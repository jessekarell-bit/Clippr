import NextAuth, { type NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { query, queryOne } from '@/lib/db/client';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.YOUTUBE_CLIENT_ID!,
      clientSecret: process.env.YOUTUBE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/youtube',
            'https://www.googleapis.com/auth/youtube.readonly',
          ].join(' '),
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;

      // Upsert user
      await query(
        `INSERT INTO users (email, name, image)
         VALUES ($1, $2, $3)
         ON CONFLICT (email) DO UPDATE SET
           name = EXCLUDED.name,
           image = EXCLUDED.image,
           updated_at = now()`,
        [user.email, user.name, user.image]
      );

      // Store/refresh YouTube OAuth tokens
      if (account?.provider === 'google' && account.access_token) {
        const dbUser = await queryOne<{ id: string }>(
          'SELECT id FROM users WHERE email = $1',
          [user.email]
        );
        if (dbUser) {
          await query(
            `INSERT INTO platform_accounts
               (user_id, platform, platform_user_id, access_token, refresh_token, token_expires_at, scope)
             VALUES ($1, 'youtube', $2, $3, $4, $5, $6)
             ON CONFLICT (user_id, platform) DO UPDATE SET
               access_token = EXCLUDED.access_token,
               refresh_token = COALESCE(EXCLUDED.refresh_token, platform_accounts.refresh_token),
               token_expires_at = EXCLUDED.token_expires_at,
               scope = EXCLUDED.scope,
               updated_at = now()`,
            [
              dbUser.id,
              account.providerAccountId,
              account.access_token,
              account.refresh_token ?? null,
              account.expires_at
                ? new Date(account.expires_at * 1000).toISOString()
                : null,
              account.scope ?? null,
            ]
          );
        }
      }

      return true;
    },

    async session({ session, token }) {
      if (session.user?.email) {
        const dbUser = await queryOne<{ id: string }>(
          'SELECT id FROM users WHERE email = $1',
          [session.user.email]
        );
        if (dbUser) {
          (session.user as typeof session.user & { id: string }).id = dbUser.id;
        }
      }
      return session;
    },

    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
