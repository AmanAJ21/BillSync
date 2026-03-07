"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  IconChartBar,
  IconTrendingUp,
  IconCalendar,
  IconCreditCard,
  IconRefresh,
  IconBolt
} from "@tabler/icons-react";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "sonner";

interface Analytics {
  currentCycle: {
    totalAutoPaid: number;
    billCount: number;
    averageAmount: number;
  };
  enabledConfigs: number;
  byBillType: Record<string, { count: number; totalAmount: number }>;
  nextScheduled: {
    date: string;
    amount: number;
    billCount: number;
  } | null;
  cycleComparison: {
    currentCycle: number;
    previousCycle: number;
    percentageChange: number;
  };
}

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/analytics/auto-payments', {
        credentials: 'include'
      });

      if (res.ok) {
        const data = await res.json();
        setAnalytics(data.analytics);
      } else {
        toast.error('Failed to load analytics');
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchAnalytics();
    }
  }, [user]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const getBillTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      electricity: 'bg-yellow-500',
      water: 'bg-blue-500',
      gas: 'bg-orange-500',
      mobile: 'bg-purple-500',
      internet: 'bg-green-500',
    };
    return colors[type.toLowerCase()] || 'bg-gray-500';
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
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

  if (!analytics) {
    return (
      <div className="space-y-6 p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">No analytics data available</p>
        </div>
      </div>
    );
  }

  const billTypes = Object.entries(analytics.byBillType);
  const maxAmount = Math.max(...billTypes.map(([_, data]) => data.totalAmount));

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <IconChartBar className="h-8 w-8 text-primary" />
            Payment Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            Insights into your automatic payment patterns and spending
          </p>
        </div>
        <Button onClick={fetchAnalytics} variant="outline" size="sm">
          <IconRefresh className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Cycle Total</CardTitle>
            <IconCreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(analytics.currentCycle.totalAutoPaid)}
            </div>
            <p className="text-xs text-muted-foreground">
              {analytics.currentCycle.billCount} bills paid
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Bill Amount</CardTitle>
            <IconTrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(analytics.currentCycle.averageAmount)}
            </div>
            <p className="text-xs text-muted-foreground">
              Per bill average
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Auto-Payments</CardTitle>
            <IconBolt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.enabledConfigs}</div>
            <p className="text-xs text-muted-foreground">
              Bills with auto-pay enabled
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Scheduled</CardTitle>
            <IconCalendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {analytics.nextScheduled ? (
              <>
                <div className="text-2xl font-bold">
                  {formatCurrency(analytics.nextScheduled.amount)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(analytics.nextScheduled.date).toLocaleDateString()}
                </p>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">No upcoming payments</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cycle Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Cycle Comparison</CardTitle>
          <CardDescription>
            Compare current cycle spending with previous cycle
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Current Cycle</span>
              <span className="text-lg font-bold">
                {formatCurrency(analytics.cycleComparison.currentCycle)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Previous Cycle</span>
              <span className="text-lg font-bold">
                {formatCurrency(analytics.cycleComparison.previousCycle)}
              </span>
            </div>
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Change</span>
                <div className="flex items-center gap-2">
                  {analytics.cycleComparison.percentageChange > 0 ? (
                    <IconTrendingUp className="h-4 w-4 text-red-600" />
                  ) : (
                    <IconTrendingUp className="h-4 w-4 text-green-600 rotate-180" />
                  )}
                  <span className={`text-lg font-bold ${
                    analytics.cycleComparison.percentageChange > 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {Math.abs(analytics.cycleComparison.percentageChange).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Spending by Bill Type */}
      <Card>
        <CardHeader>
          <CardTitle>Spending by Bill Type</CardTitle>
          <CardDescription>
            Breakdown of auto-paid amounts by category
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {billTypes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No data available
              </div>
            ) : (
              billTypes.map(([type, data]) => (
                <div key={type} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${getBillTypeColor(type)}`} />
                      <span className="font-medium capitalize">{type}</span>
                      <span className="text-muted-foreground">({data.count} bills)</span>
                    </div>
                    <span className="font-semibold">{formatCurrency(data.totalAmount)}</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getBillTypeColor(type)} transition-all duration-300`}
                      style={{ width: `${(data.totalAmount / maxAmount) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
