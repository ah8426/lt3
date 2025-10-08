export enum AuditAction {
  // Authentication
  LOGIN = 'login',
  LOGOUT = 'logout',
  LOGIN_FAILED = 'login_failed',

  // Session operations
  SESSION_CREATE = 'session_create',
  SESSION_UPDATE = 'session_update',
  SESSION_DELETE = 'session_delete',
  SESSION_ARCHIVE = 'session_archive',

  // Transcript operations
  TRANSCRIPT_CREATE = 'transcript_create',
  TRANSCRIPT_UPDATE = 'transcript_update',
  TRANSCRIPT_DELETE = 'transcript_delete',
  TRANSCRIPT_EDIT = 'transcript_edit',

  // API key operations
  API_KEY_CREATE = 'api_key_create',
  API_KEY_UPDATE = 'api_key_update',
  API_KEY_DELETE = 'api_key_delete',
  API_KEY_TEST = 'api_key_test',

  // Settings operations
  SETTINGS_UPDATE = 'settings_update',
  PREFERENCE_UPDATE = 'preference_update',

  // Sharing and export
  SHARE_LINK_CREATE = 'share_link_create',
  SHARE_LINK_DELETE = 'share_link_delete',
  DOCUMENT_EXPORT = 'document_export',

  // Segment operations
  SEGMENT_CREATE = 'segment_create',
  SEGMENT_UPDATE = 'segment_update',
  SEGMENT_DELETE = 'segment_delete',
  SEGMENT_MERGE = 'segment_merge',
  SEGMENT_SPLIT = 'segment_split',

  // Version control operations
  VERSION_CREATE = 'version_create',
  VERSION_RESTORE = 'version_restore',
  VERSION_COMPARE = 'version_compare',
}

export enum AuditResource {
  USER = 'user',
  SESSION = 'session',
  TRANSCRIPT = 'transcript',
  SEGMENT = 'segment',
  API_KEY = 'api_key',
  SETTINGS = 'settings',
  SHARE_LINK = 'share_link',
  DOCUMENT = 'document',
}

export interface AuditLog {
  id: string;
  userId: string;
  action: AuditAction;
  resource: AuditResource;
  resourceId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  location?: string;
  timestamp: Date;
  retentionUntil?: Date; // For legal holds
}

export interface AuditLogFilter {
  userId?: string;
  action?: AuditAction | AuditAction[];
  resource?: AuditResource | AuditResource[];
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export interface AuditLogResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
