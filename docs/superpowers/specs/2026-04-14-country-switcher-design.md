# Country Switcher — Design Spec

**Date:** 2026-04-14
**Status:** Approved (pending implementation plan)
**Related:** NL country module (SP1-SP4, completed 2026-04-05)

## Problem

A tenant with `countries = ['GR', 'NL']` has paid for both Greek and Dutch tender workflows, but there is no way for a user to "switch into Dutch mode". Today:

1. `tender.country` is set per-tender via a dropdown on the New Tender page — but only when explicitly chosen.
2. All AI services (`compliance-engine`, `tender-analysis`, etc.) default to `tenant.countries[0] ?? 'GR'` when no explicit country is supplied. This means a GR-first tenant that also bought NL always falls through to GR unless every single action is explicitly country-tagged.
3. Discovery merges tenders from all countries into one undifferentiated feed.
4. There is no persistent "active country" session state. A user who wants to work on Dutch deals has to remember to set the country manually for every tender they create.

## Goal

Allow a user in a multi-country tenant to set an **active country** that persists across devices, influences defaults for new work, and filters the discovery feed — without breaking single-country tenants and without retroactively re-interpreting existing tenders.

## Non-goals

- Changing UI language when country changes (language stays decoupled — existing design intent).
- Per-country feature flags, pricing tiers, or entitlement beyond the existing `Plan.maxCountries`.
- Allowing a user to pick a country outside `tenant.countries` (authorization gate applies).
- Retroactively changing the country of existing tenders when the user switches.

## Architecture

### Data model

One new nullable column in `User`:

```prisma
model User {
  // ...existing fields...
  activeCountry String? // ISO 2-letter. null → fallback to tenant.countries[0]
}
```

**Why on `User` and not `Tenant`**: two team members of the same tenant can simultaneously work on different countries (one on GR deals, another on NL). Per-user is the correct granularity.

**Why nullable**: zero-risk migration for existing users. `null` means "no explicit preference, fall back to tenant default", preserving current behavior for everyone until they opt in by clicking the switcher.

**Authorization**: enforced at the tRPC resolver level, not via DB constraint. When `setActiveCountry('NL')` is called, the resolver checks `'NL' ∈ tenant.countries` and throws `FORBIDDEN` otherwise. DB constraint is wrong because `tenant.countries` is mutable.

### Country resolution helper

New file: `src/lib/active-country.ts`

```ts
export async function resolveCountry(opts: {
  tenderCountry?: string | null;
  userId?: string;
  tenantId: string;
}): Promise<string> {
  // 1. Explicit tender country wins — historical tenders keep their context
  if (opts.tenderCountry) return opts.tenderCountry;

  // 2. User's active selection
  if (opts.userId) {
    const user = await db.user.findUnique({
      where: { id: opts.userId },
      select: { activeCountry: true },
    });
    if (user?.activeCountry) return user.activeCountry;
  }

  // 3. Tenant's first country (legacy default)
  const tenant = await db.tenant.findUnique({
    where: { id: opts.tenantId },
    select: { countries: true },
  });
  return tenant?.countries?.[0] ?? 'GR';
}
```

### Fallback chain semantics

Precedence (highest to lowest):

1. **`tender.country`** — if the operation is scoped to a specific tender, that tender's country always wins. This is critical: opening a Greek tender while in "NL mode" must still apply Greek legal context. No retroactive re-interpretation.
2. **`user.activeCountry`** — for operations without a specific tender (creating a new tender, generic AI chat, empty-state defaults).
3. **`tenant.countries[0]`** — legacy behavior for users who have never interacted with the switcher.
4. **`'GR'`** — hard fallback if tenant has no countries (should not happen but keeps code total).

### Service refactor

Replace every instance of `tenant?.countries?.[0] ?? 'GR'` with a `resolveCountry()` call. A grep pass during implementation will enumerate exact call sites. Known targets so far:

- `src/server/services/compliance-engine.ts:46` — has `tender.country` available; use full chain
- `src/server/routers/tender.ts:135` — create mutation; no tender yet, use user + tenant fallback
- Any other AI service that calls `getPromptContext(country)` needs to be inventoried

## UI components

### Country switcher (header)

New component: `src/components/CountrySwitcher.tsx`.

- Mount point: header bar, next to the existing language picker
- Render guard: `tenant.countries.length >= 2`; otherwise returns `null`
- Dropdown items: one per country in `tenant.countries`, rendered as `🇬🇷 Ελλάδα` / `🇳🇱 Nederland` using `SUPPORTED_COUNTRIES` from `src/lib/country-config/index.ts`
- Active country marked with a checkmark
- Click handler calls `user.setActiveCountry` tRPC mutation → optimistic update → invalidate tender list queries so discovery re-filters

### Mode badge

Small pill badge in the top bar, shown only when the active country is **not** `tenant.countries[0]` (i.e. when the user is operating in a non-primary country). Example: a Greek-first tenant operating in NL mode sees `🇳🇱 NL Mode`. This prevents accidents where a user forgets they are in Dutch mode and creates Greek tenders with Dutch context.

When the user is in their default country, the badge is hidden to avoid visual noise.

### Discovery tabs

Tabs above the tender list on `src/app/(dashboard)/tenders/page.tsx`:

```
[ 🇳🇱 NL (42) ] [ 🇬🇷 GR (135) ] [ All (177) ]
```

- Render guard: `tenant.countries.length >= 2`
- Default selected tab: the active country
- Counts come from query results (already computed per country)
- Tab state persists in URL query param `?country=NL` so bookmarks and back button work

### New Tender page

On `src/app/(dashboard)/tenders/new/page.tsx:346`, the existing country dropdown changes its default from `tenant.countries[0]` to `user.activeCountry ?? tenant.countries[0]`. Trivial single-line change.

### tRPC procedure

New procedure `user.setActiveCountry(country: string)` on the existing user router:

- Validates `country ∈ tenant.countries`
- Updates `user.activeCountry`
- Returns updated user object

## Migration & rollout

1. **DB migration** — `prisma migrate dev --name add_user_active_country`. Adds nullable column. Zero risk.
2. **Backend** — `resolveCountry()` helper, service refactors, `user.setActiveCountry` procedure. Behavior is unchanged for all existing users because `activeCountry` starts as `null` and the fallback chain reproduces the current `countries[0]` default.
3. **Frontend** — `CountrySwitcher`, mode badge, discovery tabs, header wiring. Can ship in parallel.
4. **No feature flag** — the change is invisible to single-country tenants (the majority) and additive for multi-country tenants. Nothing breaks.

**Rollback**: revert the frontend commit. The backend helper is additive — leaving it in place or rolling it back are both safe.

## Testing

### Unit tests (vitest)

1. **`resolveCountry()` helper** — new `src/lib/__tests__/active-country.test.ts`:
   - Returns `tender.country` when provided, ignoring user/tenant
   - Returns `user.activeCountry` when tender country is null
   - Falls through to `tenant.countries[0]` when user has no active country
   - Returns `'GR'` as final fallback when tenant has empty countries
   - Handles user-not-found gracefully (treats as no active country)

2. **`user.setActiveCountry` procedure** — new `src/server/routers/__tests__/user.test.ts`:
   - Accepts valid country in `tenant.countries`
   - Rejects country not in `tenant.countries` with `FORBIDDEN`
   - Updates DB record correctly

3. **`compliance-engine` refactor** — update existing `compliance-engine.test.ts` mocks to match the new `resolveCountry` call shape.

### E2E tests (Playwright, regression suite)

4. **Country switcher visibility** — signup with GR only → no switcher in header. Add NL via settings → switcher appears.
5. **Switch + persist** — multi-country user selects NL → reload page → NL still selected (DB persisted, not just client state).
6. **Discovery tabs** — with `countries=[GR,NL]`, landing on `/tenders` shows the active country's tab. Click "All" → URL becomes `?country=all`.
7. **Cross-country authorization** — attempt `setActiveCountry('FR')` when tenant has only `[GR,NL]` → `403 FORBIDDEN`.

### Manual smoke checks

- Create tender while in NL mode → verify `tender.country === 'NL'` in DB
- Open an existing GR tender while in NL mode → compliance check runs with GR context (tender.country wins)
- Single-country tenant sees no UI change

## Files touched (estimate)

**New files:**
- `src/lib/active-country.ts` — resolver helper
- `src/lib/__tests__/active-country.test.ts` — helper tests
- `src/components/CountrySwitcher.tsx` — header dropdown
- `src/components/CountryModeBadge.tsx` — non-default country indicator
- `prisma/migrations/*_add_user_active_country/migration.sql` — DB migration

**Modified files:**
- `prisma/schema.prisma` — `User.activeCountry` column
- `src/server/routers/tenant.ts` — add `setActiveCountry` procedure (this router already owns country-related mutations like `addCountry`, so it's the natural home)
- `src/server/services/compliance-engine.ts` — use `resolveCountry`
- `src/server/routers/tender.ts` — use `resolveCountry` in create
- ~3-6 other AI service files discovered via grep for `countries?.[0]`
- `src/app/(dashboard)/tenders/page.tsx` — discovery tabs
- `src/app/(dashboard)/tenders/new/page.tsx` — default from active country
- Dashboard header/layout component — mount `CountrySwitcher` + `CountryModeBadge`. Exact file to be located via grep for the existing language picker during implementation (it's the sibling of the language switcher)

## Out of scope (deferred)

- Cross-team country assignments (e.g. "User A can only work on GR, User B only on NL")
- Team-wide default country (currently tenant-wide via `countries[0]`; per-user already solves the immediate pain)
- Auto-switching based on tender being viewed (would need URL-scoped state, complicates the model)
