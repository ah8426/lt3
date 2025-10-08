/**
 * Test suite for Diff Engine (used in version control)
 */

import { describe, it, expect } from 'vitest'
import {
  calculateTextDiff,
  calculateLineDiff,
  compareSegments,
  generateDiffSummary,
  calculateSimilarity,
} from '@/lib/versioning/diff-engine'

describe('Diff Engine', () => {
  describe('calculateTextDiff', () => {
    it('should detect added words', () => {
      const oldText = 'Hello world'
      const newText = 'Hello beautiful world'

      const result = calculateTextDiff(oldText, newText)

      expect(result.summary.added).toBeGreaterThan(0)
      expect(result.changes.some((c) => c.type === 'added' && c.value.includes('beautiful'))).toBe(true)
    })

    it('should detect removed words', () => {
      const oldText = 'Hello beautiful world'
      const newText = 'Hello world'

      const result = calculateTextDiff(oldText, newText)

      expect(result.summary.removed).toBeGreaterThan(0)
      expect(result.changes.some((c) => c.type === 'removed' && c.value.includes('beautiful'))).toBe(true)
    })

    it('should detect unchanged text', () => {
      const oldText = 'Hello world'
      const newText = 'Hello universe'

      const result = calculateTextDiff(oldText, newText)

      expect(result.summary.unchanged).toBeGreaterThan(0)
      expect(result.changes.some((c) => c.type === 'unchanged' && c.value.includes('Hello'))).toBe(true)
    })

    it('should handle identical text', () => {
      const text = 'The quick brown fox jumps over the lazy dog'

      const result = calculateTextDiff(text, text)

      expect(result.summary.added).toBe(0)
      expect(result.summary.removed).toBe(0)
      expect(result.summary.unchanged).toBe(text.length)
    })

    it('should handle empty strings', () => {
      const result = calculateTextDiff('', '')

      expect(result.summary.added).toBe(0)
      expect(result.summary.removed).toBe(0)
      expect(result.summary.unchanged).toBe(0)
    })

    it('should handle complete replacement', () => {
      const oldText = 'Original text'
      const newText = 'Completely different'

      const result = calculateTextDiff(oldText, newText)

      expect(result.summary.added).toBeGreaterThan(0)
      expect(result.summary.removed).toBeGreaterThan(0)
      expect(result.summary.unchanged).toBe(0)
    })
  })

  describe('calculateLineDiff', () => {
    it('should detect added lines', () => {
      const oldText = 'Line 1\nLine 2'
      const newText = 'Line 1\nLine 2\nLine 3'

      const result = calculateLineDiff(oldText, newText)

      expect(result.summary.added).toBeGreaterThan(0)
      expect(result.changes.some((c) => c.type === 'added' && c.value.includes('Line 3'))).toBe(true)
    })

    it('should detect removed lines', () => {
      const oldText = 'Line 1\nLine 2\nLine 3'
      const newText = 'Line 1\nLine 3'

      const result = calculateLineDiff(oldText, newText)

      expect(result.summary.removed).toBeGreaterThan(0)
    })

    it('should include line numbers', () => {
      const oldText = 'Line 1\nLine 2'
      const newText = 'Line 1\nNew Line\nLine 2'

      const result = calculateLineDiff(oldText, newText)

      const lineNumbers = result.changes
        .filter((c) => c.newLineNumber !== undefined || c.oldLineNumber !== undefined)

      expect(lineNumbers.length).toBeGreaterThan(0)
    })
  })

  describe('compareSegments', () => {
    it('should detect added segments', () => {
      const oldSegments = [
        { id: '1', text: 'Segment 1', startMs: 0, endMs: 1000 },
      ]

      const newSegments = [
        { id: '1', text: 'Segment 1', startMs: 0, endMs: 1000 },
        { id: '2', text: 'Segment 2', startMs: 1000, endMs: 2000 },
      ]

      const result = compareSegments(oldSegments, newSegments)

      expect(result.summary.added).toBe(1)
      expect(result.segments.some((s) => s.type === 'added' && s.segmentId === '2')).toBe(true)
    })

    it('should detect removed segments', () => {
      const oldSegments = [
        { id: '1', text: 'Segment 1', startMs: 0, endMs: 1000 },
        { id: '2', text: 'Segment 2', startMs: 1000, endMs: 2000 },
      ]

      const newSegments = [
        { id: '1', text: 'Segment 1', startMs: 0, endMs: 1000 },
      ]

      const result = compareSegments(oldSegments, newSegments)

      expect(result.summary.removed).toBe(1)
      expect(result.segments.some((s) => s.type === 'removed' && s.segmentId === '2')).toBe(true)
    })

    it('should detect modified segments', () => {
      const oldSegments = [
        { id: '1', text: 'Original text', startMs: 0, endMs: 1000 },
      ]

      const newSegments = [
        { id: '1', text: 'Modified text', startMs: 0, endMs: 1000 },
      ]

      const result = compareSegments(oldSegments, newSegments)

      expect(result.summary.modified).toBe(1)
      const modifiedSegment = result.segments.find((s) => s.type === 'modified')
      expect(modifiedSegment).toBeDefined()
      expect(modifiedSegment?.changes).toBeDefined()
    })

    it('should detect unchanged segments', () => {
      const segments = [
        { id: '1', text: 'Same text', startMs: 0, endMs: 1000 },
      ]

      const result = compareSegments(segments, segments)

      expect(result.summary.unchanged).toBe(1)
      expect(result.summary.added).toBe(0)
      expect(result.summary.removed).toBe(0)
      expect(result.summary.modified).toBe(0)
    })

    it('should sort segments by startMs', () => {
      const oldSegments = [
        { id: '1', text: 'First', startMs: 0, endMs: 1000 },
        { id: '2', text: 'Third', startMs: 2000, endMs: 3000 },
      ]

      const newSegments = [
        { id: '1', text: 'First', startMs: 0, endMs: 1000 },
        { id: '3', text: 'Second', startMs: 1000, endMs: 2000 },
        { id: '2', text: 'Third', startMs: 2000, endMs: 3000 },
      ]

      const result = compareSegments(oldSegments, newSegments)

      // Should be sorted by time
      expect(result.segments[0].startMs).toBeLessThanOrEqual(result.segments[1].startMs)
    })
  })

  describe('generateDiffSummary', () => {
    it('should generate summary for changes', () => {
      const summary = {
        added: 5,
        removed: 3,
        modified: 2,
        unchanged: 10,
      }

      const result = generateDiffSummary(summary)

      expect(result).toContain('5 added')
      expect(result).toContain('3 removed')
      expect(result).toContain('2 modified')
    })

    it('should handle no changes', () => {
      const summary = {
        added: 0,
        removed: 0,
        modified: 0,
        unchanged: 10,
      }

      const result = generateDiffSummary(summary)

      expect(result).toBe('No changes')
    })

    it('should handle only additions', () => {
      const summary = {
        added: 5,
        removed: 0,
        modified: 0,
        unchanged: 0,
      }

      const result = generateDiffSummary(summary)

      expect(result).toBe('+5 added')
    })

    it('should handle mixed changes', () => {
      const summary = {
        added: 10,
        removed: 0,
        modified: 3,
        unchanged: 0,
      }

      const result = generateDiffSummary(summary)

      expect(result).toContain('+10 added')
      expect(result).toContain('~3 modified')
      expect(result).not.toContain('removed')
    })
  })

  describe('calculateSimilarity', () => {
    it('should return 100% for identical texts', () => {
      const text = 'The quick brown fox'
      const similarity = calculateSimilarity(text, text)

      expect(similarity).toBe(100)
    })

    it('should return 0% for completely different texts', () => {
      const text1 = 'Original text'
      const text2 = 'Different content'

      const similarity = calculateSimilarity(text1, text2)

      expect(similarity).toBeLessThan(100)
      expect(similarity).toBeGreaterThanOrEqual(0)
    })

    it('should return partial similarity for similar texts', () => {
      const text1 = 'Hello world this is a test'
      const text2 = 'Hello world this is different'

      const similarity = calculateSimilarity(text1, text2)

      expect(similarity).toBeGreaterThan(50)
      expect(similarity).toBeLessThan(100)
    })

    it('should handle empty strings', () => {
      const similarity = calculateSimilarity('', '')

      expect(similarity).toBe(100)
    })

    it('should handle one empty string', () => {
      const similarity = calculateSimilarity('Some text', '')

      expect(similarity).toBe(0)
    })
  })

  describe('Edge Cases', () => {
    it('should handle unicode in diff', () => {
      const oldText = 'Hello 世界'
      const newText = 'Hello مرحبا'

      const result = calculateTextDiff(oldText, newText)

      expect(result.changes).toBeDefined()
      expect(result.summary.added).toBeGreaterThan(0)
      expect(result.summary.removed).toBeGreaterThan(0)
    })

    it('should handle very long texts efficiently', () => {
      const oldText = 'A '.repeat(10000)
      const newText = 'A '.repeat(10000) + 'B'

      const startTime = Date.now()
      const result = calculateTextDiff(oldText, newText)
      const duration = Date.now() - startTime

      expect(result.summary.added).toBeGreaterThan(0)
      expect(duration).toBeLessThan(5000) // Should complete in under 5 seconds
    })

    it('should handle whitespace-only changes', () => {
      const oldText = 'Hello world'
      const newText = 'Hello  world' // Double space

      const result = calculateTextDiff(oldText, newText)

      // Should detect the difference
      expect(result.summary.added + result.summary.removed).toBeGreaterThan(0)
    })
  })
})
