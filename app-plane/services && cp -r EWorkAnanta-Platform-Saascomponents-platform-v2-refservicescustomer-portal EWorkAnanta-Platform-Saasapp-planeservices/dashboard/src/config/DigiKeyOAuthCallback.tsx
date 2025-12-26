import { useEffect, useState } from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';

import { CNS_API_URL, getAdminAuthHeaders } from './api';

type CallbackStatus = 'pending' | 'success' | 'error';

const DIGIKEY_MESSAGE_TYPE = 'DIGIKEY_OAUTH_RESULT';

const sendResultToOpener = (
  status: CallbackStatus,
  payload?: { expiresAt?: string; refreshTokenRotated?: boolean },
  error?: string
) => {
  try {
    if (window.opener) {
      window.opener.postMessage(
        {
          type: DIGIKEY_MESSAGE_TYPE,
          status,
          payload,
          error,
        },
        '*'
      );
    }
  } catch (err) {
    console.error('Failed to post message to opener:', err);
  }
};

export const DigiKeyOAuthCallback = () => {
  const [status, setStatus] = useState<CallbackStatus>('pending');
  const [message, setMessage] = useState<string>('Completing DigiKey authorization…');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (!code) {
      const error = 'Missing authorization code in callback URL.';
      setStatus('error');
      setMessage(error);
      sendResultToOpener('error', undefined, error);
      return;
    }

    const exchangeCode = async () => {
      try {
        const headersInit = getAdminAuthHeaders();
        if (!headersInit) {
          throw new Error('Admin API token missing. Set VITE_CNS_ADMIN_TOKEN before authorizing DigiKey.');
        }
        const headers = new Headers(headersInit);
        headers.set('Content-Type', 'application/json');

        const response = await fetch(`${CNS_API_URL}/suppliers/digikey/oauth/token`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ code }),
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Failed to exchange authorization code (${response.status}): ${text}`);
        }

        const data = await response.json();
        setStatus('success');
        setMessage('DigiKey authorization complete. You can close this window.');
        sendResultToOpener('success', {
          expiresAt: data.expires_at,
          refreshTokenRotated: Boolean(data.refresh_token_rotated),
        });

        setTimeout(() => {
          window.close();
        }, 1200);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to complete authorization.';
        setStatus('error');
        setMessage(errorMessage);
        sendResultToOpener('error', undefined, errorMessage);
      }
    };

    void exchangeCode();
  }, []);

  const handleCloseWindow = () => {
    window.close();
  };

  return (
    <Box
      display="flex"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
      textAlign="center"
      p={4}
    >
      {status === 'pending' && (
        <>
          <CircularProgress color="primary" size={48} />
          <Typography variant="h6" mt={3}>
            Completing DigiKey authorization…
          </Typography>
          <Typography variant="body2" color="textSecondary" mt={1}>
            Please wait while we exchange the authorization code.
          </Typography>
        </>
      )}

      {status === 'success' && (
        <>
          <CheckCircleIcon color="success" sx={{ fontSize: 48 }} />
          <Typography variant="h5" mt={3}>
            Authorized!
          </Typography>
          <Typography variant="body1" mt={1}>
            {message}
          </Typography>
        </>
      )}

      {status === 'error' && (
        <>
          <ErrorIcon color="error" sx={{ fontSize: 48 }} />
          <Typography variant="h5" mt={3}>
            Authorization Failed
          </Typography>
          <Typography variant="body1" mt={1}>
            {message}
          </Typography>
          <Typography variant="body2" color="textSecondary" mt={1}>
            You can close this window and try again from the CNS dashboard.
          </Typography>
        </>
      )}

      <Button variant="outlined" sx={{ mt: 4 }} onClick={handleCloseWindow}>
        Close Window
      </Button>
    </Box>
  );
};

export default DigiKeyOAuthCallback;
