export function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Validate environment variables on startup
    const { validateEnv, printEnvStatus } = require('./lib/config/env-validator');

    try {
      validateEnv();
      if (process.env.NODE_ENV === 'development') {
        printEnvStatus();
      }
    } catch (error) {
      console.error(error);
      // In development, we warn but don't exit
      // In production, this will prevent the app from starting
      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      }
    }

    // Polyfill 'self' for packages that expect it in browser environment (Supabase realtime, etc.)
    if (typeof (global as any).self === 'undefined') {
      ;(global as any).self = global
      ;(globalThis as any).self = globalThis
    }
  }
}
