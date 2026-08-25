import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { getDatabase } from '@/lib/mongodb';

/**
 * A valid bcrypt hash of a value no user can supply. Compared against when an
 * account is not found, so lookup failures and wrong passwords take the same
 * amount of time (prevents user enumeration by timing).
 */
const DUMMY_PASSWORD_HASH =
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

/**
 * NEXTAUTH_SECRET signs every session JWT. A committed fallback value means
 * anyone reading the repository can forge a valid session, so this refuses to
 * start without one rather than silently using a public constant.
 */
function requireSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'NEXTAUTH_SECRET is missing or too short (needs >= 32 chars). ' +
        'Generate one with:  openssl rand -base64 32'
    );
  }
  return secret;
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      allowDangerousEmailAccountLinking: true,
    }),
    CredentialsProvider({
      name: 'Email & Password',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'analyst@ntro.gov.in' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Please enter an email and password.');
        }

        const email = credentials.email.toLowerCase().trim();
        const db = await getDatabase();

        // FAIL CLOSED. There is deliberately no offline fallback here: the
        // previous behaviour accepted any email with any 6-character password
        // whenever Atlas was unreachable, which is a full authentication
        // bypass triggerable by causing a database outage.
        if (!db) {
          console.error('Auth attempt refused: user database unreachable.');
          throw new Error('Authentication service is temporarily unavailable. Please try again shortly.');
        }

        const user = await db.collection('users').findOne({ email });

        // Compare against a dummy hash when the user is absent so that the
        // response time does not reveal whether an account exists.
        const hash = user?.passwordHash ?? DUMMY_PASSWORD_HASH;
        const isValid = await bcrypt.compare(credentials.password, hash);

        if (!user?.passwordHash || !isValid) {
          throw new Error('Invalid email or password.');
        }

        return {
          id: user._id.toString(),
          name: user.name || email.split('@')[0],
          email: user.email,
          image: user.image || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.email}`,
          role: user.role || 'analyst',
        };
      },
    }),
  ],
  pages: {
    signIn: '/auth/signin',
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role || 'analyst';
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role || 'analyst';
      }
      return session;
    },
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google') {
        const db = await getDatabase();
        if (db && user.email) {
          // Upsert Google user in MongoDB Atlas
          await db.collection('users').updateOne(
            { email: user.email.toLowerCase() },
            {
              $set: {
                name: user.name,
                email: user.email.toLowerCase(),
                image: user.image,
                lastLogin: new Date().toISOString(),
                role: 'analyst',
              },
              $setOnInsert: {
                createdAt: new Date().toISOString(),
              },
            },
            { upsert: true }
          );
        }
      }
      return true;
    },
  },
  secret: requireSecret(),
};
