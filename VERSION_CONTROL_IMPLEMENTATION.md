# Version Control System - Implementation Guide

## Overview

This document provides a comprehensive guide for implementing and using the transcript version control system. The system provides Git-like version control for transcript edits with auto-save, manual versioning, comparison, and restore capabilities.

## Architecture

### Core Components

```
lib/versioning/
├── version-manager.ts    # Core version management functions
└── diff-engine.ts        # Text comparison and diff generation

app/api/sessions/[id]/
├── versions/
│   ├── route.ts          # GET/POST version history
│   └── [version]/
│       └── route.ts      # GET/POST specific version operations

components/versioning/
├── VersionHistory.tsx    # Timeline UI component
└── DiffViewer.tsx        # Diff visualization component

hooks/
└── useVersioning.ts      # React hook for version operations
```

## Database Schema

The system uses the `TranscriptVersion` model from Prisma:

```prisma
model TranscriptVersion {
  id              String   @id @default(cuid())
  sessionId       String
  version         Int

  segments        Json     // Snapshot of all segments

  changeType      String   // Type of change
  changedBy       String   // User ID who made the change
  changeReason    String?  // Optional reason/description

  diffSummary     Json?    // Summary of changes

  createdAt       DateTime @default(now())

  session         Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@unique([sessionId, version])
  @@index([sessionId, createdAt])
  @@index([changedBy, createdAt])
}
```

## Installation

### 1. Install Dependencies

```bash
npm install diff date-fns
```

### 2. Run Database Migration

Ensure your Prisma schema includes the `TranscriptVersion` model, then run:

```bash
npx prisma db push
# or
npx prisma migrate dev --name add_version_control
```

### 3. Update Audit Types

The system automatically logs version operations. Ensure these actions exist in `types/audit.ts`:

```typescript
enum AuditAction {
  VERSION_CREATE = 'version_create',
  VERSION_RESTORE = 'version_restore',
  VERSION_COMPARE = 'version_compare',
}
```

## API Reference

### Version Manager Functions

#### `createVersion()`

Create a new version snapshot of the transcript.

```typescript
import { createVersion } from '@/lib/versioning/version-manager'

const version = await createVersion({
  sessionId: 'session_123',
  userId: 'user_456',
  changeType: 'manual_save',
  changeReason: 'Corrected speaker names',
  segmentIds: ['seg_1', 'seg_2'], // Optional: specific segments changed
})
```

**Change Types:**
- `manual_save` - User manually saved
- `auto_save` - Automatic periodic save
- `segment_edit` - Segment text edited
- `segment_add` - New segment added
- `segment_delete` - Segment deleted
- `restore` - Restored from previous version
- `pre_export` - Saved before export
- `pre_share` - Saved before sharing

#### `getVersionHistory()`

Fetch version history with pagination.

```typescript
import { getVersionHistory } from '@/lib/versioning/version-manager'

const { versions, total } = await getVersionHistory({
  sessionId: 'session_123',
  limit: 50,
  offset: 0,
})

console.log(`Found ${total} versions`)
versions.forEach(v => {
  console.log(`Version ${v.version}: ${v.changeType} by ${v.changedBy}`)
})
```

#### `compareVersions()`

Compare two versions and generate detailed diff.

```typescript
import { compareVersions } from '@/lib/versioning/version-manager'

const comparison = await compareVersions({
  sessionId: 'session_123',
  fromVersion: 5,
  toVersion: 7,
})

console.log(`Changes: +${comparison.diff.added}, -${comparison.diff.removed}, ~${comparison.diff.modified}`)
comparison.diff.details.forEach(change => {
  console.log(`${change.type}: ${change.oldText} → ${change.newText}`)
})
```

#### `restoreVersion()`

Restore a previous version (creates backup first).

```typescript
import { restoreVersion } from '@/lib/versioning/version-manager'

const restoredVersion = await restoreVersion({
  sessionId: 'session_123',
  version: 5,
  userId: 'user_456',
  reason: 'Reverting accidental deletion',
})

console.log(`Restored to version 5, created new version ${restoredVersion.version}`)
```

#### `autoSaveVersion()`

Auto-save with throttling (only saves if last version > 5 minutes old).

```typescript
import { autoSaveVersion } from '@/lib/versioning/version-manager'

const version = await autoSaveVersion({
  sessionId: 'session_123',
  userId: 'user_456',
})

if (version) {
  console.log('Auto-saved as version', version.version)
} else {
  console.log('Skipped: recent version exists')
}
```

### Diff Engine Functions

#### `calculateTextDiff()`

Calculate word-level differences between two texts.

```typescript
import { calculateTextDiff } from '@/lib/versioning/diff-engine'

const diff = calculateTextDiff(
  'The quick brown fox',
  'The fast brown dog'
)

console.log('Summary:', diff.summary)
// { added: 4, removed: 9, modified: 0, unchanged: 14 }

diff.changes.forEach(change => {
  if (change.type === 'added') {
    console.log('+ ' + change.value)
  } else if (change.type === 'removed') {
    console.log('- ' + change.value)
  }
})
```

#### `compareSegments()`

Compare two arrays of segments.

```typescript
import { compareSegments } from '@/lib/versioning/diff-engine'

const { summary, segments } = compareSegments(oldSegments, newSegments)

console.log(`Summary: ${summary.added} added, ${summary.removed} removed, ${summary.modified} modified`)

segments.forEach(seg => {
  if (seg.type === 'modified') {
    console.log(`Modified at ${formatTime(seg.startMs)}:`)
    console.log(`  Old: ${seg.oldText}`)
    console.log(`  New: ${seg.newText}`)
  }
})
```

#### `generateDiffSummary()`

Generate human-readable summary.

```typescript
import { generateDiffSummary } from '@/lib/versioning/diff-engine'

const summary = { added: 5, removed: 3, modified: 2, unchanged: 50 }
const text = generateDiffSummary(summary)
// "5 added, 3 removed, 2 modified"
```

## API Endpoints

### GET `/api/sessions/[id]/versions`

Fetch version history for a session.

**Query Parameters:**
- `limit` (number, default: 50) - Number of versions to return
- `offset` (number, default: 0) - Pagination offset

**Response:**
```json
{
  "versions": [
    {
      "id": "ver_123",
      "version": 5,
      "changeType": "manual_save",
      "changedBy": "user_456",
      "changeReason": "Fixed typos",
      "diffSummary": {
        "added": 0,
        "removed": 0,
        "modified": 3
      },
      "createdAt": "2025-01-15T10:30:00Z",
      "segments": [...]
    }
  ],
  "total": 25,
  "hasMore": true
}
```

### POST `/api/sessions/[id]/versions`

Create a new version.

**Request Body:**
```json
{
  "changeType": "manual_save",
  "changeReason": "Corrected timestamps",
  "segmentIds": ["seg_1", "seg_2"]
}
```

**Response:**
```json
{
  "id": "ver_124",
  "version": 6,
  "changeType": "manual_save",
  "changedBy": "user_456",
  "changeReason": "Corrected timestamps",
  "createdAt": "2025-01-15T10:35:00Z",
  "segments": [...]
}
```

### GET `/api/sessions/[id]/versions/[version]`

Fetch a specific version or compare two versions.

**Query Parameters:**
- `compare` (number, optional) - Compare with this version number

**Response (single version):**
```json
{
  "id": "ver_123",
  "version": 5,
  "segments": [...],
  "changeType": "manual_save",
  "createdAt": "2025-01-15T10:30:00Z"
}
```

**Response (comparison):**
```json
{
  "fromVersion": {
    "version": 5,
    "segments": [...]
  },
  "toVersion": {
    "version": 7,
    "segments": [...]
  },
  "diff": {
    "added": 2,
    "removed": 1,
    "modified": 5,
    "details": [...]
  },
  "segmentDiff": {
    "summary": {
      "added": 2,
      "removed": 1,
      "modified": 5,
      "unchanged": 45
    },
    "segments": [
      {
        "segmentId": "seg_1",
        "type": "modified",
        "oldText": "Hello world",
        "newText": "Hello there",
        "startMs": 1000,
        "endMs": 2000,
        "changes": [
          { "type": "unchanged", "value": "Hello " },
          { "type": "removed", "value": "world" },
          { "type": "added", "value": "there" }
        ]
      }
    ]
  }
}
```

### POST `/api/sessions/[id]/versions/[version]`

Restore a specific version.

**Request Body:**
```json
{
  "reason": "Reverting accidental changes"
}
```

**Response:**
```json
{
  "id": "ver_125",
  "version": 8,
  "changeType": "restore",
  "changeReason": "Restored from version 5: Reverting accidental changes",
  "createdAt": "2025-01-15T10:40:00Z"
}
```

## React Hook Usage

### Basic Setup

```tsx
'use client'

import { useEffect } from 'react'
import { useVersioning } from '@/hooks/useVersioning'

export function SessionPage({ sessionId }: { sessionId: string }) {
  const {
    versions,
    isLoading,
    comparison,
    fetchVersions,
    createVersion,
    compareVersions,
    restoreVersion,
  } = useVersioning(sessionId)

  useEffect(() => {
    fetchVersions()
  }, [fetchVersions])

  return (
    <div>
      {/* Your UI here */}
    </div>
  )
}
```

### Manual Save

```tsx
const handleSave = async () => {
  await createVersion({
    changeType: 'manual_save',
    changeReason: 'User requested save',
  })
}

<Button onClick={handleSave}>Save Version</Button>
```

### Auto-Save Implementation

```tsx
import { useEffect, useRef } from 'react'
import { useVersioning } from '@/hooks/useVersioning'

export function SessionEditor({ sessionId }: { sessionId: string }) {
  const { autoSave } = useVersioning(sessionId)
  const autoSaveInterval = useRef<NodeJS.Timeout>()

  useEffect(() => {
    // Auto-save every 5 minutes
    autoSaveInterval.current = setInterval(() => {
      autoSave()
    }, 5 * 60 * 1000)

    return () => {
      if (autoSaveInterval.current) {
        clearInterval(autoSaveInterval.current)
      }
    }
  }, [autoSave])

  return (
    <div>
      {/* Editor UI */}
    </div>
  )
}
```

### Compare Versions

```tsx
const handleCompare = async () => {
  const result = await compareVersions(5, 7)
  console.log('Comparison:', result)
}

<Button onClick={handleCompare}>Compare v5 with v7</Button>
```

### Restore Version

```tsx
const handleRestore = async () => {
  await restoreVersion(5, 'Reverting accidental changes')
}

<Button onClick={handleRestore}>Restore v5</Button>
```

## UI Components

### VersionHistory Component

Timeline view of all versions with restore and compare functionality.

```tsx
import { VersionHistory } from '@/components/versioning/VersionHistory'
import { useVersioning } from '@/hooks/useVersioning'

export function VersionPanel({ sessionId }: { sessionId: string }) {
  const {
    versions,
    compareVersions,
    restoreVersion,
    fetchVersions,
  } = useVersioning(sessionId)

  return (
    <VersionHistory
      sessionId={sessionId}
      versions={versions}
      currentVersion={versions[0]?.version}
      onCompare={compareVersions}
      onRestore={restoreVersion}
      onRefresh={fetchVersions}
    />
  )
}
```

**Features:**
- ✅ Timeline view with color-coded change types
- ✅ Version metadata (timestamp, user, reason)
- ✅ Compare mode for selecting two versions
- ✅ Restore dialog with reason input
- ✅ Diff summary badges

### DiffViewer Component

Visual diff comparison between two versions.

```tsx
import { DiffViewer } from '@/components/versioning/DiffViewer'

export function ComparisonView({ comparison }: { comparison: any }) {
  if (!comparison) return null

  return (
    <DiffViewer
      fromVersion={comparison.fromVersion.version}
      toVersion={comparison.toVersion.version}
      segments={comparison.segmentDiff.segments}
      summary={comparison.segmentDiff.summary}
    />
  )
}
```

**Features:**
- ✅ Side-by-side and inline diff modes
- ✅ Color-coded changes:
  - 🟢 Green = Added
  - 🔴 Red = Removed
  - 🟡 Yellow = Modified
  - ⚪ Gray = Unchanged
- ✅ Word-level highlighting
- ✅ Timestamp display
- ✅ Expandable modified segments
- ✅ Show/hide unchanged segments

## Integration Examples

### Complete Session Page

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useVersioning } from '@/hooks/useVersioning'
import { VersionHistory } from '@/components/versioning/VersionHistory'
import { DiffViewer } from '@/components/versioning/DiffViewer'

export function SessionDetailPage({ sessionId }: { sessionId: string }) {
  const {
    versions,
    comparison,
    fetchVersions,
    compareVersions,
    restoreVersion,
    clearComparison,
  } = useVersioning(sessionId)

  useEffect(() => {
    fetchVersions()
  }, [fetchVersions])

  return (
    <div className="container mx-auto p-6">
      <Tabs defaultValue="transcript">
        <TabsList>
          <TabsTrigger value="transcript">Transcript</TabsTrigger>
          <TabsTrigger value="versions">
            Version History ({versions.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transcript">
          {/* Your transcript editor */}
        </TabsContent>

        <TabsContent value="versions">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <VersionHistory
              sessionId={sessionId}
              versions={versions}
              currentVersion={versions[0]?.version}
              onCompare={compareVersions}
              onRestore={restoreVersion}
              onRefresh={fetchVersions}
            />

            {comparison && (
              <DiffViewer
                fromVersion={comparison.fromVersion.version}
                toVersion={comparison.toVersion.version}
                segments={comparison.segmentDiff.segments}
                summary={comparison.segmentDiff.summary}
              />
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

### Save Before Export

```tsx
import { useVersioning } from '@/hooks/useVersioning'

export function ExportButton({ sessionId }: { sessionId: string }) {
  const { saveBeforeExport } = useVersioning(sessionId)

  const handleExport = async () => {
    // Create version before export
    await saveBeforeExport()

    // Proceed with export
    await exportTranscript(sessionId)
  }

  return (
    <Button onClick={handleExport}>
      Export Transcript
    </Button>
  )
}
```

### Save Before Share

```tsx
import { useVersioning } from '@/hooks/useVersioning'

export function ShareButton({ sessionId }: { sessionId: string }) {
  const { saveBeforeShare } = useVersioning(sessionId)

  const handleShare = async () => {
    // Create version before sharing
    await saveBeforeShare()

    // Generate share link
    const shareLink = await createShareLink(sessionId)

    navigator.clipboard.writeText(shareLink)
  }

  return (
    <Button onClick={handleShare}>
      Share Transcript
    </Button>
  )
}
```

## Best Practices

### 1. Version Creation Strategy

**Always create versions:**
- ✅ Before exports
- ✅ Before sharing
- ✅ Before major edits
- ✅ On manual save requests
- ✅ Every 5 minutes during active editing (auto-save)

**Avoid creating versions:**
- ❌ On every keystroke
- ❌ Within 5 minutes of last version
- ❌ For trivial changes (use auto-save instead)

### 2. Change Reasons

Provide clear, actionable change reasons:

```typescript
// ✅ Good
changeReason: "Corrected speaker names for John and Jane"
changeReason: "Fixed timestamps in minutes 5-10"
changeReason: "Removed background noise segments"

// ❌ Bad
changeReason: "Updates"
changeReason: "Changed stuff"
changeReason: "abc"
```

### 3. Auto-Save Implementation

```typescript
// ✅ Good: Throttled, non-blocking
const autoSaveInterval = setInterval(async () => {
  try {
    await autoSave() // Returns null if too recent
  } catch (error) {
    console.error('Auto-save failed:', error)
    // Don't interrupt user
  }
}, 5 * 60 * 1000)

// ❌ Bad: Not throttled
setInterval(() => {
  createVersion({ changeType: 'auto_save' }) // Creates every time
}, 1000)
```

### 4. Error Handling

```typescript
// ✅ Good: User feedback
const handleRestore = async () => {
  try {
    await restoreVersion(5, reason)
    toast.success('Version restored successfully')
    router.refresh()
  } catch (error) {
    toast.error('Failed to restore version')
    console.error(error)
  }
}

// ❌ Bad: Silent failure
const handleRestore = async () => {
  restoreVersion(5) // No error handling
}
```

### 5. Performance Optimization

```typescript
// ✅ Good: Paginated loading
const loadMore = async () => {
  const { versions } = await fetchVersions(50, currentOffset)
  setVersions(prev => [...prev, ...versions])
}

// ❌ Bad: Load all versions
const loadAll = async () => {
  const { versions } = await fetchVersions(999999, 0)
}
```

## Troubleshooting

### Version Not Created

**Problem:** `createVersion()` doesn't create a version.

**Solutions:**
1. Check database connection
2. Verify session exists and user has access
3. Check if segments exist for the session
4. Review server logs for errors

### Auto-Save Not Working

**Problem:** Auto-save doesn't trigger.

**Solutions:**
1. Verify interval is set correctly (5 minutes = 300,000ms)
2. Check if `autoSaveVersion()` is being called
3. Verify last version is older than 5 minutes
4. Check browser console for errors

### Diff Not Showing Changes

**Problem:** DiffViewer shows "No changes".

**Solutions:**
1. Verify versions are different: `v1.segments !== v2.segments`
2. Check segment IDs are stable (not regenerated)
3. Review comparison API response
4. Ensure segments are properly serialized

### Restore Failed

**Problem:** `restoreVersion()` throws error.

**Solutions:**
1. Verify version exists
2. Check user has write permission on session
3. Ensure segments can be deleted/recreated
4. Review audit logs for conflicts

## Security Considerations

### 1. Access Control

All API endpoints verify:
- ✅ User is authenticated
- ✅ User owns the session
- ✅ Session exists

```typescript
// Implemented in all routes
const user = await requireAuth()
const session = await prisma.session.findUnique({
  where: { id: sessionId },
  select: { userId: true },
})

if (session.userId !== user.id) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
}
```

### 2. Audit Logging

All version operations are logged:
- Version creation
- Version restoration
- Version comparison

```typescript
await logAction({
  userId,
  action: AuditAction.VERSION_RESTORE,
  resource: AuditResource.TRANSCRIPT,
  resourceId: sessionId,
  metadata: { restoredFromVersion: version },
})
```

### 3. Data Validation

All inputs are validated with Zod schemas:

```typescript
const createVersionSchema = z.object({
  changeType: z.enum(['manual_save', 'auto_save', /* ... */]),
  changeReason: z.string().optional(),
  segmentIds: z.array(z.string()).optional(),
})
```

## Performance Metrics

### Storage Impact

Each version stores:
- Segment data (JSON): ~1-5 KB per minute of audio
- Metadata: ~500 bytes
- **Estimated:** 30-minute session with 10 versions ≈ 300-500 KB

### API Response Times

- `fetchVersions()`: ~50-100ms (50 versions)
- `createVersion()`: ~100-200ms (depends on segment count)
- `compareVersions()`: ~150-300ms (with diff calculation)
- `restoreVersion()`: ~300-500ms (includes backup + restore)

### Optimization Tips

1. **Paginate version history** (default 50 per page)
2. **Lazy load comparisons** (only when requested)
3. **Cache current version** in session data
4. **Index frequently queried fields** (already implemented)

## Migration Guide

### From No Version Control

If adding to existing system:

1. **Create initial versions** for all sessions:

```typescript
import { prisma } from '@/lib/prisma'
import { createVersion } from '@/lib/versioning/version-manager'

async function migrateToVersionControl() {
  const sessions = await prisma.session.findMany({
    where: {
      status: 'active',
    },
  })

  for (const session of sessions) {
    await createVersion({
      sessionId: session.id,
      userId: session.userId,
      changeType: 'manual_save',
      changeReason: 'Initial version from migration',
    })
  }
}
```

2. **Update UI** to include version history tab
3. **Enable auto-save** in session editor
4. **Add save-before hooks** to export/share flows

## Support

For issues or questions:
- Review logs in browser console and server logs
- Check Prisma Studio for database state
- Review audit logs for operation history
- Consult API endpoint documentation above

---

**Version:** 1.0.0
**Last Updated:** January 2025
**License:** MIT
