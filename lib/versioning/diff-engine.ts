import * as Diff from 'diff'
import type { Change } from 'diff'

export interface DiffResult {
  summary: {
    added: number
    removed: number
    modified: number
    unchanged: number
  }
  changes: Array<{
    type: 'added' | 'removed' | 'modified' | 'unchanged'
    value: string
    lineNumber?: number
    oldLineNumber?: number
    newLineNumber?: number
  }>
}

export interface SegmentDiff {
  segmentId: string
  type: 'added' | 'removed' | 'modified' | 'unchanged'
  oldText?: string
  newText?: string
  startMs: number
  endMs: number
  changes?: Array<{
    type: 'added' | 'removed' | 'unchanged'
    value: string
  }>
}

/**
 * Calculate text differences between two strings
 */
export function calculateTextDiff(oldText: string, newText: string): DiffResult {
  const changes = Diff.diffWords(oldText, newText)

  const summary = {
    added: 0,
    removed: 0,
    modified: 0,
    unchanged: 0,
  }

  const result: DiffResult['changes'] = []

  changes.forEach((change: Change) => {
    if (change.added) {
      summary.added += change.value.length
      result.push({
        type: 'added',
        value: change.value,
      })
    } else if (change.removed) {
      summary.removed += change.value.length
      result.push({
        type: 'removed',
        value: change.value,
      })
    } else {
      summary.unchanged += change.value.length
      result.push({
        type: 'unchanged',
        value: change.value,
      })
    }
  })

  return { summary, changes: result }
}

/**
 * Calculate line-based diff with line numbers
 */
export function calculateLineDiff(oldText: string, newText: string): DiffResult {
  const changes = Diff.diffLines(oldText, newText)

  const summary = {
    added: 0,
    removed: 0,
    modified: 0,
    unchanged: 0,
  }

  const result: DiffResult['changes'] = []
  let oldLineNum = 1
  let newLineNum = 1

  changes.forEach((change: Change) => {
    const lineCount = change.value.split('\n').length - 1 || 1

    if (change.added) {
      summary.added += lineCount
      result.push({
        type: 'added',
        value: change.value,
        newLineNumber: newLineNum,
      })
      newLineNum += lineCount
    } else if (change.removed) {
      summary.removed += lineCount
      result.push({
        type: 'removed',
        value: change.value,
        oldLineNumber: oldLineNum,
      })
      oldLineNum += lineCount
    } else {
      summary.unchanged += lineCount
      result.push({
        type: 'unchanged',
        value: change.value,
        oldLineNumber: oldLineNum,
        newLineNumber: newLineNum,
      })
      oldLineNum += lineCount
      newLineNum += lineCount
    }
  })

  return { summary, changes: result }
}

/**
 * Compare two segment arrays and generate detailed diff
 */
export function compareSegments(
  oldSegments: any[],
  newSegments: any[]
): {
  summary: DiffResult['summary']
  segments: SegmentDiff[]
} {
  const oldMap = new Map(oldSegments.map((s) => [s.id, s]))
  const newMap = new Map(newSegments.map((s) => [s.id, s]))

  const segments: SegmentDiff[] = []
  const summary = {
    added: 0,
    removed: 0,
    modified: 0,
    unchanged: 0,
  }

  // Check all old segments
  oldSegments.forEach((oldSeg) => {
    const newSeg = newMap.get(oldSeg.id)

    if (!newSeg) {
      // Removed segment
      summary.removed++
      segments.push({
        segmentId: oldSeg.id,
        type: 'removed',
        oldText: oldSeg.text,
        startMs: oldSeg.startMs,
        endMs: oldSeg.endMs,
      })
    } else if (oldSeg.text !== newSeg.text) {
      // Modified segment
      summary.modified++
      const textDiff = Diff.diffWords(oldSeg.text, newSeg.text)
      const changes = textDiff.map((change: Change) => ({
        type: change.added ? 'added' : change.removed ? 'removed' : 'unchanged',
        value: change.value,
      })) as any[]

      segments.push({
        segmentId: oldSeg.id,
        type: 'modified',
        oldText: oldSeg.text,
        newText: newSeg.text,
        startMs: newSeg.startMs,
        endMs: newSeg.endMs,
        changes,
      })
    } else {
      // Unchanged segment
      summary.unchanged++
      segments.push({
        segmentId: oldSeg.id,
        type: 'unchanged',
        oldText: oldSeg.text,
        newText: newSeg.text,
        startMs: newSeg.startMs,
        endMs: newSeg.endMs,
      })
    }
  })

  // Check for added segments
  newSegments.forEach((newSeg) => {
    if (!oldMap.has(newSeg.id)) {
      summary.added++
      segments.push({
        segmentId: newSeg.id,
        type: 'added',
        newText: newSeg.text,
        startMs: newSeg.startMs,
        endMs: newSeg.endMs,
      })
    }
  })

  // Sort by start time
  segments.sort((a, b) => a.startMs - b.startMs)

  return { summary, segments }
}

/**
 * Generate human-readable diff summary
 */
export function generateDiffSummary(diff: DiffResult['summary']): string {
  const parts: string[] = []

  if (diff.added > 0) {
    parts.push(`+${diff.added} added`)
  }
  if (diff.removed > 0) {
    parts.push(`-${diff.removed} removed`)
  }
  if (diff.modified > 0) {
    parts.push(`~${diff.modified} modified`)
  }
  if (parts.length === 0) {
    return 'No changes'
  }

  return parts.join(', ')
}

/**
 * Format timestamp for diff display
 */
export function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/**
 * Calculate similarity percentage between two texts
 */
export function calculateSimilarity(oldText: string, newText: string): number {
  const diff = calculateTextDiff(oldText, newText)
  const totalChars = Math.max(oldText.length, newText.length)

  if (totalChars === 0) return 100

  const unchangedChars = diff.summary.unchanged
  return Math.round((unchangedChars / totalChars) * 100)
}

/**
 * Merge consecutive unchanged chunks for cleaner display
 */
export function mergeUnchangedChunks(
  changes: DiffResult['changes'],
  contextLines: number = 3
): DiffResult['changes'] {
  const merged: DiffResult['changes'] = []
  let unchangedBuffer: DiffResult['changes'] = []

  changes.forEach((change, index) => {
    if (change.type === 'unchanged') {
      unchangedBuffer.push(change)
    } else {
      // Include context before the change
      if (unchangedBuffer.length > contextLines * 2) {
        // Show first N lines
        merged.push(...unchangedBuffer.slice(0, contextLines))
        // Add ellipsis indicator
        merged.push({
          type: 'unchanged',
          value: '...',
        })
        // Show last N lines
        merged.push(...unchangedBuffer.slice(-contextLines))
      } else {
        merged.push(...unchangedBuffer)
      }

      unchangedBuffer = []
      merged.push(change)
    }
  })

  // Handle remaining unchanged at the end
  if (unchangedBuffer.length > contextLines) {
    merged.push(...unchangedBuffer.slice(0, contextLines))
    merged.push({
      type: 'unchanged',
      value: '...',
    })
  } else {
    merged.push(...unchangedBuffer)
  }

  return merged
}
