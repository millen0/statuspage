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
    console.log(`Calculating downtime for ${uptimePercentage}% uptime: ${downtimeMinutes} minutes (${hours}h ${minutes}m)`);
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
          <div className="bg-gray-900 text-white text-xs rounded-lg shadow-2xl p-3 min-w-[250px] max-w-[400px] border border-gray-700">
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
              <div className="font-semibold mb-2 text-white text-xs">{formatDate(date)}</div>
              
              {/* Red bar for problems */}
              {(uptimePercentage < 100 || hasIncidents) && (
                <div className="w-full h-0.5 bg-red-500 rounded-full mb-2"></div>
              )}
              
              {uptimePercentage >= 100 && !hasIncidents ? (
                <div className="text-gray-300 text-xs">
                  No downtime recorded on this day.
                </div>
              ) : (
                <>
                  {hasIncidents ? (
                    <div className="space-y-2">
                      {incidents.map((incident, idx) => {
                        console.log('Rendering incident:', incident);
                        return (
                          <div key={idx} className="">
                            <div className="text-white font-medium mb-1 text-xs">{incident.title}</div>
                            {incident.description && (
                              <div className="text-gray-300 text-xs leading-snug line-clamp-3">{incident.description}</div>
                            )}
                            {incident.severity && (
                              <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-1">
                                {incident.severity === 'critical' && (
                                  <>
                                    <i className="fas fa-times text-red-500"></i>
                                    <span>Critical</span>
                                  </>
                                )}
                                {incident.severity === 'major' && (
                                  <>
                                    <i className="fas fa-times text-red-500"></i>
                                    <span>Major</span>
                                  </>
                                )}
                                {incident.severity === 'minor' && (
                                  <>
                                    <i className="fas fa-minus-square text-yellow-500"></i>
                                    <span>Minor</span>
                                  </>
                                )}
                                {incident.severity === 'info' && (
                                  <>
                                    <i className="fas fa-info-circle text-blue-500"></i>
                                    <span>Info</span>
                                  </>
                                )}
                              </div>
                            )}
                            {incident.maintenance_id && (
                              <div className="flex items-center gap-1.5 text-xs text-blue-400 mt-1">
                                <i className="fas fa-wrench"></i>
                                <span>Occurred during scheduled maintenance</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    (downtime.hours > 0 || downtime.minutes > 0) && (
                      <div className="text-yellow-400 font-medium text-xs">
                        Downtime: {downtime.hours > 0 && `${downtime.hours} ${downtime.hours === 1 ? 'hr' : 'hrs'}`}{downtime.hours > 0 && downtime.minutes > 0 && ' '}{downtime.minutes > 0 && `${downtime.minutes} ${downtime.minutes === 1 ? 'min' : 'mins'}`}
                      </div>
                    )
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
// Force rebuild 1774373000
