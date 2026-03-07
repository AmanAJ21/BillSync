import { describe, it, expect } from 'vitest';
import { generateToken, verifyToken } from '../auth';

describe('JWT Token with Role Claim', () => {
  it('should include role in generated token', () => {
    const userId = 'test-user-123';
    const role = 'admin';
    
    const token = generateToken(userId, role);
    
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
  });

  it('should verify token and extract role for admin user', () => {
    const userId = 'test-user-123';
    const role = 'admin';
    
    const token = generateToken(userId, role);
    const decoded = verifyToken(token);
    
    expect(decoded).not.toBeNull();
    expect(decoded?.userId).toBe(userId);
    expect(decoded?.role).toBe(role);
  });

  it('should verify token and extract role for regular user', () => {
    const userId = 'test-user-456';
    const role = 'regular';
    
    const token = generateToken(userId, role);
    const decoded = verifyToken(token);
    
    expect(decoded).not.toBeNull();
    expect(decoded?.userId).toBe(userId);
    expect(decoded?.role).toBe(role);
  });

  it('should return null for invalid token', () => {
    const decoded = verifyToken('invalid-token');
    
    expect(decoded).toBeNull();
  });
});
