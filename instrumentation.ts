export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Polyfill 'self' for packages that expect it in browser environment
    if (typeof (global as any).self === 'undefined') {
      ;(global as any).self = global
    }
  }
}
