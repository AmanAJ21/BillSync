"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  IconReceipt,
  IconPlus,
  IconRefresh,
  IconCalendar,
  IconSearch,
  IconChevronDown,
  IconChevronUp,
  IconCheck,
  IconLoader2,
  IconX,
  IconFileDescription,
  IconTrash,
} from "@tabler/icons-react";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";
import Script from "next/script";
import { IconCreditCard } from "@tabler/icons-react";
import { formatDate, formatMonthYear } from "@/lib/utils/date-formatter";

// Provider options grouped by bill type
const PROVIDERS: Record<string, { label: string; value: string }[]> = {
  dth: [
    { label: "Tata Play", value: "Tata Play" },
    { label: "Dish TV", value: "Dish TV" },
    { label: "Airtel Digital TV", value: "Airtel Digital TV" },
    { label: "Sun Direct", value: "Sun Direct" },
    { label: "D2H", value: "D2H" },
  ],
  electricity: [
    { label: "BSES Rajdhani", value: "BSES Rajdhani" },
    { label: "BSES Yamuna", value: "BSES Yamuna" },
    { label: "Tata Power", value: "Tata Power" },
    { label: "Adani Electricity", value: "Adani Electricity" },
    { label: "MSEDCL", value: "MSEDCL" },
    { label: "UPPCL", value: "UPPCL" },
    { label: "TNEB", value: "TNEB" },
  ],
  prepaid_mobile: [
    { label: "Jio", value: "Jio" },
    { label: "Airtel", value: "Airtel" },
    { label: "Vi (Vodafone Idea)", value: "Vi" },
    { label: "BSNL", value: "BSNL" },
  ],
};

const BILL_TYPE_OPTIONS = [
  { label: "Electricity", value: "electricity" },
  { label: "DTH", value: "dth" },
  { label: "Prepaid Mobile", value: "prepaid_mobile" },
];

interface SearchResult {
  _id: string;
  billId: string;
  billNumber?: string;
  provider: string;
  providerName?: string;
  billType: string;
  type?: string;
  billingFrequency?: string;
  dueDay?: number;
  dueDate?: string;
  billingPeriod?: string;
  customerName?: string;
  accountNumber?: string;
  unitsConsumed?: number;
  dataUsed?: string;
  channels?: number;
  breakdown?: Record<string, number>;
  title?: string;
  description?: string;
  createdAt?: string;
}

interface Bill extends SearchResult {
  monthlyRecords?: {
    id: string;
    month: string;
    amount: number;
    dueDate: string;
    status: 'pending' | 'paid' | 'overdue';
    createdAt: string;
  }[];
}

export default function BillManagementPage() {
  const { user } = useAuth();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  // Search state
  const [searchBillNumber, setSearchBillNumber] = useState("");
  const [searchBillType, setSearchBillType] = useState("");
  const [searchProvider, setSearchProvider] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [expandedBillId, setExpandedBillId] = useState<string | null>(null);
  const [addingBillId, setAddingBillId] = useState<string | null>(null);

  // Get available providers based on selected bill type
  const getSearchProviders = () => {
    if (!searchBillType) return [];
    return PROVIDERS[searchBillType] || [];
  };

  // Selected bill in "Your Bills" section for Dialog
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [removingBillId, setRemovingBillId] = useState<string | null>(null);

  const fetchBills = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/bills', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setBills(data.bills || []);
      } else {
        toast.error('Failed to load bills');
      }
    } catch (error) {
      console.error('Error fetching bills:', error);
      toast.error('Failed to load bills');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchBills();
    }
  }, [user]);

  // Search for bills
  const handleSearch = async () => {
    if (!searchBillNumber.trim() && !searchProvider && !searchBillType) {
      toast.error('Please select a bill type and provider, or enter a bill number');
      return;
    }

    setSearching(true);
    setHasSearched(true);
    setExpandedBillId(null);

    try {
      const params = new URLSearchParams();
      if (searchBillNumber.trim()) {
        params.append('billNumber', searchBillNumber.trim());
      }
      if (searchProvider) {
        params.append('provider', searchProvider);
      }
      if (searchBillType) {
        params.append('billType', searchBillType);
      }

      const res = await fetch(`/api/bills/search?${params.toString()}`, {
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.bills || []);
        if (data.bills?.length === 0) {
          toast.info('No matching bills found');
        }
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to search bills');
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching bills:', error);
      toast.error('Failed to search bills');
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // Add a matched bill to user's account
  const handleAddMatchedBill = async (bill: SearchResult) => {
    setAddingBillId(bill._id);

    try {
      const res = await fetch('/api/bills/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          billId: bill._id,
        }),
      });

      if (res.ok) {
        toast.success('Bill linked successfully!');
        setShowAddForm(false);
        setSearchResults([]);
        setSearchBillNumber('');
        setSearchBillType('');
        setSearchProvider('');
        setHasSearched(false);
        setExpandedBillId(null);
        fetchBills();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to link bill');
      }
    } catch (error) {
      console.error('Error linking bill:', error);
      toast.error('Failed to link bill');
    } finally {
      setAddingBillId(null);
    }
  };

  const handlePayRecord = async (billId: string, recordId: string, amount: number) => {
    try {
      // Close the bill details dialog before opening Razorpay
      setSelectedBill(null);
      
      // Wait a bit for dialog to close to prevent z-index conflicts
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const res = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ billId, recordId })
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || 'Failed to create payment order');
        return;
      }

      const orderData = await res.json();

      // Check if Razorpay is loaded
      if (!(window as any).Razorpay) {
        toast.error('Payment system not loaded. Please refresh the page.');
        return;
      }

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'BillSync',
        description: `Payment for ${orderData.billDetails.provider} - ${orderData.month || ''}`,
        order_id: orderData.orderId,
        handler: async (response: any) => {
          try {
            const verifyRes = await fetch('/api/payment/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                billId,
                recordId
              })
            });

            if (verifyRes.ok) {
              toast.success('Payment successful!');
              // Close detail view and refresh bills
              setSelectedBill(null);
              fetchBills();
            } else {
              const error = await verifyRes.json();
              toast.error(error.error || 'Payment verification failed');
            }
          } catch (error) {
            console.error('Error verifying payment:', error);
            toast.error('Payment verification failed');
          }
        },
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
        },
        readonly: {
          name: true,
          email: true,
        },
        theme: {
          color: '#3b82f6',
        },
        modal: {
          ondismiss: () => {
            console.log('Payment modal closed');
          },
          escape: true,
          backdropclose: false,
        },
      };

      const rzp = new (window as any).Razorpay(options);
      
      // Add event listeners for better modal handling
      rzp.on('payment.failed', function (response: any) {
        toast.error('Payment failed: ' + (response.error?.description || 'Unknown error'));
      });
      
      rzp.open();
    } catch (error) {
      console.error('Error initiating payment:', error);
      toast.error('Failed to initiate payment');
    }
  };


  // Remove bill from user's account
  const handleRemoveBill = async (billId: string) => {
    if (!confirm('Are you sure you want to remove this bill from your account?')) return;

    setRemovingBillId(billId);
    try {
      const res = await fetch(`/api/bills/${billId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (res.ok) {
        toast.success('Bill removed successfully');
        if (selectedBill?._id === billId) setSelectedBill(null);
        fetchBills();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to remove bill');
      }
    } catch (error) {
      console.error('Error removing bill:', error);
      toast.error('Failed to remove bill');
    } finally {
      setRemovingBillId(null);
    }
  };



  const getBillTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      electricity: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
      water: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
      gas: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
      mobile: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
      prepaid_mobile: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
      internet: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
      dth: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
      other: 'bg-gray-100 text-gray-800 dark:bg-gray-900/40 dark:text-gray-300',
    };
    return colors[type?.toLowerCase()] || colors.other;
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
      paid: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
      overdue: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    };
    return (
      <Badge className={styles[status] || styles.pending}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getFrequencyLabel = (freq?: string) => {
    const labels: Record<string, string> = {
      monthly: 'Monthly',
      quarterly: 'Quarterly',
      yearly: 'Yearly',
      'one-time': 'One-time',
    };
    return labels[freq || ''] || freq || 'N/A';
  };

  const getBillTypeLabel = (type?: string) => {
    const labels: Record<string, string> = {
      electricity: 'Electricity',
      dth: 'DTH',
      prepaid_mobile: 'Prepaid Mobile',
      water: 'Water',
      gas: 'Gas',
      internet: 'Internet',
      mobile: 'Mobile',
      other: 'Other',
    };
    return labels[type?.toLowerCase() || ''] || type || 'Other';
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

  // Group bills by month and year based on due date
  const groupedBills = useMemo(() => {
    const groups: Record<string, Bill[]> = {};
    bills.forEach(bill => {
      const groupKey = formatMonthYear(bill.dueDate);
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(bill);
    });

    return Object.entries(groups).map(([month, monthBills]) => ({
      month,
      bills: monthBills
    }));
  }, [bills]);

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

  return (
    <>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <IconReceipt className="h-8 w-8 text-primary" />
              Bill Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Search and add bills to your account
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={fetchBills} variant="outline" size="sm">
              <IconRefresh className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button
              onClick={() => {
                setShowAddForm(!showAddForm);
                if (!showAddForm) {
                  setSearchResults([]);
                  setHasSearched(false);
                  setSearchBillNumber('');
                  setSearchBillType('');
                  setSearchProvider('');
                  setExpandedBillId(null);
                }
              }}
              size="sm"
            >
              {showAddForm ? (
                <>
                  <IconX className="h-4 w-4 mr-2" />
                  Cancel
                </>
              ) : (
                <>
                  <IconPlus className="h-4 w-4 mr-2" />
                  Add Bill
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Add Bill - Search Form */}
        {showAddForm && (
          <Card className="border-primary/20 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconSearch className="h-5 w-5" />
                Find Your Bill
              </CardTitle>
              <CardDescription>
                Select bill type and provider, then enter your bill number to find and add the bill
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Search Fields */}
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="search-billtype">Bill Type</Label>
                  <Select
                    value={searchBillType}
                    onValueChange={(value) => {
                      setSearchBillType(value);
                      setSearchProvider(''); // Reset provider when type changes
                    }}
                  >
                    <SelectTrigger id="search-billtype">
                      <SelectValue placeholder="Select bill type" />
                    </SelectTrigger>
                    <SelectContent>
                      {BILL_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="search-provider">Provider</Label>
                  <Select
                    value={searchProvider}
                    onValueChange={setSearchProvider}
                    disabled={!searchBillType}
                  >
                    <SelectTrigger id="search-provider">
                      <SelectValue placeholder={searchBillType ? "Select provider" : "Select bill type first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {getSearchProviders().map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="search-billnumber">Bill Number</Label>
                  <Input
                    id="search-billnumber"
                    placeholder="e.g., ELEC-TPWR-MTH-A1B2"
                    value={searchBillNumber}
                    onChange={(e) => setSearchBillNumber(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSearch();
                      }
                    }}
                    className="font-mono"
                  />
                </div>
              </div>

              <Button
                onClick={handleSearch}
                disabled={searching || (!searchBillNumber.trim() && !searchProvider && !searchBillType)}
                className="w-full sm:w-auto"
              >
                {searching ? (
                  <>
                    <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <IconSearch className="h-4 w-4 mr-2" />
                    Search Bills
                  </>
                )}
              </Button>

              {/* Search Results */}
              {hasSearched && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      {searchResults.length > 0
                        ? `${searchResults.length} Bill${searchResults.length !== 1 ? 's' : ''} Found`
                        : 'No Results'}
                    </h3>
                  </div>

                  {searchResults.length === 0 && (
                    <div className="text-center py-8">
                      <IconFileDescription className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">
                        No bills match your search. Please check the bill number or provider and try again.
                      </p>
                    </div>
                  )}

                  {searchResults.map((bill) => {
                    const isAdding = addingBillId === bill._id;
                    const providerDisplay = bill.provider || bill.providerName || 'Unknown';
                    const billTypeDisplay = bill.billType || bill.type || 'other';

                    return (
                      <div
                        key={bill._id}
                        className="flex items-center justify-between px-4 py-3 border rounded-xl hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0 flex-wrap">
                          <Badge className={getBillTypeColor(billTypeDisplay)}>
                            {getBillTypeLabel(billTypeDisplay)}
                          </Badge>
                          <span className="font-mono text-sm font-semibold text-primary">
                            {bill.billNumber || 'N/A'}
                          </span>
                          <span className="text-sm font-medium text-muted-foreground">
                            {providerDisplay}
                          </span>
                          {bill.customerName && (
                            <span className="text-sm text-muted-foreground">
                              • {bill.customerName}
                            </span>
                          )}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleAddMatchedBill(bill)}
                          disabled={isAdding}
                          className="ml-3 shrink-0"
                        >
                          {isAdding ? (
                            <>
                              <IconLoader2 className="h-4 w-4 mr-1.5 animate-spin" />
                              Adding...
                            </>
                          ) : (
                            <>
                              <IconPlus className="h-4 w-4 mr-1.5" />
                              Add Bill
                            </>
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Your Bills List */}
        <Card>
          <CardHeader>
            <CardTitle>Your Bills</CardTitle>
            <CardDescription>
              {bills.length} bill{bills.length !== 1 ? 's' : ''} in your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            {bills.length === 0 ? (
              <div className="text-center py-12">
                <IconReceipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No bills yet</h3>
                <p className="text-muted-foreground mb-4">
                  Search and add your first bill to get started
                </p>
                <Button onClick={() => setShowAddForm(true)}>
                  <IconPlus className="h-4 w-4 mr-2" />
                  Add Your First Bill
                </Button>
              </div>
            ) : (
              <div className="space-y-8">
                {groupedBills.map((group) => (
                  <div key={group.month} className="space-y-3">
                    <h3 className="text-lg font-semibold text-muted-foreground border-b pb-2 flex items-center gap-2">
                      <IconCalendar className="h-5 w-5" />
                      {group.month}
                    </h3>
                    <div className="space-y-3">
                      {group.bills.map((bill) => {
                        const providerDisplay = bill.provider || bill.providerName || 'Unknown';

                        return (
                          <div
                            key={bill._id}
                            className="border rounded-xl overflow-hidden transition-all duration-200 hover:shadow-md cursor-pointer hover:bg-muted/50"
                            onClick={() => setSelectedBill(bill)}
                          >
                            {/* Compact View - Bill Number, Provider, Frequency */}
                            <div className="flex items-center justify-between px-4 py-3">
                              <div className="flex items-center gap-4 flex-1 min-w-0">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 flex-1 min-w-0">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="font-mono text-sm font-semibold text-primary truncate">
                                      {bill.billNumber || bill.billId || 'N/A'}
                                    </span>
                                  </div>
                                  <span className="text-sm font-medium truncate">
                                    {providerDisplay}
                                  </span>
                                  {bill.billingFrequency && (
                                    <Badge variant="outline" className="w-fit text-xs shrink-0">
                                      {getFrequencyLabel(bill.billingFrequency)}
                                    </Badge>
                                  )}
                                  {/* Status removed from root bill */}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bill Details Dialog */}
        <Dialog open={!!selectedBill} onOpenChange={(open) => !open && setSelectedBill(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Bill Details</DialogTitle>
              <DialogDescription>
                {selectedBill?.billNumber || selectedBill?.billId || 'N/A'}
              </DialogDescription>
            </DialogHeader>

            {selectedBill && (
              <div className="space-y-4 pt-2">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Bill Type</span>
                    <div>
                      <Badge className={getBillTypeColor(selectedBill.billType || selectedBill.type || 'other')}>
                        {getBillTypeLabel(selectedBill.billType || selectedBill.type || 'other')}
                      </Badge>
                    </div>
                  </div>


                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Provider</span>
                    <p className="font-medium">{selectedBill.provider || selectedBill.providerName || 'Unknown'}</p>
                  </div>

                  {selectedBill.customerName && (
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Customer Name</span>
                      <p className="font-medium">{selectedBill.customerName}</p>
                    </div>
                  )}

                  {selectedBill.accountNumber && (
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Account Number</span>
                      <p className="font-mono text-sm">{selectedBill.accountNumber}</p>
                    </div>
                  )}

                  {selectedBill.dueDay && (
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Due Day</span>
                      <p className="font-medium">{selectedBill.dueDay}{getOrdinalSuffix(selectedBill.dueDay)} of every cycle</p>
                    </div>
                  )}

                  {selectedBill.dueDate && (
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Due Date</span>
                      <p className="font-medium flex items-center gap-1">
                        <IconCalendar className="h-3.5 w-3.5" />
                        {formatDate(selectedBill.dueDate, { format: 'long' })}
                      </p>
                    </div>
                  )}

                  {selectedBill.billingPeriod && (
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Billing Period</span>
                      <p className="font-medium">{selectedBill.billingPeriod}</p>
                    </div>
                  )}

                  {selectedBill.unitsConsumed && (
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Units Consumed</span>
                      <p className="font-medium">{selectedBill.unitsConsumed} kWh</p>
                    </div>
                  )}

                  {selectedBill.dataUsed && (
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Data Used</span>
                      <p className="font-medium">{selectedBill.dataUsed}</p>
                    </div>
                  )}

                  {selectedBill.channels && (
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Channels</span>
                      <p className="font-medium">{selectedBill.channels}</p>
                    </div>
                  )}
                </div>



                {selectedBill.description && (
                  <div className="space-y-1 mt-4 pt-4 border-t">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Description</span>
                    <p className="text-sm text-muted-foreground">{selectedBill.description}</p>
                  </div>
                )}

                {selectedBill.monthlyRecords && selectedBill.monthlyRecords.length > 0 && (
                  <div className="mt-6 pt-4 border-t">
                    <h3 className="text-sm font-medium mb-3">Recent Bill Records</h3>
                    <div className="space-y-3">
                      {selectedBill.monthlyRecords.map((record, idx) => (
                        <div key={record.id || idx} className="flex items-center justify-between p-3 border rounded-lg bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{record.month}</span>
                              {getStatusBadge(record.status)}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium tracking-wide">
                              <IconCalendar className="h-3 w-3" />
                              DUE: {formatDate(record.dueDate, { format: 'short' })}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <div className="font-semibold text-lg tracking-tight">
                              {new Intl.NumberFormat('en-IN', {
                                style: 'currency',
                                currency: 'INR'
                              }).format(record.amount)}
                            </div>
                            {record.status !== 'paid' && (
                              <Button
                                size="sm"
                                variant="default"
                                className="h-8 py-0 px-3 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePayRecord(selectedBill._id, record.id, record.amount);
                                }}
                              >
                                <IconCreditCard className="h-3.5 w-3.5 mr-1" />
                                Pay Now
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <DialogFooter className="mt-6 pt-4 border-t sm:justify-between">
                  <Button variant="destructive" onClick={() => handleRemoveBill(selectedBill._id)} disabled={removingBillId === selectedBill._id}>
                    {removingBillId === selectedBill._id ? (
                      <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <IconTrash className="h-4 w-4 mr-2" />
                    )}
                    Remove Bill
                  </Button>
                  <Button variant="outline" onClick={() => setSelectedBill(null)}>
                    Close
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
      <Script
        id="razorpay-checkout-js"
        src="https://checkout.razorpay.com/v1/checkout.js"
      />
    </>
  );
}
