/**
 * Service Dependency Map Component
 *
 * Visualizes service dependencies and relationships
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
} from '@mui/material';
import { AccountTree, ArrowForward } from '@mui/icons-material';
import { Service } from '../../../microservices-lib/types';

interface ServiceDependencyMapProps {
  services: Service[];
}

const ServiceDependencyMap: React.FC<ServiceDependencyMapProps> = ({ services }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedService, setSelectedService] = useState<string>('all');
  const [layout, setLayout] = useState<'hierarchical' | 'circular' | 'force'>('hierarchical');

  // Node positions for visualization
  const [nodes, setNodes] = useState<Map<string, { x: number; y: number }>>(new Map());

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // Calculate node positions based on layout
    calculateLayout();

    // Draw the dependency graph
    drawGraph(ctx);
  }, [services, selectedService, layout]);

  const calculateLayout = () => {
    const newNodes = new Map<string, { x: number; y: number }>();
    const width = canvasRef.current?.width || 800;
    const height = canvasRef.current?.height || 600;

    if (layout === 'hierarchical') {
      // Arrange in layers based on dependency depth
      const layers = calculateDependencyLayers();
      const layerHeight = height / (layers.length + 1);

      layers.forEach((layer, layerIndex) => {
        const layerWidth = width / (layer.length + 1);
        layer.forEach((serviceId, index) => {
          newNodes.set(serviceId, {
            x: layerWidth * (index + 1),
            y: layerHeight * (layerIndex + 1),
          });
        });
      });
    } else if (layout === 'circular') {
      // Arrange in circle
      const radius = Math.min(width, height) / 3;
      const centerX = width / 2;
      const centerY = height / 2;
      const angleStep = (2 * Math.PI) / services.length;

      services.forEach((service, index) => {
        const angle = angleStep * index;
        newNodes.set(service.id, {
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle),
        });
      });
    }

    setNodes(newNodes);
  };

  const calculateDependencyLayers = (): string[][] => {
    const layers: string[][] = [];
    const visited = new Set<string>();

    // Find root services (no dependencies)
    const roots = services.filter(s => s.dependencies.length === 0);
    if (roots.length > 0) {
      layers.push(roots.map(s => s.id));
      roots.forEach(s => visited.add(s.id));
    }

    // Build subsequent layers
    let currentLayer = 0;
    while (visited.size < services.length && currentLayer < 10) {
      const nextLayer: string[] = [];

      services.forEach(service => {
        if (visited.has(service.id)) return;

        // Check if all dependencies are satisfied
        const allDepsVisited = service.dependencies.every(dep => visited.has(dep));
        if (allDepsVisited) {
          nextLayer.push(service.id);
        }
      });

      if (nextLayer.length === 0) break; // Prevent infinite loop

      layers.push(nextLayer);
      nextLayer.forEach(id => visited.add(id));
      currentLayer++;
    }

    // Add any remaining services
    const remaining = services.filter(s => !visited.has(s.id));
    if (remaining.length > 0) {
      layers.push(remaining.map(s => s.id));
    }

    return layers;
  };

  const drawGraph = (ctx: CanvasRenderingContext2D) => {
    // Clear canvas
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Draw connections first (behind nodes)
    services.forEach(service => {
      const fromNode = nodes.get(service.id);
      if (!fromNode) return;

      service.dependencies.forEach(depId => {
        const toNode = nodes.get(depId);
        if (!toNode) return;

        // Draw arrow
        ctx.strokeStyle = '#4fc3f7';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(fromNode.x, fromNode.y);
        ctx.lineTo(toNode.x, toNode.y);
        ctx.stroke();

        // Draw arrowhead
        const angle = Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x);
        const arrowSize = 10;
        ctx.beginPath();
        ctx.moveTo(toNode.x, toNode.y);
        ctx.lineTo(
          toNode.x - arrowSize * Math.cos(angle - Math.PI / 6),
          toNode.y - arrowSize * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          toNode.x - arrowSize * Math.cos(angle + Math.PI / 6),
          toNode.y - arrowSize * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fillStyle = '#4fc3f7';
        ctx.fill();
      });
    });

    // Draw nodes
    services.forEach(service => {
      const node = nodes.get(service.id);
      if (!node) return;

      const nodeRadius = 40;

      // Node circle
      const getNodeColor = () => {
        switch (service.status) {
          case 'running': return '#4caf50';
          case 'degraded': return '#ff9800';
          case 'stopped': return '#9e9e9e';
          case 'error': return '#f44336';
          default: return '#9e9e9e';
        }
      };

      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeRadius, 0, 2 * Math.PI);
      ctx.fillStyle = getNodeColor();
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Service name
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Abbreviate long names
      const displayName = service.displayName.length > 12
        ? service.displayName.substring(0, 10) + '...'
        : service.displayName;

      ctx.fillText(displayName, node.x, node.y - 55);

      // Status indicator
      ctx.font = '10px sans-serif';
      ctx.fillText(service.status, node.x, node.y + 55);
    });
  };

  return (
    <Box>
      {/* Controls */}
      <Paper sx={{ p: 2, mb: 3, bgcolor: '#1a1f2e' }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography variant="h6" sx={{ color: '#fff', display: 'flex', alignItems: 'center', gap: 1 }}>
            <AccountTree /> Service Dependencies
          </Typography>

          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel sx={{ color: '#8b92a7' }}>Focus Service</InputLabel>
            <Select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              label="Focus Service"
              sx={{ color: '#fff', bgcolor: '#0a0e1a' }}
            >
              <MenuItem value="all">All Services</MenuItem>
              {services.map(service => (
                <MenuItem key={service.id} value={service.id}>
                  {service.displayName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel sx={{ color: '#8b92a7' }}>Layout</InputLabel>
            <Select
              value={layout}
              onChange={(e) => setLayout(e.target.value as any)}
              label="Layout"
              sx={{ color: '#fff', bgcolor: '#0a0e1a' }}
            >
              <MenuItem value="hierarchical">Hierarchical</MenuItem>
              <MenuItem value="circular">Circular</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {/* Dependency Graph */}
      <Paper sx={{ p: 3, bgcolor: '#1a1f2e', minHeight: 600 }}>
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: '600px',
            background: '#0a0e1a',
            borderRadius: '8px',
          }}
        />
      </Paper>

      {/* Legend */}
      <Paper sx={{ p: 2, mt: 3, bgcolor: '#1a1f2e' }}>
        <Typography variant="subtitle2" sx={{ color: '#fff', mb: 2 }}>
          Legend
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Chip
            label="Running"
            size="small"
            sx={{ bgcolor: '#4caf5020', color: '#4caf50', fontWeight: 600 }}
          />
          <Chip
            label="Degraded"
            size="small"
            sx={{ bgcolor: '#ff980020', color: '#ff9800', fontWeight: 600 }}
          />
          <Chip
            label="Stopped"
            size="small"
            sx={{ bgcolor: '#9e9e9e20', color: '#9e9e9e', fontWeight: 600 }}
          />
          <Chip
            label="Error"
            size="small"
            sx={{ bgcolor: '#f4433620', color: '#f44336', fontWeight: 600 }}
          />
        </Box>
      </Paper>

      {/* Dependency List */}
      <Paper sx={{ p: 3, mt: 3, bgcolor: '#1a1f2e' }}>
        <Typography variant="h6" sx={{ color: '#fff', mb: 2 }}>
          Dependency Details
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {services.map(service => (
            service.dependencies.length > 0 && (
              <Box key={service.id} sx={{ p: 2, bgcolor: '#0a0e1a', borderRadius: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Typography variant="body1" sx={{ color: '#fff', fontWeight: 600 }}>
                    {service.displayName}
                  </Typography>
                  <ArrowForward sx={{ color: '#4fc3f7', fontSize: 16 }} />
                  <Typography variant="body2" sx={{ color: '#8b92a7' }}>
                    depends on
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {service.dependencies.map(depId => {
                    const depService = services.find(s => s.id === depId);
                    return depService ? (
                      <Chip
                        key={depId}
                        label={depService.displayName}
                        size="small"
                        sx={{ bgcolor: '#4fc3f720', color: '#4fc3f7' }}
                      />
                    ) : null;
                  })}
                </Box>
              </Box>
            )
          ))}
        </Box>
      </Paper>
    </Box>
  );
};

export default ServiceDependencyMap;
