/**
 * Keycloak Login Page Component - Customer Portal
 *
 * Shows loading state while checking SSO,
 * then redirects to Keycloak if not authenticated.
 */

import React, { useEffect, useState } from 'react';
import { Box, CircularProgress, Typography, Button, Paper } from '@mui/material';
import { initKeycloak, login } from './keycloakConfig';

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
          // Not authenticated - show login button
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
          bgcolor: '#f5f5f5',
        }}
        role="status"
        aria-live="polite"
        aria-label="Loading authentication status"
      >
        <CircularProgress color="primary" aria-hidden="true" />
        <Typography sx={{ mt: 2, color: '#333' }}>
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
          bgcolor: '#f5f5f5',
        }}
        role="alert"
        aria-live="assertive"
      >
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography sx={{ color: '#d32f2f', mb: 2 }} role="alert">{error}</Typography>
          <Button
            variant="contained"
            onClick={() => window.location.reload()}
            aria-label="Retry authentication"
          >
            Retry
          </Button>
        </Paper>
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
        bgcolor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
      component="main"
      role="main"
    >
      <Paper
        elevation={8}
        sx={{
          p: 6,
          textAlign: 'center',
          borderRadius: 3,
          maxWidth: 400,
          width: '90%',
        }}
        component="section"
        aria-labelledby="login-heading"
      >
        <Typography
          id="login-heading"
          variant="h4"
          sx={{ color: '#333', mb: 2, fontWeight: 700 }}
          component="h1"
        >
          Customer Portal
        </Typography>

        <Typography sx={{ color: '#666', mb: 4 }}>
          Sign in with your Components Platform account
        </Typography>

        <Button
          variant="contained"
          size="large"
          fullWidth
          onClick={handleLogin}
          sx={{
            bgcolor: '#667eea',
            color: '#fff',
            '&:hover': { bgcolor: '#5a6fd6' },
            py: 1.5,
            fontSize: '1rem',
            fontWeight: 600,
          }}
          aria-label="Sign in with single sign-on using Keycloak"
        >
          Sign In with SSO
        </Button>

        <Typography sx={{ color: '#999', mt: 4, fontSize: '0.75rem' }} aria-label="Authentication provider information">
          Single Sign-On powered by Keycloak
        </Typography>
      </Paper>
    </Box>
  );
};

export default KeycloakLogin;
