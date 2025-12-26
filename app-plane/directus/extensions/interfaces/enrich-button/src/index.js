import { defineInterface } from '@directus/extensions-sdk';
import InterfaceComponent from './interface.vue';

export default defineInterface({
  id: 'enrich-button',
  name: 'Enrich Button',
  description: 'Button to trigger component enrichment from supplier APIs',
  icon: 'sync',
  component: InterfaceComponent,
  types: ['alias'],
  localTypes: ['presentation'],
  group: 'presentation',
  options: [
    {
      field: 'label',
      name: 'Button Label',
      type: 'string',
      meta: {
        width: 'full',
        interface: 'input',
      },
      schema: {
        default_value: 'Enrich from Suppliers',
      },
    },
    {
      field: 'show_history',
      name: 'Show Enrichment History',
      type: 'boolean',
      meta: {
        width: 'half',
        interface: 'boolean',
      },
      schema: {
        default_value: true,
      },
    },
    {
      field: 'auto_refresh',
      name: 'Auto-refresh after enrichment',
      type: 'boolean',
      meta: {
        width: 'half',
        interface: 'boolean',
      },
      schema: {
        default_value: true,
      },
    },
  ],
});
