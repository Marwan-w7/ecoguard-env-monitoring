import React, { useState, useEffect } from 'react';
import { Activity, Database, Users, Zap, RefreshCw } from 'lucide-react';

interface Metrics {
  system: {
    uptime_seconds: number;
    memory_usage: any;
    environment: string;
  };
  events: {
    total: number;
    last_24h: number;
    high_severity_24h: number;
    by_source: Array<{ _id: string; count: number }>;
    by_type: Array<{ _id: string; count: number; avg_severity: number }>;
  };
  subscriptions: {
    total: number;
    active_30d: number;
  };
  ingestion: {
    sources_configured: string[];
    last_ingestion: string;
    ingestion_rate_per_hour: number;
  };
}

export const Admin: React.FC = () => {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchMetrics = async () => {
    try {
      const response = await fetch('http://localhost:8080/v1/metrics/json');
      if (response.ok) {
        const data = await response.json();
        setMetrics(data.metrics);
        setLastUpdate(new Date());
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatMemory = (bytes: number) => {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const triggerIngestion = async (source: string) => {
    try {
      const response = await fetch(`http://localhost:8080/v1/ingest/${source}`, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer test-token-123' }
      });
      
      if (response.ok) {
        const result = await response.json();
        alert(`${source.toUpperCase()} ingestion completed: ${result.inserted} new, ${result.updated} updated`);
        fetchMetrics(); // Refresh metrics
      } else {
        alert(`Ingestion failed: ${response.statusText}`);
      }
    } catch (error) {
      alert(`Ingestion error: ${error}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Failed to load metrics</p>
        <button onClick={fetchMetrics} className="mt-4 px-4 py-2 bg-primary text-white rounded">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-800">System Administration</h1>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-500">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </span>
          <button
            onClick={fetchMetrics}
            className="flex items-center space-x-2 px-3 py-2 bg-primary text-white rounded hover:bg-opacity-90"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* System Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">System Uptime</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatUptime(metrics.system.uptime_seconds)}
              </p>
            </div>
            <Activity className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Events</p>
              <p className="text-2xl font-bold text-gray-900">{metrics.events.total}</p>
              <p className="text-xs text-gray-500">+{metrics.events.last_24h} today</p>
            </div>
            <Database className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Subscriptions</p>
              <p className="text-2xl font-bold text-gray-900">{metrics.subscriptions.total}</p>
              <p className="text-xs text-gray-500">{metrics.subscriptions.active_30d} active</p>
            </div>
            <Users className="h-8 w-8 text-purple-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">High Severity</p>
              <p className="text-2xl font-bold text-gray-900">{metrics.events.high_severity_24h}</p>
              <p className="text-xs text-gray-500">Last 24 hours</p>
            </div>
            <Zap className="h-8 w-8 text-red-500" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Data Sources */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Data Sources</h2>
          <div className="space-y-3">
            {metrics.ingestion.sources_configured.map((source) => (
              <div key={source} className="flex items-center justify-between p-3 border rounded">
                <div>
                  <span className="font-medium capitalize">{source}</span>
                  <div className="text-sm text-gray-500">
                    {source === 'usgs' && 'USGS Earthquake Hazards Program'}
                    {source === 'nasa-eonet' && 'NASA Earth Observatory Natural Event Tracker'}
                    {source === 'openweather' && 'OpenWeather API'}
                    {source === 'openaq' && 'OpenAQ Air Quality API'}
                  </div>
                </div>
                <button
                  onClick={() => triggerIngestion(source)}
                  className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                >
                  Ingest Now
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Events by Type */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Events by Type</h2>
          <div className="space-y-3">
            {metrics.events.by_type.map((type) => (
              <div key={type._id} className="flex items-center justify-between">
                <span className="capitalize font-medium">{type._id}</span>
                <div className="text-right">
                  <div className="font-bold">{type.count}</div>
                  <div className="text-sm text-gray-500">
                    Avg: {type.avg_severity?.toFixed(1) || 'N/A'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Events by Source */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Events by Source</h2>
          <div className="space-y-3">
            {metrics.events.by_source.map((source) => (
              <div key={source._id} className="flex items-center justify-between">
                <span className="font-medium">{source._id}</span>
                <span className="font-bold">{source.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* System Info */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">System Information</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span>Environment:</span>
              <span className="font-medium">{metrics.system.environment}</span>
            </div>
            <div className="flex justify-between">
              <span>Memory (RSS):</span>
              <span className="font-medium">{formatMemory(metrics.system.memory_usage.rss)}</span>
            </div>
            <div className="flex justify-between">
              <span>Heap Used:</span>
              <span className="font-medium">{formatMemory(metrics.system.memory_usage.heapUsed)}</span>
            </div>
            <div className="flex justify-between">
              <span>Ingestion Rate:</span>
              <span className="font-medium">{metrics.ingestion.ingestion_rate_per_hour}/hour</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};