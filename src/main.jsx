import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { storage } from './supabase.js'

// Attach storage adapter to window for use by App component
window.storage = storage

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
