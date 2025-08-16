// import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Home } from '@/pages/Home'
import { Alerts } from '@/pages/Alerts'
import { Guides } from '@/pages/Guides'
import { Admin } from '@/pages/Admin'
import { Navigation } from '@/components/Navigation'
import { NotificationProvider } from '@/hooks/useNotifications'
import './App.css'

function App() {
  return (
    <NotificationProvider>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Navigation />
          <main className="container mx-auto px-4 py-6">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/guides" element={<Guides />} />
              <Route path="/admin" element={<Admin />} />
            </Routes>
          </main>
        </div>
      </Router>
    </NotificationProvider>
  )
}

export default App