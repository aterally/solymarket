import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { sql } from '@vercel/postgres';

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user.email) return false;
      try {
        const { rows } = await sql`
          INSERT INTO users (id, email, name, image)
          VALUES (${user.id || profile.sub}, ${user.email}, ${user.name}, ${user.image})
          ON CONFLICT (email) DO UPDATE SET
            name = EXCLUDED.name,
            image = COALESCE(users.custom_image, EXCLUDED.image)
          RETURNING *
        `;
        return true;
      } catch (err) {
        console.error('[signIn]', err);
        return false;
      }
    },
    async session({ session, token }) {
      try {
        const { rows } = await sql`
          SELECT id, username, is_admin, is_manager, is_banned, is_frozen,
                 is_muted_comments, is_muted_markets, is_muted_proposing,
                 credits, COALESCE(custom_image, image) as image
          FROM users WHERE email = ${session.user.email}
        `;
        if (rows[0]) {
          session.user.id = rows[0].id;
          session.user.username = rows[0].username || session.user.name?.split(' ')[0];
          session.user.isAdmin = rows[0].is_admin;
          session.user.isManager = rows[0].is_manager;
          session.user.isBanned = rows[0].is_banned;
          session.user.isFrozen = rows[0].is_frozen;
          session.user.hasUsername = !!rows[0].username;
          session.user.credits = rows[0].credits;
          if (rows[0].image) session.user.image = rows[0].image;
        }
      } catch (err) {
        console.error('[session callback]', err);
      }
      return session;
    },
    async jwt({ token, user }) {
      return token;
    },
  },
  pages: {
    signIn: '/',
  },
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };
