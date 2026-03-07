"use client";

import { useEffect, useState } from "react";
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
  IconReceipt,
  IconCalendar,
  IconCreditCard,
  IconRefresh,
  IconAlertCircle,
} from "@tabler/icons-react";
import { toast } from "sonner";

interface Payment {
  _id: string;
  transactionId: string;
  billId: string;
  amount: number;
  paymentDate: string;
  status: 'success' | 'failed' | 'settled';
  billProvider: string;
  billType: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  recordMonth?: string;
  billNumber?: string;
  customerName?: string;
  errorMessage?: string;
  createdAt: string;
  isConsolidated?: boolean;
  paymentCycleId?: string;
  recordCount?: number;
}

interface PaymentsResponse {
  payments: Payment[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export default function PaymentHistoryPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
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
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  // Payment details dialog
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);

  // Fetch payments
  const fetchPayments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      });
      
      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }
      
      if (startDate) {
        params.append("startDate", startDate);
      }
      
      if (endDate) {
        params.append("endDate", endDate);
      }

      console.log('Fetching payment history with params:', params.toString());

      const response = await fetch(`/api/payments/history?${params.toString()}`, {
        credentials: 'include'
      });
      
      console.log('Payment history response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Payment history error:', errorData);
        throw new Error(errorData.error || "Failed to fetch payment history");
      }

      const data: PaymentsResponse = await response.json();
      console.log('Payment history data:', data);
      setPayments(data.payments);
      setPagination(data.pagination);
    } catch (error) {
      console.error("Error fetching payments:", error);
      toast.error(error instanceof Error ? error.message : "Failed to load payment history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [pagination.page, statusFilter, startDate, endDate]);

  // Handle status filter
  const handleStatusFilter = (value: string) => {
    setStatusFilter(value);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
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

  const getBillTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      electricity: 'Electricity',
      dth: 'DTH',
      prepaid_mobile: 'Prepaid Mobile',
      water: 'Water',
      gas: 'Gas',
      internet: 'Internet',
      mobile: 'Mobile',
      consolidated: 'Consolidated Bill',
      other: 'Other',
    };
    return labels[type?.toLowerCase()] || type || 'Other';
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <IconCreditCard className="h-8 w-8 text-primary" />
            Payment History
          </h1>
          <p className="text-muted-foreground mt-1">
            View all your payment transactions
          </p>
        </div>
        <Button onClick={fetchPayments} variant="outline" size="sm">
          <IconRefresh className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment Transactions</CardTitle>
          <CardDescription>
            Filter and view your payment history
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
                  <SelectItem value="paid">Consolidated Bills</SelectItem>
                </SelectContent>
              </Select>
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
              Loading payment history...
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-12">
              <IconReceipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No payments yet</h3>
              <p className="text-muted-foreground">
                Your payment history will appear here once you make a payment
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment._id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <IconCalendar className="h-4 w-4 text-muted-foreground" />
                            {formatDate(payment.paymentDate)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            {payment.billProvider}
                            {payment.isConsolidated && payment.recordCount && (
                              <div className="text-xs text-muted-foreground">
                                {payment.recordCount} bills
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {getBillTypeLabel(payment.billType)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold">
                          {formatCurrency(payment.amount)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(payment.status)}>
                            {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedPayment(payment);
                              setIsDetailsDialogOpen(true);
                            }}
                          >
                            <IconEye className="mr-2 h-4 w-4" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {payments.length} of {pagination.total} payments
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

      {/* Payment Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconReceipt className="h-5 w-5" />
              Payment Receipt
            </DialogTitle>
            <DialogDescription>
              Complete transaction details and bill information
            </DialogDescription>
          </DialogHeader>
          
          {selectedPayment && (
            <div className="space-y-6">
              {/* Payment Status Banner */}
              <div className={`p-4 rounded-lg border-2 ${
                selectedPayment.status === 'success' 
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                  : selectedPayment.status === 'failed'
                  ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                  : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">
                      {selectedPayment.status === 'success' ? '✓ Payment Successful' : 
                       selectedPayment.status === 'failed' ? '✗ Payment Failed' : 
                       '⟳ Payment Settled'}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatDate(selectedPayment.paymentDate)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary">
                      {formatCurrency(selectedPayment.amount)}
                    </p>
                    <Badge variant={getStatusBadgeVariant(selectedPayment.status)} className="mt-1">
                      {selectedPayment.status.charAt(0).toUpperCase() + selectedPayment.status.slice(1)}
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
                    <p className="font-mono text-sm bg-muted px-2 py-1 rounded">{selectedPayment.transactionId}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Payment Status</Label>
                    <div className="mt-1">
                      <Badge variant={getStatusBadgeVariant(selectedPayment.status)}>
                        {selectedPayment.status.charAt(0).toUpperCase() + selectedPayment.status.slice(1)}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Amount Paid</Label>
                    <p className="font-semibold text-lg text-primary">
                      {formatCurrency(selectedPayment.amount)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Payment Date & Time</Label>
                    <p className="flex items-center gap-1 text-sm">
                      <IconCalendar className="h-4 w-4 text-muted-foreground" />
                      {formatDate(selectedPayment.paymentDate)}
                    </p>
                  </div>
                  {selectedPayment.razorpayOrderId && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">Razorpay Order ID</Label>
                      <p className="font-mono text-xs bg-muted px-2 py-1 rounded break-all">{selectedPayment.razorpayOrderId}</p>
                    </div>
                  )}
                  {selectedPayment.razorpayPaymentId && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">Razorpay Payment ID</Label>
                      <p className="font-mono text-xs bg-muted px-2 py-1 rounded break-all">{selectedPayment.razorpayPaymentId}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Bill Information */}
              <div className="border rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <IconReceipt className="h-5 w-5" />
                  Bill Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Service Provider</Label>
                    <p className="font-semibold text-base">{selectedPayment.billProvider}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Bill Type</Label>
                    <div className="mt-1">
                      <Badge variant="outline" className="text-sm">
                        {getBillTypeLabel(selectedPayment.billType)}
                      </Badge>
                    </div>
                  </div>
                  {selectedPayment.isConsolidated && selectedPayment.recordCount && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">Bills Included</Label>
                      <p className="font-semibold text-base">{selectedPayment.recordCount} auto-payment bills</p>
                    </div>
                  )}
                  {selectedPayment.billNumber && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">Bill Number</Label>
                      <p className="font-mono text-sm bg-muted px-2 py-1 rounded">{selectedPayment.billNumber}</p>
                    </div>
                  )}
                  {selectedPayment.customerName && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">Customer Name</Label>
                      <p className="font-medium">{selectedPayment.customerName}</p>
                    </div>
                  )}
                  {selectedPayment.recordMonth && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                        {selectedPayment.isConsolidated ? 'Payment Cycle' : 'Billing Period'}
                      </Label>
                      <p className="font-medium flex items-center gap-1">
                        <IconCalendar className="h-4 w-4 text-muted-foreground" />
                        {selectedPayment.recordMonth}
                      </p>
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Bill ID</Label>
                    <p className="font-mono text-xs text-muted-foreground">{selectedPayment.billId}</p>
                  </div>
                </div>
              </div>

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
              {selectedPayment.status === 'failed' && selectedPayment.errorMessage && (
                <div className="border-2 border-destructive rounded-lg p-4 bg-destructive/5">
                  <h3 className="text-lg font-semibold mb-2 text-destructive flex items-center gap-2">
                    <IconAlertCircle className="h-5 w-5" />
                    Payment Failed
                  </h3>
                  <p className="text-sm">{selectedPayment.errorMessage}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    If you were charged, the amount will be refunded within 5-7 business days.
                  </p>
                </div>
              )}

              {/* Additional Information */}
              <div className="border-t pt-4">
                <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                  <div>
                    <p className="font-medium">Transaction Created</p>
                    <p>{new Date(selectedPayment.createdAt).toLocaleString('en-IN', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })}</p>
                  </div>
                  <div>
                    <p className="font-medium">Payment Cycle ID</p>
                    <p className="font-mono break-all">{selectedPayment._id}</p>
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
Transaction ID: ${selectedPayment.transactionId}
Amount: ${formatCurrency(selectedPayment.amount)}
Provider: ${selectedPayment.billProvider}
Date: ${formatDate(selectedPayment.paymentDate)}
Status: ${selectedPayment.status}
                    `.trim();
                    navigator.clipboard.writeText(details);
                    toast.success('Transaction details copied to clipboard');
                  }}
                >
                  Copy Details
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
