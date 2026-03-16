import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '@/server/trpc';
import { tenderDiscovery } from '@/server/services/tender-discovery';
import { urlImporter } from '@/server/services/url-importer';
import { smartIntake } from '@/server/services/smart-intake';

export const discoveryRouter = router({
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
            .array(z.enum(['KIMDIS', 'DIAVGEIA', 'TED', 'ESIDIS']))
            .optional(),
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

    const results = await tenderDiscovery.matchTendersForTenant(ctx.tenantId);

    // Return top 10 by relevance score
    return results.slice(0, 10).map((t) => ({
      ...t,
      publishedAt: t.publishedAt.toISOString(),
      submissionDeadline: t.submissionDeadline?.toISOString() ?? null,
    }));
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
        const result = await urlImporter.importFromUrl(input.url, ctx.tenantId);

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
});
