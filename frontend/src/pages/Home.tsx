import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import { LatLngTuple } from 'leaflet';
import { AlertTriangle, Thermometer, Wind, Droplets, Eye, Zap, Menu, X, Bell, Shield, MapPin } from 'lucide-react';
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [airQuality, setAirQuality] = useState<any>(null);
  const [weather, setWeather] = useState<any>(null);
  const [loading, setLoading] = useState(true);
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
    fetchAllData();
  }, [userLocation]);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchEvents(),
      fetchRiskData(),
      fetchAirQuality(),
      fetchWeather()
    ]);
    setLoading(false);
  };

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
      // Mock data for demo
      setRiskData({
        overall_risk: 'moderate',
        risk_score: 6.2,
        risks: {
          earthquake: { level: 'low', score: 2.1 },
          flood: { level: 'moderate', score: 5.8 },
          storm: { level: 'high', score: 7.3 },
          fire: { level: 'low', score: 1.9 },
          aqi: { level: 'moderate', score: 6.5 }
        }
      });
    }
  };

  const fetchAirQuality = async () => {
    try {
      // Mock air quality data based on location
      setAirQuality({
        aqi: Math.floor(Math.random() * 150) + 50,
        pm25: Math.floor(Math.random() * 50) + 10,
        pm10: Math.floor(Math.random() * 80) + 20,
        o3: Math.floor(Math.random() * 100) + 30,
        no2: Math.floor(Math.random() * 60) + 15,
        so2: Math.floor(Math.random() * 40) + 5
      });
    } catch (error) {
      console.error('Failed to fetch air quality:', error);
    }
  };

  const fetchWeather = async () => {
    try {
      // Mock weather data based on location
      setWeather({
        temperature: Math.floor(Math.random() * 15) + 20,
        humidity: Math.floor(Math.random() * 40) + 40,
        windSpeed: Math.floor(Math.random() * 20) + 5,
        pressure: Math.floor(Math.random() * 50) + 1000,
        visibility: Math.floor(Math.random() * 10) + 5,
        uvIndex: Math.floor(Math.random() * 8) + 1
      });
    } catch (error) {
      console.error('Failed to fetch weather:', error);
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

  const getAQIColor = (aqi: number) => {
    if (aqi <= 50) return 'text-green-600 bg-green-100';
    if (aqi <= 100) return 'text-yellow-600 bg-yellow-100';
    if (aqi <= 150) return 'text-orange-600 bg-orange-100';
    if (aqi <= 200) return 'text-red-600 bg-red-100';
    return 'text-purple-600 bg-purple-100';
  };

  const getAQILevel = (aqi: number) => {
    if (aqi <= 50) return 'Good';
    if (aqi <= 100) return 'Moderate';
    if (aqi <= 150) return 'Unhealthy for Sensitive';
    if (aqi <= 200) return 'Unhealthy';
    return 'Very Unhealthy';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50">
      {/* Mobile Header */}
      <div className="lg:hidden bg-white shadow-sm border-b">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-2">
            <Shield className="h-6 w-6 text-green-600" />
            <h1 className="text-lg font-bold text-gray-800">EcoGuard</h1>
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <div className="flex h-screen lg:h-[calc(100vh-4rem)]">
        {/* Sidebar - Mobile Overlay / Desktop Fixed */}
        <div className={`
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 fixed lg:relative z-30 lg:z-0
          w-80 lg:w-96 bg-white shadow-xl lg:shadow-lg
          transition-transform duration-300 ease-in-out
          overflow-y-auto h-full
        `}>
          {/* Desktop Header */}
          <div className="hidden lg:block p-6 border-b bg-gradient-to-r from-green-600 to-blue-600 text-white">
            <div className="flex items-center space-x-3">
              <Shield className="h-8 w-8" />
              <div>
                <h1 className="text-2xl font-bold">EcoGuard</h1>
                <p className="text-green-100 text-sm">Environmental Monitoring</p>
              </div>
            </div>
          </div>

          <div className="p-4 lg:p-6 space-y-6">
            {/* Connection Status */}
            <div className={`flex items-center space-x-2 p-3 rounded-lg ${isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="font-medium">{isConnected ? 'Connected' : 'Disconnected'}</span>
            </div>

            {/* Current Location */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <MapPin className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-800">Current Location</span>
              </div>
              <p className="text-sm text-blue-600">
                {userLocation[0].toFixed(4)}, {userLocation[1].toFixed(4)}
              </p>
            </div>

            {/* Air Quality */}
            {airQuality && (
              <div className="bg-white border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <Eye className="h-5 w-5 text-gray-600" />
                    <h3 className="font-semibold">Air Quality</h3>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-sm font-medium ${getAQIColor(airQuality.aqi)}`}>
                    {airQuality.aqi} AQI
                  </div>
                </div>
                <p className={`text-sm mb-3 ${getAQIColor(airQuality.aqi).split(' ')[0]}`}>
                  {getAQILevel(airQuality.aqi)}
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-gray-50 p-2 rounded">
                    <div className="text-gray-500">PM2.5</div>
                    <div className="font-medium">{airQuality.pm25} μg/m³</div>
                  </div>
                  <div className="bg-gray-50 p-2 rounded">
                    <div className="text-gray-500">PM10</div>
                    <div className="font-medium">{airQuality.pm10} μg/m³</div>
                  </div>
                  <div className="bg-gray-50 p-2 rounded">
                    <div className="text-gray-500">O₃</div>
                    <div className="font-medium">{airQuality.o3} μg/m³</div>
                  </div>
                  <div className="bg-gray-50 p-2 rounded">
                    <div className="text-gray-500">NO₂</div>
                    <div className="font-medium">{airQuality.no2} μg/m³</div>
                  </div>
                </div>
              </div>
            )}

            {/* Weather */}
            {weather && (
              <div className="bg-white border rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-3">
                  <Thermometer className="h-5 w-5 text-orange-500" />
                  <h3 className="font-semibold">Weather Conditions</h3>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center space-x-2">
                    <Thermometer className="h-4 w-4 text-red-500" />
                    <span>{weather.temperature}°C</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Droplets className="h-4 w-4 text-blue-500" />
                    <span>{weather.humidity}%</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Wind className="h-4 w-4 text-gray-500" />
                    <span>{weather.windSpeed} km/h</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Eye className="h-4 w-4 text-purple-500" />
                    <span>{weather.visibility} km</span>
                  </div>
                </div>
              </div>
            )}

            {/* Risk Overview */}
            {riskData && (
              <div className="bg-white border rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-3">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  <h3 className="font-semibold">Risk Assessment</h3>
                </div>
                <div className={`p-3 rounded-lg mb-3 ${getRiskColor(riskData.overall_risk)}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium capitalize">{riskData.overall_risk} Risk</span>
                    <span className="text-sm">{riskData.risk_score}/10</span>
                  </div>
                </div>
                <div className="space-y-2">
                  {Object.entries(riskData.risks).map(([type, risk]) => (
                    <div key={type} className="flex items-center justify-between text-sm">
                      <span className="capitalize flex items-center space-x-2">
                        {type === 'earthquake' && <Zap className="h-3 w-3" />}
                        {type === 'flood' && <Droplets className="h-3 w-3" />}
                        {type === 'storm' && <Wind className="h-3 w-3" />}
                        {type === 'fire' && <AlertTriangle className="h-3 w-3" />}
                        {type === 'aqi' && <Eye className="h-3 w-3" />}
                        <span>{type}</span>
                      </span>
                      <span className={`px-2 py-1 rounded text-xs ${getRiskColor(risk.level)}`}>
                        {risk.level}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Alert Settings */}
            <div className="bg-white border rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-3">
                <Bell className="h-5 w-5 text-blue-500" />
                <h3 className="font-semibold">Alert Settings</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-2">Alert Radius: {radius} km</label>
                  <input
                    type="range"
                    min="5"
                    max="100"
                    value={radius}
                    onChange={(e) => setRadius(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
                <button
                  onClick={handleSubscribe}
                  className="w-full bg-gradient-to-r from-green-600 to-blue-600 text-white py-3 px-4 rounded-lg hover:from-green-700 hover:to-blue-700 transition-all duration-200 font-medium"
                >
                  Subscribe to Alerts
                </button>
              </div>
            </div>

            {/* Recent Events */}
            <div className="bg-white border rounded-lg p-4">
              <h3 className="font-semibold mb-3">Recent Events ({events.length})</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {events.length > 0 ? events.map((event) => (
                  <div key={event.id} className="p-3 bg-gray-50 rounded-lg text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium capitalize" style={{ color: getEventColor(event.type) }}>
                        {event.type}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(event.starts_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-gray-600 text-xs">
                      Severity: {event.severity.toFixed(1)}
                    </div>
                    {event.properties.place && (
                      <div className="text-gray-500 text-xs mt-1">{event.properties.place}</div>
                    )}
                  </div>
                )) : (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    No recent events in your area
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Overlay */}
        {sidebarOpen && (
          <div
            className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-20"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Map Container */}
        <div className="flex-1 relative">
          {loading && (
            <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading environmental data...</p>
              </div>
            </div>
          )}

          <MapContainer
            center={userLocation}
            zoom={10}
            style={{ height: '100%', width: '100%' }}
            className="rounded-lg lg:rounded-none"
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />

            {/* User location */}
            <Marker position={userLocation}>
              <Popup>
                <div className="text-center">
                  <h3 className="font-bold text-green-600">Your Location</h3>
                  <p className="text-sm text-gray-600">
                    {userLocation[0].toFixed(4)}, {userLocation[1].toFixed(4)}
                  </p>
                  {airQuality && (
                    <div className="mt-2">
                      <div className={`inline-block px-2 py-1 rounded text-xs ${getAQIColor(airQuality.aqi)}`}>
                        AQI: {airQuality.aqi} ({getAQILevel(airQuality.aqi)})
                      </div>
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>

            {/* Alert radius */}
            <Circle
              center={userLocation}
              radius={radius * 1000}
              pathOptions={{
                color: '#3B82F6',
                fillColor: '#3B82F6',
                fillOpacity: 0.1,
                weight: 2
              }}
            />

            {/* Events */}
            {events.map((event) => (
              <Marker
                key={event.id}
                position={[event.geometry.coordinates[1], event.geometry.coordinates[0]]}
              >
                <Popup>
                  <div className="min-w-48">
                    <h3 className="font-bold capitalize text-lg mb-2" style={{ color: getEventColor(event.type) }}>
                      {event.type}
                    </h3>
                    <div className="space-y-1 text-sm">
                      <p><strong>Severity:</strong> {event.severity.toFixed(1)}/10</p>
                      <p><strong>Time:</strong> {new Date(event.starts_at).toLocaleString()}</p>
                      {event.properties.place && (
                        <p><strong>Location:</strong> {event.properties.place}</p>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
};