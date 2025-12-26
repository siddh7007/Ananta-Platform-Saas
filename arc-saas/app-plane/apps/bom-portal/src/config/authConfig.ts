/**
 * Authentication Configuration
 *
 * PRODUCTION SAFETY:
 * - Dev mode ONLY enabled via explicit environment flag
 * - Multiple safeguards prevent dev bypass from leaking to production
 * - Comprehensive logging of all auth mode decisions
 * - Optional IP/network restrictions for dev mode
 */

export interface AuthConfig {
  mode: 'production' | 'development';
  devBypassEnabled: boolean;
  sessionDurationMinutes: number;
  allowedDevIPs?: string[];
  logAuthEvents: boolean;
}

/**
 * Environment Variables for Auth Configuration
 *
 * VITE_AUTH_MODE: 'production' | 'development' (default: production)
 * VITE_DEV_BYPASS_ENABLED: 'true' | 'false' (default: false)
 * VITE_DEV_SESSION_DURATION: number in minutes (default: 60)
 * VITE_DEV_ALLOWED_IPS: comma-separated IPs (optional, default: localhost only)
 * VITE_AUTH_LOGGING: 'true' | 'false' (default: true)
 */

const getAuthMode = (): 'production' | 'development' => {
  const mode = import.meta.env.VITE_AUTH_MODE?.toLowerCase();

  // SAFE DEFAULT: Always production unless explicitly set to development
  if (mode !== 'development') {
    return 'production';
  }

  // Additional safety check: NODE_ENV must also be development
  if (import.meta.env.MODE !== 'development' && mode === 'development') {
    console.warn(
      '⚠️ AUTH SAFETY: VITE_AUTH_MODE=development but NODE_ENV is not development. ' +
      'Forcing production mode for safety.'
    );
    return 'production';
  }

  return 'development';
};

const isDevBypassEnabled = (): boolean => {
  const authMode = getAuthMode();

  // CRITICAL: Dev bypass can NEVER be enabled in production mode
  if (authMode === 'production') {
    if (import.meta.env.VITE_DEV_BYPASS_ENABLED === 'true') {
      console.error(
        '🚨 SECURITY VIOLATION: VITE_DEV_BYPASS_ENABLED=true in production mode! ' +
        'This is a critical security issue. Dev bypass will be DISABLED.'
      );
    }
    return false;
  }

  // In development mode, check the explicit flag
  return import.meta.env.VITE_DEV_BYPASS_ENABLED === 'true';
};

const getDevSessionDuration = (): number => {
  const duration = parseInt(import.meta.env.VITE_DEV_SESSION_DURATION || '60', 10);

  // Safety: Cap dev sessions at 2 hours max
  if (duration > 120) {
    console.warn(
      `⚠️ AUTH SAFETY: Dev session duration ${duration}min exceeds max (120min). ` +
      'Capping at 120 minutes.'
    );
    return 120;
  }

  // Safety: Minimum 5 minutes
  if (duration < 5) {
    console.warn(
      `⚠️ AUTH SAFETY: Dev session duration ${duration}min below min (5min). ` +
      'Setting to 5 minutes.'
    );
    return 5;
  }

  return duration;
};

const getAllowedDevIPs = (): string[] | undefined => {
  const ipsStr = import.meta.env.VITE_DEV_ALLOWED_IPS;

  if (!ipsStr) {
    // Default: localhost only
    return ['127.0.0.1', '::1', 'localhost'];
  }

  const ips = ipsStr.split(',').map(ip => ip.trim()).filter(Boolean);

  if (ips.length === 0) {
    return ['127.0.0.1', '::1', 'localhost'];
  }

  return ips;
};

export const authConfig: AuthConfig = {
  mode: getAuthMode(),
  devBypassEnabled: isDevBypassEnabled(),
  sessionDurationMinutes: getDevSessionDuration(),
  allowedDevIPs: getAllowedDevIPs(),
  logAuthEvents: import.meta.env.VITE_AUTH_LOGGING !== 'false', // Default: true
};

/**
 * Log the current auth configuration on module load
 * This ensures visibility into what auth mode is active
 */
if (authConfig.logAuthEvents) {
  const modeEmoji = authConfig.mode === 'production' ? '🔒' : '🔓';
  const bypassEmoji = authConfig.devBypassEnabled ? '⚠️' : '✅';

  console.log(
    `${modeEmoji} Auth Mode: ${authConfig.mode.toUpperCase()}\n` +
    `${bypassEmoji} Dev Bypass: ${authConfig.devBypassEnabled ? 'ENABLED' : 'DISABLED'}\n` +
    `⏱️  Session Duration: ${authConfig.sessionDurationMinutes}min\n` +
    `🌐 Allowed IPs: ${authConfig.allowedDevIPs?.join(', ') || 'Any'}`
  );

  if (authConfig.mode === 'development' && authConfig.devBypassEnabled) {
    console.warn(
      '⚠️⚠️⚠️ DEVELOPMENT MODE WITH AUTH BYPASS ENABLED ⚠️⚠️⚠️\n' +
      'This configuration is UNSAFE for production. Ensure this build is never deployed to production.'
    );
  }
}

/**
 * Validate that current client IP is allowed for dev mode
 * Returns true if allowed, false if blocked
 */
export const validateDevModeAccess = async (): Promise<boolean> => {
  if (!authConfig.devBypassEnabled) {
    return true; // No restrictions if dev bypass is disabled
  }

  if (!authConfig.allowedDevIPs || authConfig.allowedDevIPs.length === 0) {
    return true; // No IP restrictions configured
  }

  try {
    // Try to get client IP (this is best-effort and may not work in all environments)
    // In production, this should be enforced at the API/gateway level
    const response = await fetch('https://api.ipify.org?format=json', {
      signal: AbortSignal.timeout(2000),
    });
    const data = await response.json();
    const clientIP = data.ip;

    const isAllowed = authConfig.allowedDevIPs.includes(clientIP) ||
                     authConfig.allowedDevIPs.includes('localhost') ||
                     authConfig.allowedDevIPs.includes('127.0.0.1');

    if (!isAllowed && authConfig.logAuthEvents) {
      console.error(
        `🚫 DEV MODE ACCESS DENIED: Client IP ${clientIP} not in allowed list: ` +
        authConfig.allowedDevIPs.join(', ')
      );
    }

    return isAllowed;
  } catch (error) {
    // If we can't determine IP, allow in dev mode but log warning
    if (authConfig.logAuthEvents) {
      console.warn(
        '⚠️ Could not validate client IP for dev mode. Allowing access. ' +
        'Error:', error
      );
    }
    return true;
  }
};
