# Smart AI Assistant — "Digital Senior Bid Manager"

**Date:** 2026-03-21
**Status:** Approved
**Context:** TenderCopilot SaaS — the AI assistant must transform from a simple chat Q&A into a full senior bid manager that searches documents, knows procurement law, learns from every tender, proactively guides users, and NEVER gives unsubstantiated information.

---

## Problem

The current AI assistant has critical limitations:

1. **No document search** — answers status questions from structured data (tasks, requirements) but never searches inside the actual tender documents
2. **No persistent knowledge** — every question sends all document text to the AI (scales poorly, expensive)
3. **No learning** — doesn't remember past tenders, corrections, or patterns
4. **Passive only** — waits for user to ask; never warns about missing documents, deadlines, or incompatibilities
5. **No accuracy guarantees** — no source attribution, no confidence levels, no hallucination prevention
6. **No bid management expertise** — doesn't know lead times, common mistakes, or how to prepare a proper tender file

---

## Design Principle

> Ο βοηθός πρέπει να σκέφτεται σαν senior bid manager με 15 χρόνια εμπειρία. Βρίσκει τις απαντήσεις μέσα στα έγγραφα, ξέρει τη νομοθεσία, θυμάται τι δούλεψε και τι όχι, προλαβαίνει τα προβλήματα, και ΠΟΤΕ δεν λέει κάτι που δεν μπορεί να τεκμηριώσει.

---

## Architecture — 5 Layers + Trust Shield

```
┌─────────────────────────────────────────────┐
│           TRUST & ACCURACY SHIELD           │
│  Source attribution, confidence, guardrails │
├─────────────────────────────────────────────┤
│  Layer 5: PROACTIVE ENGINE                  │
│  Background analysis, alerts, roadmap,      │
│  pre-submission checklist                   │
├─────────────────────────────────────────────┤
│  Layer 4: LEARNING MEMORY                   │
│  Per-tenant + global anonymous patterns     │
├─────────────────────────────────────────────┤
│  Layer 3: KNOWLEDGE BASE                    │
│  Practical bid expertise, checklists,       │
│  lead times, common mistakes                │
├─────────────────────────────────────────────┤
│  Layer 2: DOCUMENT RAG (pgvector)           │
│  Semantic search in tender documents        │
├─────────────────────────────────────────────┤
│  Layer 1: INTELLIGENT CONTEXT BUILDER       │
│  Composes context from all layers           │
└─────────────────────────────────────────────┘
```

### Question Flow

```
User asks: "Τι εγγυητική χρειάζεται;"
  ↓
Layer 1: Analyzes question → needs documents + law
  ↓
Layer 2: Semantic search in documents → finds relevant chunks
  (e.g., "εγγυητική συμμετοχής 2% του προϋπολογισμού")
  ↓
Layer 3: Knowledge base lookup → Ν.4412/2016 Άρθρο 72
  ↓
Layer 4: Memory check → "Same entity last year also required
  εγγυητική καλής εκτέλεσης 5%"
  ↓
Layer 1: Composes focused context → sends to AI
  ↓
Trust Shield: Validates response, adds sources, confidence
  ↓
User receives fully sourced, accurate answer
```

---

## Layer 1: Intelligent Context Builder

The orchestrator that decides WHAT context to include based on the question.

### Responsibilities

- Classify question intent (document lookup, legal question, status check, guidance)
- Call relevant layers based on intent
- Compose a focused context (only relevant chunks, not everything)
- Manage token budget per request

### Intent Classification

| Intent | Layers Used | Example |
|--------|-------------|---------|
| `document_lookup` | Layer 2 (RAG) | "Τι εγγυητική ζητάνε;" |
| `legal_question` | Layer 2 + Layer 3 (KB) | "Χρειάζεται ΕΣΠΔ;" |
| `status_check` | Existing structured data | "Πόσα tasks μένουν;" |
| `guidance` | Layer 3 + Layer 4 (Memory) | "Πώς φτιάχνω τεχνική προσφορά;" |
| `mixed` | All layers | "Είμαστε έτοιμοι;" |

### Token Budget Strategy

- Total budget per question: ~8,000 tokens context
- Document chunks: max 5 chunks × ~600 tokens = 3,000
- Knowledge base: max 2,000 tokens
- Memory: max 1,000 tokens
- Tender metadata + structured data: ~2,000 tokens
- Remaining for conversation history

---

## Layer 2: Document RAG with pgvector

### New Database Schema

```prisma
model DocumentChunk {
  id          String   @id @default(cuid())
  documentId  String
  document    AttachedDocument @relation(fields: [documentId], references: [id], onDelete: Cascade)
  tenderId    String
  tender      Tender   @relation(fields: [tenderId], references: [id], onDelete: Cascade)
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id])

  chunkIndex  Int      // order within document (0, 1, 2...)
  content     String   // chunk text (~500-800 tokens)
  embedding   Unsupported("vector(768)") // pgvector via Gemini embedding
  metadata    Json?    // { page, section, headings }
  tokenCount  Int

  createdAt   DateTime @default(now())

  @@index([tenderId, tenantId])
  @@index([documentId])
}
```

### Embedding Pipeline

Triggered after document text extraction (extends existing `readTenderDocuments`):

```
Text extracted (existing pipeline)
  ↓
Smart Chunking (NEW service: document-chunker.ts)
  ├── Target: ~600 tokens per chunk
  ├── Overlap: 100 tokens between chunks
  ├── Respects paragraph boundaries
  ├── Preserves metadata (page number, section heading)
  └── Special handling for tables (keep table rows together)
  ↓
Embedding (NEW service: embedding-service.ts)
  ├── Model: Gemini text-embedding-004 (768 dimensions)
  ├── Free tier: 1,500 requests/min
  ├── Batch: up to 100 chunks per request
  └── Store in DocumentChunk table
  ↓
Ready for semantic search
```

### Semantic Search

```typescript
async function searchDocuments(
  tenderId: string,
  tenantId: string,
  query: string,
  limit: number = 5
): Promise<ChunkResult[]> {
  // 1. Embed query
  const queryEmbedding = await embed(query);

  // 2. pgvector cosine similarity search (fetch 2x for reranking headroom)
  const chunks = await db.$queryRaw`
    SELECT id, content, metadata, "tokenCount",
           1 - (embedding <=> ${queryEmbedding}::vector) as similarity
    FROM "DocumentChunk"
    WHERE "tenderId" = ${tenderId} AND "tenantId" = ${tenantId}
    ORDER BY embedding <=> ${queryEmbedding}::vector
    LIMIT ${limit * 2}
  `;

  // 3. Keyword reranking: boost chunks that contain exact query terms
  //    Score = 0.7 * cosine_similarity + 0.3 * keyword_overlap_ratio
  const reranked = rerank(chunks, query);

  // 4. Return top `limit` results
  return reranked.slice(0, limit);
}
```

### Why These Choices

- **Gemini text-embedding-004**: Generous free tier, 768 dims, excellent Greek support
- **pgvector**: Already available in Supabase, zero extra infrastructure, zero extra cost
- **Cosine similarity + keyword rerank**: Hybrid search = better results than pure semantic
- **600 token chunks with 100 overlap**: Balances granularity with context preservation

---

## Layer 3: Knowledge Base — "Practical Bid Expertise"

### What This Is NOT

This is NOT a copy of Ν.4412/2016. The AI (Gemini) already knows procurement law. This is the **practical wisdom** that only comes from 10+ years of making tender files — things you can't find in any law book.

### Structure

A structured JSON/markdown knowledge base stored in the codebase (not DB — version controlled):

```
src/server/knowledge/
  ├── checklists/
  │   ├── open-tender-above-60k.json     // Ανοιχτός > 60K
  │   ├── open-tender-below-60k.json     // Πρόχειρος < 60K
  │   ├── framework-agreement.json        // Συμφωνία-πλαίσιο
  │   └── design-contest.json             // Αρχιτεκτονικός
  ├── lead-times/
  │   └── document-lead-times.json        // Πόσες εργάσιμες κάθε έγγραφο
  ├── common-mistakes/
  │   └── disqualification-reasons.json   // Top 20 λόγοι αποκλεισμού
  ├── entity-patterns/
  │   └── known-entities.json             // ΔΕΔΔΗΕ, ΕΥΔΑΠ, ΕΥΑΘ patterns
  └── esidis/
      └── submission-guide.json           // ΕΣΗΔΗΣ βήμα-βήμα
```

### Example: Lead Times

```json
{
  "lead_times": [
    {
      "document": "Εγγυητική επιστολή (τράπεζα)",
      "working_days_typical": 5,
      "working_days_worst": 8,
      "notes": "Εξαρτάται από τράπεζα. Μεγάλα ποσά (>100K) μπορεί να θέλουν 10 εργάσιμες. ΠΑΝΤΑ ρώτα τράπεζα πρώτα."
    },
    {
      "document": "Φορολογική ενημερότητα",
      "working_days_typical": 1,
      "working_days_worst": 3,
      "notes": "Ηλεκτρονικά μέσω TAXISnet αν δεν υπάρχουν οφειλές. Αν υπάρχουν, μπορεί να θέλει ρύθμιση."
    },
    {
      "document": "Ασφαλιστική ενημερότητα (ΕΦΚΑ)",
      "working_days_typical": 1,
      "working_days_worst": 5,
      "notes": "Ηλεκτρονικά αν είναι ενήμερος. Αν χρειάζεται βεβαίωση από υποκατάστημα, πολύ περισσότερο."
    },
    {
      "document": "Ποινικό μητρώο",
      "working_days_typical": 1,
      "working_days_worst": 3,
      "notes": "Ηλεκτρονικά μέσω gov.gr. Χρειάζεται για ΟΛΟΥΣ τους νόμιμους εκπροσώπους."
    }
  ]
}
```

### Example: Common Mistakes

```json
{
  "disqualification_reasons": [
    {
      "rank": 1,
      "mistake": "Λήξη πιστοποιητικού πριν την ημερομηνία υποβολής",
      "frequency": "πολύ συχνό",
      "prevention": "Ο βοηθός ελέγχει ημερομηνίες λήξης vs deadline υποβολής"
    },
    {
      "rank": 2,
      "mistake": "Εγγυητική σε λάθος μορφή ή ποσό",
      "frequency": "συχνό",
      "prevention": "Cross-check ποσό εγγυητικής με τη διακήρυξη αυτόματα"
    },
    {
      "rank": 3,
      "mistake": "Λάθος CPV ↔ ΚΑΔ αντιστοίχιση",
      "frequency": "συχνό",
      "prevention": "Αυτόματος έλεγχος CPV διακήρυξης vs ΚΑΔ εταιρείας"
    },
    {
      "rank": 4,
      "mistake": "Ελλιπής ΕΣΠΔ — κενά πεδία ή λάθος άρθρα",
      "frequency": "μέτρια",
      "prevention": "Checklist ΕΣΠΔ πεδίων βάσει τύπου διαγωνισμού"
    },
    {
      "rank": 5,
      "mistake": "Υπεύθυνη δήλωση χωρίς σωστή θεώρηση γνησίου υπογραφής",
      "frequency": "μέτρια",
      "prevention": "Reminder: θεώρηση ή ψηφιακή υπογραφή μέσω gov.gr"
    }
  ]
}
```

### How It's Used

The Knowledge Base is searched by keyword/category — NOT by vector search (it's small and structured). The Context Builder picks the relevant sections based on question intent and tender type.

---

## Layer 4: Learning Memory

### Two Memory Types

#### 1. Per-Tenant Memory (Private)

```prisma
model TenantMemory {
  id          String   @id @default(cuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id])

  category    String   // 'entity_profile' | 'lesson' | 'preference' | 'pattern'
  subject     String   // e.g., "ΔΕΔΔΗΕ", "ISO", "εγγυητικές"
  content     String   // natural language knowledge
  confidence  Float    @default(0.7) // 0.0-1.0
  source      String   // 'user_correction' | 'successful_bid' | 'failed_bid' | 'ai_extracted'
  tenderId    String?  // optional: which tender taught us this
  usageCount  Int      @default(0)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  lastUsedAt  DateTime?

  @@index([tenantId, category])
  @@index([tenantId, subject])
}
```

**How it learns:**

| Trigger | Source | Confidence |
|---------|--------|------------|
| User corrects the AI | `user_correction` | 1.0 |
| User confirms AI suggestion | `user_correction` | 0.9 |
| AI extracts pattern from completed tender | `ai_extracted` | 0.7 |
| Win/Loss feedback submitted | `successful_bid` / `failed_bid` | 0.8 |

**Examples:**

| Category | Subject | Content |
|----------|---------|---------|
| `entity_profile` | Εταιρεία | "Έχουμε ISO 9001, ISO 14001. ΔΕΝ έχουμε ISO 45001" |
| `lesson` | ΔΕΔΔΗΕ | "Πάντα ζητάνε εμπειρία 5 ετών σε ΜΤ/ΥΤ" |
| `preference` | Τιμολόγηση | "Ο χρήστης προτιμά κοστολόγηση bottom-up" |
| `pattern` | Εγγυητικές | "3 στους 4 διαγωνισμούς μας ζήτησαν εγγυητική 2%" |

#### 2. Global Patterns (Anonymized, Cross-Tenant)

```prisma
model GlobalPattern {
  id          String   @id @default(cuid())
  category    String   // 'entity_requirement' | 'market_trend' | 'common_mistake'
  subject     String   // e.g., "ΕΥΔΑΠ", "εγγυητικές"
  pattern     String   // "78% of ΕΥΔΑΠ tenders require 5% guarantee"
  sampleSize  Int      // how many tenders support this (reliability)
  confidence  Float

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([category, subject])
}
```

**Privacy rules:**
- Zero tenant-specific data in global patterns
- Only aggregated stats: "X% of type-Y tenders require Z"
- Minimum 3 different tenants must share a pattern before it becomes global
- A background BullMQ job periodically aggregates patterns

#### Memory Retrieval

```typescript
async function getRelevantMemories(
  tenantId: string,
  question: string,
  subject?: string
): Promise<Memory[]> {
  // 1. Tenant-specific memories (keyword match on subject + category)
  const tenantMemories = await db.tenantMemory.findMany({
    where: {
      tenantId,
      OR: [
        { subject: { contains: extractKeywords(question) } },
        { content: { contains: extractKeywords(question) } }
      ]
    },
    orderBy: { confidence: 'desc' },
    take: 5
  });

  // 2. Global patterns (same keyword match)
  const globalPatterns = await db.globalPattern.findMany({
    where: {
      subject: { contains: extractKeywords(question) },
      sampleSize: { gte: 3 } // minimum reliability
    },
    orderBy: { confidence: 'desc' },
    take: 3
  });

  return [...tenantMemories, ...globalPatterns];
}
```

---

## Layer 5: Proactive Engine

### 5A. Document Upload Triggers

When a new document is uploaded and extracted, a BullMQ job runs:

```
New document uploaded → text extraction (existing)
  ↓
Background job: proactive-analysis
  ├── Embed chunks (Layer 2)
  ├── Auto-extract key info:
  │   ├── Deadline
  │   ├── Budget
  │   ├── Required documents list
  │   ├── Eligibility criteria
  │   └── Award criteria weights
  ├── Cross-check with tenant memory:
  │   ├── Missing certifications?
  │   ├── Incompatible requirements?
  │   └── Known entity patterns?
  ├── Generate alerts (TenderAlert records)
  └── Generate/update roadmap
```

### 5B. Smart Roadmap

Auto-generated per tender after analysis. Stored as structured data:

```prisma
model TenderRoadmap {
  id          String   @id @default(cuid())
  tenderId    String   @unique
  tender      Tender   @relation(fields: [tenderId], references: [id])
  tenantId    String

  steps       Json     // Array of RoadmapStep
  generatedAt DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

// RoadmapStep shape:
// {
//   order: number
//   title: string
//   description: string
//   status: 'completed' | 'current' | 'pending' | 'blocked'
//   dueDate?: string (calculated via backward scheduling)
//   blockers?: string[]
//   automatable: boolean
// }
```

Steps are **dynamic** — adapted per tender based on:
- What the διακήρυξη requires
- Tender type (ανοιχτός, πρόχειρος, etc.)
- Knowledge base checklists
- Tenant memory (what the company already has)

### 5C. Lead Time Intelligence — Backward Scheduling

```typescript
function calculateBackwardSchedule(
  deadline: Date,
  requiredDocuments: string[],
  leadTimes: LeadTimeDB
): BackwardSchedule {
  // Sort documents by lead time (longest first)
  // Calculate: "must start by" date for each
  // Flag anything where "must start by" < today as CRITICAL

  // Example output:
  // Εγγυητική: ξεκίνα μέχρι 21/03 (5 εργάσιμες) ⚠️ ΣΗΜΕΡΑ
  // Φορολογική: ξεκίνα μέχρι 25/03 (3 εργάσιμες)
  // Τεχνική προσφορά: ξεκίνα μέχρι 23/03 (3 εργάσιμες)
}
```

### 5D. Clarification Generator

After initial document analysis, the AI scans for:

```
Ambiguities:
  ├── Vague criteria ("κατάλληλη εμπειρία" without years)
  ├── Contradictions between sections
  ├── Missing information (no evaluation weights)
  ├── CPV ↔ scope mismatches
  └── Unusual clauses vs standard Ν.4412/2016
  ↓
Generates suggested clarification questions
  ↓
Stored as TenderAlert with type: 'clarification_needed'
```

### 5E. Pre-Submission Checklist

Auto-generated checklist customized per tender:

```prisma
model SubmissionChecklist {
  id          String   @id @default(cuid())
  tenderId    String   @unique
  tender      Tender   @relation(fields: [tenderId], references: [id])
  tenantId    String

  items       Json     // Array of ChecklistItem
  generatedAt DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

// ChecklistItem shape:
// {
//   category: 'formal' | 'documents' | 'financial' | 'technical' | 'cross_check'
//   title: string
//   description: string
//   checked: boolean
//   autoVerifiable: boolean (can the system check this automatically?)
//   autoVerified: boolean | null (result of auto-check, null if not run)
//   source: string (which §/article requires this)
// }
```

**Auto-verifiable items** (the system checks automatically):
- Certificate expiry dates vs submission deadline
- Guarantee amount matches διακήρυξη requirement
- CPV ↔ ΚΑΔ compatibility
- File sizes within ΕΣΗΔΗΣ limits
- Numeric vs written amount consistency

**Manual items** (user must confirm):
- Signatures on every page
- Company seal
- Digital signature (ΕΣΗΔΗΣ)
- Separate files for technical/financial offer

### 5F. Daily Digest (Background Cron)

A BullMQ recurring job:

```
Every morning (configurable):
  For each tenant:
    For each active tender:
      ├── Check deadline proximity → urgent alerts
      ├── Check missing documents → gap alerts
      ├── Check certificate expiry → warning alerts
      ├── Backward schedule update → action required alerts
      └── Roadmap progress check → status summary
    ↓
    Store as TenderAlert records
    ↓
    User sees alerts on dashboard + chat panel
```

### 5G. Win/Loss Feedback Loop

```prisma
model TenderOutcome {
  id          String   @id @default(cuid())
  tenderId    String   @unique
  tender      Tender   @relation(fields: [tenderId], references: [id])
  tenantId    String

  result      String   // 'won' | 'lost' | 'disqualified' | 'withdrawn'
  reason      String?  // 'price' | 'technical_score' | 'missing_document' | 'formal_exclusion' | 'other'
  details     String?  // free text explanation

  // What we learned (AI-extracted after user input)
  lessonsLearned Json?  // Array of { lesson, confidence }

  createdAt   DateTime @default(now())
}
```

**Feedback flow:**
```
User marks tender as won/lost/disqualified
  ↓
Simple form: result dropdown + reason dropdown + optional text
  ↓
AI analyzes: what can we learn from this?
  ↓
Creates TenantMemory entries (lessons)
  ↓
Contributes to GlobalPattern aggregation (anonymized)
  ↓
Next similar tender: "Σε παρόμοιο διαγωνισμό ΕΥΔΑΠ χάσαμε
  λόγω τιμής. Η τιμή μετράει 70% — πήγαινε aggressive."
```

---

## Trust & Accuracy Shield

This wraps EVERY response from the AI. Non-negotiable.

### Principle 1: Every Answer Has Sources

Every AI response MUST include:

```
{
  answer: string,           // The actual answer
  confidence: 'verified' | 'inferred' | 'general',
  sources: [
    {
      type: 'document' | 'law' | 'memory' | 'knowledge_base',
      reference: string,    // "Διακήρυξη.pdf, §4.2.1, σελ.12"
      quote?: string        // exact text if from document
    }
  ],
  caveats?: string[]        // warnings, limitations
}
```

### Principle 2: Three Confidence Levels

| Level | When | Display |
|-------|------|---------|
| **VERIFIED** ✅ | Found verbatim in document | Answer + exact quote + page |
| **INFERRED** ⚠️ | Concluded from multiple pieces | Answer + reasoning + "Επιβεβαίωσε στη διακήρυξη §X" |
| **GENERAL** 📚 | From knowledge base / AI knowledge, NOT from documents | "Βάσει Ν.4412/2016... αλλά **έλεγξε τη διακήρυξη** γιατί μπορεί να διαφέρει" |

### Principle 3: Explicit Uncertainty

When the AI doesn't know:

```
❌ NEVER: "Η εγγυητική είναι 5%" (without source)

✅ CORRECT: "Δεν βρήκα αναφορά σε εγγυητική στα έγγραφα
   που ανέβασες. Μπορεί να είναι σε παράρτημα που δεν
   έχει ανέβει. Έλεγξε τη διακήρυξη ή ανέβασε τα παραρτήματα."
```

### Principle 4: System Prompt Guardrails

```
ΚΑΝΟΝΕΣ ΑΚΡΙΒΕΙΑΣ (μη παραβιάσιμοι):

1. ΠΟΤΕ μην επινοείς αριθμούς, ημερομηνίες, ή ποσά.
2. ΠΟΤΕ μην λες "πρέπει" χωρίς πηγή (έγγραφο ή νόμο).
3. ΑΝ η πληροφορία είναι από γενική γνώση → ρητή σήμανση:
   "Βάσει γενικής γνώσης/Ν.4412..." + "έλεγξε τη διακήρυξη".
4. ΑΝ δύο πηγές αντιφάσκουν → ανέφερε ΟΛΕΣ, ΜΗΝ επιλέξεις.
5. ΓΙΑ νομικά/οικονομικά θέματα → "συμβουλευτείτε νομικό/λογιστή
   για επιβεβαίωση".
6. Lead times: ΠΑΝΤΑ worst-case + "εξαρτάται από φορέα, επιβεβαίωσε".
7. Memory-based tips: σαφής σήμανση "Από εμπειρία σε παρόμοιους
   διαγωνισμούς..." — ΟΧΙ σαν βέβαιο fact.
8. ΑΝ δεν βρίσκεις κάτι στα έγγραφα, ΜΗΝ μαντέψεις.
   Πες τι λείπει και πρότεινε πώς να το βρει ο χρήστης.
```

### Principle 5: Anti-Hallucination Post-Processing

Before sending response to user:

```
AI raw response
  ↓
Post-processing validation:
  ├── Numbers/amounts → exist in provided chunks?
  ├── Dates → match tender data?
  ├── Law articles → were they in context?
  ├── Claims about documents → backed by chunk content?
  └── If anything unsubstantiated → downgrade to INFERRED + add caveat
  ↓
Clean response with correct confidence labels
```

### Principle 6: UI Source Attribution

Every assistant message shows expandable sources:

```
┌──────────────────────────────────────────────┐
│ 🤖 Χρειάζεσαι εγγυητική 2% (€5.000)        │
│    και φορολογική ενημερότητα σε ισχύ.       │
│                                              │
│ ▶ Πηγές (2)                                 │
│   📄 Διακήρυξη.pdf, σελ.12, §4.2.1          │
│   📚 Ν.4412/2016, Άρθρο 72 §1               │
│                                              │
│ ✅ VERIFIED — βρέθηκε αυτολεξεί στα έγγραφα │
└──────────────────────────────────────────────┘
```

---

## Chat Persistence

Currently chat history is UI-only (useState). Must persist to DB:

```prisma
model ChatMessage {
  id          String   @id @default(cuid())
  tenderId    String
  tender      Tender   @relation(fields: [tenderId], references: [id], onDelete: Cascade)
  tenantId    String

  role        String   // 'user' | 'assistant'
  content     String   // the message text
  metadata    Json?    // sources, confidence, highlights for assistant messages

  createdAt   DateTime @default(now())

  @@index([tenderId, tenantId, createdAt])
}
```

This enables:
- Chat history survives page reload
- AI can reference earlier conversation
- Usage analytics per tenant

---

## Alert Storage

```prisma
model TenderAlert {
  id          String   @id @default(cuid())
  tenderId    String
  tender      Tender   @relation(fields: [tenderId], references: [id], onDelete: Cascade)
  tenantId    String

  type        String   // 'missing_doc' | 'deadline' | 'incompatibility' | 'suggestion' | 'clarification_needed'
  severity    String   // 'critical' | 'warning' | 'info'
  title       String
  detail      String
  source      String?  // which analysis generated this

  dismissed   Boolean  @default(false)
  resolvedAt  DateTime?

  createdAt   DateTime @default(now())

  @@index([tenderId, tenantId, dismissed])
}
```

---

## New Files & Services

| File | Purpose |
|------|---------|
| `src/server/services/document-chunker.ts` | Smart text chunking with overlap |
| `src/server/services/embedding-service.ts` | Gemini embedding + pgvector operations |
| `src/server/services/document-search.ts` | Semantic search + keyword reranking |
| `src/server/services/context-builder.ts` | Layer 1: intent classification + context assembly |
| `src/server/services/memory-service.ts` | Layer 4: tenant memory + global patterns CRUD |
| `src/server/services/proactive-engine.ts` | Layer 5: background analysis, alerts, roadmap |
| `src/server/services/backward-scheduler.ts` | Lead time calculation + backward scheduling |
| `src/server/services/submission-checklist.ts` | Pre-submission checklist generation |
| `src/server/services/trust-shield.ts` | Response validation + source attribution |
| `src/server/knowledge/` | Static knowledge base (checklists, lead times, mistakes) |
| `src/server/routers/chat.ts` | New tRPC router for persistent chat + alerts |
| `src/components/tender/smart-chat-panel.tsx` | Upgraded chat UI with sources, alerts, roadmap |

---

## Modified Existing Files

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add 8 new models (DocumentChunk, TenantMemory, GlobalPattern, TenderRoadmap, SubmissionChecklist, TenderOutcome, ChatMessage, TenderAlert) |
| `src/server/services/ai-prompts.ts` | Add new system prompts with accuracy guardrails |
| `src/server/services/ai-bid-orchestrator.ts` | Refactor `answerStatusQuestion` to use context builder |
| `src/server/services/document-reader.ts` | Trigger chunking + embedding after extraction |
| `src/server/routers/ai-roles.ts` | Add new procedures for proactive features |
| `src/components/tender/ai-assistant-panel.tsx` | Replace with smart-chat-panel or major refactor |

---

## Implementation Phases

### Phase 1: Document RAG + Trust Shield (Foundation)
- DocumentChunk schema + pgvector setup
- Smart chunking service
- Embedding service (Gemini text-embedding-004)
- Semantic search + keyword reranking
- Context builder (intent classification)
- Trust shield (source attribution, confidence levels)
- Upgraded system prompts with accuracy guardrails
- Chat persistence (ChatMessage model)
- Updated chat UI with sources display

### Phase 2: Knowledge Base + Proactive Engine
- Static knowledge base (checklists, lead times, common mistakes)
- Proactive analysis on document upload
- TenderAlert system
- Smart roadmap generation
- Backward scheduling
- Clarification generator
- Pre-submission checklist
- Alert display in chat panel + dashboard

### Phase 3: Learning Memory
- TenantMemory CRUD
- Memory extraction from AI interactions
- Win/Loss feedback form + TenderOutcome
- Memory integration in context builder
- GlobalPattern aggregation job
- Privacy controls (3-tenant minimum for global)

### Phase 4: Polish & Scale
- Daily digest cron job
- Chat history search
- Memory management UI (view/edit/delete memories)
- Analytics on AI usage and accuracy
- Performance optimization (caching, batch operations)

---

## Infrastructure & Scaling Notes

### pgvector Setup (Supabase)

Before Phase 1 implementation, enable pgvector:

```sql
-- Run in Supabase SQL editor
CREATE EXTENSION IF NOT EXISTS vector;

-- After DocumentChunk table is created by Prisma migration,
-- add HNSW index for fast similarity search:
CREATE INDEX ON "DocumentChunk"
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

**Why HNSW over IVFFlat**: HNSW is faster for small-to-medium datasets (<1M rows), doesn't require training, and works well on Supabase Hobby tier.

**Prisma limitation**: `Unsupported("vector(768)")` means all vector operations (insert, search) require `db.$queryRaw` / `db.$executeRaw`. Standard Prisma CRUD works for non-vector fields.

### Storage Estimates (Supabase Hobby = 500MB limit)

| Component | Per tender (50 pages) | Per tenant (20 tenders) | 50 tenants |
|-----------|----------------------|------------------------|------------|
| DocumentChunk text | ~200KB | ~4MB | ~200MB |
| Embeddings (768-dim vectors) | ~150KB | ~3MB | ~150MB |
| HNSW index | ~100KB | ~2MB | ~100MB |
| Other tables | — | ~1MB | ~50MB |
| **Total** | — | **~10MB** | **~500MB** |

**Conclusion**: Hobby tier supports ~50 tenants with moderate usage. At 30+ active tenants, upgrade to Supabase Pro ($25/mo, 8GB).

### Vercel Timeout & BullMQ Workers

The project already has BullMQ infrastructure:
- `src/server/jobs/worker.ts` — existing worker process
- `src/server/jobs/queues.ts` — existing queue definitions
- Workers run on a **separate process** (not Vercel serverless)

**New jobs added to existing worker:**
| Job | Trigger | Estimated Duration |
|-----|---------|-------------------|
| `embed-document` | After text extraction | 10-30s (depends on pages) |
| `proactive-analysis` | After embedding completes | 15-45s |
| `daily-digest` | Cron (configurable) | 5-60s per tenant |
| `aggregate-patterns` | Weekly cron | 10-30s |

**Vercel function timeout (60s)**: Chat questions stay within serverless — semantic search + AI completion typically takes 3-8s. No timeout risk for interactive features.

### Gemini Embedding API Limits

| Tier | Rate Limit | Daily Limit | Notes |
|------|-----------|-------------|-------|
| Free | 1,500 req/min | 1,500 req/day (content) | Sufficient for early stage |
| Pay-as-you-go | 1,500 req/min | Unlimited | ~$0.00025 per 1K tokens |

**Mitigation strategies:**
- Batch embedding: up to 100 chunks per API call (counts as 1 request)
- Queue-based processing: BullMQ rate-limits to stay within quotas
- Retry with exponential backoff on 429 errors (built into embedding service)
- Query embedding cache: LRU cache (in-memory, 1000 entries, 1h TTL) for repeated similar questions
- If free tier exhausted → graceful fallback to keyword-only search (no embeddings)

### Intent Classification Strategy

Layer 1 intent classification uses a **lightweight keyword classifier** (no LLM call):

```typescript
function classifyIntent(question: string): Intent {
  const q = question.toLowerCase();

  // Keyword patterns per intent
  const patterns = {
    document_lookup: ['εγγυητική', 'πιστοποιητικό', 'ζητάνε', 'χρειάζεται', 'απαιτ', 'προθεσμ', 'budget', 'ποσό'],
    legal_question: ['νόμος', 'άρθρο', 'ΕΣΠΔ', 'ν.4412', 'κανονισμ', 'νομικ'],
    status_check: ['πόσα', 'τι μένει', 'progress', 'κατάσταση', 'έτοιμ', 'ολοκληρ'],
    guidance: ['πώς', 'τι πρέπει', 'βήματα', 'βοήθα', 'οδηγ', 'συμβουλ'],
  };

  // Score each intent, return highest (default: 'mixed' if no clear winner)
  // This avoids an extra LLM call per question (saves ~1s + tokens)
}
```

**Why not LLM-based**: Adds 1-2s latency and ~500 tokens cost per question. Keyword patterns handle 90%+ of cases. The AI model itself handles ambiguous cases well when given mixed context.

### Embedding Fallback Strategy

If Gemini embedding API is unavailable:
1. Document upload: chunks are saved WITHOUT embeddings, queued for retry
2. Search: falls back to PostgreSQL full-text search (`to_tsvector('greek', content)`)
3. Alert: log warning, surface "limited search" indicator in UI
4. Retry: BullMQ retries failed embeddings every 5 minutes (max 10 retries)

---

## Non-Goals (Explicitly Out of Scope)

- **Document generation** (auto-write τεχνική/οικονομική) — future feature
- **Competitor intelligence** — requires external data sources
- **ΕΣΗΔΗΣ integration** (direct API) — no public API available
- **Multi-language** — Greek only for now
- **Voice interface** — text chat only
- **Real-time collaboration** — single user per session
