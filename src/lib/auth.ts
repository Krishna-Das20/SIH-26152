import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { getDatabase } from '@/lib/mongodb';

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

        if (db) {
          // MongoDB Atlas lookup
          const user = await db.collection('users').findOne({ email });
          if (!user || !user.passwordHash) {
            throw new Error('No account found with this email address.');
          }

          const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
          if (!isValid) {
            throw new Error('Incorrect password. Please try again.');
          }

          return {
            id: user._id.toString(),
            name: user.name || email.split('@')[0],
            email: user.email,
            image: user.image || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.email}`,
            role: user.role || 'analyst',
          };
        } else {
          // In-memory fallback if MongoDB Atlas is momentarily disconnecting
          if (credentials.password.length >= 6) {
            return {
              id: 'usr_local_demo',
              name: email.split('@')[0],
              email: email,
              image: `https://api.dicebear.com/7.x/bottts/svg?seed=${email}`,
              role: 'analyst',
            };
          }
          throw new Error('Invalid credentials.');
        }
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
  secret: process.env.NEXTAUTH_SECRET || 'sih26152_super_secret_session_key_2026',
};
