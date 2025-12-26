/**
 * Control Plane User Invitations Proxy
 *
 * Proxies user invitation operations to Control Plane.
 * Handles CRUD for user invitations with proper tenant isolation.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAuth, requireMinimumRole, createControlPlaneHeaders } from '../../../lib/authMiddleware';
import { controlPlaneClient } from '../../../lib/controlPlaneClient';

async function handleGet(req: NextApiRequest, res: NextApiResponse, user: any) {
  const { id, skip = 0, limit = 20, status } = req.query;

  try {
    // GET /user-invitations/:id - Fetch specific invitation
    if (id) {
      const invitation = await controlPlaneClient.get(`/user-invitations/${id}`, {
        headers: createControlPlaneHeaders(user),
      });

      return res.status(200).json(invitation);
    }

    // GET /user-invitations - List invitations with filters
    const loopBackFilter: any = {
      limit: Number(limit),
      skip: Number(skip),
      where: {},
    };

    // Add status filter
    if (status) {
      loopBackFilter.where.status = status;
    }

    const invitations = await controlPlaneClient.get('/user-invitations', {
      headers: createControlPlaneHeaders(user),
      params: {
        filter: JSON.stringify(loopBackFilter),
      },
    });

    res.status(200).json(invitations);
  } catch (error: any) {
    const status = error.status || 500;
    res.status(status).json({
      error: error.message || 'Failed to fetch invitations',
      correlationId: error.correlationId,
    });
  }
}

async function handlePost(req: NextApiRequest, res: NextApiResponse, user: any) {
  try {
    // Ensure tenantId is set from authenticated user if not provided
    const invitationData = {
      ...req.body,
      tenantId: req.body.tenantId || user.tenantId,
    };

    const invitation = await controlPlaneClient.post('/user-invitations', invitationData, {
      headers: createControlPlaneHeaders(user),
    });

    res.status(201).json(invitation);
  } catch (error: any) {
    const status = error.status || 500;
    res.status(status).json({
      error: error.message || 'Failed to create invitation',
      correlationId: error.correlationId,
    });
  }
}

async function handlePatch(req: NextApiRequest, res: NextApiResponse, user: any) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Invitation ID required' });
  }

  try {
    await controlPlaneClient.patch(`/user-invitations/${id}`, req.body, {
      headers: createControlPlaneHeaders(user),
    });

    res.status(204).end();
  } catch (error: any) {
    const status = error.status || 500;
    res.status(status).json({
      error: error.message || 'Failed to update invitation',
      correlationId: error.correlationId,
    });
  }
}

async function handleDelete(req: NextApiRequest, res: NextApiResponse, user: any) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Invitation ID required' });
  }

  try {
    await controlPlaneClient.delete(`/user-invitations/${id}`, {
      headers: createControlPlaneHeaders(user),
    });

    res.status(204).end();
  } catch (error: any) {
    const status = error.status || 500;
    res.status(status).json({
      error: error.message || 'Failed to delete invitation',
      correlationId: error.correlationId,
    });
  }
}

export default requireAuth(async (req, res, user) => {
  switch (req.method) {
    case 'GET':
      return handleGet(req, res, user);
    case 'POST':
      // Require admin role for inviting users
      return requireMinimumRole('admin', handlePost)(req, res);
    case 'PATCH':
      // Require admin role for updating invitations
      return requireMinimumRole('admin', handlePatch)(req, res);
    case 'DELETE':
      // Require admin role for deleting invitations
      return requireMinimumRole('admin', handleDelete)(req, res);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
});
