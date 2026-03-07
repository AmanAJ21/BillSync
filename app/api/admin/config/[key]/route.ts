import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/middleware/role';
import { auditLog } from '../../../../../lib/middleware/audit';
import { systemConfigService } from '../../../../../lib/services/SystemConfigService';
import { verifyAuth } from '../../../../../lib/middleware/auth';
import { handleError, errors } from '../../../../../lib/middleware/errorHandler';
import { validateRequestBody, schemas } from '../../../../../lib/middleware/validation';

/**
 * PUT /api/admin/config/[key]
 * Update a specific system configuration value
 * Requires admin role
 * Validates: Requirements 10.2, 10.3, 10.4, 10.5
 */
export const PUT = auditLog(
  { operationType: 'config_update', entityType: 'system_config' },
  async (request: NextRequest, { params }: { params: Promise<{ key: string }> }) => {
    // Check admin authorization
    const authCheck = await requireAdmin(request);
    if (authCheck) {
      return authCheck; // Return error response
    }

    try {
      // Get authenticated admin user
      const authResult = await verifyAuth(request);
      if (!authResult.authenticated || !authResult.user) {
        return errors.unauthorized('Authentication required');
      }

      const { key } = await params;

      // Validate key parameter
      if (!key || typeof key !== 'string' || key.trim().length === 0) {
        return errors.badRequest('Invalid configuration key');
      }

      // Parse request body
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return errors.badRequest('Invalid JSON in request body');
      }

      // Validate with Zod schema
      const validation = await validateRequestBody(body, schemas.updateConfig);
      if (!validation.success) {
        return errors.badRequest(validation.error);
      }

      const { value, description } = validation.data;

      // Update configuration
      const updatedConfig = await systemConfigService.updateConfig(
        key,
        { value, description },
        authResult.user.id,
        request
      );

      return NextResponse.json({
        success: true,
        config: {
          key: updatedConfig.key,
          value: updatedConfig.value,
          category: updatedConfig.category,
          description: updatedConfig.description,
          lastModifiedBy: updatedConfig.lastModifiedBy,
          lastModifiedAt: updatedConfig.lastModifiedAt,
        }
      });
    } catch (error) {
      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          return errors.notFound('Configuration');
        }
        if (error.message.includes('must be') || error.message.includes('Invalid')) {
          return errors.badRequest(error.message);
        }
      }

      return handleError(error);
    }
  }
);

/**
 * GET /api/admin/config/[key]
 * Get a specific system configuration by key
 * Requires admin role
 * Validates: Requirements 10.1
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  // Check admin authorization
  const authCheck = await requireAdmin(request);
  if (authCheck) {
    return authCheck; // Return error response
  }

  try {
    const { key } = await params;

    // Validate key parameter
    if (!key || typeof key !== 'string' || key.trim().length === 0) {
      return errors.badRequest('Invalid configuration key');
    }

    // Get configuration by key
    const config = await systemConfigService.getConfigByKey(key);

    if (!config) {
      return errors.notFound('Configuration');
    }

    return NextResponse.json({
      config: {
        key: config.key,
        value: config.value,
        category: config.category,
        description: config.description,
        lastModifiedBy: config.lastModifiedBy,
        lastModifiedAt: config.lastModifiedAt,
      }
    });
  } catch (error) {
    return handleError(error);
  }
}