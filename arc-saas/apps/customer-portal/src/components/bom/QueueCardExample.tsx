/**
 * QueueCard Example Usage
 *
 * This file demonstrates how to use the Queue Card components
 * in different scenarios. Use these patterns in your actual pages.
 *
 * USAGE EXAMPLES:
 *
 * 1. Single Queue Card:
 * ```tsx
 * import { QueueCard } from '@/components/bom';
 *
 * <QueueCard
 *   bomId="123"
 *   fileName="bom-file.csv"
 *   status="enriching"
 *   progress={65}
 *   totalItems={100}
 *   processedItems={65}
 *   startedAt={new Date()}
 *   onViewDetails={() => navigate(`/boms/${bomId}`)}
 * />
 * ```
 *
 * 2. Queue Card List:
 * ```tsx
 * import { QueueCardList } from '@/components/bom';
 *
 * const jobs = [
 *   {
 *     bomId: '1',
 *     fileName: 'bom1.csv',
 *     status: 'enriching',
 *     progress: 65,
 *     totalItems: 100,
 *     processedItems: 65,
 *     startedAt: new Date(),
 *   },
 * ];
 *
 * <QueueCardList
 *   jobs={jobs}
 *   onViewDetails={(id) => navigate(`/boms/${id}`)}
 *   onCancel={(id) => cancelEnrichment(id)}
 *   onRetry={(id) => retryEnrichment(id)}
 * />
 * ```
 *
 * 3. With Real-time Updates (SSE or Polling):
 * ```tsx
 * const { data: jobs, isLoading } = useQuery({
 *   queryKey: ['bom-queue'],
 *   queryFn: fetchBomQueue,
 *   refetchInterval: 5000, // Poll every 5 seconds
 * });
 *
 * <QueueCardList
 *   jobs={jobs || []}
 *   loading={isLoading}
 * />
 * ```
 *
 * 4. Loading State:
 * ```tsx
 * import { QueueCardSkeleton } from '@/components/bom';
 *
 * {loading ? (
 *   <>
 *     <QueueCardSkeleton />
 *     <QueueCardSkeleton />
 *     <QueueCardSkeleton />
 *   </>
 * ) : (
 *   <QueueCardList jobs={jobs} />
 * )}
 * ```
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QueueCard, QueueCardList, type QueueJob } from '@/components/bom';

// Example: Mock data for demonstration
const MOCK_JOBS: QueueJob[] = [
  {
    bomId: 'bom-001',
    fileName: 'resistors-bom.csv',
    status: 'enriching',
    progress: 75,
    totalItems: 200,
    processedItems: 150,
    startedAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
    estimatedCompletion: new Date(Date.now() + 2 * 60 * 1000), // 2 minutes from now
  },
  {
    bomId: 'bom-002',
    fileName: 'capacitors-bom.xlsx',
    status: 'processing',
    progress: 30,
    totalItems: 150,
    processedItems: 45,
    startedAt: new Date(Date.now() - 2 * 60 * 1000), // 2 minutes ago
    estimatedCompletion: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes from now
  },
  {
    bomId: 'bom-003',
    fileName: 'ics-bom.csv',
    status: 'completed',
    progress: 100,
    totalItems: 100,
    processedItems: 100,
    startedAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
  },
  {
    bomId: 'bom-004',
    fileName: 'failed-bom.csv',
    status: 'failed',
    progress: 45,
    totalItems: 80,
    processedItems: 36,
    startedAt: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
  },
  {
    bomId: 'bom-005',
    fileName: 'pending-bom.csv',
    status: 'pending',
    progress: 0,
    totalItems: 120,
    processedItems: 0,
  },
];

export function QueueCardExample() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<QueueJob[]>(MOCK_JOBS);

  const handleViewDetails = (bomId: string) => {
    console.log('View details for BOM:', bomId);
    navigate(`/boms/${bomId}`);
  };

  const handleCancel = (bomId: string) => {
    console.log('Cancel BOM:', bomId);
    // In real app: call API to cancel enrichment
    setJobs((prev) =>
      prev.map((job) => (job.bomId === bomId ? { ...job, status: 'cancelled' as const } : job))
    );
  };

  const handleRetry = (bomId: string) => {
    console.log('Retry BOM:', bomId);
    // In real app: call API to retry enrichment
    setJobs((prev) =>
      prev.map((job) =>
        job.bomId === bomId
          ? { ...job, status: 'pending' as const, progress: 0, processedItems: 0 }
          : job
      )
    );
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Queue Card Examples</h1>
        <p className="text-muted-foreground">
          Demonstrations of Queue Card components for BOM upload tracking
        </p>
      </div>

      {/* Example 1: Single Queue Card */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold mb-1">Single Queue Card</h2>
          <p className="text-sm text-muted-foreground">Individual upload job status</p>
        </div>
        <QueueCard
          bomId={MOCK_JOBS[0].bomId}
          fileName={MOCK_JOBS[0].fileName}
          status={MOCK_JOBS[0].status}
          progress={MOCK_JOBS[0].progress}
          totalItems={MOCK_JOBS[0].totalItems}
          processedItems={MOCK_JOBS[0].processedItems}
          startedAt={MOCK_JOBS[0].startedAt}
          estimatedCompletion={MOCK_JOBS[0].estimatedCompletion}
          onViewDetails={() => handleViewDetails(MOCK_JOBS[0].bomId)}
          onCancel={() => handleCancel(MOCK_JOBS[0].bomId)}
        />
      </section>

      {/* Example 2: Queue Card List */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold mb-1">Queue Card List</h2>
          <p className="text-sm text-muted-foreground">
            Multiple upload jobs with filtering and actions
          </p>
        </div>
        <QueueCardList
          jobs={jobs}
          onViewDetails={handleViewDetails}
          onCancel={handleCancel}
          onRetry={handleRetry}
          showFilters={true}
        />
      </section>

      {/* Example 3: Different Status States */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold mb-1">Status States</h2>
          <p className="text-sm text-muted-foreground">Different upload job statuses</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {jobs.map((job) => (
            <QueueCard
              key={job.bomId}
              {...job}
              onViewDetails={() => handleViewDetails(job.bomId)}
              onCancel={() => handleCancel(job.bomId)}
              onRetry={() => handleRetry(job.bomId)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
