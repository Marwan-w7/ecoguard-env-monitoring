import React from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { Bell, Clock, MapPin } from 'lucide-react';

export const Alerts: React.FC = () => {
  const { notifications, isConnected } = useNotifications();

  const getSeverityColor = (severity: number) => {
    if (severity >= 8) return 'bg-red-100 border-red-500 text-red-800';
    if (severity >= 6) return 'bg-orange-100 border-orange-500 text-orange-800';
    if (severity >= 4) return 'bg-yellow-100 border-yellow-500 text-yellow-800';
    return 'bg-blue-100 border-blue-500 text-blue-800';
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Alert History</h1>
        <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
          isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-12">
          <Bell className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No alerts yet</h3>
          <p className="text-gray-500">
            Subscribe to locations on the map to receive real-time disaster alerts.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.map((alert, index) => (
            <div
              key={`${alert.id}-${index}`}
              className={`border-l-4 p-4 rounded-lg shadow-sm ${getSeverityColor(alert.severity)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <h3 className="text-lg font-semibold">{alert.title}</h3>
                    <span className="px-2 py-1 text-xs font-medium bg-white bg-opacity-50 rounded">
                      {alert.type?.toUpperCase()}
                    </span>
                  </div>
                  
                  <p className="text-gray-700 mb-3">{alert.body}</p>
                  
                  {alert.action && (
                    <div className="bg-white bg-opacity-50 p-2 rounded text-sm font-medium">
                      💡 {alert.action}
                    </div>
                  )}
                </div>
                
                <div className="text-right text-sm text-gray-600 ml-4">
                  <div className="flex items-center space-x-1 mb-1">
                    <Clock className="h-4 w-4" />
                    <span>{new Date(alert.timestamp).toLocaleTimeString()}</span>
                  </div>
                  {alert.location && (
                    <div className="flex items-center space-x-1">
                      <MapPin className="h-4 w-4" />
                      <span>
                        {alert.location[1]?.toFixed(2)}, {alert.location[0]?.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {alert.severity && (
                    <div className="mt-1">
                      <span className="font-medium">Severity: {alert.severity.toFixed(1)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};