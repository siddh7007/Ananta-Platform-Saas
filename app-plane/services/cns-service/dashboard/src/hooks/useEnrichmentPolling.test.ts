/**
 * Tests for useEnrichmentPolling hook
 *
 * Verifies failure tracking, connection status, and state management.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useEnrichmentPolling } from './useEnrichmentPolling';

// Mock fetch globally
global.fetch = vi.fn();

describe('useEnrichmentPolling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() =>
      useEnrichmentPolling({ bomId: 'test-bom-id', enabled: false })
    );

    expect(result.current.state).toBeNull();
    expect(result.current.isPolling).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.failureCount).toBe(0);
    expect(result.current.lastUpdate).toBeNull();
    expect(result.current.isConnected).toBe(true);
  });

  it('should track successful fetches and reset failure count', async () => {
    const mockResponse = {
      status: 'enriching',
      progress: {
        total_items: 100,
        enriched_items: 50,
        failed_items: 0,
        pending_items: 50,
        percent_complete: 50,
      },
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() =>
      useEnrichmentPolling({ bomId: 'test-bom-id', pollInterval: 100 })
    );

    await waitFor(() => {
      expect(result.current.state).not.toBeNull();
    });

    expect(result.current.state?.status).toBe('enriching');
    expect(result.current.state?.enriched_items).toBe(50);
    expect(result.current.failureCount).toBe(0);
    expect(result.current.isConnected).toBe(true);
    expect(result.current.lastUpdate).toBeInstanceOf(Date);
  });

  it('should increment failure count on errors', async () => {
    (global.fetch as any).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() =>
      useEnrichmentPolling({ bomId: 'test-bom-id', pollInterval: 100 })
    );

    await waitFor(() => {
      expect(result.current.failureCount).toBeGreaterThan(0);
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toContain('Network error');
  });

  it('should mark as disconnected after 3 failures', async () => {
    (global.fetch as any).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() =>
      useEnrichmentPolling({ bomId: 'test-bom-id', pollInterval: 50 })
    );

    await waitFor(
      () => {
        expect(result.current.failureCount).toBeGreaterThanOrEqual(3);
      },
      { timeout: 1000 }
    );

    expect(result.current.isConnected).toBe(false);
  });

  it('should recover connection on successful fetch after failures', async () => {
    // First 2 calls fail
    (global.fetch as any)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      // Third call succeeds
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'enriching',
          progress: {
            total_items: 100,
            enriched_items: 25,
            failed_items: 0,
            pending_items: 75,
            percent_complete: 25,
          },
        }),
      });

    const { result } = renderHook(() =>
      useEnrichmentPolling({ bomId: 'test-bom-id', pollInterval: 100 })
    );

    // Wait for failures
    await waitFor(() => {
      expect(result.current.failureCount).toBe(2);
    });

    // Wait for recovery
    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    expect(result.current.failureCount).toBe(0);
    expect(result.current.lastUpdate).toBeInstanceOf(Date);
  });

  it('should call onCompleted when enrichment completes', async () => {
    const onCompleted = vi.fn();

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'completed',
        progress: {
          total_items: 100,
          enriched_items: 100,
          failed_items: 0,
          pending_items: 0,
          percent_complete: 100,
        },
      }),
    });

    renderHook(() =>
      useEnrichmentPolling({
        bomId: 'test-bom-id',
        pollInterval: 100,
        onCompleted,
      })
    );

    await waitFor(() => {
      expect(onCompleted).toHaveBeenCalled();
    });
  });

  it('should call onFailed when enrichment fails', async () => {
    const onFailed = vi.fn();

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'failed',
        progress: {
          total_items: 100,
          enriched_items: 50,
          failed_items: 50,
          pending_items: 0,
          percent_complete: 100,
        },
      }),
    });

    renderHook(() =>
      useEnrichmentPolling({
        bomId: 'test-bom-id',
        pollInterval: 100,
        onFailed,
      })
    );

    await waitFor(() => {
      expect(onFailed).toHaveBeenCalled();
    });
  });

  it('should stop polling when disabled', async () => {
    const { result, rerender } = renderHook(
      ({ enabled }) =>
        useEnrichmentPolling({
          bomId: 'test-bom-id',
          pollInterval: 100,
          enabled,
        }),
      { initialProps: { enabled: true } }
    );

    expect(result.current.isPolling).toBe(true);

    rerender({ enabled: false });

    await waitFor(() => {
      expect(result.current.isPolling).toBe(false);
    });
  });

  it('should handle manual refresh', async () => {
    const mockResponse = {
      status: 'enriching',
      progress: {
        total_items: 100,
        enriched_items: 75,
        failed_items: 0,
        pending_items: 25,
        percent_complete: 75,
      },
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const { result } = renderHook(() =>
      useEnrichmentPolling({ bomId: 'test-bom-id', enabled: false })
    );

    expect(result.current.state).toBeNull();

    result.current.refresh();

    await waitFor(() => {
      expect(result.current.state).not.toBeNull();
    });

    expect(result.current.state?.enriched_items).toBe(75);
  });
});
