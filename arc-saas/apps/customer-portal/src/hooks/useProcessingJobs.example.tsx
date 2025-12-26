/**
 * Example Usage: useProcessingJobs Hook
 *
 * This file demonstrates how to use the useProcessingJobs hook
 * to build a workflow management UI.
 */

import React from 'react';
import { useProcessingJobs } from './useProcessingJobs';

/**
 * Example 1: Basic Usage - List All Jobs
 */
export function ProcessingJobsList() {
  const { jobs, isLoading, error, activeJobsCount } = useProcessingJobs();

  if (isLoading) {
    return <div>Loading jobs...</div>;
  }

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  return (
    <div>
      <h2>Processing Jobs ({activeJobsCount} active)</h2>
      <ul>
        {jobs.map((job) => (
          <li key={job.bomId}>
            <strong>{job.bomName || job.bomId}</strong> - {job.status} ({job.overallProgress}%)
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Example 2: Filtered Jobs - Only Active Jobs
 */
export function ActiveJobsList() {
  const { jobs, pauseJob, resumeJob, cancelJob } = useProcessingJobs({
    statusFilter: ['running', 'paused'],
    autoRefreshInterval: 3000, // Refresh every 3 seconds
  });

  return (
    <div>
      <h2>Active Jobs</h2>
      {jobs.map((job) => (
        <div key={job.bomId}>
          <h3>{job.bomName || job.bomId}</h3>
          <p>Status: {job.status}</p>
          <p>Progress: {job.overallProgress}%</p>
          <p>
            Enriched: {job.enrichedItems} / {job.totalItems}
          </p>

          <div>
            {job.canPause && (
              <button onClick={() => pauseJob(job.bomId)}>Pause</button>
            )}
            {job.canResume && (
              <button onClick={() => resumeJob(job.bomId)}>Resume</button>
            )}
            {job.canCancel && (
              <button onClick={() => cancelJob(job.bomId)}>Cancel</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Example 3: With Callbacks - Job Completion Notifications
 */
export function JobsWithNotifications() {
  const { jobs } = useProcessingJobs({
    onJobComplete: (job) => {
      console.log(`Job completed: ${job.bomName || job.bomId}`);
      // Show toast notification
      // toast.success(`BOM enrichment completed for ${job.bomName}`);
    },
    onJobFail: (job) => {
      console.error(`Job failed: ${job.bomName || job.bomId}`);
      // Show error notification
      // toast.error(`BOM enrichment failed for ${job.bomName}`);
    },
    onError: (error) => {
      console.error('Failed to fetch jobs:', error);
      // toast.error('Failed to load processing jobs');
    },
  });

  return (
    <div>
      <h2>Jobs with Notifications</h2>
      {jobs.map((job) => (
        <div key={job.bomId}>
          {job.bomName} - {job.status}
        </div>
      ))}
    </div>
  );
}

/**
 * Example 4: Manual Refresh with Loading Indicator
 */
export function JobsWithRefresh() {
  const { jobs, isLoading, refresh, hasActiveJobs } = useProcessingJobs({
    autoRefreshInterval: 0, // Disable auto-refresh
  });

  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h2>Processing Jobs</h2>
        <button onClick={handleRefresh} disabled={isRefreshing || isLoading}>
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {hasActiveJobs && (
        <div style={{ color: 'orange', marginBottom: '1rem' }}>
          Active jobs detected. Auto-refresh is disabled - click Refresh to update.
        </div>
      )}

      <ul>
        {jobs.map((job) => (
          <li key={job.bomId}>
            {job.bomName || job.bomId} - {job.status}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Example 5: Failed/Cancelled Jobs with Restart
 */
export function FailedJobsList() {
  const { jobs, restartJob } = useProcessingJobs({
    statusFilter: ['failed', 'cancelled'],
  });

  const handleRestart = async (bomId: string) => {
    try {
      await restartJob(bomId);
      console.log('Job restarted successfully');
    } catch (error) {
      console.error('Failed to restart job:', error);
    }
  };

  if (jobs.length === 0) {
    return <div>No failed or cancelled jobs</div>;
  }

  return (
    <div>
      <h2>Failed/Cancelled Jobs</h2>
      {jobs.map((job) => (
        <div key={job.bomId}>
          <h3>{job.bomName || job.bomId}</h3>
          <p>Status: {job.status}</p>
          <p>Failed Items: {job.failedItems}</p>

          {job.canRestart && (
            <button onClick={() => handleRestart(job.bomId)}>
              Restart Job
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Example 6: Comprehensive Dashboard
 */
export function ProcessingDashboard() {
  const {
    jobs,
    isLoading,
    error,
    refresh,
    pauseJob,
    resumeJob,
    cancelJob,
    restartJob,
    activeJobsCount,
    hasActiveJobs,
  } = useProcessingJobs({
    autoRefreshInterval: 5000,
    onJobComplete: (job) => {
      console.log('Job completed:', job.bomName);
    },
    onJobFail: (job) => {
      console.error('Job failed:', job.bomName);
    },
  });

  if (isLoading) {
    return <div>Loading processing jobs...</div>;
  }

  if (error) {
    return (
      <div>
        <p>Error loading jobs: {error.message}</p>
        <button onClick={refresh}>Retry</button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h1>Processing Dashboard</h1>
        <button onClick={refresh}>Refresh</button>
      </div>

      {hasActiveJobs && (
        <div style={{ background: '#e3f2fd', padding: '1rem', borderRadius: '4px', marginBottom: '1rem' }}>
          {activeJobsCount} active job{activeJobsCount !== 1 ? 's' : ''} - Auto-refreshing every 5 seconds
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
        {jobs.map((job) => (
          <div
            key={job.bomId}
            style={{
              border: '1px solid #ddd',
              borderRadius: '8px',
              padding: '1rem',
              background: job.status === 'running' ? '#f0f9ff' : '#fff',
            }}
          >
            <h3 style={{ marginTop: 0 }}>{job.bomName || 'Unnamed BOM'}</h3>

            <div style={{ marginBottom: '0.5rem' }}>
              <strong>Status:</strong>{' '}
              <span
                style={{
                  color:
                    job.status === 'completed'
                      ? 'green'
                      : job.status === 'failed'
                        ? 'red'
                        : job.status === 'running'
                          ? 'blue'
                          : job.status === 'paused'
                            ? 'orange'
                            : 'gray',
                }}
              >
                {job.status.toUpperCase()}
              </span>
            </div>

            <div style={{ marginBottom: '0.5rem' }}>
              <strong>Progress:</strong> {job.overallProgress}%
              <div
                style={{
                  background: '#e0e0e0',
                  height: '8px',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  marginTop: '4px',
                }}
              >
                <div
                  style={{
                    background: job.status === 'failed' ? 'red' : '#2196f3',
                    height: '100%',
                    width: `${job.overallProgress}%`,
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>

            <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '1rem' }}>
              <div>Stage: {job.currentStage}</div>
              <div>
                Enriched: {job.enrichedItems} / {job.totalItems}
              </div>
              {job.failedItems > 0 && <div style={{ color: 'red' }}>Failed: {job.failedItems}</div>}
              {job.healthGrade && <div>Health: {job.healthGrade}</div>}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {job.canPause && (
                <button
                  onClick={() => pauseJob(job.bomId)}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                >
                  Pause
                </button>
              )}
              {job.canResume && (
                <button
                  onClick={() => resumeJob(job.bomId)}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                >
                  Resume
                </button>
              )}
              {job.canCancel && (
                <button
                  onClick={() => cancelJob(job.bomId)}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', color: 'red' }}
                >
                  Cancel
                </button>
              )}
              {job.canRestart && (
                <button
                  onClick={() => restartJob(job.bomId)}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', color: 'green' }}
                >
                  Restart
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {jobs.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#999' }}>
          No processing jobs found
        </div>
      )}
    </div>
  );
}
