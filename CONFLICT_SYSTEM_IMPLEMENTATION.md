# Conflict of Interest Detection System - Implementation Guide

**Status:** Core Libraries & API Complete ✅
**Remaining:** UI Components (Implementation Templates Provided Below)

---

## ✅ Completed Implementation

### 1. Core Libraries

#### ✅ `lib/conflicts/name-matcher.ts` (420+ lines)
**Functions:**
- `fuzzyMatch()` - Fuzzy string matching using fuzzysort
- `fuzzyMatchMultiple()` - Match against multiple targets
- `normalizeName()` - Handle name variations (Corp, Inc, LLC, etc.)
- `normalizeNames()` - Batch normalization
- `detectCompanyNames()` - Extract company names from text
- `extractEntities()` - Find people and organizations using NLP
- `calculateTextSimilarity()` - TF-IDF similarity scoring
- `areNamesSimilar()` - Check if names are likely the same
- `splitName()`, `getInitials()`, `matchesInitials()` - Name utilities

**Features:**
- Handles legal entity variations (Corp vs Corporation, Inc vs Incorporated)
- Removes common prefixes ("The", "A", "An")
- Normalizes punctuation and spacing
- Pattern matching for company structures
- NLP-based entity recognition
- TF-IDF document similarity

#### ✅ `lib/conflicts/conflict-checker.ts` (550+ lines)
**Functions:**
- `checkConflicts()` - Main conflict detection engine
- `saveConflictCheck()` - Persist results to database
- `updateConflictResolution()` - Update conflict status

**Risk Levels:**
- `NONE` - No conflicts
- `LOW` - Minor similarities
- `MEDIUM` - Requires review
- `HIGH` - Significant conflicts
- `CRITICAL` - Must decline engagement

**Conflict Types:**
- Client vs. existing client
- Client vs. adverse party (CRITICAL)
- Adverse party vs. existing client (CRITICAL)
- Adverse party vs. adverse party
- Matter description similarity
- Entity extraction matches

**Search Strategy:**
1. Search client name against all past clients
2. Search client name against all adverse parties (CRITICAL if match)
3. Search adverse parties against all clients (CRITICAL if match)
4. Search adverse parties against other adverse parties
5. Search matter descriptions for similarity
6. Extract entities from descriptions and cross-check

### 2. API Routes

#### ✅ `app/api/conflicts/check/route.ts`
**POST** `/api/conflicts/check`
- Accepts: clientName, adverseParties[], companyNames[], matterDescription
- Returns: ConflictCheckResult with conflicts, risk level, recommendation
- Saves result to database

#### ✅ `app/api/conflicts/[id]/route.ts`
**GET** `/api/conflicts/[id]` - Get conflict check details
**PATCH** `/api/conflicts/[id]` - Update resolution status

### 3. React Hook

#### ✅ `hooks/useConflicts.ts`
- `runConflictCheck()` - Execute conflict search
- `updateResolution()` - Update conflict status
- `conflictCheck` - Current check data
- React Query integration with caching
- Toast notifications based on risk level

---

## 📋 Implementation Templates for UI Components

### Component 1: ConflictCard.tsx

```tsx
'use client'

import { ConflictMatch, RiskLevel } from '@/lib/conflicts/conflict-checker'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, AlertCircle, Info, XCircle } from 'lucide-react'
import { format } from 'date-fns'

interface ConflictCardProps {
  conflict: ConflictMatch
  onSelect?: () => void
}

export function ConflictCard({ conflict, onSelect }: ConflictCardProps) {
  const getRiskColor = (risk: RiskLevel) => {
    switch (risk) {
      case 'critical': return 'bg-red-600 text-white'
      case 'high': return 'bg-orange-500 text-white'
      case 'medium': return 'bg-yellow-500 text-white'
      case 'low': return 'bg-blue-500 text-white'
      default: return 'bg-gray-500 text-white'
    }
  }

  const getRiskIcon = (risk: RiskLevel) => {
    switch (risk) {
      case 'critical': return <XCircle className="h-4 w-4" />
      case 'high': return <AlertTriangle className="h-4 w-4" />
      case 'medium': return <AlertCircle className="h-4 w-4" />
      default: return <Info className="h-4 w-4" />
    }
  }

  return (
    <Card
      className={`cursor-pointer hover:border-primary transition-colors ${
        conflict.riskLevel === 'critical' ? 'border-red-500' : ''
      }`}
      onClick={onSelect}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-base">{conflict.matterTitle}</CardTitle>
          <Badge className={getRiskColor(conflict.riskLevel)}>
            {getRiskIcon(conflict.riskLevel)}
            <span className="ml-1">{conflict.riskLevel.toUpperCase()}</span>
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">Matched:</span>
            <p className="font-medium">{conflict.matchedName}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Query:</span>
            <p className="font-medium">{conflict.queryName}</p>
          </div>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Similarity:</span>
          <Badge variant="outline">{Math.round(conflict.similarityScore * 100)}%</Badge>
        </div>
        <div className="text-xs text-muted-foreground">
          {format(new Date(conflict.matchedAt), 'PPP')}
        </div>
      </CardContent>
    </Card>
  )
}
```

### Component 2: ConflictReport.tsx

```tsx
'use client'

import { ConflictCheckResult } from '@/lib/conflicts/conflict-checker'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ConflictCard } from './ConflictCard'
import { Shield, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'

interface ConflictReportProps {
  result: ConflictCheckResult
  onConflictSelect?: (conflictId: string) => void
}

export function ConflictReport({ result, onConflictSelect }: ConflictReportProps) {
  const getRecommendationColor = () => {
    switch (result.recommendation) {
      case 'decline': return 'destructive'
      case 'review': return 'default'
      default: return 'default'
    }
  }

  const getRecommendationIcon = () => {
    switch (result.recommendation) {
      case 'decline': return <XCircle className="h-5 w-5" />
      case 'review': return <AlertTriangle className="h-5 w-5" />
      default: return <CheckCircle2 className="h-5 w-5" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Summary Alert */}
      <Alert variant={getRecommendationColor()}>
        {getRecommendationIcon()}
        <AlertDescription className="ml-2">
          <strong>{result.summary}</strong>
        </AlertDescription>
      </Alert>

      {/* Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Conflict Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-2xl font-bold">{result.totalMatches}</div>
              <div className="text-sm text-muted-foreground">Total Matches</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">{result.highRiskCount}</div>
              <div className="text-sm text-muted-foreground">High Risk</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-600">{result.mediumRiskCount}</div>
              <div className="text-sm text-muted-foreground">Medium Risk</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">{result.lowRiskCount}</div>
              <div className="text-sm text-muted-foreground">Low Risk</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conflict List */}
      {result.conflicts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Detected Conflicts</h3>
          {result.conflicts.map((conflict) => (
            <ConflictCard
              key={conflict.id}
              conflict={conflict}
              onSelect={() => onConflictSelect?.(conflict.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

### Component 3: Conflict Check Page

**File:** `app/(app)/conflicts/page.tsx`

```tsx
'use client'

import { useState } from 'react'
import { useConflicts } from '@/hooks/useConflicts'
import { ConflictReport } from '@/components/conflicts/ConflictReport'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Shield, Plus, X } from 'lucide-react'

export default function ConflictsPage() {
  const [clientName, setClientName] = useState('')
  const [adverseParties, setAdverseParties] = useState<string[]>([''])
  const [companyNames, setCompanyNames] = useState<string[]>([''])
  const [matterDescription, setMatterDescription] = useState('')
  const [result, setResult] = useState<any>(null)
  const [isChecking, setIsChecking] = useState(false)

  const { runConflictCheck } = useConflicts()

  const handleAddAdverseParty = () => {
    setAdverseParties([...adverseParties, ''])
  }

  const handleRemoveAdverseParty = (index: number) => {
    setAdverseParties(adverseParties.filter((_, i) => i !== index))
  }

  const handleAddCompany = () => {
    setCompanyNames([...companyNames, ''])
  }

  const handleRemoveCompany = (index: number) => {
    setCompanyNames(companyNames.filter((_, i) => i !== index))
  }

  const handleRunCheck = async () => {
    setIsChecking(true)
    try {
      const result = await runConflictCheck({
        clientName,
        adverseParties: adverseParties.filter(p => p.trim()),
        companyNames: companyNames.filter(c => c.trim()),
        matterDescription,
        saveResult: true,
      })
      setResult(result)
    } finally {
      setIsChecking(false)
    }
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="h-8 w-8" />
          Conflict of Interest Check
        </h1>
        <p className="text-muted-foreground mt-2">
          Check for potential conflicts before accepting new matters
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search Parameters</CardTitle>
          <CardDescription>
            Enter client, adverse party, and matter information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Client Name */}
          <div className="space-y-2">
            <Label htmlFor="client-name">Client Name *</Label>
            <Input
              id="client-name"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Enter client name..."
            />
          </div>

          {/* Adverse Parties */}
          <div className="space-y-2">
            <Label>Adverse Parties</Label>
            {adverseParties.map((party, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={party}
                  onChange={(e) => {
                    const updated = [...adverseParties]
                    updated[index] = e.target.value
                    setAdverseParties(updated)
                  }}
                  placeholder="Enter adverse party name..."
                />
                {adverseParties.length > 1 && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleRemoveAdverseParty(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={handleAddAdverseParty}>
              <Plus className="h-4 w-4 mr-2" />
              Add Adverse Party
            </Button>
          </div>

          {/* Company Names */}
          <div className="space-y-2">
            <Label>Company Names</Label>
            {companyNames.map((company, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={company}
                  onChange={(e) => {
                    const updated = [...companyNames]
                    updated[index] = e.target.value
                    setCompanyNames(updated)
                  }}
                  placeholder="Enter company name..."
                />
                {companyNames.length > 1 && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleRemoveCompany(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={handleAddCompany}>
              <Plus className="h-4 w-4 mr-2" />
              Add Company
            </Button>
          </div>

          {/* Matter Description */}
          <div className="space-y-2">
            <Label htmlFor="matter-description">Matter Description</Label>
            <Textarea
              id="matter-description"
              value={matterDescription}
              onChange={(e) => setMatterDescription(e.target.value)}
              placeholder="Enter matter description..."
              rows={4}
            />
          </div>

          <Button
            onClick={handleRunCheck}
            disabled={!clientName.trim() || isChecking}
            className="w-full"
          >
            {isChecking ? 'Checking...' : 'Run Conflict Check'}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {result && <ConflictReport result={result} />}
    </div>
  )
}
```

---

## 🔧 Database Schema Required

Add to `prisma/schema.prisma`:

```prisma
model ConflictCheck {
  id                String    @id @default(cuid())
  userId            String    @db.Uuid

  // Search parameters
  clientName        String?
  adverseParties    String[]  @default([])
  companyNames      String[]  @default([])
  matterDescription String?   @db.Text

  // Results
  riskLevel         String    // none, low, medium, high, critical
  totalMatches      Int       @default(0)
  highRiskCount     Int       @default(0)
  mediumRiskCount   Int       @default(0)
  lowRiskCount      Int       @default(0)
  recommendation    String    // proceed, review, decline
  summary           String    @db.Text
  conflicts         Json      // Array of ConflictMatch

  // Resolution
  status            String    @default("pending") // pending, waived, declined, screened, cleared
  resolutionNotes   String?   @db.Text
  resolvedAt        DateTime?
  resolvedBy        String?

  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
  @@index([riskLevel])
  @@index([status])
  @@map("conflict_checks")
}
```

---

## 🚀 Integration with Matter Creation

Add to `app/(app)/matters/new/page.tsx`:

```tsx
// Before saving matter
const conflictResult = await runConflictCheck({
  clientName: formData.clientName,
  adverseParties: [formData.adverseParty],
  matterDescription: formData.description,
  saveResult: true,
})

// Block if CRITICAL or HIGH risk
if (conflictResult.riskLevel === 'critical') {
  alert('CRITICAL CONFLICT DETECTED. Cannot proceed.')
  return
}

if (conflictResult.riskLevel === 'high') {
  const proceed = confirm('HIGH RISK CONFLICT. Proceed anyway?')
  if (!proceed) return
}

// Show warning for MEDIUM risk
if (conflictResult.riskLevel === 'medium') {
  const proceed = confirm('Potential conflicts detected. Review recommended. Proceed?')
  if (!proceed) return
}

// Proceed with matter creation
```

---

## ⚙️ Settings Integration

Add to `components/settings/TranscriptSettings.tsx`:

```tsx
// Conflict Detection Settings
enableConflictChecks: boolean
requireConflictCheck: boolean
blockHighRiskMatters: boolean
conflictThreshold: number // 0.7 = 70% similarity threshold
autoCheckOnMatterCreate: boolean
```

---

## 📊 Features Implemented

✅ **Fuzzy Name Matching**
- fuzzysort integration
- Legal entity normalization
- Variation handling

✅ **NLP Entity Extraction**
- Company name detection
- Person/organization classification
- natural library integration

✅ **Comprehensive Conflict Search**
- Client vs. client
- Client vs. adverse party (CRITICAL)
- Adverse vs. client (CRITICAL)
- Adverse vs. adverse
- Matter description similarity
- Entity cross-checking

✅ **Risk Assessment**
- 5 risk levels (None → Critical)
- Similarity scoring
- Context-aware risk calculation
- Recommendation engine

✅ **API Integration**
- POST /api/conflicts/check
- GET /api/conflicts/[id]
- PATCH /api/conflicts/[id]
- Zod validation
- Error handling

✅ **React Hook**
- React Query integration
- Toast notifications
- Loading states
- Error handling

---

## 📝 Next Steps

1. **Create UI Components** (use templates above)
2. **Add Database Migration** for ConflictCheck model
3. **Integrate with Matter Creation** flow
4. **Add Settings** for conflict detection
5. **Test** with sample data

---

**Status:** Core system ready for UI implementation! 🎉
