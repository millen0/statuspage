export default function IncidentTimeline({ incidents }) {
  const activeIncidents = incidents.filter(i => i.status !== 'resolved');
  
  if (!activeIncidents || activeIncidents.length === 0) return null;

  const severityColors = {
    critical: 'border-red-500',
    major: 'border-orange-500',
    minor: 'border-yellow-500',
    info: 'border-blue-500'
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString('en-US', {
      timeZone: 'UTC',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="mb-8">
      <h3 className="text-lg font-semibold mb-4">Active Incidents</h3>
      <div className="space-y-4">
        {activeIncidents.map((incident) => (
          <div key={incident.id} className={`bg-white border-l-4 ${severityColors[incident.severity]} border-r border-t border-b border-gray-200 rounded-r-lg p-4 shadow-sm`}>
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-semibold">{incident.title}</h4>
              <span className="text-xs text-gray-600">{formatDate(incident.created_at)}</span>
            </div>
            <p className="text-sm text-gray-700 mb-3">{incident.description}</p>
            {incident.updates && incident.updates.length > 0 && (
              <div className="space-y-2 border-t border-gray-200 pt-3">
                {incident.updates.map((update) => (
                  <div key={update.id} className="text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium text-blue-600">{update.status}</span>
                      <span className="text-gray-600">{formatDate(update.created_at)}</span>
                    </div>
                    <p className="text-gray-700 mt-1">{update.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
