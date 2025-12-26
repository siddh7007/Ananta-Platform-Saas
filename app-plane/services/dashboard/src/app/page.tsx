'use client';

/**
 * Modern Unified Dashboard - Main Page
 *
 * Single access point for all Components Platform V2 services
 * with Docker management controls and modern UI
 */

import { useEffect, useState } from 'react';
import { getUserInfo, logout, getToken, isAuthenticated as checkAuth0Status } from '@/lib/auth0';
import { services, Service, checkServiceHealth, openService } from '@/lib/services';

interface ServiceHealth {
  [serviceId: string]: boolean;
}

interface DockerAction {
  action: string;
  service?: string;
  loading: boolean;
}

export default function Dashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [serviceHealth, setServiceHealth] = useState<ServiceHealth>({});
  const [loading, setLoading] = useState(true);
  const [dockerAction, setDockerAction] = useState<DockerAction | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    // Check Auth0 authentication status
    const checkAuth = async () => {
      try {
        const authenticated = await checkAuth0Status();

        if (!authenticated) {
          // Redirect to Auth0 login
          window.location.href = '/api/auth/login';
          return;
        }

        setIsAuthenticated(authenticated);
        const user = await getUserInfo();
        setUserInfo(user);
        setLoading(false);
      } catch (error) {
        console.error('Auth0 initialization failed:', error);
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  useEffect(() => {
    // Check health of all services (non-blocking)
    const checkAllServices = async () => {
      const health: ServiceHealth = {};

      await Promise.all(
        services.map(async (service) => {
          health[service.id] = await checkServiceHealth(service);
        })
      );

      setServiceHealth(health);
    };

    if (isAuthenticated) {
      checkAllServices();
      const healthInterval = setInterval(checkAllServices, 300000);
      return () => clearInterval(healthInterval);
    }
  }, [isAuthenticated]);

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleDockerAction = async (action: string, serviceName?: string) => {
    setDockerAction({ action, service: serviceName, loading: true });

    try {
      const token = await getToken();
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:27200';

      const endpoint = `/api/docker/${action}`;
      const body = serviceName ? { service: serviceName } : undefined;

      const response = await fetch(`${backendUrl}${endpoint}`, {
        method: action === 'status' ? 'GET' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await response.json();

      if (response.ok) {
        showNotification(
          data.message || `${action} completed successfully`,
          'success'
        );
        // Refresh health after action
        setTimeout(() => window.location.reload(), 2000);
      } else {
        showNotification(
          data.error || `Failed to ${action}`,
          'error'
        );
      }
    } catch (error) {
      showNotification(`Error: ${error}`, 'error');
    } finally {
      setDockerAction(null);
    }
  };

  const handleLogout = () => {
    logout();
  };

  const handleServiceClick = async (service: Service) => {
    const token = await getToken();
    openService(service, token);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass rounded-2xl p-12">
          <div className="shimmer h-8 w-64 rounded mb-4"></div>
          <div className="text-white text-xl">Loading...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass rounded-2xl p-12">
          <div className="text-white text-xl">Authenticating...</div>
        </div>
      </div>
    );
  }

  const healthyServices = Object.values(serviceHealth).filter((h) => h).length;
  const totalServices = services.length;
  const healthPercentage = Math.round((healthyServices / totalServices) * 100);

  return (
    <div className="min-h-screen">
      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 glass-strong rounded-xl p-4 min-w-[300px] ${
          notification.type === 'success' ? 'border-l-4 border-green-500' : 'border-l-4 border-red-500'
        }`}>
          <div className="flex items-center space-x-3">
            <span className="text-2xl">{notification.type === 'success' ? '✅' : '❌'}</span>
            <span className="text-white">{notification.message}</span>
          </div>
        </div>
      )}

      {/* Header with glassmorphism */}
      <header className="glass-strong border-b border-white/10 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center space-x-4">
              <div className="text-4xl">🚀</div>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  Components Platform V2
                </h1>
                <p className="text-sm text-blue-300">Modern Infrastructure Dashboard</p>
              </div>
            </div>

            <div className="flex items-center space-x-6">
              <a
                href="/control-panel"
                className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl transition-all glow-on-hover font-medium flex items-center space-x-2"
              >
                <span className="text-xl">🎛️</span>
                <span>Control Panel</span>
              </a>
              <div className="text-sm">
                <div className="text-gray-400">Signed in as</div>
                <div className="text-white font-medium">{userInfo?.email || userInfo?.username}</div>
              </div>
              <button
                onClick={handleLogout}
                className="px-6 py-3 bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white rounded-xl transition-all glow-on-hover font-medium"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* System Health Dashboard */}
        <div className="glass-strong rounded-2xl p-8 mb-8 glow-on-hover">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">System Health Overview</h2>
              <p className="text-blue-300">Real-time status of all platform services</p>
            </div>
            <div className="text-center">
              <div className="text-6xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                {healthPercentage}%
              </div>
              <div className="text-gray-400 mt-2">{healthyServices}/{totalServices} operational</div>
            </div>
          </div>

          {/* Health Bar */}
          <div className="w-full bg-gray-800 rounded-full h-4 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                healthPercentage === 100
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                  : healthPercentage >= 80
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-500'
                  : 'bg-gradient-to-r from-yellow-500 to-orange-500'
              }`}
              style={{ width: `${healthPercentage}%` }}
            ></div>
          </div>
        </div>

        {/* Docker Management Controls */}
        <div className="glass-strong rounded-2xl p-8 mb-8">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center">
            <span className="text-3xl mr-3">🐳</span>
            Docker Management
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => handleDockerAction('restart')}
              disabled={dockerAction?.loading}
              className="px-6 py-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl transition-all glow-on-hover font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-3"
            >
              <span className="text-2xl">🔄</span>
              <span>{dockerAction?.action === 'restart' && dockerAction.loading ? 'Restarting...' : 'Restart All Services'}</span>
            </button>

            <button
              onClick={() => handleDockerAction('stop')}
              disabled={dockerAction?.loading}
              className="px-6 py-4 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl transition-all glow-on-hover font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-3"
            >
              <span className="text-2xl">⏹️</span>
              <span>{dockerAction?.action === 'stop' && dockerAction.loading ? 'Stopping...' : 'Stop All Services'}</span>
            </button>

            <button
              onClick={() => handleDockerAction('start')}
              disabled={dockerAction?.loading}
              className="px-6 py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl transition-all glow-on-hover font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-3"
            >
              <span className="text-2xl">▶️</span>
              <span>{dockerAction?.action === 'start' && dockerAction.loading ? 'Starting...' : 'Start All Services'}</span>
            </button>
          </div>
        </div>

        {/* Services Grid */}
        <div className="space-y-8">
          {['core', 'storage', 'observability', 'automation'].map((category) => (
            <section key={category}>
              <h3 className="text-xl font-bold text-white mb-6 capitalize flex items-center">
                <span className="w-2 h-8 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full mr-4"></span>
                {category} Services
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {services
                  .filter((s) => s.category === category)
                  .map((service) => (
                    <ServiceCard
                      key={service.id}
                      service={service}
                      isHealthy={serviceHealth[service.id]}
                      onClick={() => handleServiceClick(service)}
                      onRestart={() => handleDockerAction('restart', service.id)}
                      onRebuild={() => handleDockerAction('rebuild', service.id)}
                      isActionLoading={
                        (dockerAction?.loading &&
                        dockerAction?.service === service.id) || false
                      }
                    />
                  ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}

interface ServiceCardProps {
  service: Service;
  isHealthy?: boolean;
  onClick: () => void;
  onRestart: () => void;
  onRebuild: () => void;
  isActionLoading: boolean;
}

function ServiceCard({ service, isHealthy, onClick, onRestart, onRebuild, isActionLoading }: ServiceCardProps) {
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      className="glass rounded-2xl p-6 transition-all glow-on-hover relative overflow-hidden group"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Status indicator with glow */}
      <div className="absolute top-4 right-4">
        <div
          className={`w-4 h-4 rounded-full ${
            isHealthy === undefined
              ? 'bg-gray-500'
              : isHealthy
              ? 'bg-green-500 pulse-glow'
              : 'bg-red-500 pulse-glow'
          }`}
          title={
            isHealthy === undefined
              ? 'Status unknown'
              : isHealthy
              ? 'Healthy'
              : 'Unhealthy'
          }
        />
      </div>

      {/* Service icon and info */}
      <div className="mb-6">
        <div className="text-5xl mb-4">{service.icon}</div>
        <h4 className="text-xl font-bold text-white mb-2">{service.name}</h4>
        <p className="text-sm text-gray-400">{service.description}</p>

        {service.requiresSSO && (
          <div className="mt-4 inline-flex items-center space-x-2 px-3 py-1 bg-blue-500/20 rounded-lg border border-blue-500/30">
            <span className="text-xs text-blue-300">🔐 SSO Enabled</span>
          </div>
        )}
      </div>

      {/* Action buttons - shown on hover */}
      <div className={`transition-all duration-300 ${showActions ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
            className="px-3 py-2 bg-gradient-to-r from-blue-500/80 to-purple-500/80 hover:from-blue-500 hover:to-purple-500 text-white rounded-lg text-xs font-medium transition-all"
          >
            Open
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRestart();
            }}
            disabled={isActionLoading}
            className="px-3 py-2 bg-yellow-500/80 hover:bg-yellow-500 text-white rounded-lg text-xs font-medium transition-all disabled:opacity-50"
          >
            {isActionLoading ? '...' : 'Restart'}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRebuild();
            }}
            disabled={isActionLoading}
            className="px-3 py-2 bg-purple-500/80 hover:bg-purple-500 text-white rounded-lg text-xs font-medium transition-all disabled:opacity-50"
          >
            {isActionLoading ? '...' : 'Rebuild'}
          </button>
        </div>
      </div>
    </div>
  );
}
