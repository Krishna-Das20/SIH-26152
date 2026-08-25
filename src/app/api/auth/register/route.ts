import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDatabase } from '@/lib/mongodb';

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();

    if (!email || !password || password.length < 6) {
      return NextResponse.json(
        { error: 'Email and password (min 6 characters) are required.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();
    const db = await getDatabase();

    if (!db) {
      return NextResponse.json(
        { error: 'Database connection currently unavailable. Please try again shortly.' },
        { status: 503 }
      );
    }

    // Check if user already exists
    const existingUser = await db.collection('users').findOne({ email: cleanEmail });
    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email address already exists.' },
        { status: 409 }
      );
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = {
      name: name?.trim() || cleanEmail.split('@')[0],
      email: cleanEmail,
      passwordHash,
      image: `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanEmail}`,
      role: 'analyst',
      createdAt: new Date().toISOString(),
    };

    const result = await db.collection('users').insertOne(newUser);

    return NextResponse.json({
      success: true,
      message: 'Account created successfully.',
      userId: result.insertedId.toString(),
    });
  } catch (error: any) {
    console.error('Registration Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
