import SystemConfig, { ISystemConfig } from '../models/SystemConfig';
import { createAuditLogWithState } from '../middleware/audit';
import { NextRequest } from 'next/server';

/**
 * SystemConfig Service
 * Handles system configuration management operations
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5
 */

export interface ConfigFilters {
  category?: 'payment' | 'notification' | 'auto_payment' | 'general';
}

export interface UpdateConfigDto {
  value: any;
  description?: string;
}

export class SystemConfigService {
  /**
   * Get all system configurations with optional category filtering
   * Validates: Requirements 10.1
   */
  async getAllConfigs(filters: ConfigFilters = {}): Promise<ISystemConfig[]> {
    const query: any = {};
    
    if (filters.category) {
      query.category = filters.category;
    }
    
    return await SystemConfig.find(query).sort({ category: 1, key: 1 });
  }

  /**
   * Get a specific configuration by key
   * Validates: Requirements 10.1
   */
  async getConfigByKey(key: string): Promise<ISystemConfig | null> {
    return await SystemConfig.findOne({ key });
  }

  /**
   * Update system configuration value
   * Validates: Requirements 10.2, 10.3, 10.4, 10.5
   */
  async updateConfig(
    key: string,
    updates: UpdateConfigDto,
    adminId: string,
    request: NextRequest
  ): Promise<ISystemConfig> {
    // Get current config for before state
    const currentConfig = await SystemConfig.findOne({ key });
    if (!currentConfig) {
      throw new Error(`Configuration with key '${key}' not found`);
    }

    // Store before state for audit logging
    const beforeState = {
      key: currentConfig.key,
      value: currentConfig.value,
      category: currentConfig.category,
      description: currentConfig.description,
    };

    // Validate the new value based on category and key
    this.validateConfigValue(key, updates.value, currentConfig.category);

    // Update the configuration
    const updatedConfig = await SystemConfig.findOneAndUpdate(
      { key },
      {
        value: updates.value,
        description: updates.description || currentConfig.description,
        lastModifiedBy: adminId,
        lastModifiedAt: new Date(),
      },
      { new: true }
    );

    if (!updatedConfig) {
      throw new Error(`Failed to update configuration with key '${key}'`);
    }

    // Store after state for audit logging
    const afterState = {
      key: updatedConfig.key,
      value: updatedConfig.value,
      category: updatedConfig.category,
      description: updatedConfig.description,
    };

    // Create audit log with before/after state
    await createAuditLogWithState(
      adminId,
      'config_update',
      'system_config',
      updatedConfig._id.toString(),
      beforeState,
      afterState,
      request
    );

    return updatedConfig;
  }

  /**
   * Create a new system configuration
   * Validates: Requirements 10.1, 10.5
   */
  async createConfig(
    key: string,
    value: any,
    category: 'payment' | 'notification' | 'auto_payment' | 'general',
    description: string,
    adminId: string
  ): Promise<ISystemConfig> {
    // Check if config already exists
    const existingConfig = await SystemConfig.findOne({ key });
    if (existingConfig) {
      throw new Error(`Configuration with key '${key}' already exists`);
    }

    // Validate the value
    this.validateConfigValue(key, value, category);

    // Create new configuration
    const newConfig = await SystemConfig.create({
      key,
      value,
      category,
      description,
      lastModifiedBy: adminId,
      lastModifiedAt: new Date(),
    });

    return newConfig;
  }

  /**
   * Validate configuration value based on key and category
   * Validates: Requirements 10.5
   */
  private validateConfigValue(key: string, value: any, category: string): void {
    // Payment category validations
    if (category === 'payment') {
      if (key === 'payment_processor_api_key' && typeof value !== 'string') {
        throw new Error('Payment processor API key must be a string');
      }
      if (key === 'payment_timeout_seconds' && (typeof value !== 'number' || value < 1)) {
        throw new Error('Payment timeout must be a positive number');
      }
      if (key === 'max_payment_amount' && (typeof value !== 'number' || value <= 0)) {
        throw new Error('Maximum payment amount must be a positive number');
      }
    }

    // Notification category validations
    if (category === 'notification') {
      if (key === 'email_enabled' && typeof value !== 'boolean') {
        throw new Error('Email enabled setting must be a boolean');
      }
      if (key === 'notification_frequency_hours' && (typeof value !== 'number' || value < 1)) {
        throw new Error('Notification frequency must be a positive number of hours');
      }
      if (key === 'email_template' && typeof value !== 'string') {
        throw new Error('Email template must be a string');
      }
    }

    // Auto payment category validations
    if (category === 'auto_payment') {
      if (key === 'auto_payment_enabled' && typeof value !== 'boolean') {
        throw new Error('Auto payment enabled setting must be a boolean');
      }
      if (key === 'default_auto_payment_days_before' && (typeof value !== 'number' || value < 0)) {
        throw new Error('Default auto payment days must be a non-negative number');
      }
      if (key === 'max_auto_payment_amount' && (typeof value !== 'number' || value <= 0)) {
        throw new Error('Maximum auto payment amount must be a positive number');
      }
    }

    // General category validations
    if (category === 'general') {
      if (key === 'app_name' && typeof value !== 'string') {
        throw new Error('Application name must be a string');
      }
      if (key === 'maintenance_mode' && typeof value !== 'boolean') {
        throw new Error('Maintenance mode setting must be a boolean');
      }
      if (key === 'session_timeout_minutes' && (typeof value !== 'number' || value < 1)) {
        throw new Error('Session timeout must be a positive number of minutes');
      }
    }
  }

  /**
   * Get configurations by category
   * Validates: Requirements 10.1
   */
  async getConfigsByCategory(category: 'payment' | 'notification' | 'auto_payment' | 'general'): Promise<ISystemConfig[]> {
    return await SystemConfig.find({ category }).sort({ key: 1 });
  }

  /**
   * Delete a configuration (admin only, rarely used)
   */
  async deleteConfig(key: string, adminId: string): Promise<void> {
    const config = await SystemConfig.findOne({ key });
    if (!config) {
      throw new Error(`Configuration with key '${key}' not found`);
    }

    await SystemConfig.deleteOne({ key });
  }
}

// Export singleton instance
export const systemConfigService = new SystemConfigService();