import { z } from 'zod';
import { router, protectedProcedure } from '@/server/trpc';

export const notificationRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.notification.findMany({
      where: { userId: ctx.user.id },
      orderBy: [{ readAt: 'asc' }, { createdAt: 'desc' }],
      take: 20,
    });
  }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.notification.count({
      where: { userId: ctx.user.id, readAt: null },
    });
  }),

  markRead: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.notification.update({
        where: { id: input.id, userId: ctx.user.id },
        data: { readAt: new Date() },
      });
    }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.db.notification.updateMany({
      where: { userId: ctx.user.id, readAt: null },
      data: { readAt: new Date() },
    });
  }),
});

// Helper: create a notification (used from other services)
export async function createNotification(
  db: any,
  userId: string,
  type: string,
  title: string,
  opts?: { body?: string; linkUrl?: string }
) {
  await db.notification.create({
    data: { userId, type, title, body: opts?.body, linkUrl: opts?.linkUrl },
  });
}
