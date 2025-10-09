// Polyfill for packages that expect browser 'self' global
if (typeof self === 'undefined') {
  ;(global as any).self = global
}
