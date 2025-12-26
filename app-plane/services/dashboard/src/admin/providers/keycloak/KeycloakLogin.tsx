/**
 * Keycloak Login Page - Dashboard (Next.js)
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
          window.location.href = '/';
        } else {
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
      >
        <CircularProgress color="primary" />
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
      >
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography sx={{ color: '#d32f2f', mb: 2 }}>{error}</Typography>
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
        background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
      }}
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
      >
        <Typography variant="h4" sx={{ color: '#333', mb: 2, fontWeight: 700 }}>
          Dashboard
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
            bgcolor: '#3b82f6',
            color: '#fff',
            py: 1.5,
            fontSize: '1rem',
            fontWeight: 600,
          }}
        >
          Sign In with SSO
        </Button>

        <Typography sx={{ color: '#999', mt: 4, fontSize: '0.75rem' }}>
          Single Sign-On powered by Keycloak
        </Typography>
      </Paper>
    </Box>
  );
};

export default KeycloakLogin;
