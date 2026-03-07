"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  IconFileInvoice,
  IconDownload,
  IconCreditCard,
  IconCalendar,
  IconReceipt,
  IconRefresh,
  IconChevronRight
} from "@tabler/icons-react";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/utils";
import Link from "next/link";

interface ConsolidatedBill {
  id: string;
  userId: string;
  paymentCycleId: string;
  cycleStartDate: string;
  cycleEndDate: string;
  totalAmount: number;
  status: 'pending' | 'paid' | 'failed';
  paidAt?: string;
  createdAt: string;
  autoPaymentRecordCount: number;
}

export default function ConsolidatedBillsPage() {
  const { user } = useAuth();
  const [bills, setBills] = useState<ConsolidatedBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [paying, setPaying] = useState<string | null>(null);

  const fetchBills = async (pageNum: number = 1) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/consolidated-bills?page=${pageNum}&limit=10`, {
        credentials: 'include'
      });

      if (res.ok) {
        const data = await res.json();
        setBills(data.bills || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setPage(pageNum);
      } else {
        toast.error('Failed to load consolidated bills');
      }
    } catch (error) {
      console.error('Error fetching bills:', error);
      toast.error('Failed to load consolidated bills');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchBills();
    }
  }, [user]);

  const handlePayBill = async (billId: string) => {
    setPaying(billId);
    try {
      // Create Razorpay order
      const res = await fetch(`/api/consolidated-bills/${billId}/pay`, {
        method: 'POST',
        credentials: 'include'
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || 'Failed to initiate payment');
        setPaying(null);
        return;
      }

      const data = await res.json();
      const { orderId, amount, currency } = data.data;

      // Load Razorpay script
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);

      script.onload = () => {
        const options = {
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_SJxb9PHTqp9HFW',
          amount: amount * 100, // Amount in paise
          currency: currency,
          name: 'BillSync',
          description: `Consolidated Bill Payment`,
          order_id: orderId,
          handler: async function (response: any) {
            try {
              // Verify payment
              const verifyRes = await fetch('/api/payments/verify', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                }),
              });

              if (verifyRes.ok) {
                toast.success('Payment successful!');
                fetchBills(page);
              } else {
                toast.error('Payment verification failed');
              }
            } catch (error) {
              console.error('Payment verification error:', error);
              toast.error('Payment verification failed');
            } finally {
              setPaying(null);
            }
          },
          prefill: {
            name: user?.name || '',
            email: user?.email || '',
          },
          theme: {
            color: '#3b82f6',
          },
          modal: {
            ondismiss: function() {
              setPaying(null);
              toast.info('Payment cancelled');
            }
          }
        };

        const razorpay = new (window as any).Razorpay(options);
        razorpay.open();
      };

      script.onerror = () => {
        toast.error('Failed to load payment gateway');
        setPaying(null);
      };

    } catch (error) {
      console.error('Error paying bill:', error);
      toast.error('Failed to initiate payment');
      setPaying(null);
    }
  };

  const handleDownloadPDF = async (billId: string) => {
    try {
      const res = await fetch(`/api/consolidated-bills/${billId}/pdf`, {
        credentials: 'include'
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `consolidated-bill-${billId}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success('PDF downloaded');
      } else {
        toast.error('Failed to download PDF');
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Failed to download PDF');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      paid: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    };
    return (
      <Badge className={styles[status as keyof typeof styles] || styles.pending}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="h-24 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const totalPaid = bills.filter(b => b.status === 'paid').reduce((sum, b) => sum + b.totalAmount, 0);
  const totalPending = bills.filter(b => b.status === 'pending').reduce((sum, b) => sum + b.totalAmount, 0);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <IconFileInvoice className="h-8 w-8 text-primary" />
            Consolidated Bills
          </h1>
          <p className="text-muted-foreground mt-1">
            View and manage your monthly aggregated bills
          </p>
        </div>
        <Button onClick={() => fetchBills(page)} variant="outline" size="sm">
          <IconRefresh className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bills</CardTitle>
            <IconReceipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bills.length}</div>
            <p className="text-xs text-muted-foreground">
              Consolidated bills generated
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
            <IconCreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalPaid)}</div>
            <p className="text-xs text-muted-foreground">
              {bills.filter(b => b.status === 'paid').length} bills paid
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Amount</CardTitle>
            <IconCalendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalPending)}</div>
            <p className="text-xs text-muted-foreground">
              {bills.filter(b => b.status === 'pending').length} bills pending
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bills List */}
      <div className="space-y-4">
        {bills.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <IconFileInvoice className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No consolidated bills yet</h3>
                <p className="text-muted-foreground mb-4">
                  Consolidated bills are generated at the end of each payment cycle
                </p>
                <Link href="/dashboard/auto-payments">
                  <Button>
                    Manage Auto-Payments
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          bills.map((bill) => (
            <Card key={bill.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">
                        {new Date(bill.cycleStartDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </h3>
                      {getStatusBadge(bill.status)}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground mb-4">
                      <div>
                        <span className="font-medium">Cycle Period:</span>
                        <br />
                        {new Date(bill.cycleStartDate).toLocaleDateString()} - {new Date(bill.cycleEndDate).toLocaleDateString()}
                      </div>
                      <div>
                        <span className="font-medium">Bills Included:</span>
                        <br />
                        {bill.autoPaymentRecordCount} auto-paid bills
                      </div>
                      <div>
                        <span className="font-medium">Total Amount:</span>
                        <br />
                        <span className="text-lg font-bold text-foreground">
                          {formatCurrency(bill.totalAmount)}
                        </span>
                      </div>
                      {bill.paidAt && (
                        <div>
                          <span className="font-medium">Paid On:</span>
                          <br />
                          {formatDateTime(bill.paidAt)}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Link href={`/dashboard/auto-payments/consolidated-bills/${bill.id}`}>
                        <Button variant="outline" size="sm">
                          <IconChevronRight className="h-4 w-4 mr-1" />
                          View Details
                        </Button>
                      </Link>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadPDF(bill.id)}
                      >
                        <IconDownload className="h-4 w-4 mr-1" />
                        Download PDF
                      </Button>

                      {bill.status === 'pending' && (
                        <Button
                          size="sm"
                          onClick={() => handlePayBill(bill.id)}
                          disabled={paying === bill.id}
                        >
                          <IconCreditCard className="h-4 w-4 mr-1" />
                          {paying === bill.id ? 'Processing...' : 'Pay Now'}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchBills(page - 1)}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchBills(page + 1)}
            disabled={page === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
