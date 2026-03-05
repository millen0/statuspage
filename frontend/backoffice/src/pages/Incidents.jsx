import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { getIncidents, createIncident, updateIncident, getServices, toggleIncidentVisibility, publishServiceIncident, unpublishServiceIncident } from '../services/api';
import { useThemeStore } from '../contexts/themeStore';

export default function Incidents() {
  const theme = useThemeStore((state) => state.theme);
  const [incidents, setIncidents] = useState([]);
  const [services, setServices] = useState([]);
  const [degradedServices, setDegradedServices] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingIncident, setEditingIncident] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    severity: 'minor',
    status: 'investigating',
    service_id: null,
    is_visible: false,
  });

  useEffect(() => {
    fetchIncidents();
    fetchServices();
  }, []);

  const fetchIncidents = async () => {
    try {
      const response = await getIncidents();
      setIncidents(response.data || []);
    } catch (error) {
      console.error('Error fetching incidents:', error);
      setIncidents([]);
    }
  };

  const fetchServices = async () => {
    try {
      const response = await getServices();
      const allServices = response.data || [];
      setServices(allServices);
      setDegradedServices(allServices.filter(s => s.status !== 'operational'));
    } catch (error) {
      console.error('Error fetching services:', error);
      setServices([]);
      setDegradedServices([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingIncident) {
        await updateIncident(editingIncident.id, formData);
      } else {
        await createIncident(formData);
      }
      fetchIncidents();
      resetForm();
    } catch (error) {
      console.error('Error saving incident:', error);
      alert('Error saving incident: ' + (error.response?.data || error.message));
    }
  };

  const handleEdit = (incident) => {
    setEditingIncident(incident);
    setFormData(incident);
    setShowForm(true);
  };

  const handleToggleVisibility = async (incident) => {
    try {
      await toggleIncidentVisibility(incident.id, !incident.is_visible);
      fetchIncidents();
    } catch (error) {
      console.error('Error toggling visibility:', error);
      alert('Error toggling visibility');
    }
  };

  const handlePublishServiceIncident = async (serviceId) => {
    try {
      await publishServiceIncident(serviceId);
      await fetchServices();
    } catch (error) {
      console.error('Error publishing incident:', error);
      alert('Error publishing incident');
    }
  };

  const handleUnpublishServiceIncident = async (serviceId) => {
    try {
      await unpublishServiceIncident(serviceId);
      await fetchServices();
    } catch (error) {
      console.error('Error unpublishing incident:', error);
      alert('Error unpublishing incident');
    }
  };



  const resetForm = () => {
    setFormData({ title: '', description: '', severity: 'minor', status: 'investigating', service_id: null, is_visible: false });
    setEditingIncident(null);
    setShowForm(false);
  };

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        <div className="flex justify-between items-center mb-6">
          <h1 className={theme === 'dark' ? 'text-2xl font-semibold text-white' : 'text-2xl font-semibold text-gray-900'}>Incidents</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            {showForm ? 'Cancel' : 'Add Incident'}
          </button>
        </div>

        {showForm && (
          <div className={theme === 'dark' ? 'bg-[#161b22] border border-[#30363d] rounded-lg p-6 mb-6' : 'bg-white shadow rounded-lg p-6 mb-6'}>
            <h2 className={theme === 'dark' ? 'text-lg font-medium text-white mb-4' : 'text-lg font-medium mb-4'}>{editingIncident ? 'Edit' : 'New'} Incident</h2>
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
                <label className={theme === 'dark' ? 'block text-sm font-medium text-gray-300' : 'block text-sm font-medium text-gray-700'}>Severity</label>
                <select
                  value={formData.severity}
                  onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                  className={theme === 'dark' ? 'mt-1 block w-full bg-[#0d1117] border border-[#30363d] rounded-md shadow-sm py-2 px-3 text-white' : 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3'}
                >
                  <option value="info">Info</option>
                  <option value="minor">Minor</option>
                  <option value="major">Major</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div>
                <label className={theme === 'dark' ? 'block text-sm font-medium text-gray-300' : 'block text-sm font-medium text-gray-700'}>Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className={theme === 'dark' ? 'mt-1 block w-full bg-[#0d1117] border border-[#30363d] rounded-md shadow-sm py-2 px-3 text-white' : 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3'}
                >
                  <option value="investigating">Investigating</option>
                  <option value="identified">Identified</option>
                  <option value="monitoring">Monitoring</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
              <div>
                <label className={theme === 'dark' ? 'block text-sm font-medium text-gray-300' : 'block text-sm font-medium text-gray-700'}>Service</label>
                <select
                  value={formData.service_id || ''}
                  onChange={(e) => setFormData({ ...formData, service_id: e.target.value ? parseInt(e.target.value) : null })}
                  className={theme === 'dark' ? 'mt-1 block w-full bg-[#0d1117] border border-[#30363d] rounded-md shadow-sm py-2 px-3 text-white' : 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3'}
                >
                  <option value="">None</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>{service.name}</option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
              >
                Save
              </button>
            </form>
          </div>
        )}

        {degradedServices.length > 0 && (
          <div className={theme === 'dark' ? 'bg-[#161b22] border border-[#30363d] rounded-lg p-6 mb-6' : 'bg-white shadow rounded-lg p-6 mb-6'}>
            <h2 className={theme === 'dark' ? 'text-lg font-medium text-yellow-400 mb-4' : 'text-lg font-medium text-yellow-600 mb-4'}>⚠️ Degraded Services</h2>
            <div className="space-y-3">
              {degradedServices.map((service) => (
                <div key={service.id} className="border-l-4 border-yellow-500 pl-4 py-2">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className={theme === 'dark' ? 'font-medium text-white' : 'font-medium'}>{service.name}</div>
                      <div className={theme === 'dark' ? 'text-sm text-gray-400' : 'text-sm text-gray-600'}>{service.description}</div>
                      {service.incident && (
                        <div className={theme === 'dark' ? 'text-sm text-gray-300 mt-1 italic' : 'text-sm text-gray-700 mt-1 italic'}>
                          Incident: {service.incident}
                        </div>
                      )}
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-2 ${
                        service.status === 'outage' ? 'bg-red-100 text-red-800' :
                        service.status === 'degraded' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {service.status}
                      </span>
                    </div>
                    <div className="ml-4">
                      {service.incident_published ? (
                        <button
                          onClick={() => handleUnpublishServiceIncident(service.id)}
                          className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
                        >
                          Unpublish
                        </button>
                      ) : (
                        <button
                          onClick={() => handlePublishServiceIncident(service.id)}
                          className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                        >
                          Publish
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className={theme === 'dark' ? 'bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden' : 'bg-white shadow overflow-hidden sm:rounded-md'}>
          {incidents.length === 0 ? (
            <div className={theme === 'dark' ? 'px-6 py-8 text-center text-gray-400' : 'px-6 py-8 text-center text-gray-500'}>
              No incidents found. Create your first incident.
            </div>
          ) : (
            <ul className={theme === 'dark' ? 'divide-y divide-[#30363d]' : 'divide-y divide-gray-200'}>
              {incidents.map((incident) => (
              <li key={incident.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className={theme === 'dark' ? 'text-lg font-medium text-white' : 'text-lg font-medium'}>{incident.title}</h3>
                    <p className={theme === 'dark' ? 'text-sm text-gray-400' : 'text-sm text-gray-500'}>{incident.description}</p>
                    <div className="flex gap-2 mt-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        {incident.severity}
                      </span>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {incident.status}
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${incident.is_visible ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {incident.is_visible ? '👁️ Published' : '🚫 Unpublished'}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleToggleVisibility(incident)}
                      className={`px-3 py-1 rounded ${incident.is_visible ? 'bg-gray-600 hover:bg-gray-700' : 'bg-green-600 hover:bg-green-700'} text-white`}
                    >
                      {incident.is_visible ? 'Unpublish' : 'Publish'}
                    </button>
                    <button
                      onClick={() => handleEdit(incident)}
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
