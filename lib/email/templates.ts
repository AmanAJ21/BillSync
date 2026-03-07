/**
 * Email Templates for BillSync
 * 
 * This module contains all email templates used throughout the application.
 * Templates are defined as functions that accept data and return email content
 * in both HTML and plain text formats.
 */

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

/**
 * Admin Account Creation Welcome Email
 * 
 * Sent when a new admin account is created via the bootstrap script
 * or by an existing admin.
 * 
 * @param name - The admin's full name
 * @param email - The admin's email address
 * @param appUrl - The application URL (defaults to localhost:3001)
 * @returns Email template with subject, HTML, and text content
 */
export function adminWelcomeEmail(
  name: string,
  email: string,
  appUrl: string = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
): EmailTemplate {
  return {
    subject: 'Welcome to BillSync - Admin Account Created',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Welcome to BillSync, ${name}!</h2>
        <p>Your administrator account has been successfully created.</p>
        
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Account Details</h3>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Role:</strong> Administrator</p>
        </div>
        
        <h3>What you can do as an admin:</h3>
        <ul>
          <li>Manage user accounts and roles</li>
          <li>Create and manage bills for all users</li>
          <li>Create reusable bill templates</li>
          <li>View audit logs and system activity</li>
          <li>Configure system settings</li>
          <li>Export data for reporting</li>
          <li>Monitor payment transactions</li>
        </ul>
        
        <p>You can access the admin dashboard at: <a href="${appUrl}/admin">${appUrl}/admin</a></p>
        
        <p style="margin-top: 30px; color: #666; font-size: 14px;">
          If you did not request this account, please contact the system administrator immediately.
        </p>
      </div>
    `,
    text: `
Welcome to BillSync, ${name}!

Your administrator account has been successfully created.

Account Details:
- Email: ${email}
- Role: Administrator

What you can do as an admin:
- Manage user accounts and roles
- Create and manage bills for all users
- Create reusable bill templates
- View audit logs and system activity
- Configure system settings
- Export data for reporting
- Monitor payment transactions

You can access the admin dashboard at: ${appUrl}/admin

If you did not request this account, please contact the system administrator immediately.
    `,
  };
}

/**
 * Admin Role Assignment Email
 * 
 * Sent when an existing regular user is promoted to admin role.
 * 
 * @param name - The user's full name
 * @param email - The user's email address
 * @param promotedBy - The admin who promoted this user
 * @param appUrl - The application URL
 * @returns Email template with subject, HTML, and text content
 */
export function adminRoleAssignmentEmail(
  name: string,
  email: string,
  promotedBy: string,
  appUrl: string = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
): EmailTemplate {
  return {
    subject: 'BillSync - You Have Been Granted Administrator Access',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Administrator Access Granted</h2>
        <p>Hello ${name},</p>
        <p>Your BillSync account has been upgraded to administrator status by ${promotedBy}.</p>
        
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Updated Account Details</h3>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>New Role:</strong> Administrator</p>
        </div>
        
        <h3>Your new admin capabilities:</h3>
        <ul>
          <li>Manage user accounts and roles</li>
          <li>Create and manage bills for all users</li>
          <li>Create reusable bill templates</li>
          <li>View audit logs and system activity</li>
          <li>Configure system settings</li>
          <li>Export data for reporting</li>
          <li>Monitor payment transactions</li>
        </ul>
        
        <p>Access the admin dashboard at: <a href="${appUrl}/admin">${appUrl}/admin</a></p>
        
        <p style="margin-top: 30px; color: #666; font-size: 14px;">
          If you believe this change was made in error, please contact the system administrator immediately.
        </p>
      </div>
    `,
    text: `
Administrator Access Granted

Hello ${name},

Your BillSync account has been upgraded to administrator status by ${promotedBy}.

Updated Account Details:
- Email: ${email}
- New Role: Administrator

Your new admin capabilities:
- Manage user accounts and roles
- Create and manage bills for all users
- Create reusable bill templates
- View audit logs and system activity
- Configure system settings
- Export data for reporting
- Monitor payment transactions

Access the admin dashboard at: ${appUrl}/admin

If you believe this change was made in error, please contact the system administrator immediately.
    `,
  };
}

/**
 * New User Account Created Email
 * 
 * Sent when an admin creates a new regular user account.
 * 
 * @param name - The new user's full name
 * @param email - The new user's email address
 * @param createdByAdmin - The admin who created the account
 * @param appUrl - The application URL
 * @returns Email template with subject, HTML, and text content
 */
export function newUserAccountEmail(
  name: string,
  email: string,
  createdByAdmin: string,
  appUrl: string = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
): EmailTemplate {
  return {
    subject: 'Welcome to BillSync - Your Account Has Been Created',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
          <h1 style="color: #fff; margin: 0; font-size: 24px;">Welcome to BillSync!</h1>
        </div>
        
        <div style="padding: 30px; background: #fff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px;">Hello ${name},</p>
          <p>An account has been created for you on BillSync by the administrator.</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
            <h3 style="margin-top: 0; color: #333;">Your Account Details</h3>
            <p style="margin-bottom: 5px;"><strong>Email:</strong> ${email}</p>
            <p style="margin-bottom: 0;"><strong>Account Type:</strong> User</p>
          </div>
          
          <div style="background-color: #fef3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #856404;">
              <strong>⚠️ Important:</strong> Please log in and change your password immediately for security.
            </p>
          </div>
          
          <h3>With BillSync, you can:</h3>
          <ul style="line-height: 1.8;">
            <li>View and manage your bills</li>
            <li>Set up auto-payments</li>
            <li>Track payment history</li>
            <li>Download payment receipts</li>
          </ul>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${appUrl}/login" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Log In to BillSync
            </a>
          </div>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
          
          <p style="color: #666; font-size: 13px;">
            This account was created by an administrator (${createdByAdmin}).
            If you have questions, please contact the system administrator.
          </p>
        </div>
      </div>
    `,
    text: `
Welcome to BillSync, ${name}!

An account has been created for you on BillSync by the administrator.

Your Account Details:
- Email: ${email}
- Account Type: User

IMPORTANT: Please log in and change your password immediately for security.

With BillSync, you can:
- View and manage your bills
- Set up auto-payments
- Track payment history
- Download payment receipts

Log in at: ${appUrl}/login

This account was created by an administrator (${createdByAdmin}).
If you have questions, please contact the system administrator.
    `,
  };
}

/**
 * Admin Notification: New Admin Created
 * 
 * Sent to existing admins when a new admin account is created
 * (security notification).
 * 
 * @param existingAdminName - The name of the admin receiving the notification
 * @param newAdminName - The newly created admin's name
 * @param newAdminEmail - The newly created admin's email
 * @param createdByAdmin - The admin who created the new account
 * @param appUrl - The application URL
 * @returns Email template with subject, HTML, and text content
 */
export function adminCreationNotificationEmail(
  existingAdminName: string,
  newAdminName: string,
  newAdminEmail: string,
  createdByAdmin: string,
  appUrl: string = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
): EmailTemplate {
  return {
    subject: 'BillSync Security Alert - New Administrator Account Created',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #dc2626; padding: 15px 30px; border-radius: 10px 10px 0 0;">
          <h2 style="color: #fff; margin: 0;">🔒 Security Notification</h2>
        </div>
        
        <div style="padding: 30px; background: #fff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
          <p>Hello ${existingAdminName},</p>
          <p>A new administrator account has been created on BillSync.</p>
          
          <div style="background-color: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
            <h3 style="margin-top: 0; color: #991b1b;">New Admin Details</h3>
            <p style="margin-bottom: 5px;"><strong>Name:</strong> ${newAdminName}</p>
            <p style="margin-bottom: 5px;"><strong>Email:</strong> ${newAdminEmail}</p>
            <p style="margin-bottom: 0;"><strong>Created by:</strong> ${createdByAdmin}</p>
            <p style="margin-bottom: 0;"><strong>Date:</strong> ${new Date().toLocaleString()}</p>
          </div>
          
          <p>If you did not expect this action, please review the audit logs immediately at 
            <a href="${appUrl}/admin/audit-logs">${appUrl}/admin/audit-logs</a>
          </p>
          
          <p style="color: #666; font-size: 13px; margin-top: 30px;">
            This is an automated security notification from BillSync.
          </p>
        </div>
      </div>
    `,
    text: `
Security Notification

Hello ${existingAdminName},

A new administrator account has been created on BillSync.

New Admin Details:
- Name: ${newAdminName}
- Email: ${newAdminEmail}
- Created by: ${createdByAdmin}
- Date: ${new Date().toLocaleString()}

If you did not expect this action, please review the audit logs immediately at:
${appUrl}/admin/audit-logs

This is an automated security notification from BillSync.
    `,
  };
}
