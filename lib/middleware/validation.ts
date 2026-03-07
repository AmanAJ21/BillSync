import { NextResponse } from 'next/server';
import { z, ZodError, ZodSchema } from 'zod';

/**
 * Validation middleware for request bodies and parameters
 * Uses Zod for schema validation
 * Validates: Requirements 4.5, 10.5, 12.2
 */

/**
 * Validate request body against a Zod schema
 */
export async function validateRequestBody<T>(
  body: unknown,
  schema: ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const data = schema.parse(body);
    return { success: true, data };
  } catch (error) {
    if (error instanceof ZodError) {
      const errorMessages = error.issues.map((err) => `${err.path.join('.')}: ${err.message}`);
      return { success: false, error: errorMessages.join(', ') };
    }
    return { success: false, error: 'Validation failed' };
  }
}

/**
 * Validate query parameters against a Zod schema
 */
export function validateQueryParams<T>(
  params: Record<string, string | string[] | undefined>,
  schema: ZodSchema<T>
): { success: true; data: T } | { success: false; error: string } {
  try {
    const data = schema.parse(params);
    return { success: true, data };
  } catch (error) {
    if (error instanceof ZodError) {
      const errorMessages = error.issues.map((err) => `${err.path.join('.')}: ${err.message}`);
      return { success: false, error: errorMessages.join(', ') };
    }
    return { success: false, error: 'Validation failed' };
  }
}

/**
 * Create validation error response
 */
export function validationErrorResponse(error: string) {
  return NextResponse.json(
    { error: 'Validation error', code: 'VALIDATION_ERROR', details: error },
    { status: 400 }
  );
}

// ─────────────────────────────────────────────────────────
// Common validation schemas
// ─────────────────────────────────────────────────────────

// Helper: valid MongoDB ObjectId string
const objectIdString = z.string().regex(/^[a-f0-9]{24}$/, 'Invalid ID format');

// Helper: ISO date string
const isoDateString = z.string().refine(
  (val) => !isNaN(Date.parse(val)),
  { message: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)' }
);

export const schemas = {
  // ── Auto-payment configuration ──
  enableAutoPayment: z.object({
    billId: z.string().min(1, 'Bill ID is required'),
  }),

  disableAutoPayment: z.object({
    billId: z.string().min(1, 'Bill ID is required'),
    reason: z.string().optional(),
  }),

  // ── Consolidated bill payment ──
  payConsolidatedBill: z.object({
    consolidatedBillId: z.string().min(1, 'Consolidated bill ID is required'),
  }),

  // ── Pagination ──
  pagination: z.object({
    page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
    limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 10)),
  }),

  // ── Date range ──
  dateRange: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),

  // ── Payment cycle ──
  paymentCycleId: z.object({
    paymentCycleId: z.string().min(1, 'Payment cycle ID is required'),
  }),

  // ── Admin: User creation ──
  createUser: z.object({
    email: z.string().min(1, 'Email is required').email('Invalid email format'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters long')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character'),
    name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name too long'),
    role: z.enum(['regular', 'admin']),
  }),

  // ── Admin: Role update ──
  updateRole: z.object({
    role: z.enum(['regular', 'admin'], {
      message: 'Role must be either "regular" or "admin"',
    }),
  }),

  // ── Admin: Bill creation ──
  createBill: z.object({
    billNumber: z.string().min(1, 'Bill number is required').max(50, 'Bill number too long'),
    customerName: z.string().min(1, 'Customer name is required').max(100, 'Name too long'),
    provider: z.string().min(1, 'Provider is required').max(200, 'Provider name too long'),
    billType: z.enum(['dth', 'electricity', 'prepaid_mobile'], {
      message: 'billType must be one of: dth, electricity, prepaid_mobile',
    }),
    amount: z.number().min(0, 'Amount cannot be negative'),
    dueDay: z.number().int().min(1, 'Due day must be between 1 and 31').max(31, 'Due day must be between 1 and 31'),
    billingFrequency: z.enum(['monthly', 'quarterly', 'yearly', 'one-time'], {
      message: 'billingFrequency must be one of: monthly, quarterly, yearly, one-time',
    }),
  }),

  // ── Admin: Bill update ──
  updateBill: z.object({
    provider: z.string().min(1).max(200).optional(),
    billType: z.enum(['electricity', 'water', 'gas', 'mobile', 'internet', 'other']).optional(),
    dueDate: z.string().refine(
      (val) => !isNaN(Date.parse(val)),
      { message: 'Invalid dueDate format' }
    ).optional(),
    accountNumber: z.string().optional(),
    description: z.string().max(500).optional(),
  }).refine(
    (data) => Object.keys(data).some((key) => data[key as keyof typeof data] !== undefined),
    { message: 'At least one field must be provided for update' }
  ),

  // ── Admin: Bulk bill operations ──
  bulkBillOperation: z.object({
    billIds: z
      .array(objectIdString)
      .min(1, 'At least one bill ID is required')
      .max(100, 'Cannot process more than 100 bills in a single request'),
    action: z.enum(['update', 'delete'], {
      message: 'Action must be either "update" or "delete"',
    }),
    updates: z.object({
      dueDate: z.string().optional(),
      billType: z.enum(['electricity', 'water', 'gas', 'mobile', 'internet', 'other']).optional(),
    }).optional(),
  }).refine(
    (data) => {
      if (data.action === 'update') {
        return data.updates && Object.keys(data.updates).some(
          (key) => data.updates![key as keyof typeof data.updates] !== undefined
        );
      }
      return true;
    },
    { message: 'Updates object is required for update action' }
  ),

  // ── Admin: Config update ──
  updateConfig: z.object({
    value: z.any().refine(
      (val) => val !== undefined && val !== null,
      { message: 'Configuration value is required' }
    ),
    description: z.string().max(500).optional(),
  }),

  // ── Admin: Export filters ──
  exportFilters: z.object({
    filters: z.object({
      role: z.enum(['regular', 'admin']).optional(),
      status: z.string().optional(),
      userId: z.string().optional(),
      startDate: isoDateString.optional(),
      endDate: isoDateString.optional(),
    }).optional().default({}),
  }),

  // ── MongoDB ObjectId param ──
  objectId: objectIdString,
};
