/**
 * Onboarding Modal
 *
 * Shows for new users who don't have an organization yet.
 * Allows them to create their organization with a unique slug.
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography,
  Box,
  InputAdornment,
  CircularProgress,
  Alert,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import BusinessIcon from '@mui/icons-material/Business';

interface OnboardingModalProps {
  open: boolean;
  onComplete: (orgName: string, orgSlug: string) => Promise<void> | void;
  userEmail?: string;
  userName?: string;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  open,
  onComplete,
  userEmail,
  userName,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [slugChecking, setSlugChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const steps = ['Welcome', 'Create Organization'];

  // Helper function to normalize slug
  const normalizeSlug = (text: string): string => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-')      // Replace spaces with hyphens
      .replace(/-+/g, '-')       // Replace multiple hyphens with single
      .replace(/^-|-$/g, '');    // Remove leading/trailing hyphens
  };

  // Handle slug change with validation
  const handleSlugChange = (value: string) => {
    const normalized = normalizeSlug(value);
    setOrgSlug(normalized);
    setError(null);

    if (normalized.length >= 3) {
      // TODO: Check slug availability via API
      // For now, mock validation
      setSlugChecking(true);
      setTimeout(() => {
        setSlugAvailable(true); // Mock: always available in dev
        setSlugChecking(false);
      }, 500);
    } else {
      setSlugAvailable(null);
    }
  };

  // Auto-generate slug from org name
  const handleOrgNameChange = (value: string) => {
    setOrgName(value);
    if (value.trim()) {
      const suggestedSlug = normalizeSlug(value);
      setOrgSlug(suggestedSlug);
      handleSlugChange(suggestedSlug);
    }
  };

  const handleNext = async () => {
    if (activeStep === 0) {
      setActiveStep(1);
    } else {
      // Validate before completing
      if (!orgName.trim()) {
        setError('Organization name is required. Please enter a name for your organization.');
        return;
      }
      if (orgName.trim().length < 3) {
        setError('Organization name must be at least 3 characters long.');
        return;
      }
      if (!orgSlug.trim() || orgSlug.length < 3) {
        setError('Organization slug must be at least 3 characters long.');
        return;
      }
      if (slugAvailable === false) {
        setError('This organization slug is already taken. Please choose a different one.');
        return;
      }

      setIsSubmitting(true);
      setError(null);

      try {
        await onComplete(orgName, orgSlug);
      } catch (err) {
        // Handle different types of errors with user-friendly messages
        if (err instanceof Error) {
          if (err.message.includes('network') || err.message.includes('fetch')) {
            setError('Unable to connect to the server. Please check your internet connection and try again.');
          } else if (err.message.includes('timeout')) {
            setError('Request timed out. The server is taking too long to respond. Please try again.');
          } else if (err.message.includes('slug') || err.message.includes('already exists')) {
            setError('This organization name is already taken. Please choose a different one.');
          } else if (err.message.includes('unauthorized') || err.message.includes('permission')) {
            setError('You do not have permission to create an organization. Please contact support.');
          } else {
            setError(`Failed to create organization: ${err.message}. Please try again or contact support.`);
          }
        } else {
          setError('An unexpected error occurred while creating your organization. Please try again or contact support.');
        }
        setIsSubmitting(false);
      }
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  return (
    <Dialog
      open={open}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BusinessIcon color="primary" />
          <Typography variant="h6" component="span">
            Welcome to Components Platform
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ mb: 3, mt: 2 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {activeStep === 0 ? (
          <Box>
            <Typography variant="body1" paragraph>
              Hi {userName || userEmail}! 👋
            </Typography>
            <Typography variant="body1" paragraph>
              Welcome to the Components Platform. To get started, let's create your organization.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              An organization is your team's workspace where you can:
            </Typography>
            <Box component="ul" sx={{ mt: 1, mb: 2 }}>
              <Typography component="li" variant="body2" color="text.secondary">
                Manage BOMs and component data
              </Typography>
              <Typography component="li" variant="body2" color="text.secondary">
                Collaborate with team members
              </Typography>
              <Typography component="li" variant="body2" color="text.secondary">
                Track projects and enrichment workflows
              </Typography>
            </Box>
          </Box>
        ) : (
          <Box>
            <Typography variant="body1" paragraph>
              Choose a name and URL for your organization:
            </Typography>

            <TextField
              label="Organization Name"
              value={orgName}
              onChange={(e) => handleOrgNameChange(e.target.value)}
              fullWidth
              sx={{ mb: 2 }}
              placeholder="e.g., Acme Electronics"
              autoFocus
            />

            <TextField
              label="Organization Slug"
              value={orgSlug}
              onChange={(e) => handleSlugChange(e.target.value)}
              fullWidth
              sx={{ mb: 2 }}
              helperText={`Your organization URL: ${window.location.origin}/org/${orgSlug}`}
              placeholder="e.g., acme-electronics"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Typography variant="body2" color="text.secondary">/org/</Typography>
                  </InputAdornment>
                ),
                endAdornment: orgSlug.length >= 3 && (
                  <InputAdornment position="end">
                    {slugChecking ? (
                      <CircularProgress size={20} />
                    ) : slugAvailable === true ? (
                      <CheckCircleIcon color="success" />
                    ) : slugAvailable === false ? (
                      <ErrorIcon color="error" />
                    ) : null}
                  </InputAdornment>
                ),
              }}
              error={slugAvailable === false || (error !== null && orgSlug.length < 3)}
            />

            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}

            {slugAvailable === false && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                This slug is already taken. Try: {orgSlug}-{Math.floor(Math.random() * 1000)}
              </Alert>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        {activeStep > 0 && (
          <Button onClick={handleBack} color="inherit">
            Back
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Button
          variant="contained"
          onClick={handleNext}
          disabled={
            isSubmitting ||
            (activeStep === 1 &&
            (!orgName.trim() || !orgSlug.trim() || slugAvailable === false || slugChecking))
          }
          startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : null}
        >
          {isSubmitting ? 'Creating...' : activeStep === steps.length - 1 ? 'Create Organization' : 'Next'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
