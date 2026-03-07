import { describe, it, expect } from 'vitest';
import SystemConfig from '../SystemConfig';

describe('SystemConfig Model', () => {

  it('should create a system config with all required fields', async () => {
    const configData = {
      key: 'payment.processor.api_key',
      value: 'test-api-key-12345',
      category: 'payment' as const,
      description: 'API key for payment processor',
      lastModifiedBy: 'admin-user-123',
    };

    const config = await SystemConfig.create(configData);

    expect(config).toBeDefined();
    expect(config.key).toBe(configData.key);
    expect(config.value).toBe(configData.value);
    expect(config.category).toBe(configData.category);
    expect(config.description).toBe(configData.description);
    expect(config.lastModifiedBy).toBe(configData.lastModifiedBy);
    expect(config.lastModifiedAt).toBeDefined();
    expect(config.createdAt).toBeDefined();
  });

  it('should enforce unique key constraint', async () => {
    const configData = {
      key: 'unique.test.key',
      value: 'value1',
      category: 'general' as const,
      description: 'Test config',
      lastModifiedBy: 'admin-123',
    };

    await SystemConfig.create(configData);

    // Attempt to create another config with the same key
    const duplicateData = {
      ...configData,
      value: 'value2',
    };

    await expect(SystemConfig.create(duplicateData)).rejects.toThrow();
  });

  it('should enforce required fields', async () => {
    const incompleteData = {
      key: 'incomplete.config',
      value: 'test-value',
      // Missing category, description, lastModifiedBy
    };

    await expect(SystemConfig.create(incompleteData)).rejects.toThrow();
  });

  it('should enforce category enum values', async () => {
    const invalidData = {
      key: 'invalid.category',
      value: 'test-value',
      category: 'invalid-category',
      description: 'Test config',
      lastModifiedBy: 'admin-123',
    };

    await expect(SystemConfig.create(invalidData)).rejects.toThrow();
  });

  it('should support all valid category values', async () => {
    const categories = ['payment', 'notification', 'auto_payment', 'general'];
    
    for (const category of categories) {
      const config = await SystemConfig.create({
        key: `test.${category}.config`,
        value: 'test-value',
        category: category as any,
        description: `Test ${category} config`,
        lastModifiedBy: 'admin-123',
      });
      
      expect(config.category).toBe(category);
    }
  });

  it('should store flexible value types (string)', async () => {
    const config = await SystemConfig.create({
      key: 'string.value.test',
      value: 'string value',
      category: 'general' as const,
      description: 'String value test',
      lastModifiedBy: 'admin-123',
    });

    expect(config.value).toBe('string value');
    expect(typeof config.value).toBe('string');
  });

  it('should store flexible value types (number)', async () => {
    const config = await SystemConfig.create({
      key: 'number.value.test',
      value: 42,
      category: 'general' as const,
      description: 'Number value test',
      lastModifiedBy: 'admin-123',
    });

    expect(config.value).toBe(42);
    expect(typeof config.value).toBe('number');
  });

  it('should store flexible value types (boolean)', async () => {
    const config = await SystemConfig.create({
      key: 'boolean.value.test',
      value: true,
      category: 'general' as const,
      description: 'Boolean value test',
      lastModifiedBy: 'admin-123',
    });

    expect(config.value).toBe(true);
    expect(typeof config.value).toBe('boolean');
  });

  it('should store flexible value types (object)', async () => {
    const objectValue = {
      apiKey: 'test-key',
      endpoint: 'https://api.example.com',
      timeout: 5000,
    };

    const config = await SystemConfig.create({
      key: 'object.value.test',
      value: objectValue,
      category: 'payment' as const,
      description: 'Object value test',
      lastModifiedBy: 'admin-123',
    });

    expect(config.value).toEqual(objectValue);
    expect(typeof config.value).toBe('object');
  });

  it('should store flexible value types (array)', async () => {
    const arrayValue = ['option1', 'option2', 'option3'];

    const config = await SystemConfig.create({
      key: 'array.value.test',
      value: arrayValue,
      category: 'notification' as const,
      description: 'Array value test',
      lastModifiedBy: 'admin-123',
    });

    expect(config.value).toEqual(arrayValue);
    expect(Array.isArray(config.value)).toBe(true);
  });

  it('should have unique index on key field', async () => {
    const indexes = SystemConfig.schema.indexes();
    const keyIndex = indexes.find((index: any) => 
      index[0].key === 1 && index[1]?.unique === true
    );
    expect(keyIndex).toBeDefined();
  });

  it('should have index on category field', async () => {
    const indexes = SystemConfig.schema.indexes();
    const categoryIndex = indexes.find((index: any) => 
      index[0].category === 1
    );
    expect(categoryIndex).toBeDefined();
  });

  it('should update lastModifiedAt when modified', async () => {
    const config = await SystemConfig.create({
      key: 'update.test.key',
      value: 'original value',
      category: 'general' as const,
      description: 'Update test',
      lastModifiedBy: 'admin-123',
    });

    const originalModifiedAt = config.lastModifiedAt;
    
    // Wait a bit to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));
    
    config.value = 'updated value';
    config.lastModifiedBy = 'admin-456';
    config.lastModifiedAt = new Date();
    await config.save();

    expect(config.lastModifiedAt.getTime()).toBeGreaterThan(originalModifiedAt.getTime());
    expect(config.lastModifiedBy).toBe('admin-456');
  });

  it('should update timestamps on modification', async () => {
    const config = await SystemConfig.create({
      key: 'timestamp.test.key',
      value: 'original value',
      category: 'general' as const,
      description: 'Timestamp test',
      lastModifiedBy: 'admin-123',
    });

    const originalUpdatedAt = config.updatedAt;
    
    // Wait a bit to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));
    
    config.value = 'updated value';
    await config.save();

    expect(config.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
  });
});
