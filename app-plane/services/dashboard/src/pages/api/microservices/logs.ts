/**
 * Real Container Logs API
 *
 * Fetches actual logs from Docker containers
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface LogEntry {
  id: string;
  timestamp: Date;
  serviceId: string;
  serviceName: string;
  severity: 'debug' | 'info' | 'warning' | 'error' | 'critical';
  message: string;
  details?: any;
}

function parseSeverity(logLine: string): 'debug' | 'info' | 'warning' | 'error' | 'critical' {
  const line = logLine.toLowerCase();
  if (line.includes('critical') || line.includes('fatal')) return 'critical';
  if (line.includes('error') || line.includes('err')) return 'error';
  if (line.includes('warn') || line.includes('warning')) return 'warning';
  if (line.includes('debug')) return 'debug';
  return 'info';
}

async function getContainerLogs(containerName: string, lines: number = 100): Promise<LogEntry[]> {
  try {
    const { stdout } = await execAsync(
      `docker logs ${containerName} --tail ${lines} --timestamps 2>&1`
    );

    const serviceName = containerName.replace('components-v2-', '');
    const logLines = stdout.trim().split('\n').filter(line => line);

    return logLines.map((line, index) => {
      // Parse timestamp from Docker logs format
      const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)/);
      const timestamp = timestampMatch ? new Date(timestampMatch[1]) : new Date();

      // Remove timestamp from message
      const message = timestampMatch ? line.substring(timestampMatch[0].length).trim() : line;

      return {
        id: `${containerName}-${index}-${timestamp.getTime()}`,
        timestamp,
        serviceId: serviceName,
        serviceName: serviceName.charAt(0).toUpperCase() + serviceName.slice(1).replace(/-/g, ' '),
        severity: parseSeverity(message),
        message: message.substring(0, 500), // Limit message length
        details: message.length > 500 ? { fullMessage: message } : undefined,
      };
    }).reverse(); // Most recent first
  } catch (error) {
    console.error(`Error getting logs for ${containerName}:`, error);
    return [];
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { service, lines = 50 } = req.query;

    // Get list of all containers
    const { stdout } = await execAsync(
      'docker ps --filter "name=components-v2-" --format "{{.Names}}"'
    );

    const containers = stdout.trim().split('\n').filter(line => line);

    // If specific service requested, get only its logs
    if (service && typeof service === 'string') {
      const containerName = `components-v2-${service}`;
      const logs = await getContainerLogs(containerName, Number(lines));
      return res.status(200).json(logs);
    }

    // Get logs from all containers
    const allLogs = await Promise.all(
      containers.map(container => getContainerLogs(container, 20)) // Fewer lines per container for combined view
    );

    // Flatten and sort by timestamp
    const logs = allLogs
      .flat()
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, Number(lines)); // Limit total logs

    res.status(200).json(logs);
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
}
