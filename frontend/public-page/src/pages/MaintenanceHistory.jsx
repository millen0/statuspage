import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getMaintenances } from '../services/api';
import '../styles/richtext.css';

export default function MaintenanceHistory() {
  const [maintenances, setMaintenances] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMaintenances = async () => {
      try {
        const response = await getMaintenances();
        const completedMaintenances = (response.data || []).filter(m => m.status === 'completed');
        setMaintenances(completedMaintenances);
      } catch (error) {
        console.error('Error fetching maintenances:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMaintenances();
  }, []);

  const formatDate = (date) => {
    const d = new Date(date);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`;
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'completed': return 'Completed';
      case 'in_progress': return 'In Progress';
      case 'scheduled': return 'Scheduled';
      default: return 'Update';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'text-green-600';
      case 'in_progress': return 'text-yellow-600';
      case 'scheduled': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  const groupMaintenancesByMonth = (maintenances) => {
    const grouped = {};
    maintenances.forEach(maintenance => {
      const date = new Date(maintenance.scheduled_end);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      
      if (!grouped[monthKey]) {
        grouped[monthKey] = {
          name: monthName,
          maintenances: []
        };
      }
      grouped[monthKey].maintenances.push(maintenance);
    });
    
    return Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0]));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-900">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  const groupedMaintenances = groupMaintenancesByMonth(maintenances);

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
            <h2 className="text-xl font-semibold">Maintenance History</h2>
            <p className="text-sm text-gray-600 mt-1">Past scheduled maintenances</p>
          </div>

          {maintenances.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              <p>No maintenance history to display.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {groupedMaintenances.map(([monthKey, monthData]) => (
                <div key={monthKey} className="px-6 py-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">{monthData.name}</h3>
                  <div className="space-y-6">
                    {monthData.maintenances.map((maintenance) => (
                      <div key={maintenance.id} className="bg-white border border-gray-200 rounded-lg p-6">
                        {/* Título do Maintenance */}
                        <div className="mb-4">
                          <h4 className="text-lg font-semibold text-gray-900 mb-2">{maintenance.title}</h4>
                          <span className="inline-block px-2 py-1 text-xs font-medium rounded border bg-green-100 text-green-800 border-green-300">
                            completed
                          </span>
                        </div>

                        {/* Timeline de Updates */}
                        <div className="space-y-3">
                          {/* Status Completed */}
                          {maintenance.status === 'completed' && (
                            <div className="border-l-2 border-green-500 pl-4">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <span className={`font-semibold ${getStatusColor('completed')}`}>
                                    {getStatusLabel('completed')}
                                  </span>
                                  <span className="text-gray-500 text-sm ml-2">-</span>
                                  <span className="text-gray-700 text-sm ml-2">
                                    Maintenance has been completed.
                                  </span>
                                </div>
                                <span className="text-xs text-gray-500 ml-4 whitespace-nowrap">
                                  {formatDate(maintenance.actual_end || maintenance.scheduled_end)}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Updates (ordem reversa - mais recente primeiro) */}
                          {maintenance.updates && maintenance.updates.length > 0 && (
                            maintenance.updates.map((update) => (
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

                          {/* Status In Progress (se houver) */}
                          {maintenance.actual_start && (
                            <div className="border-l-2 border-yellow-500 pl-4">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <span className={`font-semibold ${getStatusColor('in_progress')}`}>
                                    {getStatusLabel('in_progress')}
                                  </span>
                                  <span className="text-gray-500 text-sm ml-2">-</span>
                                  <span className="text-gray-700 text-sm ml-2">
                                    Maintenance is currently in progress.
                                  </span>
                                </div>
                                <span className="text-xs text-gray-500 ml-4 whitespace-nowrap">
                                  {formatDate(maintenance.actual_start)}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Status Inicial (Scheduled) */}
                          <div className="border-l-2 border-blue-500 pl-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <span className={`font-semibold ${getStatusColor('scheduled')}`}>
                                  {getStatusLabel('scheduled')}
                                </span>
                                <span className="text-gray-500 text-sm ml-2">-</span>
                                <div 
                                  className="text-gray-700 text-sm ml-2 inline rich-text-content"
                                  dangerouslySetInnerHTML={{ __html: maintenance.description }}
                                />
                              </div>
                              <span className="text-xs text-gray-500 ml-4 whitespace-nowrap">
                                {formatDate(maintenance.created_at)}
                              </span>
                            </div>
                            <div className="mt-2 text-xs text-gray-600">
                              <div><span className="font-medium">Scheduled Start:</span> {formatDate(maintenance.scheduled_start)}</div>
                              <div><span className="font-medium">Scheduled End:</span> {formatDate(maintenance.scheduled_end)}</div>
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
