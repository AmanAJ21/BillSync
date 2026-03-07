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
  IconFilter,
  IconEye,
  IconAlertCircle,
  IconCircleCheck,
  IconClock
} from "@tabler/icons-react";
import { toast } from "sonner";

interface AuditLog {
  _id: string;
  userId: string;
  adminId?: string;
  operation: string;
  operationType: string;
  entityType: string;
  entityId?: string;
  targetUserId?: string;
  details: Record<string, any>;
  beforeState?: Record<string, any>;
  afterState?: Record<string, any>;
  status: 'success' | 'failure' | 'pending';
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

interface AuditLogsResponse {
  logs: AuditLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [loading, setLoading] = useState(true);

  // Filter state
  const [adminId, setAdminId] = useState("");
  const [operationType, setOperationType] = useState("all");
  const [targetUserId, setTargetUserId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Detail dialog state
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  // Fetch audit logs
  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      });

      if (adminId) {
        params.append("adminId", adminId);
      }

      if (operationType !== "all") {
        params.append("operationType", operationType);
      }

      if (targetUserId) {
        params.append("targetUserId", targetUserId);
      }

      if (startDate) {
        params.append("startDate", new Date(startDate).toISOString());
      }

      if (endDate) {
        params.append("endDate", new Date(endDate).toISOString());
      }

      const response = await fetch(`/api/admin/audit-logs?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Failed to fetch audit logs");
      }

      const data: AuditLogsResponse = await response.json();
      setLogs(data.logs);
      setPagination(data.pagination);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      toast.error("Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [pagination.page]);

  // Handle filter apply
  const handleApplyFilters = () => {
    setPagination({ ...pagination, page: 1 }); // Reset to first page
    fetchLogs();
  };

  // Handle clear filters
  const handleClearFilters = () => {
    setAdminId("");
    setOperationType("all");
    setTargetUserId("");
    setStartDate("");
    setEndDate("");
    setPagination({ ...pagination, page: 1 });
  };

  // Handle view details
  const handleViewDetails = (log: AuditLog) => {
    setSelectedLog(log);
    setIsDetailDialogOpen(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <IconCircleCheck className="h-4 w-4 text-green-500" />;
      case 'failure':
        return <IconAlertCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <IconClock className="h-4 w-4 text-yellow-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const variant = status === 'success' ? 'default' : status === 'failure' ? 'destructive' : 'secondary';
    return (
      <Badge variant={variant} className="gap-1">
        {getStatusIcon(status)}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const formatOperationType = (type: string) => {
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Audit Logs</h2>
          <p className="text-muted-foreground">
            View and filter administrative activity logs
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Filter audit logs by date range, admin, operation type, or target user
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="adminId">Admin User ID</Label>
              <Input
                id="adminId"
                placeholder="Enter admin user ID..."
                value={adminId}
                onChange={(e) => setAdminId(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="operationType">Operation Type</Label>
              <Select value={operationType} onValueChange={setOperationType}>
                <SelectTrigger id="operationType">
                  <SelectValue placeholder="Select operation type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Operations</SelectItem>
                  <SelectItem value="bill_create">Bill Create</SelectItem>
                  <SelectItem value="bill_update">Bill Update</SelectItem>
                  <SelectItem value="bill_delete">Bill Delete</SelectItem>
                  <SelectItem value="bill_bulk_update">Bill Bulk Update</SelectItem>
                  <SelectItem value="bill_bulk_delete">Bill Bulk Delete</SelectItem>
                  <SelectItem value="user_role_change">User Role Change</SelectItem>
                  <SelectItem value="user_create">User Create</SelectItem>
                  <SelectItem value="config_update">Config Update</SelectItem>
                  <SelectItem value="data_export">Data Export</SelectItem>
                  <SelectItem value="auto_payment_enable">Auto Payment Enable</SelectItem>
                  <SelectItem value="auto_payment_disable">Auto Payment Disable</SelectItem>
                  <SelectItem value="payment_attempt">Payment Attempt</SelectItem>
                  <SelectItem value="payment_success">Payment Success</SelectItem>
                  <SelectItem value="payment_failure">Payment Failure</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="targetUserId">Target User ID</Label>
              <Input
                id="targetUserId"
                placeholder="Enter target user ID..."
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button onClick={handleApplyFilters}>
              <IconFilter className="mr-2 h-4 w-4" />
              Apply Filters
            </Button>
            <Button variant="outline" onClick={handleClearFilters}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit Log Entries</CardTitle>
          <CardDescription>
            Showing {logs.length} of {pagination.total} log entries
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading audit logs...
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No audit logs found
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Operation</TableHead>
                      <TableHead>Admin ID</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log._id}>
                        <TableCell className="font-mono text-xs">
                          {formatDate(log.timestamp)}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {formatOperationType(log.operationType)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {log.entityType}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {log.adminId || log.userId}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {log.entityId ? (
                            <span>{log.entityId.substring(0, 8)}...</span>
                          ) : (
                            <span className="text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(log.status)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewDetails(log)}
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
                  Page {pagination.page} of {pagination.totalPages}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                    disabled={!pagination.hasPrevPage}
                  >
                    <IconChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
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

      {/* Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Audit Log Details</DialogTitle>
            <DialogDescription>
              Detailed information about this audit log entry
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Timestamp</Label>
                  <div className="font-mono text-sm">{formatDate(selectedLog.timestamp)}</div>
                </div>

                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedLog.status)}</div>
                </div>

                <div>
                  <Label className="text-muted-foreground">Operation Type</Label>
                  <div className="font-medium">{formatOperationType(selectedLog.operationType)}</div>
                </div>

                <div>
                  <Label className="text-muted-foreground">Entity Type</Label>
                  <div className="font-medium">{selectedLog.entityType}</div>
                </div>

                <div>
                  <Label className="text-muted-foreground">User ID</Label>
                  <div className="font-mono text-sm">{selectedLog.userId}</div>
                </div>

                {selectedLog.adminId && (
                  <div>
                    <Label className="text-muted-foreground">Admin ID</Label>
                    <div className="font-mono text-sm">{selectedLog.adminId}</div>
                  </div>
                )}

                {selectedLog.entityId && (
                  <div>
                    <Label className="text-muted-foreground">Entity ID</Label>
                    <div className="font-mono text-sm">{selectedLog.entityId}</div>
                  </div>
                )}

                {selectedLog.targetUserId && (
                  <div>
                    <Label className="text-muted-foreground">Target User ID</Label>
                    <div className="font-mono text-sm">{selectedLog.targetUserId}</div>
                  </div>
                )}

                {selectedLog.ipAddress && (
                  <div>
                    <Label className="text-muted-foreground">IP Address</Label>
                    <div className="font-mono text-sm">{selectedLog.ipAddress}</div>
                  </div>
                )}
              </div>

              <div>
                <Label className="text-muted-foreground">Operation</Label>
                <div className="font-mono text-sm mt-1 p-2 bg-muted rounded">
                  {selectedLog.operation}
                </div>
              </div>

              {selectedLog.errorMessage && (
                <div>
                  <Label className="text-muted-foreground">Error Message</Label>
                  <div className="text-sm mt-1 p-2 bg-destructive/10 text-destructive rounded">
                    {selectedLog.errorMessage}
                  </div>
                </div>
              )}

              {selectedLog.userAgent && (
                <div>
                  <Label className="text-muted-foreground">User Agent</Label>
                  <div className="text-xs mt-1 p-2 bg-muted rounded break-all">
                    {selectedLog.userAgent}
                  </div>
                </div>
              )}

              <div>
                <Label className="text-muted-foreground">Details</Label>
                <pre className="text-xs mt-1 p-2 bg-muted rounded overflow-x-auto">
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>

              {selectedLog.beforeState && (
                <div>
                  <Label className="text-muted-foreground">Before State</Label>
                  <pre className="text-xs mt-1 p-2 bg-muted rounded overflow-x-auto">
                    {JSON.stringify(selectedLog.beforeState, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.afterState && (
                <div>
                  <Label className="text-muted-foreground">After State</Label>
                  <pre className="text-xs mt-1 p-2 bg-muted rounded overflow-x-auto">
                    {JSON.stringify(selectedLog.afterState, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
