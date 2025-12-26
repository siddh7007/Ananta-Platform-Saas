import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Chip,
  Collapse,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import { PipelineStep, PipelineStepContent } from './PipelineStep';
import { AIEnhancementStep as AIEnhancementStepType, AIOperation } from '../types';

interface AIEnhancementStepComponentProps {
  data: AIEnhancementStepType | undefined;
}

/**
 * AIEnhancementStep - Modular Component with Full Transparency
 *
 * Shows:
 * - AI provider used
 * - Each operation (category, specs, description)
 * - Input prompts (expandable)
 * - AI responses (expandable)
 * - Confidence scores
 * - Costs per operation
 * - Processing times
 */
export const AIEnhancementStepComponent: React.FC<AIEnhancementStepComponentProps> = ({ data }) => {
  if (!data || !data.enabled) {
    return (
      <PipelineStep
        stepNumber={4}
        title="AI Enhancement (Optional)"
        status="skipped"
        summary="AI enhancement not enabled"
        defaultExpanded={false}
      >
        <Typography variant="body2" color="textSecondary">
          AI enhancement is disabled in the current configuration.
          Enable it in Configuration → Tier 3: AI Enhancement.
        </Typography>
      </PipelineStep>
    );
  }

  const status = data.operations.length > 0 ? 'success' : 'error';
  const summary = `${data.operations.length} operations | Provider: ${data.provider} | Cost: $${data.total_cost_usd.toFixed(4)}`;

  const sections = [
    {
      title: '🤖 AI Provider',
      content: (
        <Box>
          <Chip
            icon={<SmartToyIcon />}
            label={data.provider}
            color="primary"
            sx={{ mr: 1 }}
          />
          <Chip
            label={`${data.operations.length} operations`}
            variant="outlined"
            sx={{ mr: 1 }}
          />
          <Chip
            label={`$${data.total_cost_usd.toFixed(4)} total cost`}
            color="warning"
            variant="outlined"
            sx={{ mr: 1 }}
          />
          <Chip
            label={`${data.total_time_ms}ms total time`}
            variant="outlined"
          />
        </Box>
      ),
    },
    {
      title: '🔬 AI Operations',
      content: (
        <Box>
          {data.operations.map((operation, index) => (
            <AIOperationDetail key={index} operation={operation} index={index + 1} />
          ))}
        </Box>
      ),
    },
  ];

  return (
    <PipelineStep
      stepNumber={4}
      title="AI Enhancement"
      status={status}
      summary={summary}
      defaultExpanded={true}
      metadata={{
        time_ms: data.total_time_ms,
        cost_usd: data.total_cost_usd,
      }}
    >
      <PipelineStepContent sections={sections} />
    </PipelineStep>
  );
};

/**
 * AIOperationDetail - Individual AI Operation Display
 */
interface AIOperationDetailProps {
  operation: AIOperation;
  index: number;
}

const AIOperationDetail: React.FC<AIOperationDetailProps> = ({ operation, index }) => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [showResponse, setShowResponse] = useState(false);

  const getOperationLabel = (type: string) => {
    switch (type) {
      case 'category_suggestion':
        return 'Category Suggestion';
      case 'spec_extraction':
        return 'Specification Extraction';
      case 'description_enhancement':
        return 'Description Enhancement';
      default:
        return type;
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="subtitle1" fontWeight={600}>
          Operation {index}: {getOperationLabel(operation.type)}
        </Typography>
        <Box display="flex" gap={1}>
          {operation.confidence && (
            <Chip
              label={`${(operation.confidence * 100).toFixed(1)}% confidence`}
              size="small"
              color={operation.confidence >= 0.9 ? 'success' : 'warning'}
            />
          )}
          <Chip
            label={`${operation.processing_time_ms}ms`}
            size="small"
            variant="outlined"
          />
          <Chip
            label={`$${operation.cost_usd.toFixed(4)}`}
            size="small"
            color="warning"
            variant="outlined"
          />
        </Box>
      </Box>

      {/* Input Prompt */}
      <Box mb={2}>
        <Button
          size="small"
          startIcon={showPrompt ? <VisibilityOffIcon /> : <VisibilityIcon />}
          onClick={() => setShowPrompt(!showPrompt)}
          sx={{ mb: 1 }}
        >
          {showPrompt ? 'Hide' : 'Show'} Input Prompt
        </Button>
        <Collapse in={showPrompt}>
          <Paper
            sx={{
              p: 2,
              bgcolor: 'grey.100',
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              maxHeight: 200,
              overflow: 'auto',
            }}
          >
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
              {operation.input_prompt}
            </pre>
          </Paper>
        </Collapse>
      </Box>

      {/* AI Response */}
      <Box mb={2}>
        <Button
          size="small"
          startIcon={showResponse ? <VisibilityOffIcon /> : <VisibilityIcon />}
          onClick={() => setShowResponse(!showResponse)}
          sx={{ mb: 1 }}
        >
          {showResponse ? 'Hide' : 'Show'} AI Response
        </Button>
        <Collapse in={showResponse}>
          <Paper
            sx={{
              p: 2,
              bgcolor: 'success.lighter',
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              maxHeight: 300,
              overflow: 'auto',
            }}
          >
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(operation.output, null, 2)}
            </pre>
          </Paper>
        </Collapse>
      </Box>

      {/* Reasoning (if available) */}
      {operation.reasoning && (
        <Box>
          <Typography variant="caption" color="textSecondary" fontWeight={600}>
            AI Reasoning:
          </Typography>
          <Typography variant="body2" sx={{ fontStyle: 'italic', mt: 0.5 }}>
            "{operation.reasoning}"
          </Typography>
        </Box>
      )}
    </Paper>
  );
};
