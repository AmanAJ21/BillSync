import { NextRequest, NextResponse } from 'next/server';
import { generateNewPassword } from '@/lib/auth';
import { addInternalHeaders } from '@/lib/utils/internal-api';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return addInternalHeaders(
        NextResponse.json({ error: 'Email is required' }, { status: 400 }),
        request
      );
    }

    const newPassword = await generateNewPassword(email);

    if (!newPassword) {
      // Don't reveal if email exists or not for security
      return addInternalHeaders(
        NextResponse.json({
          message: 'If an account with that email exists, a new password has been sent.',
        }),
        request
      );
    }

    // Only send email if email service is configured
    console.log('[forgot-password] Attempting to send email to:', email);
    const { isEmailConfigured, sendEmail } = await import('@/lib/email/service');

    if (isEmailConfigured()) {
      console.log('[forgot-password] Email service is configured. Sending...');
      const template = {
        subject: 'Your New Password - BillSync',
        html: `
          <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
            <h2>Password Reset</h2>
            <p>Your password has been reset as requested.</p>
            <p>Your new temporary password is:</p>
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; font-family: monospace; font-size: 18px; font-weight: bold; text-align: center; margin: 20px 0;">
              ${newPassword}
            </div>
            <p><strong>Important:</strong> Please log in with this new password and change it immediately in your account settings.</p>
            <p>If you didn't request this password reset, please contact support immediately.</p>
          </div>
        `,
        text: `
Your New Password - BillSync

Your password has been reset as requested.
Your new temporary password is: ${newPassword}

Important: Please log in with this new password and change it immediately in your account settings.
If you didn't request this password reset, please contact support immediately.
        `,
      };

      const result = await sendEmail(email, template);
      console.log('[forgot-password] sendEmail result:', result);
    } else {
      console.warn('[forgot-password] Email service not configured. New password for', email, ':', newPassword);
    }

    return addInternalHeaders(
      NextResponse.json({
        message: 'If an account with that email exists, a new password has been sent.',
      }),
      request
    );
  } catch (error) {
    console.error('[forgot-password] Error:', error);
    return addInternalHeaders(
      NextResponse.json({ error: 'Internal server error' }, { status: 500 }),
      request
    );
  }
}