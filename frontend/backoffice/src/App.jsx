import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './contexts/authStore';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Services from './pages/Services';
import ServiceGroups from './pages/ServiceGroups';
import Incidents from './pages/Incidents';
import Maintenances from './pages/Maintenances';
import Subscribers from './pages/Subscribers';
import Settings from './pages/Settings';

export default function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <BrowserRouter basename="/area">
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <Login />} />
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/services" element={<ProtectedRoute><Services /></ProtectedRoute>} />
        <Route path="/groups" element={<ProtectedRoute><ServiceGroups /></ProtectedRoute>} />
        <Route path="/incidents" element={<ProtectedRoute><Incidents /></ProtectedRoute>} />
        <Route path="/maintenances" element={<ProtectedRoute><Maintenances /></ProtectedRoute>} />
        <Route path="/subscribers" element={<ProtectedRoute><Subscribers /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}
