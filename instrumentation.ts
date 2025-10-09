export function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Polyfill 'self' for packages that expect it in browser environment (Supabase realtime, etc.)
    if (typeof (global as any).self === 'undefined') {
      ;(global as any).self = global
      ;(globalThis as any).self = globalThis
    }
  }
}
