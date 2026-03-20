import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '@/server/trpc';
import { deleteFile } from '@/lib/s3';
import { readTenderDocuments, deepParseDocument } from '@/server/services/document-reader';

const generatedDocTypeEnum = z.enum([
  'SOLEMN_DECLARATION',
  'NON_EXCLUSION_DECLARATION',
  'TECHNICAL_COMPLIANCE',
  'TECHNICAL_PROPOSAL',
  'METHODOLOGY',
  'COVER_LETTER',
  'OTHER',
]);

const docGenStatusEnum = z.enum(['DRAFT', 'REVIEWED', 'FINAL']);

export const documentRouter = router({
  // ─── Attached Documents ─────────────────────────────────────

  listAttached: protectedProcedure
    .input(z.object({ tenderId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      const tender = await ctx.db.tender.findUnique({ where: { id: input.tenderId } });
      if (!tender || tender.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Tender not found.' });
      }

      return ctx.db.attachedDocument.findMany({
        where: { tenderId: input.tenderId },
        orderBy: { createdAt: 'desc' },
      });
    }),

  createAttached: protectedProcedure
    .input(
      z.object({
        tenderId: z.string().cuid(),
        fileName: z.string().min(1),
        fileKey: z.string().min(1),
        fileSize: z.number().int().nullish(),
        mimeType: z.string().nullish(),
        category: z.string().nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      const tender = await ctx.db.tender.findUnique({ where: { id: input.tenderId } });
      if (!tender || tender.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Tender not found.' });
      }

      const doc = await ctx.db.attachedDocument.create({
        data: input,
      });

      // Fire-and-forget: pre-extract text (including OCR for scanned PDFs)
      // so it's cached before analysis runs — avoids timeout during AI analysis
      readTenderDocuments(input.tenderId).catch((err) => {
        console.error(`[createAttached] Background text extraction failed:`, err);
      });

      return doc;
    }),

  deleteAttached: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      const doc = await ctx.db.attachedDocument.findUnique({
        where: { id: input.id },
        include: { tender: { select: { tenantId: true } } },
      });

      if (!doc || doc.tender.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found.' });
      }

      // Delete from S3 first
      try {
        await deleteFile(doc.fileKey);
      } catch {
        // Log but don't block deletion if S3 removal fails
        console.error(`Failed to delete S3 object: ${doc.fileKey}`);
      }

      return ctx.db.attachedDocument.delete({ where: { id: input.id } });
    }),

  deepParse: protectedProcedure
    .input(z.object({ documentId: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      const doc = await ctx.db.attachedDocument.findUnique({
        where: { id: input.documentId },
        include: { tender: { select: { tenantId: true, id: true } } },
      });

      if (!doc || doc.tender.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found.' });
      }

      try {
        const result = await deepParseDocument(input.documentId);
        return { success: true, method: result.method };
      } catch (err) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: err instanceof Error ? err.message : 'Deep parse failed',
        });
      }
    }),

  // ─── Generated Documents ────────────────────────────────────

  listGenerated: protectedProcedure
    .input(z.object({ tenderId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      const tender = await ctx.db.tender.findUnique({ where: { id: input.tenderId } });
      if (!tender || tender.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Tender not found.' });
      }

      return ctx.db.generatedDocument.findMany({
        where: { tenderId: input.tenderId },
        orderBy: { updatedAt: 'desc' },
      });
    }),

  createGenerated: protectedProcedure
    .input(
      z.object({
        tenderId: z.string().cuid(),
        type: generatedDocTypeEnum,
        title: z.string().min(1),
        content: z.string().min(1),
        fileKey: z.string().nullish(),
        fileName: z.string().nullish(),
        status: docGenStatusEnum.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      const tender = await ctx.db.tender.findUnique({ where: { id: input.tenderId } });
      if (!tender || tender.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Tender not found.' });
      }

      return ctx.db.generatedDocument.create({
        data: input,
      });
    }),

  updateGenerated: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        title: z.string().min(1).optional(),
        content: z.string().min(1).optional(),
        status: docGenStatusEnum.optional(),
        fileKey: z.string().nullish(),
        fileName: z.string().nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      const { id, ...data } = input;

      const doc = await ctx.db.generatedDocument.findUnique({
        where: { id },
        include: { tender: { select: { tenantId: true } } },
      });

      if (!doc || doc.tender.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found.' });
      }

      return ctx.db.generatedDocument.update({ where: { id }, data });
    }),

  deleteGenerated: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.tenantId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No tenant associated.' });
      }

      const doc = await ctx.db.generatedDocument.findUnique({
        where: { id: input.id },
        include: { tender: { select: { tenantId: true } } },
      });

      if (!doc || doc.tender.tenantId !== ctx.tenantId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found.' });
      }

      return ctx.db.generatedDocument.delete({ where: { id: input.id } });
    }),
});
