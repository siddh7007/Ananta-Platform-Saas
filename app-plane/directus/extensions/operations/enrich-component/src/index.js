import { defineOperationApi } from '@directus/extensions-sdk';

export default defineOperationApi({
  id: 'enrich-component',
  handler: async ({ component_id, triggered_by }, { services, database, getSchema, accountability }) => {
    const { ItemsService, OperationsService } = services;
    const schema = await getSchema();

    try {
      // 1. Get component from database
      const componentService = new ItemsService('catalog_components', {
        schema,
        knex: database,
        accountability,
      });

      const component = await componentService.readOne(component_id);

      if (!component || !component.mpn) {
        throw new Error(`Component ${component_id} not found or missing MPN`);
      }

      console.log(`Enriching component: ${component.mpn} (ID: ${component_id})`);

      // 2. Call all 3 vendor APIs in parallel using Directus Operations
      const operationsService = new OperationsService({ schema, knex: database });

      const [mouserResult, digikeyResult, element14Result] = await Promise.allSettled([
        operationsService.run('mouser-search', { mpn: component.mpn }),
        operationsService.run('digikey-search', { mpn: component.mpn }),
        operationsService.run('element14-search', { mpn: component.mpn }),
      ]);

      // 3. Extract successful results
      const vendors = {
        mouser: mouserResult.status === 'fulfilled' ? mouserResult.value : null,
        digikey: digikeyResult.status === 'fulfilled' ? digikeyResult.value : null,
        element14: element14Result.status === 'fulfilled' ? element14Result.value : null,
      };

      // 4. Normalize and merge data (priority: Mouser > DigiKey > Element14)
      const enrichedData = normalizeAndMerge(vendors, component);

      // 5. Calculate quality score
      const qualityScore = calculateQualityScore(enrichedData);

      // 6. Determine successful sources
      const successfulSources = [];
      if (vendors.mouser?.found) successfulSources.push('mouser');
      if (vendors.digikey?.found) successfulSources.push('digikey');
      if (vendors.element14?.found) successfulSources.push('element14');

      // 7. Determine issues
      const issues = [];
      if (successfulSources.length === 0) {
        issues.push('No vendor data found');
      }
      qualityScore.missing_fields.forEach(field => {
        issues.push(`Missing field: ${field}`);
      });

      // 8. Route based on quality score
      let status = 'completed';
      let targetCollection = 'catalog_components';

      if (qualityScore.score < 70) {
        // REJECT: Log to history only
        status = 'rejected';
        targetCollection = null;
      } else if (qualityScore.score < 95) {
        // STAGING: Save to enrichment_queue for review
        status = 'needs_review';
        targetCollection = 'enrichment_queue';
      } else {
        // PRODUCTION: Direct update to catalog_components
        status = 'completed';
        targetCollection = 'catalog_components';
      }

      // 9. Save enrichment history
      const historyService = new ItemsService('enrichment_history', {
        schema,
        knex: database,
        accountability,
      });

      await historyService.createOne({
        component_id: component_id,
        quality_score: qualityScore.score,
        sources_successful: successfulSources,
        enrichment_data: enrichedData,
        issues: issues,
        status: status,
        triggered_by: triggered_by || accountability?.user || null,
        timestamp: new Date().toISOString(),
      });

      // 10. Save to appropriate target
      if (targetCollection === 'enrichment_queue') {
        const queueService = new ItemsService('enrichment_queue', {
          schema,
          knex: database,
          accountability,
        });

        await queueService.createOne({
          component_id: component_id,
          mpn: component.mpn,
          manufacturer: component.manufacturer,
          status: 'needs_review',
          quality_score: qualityScore.score,
          enrichment_data: enrichedData,
          original_data: component,
          issues: issues,
          created_at: new Date().toISOString(),
        });
      } else if (targetCollection === 'catalog_components') {
        // Update component with enriched data
        await componentService.updateOne(component_id, enrichedData);
      }

      // 11. Return result
      return {
        success: status !== 'rejected',
        status: status,
        component_id: component_id,
        mpn: component.mpn,
        quality_score: qualityScore.score,
        sources_successful: successfulSources,
        enriched_fields: Object.keys(enrichedData).filter(k => enrichedData[k] !== null),
        missing_fields: qualityScore.missing_fields,
        issues: issues,
        message: getStatusMessage(status, qualityScore.score),
      };
    } catch (error) {
      console.error('Enrichment failed:', error);

      // Log error to history
      const historyService = new ItemsService('enrichment_history', {
        schema,
        knex: database,
        accountability,
      });

      await historyService.createOne({
        component_id: component_id,
        quality_score: 0,
        sources_successful: [],
        enrichment_data: {},
        issues: [error.message],
        status: 'error',
        triggered_by: triggered_by || accountability?.user || null,
        timestamp: new Date().toISOString(),
      });

      throw error;
    }
  },
});

/**
 * Normalize and merge data from multiple vendors
 * Priority: Mouser > DigiKey > Element14
 */
function normalizeAndMerge(vendors, originalComponent) {
  const merged = {};

  // Priority order for data merging
  const sources = ['mouser', 'digikey', 'element14'];

  // Fields to merge
  const fields = [
    'datasheet_url',
    'image_url',
    'description',
    'lifecycle_status',
    'package_type',
    'rohs_compliant',
    'reach_compliant',
    'lead_time_days',
  ];

  // Merge fields with priority
  fields.forEach(field => {
    for (const source of sources) {
      if (vendors[source]?.found && vendors[source]?.data?.[field]) {
        merged[field] = vendors[source].data[field];
        break; // Use first available (highest priority)
      }
    }
    // Keep original value if no vendor provided data
    if (!merged[field] && originalComponent[field]) {
      merged[field] = originalComponent[field];
    }
  });

  // Merge pricing (combine all vendors)
  merged.pricing = [];
  sources.forEach(source => {
    if (vendors[source]?.found && vendors[source]?.data?.pricing) {
      merged.pricing.push(...vendors[source].data.pricing);
    }
  });

  // Merge stock data
  merged.stock = {};
  sources.forEach(source => {
    if (vendors[source]?.found && vendors[source]?.data?.stock) {
      Object.assign(merged.stock, vendors[source].data.stock);
    }
  });

  return merged;
}

/**
 * Calculate quality score based on data completeness
 */
function calculateQualityScore(data) {
  const requiredFields = [
    'datasheet_url',
    'image_url',
    'description',
    'lifecycle_status',
    'package_type',
    'rohs_compliant',
    'reach_compliant',
  ];

  let filledFields = 0;
  const missingFields = [];

  requiredFields.forEach(field => {
    if (data[field] !== null && data[field] !== undefined && data[field] !== '') {
      filledFields++;
    } else {
      missingFields.push(field);
    }
  });

  const score = Math.round((filledFields / requiredFields.length) * 100);

  return {
    score,
    filled_fields: filledFields,
    total_fields: requiredFields.length,
    missing_fields: missingFields,
  };
}

/**
 * Get human-readable status message
 */
function getStatusMessage(status, score) {
  if (status === 'rejected') {
    return `Quality score ${score}% is below 70% threshold. Enrichment rejected. Check vendor data availability.`;
  } else if (status === 'needs_review') {
    return `Quality score ${score}% requires admin review. Data saved to staging queue.`;
  } else if (status === 'completed') {
    return `Quality score ${score}% meets production standards. Component updated successfully.`;
  } else if (status === 'error') {
    return `Enrichment failed due to error. Check logs for details.`;
  }
  return 'Unknown status';
}
