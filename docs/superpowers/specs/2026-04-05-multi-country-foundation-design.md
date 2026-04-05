# Multi-Country Foundation (SP1) — Design Spec

**Date:** 2026-04-05
**Status:** Approved
**Part of:** Netherlands Country Module (4 sub-projects)
**This is:** Sub-project 1 of 4

## Context

TenderCopilot is currently Greece-only. The goal is to support multiple countries (starting with Netherlands) so a tenant can operate as a Greek company, Dutch company, or both — gated by subscription plan.

This spec covers only the **foundation layer**: data model, country config system, migration, and basic UI touchpoints (registration + settings). AI prompts, compliance rules, Dutch translations, and Dutch knowledge base are separate sub-projects (SP2–SP4).

## Decisions

- **Country selection:** Per tenant, set at registration, changeable in settings
- **Multi-country:** A tenant can have multiple countries (subscription-gated). `Tenant.countries: String[]`
- **Company profile:** One per country per tenant. Greek company has ΓΕΜΗ/ΑΦΜ, Dutch has KvK/BTW
- **UI language:** Independent of country. Dutch tenant can use English UI. Existing language toggle stays
- **Config storage:** TypeScript files, not DB tables. Two countries don't need admin UI
- **LegalDocType:** Enum → String. Each country defines its own document types in config

## Data Model Changes

### Tenant

```prisma
model Tenant {
  ...existing fields...
  countries    String[]   @default(["GR"])   // enabled countries (ISO 2-letter)
  language     String     @default("el")     // preferred UI language
}
```

### CompanyProfile

```prisma
model CompanyProfile {
  ...existing fields...
  country      String     @default("GR")     // which country this profile is for

  @@unique([tenantId, country])  // replaces current @@unique([tenantId])
}
```

One profile per country per tenant. Existing profiles get `country: "GR"` in migration.

### LegalDocument

```prisma
model LegalDocument {
  ...existing fields...
  type         String     // was: LegalDocType enum → now: plain string
  // Values come from country config: "TAX_CLEARANCE", "GEMI_CERTIFICATE", "KVK_EXTRACT", etc.
}
```

Drop `enum LegalDocType`. All existing values are preserved as strings (same names).

### Certificate — no change needed

Certificate.type is already `String`, not enum. No migration needed.

## Country Config System

### File structure

```
src/lib/country-config/
  types.ts          // CountryConfig interface
  index.ts          // getCountryConfig(), SUPPORTED_COUNTRIES, getDefaultSources()
  gr.ts             // Greek config
  nl.ts             // Dutch config
```

### CountryConfig interface

```typescript
interface CountryConfig {
  code: string;              // "GR", "NL"
  name: string;              // "Ελλάδα", "Nederland"
  nameEn: string;            // "Greece", "Netherlands"
  defaultLanguage: string;   // "el", "nl"
  currency: string;          // "EUR"

  legalFramework: {
    name: string;            // "Ν.4412/2016" or "Aanbestedingswet 2012"
    description: string;     // short description
    systems: string[];       // ["ΕΣΗΔΗΣ", "ΚΗΜΔΗΣ"] or ["TenderNed"]
  };

  documentTypes: Array<{
    type: string;            // "TAX_CLEARANCE", "GEMI_CERTIFICATE", "KVK_EXTRACT"
    label: string;           // localized label
    labelEn: string;         // English label
    required: boolean;       // required for tender participation
    validityDays?: number;   // how long is this doc valid (e.g., 90 days)
  }>;

  defaultSourceIds: string[];   // tender source IDs enabled by default for this country
  
  holidays: (year: number) => Date[];  // public holidays function
}
```

### Greek config (gr.ts)

Extracts existing hardcoded values from:
- `greek-document-defaults.ts` → `documentTypes`
- `greek-holidays.ts` → `holidays`
- `tender-sources.ts` default sources → `defaultSourceIds`
- `checklists.ts` legal references → `legalFramework`

### Dutch config (nl.ts)

```typescript
const nlConfig: CountryConfig = {
  code: 'NL',
  name: 'Nederland',
  nameEn: 'Netherlands',
  defaultLanguage: 'nl',
  currency: 'EUR',
  legalFramework: {
    name: 'Aanbestedingswet 2012',
    description: 'Dutch Public Procurement Act 2012, implementing EU Directives 2014/24/EU and 2014/25/EU',
    systems: ['TenderNed', 'PIANOo'],
  },
  documentTypes: [
    { type: 'KVK_EXTRACT', label: 'KvK-uittreksel', labelEn: 'Chamber of Commerce extract', required: true, validityDays: 180 },
    { type: 'TAX_CLEARANCE', label: 'Verklaring betalingsgedrag', labelEn: 'Tax compliance certificate', required: true, validityDays: 180 },
    { type: 'SOCIAL_SECURITY_CLEARANCE', label: 'Verklaring sociale verzekeringen', labelEn: 'Social security clearance', required: true, validityDays: 180 },
    { type: 'CRIMINAL_RECORD', label: 'Gedragsverklaring aanbesteden (GVA)', labelEn: 'Certificate of conduct for public procurement', required: true, validityDays: 730 },
    { type: 'UEA_FORM', label: 'Uniform Europees Aanbestedingsdocument', labelEn: 'European Single Procurement Document (ESPD)', required: true },
    { type: 'INSURANCE_CERTIFICATE', label: 'Verzekeringscertificaat', labelEn: 'Insurance certificate', required: false },
    { type: 'BANK_GUARANTEE', label: 'Bankgarantie', labelEn: 'Bank guarantee', required: false },
  ],
  defaultSourceIds: ['tenderned', 'ted_eu', 'ted_gr', 'boamp', 'fts_uk'],
  holidays: dutchHolidays,
};
```

## Tender Source Defaults

When a tenant adds a country, the system pre-enables the default sources for that country.

```typescript
function getDefaultSourcesForCountries(countries: string[]): string[] {
  const sources = new Set<string>();
  for (const country of countries) {
    const config = getCountryConfig(country);
    config.defaultSourceIds.forEach(id => sources.add(id));
  }
  return Array.from(sources);
}
```

The discovery service uses `tenant.countries` to determine which sources to search when no explicit source selection is made.

## Migration Plan

### Prisma migration (single migration file)

1. Add `countries String[] DEFAULT ARRAY['GR']` to Tenant
2. Add `language String DEFAULT 'el'` to Tenant
3. Add `country String DEFAULT 'GR'` to CompanyProfile
4. Backfill: `UPDATE "CompanyProfile" SET country = 'GR' WHERE country IS NULL`
5. Drop old unique index on CompanyProfile(tenantId)
6. Add new unique index on CompanyProfile(tenantId, country)
7. Alter LegalDocument.type from enum to String (Prisma handles this)
8. Drop enum LegalDocType

### Code migration

1. Replace all `LegalDocType.XXX` enum references with string literals `"XXX"`
2. Replace `greek-document-defaults.ts` usage with `getCountryConfig(country).documentTypes`
3. Replace `greekHolidays()` calls with `getCountryConfig(country).holidays(year)`
4. Update `getDefaultEnabledSourceIds()` to accept country parameter

## UI Changes

### Registration form

Add country dropdown after company name field:
- Label: "Χώρα εταιρείας" / "Company country"
- Options: "Ελλάδα (GR)" | "Nederland (NL)"
- Default: "GR"
- Sets `tenant.countries: [selectedCountry]` and `tenant.language` based on country default

### Tenant settings

New "Countries" section:
- Shows enabled countries as cards/chips
- "Add country" button (disabled if subscription limit reached, shows upgrade prompt)
- Each country links to its CompanyProfile form
- CompanyProfile form shows country-appropriate fields (ΓΕΜΗ for GR, KvK for NL)

### Company profile form

When country is "NL", show Dutch-specific fields:
- KvK Number (instead of ΓΕΜΗ)
- BTW Number (instead of ΑΦΜ)
- Belastingdienst (instead of ΔΟΥ)

The form reads field labels from country config, not hardcoded Greek labels.

## What This Spec Does NOT Cover

These are handled in later sub-projects:
- **SP2:** Dutch translations (messages/nl.json), locale picker expansion
- **SP3:** Country-aware AI prompts, compliance engine, document generation
- **SP4:** Dutch knowledge base (Aanbestedingswet rules, checklists, templates)

## Files Created/Modified

### New files
- `src/lib/country-config/types.ts`
- `src/lib/country-config/index.ts`
- `src/lib/country-config/gr.ts`
- `src/lib/country-config/nl.ts`

### Modified files
- `prisma/schema.prisma` — Tenant, CompanyProfile, LegalDocument changes
- `prisma/seed.ts` — add country to seed data
- `src/app/(auth)/register/page.tsx` — country selector
- `src/app/(dashboard)/settings/` — countries section
- `src/data/tender-sources.ts` — getDefaultSourcesForCountries()
- `src/lib/greek-document-defaults.ts` — deprecated, replaced by country config
- `src/lib/greek-holidays.ts` — moved into gr.ts config
- `src/server/services/compliance-engine.ts` — use country config for doc type matching
- `src/server/routers/discovery.ts` — use tenant countries for source defaults
- All files referencing `LegalDocType` enum — switch to string
