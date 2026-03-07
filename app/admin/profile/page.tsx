"use client";

import { useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ChangePasswordDialog } from '@/components/change-password-dialog';
import { ResetPasswordDialog } from '@/components/reset-password-dialog';
import { EditProfileDialog } from '@/components/edit-profile-dialog';
import { Key, Mail, Shield, Edit, User } from 'lucide-react';

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [showChangePasswordDialog, setShowChangePasswordDialog] = useState(false);
  const [showResetPasswordDialog, setShowResetPasswordDialog] = useState(false);
  const [showEditProfileDialog, setShowEditProfileDialog] = useState(false);

  const handleProfileUpdate = (updatedUser: { name: string; email: string }) => {
    updateUser(updatedUser);
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Loading...</h2>
          <p className="text-muted-foreground">Please wait while we load your profile.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Profile</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account settings and preferences
        </p>
      </div>

      <div className="grid gap-6">
        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile Information
            </CardTitle>
            <CardDescription>
              Your basic account information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={user.name}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={user.email}
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>
            <div className="flex justify-between items-center pt-2">
              <p className="text-sm text-muted-foreground">
                Keep your profile information up to date.
              </p>
              <Button 
                onClick={() => setShowEditProfileDialog(true)}
                className="flex items-center gap-2"
              >
                <Edit className="h-4 w-4" />
                Edit Profile
              </Button>
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Password Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Password & Security
            </CardTitle>
            <CardDescription>
              Manage your password and account security settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Change Password Section */}
            <div className="flex items-start justify-between p-4 border rounded-lg">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <Key className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                </div>
                <div>
                  <h3 className="font-medium">Change Password</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Update your password to keep your account secure. You'll need to enter your current password.
                  </p>
                </div>
              </div>
              <Button 
                onClick={() => setShowChangePasswordDialog(true)}
                className="ml-4 flex-shrink-0"
              >
                Change Password
              </Button>
            </div>

            {/* Reset Password Section */}
            <div className="flex items-start justify-between p-4 border rounded-lg">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <Mail className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5" />
                </div>
                <div>
                  <h3 className="font-medium">Reset Password via Email</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Forgot your current password? We'll send a new temporary password to your email address.
                  </p>
                </div>
              </div>
              <Button 
                onClick={() => setShowResetPasswordDialog(true)}
                variant="outline"
                className="ml-4 flex-shrink-0"
              >
                Reset Password
              </Button>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    Security Tips
                  </h3>
                  <ul className="mt-1 text-sm text-blue-700 dark:text-blue-300 space-y-1">
                    <li>• Use a strong password with at least 6 characters</li>
                    <li>• Include a mix of letters, numbers, and symbols</li>
                    <li>• Don't reuse passwords from other accounts</li>
                    <li>• Change your password regularly for better security</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      <EditProfileDialog 
        open={showEditProfileDialog}
        onOpenChange={setShowEditProfileDialog}
        user={user}
        onProfileUpdate={handleProfileUpdate}
      />
      
      <ChangePasswordDialog 
        open={showChangePasswordDialog}
        onOpenChange={setShowChangePasswordDialog}
      />
      
      <ResetPasswordDialog 
        open={showResetPasswordDialog}
        onOpenChange={setShowResetPasswordDialog}
        userEmail={user.email}
      />
    </div>
  );
}