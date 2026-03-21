import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '@/server/trpc';
import { tenderDiscovery } from '@/server/services/tender-discovery';
import { urlImporter } from '@/server/services/url-importer';
import { smartIntake } from '@/server/services/smart-intake';
import { fetchDocumentsForTender } from '@/server/services/document-fetcher';
import { TENDER_SOURCES, SOURCE_CATEGORIES } from '@/data/tender-sources';
import { db } from '@/lib/db';
import type { TenderPlatform } from '@prisma/client';

/**
 * Exported for testing. Returns { missingKad: true } if the tenant has
 * no company profile or no KAD codes set.
 */
export async function checkKadGuard(tenantId: string): Promise<{ missingKad: boolean }> {
  const company = await db.companyProfile.findFirst({
    where: { tenantId },
    select: { kadCodes: true },
  });
  if (!company || company.kadCodes.length === 0) {
    return { missingKad: true };
  }
  return { missingKad: false };
}

/** Detect the correct TenderPlatform enum value from a URL. */
function detectPlatformFromUrl(url: string): TenderPlatform {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes('diavgeia.gov.gr')) return 'DIAVGEIA';
    if (hostname.includes('ted.europa.eu')) return 'TED';
    if (hostname.includes('promitheus.gov.gr') || hostname.includes('eprocurement.gov.gr')) return 'KIMDIS';
  } catch {
    // Invalid URL — fall through to OTHER
  }
  return 'OTHER';
}

export const discoveryRouter = router({
  /**
   * Returns the full list of available tender sources and categories.
   * Used by the frontend SourceSelector sidebar.
   */
  getSources: protectedProcedure.query(() => {
    return {
      sources: TENDER_SOURCES,
      categories: SOURCE_CATEGORIES,
    };
  }),

  /**
   * Search for tenders matching optional filters.
   * If no filters provided, matches against the tenant's company profile.
   */
  search: protectedProcedure
    .input(
      z
        .object({
          cpvCodes: z.array(z.string()).optional(),
          kadCodes: z.array(z.string()).optional(),
          keywords: z.array(z.string()).optional(),
          minBudget: z.number().optional(),
          maxBudget: z.number().optional(),
          platforms: z
            .array(z.enum(['KIMDIS', 'DIAVGEIA', 'TED', 'ESIDIS', 'OTHER', 'PRIVATE', 'GOOGLE']))
            .optional(),
          sources: z.array(z.string()).optional(),
          showAll: z.boolean().optional(),
          country: z.enum(['GR', 'EU', 'international', 'all']).optional(),
          entityType: z.enum(['public', 'private', 'all']).optional(),
          relevanceOnly: z.boolean().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No tenant associated.',
        });
      }

      if (input && Object.keys(input).length > 0) {
        // Use explicit filters
        const tenders = await tenderDiscovery.searchTenders({
          cpvCodes: input.cpvCodes,
          kadCodes: input.kadCodes,
          keywords: input.keywords,
          minBudget: input.minBudget,
          maxBudget: input.maxBudget,
          platforms: input.platforms,
          sources: input.sources,
          showAll: input.showAll,
          country: input.country,
          entityType: input.entityType,
          relevanceOnly: input.relevanceOnly,
          tenantId: ctx.tenantId!,
        });

        return tenders.map((t) => ({
          ...t,
          relevanceScore: 0,
          publishedAt: t.publishedAt.toISOString(),
          submissionDeadline: t.submissionDeadline?.toISOString() ?? null,
        }));
      }

      // No filters - match against company profile
      const results = await tenderDiscovery.matchTendersForTenant(ctx.tenantId);

      return results.map((t) => ({
        ...t,
        publishedAt: t.publishedAt.toISOString(),
        submissionDeadline: t.submissionDeadline?.toISOString() ?? null,
      }));
    }),

  /**
   * Get top 10 recommended tenders for the tenant based on company profile.
   */
  getRecommended: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.tenantId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'No tenant associated.',
      });
    }

    const guard = await checkKadGuard(ctx.tenantId);
    if (guard.missingKad) {
      return { tenders: [], missingKad: true };
    }

    const results = await tenderDiscovery.matchTendersForTenant(ctx.tenantId);

    // Return top 10 by relevance score
    return {
      tenders: results.slice(0, 10).map((t) => ({
        ...t,
        publishedAt: t.publishedAt.toISOString(),
        submissionDeadline: t.submissionDeadline?.toISOString() ?? null,
      })),
      missingKad: false,
    };
  }),

  /**
   * Import a tender from a procurement platform URL.
   * Scrapes the page, extracts metadata, downloads attachments,
   * creates a Tender record, and queues analysis.
   */
  importFromUrl: protectedProcedure
    .input(
      z.object({
        url: z.string().url(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No tenant associated.',
        });
      }

      try {
        const platform = detectPlatformFromUrl(input.url);
        const result = await urlImporter.importFromUrl(input.url, ctx.tenantId);

        // Ensure the platform is correctly set — the url-importer's own
        // detectPlatform may return OTHER for known platforms (e.g. Diavgeia, TED).
        if (platform !== 'OTHER') {
          await db.tender.update({
            where: { id: result.tenderId },
            data: { platform },
          });
        }

        return {
          tenderId: result.tenderId,
          title: result.metadata.title,
          referenceNumber: result.metadata.referenceNumber ?? null,
          contractingAuthority: result.metadata.contractingAuthority ?? null,
          documentCount: result.documentCount,
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message:
            error instanceof Error
              ? `Failed to import tender: ${error.message}`
              : 'Failed to import tender from URL',
        });
      }
    }),

  /**
   * Import tender from already-uploaded files (Smart Intake).
   * Takes S3 keys of files that were uploaded via a separate upload endpoint,
   * extracts text, identifies metadata with AI, creates Tender + AttachedDocuments,
   * and queues analysis + compliance check.
   */
  importFromFiles: protectedProcedure
    .input(
      z.object({
        files: z.array(
          z.object({
            key: z.string(),
            name: z.string(),
            mimeType: z.string(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No tenant associated.',
        });
      }

      if (input.files.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'At least one file is required.',
        });
      }

      try {
        const result = await smartIntake.processFromS3Keys(
          input.files,
          ctx.tenantId
        );

        return {
          tenderId: result.tenderId,
          title: result.extractedMetadata.title,
          referenceNumber: result.extractedMetadata.referenceNumber ?? null,
          contractingAuthority:
            result.extractedMetadata.contractingAuthority ?? null,
          isTenderDocument: result.extractedMetadata.isTenderDocument,
          confidence: result.extractedMetadata.confidence,
          fileCount: result.fileCount,
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message:
            error instanceof Error
              ? `Smart intake failed: ${error.message}`
              : 'Failed to process uploaded files',
        });
      }
    }),

  /**
   * After creating a tender from discovery, fetch the source documents.
   * For Diavgeia: downloads the decision PDF from the API.
   * For TED/KIMDIS: scrapes the source page for document links.
   * Stores documents in Supabase Storage and creates AttachedDocument records.
   */
  fetchDocumentsFromSource: protectedProcedure
    .input(
      z.object({
        tenderId: z.string(),
        sourceUrl: z.string(),
        platform: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      const tender = await db.tender.findUnique({ where: { id: input.tenderId } });
      if (!tender || tender.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Tender not found.' });
      }

      try {
        return await fetchDocumentsForTender({
          tenderId: input.tenderId,
          tenantId: ctx.tenantId,
          sourceUrl: input.sourceUrl,
          platform: input.platform,
        });
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error
            ? `Αποτυχία λήψης εγγράφων: ${error.message}`
            : 'Αποτυχία λήψης εγγράφων από πηγή',
        });
      }
    }),
});
