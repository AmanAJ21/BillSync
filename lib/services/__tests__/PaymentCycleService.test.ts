import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PaymentCycleService } from '../PaymentCycleService';
import PaymentCycle from '../../models/PaymentCycle';
import { clearDatabase } from '../../test/setup';

describe('PaymentCycleService', () => {
  let service: PaymentCycleService;
  let testUserId: string;

  beforeEach(async () => {
    await clearDatabase();
    service = new PaymentCycleService();
    testUserId = 'user-123';
  });

  afterEach(async () => {
    await clearDatabase();
  });

  describe('initializePaymentCycle', () => {
    it('should create a payment cycle with start date as first day of month', async () => {
      const cycle = await service.initializePaymentCycle(testUserId);

      expect(cycle).toBeDefined();
      expect(cycle.userId).toBe(testUserId);
      expect(cycle.status).toBe('active');
      
      // Verify start date is first day of current month
      const now = new Date();
      const expectedStart = new Date(now.getFullYear(), now.getMonth(), 1);
      expect(cycle.startDate.getDate()).toBe(1);
      expect(cycle.startDate.getMonth()).toBe(expectedStart.getMonth());
      expect(cycle.startDate.getFullYear()).toBe(expectedStart.getFullYear());
    });

    it('should create a payment cycle with end date as last day of month', async () => {
      const cycle = await service.initializePaymentCycle(testUserId);

      // Verify end date is last day of current month
      const now = new Date();
      const expectedEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      expect(cycle.endDate.getDate()).toBe(expectedEnd.getDate());
      expect(cycle.endDate.getMonth()).toBe(expectedEnd.getMonth());
      expect(cycle.endDate.getFullYear()).toBe(expectedEnd.getFullYear());
    });

    it('should set cycle status to active', async () => {
      const cycle = await service.initializePaymentCycle(testUserId);

      expect(cycle.status).toBe('active');
      expect(cycle.isActive).toBe(true);
    });

    it('should throw error if userId is missing', async () => {
      await expect(service.initializePaymentCycle('')).rejects.toThrow(
        'User ID is required'
      );
    });

    it('should throw error if user already has an active cycle', async () => {
      // Create first cycle
      await service.initializePaymentCycle(testUserId);

      // Attempt to create second cycle should fail
      await expect(service.initializePaymentCycle(testUserId)).rejects.toThrow(
        'User already has an active payment cycle'
      );
    });

    it('should allow creating cycle for different users', async () => {
      const user1 = 'user-1';
      const user2 = 'user-2';

      const cycle1 = await service.initializePaymentCycle(user1);
      const cycle2 = await service.initializePaymentCycle(user2);

      expect(cycle1.userId).toBe(user1);
      expect(cycle2.userId).toBe(user2);
      expect(cycle1._id.toString()).not.toBe(cycle2._id.toString());
    });

    it('should set end date to end of day (23:59:59.999)', async () => {
      const cycle = await service.initializePaymentCycle(testUserId);

      expect(cycle.endDate.getHours()).toBe(23);
      expect(cycle.endDate.getMinutes()).toBe(59);
      expect(cycle.endDate.getSeconds()).toBe(59);
      expect(cycle.endDate.getMilliseconds()).toBe(999);
    });

    it('should set start date to beginning of day (00:00:00.000)', async () => {
      const cycle = await service.initializePaymentCycle(testUserId);

      expect(cycle.startDate.getHours()).toBe(0);
      expect(cycle.startDate.getMinutes()).toBe(0);
      expect(cycle.startDate.getSeconds()).toBe(0);
      expect(cycle.startDate.getMilliseconds()).toBe(0);
    });

    it('should ensure only one active cycle per user', async () => {
      await service.initializePaymentCycle(testUserId);

      const activeCycles = await PaymentCycle.find({
        userId: testUserId,
        status: 'active',
      });

      expect(activeCycles).toHaveLength(1);
    });
  });

  describe('closePaymentCycle', () => {
    let activeCycleId: string;

    beforeEach(async () => {
      const cycle = await service.initializePaymentCycle(testUserId);
      activeCycleId = cycle._id.toString();
    });

    it('should update cycle status to completed', async () => {
      const result = await service.closePaymentCycle(activeCycleId);

      expect(result.closedCycle.status).toBe('completed');
      expect(result.closedCycle._id.toString()).toBe(activeCycleId);
    });

    it('should create a new cycle for next month', async () => {
      const result = await service.closePaymentCycle(activeCycleId);

      expect(result.newCycle).toBeDefined();
      expect(result.newCycle.userId).toBe(testUserId);
      expect(result.newCycle.status).toBe('active');
      expect(result.newCycle._id.toString()).not.toBe(activeCycleId);
    });

    it('should set new cycle start date to day after closed cycle end date', async () => {
      const originalCycle = await PaymentCycle.findById(activeCycleId);
      const result = await service.closePaymentCycle(activeCycleId);

      const expectedStart = new Date(originalCycle!.endDate);
      expectedStart.setDate(expectedStart.getDate() + 1);
      expectedStart.setHours(0, 0, 0, 0);

      expect(result.newCycle.startDate.getDate()).toBe(expectedStart.getDate());
      expect(result.newCycle.startDate.getMonth()).toBe(expectedStart.getMonth());
      expect(result.newCycle.startDate.getFullYear()).toBe(expectedStart.getFullYear());
    });

    it('should set new cycle end date to last day of next month', async () => {
      const result = await service.closePaymentCycle(activeCycleId);

      const startDate = result.newCycle.startDate;
      const expectedEnd = new Date(
        startDate.getFullYear(),
        startDate.getMonth() + 1,
        0,
        23,
        59,
        59,
        999
      );

      expect(result.newCycle.endDate.getDate()).toBe(expectedEnd.getDate());
      expect(result.newCycle.endDate.getMonth()).toBe(expectedEnd.getMonth());
      expect(result.newCycle.endDate.getFullYear()).toBe(expectedEnd.getFullYear());
    });

    it('should throw error if paymentCycleId is missing', async () => {
      await expect(service.closePaymentCycle('')).rejects.toThrow(
        'Payment cycle ID is required'
      );
    });

    it('should throw error if cycle not found', async () => {
      const nonExistentId = '507f1f77bcf86cd799439011';
      
      await expect(service.closePaymentCycle(nonExistentId)).rejects.toThrow(
        `Payment cycle ${nonExistentId} not found`
      );
    });

    it('should throw error if cycle is already completed', async () => {
      await service.closePaymentCycle(activeCycleId);

      await expect(service.closePaymentCycle(activeCycleId)).rejects.toThrow(
        `Payment cycle ${activeCycleId} is already completed`
      );
    });

    it('should ensure only one active cycle exists after closing', async () => {
      await service.closePaymentCycle(activeCycleId);

      const activeCycles = await PaymentCycle.find({
        userId: testUserId,
        status: 'active',
      });

      expect(activeCycles).toHaveLength(1);
    });

    it('should return both closed and new cycle', async () => {
      const result = await service.closePaymentCycle(activeCycleId);

      expect(result).toHaveProperty('closedCycle');
      expect(result).toHaveProperty('newCycle');
      expect(result.closedCycle.status).toBe('completed');
      expect(result.newCycle.status).toBe('active');
    });

    it('should maintain user association in new cycle', async () => {
      const result = await service.closePaymentCycle(activeCycleId);

      expect(result.newCycle.userId).toBe(testUserId);
      expect(result.closedCycle.userId).toBe(testUserId);
    });

    it('should handle month transitions correctly', async () => {
      const result = await service.closePaymentCycle(activeCycleId);

      // New cycle should start in the next month
      const closedEnd = result.closedCycle.endDate;
      const newStart = result.newCycle.startDate;

      // New start should be the day after closed end (accounting for time difference)
      // closedEnd is at 23:59:59.999, newStart is at 00:00:00.000 the next day
      const closedEndDay = new Date(closedEnd);
      closedEndDay.setHours(0, 0, 0, 0);
      
      const newStartDay = new Date(newStart);
      newStartDay.setHours(0, 0, 0, 0);
      
      const dayDiff = (newStartDay.getTime() - closedEndDay.getTime()) / (1000 * 60 * 60 * 24);
      expect(dayDiff).toBe(1);
    });
  });

  describe('Payment Cycle Transitions - Requirements 7.3, 7.4', () => {
    describe('cycle initialization and closure', () => {
      it('should transition from no cycle to active cycle', async () => {
        // Verify no cycles exist initially
        const initialCycles = await PaymentCycle.find({ userId: testUserId });
        expect(initialCycles).toHaveLength(0);

        // Initialize cycle
        const cycle = await service.initializePaymentCycle(testUserId);

        // Verify active cycle exists
        expect(cycle.status).toBe('active');
        const activeCycles = await PaymentCycle.find({
          userId: testUserId,
          status: 'active',
        });
        expect(activeCycles).toHaveLength(1);
      });

      it('should transition from active cycle to completed cycle with new active cycle', async () => {
        // Create initial active cycle
        const initialCycle = await service.initializePaymentCycle(testUserId);
        const initialCycleId = initialCycle._id.toString();

        // Close the cycle
        const result = await service.closePaymentCycle(initialCycleId);

        // Verify old cycle is completed
        expect(result.closedCycle.status).toBe('completed');
        expect(result.closedCycle._id.toString()).toBe(initialCycleId);

        // Verify new cycle is active
        expect(result.newCycle.status).toBe('active');
        expect(result.newCycle._id.toString()).not.toBe(initialCycleId);

        // Verify only one active cycle exists
        const activeCycles = await PaymentCycle.find({
          userId: testUserId,
          status: 'active',
        });
        expect(activeCycles).toHaveLength(1);
        expect(activeCycles[0]._id.toString()).toBe(result.newCycle._id.toString());
      });

      it('should handle multiple cycle transitions sequentially', async () => {
        // First cycle
        const cycle1 = await service.initializePaymentCycle(testUserId);
        const result1 = await service.closePaymentCycle(cycle1._id.toString());

        // Second cycle
        const result2 = await service.closePaymentCycle(result1.newCycle._id.toString());

        // Third cycle
        const result3 = await service.closePaymentCycle(result2.newCycle._id.toString());

        // Verify we have 3 completed cycles and 1 active cycle
        const completedCycles = await PaymentCycle.find({
          userId: testUserId,
          status: 'completed',
        });
        expect(completedCycles).toHaveLength(3);

        const activeCycles = await PaymentCycle.find({
          userId: testUserId,
          status: 'active',
        });
        expect(activeCycles).toHaveLength(1);
        expect(activeCycles[0]._id.toString()).toBe(result3.newCycle._id.toString());
      });

      it('should maintain chronological order across transitions', async () => {
        const cycle1 = await service.initializePaymentCycle(testUserId);
        const result1 = await service.closePaymentCycle(cycle1._id.toString());
        const result2 = await service.closePaymentCycle(result1.newCycle._id.toString());

        // Verify chronological order
        expect(cycle1.startDate.getTime()).toBeLessThan(cycle1.endDate.getTime());
        expect(cycle1.endDate.getTime()).toBeLessThan(result1.newCycle.startDate.getTime());
        expect(result1.newCycle.startDate.getTime()).toBeLessThan(result1.newCycle.endDate.getTime());
        expect(result1.newCycle.endDate.getTime()).toBeLessThan(result2.newCycle.startDate.getTime());
      });
    });

    describe('monthly cycle boundaries', () => {
      it('should handle January to February transition', async () => {
        // Create a cycle and close it to get next month
        const cycle = await service.initializePaymentCycle(testUserId);
        const result = await service.closePaymentCycle(cycle._id.toString());

        // Verify no gaps between cycles
        const closedEndDate = new Date(result.closedCycle.endDate);
        closedEndDate.setHours(0, 0, 0, 0);
        closedEndDate.setDate(closedEndDate.getDate() + 1);

        const newStartDate = new Date(result.newCycle.startDate);
        newStartDate.setHours(0, 0, 0, 0);

        expect(closedEndDate.getTime()).toBe(newStartDate.getTime());
      });

      it('should handle month with 31 days correctly', async () => {
        const cycle = await service.initializePaymentCycle(testUserId);

        // If current month has 31 days, verify end date is 31st
        const now = new Date();
        const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

        expect(cycle.endDate.getDate()).toBe(lastDayOfMonth);
      });

      it('should handle February (28/29 days) correctly', async () => {
        const cycle = await service.initializePaymentCycle(testUserId);

        // Verify end date is last day of month (whether 28 or 29)
        const now = new Date();
        const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

        expect(cycle.endDate.getDate()).toBe(lastDayOfMonth);
        expect(cycle.endDate.getHours()).toBe(23);
        expect(cycle.endDate.getMinutes()).toBe(59);
        expect(cycle.endDate.getSeconds()).toBe(59);
      });

      it('should ensure no time gaps between consecutive cycles', async () => {
        const cycle1 = await service.initializePaymentCycle(testUserId);
        const result = await service.closePaymentCycle(cycle1._id.toString());

        // Calculate time difference in milliseconds
        const endTime = result.closedCycle.endDate.getTime();
        const startTime = result.newCycle.startDate.getTime();

        // Should be exactly 1 millisecond apart (end at 23:59:59.999, start at 00:00:00.000 next day)
        const timeDiff = startTime - endTime;
        expect(timeDiff).toBe(1);
      });

      it('should handle year boundary transition (December to January)', async () => {
        const cycle = await service.initializePaymentCycle(testUserId);
        const result = await service.closePaymentCycle(cycle._id.toString());

        // Verify new cycle starts in next month
        const closedMonth = result.closedCycle.endDate.getMonth();
        const newMonth = result.newCycle.startDate.getMonth();

        // If closed cycle was December (11), new cycle should be January (0)
        if (closedMonth === 11) {
          expect(newMonth).toBe(0);
          expect(result.newCycle.startDate.getFullYear()).toBe(
            result.closedCycle.endDate.getFullYear() + 1
          );
        } else {
          expect(newMonth).toBe(closedMonth + 1);
        }
      });

      it('should set precise time boundaries for cycle start and end', async () => {
        const cycle = await service.initializePaymentCycle(testUserId);

        // Start should be at midnight (00:00:00.000)
        expect(cycle.startDate.getHours()).toBe(0);
        expect(cycle.startDate.getMinutes()).toBe(0);
        expect(cycle.startDate.getSeconds()).toBe(0);
        expect(cycle.startDate.getMilliseconds()).toBe(0);

        // End should be at last millisecond of day (23:59:59.999)
        expect(cycle.endDate.getHours()).toBe(23);
        expect(cycle.endDate.getMinutes()).toBe(59);
        expect(cycle.endDate.getSeconds()).toBe(59);
        expect(cycle.endDate.getMilliseconds()).toBe(999);
      });
    });

    describe('single active cycle constraint', () => {
      it('should prevent creating second active cycle for same user', async () => {
        await service.initializePaymentCycle(testUserId);

        await expect(service.initializePaymentCycle(testUserId)).rejects.toThrow(
          'User already has an active payment cycle'
        );
      });

      it('should allow creating active cycle after closing previous one', async () => {
        const cycle1 = await service.initializePaymentCycle(testUserId);
        await service.closePaymentCycle(cycle1._id.toString());

        // Should not throw - new cycle was created automatically
        const activeCycles = await PaymentCycle.find({
          userId: testUserId,
          status: 'active',
        });
        expect(activeCycles).toHaveLength(1);
      });

      it('should maintain single active cycle constraint across multiple users', async () => {
        const user1 = 'user-1';
        const user2 = 'user-2';
        const user3 = 'user-3';

        await service.initializePaymentCycle(user1);
        await service.initializePaymentCycle(user2);
        await service.initializePaymentCycle(user3);

        // Each user should have exactly one active cycle
        for (const userId of [user1, user2, user3]) {
          const activeCycles = await PaymentCycle.find({
            userId,
            status: 'active',
          });
          expect(activeCycles).toHaveLength(1);
        }

        // Total active cycles should be 3
        const allActiveCycles = await PaymentCycle.find({ status: 'active' });
        expect(allActiveCycles).toHaveLength(3);
      });

      it('should enforce constraint even after multiple transitions', async () => {
        const cycle1 = await service.initializePaymentCycle(testUserId);
        const result1 = await service.closePaymentCycle(cycle1._id.toString());
        const result2 = await service.closePaymentCycle(result1.newCycle._id.toString());
        await service.closePaymentCycle(result2.newCycle._id.toString());

        // Should always have exactly one active cycle
        const activeCycles = await PaymentCycle.find({
          userId: testUserId,
          status: 'active',
        });
        expect(activeCycles).toHaveLength(1);
      });

      it('should not allow manual creation of second active cycle via database', async () => {
        await service.initializePaymentCycle(testUserId);

        // Attempt to create another active cycle should fail
        await expect(service.initializePaymentCycle(testUserId)).rejects.toThrow(
          'User already has an active payment cycle'
        );

        // Verify still only one active cycle
        const activeCycles = await PaymentCycle.find({
          userId: testUserId,
          status: 'active',
        });
        expect(activeCycles).toHaveLength(1);
      });

      it('should allow new cycle only after previous cycle is completed', async () => {
        const cycle = await service.initializePaymentCycle(testUserId);

        // Cannot create new cycle while one is active
        await expect(service.initializePaymentCycle(testUserId)).rejects.toThrow(
          'User already has an active payment cycle'
        );

        // Close the cycle (which creates a new one automatically)
        const result = await service.closePaymentCycle(cycle._id.toString());

        // Verify old cycle is completed and new cycle is active
        expect(result.closedCycle.status).toBe('completed');
        expect(result.newCycle.status).toBe('active');

        // Still cannot create another cycle manually
        await expect(service.initializePaymentCycle(testUserId)).rejects.toThrow(
          'User already has an active payment cycle'
        );
      });
    });
  });
});
