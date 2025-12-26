/**
 * Control Plane Billing Analytics Proxy
 *
 * Proxies billing and usage analytics endpoints to Control Plane.
 * Provides tenant-level billing metrics and usage tracking.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth, requireMinimumRole, createControlPlaneHeaders } from '../../../lib/authMiddleware';
import { controlPlaneClient } from '../../../lib/controlPlaneClient';

async function handleUsageMetrics(req: NextApiRequest, res: NextApiResponse, user: any) {
  try {
    const { tenantId } = req.query;

    // GET /billing/usage - Fetch usage metrics
    const usage = await controlPlaneClient.get('/billing/usage', {
      headers: createControlPlaneHeaders(user),
      params: {
        tenantId: tenantId || user.tenantId,
      },
    });

    res.status(200).json(usage);
  } catch (error: any) {
    const status = error.status || 500;
    res.status(status).json({
      error: error.message || 'Failed to fetch usage metrics',
      correlationId: error.correlationId,
    });
  }
}

async function handleRevenueMetrics(req: NextApiRequest, res: NextApiResponse, user: any) {
  try {
    const { startDate, endDate } = req.query;

    // GET /billing/revenue - Fetch revenue metrics
    const revenue = await controlPlaneClient.get('/billing/revenue', {
      headers: createControlPlaneHeaders(user),
      params: {
        startDate,
        endDate,
      },
    });

    res.status(200).json(revenue);
  } catch (error: any) {
    const status = error.status || 500;
    res.status(status).json({
      error: error.message || 'Failed to fetch revenue metrics',
      correlationId: error.correlationId,
    });
  }
}

async function handleMRRMetrics(req: NextApiRequest, res: NextApiResponse, user: any) {
  try {
    // GET /billing/mrr - Fetch MRR metrics
    const mrr = await controlPlaneClient.get('/billing/mrr', {
      headers: createControlPlaneHeaders(user),
    });

    res.status(200).json(mrr);
  } catch (error: any) {
    const status = error.status || 500;
    res.status(status).json({
      error: error.message || 'Failed to fetch MRR metrics',
      correlationId: error.correlationId,
    });
  }
}

async function handleChurnMetrics(req: NextApiRequest, res: NextApiResponse, user: any) {
  try {
    const { period = '30d' } = req.query;

    // GET /billing/churn - Fetch churn metrics
    const churn = await controlPlaneClient.get('/billing/churn', {
      headers: createControlPlaneHeaders(user),
      params: { period },
    });

    res.status(200).json(churn);
  } catch (error: any) {
    const status = error.status || 500;
    res.status(status).json({
      error: error.message || 'Failed to fetch churn metrics',
      correlationId: error.correlationId,
    });
  }
}

export default requireAuth(async (req, res, user) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { endpoint } = req.query;

  // Route to appropriate handler based on endpoint parameter
  switch (endpoint) {
    case 'usage':
      return handleUsageMetrics(req, res, user);

    case 'revenue':
      // Require super_admin for revenue metrics
      return requireMinimumRole('super_admin', handleRevenueMetrics)(req, res);

    case 'mrr':
      // Require super_admin for MRR metrics
      return requireMinimumRole('super_admin', handleMRRMetrics)(req, res);

    case 'churn':
      // Require super_admin for churn metrics
      return requireMinimumRole('super_admin', handleChurnMetrics)(req, res);

    default:
      return res.status(400).json({
        error: 'Invalid endpoint. Valid values: usage, revenue, mrr, churn',
      });
  }
});
