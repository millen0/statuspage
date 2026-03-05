export default function ServiceList({ services }) {
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

  const statusIcons = {
    operational: '✓',
    degraded: '!',
    outage: '×',
    maintenance: '○'
  };

  const generateUptimeBars = () => {
    const bars = [];
    for (let i = 0; i < 90; i++) {
      const random = Math.random();
      const status = random > 0.98 ? 'outage' : random > 0.95 ? 'degraded' : 'operational';
      bars.push(
        <div
          key={i}
          className={`h-8 flex-1 ${statusColors[status]} ${i === 0 ? 'rounded-l' : ''} ${i === 89 ? 'rounded-r' : ''}`}
          title={`Day ${90 - i}`}
        />
      );
    }
    return bars;
  };

  return (
    <div className="space-y-4 mb-8">
      {services && services.length > 0 ? (
        services.map((service) => (
          <div key={service.id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className={`flex items-center justify-center w-6 h-6 rounded-full text-white text-sm font-bold ${statusColors[service.status]}`}>
                  {statusIcons[service.status]}
                </span>
                <h3 className="text-lg font-semibold">{service.name}</h3>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${service.status === 'operational' ? 'bg-green-100 text-green-800' : service.status === 'degraded' ? 'bg-yellow-100 text-yellow-800' : service.status === 'outage' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                {statusLabels[service.status]}
              </span>
            </div>
            
            {service.description && (
              <p className="text-sm text-gray-600 mb-4">{service.description}</p>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>90 days ago</span>
                <span className="font-medium">99.9% uptime</span>
                <span>Today</span>
              </div>
              <div className="flex gap-0.5">
                {generateUptimeBars()}
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
          No services available
        </div>
      )}
    </div>
  );
}
