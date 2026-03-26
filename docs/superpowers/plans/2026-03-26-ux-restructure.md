# UX Restructure — Phase-Grouped Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 11 horizontal tabs on the tender detail page with a phase-grouped left sidebar showing progress per section.

**Architecture:** Extract the TabsList into a new `TenderPhaseSidebar` component. The `Tabs` root and all `TabsContent` components stay exactly the same — we only change the navigation UI. Add a `getSectionStatuses` tRPC endpoint for auto-detection. Add deadline countdown to the persistent header.

**Tech Stack:** React, tRPC, Tailwind CSS, motion/react, Lucide icons, Radix UI Tabs (kept for TabsContent), Sheet (for mobile drawer).

**Spec:** `docs/superpowers/specs/2026-03-26-ux-restructure-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/components/tender/tender-phase-sidebar.tsx` | Create | Phase-grouped sidebar with status icons |
| `src/components/tender/section-status-icon.tsx` | Create | Status icon component (not_started/in_progress/complete/has_issues) |
| `src/server/routers/tender.ts` | Modify | Add getSectionStatuses endpoint |
| `src/app/(dashboard)/tenders/[id]/page.tsx` | Modify | Replace TabsList with sidebar layout |
| `messages/el.json` | Modify | Phase names + sidebar keys |
| `messages/en.json` | Modify | Phase names + sidebar keys |

---

## Task 1: i18n — Add phase and sidebar translations

**Files:**
- Modify: `messages/el.json`
- Modify: `messages/en.json`

- [ ] **Step 1: Add Greek translations**

Add inside the `"tender"` object in `messages/el.json`:

```json
"phase": {
  "understand": "Κατανόηση",
  "prepare": "Προετοιμασία",
  "assemble": "Συλλογή",
  "submit": "Υποβολή"
},
"sidebar": {
  "progress": "{{count}}/11 ολοκληρωμένα",
  "toggle": "Πλοήγηση φακέλου"
},
"deadlineCountdown": {
  "days": "{{count}} ημέρες",
  "oneDay": "1 ημέρα",
  "today": "ΣΗΜΕΡΑ",
  "expired": "ΕΛΗΞΕ"
}
```

- [ ] **Step 2: Add English translations**

Add inside the `"tender"` object in `messages/en.json`:

```json
"phase": {
  "understand": "Understand",
  "prepare": "Prepare",
  "assemble": "Assemble",
  "submit": "Submit"
},
"sidebar": {
  "progress": "{{count}}/11 complete",
  "toggle": "Dossier navigation"
},
"deadlineCountdown": {
  "days": "{{count}} days",
  "oneDay": "1 day",
  "today": "TODAY",
  "expired": "EXPIRED"
}
```

- [ ] **Step 3: Commit**

```bash
git add messages/
git commit -m "feat(ux): add i18n translations for phase sidebar"
```

---

## Task 2: Section Status Icon Component

**Files:**
- Create: `src/components/tender/section-status-icon.tsx`

- [ ] **Step 1: Create the component**

```typescript
'use client';

import { cn } from '@/lib/utils';
import { Circle, CircleDot, CheckCircle2, AlertTriangle } from 'lucide-react';

export type SectionStatus = 'not_started' | 'in_progress' | 'complete' | 'has_issues';

const statusConfig: Record<SectionStatus, { icon: typeof Circle; className: string }> = {
  not_started: { icon: Circle, className: 'text-muted-foreground/40' },
  in_progress: { icon: CircleDot, className: 'text-[#f59e0b]' },
  complete: { icon: CheckCircle2, className: 'text-emerald-500' },
  has_issues: { icon: AlertTriangle, className: 'text-[#ef4444]' },
};

export function SectionStatusIcon({
  status,
  className,
}: {
  status: SectionStatus;
  className?: string;
}) {
  const config = statusConfig[status];
  const Icon = config.icon;
  return <Icon className={cn('h-4 w-4 shrink-0', config.className, className)} />;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/tender/section-status-icon.tsx
git commit -m "feat(ux): add section status icon component"
```

---

## Task 3: tRPC — getSectionStatuses endpoint

**Files:**
- Modify: `src/server/routers/tender.ts`

- [ ] **Step 1: Add the endpoint**

Add to the tender router, after the existing procedures:

```typescript
  getSectionStatuses: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      const tender = await ctx.db.tender.findUnique({
        where: { id: input.id },
        include: {
          brief: true,
          goNoGoDecision: true,
          requirements: { select: { id: true, coverageStatus: true } },
          evaluationCriteria: { select: { id: true, status: true } },
          legalClauses: { select: { id: true } },
          clarifications: { where: { source: 'AUTHORITY_PUBLISHED', isRead: false }, select: { id: true } },
          technicalSections: { select: { id: true, status: true } },
          pricingScenarios: { select: { id: true, isSelected: true } },
          generatedDocuments: { select: { id: true } },
          tasks: { select: { id: true, status: true, dueDate: true } },
          deadlinePlanItems: { select: { id: true, status: true, isMandatory: true } },
          _count: { select: { activities: true } },
        },
      });

      if (!tender || tender.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Tender not found.' });
      }

      type S = 'not_started' | 'in_progress' | 'complete' | 'has_issues';
      const now = new Date();

      // Overview
      const hasBrief = !!tender.brief;
      const hasGoNoGo = !!tender.goNoGoDecision;
      const overview: S = hasBrief && hasGoNoGo ? 'complete' : hasBrief || hasGoNoGo ? 'in_progress' : 'not_started';

      // Requirements
      const reqCount = tender.requirements.length;
      const coveredReqs = tender.requirements.filter((r) => r.coverageStatus === 'COVERED').length;
      const requirements: S = reqCount === 0 ? 'not_started' : coveredReqs > 0 ? (coveredReqs === reqCount ? 'complete' : 'in_progress') : 'in_progress';

      // Criteria
      const criteriaCount = tender.evaluationCriteria.length;
      const finalCriteria = tender.evaluationCriteria.filter((c) => c.status === 'FINAL').length;
      const criteria: S = criteriaCount === 0 ? 'not_started' : finalCriteria === criteriaCount ? 'complete' : 'in_progress';

      // Legal
      const hasUnread = tender.clarifications.length > 0;
      const hasClauses = tender.legalClauses.length > 0;
      const legal: S = hasUnread ? 'has_issues' : hasClauses ? 'complete' : 'not_started';

      // Technical
      const techCount = tender.technicalSections.length;
      const approvedTech = tender.technicalSections.filter((s) => s.status === 'APPROVED').length;
      const technical: S = techCount === 0 ? 'not_started' : approvedTech === techCount ? 'complete' : 'in_progress';

      // Financial
      const hasScenarios = tender.pricingScenarios.length > 0;
      const hasSelected = tender.pricingScenarios.some((s) => s.isSelected);
      const financial: S = !hasScenarios ? 'not_started' : hasSelected ? 'complete' : 'in_progress';

      // Documents
      const docCount = tender.generatedDocuments.length;
      const documents: S = docCount === 0 ? 'not_started' : docCount >= 2 ? 'complete' : 'in_progress';

      // Fakelos — use fakelosReport JSON
      const fakelosReport = tender.fakelosReport as any;
      const fakelosScore = fakelosReport?.score ?? 0;
      const fakelos: S = fakelosScore >= 80 ? 'complete' : fakelosScore > 0 ? 'in_progress' : 'not_started';

      // Tasks
      const taskCount = tender.tasks.length;
      const doneTasks = tender.tasks.filter((t) => t.status === 'DONE').length;
      const overdueTasks = tender.tasks.filter((t) => t.status !== 'DONE' && t.dueDate && t.dueDate < now).length;
      const tasks: S = taskCount === 0 ? 'not_started' : overdueTasks > 0 ? 'has_issues' : doneTasks === taskCount ? 'complete' : 'in_progress';

      // Deadline
      const dlItems = tender.deadlinePlanItems;
      const mandatoryItems = dlItems.filter((d) => d.isMandatory);
      const obtainedMandatory = mandatoryItems.filter((d) => d.status === 'OBTAINED').length;
      const overdueItems = dlItems.filter((d) => d.status !== 'OBTAINED' && d.status === 'OVERDUE').length;
      const deadline: S = dlItems.length === 0 ? 'not_started' : overdueItems > 0 ? 'has_issues' : (mandatoryItems.length > 0 && obtainedMandatory === mandatoryItems.length) ? 'complete' : 'in_progress';

      // Activity — always complete (read-only log)
      const activity: S = 'complete';

      return {
        overview, requirements, criteria, legal, technical, financial,
        documents, fakelos, tasks, deadline, activity,
      };
    }),
```

- [ ] **Step 2: Verify build**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/server/routers/tender.ts
git commit -m "feat(ux): add getSectionStatuses endpoint for auto-detection"
```

---

## Task 4: Tender Phase Sidebar Component

**Files:**
- Create: `src/components/tender/tender-phase-sidebar.tsx`

- [ ] **Step 1: Create the sidebar component**

```typescript
'use client';

import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n';
import { motion } from 'motion/react';
import {
  Eye, ClipboardList, Award, Scale, Wrench, Banknote,
  FileText, FolderCheck, ListTodo, CalendarClock, Activity,
  PanelLeftClose, PanelLeft,
} from 'lucide-react';
import { SectionStatusIcon, type SectionStatus } from './section-status-icon';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

type Phase = {
  labelKey: string;
  sections: {
    value: string;
    labelKey: string;
    icon: typeof Eye;
  }[];
};

const phases: Phase[] = [
  {
    labelKey: 'tender.phase.understand',
    sections: [
      { value: 'overview', labelKey: 'tender.overviewTab', icon: Eye },
      { value: 'requirements', labelKey: 'tender.requirementsTab', icon: ClipboardList },
      { value: 'criteria', labelKey: 'tender.criteriaTab', icon: Award },
    ],
  },
  {
    labelKey: 'tender.phase.prepare',
    sections: [
      { value: 'legal', labelKey: 'tender.legalTab', icon: Scale },
      { value: 'technical', labelKey: 'tender.technicalTab', icon: Wrench },
      { value: 'financial', labelKey: 'tender.financialTab', icon: Banknote },
    ],
  },
  {
    labelKey: 'tender.phase.assemble',
    sections: [
      { value: 'documents', labelKey: 'tender.documentsTab', icon: FileText },
      { value: 'fakelos', labelKey: 'tender.dossierTab', icon: FolderCheck },
      { value: 'tasks', labelKey: 'tender.tasksTab', icon: ListTodo },
    ],
  },
  {
    labelKey: 'tender.phase.submit',
    sections: [
      { value: 'deadline', labelKey: 'deadline.tab', icon: CalendarClock },
      { value: 'activity', labelKey: 'tender.activityTab', icon: Activity },
    ],
  },
];

export function TenderPhaseSidebar({
  activeSection,
  onSectionChange,
  statuses,
  unreadClarifications,
}: {
  activeSection: string;
  onSectionChange: (section: string) => void;
  statuses: Record<string, SectionStatus>;
  unreadClarifications: number;
}) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);

  const completedCount = Object.values(statuses).filter((s) => s === 'complete').length;

  return (
    <div
      className={cn(
        'shrink-0 border-r border-border/40 bg-card/50 flex flex-col transition-all duration-200',
        collapsed ? 'w-14' : 'w-[220px]'
      )}
    >
      {/* Collapse toggle */}
      <div className="flex items-center justify-end px-2 pt-3 pb-1">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 cursor-pointer"
          onClick={() => setCollapsed(!collapsed)}
          title={t('tender.sidebar.toggle')}
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>

      {/* Phase groups */}
      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        {phases.map((phase, pi) => (
          <div key={pi} className="mb-3">
            {!collapsed && (
              <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                {t(phase.labelKey)}
              </div>
            )}
            {phase.sections.map((section) => {
              const isActive = activeSection === section.value;
              const status = statuses[section.value] ?? 'not_started';
              const Icon = section.icon;

              return (
                <button
                  key={section.value}
                  onClick={() => onSectionChange(section.value)}
                  className={cn(
                    'w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors cursor-pointer',
                    isActive
                      ? 'bg-muted/60 text-foreground border-l-2 border-[#48A4D6] -ml-[2px] pl-[calc(0.625rem+2px)]'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/30',
                    collapsed && 'justify-center px-0'
                  )}
                  title={collapsed ? t(section.labelKey) : undefined}
                >
                  <SectionStatusIcon status={status} />
                  {!collapsed && (
                    <span className="flex-1 text-left truncate text-[13px]">
                      {t(section.labelKey)}
                    </span>
                  )}
                  {!collapsed && section.value === 'legal' && unreadClarifications > 0 && (
                    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                      {unreadClarifications}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Progress bar */}
      {!collapsed && (
        <div className="px-3 pb-4">
          <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${(completedCount / 11) * 100}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
            {t('tender.sidebar.progress').replace('{{count}}', String(completedCount))}
          </p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/tender/tender-phase-sidebar.tsx
git commit -m "feat(ux): add phase-grouped sidebar component"
```

---

## Task 5: Modify Tender Detail Page — Replace Tabs with Sidebar Layout

**Files:**
- Modify: `src/app/(dashboard)/tenders/[id]/page.tsx`

This is the core change. We:
1. Add the `getSectionStatuses` query
2. Replace `TabsList` with `TenderPhaseSidebar`
3. Wrap the content area in a flex layout with sidebar
4. Add deadline countdown to header
5. Hide sidebar on mobile, show Sheet drawer instead

- [ ] **Step 1: Add imports**

At the top of the file, add:

```typescript
import { TenderPhaseSidebar } from '@/components/tender/tender-phase-sidebar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu } from 'lucide-react';
```

Remove the now-unused imports:
```typescript
// Remove these:
import { AnimatedTabsTrigger } from '@/components/ui/animated-tabs';
```

- [ ] **Step 2: Add section statuses query**

After the existing `tenderQuery`, add:

```typescript
  const statusesQuery = trpc.tender.getSectionStatuses.useQuery(
    { id: tenderId },
    { retry: false, refetchOnWindowFocus: false }
  );
  const sectionStatuses = statusesQuery.data ?? {};
```

- [ ] **Step 3: Add deadline countdown helper**

After the animation variants, add:

```typescript
function DeadlineCountdown({ deadline, t }: { deadline: Date | null | undefined; t: (k: string) => string }) {
  if (!deadline) return null;
  const days = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
  const text = days <= 0 ? t('tender.deadlineCountdown.expired') : days === 1 ? t('tender.deadlineCountdown.oneDay') : t('tender.deadlineCountdown.days').replace('{{count}}', String(days));
  const color = days <= 0 ? 'text-[#ef4444]' : days <= 3 ? 'text-[#ef4444]' : days <= 7 ? 'text-[#f59e0b]' : 'text-emerald-500';
  return (
    <span className={cn('flex items-center gap-1.5 text-sm font-semibold tabular-nums', color)}>
      <CalendarClock className="h-4 w-4" />
      {text}
    </span>
  );
}
```

- [ ] **Step 4: Add deadline countdown to header**

In the header section, after the platform badge and reference number, add:

```typescript
<DeadlineCountdown deadline={tender?.submissionDeadline} t={t} />
```

- [ ] **Step 5: Replace TabsList + content with sidebar layout**

Replace the entire `<Tabs>` block (lines ~381-478) with:

```typescript
      {/* Sidebar + Content Layout */}
      <motion.div variants={itemVariants} className="flex min-h-[600px] rounded-xl border border-border/40 bg-card/30 overflow-hidden">
        {/* Sidebar - hidden on mobile */}
        <div className="hidden lg:flex">
          <TenderPhaseSidebar
            activeSection={activeTab}
            onSectionChange={setActiveTab}
            statuses={sectionStatuses}
            unreadClarifications={unreadCount}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Mobile section toggle */}
          <div className="lg:hidden border-b border-border/40 px-4 py-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 cursor-pointer">
                  <Menu className="h-4 w-4" />
                  {t('tender.sidebar.toggle')}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[260px] p-0">
                <TenderPhaseSidebar
                  activeSection={activeTab}
                  onSectionChange={(section) => {
                    setActiveTab(section);
                  }}
                  statuses={sectionStatuses}
                  unreadClarifications={unreadCount}
                />
              </SheetContent>
            </Sheet>
          </div>

          {/* Tab content with crossfade */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="p-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] as const }}
                >
                  <TabsContent value="overview" forceMount={activeTab === 'overview' ? true : undefined}>
                    {isLoading ? (
                      <OverviewTabSkeleton />
                    ) : (
                      <div className="space-y-6">
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
                        <div className="grid gap-4 lg:grid-cols-2">
                          <AIBriefPanel tenderId={tenderId} sourceUrl={sourceUrl} platform={tenderPlatform} />
                          <GoNoGoPanel tenderId={tenderId} sourceUrl={sourceUrl} platform={tenderPlatform} />
                        </div>
                        <TenderIntelligencePanel tenderId={tenderId} />
                        <OverviewTab tender={tender} />
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value="requirements" forceMount={activeTab === 'requirements' ? true : undefined}>
                    <RequirementsTab tenderId={tenderId} />
                  </TabsContent>
                  <TabsContent value="documents" forceMount={activeTab === 'documents' ? true : undefined}>
                    <DocumentsTab tenderId={tenderId} />
                  </TabsContent>
                  <TabsContent value="criteria" forceMount={activeTab === 'criteria' ? true : undefined}>
                    <CriteriaTab tenderId={tenderId} />
                  </TabsContent>
                  <TabsContent value="fakelos" forceMount={activeTab === 'fakelos' ? true : undefined}>
                    <FakelosTab tenderId={tenderId} />
                  </TabsContent>
                  <TabsContent value="deadline" forceMount={activeTab === 'deadline' ? true : undefined}>
                    <div className="p-6">
                      <DeadlinePlannerTab tenderId={tenderId} submissionDeadline={tender.submissionDeadline} />
                    </div>
                  </TabsContent>
                  <TabsContent value="tasks" forceMount={activeTab === 'tasks' ? true : undefined}>
                    <TasksTab tenderId={tenderId} />
                  </TabsContent>
                  <TabsContent value="legal" forceMount={activeTab === 'legal' ? true : undefined}>
                    <LegalTab tenderId={tenderId} sourceUrl={sourceUrl} platform={tenderPlatform} />
                  </TabsContent>
                  <TabsContent value="financial" forceMount={activeTab === 'financial' ? true : undefined}>
                    <FinancialTab tenderId={tenderId} sourceUrl={sourceUrl} platform={tenderPlatform} />
                  </TabsContent>
                  <TabsContent value="technical" forceMount={activeTab === 'technical' ? true : undefined}>
                    <TechnicalTabEnhanced tenderId={tenderId} sourceUrl={sourceUrl} platform={tenderPlatform} />
                  </TabsContent>
                  <TabsContent value="activity" forceMount={activeTab === 'activity' ? true : undefined}>
                    <ActivityTab tenderId={tenderId} />
                  </TabsContent>
                </motion.div>
              </AnimatePresence>
            </div>
          </Tabs>
        </div>
      </motion.div>
```

Note: The `TabsList` is completely removed. The `Tabs` root stays for Radix's internal state management, but the visible trigger is now the sidebar.

- [ ] **Step 6: Verify build**

```bash
npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add src/app/\(dashboard\)/tenders/\[id\]/page.tsx
git commit -m "feat(ux): replace horizontal tabs with phase-grouped sidebar layout"
```

---

## Task 6: Build Verification

- [ ] **Step 1: Full build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 2: Visual verification**

Open a tender detail page. Verify:
- Left sidebar shows 4 phase groups with section names
- Clicking a section changes the content area
- Status icons show (mostly not_started for empty tenders)
- Collapse button hides labels, shows icons only
- Progress bar at bottom shows X/11
- Deadline countdown in header
- On narrow viewport: sidebar hidden, "Πλοήγηση φακέλου" button opens drawer

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: UX Restructure — phase-grouped sidebar navigation for tender detail"
```
