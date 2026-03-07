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
  totalRevenue: number;
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <IconUsers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? 'Loading...' : stats?.totalUsers.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              All registered users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bills</CardTitle>
            <IconFileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? 'Loading...' : stats?.totalBills.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Bills across all users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Bills</CardTitle>
            <IconFileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? 'Loading...' : stats?.pendingBills.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Bills awaiting payment
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <IconCreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? 'Loading...' : formatCurrency(stats?.totalRevenue || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Total processed payments
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Admin Activity</CardTitle>
            <CardDescription>
              Latest administrative actions performed in the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading activity...</div>
            ) : stats?.recentActivity && stats.recentActivity.length > 0 ? (
              <div className="space-y-4">
                {stats.recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-4">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium">{activity.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatTimestamp(activity.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No recent activity</div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common administrative tasks
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 ">
            <Button 
              variant="default" 
              className="w-full justify-start mb-2" 
              size="sm"
              onClick={handleTriggerAutoPayments}
              disabled={processingPayments}
            >
              {processingPayments ? (
                <>
                  <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <IconBolt className="mr-2 h-4 w-4" />
                  Trigger Auto-Payments
                </>
              )}
            </Button>
            <Link href="/admin/users" >
              <Button variant="outline" className="w-full justify-start mb-2" size="sm">
                <IconUserPlus className="mr-2 h-4 w-4" />
                Manage Users
              </Button>
            </Link>
            <Link href="/admin/bills" >
              <Button variant="outline" className="w-full justify-start mb-2" size="sm">
                <IconFilePlus className="mr-2 h-4 w-4" />
                Manage Bills
              </Button>
            </Link>
            <Link href="/admin/transactions">
              <Button variant="outline" className="w-full justify-start mb-2" size="sm">
                <IconCreditCard className="mr-2 h-4 w-4" />
                View Transactions
              </Button>
            </Link>
            <Link href="/admin/config">
              <Button variant="outline" className="w-full justify-start mb-2" size="sm">
                <IconSettings className="mr-2 h-4 w-4" />
                System Settings
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}