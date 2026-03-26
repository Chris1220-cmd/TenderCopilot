import JSZip from 'jszip';
import { db } from '@/lib/db';
import { getFileBuffer } from '@/lib/s3';
import type { TenderPlatform } from '@prisma/client';

/**
 * Platform-specific folder structures for submission packages.
 */
const PLATFORM_STRUCTURES: Record<string, { folders: string[]; description: string }> = {
  ESIDIS: {
    folders: [
      'Φάκελος Δικαιολογητικών Συμμετοχής',
      'Φάκελος Τεχνικής Προσφοράς',
      'Φάκελος Οικονομικής Προσφοράς',
      'Λοιπά Έγγραφα',
    ],
    description: 'Δομή φακέλων για ΕΣΗΔΗΣ (Εθνικό Σύστημα Ηλεκτρονικών Δημοσίων Συμβάσεων)',
  },
  COSMOONE: {
    folders: [
      'Participation Documents',
      'Technical Offer',
      'Financial Offer',
      'Supporting Documents',
    ],
    description: 'Δομή φακέλων για cosmoONE',
  },
  ISUPPLIES: {
    folders: [
      'Δικαιολογητικά',
      'Τεχνική Προσφορά',
      'Οικονομική Προσφορά',
      'Συμπληρωματικά',
    ],
    description: 'Δομή φακέλων για iSupplies',
  },
  OTHER: {
    folders: [
      'Δικαιολογητικά Συμμετοχής',
      'Τεχνική Προσφορά',
      'Οικονομική Προσφορά',
      'Λοιπά',
    ],
    description: 'Γενική δομή φακέλων',
  },
};

// Mapping from requirement categories to folder indices
const CATEGORY_FOLDER_MAP: Record<string, number> = {
  PARTICIPATION_CRITERIA: 0,
  EXCLUSION_CRITERIA: 0,
  TECHNICAL_REQUIREMENTS: 1,
  FINANCIAL_REQUIREMENTS: 2,
  DOCUMENTATION_REQUIREMENTS: 0,
  CONTRACT_TERMS: 3,
};

// Envelope IDs mapped to category
function categoryToEnvelope(category: string): 'A' | 'B' | 'C' | 'D' {
  switch (category) {
    case 'PARTICIPATION_CRITERIA':
    case 'EXCLUSION_CRITERIA':
    case 'DOCUMENTATION_REQUIREMENTS':
    case 'CONTRACT_TERMS':
      return 'A';
    case 'TECHNICAL_REQUIREMENTS':
      return 'B';
    case 'FINANCIAL_REQUIREMENTS':
      return 'C';
    default:
      return 'A';
  }
}

const ENVELOPE_TITLES: Record<'A' | 'B' | 'C' | 'D', string> = {
  A: 'Φάκελος Α — Δικαιολογητικά Συμμετοχής',
  B: 'Φάκελος Β — Τεχνική Προσφορά',
  C: 'Φάκελος Γ — Οικονομική Προσφορά',
  D: 'Φάκελος Δ — Λοιπά Έγγραφα',
};

export interface PackageDocument {
  name: string;
  folder: string;
  fileKey?: string; // S3 key for actual file
  content?: string; // For generated content (will be saved as .md or .txt)
  source: 'attached' | 'generated' | 'company';
}

export interface PackageValidation {
  valid: boolean;
  missingDocuments: string[];
  warnings: string[];
  documents: PackageDocument[];
}

// ─── Enhanced Validation Types ──────────────────────────────

export type ValidationSeverity = 'BLOCKER' | 'WARNING' | 'INFO';

export interface ValidationIssue {
  severity: ValidationSeverity;
  message: string;
  requirementId?: string;
  action?: string;
  envelope: 'A' | 'B' | 'C' | 'D';
}

export interface EnvelopePreview {
  id: 'A' | 'B' | 'C' | 'D';
  title: string;
  documents: PackageDocument[];
  documentCount: number;
}

export interface FinalValidation {
  canProceed: boolean;
  blockers: ValidationIssue[];
  warnings: ValidationIssue[];
  infos: ValidationIssue[];
  envelopes: EnvelopePreview[];
  readinessScore: number;
  deadline: string | null;
}

/**
 * Service for building submission packages (ZIP files) for tender platforms.
 */
export class PackagingService {
  /**
   * Get the folder structure for a given platform.
   */
  getPlatformStructure(platform: TenderPlatform) {
    return PLATFORM_STRUCTURES[platform] || PLATFORM_STRUCTURES.OTHER;
  }

  /**
   * Run final validation before package assembly.
   * Reuses fakelos data + adds packaging-specific checks.
   */
  async runFinalValidation(tenderId: string, tenantId: string): Promise<FinalValidation> {
    const tender = await db.tender.findUniqueOrThrow({
      where: { id: tenderId },
      include: {
        requirements: {
          include: {
            mappings: {
              include: {
                certificate: true,
                legalDocument: true,
                project: true,
              },
            },
          },
        },
        attachedDocuments: true,
        generatedDocuments: true,
      },
    });

    const structure = this.getPlatformStructure(tender.platform);
    const blockers: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];
    const infos: ValidationIssue[] = [];
    const envelopeDocs: Record<'A' | 'B' | 'C' | 'D', PackageDocument[]> = {
      A: [], B: [], C: [], D: [],
    };

    const deadline = tender.submissionDeadline;
    const deadlineStr = deadline?.toISOString() ?? null;

    // 1. Check each requirement
    for (const req of tender.requirements) {
      const env = categoryToEnvelope(req.category);

      if (req.coverageStatus === 'GAP' || req.coverageStatus === 'UNMAPPED') {
        const issue: ValidationIssue = {
          severity: req.mandatory ? 'BLOCKER' : 'INFO',
          message: req.mandatory
            ? `Λείπει: ${req.text}${req.articleReference ? ` (${req.articleReference})` : ''}`
            : `Προαιρετικό: ${req.text} — δεν βρέθηκε`,
          requirementId: req.id,
          action: req.mandatory ? 'Ανεβάστε ή δημιουργήστε το έγγραφο' : undefined,
          envelope: env,
        };
        if (req.mandatory) blockers.push(issue);
        else infos.push(issue);
        continue;
      }

      // Check mapped certificates for expiry
      for (const mapping of req.mappings) {
        if (mapping.certificate) {
          const cert = mapping.certificate;
          if (cert.expiryDate && deadline) {
            const daysUntilExpiry = Math.ceil(
              (cert.expiryDate.getTime() - deadline.getTime()) / 86400000
            );
            if (daysUntilExpiry < 0) {
              blockers.push({
                severity: 'BLOCKER',
                message: `${cert.title} έληξε ${cert.expiryDate.toLocaleDateString('el-GR')} — η υποβολή είναι ${deadline.toLocaleDateString('el-GR')}`,
                requirementId: req.id,
                action: 'Πάρτε νέο πιστοποιητικό',
                envelope: env,
              });
            } else if (daysUntilExpiry <= 5) {
              warnings.push({
                severity: 'WARNING',
                message: `${cert.title} λήγει ${cert.expiryDate.toLocaleDateString('el-GR')} (${daysUntilExpiry} μέρες πριν τη λήξη υποβολής) — σκεφτείτε ανανέωση`,
                requirementId: req.id,
                action: 'Ανανεώστε πριν την υποβολή',
                envelope: env,
              });
            }
          }

          if (cert.fileKey) {
            const folderIndex = CATEGORY_FOLDER_MAP[req.category] ?? 0;
            envelopeDocs[env].push({
              name: cert.fileName || `${cert.title}.pdf`,
              folder: structure.folders[folderIndex],
              fileKey: cert.fileKey,
              source: 'company',
            });
          }
        }

        if (mapping.legalDocument?.fileKey) {
          const folderIndex = CATEGORY_FOLDER_MAP[req.category] ?? 0;
          envelopeDocs[env].push({
            name: mapping.legalDocument.fileName || `${mapping.legalDocument.title}.pdf`,
            folder: structure.folders[folderIndex],
            fileKey: mapping.legalDocument.fileKey,
            source: 'company',
          });
        }
      }
    }

    // 2. Check generated documents
    for (const doc of tender.generatedDocuments) {
      let env: 'A' | 'B' | 'C' | 'D' = 'B';
      let folderIndex = 1;
      if (doc.type === 'SOLEMN_DECLARATION' || doc.type === 'NON_EXCLUSION_DECLARATION' || doc.type === 'ESPD') {
        env = 'A';
        folderIndex = 0;
      } else if (doc.type === 'TECHNICAL_COMPLIANCE' || doc.type === 'TECHNICAL_PROPOSAL' || doc.type === 'METHODOLOGY') {
        env = 'B';
        folderIndex = 1;
      }

      if (doc.status !== 'FINAL') {
        warnings.push({
          severity: 'WARNING',
          message: `"${doc.title}" σε κατάσταση ${doc.status} — πρέπει FINAL πριν την υποβολή`,
          action: 'Αλλάξτε σε FINAL στα Έγγραφα',
          envelope: env,
        });
      }

      envelopeDocs[env].push({
        name: doc.fileName || `${doc.title}.md`,
        folder: structure.folders[folderIndex],
        content: doc.content,
        fileKey: doc.fileKey || undefined,
        source: 'generated',
      });
    }

    // 3. Check for empty envelopes (A and B are critical)
    if (envelopeDocs.A.length === 0) {
      blockers.push({
        severity: 'BLOCKER',
        message: 'Φάκελος Α (Δικαιολογητικά Συμμετοχής) είναι κενός',
        action: 'Ανεβάστε δικαιολογητικά ή δημιουργήστε ΥΕΥΔ/ΕΣΠΔ',
        envelope: 'A',
      });
    }
    if (envelopeDocs.B.length === 0) {
      blockers.push({
        severity: 'BLOCKER',
        message: 'Φάκελος Β (Τεχνική Προσφορά) είναι κενός',
        action: 'Δημιουργήστε τεχνική προσφορά',
        envelope: 'B',
      });
    }

    // 4. Apply naming & ordering to each envelope
    const envelopes: EnvelopePreview[] = (['A', 'B', 'C', 'D'] as const).map((id) => {
      const docs = this.applyNamingAndOrdering(envelopeDocs[id], id);
      return {
        id,
        title: ENVELOPE_TITLES[id],
        documents: docs,
        documentCount: docs.length,
      };
    });

    // 5. Calculate readiness
    const totalMandatory = tender.requirements.filter(r => r.mandatory).length;
    const coveredMandatory = tender.requirements.filter(
      r => r.mandatory && r.coverageStatus === 'COVERED'
    ).length;
    const readinessScore = totalMandatory > 0
      ? Math.round((coveredMandatory / totalMandatory) * 100)
      : 0;

    return {
      canProceed: blockers.length === 0,
      blockers,
      warnings,
      infos,
      envelopes,
      readinessScore,
      deadline: deadlineStr,
    };
  }

  // Temporary stub — will be replaced in Task 3
  applyNamingAndOrdering(documents: PackageDocument[], _envelopeId: 'A' | 'B' | 'C' | 'D'): PackageDocument[] {
    return documents;
  }

  /**
   * Validate that all required documents are present for packaging.
   */
  async validatePackage(tenderId: string): Promise<PackageValidation> {
    const tender = await db.tender.findUniqueOrThrow({
      where: { id: tenderId },
      include: {
        requirements: {
          where: { mandatory: true },
          include: {
            mappings: {
              include: {
                certificate: true,
                legalDocument: true,
              },
            },
          },
        },
        attachedDocuments: true,
        generatedDocuments: true,
      },
    });

    const structure = this.getPlatformStructure(tender.platform);
    const documents: PackageDocument[] = [];
    const missingDocuments: string[] = [];
    const warnings: string[] = [];

    // Check requirements coverage
    for (const req of tender.requirements) {
      if (req.coverageStatus === 'GAP' || req.coverageStatus === 'UNMAPPED') {
        missingDocuments.push(`[${req.category}] ${req.text}`);
      }

      // Add mapped documents
      for (const mapping of req.mappings) {
        if (mapping.certificate?.fileKey) {
          const folderIndex = CATEGORY_FOLDER_MAP[req.category] ?? 0;
          documents.push({
            name: mapping.certificate.fileName || `certificate_${mapping.certificate.id}.pdf`,
            folder: structure.folders[folderIndex],
            fileKey: mapping.certificate.fileKey,
            source: 'company',
          });
        }
        if (mapping.legalDocument?.fileKey) {
          const folderIndex = CATEGORY_FOLDER_MAP[req.category] ?? 0;
          documents.push({
            name: mapping.legalDocument.fileName || `legal_${mapping.legalDocument.id}.pdf`,
            folder: structure.folders[folderIndex],
            fileKey: mapping.legalDocument.fileKey,
            source: 'company',
          });
        }
      }
    }

    // Add generated documents
    for (const doc of tender.generatedDocuments) {
      if (doc.status !== 'FINAL') {
        warnings.push(`Το έγγραφο "${doc.title}" δεν είναι σε κατάσταση FINAL`);
      }

      let folderIndex = 1; // Default to technical
      if (doc.type === 'SOLEMN_DECLARATION' || doc.type === 'NON_EXCLUSION_DECLARATION') {
        folderIndex = 0;
      } else if (doc.type === 'TECHNICAL_COMPLIANCE' || doc.type === 'TECHNICAL_PROPOSAL' || doc.type === 'METHODOLOGY') {
        folderIndex = 1;
      }

      documents.push({
        name: doc.fileName || `${doc.title}.md`,
        folder: structure.folders[folderIndex],
        content: doc.content,
        fileKey: doc.fileKey || undefined,
        source: 'generated',
      });
    }

    // Add attached specification documents
    for (const doc of tender.attachedDocuments) {
      documents.push({
        name: doc.fileName,
        folder: structure.folders[3] || structure.folders[structure.folders.length - 1],
        fileKey: doc.fileKey,
        source: 'attached',
      });
    }

    return {
      valid: missingDocuments.length === 0,
      missingDocuments,
      warnings,
      documents,
    };
  }

  /**
   * Build a ZIP file with the submission package.
   */
  async buildPackage(
    tenderId: string,
    documentMapping: PackageDocument[]
  ): Promise<Buffer> {
    const zip = new JSZip();

    const tender = await db.tender.findUniqueOrThrow({
      where: { id: tenderId },
    });

    // Create folder structure
    const structure = this.getPlatformStructure(tender.platform);
    for (const folder of structure.folders) {
      zip.folder(folder);
    }

    // Add documents to appropriate folders
    for (const doc of documentMapping) {
      const folderPath = doc.folder;

      if (doc.fileKey) {
        try {
          const buffer = await getFileBuffer(doc.fileKey);
          zip.file(`${folderPath}/${doc.name}`, buffer);
        } catch (error) {
          console.error(`Failed to fetch file ${doc.fileKey}:`, error);
          // Add placeholder
          zip.file(
            `${folderPath}/${doc.name}.MISSING.txt`,
            `Το αρχείο δεν βρέθηκε: ${doc.fileKey}`
          );
        }
      } else if (doc.content) {
        zip.file(`${folderPath}/${doc.name}`, doc.content);
      }
    }

    // Add README with package info
    const readme = `# Πακέτο Υποβολής
Διαγωνισμός: ${tender.title}
Αριθμός Αναφοράς: ${tender.referenceNumber || 'N/A'}
Πλατφόρμα: ${tender.platform}
Ημ/νία Δημιουργίας: ${new Date().toLocaleDateString('el-GR')}

## Δομή Φακέλων
${structure.folders.map((f, i) => `${i + 1}. ${f}`).join('\n')}

## Σημείωση
Αυτό το πακέτο δημιουργήθηκε αυτόματα από το TenderCopilot GR.
Παρακαλώ ελέγξτε όλα τα έγγραφα πριν την υποβολή.
`;
    zip.file('README.txt', readme);

    // Generate ZIP buffer
    const buffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    // Log activity
    await db.activity.create({
      data: {
        tenderId,
        action: 'package_built',
        details: `Δημιουργήθηκε πακέτο υποβολής με ${documentMapping.length} αρχεία`,
      },
    });

    return buffer;
  }
}

export const packagingService = new PackagingService();
