import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../contexts/authStore';
import { useThemeStore } from '../contexts/themeStore';
import ThemeToggle from './ThemeToggle';

export default function Layout({ children }) {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const theme = useThemeStore((state) => state.theme);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className={theme === 'dark' ? 'min-h-screen bg-[#0d1117]' : 'min-h-screen bg-gray-100'}>
      <nav className={theme === 'dark' ? 'bg-[#161b22] shadow-sm border-b border-[#30363d]' : 'bg-white shadow-sm'}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className={`text-xl font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Pier Cloud Backoffice</h1>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link to="/" className={theme === 'dark' ? 'border-transparent text-gray-400 hover:text-gray-200 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium'}>
                  Dashboard
                </Link>
                <Link to="/services" className={theme === 'dark' ? 'border-transparent text-gray-400 hover:text-gray-200 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium'}>
                  Services
                </Link>
                <Link to="/incidents" className={theme === 'dark' ? 'border-transparent text-gray-400 hover:text-gray-200 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium'}>
                  Incidents
                </Link>
                <Link to="/maintenances" className={theme === 'dark' ? 'border-transparent text-gray-400 hover:text-gray-200 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium'}>
                  Maintenances
                </Link>
                <Link to="/subscribers" className={theme === 'dark' ? 'border-transparent text-gray-400 hover:text-gray-200 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium'}>
                  Subscribers
                </Link>
                <Link to="/settings" className={theme === 'dark' ? 'border-transparent text-gray-400 hover:text-gray-200 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium'}>
                  Settings
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <button
                onClick={handleLogout}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
