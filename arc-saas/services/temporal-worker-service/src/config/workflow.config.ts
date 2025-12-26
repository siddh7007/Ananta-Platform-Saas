/**
 * Temporal Workflow Configuration
 *
 * Centralized configuration for workflow and activity timeouts.
 *
 * IMPORTANT: This file is bundled into Temporal workflows which run in a
 * sandboxed environment where `process` is NOT available. All values must
 * be static constants - DO NOT use process.env here.
 *
 * For environment-specific configuration, pass values as workflow inputs
 * or configure in the worker setup (outside of workflow code).
 */

/**
 * Activity timeout configuration
 */
export const ACTIVITY_TIMEOUTS = {
  // Default timeout for activity start-to-close (per execution attempt)
  START_TO_CLOSE: '30 seconds',

  // Default timeout for entire activity (including retries)
  SCHEDULE_TO_CLOSE: '2 minutes',

  // Heartbeat timeout (for long-running activities)
  HEARTBEAT: '10 seconds',
};

/**
 * Workflow execution timeout configuration
 */
export const WORKFLOW_TIMEOUTS = {
  // Maximum time a workflow can run
  EXECUTION_TIMEOUT: '10 minutes',

  // Timeout for workflow run (single attempt)
  RUN_TIMEOUT: '5 minutes',
};

/**
 * Retry policy configuration
 */
export const RETRY_POLICY = {
  // Initial retry interval
  INITIAL_INTERVAL: '2s',

  // Backoff coefficient (exponential backoff)
  BACKOFF_COEFFICIENT: 2,

  // Maximum number of retry attempts
  MAXIMUM_ATTEMPTS: 3,

  // Maximum retry interval
  MAXIMUM_INTERVAL: '30 seconds',
};

/**
 * User invitation workflow-specific configuration
 */
export const USER_INVITATION_CONFIG = {
  // Default invitation expiration in days
  DEFAULT_EXPIRES_IN_DAYS: 7,

  // Activity timeouts
  ACTIVITY_TIMEOUTS: {
    START_TO_CLOSE: ACTIVITY_TIMEOUTS.START_TO_CLOSE,
    SCHEDULE_TO_CLOSE: ACTIVITY_TIMEOUTS.SCHEDULE_TO_CLOSE,
  },

  // Retry policy
  RETRY: {
    initialInterval: RETRY_POLICY.INITIAL_INTERVAL,
    backoffCoefficient: RETRY_POLICY.BACKOFF_COEFFICIENT,
    maximumAttempts: RETRY_POLICY.MAXIMUM_ATTEMPTS,
    maximumInterval: RETRY_POLICY.MAXIMUM_INTERVAL,
    nonRetryableErrorTypes: [
      'ValidationError',
      'TenantNotFoundError',
      'TenantNotActiveError',
      'IdPConfigNotFoundError',
    ],
  },
};

/**
 * Tenant provisioning workflow-specific configuration
 */
export const TENANT_PROVISIONING_CONFIG = {
  // Activity timeouts (provisioning can take longer)
  ACTIVITY_TIMEOUTS: {
    START_TO_CLOSE: '2 minutes',
    SCHEDULE_TO_CLOSE: '5 minutes',
  },

  // Retry policy
  RETRY: {
    initialInterval: RETRY_POLICY.INITIAL_INTERVAL,
    backoffCoefficient: RETRY_POLICY.BACKOFF_COEFFICIENT,
    maximumAttempts: RETRY_POLICY.MAXIMUM_ATTEMPTS,
    maximumInterval: RETRY_POLICY.MAXIMUM_INTERVAL,
    nonRetryableErrorTypes: [
      'ValidationError',
      'DuplicateTenantError',
    ],
  },
};
