/**
 * Mutation Hook with Loading States
 * Provides consistent mutation handling with loading, error, and success states
 */

import { useState, useCallback } from 'react';
import { toastSuccess, toastError } from '@/hooks/useToast';

interface MutationState<TData> {
  /** Whether the mutation is in progress */
  isLoading: boolean;
  /** Error from the last mutation attempt */
  error: Error | null;
  /** Data from successful mutation */
  data: TData | null;
  /** Whether the last mutation was successful */
  isSuccess: boolean;
  /** Whether the last mutation failed */
  isError: boolean;
}

interface MutationOptions<TData, TVariables> {
  /** Function that performs the mutation */
  mutationFn: (variables: TVariables) => Promise<TData>;
  /** Called on success */
  onSuccess?: (data: TData, variables: TVariables) => void;
  /** Called on error */
  onError?: (error: Error, variables: TVariables) => void;
  /** Called on completion (success or error) */
  onSettled?: (data: TData | null, error: Error | null, variables: TVariables) => void;
  /** Success message to show in toast */
  successMessage?: string | ((data: TData) => string);
  /** Error message to show in toast (default: error.message) */
  errorMessage?: string | ((error: Error) => string);
  /** Show success toast (default: true if successMessage provided) */
  showSuccessToast?: boolean;
  /** Show error toast (default: true) */
  showErrorToast?: boolean;
}

interface UseMutationReturn<TData, TVariables> extends MutationState<TData> {
  /** Execute the mutation */
  mutate: (variables: TVariables) => Promise<TData | null>;
  /** Execute the mutation and return promise */
  mutateAsync: (variables: TVariables) => Promise<TData>;
  /** Reset the mutation state */
  reset: () => void;
}

/**
 * Hook for handling mutations with loading states and toast notifications
 */
export function useMutation<TData = unknown, TVariables = void>(
  options: MutationOptions<TData, TVariables>
): UseMutationReturn<TData, TVariables> {
  const [state, setState] = useState<MutationState<TData>>({
    isLoading: false,
    error: null,
    data: null,
    isSuccess: false,
    isError: false,
  });

  const {
    mutationFn,
    onSuccess,
    onError,
    onSettled,
    successMessage,
    errorMessage,
    showSuccessToast = !!successMessage,
    showErrorToast = true,
  } = options;

  const reset = useCallback(() => {
    setState({
      isLoading: false,
      error: null,
      data: null,
      isSuccess: false,
      isError: false,
    });
  }, []);

  const mutateAsync = useCallback(
    async (variables: TVariables): Promise<TData> => {
      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
        isSuccess: false,
        isError: false,
      }));

      try {
        const data = await mutationFn(variables);

        setState({
          isLoading: false,
          error: null,
          data,
          isSuccess: true,
          isError: false,
        });

        // Success toast
        if (showSuccessToast && successMessage) {
          const message =
            typeof successMessage === 'function'
              ? successMessage(data)
              : successMessage;
          toastSuccess(message);
        }

        // Success callback
        onSuccess?.(data, variables);
        onSettled?.(data, null, variables);

        return data;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));

        setState({
          isLoading: false,
          error,
          data: null,
          isSuccess: false,
          isError: true,
        });

        // Error toast
        if (showErrorToast) {
          const message =
            errorMessage
              ? typeof errorMessage === 'function'
                ? errorMessage(error)
                : errorMessage
              : error.message || 'An error occurred';
          toastError(message);
        }

        // Error callback
        onError?.(error, variables);
        onSettled?.(null, error, variables);

        throw error;
      }
    },
    [
      mutationFn,
      onSuccess,
      onError,
      onSettled,
      successMessage,
      errorMessage,
      showSuccessToast,
      showErrorToast,
    ]
  );

  const mutate = useCallback(
    async (variables: TVariables): Promise<TData | null> => {
      try {
        return await mutateAsync(variables);
      } catch {
        return null;
      }
    },
    [mutateAsync]
  );

  return {
    ...state,
    mutate,
    mutateAsync,
    reset,
  };
}

/**
 * Pre-configured mutation for delete operations
 */
export function useDeleteMutation<TData = void>(
  deleteFn: (id: string) => Promise<TData>,
  options?: {
    resourceName?: string;
    onSuccess?: (data: TData, id: string) => void;
    onError?: (error: Error, id: string) => void;
  }
) {
  const { resourceName = 'item', onSuccess, onError } = options || {};

  return useMutation<TData, string>({
    mutationFn: deleteFn,
    successMessage: `${resourceName} deleted successfully`,
    errorMessage: (error) => `Failed to delete ${resourceName}: ${error.message}`,
    onSuccess: onSuccess as (data: TData, variables: string) => void,
    onError: onError as (error: Error, variables: string) => void,
  });
}

/**
 * Pre-configured mutation for create operations
 */
export function useCreateMutation<TData, TVariables>(
  createFn: (data: TVariables) => Promise<TData>,
  options?: {
    resourceName?: string;
    onSuccess?: (data: TData, variables: TVariables) => void;
    onError?: (error: Error, variables: TVariables) => void;
  }
) {
  const { resourceName = 'item', onSuccess, onError } = options || {};

  return useMutation<TData, TVariables>({
    mutationFn: createFn,
    successMessage: `${resourceName} created successfully`,
    errorMessage: (error) => `Failed to create ${resourceName}: ${error.message}`,
    onSuccess,
    onError,
  });
}

/**
 * Pre-configured mutation for update operations
 */
export function useUpdateMutation<TData, TVariables>(
  updateFn: (data: TVariables) => Promise<TData>,
  options?: {
    resourceName?: string;
    onSuccess?: (data: TData, variables: TVariables) => void;
    onError?: (error: Error, variables: TVariables) => void;
  }
) {
  const { resourceName = 'item', onSuccess, onError } = options || {};

  return useMutation<TData, TVariables>({
    mutationFn: updateFn,
    successMessage: `${resourceName} updated successfully`,
    errorMessage: (error) => `Failed to update ${resourceName}: ${error.message}`,
    onSuccess,
    onError,
  });
}

/**
 * Combined state for multiple related mutations
 */
export function useMutationStates(
  ...mutations: { isLoading: boolean; isError: boolean }[]
) {
  return {
    isAnyLoading: mutations.some((m) => m.isLoading),
    isAnyError: mutations.some((m) => m.isError),
    areAllIdle: mutations.every((m) => !m.isLoading && !m.isError),
  };
}
