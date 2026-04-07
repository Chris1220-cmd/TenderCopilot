# SP2: Dutch i18n + UI — Design Spec

**Goal:** Full Dutch language UI so a Netherlands-based company can use TenderCopilot entirely in Dutch.

**Depends on:** SP1 (multi-country foundation) — completed.

---

## What Changes

### 1. Translation File — `messages/nl.json`

- AI-translated from `messages/en.json` (~1,023 keys)
- Dutch procurement terminology used throughout:
  - tender → aanbesteding
  - award → gunning
  - submission → inschrijving
  - contracting authority → aanbestedende dienst
  - procurement → inkoop / aanbesteding
  - ESPD → UEA (Uniform Europees Aanbestedingsdocument)
- Structure identical to `en.json` — same keys, same nesting

### 2. i18n Routing — `src/i18n/routing.ts`

Add `'nl'` to the `locales` array. Currently:

```ts
locales: ['el', 'en']
```

Becomes:

```ts
locales: ['el', 'en', 'nl']
```

### 3. i18n Provider — `src/lib/i18n.tsx`

- Add `nl` case to the dynamic import switch (loads `messages/nl.json`)
- Update browser detection: `navigator.language.startsWith('nl')` → default to `'nl'`
- Fallback chain: browser lang → localStorage → `'el'`

### 4. Language Toggle — `src/components/ui/language-toggle.tsx`

Replace the current 2-language flip button with a dropdown menu:

- Trigger: button showing current locale code (e.g., "EL", "EN", "NL")
- Menu: three options, each labeled in its own language:
  - Ελληνικά
  - English
  - Nederlands
- Use shadcn `DropdownMenu` component (already in project)
- On select: call `setLocale()`, same as current behavior

### 5. Language Modal — `src/components/tender/language-modal.tsx`

Add NL as a third option in the language selection modal. Same pattern as existing EL/EN options.

### 6. Tenant Language Integration (nice-to-have)

The SP1 schema added `Tenant.language` (defaults to `'el'`). When a user logs in, we could use their tenant's language as the initial locale instead of browser detection. This is a small enhancement:

- On auth callback / session load, check `tenant.language`
- Set as initial locale if no localStorage override exists

---

## Out of Scope

- Dutch AI prompts and compliance logic (SP3)
- Dutch knowledge base / procurement guides (SP4)
- Translation management platform (not needed at this scale)
- RTL or non-Latin script support

## Files

| File | Action |
|------|--------|
| `messages/nl.json` | Create — full Dutch translations |
| `src/i18n/routing.ts` | Modify — add `'nl'` to locales |
| `src/lib/i18n.tsx` | Modify — add NL import, update browser detection |
| `src/components/ui/language-toggle.tsx` | Modify — flip button → dropdown |
| `src/components/tender/language-modal.tsx` | Modify — add NL option |

## Risks

None significant. The i18n system is already multi-language (EL/EN). Adding NL is additive — no breaking changes, no schema changes, no migration needed.
