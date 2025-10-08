/**
 * Test suite for Cryptographic Timestamp Verification System
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { hashContent, generateNonce, createProofSignature } from '@/lib/timestamp/proof-generator'
import { verifyTimeInBounds } from '@/lib/timestamp/ntp-client'

describe('Timestamp Proof Generator', () => {
  describe('hashContent', () => {
    it('should generate consistent SHA-256 hash for same content', () => {
      const content = 'Hello, world!'
      const hash1 = hashContent(content)
      const hash2 = hashContent(content)

      expect(hash1).toBe(hash2)
      expect(hash1).toHaveLength(64) // SHA-256 hex is 64 characters
    })

    it('should generate different hashes for different content', () => {
      const content1 = 'Hello, world!'
      const content2 = 'Hello, universe!'

      const hash1 = hashContent(content1)
      const hash2 = hashContent(content2)

      expect(hash1).not.toBe(hash2)
    })

    it('should include nonce in hash when provided', () => {
      const content = 'Hello, world!'
      const nonce = 'test-nonce-12345'

      const hashWithoutNonce = hashContent(content)
      const hashWithNonce = hashContent(content, nonce)

      expect(hashWithoutNonce).not.toBe(hashWithNonce)
    })

    it('should handle empty content', () => {
      const hash = hashContent('')
      expect(hash).toHaveLength(64)
    })

    it('should handle unicode content', () => {
      const content = '你好世界 🌍 مرحبا بالعالم'
      const hash = hashContent(content)
      expect(hash).toHaveLength(64)
    })
  })

  describe('generateNonce', () => {
    it('should generate a 32-character hex string', () => {
      const nonce = generateNonce()
      expect(nonce).toHaveLength(32) // 16 bytes = 32 hex chars
      expect(nonce).toMatch(/^[0-9a-f]{32}$/)
    })

    it('should generate unique nonces', () => {
      const nonce1 = generateNonce()
      const nonce2 = generateNonce()
      const nonce3 = generateNonce()

      expect(nonce1).not.toBe(nonce2)
      expect(nonce2).not.toBe(nonce3)
      expect(nonce1).not.toBe(nonce3)
    })

    it('should generate cryptographically random nonces', () => {
      const nonces = new Set<string>()
      for (let i = 0; i < 100; i++) {
        nonces.add(generateNonce())
      }

      expect(nonces.size).toBe(100) // All unique
    })
  })

  describe('createProofSignature', () => {
    it('should generate consistent signatures for same data', () => {
      const proof = {
        contentHash: 'abc123',
        timestamp: new Date('2025-01-15T10:00:00Z'),
        nonce: 'nonce123',
      }

      const sig1 = createProofSignature(proof)
      const sig2 = createProofSignature(proof)

      expect(sig1).toBe(sig2)
      expect(sig1).toHaveLength(64)
    })

    it('should generate different signatures for different timestamps', () => {
      const proof1 = {
        contentHash: 'abc123',
        timestamp: new Date('2025-01-15T10:00:00Z'),
        nonce: 'nonce123',
      }

      const proof2 = {
        contentHash: 'abc123',
        timestamp: new Date('2025-01-15T10:00:01Z'), // 1 second later
        nonce: 'nonce123',
      }

      const sig1 = createProofSignature(proof1)
      const sig2 = createProofSignature(proof2)

      expect(sig1).not.toBe(sig2)
    })

    it('should generate different signatures for different content hashes', () => {
      const proof1 = {
        contentHash: 'abc123',
        timestamp: new Date('2025-01-15T10:00:00Z'),
        nonce: 'nonce123',
      }

      const proof2 = {
        contentHash: 'def456',
        timestamp: new Date('2025-01-15T10:00:00Z'),
        nonce: 'nonce123',
      }

      const sig1 = createProofSignature(proof1)
      const sig2 = createProofSignature(proof2)

      expect(sig1).not.toBe(sig2)
    })
  })
})

describe('NTP Client', () => {
  describe('verifyTimeInBounds', () => {
    it('should accept timestamps within bounds', () => {
      const now = new Date()
      const result = verifyTimeInBounds(now)
      expect(result).toBe(true)
    })

    it('should accept recent past timestamps', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
      const result = verifyTimeInBounds(fiveMinutesAgo)
      expect(result).toBe(true)
    })

    it('should reject timestamps in the far future', () => {
      const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000)
      const result = verifyTimeInBounds(twoHoursFromNow)
      expect(result).toBe(false)
    })

    it('should accept timestamps near the future bound (within 1 hour)', () => {
      const thirtyMinutesFromNow = new Date(Date.now() + 30 * 60 * 1000)
      const result = verifyTimeInBounds(thirtyMinutesFromNow)
      expect(result).toBe(true)
    })

    it('should reject timestamps before 2020', () => {
      const year2019 = new Date('2019-12-31T23:59:59Z')
      const result = verifyTimeInBounds(year2019)
      expect(result).toBe(false)
    })

    it('should accept timestamps after 2020', () => {
      const year2021 = new Date('2021-01-01T00:00:00Z')
      const result = verifyTimeInBounds(year2021)
      expect(result).toBe(true)
    })

    it('should respect custom min date', () => {
      const timestamp = new Date('2023-01-01T00:00:00Z')
      const minDate = new Date('2023-06-01T00:00:00Z')

      const result = verifyTimeInBounds(timestamp, minDate)
      expect(result).toBe(false)
    })

    it('should respect custom max date', () => {
      const timestamp = new Date('2024-12-31T23:59:59Z')
      const maxDate = new Date('2024-06-01T00:00:00Z')

      const result = verifyTimeInBounds(timestamp, undefined, maxDate)
      expect(result).toBe(false)
    })

    it('should accept timestamp within custom bounds', () => {
      const timestamp = new Date('2024-06-15T12:00:00Z')
      const minDate = new Date('2024-01-01T00:00:00Z')
      const maxDate = new Date('2024-12-31T23:59:59Z')

      const result = verifyTimeInBounds(timestamp, minDate, maxDate)
      expect(result).toBe(true)
    })
  })
})

describe('Content Hashing Edge Cases', () => {
  it('should handle very long content', () => {
    const longContent = 'A'.repeat(1000000) // 1MB of text
    const hash = hashContent(longContent)
    expect(hash).toHaveLength(64)
  })

  it('should handle newlines and whitespace', () => {
    const content1 = 'Line 1\nLine 2\nLine 3'
    const content2 = 'Line 1\r\nLine 2\r\nLine 3'

    const hash1 = hashContent(content1)
    const hash2 = hashContent(content2)

    // Different line endings should produce different hashes
    expect(hash1).not.toBe(hash2)
  })

  it('should be case-sensitive', () => {
    const content1 = 'Hello, World!'
    const content2 = 'hello, world!'

    const hash1 = hashContent(content1)
    const hash2 = hashContent(content2)

    expect(hash1).not.toBe(hash2)
  })

  it('should handle special characters', () => {
    const content = '!@#$%^&*()_+-={}[]|\\:";\'<>?,./~`'
    const hash = hashContent(content)
    expect(hash).toHaveLength(64)
  })

  it('should produce deterministic hashes', () => {
    const content = 'Test content for determinism'
    const hashes = new Set<string>()

    for (let i = 0; i < 10; i++) {
      hashes.add(hashContent(content))
    }

    expect(hashes.size).toBe(1) // All hashes are identical
  })
})

describe('Proof Signature Validation', () => {
  it('should detect tampering with content hash', () => {
    const originalProof = {
      contentHash: 'original_hash',
      timestamp: new Date('2025-01-15T10:00:00Z'),
      nonce: 'nonce123',
    }

    const tamperedProof = {
      contentHash: 'tampered_hash',
      timestamp: new Date('2025-01-15T10:00:00Z'),
      nonce: 'nonce123',
    }

    const originalSig = createProofSignature(originalProof)
    const tamperedSig = createProofSignature(tamperedProof)

    expect(originalSig).not.toBe(tamperedSig)
  })

  it('should detect timestamp modifications', () => {
    const originalProof = {
      contentHash: 'content_hash',
      timestamp: new Date('2025-01-15T10:00:00Z'),
      nonce: 'nonce123',
    }

    const modifiedProof = {
      contentHash: 'content_hash',
      timestamp: new Date('2025-01-15T11:00:00Z'), // Modified timestamp
      nonce: 'nonce123',
    }

    const originalSig = createProofSignature(originalProof)
    const modifiedSig = createProofSignature(modifiedProof)

    expect(originalSig).not.toBe(modifiedSig)
  })

  it('should detect nonce changes', () => {
    const originalProof = {
      contentHash: 'content_hash',
      timestamp: new Date('2025-01-15T10:00:00Z'),
      nonce: 'original_nonce',
    }

    const tamperedProof = {
      contentHash: 'content_hash',
      timestamp: new Date('2025-01-15T10:00:00Z'),
      nonce: 'tampered_nonce',
    }

    const originalSig = createProofSignature(originalProof)
    const tamperedSig = createProofSignature(tamperedProof)

    expect(originalSig).not.toBe(tamperedSig)
  })
})

describe('Integration Tests', () => {
  it('should create verifiable proof chain', () => {
    const content1 = 'First segment'
    const content2 = 'Second segment'
    const content3 = 'Third segment'

    const nonce1 = generateNonce()
    const nonce2 = generateNonce()
    const nonce3 = generateNonce()

    const hash1 = hashContent(content1, nonce1)
    const hash2 = hashContent(content2, nonce2)
    const hash3 = hashContent(content3, nonce3)

    const timestamp1 = new Date('2025-01-15T10:00:00Z')
    const timestamp2 = new Date('2025-01-15T10:05:00Z')
    const timestamp3 = new Date('2025-01-15T10:10:00Z')

    const sig1 = createProofSignature({ contentHash: hash1, timestamp: timestamp1, nonce: nonce1 })
    const sig2 = createProofSignature({ contentHash: hash2, timestamp: timestamp2, nonce: nonce2 })
    const sig3 = createProofSignature({ contentHash: hash3, timestamp: timestamp3, nonce: nonce3 })

    // All signatures should be unique
    expect(sig1).not.toBe(sig2)
    expect(sig2).not.toBe(sig3)
    expect(sig1).not.toBe(sig3)

    // All should be valid SHA-256 hashes
    expect(sig1).toHaveLength(64)
    expect(sig2).toHaveLength(64)
    expect(sig3).toHaveLength(64)
  })
})
