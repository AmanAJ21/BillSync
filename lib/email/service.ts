/**
 * Email Service
 * 
 * Centralized email sending service for BillSync.
 * Handles email configuration, sending, and error handling.
 */

import * as nodemailer from 'nodemailer';
import type { EmailTemplate } from './templates';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

/**
 * Check if email service is configured
 * 
 * @returns true if all required email environment variables are set
 */
export function isEmailConfigured(): boolean {
  return !!(
    process.env.EMAIL_HOST &&
    process.env.EMAIL_USER &&
    process.env.EMAIL_PASS
  );
}

/**
 * Get email configuration from environment variables
 * 
 * @returns Email configuration object
 * @throws Error if email service is not configured
 */
export function getEmailConfig(): EmailConfig {
  if (!isEmailConfigured()) {
    throw new Error('Email service is not configured. Set EMAIL_HOST, EMAIL_USER, and EMAIL_PASS in environment variables.');
  }

  return {
    host: process.env.EMAIL_HOST!,
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true',
    user: process.env.EMAIL_USER!,
    pass: process.env.EMAIL_PASS!,
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER!,
  };
}

/**
 * Create nodemailer transporter
 * 
 * @returns Configured nodemailer transporter
 */
export function createTransporter() {
  const config = getEmailConfig();
  
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });
}

/**
 * Send an email using a template
 * 
 * @param to - Recipient email address
 * @param template - Email template with subject, HTML, and text content
 * @returns Promise that resolves to true if email was sent successfully
 * @throws Error if email service is not configured or sending fails
 */
export async function sendEmail(
  to: string,
  template: EmailTemplate
): Promise<boolean> {
  if (!isEmailConfigured()) {
    console.warn('Email service not configured. Skipping email to:', to);
    return false;
  }

  try {
    const config = getEmailConfig();
    const transporter = createTransporter();

    await transporter.sendMail({
      from: config.from,
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    return true;
  } catch (error) {
    console.error('Failed to send email:', error instanceof Error ? error.message : error);
    throw error;
  }
}

/**
 * Send an email with graceful error handling
 * 
 * This version logs errors but doesn't throw, making it suitable for
 * non-critical email notifications where failure shouldn't block operations.
 * 
 * @param to - Recipient email address
 * @param template - Email template with subject, HTML, and text content
 * @returns Promise that resolves to true if email was sent, false otherwise
 */
export async function sendEmailSafe(
  to: string,
  template: EmailTemplate
): Promise<boolean> {
  try {
    return await sendEmail(to, template);
  } catch (error) {
    console.error('Failed to send email to', to, ':', error instanceof Error ? error.message : error);
    return false;
  }
}
