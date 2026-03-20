import { db } from '@/lib/db';
import { ai } from '@/server/ai';
import { readTenderDocuments, requireDocuments } from '@/server/services/document-reader';
import { parseAIResponse } from './ai-prompts';
import type { RequirementCategory, RequirementType, CoverageStatus } from '@prisma/client';

/**
 * AI Technical & Solution Engine — Acts as the Lead Engineer / CTO.
 * Deep-parses technical requirements, maps to company experience,
 * generates technical proposal drafts, identifies technical risks.
 * Specialized in Greek public procurement technical evaluation criteria.
 */

// ─── Types ──────────────────────────────────────────────────

type TechnicalSubtype =
  | 'Functional'
  | 'Performance'
  | 'Interface'
  | 'Standard/Certification'
  | 'Safety'
  | 'Staffing'
  | 'Timeline'
  | 'Deliverable';

interface ClassifiedRequirement {
  requirementId: string;
  subtype: TechnicalSubtype;
  criticality: number; // 1-5
  keywords: string[];
  evaluationWeight?: number;
}

interface ExperienceMatch {
  requirementId: string;
  requirementText: string;
  matches: Array<{
    type: 'project' | 'contentLibrary' | 'certificate';
    id: string;
    title: string;
    confidence: number; // 0-1
    relevantExcerpt: string;
  }>;
  overallConfidence: number;
}

interface RequirementMappingResult {
  requirementId: string;
  mappings: ExperienceMatch['matches'];
  overallConfidence: number;
}

interface ProposalSectionData {
  title: string;
  ordering: number;
  content: string; // markdown
  aiNotes: string;
}

interface TechnicalRiskData {
  title: string;
  description: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  mitigation: string;
  relatedRequirementId?: string;
}

interface ProposalStrengthBreakdown {
  criterion: string;
  weight: number;
  estimatedScore: number;
  notes: string;
}

interface ProposalStrengthResult {
  estimatedScore: number; // 0-120
  breakdown: ProposalStrengthBreakdown[];
}

// ─── Greek Proposal Section Config ──────────────────────────

const PROPOSAL_SECTIONS: Array<{ title: string; ordering: number; promptContext: string }> = [
  {
    title: 'Κατανόηση Αντικειμένου',
    ordering: 1,
    promptContext: `Understanding of Requirements (Κατανόηση Αντικειμένου):
Αναλυτική περιγραφή κατανόησης του αντικειμένου του διαγωνισμού.
Περιλαμβάνει: αναγνώριση βασικών στόχων, πεδίο εφαρμογής, ωφελούμενοι,
κρίσιμα σημεία, σύνδεση με ευρύτερο πλαίσιο (θεσμικό, τεχνολογικό).
Δείξε ότι η εταιρεία κατανοεί βαθιά τις ανάγκες του φορέα.`,
  },
  {
    title: 'Μεθοδολογία Υλοποίησης',
    ordering: 2,
    promptContext: `Implementation Methodology (Μεθοδολογία Υλοποίησης):
Αναλυτική μεθοδολογία υλοποίησης βήμα-βήμα. Περιλαμβάνει:
φάσεις έργου, πακέτα εργασίας, παραδοτέα ανά φάση, milestones,
εργαλεία και τεχνικές, πρότυπα που ακολουθούνται (ISO, PRINCE2, Agile).
Σύνδεσε κάθε φάση με τις απαιτήσεις του διαγωνισμού.`,
  },
  {
    title: 'Ομάδα Έργου',
    ordering: 3,
    promptContext: `Project Team (Ομάδα Έργου):
Παρουσίαση ομάδας έργου: ρόλοι, αρμοδιότητες, προσόντα,
εμπειρία σε σχετικά έργα. Οργανόγραμμα, αναφορές,
μηχανισμός αντικατάστασης, εκπαίδευση ομάδας.
Σύνδεσε τα προσόντα της ομάδας με τις απαιτήσεις στελέχωσης.`,
  },
  {
    title: 'Χρονοδιάγραμμα',
    ordering: 4,
    promptContext: `Timeline / Gantt (Χρονοδιάγραμμα):
Αναλυτικό χρονοδιάγραμμα υλοποίησης σε μορφή Gantt (text-based).
Φάσεις, πακέτα εργασίας, διάρκεια, εξαρτήσεις, milestones,
κρίσιμη διαδρομή (critical path). Αντιστοίχιση με τα παραδοτέα.
Περίοδοι overlap, buffer χρόνοι, σημεία ελέγχου.`,
  },
  {
    title: 'Διαχείριση Κινδύνων',
    ordering: 5,
    promptContext: `Risk Management (Διαχείριση Κινδύνων):
Πλαίσιο διαχείρισης κινδύνων: μεθοδολογία αναγνώρισης,
μητρώο κινδύνων (risk register), πιθανότητα x επίπτωση,
μέτρα αντιμετώπισης, contingency plans, escalation matrix.
Συγκεκριμένοι κίνδυνοι σχετικοί με το αντικείμενο.`,
  },
  {
    title: 'Διασφάλιση Ποιότητας',
    ordering: 6,
    promptContext: `Quality Assurance (Διασφάλιση Ποιότητας):
Σχέδιο Διασφάλισης Ποιότητας: πρότυπα ISO, μετρήσιμοι δείκτες (KPIs),
διαδικασίες ελέγχου, εσωτερικές επιθεωρήσεις, ανασκοπήσεις,
testing methodology, acceptance criteria, corrective actions,
continuous improvement. Σύνδεση με πιστοποιήσεις εταιρείας.`,
  },
  {
    title: 'Υποστήριξη & Εγγύηση',
    ordering: 7,
    promptContext: `Support & Warranty (Υποστήριξη & Εγγύηση):
Πλαίσιο υποστήριξης: SLA, χρόνοι απόκρισης, help desk,
εγγύηση καλής λειτουργίας, συντήρηση, εκπαίδευση χρηστών,
τεκμηρίωση, knowledge transfer, μεταφορά τεχνογνωσίας.
Υπηρεσίες μετά τη λήξη σύμβασης.`,
  },
];

// ─── Service ────────────────────────────────────────────────

class AITechnicalService {
  // ── analyzeTechnicalRequirements ───────────────────────────

  /**
   * Classifies each TECHNICAL_REQUIREMENTS requirement into subtypes:
   * Functional, Performance, Interface, Standard/Certification, Safety,
   * Staffing, Timeline, Deliverable. Sets criticality 1-5.
   */
  async analyzeTechnicalRequirements(tenderId: string, language: 'el' | 'en' = 'el'): Promise<ClassifiedRequirement[]> {
    await requireDocuments(tenderId);
    const requirements = await db.tenderRequirement.findMany({
      where: {
        tenderId,
        category: 'TECHNICAL_REQUIREMENTS',
      },
    });

    if (requirements.length === 0) {
      return [];
    }

    const tender = await db.tender.findUniqueOrThrow({
      where: { id: tenderId },
    });

    const documentText = await readTenderDocuments(tenderId);

    // Language instruction
    const langInstruction = language === 'en'
      ? 'Respond entirely in English.'
      : 'Απάντησε εξ ολοκλήρου στα ελληνικά.';

    const result = await ai().complete({
      messages: [
        {
          role: 'system',
          content: `Είσαι Τεχνικός Διευθυντής (CTO) με ειδίκευση σε ελληνικούς δημόσιους διαγωνισμούς.

ΡΟΛΟΣ: Ταξινόμηση τεχνικών απαιτήσεων σε υποκατηγορίες και αξιολόγηση κρισιμότητας.

Για κάθε απαίτηση, προσδιόρισε:

**subtype** — μία από:
- "Functional": Λειτουργικές απαιτήσεις (τι πρέπει να κάνει το σύστημα/έργο)
- "Performance": Απαιτήσεις επίδοσης (SLAs, χρόνοι, throughput, διαθεσιμότητα)
- "Interface": Διεπαφές, ενοποιήσεις, APIs, διαλειτουργικότητα
- "Standard/Certification": Πρότυπα, πιστοποιήσεις (ISO, EN, κ.λπ.)
- "Safety": Ασφάλεια, GDPR, κυβερνοασφάλεια, υγεία & ασφάλεια
- "Staffing": Προσωπικό, ρόλοι, προσόντα, εμπειρία
- "Timeline": Χρονοδιαγράμματα, παραδοτέα, milestones
- "Deliverable": Παραδοτέα, τεκμηρίωση, εκπαίδευση

**criticality** (1-5):
- 5: Κριτική/αποκλειστική — αποτυχία = αποκλεισμός
- 4: Πολύ σημαντική — βαρύ βάρος στην αξιολόγηση
- 3: Σημαντική — μέτριο βάρος
- 2: Επιθυμητή — χαμηλό βάρος
- 1: Προαιρετική — bonus

**keywords**: Λέξεις-κλειδιά για matching με εμπειρία εταιρείας

**evaluationWeight**: Εκτιμώμενο βάρος στην αξιολόγηση (0-100)

ΜΟΡΦΗ ΑΠΑΝΤΗΣΗΣ: JSON array:
[{
  "requirementId": "string",
  "subtype": "Functional" | "Performance" | "Interface" | "Standard/Certification" | "Safety" | "Staffing" | "Timeline" | "Deliverable",
  "criticality": 1-5,
  "keywords": ["string", ...],
  "evaluationWeight": number | null
}]

${langInstruction}`,
        },
        {
          role: 'user',
          content: JSON.stringify({
            tenderTitle: tender.title,
            awardCriteria: tender.awardCriteria,
            documentText,
            requirements: requirements.map((r) => ({
              id: r.id,
              text: r.text,
              mandatory: r.mandatory,
              articleReference: r.articleReference,
            })),
          }),
        },
      ],
      maxTokens: 8000,
      temperature: 0.1,
      responseFormat: 'json',
    });

    let classified: ClassifiedRequirement[];
    try {
      const parsed = parseAIResponse<ClassifiedRequirement[] | { requirements: ClassifiedRequirement[] }>(result.content, [], 'analyzeTechnicalRequirements');
      classified = Array.isArray(parsed) ? parsed : parsed.requirements || [];
    } catch {
      throw new Error('Η AI ανάλυση τεχνικών απαιτήσεων απέτυχε. Δοκιμάστε ξανά.');
    }

    // Update DB with criticality
    for (const item of classified) {
      const reqExists = requirements.find((r) => r.id === item.requirementId);
      if (reqExists) {
        await db.tenderRequirement.update({
          where: { id: item.requirementId },
          data: {
            criticality: Math.max(1, Math.min(5, item.criticality)),
            evidenceRefs: {
              ...(reqExists.evidenceRefs as object ?? {}),
              subtype: item.subtype,
              keywords: item.keywords,
              evaluationWeight: item.evaluationWeight ?? null,
            } as any,
          },
        });
      }
    }

    // Log activity
    await db.activity.create({
      data: {
        tenderId,
        action: 'technical_requirements_analyzed',
        details: `AI Technical Engine ταξινόμησε ${classified.length} τεχνικές απαιτήσεις: ${this.summarizeSubtypes(classified)}`,
      },
    });

    return classified;
  }

  // ── mapRequirementsToExperience ────────────────────────────

  /**
   * For each technical requirement, finds matching Projects,
   * ContentLibraryItems, and Certificates. Returns matches with
   * confidence scores. Creates/updates RequirementMapping records.
   */
  async mapRequirementsToExperience(
    tenderId: string,
    tenantId: string
  ): Promise<ExperienceMatch[]> {
    const requirements = await db.tenderRequirement.findMany({
      where: {
        tenderId,
        category: 'TECHNICAL_REQUIREMENTS',
      },
    });

    if (requirements.length === 0) {
      return [];
    }

    // Load company assets
    const [projects, contentItems, certificates] = await Promise.all([
      db.project.findMany({ where: { tenantId } }),
      db.contentLibraryItem.findMany({ where: { tenantId } }),
      db.certificate.findMany({ where: { tenantId } }),
    ]);

    const result = await ai().complete({
      messages: [
        {
          role: 'system',
          content: `Είσαι Τεχνικός Αξιολογητής. Αντιστοιχίζεις τεχνικές απαιτήσεις διαγωνισμού με τα υπάρχοντα assets μιας εταιρείας.

Για κάθε απαίτηση, βρες τα πιο σχετικά:
- **projects**: Παρόμοια έργα (τίτλος, κατηγορία, πελάτης)
- **contentLibrary**: Κείμενα βιβλιοθήκης (μεθοδολογίες, QA, HSE κλπ.)
- **certificates**: Πιστοποιητικά (ISO, κλπ.)

Για κάθε match, δώσε:
- confidence (0-1): πόσο σχετικό είναι
- relevantExcerpt: γιατί ταιριάζει (1-2 προτάσεις)

ΜΟΡΦΗ ΑΠΑΝΤΗΣΗΣ: JSON array:
[{
  "requirementId": "string",
  "requirementText": "string",
  "matches": [{
    "type": "project" | "contentLibrary" | "certificate",
    "id": "string",
    "title": "string",
    "confidence": 0.0-1.0,
    "relevantExcerpt": "string"
  }],
  "overallConfidence": 0.0-1.0
}]

Αν δεν βρεις match, επέστρεψε empty matches array με overallConfidence: 0.`,
        },
        {
          role: 'user',
          content: JSON.stringify({
            requirements: requirements.map((r) => ({
              id: r.id,
              text: r.text,
              subtype: (r.evidenceRefs as any)?.subtype ?? null,
              keywords: (r.evidenceRefs as any)?.keywords ?? [],
            })),
            companyAssets: {
              projects: projects.map((p) => ({
                id: p.id,
                title: p.title,
                description: p.description?.substring(0, 200),
                client: p.client,
                category: p.category,
                contractAmount: p.contractAmount,
              })),
              contentLibrary: contentItems.map((c) => ({
                id: c.id,
                title: c.title,
                category: c.category,
                tags: c.tags,
                contentPreview: c.content.substring(0, 200),
              })),
              certificates: certificates.map((c) => ({
                id: c.id,
                type: c.type,
                title: c.title,
                issuer: c.issuer,
              })),
            },
          }),
        },
      ],
      maxTokens: 6000,
      temperature: 0.2,
      responseFormat: 'json',
    });

    let matches: ExperienceMatch[];
    try {
      const parsed = parseAIResponse<ExperienceMatch[] | { mappings: ExperienceMatch[] }>(result.content, [], 'mapRequirementsToExperience');
      matches = Array.isArray(parsed) ? parsed : parsed.mappings || [];
    } catch {
      throw new Error('Η AI ανάλυση τεχνικών απαιτήσεων απέτυχε. Δοκιμάστε ξανά.');
    }

    // Persist RequirementMapping records
    for (const match of matches) {
      const reqExists = requirements.find((r) => r.id === match.requirementId);
      if (!reqExists) continue;

      // Delete old AI-generated mappings for this requirement
      await db.requirementMapping.deleteMany({
        where: {
          requirementId: match.requirementId,
          notes: { startsWith: '[AI]' },
        },
      });

      for (const m of match.matches) {
        const mappingData: Record<string, unknown> = {
          requirementId: match.requirementId,
          notes: `[AI] ${m.relevantExcerpt} (confidence: ${(m.confidence * 100).toFixed(0)}%)`,
        };

        // Validate that the referenced entity exists in the loaded data
        switch (m.type) {
          case 'project':
            if (projects.find((p) => p.id === m.id)) {
              mappingData.projectId = m.id;
            } else continue;
            break;
          case 'contentLibrary':
            if (contentItems.find((c) => c.id === m.id)) {
              mappingData.contentLibraryItemId = m.id;
            } else continue;
            break;
          case 'certificate':
            if (certificates.find((c) => c.id === m.id)) {
              mappingData.certificateId = m.id;
            } else continue;
            break;
          default:
            continue;
        }

        await db.requirementMapping.create({ data: mappingData as any });
      }

      // Update coverage status
      const newStatus: CoverageStatus =
        match.overallConfidence >= 0.6 ? 'COVERED' : 'GAP';
      await db.tenderRequirement.update({
        where: { id: match.requirementId },
        data: { coverageStatus: newStatus },
      });
    }

    // Log activity
    const coveredCount = matches.filter((m) => m.overallConfidence >= 0.6).length;
    const gapCount = matches.filter((m) => m.overallConfidence < 0.6).length;
    await db.activity.create({
      data: {
        tenderId,
        action: 'technical_experience_mapped',
        details: `AI Technical Engine αντιστοίχισε ${coveredCount} απαιτήσεις (${gapCount} κενά)`,
      },
    });

    return matches;
  }

  // ── generateTechnicalProposal ─────────────────────────────

  /**
   * Creates structured technical proposal with 7 sections.
   * Each section uses AI to draft content based on requirements,
   * company content library, and past projects.
   * Creates TechnicalProposalSection records with status=AI_DRAFT.
   */
  async generateTechnicalProposal(
    tenderId: string,
    tenantId: string
  ): Promise<ProposalSectionData[]> {
    await requireDocuments(tenderId);
    const [tender, requirements, contentItems, projects, certificates, company, teamReqs] =
      await Promise.all([
        db.tender.findUniqueOrThrow({ where: { id: tenderId } }),
        db.tenderRequirement.findMany({
          where: { tenderId },
          include: {
            mappings: {
              include: {
                contentLibraryItem: true,
                project: true,
                certificate: true,
              },
            },
          },
        }),
        db.contentLibraryItem.findMany({ where: { tenantId } }),
        db.project.findMany({ where: { tenantId }, orderBy: { endDate: 'desc' }, take: 10 }),
        db.certificate.findMany({ where: { tenantId } }),
        db.companyProfile.findUnique({ where: { tenantId } }),
        db.teamRequirement.findMany({ where: { tenderId } }),
      ]);

    const documentText = await readTenderDocuments(tenderId);

    const technicalReqs = requirements.filter((r) => r.category === 'TECHNICAL_REQUIREMENTS');
    const financialReqs = requirements.filter((r) => r.category === 'FINANCIAL_REQUIREMENTS');

    // Build context for AI
    const companyContext = {
      name: company?.legalName ?? 'Εταιρεία',
      description: company?.description ?? '',
      certificates: certificates.map((c) => `${c.type}: ${c.title}`).join(', '),
      recentProjects: projects.map((p) => ({
        title: p.title,
        client: p.client,
        description: p.description?.substring(0, 150),
        amount: p.contractAmount,
      })),
      contentLibrary: contentItems.map((c) => ({
        category: c.category,
        title: c.title,
        preview: c.content.substring(0, 300),
      })),
    };

    // Delete existing AI_DRAFT sections
    await db.technicalProposalSection.deleteMany({
      where: { tenderId, status: 'AI_DRAFT' },
    });

    const sections: ProposalSectionData[] = [];

    // Generate each section individually for better quality
    for (const sectionConfig of PROPOSAL_SECTIONS) {
      const result = await ai().complete({
        messages: [
          {
            role: 'system',
            content: `Είσαι Τεχνικός Σύμβουλος (CTO) που γράφει τεχνικές προσφορές για ελληνικούς δημόσιους διαγωνισμούς.

ΡΟΛΟΣ: Συγγραφή ενότητας τεχνικής πρότασης.

ΚΑΝΟΝΕΣ:
- Γράψε στα ελληνικά, σε επίσημο/τεχνικό ύφος
- Χρησιμοποίησε αριθμημένα υποκεφάλαια (1.1, 1.2, κλπ.)
- Αναφέρσου σε συγκεκριμένες απαιτήσεις του διαγωνισμού
- Ενσωμάτωσε εμπειρία εταιρείας (έργα, πιστοποιήσεις)
- Χρησιμοποίησε τα κείμενα από τη βιβλιοθήκη ως βάση
- Ελληνικά κεφαλαιογράμματα για headers
- Markdown format

ΕΝΟΤΗΤΑ: ${sectionConfig.promptContext}

ΜΟΡΦΗ ΑΠΑΝΤΗΣΗΣ: JSON
{
  "content": "markdown string",
  "aiNotes": "notes about assumptions, areas needing human review"
}`,
          },
          {
            role: 'user',
            content: JSON.stringify({
              tenderTitle: tender.title,
              referenceNumber: tender.referenceNumber,
              contractingAuthority: tender.contractingAuthority,
              budget: tender.budget,
              awardCriteria: tender.awardCriteria,
              documentText,
              technicalRequirements: technicalReqs.map((r) => ({
                text: r.text,
                subtype: (r.evidenceRefs as any)?.subtype ?? null,
                criticality: r.criticality,
                mandatory: r.mandatory,
                mappedContent: r.mappings
                  .filter((m) => m.contentLibraryItem)
                  .map((m) => m.contentLibraryItem!.content.substring(0, 300))
                  .join('\n'),
              })),
              teamRequirements: teamReqs.map((t) => ({
                role: t.role,
                qualifications: t.qualifications,
                minExperience: t.minExperience,
                isMandatory: t.isMandatory,
              })),
              company: companyContext,
            }),
          },
        ],
        maxTokens: 8000,
        temperature: 0.5,
        responseFormat: 'json',
      });

      let sectionData: { content: string; aiNotes: string };
      try {
        sectionData = parseAIResponse<{ content: string; aiNotes: string }>(result.content, [], 'generateTechnicalProposal');
      } catch {
        throw new Error('Η AI ανάλυση τεχνικών απαιτήσεων απέτυχε. Δοκιμάστε ξανά.');
      }

      const section: ProposalSectionData = {
        title: sectionConfig.title,
        ordering: sectionConfig.ordering,
        content: sectionData.content || `## ${sectionConfig.title}\n\n_Αυτή η ενότητα χρειάζεται ανθρώπινη επεξεργασία._`,
        aiNotes: sectionData.aiNotes || 'Απαιτείται ανασκόπηση.',
      };

      sections.push(section);

      // Persist to DB
      await db.technicalProposalSection.create({
        data: {
          tenderId,
          title: section.title,
          ordering: section.ordering,
          content: section.content,
          status: 'AI_DRAFT',
          aiNotes: section.aiNotes,
        },
      });
    }

    // Log activity
    await db.activity.create({
      data: {
        tenderId,
        action: 'technical_proposal_generated',
        details: `AI Technical Engine δημιούργησε τεχνική πρόταση με ${sections.length} ενότητες: ${sections.map((s) => s.title).join(', ')}`,
      },
    });

    return sections;
  }

  // ── flagTechnicalRisks ────────────────────────────────────

  /**
   * Identifies:
   * - Requirements not covered by company capabilities
   * - Unrealistic KPIs/SLAs
   * - Conflicting requirements
   * - Very tight timelines
   * - Missing certifications needed
   * Creates TechnicalRisk records with mitigation suggestions.
   */
  async flagTechnicalRisks(tenderId: string): Promise<TechnicalRiskData[]> {
    await requireDocuments(tenderId);
    const [tender, requirements, existingRisks] = await Promise.all([
      db.tender.findUniqueOrThrow({ where: { id: tenderId } }),
      db.tenderRequirement.findMany({
        where: { tenderId },
        include: { mappings: true },
      }),
      db.technicalRisk.findMany({ where: { tenderId } }),
    ]);

    const documentText = await readTenderDocuments(tenderId);

    const technicalReqs = requirements.filter((r) => r.category === 'TECHNICAL_REQUIREMENTS');
    const gapRequirements = technicalReqs.filter((r) => r.coverageStatus === 'GAP');
    const unmappedRequirements = technicalReqs.filter((r) => r.coverageStatus === 'UNMAPPED');

    const result = await ai().complete({
      messages: [
        {
          role: 'system',
          content: `Είσαι Τεχνικός Αναλυτής Κινδύνου σε ελληνικούς δημόσιους διαγωνισμούς.

ΡΟΛΟΣ: Εντοπισμός τεχνικών κινδύνων στην υποβολή προσφοράς.

Εντόπισε κινδύνους σε αυτές τις κατηγορίες:

1. **Uncovered Requirements**: Απαιτήσεις που η εταιρεία δεν μπορεί να καλύψει
2. **Unrealistic KPIs/SLAs**: Δείκτες επίδοσης που μπορεί να μην είναι εφικτοί
3. **Conflicting Requirements**: Αντικρουόμενες απαιτήσεις μέσα στη διακήρυξη
4. **Timeline Risks**: Πολύ σφιχτά χρονοδιαγράμματα για το εύρος του έργου
5. **Missing Certifications**: Πιστοποιήσεις που λείπουν ή λήγουν
6. **Resource Risks**: Ανεπάρκεια πόρων/προσωπικού
7. **Dependency Risks**: Εξαρτήσεις από τρίτους ή τον αναθέτοντα φορέα

Για κάθε κίνδυνο:
- riskLevel: LOW | MEDIUM | HIGH | CRITICAL
- mitigation: Συγκεκριμένη πρόταση αντιμετώπισης

ΜΟΡΦΗ ΑΠΑΝΤΗΣΗΣ: JSON array:
[{
  "title": "string",
  "description": "string in Greek",
  "riskLevel": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "mitigation": "string in Greek",
  "relatedRequirementId": "string" | null
}]`,
        },
        {
          role: 'user',
          content: JSON.stringify({
            tenderTitle: tender.title,
            budget: tender.budget,
            submissionDeadline: tender.submissionDeadline,
            documentText,
            requirements: technicalReqs.map((r) => ({
              id: r.id,
              text: r.text,
              mandatory: r.mandatory,
              criticality: r.criticality,
              coverageStatus: r.coverageStatus,
              subtype: (r.evidenceRefs as any)?.subtype ?? null,
              hasMappings: r.mappings.length > 0,
            })),
            gapRequirementIds: gapRequirements.map((r) => r.id),
            unmappedRequirementIds: unmappedRequirements.map((r) => r.id),
            gapCount: gapRequirements.length,
            unmappedCount: unmappedRequirements.length,
            totalTechnicalRequirements: technicalReqs.length,
          }),
        },
      ],
      maxTokens: 8000,
      temperature: 0.2,
      responseFormat: 'json',
    });

    let risks: TechnicalRiskData[];
    try {
      const parsed = parseAIResponse<TechnicalRiskData[] | { risks: TechnicalRiskData[] }>(result.content, [], 'flagTechnicalRisks');
      risks = Array.isArray(parsed) ? parsed : parsed.risks || [];
    } catch {
      throw new Error('Η AI ανάλυση τεχνικών απαιτήσεων απέτυχε. Δοκιμάστε ξανά.');
    }

    // Validate riskLevel values
    const validLevels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
    risks = risks.map((r) => ({
      ...r,
      riskLevel: validLevels.includes(r.riskLevel as any)
        ? r.riskLevel
        : 'MEDIUM',
    }));

    // Delete existing AI-generated risks
    if (existingRisks.length > 0) {
      await db.technicalRisk.deleteMany({
        where: { tenderId },
      });
    }

    // Persist risks to DB
    for (const risk of risks) {
      // Validate that relatedRequirementId actually exists
      const relatedReqValid = risk.relatedRequirementId
        ? requirements.some((r) => r.id === risk.relatedRequirementId)
        : false;

      await db.technicalRisk.create({
        data: {
          tenderId,
          title: risk.title,
          description: risk.description,
          riskLevel: risk.riskLevel as any,
          mitigation: risk.mitigation,
          relatedRequirementId: relatedReqValid ? risk.relatedRequirementId : null,
        },
      });
    }

    // Log activity
    const criticalCount = risks.filter((r) => r.riskLevel === 'CRITICAL' || r.riskLevel === 'HIGH').length;
    await db.activity.create({
      data: {
        tenderId,
        action: 'technical_risks_flagged',
        details: `AI Technical Engine εντόπισε ${risks.length} κινδύνους (${criticalCount} υψηλής/κρίσιμης σημασίας)`,
      },
    });

    return risks;
  }

  // ── scoreProposalStrength ─────────────────────────────────

  /**
   * Based on Greek evaluation criteria (N.4412/2016), estimates how
   * the proposal would score. Returns estimated 0-120 with breakdown.
   *
   * Greek evaluation framework:
   * - Technical specs conformity: up to 80 points (66.7%)
   * - Support & warranty plan: up to 20 points (16.7%)
   * - Team qualifications: up to 20 points (16.7%)
   * Total possible: 120 points
   */
  async scoreProposalStrength(tenderId: string): Promise<ProposalStrengthResult> {
    const [tender, sections, requirements, risks, teamReqs] = await Promise.all([
      db.tender.findUniqueOrThrow({ where: { id: tenderId } }),
      db.technicalProposalSection.findMany({ where: { tenderId }, orderBy: { ordering: 'asc' } }),
      db.tenderRequirement.findMany({
        where: { tenderId, category: 'TECHNICAL_REQUIREMENTS' },
      }),
      db.technicalRisk.findMany({ where: { tenderId } }),
      db.teamRequirement.findMany({ where: { tenderId } }),
    ]);

    const coveredReqs = requirements.filter((r) => r.coverageStatus === 'COVERED');
    const gapReqs = requirements.filter((r) => r.coverageStatus === 'GAP');
    const approvedSections = sections.filter((s) => s.status === 'APPROVED' || s.status === 'REVIEWED');
    const staffedTeam = teamReqs.filter((t) => t.status === 'COVERED');

    const result = await ai().complete({
      messages: [
        {
          role: 'system',
          content: `Είσαι αξιολογητής τεχνικών προσφορών σε ελληνικούς δημόσιους διαγωνισμούς (Ν.4412/2016).

ΠΛΑΙΣΙΟ ΑΞΙΟΛΟΓΗΣΗΣ (μέγιστο 120 μονάδες):

1. **Τεχνικές Προδιαγραφές** (0-80 μονάδες):
   - Κάλυψη απαιτήσεων: πόσες υποχρεωτικές καλύπτονται
   - Ποιότητα απαντήσεων: πόσο αναλυτικές/τεκμηριωμένες
   - Κατανόηση αντικειμένου: βάθος κατανόησης
   - Μεθοδολογία: δομή, φάσεις, καινοτομία

2. **Υποστήριξη & Εγγύηση** (0-20 μονάδες):
   - SLA δεσμεύσεις
   - Σχέδιο υποστήριξης
   - Εκπαίδευση χρηστών
   - Μεταφορά τεχνογνωσίας

3. **Ομάδα Έργου** (0-20 μονάδες):
   - Κάλυψη ρόλων
   - Προσόντα/εμπειρία
   - Δομή ομάδας
   - CVs/τεκμηρίωση

Αξιολόγησε ρεαλιστικά βάσει:
- % κάλυψης απαιτήσεων
- Αριθμός κενών (gaps)
- Κατάσταση ενοτήτων (draft vs reviewed vs approved)
- Αριθμός κινδύνων (ιδίως HIGH/CRITICAL)
- Κάλυψη ομάδας έργου

ΜΟΡΦΗ ΑΠΑΝΤΗΣΗΣ: JSON
{
  "estimatedScore": number (0-120),
  "breakdown": [
    { "criterion": "string", "weight": number, "estimatedScore": number, "notes": "string in Greek" }
  ]
}`,
        },
        {
          role: 'user',
          content: JSON.stringify({
            tenderTitle: tender.title,
            awardCriteria: tender.awardCriteria,
            totalTechnicalRequirements: requirements.length,
            coveredRequirements: coveredReqs.length,
            gapRequirements: gapReqs.length,
            mandatoryGaps: gapReqs.filter((r) => r.mandatory).length,
            proposalSections: sections.map((s) => ({
              title: s.title,
              status: s.status,
              contentLength: s.content.length,
            })),
            approvedSectionCount: approvedSections.length,
            totalSections: sections.length,
            risks: {
              total: risks.length,
              critical: risks.filter((r) => r.riskLevel === 'CRITICAL').length,
              high: risks.filter((r) => r.riskLevel === 'HIGH').length,
            },
            teamRequirements: {
              total: teamReqs.length,
              staffed: staffedTeam.length,
              mandatoryUnstaffed: teamReqs.filter((t) => t.isMandatory && t.status !== 'COVERED').length,
            },
          }),
        },
      ],
      maxTokens: 2000,
      temperature: 0.2,
      responseFormat: 'json',
    });

    let scoreResult: ProposalStrengthResult;
    try {
      scoreResult = parseAIResponse<ProposalStrengthResult>(result.content, [], 'scoreProposalStrength');
      scoreResult.estimatedScore = Math.max(0, Math.min(120, scoreResult.estimatedScore));
    } catch {
      throw new Error('Η AI ανάλυση τεχνικών απαιτήσεων απέτυχε. Δοκιμάστε ξανά.');
    }

    // Log activity
    await db.activity.create({
      data: {
        tenderId,
        action: 'proposal_strength_scored',
        details: `AI Technical Engine εκτίμηση βαθμολογίας: ${scoreResult.estimatedScore}/120 — ${scoreResult.breakdown.map((b) => `${b.criterion}: ${b.estimatedScore}/${b.weight}`).join(', ')}`,
      },
    });

    return scoreResult;
  }

  // ─── Private Helpers ─────────────────────────────────────────

  private summarizeSubtypes(classified: ClassifiedRequirement[]): string {
    const counts: Record<string, number> = {};
    for (const c of classified) {
      counts[c.subtype] = (counts[c.subtype] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([subtype, count]) => `${subtype}: ${count}`)
      .join(', ');
  }

}

export const aiTechnical = new AITechnicalService();
