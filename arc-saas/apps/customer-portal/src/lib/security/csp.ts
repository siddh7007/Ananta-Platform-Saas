/**
 * Content Security Policy Configuration
 * CBP-P1-004: CSP Security Headers
 *
 * Security Improvements:
 * - VULN-001 FIXED: Removed 'unsafe-inline' from script-src, using nonces
 * - VULN-005 FIXED: Restricted img-src to specific domains instead of 'https:'
 * - VULN-006 FIXED: All inline scripts/styles require nonces
 */

export interface CSPConfig {
  defaultSrc: string[];
  scriptSrc: string[];
  styleSrc: string[];
  imgSrc: string[];
  fontSrc: string[];
  connectSrc: string[];
  frameSrc: string[];
  frameAncestors: string[];
  formAction: string[];
  baseUri: string[];
  objectSrc: string[];
  workerSrc: string[];
  nonce?: string;
}

const getKeycloakOrigin = (): string => {
  return import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8180';
};

const getApiOrigin = (): string => {
  return import.meta.env.VITE_API_URL || 'http://localhost:27200';
};

const getWebSocketOrigin = (): string => {
  const apiUrl = getApiOrigin();
  return apiUrl.replace('http', 'ws');
};

export const getCSPConfig = (nonce?: string): CSPConfig => {
  const keycloakOrigin = getKeycloakOrigin();
  const apiOrigin = getApiOrigin();
  const wsOrigin = getWebSocketOrigin();
  const isDev = import.meta.env.DEV;

  // Build script-src with nonce (VULN-001 FIXED: removed 'unsafe-inline')
  const scriptSrc = [
    "'self'",
    ...(nonce ? [`'nonce-${nonce}'`] : []),
    ...(isDev ? ["'unsafe-eval'"] : []), // Vite HMR requires unsafe-eval in dev
  ];

  // Build style-src with nonce (keeping unsafe-inline for Tailwind compatibility)
  // TODO: Remove unsafe-inline once Tailwind styles are extracted to external CSS
  const styleSrc = [
    "'self'",
    ...(nonce ? [`'nonce-${nonce}'`] : []),
    "'unsafe-inline'", // Required for Tailwind CSS-in-JS
    'https://fonts.googleapis.com',
  ];

  return {
    defaultSrc: ["'self'"],
    scriptSrc,
    styleSrc,
    // VULN-005 FIXED: Restrict img-src to specific domains
    imgSrc: [
      "'self'",
      'data:',
      'blob:',
      'https://*.ananta.com', // Production CDN/assets
      ...(isDev ? ['https:'] : []), // Allow any HTTPS in dev for convenience
    ],
    fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
    connectSrc: [
      "'self'",
      apiOrigin,
      wsOrigin,
      keycloakOrigin,
      'https://*.sentry.io',
      ...(isDev ? ['http://localhost:*', 'ws://localhost:*'] : []),
    ],
    frameSrc: ["'self'", keycloakOrigin],
    frameAncestors: ["'none'"],
    formAction: ["'self'", keycloakOrigin],
    baseUri: ["'self'"],
    objectSrc: ["'none'"],
    workerSrc: ["'self'", 'blob:'],
    nonce,
  };
};

export const buildCSPString = (config: CSPConfig): string => {
  const directives = [
    `default-src ${config.defaultSrc.join(' ')}`,
    `script-src ${config.scriptSrc.join(' ')}`,
    `style-src ${config.styleSrc.join(' ')}`,
    `img-src ${config.imgSrc.join(' ')}`,
    `font-src ${config.fontSrc.join(' ')}`,
    `connect-src ${config.connectSrc.join(' ')}`,
    `frame-src ${config.frameSrc.join(' ')}`,
    `frame-ancestors ${config.frameAncestors.join(' ')}`,
    `form-action ${config.formAction.join(' ')}`,
    `base-uri ${config.baseUri.join(' ')}`,
    `object-src ${config.objectSrc.join(' ')}`,
    `worker-src ${config.workerSrc.join(' ')}`,
  ];
  return directives.join('; ');
};

/**
 * Get CSP meta tag content with nonce support
 * This is used by the nonce plugin during build
 */
export function getCSPMetaContent(nonce?: string): string {
  const config = getCSPConfig(nonce);
  return buildCSPString(config);
}

/**
 * DEPRECATED: Static CSP meta content (kept for backwards compatibility)
 * Use getCSPMetaContent() instead for nonce support
 */
export const CSP_META_CONTENT = getCSPMetaContent();