/**
 * Real Container Control API
 *
 * Restart, Stop, Start Docker containers
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const ALLOWED_ACTIONS = ['restart', 'stop', 'start', 'test'];

async function restartContainer(containerName: string): Promise<{ success: boolean; message: string }> {
  try {
    await execAsync(`docker restart ${containerName}`);
    return { success: true, message: `Container ${containerName} restarted successfully` };
  } catch (error: any) {
    return { success: false, message: `Failed to restart: ${error.message}` };
  }
}

async function stopContainer(containerName: string): Promise<{ success: boolean; message: string }> {
  try {
    await execAsync(`docker stop ${containerName}`);
    return { success: true, message: `Container ${containerName} stopped successfully` };
  } catch (error: any) {
    return { success: false, message: `Failed to stop: ${error.message}` };
  }
}

async function startContainer(containerName: string): Promise<{ success: boolean; message: string }> {
  try {
    await execAsync(`docker start ${containerName}`);
    return { success: true, message: `Container ${containerName} started successfully` };
  } catch (error: any) {
    return { success: false, message: `Failed to start: ${error.message}` };
  }
}

async function testContainer(containerName: string): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    // Check if container is running
    const { stdout } = await execAsync(
      `docker inspect ${containerName} --format "{{.State.Status}}"`
    );

    const status = stdout.trim();

    if (status !== 'running') {
      return {
        success: false,
        message: `Container is ${status}`,
        data: { status },
      };
    }

    // Get container health
    try {
      const { stdout: healthOutput } = await execAsync(
        `docker inspect ${containerName} --format "{{.State.Health.Status}}"`
      );

      const healthStatus = healthOutput.trim();

      return {
        success: healthStatus === 'healthy' || healthStatus === '<no value>',
        message: healthStatus === '<no value>'
          ? 'Container running (no health check defined)'
          : `Health status: ${healthStatus}`,
        data: { status, health: healthStatus },
      };
    } catch {
      // No health check defined
      return {
        success: true,
        message: 'Container running (no health check defined)',
        data: { status },
      };
    }
  } catch (error: any) {
    return {
      success: false,
      message: `Test failed: ${error.message}`,
    };
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action } = req.query;
    const { serviceId } = req.body;

    if (!action || typeof action !== 'string' || !ALLOWED_ACTIONS.includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    if (!serviceId) {
      return res.status(400).json({ error: 'Service ID required' });
    }

    const containerName = `components-v2-${serviceId}`;

    let result;
    switch (action) {
      case 'restart':
        result = await restartContainer(containerName);
        break;
      case 'stop':
        result = await stopContainer(containerName);
        break;
      case 'start':
        result = await startContainer(containerName);
        break;
      case 'test':
        result = await testContainer(containerName);
        break;
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error: any) {
    console.error('Error executing container action:', error);
    res.status(500).json({ error: 'Failed to execute action', message: error.message });
  }
}
