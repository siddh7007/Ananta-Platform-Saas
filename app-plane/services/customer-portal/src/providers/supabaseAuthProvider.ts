import { AuthProvider } from 'react-admin';
import { supabase } from './dataProvider';
import { publishCustomEvent } from '../services/eventPublisher';

// Platform Super Admin organization ID - used as fallback for new users
// Uses environment variable with fallback to seeded default
const DEFAULT_TENANT_ID = import.meta.env.VITE_PLATFORM_ORG_ID || 'a0000000-0000-0000-0000-000000000000';

// Gate logging control via environment variable
const ENABLE_GATE_LOGGING = import.meta.env.VITE_ENABLE_GATE_LOGGING !== 'false';

const persistIdentityLocally = (user: { id: string; email?: string | null; user_metadata?: Record<string, any> } | null) => {
  if (!user) return;
  try {
    localStorage.setItem('user_id', user.id);
    if (user.email) localStorage.setItem('user_email', user.email);
    const name = (user.user_metadata as any)?.full_name || user.email || 'User';
    localStorage.setItem('user_name', name);
  } catch {
    // Ignore localStorage failures (e.g., private mode)
  }
};

async function ensureUserMappedToTenant(email?: string) {
  if (!email) return;
  if (ENABLE_GATE_LOGGING) console.log('[GATE: Auth] Checking user-tenant mapping', { email });

  const { data: row } = await supabase
    .from('users')
    .select('organization_id')
    .eq('email', email)
    .maybeSingle();

  if (row && (row as any)?.organization_id) {
    if (ENABLE_GATE_LOGGING) console.log('[GATE: Auth] User already mapped to tenant', { email, tenantId: (row as any)?.organization_id });
    return;
  }

  // Allow signup flow to set a preferred tenant id in localStorage
  let tenantId = DEFAULT_TENANT_ID;
  try {
    const candidate = localStorage.getItem('signup_organization_id');
    if (candidate && candidate.length >= 36) tenantId = candidate;
  } catch {}

  if (ENABLE_GATE_LOGGING) console.log('[GATE: Auth] Creating user-tenant mapping', { email, tenantId });

  await supabase
    .from('users')
    .upsert({ email, organization_id: tenantId, role: 'engineer', is_active: true }, { onConflict: 'email' });

  if (ENABLE_GATE_LOGGING) console.log('[GATE: Auth] User-tenant mapping created successfully', { email, tenantId });
}

export const supabaseAuthProvider: AuthProvider = {
  login: async ({ username, email, password }: any) => {
    const userEmail = email || username;
    if (ENABLE_GATE_LOGGING) console.log('[GATE: Auth] Login attempt started', { email: userEmail });

    if (!userEmail || !password) {
      if (ENABLE_GATE_LOGGING) console.error('[GATE: Auth] Login failed: Email and password required');
      return Promise.reject(new Error('Email and password are required'));
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email: userEmail, password });

    if (error) {
      if (ENABLE_GATE_LOGGING) console.error('[GATE: Auth] Login failed', { email: userEmail, error: error.message });
      return Promise.reject(error);
    }

    if (ENABLE_GATE_LOGGING) console.log('[GATE: Auth] Login successful', { email: userEmail });

    // On first login, ensure users mapping exists
    await ensureUserMappedToTenant(userEmail);

    // Fetch and store organization_id in localStorage for production use
    const { data: userData } = await supabase
      .from('users')
      .select('organization_id')
      .eq('email', userEmail)
      .single();

    if (userData?.organization_id) {
      localStorage.setItem('organization_id', userData.organization_id);
      if (ENABLE_GATE_LOGGING) console.log('[GATE: Auth] Tenant ID stored', { tenantId: userData.organization_id });
    } else {
      // Fallback to default tenant if not found
      localStorage.setItem('organization_id', DEFAULT_TENANT_ID);
      if (ENABLE_GATE_LOGGING) console.warn('[GATE: Auth] Using default tenant ID', { tenantId: DEFAULT_TENANT_ID });
    }

    // Publish login event to RabbitMQ
    if (data.user) {
      await publishCustomEvent(
        'auth.user.login',
        'user_login',
        {
          user_id: data.user.id,
          email: data.user.email || userEmail,
          ip_address: 'browser', // Browser doesn't have direct IP access
          user_agent: navigator.userAgent,
        },
        6 // High priority for security events
      );
    }

    persistIdentityLocally(data.user);

    if (ENABLE_GATE_LOGGING) console.log('[GATE: Auth] Login complete', { email: userEmail });
    return Promise.resolve();
  },

  logout: async () => {
    if (ENABLE_GATE_LOGGING) console.log('[GATE: Auth] Logout triggered');

    // Get user info before signing out
    const { data } = await supabase.auth.getUser();

    await supabase.auth.signOut();

    // Publish logout event to RabbitMQ
    if (data.user) {
      try {
        localStorage.removeItem('user_id');
        localStorage.removeItem('user_email');
        localStorage.removeItem('user_name');
      } catch {}

      await publishCustomEvent(
        'auth.user.logout',
        'user_logout',
        {
          user_id: data.user.id,
          email: data.user.email || 'unknown',
        },
        6 // High priority for security events
      );
    }

    if (ENABLE_GATE_LOGGING) console.log('[GATE: Auth] Logout complete');
    return Promise.resolve();
  },

  checkError: ({ status }: any) => {
    if (status === 401 || status === 403) {
      if (ENABLE_GATE_LOGGING) console.warn('[GATE: Auth] Auth error detected', { status });
      return Promise.reject();
    }
    return Promise.resolve();
  },

  checkAuth: async () => {
    if (ENABLE_GATE_LOGGING) console.log('[GATE: Auth] Checking session...');
    const { data } = await supabase.auth.getSession();

    if (data.session) {
      if (ENABLE_GATE_LOGGING) console.log('[GATE: Auth] Session valid', { userId: data.session.user.id, email: data.session.user.email });
      return Promise.resolve();
    } else {
      if (ENABLE_GATE_LOGGING) console.warn('[GATE: Auth] No active session found');
      return Promise.reject();
    }
  },

  getPermissions: async () => {
    if (ENABLE_GATE_LOGGING) console.log('[GATE: Auth] Getting user permissions...');
    const { data } = await supabase.auth.getUser();
    const role = (data.user as any)?.user_metadata?.role || 'user';
    if (ENABLE_GATE_LOGGING) console.log('[GATE: Auth] User permissions retrieved', { role });
    return Promise.resolve(role);
  },

  getIdentity: async () => {
    if (ENABLE_GATE_LOGGING) console.log('[GATE: Auth] Getting user identity...');

    // Check session first - if no session, reject immediately
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      if (ENABLE_GATE_LOGGING) console.error('[GATE: Auth] Cannot get identity: No active session');
      return Promise.reject(new Error('No active session'));
    }

    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      if (ENABLE_GATE_LOGGING) console.error('[GATE: Auth] Cannot get identity: No user found');
      return Promise.reject(new Error('No user found'));
    }
    persistIdentityLocally(data.user);

    // Ensure organization_id is in localStorage (in case of page refresh)
    if (!localStorage.getItem('organization_id') && data.user.email) {
      const { data: userData } = await supabase
        .from('users')
        .select('organization_id')
        .eq('email', data.user.email)
        .single();

      if (userData?.organization_id) {
        localStorage.setItem('organization_id', userData.organization_id);
        if (ENABLE_GATE_LOGGING) console.log('[GATE: Auth] Tenant ID restored from database', { tenantId: userData.organization_id });
      } else {
        localStorage.setItem('organization_id', DEFAULT_TENANT_ID);
        if (ENABLE_GATE_LOGGING) console.warn('[GATE: Auth] Using default tenant ID (restore)', { tenantId: DEFAULT_TENANT_ID });
      }
    }

    const identity = {
      id: data.user.id,
      fullName: (data.user.user_metadata as any)?.full_name || data.user.email || 'User',
      avatar: (data.user.user_metadata as any)?.avatar_url,
    };

    if (ENABLE_GATE_LOGGING) console.log('[GATE: Auth] User identity retrieved', { userId: identity.id, fullName: identity.fullName });

    return Promise.resolve(identity);
  },
};
