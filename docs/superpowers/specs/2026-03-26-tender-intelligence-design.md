# Feature 6: Tender Intelligence Panel

## Concept

Panel στο Overview tab (δίπλα στο Go/No-Go) που αυτόματα ψάχνει παρόμοιους διαγωνισμούς από δύο πηγές (δικά σου data + ΔΙΑΥΓΕΙΑ/ΚΗΜΔΗΣ), βρίσκει ποιος κερδίζει, τι τιμές δίνονται, πώς συμπεριφέρεται η αναθέτουσα αρχή, και δίνει AI συμβουλές.

## Where It Lives

Overview tab, στο grid δίπλα στο GoNoGoPanel. Compact panel, expandable sections.

## Data Sources

### A. Δικά σου δεδομένα (TenderOutcome — υπάρχει ήδη)
- Παλιοί διαγωνισμοί με outcome (won/lost/withdrew)
- bidAmount, winAmount, reason, lessons
- Match με CPV codes, budget range, contracting authority

### B. ΔΙΑΥΓΕΙΑ API (υπάρχει ήδη στο tender-discovery.ts)
- Endpoint: `https://diavgeia.gov.gr/luminapi/opendata/search`
- Τώρα ψάχνει ΔΙΑΚΗΡΥΞΗ/ΠΡΟΚΗΡΥΞΗ — πρέπει να ψάξουμε και ΚΑΤΑΚΥΡΩΣΗ/ΑΝΑΘΕΣΗ
- Τα award decisions περιέχουν: νικητής, ποσό κατακύρωσης, αναθέτουσα αρχή, ADA
- Rate limit: none documented, use 8s timeout

### C. ΚΗΜΔΗΣ API (υπάρχει ήδη στο tender-discovery.ts)
- Endpoint: `https://cerpp.eprocurement.gov.gr/khmdhs-opendata/notice`
- POST with body filters (cpvCodes, etc.)
- Rate limit: 350 req/min
- Award notices include: winner, amount, number of bids

## Intelligence Components

### 1. Similar Tenders (Market Data)
Αναζήτηση παρόμοιων κατακυρώσεων:
- Match by CPV codes (primary)
- Filter by budget range (±50%)
- Filter by last 2 years
- From both ΔΙΑΥΓΕΙΑ (ΚΑΤΑΚΥΡΩΣΗ decisions) and ΚΗΜΔΗΣ (award notices)

Returns: list of awards with winner name, amount, authority, date

### 2. Competitor Profiles
Aggregation από τα similar tenders:
- Ποιες εταιρείες κερδίζουν (name, frequency, average price)
- Top 5 competitors sorted by win frequency
- Price patterns per competitor (average discount from budget)

### 3. Contracting Authority Profile
Aggregation από ΔΙΑΥΓΕΙΑ/ΚΗΜΔΗΣ φιλτραρισμένο στη συγκεκριμένη αναθέτουσα αρχή:
- Πόσους διαγωνισμούς έκανε (last 2 years)
- Cancellation rate (ακυρώσεις / σύνολο)
- Average award discount (τιμή κατακύρωσης vs budget)
- Typical number of bidders
- Most frequent winners

### 4. Repeat Tender Detection
Αναζήτηση στη ΔΙΑΥΓΕΙΑ/ΚΗΜΔΗΣ + δικά σου data:
- Same contracting authority + same/similar CPV + similar budget = possible re-run
- Also fuzzy match on title keywords
- If found: show previous outcome, winner, price

### 5. Preparation Time Estimate
Από δικά σου TenderOutcome + Tender.createdAt → submissionDeadline:
- Average working days you spent on similar tenders
- Compare with current deadline
- Flag if tight: "12 εργάσιμες διαθέσιμες, μέσος χρόνος σε παρόμοιους: 15 — tight"

### 6. AI Advisory
AI synthesizes all of the above into 3-5 actionable bullet points:
- Pricing guidance based on market data
- Risk flags from authority profile
- Lessons from your own history
- Re-run intelligence if applicable
- Time pressure assessment

## Data Model

### New: TenderIntelligence (cached results)

```prisma
model TenderIntelligence {
  id        String   @id @default(cuid())
  tenderId  String   @unique
  tender    Tender   @relation(fields: [tenderId], references: [id], onDelete: Cascade)

  // Cached results
  similarAwards    Json?    // [{winner, amount, authority, date, source, cpv}]
  competitors      Json?    // [{name, wins, avgAmount, avgDiscount}]
  authorityProfile Json?    // {totalTenders, cancellationRate, avgDiscount, avgBidders, topWinners}
  repeatTender     Json?    // {found: boolean, previousWinner, previousAmount, previousDate, tenderId?}
  prepTimeEstimate Json?    // {avgDays, currentDaysLeft, isTight}
  aiAdvisory       Json?    // {bullets: string[], language: string}

  fetchedAt  DateTime  @default(now())  // cache timestamp
  language   String    @default("el")

  @@index([tenderId])
}
```

Add relation to Tender model:
```prisma
  intelligence TenderIntelligence?
```

## AI Service: `ai-tender-intelligence.ts`

### Method: `generateIntelligence(tenderId, tenantId, language)`

Steps:
1. Load tender (CPV, budget, authority, submissionDeadline)
2. Fetch similar awards from ΔΙΑΥΓΕΙΑ (ΚΑΤΑΚΥΡΩΣΗ/ΑΝΑΘΕΣΗ by CPV)
3. Fetch similar awards from ΚΗΜΔΗΣ (award notices by CPV)
4. Query own TenderOutcome (same CPV or authority)
5. Aggregate competitor data
6. Build authority profile
7. Detect repeat tenders (fuzzy match title + authority + CPV)
8. Calculate prep time from own history
9. Send all data to AI for advisory synthesis
10. Cache in TenderIntelligence

### ΔΙΑΥΓΕΙΑ Award Search
Reuse existing pattern from `tender-discovery.ts` but with different search terms:
```typescript
const searchTerms = ['ΚΑΤΑΚΥΡΩΣΗ', 'ΑΝΑΘΕΣΗ', 'ΑΠΕΥΘΕΙΑΣ_ΑΝΑΘΕΣΗ'];
```
Parse from decision text: winner name, award amount.

### ΚΗΜΔΗΣ Award Search
Same API but filter for award notice types (not procurement notices).

### Cache Strategy
- Cache for 24 hours (awards don't change frequently)
- `fetchedAt` field tracks freshness
- "Ανανέωση" button forces re-fetch
- Auto-fetch on first load if no cache exists

## tRPC Endpoints

```typescript
getIntelligence: protectedProcedure
  .input(z.object({ tenderId: z.string() }))
  .query(...)  // Return cached or null

generateIntelligence: protectedProcedure
  .input(z.object({ tenderId: z.string(), language: z.enum(['el', 'en']).default('el') }))
  .mutation(...)  // Fetch, analyze, cache, return
```

## UI: `TenderIntelligencePanel` Component

### Location
Overview tab grid, same row as GoNoGoPanel:
```tsx
<div className="grid gap-4 lg:grid-cols-2">
  <AIBriefPanel ... />
  <GoNoGoPanel ... />
</div>
<div className="grid gap-4 lg:grid-cols-2">
  <TenderIntelligencePanel tenderId={tenderId} />
  {/* space for future panel or span full width */}
</div>
```

### States

**Empty/Loading**: Skeleton with "Ανάλυση αγοράς..." spinner

**No data**: "Δεν βρέθηκαν παρόμοιοι διαγωνισμοί" — still shows prep time if own history exists

**Results**: Compact card with expandable sections:

1. **Header**: "Intelligence" + count of similar tenders + refresh button
2. **Market Overview** (always visible): similar count, avg award price, price range
3. **Competitors** (expandable): top 5 names with win count + avg price
4. **Authority Profile** (expandable): cancellation rate, avg discount, avg bidders
5. **Re-run Alert** (if found, highlighted): previous winner + price
6. **Prep Time** (if own history exists): avg days vs available days
7. **AI Συμβουλές** (always visible): 3-5 bullets

### Design Rules
- Card: `bg-card border border-border/60 rounded-xl`
- No purple/violet — Picton Blue #48A4D6 only
- Accent color for warnings (tight deadline, high cancellation rate)
- All text via `t()` i18n
- `cursor-pointer` on expandable sections
- BlurFade entrance

## i18n Keys

```json
{
  "intelligence": {
    "title": "Intelligence",
    "analyze": "Ανάλυση Αγοράς",
    "analyzing": "Ανάλυση αγοράς...",
    "refresh": "Ανανέωση",
    "noData": "Δεν βρέθηκαν παρόμοιοι διαγωνισμοί",
    "similarFound": "{{count}} παρόμοιοι διαγωνισμοί",
    "marketOverview": "Αγορά",
    "avgAwardPrice": "Μέση τιμή κατακύρωσης",
    "priceRange": "Εύρος τιμών",
    "competitors": "Ανταγωνισμός",
    "wins": "νίκες",
    "avgPrice": "μέση τιμή",
    "authorityProfile": "Προφίλ Αναθέτουσας",
    "totalTenders": "Διαγωνισμοί (2 έτη)",
    "cancellationRate": "Ακυρώσεις",
    "avgDiscount": "Μέση έκπτωση",
    "avgBidders": "Μέσος αριθμός προσφορών",
    "repeatAlert": "Επαναληπτικός Διαγωνισμός",
    "previousWinner": "Προηγούμενος νικητής",
    "previousPrice": "Προηγούμενη τιμή",
    "prepTime": "Χρόνος Προετοιμασίας",
    "avgPrepDays": "Μέσος χρόνος σε παρόμοιους",
    "daysAvailable": "Διαθέσιμες εργάσιμες",
    "tight": "Πιεσμένο",
    "comfortable": "Άνετο",
    "aiAdvisory": "AI Συμβουλές",
    "yourHistory": "Δικό σου ιστορικό",
    "winRate": "Win rate",
    "submissions": "υποβολές",
    "errorAnalysis": "Σφάλμα ανάλυσης αγοράς",
    "cachedAt": "Τελευταία ανανέωση"
  }
}
```

## Files to Create/Modify

### New Files
1. `src/server/services/ai-tender-intelligence.ts` — intelligence service
2. `src/components/tender/intelligence-panel.tsx` — UI panel

### Modified Files
3. `prisma/schema.prisma` — TenderIntelligence model + Tender relation
4. `src/server/routers/ai-roles.ts` — getIntelligence + generateIntelligence endpoints
5. `src/app/(dashboard)/tenders/[id]/page.tsx` — add panel to Overview tab
6. `messages/el.json` — intelligence keys
7. `messages/en.json` — intelligence keys

## What This Does NOT Do
- No real-time scraping (cached 24h)
- No modification to existing AI logic
- No modification to existing discovery service (new functions alongside)
- No storage of full competitor company profiles (only aggregated from awards)
