# Country Switcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users in multi-country tenants switch between country contexts (e.g. GR ↔ NL) via a persistent header dropdown, with server-side state, fallback chain for AI services, and discovery-feed filtering.

**Architecture:** Add nullable `User.activeCountry` in Prisma. Introduce a `resolveCountry()` helper with the precedence `tender.country > user.activeCountry > tenant.countries[0] > 'GR'`. Refactor service-layer `countries[0]` antipatterns to call the helper. Ship `CountrySwitcher` + `CountryModeBadge` in the dashboard top nav and `[active | other | all]` tabs on the discovery page.

**Tech Stack:** Next.js 14 app router, tRPC 10 + superjson, Prisma 6, React Hook Form + Zod, shadcn/ui (Radix dropdown), vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-04-14-country-switcher-design.md`

---

## Task 1: Prisma migration — add `User.activeCountry`

**Files:**
- Modify: `prisma/schema.prisma:62-80` (User model)
- Create: `prisma/migrations/<timestamp>_add_user_active_country/migration.sql` (generated)

- [ ] **Step 1: Add `activeCountry` field to User model**

Open `prisma/schema.prisma` and in the `User` block (around line 62-80), add one new field. The final block should look like:

```prisma
model User {
  id             String    @id @default(cuid())
  email          String    @unique
  name           String?
  hashedPassword String?
  image          String?
  emailVerified  DateTime?
  activeCountry  String?   // ISO 2-letter. null → fallback to tenant.countries[0]
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  tenants       TenantUser[]
  accounts      Account[]
  sessions      Session[]
  assignedTasks Task[]        @relation("TaskAssignee")
  createdTasks  Task[]        @relation("TaskCreator")
  activities    Activity[]
  isSuperAdmin  Boolean  @default(false)
  loginEvents   LoginEvent[]
}
```

- [ ] **Step 2: Generate migration**

Run from the project root:

```bash
npx prisma migrate dev --name add_user_active_country
```

Expected output: `Applying migration '<timestamp>_add_user_active_country'` followed by `Your database is now in sync with your Prisma schema.` A new folder under `prisma/migrations/` will contain the SQL.

If `prisma generate` fails with the Windows arm64 DLL error, follow up with:

```bash
npx prisma generate --no-engine
```

This is a known dev-environment workaround; see session memory in `memory/`.

- [ ] **Step 3: Verify the migration SQL**

Read the generated `prisma/migrations/<timestamp>_add_user_active_country/migration.sql`. It should contain exactly:

```sql
-- AlterTable
ALTER TABLE "User" ADD COLUMN "activeCountry" TEXT;
```

No other tables should be altered. If anything else appears, stop and investigate before committing.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): add User.activeCountry column for per-user country context"
```

---

## Task 2: `resolveCountry()` helper with unit tests (TDD)

**Files:**
- Create: `src/lib/active-country.ts`
- Create: `src/lib/__tests__/active-country.test.ts`

- [ ] **Step 1: Write the failing test file**

Create `src/lib/__tests__/active-country.test.ts` with the following content:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    user: { findUnique: vi.fn() },
    tenant: { findUnique: vi.fn() },
  },
}));

import { db } from '@/lib/db';
import { resolveCountry } from '../active-country';

describe('resolveCountry', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns tender.country when provided, ignoring user and tenant', async () => {
    const result = await resolveCountry({
      tenderCountry: 'NL',
      userId: 'user-1',
      tenantId: 'tenant-1',
    });
    expect(result).toBe('NL');
    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(db.tenant.findUnique).not.toHaveBeenCalled();
  });

  it('returns user.activeCountry when tender country is null', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ activeCountry: 'NL' } as any);
    const result = await resolveCountry({
      tenderCountry: null,
      userId: 'user-1',
      tenantId: 'tenant-1',
    });
    expect(result).toBe('NL');
    expect(db.tenant.findUnique).not.toHaveBeenCalled();
  });

  it('falls through to tenant.countries[0] when user has no active country', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ activeCountry: null } as any);
    vi.mocked(db.tenant.findUnique).mockResolvedValue({ countries: ['GR', 'NL'] } as any);
    const result = await resolveCountry({
      tenderCountry: null,
      userId: 'user-1',
      tenantId: 'tenant-1',
    });
    expect(result).toBe('GR');
  });

  it('falls through to tenant.countries[0] when userId is not provided', async () => {
    vi.mocked(db.tenant.findUnique).mockResolvedValue({ countries: ['GR'] } as any);
    const result = await resolveCountry({ tenantId: 'tenant-1' });
    expect(result).toBe('GR');
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });

  it('returns "GR" as final fallback when tenant has empty countries', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ activeCountry: null } as any);
    vi.mocked(db.tenant.findUnique).mockResolvedValue({ countries: [] } as any);
    const result = await resolveCountry({
      tenderCountry: null,
      userId: 'user-1',
      tenantId: 'tenant-1',
    });
    expect(result).toBe('GR');
  });

  it('handles user not found gracefully (treats as no active country)', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null);
    vi.mocked(db.tenant.findUnique).mockResolvedValue({ countries: ['NL'] } as any);
    const result = await resolveCountry({
      userId: 'missing',
      tenantId: 'tenant-1',
    });
    expect(result).toBe('NL');
  });

  it('handles tender.country as empty string (treats as null)', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ activeCountry: 'NL' } as any);
    const result = await resolveCountry({
      tenderCountry: '',
      userId: 'user-1',
      tenantId: 'tenant-1',
    });
    expect(result).toBe('NL');
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npx vitest run src/lib/__tests__/active-country.test.ts
```

Expected: all 7 tests FAIL with "Cannot find module '../active-country'".

- [ ] **Step 3: Implement the helper**

Create `src/lib/active-country.ts` with:

```ts
import { db } from '@/lib/db';

export interface ResolveCountryOptions {
  /** If set, short-circuits and returns this value. Use for operations tied to a specific tender. */
  tenderCountry?: string | null;
  /** Current user id. If set, checks user.activeCountry before falling through. */
  userId?: string;
  /** Tenant id is always required as the final fallback source. */
  tenantId: string;
}

/**
 * Resolves the country code to use for AI/legal/compliance context.
 *
 * Precedence (highest wins):
 *   1. tenderCountry — explicit per-tender country
 *   2. user.activeCountry — the user's currently selected working country
 *   3. tenant.countries[0] — the tenant's primary country
 *   4. 'GR' — hard fallback if tenant has no countries
 *
 * Operations scoped to a specific tender MUST pass tenderCountry so that
 * switching context does not retroactively re-interpret existing tenders.
 */
export async function resolveCountry(opts: ResolveCountryOptions): Promise<string> {
  // 1. Explicit tender country wins
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

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npx vitest run src/lib/__tests__/active-country.test.ts
```

Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/active-country.ts src/lib/__tests__/active-country.test.ts
git commit -m "feat: add resolveCountry helper with fallback chain"
```

---

## Task 3: tRPC procedure `tenant.setActiveCountry`

**Files:**
- Modify: `src/server/routers/tenant.ts` (add procedure after `addCountry`)
- Create: `src/server/routers/__tests__/tenant-set-active-country.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/server/routers/__tests__/tenant-set-active-country.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';

vi.mock('@/lib/db', () => ({
  db: {
    tenant: { findUniqueOrThrow: vi.fn() },
    user: { update: vi.fn() },
  },
}));

import { db } from '@/lib/db';
import { tenantRouter } from '../tenant';

function makeCtx(overrides: Partial<{ tenantId: string; userId: string }> = {}) {
  return {
    db,
    tenantId: 'tenant-1',
    userId: 'user-1',
    session: { user: { id: 'user-1', tenantId: 'tenant-1' } },
    user: { id: 'user-1', tenantId: 'tenant-1' },
    ...overrides,
  } as any;
}

describe('tenant.setActiveCountry', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates user.activeCountry when country is in tenant.countries', async () => {
    vi.mocked(db.tenant.findUniqueOrThrow).mockResolvedValue({ countries: ['GR', 'NL'] } as any);
    vi.mocked(db.user.update).mockResolvedValue({ id: 'user-1', activeCountry: 'NL' } as any);

    const caller = tenantRouter.createCaller(makeCtx());
    const result = await caller.setActiveCountry({ country: 'NL' });

    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { activeCountry: 'NL' },
    });
    expect(result).toEqual({ activeCountry: 'NL' });
  });

  it('throws FORBIDDEN when country is not in tenant.countries', async () => {
    vi.mocked(db.tenant.findUniqueOrThrow).mockResolvedValue({ countries: ['GR'] } as any);

    const caller = tenantRouter.createCaller(makeCtx());
    await expect(caller.setActiveCountry({ country: 'NL' })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it('throws BAD_REQUEST when tenantId is missing', async () => {
    const caller = tenantRouter.createCaller(makeCtx({ tenantId: undefined }));
    await expect(caller.setActiveCountry({ country: 'NL' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('accepts null to clear active country', async () => {
    vi.mocked(db.tenant.findUniqueOrThrow).mockResolvedValue({ countries: ['GR', 'NL'] } as any);
    vi.mocked(db.user.update).mockResolvedValue({ id: 'user-1', activeCountry: null } as any);

    const caller = tenantRouter.createCaller(makeCtx());
    const result = await caller.setActiveCountry({ country: null });

    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { activeCountry: null },
    });
    expect(result).toEqual({ activeCountry: null });
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npx vitest run src/server/routers/__tests__/tenant-set-active-country.test.ts
```

Expected: tests fail because `setActiveCountry` is not yet a property of `tenantRouter`.

- [ ] **Step 3: Add the procedure to `tenant.ts`**

Open `src/server/routers/tenant.ts`. After the closing `}),` of the `addCountry` procedure (around line 60), add the following before the next procedure:

```ts
  setActiveCountry: protectedProcedure
    .input(z.object({ country: z.string().length(2).nullable() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      // If clearing, skip the membership check
      if (input.country !== null) {
        const tenant = await ctx.db.tenant.findUniqueOrThrow({
          where: { id: ctx.tenantId },
          select: { countries: true },
        });
        if (!tenant.countries.includes(input.country)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: `Country ${input.country} is not enabled for this tenant.`,
          });
        }
      }

      await ctx.db.user.update({
        where: { id: ctx.user.id },
        data: { activeCountry: input.country },
      });

      return { activeCountry: input.country };
    }),
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npx vitest run src/server/routers/__tests__/tenant-set-active-country.test.ts
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/routers/tenant.ts src/server/routers/__tests__/tenant-set-active-country.test.ts
git commit -m "feat(api): add tenant.setActiveCountry tRPC procedure"
```

---

## Task 4: Refactor `tender.ts` create mutation to use `resolveCountry`

**Files:**
- Modify: `src/server/routers/tender.ts:129-143`

- [ ] **Step 1: Read the current implementation**

Open `src/server/routers/tender.ts` and locate the block around line 129-143 inside the `create` mutation. It currently looks like:

```ts
const { sourceUrl, country: inputCountry, ...tenderData } = input;

// Default country from tenant's primary country
let country = inputCountry;
if (!country) {
  const tenant = await ctx.db.tenant.findUnique({ where: { id: ctx.tenantId }, select: { countries: true } });
  country = tenant?.countries?.[0] ?? 'GR';
}
```

- [ ] **Step 2: Replace the block**

Replace the block above with:

```ts
const { sourceUrl, country: inputCountry, ...tenderData } = input;

// Default country: explicit input > user.activeCountry > tenant.countries[0] > 'GR'
const { resolveCountry } = await import('@/lib/active-country');
const country = await resolveCountry({
  tenderCountry: inputCountry,
  userId: ctx.user.id,
  tenantId: ctx.tenantId,
});
```

Note: the dynamic `import()` avoids a circular dependency risk. If the file already imports from `@/lib/active-country` at the top, use a top-level import instead.

- [ ] **Step 3: Run type check**

```bash
npx tsc --noEmit
```

Expected: exit 0, no new errors.

- [ ] **Step 4: Run existing tender router tests (if any)**

```bash
npx vitest run src/server/routers/
```

Expected: all pass. If any test breaks because it expected the old `countries[0]` behavior, update the mocks to provide `user.findUnique → { activeCountry: null }` so the fallback chain still produces the original result.

- [ ] **Step 5: Commit**

```bash
git add src/server/routers/tender.ts
git commit -m "refactor(tender): use resolveCountry helper in create mutation"
```

---

## Task 5: Refactor `compliance-engine.ts` to use `resolveCountry`

**Files:**
- Modify: `src/server/services/compliance-engine.ts:39-47`
- Modify: `src/server/services/__tests__/compliance-engine.test.ts` (update tenant mock)

- [ ] **Step 1: Update compliance-engine to accept userId and use resolveCountry**

Open `src/server/services/compliance-engine.ts` and locate the `runComplianceCheck` method. Change its signature and body around lines 39-47:

Before:

```ts
async runComplianceCheck(tenderId: string, tenantId: string): Promise<{
  score: number;
  results: MatchResult[];
}> {
  // Load country-specific compliance keywords
  const { getPromptContext } = await import('@/lib/prompts');
  const tenant = await db.tenant.findUnique({ where: { id: tenantId }, select: { countries: true } });
  const country = tenant?.countries?.[0] ?? 'GR';
  this._docTypeKeywords = getPromptContext(country).docTypeKeywords;
```

After:

```ts
async runComplianceCheck(
  tenderId: string,
  tenantId: string,
  opts: { userId?: string } = {}
): Promise<{
  score: number;
  results: MatchResult[];
}> {
  // Load country-specific compliance keywords
  const { getPromptContext } = await import('@/lib/prompts');
  const { resolveCountry } = await import('@/lib/active-country');

  // Look up the tender's explicit country first — tender.country wins in the fallback chain
  const tenderRecord = await db.tender.findUnique({
    where: { id: tenderId },
    select: { country: true },
  });
  const country = await resolveCountry({
    tenderCountry: tenderRecord?.country,
    userId: opts.userId,
    tenantId,
  });
  this._docTypeKeywords = getPromptContext(country).docTypeKeywords;
```

- [ ] **Step 2: Update callers of `runComplianceCheck`**

Find every caller in the codebase:

```bash
npx grep -rn "runComplianceCheck" src/server src/app 2>/dev/null
```

For each call site that has access to a tRPC context (`ctx.user.id`), add the third argument. Example in a tRPC mutation:

```ts
// Before
await engine.runComplianceCheck(tenderId, ctx.tenantId);
// After
await engine.runComplianceCheck(tenderId, ctx.tenantId, { userId: ctx.user.id });
```

For call sites without user context (e.g. background jobs), pass `{}` or omit — the third argument is optional.

- [ ] **Step 3: Update the existing compliance-engine unit test mock**

Open `src/server/services/__tests__/compliance-engine.test.ts`. The current mock (after the Task-1 session fix) includes `tenant: { findUnique }`. Add `user: { findUnique }` and `tender: { findUnique }`:

```ts
vi.mock('@/lib/db', () => ({
  db: {
    tenant: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    tender: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    tenderRequirement: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    certificate: { findMany: vi.fn() },
    legalDocument: { findMany: vi.fn() },
    project: { findMany: vi.fn() },
    contentLibraryItem: { findMany: vi.fn() },
    activity: { create: vi.fn() },
    requirementMapping: { create: vi.fn() },
  },
}));
```

And update `beforeEach` so the new `tender.findUnique` returns a tender without an explicit country (so the fallback chain hits `user.activeCountry` then `tenant.countries[0]`):

```ts
beforeEach(() => {
  vi.clearAllMocks();
  // Default: tender has no explicit country → fallback chain takes over
  vi.mocked(db.tender.findUnique).mockResolvedValue({ country: null } as any);
  // Default: user has no active country → falls through to tenant.countries[0]
  vi.mocked(db.user.findUnique).mockResolvedValue({ activeCountry: null } as any);
  // Default: tenant resolves to GR country so getPromptContext returns valid keywords
  vi.mocked(db.tenant.findUnique).mockResolvedValue({ countries: ['GR'] } as any);
});
```

- [ ] **Step 4: Run compliance-engine tests**

```bash
npx vitest run src/server/services/__tests__/compliance-engine.test.ts
```

Expected: all 7 tests PASS.

- [ ] **Step 5: Run the full vitest suite to catch any broken caller**

```bash
npm run test:run
```

Expected: all tests PASS. If a caller test fails because it expected the old 2-arg signature, update the caller (TypeScript should already have complained in `tsc --noEmit`).

- [ ] **Step 6: Commit**

```bash
git add src/server/services/compliance-engine.ts src/server/services/__tests__/compliance-engine.test.ts
git commit -m "refactor(compliance): use resolveCountry with tender.country precedence"
```

---

## Task 6: New `user` tRPC router with `me` query

**Rationale:** The app currently has no user-scoped tRPC query — `trpc.tenant.get` returns tenant data, and there is no `me` procedure for the current user. We need one to surface `activeCountry` to the frontend cleanly.

**Files:**
- Create: `src/server/routers/user.ts`
- Modify: `src/server/root.ts` (register the new router)

- [ ] **Step 1: Create the user router**

Create `src/server/routers/user.ts`:

```ts
import { router, protectedProcedure } from '@/server/trpc';

export const userRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.user.findUnique({
      where: { id: ctx.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        activeCountry: true,
      },
    });
  }),
});
```

- [ ] **Step 2: Register the router in `root.ts`**

Open `src/server/root.ts`. Add the import alongside the other router imports:

```ts
import { userRouter } from '@/server/routers/user';
```

And add `user: userRouter,` to the `appRouter` object (alphabetically sorted with the others is fine):

```ts
export const appRouter = router({
  auth: authRouter,
  tenant: tenantRouter,
  user: userRouter, // ← ADD
  company: companyRouter,
  // ... rest unchanged
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```

Expected: exit 0. If Prisma types complain that `activeCountry` doesn't exist on `User`, run `npx prisma generate --no-engine` to regenerate the client from the Task 1 migration.

- [ ] **Step 4: Commit**

```bash
git add src/server/routers/user.ts src/server/root.ts
git commit -m "feat(api): add user.me tRPC procedure returning activeCountry"
```

---

## Task 7: `CountrySwitcher` component

**Files:**
- Create: `src/components/ui/country-switcher.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/ui/country-switcher.tsx`:

```tsx
'use client';

import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Check } from 'lucide-react';
import { SUPPORTED_COUNTRIES } from '@/lib/country-config';

const FLAG: Record<string, string> = {
  GR: '🇬🇷',
  NL: '🇳🇱',
};

export function CountrySwitcher({ className }: { className?: string }) {
  const utils = trpc.useUtils();
  const { data: tenant } = trpc.tenant.get.useQuery();
  const { data: me } = trpc.user.me.useQuery();

  const setActiveCountry = trpc.tenant.setActiveCountry.useMutation({
    onSuccess: () => {
      // Invalidate anything that depends on country context
      utils.user.me.invalidate();
      utils.tender.list.invalidate();
      utils.discovery.invalidate();
    },
  });

  const countries: string[] = tenant?.countries ?? [];

  // Hide entirely for single-country tenants
  if (countries.length < 2) return null;

  const activeCountry = me?.activeCountry ?? countries[0];
  const currentFlag = FLAG[activeCountry] ?? '🏳️';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium',
          'bg-white/[0.06] border border-white/[0.08]',
          'text-muted-foreground hover:text-foreground transition-colors cursor-pointer',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          className
        )}
        aria-label="Switch country"
      >
        <span className="mr-0.5">{currentFlag}</span>
        <span>{activeCountry}</span>
        <ChevronDown className="h-3 w-3 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        {countries.map((code) => {
          const config = SUPPORTED_COUNTRIES.find((c) => c.code === code);
          const isActive = code === activeCountry;
          return (
            <DropdownMenuItem
              key={code}
              disabled={setActiveCountry.isPending}
              onClick={() => setActiveCountry.mutate({ country: code })}
              className={cn(
                'cursor-pointer flex items-center justify-between gap-2',
                isActive && 'font-semibold'
              )}
            >
              <span className="flex items-center gap-2">
                <span>{FLAG[code] ?? '🏳️'}</span>
                <span>{config?.name ?? code}</span>
              </span>
              {isActive && <Check className="h-3 w-3" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 2: Verify `SUPPORTED_COUNTRIES` export shape**

```bash
npx grep -n "SUPPORTED_COUNTRIES" src/lib/country-config
```

Expected: export from `src/lib/country-config/index.ts` of shape `Array<{ code: string; name: string; flag: string; ... }>`. If the shape differs, adjust the `config?.name` access in the component to match (the component expects `.name`).

- [ ] **Step 3: Run type check**

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/country-switcher.tsx
git commit -m "feat(ui): add CountrySwitcher header dropdown component"
```

---

## Task 8: `CountryModeBadge` component

**Files:**
- Create: `src/components/ui/country-mode-badge.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/ui/country-mode-badge.tsx`:

```tsx
'use client';

import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

const FLAG: Record<string, string> = {
  GR: '🇬🇷',
  NL: '🇳🇱',
};

/**
 * Small pill shown only when the user is operating in a non-primary country.
 * Prevents accidents like creating a Greek tender while in Dutch mode unnoticed.
 */
export function CountryModeBadge({ className }: { className?: string }) {
  const { data: tenant } = trpc.tenant.get.useQuery();
  const { data: me } = trpc.user.me.useQuery();

  const countries: string[] = tenant?.countries ?? [];
  if (countries.length < 2) return null;

  const primaryCountry = countries[0];
  const activeCountry = me?.activeCountry ?? primaryCountry;

  // Only show when the user is in a non-primary country
  if (activeCountry === primaryCountry) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        'bg-amber-500/10 text-amber-700 border border-amber-500/30',
        'dark:bg-amber-400/10 dark:text-amber-300 dark:border-amber-400/30',
        className
      )}
      role="status"
      aria-label={`Operating in ${activeCountry} mode`}
    >
      <span>{FLAG[activeCountry] ?? '🏳️'}</span>
      <span>{activeCountry} Mode</span>
    </span>
  );
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/country-mode-badge.tsx
git commit -m "feat(ui): add CountryModeBadge for non-primary country indicator"
```

---

## Task 9: Mount switcher + badge in dashboard top nav

**Files:**
- Modify: `src/components/layout/top-nav.tsx` (around the existing LanguageToggle mount at line 158)

- [ ] **Step 1: Add imports**

Open `src/components/layout/top-nav.tsx`. In the import block near the top, add:

```ts
import { CountrySwitcher } from '@/components/ui/country-switcher';
import { CountryModeBadge } from '@/components/ui/country-mode-badge';
```

- [ ] **Step 2: Mount the CountrySwitcher next to LanguageToggle**

Find the existing line (~158):

```tsx
{/* Language Toggle */}
<LanguageToggle className="bg-foreground/[0.04] border-border/60" />
```

Replace with:

```tsx
{/* Country Switcher (auto-hidden for single-country tenants) */}
<CountrySwitcher className="bg-foreground/[0.04] border-border/60" />

{/* Language Toggle */}
<LanguageToggle className="bg-foreground/[0.04] border-border/60" />
```

- [ ] **Step 3: Mount the badge in the left cluster of the top nav**

Locate the top-nav's left area (where the breadcrumb/logo sits). Find the closing of the logo/title block and add the badge there. Example:

```tsx
<div className="flex items-center gap-2">
  {/* existing logo / breadcrumb */}
  <CountryModeBadge />
</div>
```

If the existing top-nav doesn't have an obvious left cluster, put the badge right before the `Search` button in the right cluster:

```tsx
<div className="flex items-center gap-1.5">
  <CountryModeBadge className="mr-2" />
  <Button
    variant="ghost"
    size="sm"
    // ... existing search button
```

- [ ] **Step 4: Run dev server and manually verify**

```bash
npm run dev
```

Open `http://localhost:3000/dashboard`. You should see:
- Single-country tenant (GR only): no switcher, no badge — page looks identical to before
- Multi-country tenant (GR + NL, activeCountry=null or GR): switcher visible showing `🇬🇷 GR`, NO badge
- Multi-country tenant after selecting NL: switcher shows `🇳🇱 NL`, orange badge `🇳🇱 NL Mode` visible

Stop the dev server with Ctrl+C once verified.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/top-nav.tsx
git commit -m "feat(ui): mount CountrySwitcher and CountryModeBadge in top nav"
```

---

## Task 10: Discovery tabs — filter tender list by country

**Files:**
- Modify: `src/app/(dashboard)/tenders/page.tsx`

- [ ] **Step 1: Locate the tender list rendering**

Open `src/app/(dashboard)/tenders/page.tsx`. Find the main tRPC query that fetches tenders (likely `trpc.tender.list.useQuery(...)`) and the JSX that renders the list (usually a `.map()` over the results).

- [ ] **Step 2: Add the tab state**

Near the top of the component, after the existing `useState` calls, add:

```tsx
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
// ... other imports

const searchParams = useSearchParams();
const router = useRouter();
const pathname = usePathname();

const { data: tenant } = trpc.tenant.get.useQuery();
const { data: me } = trpc.user.me.useQuery();

const countries: string[] = tenant?.countries ?? [];
const isMultiCountry = countries.length >= 2;
const activeCountry = me?.activeCountry ?? countries[0] ?? 'GR';

// Current country filter from URL (default: active country)
const countryFilter = searchParams.get('country') ?? activeCountry;

function setCountryFilter(value: string) {
  const params = new URLSearchParams(searchParams.toString());
  if (value === 'all') {
    params.delete('country');
  } else {
    params.set('country', value);
  }
  router.replace(`${pathname}?${params.toString()}`);
}
```

- [ ] **Step 3: Render the tabs (only when multi-country)**

Above the tender list JSX, insert:

```tsx
{isMultiCountry && (
  <div className="mb-4 flex items-center gap-1 rounded-lg border border-border/60 bg-muted/30 p-1 w-fit">
    {[activeCountry, ...countries.filter((c) => c !== activeCountry), 'all'].map((value) => {
      const label =
        value === 'all'
          ? `All (${allTenders.length})`
          : `${FLAG[value] ?? '🏳️'} ${value} (${allTenders.filter((t: any) => t.country === value).length})`;
      const selected = countryFilter === value;
      return (
        <button
          key={value}
          type="button"
          onClick={() => setCountryFilter(value)}
          className={cn(
            'px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer',
            selected
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {label}
        </button>
      );
    })}
  </div>
)}
```

Add the `FLAG` constant near the top of the file (copy from `country-switcher.tsx`):

```tsx
const FLAG: Record<string, string> = { GR: '🇬🇷', NL: '🇳🇱' };
```

Replace `allTenders` with the actual variable name holding the raw tender array from the query (it may be `tendersData?.items` or similar — match the existing code).

- [ ] **Step 4: Apply the filter to the rendered list**

Find where the current code maps over tenders. Replace the source array with a filtered version:

```tsx
const filteredTenders = (allTenders ?? []).filter((t: any) =>
  countryFilter === 'all' ? true : t.country === countryFilter
);
```

Then use `filteredTenders` in the `.map(...)` instead of `allTenders`. Keep all other filters (search query, status, etc.) applied on top of this.

- [ ] **Step 5: Type check**

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 6: Manually verify in dev**

```bash
npm run dev
```

Open `http://localhost:3000/tenders` as a multi-country tenant. Verify:
- Three tabs visible (active country, other country, all) with correct counts
- Clicking a tab updates the URL (`?country=NL`) and filters the list
- "All" clears the URL param and shows everything
- Single-country tenant sees no tabs

Ctrl+C to stop.

- [ ] **Step 7: Commit**

```bash
git add src/app/(dashboard)/tenders/page.tsx
git commit -m "feat(discovery): add country filter tabs on tenders list"
```

---

## Task 11: New Tender page default from `activeCountry`

**Files:**
- Modify: `src/app/(dashboard)/tenders/new/page.tsx:108` (inside the useEffect that seeds `selectedCountry`)

- [ ] **Step 1: Read the current initialization logic**

Open `src/app/(dashboard)/tenders/new/page.tsx` and find line 108. The current code is:

```tsx
setSelectedCountry(tenantData.countries[0]);
```

- [ ] **Step 2: Replace with the active-country-aware default**

Replace line 108 with:

```tsx
// Prefer the user's active country, fall back to the tenant's primary country
setSelectedCountry(meData?.activeCountry ?? tenantData.countries[0]);
```

- [ ] **Step 3: Make sure `meData` is already fetched in this component**

Near the top of the component, locate the existing tRPC queries. If `trpc.user.me.useQuery()` is not called, add it:

```tsx
const { data: meData } = trpc.user.me.useQuery();
```

Make sure this query is in scope at line 108 (same component).

- [ ] **Step 4: Run type check**

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/tenders/new/page.tsx
git commit -m "feat(tender): default new-tender country from user.activeCountry"
```

---

## Task 12: Playwright E2E test — country switcher visibility and persistence

**Files:**
- Create: `tests/country-switcher.spec.ts`

- [ ] **Step 1: Write the E2E test**

Create `tests/country-switcher.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

// This test requires a seeded multi-country test user. If the project uses
// Playwright storage state or a seed script, update the login helper accordingly.
// For a smoke-level check we assume a test user with tenant.countries=['GR','NL'].

test.describe('Country Switcher', () => {
  test('hidden for single-country tenants', async ({ page }) => {
    // Single-country user (the default signup state — countries=['GR'])
    await page.goto('/login');
    await page.getByLabel('Email').fill('single@test.gr');
    await page.getByLabel('Κωδικός', { exact: true }).fill('TestPass123');
    await page.locator('button[type="submit"]').click({ force: true });

    // Wait for dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 });

    // Verify the switcher is NOT in the DOM
    const switcher = page.getByRole('button', { name: 'Switch country' });
    await expect(switcher).toHaveCount(0);
  });

  test('visible and switchable for multi-country tenants', async ({ page }) => {
    // Multi-country user (seeded with countries=['GR','NL'])
    await page.goto('/login');
    await page.getByLabel('Email').fill('multi@test.gr');
    await page.getByLabel('Κωδικός', { exact: true }).fill('TestPass123');
    await page.locator('button[type="submit"]').click({ force: true });
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 });

    // Switcher visible, shows GR by default
    const switcher = page.getByRole('button', { name: 'Switch country' });
    await expect(switcher).toBeVisible();
    await expect(switcher).toContainText('GR');

    // Click to switch to NL
    await switcher.click({ force: true });
    await page.getByRole('menuitem', { name: /Nederland|NL/ }).click({ force: true });

    // Switcher now shows NL
    await expect(switcher).toContainText('NL', { timeout: 5_000 });

    // Mode badge appears (non-primary country)
    await expect(page.getByRole('status', { name: /NL Mode/ })).toBeVisible();

    // Reload the page — active country should persist (DB, not client state)
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(switcher).toContainText('NL');
    await expect(page.getByRole('status', { name: /NL Mode/ })).toBeVisible();
  });

  test('discovery tabs filter by country', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('multi@test.gr');
    await page.getByLabel('Κωδικός', { exact: true }).fill('TestPass123');
    await page.locator('button[type="submit"]').click({ force: true });
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 });

    // Navigate to tenders list
    await page.goto('/tenders');

    // Click the "All" tab
    await page.getByRole('button', { name: /All \(/ }).click({ force: true });
    await expect(page).toHaveURL(/\/tenders(?!\?country=)/);

    // Click the NL tab
    await page.getByRole('button', { name: /🇳🇱 NL \(/ }).click({ force: true });
    await expect(page).toHaveURL(/\?country=NL/);
  });
});
```

Note on seeding: if the project does not yet have a `multi@test.gr` user seeded, this test will need either (a) a seed script added in `prisma/seed.ts`, or (b) a programmatic setup via API. If no seed infrastructure exists, mark these tests as `test.skip` with a comment explaining the need for seeded multi-country accounts, and implement the seed in a follow-up.

- [ ] **Step 2: Run the test against the dev server**

Start the dev server in another shell:

```bash
npm run dev
```

Then run:

```bash
npx playwright test tests/country-switcher.spec.ts --project=regression-chromium --workers=1
```

Expected: tests PASS, or are cleanly SKIPPED with a clear reason. If any test fails because of missing seed data, follow the seeding note above.

- [ ] **Step 3: Commit**

```bash
git add tests/country-switcher.spec.ts
git commit -m "test(e2e): add country switcher visibility and persistence tests"
```

---

## Task 13: Final verification and integration

**Files:** (none — verification only)

- [ ] **Step 1: Run the full vitest suite**

```bash
npm run test:run
```

Expected: all tests PASS (42+ tests including the new ones from Tasks 2, 3, 5).

- [ ] **Step 2: Run the Playwright smoke + auth suites**

```bash
npx playwright test --project=smoke --project=auth --workers=1
```

Expected: 23+ tests PASS (previous baseline from session).

- [ ] **Step 3: Run type check**

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 4: Run Next.js production build**

```bash
npm run build
```

Expected: build succeeds. No new TypeScript errors or prerender issues.

- [ ] **Step 5: Manual end-to-end smoke**

Start `npm run dev`. As a multi-country tenant:

1. Log in. Verify `CountrySwitcher` visible in header showing the default (GR).
2. Click switcher → select NL. Verify badge `🇳🇱 NL Mode` appears.
3. Navigate to `/tenders`. Verify three tabs `[🇳🇱 NL (...)] [🇬🇷 GR (...)] [All (...)]` with NL pre-selected.
4. Click "All" → URL becomes `/tenders` (no query param). Verify all countries' tenders visible.
5. Navigate to `/tenders/new`. Verify country dropdown defaults to NL.
6. Create a new tender without changing the country. Inspect it — `tender.country` should be `NL` in DB.
7. Open an existing GR tender (if one exists) while in NL mode — verify compliance check still uses GR context (tender.country wins).
8. Reload the page. Verify NL still selected (DB persistence).
9. Switch back to GR. Verify badge disappears.

Stop the dev server.

- [ ] **Step 6: Final commit (if any tweaks)**

If any manual verification uncovered a small bug, fix it and commit:

```bash
git add -u
git commit -m "fix(country-switcher): <describe the fix>"
```

Otherwise, the implementation is complete. The working tree should have 11 commits stacked on main (one per task plus any fixes).

---

## Summary of files touched

**New files:**
- `src/lib/active-country.ts`
- `src/lib/__tests__/active-country.test.ts`
- `src/components/ui/country-switcher.tsx`
- `src/components/ui/country-mode-badge.tsx`
- `src/server/routers/__tests__/tenant-set-active-country.test.ts`
- `tests/country-switcher.spec.ts`
- `prisma/migrations/<timestamp>_add_user_active_country/migration.sql` (generated)

**Modified files:**
- `prisma/schema.prisma` — add `User.activeCountry`
- `src/server/routers/tenant.ts` — add `setActiveCountry` procedure
- `src/server/routers/tender.ts` — use `resolveCountry` in `create`
- `src/server/routers/user.ts` — include `activeCountry` in `me` query (if applicable)
- `src/server/services/compliance-engine.ts` — use `resolveCountry`, accept `userId`
- `src/server/services/__tests__/compliance-engine.test.ts` — update mocks
- `src/components/layout/top-nav.tsx` — mount switcher + badge
- `src/app/(dashboard)/tenders/page.tsx` — discovery tabs + filter
- `src/app/(dashboard)/tenders/new/page.tsx` — default from `activeCountry`
