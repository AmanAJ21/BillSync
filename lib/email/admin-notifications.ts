/**
 * Admin Email Notification Service
 * 
 * Handles sending email notifications for admin-related operations.
 * Uses sendEmailSafe for non-blocking email delivery.
 * 
 * Validates: Requirement 12.3
 */

import { MongoClient, Db, ObjectId } from 'mongodb';
import { sendEmailSafe } from './service';
import {
    adminWelcomeEmail,
    adminRoleAssignmentEmail,
    newUserAccountEmail,
    adminCreationNotificationEmail,
} from './templates';
import { getDatabase } from '../mongodb';

/**
 * Send welcome email to newly created admin account
 * 
 * @param name - The new admin's name
 * @param email - The new admin's email address
 * @returns Promise<boolean> - true if email was sent
 */
export async function notifyNewAdmin(name: string, email: string): Promise<boolean> {
    const template = adminWelcomeEmail(name, email);
    return sendEmailSafe(email, template);
}

/**
 * Send notification when a user is promoted to admin role
 * 
 * @param name - The promoted user's name
 * @param email - The promoted user's email
 * @param promotedByName - The admin who performed the promotion
 * @returns Promise<boolean> - true if email was sent
 */
export async function notifyRolePromotion(
    name: string,
    email: string,
    promotedByName: string
): Promise<boolean> {
    const template = adminRoleAssignmentEmail(name, email, promotedByName);
    return sendEmailSafe(email, template);
}

/**
 * Send welcome email to newly created regular user account
 * 
 * @param name - The new user's name
 * @param email - The new user's email
 * @param createdByAdmin - The admin who created the account
 * @returns Promise<boolean> - true if email was sent
 */
export async function notifyNewUser(
    name: string,
    email: string,
    createdByAdmin: string
): Promise<boolean> {
    const template = newUserAccountEmail(name, email, createdByAdmin);
    return sendEmailSafe(email, template);
}

/**
 * Notify all existing admins when a new admin account is created
 * (security notification)
 * 
 * @param newAdminName - The new admin's name
 * @param newAdminEmail - The new admin's email
 * @param createdByAdmin - The admin who created the account
 * @param excludeAdminId - Admin ID to exclude (the one who created the account)
 * @returns Promise<number> - count of notifications sent
 */
export async function notifyExistingAdminsOfNewAdmin(
    newAdminName: string,
    newAdminEmail: string,
    createdByAdmin: string,
    excludeAdminId?: string
): Promise<number> {
    try {
        const db = await getDatabase();
        const users = db.collection('users');

        // Get all existing admin users (except the one who created the account and the new admin)
        const existingAdmins = await users
            .find(
                {
                    role: 'admin',
                    email: { $ne: newAdminEmail },
                    ...(excludeAdminId ? { _id: { $ne: new ObjectId(excludeAdminId) } } : {}),
                },
                { projection: { name: 1, email: 1 } }
            )
            .toArray();

        let sentCount = 0;

        for (const admin of existingAdmins) {
            const template = adminCreationNotificationEmail(
                (admin as any).name || 'Admin',
                newAdminName,
                newAdminEmail,
                createdByAdmin
            );
            const sent = await sendEmailSafe((admin as any).email, template);
            if (sent) sentCount++;
        }

        return sentCount;
    } catch (error) {
        console.error('Error notifying existing admins:', error);
        return 0;
    }
}

/**
 * Send appropriate email notification based on the created user's role
 * 
 * @param userData - The new user's data
 * @param createdByAdminName - The name of the admin who created the account
 * @param createdByAdminId - The ID of the admin who created the account
 * @returns Promise<{ userNotified: boolean; adminsNotified: number }>
 */
export async function sendUserCreationEmails(
    userData: { name: string; email: string; role: 'regular' | 'admin' },
    createdByAdminName: string,
    createdByAdminId?: string
): Promise<{ userNotified: boolean; adminsNotified: number }> {
    let userNotified = false;
    let adminsNotified = 0;

    if (userData.role === 'admin') {
        // Send admin welcome email
        userNotified = await notifyNewAdmin(userData.name, userData.email);

        // Notify existing admins about the new admin (security notification)
        adminsNotified = await notifyExistingAdminsOfNewAdmin(
            userData.name,
            userData.email,
            createdByAdminName,
            createdByAdminId
        );
    } else {
        // Send regular user welcome email
        userNotified = await notifyNewUser(
            userData.name,
            userData.email,
            createdByAdminName
        );
    }

    return { userNotified, adminsNotified };
}
