import { gcm } from '@noble/ciphers/aes'
import { randomBytes } from '@noble/ciphers/webcrypto'
import { sha256 } from '@noble/hashes/sha256'
import { utf8ToBytes, hexToBytes, bytesToHex } from '@noble/hashes/utils'

const NONCE_LENGTH = 12 // 96 bits for GCM

// Helper function for bytes to UTF-8
function bytesToUtf8Custom(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes)
}

/**
 * Encrypt data with AES-256-GCM
 * Returns: nonce:ciphertext (both hex encoded)
 */
export async function encryptData(
  data: string,
  encryptionKey: string
): Promise<string> {
  try {
    // Derive key from password using SHA-256
    const keyBytes = sha256(utf8ToBytes(encryptionKey))

    // Generate random nonce
    const nonce = randomBytes(NONCE_LENGTH)

    // Convert plaintext to bytes
    const plaintext = utf8ToBytes(data)

    // Encrypt using AES-256-GCM
    const cipher = gcm(keyBytes, nonce)
    const ciphertext = cipher.encrypt(plaintext)

    // Format: nonce:ciphertext
    const encrypted = `${bytesToHex(nonce)}:${bytesToHex(ciphertext)}`

    return encrypted
  } catch (error) {
    console.error('Encryption error:', error)
    throw new Error('Failed to encrypt data')
  }
}

/**
 * Decrypt data
 * Input format: nonce:ciphertext
 */
export async function decryptData(
  encryptedData: string,
  encryptionKey: string
): Promise<string> {
  try {
    // Parse the encrypted format
    const parts = encryptedData.split(':')

    if (parts.length !== 2) {
      throw new Error('Invalid encrypted data format')
    }

    const [nonceHex, ciphertextHex] = parts

    // Convert hex to bytes
    const nonce = hexToBytes(nonceHex)
    const ciphertext = hexToBytes(ciphertextHex)

    // Derive key from password using SHA-256
    const keyBytes = sha256(utf8ToBytes(encryptionKey))

    // Decrypt using AES-256-GCM
    const decipher = gcm(keyBytes, nonce)
    const plaintext = decipher.decrypt(ciphertext)

    // Convert bytes to string
    return bytesToUtf8Custom(plaintext)
  } catch (error) {
    console.error('Decryption error:', error)
    throw new Error('Failed to decrypt data')
  }
}
