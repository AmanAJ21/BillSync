"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  IconBolt, 
  IconCreditCard,
  IconCalendar,
  IconAlertCircle,
  IconCheck,
  IconX,
  IconRefresh,
  IconPlus,
  IconHistory
} from "@tabler/icons-react";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/utils";
import { formatDate, formatMonthYear } from "@/lib/utils/date-formatter";
import Link from "next/link";

interface Bill {
  _id: string;
  billId: string;
  provider: string;
  billType: string;
  amount: number;
  dueDate: string;
  status: string;
}

interface AutoPaymentConfig {
  _id: string;
  billId: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  disabledReason?: string;
  billDetails?: Bill;
}

interface PaymentCycle {
  _id: string;
  startDate: string;
  endDate: string;
  status: string;
}

export default function AutoPaymentsPage() {
  const { user } = useAuth();
  const [configs, setConfigs] = useState<AutoPaymentConfig[]>([]);
  const [availableBills, setAvailableBills] = useState<Bill[]>([]);
  const [currentCycle, setCurrentCycle] = useState<PaymentCycle | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch auto-payment configs
      const configsRes = await fetch('/api/auto-payment/list', { credentials: 'include' });
      if (configsRes.ok) {
        const data = await configsRes.json();
        setConfigs(data.configs || []);
      }

      // Fetch available bills
      const billsRes = await fetch('/api/bills', { credentials: 'include' });
      if (billsRes.ok) {
        const data = await billsRes.json();
        setAvailableBills(data.bills || []);
      }

      // Fetch current payment cycle
      const cycleRes = await fetch('/api/payment-cycles/current', { credentials: 'include' });
      if (cycleRes.ok) {
        const data = await cycleRes.json();
        setCurrentCycle(data.cycle);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load auto-payment data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const handleToggleAutoPay = async (billId: string, currentlyEnabled: boolean) => {
    setToggling(billId);
    try {
      const endpoint = currentlyEnabled ? '/api/auto-payment/disable' : '/api/auto-payment/enable';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ billId })
      });

      if (res.ok) {
        toast.success(currentlyEnabled ? 'Auto-payment disabled' : 'Auto-payment enabled');
        fetchData();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to update auto-payment');
      }
    } catch (error) {
      console.error('Error toggling auto-payment:', error);
      toast.error('Failed to update auto-payment');
    } finally {
      setToggling(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
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

  const getBillStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      paid: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      overdue: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };
    return colors[status.toLowerCase()] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-4 w-32 bg-muted animate-pulse rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-20 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const enabledCount = configs.filter(c => c.enabled).length;
  const totalBills = availableBills.length;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <IconBolt className="h-8 w-8 text-primary" />
            Automatic Payments
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage automatic bill payments and view your payment schedule
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchData} variant="outline" size="sm">
            <IconRefresh className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Link href="/dashboard/auto-payments/history">
            <Button variant="outline" size="sm">
              <IconHistory className="h-4 w-4 mr-2" />
              History
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Auto-Payments</CardTitle>
            <IconBolt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{enabledCount}</div>
            <p className="text-xs text-muted-foreground">
              {enabledCount} of {totalBills} bills automated
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Cycle</CardTitle>
            <IconCalendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {currentCycle ? (
              <>
                <div className="text-2xl font-bold capitalize">{currentCycle.status}</div>
                <p className="text-xs text-muted-foreground">
                  {formatDate(currentCycle.startDate)} - {formatDate(currentCycle.endDate)}
                </p>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">No active cycle</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Payment Method</CardTitle>
            <IconCreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Active</div>
            <p className="text-xs text-muted-foreground">
              Default payment method configured
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Info Alert */}
      <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <IconAlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                How Automatic Payments Work
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Bills with auto-payment enabled will be paid automatically 24 hours before their due date. 
                All auto-paid bills are consolidated into a single monthly bill for easy settlement.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bills List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Bills</CardTitle>
          <CardDescription>
            Enable or disable automatic payments for your bills
          </CardDescription>
        </CardHeader>
        <CardContent>
          {availableBills.length === 0 ? (
            <div className="text-center py-12">
              <IconCreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No bills found</h3>
              <p className="text-muted-foreground mb-4">
                Add bills to start using automatic payments
              </p>
              <Link href="/dashboard/bill">
                <Button>
                  <IconPlus className="h-4 w-4 mr-2" />
                  Add Bill
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {availableBills.map((bill) => {
                const config = configs.find(c => c.billId === bill.billId);
                const isEnabled = config?.enabled || false;
                const isToggling = toggling === bill.billId;

                return (
                  <div
                    key={bill._id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium">{bill.provider}</h3>
                          <Badge className={getBillTypeColor(bill.billType)}>
                            {bill.billType}
                          </Badge>
                          {bill.status && (
                            <Badge className={getBillStatusColor(bill.status)}>
                              {bill.status}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Amount: {formatCurrency(bill.amount)}</span>
                          <span>Due: {formatDate(bill.dueDate)}</span>
                          {config?.disabledReason && (
                            <span className="text-red-600 dark:text-red-400">
                              {config.disabledReason}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {isEnabled ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          <IconCheck className="h-3 w-3 mr-1" />
                          Auto-Pay On
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          <IconX className="h-3 w-3 mr-1" />
                          Auto-Pay Off
                        </Badge>
                      )}
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={() => handleToggleAutoPay(bill.billId, isEnabled)}
                        disabled={isToggling}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/dashboard/auto-payments/consolidated-bills">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="text-base">View Consolidated Bills</CardTitle>
              <CardDescription>
                See your monthly aggregated bills and payment history
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/dashboard/auto-payments/analytics">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="text-base">Payment Analytics</CardTitle>
              <CardDescription>
                Track your spending patterns and auto-payment insights
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
