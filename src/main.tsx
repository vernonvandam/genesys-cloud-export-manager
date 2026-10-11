import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import { SupabaseAuthProvider } from './auth/SupabaseAuthContext'
import { AuthProvider } from './auth/AuthContext'
import App from './App'

import './index.css'
import './App.scss'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <SupabaseAuthProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </SupabaseAuthProvider>
    </BrowserRouter>
  </StrictMode>,
)