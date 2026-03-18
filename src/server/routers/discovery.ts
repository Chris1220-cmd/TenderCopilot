import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '@/server/trpc';
import { tenderDiscovery } from '@/server/services/tender-discovery';
import { urlImporter } from '@/server/services/url-importer';
import { smartIntake } from '@/server/services/smart-intake';
import { uploadFile } from '@/lib/s3';
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
          showAll: z.boolean().optional(),
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
          showAll: input.showAll,
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

      let documentCount = 0;

      try {
        // Accepted content types for downloaded documents
        const ACCEPTED_CONTENT_TYPES = new Set([
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/zip',
          'application/x-zip-compressed',
          'text/xml',
          'application/xml',
        ]);

        const MIME_BY_EXT: Record<string, string> = {
          pdf: 'application/pdf',
          doc: 'application/msword',
          docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          zip: 'application/zip',
          xml: 'application/xml',
        };

        /** Returns true if the Content-Type header indicates an acceptable document. */
        const isAcceptedContentType = (contentType: string | null): boolean => {
          if (!contentType) return false;
          const base = contentType.split(';')[0].trim().toLowerCase();
          return ACCEPTED_CONTENT_TYPES.has(base);
        };

        // ── Diavgeia: direct PDF download via API ────────────────────
        if (input.platform === 'DIAVGEIA' || input.sourceUrl.includes('diavgeia.gov.gr')) {
          // Extract ADA from URL: https://diavgeia.gov.gr/decision/view/{ADA}
          const adaMatch = input.sourceUrl.match(/\/decision\/view\/([A-Za-z0-9Α-Ωα-ω-]+)/);
          const ada = adaMatch?.[1] || tender.referenceNumber;

          if (ada) {
            try {
              // Diavgeia API: get decision document URL
              const docUrl = `https://diavgeia.gov.gr/luminapi/api/decisions/${ada}/document`;

              const docResponse = await fetch(docUrl, {
                headers: { Accept: 'application/pdf' },
                signal: AbortSignal.timeout(30000),
              });

              const contentType = docResponse.headers.get('content-type');
              if (docResponse.ok && isAcceptedContentType(contentType)) {
                const buffer = Buffer.from(await docResponse.arrayBuffer());
                if (buffer.length > 100) {
                  const s3Key = `tenants/${ctx.tenantId}/tenders/${input.tenderId}/docs/${Date.now()}-diavgeia-${ada}.pdf`;
                  await uploadFile(s3Key, buffer, 'application/pdf');

                  await db.attachedDocument.create({
                    data: {
                      tenderId: input.tenderId,
                      fileName: `Διαύγεια-${ada}.pdf`,
                      fileKey: s3Key,
                      fileSize: buffer.length,
                      mimeType: 'application/pdf',
                      category: 'specification',
                    },
                  });
                  documentCount++;
                }
              }
            } catch (err) {
              console.error(`[fetchDocumentsFromSource] Diavgeia PDF download failed for ADA ${ada}:`, err);
              // Non-fatal — continue
            }

            // Also try to get the decision metadata for extra info
            try {
              const metaRes = await fetch(
                `https://diavgeia.gov.gr/luminapi/api/decisions/${ada}`,
                { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) }
              );
              if (metaRes.ok) {
                const meta = await metaRes.json();
                // Update tender with richer metadata
                const updates: Record<string, unknown> = {};
                if (meta.extraFieldValues?.cpv) {
                  const cpvs = Array.isArray(meta.extraFieldValues.cpv)
                    ? meta.extraFieldValues.cpv
                    : [meta.extraFieldValues.cpv];
                  if (cpvs.length > 0) updates.cpvCodes = cpvs;
                }
                if (!tender.contractingAuthority && meta.organizationLabel) {
                  updates.contractingAuthority = meta.organizationLabel;
                }
                if (Object.keys(updates).length > 0) {
                  await db.tender.update({ where: { id: input.tenderId }, data: updates });
                }
              }
            } catch {
              // Metadata enrichment is optional
            }
          }
        }

        // ── TED / KIMDIS / Other: scrape source page for document links ───
        if (documentCount === 0 && input.sourceUrl.startsWith('http')) {
          try {
            // Fetch the source page and look for document links
            const pageRes = await fetch(input.sourceUrl, {
              headers: {
                Accept: 'text/html',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              },
              signal: AbortSignal.timeout(15000),
            });

            if (pageRes.ok) {
              const html = await pageRes.text();
              // Look for PDF/DOCX/DOC/ZIP/XML links
              const linkRegex = /href=["']([^"']*\.(?:pdf|docx?|zip|xml)(?:\?[^"']*)?)["']/gi;
              const origin = new URL(input.sourceUrl).origin;
              let match;
              const seen = new Set<string>();

              while ((match = linkRegex.exec(html)) !== null && documentCount < 10) {
                const href = match[1];
                const fullUrl = href.startsWith('http') ? href : `${origin}${href.startsWith('/') ? '' : '/'}${href}`;
                if (seen.has(fullUrl)) continue;
                seen.add(fullUrl);

                try {
                  const fileRes = await fetch(fullUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0' },
                    signal: AbortSignal.timeout(30000),
                  });

                  if (!fileRes.ok) {
                    console.error(`[fetchDocumentsFromSource] Download failed (HTTP ${fileRes.status}): ${fullUrl}`);
                    continue;
                  }

                  // Validate content type
                  const ct = fileRes.headers.get('content-type');
                  if (!isAcceptedContentType(ct)) {
                    console.error(`[fetchDocumentsFromSource] Rejected content-type "${ct}" for: ${fullUrl}`);
                    continue;
                  }

                  const buf = Buffer.from(await fileRes.arrayBuffer());
                  if (buf.length > 100) {
                    const ext = fullUrl.match(/\.(pdf|docx?|zip|xml)/i)?.[1]?.toLowerCase() || 'pdf';
                    const filename = `document_${documentCount + 1}.${ext}`;
                    const s3Key = `tenants/${ctx.tenantId}/tenders/${input.tenderId}/docs/${Date.now()}-${filename}`;
                    const mimeType = MIME_BY_EXT[ext] || 'application/octet-stream';
                    await uploadFile(s3Key, buf, mimeType);
                    await db.attachedDocument.create({
                      data: {
                        tenderId: input.tenderId,
                        fileName: filename,
                        fileKey: s3Key,
                        fileSize: buf.length,
                        mimeType,
                        category: 'specification',
                      },
                    });
                    documentCount++;
                  }
                } catch (err) {
                  console.error(`[fetchDocumentsFromSource] Failed to download ${fullUrl}:`, err);
                  // Continue with remaining documents
                }
              }
            }
          } catch (err) {
            console.error(`[fetchDocumentsFromSource] Page scraping failed for ${input.sourceUrl}:`, err);
            // Page scraping failure is non-fatal
          }
        }

        // Log activity
        await db.activity.create({
          data: {
            tenderId: input.tenderId,
            action: 'documents_fetched_from_source',
            details: `Κατέβηκαν ${documentCount} έγγραφα από ${input.platform}: ${input.sourceUrl}`,
          },
        });

        return { documentCount };
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
