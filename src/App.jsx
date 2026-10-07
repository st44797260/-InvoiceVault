import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Archive from './pages/Archive.jsx'
import Dashboard from './pages/Dashboard.jsx'
import InvoiceDetail from './pages/InvoiceDetail.jsx'
import Invoices from './pages/Invoices.jsx'
import Reports from './pages/Reports.jsx'
import Settings from './pages/Settings.jsx'
import Upload from './pages/Upload.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="invoices/:id" element={<InvoiceDetail />} />
          <Route path="upload" element={<Upload />} />
          <Route path="archive" element={<Archive />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
