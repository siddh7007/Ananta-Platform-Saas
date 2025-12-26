/**
 * Unified BOM Workflow Page
 *
 * Provides a unified BOM upload workflow with:
 * - Inline enrichment progress (no redirect to separate monitor)
 * - Resume support via URL parameters
 * - Deep-link capability for sharing in-progress enrichments
 *
 * URL Parameters:
 * - resume=true: Enable resume mode
 * - bomId=xxx: BOM ID to resume
 * - step=upload|enriching|results: Step to resume to
 */

import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, Typography, Alert, AlertTitle, Button } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { BOMUploadWizard } from '../bom';
import { CNS_STAFF_ORGANIZATION_ID } from '../config/api';
import { WorkspaceLayout, Panel, StackLayout } from '../layout';
import { PageHeader, ErrorBoundary } from '../components/shared';

type ResumeStep = 'upload' | 'enriching' | 'results';

interface ParsedParams {
  resume: boolean;
  bomId?: string;
  step?: ResumeStep;
}

const parseUrlParams = (searchParams: URLSearchParams): ParsedParams => {
  const resume = searchParams.get('resume') === 'true';
  const bomId = searchParams.get('bomId') || undefined;
  const stepParam = searchParams.get('step');

  let step: ResumeStep | undefined;
  if (stepParam === 'upload' || stepParam === 'enriching' || stepParam === 'results') {
    step = stepParam;
  }

  return { resume, bomId, step };
};

const UnifiedBOMWorkflow: React.FC = () => {
  const [searchParams] = useSearchParams();

  const params = useMemo(() => parseUrlParams(searchParams), [searchParams]);

  // Show resume info if resuming
  const showResumeInfo = params.resume && params.bomId;

  const header = (
    <PageHeader
      title="BOM Upload & Enrichment"
      description="Upload a BOM file, map columns, and enrich component data from supplier APIs. Progress is tracked inline—no need to navigate away."
    />
  );

  return (
    <ErrorBoundary>
      <WorkspaceLayout header={header} maxWidth="lg">
        <StackLayout spacing={3}>
          {/* Resume Info Banner */}
          {showResumeInfo && (
            <Alert
              severity="info"
              action={
                <Button
                  color="inherit"
                  size="small"
                  startIcon={<ArrowBackIcon />}
                  onClick={() => window.history.back()}
                >
                  Go Back
                </Button>
              }
            >
              <AlertTitle>Resuming Enrichment</AlertTitle>
              Continuing BOM enrichment for <strong>{params.bomId}</strong>
              {params.step && <> at step: <strong>{params.step}</strong></>}
            </Alert>
          )}

          {/* The Wizard */}
          <Panel padding="none">
            <BOMUploadWizard
              organizationId={CNS_STAFF_ORGANIZATION_ID}
              projectId={undefined}
              source="staff_bulk"
              inlineEnrichment={true}
              resumeBomId={params.resume ? params.bomId : undefined}
              resumeStep={params.resume ? params.step : undefined}
            />
          </Panel>

          {/* Usage Instructions */}
          <Panel variant="flat" padding="medium">
            <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                Deep-Link & Resume Support
              </Typography>
              <Typography variant="body2" color="textSecondary" component="div">
                <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
                  <li>
                    <strong>Resume enrichment:</strong>{' '}
                    <code>?resume=true&bomId=YOUR_BOM_ID&step=enriching</code>
                  </li>
                  <li>
                    <strong>View results:</strong>{' '}
                    <code>?resume=true&bomId=YOUR_BOM_ID&step=results</code>
                  </li>
                  <li>
                    Share URLs to let colleagues monitor or review specific BOMs.
                  </li>
                </ul>
              </Typography>
            </Box>
          </Panel>
        </StackLayout>
      </WorkspaceLayout>
    </ErrorBoundary>
  );
};

export default UnifiedBOMWorkflow;
