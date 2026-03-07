"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  IconArrowLeft,
  IconDownload,
  IconCreditCard,
  IconReceipt,
  IconCalendar,
  IconCheck
} from "@tabler/icons-react";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/utils";

interface AutoPaymentRecord {
  _id: string;
  billId: string;
  amount: number;
  paymentDate: string;
  transactionId: string;
  billProvider: string;
  billType: string;
  status: string;
}

interface ConsolidatedBillDetails {
  _id: string;
  userId: string;
  paymentCycleId: string;
  cycleStartDate: string;
  cycleEndDate: string;
  totalAmount: number;
  status: 'pending' | 'paid' | 'failed';
  paidAt?: string;
  razorpayOrderId?: string;
  createdAt: string;
  autoPaymentRecords: AutoPaymentRecord[];
}

export default function ConsolidatedBillDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [bill, setBill] = useState<ConsolidatedBillDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  const billId = params.id as string;

  const fetchBillDetails = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/consolidated-bills/${billId}`, {
        credentials: 'include'
      });

      if (res.ok) {
        const data = await res.json();
        setBill(data.bill);
      } else {
        toast.error('Failed to load bill details');
        router.push('/dashboard/auto-payments/consolidated-bills');
      }
    } catch (error) {
      console.error('Error fetching bill details:', error);
      toast.error('Failed to load bill details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && billId) {
      fetchBillDetails();
    }
  }, [user, billId]);

  const handlePayBill = async () => {
    if (!bill) return;
    
    setPaying(true);
    try {
      // Create Razorpay order
      const res = await fetch(`/api/consolidated-bills/${billId}/pay`, {
        method: 'POST',
        credentials: 'include'
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || 'Failed to initiate payment');
        setPaying(false);
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
                fetchBillDetails();
              } else {
                toast.error('Payment verification failed');
              }
            } catch (error) {
              console.error('Payment verification error:', error);
              toast.error('Payment verification failed');
            } finally {
              setPaying(false);
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
              setPaying(false);
              toast.info('Payment cancelled');
            }
          }
        };

        const razorpay = new (window as any).Razorpay(options);
        razorpay.open();
      };

      script.onerror = () => {
        toast.error('Failed to load payment gateway');
        setPaying(false);
      };

    } catch (error) {
      console.error('Error paying bill:', error);
      toast.error('Failed to initiate payment');
      setPaying(false);
    }
  };

  const handleDownloadPDF = async () => {
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
      failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      success: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      settled: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    };
    return (
      <Badge className={styles[status as keyof typeof styles] || styles.pending}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getBillTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      electricity: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      water: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      gas: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      mobile: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      internet: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    };
    return colors[type.toLowerCase()] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        <Card>
          <CardContent className="pt-6">
            <div className="h-64 bg-muted animate-pulse rounded" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="space-y-6 p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Bill not found</p>
          <Button onClick={() => router.push('/dashboard/auto-payments/consolidated-bills')} className="mt-4">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/dashboard/auto-payments/consolidated-bills')}
          >
            <IconArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              {new Date(bill.cycleStartDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} Bill
            </h1>
            <p className="text-muted-foreground mt-1">
              Consolidated bill details and itemized breakdown
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
            <IconDownload className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
          {bill.status === 'pending' && (
            <Button size="sm" onClick={handlePayBill} disabled={paying}>
              <IconCreditCard className="h-4 w-4 mr-2" />
              {paying ? 'Processing...' : 'Pay Now'}
            </Button>
          )}
        </div>
      </div>

      {/* Bill Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Bill Summary</CardTitle>
              <CardDescription>
                Payment cycle: {new Date(bill.cycleStartDate).toLocaleDateString()} - {new Date(bill.cycleEndDate).toLocaleDateString()}
              </CardDescription>
            </div>
            {getStatusBadge(bill.status)}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="text-3xl font-bold">{formatCurrency(bill.totalAmount)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Bills Included</p>
                <p className="text-xl font-semibold">{bill.autoPaymentRecords.length} bills</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Generated On</p>
                <p className="text-lg">{formatDateTime(bill.createdAt)}</p>
              </div>
              {bill.paidAt && (
                <div>
                  <p className="text-sm text-muted-foreground">Paid On</p>
                  <p className="text-lg flex items-center gap-2">
                    <IconCheck className="h-5 w-5 text-green-600" />
                    {formatDateTime(bill.paidAt)}
                  </p>
                </div>
              )}
              {bill.razorpayOrderId && (
                <div>
                  <p className="text-sm text-muted-foreground">Order ID</p>
                  <p className="text-sm font-mono">{bill.razorpayOrderId}</p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Itemized Bills */}
      <Card>
        <CardHeader>
          <CardTitle>Itemized Bills</CardTitle>
          <CardDescription>
            All bills that were automatically paid during this cycle
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {bill.autoPaymentRecords.map((record, index) => (
              <div
                key={record._id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-medium">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{record.billProvider}</h4>
                      <Badge className={getBillTypeColor(record.billType)}>
                        {record.billType}
                      </Badge>
                      {getStatusBadge(record.status)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>Paid: {new Date(record.paymentDate).toLocaleDateString()}</span>
                      <span className="font-mono text-xs">TXN: {record.transactionId}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold">{formatCurrency(record.amount)}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="mt-6 pt-6 border-t">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold">Total Amount</p>
                <p className="text-sm text-muted-foreground">
                  {bill.autoPaymentRecords.length} bills included
                </p>
              </div>
              <p className="text-3xl font-bold">{formatCurrency(bill.totalAmount)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
