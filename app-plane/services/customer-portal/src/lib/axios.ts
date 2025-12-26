/**
 * Axios Configuration for API Clients
 * @module lib/axios
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { supabase } from '../providers/dataProvider';
import { getCurrentOrganizationId, getCurrentWorkspaceId } from '../services/cnsApi';

// CNS API base URL
const CNS_BASE_URL = import.meta.env.VITE_CNS_API_URL || 'http://localhost:27800';

// Platform API base URL (Control Plane)
const PLATFORM_BASE_URL = import.meta.env.VITE_PLATFORM_API_URL || 'http://localhost:14000';

/**
 * Get auth headers for API calls.
 * Uses Supabase session token and includes organization/workspace context.
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};

  // Get Supabase session token
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  // Add organization ID header if available
  const organizationId = getCurrentOrganizationId();
  if (organizationId) {
    headers['X-Organization-Id'] = organizationId;
  }

  // Add workspace ID header if available
  const workspaceId = getCurrentWorkspaceId();
  if (workspaceId) {
    headers['X-Workspace-Id'] = workspaceId;
  }

  // Add user email if available
  if (session?.user?.email) {
    headers['X-User-Email'] = session.user.email;
  }

  return headers;
}

/**
 * Create configured axios instance with auth interceptors
 */
function createAuthenticatedAxios(baseURL: string): AxiosInstance {
  const instance = axios.create({
    baseURL,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor to add auth headers
  instance.interceptors.request.use(
    async (config) => {
      const authHeaders = await getAuthHeaders();
      Object.assign(config.headers, authHeaders);
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor for error handling
  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      // Handle 401 Unauthorized - refresh token or redirect to login
      if (error.response?.status === 401) {
        const { error: signOutError } = await supabase.auth.signOut();
        if (!signOutError) {
          window.location.href = '/login';
        }
      }
      return Promise.reject(error);
    }
  );

  return instance;
}

/**
 * CNS API client for component and BOM operations
 */
export const cnsApi = createAuthenticatedAxios(CNS_BASE_URL);

/**
 * Platform API client for user, subscription, and billing operations
 */
export const platformApi = createAuthenticatedAxios(PLATFORM_BASE_URL);

/**
 * Generic API request helper with error handling
 */
export async function apiRequest<T>(
  config: AxiosRequestConfig,
  client: AxiosInstance = cnsApi
): Promise<T> {
  try {
    const response = await client.request<T>(config);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.message || error.message;
      throw new Error(`API Error: ${message}`);
    }
    throw error;
  }
}
