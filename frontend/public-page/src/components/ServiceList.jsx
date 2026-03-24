import { useState, useEffect } from 'react';
import axios from 'axios';
import UptimeTooltip from './UptimeTooltip';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// Service Group Card Component (inline)
function ServiceGroupCard({ group, uptimeData, setUptimeData, incidentsData, generateUptimeBars, calculateOverallUptime, statusColors }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [members, setMembers] = useState([]);
  const [membersLoaded, setMembersLoaded] = useState(false);

  const toggleExpand = async () => {
    if (!isExpanded && !membersLoaded) {
      try {
        const res = await axios.get(`${API_URL}/public/service-groups/${group.id}/members`);
        const membersList = res.data || [];
        setMembers(membersList);
        setMembersLoaded(true);
        
        // Fetch uptime for each member
        const uptimePromises = membersList.map(async (member) => {
          try {
            const uptimeRes = await axios.get(`${API_URL}/public/services/${member.id}/uptime`);
            return { serviceId: member.id, data: uptimeRes.data || [] };
          } catch (error) {
            console.error(`Error fetching uptime for member ${member.id}:`, error);
            return { serviceId: member.id, data: [] };
          }
        });
        
        const results = await Promise.all(uptimePromises);
        const newUptimeData = { ...uptimeData };
        results.forEach(result => {
          newUptimeData[result.serviceId] = result.data;
        });
        setUptimeData(newUptimeData);
      } catch (error) {
        console.error('Error fetching group members:', error);
      }
    }
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 cursor-pointer mb-4" onClick={toggleExpand}>
        <svg 
          className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <h3 className="text-lg font-semibold">{group.display_name}</h3>
      </div>

      {isExpanded && (
        <div className="space-y-4 pl-7 border-l-2 border-gray-200">
          {members.map(member => (
            <div key={member.id} className="space-y-2">
              <div className="text-sm font-medium text-gray-700">{member.name}</div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>90 days ago</span>
                <span className="font-medium">{calculateOverallUptime(member.id)}% uptime</span>
                <span>Today</span>
              </div>
              <div className="flex gap-0.5">
                {generateUptimeBars(member.id)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ServiceList({ services }) {
  const [displayMode, setDisplayMode] = useState('classic');
  const [gridColumns, setGridColumns] = useState('2');
  const [uptimeData, setUptimeData] = useState({});
  const [incidentsData, setIncidentsData] = useState({});
  const [serviceGroups, setServiceGroups] = useState([]);
  const [groupedServices, setGroupedServices] = useState({});
  const [standaloneServices, setStandaloneServices] = useState([]);

  useEffect(() => {
    const fetchDisplayMode = async () => {
      try {
        const res = await axios.get(`${API_URL}/public/display-mode`);
        setDisplayMode(res.data.display_mode || 'classic');
        setGridColumns(res.data.grid_columns || '2');
      } catch (error) {
        console.error('Error fetching display mode:', error);
      }
    };
    fetchDisplayMode();
  }, []);

  // Fetch service groups
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const res = await axios.get(`${API_URL}/public/service-groups`);
        setServiceGroups(res.data || []);
      } catch (error) {
        console.error('Error fetching groups:', error);
      }
    };

    fetchGroups();
  }, []);

  useEffect(() => {
    if (displayMode === 'uptime' && services && services.length > 0) {
      const fetchUptimeData = async () => {
        const allItems = [...services];
        
        // Add virtual service IDs for groups
        serviceGroups.forEach(group => {
          allItems.push({ id: -group.id, group_id: group.id, name: group.display_name });
        });

        const uptimePromises = allItems.map(async (item) => {
          try {
            const endpoint = item.group_id && item.id < 0
              ? `${API_URL}/public/service-groups/${item.group_id}/uptime`
              : item.group_id
              ? `${API_URL}/public/service-groups/${item.group_id}/uptime`
              : `${API_URL}/public/services/${item.id}/uptime`;
            
            const res = await axios.get(endpoint);
            console.log(`Uptime data for service ${item.id} (${item.name}):`, res.data);
            return { serviceId: item.id, data: res.data || [] };
          } catch (error) {
            console.error(`Error fetching uptime for ${item.name}:`, error);
            return { serviceId: item.id, data: [] };
          }
        });
        
        const results = await Promise.all(uptimePromises);
        
        // Process uptime data and extract incidents
        setUptimeData(prevData => {
          const newUptimeMap = { ...prevData };
          results.forEach(result => {
            if (newUptimeMap[result.serviceId]) {
              const existingData = newUptimeMap[result.serviceId];
              const mergedData = [...result.data];
              
              existingData.forEach(existingLog => {
                const existingDate = existingLog.date.split('T')[0];
                const newLogIndex = mergedData.findIndex(l => l.date.split('T')[0] === existingDate);
                
                if (newLogIndex !== -1) {
                  if (existingLog.uptime_percentage < mergedData[newLogIndex].uptime_percentage) {
                    mergedData[newLogIndex] = existingLog;
                  }
                } else {
                  mergedData.push(existingLog);
                }
              });
              
              newUptimeMap[result.serviceId] = mergedData;
            } else {
              newUptimeMap[result.serviceId] = result.data;
            }
          });
          return newUptimeMap;
        });

        // Extract incidents from uptime data
        setIncidentsData(prevData => {
          const newIncidentsMap = { ...prevData };
          results.forEach(result => {
            const incidentsByDate = {};
            result.data.forEach(day => {
              const dateStr = day.date.split('T')[0];
              if (day.incidents && day.incidents.length > 0) {
                incidentsByDate[dateStr] = day.incidents;
              }
            });
            newIncidentsMap[result.serviceId] = incidentsByDate;
          });
          return newIncidentsMap;
        });
      };
      
      fetchUptimeData();

      // Auto-refresh uptime data every 5 minutes
      const refreshInterval = setInterval(() => {
        console.log('Auto-refreshing uptime data...');
        fetchUptimeData();
      }, 5 * 60 * 1000); // 5 minutes

      return () => clearInterval(refreshInterval);
    }
  }, [displayMode, services, serviceGroups]);

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

  const generateUptimeBars = (serviceId, showTooltip = true) => {
    const uptimeLogs = uptimeData[serviceId] || [];
    const serviceIncidents = incidentsData[serviceId] || {};
    const bars = [];
    
    // Gerar últimos 90 dias (do mais antigo para o mais recente)
    // Usar data local do navegador, não UTC
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const day = today.getDate();
    const localToday = new Date(year, month, day); // Data local sem hora
    
    for (let i = 89; i >= 0; i--) {
      const date = new Date(localToday);
      date.setDate(date.getDate() - i);
      
      // Formatar data como YYYY-MM-DD no timezone local
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      // Procurar log para este dia
      // Extrair apenas a parte da data (YYYY-MM-DD) do timestamp UTC
      const log = uptimeLogs.find(l => {
        const logDate = l.date.split('T')[0]; // Pega apenas YYYY-MM-DD
        return logDate === dateStr;
      });
      const dayIncidents = serviceIncidents[dateStr] || [];
      
      let status = 'operational';
      const uptimePercentage = log ? log.uptime_percentage : 100;
      
      if (uptimePercentage < 50) {
        status = 'outage';
      } else if (uptimePercentage < 99) {
        status = 'degraded';
      }
      
      const isFirstDay = i === 89;
      const isLastDay = i === 0;
      const hasProblems = uptimePercentage < 100 || dayIncidents.length > 0;
      
      // Se tem problemas, usar vermelho; senão usar a cor do status
      const barColor = hasProblems ? 'bg-red-500' : statusColors[status];
      
      if (showTooltip) {
        bars.push(
          <UptimeTooltip
            key={`${serviceId}-${dateStr}`}
            date={dateStr}
            uptimePercentage={uptimePercentage}
            incidents={dayIncidents}
          >
            <div className={`h-8 ${barColor} ${isFirstDay ? 'rounded-l' : ''} ${isLastDay ? 'rounded-r' : ''} cursor-pointer hover:opacity-80 transition-opacity`} />
          </UptimeTooltip>
        );
      } else {
        bars.push(
          <div key={`${serviceId}-${dateStr}`} className="flex-1">
            <div className={`h-8 ${barColor} ${isFirstDay ? 'rounded-l' : ''} ${isLastDay ? 'rounded-r' : ''} transition-opacity`} />
          </div>
        );
      }
    }
    return bars;
  };

  const calculateOverallUptime = (serviceId) => {
    const uptimeLogs = uptimeData[serviceId] || [];
    
    if (uptimeLogs.length === 0) return '100.00';
    
    // Calcular média baseado apenas nos dias retornados pelo backend
    let totalUptime = 0;
    uptimeLogs.forEach(log => {
      totalUptime += parseFloat(log.uptime_percentage);
    });
    
    const avgUptime = totalUptime / uptimeLogs.length;
    
    // Log para debug
    const daysWithIssues = uptimeLogs.filter(log => log.uptime_percentage < 100);
    if (daysWithIssues.length > 0) {
      console.log(`Service ${serviceId} - Days with issues:`, daysWithIssues.map(d => ({
        date: d.date.split('T')[0],
        uptime: d.uptime_percentage
      })));
    }
    console.log(`Service ${serviceId} - Total days: ${uptimeLogs.length}, Days with issues: ${daysWithIssues.length}, Calculated uptime: ${avgUptime}%`);
    
    // Se teve problemas, usar floor para não arredondar para cima
    // Caso contrário, usar toFixed normal
    if (daysWithIssues.length > 0) {
      return (Math.floor(avgUptime * 100) / 100).toFixed(2);
    }
    return avgUptime.toFixed(2);
  };

  if (displayMode === 'classic') {
    return (
      <div className="bg-white border border-gray-200 rounded-lg mb-8 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Services</h3>
        </div>
        <div className="grid grid-cols-2 gap-px bg-gray-200">
          {services && services.length > 0 ? (
            services.map((service) => (
              <div key={service.id} className="px-6 py-4 bg-white flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-4 flex-1">
                  <div className="font-medium">{service.name}</div>
                  <div className={`w-2 h-2 rounded-full ${statusColors[service.status]}`}></div>
                </div>
                <div className="text-sm text-gray-600">{statusLabels[service.status]}</div>
              </div>
            ))
          ) : (
            <div className="col-span-2 px-6 py-8 bg-white text-center text-gray-500">
              No services available
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-${gridColumns} gap-4 mb-8`}>
      {/* Render Services first (hide those with group_id) */}
      {services && services.length > 0 && services.filter(service => !service.group_id || service.group_id === 0).length > 0 ? (
        services
          .filter(service => !service.group_id || service.group_id === 0)
          .sort((a, b) => {
            // Definir ordem customizada
            const order = ['lighthouse', 'lia', 'space', 'cca', 'autofix', 'spot', 'spm', 'sp manager', 'skylift', 'platform'];
            const aName = a.name ? a.name.toLowerCase() : '';
            const bName = b.name ? b.name.toLowerCase() : '';
            
            const aIndex = order.findIndex(name => aName.includes(name));
            const bIndex = order.findIndex(name => bName.includes(name));
            
            // Se ambos estão na lista, ordenar pela posição
            if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
            // Se apenas um está na lista, ele vem primeiro
            if (aIndex !== -1) return -1;
            if (bIndex !== -1) return 1;
            // Se nenhum está na lista, manter ordem original
            return 0;
          })
          .map((service) => {
            // Determinar qual logo usar baseado no nome do serviço
            let logoSrc = null;
            let displayName = service.name;
            const serviceName = service.name ? service.name.toLowerCase() : '';
            
            // Definir descrições para serviços específicos
            const serviceDescriptions = {
              'auth': 'Handles user authentication across the platform. If unavailable, users may be unable to log in or maintain authenticated sessions.',
              'lake': 'Responsible for data processing and retrieval used across the platform. Issues may cause delays or failures in data loading, analytics, or workspaces.',
              'login': 'Manages the user login flow and access to the platform. If impacted, users may be unable to sign in or access their accounts.',
              'websocket': 'Enables real-time updates and interactions within the platform. If degraded, some features may respond slower or update with delays, but core functionality remains available.',
              'hub notification': 'Manages the delivery of notifications and alerts across the platform. If impacted, users may experience delays or failures in receiving notifications, but core platform functionality remains unaffected.'
            };
            
            // Verificar se o serviço tem descrição
            let serviceDescription = null;
            Object.keys(serviceDescriptions).forEach(key => {
              if (serviceName.includes(key)) {
                serviceDescription = serviceDescriptions[key];
              }
            });
            
            if (serviceName.includes('lighthouse')) {
              logoSrc = '/lighthouse-logo.png';
            } else if (serviceName.includes('lia')) {
              logoSrc = '/lia-logo.png';
            } else if (serviceName.includes('cca')) {
              logoSrc = '/cca-logo.png';
            } else if (serviceName.includes('skylift')) {
              logoSrc = '/skylift-logo.png';
            } else if (serviceName.includes('spot')) {
              logoSrc = '/spot-logo.png';
            } else if (serviceName.includes('space')) {
              logoSrc = '/space-logo.png';
            } else if (serviceName.includes('autofix')) {
              logoSrc = '/autofix-logo.png';
            } else if (serviceName.includes('spm') || serviceName.includes('sp manager')) {
              logoSrc = '/spm-logo.png';
              // Renomear SPM para SP Manager
              if (serviceName === 'spm') {
                displayName = 'SP Manager';
              }
            }
            
            return (
              <div key={service.id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                <div className="mb-4">
                  {logoSrc ? (
                    <div className="flex items-center gap-3">
                      <img 
                        src={logoSrc} 
                        alt={displayName} 
                        className="h-10 w-auto"
                        style={{ objectFit: 'contain' }}
                      />
                      <h3 className="text-lg font-semibold">{displayName}</h3>
                      {serviceDescription && (
                        <div className="relative group ml-1">
                          <svg 
                            viewBox="64 64 896 896" 
                            width="1em" 
                            height="1em" 
                            fill="currentColor" 
                            className="text-gray-400 hover:text-gray-600 cursor-help w-4 h-4"
                          >
                            <path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm0 820c-205.4 0-372-166.6-372-372s166.6-372 372-372 372 166.6 372 372-166.6 372-372 372z"></path>
                            <path d="M464 336a48 48 0 1096 0 48 48 0 10-96 0zm72 112h-48c-4.4 0-8 3.6-8 8v272c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8V456c0-4.4-3.6-8-8-8z"></path>
                          </svg>
                          <div className="absolute left-0 top-6 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-lg">
                            <div className="absolute -top-1 left-2 w-2 h-2 bg-gray-900 transform rotate-45"></div>
                            {serviceDescription}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold">{displayName}</h3>
                      {serviceDescription && (
                        <div className="relative group">
                          <svg 
                            viewBox="64 64 896 896" 
                            width="1em" 
                            height="1em" 
                            fill="currentColor" 
                            className="text-gray-400 hover:text-gray-600 cursor-help w-4 h-4"
                          >
                            <path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm0 820c-205.4 0-372-166.6-372-372s166.6-372 372-372 372 166.6 372 372-166.6 372-372 372z"></path>
                            <path d="M464 336a48 48 0 1096 0 48 48 0 10-96 0zm72 112h-48c-4.4 0-8 3.6-8 8v272c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8V456c0-4.4-3.6-8-8-8z"></path>
                          </svg>
                          <div className="absolute left-0 top-6 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-lg">
                            <div className="absolute -top-1 left-2 w-2 h-2 bg-gray-900 transform rotate-45"></div>
                            {serviceDescription}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>90 days ago</span>
                    <span className="font-medium">{calculateOverallUptime(service.id)}% uptime</span>
                    <span>Today</span>
                  </div>
                  <div className="flex gap-0.5">
                    {generateUptimeBars(service.id)}
                  </div>
                </div>
              </div>
            );
          })
      ) : null}
      
      {/* Render Service Groups last */}
      {serviceGroups.map((group) => (
        <ServiceGroupCard
          key={`group-${group.id}`}
          group={{ ...group, virtual_service_id: -group.id }}
          uptimeData={uptimeData}
          setUptimeData={setUptimeData}
          incidentsData={incidentsData}
          generateUptimeBars={generateUptimeBars}
          calculateOverallUptime={calculateOverallUptime}
          statusColors={statusColors}
        />
      ))}
    </div>
  );
}
