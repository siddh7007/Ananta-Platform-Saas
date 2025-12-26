import type { DataProvider, HttpError } from "@refinedev/core";
import { logger } from "../lib/logger";
import {
  getAccessToken,
  getAuthHeaders,
  refreshAccessToken,
  handleSessionExpired,
} from "../lib/token-manager";
import { API_URL } from "../config/api";

/**
 * Styled console logging for API requests
 * Only logs when VITE_ENABLE_API_LOGGING is 'true'
 */
const apiLog = {
  request: (method: string, url: string, body?: any) => {
    console.log(
      `%c[API] ${method} ${url}`,
      'color: #2196F3; font-weight: bold'
    );
    if (body) {
      console.log('%c[Request Body]', 'color: #9C27B0', body);
    }
  },
  success: (method: string, url: string, status: number, duration: number, data?: any) => {
    console.log(
      `%c[API] ✓ ${method} ${url} - ${status} (${duration}ms)`,
      'color: #4CAF50; font-weight: bold'
    );
    if (data) {
      const summary = Array.isArray(data)
        ? `[Array: ${data.length} items]`
        : typeof data === 'object' && data !== null
          ? `{${Object.keys(data).slice(0, 5).join(', ')}${Object.keys(data).length > 5 ? '...' : ''}}`
          : data;
      console.log('%c[Response]', 'color: #009688', summary);
    }
  },
  error: (method: string, url: string, status: number, duration: number, error: any) => {
    console.log(
      `%c[API] ✗ ${method} ${url} - ${status} (${duration}ms)`,
      'color: #F44336; font-weight: bold'
    );
    console.log('%c[Error]', 'color: #F44336', error);
  },
};

const handleResponse = async (response: Response): Promise<any> => {
  if (!response.ok) {
    const error: HttpError = {
      message: "An error occurred",
      statusCode: response.status,
    };

    try {
      const body = await response.json();
      error.message = body.message || body.error || error.message;
      error.errors = body.errors;
    } catch {
      // Response body was not JSON
    }

    logger.error("API error", {
      status: response.status,
      message: error.message,
      url: response.url,
    });

    throw error;
  }

  // Handle 204 No Content - return empty object instead of trying to parse JSON
  if (response.status === 204) {
    return { success: true };
  }

  // Check content-length for empty responses
  const contentLength = response.headers.get('content-length');
  if (contentLength === '0') {
    return { success: true };
  }

  return response.json();
};

const createRequest = async (
  url: string,
  method: string,
  body?: any
): Promise<any> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...getAuthHeaders(),
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  // Log request
  logger.debug("API request", { method, url });
  apiLog.request(method, url, body);

  const startTime = performance.now();
  let response = await fetch(url, options);

  // Handle 401 - attempt token refresh and retry
  if (response.status === 401) {
    logger.info("Received 401, attempting token refresh");
    console.log('%c[API] 401 Unauthorized - Refreshing token...', 'color: #FF9800');

    const newToken = await refreshAccessToken();

    if (newToken) {
      const retryHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${newToken}`,
      };

      response = await fetch(url, {
        ...options,
        headers: retryHeaders,
      });
      console.log('%c[API] Token refreshed, retrying request', 'color: #4CAF50');
    } else {
      handleSessionExpired();
      throw new Error("Session expired");
    }
  }

  const duration = Math.round(performance.now() - startTime);

  if (!response.ok) {
    const error: HttpError = {
      message: "An error occurred",
      statusCode: response.status,
    };

    try {
      const errorBody = await response.json();
      error.message = errorBody.message || errorBody.error || error.message;
      error.errors = errorBody.errors;
    } catch {
      // Response body was not JSON
    }

    apiLog.error(method, url, response.status, duration, error);
    logger.error("API error", {
      status: response.status,
      message: error.message,
      url: response.url,
    });

    throw error;
  }

  // Handle 204 No Content - return empty object instead of trying to parse JSON
  if (response.status === 204) {
    const successData = { success: true };
    apiLog.success(method, url, response.status, duration, successData);
    return successData;
  }

  // Check content-length for empty responses
  const contentLength = response.headers.get('content-length');
  if (contentLength === '0') {
    const successData = { success: true };
    apiLog.success(method, url, response.status, duration, successData);
    return successData;
  }

  const data = await response.json();
  apiLog.success(method, url, response.status, duration, data);

  return data;
};

export const dataProvider: DataProvider = {
  getList: async ({ resource, pagination, sorters, filters, meta }) => {
    const params = new URLSearchParams();

    // Pagination
    if (pagination) {
      const { current = 1, pageSize = 10 } = pagination;
      params.append("page", String(current));
      params.append("limit", String(pageSize));
    }

    // Sorting
    if (sorters && sorters.length > 0) {
      const { field, order } = sorters[0];
      params.append("sort", field);
      params.append("order", order);
    }

    // Filters
    if (filters) {
      filters.forEach((filter) => {
        if ("field" in filter && filter.value !== undefined) {
          params.append(filter.field, String(filter.value));
        }
      });
    }

    const url = `${API_URL}/${resource}?${params}`;
    const data = await createRequest(url, "GET");

    logger.info("Fetched list", { resource, total: data.total || data.data?.length });

    return {
      data: data.data || data,
      total: data.total || data.length,
    };
  },

  getOne: async ({ resource, id, meta }) => {
    const url = `${API_URL}/${resource}/${id}`;
    const data = await createRequest(url, "GET");

    logger.info("Fetched one", { resource, id });

    return { data };
  },

  create: async ({ resource, variables, meta }) => {
    const url = `${API_URL}/${resource}`;
    const data = await createRequest(url, "POST", variables);

    logger.info("Created resource", { resource, id: data.id });

    return { data };
  },

  update: async ({ resource, id, variables, meta }) => {
    const url = `${API_URL}/${resource}/${id}`;
    // Use PATCH for partial updates (LoopBack 4 standard)
    const data = await createRequest(url, "PATCH", variables);

    logger.info("Updated resource", { resource, id });

    return { data };
  },

  deleteOne: async ({ resource, id, meta }) => {
    const url = `${API_URL}/${resource}/${id}`;
    const data = await createRequest(url, "DELETE");

    logger.info("Deleted resource", { resource, id });

    return { data };
  },

  getMany: async ({ resource, ids, meta }) => {
    const params = new URLSearchParams();
    ids.forEach((id) => params.append("ids", String(id)));

    const url = `${API_URL}/${resource}?${params}`;
    const data = await createRequest(url, "GET");

    logger.info("Fetched many", { resource, count: ids.length });

    return { data: data.data || data };
  },

  createMany: async ({ resource, variables, meta }) => {
    const url = `${API_URL}/${resource}/bulk`;
    const data = await createRequest(url, "POST", { items: variables });

    logger.info("Created many", { resource, count: variables.length });

    return { data };
  },

  updateMany: async ({ resource, ids, variables, meta }) => {
    const url = `${API_URL}/${resource}/bulk`;
    const data = await createRequest(url, "PUT", { ids, ...variables });

    logger.info("Updated many", { resource, count: ids.length });

    return { data };
  },

  deleteMany: async ({ resource, ids, meta }) => {
    const url = `${API_URL}/${resource}/bulk`;
    const data = await createRequest(url, "DELETE", { ids });

    logger.info("Deleted many", { resource, count: ids.length });

    return { data };
  },

  custom: async ({ url, method, filters, sorters, payload, query, headers }) => {
    const fullUrl = url.startsWith("http") ? url : `${API_URL}${url}`;

    const params = new URLSearchParams();
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        params.append(key, String(value));
      });
    }

    const finalUrl = params.toString() ? `${fullUrl}?${params}` : fullUrl;

    const requestHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...headers,
    };

    const options: RequestInit = {
      method: method.toUpperCase(),
      headers: requestHeaders,
    };

    if (payload && method.toUpperCase() !== "GET") {
      options.body = JSON.stringify(payload);
    }

    logger.debug("Custom API request", { method, url: finalUrl });

    let response = await fetch(finalUrl, options);

    // Handle 401 for custom requests too
    if (response.status === 401) {
      const newToken = await refreshAccessToken();

      if (newToken) {
        requestHeaders.Authorization = `Bearer ${newToken}`;
        response = await fetch(finalUrl, {
          ...options,
          headers: requestHeaders,
        });
      } else {
        handleSessionExpired();
        throw new Error("Session expired");
      }
    }

    const data = await handleResponse(response);

    return { data };
  },

  getApiUrl: () => API_URL,
};
