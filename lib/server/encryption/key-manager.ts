import { gcm } from '@noble/ciphers/aes';
import { randomBytes } from '@noble/ciphers/webcrypto';
import { hkdf } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha256';
import { utf8ToBytes, bytesToUtf8, hexToBytes, bytesToHex } from '@noble/hashes/utils';

/**
 * Secure API Key Management System
 *
 * Security Features:
 * - AES-256-GCM encryption
 * - HKDF key derivation with user-specific salts
 * - Random nonces for each encryption
 * - Server-side only operations
 * - Key rotation support
 */

const ENCRYPTION_VERSION = 1;
const KEY_LENGTH = 32; // 256 bits for AES-256
const NONCE_LENGTH = 12; // 96 bits for GCM
const TAG_LENGTH = 16; // 128 bits authentication tag

/**
 * Get the master encryption key from environment variable
 * This key should be stored securely (e.g., in environment variables or secrets manager)
 */
function getMasterKey(): Uint8Array {
  const masterKeyHex = process.env.ENCRYPTION_MASTER_KEY;

  if (!masterKeyHex) {
    throw new Error(
      'ENCRYPTION_MASTER_KEY not found in environment variables. ' +
      'Generate one using: openssl rand -hex 32'
    );
  }

  if (masterKeyHex.length !== 64) {
    throw new Error('ENCRYPTION_MASTER_KEY must be 32 bytes (64 hex characters)');
  }

  return hexToBytes(masterKeyHex);
}

/**
 * Derive a user-specific encryption key using HKDF
 * This ensures each user's keys are encrypted with a different derived key
 */
function deriveUserKey(userId: string, version: number = ENCRYPTION_VERSION): Uint8Array {
  const masterKey = getMasterKey();
  const info = utf8ToBytes(`api-key-encryption-v${version}`);
  const salt = utf8ToBytes(`user:${userId}`);

  // Use HKDF to derive a user-specific key
  return hkdf(sha256, masterKey, salt, info, KEY_LENGTH);
}

/**
 * Encrypt API key with AES-256-GCM
 * Returns: version:nonce:ciphertext:tag (all hex encoded)
 */
export async function encryptAPIKey(
  apiKey: string,
  userId: string
): Promise<string> {
  try {
    // Derive user-specific key
    const key = deriveUserKey(userId);

    // Generate random nonce
    const nonce = randomBytes(NONCE_LENGTH);

    // Convert plaintext to bytes
    const plaintext = utf8ToBytes(apiKey);

    // Encrypt using AES-256-GCM
    const cipher = gcm(key, nonce);
    const ciphertext = cipher.encrypt(plaintext);

    // Format: version:nonce:ciphertext (ciphertext includes auth tag)
    const encrypted = `${ENCRYPTION_VERSION}:${bytesToHex(nonce)}:${bytesToHex(ciphertext)}`;

    return encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt API key');
  }
}

/**
 * Decrypt API key
 * Input format: version:nonce:ciphertext
 */
export async function decryptAPIKey(
  encryptedKey: string,
  userId: string
): Promise<string> {
  try {
    // Parse the encrypted format
    const parts = encryptedKey.split(':');

    if (parts.length !== 3) {
      throw new Error('Invalid encrypted key format');
    }

    const [versionStr, nonceHex, ciphertextHex] = parts;
    const version = parseInt(versionStr, 10);

    if (version !== ENCRYPTION_VERSION) {
      throw new Error(`Unsupported encryption version: ${version}`);
    }

    // Convert hex to bytes
    const nonce = hexToBytes(nonceHex);
    const ciphertext = hexToBytes(ciphertextHex);

    // Derive the same user-specific key
    const key = deriveUserKey(userId, version);

    // Decrypt using AES-256-GCM
    const decipher = gcm(key, nonce);
    const plaintext = decipher.decrypt(ciphertext);

    // Convert bytes to string
    return bytesToUtf8(plaintext);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt API key');
  }
}

/**
 * Re-encrypt an API key with a new version (for key rotation)
 */
export async function rotateAPIKey(
  encryptedKey: string,
  userId: string,
  newVersion: number = ENCRYPTION_VERSION
): Promise<string> {
  try {
    // Decrypt with old key
    const plaintext = await decryptAPIKey(encryptedKey, userId);

    // Re-encrypt with new version
    // Note: In production, you'd use a different master key for the new version
    return await encryptAPIKey(plaintext, userId);
  } catch (error) {
    console.error('Key rotation error:', error);
    throw new Error('Failed to rotate API key');
  }
}

/**
 * Validate that an encrypted key can be decrypted
 */
export async function validateEncryptedKey(
  encryptedKey: string,
  userId: string
): Promise<boolean> {
  try {
    await decryptAPIKey(encryptedKey, userId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate a secure random encryption key for initialization
 * Use this to generate ENCRYPTION_MASTER_KEY
 */
export function generateMasterKey(): string {
  const key = randomBytes(KEY_LENGTH);
  return bytesToHex(key);
}

/**
 * Mask an API key for display purposes
 * Shows first 4 and last 4 characters, masks the rest
 */
export function maskAPIKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 8) {
    return '••••••••';
  }

  const start = apiKey.substring(0, 4);
  const end = apiKey.substring(apiKey.length - 4);
  const middle = '•'.repeat(Math.min(apiKey.length - 8, 20));

  return `${start}${middle}${end}`;
}

/**
 * Validate API key format (basic check)
 */
export function validateAPIKeyFormat(apiKey: string, provider: string): boolean {
  if (!apiKey || typeof apiKey !== 'string') {
    return false;
  }

  // Provider-specific format validation
  switch (provider) {
    case 'openai':
      return /^sk-[a-zA-Z0-9]{48}$/.test(apiKey);
    case 'anthropic':
      return /^sk-ant-[a-zA-Z0-9-_]{95,}$/.test(apiKey);
    case 'deepgram':
      return /^[a-zA-Z0-9]{40}$/.test(apiKey);
    case 'assemblyai':
      return /^[a-f0-9]{32}$/.test(apiKey);
    case 'google':
      return /^AIza[a-zA-Z0-9_-]{35}$/.test(apiKey);
    case 'openrouter':
      return /^sk-or-v1-[a-zA-Z0-9]{64}$/.test(apiKey);
    default:
      // Generic validation: at least 20 characters
      return apiKey.length >= 20;
  }
}
