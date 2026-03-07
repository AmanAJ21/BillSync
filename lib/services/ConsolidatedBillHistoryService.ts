import ConsolidatedBill from '../models/ConsolidatedBill';
import connectDB from '../mongoose';

/**
 * Service for managing consolidated bill history
 * Validates: Requirement 5.5
 */
export class ConsolidatedBillHistoryService {
  /**
   * Get consolidated bill history for a user
   * Returns all consolidated bills ordered by date (newest first)
   * Includes payment status and cycle information
   */
  async getConsolidatedBillHistory(userId: string) {
    await connectDB();

    const bills = await ConsolidatedBill.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    return bills.map((bill) => ({
      id: bill._id.toString(),
      userId: bill.userId,
      paymentCycleId: bill.paymentCycleId,
      cycleStartDate: bill.cycleStartDate,
      cycleEndDate: bill.cycleEndDate,
      totalAmount: bill.totalAmount,
      status: bill.status,
      paidAt: bill.paidAt,
      createdAt: bill.createdAt,
      autoPaymentRecordCount: bill.autoPaymentRecords?.length || 0,
    }));
  }

  /**
   * Get paginated consolidated bill history
   */
  async getConsolidatedBillHistoryPaginated(
    userId: string,
    page: number = 1,
    limit: number = 10
  ) {
    await connectDB();

    const skip = (page - 1) * limit;

    const [bills, total] = await Promise.all([
      ConsolidatedBill.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ConsolidatedBill.countDocuments({ userId }),
    ]);

    return {
      bills: bills.map((bill) => ({
        id: bill._id.toString(),
        userId: bill.userId,
        paymentCycleId: bill.paymentCycleId,
        cycleStartDate: bill.cycleStartDate,
        cycleEndDate: bill.cycleEndDate,
        totalAmount: bill.totalAmount,
        status: bill.status,
        paidAt: bill.paidAt,
        createdAt: bill.createdAt,
        autoPaymentRecordCount: bill.autoPaymentRecords?.length || 0,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export const consolidatedBillHistoryService = new ConsolidatedBillHistoryService();
