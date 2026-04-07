# SP3: Country-Aware AI & Compliance — Design Spec

**Goal:** Refactor hardcoded Greek references in AI prompts and compliance engine so the system works correctly for both GR and NL tenants.

**Depends on:** SP1 (multi-country foundation), SP2 (Dutch i18n).

**Approach:** Minimal — swap law/platform/keyword references per country. Prompts stay in English. AI output language is controlled by the existing `language` parameter (SP2).

---

## Architecture

### New: Prompt Context System

Country-specific AI context lives in `src/lib/prompts/` — separate from `country-config/` because prompts change for different reasons (AI tuning) than config (holidays, doc types).

**Files:**
- `src/lib/prompts/types.ts` — `CountryPromptContext` interface
- `src/lib/prompts/gr.ts` — Greek prompt context (extracted from current hardcoded values)
- `src/lib/prompts/nl.ts` — Dutch prompt context
- `src/lib/prompts/index.ts` — `getPromptContext(country)` registry

### CountryPromptContext Interface

```typescript
interface ProposalSection {
  id: string;
  titleEl: string;
  titleEn: string;
  description: string;
}

interface CountryPromptContext {
  code: string;

  // Legal framework for AI prompts
  lawReference: string;           // "Ν.4412/2016" or "Aanbestedingswet 2012"
  lawDescription: string;         // Full description for system prompts
  euDirectives: string[];         // ["2014/24/EU", "2014/25/EU"]
  
  // Platform names used in prompts
  platforms: string[];            // ["ΕΣΗΔΗΣ", "ΚΗΜΔΗΣ"] or ["TenderNed", "PIANOo"]
  eProcurementPlatform: string;   // Primary platform name for prompts
  
  // Compliance engine keywords
  docTypeKeywords: Record<string, string[]>;
  
  // Technical proposal sections
  proposalSections: ProposalSection[];
  
  // AI persona
  expertiseDescription: string;   // "20+ years in Greek public procurement" etc.
  
  // Legal analysis specific
  legalFieldKeywords: string[];   // Keywords to identify legal clauses in documents
  paymentTermReference: string;   // "Οδηγία 2011/7/ΕΕ" or EU Late Payment Directive ref
}
```

### Modified Files

| File | Current State | Change |
|------|--------------|--------|
| `context-builder.ts` | Hardcoded "Ν.4412/2016", "ΕΣΗΔΗΣ", Greek labels | Accept `country` param, use `getPromptContext()` |
| `ai-legal-analyzer.ts` | 3 Greek-specific system prompt constants | Convert to functions: `buildExtractClausesPrompt(ctx)` |
| `ai-bid-orchestrator.ts` | Greek law refs in summarize/goNoGo/team prompts | Parameterize with prompt context |
| `ai-technical.ts` | `PROPOSAL_SECTIONS` hardcoded Greek titles | Load from `promptContext.proposalSections` |
| `ai-financial.ts` | "Ν.4412/2016, Άρθρο 75" in extraction prompt | Parameterize law references |
| `compliance-engine.ts` | `docTypeKeywords` hardcoded Greek keywords | Load from `promptContext.docTypeKeywords` |

### How Country Flows Through the System

1. tRPC router knows `tenantId` from auth context
2. Router queries `tenant.countries[0]` (primary country) or accepts explicit `country` param
3. Router passes `country` to service functions
4. Service functions call `getPromptContext(country)` to get law refs, keywords, etc.
5. Prompts are built dynamically using the context

### Dutch Compliance Keywords

```typescript
docTypeKeywords: {
  KVK_EXTRACT: ['kvk', 'kamer van koophandel', 'handelsregister', 'uittreksel'],
  TAX_CLEARANCE: ['belastingdienst', 'betalingsgedrag', 'verklaring betalingsgedrag'],
  SOCIAL_SECURITY_CLEARANCE: ['sociale verzekeringen', 'uwv', 'premies'],
  CRIMINAL_RECORD: ['gedragsverklaring', 'gva', 'verklaring omtrent gedrag', 'vog'],
  UEA_FORM: ['uea', 'uniform europees aanbestedingsdocument', 'espd'],
  INSURANCE_CERTIFICATE: ['verzekering', 'aansprakelijkheid', 'beroepsaansprakelijkheid'],
  BANK_GUARANTEE: ['bankgarantie', 'garantstelling'],
}
```

## Out of Scope

- Dutch knowledge base / procurement guides (SP4)
- Full Dutch-language AI prompts (prompts stay English, output follows `language` param)
- AI model fine-tuning
- Refactoring `greek-document-defaults.ts` filename (still works, just Greek-specific)

## Risks

Low. All changes are additive — Greek prompts are extracted as-is into `gr.ts`, so GR behavior is identical. NL prompts are new additions.
