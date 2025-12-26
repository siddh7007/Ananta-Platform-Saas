/**
 * Keycloak Login Page Component - CNS Dashboard
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
          bgcolor: 'background.default',
        }}
      >
        <CircularProgress color="primary" />
        <Typography sx={{ mt: 2, color: 'text.primary' }}>
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
          bgcolor: 'background.default',
        }}
      >
        <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}>
          <Typography sx={{ color: 'error.main', mb: 2 }}>{error}</Typography>
          <Button variant="contained" onClick={() => window.location.reload()}>
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
        bgcolor: 'background.default',
      }}
    >
      <Paper
        elevation={3}
        sx={{
          p: 6,
          textAlign: 'center',
          borderRadius: 2,
          maxWidth: 400,
          width: '90%',
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
        }}
      >
        <Typography variant="h4" sx={{ color: 'text.primary', mb: 2, fontWeight: 700 }}>
          CNS Dashboard
        </Typography>
        <Typography variant="subtitle1" sx={{ color: 'primary.main', mb: 2 }}>
          Platform Admin Portal
        </Typography>

        <Typography sx={{ color: 'text.secondary', mb: 4 }}>
          Sign in with your Components Platform admin account
        </Typography>

        <Button
          variant="contained"
          size="large"
          fullWidth
          onClick={handleLogin}
          color="primary"
          sx={{
            py: 1.5,
            fontSize: '1rem',
            fontWeight: 600,
          }}
        >
          Sign In with SSO
        </Button>

        <Typography sx={{ color: 'text.disabled', mt: 4, fontSize: '0.75rem' }}>
          Single Sign-On powered by Keycloak
        </Typography>
      </Paper>
    </Box>
  );
};

export default KeycloakLogin;
