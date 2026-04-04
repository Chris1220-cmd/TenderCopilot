import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { findUserByEmail, findTenantUser } from '@/lib/auth-db';
import { recordLoginEvent, checkSuperAdmin } from '@/server/services/login-event-service';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      async authorize(credentials) {
        try {
          const email = credentials?.email as string;
          const password = credentials?.password as string;
          if (!email || !password) return null;

          const user = await findUserByEmail(email);
          if (!user?.hashedPassword) return null;

          const valid = await bcrypt.compare(password, user.hashedPassword);
          if (!valid) return null;

          return { id: user.id, email: user.email, name: user.name };
        } catch (e) {
          console.error('[Auth] authorize error:', e);
          return null;
        }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  trustHost: true,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;

        try {
          const tenantUser = await findTenantUser(user.id as string);
          if (tenantUser) {
            token.tenantId = tenantUser.tenantId;
            token.role = tenantUser.role;
          }
        } catch (e) {
          console.error('[Auth] tenant lookup error:', e);
        }

        // Record login event & check super admin
        recordLoginEvent({
          userId: user.id as string,
          tenantId: token.tenantId as string | undefined,
        }).catch(() => {});

        checkSuperAdmin(user.id as string, user.email as string).catch(() => {});
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.tenantId = token.tenantId;
        session.user.role = token.role;
      }
      return session;
    },
  },
});
