# Law Transcribed - Complete Build Plan

**Version:** 1.0.0  
**Date:** October 6, 2025  
**Target Platform:** Web (Next.js 15) + Mobile (React Native/Expo)

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Database Schema](#database-schema)
4. [Feature Specifications](#feature-specifications)
5. [Subscription Tiers](#subscription-tiers)
6. [Implementation Phases](#implementation-phases)
7. [Deployment Strategy](#deployment-strategy)
8. [Testing Strategy](#testing-strategy)

---

## Project Overview

**Law Transcribed** is an AI-powered legal dictation and chat platform designed specifically for attorneys. The platform provides real-time voice transcription with AI assistance, document generation, citation checking, and comprehensive practice management tools.

### Core Objectives

1. Professional-grade voice dictation with multiple ASR providers
2. AI-powered legal assistance with citation verification
3. Attorney-client privilege compliance and security
4. Comprehensive audit trails and version control
5. Offline capability for courtroom use
6. Mobile-first design for iOS and Android

### Target Users

- Solo practitioners and small law firms
- Michigan civil litigation attorneys (initial focus)
- Attorneys requiring HIPAA/attorney-client privilege compliance
- Legal professionals needing mobile dictation solutions

---

## Technology Stack

### Verified Compatible Versions

All versions have been cross-referenced for compatibility as of October 2025.

#### Core Framework

```json
{
  "next": "15.0.3",
  "react": "19.0.0",
  "react-dom": "19.0.0",
  "typescript": "5.6.3"
}
```

**Compatibility Notes:**
- Next.js 15.0.3 requires React 19.0.0 (verified compatible)
- TypeScript 5.6.3 supports all React 19 features
- Node.js 20.11.0+ required

#### Database & ORM

```json
{
  "@prisma/client": "5.20.0",
  "prisma": "5.20.0"
}
```

**Compatibility Notes:**
- Prisma 5.20.0 compatible with PostgreSQL 12-16
- Works with Supabase managed PostgreSQL
- Supports pgvector extension for future AI features

#### Authentication & Backend

```json
{
  "@supabase/supabase-js": "2.39.0",
  "@supabase/ssr": "0.1.0"
}
```

**Compatibility Notes:**
- @supabase/ssr 0.1.0 designed for Next.js 15 App Router
- Compatible with Server Components and Server Actions
- Supports OAuth 2.0 (Google Workspace, Microsoft 365)

#### State Management

```json
{
  "zustand": "5.0.0-rc.2",
  "@tanstack/react-query": "5.56.2",
  "@tanstack/react-query-devtools": "5.56.2",
  "@tanstack/react-query-persist-client": "5.56.2"
}
```

**Compatibility Notes:**
- Zustand 5.0.0-rc.2 fully compatible with React 19
- TanStack Query 5.56.2 supports React 19 and Next.js 15
- All packages use same major version (5.x) for compatibility

#### UI Components (Radix UI)

```json
{
  "@radix-ui/react-alert-dialog": "1.1.2",
  "@radix-ui/react-avatar": "1.1.1",
  "@radix-ui/react-checkbox": "1.1.2",
  "@radix-ui/react-dialog": "1.1.2",
  "@radix-ui/react-dropdown-menu": "2.1.2",
  "@radix-ui/react-label": "2.1.0",
  "@radix-ui/react-popover": "1.1.2",
  "@radix-ui/react-progress": "1.1.0",
  "@radix-ui/react-scroll-area": "1.2.0",
  "@radix-ui/react-select": "2.1.2",
  "@radix-ui/react-separator": "1.1.0",
  "@radix-ui/react-slider": "1.2.1",
  "@radix-ui/react-switch": "1.1.1",
  "@radix-ui/react-tabs": "1.1.1",
  "@radix-ui/react-toast": "1.2.2",
  "@radix-ui/react-tooltip": "1.1.3",
  "lucide-react": "0.446.0",
  "class-variance-authority": "0.7.0",
  "clsx": "2.1.1",
  "tailwind-merge": "2.5.4"
}
```

**Compatibility Notes:**
- All Radix UI v1.x and v2.x packages compatible with React 19
- Lucide React 0.446.0 supports React 19
- CVA, clsx, and tailwind-merge have no React version dependencies

#### Styling

```json
{
  "tailwindcss": "4.0.0-beta.1",
  "autoprefixer": "10.4.20",
  "postcss": "8.4.47"
}
```

**Compatibility Notes:**
- Tailwind CSS v4 beta requires PostCSS 8.4.x
- Uses CSS-first configuration (no tailwind.config.js)
- Compatible with Next.js 15's Turbopack

#### Audio & Transcription

```json
{
  "wavesurfer.js": "7.8.6",
  "recordrtc": "5.6.2"
}
```

**Compatibility Notes:**
- WaveSurfer.js 7.8.6 is browser-agnostic (no React dependency)
- RecordRTC 5.6.2 compatible with all modern browsers
- Both work with Web Audio API and MediaRecorder API

#### AI/LLM Providers

```json
{
  "@anthropic-ai/sdk": "0.27.3",
  "openai": "4.67.3",
  "@google/generative-ai": "0.21.0",
  "openrouter": "npm:openai@4.67.3"
}
```

**Compatibility Notes:**
- Anthropic SDK 0.27.3 supports streaming and tool use
- OpenAI SDK 4.67.3 includes GPT-4, GPT-4 Turbo, GPT-4o
- Google Generative AI 0.21.0 supports Gemini 1.5 Pro/Flash
- OpenRouter uses OpenAI SDK (aliased as 'openrouter' for clarity)
- All SDKs support Node.js 18+ and Edge Runtime

#### Redis (Cache & Rate Limiting)

```json
{
  "@upstash/redis": "1.34.3",
  "@upstash/ratelimit": "2.0.3"
}
```

**Compatibility Notes:**
- Upstash Redis 1.34.3 supports Edge Runtime
- Compatible with Vercel Edge Functions
- Works with both Node.js and browser environments

#### Document Processing

```json
{
  "docxtemplater": "3.50.0",
  "mammoth": "1.8.0",
  "pdf-lib": "1.17.1",
  "@pdfme/generator": "4.5.2",
  "html-pdf-node": "1.0.8",
  "docx": "8.5.0",
  "jszip": "3.10.1"
}
```

**Compatibility Notes:**
- All document libraries are Node.js only (use in API routes)
- JSZip 3.10.1 compatible with all other document libraries
- pdf-lib and @pdfme/generator can be used together

#### Security & Encryption

```json
{
  "@noble/hashes": "1.5.0",
  "@noble/ciphers": "1.0.0",
  "bcrypt": "5.1.1"
}
```

**Compatibility Notes:**
- Noble libraries are pure JavaScript (no native dependencies)
- bcrypt 5.1.1 requires native compilation (works on Vercel)
- All compatible with Node.js 18+

#### Payments

```json
{
  "stripe": "17.2.0",
  "@stripe/stripe-js": "4.8.0"
}
```

**Compatibility Notes:**
- Stripe SDK 17.2.0 requires Node.js 18+
- @stripe/stripe-js 4.8.0 is client-side only
- Both support latest Stripe API version (2024-10-28.acacia)

#### Utilities

```json
{
  "date-fns": "4.1.0",
  "decimal.js": "10.4.3",
  "zod": "3.23.8",
  "nanoid": "5.0.7"
}
```

**Compatibility Notes:**
- date-fns 4.1.0 is tree-shakeable and TypeScript-first
- decimal.js 10.4.3 for precise financial calculations
- Zod 3.23.8 compatible with TypeScript 5.6
- nanoid 5.0.7 is ESM-only (compatible with Next.js 15)

#### Feature-Specific Dependencies

##### Audit & Compliance

```json
{
  "@tanstack/react-table": "8.20.5",
  "diff": "7.0.0",
  "immer": "10.1.1"
}
```

**Compatibility Notes:**
- React Table 8.20.5 compatible with React 19
- diff 7.0.0 is pure JavaScript (no dependencies)
- immer 10.1.1 supports ES2015+

##### Timestamp Verification

```json
{
  "ntp-client": "0.5.3"
}
```

**Compatibility Notes:**
- ntp-client 0.5.3 is Node.js only (use in API routes)
- Works with Node.js 18+

##### Redaction & PII Detection

```json
{
  "compromise": "14.14.2",
  "string-similarity": "4.0.4"
}
```

**Compatibility Notes:**
- compromise 14.14.2 is pure JavaScript NLP library
- string-similarity 4.0.4 has no dependencies

##### Speaker Management

```json
{
  "react-select": "5.8.1"
}
```

**Compatibility Notes:**
- react-select 5.8.1 compatible with React 19
- Peer dependency: emotion (included)

##### Conflict Checking

```json
{
  "fuzzysort": "3.0.2",
  "natural": "8.0.1"
}
```

**Compatibility Notes:**
- fuzzysort 3.0.2 is pure JavaScript (very fast)
- natural 8.0.1 requires Node.js 18+ (use in API routes)

##### Backup & Recovery

```json
{
  "tar-stream": "3.1.7",
  "@aws-sdk/client-s3": "3.686.0"
}
```

**Compatibility Notes:**
- tar-stream 3.1.7 is streaming-first (low memory)
- AWS SDK v3 is modular (only import what you need)
- Both require Node.js 18+

##### Offline Support

```json
{
  "idb": "8.0.0",
  "workbox-webpack-plugin": "7.1.0"
}
```

**Compatibility Notes:**
- idb 8.0.0 is TypeScript-first IndexedDB wrapper
- workbox 7.1.0 compatible with webpack 5 (Next.js 15)

##### Voice Commands & Accessibility

```json
{
  "react-speech-recognition": "3.10.0",
  "focus-trap-react": "10.2.3"
}
```

**Compatibility Notes:**
- react-speech-recognition 3.10.0 uses Web Speech API
- focus-trap-react 10.2.3 compatible with React 19

##### Citation Checking

```json
{
  "axios": "1.7.7"
}
```

**Compatibility Notes:**
- axios 1.7.7 works in Node.js and browser
- Can be used with all AI providers

#### Monitoring & Analytics

```json
{
  "@sentry/nextjs": "8.33.1",
  "@vercel/analytics": "1.3.1",
  "@vercel/speed-insights": "1.0.12"
}
```

**Compatibility Notes:**
- Sentry 8.33.1 fully supports Next.js 15 App Router
- Vercel Analytics 1.3.1 compatible with React 19
- All support Edge Runtime

#### Development Tools

```json
{
  "@types/node": "20.11.30",
  "@types/react": "18.3.11",
  "@types/react-dom": "18.3.0",
  "@types/bcrypt": "5.0.2",
  "eslint": "8.57.1",
  "eslint-config-next": "15.0.3",
  "vitest": "2.1.3",
  "@vitest/ui": "2.1.3",
  "@vitejs/plugin-react": "4.3.3",
  "playwright": "1.48.2",
  "@playwright/test": "1.48.2",
  "@testing-library/react": "16.0.1",
  "@testing-library/jest-dom": "6.5.0",
  "@testing-library/user-event": "14.5.2"
}
```

**Compatibility Notes:**
- Type definitions match runtime versions
- ESLint 8.x required by Next.js 15.0.3
- Vitest 2.1.3 compatible with React 19
- Playwright 1.48.2 supports all modern browsers
- Testing Library packages all support React 19

### Mobile App Dependencies (React Native/Expo)

```json
{
  "react-native": "0.76.1",
  "expo": "52.0.11",
  "expo-router": "4.0.9",
  "@react-navigation/native": "6.1.18",
  "@react-navigation/stack": "6.4.1",
  "@supabase/supabase-js": "2.39.0",
  "@tanstack/react-query": "5.56.2",
  "zustand": "5.0.0-rc.2",
  "expo-av": "14.0.7",
  "expo-file-system": "17.0.1",
  "expo-local-authentication": "14.0.1",
  "@react-native-async-storage/async-storage": "2.0.0",
  "react-native-mmkv": "3.1.0",
  "@react-native-voice/voice": "3.2.4"
}
```

**Compatibility Notes:**
- React Native 0.76.1 supports React 18.3 (not 19 yet)
- Expo 52 is the latest stable SDK
- All Expo packages use matching version (52.x)
- Supabase and TanStack Query share versions with web app

---

## Database Schema

### Complete Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  directUrl  = env("DIRECT_URL")
  extensions = [pgvector(map: "vector")]
}

// ============================================================================
// USER & AUTHENTICATION
// ============================================================================

model User {
  id              String    @id @default(cuid())
  email           String    @unique
  fullName        String?
  provider        String    // 'google' or 'microsoft'
  providerId      String
  firmId          String?
  roles           String[]  @default(["user"])
  
  // Subscription
  subscriptionTier    String   @default("free") // free, starter, professional, enterprise
  subscriptionStatus  String   @default("active") // active, trialing, past_due, canceled
  stripeCustomerId    String?  @unique
  stripeSubscriptionId String? @unique
  subscriptionEndsAt  DateTime?
  trialEndsAt         DateTime?
  
  // User Settings (includes feature toggles)
  settings        Json      @default("{}")
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  lastLoginAt     DateTime?
  
  // Relations
  matters         Matter[]
  sessions        Session[]
  apiKeys         EncryptedApiKey[]
  auditLogs       AuditLog[]
  exportJobs      ExportJob[]
  conflictChecks  ConflictCheck[]
  billableTime    BillableTime[]
  templates       DocumentTemplate[]
  generatedDocs   GeneratedDocument[]
  
  @@index([email])
  @@index([firmId])
  @@index([subscriptionTier, subscriptionStatus])
}

model EncryptedApiKey {
  id              String   @id @default(cuid())
  userId          String
  provider        String   // 'deepgram', 'assemblyai', 'anthropic', 'openai', 'google', 'openrouter'
  encryptedKey    String   @db.Text
  iv              String
  authTag         String?
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  lastUsedAt      DateTime?
  
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([userId, provider])
  @@index([userId, isActive])
}

// ============================================================================
// SUBSCRIPTION & BILLING
// ============================================================================

model SubscriptionPlan {
  id              String   @id @default(cuid())
  name            String   @unique // "Free", "Starter", "Professional", "Enterprise"
  slug            String   @unique // "free", "starter", "professional", "enterprise"
  description     String?  @db.Text
  
  // Pricing
  priceMonthly    Int      // Cents (e.g., 2900 = $29.00)
  priceYearly     Int      // Cents with discount
  stripePriceIdMonthly  String?
  stripePriceIdYearly   String?
  
  // Limits
  maxSessions     Int      @default(-1) // -1 = unlimited
  maxStorageGB    Int      @default(-1) // -1 = unlimited
  maxAIRequests   Int      @default(-1) // Per month, -1 = unlimited
  maxMatters      Int      @default(-1)
  maxUsers        Int      @default(1)  // For firm accounts
  
  // Features (JSON for flexibility)
  features        Json     @default("{}")
  // Structure: {
  //   auditLogging: true,
  //   versionControl: true,
  //   advancedAI: false,
  //   prioritySupport: false,
  //   customBranding: false,
  //   apiAccess: false,
  //   ssoIntegration: false
  // }
  
  isActive        Boolean  @default(true)
  sortOrder       Int      @default(0)
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@index([isActive, sortOrder])
}

model Invoice {
  id              String   @id @default(cuid())
  userId          String
  stripeInvoiceId String   @unique
  
  // Invoice details
  amountDue       Int      // Cents
  amountPaid      Int      // Cents
  currency        String   @default("usd")
  status          String   // draft, open, paid, void, uncollectible
  
  // Dates
  periodStart     DateTime
  periodEnd       DateTime
  dueDate         DateTime?
  paidAt          DateTime?
  
  // Files
  invoicePdf      String?
  hostedUrl       String?
  
  createdAt       DateTime @default(now())
  
  @@index([userId, createdAt])
  @@index([status])
}

model UsageMetrics {
  id              String   @id @default(cuid())
  userId          String
  
  // Period
  periodStart     DateTime
  periodEnd       DateTime
  
  // Metrics
  sessionsCount   Int      @default(0)
  transcriptionMinutes Float @default(0)
  aiRequestsCount Int      @default(0)
  storageUsedGB   Float    @default(0)
  
  // Costs
  transcriptionCost Float  @default(0)
  aiCost          Float    @default(0)
  storageCost     Float    @default(0)
  totalCost       Float    @default(0)
  
  createdAt       DateTime @default(now())
  
  @@unique([userId, periodStart])
  @@index([userId, periodEnd])
}

// ============================================================================
// MATTERS & SESSIONS
// ============================================================================

model Matter {
  id              String   @id @default(cuid())
  name            String
  clientName      String
  adverseParty    String?
  jurisdiction    String?
  courtType       String?
  caseNumber      String?
  status          String   @default("active")
  userId          String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  sessions        Session[]
  documents       GeneratedDocument[]
  conflictChecks  ConflictCheck[]
  billableTime    BillableTime[]
  
  @@index([userId, status])
  @@index([clientName])
}

model Session {
  id                    String    @id @default(cuid())
  matterId              String
  userId                String
  
  status                String    @default("active")
  title                 String?
  description           String?   @db.Text
  
  startedAt             DateTime  @default(now())
  endedAt               DateTime?
  durationMs            Int?
  
  audioStoragePath      String?
  transcriptData        Json?
  
  shareToken            String?   @unique
  shareExpiresAt        DateTime?
  shareScope            String?
  
  totalCost             Float     @default(0)
  asrProvider           String?
  asrCost               Float     @default(0)
  aiProvider            String?
  aiCost                Float     @default(0)
  
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  
  matter                Matter    @relation(fields: [matterId], references: [id], onDelete: Cascade)
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  segments              TranscriptSegment[]
  chatMessages          ChatMessage[]
  versions              TranscriptVersion[]
  accessLogs            TranscriptAccessLog[]
  redactions            Redaction[]
  speakers              Speaker[]
  exportJobs            ExportJob[]
  billableTime          BillableTime[]
  generatedDocs         GeneratedDocument[]
  
  @@index([userId, status, startedAt])
  @@index([matterId, startedAt])
  @@index([shareToken])
}

// ============================================================================
// FEATURE 1: AUDIT LOGGING
// ============================================================================

model AuditLog {
  id              String    @id @default(cuid())
  userId          String?
  sessionId       String?
  matterId        String?
  
  action          String
  resource        String
  resourceId      String?
  
  clientName      String?
  
  oldValue        Json?
  newValue        Json?
  changeReason    String?
  
  ipAddress       String?
  userAgent       String?
  location        String?
  
  retentionUntil  DateTime?
  isPrivileged    Boolean   @default(true)
  
  metadata        Json      @default("{}")
  timestamp       DateTime  @default(now())
  
  user            User?     @relation(fields: [userId], references: [id], onDelete: SetNull)
  
  @@index([userId, timestamp])
  @@index([sessionId, timestamp])
  @@index([matterId, timestamp])
  @@index([action, resource])
  @@index([clientName, timestamp])
}

// ============================================================================
// FEATURE 2: VERSION CONTROL
// ============================================================================

model TranscriptVersion {
  id              String   @id @default(cuid())
  sessionId       String
  version         Int
  
  segments        Json
  
  changeType      String
  changedBy       String
  changeReason    String?
  
  diffSummary     Json?
  
  createdAt       DateTime @default(now())
  
  session         Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  
  @@unique([sessionId, version])
  @@index([sessionId, createdAt])
  @@index([changedBy, createdAt])
}

// ============================================================================
// FEATURE 3: TIMESTAMP VERIFICATION
// ============================================================================

model TimestampProof {
  id              String   @id @default(cuid())
  sessionId       String
  segmentId       String
  
  contentHash     String
  timestamp       DateTime
  timestampSource String
  
  rfc3161Token    String?  @db.Text
  
  isVerified      Boolean  @default(false)
  verifiedAt      DateTime?
  verifiedBy      String?
  verificationMethod String?
  
  createdAt       DateTime @default(now())
  
  segment         TranscriptSegment @relation(fields: [segmentId], references: [id], onDelete: Cascade)
  
  @@unique([segmentId])
  @@index([sessionId, timestamp])
  @@index([isVerified, timestamp])
}

// ============================================================================
// FEATURE 4: REDACTION & PII PROTECTION
// ============================================================================

model Redaction {
  id              String   @id @default(cuid())
  sessionId       String
  segmentId       String
  
  originalText    String   @db.Text
  redactedText    String
  redactionType   String
  
  startOffset     Int
  endOffset       Int
  
  redactedBy      String
  unredactableBy  String[]
  
  reason          String?
  legalBasis      String?
  
  createdAt       DateTime @default(now())
  expiresAt       DateTime?
  
  session         Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  segment         TranscriptSegment @relation(fields: [segmentId], references: [id], onDelete: Cascade)
  
  @@index([sessionId])
  @@index([segmentId])
  @@index([redactionType])
}

// ============================================================================
// FEATURE 5: SPEAKER IDENTIFICATION
// ============================================================================

model Speaker {
  id              String   @id @default(cuid())
  sessionId       String
  
  name            String
  role            String?
  organization    String?
  
  voiceprint      Json?
  
  firstSpoke      DateTime
  lastSpoke       DateTime
  totalDuration   Int
  segmentCount    Int
  wordCount       Int      @default(0)
  
  metadata        Json     @default("{}")
  createdAt       DateTime @default(now())
  
  session         Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  segments        TranscriptSegment[]
  
  @@unique([sessionId, name])
  @@index([sessionId])
}

// ============================================================================
// TRANSCRIPTION
// ============================================================================

model TranscriptSegment {
  id              String   @id @default(cuid())
  sessionId       String
  
  startMs         Int
  endMs           Int
  
  text            String   @db.Text
  
  speakerId       String?
  speakerName     String?
  
  confidence      Float?
  provider        String?
  
  isFinal         Boolean  @default(false)
  isEdited        Boolean  @default(false)
  editedBy        String?
  
  createdAt       DateTime @default(now())
  
  session         Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  speaker         Speaker? @relation(fields: [speakerId], references: [id], onDelete: SetNull)
  timestampProofs TimestampProof[]
  redactions      Redaction[]
  
  @@index([sessionId, startMs])
  @@index([speakerId])
}

model TranscriptAccessLog {
  id              String   @id @default(cuid())
  sessionId       String
  userId          String?
  accessType      String
  accessMethod    String
  timestamp       DateTime @default(now())
  ipAddress       String?
  userAgent       String?
  
  session         Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  
  @@index([sessionId, timestamp])
  @@index([userId, timestamp])
}

// ============================================================================
// AI CHAT
// ============================================================================

model ChatMessage {
  id              String   @id @default(cuid())
  sessionId       String
  
  role            String
  content         String   @db.Text
  
  provider        String?
  model           String?
  tokens          Int?
  cost            Float?
  
  contextUsed     Json?
  
  createdAt       DateTime @default(now())
  
  session         Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  citations       Citation[]
  
  @@index([sessionId, createdAt])
}

// ============================================================================
// CITATION CHECKING (AI-Powered)
// ============================================================================

model Citation {
  id              String   @id @default(cuid())
  chatMessageId   String?
  sessionId       String?
  documentId      String?
  
  citationType    String
  fullCitation    String   @db.Text
  shortCitation   String?
  
  jurisdiction    String?
  statuteCode     String?
  section         String?
  
  caseName        String?
  reporter        String?
  volume          Int?
  page            Int?
  year            Int?
  court           String?
  
  isVerified      Boolean  @default(false)
  verificationStatus String?
  verifiedAt      DateTime?
  verifiedBy      String?
  verificationNotes String? @db.Text
  
  treatmentStatus String?
  treatmentNotes  String?  @db.Text
  
  westlawUrl      String?
  lexisUrl        String?
  publicUrl       String?
  
  createdAt       DateTime @default(now())
  
  chatMessage     ChatMessage? @relation(fields: [chatMessageId], references: [id], onDelete: Cascade)
  
  @@index([sessionId, citationType])
  @@index([jurisdiction, statuteCode, section])
  @@index([isVerified, verificationStatus])
}

// ============================================================================
// DOCUMENT GENERATION & EXPORT
// ============================================================================

model ExportJob {
  id                      String   @id @default(cuid())
  sessionId               String
  userId                  String
  
  format                  String
  template                String?
  
  includeLineNumbers      Boolean  @default(false)
  includeTimestamps       Boolean  @default(true)
  includePageNumbers      Boolean  @default(true)
  includeCertification    Boolean  @default(false)
  includeIndexPage        Boolean  @default(false)
  includeTableOfContents  Boolean  @default(false)
  
  certifiedBy             String?
  certificationDate       DateTime?
  certificationText       String?  @db.Text
  barNumber               String?
  
  status                  String   @default("pending")
  fileUrl                 String?
  fileSize                Int?
  
  error                   String?  @db.Text
  createdAt               DateTime @default(now())
  completedAt             DateTime?
  
  session                 Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  user                    User     @relation(fields: [userId], references: [id])
  
  @@index([userId, createdAt])
  @@index([sessionId])
  @@index([status])
}

model DocumentTemplate {
  id              String   @id @default(cuid())
  userId          String
  name            String
  description     String?  @db.Text
  
  fileUrl         String
  fields          Json
  
  courtType       String?
  documentType    String?
  jurisdiction    String?
  
  useCount        Int      @default(0)
  lastUsed        DateTime?
  
  isPublic        Boolean  @default(false)
  sharedWith      String[]
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  generatedDocs   GeneratedDocument[]
  
  @@index([userId, documentType])
  @@index([isPublic, jurisdiction])
}

model GeneratedDocument {
  id              String   @id @default(cuid())
  templateId      String
  sessionId       String?
  matterId        String
  userId          String
  
  fileName        String
  fileUrl         String
  format          String
  
  fieldValues     Json
  
  version         Int      @default(1)
  parentId        String?
  
  status          String   @default("draft")
  
  createdAt       DateTime @default(now())
  
  template        DocumentTemplate @relation(fields: [templateId], references: [id])
  session         Session?  @relation(fields: [sessionId], references: [id], onDelete: SetNull)
  matter          Matter    @relation(fields: [matterId], references: [id], onDelete: Cascade)
  user            User      @relation(fields: [userId], references: [id])
  
  @@index([matterId, createdAt])
  @@index([templateId])
  @@index([userId, status])
}

// ============================================================================
// FEATURE 9: CONFLICT CHECKING
// ============================================================================

model ConflictCheck {
  id              String   @id @default(cuid())
  userId          String
  
  partyNames      String[]
  companyNames    String[]
  matterId        String?
  
  conflicts       Json
  status          String
  riskLevel       String?
  
  reviewedBy      String?
  reviewedAt      DateTime?
  resolution      String?
  resolutionNotes String?  @db.Text
  
  createdAt       DateTime @default(now())
  
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  matter          Matter?  @relation(fields: [matterId], references: [id], onDelete: SetNull)
  
  @@index([userId, createdAt])
  @@index([status, riskLevel])
}

// ============================================================================
// FEATURE 10: BACKUP & DISASTER RECOVERY
// ============================================================================

model Backup {
  id              String   @id @default(cuid())
  userId          String?
  
  type            String
  scope           String
  scopeId         String?
  
  resources       Json
  
  storageProvider String
  backupUrl       String
  encryptionKey   String
  
  size            BigInt
  checksum        String
  compressionType String?
  
  retentionUntil  DateTime
  isEncrypted     Boolean  @default(true)
  
  status          String   @default("pending")
  progress        Int      @default(0)
  error           String?  @db.Text
  
  createdAt       DateTime @default(now())
  completedAt     DateTime?
  
  @@index([userId, createdAt])
  @@index([status, createdAt])
  @@index([retentionUntil])
}

// ============================================================================
// BILLING & TIME TRACKING
// ============================================================================

model BillableTime {
  id              String   @id @default(cuid())
  sessionId       String
  matterId        String
  userId          String
  
  startTime       DateTime
  endTime         DateTime
  durationSeconds Int
  billableSeconds Int
  
  hourlyRate      Float
  amount          Float
  
  activityType    String
  description     String?  @db.Text
  
  status          String   @default("draft")
  invoiceId       String?
  invoiceDate     DateTime?
  
  createdAt       DateTime @default(now())
  
  session         Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  matter          Matter   @relation(fields: [matterId], references: [id], onDelete: Cascade)
  user            User     @relation(fields: [userId], references: [id])
  
  @@index([matterId, createdAt])
  @@index([userId, status])
  @@index([invoiceId])
}

// ============================================================================
// SYSTEM TABLES
// ============================================================================

model FeatureFlag {
  id              String   @id @default(cuid())
  name            String   @unique
  description     String?  @db.Text
  isEnabled       Boolean  @default(false)
  rolloutPercent  Int      @default(0)
  enabledForUsers String[]
  metadata        Json     @default("{}")
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@index([isEnabled])
}

model SystemLog {
  id              String   @id @default(cuid())
  level           String
  service         String
  message         String   @db.Text
  error           String?  @db.Text
  stack           String?  @db.Text
  metadata        Json     @default("{}")
  timestamp       DateTime @default(now())
  
  @@index([level, timestamp])
  @@index([service, timestamp])
}
```

---

## Feature Specifications

### Feature Toggles System

All features can be enabled/disabled per-user in settings.

#### Default Feature States by Subscription Tier

| Feature | Free | Starter | Professional | Enterprise |
|---------|------|---------|--------------|------------|
| Audit Logging | ✓ Basic | ✓ Full | ✓ Full | ✓ Full |
| Version Control | ✓ | ✓ | ✓ | ✓ |
| Timestamp Verification | ✗ | ✓ | ✓ | ✓ |
| Redaction Tools | ✗ | ✓ | ✓ | ✓ |
| Speaker Diarization | ✗ | ✓ | ✓ | ✓ |
| Conflict Checking | ✗ | ✗ | ✓ | ✓ |
| Auto Backup | ✗ | ✓ Daily | ✓ Hourly | ✓ Real-time |
| Offline Mode | ✗ | ✗ | ✓ | ✓ |
| Voice Commands | ✗ | ✗ | ✓ | ✓ |
| Citation Checking | ✗ | ✓ Basic | ✓ Advanced | ✓ Advanced |
| Billable Time Tracking | ✓ | ✓ | ✓ | ✓ |
| Document Generation | ✗ | ✓ 10/mo | ✓ 100/mo | ✓ Unlimited |

### AI Provider Configuration

#### Supported Providers

1. **Anthropic Claude**
   - Models: claude-sonnet-4-20250514, claude-opus-4-20250514
   - Best for: Legal reasoning, citation analysis
   - Cost: ~$3/1M input tokens, ~$15/1M output tokens

2. **OpenAI**
   - Models: gpt-4o, gpt-4-turbo, gpt-4
   - Best for: General assistance, document generation
   - Cost: ~$5/1M input tokens, ~$15/1M output tokens

3. **Google Gemini**
   - Models: gemini-1.5-pro, gemini-1.5-flash
   - Best for: Long context (2M tokens)
   - Cost: ~$1.25/1M input tokens, ~$5/1M output tokens

4. **OpenRouter** (NEW)
   - Aggregates all providers above plus:
     - Meta Llama 3.3 70B
     - Mistral Large
     - Cohere Command R+
   - Best for: Cost optimization, model flexibility
   - Cost: Varies by model (typically 20-30% cheaper)

#### OpenRouter Integration

```typescript
// lib/ai/openrouter-client.ts
import OpenAI from 'openai'

export class OpenRouterClient {
  private client: OpenAI
  
  constructor(apiKey: string) {
    this.client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: apiKey,
      defaultHeaders: {
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL,
        'X-Title': 'Law Transcribed',
      },
    })
  }
  
  async chat(messages: any[], model: string = 'anthropic/claude-sonnet-4') {
    const response = await this.client.chat.completions.create({
      model,
      messages,
    })
    return response
  }
  
  // Available models on OpenRouter:
  // - anthropic/claude-sonnet-4
  // - anthropic/claude-opus-4
  // - openai/gpt-4o
  // - google/gemini-pro-1.5
  // - meta-llama/llama-3.3-70b-instruct
  // - mistralai/mistral-large
  // - cohere/command-r-plus
}
```

### Citation Checking Details

The AI-powered citation checker validates:

1. **Michigan Citations**
   - MCL (Michigan Compiled Laws)
   - MCR (Michigan Court Rules)
   - Michigan case law

2. **Federal Citations**
   - USC (United States Code)
   - CFR (Code of Federal Regulations)
   - Federal case law

3. **Validation Checks**
   - Format correctness
   - Current validity (not superseded)
   - Treatment status (good law, overruled, etc.)
   - Proper Bluebook formatting

---

## Subscription Tiers

### Tier 1: Free

**Price:** $0/month

**Limits:**
- 2 sessions per month
- 30 minutes total transcription
- 10 AI requests per month
- 1 GB storage
- 1 user

**Features:**
- ✓ Basic transcription
- ✓ Basic audit logging (30 days retention)
- ✓ Version control
- ✓ Billable time tracking
- ✗ Advanced AI features
- ✗ Document generation
- ✗ Offline mode
- ✗ Voice commands

**Use Case:** Trial/evaluation, very light usage

---

### Tier 2: Starter

**Price:** $29/month or $290/year (17% discount)

**Stripe Price IDs:**
- Monthly: `price_starter_monthly`
- Yearly: `price_starter_yearly`

**Limits:**
- 25 sessions per month
- 500 minutes transcription
- 500 AI requests per month
- 25 GB storage
- 1 user

**Features:**
- ✓ All Free features
- ✓ Full audit logging (1 year retention)
- ✓ Timestamp verification
- ✓ Redaction tools
- ✓ Speaker diarization
- ✓ Basic citation checking
- ✓ Document generation (10 per month)
- ✓ Daily backups
- ✗ Conflict checking
- ✗ Offline mode
- ✗ Voice commands
- ✗ Priority support

**Use Case:** Solo practitioners, occasional use

---

### Tier 3: Professional

**Price:** $99/month or $990/year (17% discount)

**Stripe Price IDs:**
- Monthly: `price_professional_monthly`
- Yearly: `price_professional_yearly`

**Limits:**
- Unlimited sessions
- 2,000 minutes transcription per month
- 2,000 AI requests per month
- 100 GB storage
- 3 users

**Features:**
- ✓ All Starter features
- ✓ Advanced citation checking
- ✓ Conflict checking
- ✓ Document generation (100 per month)
- ✓ Offline mode
- ✓ Voice commands
- ✓ Hourly backups
- ✓ Export to all formats
- ✓ Custom templates
- ✓ Priority email support
- ✗ SSO integration
- ✗ Custom branding
- ✗ API access

**Use Case:** Active solo practitioners, small firms

---

### Tier 4: Enterprise

**Price:** $299/month or $2,990/year (17% discount)

**Stripe Price IDs:**
- Monthly: `price_enterprise_monthly`
- Yearly: `price_enterprise_yearly`

**Limits:**
- Unlimited sessions
- Unlimited transcription
- Unlimited AI requests
- 1 TB storage
- Unlimited users

**Features:**
- ✓ All Professional features
- ✓ Real-time backups
- ✓ Unlimited document generation
- ✓ SSO integration (SAML/OIDC)
- ✓ Custom branding
- ✓ API access
- ✓ Dedicated account manager
- ✓ Phone support
- ✓ 99.9% SLA
- ✓ Custom integrations
- ✓ White-label options
- ✓ Advanced analytics

**Use Case:** Law firms, corporate legal departments

---

### Stripe Integration Plan

```typescript
// lib/stripe/plans.ts

export const SUBSCRIPTION_PLANS = {
  free: {
    name: 'Free',
    slug: 'free',
    priceMonthly: 0,
    priceYearly: 0,
    limits: {
      maxSessions: 2,
      maxStorageGB: 1,
      maxAIRequests: 10,
      maxMatters: 5,
      maxUsers: 1,
      transcriptionMinutesPerMonth: 30,
      documentGenerationPerMonth: 0,
    },
  },
  starter: {
    name: 'Starter',
    slug: 'starter',
    priceMonthly: 2900, // $29.00
    priceYearly: 29000, // $290.00
    stripePriceIdMonthly: process.env.STRIPE_PRICE_STARTER_MONTHLY,
    stripePriceIdYearly: process.env.STRIPE_PRICE_STARTER_YEARLY,
    limits: {
      maxSessions: 25,
      maxStorageGB: 25,
      maxAIRequests: 500,
      maxMatters: 50,
      maxUsers: 1,
      transcriptionMinutesPerMonth: 500,
      documentGenerationPerMonth: 10,
    },
  },
  professional: {
    name: 'Professional',
    slug: 'professional',
    priceMonthly: 9900, // $99.00
    priceYearly: 99000, // $990.00
    stripePriceIdMonthly: process.env.STRIPE_PRICE_PROFESSIONAL_MONTHLY,
    stripePriceIdYearly: process.env.STRIPE_PRICE_PROFESSIONAL_YEARLY,
    limits: {
      maxSessions: -1, // Unlimited
      maxStorageGB: 100,
      maxAIRequests: 2000,
      maxMatters: -1, // Unlimited
      maxUsers: 3,
      transcriptionMinutesPerMonth: 2000,
      documentGenerationPerMonth: 100,
    },
  },
  enterprise: {
    name: 'Enterprise',
    slug: 'enterprise',
    priceMonthly: 29900, // $299.00
    priceYearly: 299000, // $2,990.00
    stripePriceIdMonthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY,
    stripePriceIdYearly: process.env.STRIPE_PRICE_ENTERPRISE_YEARLY,
    limits: {
      maxSessions: -1, // Unlimited
      maxStorageGB: 1000,
      maxAIRequests: -1, // Unlimited
      maxMatters: -1, // Unlimited
      maxUsers: -1, // Unlimited
      transcriptionMinutesPerMonth: -1, // Unlimited
      documentGenerationPerMonth: -1, // Unlimited
    },
  },
} as const

export type SubscriptionTier = keyof typeof SUBSCRIPTION_PLANS
```

---

## Implementation Phases

### Phase 1: Foundation (Weeks 1-2)

**Goal:** Set up project infrastructure and basic authentication

**Tasks:**
1. Initialize Next.js 15 project
2. Configure Tailwind CSS v4
3. Set up Prisma with PostgreSQL
4. Configure Supabase (auth + storage)
5. Set up Upstash Redis
6. Implement OAuth authentication
7. Create basic user dashboard

**Deliverables:**
- Working Next.js app with authentication
- Database schema deployed
- Redis cache configured
- Basic UI components library

**Testing:**
- OAuth login flow (Google + Microsoft)
- Session management
- Database connections

---

### Phase 2: Core Transcription (Weeks 3-4)

**Goal:** Implement real-time voice dictation

**Tasks:**
1. Audio capture with RecordRTC
2. Multi-provider ASR integration
   - Deepgram
   - AssemblyAI
   - Google Speech-to-Text
3. Real-time transcript display
4. Session management
5. Audio storage in Supabase
6. Basic transcript editing

**Deliverables:**
- Working dictation interface
- Real-time transcription
- Session save/load
- Audio playback

**Testing:**
- Audio recording in Chrome, Safari, Firefox
- ASR provider failover
- Transcript accuracy

---

### Phase 3: AI Chat Integration (Weeks 5-6)

**Goal:** Add AI-powered assistance

**Tasks:**
1. Integrate Anthropic Claude
2. Integrate OpenAI
3. Integrate Google Gemini
4. Integrate OpenRouter
5. Chat interface alongside transcript
6. Context-aware responses
7. "Insert to transcript" functionality
8. API key management UI

**Deliverables:**
- Multi-provider AI chat
- Encrypted API key storage
- Provider selection UI
- Usage tracking

**Testing:**
- All 4 AI providers
- API key encryption/decryption
- Streaming responses
- Error handling

---

### Phase 4: Feature Set 1 (Weeks 7-8)

**Goal:** Implement audit logging, version control, timestamps, speakers

**Tasks:**
1. **Audit Logging**
   - Track all user actions
   - Store IP, user agent, location
   - Retention policies
   - Audit log viewer UI

2. **Version Control**
   - Auto-save versions
   - Manual save points
   - Diff viewer
   - Rollback functionality

3. **Timestamp Verification**
   - NTP time synchronization
   - SHA-256 content hashing
   - Optional RFC 3161 tokens
   - Verification UI

4. **Speaker Identification**
   - ASR diarization integration
   - Speaker labeling UI
   - Voice profile storage
   - Speaker statistics

**Deliverables:**
- Complete audit trail
- Version history UI
- Timestamp verification
- Speaker management

**Testing:**
- Audit log completeness
- Version diff accuracy
- Timestamp verification
- Speaker identification accuracy

---

### Phase 5: Feature Set 2 (Weeks 9-10)

**Goal:** Implement redaction, conflict checking, backups, citations

**Tasks:**
1. **Redaction Tools**
   - PII detection with Compromise
   - Manual redaction UI
   - Access control for unredacting
   - Redaction audit trail

2. **Conflict Checking**
   - Fuzzy name matching
   - Party/company search
   - Conflict report generation
   - Resolution tracking

3. **Backup System**
   - Automated backup scheduler
   - Encrypted backup storage
   - Restore functionality
   - Backup verification

4. **Citation Checking (AI)**
   - Pattern extraction (MCL, MCR, cases)
   - AI verification with all providers
   - Citation formatting
   - Shepardizing equivalent
   - Citation database

**Deliverables:**
- Redaction UI
- Conflict check reports
- Automated backups
- Citation verification

**Testing:**
- PII detection accuracy
- Conflict check precision
- Backup integrity
- Citation verification accuracy

---

### Phase 6: Advanced Features (Weeks 11-12)

**Goal:** Offline mode, voice commands, settings

**Tasks:**
1. **Offline Mode**
   - IndexedDB storage
   - Service Worker
   - Sync queue
   - Conflict resolution
   - Offline indicator

2. **Voice Commands**
   - Web Speech API integration
   - Custom command system
   - Legal-specific commands
   - Wake word detection

3. **Settings UI**
   - Feature toggles
   - Provider preferences
   - Notification settings
   - Backup configuration

**Deliverables:**
- Working offline mode
- Voice command system
- Complete settings interface

**Testing:**
- Offline functionality
- Sync reliability
- Voice command accuracy
- Settings persistence

---

### Phase 7: Document Generation (Weeks 13-14)

**Goal:** Template system and document export

**Tasks:**
1. **Template Management**
   - DOCX template parser
   - Field detection
   - Template library
   - Template sharing

2. **Document Generation**
   - Fill templates from transcript
   - Voice-driven field navigation
   - Michigan-specific validators
   - Export with track changes

3. **Export Formats**
   - PDF (standard + certified)
   - DOCX (with track changes)
   - TXT (plain text)
   - RTF (rich text)

**Deliverables:**
- Template system
- Document generator
- Multi-format export
- Court-ready formatting

**Testing:**
- Template parsing accuracy
- Field detection
- Export format compliance
- Track changes integrity

---

### Phase 8: Subscription System (Weeks 15-16)

**Goal:** Implement Stripe billing and tier enforcement

**Tasks:**
1. **Stripe Integration**
   - Create products and prices
   - Subscription creation
   - Webhook handlers
   - Invoice generation

2. **Tier Enforcement**
   - Usage tracking
   - Limit enforcement
   - Feature gating
   - Upgrade prompts

3. **Billing Portal**
   - Subscription management
   - Payment method updates
   - Invoice history
   - Usage dashboard

**Deliverables:**
- Working subscription system
- Tier-based feature access
- Customer portal
- Usage analytics

**Testing:**
- Subscription lifecycle
- Webhook reliability
- Limit enforcement
- Billing accuracy

---

### Phase 9: Mobile App (Weeks 17-20)

**Goal:** Build React Native apps for iOS and Android

**Tasks:**
1. **Setup**
   - Expo project initialization
   - Shared API client
   - Shared state management
   - Navigation structure

2. **Core Features**
   - Authentication (OAuth + biometric)
   - Recording interface
   - Offline-first architecture
   - Background recording

3. **Mobile-Specific**
   - Push notifications
   - Local file management
   - Voice commands (native)
   - Camera integration (document scanning)

4. **App Store Preparation**
   - App icons and splash screens
   - Privacy policy
   - App Store listing
   - TestFlight/Play Store beta

**Deliverables:**
- iOS app (TestFlight)
- Android app (Play Store beta)
- Offline functionality
- Native integrations

**Testing:**
- iOS devices (iPhone 12+)
- Android devices (Android 10+)
- Offline sync
- Battery optimization

---

### Phase 10: Testing & Launch (Weeks 21-24)

**Goal:** Comprehensive testing and production launch

**Tasks:**
1. **Testing**
   - E2E tests with Playwright
   - Integration tests
   - Load testing
   - Security audit
   - Accessibility audit

2. **Documentation**
   - User guide
   - API documentation
   - Admin documentation
   - Video tutorials

3. **Launch Preparation**
   - Beta user recruitment (20 Michigan attorneys)
   - Feedback collection
   - Bug fixes
   - Performance optimization

4. **Production Launch**
   - DNS configuration
   - SSL certificates
   - Monitoring setup (Sentry)
   - Analytics (Vercel + custom)
   - Marketing site

**Deliverables:**
- Production-ready web app
- iOS app (App Store)
- Android app (Play Store)
- Complete documentation
- Marketing site

**Testing:**
- Full user journey
- Security penetration testing
- Load testing (100 concurrent users)
- Mobile app review compliance

---

## Deployment Strategy

### Infrastructure

```
Production Environment:
- Frontend: Vercel (Next.js)
- Database: Supabase (PostgreSQL)
- Cache: Upstash (Redis)
- CDN: Cloudflare
- Storage: Supabase Storage
- Monitoring: Sentry + Vercel Analytics
```

### Environments

1. **Development**
   - Local: `localhost:3000`
   - Database: Local Supabase
   - Redis: Local

2. **Staging**
   - URL: `staging.lawtranscribed.com`
   - Database: Supabase (staging project)
   - Redis: Upstash (staging)
   - Auto-deploy from `develop` branch

3. **Production**
   - URL: `app.lawtranscribed.com`
   - Database: Supabase (production project)
   - Redis: Upstash (production)
   - Auto-deploy from `main` branch

### CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
name: CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      
      - run: pnpm install
      - run: pnpm run lint
      - run: pnpm run type-check
      - run: pnpm run test
      
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
      - uses: microsoft/playwright-action@v1
      
      - run: pnpm install
      - run: pnpm exec playwright install
      - run: pnpm run test:e2e
      
  deploy:
    needs: [test, e2e]
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: ${{ github.ref == 'refs/heads/main' && '--prod' || '' }}
```

### Database Migrations

```bash
# Run migrations in staging
npx prisma migrate deploy

# Run migrations in production
# (done automatically via Vercel build)
```

### Environment Variables

```bash
# Required for all environments
NEXT_PUBLIC_APP_URL=
DATABASE_URL=
DIRECT_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
MASTER_ENCRYPTION_KEY=
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_SENTRY_DSN=

# Optional (for enhanced features)
OPENAI_API_KEY= # For OpenAI fallback
ANTHROPIC_API_KEY= # For Anthropic fallback
GOOGLE_AI_API_KEY= # For Gemini fallback
```

---

## Testing Strategy

### Unit Tests (Vitest)

```typescript
// tests/unit/citation-checker.test.ts
import { describe, it, expect } from 'vitest'
import { extractCitations } from '@/lib/services/citation-checker'

describe('Citation Extraction', () => {
  it('should extract MCL citations', () => {
    const text = 'According to MCL 600.2912a, the plaintiff...'
    const citations = extractCitations(text)
    
    expect(citations).toHaveLength(1)
    expect(citations[0].citation).toBe('MCL 600.2912a')
    expect(citations[0].type).toBe('STATUTE')
  })
  
  it('should extract case citations', () => {
    const text = 'In Smith v. Jones, 500 Mich 100, the court held...'
    const citations = extractCitations(text)
    
    expect(citations).toHaveLength(1)
    expect(citations[0].type).toBe('CASE')
  })
})
```

### Integration Tests

```typescript
// tests/integration/api/sessions.test.ts
import { describe, it, expect } from 'vitest'
import { createMockUser, createMockSession } from '../helpers'

describe('Session API', () => {
  it('should create a new session', async () => {
    const user = await createMockUser()
    const response = await fetch('/api/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${user.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        matterId: user.matters[0].id,
        title: 'Test Session',
      }),
    })
    
    expect(response.status).toBe(201)
    const session = await response.json()
    expect(session.title).toBe('Test Session')
  })
})
```

### E2E Tests (Playwright)

```typescript
// tests/e2e/dictation.spec.ts
import { test, expect } from '@playwright/test'

test('complete dictation workflow', async ({ page }) => {
  // Login
  await page.goto('/login')
  await page.click('text=Continue with Google')
  // ... OAuth flow ...
  
  // Start new session
  await page.goto('/dictation')
  await page.click('text=New Session')
  await page.fill('input[name="title"]', 'Test Dictation')
  await page.click('text=Start Recording')
  
  // Wait for recording to start
  await expect(page.locator('.recording-indicator')).toBeVisible()
  
  // Simulate speech (in real test, use actual audio)
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('mock-transcript', {
      detail: { text: 'This is a test transcript' }
    }))
  })
  
  // Verify transcript appears
  await expect(page.locator('text=This is a test transcript')).toBeVisible()
  
  // Stop recording
  await page.click('text=Stop Recording')
  
  // Verify session saved
  await expect(page.locator('text=Session saved')).toBeVisible()
})
```

### Load Testing

```javascript
// k6-load-test.js
import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  stages: [
    { duration: '2m', target: 10 }, // Ramp up to 10 users
    { duration: '5m', target: 10 }, // Stay at 10 users
    { duration: '2m', target: 50 }, // Ramp up to 50 users
    { duration: '5m', target: 50 }, // Stay at 50 users
    { duration: '2m', target: 0 },  // Ramp down
  ],
}

export default function () {
  const res = http.get('https://app.lawtranscribed.com/api/health')
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  })
  sleep(1)
}
```

---

## Complete package.json

```json
{
  "name": "law-transcribed",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit",
    "db:push": "prisma db push",
    "db:migrate": "prisma migrate dev",
    "db:migrate:deploy": "prisma migrate deploy",
    "db:studio": "prisma studio",
    "db:generate": "prisma generate",
    "db:seed": "tsx prisma/seed.ts",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:load": "k6 run k6-load-test.js"
  },
  "dependencies": {
    "next": "15.0.3",
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "typescript": "5.6.3",
    "@prisma/client": "5.20.0",
    "@supabase/supabase-js": "2.39.0",
    "@supabase/ssr": "0.1.0",
    "zustand": "5.0.0-rc.2",
    "@tanstack/react-query": "5.56.2",
    "@tanstack/react-query-devtools": "5.56.2",
    "@tanstack/react-query-persist-client": "5.56.2",
    "@radix-ui/react-alert-dialog": "1.1.2",
    "@radix-ui/react-avatar": "1.1.1",
    "@radix-ui/react-checkbox": "1.1.2",
    "@radix-ui/react-dialog": "1.1.2",
    "@radix-ui/react-dropdown-menu": "2.1.2",
    "@radix-ui/react-label": "2.1.0",
    "@radix-ui/react-popover": "1.1.2",
    "@radix-ui/react-progress": "1.1.0",
    "@radix-ui/react-scroll-area": "1.2.0",
    "@radix-ui/react-select": "2.1.2",
    "@radix-ui/react-separator": "1.1.0",
    "@radix-ui/react-slider": "1.2.1",
    "@radix-ui/react-switch": "1.1.1",
    "@radix-ui/react-tabs": "1.1.1",
    "@radix-ui/react-toast": "1.2.2",
    "@radix-ui/react-tooltip": "1.1.3",
    "lucide-react": "0.446.0",
    "class-variance-authority": "0.7.0",
    "clsx": "2.1.1",
    "tailwind-merge": "2.5.4",
    "wavesurfer.js": "7.8.6",
    "recordrtc": "5.6.2",
    "@anthropic-ai/sdk": "0.27.3",
    "openai": "4.67.3",
    "@google/generative-ai": "0.21.0",
    "@upstash/redis": "1.34.3",
    "@upstash/ratelimit": "2.0.3",
    "docxtemplater": "3.50.0",
    "mammoth": "1.8.0",
    "pdf-lib": "1.17.1",
    "@pdfme/generator": "4.5.2",
    "html-pdf-node": "1.0.8",
    "docx": "8.5.0",
    "jszip": "3.10.1",
    "@noble/hashes": "1.5.0",
    "@noble/ciphers": "1.0.0",
    "bcrypt": "5.1.1",
    "stripe": "17.2.0",
    "@stripe/stripe-js": "4.8.0",
    "date-fns": "4.1.0",
    "decimal.js": "10.4.3",
    "zod": "3.23.8",
    "nanoid": "5.0.7",
    "@tanstack/react-table": "8.20.5",
    "diff": "7.0.0",
    "immer": "10.1.1",
    "ntp-client": "0.5.3",
    "compromise": "14.14.2",
    "string-similarity": "4.0.4",
    "react-select": "5.8.1",
    "fuzzysort": "3.0.2",
    "natural": "8.0.1",
    "tar-stream": "3.1.7",
    "@aws-sdk/client-s3": "3.686.0",
    "idb": "8.0.0",
    "workbox-webpack-plugin": "7.1.0",
    "react-speech-recognition": "3.10.0",
    "focus-trap-react": "10.2.3",
    "axios": "1.7.7",
    "@sentry/nextjs": "8.33.1",
    "@vercel/analytics": "1.3.1",
    "@vercel/speed-insights": "1.0.12"
  },
  "devDependencies": {
    "@types/node": "20.11.30",
    "@types/react": "18.3.11",
    "@types/react-dom": "18.3.0",
    "@types/bcrypt": "5.0.2",
    "autoprefixer": "10.4.20",
    "postcss": "8.4.47",
    "tailwindcss": "4.0.0-beta.1",
    "eslint": "8.57.1",
    "eslint-config-next": "15.0.3",
    "prisma": "5.20.0",
    "tsx": "4.19.1",
    "vitest": "2.1.3",
    "@vitest/ui": "2.1.3",
    "@vitejs/plugin-react": "4.3.3",
    "playwright": "1.48.2",
    "@playwright/test": "1.48.2",
    "@testing-library/react": "16.0.1",
    "@testing-library/jest-dom": "6.5.0",
    "@testing-library/user-event": "14.5.2"
  },
  "engines": {
    "node": ">=20.11.0",
    "pnpm": ">=9.0.0"
  }
}
```

---

## Next Steps

1. **Initialize Project**
   ```bash
   npx create-next-app@latest law-transcribed --typescript --tailwind --app
   cd law-transcribed
   pnpm install
   ```

2. **Setup Supabase**
   - Create project at supabase.com
   - Enable Google OAuth
   - Enable Microsoft OAuth
   - Create storage bucket for audio files

3. **Setup Stripe**
   - Create account
   - Create products (Free, Starter, Professional, Enterprise)
   - Create prices (monthly + yearly)
   - Setup webhook endpoint

4. **Setup Upstash Redis**
   - Create database
   - Copy connection details

5. **Copy Environment Variables**
   - Create `.env.local`
   - Fill in all required variables

6. **Initialize Database**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

7. **Start Development**
   ```bash
   pnpm dev
   ```

---

**Ready to begin implementation with Claude Code!** 🚀