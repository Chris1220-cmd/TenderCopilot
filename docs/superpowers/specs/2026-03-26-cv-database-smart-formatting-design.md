# Feature 8: CV Database & Smart Formatting — Design Spec

**Date:** 2026-03-26
**Status:** Approved
**Author:** Christos Athanasopoulos + Claude

## Summary

Κεντρική βάση βιογραφικών ομάδας έργου. Upload CV → AI parse → structured storage → assign σε διαγωνισμούς → export formatted CVs + Πίνακας Στελέχωσης.

## Decisions

| Ερώτηση | Απόφαση |
|---------|---------|
| Location | `/company` — tab "Ομάδα Έργου" |
| Data model | Normalized (Approach B) — separate tables per data category |
| CV parsing | Smart — AI parse → auto-fill → user confirms/corrects |
| CV formatting | 3 CV templates (Europass, Ελληνικό Δημόσιο, Συνοπτικό) + Πίνακας Στελέχωσης |
| Assignment | Suggested + manual — AI proposes best matches, user decides |
| Tracking | Basic — list of tenders per member (read-only) |

---

## 1. Data Model

### TeamMember

| Field | Type | Purpose |
|-------|------|---------|
| id | String @id @default(cuid()) | Primary key |
| fullName | String | Ονοματεπώνυμο |
| title | String | Ειδικότητα ("Πολιτικός Μηχανικός") |
| email | String? | Προαιρετικό |
| phone | String? | Προαιρετικό |
| totalExperience | Int | Συνολικά χρόνια εμπειρίας |
| bio | Text? | Σύντομο professional summary |
| cvFileKey | String? | S3 key αρχείου CV |
| cvFileName | String? | Όνομα αρχείου |
| isActive | Boolean @default(true) | Ενεργό μέλος ή όχι |
| tenantId | → Tenant | Tenant isolation |
| createdAt | DateTime | Auto |
| updatedAt | DateTime | Auto |

**Indexes:** `@@index([tenantId])`

### TeamMemberEducation

| Field | Type | Purpose |
|-------|------|---------|
| id | String @id | Primary key |
| degree | String | "Δίπλωμα Πολιτικού Μηχανικού" |
| institution | String | "ΕΜΠ" |
| year | Int? | Έτος αποφοίτησης |
| memberId | → TeamMember | Parent relation |

### TeamMemberExperience

| Field | Type | Purpose |
|-------|------|---------|
| id | String @id | Primary key |
| projectName | String | "Μελέτη Οδοποιίας Ε.Ο. Πατρών-Πύργου" |
| client | String | "Περιφέρεια Δυτικής Ελλάδας" |
| role | String | "Υπεύθυνος Μελέτης" |
| budget | Decimal? | Προϋπολογισμός έργου |
| startYear | Int | Από |
| endYear | Int? | Έως (null = τρέχον) |
| description | Text? | Σύντομη περιγραφή συμμετοχής |
| category | String? | Κατηγορία μελέτης (Οδοποιία, Υδραυλικά κτλ) |
| memberId | → TeamMember | Parent relation |

### TeamMemberCertification

| Field | Type | Purpose |
|-------|------|---------|
| id | String @id | Primary key |
| name | String | "PMP", "Μελετητικό Πτυχίο Β'" |
| issuer | String | "PMI", "ΤΕΕ" |
| issueDate | DateTime? | Ημ. έκδοσης |
| expiryDate | DateTime? | Ημ. λήξης (null = δεν λήγει) |
| memberId | → TeamMember | Parent relation |

### TeamRequirement (existing — modified)

New field:
- `assignedMemberId` — Optional FK → TeamMember

Existing `mappedStaffName` remains for backward compatibility. Auto-populated from `TeamMember.fullName` when assignment happens.

---

## 2. UI & Flows

### 2.1 Company Page — Tab "Ομάδα Έργου"

**List view:**
- Cards/table: Όνομα, Ειδικότητα, Χρόνια εμπειρίας, # πιστοποιήσεις, # active tender assignments, Active/Inactive badge
- Κουμπί "Νέο Μέλος"
- Search box (no faceted filters — 10-20 members don't need them)
- Same pattern as certificates-list

**Member profile** (click → **large Sheet/Drawer**, not Dialog — too much data for Dialog):
- Βασικά στοιχεία (form)
- Εκπαίδευση (repeatable add/edit/remove entries)
- Εμπειρία Έργων (repeatable entries)
- Πιστοποιήσεις (repeatable entries)
- Upload CV section
- "Προτάθηκε σε:" list (read-only, auto-derived from TeamRequirement assignments)

### 2.2 CV Upload & AI Parse Flow

```
1. User clicks "Ανέβασμα CV"
2. File uploads to S3 via existing /api/upload → returns fileKey
3. User clicks "Ανάλυση CV"
4. Client calls tRPC teamMember.parseCv({ fileKey })
5. Server downloads from S3, extracts text (pdf-parse / mammoth)
6. Server sends text to Gemini → returns structured JSON
7. Client auto-fills form fields
8. User reviews, corrects, saves
```

**Fallbacks:**
- Scanned PDF (no extractable text) → message: "Δεν βρέθηκε κείμενο — ανέβασε PDF με κείμενο ή DOCX"
- AI parse fails → message: "Δεν μπόρεσε να αναλυθεί αυτόματα, συμπλήρωσε χειροκίνητα"
- User can always skip AI parse and fill manually

### 2.3 Tender Technical Tab — Team Assignment

Current state: text input for `mappedStaffName` → replaced with:

- **Combobox dropdown** per TeamRequirement → shows members: name + title + years experience
- **"Πρότεινε Ομάδα" button** (on-demand, not auto):
  - Runs AI matching once
  - Shows suggestions as badges next to each requirement: "Προτείνεται: Γιάννης Κ." + reasoning
  - Suggestions held in client state (ephemeral, not stored in DB)
- **Info warning** if a member is already assigned to another active tender (non-blocking)
- Assignment updates `assignedMemberId` + auto-fills `mappedStaffName`

### 2.4 CV Export / Smart Formatting

Location: Tender detail page (after team is assigned)

- Κουμπί "Εξαγωγή CVs Ομάδας"
- Template selection: Europass | Ελληνικό Δημόσιο | Συνοπτικό
- Generates:
  - **Individual CVs** — one DOCX per assigned member, in selected template
  - **Πίνακας Στελέχωσης** — one DOCX, summary table: Α/Α, Ονοματεπώνυμο, Ρόλος στο Έργο, Ειδικότητα, Εμπειρία, Σπουδές
- Output: ZIP bundle (same pattern as package assembly — generate → store S3 → return download URL)
- Disabled if no members assigned, tooltip: "Ανάθεσε ομάδα πρώτα"

---

## 3. Backend & AI

### 3.1 tRPC Router: `teamMember`

| Endpoint | Type | Description |
|----------|------|-------------|
| `list` | Query | Λίστα μελών + count relations + count active assignments |
| `getById` | Query | Πλήρες μέλος + education[] + experience[] + certifications[] + tender assignments[] |
| `create` | Mutation | Νέο μέλος με nested create (education[], experience[], certs[]) |
| `update` | Mutation | Update μέλος + upsert nested entries |
| `delete` | Mutation | Soft delete (isActive=false) if has assignments, hard delete otherwise |
| `parseCv` | Mutation | Input: fileKey → download from S3 → extract text → AI parse → return structured JSON (does NOT save) |
| `suggestAssignments` | Mutation | Input: tenderId → compare all active members against TeamRequirements → return suggestions[] |
| `assignToRequirement` | Mutation | Input: { requirementId, memberId } → link TeamMember ↔ TeamRequirement |
| `unassignFromRequirement` | Mutation | Input: { requirementId } → clear assignment |
| `exportCvs` | Mutation | Input: { tenderId, templateId } → generate DOCX files → ZIP → S3 → return download URL |

### 3.2 AI Parse Service

**Input:** fileKey (S3 reference)
**Process:**
1. Download file from S3
2. Extract text: `pdf-parse` for PDF, `mammoth` for DOCX
3. If no text extracted → return error (scanned PDF)
4. Send to Gemini with structured extraction prompt:

```
Ανέλυσε αυτό το βιογραφικό και εξήγαγε σε JSON:
{
  "fullName": "...",
  "title": "...",
  "totalExperience": number,
  "education": [{ "degree": "...", "institution": "...", "year": number }],
  "experience": [{ "projectName": "...", "client": "...", "role": "...", "budget": number|null, "startYear": number, "endYear": number|null, "description": "...", "category": "..." }],
  "certifications": [{ "name": "...", "issuer": "...", "issueDate": "...", "expiryDate": "..." }]
}
```

**Output:** Structured JSON → client uses to auto-fill form
**Note:** Does NOT save to DB. Client receives data, user reviews, then saves via `create` or `update`.

### 3.3 AI Suggest Assignments Service

**Input:** tenderId
**Process:**
1. Fetch all TeamRequirements for tender
2. Fetch all active TeamMembers + education + experience + certifications
3. Send to Gemini: "Match members to requirements, explain reasoning, score 0-100"
4. Return array of suggestions per requirement

**Output per requirement:**
```json
{
  "requirementId": "...",
  "suggestions": [
    { "memberId": "...", "memberName": "...", "score": 85, "reasoning": "Πολιτικός Μηχ. με 8 χρόνια σε οδοποιία" }
  ]
}
```

**Not stored in DB** — ephemeral, held in client state.

### 3.4 CV Export Service

Uses `docx` library (already in project) + `JSZip` (already in project).

**CV Templates (per member):**
- **Europass:** EU standard format — sidebar layout, structured sections, specific styling
- **Ελληνικό Δημόσιο:** Clean table-based format — Σπουδές, Εμπειρία, Πιστοποιήσεις sections
- **Συνοπτικό:** One-page summary — key qualifications and experience only

**Team Deliverable:**
- **Πίνακας Στελέχωσης:** Single DOCX, one table — all assigned members summarized (always included in export)

**Flow:** Generate DOCX files → bundle in ZIP → upload to S3 → return presigned download URL.

---

## 4. i18n

New top-level key `teamMembers` in `messages/el.json` and `messages/en.json`.

Key translations include: title, newMember, editMember, education, experience, certifications, uploadCv, parseCv, parseError, parseFallback, suggestTeam, exportCvs, staffingTable, templateEuropass, templateGreekPublic, assignMember, unassign, alreadyAssigned, noMembers, confirmDelete, memberDeactivated, etc.

Same pattern as existing `certificates` / `legalDocs` keys.

---

## 5. Migration Strategy

- **New tables:** TeamMember, TeamMemberEducation, TeamMemberExperience, TeamMemberCertification
- **Modified table:** TeamRequirement gains `assignedMemberId` (optional FK → TeamMember)
- **Existing data:** `mappedStaffName` values remain untouched. No automatic migration of text names → TeamMember records. Users build up the database gradually and re-assign.

---

## 6. Edge Cases

| Case | Handling |
|------|----------|
| Delete member with active assignments | Soft delete (isActive=false), assignments remain visible |
| Upload scanned PDF | Error message: "Ανέβασε PDF με κείμενο ή DOCX" |
| AI parse returns bad data | User always reviews before saving — no auto-save |
| Same member assigned to 2+ active tenders | Allowed + info warning (non-blocking) |
| Export with no assigned members | Button disabled, tooltip: "Ανάθεσε ομάδα πρώτα" |
| Re-upload new CV | Prompt: "Θέλεις να ενημερωθούν τα στοιχεία από το νέο CV;" |
| Tenant isolation | All queries filter by `ctx.tenantId` |
| Member with expired certification | Show visual indicator (same pattern as certificate tracker) |
