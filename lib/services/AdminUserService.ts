import { getDatabase } from '../mongodb';
import { User, hashPassword } from '../auth';
import { auditLogService } from './AuditLogService';
import { ObjectId } from 'mongodb';

/**
 * AdminUserService
 * Handles admin operations for user management
 * Validates: Requirements 6.1, 6.2, 6.3, 12.1, 12.5
 */

export interface UserFilters {
  search?: string;
  role?: 'regular' | 'admin';
}

export interface Pagination {
  page: number;
  limit: number;
}

export interface PaginatedUsers {
  users: User[];
  total: number;
  page: number;
  totalPages: number;
}

export interface UserDetails extends User {
  billCount: number;
  lastLogin?: Date;
}

export interface CreateUserDto {
  email: string;
  password: string;
  name: string;
  role: 'regular' | 'admin';
}

export class AdminUserService {
  /**
   * Get all users with pagination and filters
   * Validates: Requirement 6.1
   * 
   * @param filters - Search and role filters
   * @param pagination - Page and limit
   * @returns Paginated list of users
   */
  async getAllUsers(filters: UserFilters, pagination: Pagination): Promise<PaginatedUsers> {
    const db = await getDatabase();
    const users = db.collection<User>('users');

    // Build query
    const query: any = {};

    if (filters.search) {
      query.$or = [
        { email: { $regex: filters.search, $options: 'i' } },
        { name: { $regex: filters.search, $options: 'i' } }
      ];
    }

    if (filters.role) {
      query.role = filters.role;
    }

    // Get total count
    const total = await users.countDocuments(query);

    // Get paginated results
    const skip = (pagination.page - 1) * pagination.limit;
    const userList = await users
      .find(query, { projection: { password: 0 } }) // Exclude password
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pagination.limit)
      .toArray();

    return {
      users: userList.map(u => ({ ...u, _id: u._id?.toString() })),
      total,
      page: pagination.page,
      totalPages: Math.ceil(total / pagination.limit)
    };
  }

  /**
   * Get user details with additional stats
   * Validates: Requirement 6.2, 6.5
   * 
   * @param userId - User ID
   * @returns User details with stats (excludes password)
   */
  async getUserDetails(userId: string): Promise<UserDetails | null> {
    const db = await getDatabase();
    const users = db.collection('users');
    const bills = db.collection('bills');

    // Get user (exclude password)
    const user = await users.findOne(
      { _id: new ObjectId(userId) } as any,
      { projection: { password: 0 } }
    );

    if (!user) {
      return null;
    }

    // Get bill count for this user
    const billCount = await bills.countDocuments({ userId });

    return {
      ...user,
      _id: user._id?.toString(),
      billCount
    } as UserDetails;
  }

  /**
   * Create a new user with specified role
   * Validates: Requirement 12.1
   * 
   * @param userData - User creation data
   * @param adminId - Admin user ID performing the action
   * @returns Created user
   */
  async createUser(userData: CreateUserDto, adminId: string): Promise<User> {
    const db = await getDatabase();
    const users = db.collection<User>('users');

    // Normalize email: trim whitespace and convert to lowercase
    const normalizedEmail = userData.email.trim().toLowerCase();

    // Check if user already exists (case-insensitive using collation)
    const existingUser = await users.findOne(
      { email: normalizedEmail },
      { collation: { locale: 'en', strength: 2 } }
    );
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await hashPassword(userData.password);

    // Create user (store email in normalized form)
    const newUser: User = {
      email: normalizedEmail,
      password: hashedPassword,
      name: userData.name,
      role: userData.role,
      createdAt: new Date()
    };

    const result = await users.insertOne(newUser);
    const createdUser = { ...newUser, _id: result.insertedId.toString() };

    // Log the action
    await auditLogService.log({
      userId: adminId,
      adminId,
      operation: 'Create user',
      operationType: 'user_create',
      entityType: 'user',
      entityId: result.insertedId.toString(),
      targetUserId: result.insertedId.toString(),
      details: {
        email: userData.email,
        name: userData.name,
        role: userData.role
      },
      status: 'success'
    });

    return createdUser;
  }

  /**
   * Update user role
   * Validates: Requirement 12.5
   * 
   * @param userId - User ID to update
   * @param role - New role
   * @param adminId - Admin user ID performing the action
   * @returns Updated user
   */
  async updateUserRole(userId: string, role: 'regular' | 'admin', adminId: string): Promise<User | null> {
    const db = await getDatabase();
    const users = db.collection('users');

    // Get current user state
    const currentUser = await users.findOne({ _id: new ObjectId(userId) } as any);
    if (!currentUser) {
      return null;
    }

    const beforeState = { role: (currentUser as any).role };
    const afterState = { role };

    // Update role
    await users.updateOne(
      { _id: new ObjectId(userId) } as any,
      { $set: { role } }
    );

    // Get updated user (exclude password)
    const updatedUser = await users.findOne(
      { _id: new ObjectId(userId) } as any,
      { projection: { password: 0 } }
    );

    if (!updatedUser) {
      return null;
    }

    // Log the action with before/after state
    await auditLogService.log({
      userId: adminId,
      adminId,
      operation: 'Update user role',
      operationType: 'user_role_change',
      entityType: 'user',
      entityId: userId,
      targetUserId: userId,
      details: {
        email: (updatedUser as any).email,
        name: (updatedUser as any).name
      },
      beforeState,
      afterState,
      status: 'success'
    });

    return { ...(updatedUser as any), _id: updatedUser._id?.toString() };
  }

  /**
   * Update user details (name, email, role)
   * 
   * @param userId - User ID to update
   * @param updates - Fields to update
   * @param adminId - Admin user ID performing the action
   * @returns Updated user
   */
  async updateUser(
    userId: string,
    updates: { name?: string; email?: string; role?: 'regular' | 'admin' },
    adminId: string
  ): Promise<User | null> {
    const db = await getDatabase();
    const users = db.collection('users');

    // Get current user state
    const currentUser = await users.findOne({ _id: new ObjectId(userId) } as any);
    if (!currentUser) {
      return null;
    }

    const updateFields: Record<string, any> = {};
    const beforeState: Record<string, any> = {};
    const afterState: Record<string, any> = {};

    if (updates.name !== undefined) {
      beforeState.name = (currentUser as any).name;
      afterState.name = updates.name;
      updateFields.name = updates.name;
    }

    if (updates.email !== undefined) {
      const normalizedEmail = updates.email.trim().toLowerCase();
      // Check if the email is already taken by another user
      const existingUser = await users.findOne({
        email: normalizedEmail,
        _id: { $ne: new ObjectId(userId) }
      } as any);
      if (existingUser) {
        throw new Error('User with this email already exists');
      }
      beforeState.email = (currentUser as any).email;
      afterState.email = normalizedEmail;
      updateFields.email = normalizedEmail;
    }

    if (updates.role !== undefined) {
      beforeState.role = (currentUser as any).role;
      afterState.role = updates.role;
      updateFields.role = updates.role;
    }

    if (Object.keys(updateFields).length === 0) {
      return { ...(currentUser as any), _id: currentUser._id?.toString() };
    }

    // Update user
    await users.updateOne(
      { _id: new ObjectId(userId) } as any,
      { $set: updateFields }
    );

    // Get updated user (exclude password)
    const updatedUser = await users.findOne(
      { _id: new ObjectId(userId) } as any,
      { projection: { password: 0 } }
    );

    if (!updatedUser) {
      return null;
    }

    // Log the action
    await auditLogService.log({
      userId: adminId,
      adminId,
      operation: 'Update user',
      operationType: 'user_update',
      entityType: 'user',
      entityId: userId,
      targetUserId: userId,
      details: {
        email: (updatedUser as any).email,
        name: (updatedUser as any).name,
        updatedFields: Object.keys(updateFields)
      },
      beforeState,
      afterState,
      status: 'success'
    });

    return { ...(updatedUser as any), _id: updatedUser._id?.toString() };
  }

  /**
   * Delete a user
   * 
   * @param userId - User ID to delete
   * @param adminId - Admin user ID performing the action
   * @returns true if deleted, false if not found
   */
  async deleteUser(userId: string, adminId: string): Promise<boolean> {
    const db = await getDatabase();
    const users = db.collection('users');

    // Get user before deletion for audit log
    const user = await users.findOne(
      { _id: new ObjectId(userId) } as any,
      { projection: { password: 0 } }
    );
    if (!user) {
      return false;
    }

    // Prevent self-deletion
    if (userId === adminId) {
      throw new Error('Cannot delete your own account');
    }

    // Delete the user
    const result = await users.deleteOne({ _id: new ObjectId(userId) } as any);

    if (result.deletedCount === 0) {
      return false;
    }

    // Log the action
    await auditLogService.log({
      userId: adminId,
      adminId,
      operation: 'Delete user',
      operationType: 'user_delete',
      entityType: 'user',
      entityId: userId,
      targetUserId: userId,
      details: {
        email: (user as any).email,
        name: (user as any).name,
        role: (user as any).role
      },
      beforeState: { email: (user as any).email, name: (user as any).name, role: (user as any).role },
      afterState: { deleted: true },
      status: 'success'
    });

    return true;
  }

  /**
   * Search users by email or name
   * Validates: Requirement 6.3
   * 
   * @param query - Search query
   * @returns Array of matching users
   */
  async searchUsers(query: string): Promise<User[]> {
    const db = await getDatabase();
    const users = db.collection<User>('users');

    const searchResults = await users
      .find(
        {
          $or: [
            { email: { $regex: query, $options: 'i' } },
            { name: { $regex: query, $options: 'i' } }
          ]
        },
        { projection: { password: 0 } } // Exclude password
      )
      .limit(50) // Limit search results
      .toArray();

    return searchResults.map(u => ({ ...u, _id: u._id?.toString() }));
  }
}

// Export singleton instance
export const adminUserService = new AdminUserService();
