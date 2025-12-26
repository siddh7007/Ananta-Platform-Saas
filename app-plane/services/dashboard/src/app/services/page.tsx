'use client';

import { getEnabledServices, getServiceStats } from '@/lib/services';

export default function ServicesPage() {
  const enabledServices = getEnabledServices();
  const stats = getServiceStats();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8">Platform Services</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {enabledServices.map((service) => (
            <a
              key={service.id}
              href={service.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-6 bg-white/10 backdrop-blur-lg rounded-lg hover:bg-white/20 transition-all duration-200 border border-white/20"
            >
              <div className="flex items-center space-x-3 mb-2">
                <span className="text-3xl">{service.icon}</span>
                <div>
                  <h3 className="text-lg font-semibold text-white">{service.name}</h3>
                  <p className="text-sm text-gray-300">{service.description}</p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-white/10 space-y-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs px-2 py-1 rounded ${service.color} bg-opacity-30 text-white`}>
                      {service.category}
                    </span>
                    {service.route && (
                      <span className="text-xs text-gray-300 font-mono">
                        {service.route}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-1 text-xs text-gray-300 font-mono">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Traefik URL</span>
                      <span className="break-all">{service.url}</span>
                    </div>
                    {service.externalPort && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Traefik Port</span>
                        <span>{service.externalPort}</span>
                      </div>
                    )}
                    {service.directUrl && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Direct URL</span>
                        <a
                          href={service.directUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-300 hover:underline"
                        >
                          {service.directUrl}
                        </a>
                      </div>
                    )}
                    {service.directPort && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Direct Port</span>
                        <span>{service.directPort}</span>
                      </div>
                    )}
                    {service.internalPort && (
                      <div className="flex justify-between">
                        <span className="text-gray-400">Container Port</span>
                        <span>{service.internalPort}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>

        <div className="mt-8 p-6 bg-white/5 rounded-lg border border-white/10">
          <h2 className="text-xl font-bold text-white mb-4">Service Statistics</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-white">{stats.total}</div>
              <div className="text-sm text-gray-400">Total Services</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-400">
                {stats.byCategory['core'] ?? 0}
              </div>
              <div className="text-sm text-gray-400">Core</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-400">
                {stats.byCategory['automation'] ?? 0}
              </div>
              <div className="text-sm text-gray-400">Automation</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-400">
                {stats.byCategory['observability'] ?? 0}
              </div>
              <div className="text-sm text-gray-400">Observability</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
