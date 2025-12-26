/**
 * Dev Mode Login Page
 * Shows bypass button for dev@ananta.com quick access
 */

import { useState } from 'react';
import { useLogin, useNotify } from 'react-admin';
import { supabase } from '../providers/dataProvider';
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
  // Pre-fill with env defaults for faster dev workflow
  const [username, setUsername] = useState(import.meta.env.VITE_DEV_DEFAULT_EMAIL || '');
  const [password, setPassword] = useState(import.meta.env.VITE_DEV_DEFAULT_PASSWORD || '');
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

  // Sign up state
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [tenantIdInput, setTenantIdInput] = useState('');

  const handleSignUp = async () => {
    try {
      // Optional: store organization id for first-login mapping
      if (tenantIdInput) {
        try { localStorage.setItem('signup_organization_id', tenantIdInput.trim()); } catch {}
      }
      const redirectTo = window.location.origin + '/customer-portal';
      const { error } = await supabase.auth.signUp({
        email: signupEmail.trim(),
        password: signupPassword,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) throw error;
      notify('Account created. You can now log in.', { type: 'info' });
      // Attempt immediate login (autoconfirm is enabled in dev)
      await login({ username: signupEmail.trim(), password: signupPassword });
    } catch (err: any) {
      notify(err?.message || 'Sign up failed', { type: 'error' });
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Card sx={{ maxWidth: 400, width: '100%', m: 2 }}>
        <CardContent>
          {/* Header */}
          <Typography variant="h5" align="center" gutterBottom fontWeight="bold">
            Components Platform
          </Typography>
          <Typography variant="body2" align="center" color="text.secondary" gutterBottom>
            Customer Portal - React Admin
          </Typography>

      {/* Login Form */}
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

      <Divider sx={{ my: 2 }}>
        <Typography variant="caption" color="text.secondary">
          New here?
        </Typography>
      </Divider>

      {/* Sign Up */}
      <TextField
        label="Email"
        type="email"
        value={signupEmail}
        onChange={(e) => setSignupEmail(e.target.value)}
        fullWidth
        margin="normal"
        variant="outlined"
      />
      <TextField
        label="Password"
        type="password"
        value={signupPassword}
        onChange={(e) => setSignupPassword(e.target.value)}
        fullWidth
        margin="normal"
        variant="outlined"
      />
      <TextField
        label="Organization Code (Organization ID, optional)"
        placeholder="a1111111-1111-1111-1111-111111111111"
        value={tenantIdInput}
        onChange={(e) => setTenantIdInput(e.target.value)}
        fullWidth
        margin="normal"
        variant="outlined"
        helperText="If provided, your account will join this organization."
      />
      <Button
        variant="contained"
        color="primary"
        fullWidth
        size="large"
        onClick={handleSignUp}
        sx={{ mt: 1, textTransform: 'none', fontWeight: 'bold' }}
      >
        Sign up
      </Button>

        </CardContent>
      </Card>

      <Typography variant="caption" color="white" sx={{ mt: 2, opacity: 0.8 }}>
        Port 27510 • Supabase Database: localhost:27541
      </Typography>
    </Box>
  );
};
