/**
 * Control Plane Subscriptions Proxy
 *
 * Direct proxy for subscription management (real-time critical).
 * Supports CRUD operations for subscriptions.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth, requireMinimumRole, createControlPlaneHeaders } from '../../../lib/authMiddleware';
import { controlPlaneClient } from '../../../lib/controlPlaneClient';

async function handleGet(req: NextApiRequest, res: NextApiResponse, user: any) {
  const { id, skip = 0, limit = 20, tenantId, status } = req.query;

  try {
    // GET /subscriptions/:id - Fetch specific subscription
    if (id) {
      const subscription = await controlPlaneClient.get(`/subscriptions/${id}`, {
        headers: createControlPlaneHeaders(user),
      });

      return res.status(200).json(subscription);
    }

    // GET /subscriptions - List subscriptions with filters
    const loopBackFilter: any = {
      limit: Number(limit),
      skip: Number(skip),
      where: {},
    };

    // Add tenant filter
    if (tenantId) {
      loopBackFilter.where.tenantId = tenantId;
    }

    // Add status filter
    if (status) {
      loopBackFilter.where.status = status;
    }

    const subscriptions = await controlPlaneClient.get('/subscriptions', {
      headers: createControlPlaneHeaders(user),
      params: {
        filter: JSON.stringify(loopBackFilter),
      },
    });

    res.status(200).json(subscriptions);
  } catch (error: any) {
    const status = error.status || 500;
    res.status(status).json({
      error: error.message || 'Failed to fetch subscriptions',
      correlationId: error.correlationId,
    });
  }
}

async function handlePost(req: NextApiRequest, res: NextApiResponse, user: any) {
  try {
    const subscription = await controlPlaneClient.post('/subscriptions', req.body, {
      headers: createControlPlaneHeaders(user),
    });

    res.status(201).json(subscription);
  } catch (error: any) {
    const status = error.status || 500;
    res.status(status).json({
      error: error.message || 'Failed to create subscription',
      correlationId: error.correlationId,
    });
  }
}

async function handlePatch(req: NextApiRequest, res: NextApiResponse, user: any) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Subscription ID required' });
  }

  try {
    await controlPlaneClient.patch(`/subscriptions/${id}`, req.body, {
      headers: createControlPlaneHeaders(user),
    });

    res.status(204).end();
  } catch (error: any) {
    const status = error.status || 500;
    res.status(status).json({
      error: error.message || 'Failed to update subscription',
      correlationId: error.correlationId,
    });
  }
}

async function handleDelete(req: NextApiRequest, res: NextApiResponse, user: any) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Subscription ID required' });
  }

  try {
    await controlPlaneClient.delete(`/subscriptions/${id}`, {
      headers: createControlPlaneHeaders(user),
    });

    res.status(204).end();
  } catch (error: any) {
    const status = error.status || 500;
    res.status(status).json({
      error: error.message || 'Failed to delete subscription',
      correlationId: error.correlationId,
    });
  }
}

export default requireAuth(async (req, res, user) => {
  switch (req.method) {
    case 'GET':
      return handleGet(req, res, user);
    case 'POST':
      // Require admin role for creating subscriptions
      return requireMinimumRole('admin', handlePost)(req, res);
    case 'PATCH':
      // Require admin role for updating subscriptions
      return requireMinimumRole('admin', handlePatch)(req, res);
    case 'DELETE':
      // Require owner role for deleting subscriptions
      return requireMinimumRole('owner', handleDelete)(req, res);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
});
