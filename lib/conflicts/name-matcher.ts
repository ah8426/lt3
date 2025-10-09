/**
 * Name Matching Library
 *
 * Provides fuzzy matching and entity extraction for conflict detection
 */

import fuzzysort from 'fuzzysort'

// Common name variations
const NAME_VARIATIONS: Record<string, string[]> = {
  corporation: ['corp', 'corporation', 'incorporated', 'inc', 'co', 'company', 'limited', 'ltd', 'llc', 'llp', 'lp'],
  and: ['&', 'and'],
}

// Common legal entity suffixes
const ENTITY_SUFFIXES = [
  'inc',
  'incorporated',
  'corp',
  'corporation',
  'llc',
  'llp',
  'lp',
  'ltd',
  'limited',
  'co',
  'company',
  'plc',
  'pc',
  'pa',
]

// Common name prefixes to ignore
const IGNORE_PREFIXES = ['the', 'a', 'an']

export interface FuzzyMatchResult {
  target: string
  score: number
  matches: boolean
  normalizedTarget: string
  normalizedQuery: string
}

export interface EntityMatch {
  text: string
  type: 'person' | 'organization' | 'location'
  confidence: number
  startIndex: number
  endIndex: number
}

/**
 * Normalize name for comparison
 */
export function normalizeName(name: string): string {
  if (!name) return ''

  let normalized = name.toLowerCase().trim()

  // Remove special characters
  normalized = normalized.replace(/[^\w\s&]/g, ' ')

  // Remove common prefixes
  IGNORE_PREFIXES.forEach((prefix) => {
    const regex = new RegExp(`^${prefix}\\s+`, 'i')
    normalized = normalized.replace(regex, '')
  })

  // Normalize entity suffixes
  ENTITY_SUFFIXES.forEach((suffix) => {
    const regex = new RegExp(`\\s+${suffix}\\.?$`, 'i')
    normalized = normalized.replace(regex, '')
  })

  // Normalize variations
  Object.entries(NAME_VARIATIONS).forEach(([key, variations]) => {
    variations.forEach((variation) => {
      const regex = new RegExp(`\\b${variation}\\b`, 'gi')
      normalized = normalized.replace(regex, key)
    })
  })

  // Collapse multiple spaces
  normalized = normalized.replace(/\s+/g, ' ').trim()

  return normalized
}

/**
 * Normalize names with variations
 */
export function normalizeNames(names: string[]): string[] {
  return names.map((name) => normalizeName(name))
}

/**
 * Fuzzy match two names
 */
export function fuzzyMatch(
  query: string,
  target: string,
  threshold: number = 0.7
): FuzzyMatchResult {
  const normalizedQuery = normalizeName(query)
  const normalizedTarget = normalizeName(target)

  // Exact match
  if (normalizedQuery === normalizedTarget) {
    return {
      target,
      score: 1.0,
      matches: true,
      normalizedTarget,
      normalizedQuery,
    }
  }

  // Fuzzy match using fuzzysort
  const result = fuzzysort.single(normalizedQuery, normalizedTarget)

  if (!result) {
    return {
      target,
      score: 0,
      matches: false,
      normalizedTarget,
      normalizedQuery,
    }
  }

  // Convert fuzzysort score to 0-1 range
  // fuzzysort scores are negative, where 0 is perfect match
  const score = Math.max(0, 1 + result.score / 1000)

  return {
    target,
    score,
    matches: score >= threshold,
    normalizedTarget,
    normalizedQuery,
  }
}

/**
 * Fuzzy match against multiple targets
 */
export function fuzzyMatchMultiple(
  query: string,
  targets: string[],
  threshold: number = 0.7,
  limit: number = 10
): FuzzyMatchResult[] {
  const normalizedQuery = normalizeName(query)

  // Use fuzzysort for efficient matching
  const results = fuzzysort.go(normalizedQuery, targets, {
    threshold: -1000, // Lower threshold for initial search
    limit,
  })

  return results
    .map((result) => {
      const score = Math.max(0, 1 + result.score / 1000)
      return {
        target: result.target,
        score,
        matches: score >= threshold,
        normalizedTarget: normalizeName(result.target),
        normalizedQuery,
      }
    })
    .filter((r) => r.matches)
    .sort((a, b) => b.score - a.score)
}

/**
 * Detect company names in text using pattern matching
 */
export function detectCompanyNames(text: string): string[] {
  const companies: string[] = []

  // Simple pattern matching for company names
  const patterns = [
    // Corp, Inc, LLC patterns
    /\b([A-Z][A-Za-z0-9\s&]+(?:Corp|Inc|LLC|LLP|Ltd|Limited|Corporation|Incorporated|Company|Co)\.?)/gi,
    // Multiple capitalized words (likely company)
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4})\b/g,
  ]

  patterns.forEach((pattern) => {
    const matches = text.match(pattern)
    if (matches) {
      companies.push(...matches)
    }
  })

  // Deduplicate and normalize
  const uniqueCompanies = [...new Set(companies.map((c) => c.trim()))]

  return uniqueCompanies.filter((c) => c.length > 2) // Filter out very short matches
}

/**
 * Simple sentence tokenizer
 */
function tokenizeSentences(text: string): string[] {
  // Split on sentence-ending punctuation followed by whitespace
  return text
    .split(/[.!?]+\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
}

/**
 * Extract entities (people, organizations) from text
 */
export function extractEntities(text: string): EntityMatch[] {
  const entities: EntityMatch[] = []

  // Tokenize sentences
  const sentences = tokenizeSentences(text)

  sentences.forEach((sentence) => {
    // Find capitalized sequences (potential names)
    const namePattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g
    let match

    while ((match = namePattern.exec(sentence)) !== null) {
      const name = match[1]
      const startIndex = match.index

      // Determine if it's a person or organization
      const isOrganization = ENTITY_SUFFIXES.some((suffix) =>
        name.toLowerCase().includes(suffix)
      )

      entities.push({
        text: name,
        type: isOrganization ? 'organization' : 'person',
        confidence: 0.7, // Base confidence
        startIndex,
        endIndex: startIndex + name.length,
      })
    }

    // Find company patterns
    const companies = detectCompanyNames(sentence)
    companies.forEach((company) => {
      const index = sentence.indexOf(company)
      if (index !== -1) {
        // Check if already added
        const exists = entities.some(
          (e) => e.startIndex === index && e.text === company
        )
        if (!exists) {
          entities.push({
            text: company,
            type: 'organization',
            confidence: 0.85, // Higher confidence for company patterns
            startIndex: index,
            endIndex: index + company.length,
          })
        }
      }
    })
  })

  // Deduplicate based on text and position
  const uniqueEntities = entities.reduce((acc, entity) => {
    const exists = acc.some(
      (e) =>
        e.text === entity.text &&
        Math.abs(e.startIndex - entity.startIndex) < 10
    )
    if (!exists) {
      acc.push(entity)
    }
    return acc
  }, [] as EntityMatch[])

  return uniqueEntities.sort((a, b) => a.startIndex - b.startIndex)
}

/**
 * Simple word tokenizer
 */
function tokenizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 0)
}

/**
 * Calculate term frequency
 */
function calculateTF(words: string[]): Map<string, number> {
  const tf = new Map<string, number>()
  const totalWords = words.length

  words.forEach(word => {
    tf.set(word, (tf.get(word) || 0) + 1)
  })

  // Normalize by total words
  tf.forEach((count, word) => {
    tf.set(word, count / totalWords)
  })

  return tf
}

/**
 * Calculate text similarity using simple cosine similarity with word frequencies
 * (simplified alternative to TF-IDF)
 */
export function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = tokenizeWords(text1)
  const words2 = tokenizeWords(text2)

  if (words1.length === 0 || words2.length === 0) {
    return 0
  }

  const tf1 = calculateTF(words1)
  const tf2 = calculateTF(words2)

  // Get all unique terms
  const allTerms = new Set([...tf1.keys(), ...tf2.keys()])

  // Calculate cosine similarity
  let dotProduct = 0
  let magnitude1 = 0
  let magnitude2 = 0

  allTerms.forEach(term => {
    const freq1 = tf1.get(term) || 0
    const freq2 = tf2.get(term) || 0

    dotProduct += freq1 * freq2
    magnitude1 += freq1 * freq1
    magnitude2 += freq2 * freq2
  })

  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0
  }

  const similarity = dotProduct / (Math.sqrt(magnitude1) * Math.sqrt(magnitude2))
  return Math.max(0, Math.min(1, similarity))
}

/**
 * Check if two names are likely the same person/entity with variations
 */
export function areNamesSimilar(
  name1: string,
  name2: string,
  threshold: number = 0.8
): boolean {
  // Exact match after normalization
  const normalized1 = normalizeName(name1)
  const normalized2 = normalizeName(name2)

  if (normalized1 === normalized2) {
    return true
  }

  // Check if one is a substring of the other (for abbreviated names)
  if (
    normalized1.includes(normalized2) ||
    normalized2.includes(normalized1)
  ) {
    return true
  }

  // Fuzzy match
  const match = fuzzyMatch(name1, name2, threshold)
  return match.matches
}

/**
 * Extract first and last name from full name
 */
export function splitName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/)

  if (parts.length === 0) {
    return { first: '', last: '' }
  } else if (parts.length === 1) {
    return { first: parts[0], last: '' }
  } else {
    return {
      first: parts[0],
      last: parts[parts.length - 1],
    }
  }
}

/**
 * Get initials from name
 */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

/**
 * Check if name matches initials pattern
 */
export function matchesInitials(fullName: string, initials: string): boolean {
  const extracted = getInitials(fullName)
  return extracted === initials.toUpperCase()
}
