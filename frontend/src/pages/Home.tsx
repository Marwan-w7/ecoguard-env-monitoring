import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import { LatLngTuple } from 'leaflet';
// import { AlertTriangle, Thermometer, Wind, Droplets } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in React-Leaflet
import L from 'leaflet';
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface Event {
  id: string;
  type: string;
  severity: number;
  geometry: { coordinates: [number, number] };
  properties: any;
  starts_at: string;
}

interface RiskData {
  overall_risk: string;
  risk_score: number;
  risks: {
    earthquake: { level: string; score: number };
    flood: { level: string; score: number };
    storm: { level: string; score: number };
    fire: { level: string; score: number };
    aqi: { level: string; score: number };
  };
}

export const Home: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [userLocation, setUserLocation] = useState<LatLngTuple>([3.139, 101.687]); // KL default
  const [riskData, setRiskData] = useState<RiskData | null>(null);
  const [radius, setRadius] = useState(25);
  const { isConnected, subscribe, requestPermission } = useNotifications();

  useEffect(() => {
    // Get user location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
        },
        () => console.log('Location access denied')
      );
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    fetchRiskData();
  }, [userLocation]);

  const fetchEvents = async () => {
    try {
      const [lat, lng] = userLocation;
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/v1/events/near/${lat}/${lng}?radius_km=100&limit=20`);
      if (response.ok) {
        const data = await response.json();
        setEvents(data.events || []);
      }
    } catch (error) {
      console.error('Failed to fetch events:', error);
    }
  };

  const fetchRiskData = async () => {
    try {
      const [lat, lng] = userLocation;
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/v1/risk/now?lat=${lat}&lng=${lng}&radius_km=${radius}`);
      if (response.ok) {
        const data = await response.json();
        setRiskData(data.risk_assessment);
      }
    } catch (error) {
      console.error('Failed to fetch risk data:', error);
    }
  };

  const handleSubscribe = async () => {
    const granted = await requestPermission();
    if (granted) {
      await subscribe({ lat: userLocation[0], lng: userLocation[1] }, radius);
      alert('Subscribed to alerts for this location!');
    } else {
      alert('Please enable notifications to receive alerts');
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'very high': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'moderate': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'earthquake': return '#8B5CF6';
      case 'flood': return '#3B82F6';
      case 'fire': return '#EF4444';
      case 'storm': return '#6B7280';
      case 'aqi': return '#F59E0B';
      default: return '#6B7280';
    }
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-80 bg-white shadow-lg overflow-y-auto">
        <div className="p-4">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">EcoGuard Dashboard</h1>
          
          {/* Connection Status */}
          <div className={`mb-4 p-2 rounded ${isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </div>

          {/* Risk Overview */}
          {riskData && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-3">Current Risk Level</h2>
              <div className={`p-3 rounded-lg ${getRiskColor(riskData.overall_risk)}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium capitalize">{riskData.overall_risk}</span>
                  <span className="text-sm">Score: {riskData.risk_score}/10</span>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {Object.entries(riskData.risks).map(([type, risk]) => (
                  <div key={type} className="flex items-center justify-between text-sm">
                    <span className="capitalize">{type}:</span>
                    <span className={`px-2 py-1 rounded text-xs ${getRiskColor(risk.level)}`}>
                      {risk.level}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Subscribe Section */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3">Alert Settings</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Alert Radius (km)</label>
                <input
                  type="range"
                  min="5"
                  max="100"
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                  className="w-full"
                />
                <span className="text-sm text-gray-600">{radius} km</span>
              </div>
              <button
                onClick={handleSubscribe}
                className="w-full bg-primary text-white py-2 px-4 rounded hover:bg-opacity-90"
              >
                Subscribe to Alerts
              </button>
            </div>
          </div>

          {/* Recent Events */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Recent Events ({events.length})</h2>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {events.map((event) => (
                <div key={event.id} className="p-2 border rounded text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium capitalize" style={{ color: getEventColor(event.type) }}>
                      {event.type}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(event.starts_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-gray-600">
                    Severity: {event.severity.toFixed(1)}
                  </div>
                  {event.properties.place && (
                    <div className="text-gray-500 text-xs">{event.properties.place}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1">
        <MapContainer
          center={userLocation}
          zoom={8}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          
          {/* User location */}
          <Marker position={userLocation}>
            <Popup>Your Location</Popup>
          </Marker>
          
          {/* Alert radius */}
          <Circle
            center={userLocation}
            radius={radius * 1000}
            pathOptions={{ color: 'blue', fillOpacity: 0.1 }}
          />

          {/* Events */}
          {events.map((event) => (
            <Marker
              key={event.id}
              position={[event.geometry.coordinates[1], event.geometry.coordinates[0]]}
            >
              <Popup>
                <div>
                  <h3 className="font-bold capitalize">{event.type}</h3>
                  <p>Severity: {event.severity.toFixed(1)}</p>
                  <p>Time: {new Date(event.starts_at).toLocaleString()}</p>
                  {event.properties.place && <p>Location: {event.properties.place}</p>}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
};