import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getIncidents } from '../services/api';

export default function IncidentHistory() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchIncidents = async () => {
      try {
        const response = await getIncidents();
        const resolvedIncidents = (response.data || []).filter(i => i.status === 'resolved' && i.is_visible);
        setIncidents(resolvedIncidents);
      } catch (error) {
        console.error('Error fetching incidents:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchIncidents();
  }, []);

  const formatDate = (date) => {
    return new Date(date).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  };

  const groupIncidentsByMonth = (incidents) => {
    const grouped = {};
    incidents.forEach(incident => {
      const date = new Date(incident.resolved_at || incident.updated_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      
      if (!grouped[monthKey]) {
        grouped[monthKey] = {
          name: monthName,
          incidents: []
        };
      }
      grouped[monthKey].incidents.push(incident);
    });
    
    return Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0]));
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300';
      case 'major': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'minor': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default: return 'bg-blue-100 text-blue-800 border-blue-300';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-900">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  const groupedIncidents = groupIncidentsByMonth(incidents);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex flex-col items-center">
            <img 
              src="/piercloud-logo.png" 
              alt="Pier Cloud" 
              className="h-16 w-auto mb-2"
              style={{ objectFit: 'contain' }}
            />
            <h1 className="text-lg font-semibold text-gray-800">Pier Cloud Platform Status Page</h1>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link to="/" className="text-blue-600 hover:text-blue-800 text-sm font-medium">
            <span style={{ fontFamily: 'arial' }}>←</span> Back to Status Page
          </Link>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold">Incident History</h2>
            <p className="text-sm text-gray-600 mt-1">Past incidents and resolutions</p>
          </div>

          {incidents.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              <p>No incidents to display. All systems have been operational.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {groupedIncidents.map(([monthKey, monthData]) => (
                <div key={monthKey} className="px-6 py-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">{monthData.name}</h3>
                  <div className="space-y-4">
                    {monthData.incidents.map((incident) => (
                      <div key={incident.id} className="border-l-4 border-green-500 pl-4 py-2">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">{incident.title}</h4>
                            <span className={`inline-block mt-1 px-2 py-1 text-xs font-medium rounded border ${getSeverityColor(incident.severity)}`}>
                              {incident.severity || 'minor'}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 ml-4">
                            {formatDate(incident.resolved_at || incident.updated_at)}
                          </div>
                        </div>
                        <p className="text-sm text-gray-700 mt-2">{incident.description}</p>
                        {incident.affected_services && (
                          <div className="mt-2 text-xs text-gray-600">
                            <span className="font-medium">Affected services:</span> {incident.affected_services}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-gray-200 mt-16">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="text-center text-sm text-gray-600">
            © 2026 Pier Cloud. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
