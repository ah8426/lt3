// Polyfill 'self' for packages that expect browser environment
if (typeof globalThis.self === 'undefined') {
  globalThis.self = globalThis
  global.self = global
}
