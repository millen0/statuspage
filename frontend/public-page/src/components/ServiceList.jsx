import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export default function ServiceList({ services }) {
  const [displayMode, setDisplayMode] = useState('classic');
  const [uptimeData, setUptimeData] = useState({});

  useEffect(() => {
    const fetchDisplayMode = async () => {
      try {
        const res = await axios.get(`${API_URL}/public/display-mode`);
        setDisplayMode(res.data.display_mode || 'classic');
      } catch (error) {
        console.error('Error fetching display mode:', error);
      }
    };
    fetchDisplayMode();
  }, []);

  useEffect(() => {
    if (displayMode === 'uptime' && services && services.length > 0) {
      const fetchUptimeData = async () => {
        const uptimePromises = services.map(async (service) => {
          try {
            const res = await axios.get(`${API_URL}/public/services/${service.id}/uptime`);
            return { serviceId: service.id, data: res.data || [] };
          } catch (error) {
            console.error(`Error fetching uptime for service ${service.id}:`, error);
            return { serviceId: service.id, data: [] };
          }
        });
        
        const results = await Promise.all(uptimePromises);
        const uptimeMap = {};
        results.forEach(result => {
          uptimeMap[result.serviceId] = result.data;
        });
        setUptimeData(uptimeMap);
      };
      
      fetchUptimeData();
    }
  }, [displayMode, services]);

  const statusColors = {
    operational: 'bg-green-500',
    degraded: 'bg-yellow-500',
    outage: 'bg-red-500',
    maintenance: 'bg-blue-500'
  };

  const statusLabels = {
    operational: 'Operational',
    degraded: 'Degraded Performance',
    outage: 'Major Outage',
    maintenance: 'Under Maintenance'
  };

  const generateUptimeBars = (serviceId) => {
    const uptimeLogs = uptimeData[serviceId] || [];
    const bars = [];
    
    // Gerar últimos 90 dias
    const today = new Date();
    for (let i = 89; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      // Procurar log para este dia
      const log = uptimeLogs.find(l => l.date.startsWith(dateStr));
      
      let status = 'operational';
      if (log) {
        if (log.uptime_percentage < 50) {
          status = 'outage';
        } else if (log.uptime_percentage < 99) {
          status = 'degraded';
        }
      }
      
      bars.push(
        <div
          key={i}
          className={`h-8 flex-1 ${statusColors[status]} ${i === 89 ? 'rounded-l' : ''} ${i === 0 ? 'rounded-r' : ''}`}
          title={`${dateStr}: ${log ? log.uptime_percentage.toFixed(2) : '100.00'}% uptime`}
        />
      );
    }
    return bars;
  };

  const calculateOverallUptime = (serviceId) => {
    const uptimeLogs = uptimeData[serviceId] || [];
    if (uptimeLogs.length === 0) return '100.0';
    
    const avgUptime = uptimeLogs.reduce((sum, log) => sum + parseFloat(log.uptime_percentage), 0) / uptimeLogs.length;
    return avgUptime.toFixed(1);
  };

  if (displayMode === 'classic') {
    return (
      <div className="bg-white border border-gray-200 rounded-lg mb-8 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Services</h3>
        </div>
        <div className="grid grid-cols-2 gap-px bg-gray-200">
          {services && services.length > 0 ? (
            services.map((service) => (
              <div key={service.id} className="px-6 py-4 bg-white flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-4 flex-1">
                  <div className="font-medium">{service.name}</div>
                  <div className={`w-2 h-2 rounded-full ${statusColors[service.status]}`}></div>
                </div>
                <div className="text-sm text-gray-600">{statusLabels[service.status]}</div>
              </div>
            ))
          ) : (
            <div className="col-span-2 px-6 py-8 bg-white text-center text-gray-500">
              No services available
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 mb-8">
      {services && services.length > 0 ? (
        services.map((service) => (
          <div key={service.id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold">{service.name}</h3>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${service.status === 'operational' ? 'bg-green-100 text-green-800' : service.status === 'degraded' ? 'bg-yellow-100 text-yellow-800' : service.status === 'outage' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                {statusLabels[service.status]}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>90 days ago</span>
                <span className="font-medium">{calculateOverallUptime(service.id)}% uptime</span>
                <span>Today</span>
              </div>
              <div className="flex gap-0.5">
                {generateUptimeBars(service.id)}
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="col-span-2 bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
          No services available
        </div>
      )}
    </div>
  );
}
