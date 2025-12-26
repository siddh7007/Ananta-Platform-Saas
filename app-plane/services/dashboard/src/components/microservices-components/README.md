# Microservices Monitoring Dashboard

A comprehensive, real-time monitoring and management dashboard for the Components Platform V2 microservices architecture.

## Features

### 🎯 Service Health Monitoring
- **Real-time Status**: Visual indicators for 12+ microservices
- **Health Metrics**: CPU, memory, uptime, and response time tracking
- **Color-coded Status**: Green (running), Yellow (degraded), Red (error), Gray (stopped)
- **Quick Stats**: Requests per hour, success rates, active connections

### 📊 Performance Metrics & Charts
- **Request Rate Tracking**: Line/area/bar charts showing request volume over time
- **Error Rate Monitoring**: Track error trends and spikes
- **Response Time Analysis**: Monitor API response times
- **Resource Usage**: CPU and memory utilization graphs
- **Multi-Service Comparison**: Compare metrics across services
- **Time Range Selection**: 1h, 6h, 24h, 7d views

### 🔗 Service Dependency Visualization
- **Interactive Dependency Graph**: Canvas-based visualization showing service relationships
- **Multiple Layouts**: Hierarchical and circular layouts
- **Dependency Layers**: Automatically calculates and displays dependency depth
- **Clickable Nodes**: Explore service connections interactively
- **Status Integration**: Node colors reflect service health

### 📝 Real-time Logs Feed
- **Live Log Streaming**: Auto-refreshing log entries from all services
- **Advanced Filtering**: Filter by severity, service, or search terms
- **Severity Levels**: Debug, Info, Warning, Error, Critical
- **Expandable Details**: Click to view full log context and trace IDs
- **Compact/Full Views**: Flexible display modes

### 🚨 Alert Management
- **Alert Center**: Centralized view of all system alerts
- **Priority-based Display**: Critical, Error, Warning, Info
- **Acknowledgment System**: Track and acknowledge alerts
- **Alert History**: View past alerts and resolutions
- **Auto-detection**: Automatically generates alerts for issues

### 🛠️ Service Management
- **Quick Actions**: Restart, Start/Stop, View Logs, Test Health
- **Service Details Drawer**: Comprehensive view of each service
- **Action Confirmations**: Prevent accidental changes
- **Docker Integration**: Direct container management
- **Deployment Info**: Last deployment time and deployer

### ⚙️ Auto-Refresh & Configuration
- **Auto-refresh Toggle**: Enable/disable automatic updates
- **Configurable Intervals**: 10s, 30s, 1min refresh rates
- **Manual Refresh**: On-demand data updates
- **Real-time Updates**: Sub-second UI responsiveness

## Architecture

### Services Monitored

The dashboard monitors all Components Platform V2 services:

1. **Traefik** - Reverse proxy and load balancer (Port 27500)
2. **Django Backend** - Main application API (Port 27200)
3. **CNS Service** - Component Normalization Service (Port 27800)
4. **Main Dashboard** - Next.js frontend (Port 27300)
5. **Keycloak** - SSO authentication (Port 27210)
6. **n8n** - Workflow automation (Port 27600)
7. **PostgreSQL** - Primary database (Port 5432)
8. **Redis** - Caching layer (Port 6379)
9. **Temporal** - Workflow engine (Port 7233)
10. **Grafana** - Metrics visualization (Port 27900)
11. **Prometheus** - Metrics collection (Port 9090)
12. **Jaeger** - Distributed tracing (Port 16686)

### Technology Stack

- **React 18.2** - UI framework
- **Material-UI (MUI) v5** - Component library
- **Recharts** - Chart visualization
- **TypeScript** - Type safety
- **HTML Canvas** - Dependency graph rendering
- **React Hooks** - State management

## File Structure

```
src/pages/microservices/
├── index.tsx                           # Main dashboard component
├── types.ts                           # TypeScript type definitions
├── README.md                          # This file
├── components/
│   ├── ServiceHealthCards.tsx         # Service status cards grid
│   ├── MetricsCharts.tsx             # Performance charts
│   ├── ServiceDependencyMap.tsx      # Dependency visualization
│   ├── LogsFeed.tsx                  # Real-time logs display
│   ├── AlertCenter.tsx               # Alert management
│   └── ServiceDetails.tsx            # Service detail drawer
└── hooks/
    └── useMicroservicesData.ts       # Custom data hook with mock data
```

## Usage

### Accessing the Dashboard

The dashboard is available at:
```
http://localhost:27500/microservices
```

### Tab Navigation

1. **Overview** - Service cards + quick metrics + recent logs
2. **Metrics & Charts** - Detailed performance analytics
3. **Dependencies** - Service relationship visualization
4. **Logs** - Full log feed with advanced filtering
5. **Alerts** - Alert management center

### Service Interactions

**View Service Details:**
- Click any service card to open the details drawer
- View comprehensive metrics and configuration
- Access quick actions (restart, logs, health check)

**Filter Logs:**
- Use the search bar to find specific log entries
- Filter by severity level (Debug, Info, Warning, Error, Critical)
- Filter by service name
- Expand log entries to view full details and trace IDs

**Manage Alerts:**
- View active and acknowledged alerts
- Click "Acknowledge" to mark alerts as resolved
- View alert history and acknowledgment details

**Dependency Analysis:**
- Switch between hierarchical and circular layouts
- Focus on specific services to highlight their dependencies
- View dependency details in the list below the graph

### Auto-Refresh

1. Toggle auto-refresh using the switch in the header
2. Select refresh interval (10s, 30s, or 1min)
3. Click the refresh icon for manual updates

## Data Integration

### Current Implementation (Mock Data)

The dashboard currently uses mock data generated by `useMicroservicesData.ts` hook. This provides:
- Realistic service metrics
- Randomized but plausible status values
- Time-series data for charts
- Simulated logs and alerts

### Production Integration

To connect to real services, modify `useMicroservicesData.ts`:

```typescript
const fetchData = async () => {
  // Replace mock data with API calls
  const servicesResponse = await fetch('/api/microservices/status');
  const services = await servicesResponse.json();

  const logsResponse = await fetch('/api/microservices/logs');
  const logs = await logsResponse.json();

  // ... etc
};
```

### API Endpoints to Implement

```
GET  /api/microservices/status          # Service health status
GET  /api/microservices/metrics         # Performance metrics
GET  /api/microservices/logs            # Log entries
GET  /api/microservices/alerts          # System alerts
POST /api/microservices/:id/restart     # Restart service
POST /api/microservices/:id/stop        # Stop service
POST /api/microservices/:id/start       # Start service
GET  /api/microservices/:id/test        # Health check
```

## Customization

### Adding New Services

Edit `SERVICE_DEFINITIONS` in `hooks/useMicroservicesData.ts`:

```typescript
{
  id: 'my-service',
  name: 'my-service',
  displayName: 'My Service',
  port: 8080,
  endpoint: 'http://localhost:27500/my-service',
  dockerContainer: 'components-v2-my-service',
  dependencies: ['postgres', 'redis'],
}
```

### Customizing Colors

Service status colors are defined in the components:
- Running: `#4caf50` (green)
- Degraded: `#ff9800` (orange)
- Error: `#f44336` (red)
- Stopped: `#9e9e9e` (gray)

### Adjusting Refresh Rates

Modify the refresh interval options in `index.tsx`:

```typescript
<MenuItem value={10}>10s</MenuItem>
<MenuItem value={30}>30s</MenuItem>
<MenuItem value={60}>1min</MenuItem>
<MenuItem value={300}>5min</MenuItem>  // Add new option
```

## Performance Considerations

- **Chart Data Points**: Limited to 20 points per chart to maintain performance
- **Log Entries**: Display limited to last 50 entries, paginate for more
- **Auto-refresh**: Debounced to prevent excessive re-renders
- **Canvas Rendering**: Dependency graph uses requestAnimationFrame for smooth updates

## Dependencies

Add to `package.json`:

```json
{
  "dependencies": {
    "recharts": "^2.10.0"
  }
}
```

Already included:
- `@mui/material`: ^5.15.6
- `@mui/icons-material`: ^5.15.6
- `react`: 18.2.0

## Future Enhancements

- [ ] Export metrics as CSV/JSON
- [ ] Historical data comparison
- [ ] Custom alert rules and thresholds
- [ ] Service deployment triggers
- [ ] Real-time WebSocket updates
- [ ] Dark/Light theme toggle
- [ ] Customizable dashboard layouts
- [ ] Service performance benchmarking
- [ ] Automated incident response playbooks
- [ ] Integration with PagerDuty/Slack for alerts

## Contributing

When adding new features:
1. Follow the existing component structure
2. Add TypeScript types to `types.ts`
3. Update mock data generators in `useMicroservicesData.ts`
4. Ensure responsive design works on tablet/mobile
5. Add comments for complex logic
6. Test with auto-refresh enabled

## License

Part of Components Platform V2
```
