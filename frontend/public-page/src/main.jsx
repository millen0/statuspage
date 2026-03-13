import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import Unsubscribe from './pages/Unsubscribe.jsx'
import ServicesArea from './pages/ServicesArea.jsx'
import IncidentHistory from './pages/IncidentHistory.jsx'
import MaintenanceHistory from './pages/MaintenanceHistory.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/unsubscribe" element={<Unsubscribe />} />
        <Route path="/area/services" element={<ServicesArea />} />
        <Route path="/history" element={<IncidentHistory />} />
        <Route path="/maintenance-history" element={<MaintenanceHistory />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
