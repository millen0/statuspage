import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import StatusBanner from './components/StatusBanner';
import ServiceList from './components/ServiceList';
import IncidentTimeline from './components/IncidentTimeline';
import MaintenanceCard from './components/MaintenanceCard';
import HistorySection from './components/HistorySection';
import SubscribeForm from './components/SubscribeForm';
import { getHeartbeat, getIncidents, getMaintenances } from './services/api';

export default function App() {
  const [status, setStatus] = useState('operational');
  const [services, setServices] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [maintenances, setMaintenances] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('Fetching data from API...');
        const [heartbeatRes, incidentsRes, maintenancesRes] = await Promise.all([
          getHeartbeat(),
          getIncidents(),
          getMaintenances()
        ]);

        console.log('Heartbeat response:', heartbeatRes.data);
        console.log('Services:', heartbeatRes.data.services);
        
        const fetchedIncidents = incidentsRes.data || [];
        const activeIncidents = fetchedIncidents.filter(i => i.status !== 'resolved');
        const fetchedServices = heartbeatRes.data.services || [];
        const unavailableServices = fetchedServices.filter(s => s.status === 'outage' || s.status === 'degraded');
        
        // Determinar status baseado em serviços indisponíveis
        let finalStatus = 'operational';
        if (unavailableServices.length >= 2) {
          finalStatus = 'outage';
        } else if (unavailableServices.length === 1 || activeIncidents.length > 0) {
          finalStatus = 'degraded';
        }
        
        setStatus(finalStatus);
        setServices(fetchedServices);
        setIncidents(fetchedIncidents);
        setMaintenances(maintenancesRes.data || []);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-900">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <img 
              src="/piercloud-logo.png" 
              alt="Pier Cloud" 
              className="h-12 w-auto"
              style={{ objectFit: 'contain' }}
            />
            <div>
              <h1 className="text-2xl font-bold">Status</h1>
              <p className="text-gray-600 mt-1">Service status and incident history</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <StatusBanner status={status} />
        <MaintenanceCard maintenances={maintenances} />
        <ServiceList services={services} />
        <IncidentTimeline incidents={incidents} />
        <HistorySection incidents={incidents} />
      </main>

      <footer className="border-t border-gray-200 mt-16">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <SubscribeForm />
          <div className="mt-6 text-center flex justify-center gap-6">
            <Link to="/history" className="text-sm text-red-600 hover:text-red-800 font-medium">
              <span style={{ fontFamily: 'arial' }}>←</span> Incident History
            </Link>
            <Link to="/maintenance-history" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
              <span style={{ fontFamily: 'arial' }}>←</span> Maintenance History
            </Link>
          </div>
          
          {/* Status Legend */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 text-center mb-4">Status Legend</h3>
            <div className="flex justify-center gap-8 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-sm text-gray-600">Operational - All systems running normally</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <span className="text-sm text-gray-600">Degraded Performance - Partial service disruption</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span className="text-sm text-gray-600">Major Outage - Service unavailable</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span className="text-sm text-gray-600">Under Maintenance - Scheduled maintenance in progress</span>
              </div>
            </div>
          </div>
          
          <div className="text-center text-sm text-gray-600 mt-6">
            © 2026 Pier Cloud. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
// Force rebuild 1774371769
