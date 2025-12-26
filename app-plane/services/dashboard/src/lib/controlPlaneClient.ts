/**
 * Control Plane HTTP Client
 *
 * Provides HTTP client for Arc-SaaS tenant-management-service integration.
 * Includes error handling, retry logic, and request correlation.
 */

import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';

const CONTROL_PLANE_URL = process.env.NEXT_PUBLIC_PLATFORM_API_URL || 'http://localhost:14000';
const REQUEST_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 3;

interface ControlPlaneClientConfig {
  baseURL?: string;
  timeout?: number;
}

interface RequestOptions extends AxiosRequestConfig {
  correlationId?: string;
  skipRetry?: boolean;
}

/**
 * Control Plane API client with automatic retry and error mapping
 */
class ControlPlaneClient {
  private client: AxiosInstance;
  private retryCount: Map<string, number>;

  constructor(config: ControlPlaneClientConfig = {}) {
    this.client = axios.create({
      baseURL: config.baseURL || CONTROL_PLANE_URL,
      timeout: config.timeout || REQUEST_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Dashboard-Service/1.0',
      },
    });

    this.retryCount = new Map();

    // Request interceptor for logging and correlation
    this.client.interceptors.request.use(
      (config) => {
        const correlationId = config.headers?.['X-Correlation-ID'] as string || this.generateCorrelationId();
        config.headers = config.headers || {};
        config.headers['X-Correlation-ID'] = correlationId;

        console.log(`[CONTROL_PLANE_REQUEST] ${config.method?.toUpperCase()} ${config.url} - Correlation: ${correlationId}`);
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for logging and error handling
    this.client.interceptors.response.use(
      (response) => {
        const correlationId = response.config.headers?.['X-Correlation-ID'];
        console.log(`[CONTROL_PLANE_RESPONSE] ${response.status} ${response.config.url} - Correlation: ${correlationId}`);
        return response;
      },
      async (error: AxiosError) => {
        return this.handleError(error);
      }
    );
  }

  /**
   * Execute GET request
   */
  async get<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
    const { correlationId, skipRetry, ...axiosConfig } = options;

    if (correlationId) {
      axiosConfig.headers = { ...axiosConfig.headers, 'X-Correlation-ID': correlationId };
    }

    const response = await this.executeWithRetry(
      () => this.client.get<T>(path, axiosConfig),
      skipRetry
    );

    return response.data;
  }

  /**
   * Execute POST request
   */
  async post<T = any>(path: string, data?: any, options: RequestOptions = {}): Promise<T> {
    const { correlationId, skipRetry, ...axiosConfig } = options;

    if (correlationId) {
      axiosConfig.headers = { ...axiosConfig.headers, 'X-Correlation-ID': correlationId };
    }

    const response = await this.executeWithRetry(
      () => this.client.post<T>(path, data, axiosConfig),
      skipRetry
    );

    return response.data;
  }

  /**
   * Execute PATCH request
   */
  async patch<T = any>(path: string, data?: any, options: RequestOptions = {}): Promise<T> {
    const { correlationId, skipRetry, ...axiosConfig } = options;

    if (correlationId) {
      axiosConfig.headers = { ...axiosConfig.headers, 'X-Correlation-ID': correlationId };
    }

    const response = await this.executeWithRetry(
      () => this.client.patch<T>(path, data, axiosConfig),
      skipRetry
    );

    return response.data;
  }

  /**
   * Execute DELETE request
   */
  async delete<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
    const { correlationId, skipRetry, ...axiosConfig } = options;

    if (correlationId) {
      axiosConfig.headers = { ...axiosConfig.headers, 'X-Correlation-ID': correlationId };
    }

    const response = await this.executeWithRetry(
      () => this.client.delete<T>(path, axiosConfig),
      skipRetry
    );

    return response.data;
  }

  /**
   * Execute request with automatic retry on transient errors
   */
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    skipRetry: boolean = false
  ): Promise<T> {
    let lastError: any;

    const retries = skipRetry ? 1 : MAX_RETRIES;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        if (attempt < retries && this.isRetryable(error as AxiosError)) {
          const delayMs = this.calculateBackoff(attempt);
          console.log(`[CONTROL_PLANE_RETRY] Attempt ${attempt}/${retries} failed, retrying in ${delayMs}ms...`);
          await this.sleep(delayMs);
          continue;
        }

        throw error;
      }
    }

    throw lastError;
  }

  /**
   * Check if error is retryable
   */
  private isRetryable(error: AxiosError): boolean {
    if (!error.response) {
      // Network error - retry
      return true;
    }

    const status = error.response.status;

    // Retry on server errors (500-599) and rate limiting (429)
    if (status >= 500 || status === 429 || status === 408) {
      return true;
    }

    return false;
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoff(attempt: number): number {
    const baseDelay = 1000; // 1 second
    const maxDelay = 10000; // 10 seconds
    const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.3 * delay;
    return delay + jitter;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate correlation ID for request tracking
   */
  private generateCorrelationId(): string {
    return `cp-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Handle API errors and map to user-friendly messages
   */
  private async handleError(error: AxiosError): Promise<never> {
    const correlationId = error.config?.headers?.['X-Correlation-ID'];

    // Network error
    if (!error.response) {
      console.error(`[CONTROL_PLANE_ERROR] Network error - Correlation: ${correlationId}`, error.message);
      throw new Error('Unable to connect to Control Plane. Please check your network connection.');
    }

    const status = error.response.status;
    const data = error.response.data as any;

    console.error(
      `[CONTROL_PLANE_ERROR] ${status} ${error.config?.url} - Correlation: ${correlationId}`,
      data
    );

    // Map LoopBack error responses
    const message = this.extractErrorMessage(data, status);

    // Create enhanced error with correlation ID
    const enhancedError: any = new Error(message);
    enhancedError.status = status;
    enhancedError.correlationId = correlationId;
    enhancedError.originalError = data;

    throw enhancedError;
  }

  /**
   * Extract user-friendly error message from LoopBack response
   */
  private extractErrorMessage(data: any, status: number): string {
    // LoopBack error format: { error: { statusCode, name, message, details } }
    if (data?.error?.message) {
      return data.error.message;
    }

    // Validation errors
    if (data?.error?.details) {
      const details = data.error.details;
      if (Array.isArray(details)) {
        return details.map((d: any) => d.message || d.path).join(', ');
      }
      return JSON.stringify(details);
    }

    // Generic message field
    if (data?.message) {
      return data.message;
    }

    // Fallback to status code messages
    switch (status) {
      case 401:
        return 'Authentication required. Please log in again.';
      case 403:
        return 'You do not have permission to perform this action.';
      case 404:
        return 'The requested resource was not found.';
      case 409:
        return 'A conflict occurred. The resource may already exist.';
      case 422:
        return 'Invalid data provided. Please check your input.';
      case 429:
        return 'Too many requests. Please try again later.';
      case 500:
        return 'An internal server error occurred. Please try again.';
      case 503:
        return 'Service temporarily unavailable. Please try again later.';
      default:
        return `An error occurred (${status}). Please try again.`;
    }
  }
}

// Export singleton instance
export const controlPlaneClient = new ControlPlaneClient();

// Export class for testing
export { ControlPlaneClient };
