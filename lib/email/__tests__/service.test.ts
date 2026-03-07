import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as nodemailer from 'nodemailer';
import {
  isEmailConfigured,
  getEmailConfig,
  sendEmail,
  sendEmailSafe,
} from '../service';
import { adminWelcomeEmail } from '../templates';

// Mock nodemailer
vi.mock('nodemailer');

describe('Email Service', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('isEmailConfigured', () => {
    it('should return true when all email variables are set', () => {
      process.env.EMAIL_HOST = 'smtp.example.com';
      process.env.EMAIL_USER = 'user@example.com';
      process.env.EMAIL_PASS = 'password';

      expect(isEmailConfigured()).toBe(true);
    });

    it('should return false when EMAIL_HOST is missing', () => {
      process.env.EMAIL_USER = 'user@example.com';
      process.env.EMAIL_PASS = 'password';
      delete process.env.EMAIL_HOST;

      expect(isEmailConfigured()).toBe(false);
    });

    it('should return false when EMAIL_USER is missing', () => {
      process.env.EMAIL_HOST = 'smtp.example.com';
      process.env.EMAIL_PASS = 'password';
      delete process.env.EMAIL_USER;

      expect(isEmailConfigured()).toBe(false);
    });

    it('should return false when EMAIL_PASS is missing', () => {
      process.env.EMAIL_HOST = 'smtp.example.com';
      process.env.EMAIL_USER = 'user@example.com';
      delete process.env.EMAIL_PASS;

      expect(isEmailConfigured()).toBe(false);
    });

    it('should return false when all email variables are missing', () => {
      delete process.env.EMAIL_HOST;
      delete process.env.EMAIL_USER;
      delete process.env.EMAIL_PASS;

      expect(isEmailConfigured()).toBe(false);
    });
  });

  describe('getEmailConfig', () => {
    it('should return email configuration when all variables are set', () => {
      process.env.EMAIL_HOST = 'smtp.example.com';
      process.env.EMAIL_PORT = '465';
      process.env.EMAIL_SECURE = 'true';
      process.env.EMAIL_USER = 'user@example.com';
      process.env.EMAIL_PASS = 'password';
      process.env.EMAIL_FROM = 'noreply@example.com';

      const config = getEmailConfig();

      expect(config).toEqual({
        host: 'smtp.example.com',
        port: 465,
        secure: true,
        user: 'user@example.com',
        pass: 'password',
        from: 'noreply@example.com',
      });
    });

    it('should use default port 587 when EMAIL_PORT is not set', () => {
      process.env.EMAIL_HOST = 'smtp.example.com';
      process.env.EMAIL_USER = 'user@example.com';
      process.env.EMAIL_PASS = 'password';
      delete process.env.EMAIL_PORT;

      const config = getEmailConfig();

      expect(config.port).toBe(587);
    });

    it('should use secure=false when EMAIL_SECURE is not set', () => {
      process.env.EMAIL_HOST = 'smtp.example.com';
      process.env.EMAIL_USER = 'user@example.com';
      process.env.EMAIL_PASS = 'password';
      delete process.env.EMAIL_SECURE;

      const config = getEmailConfig();

      expect(config.secure).toBe(false);
    });

    it('should use EMAIL_USER as from address when EMAIL_FROM is not set', () => {
      process.env.EMAIL_HOST = 'smtp.example.com';
      process.env.EMAIL_USER = 'user@example.com';
      process.env.EMAIL_PASS = 'password';
      delete process.env.EMAIL_FROM;

      const config = getEmailConfig();

      expect(config.from).toBe('user@example.com');
    });

    it('should throw error when email is not configured', () => {
      delete process.env.EMAIL_HOST;
      delete process.env.EMAIL_USER;
      delete process.env.EMAIL_PASS;

      expect(() => getEmailConfig()).toThrow(
        'Email service is not configured'
      );
    });
  });

  describe('sendEmail', () => {
    it('should send email successfully when configured', async () => {
      process.env.EMAIL_HOST = 'smtp.example.com';
      process.env.EMAIL_USER = 'user@example.com';
      process.env.EMAIL_PASS = 'password';
      process.env.EMAIL_FROM = 'noreply@example.com';

      const mockSendMail = vi.fn().mockResolvedValue({ messageId: '123' });
      const mockTransporter = {
        sendMail: mockSendMail,
      };

      vi.mocked(nodemailer.createTransport).mockReturnValue(
        mockTransporter as any
      );

      const template = adminWelcomeEmail('John Doe', 'john@example.com');
      const result = await sendEmail('john@example.com', template);

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith({
        from: 'noreply@example.com',
        to: 'john@example.com',
        subject: template.subject,
        html: template.html,
        text: template.text,
      });
    });

    it('should return false when email is not configured', async () => {
      delete process.env.EMAIL_HOST;
      delete process.env.EMAIL_USER;
      delete process.env.EMAIL_PASS;

      const template = adminWelcomeEmail('John Doe', 'john@example.com');
      const result = await sendEmail('john@example.com', template);

      expect(result).toBe(false);
    });

    it('should throw error when sending fails', async () => {
      process.env.EMAIL_HOST = 'smtp.example.com';
      process.env.EMAIL_USER = 'user@example.com';
      process.env.EMAIL_PASS = 'password';

      const mockError = new Error('SMTP connection failed');
      const mockSendMail = vi.fn().mockRejectedValue(mockError);
      const mockTransporter = {
        sendMail: mockSendMail,
      };

      vi.mocked(nodemailer.createTransport).mockReturnValue(
        mockTransporter as any
      );

      const template = adminWelcomeEmail('John Doe', 'john@example.com');

      await expect(
        sendEmail('john@example.com', template)
      ).rejects.toThrow('SMTP connection failed');
    });
  });

  describe('sendEmailSafe', () => {
    it('should send email successfully and return true', async () => {
      process.env.EMAIL_HOST = 'smtp.example.com';
      process.env.EMAIL_USER = 'user@example.com';
      process.env.EMAIL_PASS = 'password';

      const mockSendMail = vi.fn().mockResolvedValue({ messageId: '123' });
      const mockTransporter = {
        sendMail: mockSendMail,
      };

      vi.mocked(nodemailer.createTransport).mockReturnValue(
        mockTransporter as any
      );

      const template = adminWelcomeEmail('John Doe', 'john@example.com');
      const result = await sendEmailSafe('john@example.com', template);

      expect(result).toBe(true);
    });

    it('should return false when sending fails without throwing', async () => {
      process.env.EMAIL_HOST = 'smtp.example.com';
      process.env.EMAIL_USER = 'user@example.com';
      process.env.EMAIL_PASS = 'password';

      const mockError = new Error('SMTP connection failed');
      const mockSendMail = vi.fn().mockRejectedValue(mockError);
      const mockTransporter = {
        sendMail: mockSendMail,
      };

      vi.mocked(nodemailer.createTransport).mockReturnValue(
        mockTransporter as any
      );

      const template = adminWelcomeEmail('John Doe', 'john@example.com');
      const result = await sendEmailSafe('john@example.com', template);

      expect(result).toBe(false);
    });

    it('should return false when email is not configured', async () => {
      delete process.env.EMAIL_HOST;
      delete process.env.EMAIL_USER;
      delete process.env.EMAIL_PASS;

      const template = adminWelcomeEmail('John Doe', 'john@example.com');
      const result = await sendEmailSafe('john@example.com', template);

      expect(result).toBe(false);
    });
  });

  describe('Requirements Validation', () => {
    /**
     * **Validates: Requirement 12.3**
     * 
     * Requirement 12.3: THE BillSync_System SHALL send account credentials to the new admin via email
     */
    it('should send welcome email with account information when admin is created', async () => {
      process.env.EMAIL_HOST = 'smtp.example.com';
      process.env.EMAIL_USER = 'user@example.com';
      process.env.EMAIL_PASS = 'password';
      process.env.EMAIL_FROM = 'noreply@billsync.com';

      const mockSendMail = vi.fn().mockResolvedValue({ messageId: '123' });
      const mockTransporter = {
        sendMail: mockSendMail,
      };

      vi.mocked(nodemailer.createTransport).mockReturnValue(
        mockTransporter as any
      );

      const adminEmail = 'newadmin@example.com';
      const adminName = 'New Admin';
      const template = adminWelcomeEmail(adminName, adminEmail);

      const result = await sendEmail(adminEmail, template);

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: adminEmail,
          subject: expect.stringContaining('Admin Account Created'),
        })
      );

      // Verify email contains account information
      const callArgs = mockSendMail.mock.calls[0][0];
      expect(callArgs.html).toContain(adminName);
      expect(callArgs.html).toContain(adminEmail);
      expect(callArgs.html).toContain('Administrator');
      expect(callArgs.text).toContain(adminName);
      expect(callArgs.text).toContain(adminEmail);
      expect(callArgs.text).toContain('Administrator');
    });
  });
});
