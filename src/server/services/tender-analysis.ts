import { db } from '@/lib/db';
import { ai } from '@/server/ai';
import type { TenderAnalysisResult, ExtractedRequirement } from '@/server/ai/types';
import type { RequirementCategory, RequirementType } from '@prisma/client';

/**
 * Service that analyzes tender specification documents using AI.
 * Extracts requirements, metadata, and categorizes them.
 */
export class TenderAnalysisService {
  /**
   * Analyze tender documents and extract requirements.
   * Called as a background job after document upload.
   */
  async analyzeTender(tenderId: string, documentTexts: string[]): Promise<TenderAnalysisResult> {
    const combinedText = documentTexts.join('\n\n---DOCUMENT SEPARATOR---\n\n');

    const result = await ai().complete({
      messages: [
        {
          role: 'system',
          content: `You are an expert Greek public procurement analyst. Your task is to analyze tender specification documents (διακηρύξεις) and extract requirements.

For each requirement, identify:
- text: the exact requirement text in Greek
- category: one of PARTICIPATION_CRITERIA, EXCLUSION_CRITERIA, TECHNICAL_REQUIREMENTS, FINANCIAL_REQUIREMENTS, DOCUMENTATION_REQUIREMENTS, CONTRACT_TERMS
- articleReference: the legal article reference (e.g. "Άρθρο 73 Ν.4412/2016")
- mandatory: whether this is a mandatory requirement (true/false)
- type: one of DOCUMENT, EXPERIENCE, CERTIFICATE, DECLARATION, FINANCIAL, TECHNICAL, OTHER
- confidence: your confidence in this extraction (0-1)

Also extract metadata: title, referenceNumber, contractingAuthority, budget, submissionDeadline, cpvCodes.

Respond ONLY with valid JSON matching the TenderAnalysisResult schema.`,
        },
        {
          role: 'user',
          content: `Analyze the following tender specification documents and extract all requirements:\n\n${combinedText}`,
        },
      ],
      maxTokens: 8000,
      temperature: 0.1,
      responseFormat: 'json',
    });

    const analysis: TenderAnalysisResult = JSON.parse(result.content);
    return analysis;
  }

  /**
   * Save extracted requirements to the database.
   */
  async saveRequirements(tenderId: string, analysis: TenderAnalysisResult): Promise<void> {
    // Update tender metadata if extracted
    const updateData: Record<string, unknown> = {};
    if (analysis.title) updateData.title = analysis.title;
    if (analysis.referenceNumber) updateData.referenceNumber = analysis.referenceNumber;
    if (analysis.contractingAuthority) updateData.contractingAuthority = analysis.contractingAuthority;
    if (analysis.budget) updateData.budget = analysis.budget;
    if (analysis.submissionDeadline) updateData.submissionDeadline = new Date(analysis.submissionDeadline);
    if (analysis.cpvCodes) updateData.cpvCodes = analysis.cpvCodes;

    if (Object.keys(updateData).length > 0) {
      await db.tender.update({
        where: { id: tenderId },
        data: updateData,
      });
    }

    // Create requirements
    if (analysis.requirements.length > 0) {
      await db.tenderRequirement.createMany({
        data: analysis.requirements.map((req) => ({
          tenderId,
          text: req.text,
          category: req.category as RequirementCategory,
          articleReference: req.articleReference || null,
          mandatory: req.mandatory,
          type: req.type as RequirementType,
          coverageStatus: 'UNMAPPED',
          aiConfidence: req.confidence,
        })),
      });
    }

    // Log activity
    await db.activity.create({
      data: {
        tenderId,
        action: 'requirements_extracted',
        details: `Εξήχθησαν ${analysis.requirements.length} απαιτήσεις από την ανάλυση AI`,
      },
    });
  }
}

export const tenderAnalysisService = new TenderAnalysisService();
