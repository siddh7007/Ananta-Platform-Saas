/**
 * API Types - Request/Response interfaces for CNS API calls
 */

import { RaRecord } from 'react-admin';

// ============================================================================
// Generic API Response Types
// ============================================================================

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T> {
  data: T;
  meta?: ResponseMeta;
}

/**
 * Response metadata
 */
export interface ResponseMeta {
  total?: number;
  page?: number;
  limit?: number;
  hasMore?: boolean;
}

/**
 * API error response structure
 */
export interface ApiError {
  detail: string;
  code?: string;
  status?: number;
  field?: string;
}

/**
 * Validation error response
 */
export interface ValidationError extends ApiError {
  field: string;
  constraint?: string;
}

// ============================================================================
// React Admin Data Provider Types
// ============================================================================

/**
 * React Admin record type (extends RaRecord with optional id)
 */
export type AdminRecord = RaRecord & {
  id?: string | number;
  [key: string]: unknown;
};

/**
 * Get list result with total count
 */
export interface GetListResult<T = AdminRecord> {
  data: T[];
  total: number;
}

/**
 * Get one result
 */
export interface GetOneResult<T = AdminRecord> {
  data: T;
}

/**
 * Create result
 */
export interface CreateResult<T = AdminRecord> {
  data: T;
}

/**
 * Update result
 */
export interface UpdateResult<T = AdminRecord> {
  data: T;
}

/**
 * Delete result
 */
export interface DeleteResult<T = AdminRecord> {
  data: T;
}

// ============================================================================
// Pagination & Filtering
// ============================================================================

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page: number;
  perPage: number;
}

/**
 * Sort parameters
 */
export interface SortParams {
  field: string;
  order: 'ASC' | 'DESC';
}

/**
 * Filter parameters (generic key-value)
 */
export type FilterParams = Record<string, unknown>;

/**
 * Query parameters for list requests
 */
export interface QueryParams {
  pagination?: PaginationParams;
  sort?: SortParams;
  filter?: FilterParams;
}

// ============================================================================
// HTTP Client Types
// ============================================================================

/**
 * HTTP method types
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * HTTP headers
 */
export type HttpHeaders = Record<string, string>;

/**
 * Fetch options for HTTP client
 */
export interface FetchOptions {
  method?: HttpMethod;
  headers?: HttpHeaders;
  body?: string | FormData;
  signal?: AbortSignal;
}

/**
 * Fetch response with JSON body
 */
export interface FetchResponse<T = unknown> {
  json: T;
  headers: Headers;
  status: number;
}
