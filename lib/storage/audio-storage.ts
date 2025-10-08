import { createClient } from '@supabase/supabase-js';

const BUCKET_NAME = 'audio-files';
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_MIME_TYPES = ['audio/webm', 'audio/wav', 'audio/mp3', 'audio/mpeg'];

export interface UploadResult {
  path: string;
  url: string;
  size: number;
}

export interface StorageQuota {
  used: number;
  limit: number;
  percentage: number;
}

/**
 * Upload audio file to Supabase Storage
 */
export async function uploadAudio(
  file: Blob | File,
  userId: string,
  sessionId: string,
  supabase: ReturnType<typeof createClient>
): Promise<UploadResult> {
  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  // Validate file type
  if (file instanceof File && !ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error(`Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`);
  }

  // Generate file path
  const extension = file instanceof File ? file.name.split('.').pop() : 'webm';
  const fileName = `${sessionId}.${extension}`;
  const filePath = `sessions/${userId}/${fileName}`;

  // Convert to buffer for upload
  const buffer = Buffer.from(await file.arrayBuffer());

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, buffer, {
      contentType: file instanceof File ? file.type : 'audio/webm',
      upsert: true,
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  // Generate public URL (for signed URLs, use getSignedUrl instead)
  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(filePath);

  return {
    path: filePath,
    url: urlData.publicUrl,
    size: file.size,
  };
}

/**
 * Generate signed URL for audio file (expires in 1 hour)
 */
export async function getSignedUrl(
  filePath: string,
  supabase: ReturnType<typeof createClient>,
  expiresIn: number = 3600 // 1 hour in seconds
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(filePath, expiresIn);

  if (error) {
    throw new Error(`Failed to generate signed URL: ${error.message}`);
  }

  return data.signedUrl;
}

/**
 * Delete audio file from storage
 */
export async function deleteAudio(
  filePath: string,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET_NAME).remove([filePath]);

  if (error) {
    throw new Error(`Failed to delete audio: ${error.message}`);
  }
}

/**
 * Get storage quota for user
 */
export async function getStorageQuota(
  userId: string,
  supabase: ReturnType<typeof createClient>
): Promise<StorageQuota> {
  // List all files for user
  const { data: files, error } = await supabase.storage
    .from(BUCKET_NAME)
    .list(`sessions/${userId}`);

  if (error) {
    throw new Error(`Failed to get storage quota: ${error.message}`);
  }

  // Calculate total size
  const used = files?.reduce((total, file) => total + (file.metadata?.size || 0), 0) || 0;

  // Set limit (could be fetched from user subscription plan)
  const limit = 5 * 1024 * 1024 * 1024; // 5GB default

  return {
    used,
    limit,
    percentage: (used / limit) * 100,
  };
}

/**
 * Download audio file as blob
 */
export async function downloadAudio(
  filePath: string,
  supabase: ReturnType<typeof createClient>
): Promise<Blob> {
  const { data, error } = await supabase.storage.from(BUCKET_NAME).download(filePath);

  if (error) {
    throw new Error(`Failed to download audio: ${error.message}`);
  }

  return data;
}

/**
 * Copy audio file to new location
 */
export async function copyAudio(
  sourcePath: string,
  destinationPath: string,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .copy(sourcePath, destinationPath);

  if (error) {
    throw new Error(`Failed to copy audio: ${error.message}`);
  }
}

/**
 * Move audio file to new location
 */
export async function moveAudio(
  sourcePath: string,
  destinationPath: string,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .move(sourcePath, destinationPath);

  if (error) {
    throw new Error(`Failed to move audio: ${error.message}`);
  }
}

/**
 * Get file metadata
 */
export async function getAudioMetadata(
  filePath: string,
  supabase: ReturnType<typeof createClient>
): Promise<{
  size: number;
  mimetype: string;
  lastModified: Date;
}> {
  const { data, error } = await supabase.storage.from(BUCKET_NAME).list('', {
    search: filePath,
  });

  if (error || !data || data.length === 0) {
    throw new Error('File not found');
  }

  const file = data[0];

  return {
    size: file.metadata?.size || 0,
    mimetype: file.metadata?.mimetype || 'audio/webm',
    lastModified: new Date(file.metadata?.lastModified || file.created_at),
  };
}

/**
 * Check if file exists
 */
export async function fileExists(
  filePath: string,
  supabase: ReturnType<typeof createClient>
): Promise<boolean> {
  try {
    const { data, error } = await supabase.storage.from(BUCKET_NAME).list('', {
      search: filePath,
    });

    return !error && data && data.length > 0;
  } catch {
    return false;
  }
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Validate audio file before upload
 */
export function validateAudioFile(file: File): {
  valid: boolean;
  error?: string;
} {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size must be less than ${formatFileSize(MAX_FILE_SIZE)}`,
    };
  }

  // Check file type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed: ${ALLOWED_MIME_TYPES.map(t => t.split('/')[1]).join(', ')}`,
    };
  }

  return { valid: true };
}

/**
 * Batch delete multiple files
 */
export async function batchDeleteAudio(
  filePaths: string[],
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET_NAME).remove(filePaths);

  if (error) {
    throw new Error(`Failed to batch delete audio: ${error.message}`);
  }
}

/**
 * Get all files for a user
 */
export async function getUserAudioFiles(
  userId: string,
  supabase: ReturnType<typeof createClient>
): Promise<
  Array<{
    name: string;
    path: string;
    size: number;
    created_at: string;
  }>
> {
  const { data: files, error } = await supabase.storage
    .from(BUCKET_NAME)
    .list(`sessions/${userId}`);

  if (error) {
    throw new Error(`Failed to list files: ${error.message}`);
  }

  return (
    files?.map((file) => ({
      name: file.name,
      path: `sessions/${userId}/${file.name}`,
      size: file.metadata?.size || 0,
      created_at: file.created_at,
    })) || []
  );
}
