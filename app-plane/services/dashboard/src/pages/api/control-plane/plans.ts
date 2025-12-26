/**
 * Control Plane Plans Proxy
 *
 * Proxies requests to /plans endpoint on Control Plane.
 * Example: GET /api/control-plane/plans
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth, createControlPlaneHeaders } from '../../../lib/authMiddleware';
import { controlPlaneClient } from '../../../lib/controlPlaneClient';

export default requireAuth(async (req, res, user) => {
  if (req.method === 'GET') {
    // GET /plans - List all subscription plans
    try {
      const { skip = 0, limit = 20, ...filters } = req.query;

      // Build LoopBack filter
      const loopBackFilter: any = {
        limit: Number(limit),
        skip: Number(skip),
      };

      // Add query filters if provided
      if (Object.keys(filters).length > 0) {
        loopBackFilter.where = filters;
      }

      const plans = await controlPlaneClient.get('/plans', {
        headers: createControlPlaneHeaders(user),
        params: {
          filter: JSON.stringify(loopBackFilter),
        },
      });

      res.status(200).json(plans);
    } catch (error: any) {
      const status = error.status || 500;
      res.status(status).json({
        error: error.message || 'Failed to fetch plans',
        correlationId: error.correlationId,
      });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
});
