"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  IconFileInvoice,
  IconChartBar,
  IconClock,
  IconCreditCard,
  IconTrendingUp,
  IconCalendarEvent,
  IconShieldCheck,
  IconChevronRight,
  IconAlertCircle
} from "@tabler/icons-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

export default function UserDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [history, setHistory] = useState<any>(null);
  const [recentBills, setRecentBills] = useState<any>(null);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const [statsRes, historyRes, billsRes] = await Promise.all([
          fetch('/api/analytics/auto-payments').then(res => res.ok ? res.json() : null),
          fetch('/api/analytics/payment-history?limit=6').then(res => res.ok ? res.json() : null),
          fetch('/api/bills').then(res => res.ok ? res.json() : null)
        ]);

        if (statsRes && statsRes.success) setStats(statsRes.data);
        if (historyRes && historyRes.success) setHistory(historyRes.data);

        if (billsRes && billsRes.bills) {
          // Get the top 5 most recent bills
          const sorted = billsRes.bills.sort((a: any, b: any) =>
            new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()
          );
          setRecentBills(sorted.slice(0, 5));
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const prepareChartData = () => {
    if (!history?.history || history.history.length === 0) return [];

    // Reverse to show oldest to newest (left to right)
    return [...history.history].reverse().map(cycle => ({
      name: cycle.cycleMonth,
      total: cycle.totalAmount,
      successCount: cycle.successCount
    }));
  };

  const chartData = prepareChartData();

  if (loading) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <div className="h-8 w-48 bg-muted rounded animate-pulse"></div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-muted rounded animate-pulse"></div>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <div className="h-96 bg-muted rounded animate-pulse col-span-4"></div>
          <div className="h-96 bg-muted rounded animate-pulse col-span-3"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard Overview</h2>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1 bg-primary/5 text-primary">
            <IconShieldCheck className="h-4 w-4" />
            Protected Account
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-md transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
            <IconCreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.totalAmountPaid ? formatCurrency(stats.totalAmountPaid) : "₹0.00"}
            </div>
            <p className="text-xs text-muted-foreground mt-1 text-green-600 flex items-center">
              <IconTrendingUp className="h-3 w-3 mr-1" />
              Lifetime successful payments
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <IconChartBar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.successRate ? `${stats.successRate.toFixed(1)}%` : "0%"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Of {stats?.totalProcessed || 0} auto-payments processed
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Auto Pay Bills</CardTitle>
            <IconFileInvoice className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.totalSubscribedBills || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Currently enabled for auto-payment
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Due</CardTitle>
            <IconClock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {recentBills?.[0]?.dueDate ? formatDate(recentBills[0].dueDate) : "No Upcoming"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {recentBills?.[0]?.provider ? recentBills[0].provider : "Add a bill to see due dates"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 hover:shadow-md transition-all duration-300">
          <CardHeader>
            <CardTitle>Spending Over Time</CardTitle>
            <CardDescription>
              Your auto-payment usage over the last 6 months
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-0">
            {chartData.length > 0 ? (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={chartData}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} tickMargin={10} axisLine={false} tickLine={false} />
                    <YAxis
                      tickFormatter={(value) => `₹${value / 1000}k`}
                      tick={{ fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                    <Tooltip
                      formatter={(value: number) => [formatCurrency(value), "Spent"]}
                      contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                    />
                    <Area type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorTotal)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg m-4">
                Not enough data to display charts. Add bills and wait for the auto-payment cycle.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-3 hover:shadow-md transition-all duration-300 flex flex-col">
          <CardHeader>
            <CardTitle>Recent Bills</CardTitle>
            <CardDescription>
              Your most recently added or updated bills
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {recentBills && recentBills.length > 0 ? (
              <div className="space-y-4">
                {recentBills.map((bill: any) => (
                  <div key={bill._id} className="flex items-center p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      {bill.billType === 'electricity' ? <IconBolt className="h-5 w-5" /> :
                        bill.billType === 'water' ? <IconAlertCircle className="h-5 w-5" /> :
                          <IconFileInvoice className="h-5 w-5" />}
                    </div>
                    <div className="ml-4 space-y-1 overflow-hidden">
                      <p className="text-sm font-medium leading-none truncate">{bill.provider}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(bill.dueDate)}</p>
                    </div>
                    <div className="ml-auto font-medium">
                      {formatCurrency(bill.amount)}
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5 justify-end">
                        {bill.autoPayEnabled ? (
                          <span className="text-green-500 flex items-center gap-0.5"><IconClock className="h-3 w-3 " /> Auto-Pay ON</span>
                        ) : (
                          <span className="text-muted-foreground">Manual</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-[200px] items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
                No bills added yet
              </div>
            )}
          </CardContent>
          <CardFooter className="pt-4 border-t">
            <Link href="/dashboard/bills" className="w-full">
              <Button variant="outline" className="w-full group">
                Manage Bills
                <IconChevronRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

// Simple fallback icon component since not all icons from table-icons-react might be imported
const IconBolt = (props: any) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>
);
