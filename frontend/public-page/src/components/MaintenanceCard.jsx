export default function MaintenanceCard({ maintenances }) {
  const activeMaintenances = maintenances.filter(m => m.status !== 'completed');
  
  if (!activeMaintenances || activeMaintenances.length === 0) return null;

  const formatDate = (date) => {
    return new Date(date).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  };

  return (
    <div className="mb-8">
      <h3 className="text-lg font-semibold mb-4">Scheduled Maintenance</h3>
      <div className="space-y-4">
        {activeMaintenances.map((maintenance) => (
          <div key={maintenance.id} className="bg-white border border-blue-300 rounded-lg p-4 shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-semibold text-blue-600">{maintenance.title}</h4>
              <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
                {maintenance.status}
              </span>
            </div>
            <p className="text-sm text-gray-700 mb-3">{maintenance.description}</p>
            <div className="text-sm text-gray-600">
              <div>Start: {formatDate(maintenance.scheduled_start)}</div>
              <div>End: {formatDate(maintenance.scheduled_end)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
