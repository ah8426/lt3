import { createClient } from './server'

const AUDIO_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || 'audio-files'

/**
 * Upload audio file to Supabase Storage
 */
export async function uploadAudioFile(
  file: File,
  path: string,
  options?: {
    cacheControl?: string
    upsert?: boolean
  }
) {
  const supabase = await createClient()

  const { data, error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .upload(path, file, {
      cacheControl: options?.cacheControl || '3600',
      upsert: options?.upsert || false,
    })

  if (error) {
    throw error
  }

  return data
}

/**
 * Get public URL for an audio file
 */
export async function getAudioFileUrl(path: string) {
  const supabase = await createClient()

  const { data } = supabase.storage
    .from(AUDIO_BUCKET)
    .getPublicUrl(path)

  return data.publicUrl
}

/**
 * Get signed URL for private audio file
 */
export async function getSignedAudioUrl(path: string, expiresIn: number = 3600) {
  const supabase = await createClient()

  const { data, error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .createSignedUrl(path, expiresIn)

  if (error) {
    throw error
  }

  return data.signedUrl
}

/**
 * Delete audio file from storage
 */
export async function deleteAudioFile(path: string) {
  const supabase = await createClient()

  const { error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .remove([path])

  if (error) {
    throw error
  }
}

/**
 * List audio files in a directory
 */
export async function listAudioFiles(path: string) {
  const supabase = await createClient()

  const { data, error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .list(path)

  if (error) {
    throw error
  }

  return data
}

/**
 * Download audio file as blob
 */
export async function downloadAudioFile(path: string) {
  const supabase = await createClient()

  const { data, error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .download(path)

  if (error) {
    throw error
  }

  return data
}
