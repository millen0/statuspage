import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export default function ServicesArea() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/area/services`);
      const sortedServices = (res.data || []).sort((a, b) => {
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
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleVisibility = async (id, currentVisibility) => {
    try {
      await axios.patch(`${API_URL}/api/area/services/${id}/visibility`, {
        is_visible: !currentVisibility
      });
      fetchServices();
    } catch (error) {
      console.error('Error:', error);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Services Visibility</h1>
        <div className="bg-white rounded-lg shadow">
          {services.map(service => (
            <div key={service.id} className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="font-semibold">{service.name}</h3>
                <p className="text-sm text-gray-600">{service.description}</p>
              </div>
              <button
                onClick={() => toggleVisibility(service.id, service.is_visible)}
                className={`px-4 py-2 rounded ${
                  service.is_visible
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-300 text-gray-700'
                }`}
              >
                {service.is_visible ? 'Visible' : 'Hidden'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
