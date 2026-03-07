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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { 
  IconSettings,
  IconEdit,
  IconCheck,
  IconX,
  IconAlertCircle
} from "@tabler/icons-react";
import { toast } from "sonner";

interface SystemConfig {
  _id: string;
  key: string;
  value: any;
  category: 'payment' | 'notification' | 'auto_payment' | 'general';
  description: string;
  lastModifiedBy: string;
  lastModifiedAt: string;
  createdAt: string;
  updatedAt: string;
}

interface ConfigsByCategory {
  payment: SystemConfig[];
  notification: SystemConfig[];
  auto_payment: SystemConfig[];
  general: SystemConfig[];
}

export default function SystemConfigPage() {
  const [configs, setConfigs] = useState<ConfigsByCategory>({
    payment: [],
    notification: [],
    auto_payment: [],
    general: [],
  });
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<'payment' | 'notification' | 'auto_payment' | 'general'>('payment');
  
  // Edit dialog state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<SystemConfig | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  // Fetch all configurations
  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/config');
      
      if (!response.ok) {
        throw new Error("Failed to fetch system configurations");
      }

      const data = await response.json();
      
      // Group configs by category
      const grouped: ConfigsByCategory = {
        payment: [],
        notification: [],
        auto_payment: [],
        general: [],
      };
      
      data.configs.forEach((config: SystemConfig) => {
        grouped[config.category].push(config);
      });
      
      setConfigs(grouped);
    } catch (error) {
      console.error("Error fetching system configurations:", error);
      toast.error("Failed to load system configurations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  // Handle edit button click
  const handleEditClick = (config: SystemConfig) => {
    setEditingConfig(config);
    setEditValue(formatValueForEdit(config.value));
    setIsEditDialogOpen(true);
  };

  // Format value for editing
  const formatValueForEdit = (value: any): string => {
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  // Parse edited value
  const parseEditedValue = (value: string, originalValue: any): any => {
    // If original was a number, parse as number
    if (typeof originalValue === 'number') {
      const parsed = Number(value);
      if (isNaN(parsed)) {
        throw new Error('Invalid number format');
      }
      return parsed;
    }
    
    // If original was a boolean, parse as boolean
    if (typeof originalValue === 'boolean') {
      if (value.toLowerCase() === 'true') return true;
      if (value.toLowerCase() === 'false') return false;
      throw new Error('Invalid boolean format. Use "true" or "false"');
    }
    
    // If original was an object, parse as JSON
    if (typeof originalValue === 'object') {
      try {
        return JSON.parse(value);
      } catch (e) {
        throw new Error('Invalid JSON format');
      }
    }
    
    // Otherwise, return as string
    return value;
  };

  // Handle save configuration
  const handleSaveConfig = async () => {
    if (!editingConfig) return;
    
    setSaving(true);
    try {
      // Parse the edited value
      const parsedValue = parseEditedValue(editValue, editingConfig.value);
      
      const response = await fetch(`/api/admin/config/${editingConfig.key}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ value: parsedValue }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update configuration');
      }
      
      toast.success('Configuration updated successfully');
      setIsEditDialogOpen(false);
      setEditingConfig(null);
      setEditValue("");
      
      // Refresh configurations
      await fetchConfigs();
    } catch (error) {
      console.error("Error updating configuration:", error);
      toast.error(error instanceof Error ? error.message : 'Failed to update configuration');
    } finally {
      setSaving(false);
    }
  };

  // Format value for display
  const formatValueForDisplay = (value: any): string => {
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get category badge color
  const getCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      payment: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      notification: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      auto_payment: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      general: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
    };
    
    return (
      <Badge className={colors[category] || colors.general}>
        {category.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  // Render config list for a category
  const renderConfigList = (categoryConfigs: SystemConfig[]) => {
    if (categoryConfigs.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          No configurations found in this category
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {categoryConfigs.map((config) => (
          <Card key={config._id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{config.key}</CardTitle>
                    {getCategoryBadge(config.category)}
                  </div>
                  <CardDescription>{config.description}</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEditClick(config)}
                >
                  <IconEdit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <Label className="text-muted-foreground text-xs">Current Value</Label>
                  <div className="mt-1 p-3 bg-muted rounded-md font-mono text-sm break-all">
                    {formatValueForDisplay(config.value)}
                  </div>
                </div>
                
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div>
                    <span className="font-medium">Last Modified:</span>{' '}
                    {formatDate(config.lastModifiedAt)}
                  </div>
                  <div>
                    <span className="font-medium">By:</span>{' '}
                    <span className="font-mono">{config.lastModifiedBy.substring(0, 8)}...</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">System Configuration</h2>
          <p className="text-muted-foreground">
            Manage system-wide settings and configurations
          </p>
        </div>
        <IconSettings className="h-8 w-8 text-muted-foreground" />
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              Loading configurations...
            </div>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeCategory} onValueChange={(value) => setActiveCategory(value as any)}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="payment">
              Payment ({configs.payment.length})
            </TabsTrigger>
            <TabsTrigger value="notification">
              Notification ({configs.notification.length})
            </TabsTrigger>
            <TabsTrigger value="auto_payment">
              Auto Payment ({configs.auto_payment.length})
            </TabsTrigger>
            <TabsTrigger value="general">
              General ({configs.general.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="payment" className="mt-4">
            {renderConfigList(configs.payment)}
          </TabsContent>
          
          <TabsContent value="notification" className="mt-4">
            {renderConfigList(configs.notification)}
          </TabsContent>
          
          <TabsContent value="auto_payment" className="mt-4">
            {renderConfigList(configs.auto_payment)}
          </TabsContent>
          
          <TabsContent value="general" className="mt-4">
            {renderConfigList(configs.general)}
          </TabsContent>
        </Tabs>
      )}

      {/* Edit Configuration Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Configuration</DialogTitle>
            <DialogDescription>
              Update the configuration value. Changes will be applied immediately.
            </DialogDescription>
          </DialogHeader>
          
          {editingConfig && (
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Configuration Key</Label>
                <div className="font-mono text-sm mt-1">{editingConfig.key}</div>
              </div>
              
              <div>
                <Label className="text-muted-foreground">Description</Label>
                <div className="text-sm mt-1">{editingConfig.description}</div>
              </div>
              
              <div>
                <Label className="text-muted-foreground">Category</Label>
                <div className="mt-1">{getCategoryBadge(editingConfig.category)}</div>
              </div>
              
              <div>
                <Label htmlFor="configValue">Value</Label>
                <div className="mt-1 space-y-2">
                  {typeof editingConfig.value === 'object' ? (
                    <textarea
                      id="configValue"
                      className="w-full min-h-[200px] p-3 font-mono text-sm border rounded-md bg-background"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      placeholder="Enter JSON value..."
                    />
                  ) : (
                    <Input
                      id="configValue"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      placeholder="Enter value..."
                      className="font-mono"
                    />
                  )}
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <IconAlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="font-medium">Value Type: {typeof editingConfig.value}</div>
                      {typeof editingConfig.value === 'object' && (
                        <div>Enter valid JSON format</div>
                      )}
                      {typeof editingConfig.value === 'boolean' && (
                        <div>Enter "true" or "false"</div>
                      )}
                      {typeof editingConfig.value === 'number' && (
                        <div>Enter a valid number</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false);
                setEditingConfig(null);
                setEditValue("");
              }}
              disabled={saving}
            >
              <IconX className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleSaveConfig}
              disabled={saving}
            >
              {saving ? (
                <>Saving...</>
              ) : (
                <>
                  <IconCheck className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
