"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  IconChevronLeft,
  IconChevronRight,
  IconEye,
  IconAlertCircle,
  IconDownload,
  IconReceipt,
  IconCreditCard,
  IconCalendar,
  IconUser,
} from "@tabler/icons-react";
import { toast } from "sonner";

interface Transaction {
  _id: string;
  transactionId: string;
  userId: string;
  billId: string;
  amount: number;
  paymentDate: string;
  status: 'success' | 'failed' | 'settled';
  errorMessage?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  recordMonth?: string;
}

interface TransactionsResponse {
  transactions: Transaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

interface TransactionDetails {
  transaction: Transaction & {
    amountInRupees: number;
    paymentDateFormatted: string;
  };
  bill?: {
    billId: string;
    provider: string;
    amount: number;
    dueDate: string;
    status: string;
    accountNumber?: string;
    description?: string;
    billType?: string;
    billNumber?: string;
    customerName?: string;
    dueDay?: number;
    billingFrequency?: string;
  };
  user?: {
    userId: string;
    email: string;
    name: string;
  };
  errorDetails?: {
    errorCode?: string;
    errorDescription?: string;
    errorSource?: string;
    errorStep?: string;
    errorReason?: string;
  };
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false
  });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [userIdFilter, setUserIdFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  // Transaction details dialog
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionDetails | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Fetch transactions
  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      });

      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }

      if (userIdFilter) {
        params.append("userId", userIdFilter);
      }

      if (startDate) {
        params.append("startDate", startDate);
      }

      if (endDate) {
        params.append("endDate", endDate);
      }

      const response = await fetch(`/api/admin/transactions?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Failed to fetch transactions");
      }

      const data: TransactionsResponse = await response.json();
      setTransactions(data.transactions);
      setPagination(data.pagination);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      toast.error("Failed to load transactions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [pagination.page, statusFilter, userIdFilter, startDate, endDate]);

  // Handle status filter
  const handleStatusFilter = (value: string) => {
    setStatusFilter(value);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  // Fetch transaction details
  const fetchTransactionDetails = async (transactionId: string) => {
    setLoadingDetails(true);
    try {
      const response = await fetch(`/api/admin/transactions/${transactionId}`);

      if (!response.ok) {
        throw new Error("Failed to fetch transaction details");
      }

      const data: TransactionDetails = await response.json();
      setSelectedTransaction(data);
      setIsDetailsDialogOpen(true);
    } catch (error) {
      console.error("Error fetching transaction details:", error);
      toast.error("Failed to load transaction details");
    } finally {
      setLoadingDetails(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'success':
        return 'default';
      case 'settled':
        return 'secondary';
      case 'failed':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getOrdinalSuffix = (day: number) => {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };

  // Handle export
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const filters: Record<string, string> = {};

      if (statusFilter !== "all") {
        filters.status = statusFilter;
      }

      if (userIdFilter) {
        filters.userId = userIdFilter;
      }

      if (startDate) {
        filters.startDate = startDate;
      }

      if (endDate) {
        filters.endDate = endDate;
      }

      const response = await fetch("/api/admin/export/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ filters })
      });

      if (!response.ok) {
        throw new Error("Failed to export transactions");
      }

      // Get the CSV data as blob
      const blob = await response.blob();

      // Extract filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `transactions-export-${new Date().toISOString()}.csv`;

      // Create download link and trigger download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Transactions exported successfully");
    } catch (error) {
      console.error("Error exporting transactions:", error);
      toast.error("Failed to export transactions");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Transaction Oversight</h2>
          <p className="text-muted-foreground">
            Monitor payment transactions across all users
          </p>
        </div>

        <Button
          variant="outline"
          onClick={handleExport}
          disabled={isExporting || loading}
        >
          <IconDownload className="mr-2 h-4 w-4" />
          {isExporting ? "Exporting..." : "Export CSV"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment Transactions</CardTitle>
          <CardDescription>
            View and filter payment transactions with detailed error information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div>
              <Label htmlFor="status-filter">Status</Label>
              <Select value={statusFilter} onValueChange={handleStatusFilter}>
                <SelectTrigger id="status-filter">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="settled">Settled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="user-filter">User ID</Label>
              <Input
                id="user-filter"
                placeholder="Filter by user ID..."
                value={userIdFilter}
                onChange={(e) => {
                  setUserIdFilter(e.target.value);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
              />
            </div>

            <div>
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
              />
            </div>

            <div>
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading transactions...
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No transactions found
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Transaction ID</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>User ID</TableHead>
                      <TableHead>Bill ID</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((transaction) => (
                      <TableRow key={transaction._id}>
                        <TableCell className="font-mono text-xs">
                          {transaction.transactionId}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(transaction.amount)}
                        </TableCell>
                        <TableCell>{formatDate(transaction.paymentDate)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant={getStatusBadgeVariant(transaction.status)}>
                              {transaction.status}
                            </Badge>
                            {transaction.status === 'failed' && transaction.errorMessage && (
                              <IconAlertCircle className="h-4 w-4 text-destructive" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {transaction.userId.substring(0, 8)}...
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {transaction.billId.substring(0, 8)}...
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fetchTransactionDetails(transaction.transactionId)}
                            disabled={loadingDetails}
                          >
                            <IconEye className="mr-2 h-4 w-4" />
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {transactions.length} of {pagination.total} transactions
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={!pagination.hasPrevPage}
                  >
                    <IconChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>

                  <div className="text-sm">
                    Page {pagination.page} of {pagination.totalPages}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={!pagination.hasNextPage}
                  >
                    Next
                    <IconChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Transaction Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconReceipt className="h-5 w-5" />
              Transaction Receipt
            </DialogTitle>
            <DialogDescription>
              Complete transaction details and bill information
            </DialogDescription>
          </DialogHeader>

          {selectedTransaction && (
            <div className="space-y-6">
              {/* Payment Status Banner */}
              <div className={`p-4 rounded-lg border-2 ${selectedTransaction.transaction.status === 'success'
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                  : selectedTransaction.transaction.status === 'failed'
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                    : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">
                      {selectedTransaction.transaction.status === 'success' ? '✓ Payment Successful' :
                        selectedTransaction.transaction.status === 'failed' ? '✗ Payment Failed' :
                          '⟳ Payment Settled'}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatDate(selectedTransaction.transaction.paymentDate)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary">
                      {formatCurrency(selectedTransaction.transaction.amount)}
                    </p>
                    <Badge variant={getStatusBadgeVariant(selectedTransaction.transaction.status)} className="mt-1">
                      {selectedTransaction.transaction.status.charAt(0).toUpperCase() + selectedTransaction.transaction.status.slice(1)}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Transaction Information */}
              <div className="border rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <IconCreditCard className="h-5 w-5" />
                  Transaction Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Transaction ID</Label>
                    <p className="font-mono text-sm bg-muted px-2 py-1 rounded">{selectedTransaction.transaction.transactionId}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Payment Status</Label>
                    <div className="mt-1">
                      <Badge variant={getStatusBadgeVariant(selectedTransaction.transaction.status)}>
                        {selectedTransaction.transaction.status.charAt(0).toUpperCase() + selectedTransaction.transaction.status.slice(1)}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Amount Paid</Label>
                    <p className="font-semibold text-lg text-primary">
                      {formatCurrency(selectedTransaction.transaction.amount)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Payment Date & Time</Label>
                    <p className="flex items-center gap-1 text-sm">
                      <IconCalendar className="h-4 w-4 text-muted-foreground" />
                      {formatDate(selectedTransaction.transaction.paymentDate)}
                    </p>
                  </div>
                  {selectedTransaction.transaction.razorpayOrderId && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">Razorpay Order ID</Label>
                      <p className="font-mono text-xs bg-muted px-2 py-1 rounded break-all">{selectedTransaction.transaction.razorpayOrderId}</p>
                    </div>
                  )}
                  {selectedTransaction.transaction.razorpayPaymentId && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">Razorpay Payment ID</Label>
                      <p className="font-mono text-xs bg-muted px-2 py-1 rounded break-all">{selectedTransaction.transaction.razorpayPaymentId}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* User Information */}
              {selectedTransaction.user && (
                <div className="border rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <IconUser className="h-5 w-5" />
                    Customer Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">Customer Name</Label>
                      <p className="font-medium">{selectedTransaction.user.name}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">Email Address</Label>
                      <p className="text-sm">{selectedTransaction.user.email}</p>
                    </div>
                    <div className="space-y-1 col-span-2">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">User ID</Label>
                      <p className="font-mono text-xs bg-muted px-2 py-1 rounded inline-block">{selectedTransaction.user.userId}</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Link href={`/admin/users/${selectedTransaction.user.userId}`}>
                      <Button variant="outline" size="sm">
                        <IconUser className="mr-2 h-4 w-4" />
                        View User Profile
                      </Button>
                    </Link>
                  </div>
                </div>
              )}

              {/* Bill Information */}
              {selectedTransaction.bill && (
                <div className="border rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <IconReceipt className="h-5 w-5" />
                    Bill Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">Service Provider</Label>
                      <p className="font-semibold">{selectedTransaction.bill.provider}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">Bill Type</Label>
                      <div>
                        <Badge variant="outline" className="text-sm">
                          {selectedTransaction.bill.billType ?
                            selectedTransaction.bill.billType.charAt(0).toUpperCase() +
                            selectedTransaction.bill.billType.slice(1).replace('_', ' ')
                            : 'N/A'}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">Bill Amount</Label>
                      <p className="font-semibold text-primary">{formatCurrency(selectedTransaction.bill.amount)}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">Bill Status</Label>
                      <div>
                        <Badge variant={getStatusBadgeVariant(selectedTransaction.bill.status)}>
                          {selectedTransaction.bill.status.charAt(0).toUpperCase() + selectedTransaction.bill.status.slice(1)}
                        </Badge>
                      </div>
                    </div>
                    {selectedTransaction.bill.billNumber && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wide">Bill Number</Label>
                        <p className="font-mono text-sm bg-muted px-2 py-1 rounded">{selectedTransaction.bill.billNumber}</p>
                      </div>
                    )}
                    {selectedTransaction.bill.customerName && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wide">Customer Name</Label>
                        <p className="font-medium">{selectedTransaction.bill.customerName}</p>
                      </div>
                    )}
                    {selectedTransaction.bill.dueDate && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wide">Due Date</Label>
                        <p className="flex items-center gap-1 text-sm">
                          <IconCalendar className="h-4 w-4 text-muted-foreground" />
                          {formatDate(selectedTransaction.bill.dueDate)}
                        </p>
                      </div>
                    )}
                    {selectedTransaction.transaction.recordMonth && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wide">Billing Period</Label>
                        <p className="font-medium flex items-center gap-1">
                          <IconCalendar className="h-4 w-4 text-muted-foreground" />
                          {selectedTransaction.transaction.recordMonth}
                        </p>
                      </div>
                    )}
                    {selectedTransaction.bill.accountNumber && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wide">Account Number</Label>
                        <p className="font-mono text-sm bg-muted px-2 py-1 rounded">{selectedTransaction.bill.accountNumber}</p>
                      </div>
                    )}
                    {selectedTransaction.bill.dueDay && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wide">Due Day</Label>
                        <p className="text-sm">{selectedTransaction.bill.dueDay}{getOrdinalSuffix(selectedTransaction.bill.dueDay)} of every cycle</p>
                      </div>
                    )}
                    {selectedTransaction.bill.billingFrequency && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wide">Billing Frequency</Label>
                        <p className="text-sm capitalize">{selectedTransaction.bill.billingFrequency}</p>
                      </div>
                    )}
                    {selectedTransaction.bill.description && (
                      <div className="space-y-1 col-span-2">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wide">Description</Label>
                        <p className="text-sm text-muted-foreground">{selectedTransaction.bill.description}</p>
                      </div>
                    )}
                    <div className="space-y-1 col-span-2">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">Bill ID</Label>
                      <p className="font-mono text-xs text-muted-foreground">{selectedTransaction.bill.billId || selectedTransaction.transaction.billId}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Method */}
              <div className="border rounded-lg p-4 bg-muted/30">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <IconCreditCard className="h-4 w-4" />
                  Payment Method
                </h3>
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded">
                    <IconCreditCard className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Razorpay Payment Gateway</p>
                    <p className="text-xs text-muted-foreground">Secure online payment</p>
                  </div>
                </div>
              </div>

              {/* Error Details (if failed) */}
              {selectedTransaction.transaction.status === 'failed' && (
                <div className="border-2 border-destructive rounded-lg p-4 bg-destructive/5">
                  <h3 className="text-lg font-semibold mb-3 text-destructive flex items-center gap-2">
                    <IconAlertCircle className="h-5 w-5" />
                    Payment Failed - Error Details
                  </h3>
                  <div className="space-y-3">
                    {selectedTransaction.transaction.errorMessage && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wide">Error Message</Label>
                        <p className="text-sm bg-destructive/10 p-2 rounded">{selectedTransaction.transaction.errorMessage}</p>
                      </div>
                    )}
                    {selectedTransaction.errorDetails && (
                      <div className="grid grid-cols-2 gap-3">
                        {selectedTransaction.errorDetails.errorCode && (
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Error Code</Label>
                            <p className="font-mono text-sm">{selectedTransaction.errorDetails.errorCode}</p>
                          </div>
                        )}
                        {selectedTransaction.errorDetails.errorSource && (
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Error Source</Label>
                            <p className="text-sm">{selectedTransaction.errorDetails.errorSource}</p>
                          </div>
                        )}
                        {selectedTransaction.errorDetails.errorStep && (
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Error Step</Label>
                            <p className="text-sm">{selectedTransaction.errorDetails.errorStep}</p>
                          </div>
                        )}
                        {selectedTransaction.errorDetails.errorReason && (
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Reason</Label>
                            <p className="text-sm">{selectedTransaction.errorDetails.errorReason}</p>
                          </div>
                        )}
                        {selectedTransaction.errorDetails.errorDescription && (
                          <div className="space-y-1 col-span-2">
                            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Description</Label>
                            <p className="text-sm">{selectedTransaction.errorDetails.errorDescription}</p>
                          </div>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-3 p-2 bg-muted rounded">
                      ℹ️ If customer was charged, the amount will be automatically refunded within 5-7 business days.
                    </p>
                  </div>
                </div>
              )}

              {/* Additional Information */}
              <div className="border-t pt-4">
                <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                  <div>
                    <p className="font-medium">Transaction Created</p>
                    <p>{new Date(selectedTransaction.transaction.paymentDate).toLocaleString('en-IN', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })}</p>
                  </div>
                  <div>
                    <p className="font-medium">Transaction ID (Internal)</p>
                    <p className="font-mono break-all">{selectedTransaction.transaction._id}</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Copy transaction details to clipboard
                    const details = `
TRANSACTION RECEIPT
==================
Transaction ID: ${selectedTransaction.transaction.transactionId}
Amount: ${formatCurrency(selectedTransaction.transaction.amount)}
Status: ${selectedTransaction.transaction.status}
Date: ${formatDate(selectedTransaction.transaction.paymentDate)}

CUSTOMER INFORMATION
===================
Name: ${selectedTransaction.user?.name || 'N/A'}
Email: ${selectedTransaction.user?.email || 'N/A'}
User ID: ${selectedTransaction.user?.userId || 'N/A'}

BILL INFORMATION
================
Provider: ${selectedTransaction.bill?.provider || 'N/A'}
Amount: ${selectedTransaction.bill ? formatCurrency(selectedTransaction.bill.amount) : 'N/A'}
Due Date: ${selectedTransaction.bill ? formatDate(selectedTransaction.bill.dueDate) : 'N/A'}
                    `.trim();
                    navigator.clipboard.writeText(details);
                    toast.success('Transaction details copied to clipboard');
                  }}
                >
                  Copy Receipt
                </Button>
                <Button variant="outline" onClick={() => setIsDetailsDialogOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
