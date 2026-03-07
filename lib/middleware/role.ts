import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse, forbiddenResponse } from './auth';

/**
 * Middleware to require admin role for route access
 * Returns 401 if not authenticated, 403 if not admin
 */
export async function requireAdmin(request: NextRequest): Promise<NextResponse | null> {
  // Verify authentication first
  const authResult = await verifyAuth(request);
  
  if (!authResult.authenticated) {
    return unauthorizedResponse('Authentication required');
  }
  
  // Get user from database to check role
  const { getDatabase } = await import('../mongodb');
  const { ObjectId } = await import('mongodb');
  
  const db = await getDatabase();
  const users = db.collection('users');
  const user = await users.findOne({ _id: new ObjectId(authResult.user!.id) });
  
  if (!user || user.role !== 'admin') {
    return forbiddenResponse('Admin access required');
  }
  
  // Return null to indicate authorization passed
  return null;
}

/**
 * Middleware factory to require specific role for route access
 * Returns 401 if not authenticated, 403 if role doesn't match
 */
export function requireRole(role: 'regular' | 'admin') {
  return async (request: NextRequest): Promise<NextResponse | null> => {
    // Verify authentication first
    const authResult = await verifyAuth(request);
    
    if (!authResult.authenticated) {
      return unauthorizedResponse('Authentication required');
    }
    
    // Get user from database to check role
    const { getDatabase } = await import('../mongodb');
    const { ObjectId } = await import('mongodb');
    
    const db = await getDatabase();
    const users = db.collection('users');
    const user = await users.findOne({ _id: new ObjectId(authResult.user!.id) });
    
    if (!user || user.role !== role) {
      return forbiddenResponse(`${role.charAt(0).toUpperCase() + role.slice(1)} access required`);
    }
    
    // Return null to indicate authorization passed
    return null;
  };
}
