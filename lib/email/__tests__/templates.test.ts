import { describe, it, expect } from 'vitest';
import { adminWelcomeEmail, adminRoleAssignmentEmail } from '../templates';

describe('Email Templates', () => {
  describe('adminWelcomeEmail', () => {
    it('should generate welcome email with correct subject', () => {
      const template = adminWelcomeEmail('John Doe', 'john@example.com');

      expect(template.subject).toBe('Welcome to BillSync - Admin Account Created');
    });

    it('should include admin name in HTML content', () => {
      const name = 'John Doe';
      const template = adminWelcomeEmail(name, 'john@example.com');

      expect(template.html).toContain(name);
    });

    it('should include admin email in HTML content', () => {
      const email = 'john@example.com';
      const template = adminWelcomeEmail('John Doe', email);

      expect(template.html).toContain(email);
    });

    it('should include admin name in text content', () => {
      const name = 'John Doe';
      const template = adminWelcomeEmail(name, 'john@example.com');

      expect(template.text).toContain(name);
    });

    it('should include admin email in text content', () => {
      const email = 'john@example.com';
      const template = adminWelcomeEmail('John Doe', email);

      expect(template.text).toContain(email);
    });

    it('should include admin dashboard link in HTML', () => {
      const appUrl = 'https://billsync.example.com';
      const template = adminWelcomeEmail('John Doe', 'john@example.com', appUrl);

      expect(template.html).toContain(`${appUrl}/admin`);
    });

    it('should include admin dashboard link in text', () => {
      const appUrl = 'https://billsync.example.com';
      const template = adminWelcomeEmail('John Doe', 'john@example.com', appUrl);

      expect(template.text).toContain(`${appUrl}/admin`);
    });

    it('should use default localhost URL when appUrl is not provided', () => {
      const template = adminWelcomeEmail('John Doe', 'john@example.com');

      expect(template.html).toContain('http://localhost:3001/admin');
      expect(template.text).toContain('http://localhost:3001/admin');
    });

    it('should list admin capabilities in HTML', () => {
      const template = adminWelcomeEmail('John Doe', 'john@example.com');

      const capabilities = [
        'Manage user accounts and roles',
        'Create and manage bills for all users',
        'Create reusable bill templates',
        'View audit logs and system activity',
        'Configure system settings',
        'Export data for reporting',
        'Monitor payment transactions',
      ];

      capabilities.forEach(capability => {
        expect(template.html).toContain(capability);
      });
    });

    it('should list admin capabilities in text', () => {
      const template = adminWelcomeEmail('John Doe', 'john@example.com');

      const capabilities = [
        'Manage user accounts and roles',
        'Create and manage bills for all users',
        'Create reusable bill templates',
        'View audit logs and system activity',
        'Configure system settings',
        'Export data for reporting',
        'Monitor payment transactions',
      ];

      capabilities.forEach(capability => {
        expect(template.text).toContain(capability);
      });
    });

    it('should include security notice in HTML', () => {
      const template = adminWelcomeEmail('John Doe', 'john@example.com');

      expect(template.html).toContain('If you did not request this account');
    });

    it('should include security notice in text', () => {
      const template = adminWelcomeEmail('John Doe', 'john@example.com');

      expect(template.text).toContain('If you did not request this account');
    });

    it('should include role information in HTML', () => {
      const template = adminWelcomeEmail('John Doe', 'john@example.com');

      expect(template.html).toContain('Administrator');
    });

    it('should include role information in text', () => {
      const template = adminWelcomeEmail('John Doe', 'john@example.com');

      expect(template.text).toContain('Administrator');
    });
  });

  describe('adminRoleAssignmentEmail', () => {
    it('should generate role assignment email with correct subject', () => {
      const template = adminRoleAssignmentEmail(
        'John Doe',
        'john@example.com',
        'Admin User'
      );

      expect(template.subject).toBe('BillSync - You Have Been Granted Administrator Access');
    });

    it('should include user name in HTML content', () => {
      const name = 'John Doe';
      const template = adminRoleAssignmentEmail(
        name,
        'john@example.com',
        'Admin User'
      );

      expect(template.html).toContain(name);
    });

    it('should include user email in HTML content', () => {
      const email = 'john@example.com';
      const template = adminRoleAssignmentEmail(
        'John Doe',
        email,
        'Admin User'
      );

      expect(template.html).toContain(email);
    });

    it('should include promoter name in HTML content', () => {
      const promotedBy = 'Admin User';
      const template = adminRoleAssignmentEmail(
        'John Doe',
        'john@example.com',
        promotedBy
      );

      expect(template.html).toContain(promotedBy);
    });

    it('should include user name in text content', () => {
      const name = 'John Doe';
      const template = adminRoleAssignmentEmail(
        name,
        'john@example.com',
        'Admin User'
      );

      expect(template.text).toContain(name);
    });

    it('should include user email in text content', () => {
      const email = 'john@example.com';
      const template = adminRoleAssignmentEmail(
        'John Doe',
        email,
        'Admin User'
      );

      expect(template.text).toContain(email);
    });

    it('should include promoter name in text content', () => {
      const promotedBy = 'Admin User';
      const template = adminRoleAssignmentEmail(
        'John Doe',
        'john@example.com',
        promotedBy
      );

      expect(template.text).toContain(promotedBy);
    });

    it('should include admin dashboard link in HTML', () => {
      const appUrl = 'https://billsync.example.com';
      const template = adminRoleAssignmentEmail(
        'John Doe',
        'john@example.com',
        'Admin User',
        appUrl
      );

      expect(template.html).toContain(`${appUrl}/admin`);
    });

    it('should include admin dashboard link in text', () => {
      const appUrl = 'https://billsync.example.com';
      const template = adminRoleAssignmentEmail(
        'John Doe',
        'john@example.com',
        'Admin User',
        appUrl
      );

      expect(template.text).toContain(`${appUrl}/admin`);
    });

    it('should list admin capabilities in HTML', () => {
      const template = adminRoleAssignmentEmail(
        'John Doe',
        'john@example.com',
        'Admin User'
      );

      const capabilities = [
        'Manage user accounts and roles',
        'Create and manage bills for all users',
        'Create reusable bill templates',
        'View audit logs and system activity',
        'Configure system settings',
        'Export data for reporting',
        'Monitor payment transactions',
      ];

      capabilities.forEach(capability => {
        expect(template.html).toContain(capability);
      });
    });

    it('should list admin capabilities in text', () => {
      const template = adminRoleAssignmentEmail(
        'John Doe',
        'john@example.com',
        'Admin User'
      );

      const capabilities = [
        'Manage user accounts and roles',
        'Create and manage bills for all users',
        'Create reusable bill templates',
        'View audit logs and system activity',
        'Configure system settings',
        'Export data for reporting',
        'Monitor payment transactions',
      ];

      capabilities.forEach(capability => {
        expect(template.text).toContain(capability);
      });
    });

    it('should include security notice in HTML', () => {
      const template = adminRoleAssignmentEmail(
        'John Doe',
        'john@example.com',
        'Admin User'
      );

      expect(template.html).toContain('If you believe this change was made in error');
    });

    it('should include security notice in text', () => {
      const template = adminRoleAssignmentEmail(
        'John Doe',
        'john@example.com',
        'Admin User'
      );

      expect(template.text).toContain('If you believe this change was made in error');
    });
  });

  describe('Template Structure', () => {
    it('should return object with subject, html, and text properties', () => {
      const template = adminWelcomeEmail('John Doe', 'john@example.com');

      expect(template).toHaveProperty('subject');
      expect(template).toHaveProperty('html');
      expect(template).toHaveProperty('text');
      expect(typeof template.subject).toBe('string');
      expect(typeof template.html).toBe('string');
      expect(typeof template.text).toBe('string');
    });

    it('should have non-empty content in all fields', () => {
      const template = adminWelcomeEmail('John Doe', 'john@example.com');

      expect(template.subject.length).toBeGreaterThan(0);
      expect(template.html.length).toBeGreaterThan(0);
      expect(template.text.length).toBeGreaterThan(0);
    });

    it('should have HTML content with proper structure', () => {
      const template = adminWelcomeEmail('John Doe', 'john@example.com');

      expect(template.html).toContain('<div');
      expect(template.html).toContain('<h2');
      expect(template.html).toContain('<p');
      expect(template.html).toContain('<ul');
      expect(template.html).toContain('<li');
    });
  });
});
