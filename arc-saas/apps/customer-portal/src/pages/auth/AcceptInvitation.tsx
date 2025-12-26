/**
 * Accept Invitation Page
 *
 * Handles invitation acceptance flow:
 * 1. Validates invitation token
 * 2. If user exists - links to organization
 * 3. If new user - redirects to login/signup with invitation context
 * 4. On success - redirects to dashboard
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, Mail, Building2, UserPlus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { env } from '@/config/env';

interface InvitationDetails {
  id: string;
  email: string;
  organizationId: string;
  organizationName: string;
  role: string;
  invitedBy: string;
  expiresAt: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
}

type PageState = 'loading' | 'valid' | 'accepting' | 'success' | 'error' | 'expired' | 'already_accepted';

export function AcceptInvitationPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, login } = useAuth();

  const [state, setState] = useState<PageState>('loading');
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Validate invitation token on mount
  useEffect(() => {
    if (!token) {
      setState('error');
      setError('Invalid invitation link. No token provided.');
      return;
    }

    validateInvitation(token);
  }, [token]);

  // If user logs in while on this page, try to accept
  useEffect(() => {
    if (isAuthenticated && state === 'valid' && invitation) {
      acceptInvitation();
    }
  }, [isAuthenticated, state, invitation]);

  const validateInvitation = async (inviteToken: string) => {
    try {
      setState('loading');

      // Call platform API to validate invitation
      const apiUrl = env.api.platform || '/api';
      const response = await fetch(`${apiUrl}/user-invitations/validate/${inviteToken}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json();

        if (response.status === 404) {
          setState('error');
          setError('This invitation link is invalid or has been revoked.');
          return;
        }

        if (response.status === 410) {
          setState('expired');
          setError('This invitation has expired. Please request a new invitation.');
          return;
        }

        throw new Error(data.message || 'Failed to validate invitation');
      }

      const data = await response.json();

      if (data.status === 'accepted') {
        setState('already_accepted');
        setInvitation(data);
        return;
      }

      if (data.status === 'expired') {
        setState('expired');
        setError('This invitation has expired. Please request a new invitation.');
        return;
      }

      setInvitation(data);
      setState('valid');

      // Store invitation token for after login (both session and local for cross-tab resilience)
      sessionStorage.setItem('pendingInvitationToken', inviteToken);
      localStorage.setItem('cbp_pending_invitation', inviteToken);

    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Failed to validate invitation');
    }
  };

  const acceptInvitation = async () => {
    if (!token || !invitation) return;

    try {
      setState('accepting');

      const apiUrl = env.api.platform || '/api';
      const authToken = localStorage.getItem('arc_token') || sessionStorage.getItem('arc_token');

      const response = await fetch(`${apiUrl}/user-invitations/${token}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to accept invitation');
      }

      // Clear pending invitation from storage (both session and local)
      sessionStorage.removeItem('pendingInvitationToken');
      localStorage.removeItem('cbp_pending_invitation');

      setState('success');

      // Redirect to dashboard after short delay
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 2000);

    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Failed to accept invitation');
    }
  };

  const handleLogin = async () => {
    try {
      await login();
    } catch (err) {
      console.error('Login failed:', err);
    }
  };

  const handleSignUp = () => {
    // Redirect to admin portal signup with invitation context
    const signupUrl = env.adminPortal.url;
    const returnUrl = encodeURIComponent(window.location.href);
    if (signupUrl) {
      // Store return URL in localStorage (survives cross-domain redirect)
      localStorage.setItem('cbp_signup_return_url', window.location.href);
      window.location.href = `${signupUrl}/register?return_url=${returnUrl}&invitation=${token}`;
    }
  };

  // Loading state
  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-8 text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900">Validating Invitation...</h1>
          <p className="text-gray-600 mt-2">Please wait while we verify your invitation.</p>
        </div>
      </div>
    );
  }

  // Error state
  if (state === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mx-auto mb-4">
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Invalid Invitation</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/landing')}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  // Expired state
  if (state === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-yellow-100 mx-auto mb-4">
            <Mail className="w-8 h-8 text-yellow-600" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Invitation Expired</h1>
          <p className="text-gray-600 mb-6">
            This invitation has expired. Please contact the person who invited you to send a new invitation.
          </p>
          <button
            onClick={() => navigate('/landing')}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  // Already accepted state
  if (state === 'already_accepted') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Already Accepted</h1>
          <p className="text-gray-600 mb-6">
            You have already accepted this invitation and are a member of{' '}
            <strong>{invitation?.organizationName}</strong>.
          </p>
          <button
            onClick={handleLogin}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  // Accepting state
  if (state === 'accepting') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-8 text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-gray-900">Joining Organization...</h1>
          <p className="text-gray-600 mt-2">Setting up your access to {invitation?.organizationName}.</p>
        </div>
      </div>
    );
  }

  // Success state
  if (state === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
        <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Welcome!</h1>
          <p className="text-gray-600 mb-4">
            You are now a member of <strong>{invitation?.organizationName}</strong> as {invitation?.role}.
          </p>
          <p className="text-sm text-gray-500">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  // Valid invitation - show accept UI
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-2xl p-8">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mx-auto mb-4">
            <UserPlus className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">You're Invited!</h1>
        </div>

        {/* Invitation Details */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <Building2 className="w-5 h-5 text-gray-500" />
            <div>
              <p className="text-sm text-gray-500">Organization</p>
              <p className="font-semibold text-gray-900">{invitation?.organizationName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 mb-3">
            <Mail className="w-5 h-5 text-gray-500" />
            <div>
              <p className="text-sm text-gray-500">Invited Email</p>
              <p className="font-semibold text-gray-900">{invitation?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <UserPlus className="w-5 h-5 text-gray-500" />
            <div>
              <p className="text-sm text-gray-500">Your Role</p>
              <p className="font-semibold text-gray-900 capitalize">{invitation?.role}</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {isAuthenticated ? (
          // Already logged in - accept directly
          <button
            onClick={acceptInvitation}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg mb-3"
          >
            Accept Invitation
          </button>
        ) : (
          // Not logged in - show login/signup options
          <>
            <p className="text-center text-gray-600 mb-4">
              Sign in or create an account to join the organization.
            </p>
            <button
              onClick={handleLogin}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg mb-3"
            >
              Sign In with Existing Account
            </button>
            <button
              onClick={handleSignUp}
              className="w-full py-3 px-4 border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold rounded-lg"
            >
              Create New Account
            </button>
          </>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-gray-500 mt-6">
          By accepting this invitation, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}

export default AcceptInvitationPage;
