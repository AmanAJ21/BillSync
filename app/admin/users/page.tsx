"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  IconUserPlus,
  IconChevronLeft,
  IconChevronRight,
  IconUser,
  IconShield,
  IconDownload,
  IconAlertCircle,
  IconCheck,
  IconX,
  IconAlertTriangle,
} from "@tabler/icons-react";
import { toast } from "sonner";

interface User {
  _id: string;
  email: string;
  name: string;
  role: 'regular' | 'admin';
  createdAt: string;
}

interface UsersResponse {
  users: User[];
  total: number;
  page: number;
  totalPages: number;
}

// ── Client-side validation helpers ──

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

function validateEmail(email: string): ValidationResult {
  const errors: string[] = [];
  if (!email) {
    errors.push('Email is required');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Invalid email format');
  }
  return { valid: errors.length === 0, errors };
}

function validatePassword(password: string): ValidationResult {
  const errors: string[] = [];
  if (!password) {
    errors.push('Password is required');
    return { valid: false, errors };
  }
  if (password.length < 8) errors.push('At least 8 characters');
  if (!/[A-Z]/.test(password)) errors.push('At least one uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('At least one lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('At least one number');
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) errors.push('At least one special character');
  return { valid: errors.length === 0, errors };
}

function validateName(name: string): ValidationResult {
  const errors: string[] = [];
  if (!name) {
    errors.push('Name is required');
  } else if (name.length < 2) {
    errors.push('Name must be at least 2 characters');
  } else if (name.length > 100) {
    errors.push('Name must not exceed 100 characters');
  }
  return { valid: errors.length === 0, errors };
}

// ── Password requirement indicator component ──
function PasswordRequirement({ met, label }: { met: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs ${met ? 'text-green-600' : 'text-muted-foreground'}`}>
      {met ? (
        <IconCheck className="h-3 w-3 text-green-600" />
      ) : (
        <IconX className="h-3 w-3 text-muted-foreground" />
      )}
      {label}
    </div>
  );
}

export default function UsersManagementPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Role change confirmation state
  const [roleChangeDialog, setRoleChangeDialog] = useState<{
    open: boolean;
    userId: string;
    userName: string;
    currentRole: 'regular' | 'admin';
    newRole: 'regular' | 'admin';
  }>({ open: false, userId: '', userName: '', currentRole: 'regular', newRole: 'regular' });
  const [isChangingRole, setIsChangingRole] = useState(false);

  // Create user form state
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    name: "",
    role: "regular" as 'regular' | 'admin'
  });

  // Field validation state (tracks which fields have been touched)
  const [touched, setTouched] = useState({
    email: false,
    password: false,
    name: false,
  });

  // Computed validation
  const emailValidation = validateEmail(newUser.email);
  const passwordValidation = validatePassword(newUser.password);
  const nameValidation = validateName(newUser.name);
  const isFormValid = emailValidation.valid && passwordValidation.valid && nameValidation.valid;

  // Password requirement indicators
  const passwordChecks = {
    length: newUser.password.length >= 8,
    uppercase: /[A-Z]/.test(newUser.password),
    lowercase: /[a-z]/.test(newUser.password),
    number: /[0-9]/.test(newUser.password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(newUser.password),
  };

  // Reset form state when dialog opens/closes
  useEffect(() => {
    if (!isCreateDialogOpen) {
      setNewUser({ email: "", password: "", name: "", role: "regular" });
      setTouched({ email: false, password: false, name: false });
    }
  }, [isCreateDialogOpen]);

  // Fetch users
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10"
      });

      if (searchQuery) {
        params.append("search", searchQuery);
      }

      if (roleFilter !== "all") {
        params.append("role", roleFilter);
      }

      const response = await fetch(`/api/admin/users?${params.toString()}`);

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to fetch users");
      }

      const data: UsersResponse = await response.json();
      setUsers(data.users);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error(error instanceof Error ? error.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, searchQuery, roleFilter]);

  // Handle search
  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setPage(1); // Reset to first page on search
  };

  // Handle role filter
  const handleRoleFilter = (value: string) => {
    setRoleFilter(value);
    setPage(1); // Reset to first page on filter
  };

  // Handle create user
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    // Mark all fields as touched on submit
    setTouched({ email: true, password: true, name: true });

    // Validate all fields
    if (!isFormValid) {
      toast.error("Please fix the validation errors before submitting");
      return;
    }

    setIsCreating(true);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(newUser)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create user");
      }

      // Show success with email status
      const emailMsg = data.notifications?.userNotified
        ? " Welcome email sent."
        : "";
      toast.success(`User created successfully.${emailMsg}`);

      setIsCreateDialogOpen(false);
      fetchUsers(); // Refresh the list
    } catch (error) {
      console.error("Error creating user:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create user");
    } finally {
      setIsCreating(false);
    }
  };

  // Open role change confirmation dialog
  const openRoleChangeDialog = (user: User, newRole: 'regular' | 'admin') => {
    if (newRole === user.role) return; // No change
    setRoleChangeDialog({
      open: true,
      userId: user._id,
      userName: user.name,
      currentRole: user.role,
      newRole,
    });
  };

  // Confirm and execute role change
  const confirmRoleChange = async () => {
    setIsChangingRole(true);
    try {
      const response = await fetch(`/api/admin/users/${roleChangeDialog.userId}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ role: roleChangeDialog.newRole })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update user role");
      }

      const emailMsg = roleChangeDialog.newRole === 'admin' && data.notifications?.emailSent
        ? " Notification email sent."
        : "";
      toast.success(`User role updated successfully.${emailMsg}`);
      setRoleChangeDialog({ ...roleChangeDialog, open: false });
      fetchUsers(); // Refresh the list
    } catch (error) {
      console.error("Error updating user role:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update user role");
    } finally {
      setIsChangingRole(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Handle export
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const filters: Record<string, string> = {};

      if (roleFilter !== "all") {
        filters.role = roleFilter;
      }

      if (searchQuery) {
        filters.search = searchQuery;
      }

      const response = await fetch("/api/admin/export/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ filters })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to export users");
      }

      // Get the CSV data as blob
      const blob = await response.blob();

      // Extract filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `users-export-${new Date().toISOString()}.csv`;

      // Create download link and trigger download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Users exported successfully");
    } catch (error) {
      console.error("Error exporting users:", error);
      toast.error(error instanceof Error ? error.message : "Failed to export users");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">User Management</h2>
          <p className="text-muted-foreground">
            Manage user accounts and roles
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
                <IconUserPlus className="mr-2 h-4 w-4" />
                Create User
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
              <form onSubmit={handleCreateUser}>
                <DialogHeader>
                  <DialogTitle>Create New User</DialogTitle>
                  <DialogDescription>
                    Add a new user account to the system. A welcome email will be sent automatically.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  {/* Name field */}
                  <div className="grid gap-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={newUser.name}
                      onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                      onBlur={() => setTouched({ ...touched, name: true })}
                      className={touched.name && !nameValidation.valid ? "border-red-500" : ""}
                      placeholder="Enter full name"
                      required
                    />
                    {touched.name && !nameValidation.valid && (
                      <p className="text-xs text-red-500 flex items-center gap-1">
                        <IconAlertCircle className="h-3 w-3" />
                        {nameValidation.errors[0]}
                      </p>
                    )}
                  </div>

                  {/* Email field */}
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      onBlur={() => setTouched({ ...touched, email: true })}
                      className={touched.email && !emailValidation.valid ? "border-red-500" : ""}
                      placeholder="user@example.com"
                      required
                    />
                    {touched.email && !emailValidation.valid && (
                      <p className="text-xs text-red-500 flex items-center gap-1">
                        <IconAlertCircle className="h-3 w-3" />
                        {emailValidation.errors[0]}
                      </p>
                    )}
                  </div>

                  {/* Password field with live requirements */}
                  <div className="grid gap-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      onBlur={() => setTouched({ ...touched, password: true })}
                      className={touched.password && !passwordValidation.valid ? "border-red-500" : ""}
                      placeholder="Enter a strong password"
                      required
                    />
                    {/* Live password requirements checklist */}
                    {(touched.password || newUser.password.length > 0) && (
                      <div className="grid grid-cols-2 gap-1 mt-1">
                        <PasswordRequirement met={passwordChecks.length} label="8+ characters" />
                        <PasswordRequirement met={passwordChecks.uppercase} label="Uppercase letter" />
                        <PasswordRequirement met={passwordChecks.lowercase} label="Lowercase letter" />
                        <PasswordRequirement met={passwordChecks.number} label="Number" />
                        <PasswordRequirement met={passwordChecks.special} label="Special character" />
                      </div>
                    )}
                  </div>

                  {/* Role selector */}
                  <div className="grid gap-2">
                    <Label htmlFor="role">Role</Label>
                    <Select
                      value={newUser.role}
                      onValueChange={(value: 'regular' | 'admin') =>
                        setNewUser({ ...newUser, role: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="regular">Regular User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    {newUser.role === 'admin' && (
                      <p className="text-xs text-amber-600 flex items-center gap-1">
                        <IconAlertCircle className="h-3 w-3" />
                        Admin users will have full system access. A security notification will be sent to existing admins.
                      </p>
                    )}
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
                  <Button type="submit" disabled={isCreating || !isFormValid}>
                    {isCreating ? "Creating..." : "Create User"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            Search and filter users, change roles, and view details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <IconSearch className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="w-full md:w-48">
              <Select value={roleFilter} onValueChange={handleRoleFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="regular">Regular Users</SelectItem>
                  <SelectItem value="admin">Admins</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading users...
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No users found
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user._id}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge
                            variant={user.role === 'admin' ? 'default' : 'secondary'}
                            className="gap-1"
                          >
                            {user.role === 'admin' ? (
                              <IconShield className="h-3 w-3" />
                            ) : (
                              <IconUser className="h-3 w-3" />
                            )}
                            {user.role === 'admin' ? 'Admin' : 'Regular'}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(user.createdAt)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Select
                              value={user.role}
                              onValueChange={(value: 'regular' | 'admin') =>
                                openRoleChangeDialog(user, value)
                              }
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="regular">Regular</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>

                            <Link href={`/admin/users/${user._id}`}>
                              <Button variant="outline" size="sm">
                                View Details
                              </Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {users.length} of {total} users
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
      {/* Role Change Confirmation Dialog */}
      <Dialog
        open={roleChangeDialog.open}
        onOpenChange={(open) => setRoleChangeDialog({ ...roleChangeDialog, open })}
      >
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconAlertTriangle className="h-5 w-5 text-amber-500" />
              Confirm Role Change
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to change this user&apos;s role?
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <div className="rounded-md border p-4 space-y-2">
              <p className="text-sm">
                <strong>User:</strong> {roleChangeDialog.userName}
              </p>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Role:</span>
                <Badge variant={roleChangeDialog.currentRole === 'admin' ? 'default' : 'secondary'} className="gap-1">
                  {roleChangeDialog.currentRole === 'admin' ? (
                    <IconShield className="h-3 w-3" />
                  ) : (
                    <IconUser className="h-3 w-3" />
                  )}
                  {roleChangeDialog.currentRole === 'admin' ? 'Admin' : 'Regular'}
                </Badge>
                <span className="text-muted-foreground">→</span>
                <Badge variant={roleChangeDialog.newRole === 'admin' ? 'default' : 'secondary'} className="gap-1">
                  {roleChangeDialog.newRole === 'admin' ? (
                    <IconShield className="h-3 w-3" />
                  ) : (
                    <IconUser className="h-3 w-3" />
                  )}
                  {roleChangeDialog.newRole === 'admin' ? 'Admin' : 'Regular'}
                </Badge>
              </div>
            </div>

            {roleChangeDialog.newRole === 'admin' && (
              <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3">
                <p className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                  <IconAlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  Promoting to Admin will grant full system access including user management, billing, and system configuration.
                </p>
              </div>
            )}

            {roleChangeDialog.currentRole === 'admin' && roleChangeDialog.newRole === 'regular' && (
              <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3">
                <p className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                  <IconAlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  Demoting from Admin will revoke all administrative privileges. This user will no longer be able to access the admin panel.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRoleChangeDialog({ ...roleChangeDialog, open: false })}
              disabled={isChangingRole}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmRoleChange}
              disabled={isChangingRole}
            >
              {isChangingRole ? "Updating..." : "Confirm Change"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
