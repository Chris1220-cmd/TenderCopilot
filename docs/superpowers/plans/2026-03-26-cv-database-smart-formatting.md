# Feature 8: CV Database & Smart Formatting — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable team member database with AI-powered CV parsing, smart team assignment, and formatted CV export for Greek public tenders.

**Architecture:** New `TeamMember` model (normalized with Education, Experience, Certification sub-tables) lives under the Company domain. A new tRPC router handles CRUD + AI operations. The tender technical tab gets upgraded from text input to Combobox assignment with AI suggestions. CV export generates DOCX files using existing `docx` + `JSZip` libraries.

**Tech Stack:** Prisma (PostgreSQL), tRPC, React Hook Form + Zod, shadcn/ui Sheet, Google Generative AI (Gemini), docx library, JSZip, pdf-parse, mammoth

**Spec:** `docs/superpowers/specs/2026-03-26-cv-database-smart-formatting-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/server/routers/team-member.ts` | tRPC router — CRUD, parseCv, suggestAssignments, assignToRequirement, exportCvs |
| `src/server/services/cv-parser.ts` | Extract text from PDF/DOCX → send to Gemini → return structured JSON |
| `src/server/services/cv-export.ts` | Generate DOCX CVs from templates + Πίνακας Στελέχωσης → ZIP bundle |
| `src/server/services/team-suggest.ts` | AI matching: TeamMembers vs TeamRequirements → ranked suggestions |
| `src/components/company/team-members-list.tsx` | List view — cards with search, new member button |
| `src/components/company/team-member-sheet.tsx` | Large Sheet — full member profile form with repeatable sections |
| `src/components/tender/team-assignment-cell.tsx` | Combobox dropdown for assigning members to requirements |
| `src/lib/cv-templates.ts` | Template definitions for Europass, Greek Public, Summary formats |
| `src/lib/team-member-schemas.ts` | Shared Zod schemas for TeamMember forms and API |
| `tests/services/cv-parser.test.ts` | Unit tests for CV parser service |
| `tests/services/cv-export.test.ts` | Unit tests for CV export service |

### Modified Files
| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add TeamMember + 3 sub-models, modify TeamRequirement |
| `src/server/root.ts` | Register teamMember router |
| `src/app/(dashboard)/company/page.tsx` | Add "Ομάδα Έργου" tab |
| `src/components/tender/technical-tab-enhanced.tsx` | Replace text input with Combobox + suggestion badges |
| `messages/el.json` | Add `teamMembers` + `company.teamTab` keys |
| `messages/en.json` | Add `teamMembers` + `company.teamTab` keys |

---

## Task 1: Prisma Schema — New Models

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add TeamMember model to schema**

Open `prisma/schema.prisma` and add after the `Certificate` model:

```prisma
model TeamMember {
  id              String   @id @default(cuid())
  fullName        String
  title           String
  email           String?
  phone           String?
  totalExperience Int      @default(0)
  bio             String?  @db.Text
  cvFileKey       String?
  cvFileName      String?
  isActive        Boolean  @default(true)

  tenantId String
  tenant   Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  education      TeamMemberEducation[]
  experience     TeamMemberExperience[]
  certifications TeamMemberCertification[]
  assignments    TeamRequirement[]         @relation("AssignedMember")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([tenantId])
}

model TeamMemberEducation {
  id          String @id @default(cuid())
  degree      String
  institution String
  year        Int?

  memberId String
  member   TeamMember @relation(fields: [memberId], references: [id], onDelete: Cascade)
}

model TeamMemberExperience {
  id          String   @id @default(cuid())
  projectName String
  client      String
  role        String
  budget      Decimal? @db.Decimal(14, 2)
  startYear   Int
  endYear     Int?
  description String?  @db.Text
  category    String?

  memberId String
  member   TeamMember @relation(fields: [memberId], references: [id], onDelete: Cascade)
}

model TeamMemberCertification {
  id         String    @id @default(cuid())
  name       String
  issuer     String
  issueDate  DateTime?
  expiryDate DateTime?

  memberId String
  member   TeamMember @relation(fields: [memberId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 2: Add assignedMemberId to TeamRequirement**

In the existing `TeamRequirement` model, add:

```prisma
model TeamRequirement {
  // ... existing fields ...

  assignedMemberId String?
  assignedMember   TeamMember? @relation("AssignedMember", fields: [assignedMemberId], references: [id], onDelete: SetNull)

  // ... existing relations ...
}
```

- [ ] **Step 3: Add TeamMember relation to Tenant model**

In the `Tenant` model, add to the relations list:

```prisma
  teamMembers    TeamMember[]
```

- [ ] **Step 4: Run migration**

```bash
npx prisma migrate dev --name add-team-member-models
```

Expected: Migration creates 4 new tables and adds `assignedMemberId` column to `TeamRequirement`.

- [ ] **Step 5: Verify schema**

```bash
npx prisma generate
```

Expected: Prisma client regenerated with new types.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add TeamMember models and assignedMemberId to TeamRequirement"
```

---

## Task 2: Shared Zod Schemas

**Files:**
- Create: `src/lib/team-member-schemas.ts`

- [ ] **Step 1: Create shared validation schemas**

```typescript
import { z } from 'zod';

export const educationSchema = z.object({
  id: z.string().optional(),
  degree: z.string().min(1),
  institution: z.string().min(1),
  year: z.coerce.number().int().min(1950).max(2030).nullish(),
});

export const experienceSchema = z.object({
  id: z.string().optional(),
  projectName: z.string().min(1),
  client: z.string().min(1),
  role: z.string().min(1),
  budget: z.coerce.number().nonnegative().nullish(),
  startYear: z.coerce.number().int().min(1950).max(2030),
  endYear: z.coerce.number().int().min(1950).max(2030).nullish(),
  description: z.string().nullish(),
  category: z.string().nullish(),
});

export const certificationSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  issuer: z.string().min(1),
  issueDate: z.coerce.date().nullish(),
  expiryDate: z.coerce.date().nullish(),
});

export const teamMemberCreateSchema = z.object({
  fullName: z.string().min(1),
  title: z.string().min(1),
  email: z.string().email().nullish(),
  phone: z.string().nullish(),
  totalExperience: z.coerce.number().int().min(0).default(0),
  bio: z.string().nullish(),
  cvFileKey: z.string().nullish(),
  cvFileName: z.string().nullish(),
  education: z.array(educationSchema).default([]),
  experience: z.array(experienceSchema).default([]),
  certifications: z.array(certificationSchema).default([]),
});

export const teamMemberUpdateSchema = teamMemberCreateSchema.partial().extend({
  id: z.string().cuid(),
  isActive: z.boolean().optional(),
});

export type TeamMemberFormValues = z.infer<typeof teamMemberCreateSchema>;
export type EducationEntry = z.infer<typeof educationSchema>;
export type ExperienceEntry = z.infer<typeof experienceSchema>;
export type CertificationEntry = z.infer<typeof certificationSchema>;
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/team-member-schemas.ts
git commit -m "feat(team): add shared Zod schemas for team member forms"
```

---

## Task 3: tRPC Router — CRUD

**Files:**
- Create: `src/server/routers/team-member.ts`
- Modify: `src/server/root.ts`

- [ ] **Step 1: Create the team-member router with list and getById**

Create `src/server/routers/team-member.ts`:

```typescript
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '@/server/trpc';
import {
  teamMemberCreateSchema,
  teamMemberUpdateSchema,
} from '@/lib/team-member-schemas';

export const teamMemberRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
    }

    return ctx.db.teamMember.findMany({
      where: { tenantId: ctx.tenantId },
      include: {
        _count: {
          select: {
            education: true,
            experience: true,
            certifications: true,
            assignments: true,
          },
        },
      },
      orderBy: { fullName: 'asc' },
    });
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      const member = await ctx.db.teamMember.findUnique({
        where: { id: input.id },
        include: {
          education: { orderBy: { year: 'desc' } },
          experience: { orderBy: { startYear: 'desc' } },
          certifications: { orderBy: { name: 'asc' } },
          assignments: {
            include: {
              tender: { select: { id: true, title: true, status: true } },
            },
          },
        },
      });

      if (!member || member.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Team member not found.' });
      }

      return member;
    }),

  create: protectedProcedure
    .input(teamMemberCreateSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      const { education, experience, certifications, ...memberData } = input;

      return ctx.db.teamMember.create({
        data: {
          tenantId: ctx.tenantId,
          ...memberData,
          education: { create: education },
          experience: {
            create: experience.map((e) => ({
              ...e,
              budget: e.budget != null ? e.budget : undefined,
            })),
          },
          certifications: { create: certifications },
        },
        include: {
          education: true,
          experience: true,
          certifications: true,
        },
      });
    }),

  update: protectedProcedure
    .input(teamMemberUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      const { id, education, experience, certifications, ...memberData } = input;

      const existing = await ctx.db.teamMember.findUnique({ where: { id } });
      if (!existing || existing.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Team member not found.' });
      }

      // Transaction: update member + replace sub-entries
      return ctx.db.$transaction(async (tx) => {
        // Update member fields
        await tx.teamMember.update({
          where: { id },
          data: memberData,
        });

        // Replace education entries if provided
        if (education !== undefined) {
          await tx.teamMemberEducation.deleteMany({ where: { memberId: id } });
          if (education.length > 0) {
            await tx.teamMemberEducation.createMany({
              data: education.map((e) => ({ ...e, id: undefined, memberId: id })),
            });
          }
        }

        // Replace experience entries if provided
        if (experience !== undefined) {
          await tx.teamMemberExperience.deleteMany({ where: { memberId: id } });
          if (experience.length > 0) {
            await tx.teamMemberExperience.createMany({
              data: experience.map((e) => ({
                ...e,
                id: undefined,
                memberId: id,
                budget: e.budget != null ? e.budget : undefined,
              })),
            });
          }
        }

        // Replace certification entries if provided
        if (certifications !== undefined) {
          await tx.teamMemberCertification.deleteMany({ where: { memberId: id } });
          if (certifications.length > 0) {
            await tx.teamMemberCertification.createMany({
              data: certifications.map((c) => ({ ...c, id: undefined, memberId: id })),
            });
          }
        }

        // Also update any TeamRequirement mappedStaffName that references this member
        if (memberData.fullName) {
          await tx.teamRequirement.updateMany({
            where: { assignedMemberId: id },
            data: { mappedStaffName: memberData.fullName },
          });
        }

        return tx.teamMember.findUnique({
          where: { id },
          include: { education: true, experience: true, certifications: true },
        });
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      const member = await ctx.db.teamMember.findUnique({
        where: { id: input.id },
        include: { _count: { select: { assignments: true } } },
      });

      if (!member || member.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Team member not found.' });
      }

      // Soft delete if has assignments, hard delete otherwise
      if (member._count.assignments > 0) {
        return ctx.db.teamMember.update({
          where: { id: input.id },
          data: { isActive: false },
        });
      }

      return ctx.db.teamMember.delete({ where: { id: input.id } });
    }),

  // Assignment endpoints
  assignToRequirement: protectedProcedure
    .input(z.object({
      requirementId: z.string().cuid(),
      memberId: z.string().cuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      const member = await ctx.db.teamMember.findUnique({ where: { id: input.memberId } });
      if (!member || member.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Team member not found.' });
      }

      return ctx.db.teamRequirement.update({
        where: { id: input.requirementId },
        data: {
          assignedMemberId: input.memberId,
          mappedStaffName: member.fullName,
          status: 'COVERED',
        },
      });
    }),

  unassignFromRequirement: protectedProcedure
    .input(z.object({ requirementId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      return ctx.db.teamRequirement.update({
        where: { id: input.requirementId },
        data: {
          assignedMemberId: null,
          mappedStaffName: null,
          status: 'UNMAPPED',
        },
      });
    }),
});
```

- [ ] **Step 2: Register router in root**

In `src/server/root.ts`, add:

```typescript
import { teamMemberRouter } from '@/server/routers/team-member';
```

And in the `appRouter`:

```typescript
  teamMember: teamMemberRouter,
```

- [ ] **Step 3: Verify build**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add src/server/routers/team-member.ts src/server/root.ts
git commit -m "feat(team): add tRPC team-member router with CRUD and assignment endpoints"
```

---

## Task 4: i18n Translations

**Files:**
- Modify: `messages/el.json`
- Modify: `messages/en.json`

- [ ] **Step 1: Add Greek translations**

Add to `messages/el.json` — new `teamMembers` top-level key and `company.teamTab`:

In the `company` object, add:
```json
"teamTab": "Ομάδα Έργου"
```

Add new top-level key:
```json
"teamMembers": {
  "title": "Ομάδα Έργου",
  "subtitle": "Διαχείριση μελών ομάδας και βιογραφικών",
  "countSingular": "μέλος",
  "countPlural": "μέλη",
  "newMember": "Νέο Μέλος",
  "editMember": "Επεξεργασία Μέλους",
  "memberCreated": "Το μέλος δημιουργήθηκε.",
  "memberUpdated": "Το μέλος ενημερώθηκε.",
  "memberDeleted": "Το μέλος διαγράφηκε.",
  "memberDeactivated": "Το μέλος απενεργοποιήθηκε.",
  "deleteConfirm": "Θέλετε σίγουρα να διαγράψετε αυτό το μέλος; Αυτή η ενέργεια δεν μπορεί να αναιρεθεί.",
  "deactivateConfirm": "Αυτό το μέλος έχει ανατεθεί σε διαγωνισμούς. Θα απενεργοποιηθεί αντί να διαγραφεί.",
  "fillDetails": "Συμπληρώστε τα στοιχεία του μέλους.",
  "noMembers": "Δεν υπάρχουν μέλη",
  "noMembersSub": "Προσθέστε τα μέλη της ομάδας σας.",
  "searchPlaceholder": "Αναζήτηση...",
  "fullName": "Ονοματεπώνυμο *",
  "fullNamePlaceholder": "π.χ. Ιωάννης Παπαδόπουλος",
  "memberTitle": "Ειδικότητα *",
  "memberTitlePlaceholder": "π.χ. Πολιτικός Μηχανικός",
  "email": "Email",
  "phone": "Τηλέφωνο",
  "totalExperience": "Χρόνια Εμπειρίας",
  "bio": "Σύντομο Προφίλ",
  "bioPlaceholder": "Σύντομη περιγραφή επαγγελματικού προφίλ...",
  "active": "Ενεργό",
  "inactive": "Ανενεργό",
  "education": "Εκπαίδευση",
  "addEducation": "Προσθήκη Σπουδών",
  "degree": "Τίτλος Σπουδών *",
  "degreePlaceholder": "π.χ. Δίπλωμα Πολιτικού Μηχανικού",
  "institution": "Ίδρυμα *",
  "institutionPlaceholder": "π.χ. ΕΜΠ",
  "year": "Έτος",
  "experience": "Εμπειρία Έργων",
  "addExperience": "Προσθήκη Έργου",
  "projectName": "Όνομα Έργου *",
  "projectNamePlaceholder": "π.χ. Μελέτη Οδοποιίας Ε.Ο. Πατρών-Πύργου",
  "client": "Κύριος Έργου *",
  "clientPlaceholder": "π.χ. Περιφέρεια Δυτικής Ελλάδας",
  "role": "Ρόλος *",
  "rolePlaceholder": "π.χ. Υπεύθυνος Μελέτης",
  "budget": "Προϋπολογισμός (€)",
  "startYear": "Από *",
  "endYear": "Έως",
  "endYearCurrent": "Τρέχον",
  "description": "Περιγραφή",
  "category": "Κατηγορία",
  "categoryPlaceholder": "π.χ. Οδοποιία",
  "certifications": "Πιστοποιήσεις",
  "addCertification": "Προσθήκη Πιστοποιητικού",
  "certName": "Όνομα *",
  "certNamePlaceholder": "π.χ. PMP",
  "certIssuer": "Εκδότης *",
  "certIssuerPlaceholder": "π.χ. PMI",
  "certIssueDate": "Ημ. Έκδοσης",
  "certExpiryDate": "Ημ. Λήξης",
  "uploadCv": "Ανέβασμα CV",
  "parseCv": "Ανάλυση CV",
  "parsing": "Ανάλυση σε εξέλιξη...",
  "parseSuccess": "Το CV αναλύθηκε. Ελέγξτε τα στοιχεία.",
  "parseError": "Δεν βρέθηκε κείμενο — ανεβάστε PDF με κείμενο ή DOCX.",
  "parseFailed": "Δεν μπόρεσε να αναλυθεί αυτόματα. Συμπληρώστε χειροκίνητα.",
  "reparseConfirm": "Θέλετε να ενημερωθούν τα στοιχεία από το νέο CV;",
  "proposedIn": "Προτάθηκε σε",
  "noAssignments": "Δεν έχει ανατεθεί σε διαγωνισμούς.",
  "suggestTeam": "Πρότεινε Ομάδα",
  "suggesting": "Ανάλυση ομάδας...",
  "suggested": "Προτείνεται",
  "assignMember": "Ανάθεση Μέλους",
  "unassign": "Αφαίρεση",
  "selectMember": "Επιλέξτε μέλος...",
  "alreadyAssigned": "Ήδη σε ενεργό διαγωνισμό",
  "exportCvs": "Εξαγωγή CVs Ομάδας",
  "exporting": "Δημιουργία εγγράφων...",
  "exportReady": "Τα έγγραφα είναι έτοιμα για λήψη.",
  "assignTeamFirst": "Αναθέστε ομάδα πρώτα.",
  "templateEuropass": "Europass",
  "templateGreekPublic": "Ελληνικό Δημόσιο",
  "templateSummary": "Συνοπτικό",
  "staffingTable": "Πίνακας Στελέχωσης",
  "selectTemplate": "Επιλέξτε μορφή"
}
```

- [ ] **Step 2: Add English translations**

Add the same structure to `messages/en.json`:

In the `company` object, add:
```json
"teamTab": "Project Team"
```

Add new top-level key:
```json
"teamMembers": {
  "title": "Project Team",
  "subtitle": "Manage team members and CVs",
  "countSingular": "member",
  "countPlural": "members",
  "newMember": "New Member",
  "editMember": "Edit Member",
  "memberCreated": "Member created.",
  "memberUpdated": "Member updated.",
  "memberDeleted": "Member deleted.",
  "memberDeactivated": "Member deactivated.",
  "deleteConfirm": "Are you sure you want to delete this member? This action cannot be undone.",
  "deactivateConfirm": "This member has tender assignments. They will be deactivated instead of deleted.",
  "fillDetails": "Fill in the member details.",
  "noMembers": "No team members",
  "noMembersSub": "Add your team members.",
  "searchPlaceholder": "Search...",
  "fullName": "Full Name *",
  "fullNamePlaceholder": "e.g. John Smith",
  "memberTitle": "Title / Specialty *",
  "memberTitlePlaceholder": "e.g. Civil Engineer",
  "email": "Email",
  "phone": "Phone",
  "totalExperience": "Years of Experience",
  "bio": "Short Profile",
  "bioPlaceholder": "Brief professional summary...",
  "active": "Active",
  "inactive": "Inactive",
  "education": "Education",
  "addEducation": "Add Education",
  "degree": "Degree *",
  "degreePlaceholder": "e.g. MSc Civil Engineering",
  "institution": "Institution *",
  "institutionPlaceholder": "e.g. NTUA",
  "year": "Year",
  "experience": "Project Experience",
  "addExperience": "Add Project",
  "projectName": "Project Name *",
  "projectNamePlaceholder": "e.g. Highway Design Study",
  "client": "Client *",
  "clientPlaceholder": "e.g. Ministry of Infrastructure",
  "role": "Role *",
  "rolePlaceholder": "e.g. Project Manager",
  "budget": "Budget (€)",
  "startYear": "From *",
  "endYear": "To",
  "endYearCurrent": "Present",
  "description": "Description",
  "category": "Category",
  "categoryPlaceholder": "e.g. Road Design",
  "certifications": "Certifications",
  "addCertification": "Add Certification",
  "certName": "Name *",
  "certNamePlaceholder": "e.g. PMP",
  "certIssuer": "Issuer *",
  "certIssuerPlaceholder": "e.g. PMI",
  "certIssueDate": "Issue Date",
  "certExpiryDate": "Expiry Date",
  "uploadCv": "Upload CV",
  "parseCv": "Parse CV",
  "parsing": "Parsing CV...",
  "parseSuccess": "CV parsed. Review the details.",
  "parseError": "No text found — upload a text-based PDF or DOCX.",
  "parseFailed": "Could not parse automatically. Fill in manually.",
  "reparseConfirm": "Update details from the new CV?",
  "proposedIn": "Proposed in",
  "noAssignments": "Not assigned to any tenders.",
  "suggestTeam": "Suggest Team",
  "suggesting": "Analyzing team...",
  "suggested": "Suggested",
  "assignMember": "Assign Member",
  "unassign": "Unassign",
  "selectMember": "Select member...",
  "alreadyAssigned": "Already in active tender",
  "exportCvs": "Export Team CVs",
  "exporting": "Generating documents...",
  "exportReady": "Documents ready for download.",
  "assignTeamFirst": "Assign team first.",
  "templateEuropass": "Europass",
  "templateGreekPublic": "Greek Public",
  "templateSummary": "Summary",
  "staffingTable": "Staffing Table",
  "selectTemplate": "Select format"
}
```

- [ ] **Step 3: Commit**

```bash
git add messages/el.json messages/en.json
git commit -m "feat(i18n): add team member translations for Greek and English"
```

---

## Task 5: Team Members List Component

**Files:**
- Create: `src/components/company/team-members-list.tsx`

- [ ] **Step 1: Create the list component**

Create `src/components/company/team-members-list.tsx` following the `certificates-list.tsx` pattern:

```typescript
'use client';

import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { TeamMemberSheet } from './team-member-sheet';
import {
  Users,
  Plus,
  Search,
  Briefcase,
  GraduationCap,
  Award,
  Pencil,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function TeamMembersList() {
  const { toast } = useToast();
  const { t } = useTranslation();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const membersQuery = trpc.teamMember.list.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const deleteMutation = trpc.teamMember.delete.useMutation({
    onSuccess: (result) => {
      const isDeactivated = 'isActive' in result && result.isActive === false;
      toast({
        title: t('common.success'),
        description: isDeactivated
          ? t('teamMembers.memberDeactivated')
          : t('teamMembers.memberDeleted'),
      });
      membersQuery.refetch();
      setDeleteConfirmId(null);
    },
    onError: (err) => {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    },
  });

  const members = membersQuery.data ?? [];

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return members;
    const q = searchQuery.toLowerCase();
    return members.filter(
      (m) =>
        m.fullName.toLowerCase().includes(q) ||
        m.title.toLowerCase().includes(q)
    );
  }, [members, searchQuery]);

  function openNew() {
    setEditingId(null);
    setSheetOpen(true);
  }

  function openEdit(id: string) {
    setEditingId(id);
    setSheetOpen(true);
  }

  function onSheetClose() {
    setSheetOpen(false);
    setEditingId(null);
    membersQuery.refetch();
  }

  // Loading state
  if (membersQuery.isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="border-border/60 bg-card">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-6 w-16" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const deleteTarget = members.find((m) => m.id === deleteConfirmId);
  const hasAssignments = deleteTarget && deleteTarget._count.assignments > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5 text-[#48A4D6]" />
            {t('teamMembers.title')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {members.filter((m) => m.isActive).length}{' '}
            {members.filter((m) => m.isActive).length === 1
              ? t('teamMembers.countSingular')
              : t('teamMembers.countPlural')}
          </p>
        </div>
        <Button onClick={openNew} className="cursor-pointer">
          <Plus className="h-4 w-4 mr-1" />
          {t('teamMembers.newMember')}
        </Button>
      </div>

      {/* Search */}
      {members.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('teamMembers.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 border-border/60 bg-card">
          <Users className="h-12 w-12 text-muted-foreground/30" />
          <h3 className="mt-4 text-lg font-semibold">{t('teamMembers.noMembers')}</h3>
          <p className="text-sm text-muted-foreground">{t('teamMembers.noMembersSub')}</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((member) => (
            <Card
              key={member.id}
              className={cn(
                'border-border/60 bg-card transition-all duration-200 hover:shadow-md cursor-pointer group',
                !member.isActive && 'opacity-60'
              )}
              onClick={() => openEdit(member.id)}
            >
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  {/* Avatar placeholder */}
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#48A4D6]/10 text-[#48A4D6] font-semibold text-sm">
                    {member.fullName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold truncate">{member.fullName}</h3>
                      {!member.isActive && (
                        <Badge variant="outline" className="text-[10px]">
                          {t('teamMembers.inactive')}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {member.title} &middot; {member.totalExperience} {t('teamMembers.year')}
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="hidden md:flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1" title={t('teamMembers.education')}>
                      <GraduationCap className="h-3.5 w-3.5" />
                      {member._count.education}
                    </span>
                    <span className="flex items-center gap-1" title={t('teamMembers.experience')}>
                      <Briefcase className="h-3.5 w-3.5" />
                      {member._count.experience}
                    </span>
                    <span className="flex items-center gap-1" title={t('teamMembers.certifications')}>
                      <Award className="h-3.5 w-3.5" />
                      {member._count.certifications}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(member.id);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmId(member.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Sheet for create/edit */}
      <TeamMemberSheet
        open={sheetOpen}
        memberId={editingId}
        onClose={onSheetClose}
      />

      {/* Delete confirmation */}
      <Dialog
        open={deleteConfirmId !== null}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{t('common.deleteConfirmTitle')}</DialogTitle>
            <DialogDescription>
              {hasAssignments
                ? t('teamMembers.deactivateConfirm')
                : t('teamMembers.deleteConfirm')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)} className="cursor-pointer">
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              className="cursor-pointer"
              onClick={() => deleteConfirmId && deleteMutation.mutate({ id: deleteConfirmId })}
              disabled={deleteMutation.isPending}
            >
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npx tsc --noEmit
```

Note: This will fail because `TeamMemberSheet` doesn't exist yet — that's expected. Proceed to Task 6.

- [ ] **Step 3: Commit**

```bash
git add src/components/company/team-members-list.tsx
git commit -m "feat(team): add team members list component"
```

---

## Task 6: Team Member Sheet (Create/Edit Form)

**Files:**
- Create: `src/components/company/team-member-sheet.tsx`

- [ ] **Step 1: Create the Sheet component with form**

Create `src/components/company/team-member-sheet.tsx`. This is a large Sheet with:
- Basic info fields (fullName, title, email, phone, totalExperience, bio)
- CV upload section
- Repeatable Education entries
- Repeatable Experience entries
- Repeatable Certification entries
- "Proposed in" read-only list

The component should:
- Use `Sheet` from shadcn/ui with `side="right"` and custom width (`sm:max-w-[640px]`)
- Use `react-hook-form` with `useFieldArray` for repeatable sections
- Load existing data via `trpc.teamMember.getById` when `memberId` is provided
- Save via `trpc.teamMember.create` or `trpc.teamMember.update`
- Include CV upload button that calls `/api/upload` then stores fileKey
- Include "Ανάλυση CV" button that calls `trpc.teamMember.parseCv` (added in Task 8)

Key implementation details:
- Each repeatable section (education, experience, certifications) uses `useFieldArray` with `append`, `remove`, and `fields`
- The form has sections separated by `<Separator />`
- Each section header has "Add" button aligned right
- Each entry has a "Remove" button (Trash2 icon)
- On save: collect all data including arrays, call create or update mutation
- On cancel: close sheet and reset form

The complete component is ~400 lines. The engineer should follow the `certificates-list.tsx` form pattern but adapted for Sheet + useFieldArray. Use `ScrollArea` inside the Sheet for scrollable content.

Key imports:
```typescript
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { teamMemberCreateSchema, type TeamMemberFormValues } from '@/lib/team-member-schemas';
```

Form structure:
```
Sheet (side="right", className="sm:max-w-[640px] w-full")
  SheetHeader
    SheetTitle: "Νέο Μέλος" / "Επεξεργασία Μέλους"
  ScrollArea (className="h-[calc(100vh-140px)]")
    form (onSubmit)
      Section: Basic Info
        fullName, title (2-col grid)
        email, phone (2-col grid)
        totalExperience, bio
      Section: CV Upload
        File input + "Ανάλυση CV" button
        Current file name display
      Separator
      Section: Education (useFieldArray)
        Header + "Προσθήκη" button
        For each entry: degree, institution, year (grid) + remove button
      Separator
      Section: Experience (useFieldArray)
        Header + "Προσθήκη" button
        For each entry: projectName, client, role (grid), budget, startYear, endYear, description, category + remove button
      Separator
      Section: Certifications (useFieldArray)
        Header + "Προσθήκη" button
        For each entry: name, issuer (grid), issueDate, expiryDate (grid) + remove button
      Separator
      Section: Proposed In (read-only, if editing)
        List of tender assignments from member data
      Footer: Cancel + Save buttons
```

- [ ] **Step 2: Verify build**

```bash
npx tsc --noEmit
```

Expected: Should compile without errors (parseCv endpoint not yet needed — the button can be disabled initially).

- [ ] **Step 3: Commit**

```bash
git add src/components/company/team-member-sheet.tsx
git commit -m "feat(team): add team member sheet with repeatable sections form"
```

---

## Task 7: Company Page — Add Tab

**Files:**
- Modify: `src/app/(dashboard)/company/page.tsx`

- [ ] **Step 1: Import and add the team tab**

In `src/app/(dashboard)/company/page.tsx`:

Add import:
```typescript
import { TeamMembersList } from '@/components/company/team-members-list';
import { Users } from 'lucide-react';
```

Note: `Users` may already be imported — check first.

Add to `tabKeys` array:
```typescript
{ value: 'team', labelKey: 'company.teamTab', icon: Users },
```

Add corresponding `TabsContent`:
```typescript
<TabsContent value="team" forceMount={activeTab === 'team' ? true : undefined}>
  <TeamMembersList />
</TabsContent>
```

- [ ] **Step 2: Verify build and test manually**

```bash
npm run build
```

Expected: Build succeeds. Navigate to `/company` → "Ομάδα Έργου" tab visible.

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/company/page.tsx
git commit -m "feat(team): add Ομάδα Έργου tab to company page"
```

---

## Task 8: CV Parser Service

**Files:**
- Create: `src/server/services/cv-parser.ts`
- Modify: `src/server/routers/team-member.ts`

- [ ] **Step 1: Create the CV parser service**

Create `src/server/services/cv-parser.ts`:

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { downloadFile } from '@/lib/s3';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

interface ParsedEducation {
  degree: string;
  institution: string;
  year: number | null;
}

interface ParsedExperience {
  projectName: string;
  client: string;
  role: string;
  budget: number | null;
  startYear: number;
  endYear: number | null;
  description: string | null;
  category: string | null;
}

interface ParsedCertification {
  name: string;
  issuer: string;
  issueDate: string | null;
  expiryDate: string | null;
}

export interface ParsedCvData {
  fullName: string;
  title: string;
  totalExperience: number;
  education: ParsedEducation[];
  experience: ParsedExperience[];
  certifications: ParsedCertification[];
}

const CV_PARSE_PROMPT = `Ανέλυσε αυτό το βιογραφικό και εξήγαγε δομημένα δεδομένα σε JSON.

ΚΑΝΟΝΕΣ:
- Εξήγαγε ΜΟΝΟ πληροφορίες που υπάρχουν στο κείμενο
- Αν κάτι δεν αναφέρεται, βάλε null
- Τα χρόνια εμπειρίας υπολόγισέ τα από τις θέσεις εργασίας/έργα
- Η εμπειρία πρέπει να είναι σε ΕΡΓΑ (projects), όχι θέσεις εργασίας
- Αν το CV αναφέρει θέσεις εργασίας αντί για έργα, μετέτρεψέ τες σε project entries

Επέστρεψε ΜΟΝΟ JSON:
{
  "fullName": "string",
  "title": "string — ειδικότητα/τίτλος",
  "totalExperience": number,
  "education": [{ "degree": "string", "institution": "string", "year": number|null }],
  "experience": [{ "projectName": "string", "client": "string", "role": "string", "budget": number|null, "startYear": number, "endYear": number|null, "description": "string|null", "category": "string|null" }],
  "certifications": [{ "name": "string", "issuer": "string", "issueDate": "string|null", "expiryDate": "string|null" }]
}`;

async function extractText(fileKey: string): Promise<string> {
  const buffer = await downloadFile(fileKey);
  const ext = fileKey.split('.').pop()?.toLowerCase();

  if (ext === 'pdf') {
    const result = await pdfParse(buffer);
    if (!result.text || result.text.trim().length < 50) {
      throw new Error('NO_TEXT');
    }
    return result.text;
  }

  if (ext === 'docx' || ext === 'doc') {
    const result = await mammoth.extractRawText({ buffer });
    if (!result.value || result.value.trim().length < 50) {
      throw new Error('NO_TEXT');
    }
    return result.value;
  }

  throw new Error('UNSUPPORTED_FORMAT');
}

export async function parseCv(fileKey: string): Promise<ParsedCvData> {
  const text = await extractText(fileKey);

  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const result = await model.generateContent([
    { text: CV_PARSE_PROMPT },
    { text: `--- ΒΙΟΓΡΑΦΙΚΟ ---\n${text.slice(0, 15000)}` },
  ]);

  const response = result.response.text();

  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, response];
  const jsonStr = jsonMatch[1]?.trim() || response.trim();

  try {
    const parsed = JSON.parse(jsonStr) as ParsedCvData;
    return {
      fullName: parsed.fullName || '',
      title: parsed.title || '',
      totalExperience: parsed.totalExperience || 0,
      education: Array.isArray(parsed.education) ? parsed.education : [],
      experience: Array.isArray(parsed.experience) ? parsed.experience : [],
      certifications: Array.isArray(parsed.certifications) ? parsed.certifications : [],
    };
  } catch {
    throw new Error('PARSE_FAILED');
  }
}
```

- [ ] **Step 2: Check that downloadFile exists in s3 lib**

Read `src/lib/s3.ts` to verify `downloadFile` exists. If it doesn't, add it:

```typescript
export async function downloadFile(key: string): Promise<Buffer> {
  // Implementation depends on whether MinIO or Supabase Storage is used
  // Check existing s3.ts for the pattern and add a download counterpart
}
```

- [ ] **Step 3: Add parseCv endpoint to router**

In `src/server/routers/team-member.ts`, add:

```typescript
import { parseCv } from '@/server/services/cv-parser';
```

Add to the router:

```typescript
  parseCv: protectedProcedure
    .input(z.object({ fileKey: z.string().min(1) }))
    .mutation(async ({ input }) => {
      try {
        return await parseCv(input.fileKey);
      } catch (err: any) {
        if (err.message === 'NO_TEXT') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'No extractable text found in file.',
          });
        }
        if (err.message === 'UNSUPPORTED_FORMAT') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Unsupported file format. Use PDF or DOCX.',
          });
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'CV parsing failed.',
        });
      }
    }),
```

- [ ] **Step 4: Integrate parse button in TeamMemberSheet**

In `src/components/company/team-member-sheet.tsx`, add the parse flow:
- After file upload succeeds and `fileKey` is stored in form state
- "Ανάλυση CV" button calls `trpc.teamMember.parseCv.useMutation`
- On success: `reset(parsedData)` to fill the form
- On error `NO_TEXT`: show `t('teamMembers.parseError')` toast
- On other error: show `t('teamMembers.parseFailed')` toast

- [ ] **Step 5: Commit**

```bash
git add src/server/services/cv-parser.ts src/server/routers/team-member.ts src/components/company/team-member-sheet.tsx
git commit -m "feat(team): add AI-powered CV parsing with Gemini"
```

---

## Task 9: Team Assignment in Technical Tab

**Files:**
- Create: `src/components/tender/team-assignment-cell.tsx`
- Modify: `src/components/tender/technical-tab-enhanced.tsx`

- [ ] **Step 1: Create the assignment Combobox component**

Create `src/components/tender/team-assignment-cell.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown, X, AlertTriangle } from 'lucide-react';

interface TeamAssignmentCellProps {
  requirementId: string;
  currentMemberId: string | null;
  currentMemberName: string | null;
  suggestion?: {
    memberId: string;
    memberName: string;
    score: number;
    reasoning: string;
  } | null;
  onAssigned: () => void;
}

export function TeamAssignmentCell({
  requirementId,
  currentMemberId,
  currentMemberName,
  suggestion,
  onAssigned,
}: TeamAssignmentCellProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const membersQuery = trpc.teamMember.list.useQuery();
  const assignMutation = trpc.teamMember.assignToRequirement.useMutation({
    onSuccess: () => {
      onAssigned();
      setOpen(false);
    },
    onError: (err) => {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    },
  });
  const unassignMutation = trpc.teamMember.unassignFromRequirement.useMutation({
    onSuccess: () => onAssigned(),
    onError: (err) => {
      toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
    },
  });

  const members = (membersQuery.data ?? []).filter((m) => m.isActive);

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-[180px] justify-between text-xs h-8 cursor-pointer"
          >
            {currentMemberName || (
              <span className="text-muted-foreground">{t('teamMembers.selectMember')}</span>
            )}
            <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[240px] p-0">
          <Command>
            <CommandInput placeholder={t('teamMembers.searchPlaceholder')} className="h-8" />
            <CommandList>
              <CommandEmpty>{t('teamMembers.noMembers')}</CommandEmpty>
              <CommandGroup>
                {members.map((member) => {
                  const isAssignedElsewhere = member._count.assignments > 0 && member.id !== currentMemberId;
                  return (
                    <CommandItem
                      key={member.id}
                      value={member.fullName}
                      onSelect={() => {
                        assignMutation.mutate({
                          requirementId,
                          memberId: member.id,
                        });
                      }}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          'mr-2 h-3 w-3',
                          currentMemberId === member.id ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">{member.fullName}</div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {member.title} &middot; {member.totalExperience}y
                        </div>
                      </div>
                      {isAssignedElsewhere && (
                        <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" title={t('teamMembers.alreadyAssigned')} />
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Unassign button */}
      {currentMemberId && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 cursor-pointer"
          onClick={() => unassignMutation.mutate({ requirementId })}
        >
          <X className="h-3 w-3" />
        </Button>
      )}

      {/* AI suggestion badge */}
      {suggestion && !currentMemberId && (
        <Badge
          variant="outline"
          className="text-[10px] bg-[#48A4D6]/10 text-[#48A4D6] border-[#48A4D6]/30 cursor-pointer"
          onClick={() => {
            assignMutation.mutate({
              requirementId,
              memberId: suggestion.memberId,
            });
          }}
          title={suggestion.reasoning}
        >
          {t('teamMembers.suggested')}: {suggestion.memberName}
        </Badge>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Modify technical-tab-enhanced.tsx**

In `src/components/tender/technical-tab-enhanced.tsx`, in the team requirements table:

1. Import `TeamAssignmentCell`:
```typescript
import { TeamAssignmentCell } from './team-assignment-cell';
```

2. Replace the `mappedStaff` text display in the table body with:
```typescript
<td className="px-3 py-2.5">
  <TeamAssignmentCell
    requirementId={req.id}
    currentMemberId={req.assignedMemberId ?? null}
    currentMemberName={req.mappedStaff}
    suggestion={suggestions?.[req.id] ?? null}
    onAssigned={() => refetchTeam()}
  />
</td>
```

3. Add state for suggestions and the "Πρότεινε Ομάδα" button in the team section header.

Note: The `assignedMemberId` field needs to be included in the data fetched for team requirements. Check the `getTechnicalData` query in `ai-roles.ts` and ensure `assignedMemberId` is selected.

- [ ] **Step 3: Verify build**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/tender/team-assignment-cell.tsx src/components/tender/technical-tab-enhanced.tsx
git commit -m "feat(team): replace text input with Combobox for team assignment"
```

---

## Task 10: AI Suggest Assignments Service

**Files:**
- Create: `src/server/services/team-suggest.ts`
- Modify: `src/server/routers/team-member.ts`
- Modify: `src/components/tender/technical-tab-enhanced.tsx`

- [ ] **Step 1: Create the suggestion service**

Create `src/server/services/team-suggest.ts`:

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';
import { db } from '@/lib/db';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

interface Suggestion {
  requirementId: string;
  memberId: string;
  memberName: string;
  score: number;
  reasoning: string;
}

const SUGGEST_PROMPT = `Είσαι ειδικός στελέχωσης ομάδων για δημόσιους διαγωνισμούς (Ν.4412/2016).

Σου δίνω τις ΑΠΑΙΤΗΣΕΙΣ ΡΟΛΩΝ ενός διαγωνισμού και τα ΔΙΑΘΕΣΙΜΑ ΜΕΛΗ της εταιρείας.

Για κάθε απαίτηση, πρότεινε το καλύτερο μέλος. Βαθμολόγησε 0-100.

ΚΡΙΤΗΡΙΑ ΑΝΤΙΣΤΟΙΧΙΣΗΣ:
- Ειδικότητα ταιριάζει με ρόλο
- Εμπειρία >= ελάχιστη απαίτηση
- Πτυχία/πιστοποιήσεις καλύπτουν απαιτούμενα προσόντα
- Εμπειρία σε παρόμοια έργα (κατηγορία, μέγεθος)

Επέστρεψε ΜΟΝΟ JSON array:
[{ "requirementId": "...", "memberId": "...", "memberName": "...", "score": number, "reasoning": "..." }]

Αν κανένα μέλος δεν ταιριάζει σε μια απαίτηση, μην το συμπεριλάβεις.`;

export async function suggestAssignments(
  tenderId: string,
  tenantId: string
): Promise<Suggestion[]> {
  // Fetch requirements
  const requirements = await db.teamRequirement.findMany({
    where: { tenderId },
    orderBy: { createdAt: 'asc' },
  });

  if (requirements.length === 0) return [];

  // Fetch all active members with full data
  const members = await db.teamMember.findMany({
    where: { tenantId, isActive: true },
    include: {
      education: true,
      experience: true,
      certifications: true,
    },
  });

  if (members.length === 0) return [];

  // Build context
  const reqText = requirements
    .map(
      (r) =>
        `ID: ${r.id} | Ρόλος: ${r.role} | Προσόντα: ${r.qualifications || '-'} | Εμπειρία: ${r.minExperience ?? 0}+ χρόνια | Υποχρεωτικό: ${r.isMandatory ? 'Ναι' : 'Όχι'}`
    )
    .join('\n');

  const membersText = members
    .map((m) => {
      const edu = m.education.map((e) => `${e.degree} (${e.institution})`).join(', ');
      const exp = m.experience
        .map((e) => `${e.projectName} [${e.category || '-'}] ρόλος:${e.role} ${e.startYear}-${e.endYear || 'τώρα'}`)
        .join('; ');
      const certs = m.certifications.map((c) => c.name).join(', ');
      return `ID: ${m.id} | Όνομα: ${m.fullName} | Ειδικότητα: ${m.title} | Εμπειρία: ${m.totalExperience}χρ | Σπουδές: ${edu} | Έργα: ${exp} | Πιστοποιήσεις: ${certs}`;
    })
    .join('\n');

  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const result = await model.generateContent([
    { text: SUGGEST_PROMPT },
    { text: `--- ΑΠΑΙΤΗΣΕΙΣ ---\n${reqText}\n\n--- ΜΕΛΗ ---\n${membersText}` },
  ]);

  const response = result.response.text();
  const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, response];
  const jsonStr = jsonMatch[1]?.trim() || response.trim();

  try {
    const suggestions = JSON.parse(jsonStr) as Suggestion[];
    // Validate that member IDs and requirement IDs exist
    const memberIds = new Set(members.map((m) => m.id));
    const reqIds = new Set(requirements.map((r) => r.id));
    return suggestions.filter(
      (s) => memberIds.has(s.memberId) && reqIds.has(s.requirementId)
    );
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: Add suggestAssignments endpoint**

In `src/server/routers/team-member.ts`, add:

```typescript
import { suggestAssignments } from '@/server/services/team-suggest';
```

Add to router:

```typescript
  suggestAssignments: protectedProcedure
    .input(z.object({ tenderId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }
      return suggestAssignments(input.tenderId, ctx.tenantId);
    }),
```

- [ ] **Step 3: Add "Πρότεινε Ομάδα" button in technical tab**

In `src/components/tender/technical-tab-enhanced.tsx`, in the team requirements section header:

```typescript
const suggestMutation = trpc.teamMember.suggestAssignments.useMutation();
const [suggestions, setSuggestions] = useState<Record<string, any>>({});

// Button in the card header:
<Button
  variant="outline"
  size="sm"
  className="cursor-pointer"
  onClick={() => {
    suggestMutation.mutate(
      { tenderId },
      {
        onSuccess: (data) => {
          const map: Record<string, any> = {};
          data.forEach((s) => { map[s.requirementId] = s; });
          setSuggestions(map);
        },
      }
    );
  }}
  disabled={suggestMutation.isPending}
>
  <Users className="h-3.5 w-3.5 mr-1" />
  {suggestMutation.isPending ? t('teamMembers.suggesting') : t('teamMembers.suggestTeam')}
</Button>
```

- [ ] **Step 4: Commit**

```bash
git add src/server/services/team-suggest.ts src/server/routers/team-member.ts src/components/tender/technical-tab-enhanced.tsx
git commit -m "feat(team): add AI-powered team assignment suggestions"
```

---

## Task 11: CV Export Service

**Files:**
- Create: `src/server/services/cv-export.ts`
- Create: `src/lib/cv-templates.ts`
- Modify: `src/server/routers/team-member.ts`

- [ ] **Step 1: Create template definitions**

Create `src/lib/cv-templates.ts`:

```typescript
export const CV_TEMPLATES = {
  europass: {
    id: 'europass',
    labelKey: 'teamMembers.templateEuropass',
  },
  greekPublic: {
    id: 'greekPublic',
    labelKey: 'teamMembers.templateGreekPublic',
  },
  summary: {
    id: 'summary',
    labelKey: 'teamMembers.templateSummary',
  },
} as const;

export type CvTemplateId = keyof typeof CV_TEMPLATES;
```

- [ ] **Step 2: Create the CV export service**

Create `src/server/services/cv-export.ts`:

This service uses the `docx` library to generate DOCX files. It should:

1. Accept `tenderId` and `templateId`
2. Fetch all TeamRequirements with assigned TeamMembers (include education, experience, certifications)
3. For each assigned member, generate a DOCX using the selected template
4. Generate the Πίνακας Στελέχωσης as a separate DOCX
5. Bundle everything in a ZIP using JSZip
6. Upload ZIP to S3
7. Return a download URL

Key implementation:

```typescript
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
} from 'docx';
import JSZip from 'jszip';
import { db } from '@/lib/db';
import { uploadFile, getSignedUrl } from '@/lib/s3';
import type { CvTemplateId } from '@/lib/cv-templates';

// Three template builders:
// buildEuropassCv(member) → Document
// buildGreekPublicCv(member) → Document
// buildSummaryCv(member) → Document
// buildStaffingTable(assignments) → Document

export async function exportCvs(
  tenderId: string,
  tenantId: string,
  templateId: CvTemplateId
): Promise<{ downloadUrl: string; fileName: string }> {
  // 1. Fetch assigned team
  const requirements = await db.teamRequirement.findMany({
    where: { tenderId, assignedMemberId: { not: null } },
    include: {
      assignedMember: {
        include: { education: true, experience: true, certifications: true },
      },
    },
  });

  if (requirements.length === 0) {
    throw new Error('NO_ASSIGNMENTS');
  }

  const zip = new JSZip();

  // 2. Generate individual CVs
  for (const req of requirements) {
    const member = req.assignedMember!;
    let doc: Document;

    switch (templateId) {
      case 'europass':
        doc = buildEuropassCv(member, req.role);
        break;
      case 'greekPublic':
        doc = buildGreekPublicCv(member, req.role);
        break;
      case 'summary':
        doc = buildSummaryCv(member, req.role);
        break;
    }

    const buffer = await Packer.toBuffer(doc);
    const safeName = member.fullName.replace(/\s+/g, '_');
    zip.file(`CVs/${safeName}_CV.docx`, buffer);
  }

  // 3. Generate staffing table
  const staffingDoc = buildStaffingTable(requirements);
  const staffingBuffer = await Packer.toBuffer(staffingDoc);
  zip.file('Πίνακας_Στελέχωσης.docx', staffingBuffer);

  // 4. Bundle and upload
  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
  const key = `exports/${tenantId}/${Date.now()}_team_cvs.zip`;
  await uploadFile(key, zipBuffer, 'application/zip');
  const downloadUrl = await getSignedUrl(key);

  return { downloadUrl, fileName: 'team_cvs.zip' };
}
```

Each template builder creates a `Document` with appropriate formatting. The engineer should implement:

- **Europass**: Title section with name/title, then structured sections (Personal Information, Education, Experience, Certifications) with the standard Europass two-column layout
- **Greek Public**: Table-based format with clear section headers (ΣΠΟΥΔΕΣ, ΕΠΑΓΓΕΛΜΑΤΙΚΗ ΕΜΠΕΙΡΙΑ, ΠΙΣΤΟΠΟΙΗΣΕΙΣ)
- **Summary**: Single-page format with name/title header and bullet points for key qualifications
- **Staffing Table**: Single table with columns: Α/Α, Ονοματεπώνυμο, Ρόλος στο Έργο, Ειδικότητα, Έτη Εμπειρίας, Σπουδές

- [ ] **Step 3: Add exportCvs endpoint**

In `src/server/routers/team-member.ts`, add:

```typescript
import { exportCvs } from '@/server/services/cv-export';
import { CV_TEMPLATES } from '@/lib/cv-templates';
```

Add to router:

```typescript
  exportCvs: protectedProcedure
    .input(z.object({
      tenderId: z.string().cuid(),
      templateId: z.enum(['europass', 'greekPublic', 'summary']),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      try {
        return await exportCvs(input.tenderId, ctx.tenantId, input.templateId);
      } catch (err: any) {
        if (err.message === 'NO_ASSIGNMENTS') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'No team members assigned to this tender.',
          });
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'CV export failed.',
        });
      }
    }),
```

- [ ] **Step 4: Add export button to technical tab**

In `src/components/tender/technical-tab-enhanced.tsx`, add an export button in the team section:

```typescript
const [exportDialogOpen, setExportDialogOpen] = useState(false);
const [selectedTemplate, setSelectedTemplate] = useState<string>('greekPublic');
const exportMutation = trpc.teamMember.exportCvs.useMutation();

// Button:
<Button
  variant="outline"
  size="sm"
  className="cursor-pointer"
  onClick={() => setExportDialogOpen(true)}
  disabled={!hasAssignedMembers}
  title={!hasAssignedMembers ? t('teamMembers.assignTeamFirst') : undefined}
>
  <FileDown className="h-3.5 w-3.5 mr-1" />
  {t('teamMembers.exportCvs')}
</Button>

// Dialog with template selection:
<Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
  <DialogContent className="sm:max-w-[400px]">
    <DialogHeader>
      <DialogTitle>{t('teamMembers.exportCvs')}</DialogTitle>
    </DialogHeader>
    <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
      <SelectTrigger className="cursor-pointer">
        <SelectValue placeholder={t('teamMembers.selectTemplate')} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="europass">{t('teamMembers.templateEuropass')}</SelectItem>
        <SelectItem value="greekPublic">{t('teamMembers.templateGreekPublic')}</SelectItem>
        <SelectItem value="summary">{t('teamMembers.templateSummary')}</SelectItem>
      </SelectContent>
    </Select>
    <DialogFooter>
      <Button
        className="cursor-pointer"
        onClick={() => {
          exportMutation.mutate(
            { tenderId, templateId: selectedTemplate as any },
            {
              onSuccess: (data) => {
                window.open(data.downloadUrl, '_blank');
                setExportDialogOpen(false);
                toast({ title: t('common.success'), description: t('teamMembers.exportReady') });
              },
              onError: (err) => {
                toast({ title: t('common.error'), description: err.message, variant: 'destructive' });
              },
            }
          );
        }}
        disabled={exportMutation.isPending}
      >
        {exportMutation.isPending ? t('teamMembers.exporting') : t('teamMembers.exportCvs')}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

- [ ] **Step 5: Commit**

```bash
git add src/server/services/cv-export.ts src/lib/cv-templates.ts src/server/routers/team-member.ts src/components/tender/technical-tab-enhanced.tsx
git commit -m "feat(team): add CV export with Europass, Greek Public, Summary templates + staffing table"
```

---

## Task 12: Final Integration & Build Verification

**Files:**
- All files from previous tasks

- [ ] **Step 1: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 2: Run build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Run existing tests**

```bash
npx vitest run
```

Expected: All existing tests still pass.

- [ ] **Step 4: Manual smoke test**

1. Navigate to `/company` → verify "Ομάδα Έργου" tab appears
2. Click tab → verify empty state shows
3. Click "Νέο Μέλος" → verify Sheet opens with all sections
4. Fill basic info + add education entry + add experience entry → Save → verify member appears in list
5. Click member → verify Sheet opens with saved data
6. Navigate to a tender → Technical tab → verify Combobox dropdown appears in team table
7. Select a member from dropdown → verify assignment saves

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix(team): integration fixes from smoke testing"
```

---

## Dependency Graph

```
Task 1 (Schema)
  ↓
Task 2 (Zod Schemas)
  ↓
Task 3 (Router CRUD) ←── Task 4 (i18n) [parallel]
  ↓
Task 5 (List Component) + Task 6 (Sheet Component) [parallel]
  ↓
Task 7 (Company Page Tab)
  ↓
Task 8 (CV Parser) ←── integrates into Sheet from Task 6
  ↓
Task 9 (Assignment Cell + Tech Tab)
  ↓
Task 10 (Suggest Service)
  ↓
Task 11 (Export Service)
  ↓
Task 12 (Integration)
```

Tasks 4 (i18n) can run in parallel with Task 3.
Tasks 5 and 6 can run in parallel.
All other tasks are sequential.
