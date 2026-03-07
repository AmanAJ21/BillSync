import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDatabase } from './mongodb';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export interface User {
  _id?: string;
  email: string;
  password: string;
  name: string;
  role: 'regular' | 'admin';
  resetToken?: string;
  resetTokenExpiry?: Date;
  createdAt?: Date;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export function generateToken(userId: string, role: 'regular' | 'admin'): string {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): { userId: string; role: 'regular' | 'admin' } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string; role: 'regular' | 'admin' };
  } catch {
    return null;
  }
}

export async function createUser(email: string, password: string, name: string): Promise<User> {
  const db = await getDatabase();
  const users = db.collection<User>('users');

  // Normalize email: trim whitespace and convert to lowercase
  const normalizedEmail = email.trim().toLowerCase();

  // Check if user already exists (case-insensitive)
  const existingUser = await users.findOne(
    { email: normalizedEmail },
    { collation: { locale: 'en', strength: 2 } }
  );
  if (existingUser) {
    throw new Error('User already exists');
  }

  const hashedPassword = await hashPassword(password);
  const user: User = {
    email: normalizedEmail,
    password: hashedPassword,
    name,
    role: 'regular', // Default role for new users
    createdAt: new Date(),
  };

  const result = await users.insertOne(user);
  return { ...user, _id: result.insertedId.toString() };
}

export async function authenticateUser(email: string, password: string): Promise<User | null> {
  const db = await getDatabase();
  const users = db.collection<User>('users');

  // Normalize email for lookup
  const normalizedEmail = email.trim().toLowerCase();

  const user = await users.findOne({ email: normalizedEmail });
  if (!user) {
    return null;
  }

  const isValid = await verifyPassword(password, user.password);
  if (!isValid) {
    return null;
  }

  return user;
}

export async function generateNewPassword(email: string): Promise<string | null> {
  const db = await getDatabase();
  const users = db.collection<User>('users');

  // Normalize email for lookup
  const normalizedEmail = email.trim().toLowerCase();

  const user = await users.findOne({ email: normalizedEmail });
  if (!user) {
    return null;
  }

  // Generate a random password (8 characters with mix of letters, numbers, and symbols)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let newPassword = '';
  for (let i = 0; i < 8; i++) {
    newPassword += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  // Hash the new password
  const hashedPassword = await hashPassword(newPassword);

  // Update user's password in database
  await users.updateOne(
    { email: normalizedEmail },
    {
      $set: { password: hashedPassword },
      $unset: { resetToken: '', resetTokenExpiry: '' }
    }
  );

  return newPassword;
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<boolean> {
  const db = await getDatabase();
  const users = db.collection<User>('users');

  // Get user by ID
  const { ObjectId } = require('mongodb');
  const user = await users.findOne({ _id: new ObjectId(userId) });
  if (!user) {
    return false;
  }

  // Verify current password
  const isCurrentPasswordValid = await verifyPassword(currentPassword, user.password);
  if (!isCurrentPasswordValid) {
    return false;
  }

  // Hash new password
  const hashedNewPassword = await hashPassword(newPassword);

  // Update password in database
  await users.updateOne(
    { _id: new ObjectId(userId) },
    { $set: { password: hashedNewPassword } }
  );

  return true;
}

export async function updateUserProfile(userId: string, updates: { name?: string }): Promise<User | null> {
  const db = await getDatabase();
  const users = db.collection<User>('users');

  // Get user by ID
  const { ObjectId } = require('mongodb');
  const user = await users.findOne({ _id: new ObjectId(userId) });
  if (!user) {
    return null;
  }

  // Update user profile (only name)
  const updateData: any = {};
  if (updates.name) updateData.name = updates.name;

  await users.updateOne(
    { _id: new ObjectId(userId) },
    { $set: updateData }
  );

  // Return updated user
  const updatedUser = await users.findOne({ _id: new ObjectId(userId) });
  return updatedUser;
}

export async function resetPassword(token: string, newPassword: string): Promise<boolean> {
  // This function is deprecated - we now send new passwords directly via email
  // Keeping for backward compatibility but it will always return false
  return false;
}

// Re-export auth middleware for convenience
export { verifyAuth, verifyOwnership, unauthorizedResponse, forbiddenResponse } from './middleware/auth';
