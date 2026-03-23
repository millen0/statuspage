import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { getServices, createService, updateService, deleteService, toggleServiceVisibility } from '../services/api';
import { useThemeStore } from '../contexts/themeStore';

export default function Services() {
  const theme = useThemeStore((state) => state.theme);
  const [services, setServices] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'operational',
    position: 0,
    url: '',
    heartbeat_interval: 60,
    request_timeout: 120,
    retries: 5,
    is_visible: true,
  });

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const response = await getServices();
      const sortedServices = (response.data || []).sort((a, b) => {
        // Visible services first (true = 1, false = 0)
        // Sort by is_visible descending (true before false)
        if (a.is_visible === b.is_visible) {
          // If same visibility, sort by name
          return a.name.localeCompare(b.name);
        }
        return b.is_visible - a.is_visible;
      });
      setServices(sortedServices);
    } catch (error) {
      console.error('Error fetching services:', error);
      setServices([]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingService) {
        await updateService(editingService.id, formData);
      } else {
        await createService(formData);
      }
      fetchServices();
      resetForm();
    } catch (error) {
      console.error('Error saving service:', error);
    }
  };

  const handleEdit = (service) => {
    setEditingService(service);
    setFormData(service);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure?')) {
      try {
        await deleteService(id);
        fetchServices();
      } catch (error) {
        console.error('Error deleting service:', error);
      }
    }
  };

  const handleToggleVisibility = async (service) => {
    try {
      await toggleServiceVisibility(service.id, !service.is_visible);
      fetchServices();
    } catch (error) {
      console.error('Error toggling visibility:', error);
      alert('Error toggling visibility');
    }
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', status: 'operational', position: 0, url: '', heartbeat_interval: 60, request_timeout: 120, retries: 5, is_visible: true });
    setEditingService(null);
    setShowForm(false);
  };

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        <div className="flex justify-between items-center mb-6">
          <h1 className={theme === 'dark' ? 'text-2xl font-semibold text-white' : 'text-2xl font-semibold text-gray-900'}>Services</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            {showForm ? 'Cancel' : 'Add Service'}
          </button>
        </div>

        {showForm && (
          <div className={theme === 'dark' ? 'bg-[#161b22] border border-[#30363d] rounded-lg p-6 mb-6' : 'bg-white shadow rounded-lg p-6 mb-6'}>
            <h2 className={theme === 'dark' ? 'text-lg font-medium text-white mb-4' : 'text-lg font-medium mb-4'}>{editingService ? 'Edit' : 'New'} Service</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={theme === 'dark' ? 'block text-sm font-medium text-gray-300' : 'block text-sm font-medium text-gray-700'}>Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={theme === 'dark' ? 'mt-1 block w-full bg-[#0d1117] border border-[#30363d] rounded-md shadow-sm py-2 px-3 text-white' : 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3'}
                />
              </div>
              <div>
                <label className={theme === 'dark' ? 'block text-sm font-medium text-gray-300' : 'block text-sm font-medium text-gray-700'}>Description</label>
                <textarea
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
                  <option value="operational">Operational</option>
                  <option value="degraded">Degraded</option>
                  <option value="outage">Outage</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </div>
              <div>
                <label className={theme === 'dark' ? 'block text-sm font-medium text-gray-300' : 'block text-sm font-medium text-gray-700'}>Position</label>
                <input
                  type="number"
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: parseInt(e.target.value) })}
                  className={theme === 'dark' ? 'mt-1 block w-full bg-[#0d1117] border border-[#30363d] rounded-md shadow-sm py-2 px-3 text-white' : 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3'}
                />
              </div>
              <div>
                <label className={theme === 'dark' ? 'block text-sm font-medium text-gray-300' : 'block text-sm font-medium text-gray-700'}>URL (Endpoint)</label>
                <input
                  type="text"
                  placeholder="https://api.example.com/health"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  className={theme === 'dark' ? 'mt-1 block w-full bg-[#0d1117] border border-[#30363d] rounded-md shadow-sm py-2 px-3 text-white' : 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3'}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={theme === 'dark' ? 'block text-sm font-medium text-gray-300' : 'block text-sm font-medium text-gray-700'}>Heartbeat Interval (s)</label>
                  <input
                    type="number"
                    min="10"
                    value={formData.heartbeat_interval}
                    onChange={(e) => setFormData({ ...formData, heartbeat_interval: parseInt(e.target.value) })}
                    className={theme === 'dark' ? 'mt-1 block w-full bg-[#0d1117] border border-[#30363d] rounded-md shadow-sm py-2 px-3 text-white' : 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3'}
                  />
                </div>
                <div>
                  <label className={theme === 'dark' ? 'block text-sm font-medium text-gray-300' : 'block text-sm font-medium text-gray-700'}>Request Timeout (s)</label>
                  <input
                    type="number"
                    min="5"
                    value={formData.request_timeout}
                    onChange={(e) => setFormData({ ...formData, request_timeout: parseInt(e.target.value) })}
                    className={theme === 'dark' ? 'mt-1 block w-full bg-[#0d1117] border border-[#30363d] rounded-md shadow-sm py-2 px-3 text-white' : 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3'}
                  />
                </div>
                <div>
                  <label className={theme === 'dark' ? 'block text-sm font-medium text-gray-300' : 'block text-sm font-medium text-gray-700'}>Retries</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={formData.retries}
                    onChange={(e) => setFormData({ ...formData, retries: parseInt(e.target.value) })}
                    className={theme === 'dark' ? 'mt-1 block w-full bg-[#0d1117] border border-[#30363d] rounded-md shadow-sm py-2 px-3 text-white' : 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3'}
                  />
                </div>
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

        <div className={theme === 'dark' ? 'bg-[#161b22] border border-[#30363d] rounded-lg overflow-hidden' : 'bg-white shadow overflow-hidden sm:rounded-md'}>
          {services.length === 0 ? (
            <div className={theme === 'dark' ? 'px-6 py-8 text-center text-gray-400' : 'px-6 py-8 text-center text-gray-500'}>
              No services found. Create your first service.
            </div>
          ) : (
            <ul className={theme === 'dark' ? 'divide-y divide-[#30363d]' : 'divide-y divide-gray-200'}>
              {services.map((service) => (
              <li key={service.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className={theme === 'dark' ? 'text-lg font-medium text-white' : 'text-lg font-medium'}>{service.name}</h3>
                    <p className={theme === 'dark' ? 'text-sm text-gray-400' : 'text-sm text-gray-500'}>{service.description}</p>
                    <div className="flex gap-2 mt-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        service.status === 'operational' ? 'bg-green-100 text-green-800' :
                        service.status === 'degraded' ? 'bg-yellow-100 text-yellow-800' :
                        service.status === 'outage' ? 'bg-red-100 text-red-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {service.status}
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        service.is_visible ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {service.is_visible ? '👁️ Visible' : '🚫 Hidden'}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleToggleVisibility(service)}
                      className={`px-3 py-1 rounded ${service.is_visible ? 'bg-gray-600 hover:bg-gray-700' : 'bg-green-600 hover:bg-green-700'} text-white`}
                    >
                      {service.is_visible ? 'Hide' : 'Show'}
                    </button>
                    <button
                      onClick={() => handleEdit(service)}
                      className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(service.id)}
                      className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Delete
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
