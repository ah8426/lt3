// Client exports
export { createClient as createBrowserClient } from './client'

// Server exports
export { createClient as createServerClient, createServiceClient } from './server'

// Auth utilities
export {
  signInWithOAuth,
  signOut,
  getSession,
  getUser,
  requireAuth,
  isAuthenticated,
} from './auth'

// Storage utilities
export {
  uploadAudioFile,
  getAudioFileUrl,
  getSignedAudioUrl,
  deleteAudioFile,
  listAudioFiles,
  downloadAudioFile,
} from './storage'

// Middleware
export { updateSession } from './middleware'
