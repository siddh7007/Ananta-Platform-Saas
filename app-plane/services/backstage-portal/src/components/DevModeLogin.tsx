/**
 * Dev Mode Login Page
 * Shows bypass button for dev@ananta.com quick access
 */

import { useState } from 'react';
import { useLogin, useNotify } from 'react-admin';
import {
  Card,
  CardContent,
  TextField,
  Button,
  Box,
  Typography,
  Divider,
  Alert,
} from '@mui/material';
import { Code as DevIcon, VpnKey as KeyIcon } from '@mui/icons-material';

export const DevModeLogin = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const login = useLogin();
  const notify = useNotify();

  const handleDevBypass = () => {
    // Bypass authentication for dev mode
    login({ username: 'dev@ananta.com', password: 'dev' })
      .then(() => {
        notify('🔓 Dev Mode: Logged in as dev@ananta.com with full access', { type: 'success' });
      })
      .catch(() => {
        notify('Dev mode login failed', { type: 'error' });
      });
  };

  const handleNormalLogin = (e: React.FormEvent) => {
    e.preventDefault();
    login({ username, password })
      .catch(() => {
        notify('Invalid credentials', { type: 'error' });
      });
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: 'background.default',
      }}
    >
      <Card variant="outlined" sx={{ maxWidth: 400, width: '100%', m: 2 }}>
        <CardContent>
          {/* Header */}
          <Typography variant="h5" align="center" gutterBottom fontWeight="bold">
            Components Platform
          </Typography>
          <Typography variant="body2" align="center" color="text.secondary" gutterBottom>
            Backstage Admin Portal - Platform Management
          </Typography>

          {/* Dev Mode Bypass */}
          <Box sx={{ mt: 3, mb: 2 }}>
            <Alert severity="info" icon={<DevIcon />}>
              <Typography variant="body2" fontWeight="bold">
                Development Mode
              </Typography>
              <Typography variant="caption">
                Quick access for dev@ananta.com with full database permissions
              </Typography>
            </Alert>
          </Box>

          <Button
            variant="contained"
            color="secondary"
            fullWidth
            size="large"
            startIcon={<DevIcon />}
            onClick={handleDevBypass}
            sx={{ mb: 3, textTransform: 'none', fontWeight: 'bold' }}
          >
            Bypass Auth - Login as Dev Ananta
          </Button>

          <Divider sx={{ my: 2 }}>
            <Typography variant="caption" color="text.secondary">
              OR
            </Typography>
          </Divider>

          {/* Normal Login Form */}
          <form onSubmit={handleNormalLogin}>
            <TextField
              label="Email"
              type="email"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              fullWidth
              margin="normal"
              variant="outlined"
              autoComplete="email"
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              margin="normal"
              variant="outlined"
              autoComplete="current-password"
            />
            <Button
              type="submit"
              variant="outlined"
              color="primary"
              fullWidth
              size="large"
              startIcon={<KeyIcon />}
              sx={{ mt: 2, textTransform: 'none' }}
            >
              Login with Supabase Auth
            </Button>
          </form>

          {/* Dev User Info */}
          <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary" display="block">
              Dev User Details:
            </Typography>
            <Typography variant="body2" fontFamily="monospace">
              • Email: dev@ananta.com
            </Typography>
            <Typography variant="body2" fontFamily="monospace">
              • Organization: Ananta Platform
            </Typography>
            <Typography variant="body2" fontFamily="monospace">
              • Role: Platform Admin (Full Access)
            </Typography>
            <Typography variant="body2" fontFamily="monospace">
              • Access: Docker, Services, Components, BOMs
            </Typography>
          </Box>
        </CardContent>
      </Card>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 2 }}>
        Port 27520 • Supabase Database: localhost:27541
      </Typography>
    </Box>
  );
};
