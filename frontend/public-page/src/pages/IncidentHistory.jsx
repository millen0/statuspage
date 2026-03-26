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
    const d = new Date(date);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`;
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'resolved': return 'Resolved';
      case 'monitoring': return 'Monitoring';
      case 'identified': return 'Identified';
      case 'investigating': return 'Investigating';
      default: return 'Update';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'resolved': return 'text-green-600';
      case 'monitoring': return 'text-blue-600';
      case 'identified': return 'text-yellow-600';
      case 'investigating': return 'text-red-600';
      default: return 'text-gray-600';
    }
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
          <div className="flex items-center">
            <div className="flex flex-col">
              <img 
                src="/piercloud-logo.png" 
                alt="Pier Cloud" 
                className="h-16 w-auto mb-2"
                style={{ objectFit: 'contain' }}
              />
              <h1 className="text-lg font-semibold text-gray-800">Pier Cloud Platform Status Page</h1>
            </div>
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
                  <div className="space-y-6">
                    {monthData.incidents.map((incident) => (
                      <div key={incident.id} className="bg-white border border-gray-200 rounded-lg p-6">
                        {/* Título do Incident */}
                        <div className="mb-4">
                          <h4 className="text-lg font-semibold text-gray-900 mb-2">{incident.title}</h4>
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`inline-block px-2 py-1 text-xs font-medium rounded border ${getSeverityColor(incident.severity)}`}>
                              {incident.severity || 'minor'}
                            </span>
                          </div>
                          {incident.description && (
                            <p className="text-sm text-gray-700 mt-2">{incident.description}</p>
                          )}
                        </div>

                        {/* Timeline de Updates */}
                        <div className="space-y-3">
                          {/* Status Resolved */}
                          <div className="border-l-2 border-green-500 pl-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <span className={`font-semibold ${getStatusColor('resolved')}`}>
                                  {getStatusLabel('resolved')}
                                </span>
                                <span className="text-gray-500 text-sm ml-2">-</span>
                                <span className="text-gray-700 text-sm ml-2">
                                  Service has been restored and is now operational.
                                </span>
                              </div>
                              <span className="text-xs text-gray-500 ml-4 whitespace-nowrap">
                                {formatDate(incident.resolved_at || incident.updated_at)}
                              </span>
                            </div>
                          </div>

                          {/* Updates (ordem reversa - mais recente primeiro) - excluindo status resolved */}
                          {incident.updates && incident.updates.length > 0 && (
                            incident.updates
                              .filter(update => update.status !== 'resolved')
                              .map((update, idx) => (
                              <div key={update.id} className="border-l-2 border-gray-300 pl-4">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <span className={`font-semibold ${getStatusColor(update.status)}`}>
                                      {getStatusLabel(update.status)}
                                    </span>
                                    <span className="text-gray-500 text-sm ml-2">-</span>
                                    <span className="text-gray-700 text-sm ml-2">
                                      {update.message}
                                    </span>
                                  </div>
                                  <span className="text-xs text-gray-500 ml-4 whitespace-nowrap">
                                    {formatDate(update.created_at)}
                                  </span>
                                </div>
                              </div>
                            ))
                          )}

                          {/* Status Inicial (Investigating) */}
                          <div className="border-l-2 border-red-500 pl-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <span className={`font-semibold ${getStatusColor('investigating')}`}>
                                  {getStatusLabel('investigating')}
                                </span>
                                <span className="text-gray-500 text-sm ml-2">-</span>
                                <span className="text-gray-700 text-sm ml-2">
                                  {incident.description}
                                </span>
                              </div>
                              <span className="text-xs text-gray-500 ml-4 whitespace-nowrap">
                                {formatDate(incident.created_at)}
                              </span>
                            </div>
                          </div>
                        </div>
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
