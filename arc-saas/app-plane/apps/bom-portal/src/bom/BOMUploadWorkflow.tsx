/**
 * BOM Upload Workflow Component - Unified Pipeline
 *
 * Unified Flow (all on single page):
 * 1. Upload file → Parse columns client-side
 * 2. Store raw file in MinIO (customer-uploads bucket)
 * 3. Save to Supabase bom_uploads (status: 'mapping_pending')
 * 4. User confirms column mappings
 * 5. Save line items to Supabase bom_line_items
 * 6. Update bom_uploads (status: 'completed')
 * 7. Start enrichment → Live SSE progress
 * 8. Show risk analysis and results
 *
 * Refactored: Uses modular components from ./intake/
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNotify, useRedirect, usePermissions } from 'react-admin';
import { useAuth0 } from '@auth0/auth0-react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  List,
  CircularProgress,
  Paper,
  Divider,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';

import {
  BOMDropzone,
  BOMQueueItem,
  BOMProjectBanner,
  BOMWorkflowStepper,
  BOMQueueMetrics,
  BOMResultsSummary,
  EnrichmentQueueSection,
  AnalysisQueueCard,
  type QueueItemData,
  type BOMWorkflowStatus,
} from './intake';
import type { EnrichmentState } from '../hooks/useEnrichmentProgress';
import type { AnalysisQueueMetrics } from '../hooks/useEnrichmentQueue';
import { supabase } from '../providers/dataProvider';
import { publishCustomEvent } from '../services/eventPublisher';
import { getCnsBaseUrl } from '../services/cnsApi';
import { parseBOMFile } from '../utils/bomParser';
import { analytics } from '../services/analytics';
import { BomUploadTipBanner } from '../components/shared';
import { useOrganization } from '../contexts/OrganizationContext';
import { consumePendingUploadFiles } from './uploadQueueStore';

// Feature flag: when true, use the new /api/bom-snapshots + Temporal
// ingestion path instead of writing BOMs directly from the client.
const USE_BOM_SNAPSHOTS = ['true', '1', 'yes'].includes(
  ((import.meta as any).env?.VITE_USE_BOM_SNAPSHOTS || '').toLowerCase()
);

export const BOMUploadWorkflow: React.FC = () => {
  const notify = useNotify();
  const redirect = useRedirect();
  const { permissions } = usePermissions();
  const { currentOrg } = useOrganization();
  const { user: auth0User, isAuthenticated: auth0Authenticated } = useAuth0();
  const isAdmin = permissions === 'owner' || permissions === 'admin' || permissions === 'super_admin';
  const showDebugIds = useMemo(() => {
    try {
      return isAdmin && localStorage.getItem('cbp_show_debug_ids') === 'true';
    } catch {
      return false;
    }
  }, [isAdmin]);

  // Context from localStorage
  const currentProjectId = localStorage.getItem('current_project_id');
  const tenantId = currentOrg?.id || null;
  const userEmail = localStorage.getItem('user_email');

  // State
  const [dbUserId, setDbUserId] = useState<string | null>(null);
  const [currentProject, setCurrentProject] = useState<{ id: string; name: string } | null>(null);
  const [queue, setQueue] = useState<QueueItemData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Unified workflow state - enrichment phase tracking
  const [enrichingBomId, setEnrichingBomId] = useState<string | null>(null);
  const [enrichingFilename, setEnrichingFilename] = useState<string>('');
  const [enrichmentPhase, setEnrichmentPhase] = useState<'upload' | 'enriching' | 'enriched'>('upload');
  const [enrichmentProgress, setEnrichmentProgress] = useState<{ percent: number; enriched: number; total: number } | null>(null);
  const [enrichedResults, setEnrichedResults] = useState<{ enriched: number; failed: number; total: number } | null>(null);
  const [analysisMetrics, setAnalysisMetrics] = useState<AnalysisQueueMetrics>({ status: 'pending' });

  // Compute current user ID - prefer Auth0 sub for SSO users (to match NovuBellWrapper)
  // This ensures notifications are sent to the same subscriberId the bell is using
  const currentUserId = useMemo(() => {
    if (auth0Authenticated && auth0User?.sub) return auth0User.sub;
    if (dbUserId) return dbUserId;
    return null;
  }, [dbUserId, auth0Authenticated, auth0User]);

  // Resume state from URL parameters
  const [isResuming, setIsResuming] = useState(false);

  // Parse URL parameters for resume functionality
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const resumeUploadId = params.get('resume');
    const resumeStep = params.get('step');
    const resumeBomId = params.get('bomId');

    if (!resumeUploadId) return;

    console.log('[BOMUpload] Resuming workflow:', { resumeUploadId, resumeStep, resumeBomId });
    setIsResuming(true);

    const loadUploadForResume = async () => {
      try {
        // Load the bom_upload record
        const { data: uploadRecord, error: uploadError } = await supabase
          .from('bom_uploads')
          .select('*')
          .eq('id', resumeUploadId)
          .single();

        if (uploadError || !uploadRecord) {
          notify('Failed to load upload for resume', { type: 'error' });
          setIsResuming(false);
          return;
        }

        console.log('[BOMUpload] Loaded upload record:', uploadRecord);

        // Determine the step to resume from
        const status = uploadRecord.status?.toLowerCase();

        if (resumeStep === 'results' || status === 'completed') {
          // Show completed workflow results with full state
          const bomId = resumeBomId || uploadRecord.bom_id;
          if (bomId) {
            // Load final enrichment counts from bom_line_items
            const { data: lineItems } = await supabase
              .from('bom_line_items')
              .select('enrichment_status')
              .eq('bom_id', bomId);

            const total = lineItems?.length || 0;
            const enriched = lineItems?.filter(li => li.enrichment_status === 'enriched').length || 0;
            const failed = lineItems?.filter(li => li.enrichment_status === 'failed' || li.enrichment_status === 'not_found').length || 0;

            // Create queue item to show file info in UI
            const queueItem: QueueItemData = {
              file: new File([], uploadRecord.filename), // Dummy file for display
              status: 'completed',
              uploadId: uploadRecord.id,
              bomId: bomId,
              s3Key: uploadRecord.s3_key,
              totalRows: uploadRecord.total_rows || total,
              columnMappings: uploadRecord.column_mappings
                ? Object.entries(uploadRecord.column_mappings).map(([source, target]) => ({
                    source,
                    target: target as any,
                  }))
                : [],
            };
            setQueue([queueItem]);

            setEnrichingBomId(bomId);
            setEnrichingFilename(uploadRecord.filename);
            setEnrichmentPhase('enriched');
            setEnrichedResults({ enriched, failed, total });
            notify(`Viewing results for ${uploadRecord.filename}`, { type: 'info' });
          }
        } else if (resumeStep === 'enriching' || status === 'processing') {
          // Resume to enrichment progress view - also ensure workflow is running
          const bomId = resumeBomId || uploadRecord.bom_id;
          if (bomId) {
            setEnrichingBomId(bomId);
            setEnrichingFilename(uploadRecord.filename);
            setEnrichmentPhase('enriching');

            // Try to start enrichment (returns 409 if already running, which is OK)
            // This ensures the workflow is actually running when resuming
            try {
              const auth0Token = localStorage.getItem('auth0_access_token');
              const response = await fetch(`${getCnsBaseUrl()}/api/boms/${bomId}/enrichment/start`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(auth0Token ? { Authorization: `Bearer ${auth0Token}` } : {}),
                },
                body: JSON.stringify({
                  organization_id: uploadRecord.organization_id,
                  project_id: uploadRecord.project_id,
                  priority: 7,
                }),
              });

              if (response.status === 409) {
                // Workflow already running - that's fine
                console.log('[BOMUpload] Enrichment already in progress for resumed BOM');
              } else if (!response.ok) {
                console.warn('[BOMUpload] Could not start enrichment for resumed BOM:', response.status);
              } else {
                console.log('[BOMUpload] Started enrichment for resumed BOM');
              }
            } catch (err) {
              console.warn('[BOMUpload] Failed to start enrichment on resume:', err);
            }

            notify(`Resuming enrichment for ${uploadRecord.filename}`, { type: 'info' });
          }
        } else if (resumeStep === 'enrich' || status === 'ready_for_enrichment') {
          // Resume to ready-to-enrich state
          const bomId = resumeBomId || uploadRecord.bom_id;
          if (bomId) {
            // Load BOM line items count
            const { count } = await supabase
              .from('bom_line_items')
              .select('*', { count: 'exact', head: true })
              .eq('bom_id', bomId);

            // Create a queue item in 'confirming' state (ready to start enrichment)
            const queueItem: QueueItemData = {
              file: new File([], uploadRecord.filename), // Dummy file
              status: 'confirming',
              uploadId: uploadRecord.id,
              bomId: bomId,
              s3Key: uploadRecord.s3_key,
              totalRows: count || uploadRecord.total_rows || 0,
              columnMappings: uploadRecord.column_mappings
                ? Object.entries(uploadRecord.column_mappings).map(([source, target]) => ({
                    source,
                    target: target as any,
                  }))
                : [],
            };
            setQueue([queueItem]);
            notify(`Ready to enrich: ${uploadRecord.filename}`, { type: 'info' });
          }
        } else if (resumeStep === 'mapping' || status === 'mapping_pending' || status === 'parsed') {
          // Resume to column mapping view
          const queueItem: QueueItemData = {
            file: new File([], uploadRecord.filename), // Dummy file
            status: 'mapping',
            uploadId: uploadRecord.id,
            s3Key: uploadRecord.s3_key,
            totalRows: uploadRecord.total_rows || 0,
            previewData: uploadRecord.preview_data || [],
            columnMappings: uploadRecord.detected_columns
              ? Object.entries(uploadRecord.detected_columns).map(([source, target]) => ({
                  source,
                  target: target as any,
                }))
              : [],
            unmappedColumns: uploadRecord.unmapped_columns || [],
          };
          setQueue([queueItem]);
          notify(`Resuming column mapping for ${uploadRecord.filename}`, { type: 'info' });
        }

        setIsResuming(false);
      } catch (err) {
        console.error('[BOMUpload] Error resuming workflow:', err);
        notify('Failed to resume workflow', { type: 'error' });
        setIsResuming(false);
      }
    };

    loadUploadForResume();
  }, []); // Only run once on mount

  // Look up database user ID by email
  useEffect(() => {
    const lookupDbUserId = async () => {
      if (!userEmail) return;
      try {
        const { data } = await supabase
          .from('users')
          .select('id')
          .eq('email', userEmail)
          .maybeSingle();
        if (data?.id) setDbUserId(data.id);
      } catch (err) {
        console.error('[BOM Upload] Failed to look up user:', err);
      }
    };
    lookupDbUserId();
  }, [userEmail]);

  // Load current project name
  useEffect(() => {
    if (!currentProjectId) {
      notify('No project selected. Please select a project from Dashboard first.', { type: 'warning' });
      redirect('/');
      return;
    }

    const loadProject = async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .eq('id', currentProjectId)
        .maybeSingle();

      if (error || !data) {
        notify('Failed to load current project', { type: 'error' });
        return;
      }
      setCurrentProject(data);
    };
    loadProject();
  }, [currentProjectId, notify, redirect]);

  // Track page view on mount
  useEffect(() => {
    analytics.trackPageView('BOM Upload', '/bom/upload');
  }, []);

  // Add files to queue
  const handleFilesAdded = useCallback((files: File[]) => {
    const newItems: QueueItemData[] = files.map((file) => ({
      file,
      status: 'pending',
    }));
    setQueue((prev) => [...prev, ...newItems]);
    // Track upload started
    files.forEach((f) => analytics.trackBomUploadStarted(f.name));
  }, []);

  useEffect(() => {
    const pendingFiles = consumePendingUploadFiles();
    if (pendingFiles.length > 0) {
      handleFilesAdded(pendingFiles);
    }
  }, [handleFilesAdded]);

  // Upload single file
  const uploadSingleFile = async (queueIndex: number) => {
    const item = queue[queueIndex];

    try {
      if (!tenantId) {
        throw new Error('No organization selected. Please choose an organization to continue.');
      }
      // Step 1: Parse file
      setQueue((prev) => prev.map((it, idx) => (idx === queueIndex ? { ...it, status: 'parsing' } : it)));
      const parsed = await parseBOMFile(item.file);

      // Step 2: Verify session
      const auth0Token = localStorage.getItem('auth0_access_token');
      const { data: sessionData } = await supabase.auth.getSession();
      if (!auth0Token && !sessionData?.session) {
        throw new Error('Please log in to upload BOMs');
      }

      // Step 3: Upload to MinIO
      setQueue((prev) => prev.map((it, idx) => (idx === queueIndex ? { ...it, status: 'uploading' } : it)));
      const formData = new FormData();
      formData.append('file', item.file);
      formData.append('organization_id', tenantId);

      const headers: Record<string, string> = {};
      if (auth0Token) headers['Authorization'] = `Bearer ${auth0Token}`;

      const uploadResponse = await fetch(`${getCnsBaseUrl()}/api/customer/upload`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload file: ${await uploadResponse.text()}`);
      }
      const uploadResult = await uploadResponse.json();

      // Step 4: Save to Supabase
      const { data: uploadRecord, error: insertError } = await supabase
        .from('bom_uploads')
        .insert({
          filename: item.file.name,
          file_size: item.file.size,
          file_type: item.file.name.split('.').pop()?.toLowerCase() || 'csv',
          organization_id: tenantId,
          project_id: currentProjectId,
          uploaded_by: dbUserId || null,
          upload_source: 'customer_portal',
          s3_bucket: uploadResult.s3_bucket,
          s3_key: uploadResult.s3_key,
          storage_backend: uploadResult.storage_backend,
          status: 'mapping_pending',
          detected_columns: parsed.detected_mappings.reduce(
            (acc, m) => ({ ...acc, [m.source]: m.target }),
            {}
          ),
          unmapped_columns: parsed.unmapped_columns,
          total_rows: parsed.total_rows,
          preview_data: parsed.rows.slice(0, 10),
        })
        .select()
        .single();

      if (insertError || !uploadRecord) {
        throw new Error(insertError?.message || 'Failed to save upload record');
      }

      // Step 5: Show mapping UI
      setQueue((prev) =>
        prev.map((it, idx) =>
          idx === queueIndex
            ? {
                ...it,
                status: 'mapping',
                uploadId: uploadRecord.id,
                s3Key: uploadResult.s3_key,
                totalRows: parsed.total_rows,
                previewData: parsed.rows.slice(0, 10),
                allRows: parsed.rows,
                columnMappings: parsed.detected_mappings,
                unmappedColumns: parsed.unmapped_columns,
              }
            : it
        )
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown upload error';
      setQueue((prev) =>
        prev.map((it, idx) => (idx === queueIndex ? { ...it, status: 'error', error: message } : it))
      );
      notify(`Upload failed: ${message}`, { type: 'error' });
    }
  };

  // Start workflow for all pending files
  const startWorkflow = async () => {
    if (!tenantId) {
      notify('No organization selected. Please select an organization before uploading.', { type: 'error' });
      return;
    }
    if (!currentProjectId || queue.length === 0) {
      notify('No files to upload', { type: 'warning' });
      return;
    }

    setIsProcessing(true);
    try {
      for (let idx = 0; idx < queue.length; idx++) {
        if (queue[idx].status === 'pending') {
          await uploadSingleFile(idx);
        }
      }
      notify('All files uploaded successfully!', { type: 'success' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      notify(message, { type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle mapping change
  const handleMappingChange = (queueIndex: number, sourceColumn: string, targetField: string) => {
    setQueue((prev) =>
      prev.map((item, idx) => {
        if (idx === queueIndex && item.columnMappings) {
          return {
            ...item,
            columnMappings: item.columnMappings.map((m) =>
              m.source === sourceColumn ? { ...m, target: targetField as any } : m
            ),
          };
        }
        return item;
      })
    );
  };

  // Confirm mappings and process
  const confirmMappings = async (queueIndex: number) => {
    const item = queue[queueIndex];
    if (!item.uploadId || !item.columnMappings || !item.allRows) return;
    if (!tenantId) {
      notify('No organization selected. Please select an organization before confirming mappings.', { type: 'error' });
      return;
    }

    const hasMPN = item.columnMappings.some((m) => m.target === 'manufacturer_part_number');
    if (!hasMPN) {
      notify('Part Number (MPN) column is required', { type: 'error' });
      return;
    }

    try {
      setQueue((prev) => prev.map((it, idx) => (idx === queueIndex ? { ...it, status: 'confirming' } : it)));

      const columnMappings: Record<string, string> = {};
      item.columnMappings.forEach((m) => {
        if (m.target !== 'ignore') columnMappings[m.target] = m.source;
      });

      // Update bom_uploads
      await supabase
        .from('bom_uploads')
        .update({
          column_mappings: columnMappings,
          mapping_confirmed: true,
          mapping_confirmed_at: new Date().toISOString(),
          status: 'processing',
        })
        .eq('id', item.uploadId);

      // Use CNS snapshot path if enabled
      if (USE_BOM_SNAPSHOTS && item.s3Key) {
        const auth0Token = localStorage.getItem('auth0_access_token');
          const snapshotResp = await fetch(`${getCnsBaseUrl()}/api/bom-snapshots`, {
            method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(auth0Token ? { Authorization: `Bearer ${auth0Token}` } : {}),
          },
          body: JSON.stringify({
            file_id: item.s3Key,
            organization_id: tenantId,
            project_id: currentProjectId,
            bom_name: item.file.name,
            uploaded_by: userEmail || dbUserId,
            source: 'customer',
            column_mappings: columnMappings,
          }),
        });

        if (!snapshotResp.ok) {
          const errorData = await snapshotResp.json().catch(() => ({}));
          throw new Error(errorData.detail || 'Failed to create BOM snapshot');
        }

        const snapshotResult = await snapshotResp.json();
        setQueue((prev) =>
          prev.map((it, idx) =>
            idx === queueIndex ? { ...it, status: 'completed', bomId: snapshotResult.bom_id } : it
          )
        );
        notify('BOM submitted for ingestion and enrichment.', { type: 'success' });
        return;
      }

      // Legacy path: create BOM and line items directly
      setQueue((prev) => prev.map((it, idx) => (idx === queueIndex ? { ...it, status: 'saving' } : it)));

      const rows = item.allRows || [];
      const { data: bomRecord, error: bomError } = await supabase
        .from('boms')
        .insert({
          organization_id: tenantId,
          project_id: currentProjectId,
          name: item.file.name,
          status: 'pending',
          source: 'customer_portal',
          component_count: rows.length,
          metadata: { upload_id: item.uploadId, s3_key: item.s3Key, column_mappings: columnMappings },
        })
        .select()
        .single();

      if (bomError || !bomRecord) throw new Error(bomError?.message || 'Failed to create BOM');

      // Save line items in chunks to avoid oversized payloads
      const chunkSize = 500;
      let totalSaved = 0;
      for (let start = 0; start < rows.length; start += chunkSize) {
        const chunk = rows.slice(start, start + chunkSize).map((row, idx) => {
          const lineItem: Record<string, unknown> = {
            bom_id: bomRecord.id,
            line_number: start + idx + 1,
            metadata: { raw_data: row },
          };
          Object.entries(columnMappings).forEach(([target, source]) => {
            const value = row[source];
            if (value !== undefined && value !== null && value !== '') {
              lineItem[target] = String(value);
            }
          });
          return lineItem;
        });

        if (chunk.length === 0) continue;

        const { error: lineItemsError } = await supabase.from('bom_line_items').insert(chunk);
        if (lineItemsError) {
          throw new Error(`Failed to save line items: ${lineItemsError.message}`);
        }
        totalSaved += chunk.length;
      }

      // Update status
      await supabase.from('bom_uploads').update({ status: 'completed', bom_id: bomRecord.id }).eq('id', item.uploadId);

      // Publish event
      await publishCustomEvent('customer.bom.uploaded', 'bom_uploaded', {
        upload_id: item.uploadId,
        bom_id: bomRecord.id,
        project_id: currentProjectId,
        organization_id: tenantId,
        user_id: currentUserId,  // Required for Novu notifications
        filename: item.file.name,
        status: 'completed',
        total_rows: item.totalRows,
        line_items_saved: totalSaved,
      }, 7);

      setQueue((prev) =>
        prev.map((it, idx) =>
          idx === queueIndex
            ? { ...it, status: 'completed', bomId: bomRecord.id, allRows: undefined }
            : it
        )
      );
      // Track successful upload
      analytics.trackBomUploadComplete(bomRecord.id, totalSaved);
      notify(`BOM uploaded! ${totalSaved} line items saved.`, { type: 'success' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Confirmation failed';
      setQueue((prev) =>
        prev.map((it, idx) => (idx === queueIndex ? { ...it, status: 'error', error: message } : it))
      );
      notify(`Confirmation failed: ${message}`, { type: 'error' });
    }
  };

  // Start enrichment - now inline instead of redirect
  const startEnrichment = async (queueIndex: number) => {
    const item = queue[queueIndex];
    if (!item.bomId) {
      notify('BOM ID not found.', { type: 'error' });
      return;
    }

    try {
      const auth0Token = localStorage.getItem('auth0_access_token');
      const response = await fetch(`${getCnsBaseUrl()}/api/boms/${item.bomId}/enrichment/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(auth0Token ? { Authorization: `Bearer ${auth0Token}` } : {}),
        },
        body: JSON.stringify({
          organization_id: tenantId,
          project_id: currentProjectId,
          user_id: currentUserId,  // Required for Novu notifications
          priority: 7,
        }),
      });

      if (response.status === 409) {
        notify('Enrichment already in progress. Connecting...', { type: 'info' });
      } else if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail?.message || errorData.detail || 'Failed to start enrichment');
      } else {
        notify('Enrichment started!', { type: 'success' });
      }

      // Switch to inline enrichment view
      setEnrichingBomId(item.bomId);
      setEnrichingFilename(item.file.name);
      setEnrichmentPhase('enriching');
      setEnrichmentProgress(null);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to start enrichment';
      notify(message, { type: 'error' });
    }
  };

  // Handle enrichment completion
  const handleEnrichmentComplete = useCallback((state: EnrichmentState) => {
    setEnrichmentPhase('enriched');
    setEnrichedResults({
      enriched: state.enriched_items,
      failed: state.failed_items,
      total: state.total_items,
    });
    notify('Enrichment complete! View your analysis below.', { type: 'success' });
    analytics.trackEnrichmentComplete(enrichingBomId || '', state.enriched_items, state.failed_items);
  }, [enrichingBomId, notify]);

  // Handle enrichment error
  const handleEnrichmentError = useCallback((error: Error) => {
    notify(`Enrichment error: ${error.message}`, { type: 'error' });
  }, [notify]);

  // Handle enrichment progress updates (for stepper)
  const handleEnrichmentProgress = useCallback((progress: { percent: number; enriched: number; total: number }) => {
    setEnrichmentProgress(progress);
  }, []);

  // Handle cancel during enrichment (go back to upload phase)
  const handleEnrichmentCancel = useCallback(() => {
    setEnrichmentPhase('upload');
    setEnrichmentProgress(null);
    // Note: enrichment continues in background, we just switch the view
    notify('Returned to upload view. Enrichment continues in background.', { type: 'info' });
  }, [notify]);

  // Reset to start new upload
  const handleStartNew = useCallback(() => {
    setEnrichingBomId(null);
    setEnrichingFilename('');
    setEnrichmentPhase('upload');
    setEnrichmentProgress(null);
    setEnrichedResults(null);
    setQueue([]);
  }, []);

  // Handle step navigation in stepper (go back to previous phases)
  const handleStepClick = useCallback((stepIndex: number, stepLabel: string) => {
    console.log(`[Workflow] Step clicked: ${stepIndex} - ${stepLabel}`);

    // Steps 0-3: Upload phase (Upload, Parse, Map, Save)
    if (stepIndex <= 3) {
      // Go back to upload phase - allow starting a new upload
      // Don't clear enrichment state in case user wants to go back
      setEnrichmentPhase('upload');
      notify('Returned to upload phase. You can upload additional files.', { type: 'info' });
    }
    // Step 4: Enrichment phase
    else if (stepIndex === 4) {
      // If we have an enriching BOM, show enrichment panel
      if (enrichingBomId) {
        setEnrichmentPhase('enriching');
        notify('Showing enrichment progress.', { type: 'info' });
      }
    }
    // Step 5: Results phase
    else if (stepIndex === 5) {
      // If we have results, show them
      if (enrichedResults) {
        setEnrichmentPhase('enriched');
        notify('Showing enrichment results.', { type: 'info' });
      }
    }
  }, [enrichingBomId, enrichedResults, notify]);

  // Retry failed upload
  const handleRetry = (queueIndex: number) => {
    setQueue((prev) =>
      prev.map((it, idx) => (idx === queueIndex ? { ...it, status: 'pending', error: undefined } : it))
    );
  };

  // Remove item from queue
  const handleRemove = (queueIndex: number) => {
    setQueue((prev) => prev.filter((_, idx) => idx !== queueIndex));
  };

  // Derived state - MUST be before any early returns to maintain hook order
  const pendingCount = queue.filter((q) => q.status === 'pending').length;

  // Get current active status for stepper - including enrichment phases
  // IMPORTANT: This useMemo MUST be called before any early returns (Rules of Hooks)
  const currentStepStatus = useMemo((): BOMWorkflowStatus | null => {
    // Enrichment phases take precedence
    if (enrichmentPhase === 'enriched') return 'enriched';
    if (enrichmentPhase === 'enriching') return 'enriching';

    // Upload workflow phases
    const activeItem = queue.find((q) =>
      ['parsing', 'uploading', 'mapping', 'confirming', 'saving'].includes(q.status)
    );
    if (activeItem) return activeItem.status as BOMWorkflowStatus;
    if (queue.some((q) => q.status === 'completed')) return 'completed';
    // Files selected but not yet started - step 0 complete, ready to start
    if (queue.some((q) => q.status === 'pending')) return 'pending';
    return null;
  }, [queue, enrichmentPhase]);

  if (!tenantId) {
    return (
      <Box sx={{ p: 3 }}>
        <Card>
          <CardContent>
            <Alert severity="warning">
              Select an organization from the sidebar before uploading a BOM.
            </Alert>
          </CardContent>
        </Card>
      </Box>
    );
  }

  // Loading state - early return AFTER all hooks
  if (!currentProject || isResuming) {
    return (
      <Box sx={{ p: 3 }}>
        <Card>
          <CardContent>
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CircularProgress sx={{ mb: 2 }} />
              <Typography variant="body1">
                {isResuming ? 'Resuming workflow...' : 'Loading project...'}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Upload BOM
      </Typography>

      {/* Contextual tip banner */}
      <BomUploadTipBanner />

      {/* Current Project Banner */}
      <BOMProjectBanner projectName={currentProject.name} onChangeProject={() => redirect('/')} />

      {/* Two-Column Layout: Stepper + Main Content */}
      <Box sx={{ display: 'flex', gap: 3, mt: 2 }}>
        {/* Left Column: Workflow Stepper */}
        <Paper
          elevation={0}
          sx={{
            width: 280,
            flexShrink: 0,
            p: 2,
            bgcolor: 'background.paper',
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
            display: { xs: 'none', md: 'block' },
          }}
        >
          <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ mb: 2 }}>
            Workflow Steps
          </Typography>
          <BOMWorkflowStepper
            currentStatus={currentStepStatus}
            isProcessing={isProcessing || enrichmentPhase === 'enriching'}
            orientation="vertical"
            showDescriptions={true}
            enrichmentProgress={enrichmentProgress}
            onStepClick={handleStepClick}
            allowNavigation={!isProcessing}
          />
        </Paper>

        {/* Right Column: Main Content */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* Pipeline Info */}
          <Alert severity="info" sx={{ mb: 2 }} icon={false}>
            <Typography variant="body2">
              <strong>Unified Pipeline:</strong> Upload → Enrich → Analyze all on one page.
            </Typography>
          </Alert>

          {/* File Upload Area - always visible to show workflow state */}
          <BOMDropzone
            onFilesAdded={handleFilesAdded}
            disabled={isProcessing || enrichmentPhase === 'enriching' || enrichmentPhase === 'enriched'}
            filesInQueue={queue.length}
            totalRows={queue.reduce((sum, q) => sum + (q.totalRows || 0), 0)}
          />

          {/* Upload Queue - always visible when queue has items */}
          {queue.length > 0 && (
            <Card sx={{ mt: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">
                    Upload Queue
                  </Typography>
                  {/* Compact Metrics in Header */}
                  <BOMQueueMetrics items={queue} compact />
                </Box>

                <Divider sx={{ mb: 2 }} />

                {/* Full Queue Metrics */}
                <BOMQueueMetrics items={queue} />

                <List dense sx={{ mt: 2 }}>
                  {queue.map((item, idx) => (
                    <BOMQueueItem
                      key={idx}
                      item={item}
                      index={idx}
                      showDebugIds={showDebugIds}
                      onMappingChange={handleMappingChange}
                      onConfirmMappings={confirmMappings}
                      onStartEnrichment={startEnrichment}
                      onRetry={handleRetry}
                      onRemove={handleRemove}
                      onSkip={() => redirect('/bom_uploads')}
                      onViewDetails={(uploadId) => redirect(`/bom_uploads/${uploadId}/show`)}
                    />
                  ))}
                </List>

                <Divider sx={{ my: 2 }} />

                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                  <Button
                    variant="outlined"
                    disabled={isProcessing || enrichmentPhase === 'enriching'}
                    onClick={() => setQueue([])}
                    startIcon={<DeleteSweepIcon />}
                  >
                    Clear All
                  </Button>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={startWorkflow}
                    disabled={isProcessing || pendingCount === 0 || enrichmentPhase === 'enriching'}
                    startIcon={isProcessing ? <CircularProgress size={20} /> : <CloudUploadIcon />}
                  >
                    {isProcessing ? 'Uploading...' : `Upload ${pendingCount} File(s)`}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          )}

          {/* Enrichment Queue Section - Appears BELOW Upload Queue during enrichment */}
          {(enrichmentPhase === 'enriching' || enrichmentPhase === 'enriched') && enrichingBomId && (
            <EnrichmentQueueSection
              bomId={enrichingBomId}
              filename={enrichingFilename}
              organizationId={tenantId}
              projectId={currentProjectId || undefined}
              onComplete={handleEnrichmentComplete}
              onError={handleEnrichmentError}
              onProgress={handleEnrichmentProgress}
              onAnalysisUpdate={setAnalysisMetrics}
              bomDetailUrl={`/boms/${enrichingBomId}/show`}
            />
          )}

          {/* Analysis Queue Card - Separate card for Risk Analysis & Alerts */}
          {(enrichmentPhase === 'enriching' || enrichmentPhase === 'enriched') && enrichingBomId && (
            <AnalysisQueueCard
              bomId={enrichingBomId}
              analysisMetrics={analysisMetrics}
              enrichmentComplete={enrichmentPhase === 'enriched'}
            />
          )}

          {/* Enriched - Results Summary - Shows below EnrichmentQueueSection when complete */}
          {enrichmentPhase === 'enriched' && enrichingBomId && enrichedResults && (
            <BOMResultsSummary
              bomId={enrichingBomId}
              filename={enrichingFilename}
              totalComponents={enrichedResults.total}
              enrichedCount={enrichedResults.enriched}
              failedCount={enrichedResults.failed}
              onStartNew={handleStartNew}
            />
          )}
        </Box>
      </Box>
    </Box>
  );
};
