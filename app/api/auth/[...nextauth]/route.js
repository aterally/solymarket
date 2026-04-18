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
        const { rows: existing } = await sql`SELECT id, is_banned FROM users WHERE email = ${user.email}`;
        if (existing.length === 0) {
          const isAdmin = user.email === process.env.ADMIN_EMAIL;
          await sql`
            INSERT INTO users (id, email, name, image, credits, is_admin, is_banned)
            VALUES (${user.id}, ${user.email}, ${user.name}, ${user.image}, 100, ${isAdmin}, FALSE)
          `;
        } else {
          if (existing[0].is_banned) return false; // block banned users
          const isAdmin = user.email === process.env.ADMIN_EMAIL;
          await sql`UPDATE users SET name = ${user.name}, image = ${user.image}, is_admin = ${isAdmin} WHERE email = ${user.email}`;
        }
        return true;
      } catch (err) {
        console.error('SignIn error:', err);
        return false;
      }
    },
    async session({ session }) {
      if (session?.user?.email) {
        const { rows } = await sql`SELECT * FROM users WHERE email = ${session.user.email}`;
        if (rows[0]) {
          session.user.id = rows[0].id;
          session.user.credits = rows[0].credits;
          session.user.isAdmin = rows[0].is_admin;
          session.user.username = rows[0].username;
          session.user.hasUsername = !!rows[0].username;
        }
      }
      return session;
    },
  },
  pages: { signIn: '/' },
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };
