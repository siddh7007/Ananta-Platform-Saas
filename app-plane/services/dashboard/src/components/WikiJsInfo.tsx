'use client';

/**
 * Wiki.js Information Component
 * Displays health check, admin profile, and statistics for Wiki.js
 */

import { useEffect, useState } from 'react';

interface WikiJsHealth {
  success: boolean;
  status?: string;
  status_code?: number;
  error?: string;
}

interface WikiJsInfo {
  success: boolean;
  config?: {
    title?: string;
    description?: string;
    company?: string;
    logoUrl?: string;
  };
  error?: string;
}

interface WikiJsStats {
  totalPages: number;
  recentUpdates: number;
  lastUpdate: string;
}

export default function WikiJsInfo() {
  const [health, setHealth] = useState<WikiJsHealth | null>(null);
  const [info, setInfo] = useState<WikiJsInfo | null>(null);
  const [stats, setStats] = useState<WikiJsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWikiJsData = async () => {
      try {
        setLoading(true);

        // Fetch health check from MCP Gateway
        const healthResponse = await fetch('http://localhost:27150/execute', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tool: 'wikijs.wiki_health',
            parameters: {}
          }),
        });

        if (healthResponse.ok) {
          const healthData = await healthResponse.json();
          if (healthData.success && healthData.result) {
            setHealth(healthData.result);
          }
        }

        // Fetch Wiki.js info (system configuration)
        const infoResponse = await fetch('http://localhost:27150/execute', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tool: 'wikijs.wiki_get_info',
            parameters: {}
          }),
        });

        if (infoResponse.ok) {
          const infoData = await infoResponse.json();
          if (infoData.success && infoData.result) {
            setInfo(infoData.result);
          }
        }

        // Fetch Wiki.js page statistics
        const pagesResponse = await fetch('http://localhost:27150/execute', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tool: 'wikijs.wiki_list_pages',
            parameters: {
              limit: 100,
              orderBy: 'UPDATED'
            }
          }),
        });

        if (pagesResponse.ok) {
          const pagesData = await pagesResponse.json();
          if (pagesData.success && pagesData.result && pagesData.result.pages) {
            const pages = pagesData.result.pages;
            setStats({
              totalPages: pagesData.result.count || pages.length,
              recentUpdates: pages.filter((p: any) => {
                const updated = new Date(p.updatedAt);
                const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
                return updated > dayAgo;
              }).length,
              lastUpdate: pages[0]?.updatedAt || 'N/A'
            });
          }
        }

        setLoading(false);
      } catch (err) {
        console.error('Error fetching Wiki.js data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch Wiki.js data');
        setLoading(false);
      }
    };

    fetchWikiJsData();

    // Refresh every 60 seconds
    const interval = setInterval(fetchWikiJsData, 60000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="text-4xl">📚</div>
          <div>
            <h3 className="text-xl font-bold text-white">Wiki.js</h3>
            <p className="text-sm text-gray-400">Loading...</p>
          </div>
        </div>
        <div className="shimmer h-20 w-full rounded"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass rounded-2xl p-6 border-2 border-red-500/30">
        <div className="flex items-center space-x-3 mb-4">
          <div className="text-4xl">📚</div>
          <div>
            <h3 className="text-xl font-bold text-white">Wiki.js</h3>
            <p className="text-sm text-red-400">Error: {error}</p>
          </div>
        </div>
      </div>
    );
  }

  const isHealthy = health?.success && health.status === 'healthy';

  return (
    <div className="glass rounded-2xl p-6 glow-on-hover">
      {/* Header with Health Status */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="text-4xl">📚</div>
          <div>
            <h3 className="text-xl font-bold text-white">Wiki.js</h3>
            <p className="text-sm text-gray-400">Documentation & Knowledge Base</p>
          </div>
        </div>

        {/* Health Indicator */}
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${isHealthy ? 'bg-green-500 pulse-glow' : 'bg-red-500'}`}></div>
          <span className={`text-sm font-medium ${isHealthy ? 'text-green-400' : 'text-red-400'}`}>
            {isHealthy ? 'Healthy' : 'Unhealthy'}
          </span>
        </div>
      </div>

      {/* System Information */}
      {info?.success && info.config && (
        <div className="mb-6 p-4 bg-white/5 rounded-xl">
          <h4 className="text-sm font-semibold text-blue-300 mb-3">System Information</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Title:</span>
              <span className="text-white font-medium">{info.config.title || 'Wiki.js'}</span>
            </div>
            {info.config.description && (
              <div className="flex justify-between">
                <span className="text-gray-400">Description:</span>
                <span className="text-white font-medium">{info.config.description}</span>
              </div>
            )}
            {info.config.company && (
              <div className="flex justify-between">
                <span className="text-gray-400">Organization:</span>
                <span className="text-white font-medium">{info.config.company}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Statistics Grid */}
      {stats && (
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-xl border border-indigo-500/30">
            <div className="text-3xl font-bold text-indigo-300">{stats.totalPages}</div>
            <div className="text-sm text-gray-400 mt-1">Total Pages</div>
          </div>

          <div className="p-4 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl border border-green-500/30">
            <div className="text-3xl font-bold text-green-300">{stats.recentUpdates}</div>
            <div className="text-sm text-gray-400 mt-1">Updates (24h)</div>
          </div>
        </div>
      )}

      {/* Admin Access Info */}
      <div className="mt-6 p-4 bg-blue-500/10 rounded-xl border border-blue-500/30">
        <div className="flex items-center space-x-2 mb-2">
          <span className="text-xl">🔐</span>
          <h4 className="text-sm font-semibold text-blue-300">Admin Access</h4>
        </div>
        <div className="space-y-1 text-xs text-gray-400">
          <div>Email: <span className="text-white font-mono">admin@components.local</span></div>
          <div>Password: <span className="text-white font-mono">admin123</span></div>
          <div>Direct URL: <a href="http://localhost:27910" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">http://localhost:27910</a></div>
          <div>MCP Tools: <span className="text-green-400 font-semibold">13 available</span></div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <a
          href="http://localhost:27910"
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-lg text-sm font-medium transition-all text-center"
        >
          Open Wiki
        </a>
        <a
          href="http://localhost:27150/wikijs/tools"
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white rounded-lg text-sm font-medium transition-all text-center"
        >
          MCP Tools
        </a>
      </div>
    </div>
  );
}
