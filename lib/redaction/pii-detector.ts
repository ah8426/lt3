/**
 * PII Detection Library
 *
 * Detects Personally Identifiable Information (PII) in text using:
 * - Pattern matching (regex) for structured data
 * - NLP analysis using compromise for contextual detection
 * - Custom heuristics for legal documents
 */

import nlp from 'compromise'

export enum PIIType {
  SSN = 'ssn',
  CREDIT_CARD = 'credit_card',
  BANK_ACCOUNT = 'bank_account',
  EMAIL = 'email',
  PHONE = 'phone',
  ADDRESS = 'address',
  NAME = 'name',
  DATE_OF_BIRTH = 'date_of_birth',
  DRIVER_LICENSE = 'driver_license',
  PASSPORT = 'passport',
  IP_ADDRESS = 'ip_address',
  CUSTOM = 'custom',
}

export interface PIIMatch {
  type: PIIType
  text: string
  start: number
  end: number
  confidence: number
  context?: string
  metadata?: Record<string, any>
}

export interface DetectPIIOptions {
  includeNames?: boolean
  includeAddresses?: boolean
  includeEmails?: boolean
  includePhones?: boolean
  includeFinancial?: boolean
  includeDates?: boolean
  minConfidence?: number
  contextWindow?: number
}

const DEFAULT_OPTIONS: DetectPIIOptions = {
  includeNames: true,
  includeAddresses: true,
  includeEmails: true,
  includePhones: true,
  includeFinancial: true,
  includeDates: true,
  minConfidence: 0.7,
  contextWindow: 50,
}

/**
 * Patterns for detecting structured PII
 */
const PATTERNS = {
  // SSN: XXX-XX-XXXX or XXXXXXXXX
  ssn: /\b(?!000|666|9\d{2})\d{3}[- ]?(?!00)\d{2}[- ]?(?!0000)\d{4}\b/g,

  // Credit Card: 13-19 digits with optional spaces/dashes
  creditCard: /\b(?:\d{4}[- ]?){3}\d{4}(?:\d{3})?\b/g,

  // Bank Account: 8-17 digits
  bankAccount: /\b\d{8,17}\b/g,

  // Email
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,

  // Phone: Various formats
  phone: /\b(?:\+?1[- ]?)?\(?([0-9]{3})\)?[- ]?([0-9]{3})[- ]?([0-9]{4})\b/g,

  // Date of Birth patterns
  dob: /\b(?:0?[1-9]|1[0-2])[\/\-](?:0?[1-9]|[12][0-9]|3[01])[\/\-](?:19|20)\d{2}\b/g,

  // Driver's License (varies by state, common patterns)
  driverLicense: /\b[A-Z]{1,2}\d{5,8}\b/g,

  // Passport Number (US format)
  passport: /\b[A-Z]{1,2}\d{6,9}\b/g,

  // IP Address (IPv4)
  ipAddress: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,

  // Street Address (basic pattern)
  streetAddress: /\b\d+\s+(?:[A-Z][a-z]+\s+){1,5}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Circle|Cir|Way)\b/gi,

  // ZIP Code
  zipCode: /\b\d{5}(?:-\d{4})?\b/g,
}

/**
 * Validate potential SSN match
 */
function validateSSN(ssn: string): boolean {
  const digits = ssn.replace(/\D/g, '')

  // Check length
  if (digits.length !== 9) return false

  // Invalid area numbers
  if (digits.startsWith('000') || digits.startsWith('666') || digits.startsWith('9')) {
    return false
  }

  // Invalid group number
  if (digits.substring(3, 5) === '00') return false

  // Invalid serial number
  if (digits.substring(5, 9) === '0000') return false

  return true
}

/**
 * Validate credit card number using Luhn algorithm
 */
function validateCreditCard(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, '')

  // Check length (13-19 digits)
  if (digits.length < 13 || digits.length > 19) return false

  // Luhn algorithm
  let sum = 0
  let isEven = false

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10)

    if (isEven) {
      digit *= 2
      if (digit > 9) digit -= 9
    }

    sum += digit
    isEven = !isEven
  }

  return sum % 10 === 0
}

/**
 * Detect names using NLP with context analysis
 */
function detectNames(text: string, contextWindow: number = 50): PIIMatch[] {
  const matches: PIIMatch[] = []
  const doc = nlp(text)

  // Find people's names
  const people = doc.people()

  people.forEach((person) => {
    const personText = person.text()
    const offset = text.indexOf(personText)

    if (offset === -1) return

    // Get context around the name
    const contextStart = Math.max(0, offset - contextWindow)
    const contextEnd = Math.min(text.length, offset + personText.length + contextWindow)
    const context = text.substring(contextStart, contextEnd)

    // Increase confidence if name appears with title or role
    let confidence = 0.7
    if (/\b(?:Mr|Mrs|Ms|Dr|Prof|Attorney|Judge|Hon)\b/i.test(context)) {
      confidence = 0.9
    }

    // Decrease confidence for common words that might be misidentified
    if (/\b(?:and|or|the|in|on|at)\b/i.test(personText)) {
      confidence = 0.3
    }

    matches.push({
      type: PIIType.NAME,
      text: personText,
      start: offset,
      end: offset + personText.length,
      confidence,
      context,
    })
  })

  return matches
}

/**
 * Detect addresses using NLP
 */
function detectAddresses(text: string, contextWindow: number = 50): PIIMatch[] {
  const matches: PIIMatch[] = []
  const doc = nlp(text)

  // Find places (cities, states, countries)
  const places = doc.places()

  // Street address pattern matching
  const streetMatches = Array.from(text.matchAll(PATTERNS.streetAddress))

  streetMatches.forEach((match) => {
    if (!match.index) return

    const addressText = match[0]
    const offset = match.index

    // Get context
    const contextStart = Math.max(0, offset - contextWindow)
    const contextEnd = Math.min(text.length, offset + addressText.length + contextWindow)
    const context = text.substring(contextStart, contextEnd)

    // Look for ZIP codes nearby to increase confidence
    let confidence = 0.7
    if (PATTERNS.zipCode.test(context)) {
      confidence = 0.9
    }

    matches.push({
      type: PIIType.ADDRESS,
      text: addressText,
      start: offset,
      end: offset + addressText.length,
      confidence,
      context,
    })
  })

  return matches
}

/**
 * Main PII detection function
 */
export async function detectPII(
  text: string,
  options: DetectPIIOptions = {}
): Promise<PIIMatch[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const matches: PIIMatch[] = []

  // SSN Detection
  if (opts.includeFinancial) {
    const ssnMatches = Array.from(text.matchAll(PATTERNS.ssn))
    ssnMatches.forEach((match) => {
      if (!match.index) return

      const ssnText = match[0]
      if (validateSSN(ssnText)) {
        const contextStart = Math.max(0, match.index - opts.contextWindow!)
        const contextEnd = Math.min(text.length, match.index + ssnText.length + opts.contextWindow!)

        matches.push({
          type: PIIType.SSN,
          text: ssnText,
          start: match.index,
          end: match.index + ssnText.length,
          confidence: 0.95,
          context: text.substring(contextStart, contextEnd),
        })
      }
    })
  }

  // Credit Card Detection
  if (opts.includeFinancial) {
    const ccMatches = Array.from(text.matchAll(PATTERNS.creditCard))
    ccMatches.forEach((match) => {
      if (!match.index) return

      const ccText = match[0]
      if (validateCreditCard(ccText)) {
        const contextStart = Math.max(0, match.index - opts.contextWindow!)
        const contextEnd = Math.min(text.length, match.index + ccText.length + opts.contextWindow!)

        matches.push({
          type: PIIType.CREDIT_CARD,
          text: ccText,
          start: match.index,
          end: match.index + ccText.length,
          confidence: 0.9,
          context: text.substring(contextStart, contextEnd),
        })
      }
    })
  }

  // Email Detection
  if (opts.includeEmails) {
    const emailMatches = Array.from(text.matchAll(PATTERNS.email))
    emailMatches.forEach((match) => {
      if (!match.index) return

      const emailText = match[0]
      const contextStart = Math.max(0, match.index - opts.contextWindow!)
      const contextEnd = Math.min(text.length, match.index + emailText.length + opts.contextWindow!)

      matches.push({
        type: PIIType.EMAIL,
        text: emailText,
        start: match.index,
        end: match.index + emailText.length,
        confidence: 0.95,
        context: text.substring(contextStart, contextEnd),
      })
    })
  }

  // Phone Number Detection
  if (opts.includePhones) {
    const phoneMatches = Array.from(text.matchAll(PATTERNS.phone))
    phoneMatches.forEach((match) => {
      if (!match.index) return

      const phoneText = match[0]
      const contextStart = Math.max(0, match.index - opts.contextWindow!)
      const contextEnd = Math.min(text.length, match.index + phoneText.length + opts.contextWindow!)

      matches.push({
        type: PIIType.PHONE,
        text: phoneText,
        start: match.index,
        end: match.index + phoneText.length,
        confidence: 0.85,
        context: text.substring(contextStart, contextEnd),
      })
    })
  }

  // Date of Birth Detection
  if (opts.includeDates) {
    const dobMatches = Array.from(text.matchAll(PATTERNS.dob))
    dobMatches.forEach((match) => {
      if (!match.index) return

      const dobText = match[0]
      const contextStart = Math.max(0, match.index - opts.contextWindow!)
      const contextEnd = Math.min(text.length, match.index + dobText.length + opts.contextWindow!)
      const context = text.substring(contextStart, contextEnd)

      // Only flag as DOB if context suggests it (contains "birth", "DOB", "born", etc.)
      if (/\b(?:birth|DOB|born|age)\b/i.test(context)) {
        matches.push({
          type: PIIType.DATE_OF_BIRTH,
          text: dobText,
          start: match.index,
          end: match.index + dobText.length,
          confidence: 0.8,
          context,
        })
      }
    })
  }

  // Driver's License Detection
  if (opts.includeFinancial) {
    const dlMatches = Array.from(text.matchAll(PATTERNS.driverLicense))
    dlMatches.forEach((match) => {
      if (!match.index) return

      const dlText = match[0]
      const contextStart = Math.max(0, match.index - opts.contextWindow!)
      const contextEnd = Math.min(text.length, match.index + dlText.length + opts.contextWindow!)
      const context = text.substring(contextStart, contextEnd)

      // Only flag if context suggests driver's license
      if (/\b(?:license|DL|driver|DMV)\b/i.test(context)) {
        matches.push({
          type: PIIType.DRIVER_LICENSE,
          text: dlText,
          start: match.index,
          end: match.index + dlText.length,
          confidence: 0.75,
          context,
        })
      }
    })
  }

  // IP Address Detection
  const ipMatches = Array.from(text.matchAll(PATTERNS.ipAddress))
  ipMatches.forEach((match) => {
    if (!match.index) return

    const ipText = match[0]
    const contextStart = Math.max(0, match.index - opts.contextWindow!)
    const contextEnd = Math.min(text.length, match.index + ipText.length + opts.contextWindow!)

    matches.push({
      type: PIIType.IP_ADDRESS,
      text: ipText,
      start: match.index,
      end: match.index + ipText.length,
      confidence: 0.85,
      context: text.substring(contextStart, contextEnd),
    })
  })

  // Name Detection using NLP
  if (opts.includeNames) {
    const nameMatches = detectNames(text, opts.contextWindow!)
    matches.push(...nameMatches)
  }

  // Address Detection
  if (opts.includeAddresses) {
    const addressMatches = detectAddresses(text, opts.contextWindow!)
    matches.push(...addressMatches)
  }

  // Filter by minimum confidence
  const filteredMatches = matches.filter(
    (match) => match.confidence >= opts.minConfidence!
  )

  // Sort by position in text
  filteredMatches.sort((a, b) => a.start - b.start)

  // Remove overlapping matches (keep highest confidence)
  const deduplicatedMatches: PIIMatch[] = []
  for (const match of filteredMatches) {
    const overlaps = deduplicatedMatches.some(
      (existing) =>
        (match.start >= existing.start && match.start < existing.end) ||
        (match.end > existing.start && match.end <= existing.end)
    )

    if (!overlaps) {
      deduplicatedMatches.push(match)
    } else {
      // Replace if higher confidence
      const overlappingIndex = deduplicatedMatches.findIndex(
        (existing) =>
          (match.start >= existing.start && match.start < existing.end) ||
          (match.end > existing.start && match.end <= existing.end)
      )

      if (
        overlappingIndex !== -1 &&
        match.confidence > deduplicatedMatches[overlappingIndex].confidence
      ) {
        deduplicatedMatches[overlappingIndex] = match
      }
    }
  }

  return deduplicatedMatches
}

/**
 * Get redaction label for PII type
 */
export function getRedactionLabel(type: PIIType): string {
  const labels: Record<PIIType, string> = {
    [PIIType.SSN]: 'SSN',
    [PIIType.CREDIT_CARD]: 'CREDIT CARD',
    [PIIType.BANK_ACCOUNT]: 'ACCOUNT NUMBER',
    [PIIType.EMAIL]: 'EMAIL',
    [PIIType.PHONE]: 'PHONE',
    [PIIType.ADDRESS]: 'ADDRESS',
    [PIIType.NAME]: 'NAME',
    [PIIType.DATE_OF_BIRTH]: 'DOB',
    [PIIType.DRIVER_LICENSE]: 'LICENSE',
    [PIIType.PASSPORT]: 'PASSPORT',
    [PIIType.IP_ADDRESS]: 'IP ADDRESS',
    [PIIType.CUSTOM]: 'REDACTED',
  }

  return labels[type] || 'REDACTED'
}

/**
 * Get confidence level description
 */
export function getConfidenceLevel(confidence: number): 'low' | 'medium' | 'high' {
  if (confidence >= 0.85) return 'high'
  if (confidence >= 0.7) return 'medium'
  return 'low'
}
