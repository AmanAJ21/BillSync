import { NextRequest } from 'next/server';
import { validateInternalRequest, addInternalHeaders } from '../internal-api';

describe('Internal API Protection', () => {
  describe('validateInternalRequest', () => {
    it('should allow requests without origin or referer (server-side)', () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          'host': 'localhost:3000',
        },
      });

      const result = validateInternalRequest(request);
      expect(result).toBeNull();
    });

    it('should allow requests with matching origin', () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          'host': 'localhost:3000',
          'origin': 'http://localhost:3000',
        },
      });

      const result = validateInternalRequest(request);
      expect(result).toBeNull();
    });

    it('should allow requests with matching referer', () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          'host': 'localhost:3000',
          'referer': 'http://localhost:3000/dashboard',
        },
      });

      const result = validateInternalRequest(request);
      expect(result).toBeNull();
    });

    it('should block requests with non-matching origin', () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          'host': 'localhost:3000',
          'origin': 'http://evil.com',
        },
      });

      const result = validateInternalRequest(request);
      expect(result).not.toBeNull();
      expect(result?.status).toBe(403);
    });

    it('should block requests with non-matching referer', () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          'host': 'localhost:3000',
          'referer': 'http://evil.com/attack',
        },
      });

      const result = validateInternalRequest(request);
      expect(result).not.toBeNull();
      expect(result?.status).toBe(403);
    });

    it('should allow requests from same origin with different protocol in production', () => {
      const request = new NextRequest('https://example.com/api/test', {
        headers: {
          'host': 'example.com',
          'origin': 'https://example.com',
        },
      });

      const result = validateInternalRequest(request);
      expect(result).toBeNull();
    });
  });

  describe('addInternalHeaders', () => {
    it('should add internal-only CORS headers', async () => {
      const response = new Response('test');
      const nextResponse = addInternalHeaders(response as any);

      expect(nextResponse.headers.get('Access-Control-Allow-Origin')).toBe('same-origin');
      expect(nextResponse.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, PUT, DELETE, PATCH');
      expect(nextResponse.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    });
  });
});
