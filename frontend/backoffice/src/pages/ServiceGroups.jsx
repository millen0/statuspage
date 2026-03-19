import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useThemeStore } from '../contexts/themeStore';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export default function ServiceGroups() {
  const theme = useThemeStore((state) => state.theme);
  const [groups, setGroups] = useState([]);
  const [services, setServices] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    display_name: '',
    description: '',
    is_active: true,
    parent_service_id: null,
    member_ids: []
  });

  useEffect(() => {
    fetchGroups();
    fetchServices();
  }, []);

  const fetchGroups = async () => {
    try {
      const res = await axios.get(`${API_URL}/admin/service-groups`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setGroups(res.data || []);
    } catch (error) {
      console.error('Error fetching groups:', error);
    }
  };

  const fetchServices = async () => {
    try {
      const res = await axios.get(`${API_URL}/admin/services`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setServices(res.data || []);
    } catch (error) {
      console.error('Error fetching services:', error);
    }
  };

  // Generate slug from display name
  const generateSlug = (displayName) => {
    return displayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleDisplayNameChange = (value) => {
    setFormData({
      ...formData,
      display_name: value,
      name: generateSlug(value)
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingGroup) {
        await axios.put(`${API_URL}/admin/service-groups/${editingGroup.id}`, formData, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
      } else {
        await axios.post(`${API_URL}/admin/service-groups`, formData, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
      }
      fetchGroups();
      resetForm();
    } catch (error) {
      console.error('Error saving group:', error);
      alert('Error saving group');
    }
  };

  const handleEdit = async (group) => {
    setEditingGroup(group);
    
    // Fetch members
    try {
      const res = await axios.get(`${API_URL}/admin/service-groups/${group.id}/members`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const memberIds = res.data.map(m => m.id);
      
      setFormData({
        name: group.name,
        display_name: group.display_name,
        description: group.description || '',
        is_active: group.is_active,
        parent_service_id: group.parent_service_id || null,
        member_ids: memberIds
      });
    } catch (error) {
      console.error('Error fetching members:', error);
    }
    
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this group?')) return;
    try {
      await axios.delete(`${API_URL}/admin/service-groups/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      fetchGroups();
    } catch (error) {
      console.error('Error deleting group:', error);
    }
  };

  const toggleServiceMember = (serviceId) => {
    setFormData(prev => ({
      ...prev,
      member_ids: prev.member_ids.includes(serviceId)
        ? prev.member_ids.filter(id => id !== serviceId)
        : [...prev.member_ids, serviceId]
    }));
  };

  const resetForm = () => {
    setFormData({ name: '', display_name: '', description: '', is_active: true, parent_service_id: null, member_ids: [] });
    setEditingGroup(null);
    setShowForm(false);
  };

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        <div className="flex justify-between items-center mb-6">
          <h1 className={theme === 'dark' ? 'text-2xl font-semibold text-white' : 'text-2xl font-semibold text-gray-900'}>
            Service Groups
          </h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            {showForm ? 'Cancel' : 'Create Group'}
          </button>
        </div>

        {showForm && (
          <div className={theme === 'dark' ? 'bg-[#161b22] border border-[#30363d] rounded-lg p-6 mb-6' : 'bg-white shadow rounded-lg p-6 mb-6'}>
            <h2 className={theme === 'dark' ? 'text-lg font-medium text-white mb-4' : 'text-lg font-medium mb-4'}>
              {editingGroup ? 'Edit' : 'New'} Group
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={theme === 'dark' ? 'block text-sm font-medium text-gray-300' : 'block text-sm font-medium text-gray-700'}>
                  Group Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.display_name}
                  onChange={(e) => handleDisplayNameChange(e.target.value)}
                  className={theme === 'dark' ? 'mt-1 block w-full bg-[#0d1117] border border-[#30363d] rounded-md shadow-sm py-2 px-3 text-white' : 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3'}
                  placeholder="LIGHTHOUSE"
                />
                {formData.name && (
                  <p className={theme === 'dark' ? 'mt-1 text-xs text-gray-400' : 'mt-1 text-xs text-gray-500'}>
                    Slug: {formData.name}
                  </p>
                )}
              </div>
              <div>
                <label className={theme === 'dark' ? 'block text-sm font-medium text-gray-300' : 'block text-sm font-medium text-gray-700'}>
                  Parent Service (Optional)
                </label>
                <select
                  value={formData.parent_service_id || ''}
                  onChange={(e) => setFormData({ ...formData, parent_service_id: e.target.value ? parseInt(e.target.value) : null })}
                  className={theme === 'dark' ? 'mt-1 block w-full bg-[#0d1117] border border-[#30363d] rounded-md shadow-sm py-2 px-3 text-white' : 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3'}
                >
                  <option value="">-- No parent service --</option>
                  {services.map(service => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </select>
                <p className={theme === 'dark' ? 'mt-1 text-xs text-gray-400' : 'mt-1 text-xs text-gray-500'}>
                  Select a main service as the base for this group (e.g., LIGHTHOUSE service for Lighthouse group)
                </p>
              </div>
              <div>
                <label className={theme === 'dark' ? 'block text-sm font-medium text-gray-300' : 'block text-sm font-medium text-gray-700'}>
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className={theme === 'dark' ? 'mt-1 block w-full bg-[#0d1117] border border-[#30363d] rounded-md shadow-sm py-2 px-3 text-white' : 'mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3'}
                  rows="2"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor="is_active" className={theme === 'dark' ? 'ml-2 block text-sm text-gray-300' : 'ml-2 block text-sm text-gray-700'}>
                  Active
                </label>
              </div>
              <div>
                <label className={theme === 'dark' ? 'block text-sm font-medium text-gray-300 mb-2' : 'block text-sm font-medium text-gray-700 mb-2'}>
                  Additional Member Services
                </label>
                <p className={theme === 'dark' ? 'text-xs text-gray-400 mb-2' : 'text-xs text-gray-500 mb-2'}>
                  Select other services to include in this group
                </p>
                <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto border border-gray-300 rounded p-3">
                  {services.filter(s => s.id !== formData.parent_service_id).map(service => (
                    <label key={service.id} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.member_ids.includes(service.id)}
                        onChange={() => toggleServiceMember(service.id)}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <span className={theme === 'dark' ? 'text-sm text-gray-300' : 'text-sm text-gray-700'}>
                        {service.name}
                      </span>
                    </label>
                  ))}
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
          {groups.length === 0 ? (
            <div className={theme === 'dark' ? 'px-6 py-8 text-center text-gray-400' : 'px-6 py-8 text-center text-gray-500'}>
              No groups created yet.
            </div>
          ) : (
            <ul className={theme === 'dark' ? 'divide-y divide-[#30363d]' : 'divide-y divide-gray-200'}>
              {groups.map((group) => (
                <li key={group.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className={theme === 'dark' ? 'text-lg font-medium text-white' : 'text-lg font-medium'}>
                        {group.display_name}
                      </h3>
                      <p className={theme === 'dark' ? 'text-sm text-gray-400' : 'text-sm text-gray-500'}>
                        {group.description}
                      </p>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-2 ${
                        group.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {group.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(group)}
                        className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(group.id)}
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
