import React, { useState } from 'react';
import { AlertTriangle, Droplets, Flame, Wind, Thermometer } from 'lucide-react';

interface Guide {
  type: string;
  icon: React.ComponentType<any>;
  title: string;
  description: string;
  actions: string[];
  preparation: string[];
}

const guides: Guide[] = [
  {
    type: 'earthquake',
    icon: AlertTriangle,
    title: 'Earthquake Safety',
    description: 'Sudden ground shaking caused by tectonic plate movement.',
    actions: [
      'Drop to hands and knees immediately',
      'Take cover under a sturdy desk or table',
      'Hold on to your shelter and protect your head',
      'Stay away from windows, mirrors, and heavy objects',
      'If outdoors, move away from buildings and power lines',
      'If driving, pull over and stay in the vehicle'
    ],
    preparation: [
      'Secure heavy furniture and appliances to walls',
      'Keep emergency supplies (water, food, flashlight)',
      'Identify safe spots in each room',
      'Practice drop, cover, and hold on drills',
      'Know how to turn off gas, water, and electricity'
    ]
  },
  {
    type: 'flood',
    icon: Droplets,
    title: 'Flood Safety',
    description: 'Rising water levels that can cause property damage and endanger lives.',
    actions: [
      'Move to higher ground immediately',
      'Avoid walking or driving through flood water',
      'Stay away from downed power lines',
      'Listen to emergency broadcasts for updates',
      'If trapped, signal for help from the highest point',
      'Do not return home until authorities say it\'s safe'
    ],
    preparation: [
      'Know your evacuation routes',
      'Keep important documents in waterproof container',
      'Install sump pumps and backup power',
      'Clear gutters and storm drains regularly',
      'Consider flood insurance'
    ]
  },
  {
    type: 'fire',
    icon: Flame,
    title: 'Wildfire Safety',
    description: 'Uncontrolled fires that spread rapidly through vegetation.',
    actions: [
      'Evacuate immediately if ordered',
      'Close all windows and doors',
      'Remove flammable materials from around your home',
      'Connect garden hoses to water sources',
      'Wear protective clothing and N95 masks',
      'Stay tuned to emergency broadcasts'
    ],
    preparation: [
      'Create defensible space around your home',
      'Use fire-resistant building materials',
      'Maintain an emergency evacuation kit',
      'Plan multiple evacuation routes',
      'Register for emergency alerts'
    ]
  },
  {
    type: 'storm',
    icon: Wind,
    title: 'Severe Weather',
    description: 'High winds, heavy rain, hail, and lightning that can cause damage.',
    actions: [
      'Stay indoors and away from windows',
      'Avoid using electrical appliances',
      'Do not take shelter under trees',
      'If driving, pull over safely and wait',
      'Stay in the center of the building on the lowest floor',
      'Monitor weather alerts continuously'
    ],
    preparation: [
      'Trim trees near your home',
      'Secure outdoor furniture and decorations',
      'Check and clean gutters',
      'Install surge protectors',
      'Keep battery-powered radio available'
    ]
  },
  {
    type: 'aqi',
    icon: Thermometer,
    title: 'Air Quality Alerts',
    description: 'Poor air quality that can affect health, especially for sensitive groups.',
    actions: [
      'Stay indoors with windows and doors closed',
      'Use air purifiers if available',
      'Wear N95 or P100 masks when outdoors',
      'Avoid outdoor exercise and activities',
      'Keep rescue medications nearby if you have respiratory conditions',
      'Monitor air quality index regularly'
    ],
    preparation: [
      'Install air filtration systems',
      'Keep masks and air purifiers ready',
      'Know your local air quality monitoring sites',
      'Plan indoor activities for poor air days',
      'Consult doctor about air quality action plans'
    ]
  }
];

export const Guides: React.FC = () => {
  const [selectedGuide, setSelectedGuide] = useState<Guide>(guides[0]);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Emergency Preparedness Guides</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Guide Selection */}
        <div className="lg:col-span-1">
          <h2 className="text-xl font-semibold mb-4">Disaster Types</h2>
          <div className="space-y-2">
            {guides.map((guide) => {
              const Icon = guide.icon;
              return (
                <button
                  key={guide.type}
                  onClick={() => setSelectedGuide(guide)}
                  className={`w-full text-left p-4 rounded-lg border transition-colors ${
                    selectedGuide.type === guide.type
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white hover:bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className="h-6 w-6" />
                    <div>
                      <div className="font-medium">{guide.title}</div>
                      <div className={`text-sm ${
                        selectedGuide.type === guide.type ? 'text-white text-opacity-80' : 'text-gray-500'
                      }`}>
                        {guide.type}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Guide Content */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center space-x-3 mb-4">
              <selectedGuide.icon className="h-8 w-8 text-primary" />
              <h2 className="text-2xl font-bold text-gray-800">{selectedGuide.title}</h2>
            </div>
            
            <p className="text-gray-600 mb-6">{selectedGuide.description}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* During Emergency */}
              <div>
                <h3 className="text-lg font-semibold text-red-600 mb-3 flex items-center">
                  <AlertTriangle className="h-5 w-5 mr-2" />
                  During Emergency
                </h3>
                <ul className="space-y-2">
                  {selectedGuide.actions.map((action, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <span className="bg-red-100 text-red-600 rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium flex-shrink-0 mt-0.5">
                        {index + 1}
                      </span>
                      <span className="text-gray-700">{action}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Preparation */}
              <div>
                <h3 className="text-lg font-semibold text-blue-600 mb-3 flex items-center">
                  <Wind className="h-5 w-5 mr-2" />
                  Preparation
                </h3>
                <ul className="space-y-2">
                  {selectedGuide.preparation.map((item, index) => (
                    <li key={index} className="flex items-start space-x-2">
                      <span className="bg-blue-100 text-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium flex-shrink-0 mt-0.5">
                        {index + 1}
                      </span>
                      <span className="text-gray-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800 text-sm">
                <strong>Remember:</strong> Always follow local emergency management guidance and evacuation orders. 
                These are general guidelines and may not apply to all situations.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};