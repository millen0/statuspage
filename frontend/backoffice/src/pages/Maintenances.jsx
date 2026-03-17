import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { getMaintenances, createMaintenance, updateMaintenance } from '../services/api';
import { useThemeStore } from '../contexts/themeStore';

export default function Maintenances() {
  const theme = useThemeStore((state) => state.theme);
  const [maintenances, setMaintenances] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingMaintenance, setEditingMaintenance] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'scheduled',
    scheduled_start: '',
    scheduled_end: '',
    send_email: false,
    email_scheduled_time: '',
  });

  useEffect(() => {
    fetchMaintenances();
  }, []);

  const fetchMaintenances = async () => {
    try {
      const response = await getMaintenances();
      setMaintenances(response.data || []);
    } catch (error) {
      console.error('Error fetching maintenances:', error);
      setMaintenances([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Converter de horário de SP para UTC
      const convertSPtoUTC = (dateStr) => {
        if (!dateStr) return null;
        // Adicionar timezone de SP ao datetime-local
        const spDate = new Date(dateStr + ':00-03:00');
        return spDate.toISOString();
      };
      
      const payload = {
        ...formData,
        scheduled_start: convertSPtoUTC(formData.scheduled_start),
        scheduled_end: convertSPtoUTC(formData.scheduled_end),
        email_scheduled_time: formData.email_scheduled_time ? convertSPtoUTC(formData.email_scheduled_time) : null
      };
      
      if (editingMaintenance) {
        await updateMaintenance(editingMaintenance.id, payload);
      } else {
        await createMaintenance(payload);
      }
      fetchMaintenances();
      resetForm();
    } catch (error) {
      console.error('Error saving maintenance:', error);
    }
  };

  const handleEdit = (maintenance) => {
    setEditingMaintenance(maintenance);
    
    // Converter de UTC para horário de SP para exibição
    const convertUTCtoSP = (utcDateStr) => {
      if (!utcDateStr) return '';
      const utcDate = new Date(utcDateStr);
      // Converter para SP (UTC-3)
      const spDate = new Date(utcDate.getTime() - (3 * 60 * 60 * 1000));
      return spDate.toISOString().slice(0, 16);
    };
    
    setFormData({
      ...maintenance,
      scheduled_start: convertUTCtoSP(maintenance.scheduled_start),
      scheduled_end: convertUTCtoSP(maintenance.scheduled_end),
      send_email: maintenance.send_email || false,
      email_scheduled_time: maintenance.email_scheduled_time ? convertUTCtoSP(maintenance.email_scheduled_time) : '',
    });
    setShowForm(true);
  };



  const resetForm = () => {
    setFormData({ title: '', description: '', status: 'scheduled', scheduled_start: '', scheduled_end: '', send_email: false, email_scheduled_time: '' });
    setEditingMaintenance(null);
    setShowForm(false);
  };

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        <div className="flex justify-between items-center mb-6">
          <h1 className={theme === 'dark' ? 'text-2xl font-semibold text-white' : 'text-2xl font-semibold text-gray-900'}>Maintenances</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            {showForm ? 'Cancel' : 'Schedule Maintenance'}
          </button>
        </div>

        {showForm && (
          <div className={theme === 'dark' ? 'bg-[#161b22] border border-[#30363d] rounded-lg p-6 mb-6' : 'bg-white shadow rounded-lg p-6 mb-6'}>
            <h2 className={theme === 'dark' ? 'text-lg font-medium text-white mb-4' : 'text-lg font-medium mb-4'}>{editingMaintenance ? 'Edit' : 'New'} Maintenance</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={theme === 'dark' ? 'block text-sm font-medium text-gray-300' : 'block text-sm font-medium text-gray-700'}>Title</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className={theme === 'dark' ? 'mt-1 block w-full bg-[#0d1117] border border-[#30363d] rounded-md shadow-sm py-2 px-3 text-white' : 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3'}
                />
              </div>
              <div>
                <label className={theme === 'dark' ? 'block text-sm font-medium text-gray-300' : 'block text-sm font-medium text-gray-700'}>Description</label>
                <textarea
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className={theme === 'dark' ? 'mt-1 block w-full bg-[#0d1117] border border-[#30363d] rounded-md shadow-sm py-2 px-3 text-white' : 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3'}
                  rows="3"
                />
              </div>
              <div>
                <label className={theme === 'dark' ? 'block text-sm font-medium text-gray-300' : 'block text-sm font-medium text-gray-700'}>Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className={theme === 'dark' ? 'mt-1 block w-full bg-[#0d1117] border border-[#30363d] rounded-md shadow-sm py-2 px-3 text-white' : 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3'}
                >
                  <option value="scheduled">Scheduled</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <div>
                <label className={theme === 'dark' ? 'block text-sm font-medium text-gray-300' : 'block text-sm font-medium text-gray-700'}>Scheduled Start (Horário de SP)</label>
                <input
                  type="datetime-local"
                  required
                  value={formData.scheduled_start}
                  onChange={(e) => setFormData({ ...formData, scheduled_start: e.target.value })}
                  className={theme === 'dark' ? 'mt-1 block w-full bg-[#0d1117] border border-[#30363d] rounded-md shadow-sm py-2 px-3 text-white' : 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3'}
                />
              </div>
              <div>
                <label className={theme === 'dark' ? 'block text-sm font-medium text-gray-300' : 'block text-sm font-medium text-gray-700'}>Scheduled End (Horário de SP)</label>
                <input
                  type="datetime-local"
                  required
                  value={formData.scheduled_end}
                  onChange={(e) => setFormData({ ...formData, scheduled_end: e.target.value })}
                  className={theme === 'dark' ? 'mt-1 block w-full bg-[#0d1117] border border-[#30363d] rounded-md shadow-sm py-2 px-3 text-white' : 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3'}
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="send_email"
                  checked={formData.send_email}
                  onChange={(e) => setFormData({ ...formData, send_email: e.target.checked })}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor="send_email" className={theme === 'dark' ? 'ml-2 block text-sm text-gray-300' : 'ml-2 block text-sm text-gray-700'}>
                  Send email notification to subscribers
                </label>
              </div>
              {formData.send_email && (
                <div>
                  <label className={theme === 'dark' ? 'block text-sm font-medium text-gray-300' : 'block text-sm font-medium text-gray-700'}>
                    Email Send Time (Horário de SP) - Leave empty to send immediately
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.email_scheduled_time}
                    onChange={(e) => setFormData({ ...formData, email_scheduled_time: e.target.value })}
                    className={theme === 'dark' ? 'mt-1 block w-full bg-[#0d1117] border border-[#30363d] rounded-md shadow-sm py-2 px-3 text-white' : 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3'}
                  />
                  <p className={theme === 'dark' ? 'mt-1 text-xs text-gray-400' : 'mt-1 text-xs text-gray-500'}>
                    If empty, email will be sent immediately when you save
                  </p>
                </div>
              )}
              <button
                type="submit"
                className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Save
              </button>
            </form>
          </div>
        )}

        <div className={theme === 'dark' ? 'bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden' : 'bg-white shadow overflow-hidden sm:rounded-md'}>
          {maintenances.length === 0 ? (
            <div className={theme === 'dark' ? 'px-6 py-8 text-center text-gray-400' : 'px-6 py-8 text-center text-gray-500'}>
              No maintenances scheduled. Create your first maintenance.
            </div>
          ) : (
            <ul className={theme === 'dark' ? 'divide-y divide-[#30363d]' : 'divide-y divide-gray-200'}>
              {maintenances.map((maintenance) => (
              <li key={maintenance.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className={theme === 'dark' ? 'text-lg font-medium text-white' : 'text-lg font-medium'}>{maintenance.title}</h3>
                    <p className={theme === 'dark' ? 'text-sm text-gray-400' : 'text-sm text-gray-500'}>{maintenance.description}</p>
                    <div className={theme === 'dark' ? 'text-sm text-gray-400 mt-2' : 'text-sm text-gray-600 mt-2'}>
                      <div>Start (SP): {new Date(new Date(maintenance.scheduled_start).getTime() - (3 * 60 * 60 * 1000)).toISOString().replace('T', ' ').slice(0, 19)}</div>
                      <div>End (SP): {new Date(new Date(maintenance.scheduled_end).getTime() - (3 * 60 * 60 * 1000)).toISOString().replace('T', ' ').slice(0, 19)}</div>
                      <div className="text-xs opacity-70">UTC: {new Date(maintenance.scheduled_start).toISOString().replace('T', ' ').slice(0, 19)} - {new Date(maintenance.scheduled_end).toISOString().replace('T', ' ').slice(0, 19)}</div>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mt-2">
                      {maintenance.status}
                    </span>
                    {maintenance.email_sent && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 mt-2 ml-2">
                        ✉️ Email Sent
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(maintenance)}
                      className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          )}
        </div>
      </div>
    </Layout>
  );
}
