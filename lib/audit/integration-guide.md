# Audit Logging Integration Guide

This guide shows how to integrate audit logging for settings changes, share links, and exports when those features are implemented.

## Settings Changes

When implementing settings update endpoints, add audit logging:

```typescript
import { logAction } from '@/lib/audit/logger';
import { AuditAction, AuditResource } from '@/types/audit';

// Example: After updating user settings
await logAction({
  userId: user.id,
  action: AuditAction.SETTINGS_UPDATE,
  resource: AuditResource.SETTINGS,
  metadata: {
    settingKey: 'theme',
    oldValue: 'light',
    newValue: 'dark',
  },
});

// Example: After updating preferences
await logAction({
  userId: user.id,
  action: AuditAction.PREFERENCE_UPDATE,
  resource: AuditResource.SETTINGS,
  metadata: {
    preferenceType: 'notifications',
    enabled: true,
  },
});
```

## Share Link Generation

When implementing share link creation:

```typescript
// After creating a share link
await logAction({
  userId: user.id,
  action: AuditAction.SHARE_LINK_CREATE,
  resource: AuditResource.SHARE_LINK,
  resourceId: shareLinkId,
  metadata: {
    sessionId: session.id,
    expiresAt: shareLink.expiresAt,
    permissions: 'read-only',
  },
});

// After deleting a share link
await logAction({
  userId: user.id,
  action: AuditAction.SHARE_LINK_DELETE,
  resource: AuditResource.SHARE_LINK,
  resourceId: shareLinkId,
  metadata: {
    sessionId: session.id,
  },
});
```

## Document Exports

When implementing document export functionality:

```typescript
// After exporting a document
await logAction({
  userId: user.id,
  action: AuditAction.DOCUMENT_EXPORT,
  resource: AuditResource.DOCUMENT,
  resourceId: documentId,
  metadata: {
    format: 'pdf', // or 'docx', 'txt', etc.
    sessionId: session.id,
    includedSections: ['transcript', 'summary', 'citations'],
  },
});
```

## Legal Holds

For records that must be retained for legal or compliance purposes:

```typescript
// Set a retention period
await logAction({
  userId: user.id,
  action: AuditAction.SESSION_DELETE,
  resource: AuditResource.SESSION,
  resourceId: sessionId,
  retentionUntil: new Date('2030-12-31'), // Retain until this date
  metadata: {
    reason: 'Legal hold - Case #12345',
  },
});
```

## Best Practices

1. **Always log after successful operations**: Only log after the database transaction succeeds
2. **Use meaningful metadata**: Include context that helps understand the action
3. **Don't log sensitive data**: Never log passwords, full API keys, or PII beyond user ID
4. **Use immediate logging for critical actions**: Use `logActionImmediate()` for security-critical events
5. **Include resource IDs**: Always include the resource ID when available for traceability

## Immediate Logging

For critical security events that should be logged immediately (not batched):

```typescript
import { logActionImmediate } from '@/lib/audit/logger';

await logActionImmediate({
  userId: user.id,
  action: AuditAction.LOGIN_FAILED,
  resource: AuditResource.USER,
  metadata: {
    reason: 'Invalid credentials',
    attempts: 3,
  },
});
```
