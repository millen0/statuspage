import { useState } from 'react';
import { api } from '../services/api';

export default function SubscribeForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus('');

    try {
      await api.post('/public/subscribe', { email });
      setStatus('success');
      setEmail('');
    } catch (error) {
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
          className="flex-1 px-4 py-2 text-sm bg-white border border-gray-300 rounded-md text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 text-sm bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Subscribing...' : 'Subscribe'}
        </button>
      </form>
      {status === 'success' && (
        <p className="mt-2 text-xs text-green-600 text-center">✓ Successfully subscribed!</p>
      )}
      {status === 'error' && (
        <p className="mt-2 text-xs text-red-600 text-center">✗ Failed to subscribe. Please try again.</p>
      )}
    </div>
  );
}
