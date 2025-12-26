/**
 * Directus Custom Endpoint: Database Router
 *
 * Provides API endpoints to query both databases:
 * - GET /database-router/components - Query components from central DB
 * - GET /database-router/customers - Query customer data from Supabase
 * - POST /database-router/enrich-bom - Enrich BOM with component data
 */

module.exports = function registerEndpoint(router, { services, database, getSchema }) {
  const { ItemsService } = services;
  const { Knex } = require('knex');

  // Initialize connections to both databases
  const componentsDB = Knex({
    client: 'pg',
    connection: {
      host: process.env.COMPONENTS_DB_HOST || 'components-v2-postgres',
      port: 5432,
      database: process.env.COMPONENTS_DB_NAME || 'components_v2',
      user: process.env.COMPONENTS_DB_USER || 'postgres',
      password: process.env.COMPONENTS_DB_PASSWORD || 'postgres',
    },
  });

  const supabaseDB = Knex({
    client: 'pg',
    connection: {
      host: process.env.SUPABASE_DB_HOST || 'components-v2-supabase-db',
      port: 5432,
      database: process.env.SUPABASE_DB_NAME || 'supabase',
      user: process.env.SUPABASE_DB_USER || 'postgres',
      password: process.env.SUPABASE_DB_PASSWORD || 'supabase-postgres-secure-2024',
    },
  });

  // GET /database-router/components/:mpn
  router.get('/components/:mpn', async (req, res) => {
    try {
      const { mpn } = req.params;

      // Query components from central DB
      const component = await componentsDB('components')
        .where('manufacturer_part_number', mpn)
        .first();

      if (!component) {
        return res.status(404).json({
          error: 'Component not found',
          mpn,
        });
      }

      // Get additional data (manufacturer, category, SKUs)
      const manufacturer = await componentsDB('manufacturers')
        .where('id', component.manufacturer_id)
        .first();

      const category = await componentsDB('categories')
        .where('id', component.category_id)
        .first();

      const skus = await componentsDB('skus')
        .where('component_id', component.id)
        .select('*');

      res.json({
        component,
        manufacturer,
        category,
        skus,
        source: 'components_v2_db',
      });
    } catch (error) {
      res.status(500).json({
        error: 'Database query failed',
        message: error.message,
      });
    }
  });

  // GET /database-router/search-components?q=STM32
  router.get('/search-components', async (req, res) => {
    try {
      const { q, limit = 20 } = req.query;

      if (!q) {
        return res.status(400).json({
          error: 'Query parameter "q" is required',
        });
      }

      // Search components by MPN or description
      const components = await componentsDB('components')
        .where('manufacturer_part_number', 'ilike', `%${q}%`)
        .orWhere('description', 'ilike', `%${q}%`)
        .limit(parseInt(limit));

      res.json({
        query: q,
        count: components.length,
        components,
        source: 'components_v2_db',
      });
    } catch (error) {
      res.status(500).json({
        error: 'Search failed',
        message: error.message,
      });
    }
  });

  // GET /database-router/customer-boms/:org_id
  router.get('/customer-boms/:org_id', async (req, res) => {
    try {
      const { org_id } = req.params;

      // Query customer BOMs from Supabase
      const boms = await supabaseDB('boms')
        .join('projects', 'boms.project_id', 'projects.id')
        .where('projects.organization_id', org_id)
        .select('boms.*', 'projects.name as project_name');

      res.json({
        organization_id: org_id,
        count: boms.length,
        boms,
        source: 'supabase_db',
      });
    } catch (error) {
      res.status(500).json({
        error: 'Query failed',
        message: error.message,
      });
    }
  });

  // POST /database-router/enrich-bom
  router.post('/enrich-bom', async (req, res) => {
    try {
      const { bom_id } = req.body;

      if (!bom_id) {
        return res.status(400).json({
          error: 'bom_id is required',
        });
      }

      // Get BOM line items from Supabase
      const lineItems = await supabaseDB('bom_line_items')
        .where('bom_id', bom_id)
        .select('*');

      const enrichedItems = [];

      // Enrich each line item with data from central DB
      for (const item of lineItems) {
        const component = await componentsDB('components')
          .where('manufacturer_part_number', item.mpn)
          .first();

        if (component) {
          // Update line item in Supabase with enriched data
          await supabaseDB('bom_line_items')
            .where('id', item.id)
            .update({
              matched_component_id: component.id,
              lifecycle_status: component.lifecycle_status,
              description: component.description,
              updated_at: new Date(),
            });

          enrichedItems.push({
            line_item_id: item.id,
            mpn: item.mpn,
            status: 'enriched',
            component_id: component.id,
          });
        } else {
          enrichedItems.push({
            line_item_id: item.id,
            mpn: item.mpn,
            status: 'not_found',
          });
        }
      }

      // Update BOM status
      await supabaseDB('boms')
        .where('id', bom_id)
        .update({
          status: 'ENRICHED',
          updated_at: new Date(),
        });

      res.json({
        bom_id,
        total_items: lineItems.length,
        enriched_count: enrichedItems.filter(i => i.status === 'enriched').length,
        not_found_count: enrichedItems.filter(i => i.status === 'not_found').length,
        items: enrichedItems,
      });
    } catch (error) {
      res.status(500).json({
        error: 'Enrichment failed',
        message: error.message,
      });
    }
  });

  // Health check endpoint
  router.get('/health', async (req, res) => {
    try {
      // Test both database connections
      await componentsDB.raw('SELECT 1');
      await supabaseDB.raw('SELECT 1');

      res.json({
        status: 'ok',
        databases: {
          components_v2: 'connected',
          supabase: 'connected',
        },
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: error.message,
      });
    }
  });
};
