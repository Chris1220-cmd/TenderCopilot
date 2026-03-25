# Clarification Monitoring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add hybrid clarification monitoring with manual entry, smart escalating reminders, and unread alerts across dashboard + tender detail.

**Architecture:** Extend existing `ClarificationQuestion` model with 4 new fields (source, publishedAt, sourceUrl, isRead). Add `lastClarificationCheckAt` to Tender. New procedures in `ai-roles.ts` router. New published clarifications section in LegalTab, alert banner in overview, reminder widget on dashboard.

**Tech Stack:** tRPC, Prisma (PostgreSQL), React, motion/react, Lucide icons, existing Shadcn + GlassCard components

**Spec:** `docs/superpowers/specs/2026-03-25-clarification-monitoring-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/components/dashboard/clarification-reminders-widget.tsx` | Dashboard widget showing tenders needing clarification check |
| `src/components/tender/published-clarifications.tsx` | Published clarifications section for LegalTab |

### Modified Files

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add 4 fields to ClarificationQuestion + 1 field to Tender |
| `src/server/routers/ai-roles.ts` | Add 6 new procedures + filter existing getLegalClauses |
| `src/components/tender/legal-tab.tsx` | Import and render PublishedClarifications section |
| `src/app/(dashboard)/tenders/[id]/page.tsx` | Add unread badge on Legal tab + alert banner in overview |
| `src/app/(dashboard)/dashboard/page.tsx` | Render ClarificationRemindersWidget |
| `messages/el.json` | Add `clarifications.*` i18n keys |
| `messages/en.json` | Add `clarifications.*` i18n keys |

---

## Task 1: Prisma Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add new fields to ClarificationQuestion**

Find the `ClarificationQuestion` model (line ~708) and add after `updatedAt`:

```prisma
model ClarificationQuestion {
  id           String              @id @default(cuid())
  questionText String              @db.Text
  answerText   String?             @db.Text
  status       ClarificationStatus @default(DRAFT)
  priority     Int                 @default(0)

  tenderId String
  tender   Tender @relation(fields: [tenderId], references: [id], onDelete: Cascade)
  clauseId String?
  clause   LegalClause? @relation(fields: [clauseId], references: [id], onDelete: SetNull)

  // Clarification Monitoring (Feature 3)
  source      String    @default("AI_GENERATED") // "AI_GENERATED" | "AUTHORITY_PUBLISHED"
  publishedAt DateTime?
  sourceUrl   String?
  isRead      Boolean   @default(false)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

- [ ] **Step 2: Add lastClarificationCheckAt to Tender**

Find the `Tender` model. Add before `createdAt`:

```prisma
  // Clarification Monitoring
  lastClarificationCheckAt DateTime?
```

- [ ] **Step 3: Run migration**

```bash
npx prisma migrate dev --name add-clarification-monitoring-fields
```

- [ ] **Step 4: Generate client and verify**

```bash
npx prisma generate
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add prisma/
git commit -m "feat(clarifications): add monitoring fields to schema"
```

---

## Task 2: i18n Keys

**Files:**
- Modify: `messages/el.json`
- Modify: `messages/en.json`

- [ ] **Step 1: Add Greek keys**

Add to `messages/el.json` (inside the top-level object, after the `certs` block):

```json
"clarifications": {
  "publishedTitle": "Δημοσιευμένες Διευκρινίσεις",
  "addNew": "Προσθήκη",
  "markChecked": "Έλεγξα για νέες",
  "lastChecked": "Τελευταίος έλεγχος: {{date}}",
  "questionLabel": "Ερώτηση",
  "answerLabel": "Απάντηση",
  "publishedAt": "Δημοσιεύτηκε {{date}}",
  "sourceLink": "Πηγή",
  "aiAnalysis": "Ανάλυση AI",
  "comingSoon": "Σύντομα διαθέσιμο",
  "noPublished": "Δεν υπάρχουν δημοσιευμένες διευκρινίσεις",
  "checkPortal": "Ελέγξτε το ΕΣΗΔΗΣ για νέες",
  "newUnread": "{{count}} νέες διευκρινίσεις",
  "seeInLegal": "Δες τες στο tab Νομικά",
  "remindersTitle": "Έλεγχος Διευκρινίσεων",
  "allChecked": "Όλοι οι διαγωνισμοί είναι ενήμεροι",
  "daysSinceCheck": "{{days}} ημ. από τελευταίο έλεγχο",
  "checkedNow": "Σημειώθηκε ως ελεγμένο",
  "publishedDate": "Ημ. Δημοσίευσης",
  "sourceLinkPlaceholder": "https://portal.eprocurement.gov.gr/...",
  "questionPlaceholder": "Η ερώτηση που υποβλήθηκε...",
  "answerPlaceholder": "Η απάντηση της αναθέτουσας..."
}
```

- [ ] **Step 2: Add English keys**

Add to `messages/en.json`:

```json
"clarifications": {
  "publishedTitle": "Published Clarifications",
  "addNew": "Add",
  "markChecked": "Checked for new",
  "lastChecked": "Last checked: {{date}}",
  "questionLabel": "Question",
  "answerLabel": "Answer",
  "publishedAt": "Published {{date}}",
  "sourceLink": "Source",
  "aiAnalysis": "AI Analysis",
  "comingSoon": "Coming soon",
  "noPublished": "No published clarifications",
  "checkPortal": "Check ESIDIS for new ones",
  "newUnread": "{{count}} new clarifications",
  "seeInLegal": "See them in Legal tab",
  "remindersTitle": "Clarification Checks",
  "allChecked": "All tenders are up to date",
  "daysSinceCheck": "{{days}} days since last check",
  "checkedNow": "Marked as checked",
  "publishedDate": "Published Date",
  "sourceLinkPlaceholder": "https://portal.eprocurement.gov.gr/...",
  "questionPlaceholder": "The question submitted...",
  "answerPlaceholder": "The authority's answer..."
}
```

- [ ] **Step 3: Verify and commit**

```bash
npx tsc --noEmit
git add messages/el.json messages/en.json
git commit -m "feat(clarifications): add i18n keys for monitoring UI"
```

---

## Task 3: Backend Procedures

**Files:**
- Modify: `src/server/routers/ai-roles.ts`

- [ ] **Step 1: Filter getLegalClauses to exclude published clarifications**

Find `getLegalClauses` (line ~75). Change the clarifications query from:

```typescript
const clarifications = await db.clarificationQuestion.findMany({
  where: { tenderId: input.tenderId },
  orderBy: { createdAt: 'asc' },
});
```

To:

```typescript
const clarifications = await db.clarificationQuestion.findMany({
  where: { tenderId: input.tenderId, source: 'AI_GENERATED' },
  orderBy: { createdAt: 'asc' },
});
```

- [ ] **Step 2: Add addPublishedClarification mutation**

Add after `approveClarification` (line ~248):

```typescript
addPublishedClarification: protectedProcedure
  .input(z.object({
    tenderId: z.string(),
    questionText: z.string().min(1),
    answerText: z.string().min(1),
    publishedAt: z.string(),
    sourceUrl: z.string().optional(),
  }))
  .mutation(async ({ ctx, input }) => {
    const { tenantId } = await ensureTenderAccess(input.tenderId, ctx.tenantId);

    const clarification = await db.clarificationQuestion.create({
      data: {
        tenderId: input.tenderId,
        questionText: input.questionText,
        answerText: input.answerText,
        status: 'ANSWERED',
        source: 'AUTHORITY_PUBLISHED',
        publishedAt: new Date(input.publishedAt),
        sourceUrl: input.sourceUrl || null,
        isRead: false,
      },
    });

    // Create alert for unread clarification
    await db.tenderAlert.create({
      data: {
        tenderId: input.tenderId,
        tenantId,
        type: 'CLARIFICATION_NEW_UNREAD',
        severity: 'MEDIUM',
        title: 'Νέα δημοσιευμένη διευκρίνιση',
        detail: input.questionText.slice(0, 200),
        source: 'clarification-monitor',
      },
    });

    return clarification;
  }),
```

- [ ] **Step 3: Add listPublishedClarifications query**

```typescript
listPublishedClarifications: protectedProcedure
  .input(z.object({ tenderId: z.string() }))
  .query(async ({ ctx, input }) => {
    await ensureTenderAccess(input.tenderId, ctx.tenantId);
    return db.clarificationQuestion.findMany({
      where: { tenderId: input.tenderId, source: 'AUTHORITY_PUBLISHED' },
      orderBy: { publishedAt: 'desc' },
    });
  }),
```

- [ ] **Step 4: Add markClarificationRead mutation**

```typescript
markClarificationRead: protectedProcedure
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
    const clarification = await db.clarificationQuestion.findUnique({
      where: { id: input.id },
      select: { tenderId: true },
    });
    if (!clarification) throw new TRPCError({ code: 'NOT_FOUND', message: 'Clarification not found.' });
    await ensureTenderAccess(clarification.tenderId, ctx.tenantId);

    return db.clarificationQuestion.update({
      where: { id: input.id },
      data: { isRead: true },
    });
  }),
```

- [ ] **Step 5: Add markClarificationsChecked mutation**

```typescript
markClarificationsChecked: protectedProcedure
  .input(z.object({ tenderId: z.string() }))
  .mutation(async ({ ctx, input }) => {
    await ensureTenderAccess(input.tenderId, ctx.tenantId);
    return db.tender.update({
      where: { id: input.tenderId },
      data: { lastClarificationCheckAt: new Date() },
    });
  }),
```

- [ ] **Step 6: Add getUnreadCount query**

```typescript
getUnreadClarificationCount: protectedProcedure
  .input(z.object({ tenderId: z.string() }))
  .query(async ({ ctx, input }) => {
    await ensureTenderAccess(input.tenderId, ctx.tenantId);
    const count = await db.clarificationQuestion.count({
      where: {
        tenderId: input.tenderId,
        source: 'AUTHORITY_PUBLISHED',
        isRead: false,
      },
    });
    return { count };
  }),
```

- [ ] **Step 7: Add getClarificationReminders query**

```typescript
getClarificationReminders: protectedProcedure
  .query(async ({ ctx }) => {
    if (!ctx.tenantId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant.' });

    const now = new Date();
    const tenders = await db.tender.findMany({
      where: {
        tenantId: ctx.tenantId,
        status: { in: ['GO_NO_GO', 'IN_PROGRESS'] },
        submissionDeadline: { gt: now },
      },
      select: {
        id: true,
        title: true,
        submissionDeadline: true,
        lastClarificationCheckAt: true,
        createdAt: true,
        notes: true,
      },
    });

    return tenders
      .map((t) => {
        const deadline = t.submissionDeadline!;
        const daysToDeadline = Math.ceil((deadline.getTime() - now.getTime()) / 86400000);
        const interval = daysToDeadline > 14 ? 5 : daysToDeadline > 7 ? 2 : 1;
        const lastCheck = t.lastClarificationCheckAt || t.createdAt;
        const daysSinceCheck = Math.floor((now.getTime() - lastCheck.getTime()) / 86400000);
        const needsReminder = daysSinceCheck >= interval;

        if (!needsReminder) return null;

        const ratio = daysSinceCheck / interval;
        const urgency = ratio >= 2 ? 'critical' as const : ratio >= 1.5 ? 'warning' as const : 'normal' as const;

        const platformUrl = t.notes?.match(/Imported from: (https?:\/\/\S+)/)?.[1] ?? null;

        return {
          tenderId: t.id,
          tenderTitle: t.title,
          daysToDeadline,
          daysSinceCheck,
          interval,
          urgency,
          platformUrl,
        };
      })
      .filter(Boolean);
  }),
```

- [ ] **Step 8: Verify and commit**

```bash
npx tsc --noEmit
git add src/server/routers/ai-roles.ts
git commit -m "feat(clarifications): add monitoring procedures to ai-roles router"
```

---

## Task 4: Published Clarifications Component

**Files:**
- Create: `src/components/tender/published-clarifications.tsx`

- [ ] **Step 1: Create the component**

```typescript
'use client';

import { useState } from 'react';
import { cn, formatDate } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  GlassCard,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardDescription,
  GlassCardContent,
} from '@/components/ui/glass-card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  MessageSquare,
  Plus,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Inbox,
  Clock,
  Sparkles,
} from 'lucide-react';

interface PublishedClarificationsProps {
  tenderId: string;
}

export function PublishedClarifications({ tenderId }: PublishedClarificationsProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [questionText, setQuestionText] = useState('');
  const [answerText, setAnswerText] = useState('');
  const [publishedAt, setPublishedAt] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');

  const listQuery = trpc.aiRoles.listPublishedClarifications.useQuery(
    { tenderId },
    { retry: false, refetchOnWindowFocus: false }
  );

  const addMutation = trpc.aiRoles.addPublishedClarification.useMutation({
    onSuccess: () => {
      toast({ title: t('common.success'), description: t('clarifications.checkedNow') });
      listQuery.refetch();
      closeDialog();
    },
    onError: (err) => {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    },
  });

  const markReadMutation = trpc.aiRoles.markClarificationRead.useMutation({
    onSuccess: () => listQuery.refetch(),
  });

  const tenderQuery = trpc.tender.get.useQuery({ id: tenderId }, { retry: false });
  const lastCheckedAt = (tenderQuery.data as any)?.lastClarificationCheckAt;

  const markCheckedMutation = trpc.aiRoles.markClarificationsChecked.useMutation({
    onSuccess: () => {
      toast({ title: t('clarifications.checkedNow') });
      tenderQuery.refetch();
    },
  });

  const clarifications = (listQuery.data ?? []) as any[];

  function closeDialog() {
    setDialogOpen(false);
    setQuestionText('');
    setAnswerText('');
    setPublishedAt('');
    setSourceUrl('');
  }

  function handleSubmit() {
    if (!questionText || !answerText || !publishedAt) return;
    addMutation.mutate({
      tenderId,
      questionText,
      answerText,
      publishedAt,
      sourceUrl: sourceUrl || undefined,
    });
  }

  function handleMarkRead(id: string) {
    markReadMutation.mutate({ id });
  }

  return (
    <>
      <GlassCard>
        <GlassCardHeader>
          <GlassCardTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            {t('clarifications.publishedTitle')}
            {clarifications.filter((c: any) => !c.isRead).length > 0 && (
              <Badge variant="destructive" className="text-[10px] h-5 min-w-5 flex items-center justify-center">
                {clarifications.filter((c: any) => !c.isRead).length}
              </Badge>
            )}
          </GlassCardTitle>
          <GlassCardDescription className="flex items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDialogOpen(true)}
              className="cursor-pointer h-7 text-xs gap-1"
            >
              <Plus className="h-3 w-3" />
              {t('clarifications.addNew')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => markCheckedMutation.mutate({ tenderId })}
              disabled={markCheckedMutation.isPending}
              className="cursor-pointer h-7 text-xs gap-1"
            >
              {markCheckedMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3 w-3" />
              )}
              {t('clarifications.markChecked')}
            </Button>
            {lastCheckedAt && (
              <span className="text-[10px] text-muted-foreground">
                {t('clarifications.lastChecked').replace('{{date}}', formatDate(lastCheckedAt))}
              </span>
            )}
          </GlassCardDescription>
        </GlassCardHeader>
        <GlassCardContent>
          {clarifications.length === 0 ? (
            <div className="text-center py-8">
              <Inbox className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-xs text-muted-foreground">{t('clarifications.noPublished')}</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">{t('clarifications.checkPortal')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {clarifications.map((cl: any) => (
                <div
                  key={cl.id}
                  onClick={() => !cl.isRead && handleMarkRead(cl.id)}
                  className={cn(
                    'rounded-xl border p-4 transition-all duration-200 cursor-pointer',
                    'bg-white/40 dark:bg-white/[0.03]',
                    cl.isRead
                      ? 'border-white/30 dark:border-white/10'
                      : 'border-primary/30 dark:border-primary/20 bg-primary/[0.03]'
                  )}
                >
                  {/* Unread indicator */}
                  <div className="flex items-start gap-3">
                    {!cl.isRead && (
                      <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                    )}
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Question */}
                      <div>
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                          {t('clarifications.questionLabel')}
                        </span>
                        <p className="text-xs text-foreground leading-relaxed mt-0.5">
                          {cl.questionText}
                        </p>
                      </div>
                      {/* Answer */}
                      <div>
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                          {t('clarifications.answerLabel')}
                        </span>
                        <p className="text-xs text-foreground leading-relaxed mt-0.5">
                          {cl.answerText}
                        </p>
                      </div>
                      {/* Footer */}
                      <div className="flex items-center gap-3 pt-1">
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {t('clarifications.publishedAt').replace('{{date}}', formatDate(cl.publishedAt))}
                        </span>
                        {cl.sourceUrl && (
                          <a
                            href={cl.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[10px] text-primary hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <ExternalLink className="h-3 w-3" />
                            {t('clarifications.sourceLink')}
                          </a>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled
                          className="h-6 text-[10px] gap-1 ml-auto opacity-50"
                          title={t('clarifications.comingSoon')}
                        >
                          <Sparkles className="h-3 w-3" />
                          {t('clarifications.aiAnalysis')}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCardContent>
      </GlassCard>

      {/* Add Clarification Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[520px] border-white/10 bg-gradient-to-br from-card to-card/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle>{t('clarifications.addNew')}</DialogTitle>
            <DialogDescription>{t('clarifications.publishedTitle')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('clarifications.questionLabel')}</Label>
              <Textarea
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                placeholder={t('clarifications.questionPlaceholder')}
                className="min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('clarifications.answerLabel')}</Label>
              <Textarea
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                placeholder={t('clarifications.answerPlaceholder')}
                className="min-h-[80px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('clarifications.publishedDate')}</Label>
                <Input
                  type="date"
                  value={publishedAt}
                  onChange={(e) => setPublishedAt(e.target.value)}
                  className="cursor-pointer"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('clarifications.sourceLink')}</Label>
                <Input
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder={t('clarifications.sourceLinkPlaceholder')}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} className="cursor-pointer">
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!questionText || !answerText || !publishedAt || addMutation.isPending}
              className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 border-0"
            >
              {addMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/tender/published-clarifications.tsx
git commit -m "feat(clarifications): add published clarifications component"
```

---

## Task 5: Integrate into LegalTab

**Files:**
- Modify: `src/components/tender/legal-tab.tsx`

- [ ] **Step 1: Import PublishedClarifications**

Add import at top of file:

```typescript
import { PublishedClarifications } from './published-clarifications';
```

- [ ] **Step 2: Render after existing Clarifications section**

Find the closing `</GlassCard>` after the "Προτεινόμενες Διευκρινίσεις" section (line ~632). Add right after it:

```tsx
      {/* Published Clarifications (Feature 3) */}
      <BlurFade delay={0.2} inView>
        <PublishedClarifications tenderId={tenderId} />
      </BlurFade>
```

- [ ] **Step 3: Verify and commit**

```bash
npx tsc --noEmit
git add src/components/tender/legal-tab.tsx
git commit -m "feat(clarifications): integrate published section into LegalTab"
```

---

## Task 6: Unread Badge on Legal Tab + Overview Alert Banner

**Files:**
- Modify: `src/app/(dashboard)/tenders/[id]/page.tsx`

- [ ] **Step 1: Add unread count query**

Inside the `TenderDetailPage` component, add after existing queries:

```typescript
const unreadClarifications = trpc.aiRoles.getUnreadClarificationCount.useQuery(
  { tenderId },
  { retry: false, refetchOnWindowFocus: false }
);
const unreadCount = unreadClarifications.data?.count ?? 0;
```

- [ ] **Step 2: Add badge to Legal tab trigger**

Find the Legal tab trigger (line ~380):

```tsx
<AnimatedTabsTrigger value="legal" activeValue={activeTab}><Scale className="h-3.5 w-3.5" />{t('tender.legalTab')}</AnimatedTabsTrigger>
```

Replace with:

```tsx
<AnimatedTabsTrigger value="legal" activeValue={activeTab}>
  <Scale className="h-3.5 w-3.5" />
  {t('tender.legalTab')}
  {unreadCount > 0 && (
    <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
      {unreadCount}
    </span>
  )}
</AnimatedTabsTrigger>
```

- [ ] **Step 3: Add alert banner in overview tab**

Find the overview TabsContent (line ~396). Inside the `<div className="space-y-6">`, add before the grid with AIBriefPanel:

```tsx
{unreadCount > 0 && (
  <div
    onClick={() => setActiveTab('legal')}
    className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm cursor-pointer hover:bg-amber-500/15 transition-colors"
  >
    <MessageSquare className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
    <span className="text-amber-700 dark:text-amber-300">
      {t('clarifications.newUnread').replace('{{count}}', String(unreadCount))} — {t('clarifications.seeInLegal')}
    </span>
  </div>
)}
```

Don't forget to add `MessageSquare` to the lucide-react imports at the top of the file.

- [ ] **Step 4: Verify and commit**

```bash
npx tsc --noEmit
git add src/app/\(dashboard\)/tenders/\[id\]/page.tsx
git commit -m "feat(clarifications): add unread badge on Legal tab + overview alert banner"
```

---

## Task 7: Dashboard Reminders Widget

**Files:**
- Create: `src/components/dashboard/clarification-reminders-widget.tsx`
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Create the widget**

```typescript
'use client';

import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/components/ui/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock, ExternalLink, Loader2, ArrowRight } from 'lucide-react';
import Link from 'next/link';

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const },
  },
};

export function ClarificationRemindersWidget() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data, isLoading } = trpc.aiRoles.getClarificationReminders.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const utils = trpc.useUtils();

  const markCheckedMutation = trpc.aiRoles.markClarificationsChecked.useMutation({
    onSuccess: () => {
      toast({ title: t('clarifications.checkedNow') });
      utils.aiRoles.getClarificationReminders.invalidate();
    },
  });

  const reminders = (data ?? []) as any[];

  return (
    <motion.div variants={itemVariants} className="lg:col-span-3">
      <div className="group rounded-xl border border-border/60 bg-card transition-colors hover:border-primary/20">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4">
          <h2 className="text-title text-foreground">{t('clarifications.remindersTitle')}</h2>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </div>

        {/* Body */}
        <div className="border-t border-border/40">
          {isLoading ? (
            <div className="space-y-1 p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : reminders.length === 0 ? (
            <div className="py-10 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500 mb-2" />
              <p className="text-body text-muted-foreground">{t('clarifications.allChecked')}</p>
            </div>
          ) : (
            <div>
              {reminders.map((r: any) => (
                <div
                  key={r.tenderId}
                  className="flex items-center gap-3 px-6 py-3.5 border-b border-border/30 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/tenders/${r.tenderId}?tab=legal`}
                      className="text-body font-medium text-foreground truncate hover:text-primary transition-colors cursor-pointer block"
                    >
                      {r.tenderTitle}
                    </Link>
                    <span className="text-[10px] text-muted-foreground">
                      {t('clarifications.daysSinceCheck').replace('{{days}}', String(r.daysSinceCheck))}
                    </span>
                  </div>
                  <span
                    className={cn(
                      'text-[12px] font-semibold tabular-nums shrink-0',
                      r.urgency === 'critical' ? 'text-[#ef4444]' :
                      r.urgency === 'warning' ? 'text-[#f59e0b]' :
                      'text-muted-foreground'
                    )}
                  >
                    {r.daysToDeadline}d
                  </span>
                  {r.platformUrl && (
                    <a
                      href={r.platformUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cursor-pointer shrink-0 text-muted-foreground hover:text-primary transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => markCheckedMutation.mutate({ tenderId: r.tenderId })}
                    disabled={markCheckedMutation.isPending}
                    className="cursor-pointer h-7 text-xs shrink-0"
                  >
                    {markCheckedMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Add to dashboard page**

In `src/app/(dashboard)/dashboard/page.tsx`, add import:

```typescript
import { ClarificationRemindersWidget } from '@/components/dashboard/clarification-reminders-widget';
```

Find the BlurFade block that contains `<ExpiringCertsWidget />` (line ~333). Change it to include both widgets side by side:

```tsx
{/* Expiring Certificates + Clarification Reminders */}
<BlurFade delay={0.25} inView>
  <div className="grid gap-6 lg:grid-cols-5">
    <ExpiringCertsWidget />
    <ClarificationRemindersWidget />
  </div>
</BlurFade>
```

- [ ] **Step 3: Verify and commit**

```bash
npx tsc --noEmit
git add src/components/dashboard/clarification-reminders-widget.tsx src/app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat(clarifications): add reminders widget to dashboard"
```

---

## Task 8: Build Verification

- [ ] **Step 1: Full build**

```bash
npm run build
```

- [ ] **Step 2: Fix any errors**

Address any build errors that come up.

- [ ] **Step 3: Final commit if fixes needed**

```bash
git add -A
git commit -m "fix(clarifications): build fixes"
```
