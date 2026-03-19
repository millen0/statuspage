export default function HistorySection({ incidents }) {
  const formatDate = (date) => {
    return new Date(date).toLocaleString('en-US', {
      timeZone: 'UTC',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Filter only today's resolved incidents
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const resolvedIncidents = incidents.filter(i => {
    if (i.status !== 'resolved' || !i.is_visible) return false;
    
    const incidentDate = new Date(i.resolved_at || i.updated_at);
    incidentDate.setHours(0, 0, 0, 0);
    
    return incidentDate.getTime() === today.getTime();
  });

  if (resolvedIncidents.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <h3 className="text-lg font-semibold mb-4">Recent History (Today)</h3>
      
      {resolvedIncidents.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h4 className="text-md font-semibold mb-3 text-green-600">✓ Resolved Incidents</h4>
          <div className="space-y-3">
            {resolvedIncidents.map((incident) => (
              <div key={incident.id} className="border-l-2 border-green-500 pl-4 py-2">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">{incident.title}</div>
                    <div className="text-sm text-gray-600">{incident.description}</div>
                  </div>
                  <div className="text-xs text-gray-500">{formatDate(incident.resolved_at || incident.updated_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
