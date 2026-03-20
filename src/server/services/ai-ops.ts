import { db } from '@/lib/db';
import { ai } from '@/server/ai';
import { parseAIResponse } from './ai-prompts';
import type { TaskPriority, TaskStatus } from '@prisma/client';
import path from 'path';

// ─── Types ──────────────────────────────────────────────────

interface PrioritizedTask {
  taskId: string;
  title: string;
  status: TaskStatus;
  currentPriority: TaskPriority;
  suggestedPriority: TaskPriority;
  urgencyScore: number; // 0-100
  daysUntilDue: number | null;
  reasons: string[];
  dependencies: string[];
  impactOnCompliance: 'none' | 'low' | 'medium' | 'high' | 'critical';
}

interface Reminder {
  type: 'overdue_task' | 'upcoming_task' | 'expiring_certificate' | 'compliance_gap' | 'draft_document' | 'deadline_warning';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  relatedEntityId: string;
}

interface SuggestedAction {
  rank: number;
  action: string;
  reason: string;
  category: 'compliance' | 'document' | 'legal' | 'financial' | 'technical' | 'admin';
  estimatedEffort: 'quick' | 'medium' | 'extensive';
  relatedEntityId?: string;
}

// ─── AI Ops Service ─────────────────────────────────────────

/**
 * AI Admin & Operations -- Acts as the Project Admin.
 * Manages document naming, auto-reminders, task prioritization,
 * deadline tracking, and team coordination.
 */
class AIOpsService {
  // ─── generateFileName ──────────────────────────────────────

  /**
   * Generates consistent file naming:
   * [TenderRef]_[Category]_[Title]_v[Version].[ext]
   * e.g. DIAK-2024-001_TECHNICAL_Methodologia_v1.pdf
   */
  generateFileName(
    tenderId: string,
    category: string,
    version: number,
    originalName: string
  ): string {
    // Extract file extension
    const ext = path.extname(originalName).toLowerCase() || '.pdf';

    // Sanitize the original name to use as title
    const baseName = path.basename(originalName, ext);
    const sanitizedTitle = this.sanitizeForFilename(baseName);

    // Sanitize category
    const sanitizedCategory = category
      .toUpperCase()
      .replace(/\s+/g, '_')
      .replace(/[^A-Z0-9_]/g, '');

    // Use tenderId as fallback reference (the actual reference number would be better
    // but we keep this synchronous — caller can pass reference as category prefix)
    const tenderRef = tenderId.substring(0, 12).toUpperCase();

    return `${tenderRef}_${sanitizedCategory}_${sanitizedTitle}_v${version}${ext}`;
  }

  // ─── prioritizeTasks ──────────────────────────────────────

  /**
   * Analyzes all tasks for a tender, returns prioritized list based on:
   *   - Days until deadline
   *   - Task dependencies (legal review before compliance check)
   *   - Impact on compliance score
   *   - Critical path items
   */
  async prioritizeTasks(tenderId: string): Promise<PrioritizedTask[]> {
    const tender = await db.tender.findUniqueOrThrow({
      where: { id: tenderId },
      include: {
        tasks: {
          include: {
            requirement: true,
            assignee: { select: { id: true, name: true } },
          },
        },
        requirements: true,
      },
    });

    const deadline = tender.submissionDeadline;
    const now = new Date();

    // Get tasks that are not done
    const activeTasks = tender.tasks.filter((t) => t.status !== 'DONE');

    if (activeTasks.length === 0) {
      return [];
    }

    try {
      const result = await ai().complete({
        messages: [
          {
            role: 'system',
            content: `Είσαι ο Διοικητικός Υπεύθυνος (Project Admin) για δημόσιους διαγωνισμούς.
Αξιολόγησε τις εργασίες και κατάταξέ τες κατά προτεραιότητα.

Κανόνες προτεραιότητας:
1. URGENT: Εκπρόθεσμες ή λήγουν σε < 24 ώρες, ή μπλοκάρουν άλλες εργασίες
2. HIGH: Λήγουν σε < 48 ώρες, ή αφορούν υποχρεωτικές απαιτήσεις με GAP status
3. MEDIUM: Λήγουν σε < 1 εβδομάδα
4. LOW: Ολα τα υπόλοιπα

Σειρά εξαρτήσεων (πρέπει να ολοκληρωθούν πρώτα):
- Νομικός έλεγχος → Compliance check → Δημιουργία εγγράφων
- Εξαγωγή απαιτήσεων → Τεχνική ανάλυση → Τεχνική πρόταση
- Οικονομική ανάλυση → Τιμολόγηση → Οικονομική προσφορά

Απάντησε ΜΟΝΟ σε JSON array:
[{
  "taskId": "...",
  "suggestedPriority": "URGENT|HIGH|MEDIUM|LOW",
  "urgencyScore": 0-100,
  "reasons": ["reason1", "reason2"],
  "dependencies": ["taskId that must come first"],
  "impactOnCompliance": "none|low|medium|high|critical"
}]`,
          },
          {
            role: 'user',
            content: JSON.stringify({
              tenderDeadline: deadline,
              currentDate: now.toISOString(),
              complianceScore: tender.complianceScore,
              tasks: activeTasks.map((t) => ({
                taskId: t.id,
                title: t.title,
                description: t.description,
                status: t.status,
                currentPriority: t.priority,
                dueDate: t.dueDate,
                assigneeRole: t.assigneeRole,
                isAiGenerated: t.isAiGenerated,
                relatedRequirement: t.requirement
                  ? {
                      text: t.requirement.text,
                      category: t.requirement.category,
                      mandatory: t.requirement.mandatory,
                      coverageStatus: t.requirement.coverageStatus,
                    }
                  : null,
              })),
              gapCount: tender.requirements.filter((r) => r.coverageStatus === 'GAP').length,
              unmappedCount: tender.requirements.filter((r) => r.coverageStatus === 'UNMAPPED').length,
            }),
          },
        ],
        maxTokens: 6000,
        temperature: 0.2,
        responseFormat: 'json',
      });

      const aiPriorities: Array<{
        taskId: string;
        suggestedPriority: TaskPriority;
        urgencyScore: number;
        reasons: string[];
        dependencies: string[];
        impactOnCompliance: PrioritizedTask['impactOnCompliance'];
      }> = parseAIResponse<Array<{
        taskId: string;
        suggestedPriority: TaskPriority;
        urgencyScore: number;
        reasons: string[];
        dependencies: string[];
        impactOnCompliance: PrioritizedTask['impactOnCompliance'];
      }>>(result.content, [], 'prioritizeTasks');

      // Merge AI analysis with task data
      const prioritized: PrioritizedTask[] = activeTasks.map((task) => {
        const aiData = aiPriorities.find((p) => p.taskId === task.id);
        const daysUntilDue = task.dueDate
          ? Math.ceil((new Date(task.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : null;

        return {
          taskId: task.id,
          title: task.title,
          status: task.status,
          currentPriority: task.priority,
          suggestedPriority: aiData?.suggestedPriority || task.priority,
          urgencyScore: aiData?.urgencyScore ?? this.calculateFallbackUrgency(daysUntilDue, task.priority),
          daysUntilDue,
          reasons: aiData?.reasons || [],
          dependencies: aiData?.dependencies || [],
          impactOnCompliance: aiData?.impactOnCompliance || 'none',
        };
      });

      // Sort by urgency score descending
      prioritized.sort((a, b) => b.urgencyScore - a.urgencyScore);

      await db.activity.create({
        data: {
          tenderId,
          action: 'tasks_prioritized',
          details: `Προτεραιοποίηση ${prioritized.length} εργασιών — ${prioritized.filter((t) => t.suggestedPriority === 'URGENT').length} URGENT, ${prioritized.filter((t) => t.suggestedPriority === 'HIGH').length} HIGH`,
        },
      });

      return prioritized;
    } catch {
      // Fallback: prioritize by due date and current priority
      return this.fallbackPrioritization(activeTasks, now);
    }
  }

  // ─── generateReminders ────────────────────────────────────

  /**
   * Checks for:
   *   - Tasks overdue or due within 48 hours
   *   - Certificates expiring before submission deadline
   *   - Compliance gaps still open
   *   - Documents still in DRAFT status
   */
  async generateReminders(tenderId: string): Promise<Reminder[]> {
    const tender = await db.tender.findUniqueOrThrow({
      where: { id: tenderId },
      include: {
        tasks: true,
        requirements: true,
        generatedDocuments: true,
      },
    });

    const tenantId = tender.tenantId;
    const now = new Date();
    const deadline = tender.submissionDeadline;
    const reminders: Reminder[] = [];

    // 1. Overdue tasks
    const overdueTasks = tender.tasks.filter(
      (t) => t.status !== 'DONE' && t.dueDate && new Date(t.dueDate) < now
    );
    for (const task of overdueTasks) {
      const daysOverdue = Math.ceil(
        (now.getTime() - new Date(task.dueDate!).getTime()) / (1000 * 60 * 60 * 24)
      );
      reminders.push({
        type: 'overdue_task',
        urgency: daysOverdue > 3 ? 'critical' : daysOverdue > 1 ? 'high' : 'medium',
        message: `Η εργασία "${task.title}" έχει καθυστερήσει κατά ${daysOverdue} ημέρ${daysOverdue === 1 ? 'α' : 'ες'}`,
        relatedEntityId: task.id,
      });
    }

    // 2. Tasks due within 48 hours
    const urgentTasks = tender.tasks.filter((t) => {
      if (t.status === 'DONE' || !t.dueDate) return false;
      const hoursUntil = (new Date(t.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60);
      return hoursUntil > 0 && hoursUntil <= 48;
    });
    for (const task of urgentTasks) {
      const hoursUntil = Math.ceil(
        (new Date(task.dueDate!).getTime() - now.getTime()) / (1000 * 60 * 60)
      );
      reminders.push({
        type: 'upcoming_task',
        urgency: hoursUntil <= 12 ? 'high' : 'medium',
        message: `Η εργασία "${task.title}" λήγει σε ${hoursUntil} ώρ${hoursUntil === 1 ? 'α' : 'ες'}`,
        relatedEntityId: task.id,
      });
    }

    // 3. Expiring certificates
    if (deadline) {
      const certificates = await db.certificate.findMany({
        where: { tenantId },
      });
      for (const cert of certificates) {
        if (cert.expiryDate && new Date(cert.expiryDate) < deadline) {
          const daysUntilExpiry = Math.ceil(
            (new Date(cert.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );
          reminders.push({
            type: 'expiring_certificate',
            urgency: daysUntilExpiry <= 0 ? 'critical' : daysUntilExpiry <= 7 ? 'high' : 'medium',
            message: daysUntilExpiry <= 0
              ? `Το πιστοποιητικό "${cert.title}" έχει ήδη λήξει!`
              : `Το πιστοποιητικό "${cert.title}" λήγει σε ${daysUntilExpiry} ημέρες — πριν την προθεσμία υποβολής`,
            relatedEntityId: cert.id,
          });
        }
      }

      // Also check legal documents
      const legalDocs = await db.legalDocument.findMany({
        where: { tenantId },
      });
      for (const doc of legalDocs) {
        if (doc.expiryDate && new Date(doc.expiryDate) < deadline) {
          const daysUntilExpiry = Math.ceil(
            (new Date(doc.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          );
          reminders.push({
            type: 'expiring_certificate',
            urgency: daysUntilExpiry <= 0 ? 'critical' : daysUntilExpiry <= 7 ? 'high' : 'medium',
            message: daysUntilExpiry <= 0
              ? `Το έγγραφο "${doc.title}" έχει ήδη λήξει!`
              : `Το έγγραφο "${doc.title}" λήγει σε ${daysUntilExpiry} ημέρες — πριν την προθεσμία υποβολής`,
            relatedEntityId: doc.id,
          });
        }
      }
    }

    // 4. Compliance gaps still open
    const mandatoryGaps = tender.requirements.filter(
      (r) => r.mandatory && (r.coverageStatus === 'GAP' || r.coverageStatus === 'UNMAPPED')
    );
    if (mandatoryGaps.length > 0) {
      reminders.push({
        type: 'compliance_gap',
        urgency: mandatoryGaps.length > 5 ? 'critical' : mandatoryGaps.length > 2 ? 'high' : 'medium',
        message: `${mandatoryGaps.length} υποχρεωτικ${mandatoryGaps.length === 1 ? 'ή απαίτηση' : 'ές απαιτήσεις'} δεν καλύπτ${mandatoryGaps.length === 1 ? 'εται' : 'ονται'} ακόμα`,
        relatedEntityId: tenderId,
      });
    }

    // 5. Documents still in DRAFT status
    const draftDocs = tender.generatedDocuments.filter((d) => d.status === 'DRAFT');
    for (const doc of draftDocs) {
      reminders.push({
        type: 'draft_document',
        urgency: 'medium',
        message: `Το έγγραφο "${doc.title}" είναι ακόμα σε DRAFT — χρειάζεται review και οριστικοποίηση`,
        relatedEntityId: doc.id,
      });
    }

    // 6. Submission deadline proximity
    if (deadline) {
      const daysUntilDeadline = Math.ceil(
        (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysUntilDeadline <= 0) {
        reminders.push({
          type: 'deadline_warning',
          urgency: 'critical',
          message: 'Η προθεσμία υποβολής έχει παρέλθει!',
          relatedEntityId: tenderId,
        });
      } else if (daysUntilDeadline <= 1) {
        reminders.push({
          type: 'deadline_warning',
          urgency: 'critical',
          message: `Η προθεσμία υποβολής είναι ΑΥΡΙΟ! Ελέγξτε αν όλα είναι έτοιμα.`,
          relatedEntityId: tenderId,
        });
      } else if (daysUntilDeadline <= 3) {
        reminders.push({
          type: 'deadline_warning',
          urgency: 'high',
          message: `Η προθεσμία υποβολής είναι σε ${daysUntilDeadline} ημέρες`,
          relatedEntityId: tenderId,
        });
      } else if (daysUntilDeadline <= 7) {
        reminders.push({
          type: 'deadline_warning',
          urgency: 'medium',
          message: `Η προθεσμία υποβολής είναι σε ${daysUntilDeadline} ημέρες — ξεκινήστε τελικούς ελέγχους`,
          relatedEntityId: tenderId,
        });
      }
    }

    // Sort by urgency
    const urgencyOrder: Record<Reminder['urgency'], number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };
    reminders.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

    await db.activity.create({
      data: {
        tenderId,
        action: 'reminders_generated',
        details: `Δημιουργήθηκαν ${reminders.length} υπενθυμίσεις — ${reminders.filter((r) => r.urgency === 'critical').length} κρίσιμες, ${reminders.filter((r) => r.urgency === 'high').length} υψηλής προτεραιότητας`,
      },
    });

    return reminders;
  }

  // ─── suggestNextActions ───────────────────────────────────

  /**
   * AI-powered "what should we do next?" based on current state.
   * Returns top 5 recommended actions with reasons.
   */
  async suggestNextActions(tenderId: string): Promise<SuggestedAction[]> {
    const tender = await db.tender.findUniqueOrThrow({
      where: { id: tenderId },
      include: {
        tasks: true,
        requirements: true,
        generatedDocuments: true,
        attachedDocuments: true,
        goNoGoDecision: true,
        legalClauses: true,
        pricingScenarios: true,
        technicalSections: true,
      },
    });

    const tenantId = tender.tenantId;

    // Load additional context
    const [certificates, legalDocs] = await Promise.all([
      db.certificate.findMany({ where: { tenantId } }),
      db.legalDocument.findMany({ where: { tenantId } }),
    ]);

    try {
      const result = await ai().complete({
        messages: [
          {
            role: 'system',
            content: `Είσαι ο AI Διοικητικός Σύμβουλος για δημόσιους διαγωνισμούς (Ν.4412/2016).
Ανάλυσε την τρέχουσα κατάσταση του διαγωνισμού και πρότεινε τις 5 πιο σημαντικές ενέργειες.

Εξέτασε:
1. Σε ποιο στάδιο βρίσκεται ο διαγωνισμός (DISCOVERY → GO_NO_GO → IN_PROGRESS → SUBMITTED)
2. Ποιες απαιτήσεις δεν καλύπτονται
3. Ποια έγγραφα λείπουν ή είναι σε DRAFT
4. Αν υπάρχουν νομικά ζητήματα ή κίνδυνοι
5. Αν η οικονομική προσφορά είναι έτοιμη
6. Πόσος χρόνος απομένει

Απάντησε ΜΟΝΟ σε JSON array (top 5):
[{
  "rank": 1-5,
  "action": "Τι πρέπει να γίνει",
  "reason": "Γιατί είναι σημαντικό",
  "category": "compliance|document|legal|financial|technical|admin",
  "estimatedEffort": "quick|medium|extensive"
}]`,
          },
          {
            role: 'user',
            content: JSON.stringify({
              tender: {
                title: tender.title,
                status: tender.status,
                platform: tender.platform,
                budget: tender.budget,
                complianceScore: tender.complianceScore,
                submissionDeadline: tender.submissionDeadline,
                daysUntilDeadline: tender.submissionDeadline
                  ? Math.ceil(
                      (new Date(tender.submissionDeadline).getTime() - Date.now()) /
                        (1000 * 60 * 60 * 24)
                    )
                  : null,
              },
              requirements: {
                total: tender.requirements.length,
                covered: tender.requirements.filter(
                  (r) => r.coverageStatus === 'COVERED' || r.coverageStatus === 'MANUAL_OVERRIDE'
                ).length,
                gaps: tender.requirements.filter((r) => r.coverageStatus === 'GAP').length,
                unmapped: tender.requirements.filter((r) => r.coverageStatus === 'UNMAPPED').length,
                mandatoryGaps: tender.requirements.filter(
                  (r) => r.mandatory && r.coverageStatus === 'GAP'
                ).length,
              },
              tasks: {
                total: tender.tasks.length,
                todo: tender.tasks.filter((t) => t.status === 'TODO').length,
                inProgress: tender.tasks.filter((t) => t.status === 'IN_PROGRESS').length,
                done: tender.tasks.filter((t) => t.status === 'DONE').length,
                overdue: tender.tasks.filter(
                  (t) => t.status !== 'DONE' && t.dueDate && new Date(t.dueDate) < new Date()
                ).length,
              },
              documents: {
                attached: tender.attachedDocuments.length,
                generated: tender.generatedDocuments.length,
                drafts: tender.generatedDocuments.filter((d) => d.status === 'DRAFT').length,
                finals: tender.generatedDocuments.filter((d) => d.status === 'FINAL').length,
              },
              legal: {
                clausesExtracted: tender.legalClauses.length,
                highRiskClauses: tender.legalClauses.filter(
                  (c) => c.riskLevel === 'HIGH' || c.riskLevel === 'CRITICAL'
                ).length,
              },
              financial: {
                pricingScenarios: tender.pricingScenarios.length,
                selectedPricing: tender.pricingScenarios.filter((p) => p.isSelected).length,
              },
              technical: {
                proposalSections: tender.technicalSections.length,
                approvedSections: tender.technicalSections.filter(
                  (s) => s.status === 'APPROVED'
                ).length,
              },
              goNoGo: tender.goNoGoDecision
                ? {
                    decision: tender.goNoGoDecision.decision,
                    score: tender.goNoGoDecision.overallScore,
                    approved: !!tender.goNoGoDecision.approvedAt,
                  }
                : null,
              expiringCertificates: certificates.filter(
                (c) => c.expiryDate && tender.submissionDeadline &&
                  new Date(c.expiryDate) < tender.submissionDeadline
              ).length,
              expiringLegalDocs: legalDocs.filter(
                (d) => d.expiryDate && tender.submissionDeadline &&
                  new Date(d.expiryDate) < tender.submissionDeadline
              ).length,
            }),
          },
        ],
        maxTokens: 2000,
        temperature: 0.4,
        responseFormat: 'json',
      });

      const actions: SuggestedAction[] = parseAIResponse<SuggestedAction[]>(result.content, [], 'suggestNextActions');

      await db.activity.create({
        data: {
          tenderId,
          action: 'next_actions_suggested',
          details: `Προτάθηκαν ${actions.length} επόμενες ενέργειες`,
        },
      });

      return actions.slice(0, 5);
    } catch {
      // Fallback: rule-based suggestions
      return this.fallbackSuggestions(tender);
    }
  }

  // ─── Private Helpers ──────────────────────────────────────

  private sanitizeForFilename(name: string): string {
    // Transliterate common Greek characters to Latin
    const greekToLatin: Record<string, string> = {
      'α': 'a', 'β': 'v', 'γ': 'g', 'δ': 'd', 'ε': 'e', 'ζ': 'z',
      'η': 'i', 'θ': 'th', 'ι': 'i', 'κ': 'k', 'λ': 'l', 'μ': 'm',
      'ν': 'n', 'ξ': 'x', 'ο': 'o', 'π': 'p', 'ρ': 'r', 'σ': 's',
      'ς': 's', 'τ': 't', 'υ': 'y', 'φ': 'f', 'χ': 'ch', 'ψ': 'ps',
      'ω': 'o', 'ά': 'a', 'έ': 'e', 'ή': 'i', 'ί': 'i', 'ό': 'o',
      'ύ': 'y', 'ώ': 'o', 'ϊ': 'i', 'ϋ': 'y', 'ΐ': 'i', 'ΰ': 'y',
      'Α': 'A', 'Β': 'V', 'Γ': 'G', 'Δ': 'D', 'Ε': 'E', 'Ζ': 'Z',
      'Η': 'I', 'Θ': 'Th', 'Ι': 'I', 'Κ': 'K', 'Λ': 'L', 'Μ': 'M',
      'Ν': 'N', 'Ξ': 'X', 'Ο': 'O', 'Π': 'P', 'Ρ': 'R', 'Σ': 'S',
      'Τ': 'T', 'Υ': 'Y', 'Φ': 'F', 'Χ': 'Ch', 'Ψ': 'Ps', 'Ω': 'O',
      'Ά': 'A', 'Έ': 'E', 'Ή': 'I', 'Ί': 'I', 'Ό': 'O', 'Ύ': 'Y', 'Ώ': 'O',
    };

    let result = '';
    for (const char of name) {
      result += greekToLatin[char] || char;
    }

    // Replace spaces and special characters with underscores, remove consecutive underscores
    return result
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 60); // Keep reasonable length
  }

  private calculateFallbackUrgency(daysUntilDue: number | null, priority: TaskPriority): number {
    const priorityScores: Record<TaskPriority, number> = {
      URGENT: 90,
      HIGH: 70,
      MEDIUM: 50,
      LOW: 30,
    };

    let score = priorityScores[priority] || 50;

    if (daysUntilDue !== null) {
      if (daysUntilDue < 0) score = Math.max(score, 95);
      else if (daysUntilDue <= 1) score = Math.max(score, 85);
      else if (daysUntilDue <= 3) score = Math.max(score, 75);
      else if (daysUntilDue <= 7) score = Math.max(score, 60);
    }

    return score;
  }

  private fallbackPrioritization(
    tasks: Array<{
      id: string;
      title: string;
      status: TaskStatus;
      priority: TaskPriority;
      dueDate: Date | null;
      requirement?: { coverageStatus: string; mandatory: boolean } | null;
    }>,
    now: Date
  ): PrioritizedTask[] {
    return tasks
      .map((task) => {
        const daysUntilDue = task.dueDate
          ? Math.ceil((new Date(task.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : null;

        const urgencyScore = this.calculateFallbackUrgency(daysUntilDue, task.priority);
        const reasons: string[] = [];

        if (daysUntilDue !== null && daysUntilDue < 0) {
          reasons.push(`Εκπρόθεσμη κατά ${Math.abs(daysUntilDue)} ημέρες`);
        } else if (daysUntilDue !== null && daysUntilDue <= 2) {
          reasons.push(`Λήγει σε ${daysUntilDue} ημέρες`);
        }

        if (task.requirement?.mandatory && task.requirement.coverageStatus === 'GAP') {
          reasons.push('Αφορά υποχρεωτική απαίτηση με κενό κάλυψης');
        }

        let suggestedPriority: TaskPriority = task.priority;
        if (urgencyScore >= 85) suggestedPriority = 'URGENT';
        else if (urgencyScore >= 70) suggestedPriority = 'HIGH';
        else if (urgencyScore >= 50) suggestedPriority = 'MEDIUM';

        return {
          taskId: task.id,
          title: task.title,
          status: task.status,
          currentPriority: task.priority,
          suggestedPriority,
          urgencyScore,
          daysUntilDue,
          reasons,
          dependencies: [],
          impactOnCompliance: task.requirement?.mandatory ? 'high' as const : 'none' as const,
        };
      })
      .sort((a, b) => b.urgencyScore - a.urgencyScore);
  }

  private fallbackSuggestions(
    tender: {
      id: string;
      status: string;
      complianceScore: number | null;
      requirements: Array<{ coverageStatus: string; mandatory: boolean }>;
      generatedDocuments: Array<{ status: string }>;
      goNoGoDecision: { decision: string; approvedAt: Date | null } | null;
      legalClauses: Array<{ riskLevel: string }>;
      pricingScenarios: Array<{ isSelected: boolean }>;
      technicalSections: Array<{ status: string }>;
    }
  ): SuggestedAction[] {
    const actions: SuggestedAction[] = [];

    // Check status-based suggestions
    if (tender.status === 'DISCOVERY') {
      actions.push({
        rank: 1,
        action: 'Εκτελέστε ανάλυση Go/No-Go',
        reason: 'Ο διαγωνισμός βρίσκεται ακόμα σε στάδιο Discovery — πρέπει να αποφασίσετε αν θα συμμετάσχετε.',
        category: 'admin',
        estimatedEffort: 'medium',
      });
    }

    if (tender.goNoGoDecision && !tender.goNoGoDecision.approvedAt) {
      actions.push({
        rank: actions.length + 1,
        action: 'Εγκρίνετε την απόφαση Go/No-Go',
        reason: 'Εκκρεμεί έγκριση της απόφασης Go/No-Go.',
        category: 'admin',
        estimatedEffort: 'quick',
      });
    }

    const mandatoryGaps = tender.requirements.filter(
      (r) => r.mandatory && (r.coverageStatus === 'GAP' || r.coverageStatus === 'UNMAPPED')
    ).length;

    if (mandatoryGaps > 0) {
      actions.push({
        rank: actions.length + 1,
        action: `Καλύψτε ${mandatoryGaps} υποχρεωτικά κενά συμμόρφωσης`,
        reason: 'Υπάρχουν υποχρεωτικές απαιτήσεις χωρίς κάλυψη — αποτελεί λόγο απόρριψης.',
        category: 'compliance',
        estimatedEffort: 'extensive',
      });
    }

    const draftDocs = tender.generatedDocuments.filter((d) => d.status === 'DRAFT').length;
    if (draftDocs > 0) {
      actions.push({
        rank: actions.length + 1,
        action: `Ελέγξτε και οριστικοποιήστε ${draftDocs} έγγραφα σε DRAFT`,
        reason: 'Τα έγγραφα πρέπει να είναι σε FINAL κατάσταση πριν την υποβολή.',
        category: 'document',
        estimatedEffort: 'medium',
      });
    }

    const highRiskClauses = tender.legalClauses.filter(
      (c) => c.riskLevel === 'HIGH' || c.riskLevel === 'CRITICAL'
    ).length;
    if (highRiskClauses > 0) {
      actions.push({
        rank: actions.length + 1,
        action: `Εξετάστε ${highRiskClauses} νομικές ρήτρες υψηλού κινδύνου`,
        reason: 'Υπάρχουν νομικοί κίνδυνοι που μπορεί να επηρεάσουν τη συμμετοχή.',
        category: 'legal',
        estimatedEffort: 'medium',
      });
    }

    if (tender.pricingScenarios.filter((p) => p.isSelected).length === 0) {
      actions.push({
        rank: actions.length + 1,
        action: 'Επιλέξτε σενάριο τιμολόγησης',
        reason: 'Δεν έχει επιλεγεί ακόμα σενάριο τιμολόγησης για την οικονομική προσφορά.',
        category: 'financial',
        estimatedEffort: 'medium',
      });
    }

    // Fill up to 5 with generic suggestions
    while (actions.length < 5) {
      actions.push({
        rank: actions.length + 1,
        action: 'Εκτελέστε compliance check',
        reason: 'Τακτικός έλεγχος συμμόρφωσης για ενημερωμένη εικόνα.',
        category: 'compliance',
        estimatedEffort: 'quick',
      });
      if (actions.length >= 5) break;
      actions.push({
        rank: actions.length + 1,
        action: 'Ελέγξτε τα πιστοποιητικά για ημερομηνίες λήξης',
        reason: 'Βεβαιωθείτε ότι όλα τα πιστοποιητικά θα είναι σε ισχύ κατά την υποβολή.',
        category: 'admin',
        estimatedEffort: 'quick',
      });
    }

    return actions.slice(0, 5);
  }
}

export const aiOps = new AIOpsService();
