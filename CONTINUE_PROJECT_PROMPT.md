# Legal Dictation Platform - Project Continuation Prompt

Copy and paste this entire prompt into a new chat with Claude to continue working on this project.

---

## Project Context

I'm building **Law Transcribed**, an AI-powered legal dictation and chat platform for attorneys. This is a professional-grade web application for real-time voice transcription with AI assistance, specifically designed for legal professionals.

### Tech Stack (Latest Versions - October 2025)

**Core Framework:**
- Next.js 15.0.3 with App Router
- React 19.0.0
- TypeScript 5.6.3
- Node.js 20.11.0+
- pnpm 9.0.0+

**Styling:**
- **Tailwind CSS v4.0.0-beta.1** (CSS-first configuration, no tailwind.config.js)
- Radix UI components (latest stable - v1.x)
- Lucide React icons 0.446.0

**Backend & Data:**
- Supabase (auth + secure database storage)
- Prisma 5.20.0 (ORM)
- PostgreSQL 16 with pgvector extension

**Authentication:**
- OAuth 2.0 ONLY (Google Workspace & Microsoft 365)
- No password-based authentication
- All user data stored server-side in Supabase
- API keys encrypted server-side with application-level encryption

**State Management:**
- Zustand 5.0.0
- TanStack Query 5.56.2

**Audio & Transcription:**
- WaveSurfer.js 7.8.6
- RecordRTC 5.6.2
- Multi-provider ASR: Deepgram, AssemblyAI, Google Speech, Azure, Rev.ai, Whisper

**AI/LLM Providers:**
- Anthropic Claude (@anthropic-ai/sdk 0.27.3)
- OpenAI (openai 4.67.1)
- Google Gemini (@google/generative-ai 0.21.0)
- LangChain 0.3.2 (optional)

**Document Processing:**
- docxtemplater 3.50.0
- mammoth 1.8.0
- pdf-lib 1.17.1

**Payments:**
- Stripe 17.1.0

**Security:**
- @noble/hashes 1.5.0
- @noble/ciphers 1.0.0
- bcrypt 5.1.1

**Testing:**
- Vitest 2.1.2
- Playwright 1.48.0
- Testing Library 16.0.1

**Monitoring:**
- Sentry 8.33.1
- Vercel Analytics 1.3.1

### Architecture Mode: OAuth Server-Side (OSS)

**Data Storage Philosophy:**
- ALL user data stored server-side in Supabase Postgres
- User profiles, settings, sessions, transcripts → Database
- Audio files → Supabase Storage (encrypted)
- API keys → Database (encrypted with application-level encryption using master key from environment)
- NO client-side storage of user data (except temporary in-memory state)

**API Key Management:**
- Users provide their own ASR/LLM provider API keys
- Keys encrypted server-side using application-level encryption (Master key → User-specific derived keys → Individual API key encryption)
- All decryption happens server-side in secure API routes
- Client never has direct access to provider keys
- API routes proxy requests to ASR/LLM vendors

### Core Features

1. **Real-time Voice Dictation:**
   - WebRTC audio capture
   - Multi-provider ASR with automatic fallback
   - Live transcript with timestamps and speaker diarization
   - Partial and final transcript rendering

2. **AI Chat Integration:**
   - Chat alongside live transcript
   - Context-aware responses based on transcript
   - "Insert to draft" functionality with provenance tracking
   - Support for Claude, OpenAI, Gemini

3. **Template System:**
   - DOCX/PDF template parsing
   - Field detection patterns: `[Field]`, `{{var}}`, `_____`, `<field name="x">`
   - Voice navigation (next/previous/fill/skip field)
   - Michigan-specific validators (MCR/MCL patterns, court rules)
   - Export with tracked changes

4. **Share Links:**
   - Generate scoped JWT tokens
   - Encrypted transcript storage
   - Public API endpoint with rate limiting
   - Default scope: transcript-only chat
   - Optional audio access
   - 7-day expiry default

5. **Enterprise Security:**
   - OAuth-only authentication
   - Row-level security in database
   - Comprehensive audit logging
   - Encrypted at rest and in transit
   - HIPAA/attorney-client privilege considerations

### Database Schema (Prisma)

```prisma
model User {
  id              String    @id
  email           String    @unique
  fullName        String?
  provider        String    // 'google' or 'microsoft'
  providerId      String
  firmId          String?
  roles           String[]  @default(["user"])
  settings        Json      @default("{}")
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  lastLoginAt     DateTime?
  
  matters         Matter[]
  sessions        Session[]
  apiKeys         EncryptedApiKey[]
  auditLogs       AuditLog[]
}

model Matter {
  id              String   @id @default(cuid())
  name            String
  clientName      String
  jurisdiction    String?
  userId          String
  sessions        Session[]
  documents       Document[]
}

model Session {
  id                    String    @id @default(cuid())
  matterId              String
  userId                String
  status                String    @default("active")
  startedAt             DateTime  @default(now())
  endedAt               DateTime?
  audioStoragePath      String?
  transcriptData        Json?
  shareToken            String?   @unique
  shareExpiresAt        DateTime?
  totalCost             Float     @default(0)
  
  segments              TranscriptSegment[]
  chatMessages          ChatMessage[]
}

model TranscriptSegment {
  id              String   @id @default(cuid())
  sessionId       String
  startMs         Int
  endMs           Int
  text            String   @db.Text
  speaker         String?
  confidence      Float?
  provider        String?
  createdAt       DateTime @default(now())
}

model ChatMessage {
  id              String   @id @default(cuid())
  sessionId       String
  role            String   // user, assistant, system
  content         String   @db.Text
  tokens          Int?
  provider        String?
  cost            Float?
  createdAt       DateTime @default(now())
}

model EncryptedApiKey {
  id              String   @id @default(cuid())
  userId          String
  provider        String   // 'deepgram', 'assemblyai', 'anthropic', etc.
  encryptedKey    String   @db.Text
  iv              String
  authTag         String?
  isActive        Boolean  @default(true)
  createdAt       DateTime @default(now())
  lastUsedAt      DateTime?
  
  @@unique([userId, provider])
}

model AuditLog {
  id              String   @id @default(cuid())
  userId          String?
  sessionId       String?
  action          String
  resource        String?
  resourceId      String?
  ipAddress       String?
  metadata        Json     @default("{}")
  timestamp       DateTime @default(now())
}
```

### Brand Identity

**App Name:** Law Transcribed  
**Tagline:** AI-Powered Legal Dictation & Chat

**Logo:** Professional design featuring:
- Microphone + fountain pen nib hybrid
- Audio waveform (teal gradient)
- Circuit board traces (suggesting AI)
- Color scheme: Teal/turquoise primary (#00BFA5) with navy blue secondary (#1E3A8A)

**Brand Colors (Tailwind v4):**
```css
@theme {
  --color-brand-primary: #00BFA5;
  --color-brand-primary-dark: #00897B;
  --color-brand-secondary: #1E3A8A;
  --color-brand-accent: #80DEEA;
  --color-brand-text-dark: #1F2937;
}
```

### Project Structure

```
legal-dictation/
├── app/
│   ├── (auth)/
│   │   ├── auth/callback
│   │   └── auth/error
│   ├── (app)/
│   │   ├── dictation/
│   │   ├── sessions/
│   │   └── settings/
│   │       ├── api-keys
│   │       ├── billing
│   │       └── account
│   ├── api/
│   │   ├── auth/
│   │   ├── transcription/proxy
│   │   ├── ai/chat
│   │   ├── sessions/
│   │   ├── api-keys/
│   │   └── users/
│   └── share/[token]
├── components/
│   ├── auth/
│   ├── dictation/
│   ├── chat/
│   ├── templates/
│   └── ui/
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   └── server.ts
│   ├── server/
│   │   └── encryption/key-manager.ts
│   ├── stripe/
│   └── validations/
├── hooks/
│   ├── useAuth.ts
│   ├── useAPIKeys.ts
│   ├── useDictation.ts
│   └── useSubscription.ts
├── services/
│   ├── api-client.ts
│   └── session-manager.ts
├── stores/
│   ├── auth-store.ts
│   └── session-store.ts
├── types/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
└── public/
    └── logos/
```

### Key Environment Variables

```bash
# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Database
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# Supabase (Auth + Storage)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# Encryption (Server-side)
MASTER_ENCRYPTION_KEY=[64-character-hex]
ENCRYPTION_KEY_VERSION=1

# Stripe
STRIPE_SECRET_KEY=sk_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_xxx

# Monitoring
NEXT_PUBLIC_SENTRY_DSN=xxx
```

### Recent Decisions & Preferences

1. **Authentication:** OAuth-only (no passwords)
2. **Data Storage:** All server-side (no client-side user data)
3. **API Keys:** User-provided, encrypted server-side
4. **Styling:** Tailwind CSS v4 (CSS-first, no config file)
5. **Target User:** Michigan civil litigation attorneys
6. **Jurisdiction Focus:** Start with Michigan (MCR/MCL), expand later

### What I'm Working On

[DESCRIBE YOUR CURRENT TASK OR QUESTION HERE]

### What I Need Help With

Please help me with:
1. [SPECIFIC REQUEST 1]
2. [SPECIFIC REQUEST 2]
3. [SPECIFIC REQUEST 3]

### Important Notes

- Think through problems logically and use reasoning
- If uncertain, say "I don't know"
- For multiple independent operations, invoke tools simultaneously
- All code should use TypeScript with strict type checking
- Follow Next.js 15 best practices (async cookies/headers/params)
- Use Tailwind CSS v4 syntax (@theme, @utility, etc.)
- Ensure all user data is stored securely server-side

---

## Previous Work Completed

1. ✅ Defined complete architecture (Mode A: OAuth Server-Side)
2. ✅ Updated tech stack to latest compatible versions (October 2025)
3. ✅ Migrated to Tailwind CSS v4 with CSS-first configuration
4. ✅ Designed database schema with Prisma
5. ✅ Established OAuth-only authentication strategy
6. ✅ Created server-side API key encryption architecture
7. ✅ Enhanced logo to multiple high-resolution formats (19 variants)
8. ✅ Defined brand colors and design system

## Reference Documents

The following documents contain the complete project blueprint:
- `LEGAL_DICTATION_README_v2.md` - Original architecture document
- `README_LOGO_GUIDE.md` - Logo usage guide with 19 enhanced versions
- This file - Context for continuing the project

---

**Copy everything above this line into your new chat with Claude.**
