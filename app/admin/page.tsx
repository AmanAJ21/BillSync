"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  IconUsers,
  IconFileText,
  IconCreditCard,
  IconTrendingUp,
  IconUserPlus,
  IconFilePlus,
  IconDownload,
  IconSettings,
  IconBolt,
  IconLoader2
} from "@tabler/icons-react";

interface DashboardStats {
  totalUsers: number;
  totalBills: number;
  pendingBills: number;
  totalConsolidatedBills?: number;
  totalRevenue: number;
  totalProcessedPayments: number;
  recentActivity: Array<{
    id: string;
    adminId: string;
    action: string;
    entityType: string;
    timestamp: string;
    description: string;
  }>;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingPayments, setProcessingPayments] = useState(false);
  const [generatingConsolidated, setGeneratingConsolidated] = useState(false);

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/api/admin/dashboard/stats');
        if (!response.ok) {
          throw new Error('Failed to fetch dashboard statistics');
        }
        const data = await response.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const handleTriggerAutoPayments = async () => {
    setProcessingPayments(true);
    try {
      const response = await fetch('/api/admin/auto-payment/trigger', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to trigger auto-payments');
      }

      const data = await response.json();

      toast.success('Auto-payment processing completed', {
        description: `Processed: ${data.summary.totalProcessed}, Successful: ${data.summary.successful}, Skipped: ${data.summary.skipped}, Failed: ${data.summary.failed}`,
      });

      // Show detailed results
      if (data.results && data.results.length > 0) {
        console.log('Auto-payment results:', data.results);
      }
    } catch (error) {
      console.error('Error triggering auto-payments:', error);
      toast.error('Failed to trigger auto-payments', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    } finally {
      setProcessingPayments(false);
    }
  };

  const handleTriggerConsolidated = async () => {
    try {
      setGeneratingConsolidated(true);
      const response = await fetch('/api/consolidated-bills/trigger', {
        method: 'POST',
      });
      const data = await response.json();

      if (response.ok) {
        toast.success(`Success! Generated ${data.data?.generatedCount || 0} consolidated bills.`);
        // Reload page to refresh stats since fetchStats isn't exported into this scope nicely
        window.location.reload();
      } else {
        toast.error(`Error: ${data.message || 'Failed to generate consolidated bills'}`);
      }
    } catch (error) {
      console.error('Trigger error:', error);
      toast.error('Failed to trigger consolidated bill generation');
    } finally {
      setGeneratingConsolidated(false);
    }
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Admin Dashboard</h2>
        <Badge variant="secondary" className="gap-1">
          <IconTrendingUp className="h-3 w-3" />
          System Overview
        </Badge>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="hover:shadow-md transition-all duration-300 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <IconUsers size={80} />
          </div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <IconUsers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <span className="animate-pulse bg-muted text-transparent rounded">0000</span> : stats?.totalUsers.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              All registered users
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-all duration-300 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <IconFileText size={80} />
          </div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bills</CardTitle>
            <IconFileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <span className="animate-pulse bg-muted text-transparent rounded">0000</span> : stats?.totalBills.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Bills across all users
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-all duration-300 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none text-red-500">
            <IconFileText size={80} />
          </div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Bills</CardTitle>
            <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? <span className="animate-pulse bg-muted text-transparent rounded">0000</span> : stats?.pendingBills.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1 text-red-600/80">
              Bills awaiting payment
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-all duration-300 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none text-green-500">
            <IconCreditCard size={80} />
          </div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <IconCreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-500">
              {loading ? <span className="animate-pulse bg-muted text-transparent rounded">0000</span> : formatCurrency(stats?.totalRevenue || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {loading ? <span className="animate-pulse bg-muted text-transparent rounded">0000</span> : `${stats?.totalProcessedPayments || 0} successful payments`}
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-all duration-300 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none text-purple-500">
            <IconFileText size={80} />
          </div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Consolidated Bills</CardTitle>
            <div className="h-4 w-4 text-muted-foreground">
              <IconFileText className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-500">
              {loading ? <span className="animate-pulse bg-muted text-transparent rounded">0000</span> : stats?.totalConsolidatedBills?.toLocaleString() || '0'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Currently generated bills
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mt-6">
        <Card className="hover:shadow-md transition-all duration-300 bg-primary/5 cursor-pointer border-primary/20" onClick={handleTriggerAutoPayments}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-primary">Trigger Auto-Payments</CardTitle>
            {processingPayments ? <IconLoader2 className="h-4 w-4 text-primary animate-spin" /> : <IconBolt className="h-4 w-4 text-primary" />}
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mt-2">Force trigger the background auto-payment worker for all pending cycles.</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-all duration-300 bg-purple-500/5 cursor-pointer border-purple-500/20" onClick={handleTriggerConsolidated}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-purple-600 dark:text-purple-400">Generate Consolidated</CardTitle>
            {generatingConsolidated ? <IconLoader2 className="h-4 w-4 text-purple-500 animate-spin" /> : <IconFileText className="h-4 w-4 text-purple-500" />}
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mt-2">Generate consolidated bills for all users for the current period.</p>
          </CardContent>
        </Card>

        <Link href="/admin/users" className="block">
          <Card className="hover:shadow-md transition-all duration-300 cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Manage Users</CardTitle>
              <IconUserPlus className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mt-2">View, edit, or delete users. Assign admin roles.</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/bills" className="block">
          <Card className="hover:shadow-md transition-all duration-300 cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Manage Bills</CardTitle>
              <IconFilePlus className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mt-2">Oversee all user bills, update statuses, or delete inappropriate entries.</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/transactions" className="block">
          <Card className="hover:shadow-md transition-all duration-300 cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">View Transactions</CardTitle>
              <IconCreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mt-2">Review full history of manual and automated payments.</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="mt-6">
        <Card className="hover:shadow-md transition-all duration-300">
          <CardHeader>
            <CardTitle>Recent Admin Activity</CardTitle>
            <CardDescription>
              Latest administrative actions performed in the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-start space-x-4 animate-pulse">
                    <div className="w-2 h-2 bg-muted rounded-full mt-2"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-3/4"></div>
                      <div className="h-3 bg-muted rounded w-1/4"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : stats?.recentActivity && stats.recentActivity.length > 0 ? (
              <div className="space-y-6">
                {stats.recentActivity.map((activity, index) => (
                  <div key={activity.id} className="relative pl-6 before:absolute before:left-[3px] before:top-2 before:bottom-[-20px] before:w-[2px] before:bg-muted last:before:hidden">
                    <div className="absolute left-[-2px] top-1 w-[12px] h-[12px] rounded-full border-2 border-white bg-primary"></div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium leading-none">{activity.description}</p>
                        <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                          <span className="bg-secondary px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider">{activity.entityType}</span>
                          • {activity.adminId ? `Admin ${activity.adminId.substring(0, 6)}` : 'System'}
                        </p>
                      </div>
                      <div className="text-xs font-mono text-muted-foreground whitespace-nowrap bg-muted/50 px-2 py-1 rounded">
                        {formatTimestamp(activity.timestamp)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-[200px] items-center justify-center text-muted-foreground border-2 border-dashed rounded-lg">
                No recent activity recorded
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}