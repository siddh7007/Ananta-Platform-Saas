/**
 * Directus Multi-Database Configuration
 *
 * Connects Directus to both:
 * 1. Components V2 Postgres (port 27010) - Central Component Catalog (READ-ONLY)
 * 2. Supabase (port 27701) - Customer-Specific Data (READ-WRITE)
 */

module.exports = {
  // Database 1: Components V2 Postgres (Central Catalog)
  componentsDB: {
    client: 'pg',
    connection: {
      host: process.env.COMPONENTS_DB_HOST || 'components-v2-postgres',
      port: process.env.COMPONENTS_DB_PORT || 5432,
      database: process.env.COMPONENTS_DB_NAME || 'components_v2',
      user: process.env.COMPONENTS_DB_USER || 'postgres',
      password: process.env.COMPONENTS_DB_PASSWORD || 'postgres',
    },
    pool: {
      min: 2,
      max: 10,
    },
    // READ-ONLY configuration
    readOnly: true,
  },

  // Database 2: Supabase (Customer Data)
  supabaseDB: {
    client: 'pg',
    connection: {
      host: process.env.SUPABASE_DB_HOST || 'components-v2-supabase-db',
      port: process.env.SUPABASE_DB_PORT || 5432,
      database: process.env.SUPABASE_DB_NAME || 'supabase',
      user: process.env.SUPABASE_DB_USER || 'postgres',
      password: process.env.SUPABASE_DB_PASSWORD || 'supabase-postgres-secure-2024',
    },
    pool: {
      min: 2,
      max: 10,
    },
    // READ-WRITE configuration
    readOnly: false,
  },
};
