/**
 * Keycloak Login Page Component
 *
 * Shows loading state while checking SSO,
 * then redirects to Keycloak if not authenticated.
 */

import React, { useEffect, useState } from 'react';
import { Box, CircularProgress, Typography, Button } from '@mui/material';
import { initKeycloak, getKeycloak, login } from './keycloakConfig';

export const KeycloakLogin: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authenticated = await initKeycloak();

        if (authenticated) {
          // Already authenticated via SSO - redirect to app
          window.location.href = '/';
        } else {
          // Not authenticated - show login button or auto-redirect
          setLoading(false);
        }
      } catch (err) {
        console.error('[KeycloakLogin] Init error:', err);
        setError('Failed to connect to authentication server');
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const handleLogin = () => {
    login();
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          bgcolor: '#1a1a2e',
        }}
      >
        <CircularProgress sx={{ color: '#00ff88' }} />
        <Typography sx={{ mt: 2, color: '#fff' }}>
          Checking authentication...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          bgcolor: '#1a1a2e',
        }}
      >
        <Typography sx={{ color: '#ff4444', mb: 2 }}>{error}</Typography>
        <Button variant="contained" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        bgcolor: '#1a1a2e',
      }}
    >
      <Typography variant="h4" sx={{ color: '#fff', mb: 4 }}>
        Backstage Admin Portal
      </Typography>

      <Typography sx={{ color: '#888', mb: 4, textAlign: 'center' }}>
        Sign in with your Components Platform account
      </Typography>

      <Button
        variant="contained"
        size="large"
        onClick={handleLogin}
        sx={{
          bgcolor: '#00ff88',
          color: '#000',
          '&:hover': { bgcolor: '#00cc66' },
          px: 4,
          py: 1.5,
        }}
      >
        Sign In with SSO
      </Button>

      <Typography sx={{ color: '#666', mt: 4, fontSize: '0.875rem' }}>
        Single Sign-On powered by Keycloak
      </Typography>
    </Box>
  );
};

export default KeycloakLogin;
