import React from 'react'
import ReactDOM from 'react-dom/client'
import { Auth0Provider } from '@auth0/auth0-react'
import { Auth0StateSync } from './components/Auth0StateSync'
import App from './App.tsx'
import './utils/devLogger' // Initialize dev logger in development mode

// Auth0 configuration
const auth0Config = {
  domain: import.meta.env.VITE_AUTH0_DOMAIN || '',
  clientId: import.meta.env.VITE_AUTH0_CLIENT_ID || '',
  authorizationParams: {
    redirect_uri: window.location.origin,
    audience: import.meta.env.VITE_AUTH0_AUDIENCE || undefined,
  },
  // Use localStorage to avoid slow iframe-based silent auth on page load
  cacheLocation: 'localstorage' as const,
  // Enable refresh tokens for better UX
  useRefreshTokens: true,
}

// Check if Auth0 is enabled
const isAuth0Enabled = import.meta.env.VITE_AUTH_PROVIDER?.toLowerCase() === 'auth0'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isAuth0Enabled ? (
      <Auth0Provider {...auth0Config}>
        <Auth0StateSync>
          <App />
        </Auth0StateSync>
      </Auth0Provider>
    ) : (
      <App />
    )}
  </React.StrictMode>,
)
