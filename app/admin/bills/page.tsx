"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  IconSearch,
  IconPlus,
  IconChevronLeft,
  IconChevronRight,
  IconTrash,
  IconEdit,
  IconCalendar,
  IconDownload,
  IconCurrencyRupee,
  IconFileDescription,
  IconCheck,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { toast } from "sonner";

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

const BILL_TYPE_LABELS: Record<string, string> = {
  dth: "DTH",
  electricity: "Electricity",
  prepaid_mobile: "Prepaid Mobile",
};

interface Bill {
  _id: string;
  billId: string;
  billNumber: string;
  customerName: string;
  provider: string;
  billType: string;
  amount: number;
  dueDay: number;
  billingFrequency: 'monthly' | 'quarterly' | 'yearly' | 'one-time';
  createdAt: string;
  autoPaymentEnabled?: boolean;
  // Legacy fields
  userId?: string;
  dueDate?: string;
  monthlyRecords?: {
    id: string;
    month: string;
    amount: number;
    dueDate: string;
    status: string;
    createdAt: string;
  }[];
}

interface BillsResponse {
  bills: Bill[];
  total: number;
  page: number;
  totalPages: number;
}

export default function BillsManagementPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [userIdFilter, setUserIdFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [selectedBills, setSelectedBills] = useState<Set<string>>(new Set());
  const [isBulkOperating, setIsBulkOperating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);

  // Add monthly record form state
  const [newMonthRecord, setNewMonthRecord] = useState({
    month: "",
    amount: "",
    dueDate: "",
    description: "",
  });
  const [isAddingRecord, setIsAddingRecord] = useState(false);

  // Payment details dialog state
  const [selectedRecord, setSelectedRecord] = useState<{
    id: string;
    month: string;
    amount: number;
    dueDate: string;
    status: string;
    createdAt: string;
  } | null>(null);
  const [isPaymentDetailsOpen, setIsPaymentDetailsOpen] = useState(false);

  // Status change confirmation dialog state
  const [statusChangeDialog, setStatusChangeDialog] = useState<{
    open: boolean;
    recordId: string;
    currentStatus: string;
    newStatus: string;
  }>({
    open: false,
    recordId: "",
    currentStatus: "",
    newStatus: "",
  });

  // Create bill form state
  const [newBill, setNewBill] = useState({
    billNumber: "",
    customerName: "",
    provider: "",
    billType: "electricity" as string,
    amount: "",
    dueDay: "",
    billingFrequency: "monthly" as string,
  });

  // Bill type code mapping
  const BILL_TYPE_CODES: Record<string, string> = {
    electricity: 'ELEC',
    dth: 'DTH',
    prepaid_mobile: 'MOB',
  };

  // Provider code mapping (short codes)
  const PROVIDER_CODES: Record<string, string> = {
    'Tata Play': 'TPLAY',
    'Dish TV': 'DISH',
    'Airtel Digital TV': 'ADTV',
    'Sun Direct': 'SUND',
    'D2H': 'D2H',
    'BSES Rajdhani': 'BSESR',
    'BSES Yamuna': 'BSESY',
    'Tata Power': 'TPWR',
    'Adani Electricity': 'ADANI',
    'MSEDCL': 'MSEDCL',
    'UPPCL': 'UPPCL',
    'TNEB': 'TNEB',
    'Jio': 'JIO',
    'Airtel': 'AIRTL',
    'Vi': 'VI',
    'BSNL': 'BSNL',
  };

  // Frequency code mapping
  const FREQ_CODES: Record<string, string> = {
    monthly: 'MTH',
    quarterly: 'QTR',
    yearly: 'YRL',
    'one-time': 'OT',
  };

  // Auto-generate bill number from provider, bill type, and frequency
  const generateBillNumber = useCallback((billType: string, provider: string, frequency: string) => {
    const typeCode = BILL_TYPE_CODES[billType] || 'BILL';
    const providerCode = PROVIDER_CODES[provider] || provider.substring(0, 4).toUpperCase();
    const freqCode = FREQ_CODES[frequency] || 'OT';
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `${typeCode}-${providerCode}-${freqCode}-${random}`;
  }, []);

  // Auto-regenerate bill number when provider, billType, or frequency changes
  useEffect(() => {
    if (newBill.provider && newBill.billType && newBill.billingFrequency) {
      const generated = generateBillNumber(newBill.billType, newBill.provider, newBill.billingFrequency);
      setNewBill(prev => ({ ...prev, billNumber: generated }));
    }
  }, [newBill.provider, newBill.billType, newBill.billingFrequency, generateBillNumber]);

  // Get available providers based on selected bill type
  const getProviders = () => {
    return PROVIDERS[newBill.billType] || [];
  };

  // Fetch bills
  const fetchBills = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10"
      });

      if (endDate) {
        params.append("endDate", endDate);
      }

      const response = await fetch(`/api/admin/bills?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Failed to fetch bills");
      }

      const data: BillsResponse = await response.json();
      setBills(data.bills);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (error) {
      console.error("Error fetching bills:", error);
      toast.error("Failed to load bills");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, [page, userIdFilter, endDate]);

  // Handle create bill
  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const response = await fetch("/api/admin/bills", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...newBill,
          amount: parseFloat(newBill.amount) || 0,
          dueDay: parseInt(newBill.dueDay),
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create bill");
      }

      toast.success("Bill created successfully");
      setIsCreateDialogOpen(false);
      setNewBill({
        billNumber: "",
        customerName: "",
        provider: "",
        billType: "electricity",
        amount: "",
        dueDay: "",
        billingFrequency: "monthly",
      });
      fetchBills();
    } catch (error) {
      console.error("Error creating bill:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create bill");
    } finally {
      setIsCreating(false);
    }
  };

  // Handle checkbox selection
  const handleSelectBill = (billId: string, checked: boolean) => {
    const newSelected = new Set(selectedBills);
    if (checked) {
      newSelected.add(billId);
    } else {
      newSelected.delete(billId);
    }
    setSelectedBills(newSelected);
  };

  // Handle select all
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedBills(new Set(bills.map(b => b._id)));
    } else {
      setSelectedBills(new Set());
    }
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (selectedBills.size === 0) {
      toast.error("No bills selected");
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedBills.size} bills? This action cannot be undone.`)) {
      return;
    }

    setIsBulkOperating(true);
    try {
      const response = await fetch("/api/admin/bills/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          billIds: Array.from(selectedBills),
          action: "delete"
        })
      });

      if (!response.ok) {
        throw new Error("Failed to delete bills");
      }

      const result = await response.json();
      toast.success(`Deleted ${result.summary.successful} bills successfully`);

      if (result.summary.failed > 0) {
        toast.error(`Failed to delete ${result.summary.failed} bills`);
      }

      setSelectedBills(new Set());
      fetchBills();
    } catch (error) {
      console.error("Error deleting bills:", error);
      toast.error("Failed to delete bills");
    } finally {
      setIsBulkOperating(false);
    }
  };

  const handleDeleteBill = async (billId: string) => {
    if (!confirm("Are you sure you want to delete this bill? This action cannot be undone.")) return;

    try {
      const response = await fetch(`/api/admin/bills/${billId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete bill");

      toast.success("Bill deleted successfully");
      if (selectedBill?._id === billId || selectedBill?.billId === billId) {
        setSelectedBill(null);
      }
      fetchBills();
    } catch (error) {
      console.error("Error deleting bill:", error);
      toast.error("Failed to delete bill");
    }
  };

  const handleAddMonthRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBill) return;

    setIsAddingRecord(true);
    try {
      const response = await fetch(`/api/admin/bills/${selectedBill._id}/records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newMonthRecord)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add record");
      }

      toast.success("Monthly record added successfully");

      // Reset form
      setNewMonthRecord({
        month: "",
        amount: "",
        dueDate: "",
        description: "",
      });

      // Update local state by getting the returned bill from the response
      const result = await response.json();
      if (result.bill) {
        setSelectedBill(result.bill);
      }

      // Refetch bills list in background
      fetchBills();

    } catch (error) {
      console.error("Error adding monthly record:", error);
      toast.error(error instanceof Error ? error.message : "Failed to add record");
    } finally {
      setIsAddingRecord(false);
    }
  };

  const handleRemoveMonthRecord = async (recordId: string) => {
    if (!selectedBill || !confirm("Are you sure you want to delete this monthly record?")) return;

    try {
      const response = await fetch(`/api/admin/bills/${selectedBill._id}/records/${recordId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete record");
      }

      toast.success("Monthly record deleted successfully");

      const result = await response.json();
      if (result.bill) {
        setSelectedBill(result.bill);
      }

      fetchBills();
    } catch (error) {
      console.error("Error deleting monthly record:", error);
      toast.error("Failed to delete record");
    }
  };

  const handleUpdateRecordStatus = async (recordId: string, newStatus: string, currentStatus: string) => {
    // Open confirmation dialog
    setStatusChangeDialog({
      open: true,
      recordId,
      currentStatus,
      newStatus,
    });
  };

  const confirmStatusChange = async () => {
    if (!selectedBill) return;

    try {
      const response = await fetch(`/api/admin/bills/${selectedBill._id}/records/${statusChangeDialog.recordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: statusChangeDialog.newStatus })
      });

      if (!response.ok) {
        throw new Error("Failed to update status");
      }

      toast.success("Record status updated");
      const result = await response.json();
      if (result.bill) {
        setSelectedBill(result.bill);
      }
      fetchBills();
      setStatusChangeDialog({ open: false, recordId: "", currentStatus: "", newStatus: "" });
    } catch (error) {
      console.error("Error updating record status:", error);
      toast.error("Failed to update status");
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
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
      case 'paid':
        return 'default';
      case 'pending':
        return 'secondary';
      case 'overdue':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getBillTypeLabel = (type: string) => {
    return BILL_TYPE_LABELS[type] || type;
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

  // Handle export
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const filters: Record<string, string> = {};

      if (userIdFilter) {
        filters.userId = userIdFilter;
      }

      if (endDate) {
        filters.endDate = endDate;
      }

      const response = await fetch("/api/admin/export/bills", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ filters })
      });

      if (!response.ok) {
        throw new Error("Failed to export bills");
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `bills-export-${new Date().toISOString()}.csv`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Bills exported successfully");
    } catch (error) {
      console.error("Error exporting bills:", error);
      toast.error("Failed to export bills");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Bill Management</h2>
          <p className="text-muted-foreground">
            Manage bills across all users
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={isExporting || loading}
          >
            <IconDownload className="mr-2 h-4 w-4" />
            {isExporting ? "Exporting..." : "Export CSV"}
          </Button>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <IconPlus className="mr-2 h-4 w-4" />
                Create Bill
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[540px]">
              <form onSubmit={handleCreateBill}>
                <DialogHeader>
                  <DialogTitle>Create New Bill</DialogTitle>
                  <DialogDescription>
                    Add a new bill with provider, type, and billing schedule
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  {/* Customer Name */}
                  <div className="grid gap-2">
                    <Label htmlFor="customerName">Customer Name</Label>
                    <Input
                      id="customerName"
                      value={newBill.customerName}
                      onChange={(e) => setNewBill({ ...newBill, customerName: e.target.value })}
                      required
                      placeholder="Enter customer name"
                    />
                  </div>

                  {/* Bill Type & Provider */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="billType">Bill Type</Label>
                      <Select
                        value={newBill.billType}
                        onValueChange={(value) => setNewBill({ ...newBill, billType: value, provider: "" })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="electricity">Electricity</SelectItem>
                          <SelectItem value="dth">DTH</SelectItem>
                          <SelectItem value="prepaid_mobile">Prepaid Mobile</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="provider">Provider</Label>
                      <Select
                        value={newBill.provider}
                        onValueChange={(value) => setNewBill({ ...newBill, provider: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select provider" />
                        </SelectTrigger>
                        <SelectContent>
                          {getProviders().map((p) => (
                            <SelectItem key={p.value} value={p.value}>
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="grid gap-2">
                    <Label htmlFor="amount">Amount</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={newBill.amount}
                      onChange={(e) => setNewBill({ ...newBill, amount: e.target.value })}
                      required
                      placeholder="Enter amount"
                    />
                  </div>

                  {/* Billing Frequency */}
                  <div className="grid gap-2">
                    <Label htmlFor="billingFrequency">Billing Frequency</Label>
                    <Select
                      value={newBill.billingFrequency}
                      onValueChange={(value) => setNewBill({ ...newBill, billingFrequency: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                        <SelectItem value="one-time">One-time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Bill Number (Auto-generated) */}
                  <div className="grid gap-2">
                    <Label htmlFor="billNumber">Bill Number</Label>
                    <div className="flex gap-2">
                      <Input
                        id="billNumber"
                        value={newBill.billNumber}
                        readOnly
                        required
                        placeholder="Select type, provider & frequency to generate"
                        className="flex-1 bg-muted font-mono text-sm"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (newBill.provider && newBill.billType && newBill.billingFrequency) {
                            const generated = generateBillNumber(newBill.billType, newBill.provider, newBill.billingFrequency);
                            setNewBill({ ...newBill, billNumber: generated });
                          }
                        }}
                        disabled={!newBill.provider}
                      >
                        Regenerate
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Auto-generated from type, provider & frequency
                    </p>
                  </div>

                  {/* Due Day */}
                  <div className="grid gap-2">
                    <Label htmlFor="dueDay">Due Day (of month)</Label>
                    <Input
                      id="dueDay"
                      type="number"
                      min="1"
                      max="31"
                      value={newBill.dueDay}
                      onChange={(e) => setNewBill({ ...newBill, dueDay: e.target.value })}
                      required
                      placeholder="1-31"
                    />
                    <p className="text-xs text-muted-foreground">
                      Bill will be due on this day each cycle
                    </p>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                    disabled={isCreating}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isCreating}>
                    {isCreating ? "Creating..." : "Create Bill"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bills</CardTitle>
          <CardDescription>
            Filter and manage bills with bulk operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {/* Search filter */}
            <div className="md:col-span-2">
              <Label htmlFor="user-filter">Search</Label>
              <div className="relative">
                <IconSearch className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="user-filter"
                  placeholder="Filter by user ID..."
                  value={userIdFilter}
                  className="pl-8"
                  onChange={(e) => {
                    setUserIdFilter(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>

          {selectedBills.size > 0 && (
            <div className="flex items-center gap-2 mb-4 p-3 bg-muted rounded-lg">
              <span className="text-sm font-medium">
                {selectedBills.size} bill{selectedBills.size !== 1 ? 's' : ''} selected
              </span>
              <div className="flex gap-2 ml-auto">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={isBulkOperating}
                >
                  <IconTrash className="mr-2 h-4 w-4" />
                  Delete Selected
                </Button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading bills...
            </div>
          ) : bills.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No bills found
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={bills.length > 0 && selectedBills.size === bills.length}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Bill No.</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Due Day</TableHead>
                      <TableHead>Frequency</TableHead>
                      <TableHead>Auto-Pay</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bills.map((bill) => (
                      <TableRow
                        key={bill._id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedBill(bill)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedBills.has(bill._id)}
                            onCheckedChange={(checked) =>
                              handleSelectBill(bill._id, checked as boolean)
                            }
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs font-medium">{bill.billNumber || '-'}</TableCell>
                        <TableCell className="font-medium">{bill.customerName || '-'}</TableCell>
                        <TableCell>{bill.provider}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {getBillTypeLabel(bill.billType)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {bill.amount != null ? formatCurrency(bill.amount) : '-'}
                        </TableCell>
                        <TableCell>
                          {bill.dueDay ? (
                            <span>{bill.dueDay}{getOrdinalSuffix(bill.dueDay)}</span>
                          ) : bill.dueDate ? (
                            formatDate(bill.dueDate)
                          ) : '-'}
                        </TableCell>
                        <TableCell className="capitalize">{bill.billingFrequency || 'one-time'}</TableCell>
                        <TableCell>
                          {bill.autoPaymentEnabled ? (
                            <Badge variant="default" className="bg-green-500 hover:bg-green-600">Enabled</Badge>
                          ) : (
                            <Badge variant="outline">Disabled</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {bills.length} of {total} bills
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                  >
                    <IconChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>

                  <div className="text-sm">
                    Page {page} of {totalPages}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={page === totalPages}
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

      {/* Admin Bill Details Dialog */}
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
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Customer</span>
                  <p className="font-medium">{selectedBill.customerName || '-'}</p>
                </div>

                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Provider</span>
                  <p className="font-medium">{selectedBill.provider || '-'}</p>
                </div>

                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Bill Type</span>
                  <div>
                    <Badge variant="outline">
                      {getBillTypeLabel(selectedBill.billType)}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Frequency</span>
                  <p className="font-medium capitalize">{selectedBill.billingFrequency}</p>
                </div>

                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Due Cycle</span>
                  <p className="font-medium">
                    {selectedBill.dueDay
                      ? `${selectedBill.dueDay}${getOrdinalSuffix(selectedBill.dueDay)} of month`
                      : selectedBill.dueDate
                        ? formatDate(selectedBill.dueDate)
                        : 'N/A'
                    }
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Created At</span>
                  <p className="font-medium">
                    {selectedBill.createdAt ? formatDate(selectedBill.createdAt) : 'N/A'}
                  </p>
                </div>

                {selectedBill.userId && (
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Owner ID</span>
                    <p className="font-mono text-sm">{selectedBill.userId}</p>
                  </div>
                )}
                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Auto Payment</span>
                  <div>
                    {selectedBill.autoPaymentEnabled ? (
                      <Badge variant="default" className="bg-green-500">Enabled</Badge>
                    ) : (
                      <Badge variant="outline">Disabled</Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-8 border-t pt-6">
                <h3 className="text-lg font-medium mb-4">Monthly Records</h3>

                {selectedBill.monthlyRecords && selectedBill.monthlyRecords.length > 0 ? (
                  <div className="space-y-3 mb-6">
                    {selectedBill.monthlyRecords.map((record, idx) => (
                      <div key={record.id || idx} className="flex items-center justify-between p-3 border rounded hover:bg-muted/50 transition-colors">
                        <div className="flex-1">
                          <div className="font-medium">{record.month}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                            <span>Due: {formatDate(record.dueDate)}</span>
                            <span>|</span>
                            <div className="flex items-center gap-2">
                              <span>Status:</span>
                              <Select
                                value={record.status}
                                onValueChange={(val) => handleUpdateRecordStatus(record.id, val, record.status)}
                              >
                                <SelectTrigger className="h-6 w-[100px] text-xs px-2 border-0 shadow-none bg-muted/50 rounded-sm focus:ring-0">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">Pending</SelectItem>
                                  <SelectItem value="paid">Paid</SelectItem>
                                  <SelectItem value="overdue">Overdue</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="font-semibold">{formatCurrency(record.amount)}</div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedRecord(record);
                              setIsPaymentDetailsOpen(true);
                            }}
                            title="View Payment Details"
                          >
                            <IconFileDescription className="h-4 w-4 mr-1" />
                            Details
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => handleRemoveMonthRecord(record.id)}
                            title="Remove Record"
                          >
                            <IconTrash className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground mb-6">No monthly records found.</div>
                )}

                <div className="bg-muted/50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium mb-3">Add Monthly Record</h4>
                  <form onSubmit={handleAddMonthRecord} className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="month" className="text-xs">Month (e.g. Jan 2024)</Label>
                      <Input
                        id="month"
                        value={newMonthRecord.month}
                        onChange={(e) => setNewMonthRecord({ ...newMonthRecord, month: e.target.value })}
                        required
                        className="h-8 text-sm"
                        placeholder="e.g. 2024-01"
                        type="month"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="record-amount" className="text-xs">Amount</Label>
                      <Input
                        id="record-amount"
                        type="number"
                        min="0"
                        step="0.01"
                        value={newMonthRecord.amount}
                        onChange={(e) => setNewMonthRecord({ ...newMonthRecord, amount: e.target.value })}
                        required
                        className="h-8 text-sm"
                        placeholder="0.00"
                      />
                    </div>
                    <Button type="submit" size="sm" className="w-full sm:col-span-2 mt-2" disabled={isAddingRecord}>
                      {isAddingRecord ? "Adding..." : "Add Record"}
                    </Button>
                  </form>
                </div>
              </div>

              <DialogFooter className="mt-6 pt-4 border-t sm:justify-between">
                <Button variant="destructive" onClick={() => handleDeleteBill(selectedBill._id)}>
                  <IconTrash className="mr-2 h-4 w-4" />
                  Delete Bill
                </Button>
                <Button variant="outline" onClick={() => setSelectedBill(null)}>
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Details Dialog */}
      <Dialog open={isPaymentDetailsOpen} onOpenChange={setIsPaymentDetailsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Payment Details</DialogTitle>
            <DialogDescription>
              Detailed information for this bill record
            </DialogDescription>
          </DialogHeader>

          {selectedRecord && (
            <div className="space-y-4 pt-2">
              <div className="grid gap-4">
                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Billing Period</span>
                  <p className="font-semibold text-lg">{selectedRecord.month}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Amount</span>
                    <p className="font-semibold text-xl text-primary">{formatCurrency(selectedRecord.amount)}</p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</span>
                    <div>
                      <Badge variant={getStatusBadgeVariant(selectedRecord.status)}>
                        {selectedRecord.status.charAt(0).toUpperCase() + selectedRecord.status.slice(1)}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Due Date</span>
                  <p className="font-medium flex items-center gap-2">
                    <IconCalendar className="h-4 w-4 text-muted-foreground" />
                    {formatDate(selectedRecord.dueDate)}
                  </p>
                </div>

                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Record Created</span>
                  <p className="font-medium text-sm text-muted-foreground">
                    {formatDate(selectedRecord.createdAt)}
                  </p>
                </div>
              </div>

              {selectedBill && (
                <div className="pt-4 border-t space-y-3">
                  <h4 className="text-sm font-semibold">Bill Information</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Provider:</span>
                      <p className="font-medium">{selectedBill.provider}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Customer:</span>
                      <p className="font-medium">{selectedBill.customerName || '-'}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Bill Type:</span>
                      <p className="font-medium capitalize">{getBillTypeLabel(selectedBill.billType)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Bill Number:</span>
                      <p className="font-mono text-xs">{selectedBill.billNumber || '-'}</p>
                    </div>
                  </div>
                </div>
              )}

              <DialogFooter className="pt-4">
                <Button variant="outline" onClick={() => setIsPaymentDetailsOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Status Change Confirmation Dialog */}
      <Dialog open={statusChangeDialog.open} onOpenChange={(open) => !open && setStatusChangeDialog({ open: false, recordId: "", currentStatus: "", newStatus: "" })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Status Change</DialogTitle>
            <DialogDescription>
              Are you sure you want to change the payment status?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Current Status</span>
                <div>
                  <Badge variant={getStatusBadgeVariant(statusChangeDialog.currentStatus)}>
                    {statusChangeDialog.currentStatus.charAt(0).toUpperCase() + statusChangeDialog.currentStatus.slice(1)}
                  </Badge>
                </div>
              </div>
              <IconChevronRight className="h-5 w-5 text-muted-foreground" />
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">New Status</span>
                <div>
                  <Badge variant={getStatusBadgeVariant(statusChangeDialog.newStatus)}>
                    {statusChangeDialog.newStatus.charAt(0).toUpperCase() + statusChangeDialog.newStatus.slice(1)}
                  </Badge>
                </div>
              </div>
            </div>

            {statusChangeDialog.newStatus === 'paid' && statusChangeDialog.currentStatus !== 'paid' && (
              <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <IconCheck className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                <div className="text-sm text-green-800 dark:text-green-300">
                  <p className="font-medium">Marking as Paid</p>
                  <p className="text-xs mt-1">This will update the record to show payment has been received.</p>
                </div>
              </div>
            )}

            {statusChangeDialog.newStatus === 'overdue' && (
              <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <IconAlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                <div className="text-sm text-red-800 dark:text-red-300">
                  <p className="font-medium">Marking as Overdue</p>
                  <p className="text-xs mt-1">This indicates the payment is past the due date.</p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setStatusChangeDialog({ open: false, recordId: "", currentStatus: "", newStatus: "" })}
            >
              Cancel
            </Button>
            <Button onClick={confirmStatusChange}>
              Confirm Change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
