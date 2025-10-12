import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'
import { AnalyticsProvider } from './context/AnalyticsContext'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AnalyticsProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AnalyticsProvider>
  </React.StrictMode>,
)