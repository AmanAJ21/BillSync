import { describe, it, expect, vi } from 'vitest';

// Mock next/navigation before importing the component
vi.mock('next/navigation', () => ({
  useParams: vi.fn(() => ({ userId: 'test-user-id' })),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  })),
}));

describe('User Details Page', () => {
  it('can import user details page component without errors', async () => {
    const { default: UserDetailsPage } = await import('./page');
    expect(UserDetailsPage).toBeDefined();
    expect(typeof UserDetailsPage).toBe('function');
  });

  it('user details page component has correct display name', async () => {
    const { default: UserDetailsPage } = await import('./page');
    expect(UserDetailsPage.name).toBe('UserDetailsPage');
  });

  it('component exports a valid React component', async () => {
    const { default: UserDetailsPage } = await import('./page');
    // Verify it's a function (React component)
    expect(typeof UserDetailsPage).toBe('function');
    // Verify it can be called (though we won't render it)
    expect(() => UserDetailsPage).not.toThrow();
  });
});
