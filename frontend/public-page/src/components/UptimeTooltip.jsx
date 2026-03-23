import { useState } from 'react';

export default function UptimeTooltip({ date, uptimePercentage, incidents, children }) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const formatDate = (dateStr) => {
    // Extrair apenas a parte da data (YYYY-MM-DD) e criar data local
    const [year, month, day] = dateStr.split('T')[0].split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  const calculateDowntime = (uptimePercentage) => {
    const downtimeMinutes = Math.round((100 - uptimePercentage) * 14.4); // 1440 minutes in a day
    const hours = Math.floor(downtimeMinutes / 60);
    const minutes = downtimeMinutes % 60;
    return { hours, minutes };
  };

  const handleMouseEnter = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setPosition({
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    });
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  const downtime = calculateDowntime(uptimePercentage);
  const hasIncidents = incidents && incidents.length > 0;

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative flex-1"
    >
      {children}

      {isVisible && (
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            transform: 'translate(-50%, -100%)'
          }}
        >
          <div className="bg-gray-900 text-white text-sm rounded-lg shadow-2xl p-4 min-w-[250px] max-w-[350px] border border-gray-700">
            {/* Arrow */}
            <div
              className="absolute w-3 h-3 bg-gray-900 border-r border-b border-gray-700 transform rotate-45"
              style={{
                left: '50%',
                bottom: '-6px',
                marginLeft: '-6px'
              }}
            />

            {/* Content */}
            <div className="relative z-10">
              <div className="font-semibold mb-2 text-white">{formatDate(date)}</div>
              
              {/* Red bar for problems */}
              {(uptimePercentage < 100 || hasIncidents) && (
                <div className="w-full h-1 bg-red-500 rounded-full mb-3"></div>
              )}
              
              {uptimePercentage >= 100 && !hasIncidents ? (
                <div className="text-gray-300">
                  No downtime recorded on this day.
                </div>
              ) : (
                <>
                  {downtime.hours > 0 && (
                    <div className="text-yellow-400 font-medium">
                      {downtime.hours} {downtime.hours === 1 ? 'hr' : 'hrs'}
                    </div>
                  )}
                  {downtime.minutes > 0 && (
                    <div className="text-yellow-400 font-medium">
                      {downtime.minutes} {downtime.minutes === 1 ? 'min' : 'mins'}
                    </div>
                  )}

                  {hasIncidents && (
                    <div className="mt-3 pt-3 border-t border-gray-700">
                      <div className="text-gray-400 text-xs mb-2">Incident Details</div>
                      {incidents.map((incident, idx) => (
                        <div key={idx} className="mb-3 last:mb-0">
                          <div className="text-white font-medium mb-1">{incident.title}</div>
                          {incident.description && (
                            <div className="text-gray-300 text-xs mb-1">{incident.description}</div>
                          )}
                          {incident.severity && (
                            <div className="text-xs text-gray-400">
                              {incident.severity === 'critical' && '🔴 Critical'}
                              {incident.severity === 'major' && '🟠 Major'}
                              {incident.severity === 'minor' && '🟡 Minor'}
                              {incident.severity === 'info' && 'ℹ️ Info'}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {!hasIncidents && (downtime.hours > 0 || downtime.minutes > 0) && (
                    <div className="mt-2 text-gray-400 text-xs">
                      {uptimePercentage < 50 ? 'Major Outage' : 
                       uptimePercentage < 95 ? 'Partial Outage' : 
                       uptimePercentage < 99 ? 'Degraded Performance' : 
                       'Minor Issues'}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
