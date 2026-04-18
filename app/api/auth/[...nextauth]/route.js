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
    async signIn({ user }) {
      try {
        const adminEmail = process.env.ADMIN_EMAIL;
        await sql`
          INSERT INTO users (id, email, name, image, credits, is_admin)
          VALUES (${user.id}, ${user.email}, ${user.name}, ${user.image}, 100, ${user.email === adminEmail})
          ON CONFLICT (email) DO UPDATE SET
            name = EXCLUDED.name,
            image = EXCLUDED.image,
            is_admin = CASE WHEN users.email = ${adminEmail} THEN TRUE ELSE users.is_admin END
        `;
        const { rows } = await sql`SELECT is_banned FROM users WHERE email = ${user.email}`;
        if (rows[0]?.is_banned) return '/banned';
        return true;
      } catch (err) {
        console.error('SignIn error:', err);
        return true;
      }
    },
    async session({ session }) {
      if (session?.user?.email) {
        try {
          const { rows } = await sql`
            SELECT id, username, is_admin, is_manager, is_banned, custom_image
            FROM users WHERE email = ${session.user.email}
          `;
          if (rows[0]) {
            session.user.id = rows[0].id;
            session.user.username = rows[0].username;
            session.user.isAdmin = rows[0].is_admin;
            session.user.isManager = rows[0].is_manager;
            session.user.hasUsername = !!rows[0].username;
            // Override image with custom avatar if set
            if (rows[0].custom_image) session.user.image = rows[0].custom_image;
          }
        } catch (err) {
          console.error('Session error:', err);
        }
      }
      return session;
    },
  },
  pages: {
    signIn: '/',
  },
});

export { handler as GET, handler as POST };
