import { useState } from 'react';
import axios from 'axios';
import UptimeTooltip from './UptimeTooltip';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export default function ServiceGroupCard({ group, uptimeData, incidentsData }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [members, setMembers] = useState([]);
  const [membersLoaded, setMembersLoaded] = useState(false);

  const statusColors = {
    operational: 'bg-green-500',
    degraded: 'bg-yellow-500',
    outage: 'bg-red-500',
    maintenance: 'bg-blue-500'
  };

  const toggleExpand = async () => {
    if (!isExpanded && !membersLoaded) {
      // Fetch members
      try {
        const res = await axios.get(`${API_URL}/public/service-groups/${group.id}/members`);
        setMembers(res.data || []);
        setMembersLoaded(true);
      } catch (error) {
        console.error('Error fetching group members:', error);
      }
    }
    setIsExpanded(!isExpanded);
  };

  const generateUptimeBars = (serviceId, showTooltip = true) => {
    const uptimeLogs = uptimeData[serviceId] || [];
    const serviceIncidents = incidentsData[serviceId] || {};
    const bars = [];
    
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const day = today.getDate();
    const localToday = new Date(year, month, day);
    
    for (let i = 90; i >= 0; i--) {
      const date = new Date(localToday);
      date.setDate(date.getDate() - i);
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      const log = uptimeLogs.find(l => {
        const logDate = l.date.split('T')[0];
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
      
      const isFirstDay = i === 90;
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
    if (uptimeLogs.length === 0) return '100.0';
    
    const avgUptime = uptimeLogs.reduce((sum, log) => sum + parseFloat(log.uptime_percentage), 0) / uptimeLogs.length;
    return avgUptime.toFixed(1);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
      {/* Group Header */}
      <div 
        className="flex items-center gap-2 cursor-pointer mb-4"
        onClick={toggleExpand}
      >
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

      {/* Group Uptime Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>91 days ago</span>
          <span className="font-medium">{calculateOverallUptime(group.virtual_service_id)}% uptime</span>
          <span>Today</span>
        </div>
        <div className="flex gap-0.5">
          {generateUptimeBars(group.virtual_service_id, false)}
        </div>
      </div>

      {/* Expanded Members */}
      {isExpanded && (
        <div className="mt-6 space-y-4 pl-7 border-l-2 border-gray-200">
          {members.map(member => (
            <div key={member.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${statusColors[member.status]}`}></div>
                <span className="text-sm font-medium text-gray-700">{member.name}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>91 days ago</span>
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
