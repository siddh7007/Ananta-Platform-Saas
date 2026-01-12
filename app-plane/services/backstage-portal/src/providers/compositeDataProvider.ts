/**
 * Composite Data Provider
 *
 * Combines multiple data providers following Ananta v2 pattern:
 * - dockerDataProvider: Real-time container & service data from Django Docker SDK
 * - supabaseDataProvider: Tenant data with RLS (components, alerts)
 * - djangoDataProvider: Backend processing (BOM upload, analysis, grading)
 *
 * Architecture:
 * - Platform resources → Django Docker SDK
 * - Tenant resources → Supabase with RLS
 * - Complex operations → Django backend API
 */

import { DataProvider } from 'react-admin';
import { dockerDataProvider } from './dockerDataProvider';
import { supabaseDataProvider } from './supabaseDataProvider';
import { djangoDataProvider } from './djangoDataProvider';

/**
 * Resources handled by Docker data provider (platform management)
 */
const DOCKER_RESOURCES = ['containers', 'platform-services'];

/**
 * Resources handled by Supabase (tenant data with RLS)
 */
const SUPABASE_RESOURCES = ['components', 'alerts'];

/**
 * Resources handled by Django backend (complex processing)
 * - BOMs: Upload/analysis through Django, read from Supabase
 */
const DJANGO_RESOURCES = ['boms', 'bom_line_items'];

/**
 * Composite Data Provider
 *
 * Routes requests to appropriate provider based on resource type
 * Following Ananta v2 dual data provider pattern
 */
export const compositeDataProvider: DataProvider = {
  getList: async (resource, params) => {
    if (DOCKER_RESOURCES.includes(resource)) {
      return dockerDataProvider.getList(resource, params);
    }
    if (SUPABASE_RESOURCES.includes(resource)) {
      return supabaseDataProvider.getList(resource, params);
    }
    if (DJANGO_RESOURCES.includes(resource)) {
      // BOMs are read from Supabase (after Django processes them)
      return supabaseDataProvider.getList(resource, params);
    }
    throw new Error(`Unknown resource: ${resource}`);
  },

  getOne: async (resource, params) => {
    if (DOCKER_RESOURCES.includes(resource)) {
      return dockerDataProvider.getOne(resource, params);
    }
    if (SUPABASE_RESOURCES.includes(resource)) {
      return supabaseDataProvider.getOne(resource, params);
    }
    if (DJANGO_RESOURCES.includes(resource)) {
      return supabaseDataProvider.getOne(resource, params);
    }
    throw new Error(`Unknown resource: ${resource}`);
  },

  getMany: async (resource, params) => {
    if (DOCKER_RESOURCES.includes(resource)) {
      return dockerDataProvider.getMany(resource, params);
    }
    if (SUPABASE_RESOURCES.includes(resource)) {
      return supabaseDataProvider.getMany(resource, params);
    }
    if (DJANGO_RESOURCES.includes(resource)) {
      return supabaseDataProvider.getMany(resource, params);
    }
    throw new Error(`Unknown resource: ${resource}`);
  },

  getManyReference: async (resource, params) => {
    if (DOCKER_RESOURCES.includes(resource)) {
      return dockerDataProvider.getManyReference(resource, params);
    }
    if (SUPABASE_RESOURCES.includes(resource)) {
      return supabaseDataProvider.getManyReference(resource, params);
    }
    if (DJANGO_RESOURCES.includes(resource)) {
      return supabaseDataProvider.getManyReference(resource, params);
    }
    throw new Error(`Unknown resource: ${resource}`);
  },

  create: async (resource, params) => {
    if (DOCKER_RESOURCES.includes(resource)) {
      throw new Error('Cannot create platform resources');
    }
    if (SUPABASE_RESOURCES.includes(resource)) {
      // Direct create for simple resources (components, alerts)
      return supabaseDataProvider.create(resource, params);
    }
    if (DJANGO_RESOURCES.includes(resource)) {
      // BOMs go through Django for processing (upload, parse, match, grade)
      return djangoDataProvider.create(resource, params);
    }
    throw new Error(`Unknown resource: ${resource}`);
  },

  update: async (resource, params) => {
    if (DOCKER_RESOURCES.includes(resource)) {
      // Handle container actions via update
      return dockerDataProvider.update(resource, params);
    }
    if (SUPABASE_RESOURCES.includes(resource)) {
      return supabaseDataProvider.update(resource, params);
    }
    if (DJANGO_RESOURCES.includes(resource)) {
      // BOMs updated directly in Supabase (already processed)
      return supabaseDataProvider.update(resource, params);
    }
    throw new Error(`Unknown resource: ${resource}`);
  },

  updateMany: async (resource, params) => {
    if (SUPABASE_RESOURCES.includes(resource)) {
      return supabaseDataProvider.updateMany(resource, params);
    }
    if (DJANGO_RESOURCES.includes(resource)) {
      return supabaseDataProvider.updateMany(resource, params);
    }
    throw new Error('Bulk updates not supported for this resource');
  },

  delete: async (resource, params) => {
    if (DOCKER_RESOURCES.includes(resource)) {
      throw new Error('Cannot delete platform resources');
    }
    if (SUPABASE_RESOURCES.includes(resource)) {
      return supabaseDataProvider.delete(resource, params);
    }
    if (DJANGO_RESOURCES.includes(resource)) {
      return supabaseDataProvider.delete(resource, params);
    }
    throw new Error(`Unknown resource: ${resource}`);
  },

  deleteMany: async (resource, params) => {
    if (SUPABASE_RESOURCES.includes(resource)) {
      return supabaseDataProvider.deleteMany(resource, params);
    }
    if (DJANGO_RESOURCES.includes(resource)) {
      return supabaseDataProvider.deleteMany(resource, params);
    }
    throw new Error('Bulk deletes not supported for this resource');
  },
};
