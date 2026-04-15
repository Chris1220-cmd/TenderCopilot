# TenderCopilot Alpha Testing Guide

Welcome — thank you for testing TenderCopilot before public launch.

---

## What Works Today

### For Greek companies (GR)
- **Discovery feed** — live scraping from KIMDIS, Diavgeia, ESIDIS, TED, and 22 other sources
- **Tender analysis** — AI reads your uploaded PDF and extracts requirements, deadlines, CPV codes
- **Compliance check** — matches your certificates and documents against tender requirements
- **AI chat assistant** — ask questions about any tender in your list
- **Document upload** — supports PDF (text-based and scanned via AI)
- **Deadline tracking** — calendar view with submission countdown

### For Dutch companies (NL)
- **TenderNed feed** — live data from the official Dutch procurement portal
- **Dutch legal context** — AI references Aanbestedingswet 2012, Gids Proportionaliteit
- **Dutch tender analysis** — CPV codes, social-return clauses, duurzaamheid requirements
- **Full compliance engine** — same functionality as the Greek module

### Multi-country (GR + NL tenants)
- **Country switcher** in the top navigation bar (appears only when you have access to 2+ countries)
- **Per-country discovery tabs** — GR and NL feeds shown separately
- **Active country badge** — amber pill indicates when your active context differs from your primary country

---

## How to Test

### 1. Basic signup / login
1. Go to `/register` and create an account
2. Fill in: full name, email, password (8+ chars), company name
3. Log in at `/login`

### 2. Browse tenders
1. Dashboard → Tenders
2. Use the search bar and filters (country, deadline, status)
3. Click any tender to see the detail view

### 3. Upload a tender document
1. Open a tender → Documents tab
2. Upload a PDF (procurement specification or terms)
3. Wait ~10–30 seconds for parsing
4. Click "Ανάλυση" to trigger AI analysis

### 4. Check compliance
1. First set up your company profile: Settings → Company Profile
2. Add KAD codes, certificates, legal documents
3. Open an analyzed tender → Compliance tab
4. Review the match/gap report

### 5. Country switching (multi-country tenants only)
1. Look for the country flag dropdown in the top-right navigation
2. Switch between GR and NL
3. The discovery feed and AI context switch accordingly

---

## Known Limitations (Alpha)

| Area | Status |
|------|--------|
| Google sign-in | Configured but not tested in production — use email/password |
| Magic link email | Requires valid SMTP config — may not send in alpha |
| Document AI OCR | Fallback to Gemini Vision — works but ~40s for scanned PDFs |
| 11 minor scraper sources | Return 0 results (DEI, DEPA, ANAC, isupplies) — main sources work fine |
| Belgian / French sources | BOAMP/OJEU in feed but UI shows GR/NL tabs only |
| Mobile layout | Functional but not optimized — desktop recommended |
| Password reset | `/forgot-password` page exists but email delivery depends on SMTP |

---

## Reporting Issues

Please report bugs with:
1. What you were doing
2. What you expected to happen
3. What actually happened
4. Screenshot if possible

Send to: [your feedback channel]

---

## What's Coming Next

- Certificate validity tracker with expiry alerts
- Smart document assembly (auto-generate proposal sections)
- Backward deadline planner
- Subscription plans + billing

---

*Build: main branch — last updated 2026-04-15*
