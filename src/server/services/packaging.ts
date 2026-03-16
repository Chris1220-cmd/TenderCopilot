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
