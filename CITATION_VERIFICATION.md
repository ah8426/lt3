# Citation Verification System

**Status**: ✅ **IMPLEMENTED**
**Date**: 2025-10-07

## Overview

AI-powered legal citation verification system that automatically detects, extracts, and verifies citations in legal transcripts. Supports Michigan and Federal law citations.

## Features

### 1. Citation Detection
- **Automatic extraction** of citations from text
- **Real-time detection** as user types (debounced)
- **Multiple citation types** supported:
  - MCL (Michigan Compiled Laws)
  - MCR (Michigan Court Rules)
  - USC (United States Code)
  - CFR (Code of Federal Regulations)
  - Case citations (Mich, Mich App, US, F.2d, F.3d, N.W.2d)

### 2. AI-Powered Verification
- **Format correctness** - Bluebook compliance checking
- **Current validity** - Check if law is still valid
- **Treatment status** - Good law, questioned, negative, superseded
- **Bluebook formatting** - Proper citation format suggestions
- **Confidence scoring** - AI confidence in verification (0-100%)

### 3. Visual Indicators
- **Color-coded underlining**:
  - Green: Verified and valid
  - Red: Invalid or has issues
  - Blue: Unverified
- **Citation badges** with status icons
- **Tooltips** with detailed verification information
- **Context menu** for quick verification

### 4. Batch Operations
- **Verify all** citations at once
- **Progress tracking** during batch verification
- **Cost tracking** for AI usage
- **Export to CSV** for external use

## File Structure

```
lib/services/
  └── citation-checker.ts          # Core citation extraction and verification

app/api/citations/
  └── check/route.ts                # API endpoints for citation checking

components/citations/
  ├── CitationBadge.tsx             # Citation display with status
  ├── CitationPanel.tsx             # Side panel for managing citations
  └── TranscriptWithCitations.tsx   # Transcript editor with citation detection

hooks/
  └── useCitations.ts               # React hook for citation management

lib/features/
  └── citation-verification.ts      # Feature flag and settings
```

## Citation Patterns

### Michigan Compiled Laws (MCL)
```regex
MCL 600.2591
MCL § 600.2591
MCLA 600.2591(1)(a)
```

### Michigan Court Rules (MCR)
```regex
MCR 2.116
MCR 2.116(C)(10)
```

### United States Code (USC)
```regex
42 USC 1983
42 U.S.C. § 1983
42 USC § 1983(a)
```

### Code of Federal Regulations (CFR)
```regex
29 CFR 1910.1200
29 C.F.R. § 1910.1200
```

### Case Citations

#### Michigan Supreme Court
```regex
500 Mich 1
500 Mich 1, 5
```

#### Michigan Court of Appeals
```regex
300 Mich App 1
```

#### US Supreme Court
```regex
500 US 1
500 U.S. 1
```

#### Federal Reporter
```regex
900 F.2d 100
900 F.3d 100
```

#### Northwestern Reporter
```regex
800 NW2d 1
800 N.W.2d 1
```

#### Full Case Citation
```regex
Smith v Jones, 500 Mich 1; 800 NW2d 100 (2011)
People v Smith, 300 Mich App 1 (2013)
```

## API Usage

### Check Citations

**POST** `/api/citations/check`

Request body:
```json
{
  "text": "See MCL 600.2591 and Smith v Jones, 500 Mich 1 (2011)",
  "sessionId": "session-123",
  "provider": "anthropic",
  "model": "claude-3-5-sonnet-20241022",
  "storeResults": true
}
```

Response:
```json
{
  "citations": [
    {
      "id": "citation-1",
      "text": "MCL 600.2591",
      "type": "mcl",
      "startIndex": 4,
      "endIndex": 16,
      "jurisdiction": "Michigan",
      "statute": {
        "title": "600",
        "section": "2591"
      }
    }
  ],
  "verifications": [
    {
      "citationId": "citation-1",
      "isValid": true,
      "isFormatCorrect": true,
      "isCurrentlyValid": true,
      "treatmentStatus": "good",
      "bluebookFormat": "MICH. COMP. LAWS § 600.2591",
      "confidence": 95,
      "verifiedAt": "2025-10-07T...",
      "verificationSource": "ai"
    }
  ],
  "batch": {
    "totalChecked": 2,
    "validCount": 2,
    "invalidCount": 0,
    "unknownCount": 0,
    "cost": 0.003
  }
}
```

### Get Citation History

**GET** `/api/citations/check?sessionId=session-123`

Response:
```json
{
  "citations": [
    {
      "id": "...",
      "sessionId": "session-123",
      "citationType": "mcl",
      "fullCitation": "MCL 600.2591",
      "isVerified": true,
      "verificationStatus": "good",
      "verifiedAt": "2025-10-07T...",
      "verifiedBy": "ai"
    }
  ]
}
```

## React Hook Usage

### Basic Usage

```typescript
import { useCitations } from '@/hooks/useCitations'

function MyComponent() {
  const {
    citations,
    verifications,
    isVerifying,
    verifyCitation,
    verifyAllCitations,
    exportCitations,
    stats,
  } = useCitations({
    text: transcriptText,
    sessionId: 'session-123',
    autoExtract: true,
  })

  return (
    <div>
      <p>Found {stats.total} citations</p>
      <p>Verified: {stats.verified}</p>
      <button onClick={verifyAllCitations}>Verify All</button>
    </div>
  )
}
```

### Live Detection

```typescript
import { useLiveCitationDetection } from '@/hooks/useCitations'

function Editor() {
  const [text, setText] = useState('')

  const { citations } = useLiveCitationDetection(text, {
    debounceMs: 1000,
    onCitationDetected: (citations) => {
      console.log('New citations detected:', citations)
    },
  })

  return (
    <textarea
      value={text}
      onChange={(e) => setText(e.target.value)}
    />
  )
}
```

## Component Usage

### Citation Badge

```typescript
import { CitationBadge } from '@/components/citations/CitationBadge'

<CitationBadge
  citation={citation}
  verification={verification}
  onClick={() => handleClick(citation)}
  showTooltip={true}
/>
```

### Citation Panel

```typescript
import { CitationPanel } from '@/components/citations/CitationPanel'

<CitationPanel
  citations={citations}
  verifications={verificationMap}
  onVerifyAll={handleVerifyAll}
  onVerifySingle={handleVerifySingle}
  onExport={handleExport}
  isVerifying={isVerifying}
  verificationProgress={{ current: 3, total: 10 }}
/>
```

### Transcript with Citations

```typescript
import { TranscriptWithCitations } from '@/components/citations/TranscriptWithCitations'

<TranscriptWithCitations
  text={transcript}
  onChange={setTranscript}
  sessionId="session-123"
  editable={true}
  enableCitationDetection={true}
/>
```

## Feature Flag

The citation verification feature can be toggled in user settings:

```typescript
import { isCitationVerificationEnabled } from '@/lib/features/citation-verification'

const isEnabled = await isCitationVerificationEnabled(userId)
```

Settings include:
- `autoDetect` - Automatically detect citations while typing
- `autoVerify` - Automatically verify detected citations
- `highlightCitations` - Show visual indicators for citations
- `providers` - Preferred AI providers
- `costTracking` - Track AI usage costs

## Database Schema

Citations are stored in the `citation` table (already in schema):

```prisma
model Citation {
  id                  String   @id @default(cuid())
  sessionId           String?
  documentId          String?

  citationType        String   // 'mcl', 'mcr', 'usc', 'cfr', 'case'
  fullCitation        String   @db.Text
  shortCitation       String?

  jurisdiction        String?
  volume              Int?
  reporter            String?
  page                Int?
  year                Int?
  court               String?

  caseName            String?
  statuteCode         String?
  section             String?

  isVerified          Boolean  @default(false)
  verificationStatus  String?  // 'good', 'questioned', 'negative', 'superseded'
  verifiedAt          DateTime?
  verifiedBy          String?
  verificationNotes   String?  @db.Text

  treatmentStatus     String?
  treatmentNotes      String?  @db.Text

  createdAt           DateTime @default(now())

  @@index([sessionId, citationType])
  @@index([isVerified, verificationStatus])
}
```

## AI Prompts

The system uses structured prompts to verify citations:

```
Verify the following legal citation:

Citation Text: "MCL 600.2591"
Type: MCL
Jurisdiction: Michigan
Title: 600
Section: 2591

Please verify:
1. Is the citation format correct according to Bluebook standards?
2. Is this citation currently valid (not superseded, repealed, or overruled)?
3. What is the treatment status (good law, questioned, negative treatment, superseded)?
4. What is the proper Bluebook format for this citation?
5. Any suggestions for improvement?

Respond in JSON format with:
- isValid, isFormatCorrect, isCurrentlyValid
- treatmentStatus, bluebookFormat, suggestions, errors
- confidence (0-100)
- details (fullName, court, decidedDate, status, treatmentNotes)
```

## Cost Management

Citation verification uses AI and incurs costs:
- **Single citation**: ~$0.001 - $0.003 (depending on provider and model)
- **Batch of 10**: ~$0.01 - $0.03
- **Large document (100 citations)**: ~$0.10 - $0.30

All costs are tracked in the `ai_usage` table with purpose `citation_verification`.

## Performance Considerations

1. **Debouncing**: Live detection is debounced by 1 second to avoid excessive processing
2. **Batch verification**: Checks multiple citations in one request when possible
3. **Rate limiting**: 500ms delay between individual verifications to avoid rate limits
4. **Caching**: Verification results are stored in database and reused
5. **Provider failover**: Automatically switches providers if one fails

## Testing

### Test Citation Extraction

```typescript
import { extractCitations } from '@/lib/services/citation-checker'

const text = `
  According to MCL 600.2591 and Smith v Jones, 500 Mich 1 (2011),
  the court must follow 42 USC 1983 and MCR 2.116(C)(10).
`

const citations = extractCitations(text)
// Returns 4 citations: MCL, case, USC, MCR
```

### Test Single Verification

```bash
curl -X POST http://localhost:3000/api/citations/check \
  -H "Content-Type: application/json" \
  -d '{
    "citations": [{
      "id": "test-1",
      "text": "MCL 600.2591",
      "type": "mcl",
      "startIndex": 0,
      "endIndex": 12,
      "statute": {"title": "600", "section": "2591"}
    }]
  }'
```

## Future Enhancements

- [ ] Integration with Westlaw/LexisNexis APIs for authoritative verification
- [ ] Citation network analysis (related cases, citing cases)
- [ ] Shepardizing integration
- [ ] Auto-correct citation formatting
- [ ] Custom citation patterns for other jurisdictions
- [ ] Citation templates library
- [ ] Offline citation database for common citations
- [ ] Browser extension for citation detection in any text field

## Troubleshooting

### Citations not detected
- Check that `enableCitationDetection` is `true`
- Verify citation format matches patterns
- Check console for extraction errors

### Verification failing
- Ensure AI API keys are set in environment
- Check API endpoint is reachable
- Verify provider has sufficient credits
- Check network console for errors

### Slow performance
- Increase debounce time for live detection
- Reduce frequency of auto-verification
- Use batch verification instead of individual checks
- Consider caching verification results

## Support

For issues or questions:
1. Check the console for error messages
2. Verify API keys are valid
3. Check database migrations are applied
4. Review feature flag settings
5. Contact support with session ID and error details
