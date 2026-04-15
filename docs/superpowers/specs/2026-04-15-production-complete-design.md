# TenderCopilot — Production Complete Design Spec

**Date:** 2026-04-15  
**Scope:** 6 sub-projects to bring TenderCopilot from beta to production-ready  
**Stack:** Next.js 14, tRPC, Prisma, shadcn/ui, Resend, Stripe

---

## SP1 — Missing Pages & Error Handling

### Pages to create

| Route | Purpose |
|-------|---------|
| `/terms` | Terms of Service — static, Greek + English toggle |
| `/privacy` | Privacy Policy — static, GDPR compliant (GR/NL) |
| `/invite/[token]` | Accept team invitation — validates token, creates account or links existing |
| `src/app/not-found.tsx` | Global 404 page |
| `src/app/error.tsx` | Global error boundary |

### Design
- `/terms` and `/privacy`: simple prose pages, same layout as auth pages (centered card, TenderCopilot header). Greek by default, language toggle for English.
- `/invite/[token]`: fetches invitation from DB by token, shows inviter name + company, presents signup form pre-filled with email. On submit: creates user (if new) or links existing account to tenant.
- `not-found.tsx`: headline "Η σελίδα δεν βρέθηκε", subtext, button back to dashboard.
- `error.tsx`: headline "Κάτι πήγε στραβά", subtext, retry + home buttons.

### Data model
Invitation token already exists in `TenantMember` or similar — verify and use. If not, add `InviteToken` model:
```
model InviteToken {
  id        String   @id @default(cuid())
  token     String   @unique
  email     String
  tenantId  String
  role      String   @default("MEMBER")
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())
}
```

---

## SP2 — Email Infrastructure (Resend)

### Provider
**Resend** via `resend` npm package + **React Email** for templates.

### Setup
1. `npm install resend @react-email/components`
2. `RESEND_API_KEY=re_xxx` in `.env`
3. `RESEND_FROM=noreply@tendercopilot.com` in `.env`
4. Single email service at `src/server/services/email.ts` — replaces existing SMTP stub

### Emails to implement

| Email | Trigger | Template |
|-------|---------|---------|
| Welcome | After registration | Καλώς ήρθες + CTA "Ξεκίνα το setup" |
| Password Reset | forgot-password form submit | Reset link (24h expiry) |
| Team Invitation | Settings → Invite | Invitation link to `/invite/[token]` |
| Document Ready | Document parsing complete | "Το έγγραφό σου αναλύθηκε" + CTA |

### Email service interface
```ts
sendWelcomeEmail(to: string, name: string): Promise<void>
sendPasswordResetEmail(to: string, resetUrl: string): Promise<void>
sendInvitationEmail(to: string, inviterName: string, company: string, inviteUrl: string): Promise<void>
sendDocumentReadyEmail(to: string, tenderTitle: string, tenderUrl: string): Promise<void>
```

### Templates
- All templates: React Email components
- Design: matches TenderCopilot visual style (white bg, Picton Blue `#3B96D4` primary, Inter font)
- Language: Greek default, English fallback
- Footer: unsubscribe link, company address (required for GDPR)

---

## SP3 — Onboarding Wizard

### Flow
After registration → redirect to `/onboarding` instead of `/dashboard`. After completion (or skip) → redirect to `/dashboard`.

### Steps

**Step 1 — Εταιρεία**
- Fields: Επωνυμία (pre-filled from registration), ΑΦΜ, Διεύθυνση, Πόλη
- Required: Επωνυμία only
- Saves to: `CompanyProfile`

**Step 2 — Δραστηριότητα**
- Fields: KAD codes (multi-select searchable), CPV codes (optional), brief description
- Purpose: powers the discovery feed relevance
- At least 1 KAD code required to proceed (soft — skippable)

**Step 3 — Έτοιμος!**
- Summary of what was set up
- CTA: "Δες τους πρώτους διαγωνισμούς" → `/tenders`
- Secondary: "Εξερεύνησε το dashboard" → `/dashboard`

### Navigation
- Progress bar at top (3 steps)
- "← Πίσω" between steps
- "Παράλειψη για τώρα" link on every step (goes to dashboard, wizard doesn't reappear — state stored in `user.onboardingCompletedAt`)
- No back button on step 1 (no previous step)

### State
Add to `User` model:
```
onboardingCompletedAt DateTime?
```
Wizard shows only if `user.onboardingCompletedAt == null`.  
On skip or completion: set `onboardingCompletedAt = now()`.

### Route protection
`/onboarding` requires auth. If `onboardingCompletedAt` is set → redirect to `/dashboard`.

---

## SP4 — Notifications Center

### Bell icon behavior
Click on 🔔 in top nav → opens dropdown popover (no page navigation).

### Notification types

| Type | Icon | Trigger |
|------|------|---------|
| `DEADLINE_APPROACHING` | ⏰ | 7 days and 3 days before submission deadline |
| `NEW_MATCHING_TENDER` | 🔍 | Discovery finds tenders matching user's KAD/CPV |
| `DOCUMENT_READY` | ✅ | Document parsing + analysis complete |
| `TEAM_ACTIVITY` | 👤 | Team member assigned/completed a task |

### Data model
```prisma
model Notification {
  id        String   @id @default(cuid())
  userId    String
  type      String   // DEADLINE_APPROACHING | NEW_MATCHING_TENDER | DOCUMENT_READY | TEAM_ACTIVITY
  title     String
  body      String?
  linkUrl   String?
  readAt    DateTime?
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

### API
- `notification.list` — returns last 20 notifications for current user, unread first
- `notification.markRead(id)` — marks one as read
- `notification.markAllRead` — marks all as read
- `notification.unreadCount` — returns integer for bell badge

### Dropdown UI
- Max 5 notifications visible, "Δες όλες →" link at bottom (links to `/notifications` page — future)
- Unread items: blue left border + subtle blue tint background
- Blue dot on unread items
- "Σήμανση όλων ως αναγνωσμένα" button in header
- Badge count on bell icon (hidden when 0)
- Auto-refresh every 60 seconds via tRPC query refetch

### Notification creation
- `DEADLINE_APPROACHING`: created by a lightweight check in the discovery cron / or lazily when user opens tenders page
- `NEW_MATCHING_TENDER`: created when discovery runs and finds new matches
- `DOCUMENT_READY`: created in document parsing pipeline after status → `success`
- `TEAM_ACTIVITY`: created on task assignment mutation

---

## SP5 — Settings Fixes

### Profile save (currently broken)
- `user.updateProfile` tRPC mutation: updates `user.name`
- Wire to existing "Save Changes" button in Settings → Profile tab
- Show success toast on save

### Invitation flow end-to-end
- `tenant.inviteMember` mutation: creates `InviteToken` record + calls `sendInvitationEmail()`
- Currently sends toast but no email — wire to Resend (SP2)
- Invitation link format: `https://app.tendercopilot.com/invite/[token]`
- Token expiry: 7 days

### Password in settings
- Add "Αλλαγή κωδικού" section: current password + new password (8+ chars) + confirm
- `user.changePassword` mutation: bcrypt verify current, hash new, update

---

## SP6 — Stripe Billing

### Architecture
- Stripe Checkout for new subscriptions (hosted payment page)
- Stripe Customer Portal for subscription management (cancel, upgrade, billing history)
- Webhooks handle subscription state changes

### Plans (match existing `Plan` model in DB)

| Plan | Price | Countries | Users | AI Credits |
|------|-------|-----------|-------|------------|
| Starter | €49/μήνα | 1 | 3 | 100 |
| Professional | €99/μήνα | 2 | 10 | 500 |
| Enterprise | €249/μήνα | 5 | unlimited | 2000 |

### New routes
- `/pricing` — public pricing page (accessible without login)
- `/billing` — authenticated billing management page
- `/api/stripe/webhook` — Stripe webhook handler
- `/api/stripe/create-checkout` — creates Stripe Checkout session
- `/api/stripe/create-portal` — creates Customer Portal session

### Environment variables needed
```
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_STARTER=price_xxx
STRIPE_PRICE_PRO=price_xxx
STRIPE_PRICE_ENTERPRISE=price_xxx
```

### Upgrade prompts
- When user hits plan limit (countries, users, AI credits): modal with plan comparison + "Αναβάθμιση" CTA
- `UsageIndicator` in top nav already shows % — add "Αναβάθμιση" button when >80%
- Trial ending badge → add "Αναβάθμιση πριν λήξει" CTA

### Webhook events handled
- `checkout.session.completed` → activate subscription
- `customer.subscription.updated` → update plan/status in DB
- `customer.subscription.deleted` → mark as CANCELLED
- `invoice.payment_failed` → mark as PAST_DUE, notify user

---

## Implementation Order

1. **SP1** — Missing pages (unblocks invite flow)
2. **SP2** — Email infrastructure (enables SP5 invites + SP3 welcome email)
3. **SP5** — Settings fixes (profile save + invite wired to email)
4. **SP3** — Onboarding wizard
5. **SP4** — Notifications center
6. **SP6** — Stripe billing

---

## Testing Strategy

- Unit tests: email service (mock Resend SDK), notification creation helpers
- E2E (Playwright): onboarding wizard flow, invite acceptance flow, forgot-password flow
- Manual: Stripe checkout in test mode before going live
