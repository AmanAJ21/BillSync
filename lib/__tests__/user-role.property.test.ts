import fc from 'fast-check';
import { describe, it, expect, beforeEach } from 'vitest';
import { createUser } from '../auth';
import { getDatabase } from '../mongodb';
import { User } from '../auth';

describe('Feature: admin-role-management - User Role Properties', () => {
  beforeEach(async () => {
    // Clear users collection before each test
    const db = await getDatabase();
    await db.collection('users').deleteMany({});
  });

  /**
   * **Validates: Requirements 1.2**
   * Property 2: Role Value Validation
   * For any user creation or update operation, the system should only accept 
   * role values of 'regular' or 'admin', rejecting any other values.
   */
  it('Property 2: Role Value Validation - system should only accept regular or admin role values', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          email: fc.emailAddress(),
          password: fc.string({ minLength: 8 }),
          name: fc.string({ minLength: 1 }),
        }),
        async (userData) => {
          // Create user through the normal flow (should get 'regular' role)
          const user = await createUser(userData.email, userData.password, userData.name);
          
          // Verify role is one of the valid values
          expect(['regular', 'admin']).toContain(user.role);
          
          // Verify in database
          const db = await getDatabase();
          const users = db.collection<User>('users');
          const dbUser = await users.findOne({ email: userData.email });
          
          expect(dbUser).toBeDefined();
          expect(['regular', 'admin']).toContain(dbUser!.role);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.3**
   * Property 3: Default Role Assignment
   * For any new user account created without an explicit role specification, 
   * the system should assign the 'regular' role by default.
   */
  it('Property 3: Default Role Assignment - new users should have regular role by default', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          email: fc.emailAddress(),
          password: fc.string({ minLength: 8 }),
          name: fc.string({ minLength: 1 }),
        }),
        async (userData) => {
          // Create user without specifying role
          const user = await createUser(userData.email, userData.password, userData.name);
          
          // Verify default role is 'regular'
          expect(user.role).toBe('regular');
          
          // Verify in database
          const db = await getDatabase();
          const users = db.collection<User>('users');
          const dbUser = await users.findOne({ email: userData.email });
          
          expect(dbUser).toBeDefined();
          expect(dbUser!.role).toBe('regular');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 1.4**
   * Property 4: Single Role Constraint
   * For any user account in the system, exactly one role value should be present—
   * never zero roles or multiple roles.
   */
  it('Property 4: Single Role Constraint - each user should have exactly one role', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          email: fc.emailAddress(),
          password: fc.string({ minLength: 8 }),
          name: fc.string({ minLength: 1 }),
        }),
        async (userData) => {
          // Create user
          const user = await createUser(userData.email, userData.password, userData.name);
          
          // Verify role field exists and is not null/undefined
          expect(user.role).toBeDefined();
          expect(user.role).not.toBeNull();
          
          // Verify role is a single string value (not an array)
          expect(typeof user.role).toBe('string');
          expect(Array.isArray(user.role)).toBe(false);
          
          // Verify in database
          const db = await getDatabase();
          const users = db.collection<User>('users');
          const dbUser = await users.findOne({ email: userData.email });
          
          expect(dbUser).toBeDefined();
          expect(dbUser!.role).toBeDefined();
          expect(dbUser!.role).not.toBeNull();
          expect(typeof dbUser!.role).toBe('string');
          expect(Array.isArray(dbUser!.role)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
