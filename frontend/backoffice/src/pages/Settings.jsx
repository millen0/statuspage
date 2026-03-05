import { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export default function Settings() {
  const [displayMode, setDisplayMode] = useState('classic');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchDisplayMode();
  }, []);

  const fetchDisplayMode = async () => {
    try {
      const res = await axios.get(`${API_URL}/public/display-mode`);
      setDisplayMode(res.data.display_mode || 'classic');
    } catch (error) {
      console.error('Error fetching display mode:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_URL}/admin/settings/display-mode`,
        { display_mode: displayMode },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Layout><div className="p-8">Loading...</div></Layout>;

  return (
    <Layout>
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-6">Settings</h1>
        
        <div className="bg-white rounded-lg shadow p-6 max-w-2xl">
          <h2 className="text-lg font-semibold mb-4">Display Mode</h2>
          <p className="text-gray-600 mb-4">Choose how services are displayed on the public status page</p>
          
          <div className="space-y-3">
            <label className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="displayMode"
                value="classic"
                checked={displayMode === 'classic'}
                onChange={(e) => setDisplayMode(e.target.value)}
                className="mr-3"
              />
              <div>
                <div className="font-medium">Classic Mode</div>
                <div className="text-sm text-gray-600">Simple grid with service name, status dot, and status label</div>
              </div>
            </label>

            <label className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="displayMode"
                value="uptime"
                checked={displayMode === 'uptime'}
                onChange={(e) => setDisplayMode(e.target.value)}
                className="mr-3"
              />
              <div>
                <div className="font-medium">Uptime Mode</div>
                <div className="text-sm text-gray-600">Detailed cards with 90-day uptime graph (GitHub-style)</div>
              </div>
            </label>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </Layout>
  );
}
