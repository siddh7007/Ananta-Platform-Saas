import {model, property} from '@loopback/repository';
import {UserModifiableEntity} from '@sourceloop/core';

/**
 * Setting model for platform-wide configuration.
 * Stores key-value pairs for admin-configurable settings.
 */
@model({
  name: 'settings',
  description: 'Platform settings and configuration',
  settings: {
    indexes: {
      idx_settings_config_key: {
        keys: {config_key: 1},
        options: {unique: true},
      },
    },
  },
})
export class Setting extends UserModifiableEntity {
  @property({
    type: 'string',
    id: true,
    generated: true,
    postgresql: {
      dataType: 'uuid',
    },
  })
  id: string;

  @property({
    type: 'string',
    required: true,
    name: 'config_key',
    jsonSchema: {
      maxLength: 100,
    },
    description: 'Unique key for the setting (e.g., "platform.name", "email.sender")',
  })
  configKey: string;

  @property({
    type: 'string',
    name: 'config_value',
    description: 'Value of the setting',
  })
  configValue?: string;

  @property({
    type: 'string',
    name: 'value_type',
    default: 'string',
    jsonSchema: {
      enum: ['string', 'number', 'boolean', 'json'],
    },
    description: 'Data type of the value for proper parsing',
  })
  valueType?: string;

  @property({
    type: 'string',
    description: 'Human-readable description of the setting',
  })
  description?: string;

  @property({
    type: 'string',
    name: 'category',
    description: 'Category for grouping settings (e.g., "general", "email", "billing")',
  })
  category?: string;

  @property({
    type: 'boolean',
    name: 'is_public',
    default: false,
    description: 'Whether this setting is visible to non-admin users',
  })
  isPublic?: boolean;

  constructor(data?: Partial<Setting>) {
    super(data);
  }
}

export interface SettingRelations {}

export type SettingWithRelations = Setting & SettingRelations;
