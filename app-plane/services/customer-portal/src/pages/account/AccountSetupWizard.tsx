/**
 * AccountSetupWizard Component
 *
 * Multi-step onboarding wizard for new users.
 * Replaces the simple OnboardingModal with a comprehensive setup flow.
 *
 * Steps:
 * 1. Welcome - Introduction and overview
 * 2. Organization - Create or join organization
 * 3. Team - Invite team members (optional)
 * 4. Alerts - Configure alert preferences
 * 5. Complete - Summary and next actions
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Stepper,
  Step,
  StepLabel,
  TextField,
  InputAdornment,
  CircularProgress,
  Alert,
  FormControlLabel,
  Switch,
  Chip,
  Grid,
  Card,
  CardContent,
  IconButton,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import BusinessIcon from '@mui/icons-material/Business';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import NotificationsIcon from '@mui/icons-material/Notifications';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import DeleteIcon from '@mui/icons-material/Delete';
import EmailIcon from '@mui/icons-material/Email';

interface TeamMember {
  email: string;
  role: 'engineer' | 'analyst' | 'viewer';
}

interface WizardData {
  // Organization
  orgName: string;
  orgSlug: string;
  // Team
  teamMembers: TeamMember[];
  // Alerts
  alertLifecycle: boolean;
  alertRisk: boolean;
  alertPrice: boolean;
  alertAvailability: boolean;
  emailDigest: boolean;
}

interface AccountSetupWizardProps {
  open: boolean;
  onComplete: (data: WizardData) => Promise<void>;
  userEmail?: string;
  userName?: string;
}

const STEPS = ['Welcome', 'Organization', 'Team', 'Alerts', 'Complete'];

export function AccountSetupWizard({
  open,
  onComplete,
  userEmail,
  userName,
}: AccountSetupWizardProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form data
  const [wizardData, setWizardData] = useState<WizardData>({
    orgName: '',
    orgSlug: '',
    teamMembers: [],
    alertLifecycle: true,
    alertRisk: true,
    alertPrice: true,
    alertAvailability: true,
    emailDigest: true,
  });

  // Slug validation
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [slugChecking, setSlugChecking] = useState(false);

  // Team invite input
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'engineer' | 'analyst' | 'viewer'>('engineer');

  // Helper to normalize slug
  const normalizeSlug = (text: string): string => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };

  // Handle org name change - auto-generate slug
  const handleOrgNameChange = (value: string) => {
    setWizardData(prev => ({
      ...prev,
      orgName: value,
      orgSlug: normalizeSlug(value),
    }));
    setError(null);

    // Mock slug check
    if (value.length >= 3) {
      setSlugChecking(true);
      setTimeout(() => {
        setSlugAvailable(true);
        setSlugChecking(false);
      }, 500);
    }
  };

  // Handle slug change
  const handleSlugChange = (value: string) => {
    const normalized = normalizeSlug(value);
    setWizardData(prev => ({ ...prev, orgSlug: normalized }));
    setError(null);

    if (normalized.length >= 3) {
      setSlugChecking(true);
      setTimeout(() => {
        setSlugAvailable(true);
        setSlugChecking(false);
      }, 500);
    } else {
      setSlugAvailable(null);
    }
  };

  // Add team member
  const handleAddTeamMember = () => {
    if (!inviteEmail.trim()) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    if (wizardData.teamMembers.some(m => m.email === inviteEmail)) {
      setError('This email has already been added');
      return;
    }

    setWizardData(prev => ({
      ...prev,
      teamMembers: [...prev.teamMembers, { email: inviteEmail, role: inviteRole }],
    }));
    setInviteEmail('');
    setError(null);
  };

  // Remove team member
  const handleRemoveTeamMember = (email: string) => {
    setWizardData(prev => ({
      ...prev,
      teamMembers: prev.teamMembers.filter(m => m.email !== email),
    }));
  };

  // Navigation
  const handleNext = async () => {
    setError(null);

    // Validate current step
    if (activeStep === 1) {
      if (!wizardData.orgName.trim() || wizardData.orgName.length < 3) {
        setError('Organization name must be at least 3 characters');
        return;
      }
      if (!wizardData.orgSlug.trim() || wizardData.orgSlug.length < 3) {
        setError('Organization slug must be at least 3 characters');
        return;
      }
      if (slugAvailable === false) {
        setError('This slug is already taken');
        return;
      }
    }

    if (activeStep === STEPS.length - 1) {
      // Final step - submit
      setIsSubmitting(true);
      try {
        await onComplete(wizardData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to complete setup');
        setIsSubmitting(false);
      }
    } else {
      setActiveStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep(prev => prev - 1);
    setError(null);
  };

  const handleSkip = () => {
    setActiveStep(prev => prev + 1);
    setError(null);
  };

  // Step content
  const renderStepContent = () => {
    switch (activeStep) {
      case 0: // Welcome
        return (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <RocketLaunchIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
            <Typography variant="h5" gutterBottom fontWeight={600}>
              Welcome to Components Platform!
            </Typography>
            <Typography variant="body1" paragraph color="text.secondary">
              Hi {userName || userEmail?.split('@')[0]}! Let's get you set up in just a few steps.
            </Typography>
            <Box sx={{ textAlign: 'left', maxWidth: 400, mx: 'auto', mt: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                What you'll set up:
              </Typography>
              <Box component="ul" sx={{ pl: 2, color: 'text.secondary' }}>
                <li>Create your organization workspace</li>
                <li>Invite team members (optional)</li>
                <li>Configure notification preferences</li>
              </Box>
              <Typography variant="body2" sx={{ mt: 2 }} color="text.secondary">
                This takes about 2 minutes. You can always change these settings later.
              </Typography>
            </Box>
          </Box>
        );

      case 1: // Organization
        return (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
              <BusinessIcon color="primary" />
              <Typography variant="h6">Create Your Organization</Typography>
            </Box>

            <TextField
              label="Organization Name"
              value={wizardData.orgName}
              onChange={(e) => handleOrgNameChange(e.target.value)}
              fullWidth
              sx={{ mb: 2 }}
              placeholder="e.g., Acme Electronics"
              autoFocus
              helperText="This is your company or team name"
            />

            <TextField
              label="Organization URL"
              value={wizardData.orgSlug}
              onChange={(e) => handleSlugChange(e.target.value)}
              fullWidth
              sx={{ mb: 2 }}
              placeholder="acme-electronics"
              helperText={`Your URL: ${window.location.origin}/org/${wizardData.orgSlug || '...'}`}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Typography variant="body2" color="text.secondary">/org/</Typography>
                  </InputAdornment>
                ),
                endAdornment: wizardData.orgSlug.length >= 3 && (
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
              error={slugAvailable === false}
            />
          </Box>
        );

      case 2: // Team
        return (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <PersonAddIcon color="primary" />
              <Typography variant="h6">Invite Your Team</Typography>
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Add team members who will work with you. You can always invite more people later.
            </Typography>

            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField
                label="Email Address"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
                size="small"
                sx={{ flex: 1 }}
                onKeyPress={(e) => e.key === 'Enter' && handleAddTeamMember()}
              />
              <Button
                variant="outlined"
                onClick={handleAddTeamMember}
                disabled={!inviteEmail.trim()}
              >
                Add
              </Button>
            </Box>

            {wizardData.teamMembers.length > 0 ? (
              <List dense>
                {wizardData.teamMembers.map((member) => (
                  <ListItem
                    key={member.email}
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      mb: 1,
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
                        <EmailIcon sx={{ fontSize: 16 }} />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={member.email}
                      secondary={`Role: ${member.role}`}
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        size="small"
                        onClick={() => handleRemoveTeamMember(member.email)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            ) : (
              <Box sx={{ textAlign: 'center', py: 3, color: 'text.secondary' }}>
                <Typography variant="body2">
                  No team members added yet
                </Typography>
                <Typography variant="caption">
                  You can skip this step and invite members later
                </Typography>
              </Box>
            )}
          </Box>
        );

      case 3: // Alerts
        return (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <NotificationsIcon color="primary" />
              <Typography variant="h6">Alert Preferences</Typography>
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Choose which notifications you'd like to receive:
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Card variant="outlined">
                  <CardContent sx={{ py: 1.5 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={wizardData.alertLifecycle}
                          onChange={(e) => setWizardData(prev => ({
                            ...prev,
                            alertLifecycle: e.target.checked,
                          }))}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2" fontWeight={500}>
                            Lifecycle Alerts
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            EOL, NRND, obsolescence warnings
                          </Typography>
                        </Box>
                      }
                    />
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Card variant="outlined">
                  <CardContent sx={{ py: 1.5 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={wizardData.alertRisk}
                          onChange={(e) => setWizardData(prev => ({
                            ...prev,
                            alertRisk: e.target.checked,
                          }))}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2" fontWeight={500}>
                            Risk Alerts
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Risk score changes, threshold breaches
                          </Typography>
                        </Box>
                      }
                    />
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Card variant="outlined">
                  <CardContent sx={{ py: 1.5 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={wizardData.alertPrice}
                          onChange={(e) => setWizardData(prev => ({
                            ...prev,
                            alertPrice: e.target.checked,
                          }))}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2" fontWeight={500}>
                            Price Alerts
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Significant price changes
                          </Typography>
                        </Box>
                      }
                    />
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Card variant="outlined">
                  <CardContent sx={{ py: 1.5 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={wizardData.alertAvailability}
                          onChange={(e) => setWizardData(prev => ({
                            ...prev,
                            alertAvailability: e.target.checked,
                          }))}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2" fontWeight={500}>
                            Availability Alerts
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Stock shortages, lead time changes
                          </Typography>
                        </Box>
                      }
                    />
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12}>
                <Card variant="outlined">
                  <CardContent sx={{ py: 1.5 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={wizardData.emailDigest}
                          onChange={(e) => setWizardData(prev => ({
                            ...prev,
                            emailDigest: e.target.checked,
                          }))}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2" fontWeight={500}>
                            Daily Email Digest
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Receive a summary of all alerts once daily
                          </Typography>
                        </Box>
                      }
                    />
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        );

      case 4: // Complete
        return (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
            <Typography variant="h5" gutterBottom fontWeight={600}>
              You're All Set!
            </Typography>
            <Typography variant="body1" paragraph color="text.secondary">
              Your organization "{wizardData.orgName}" is ready to go.
            </Typography>

            <Box sx={{ textAlign: 'left', maxWidth: 400, mx: 'auto', mt: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Next steps:
              </Typography>
              <Box component="ul" sx={{ pl: 2, color: 'text.secondary' }}>
                <li>Upload your first BOM to start enrichment</li>
                <li>Explore the Risk Dashboard to understand your portfolio</li>
                <li>Configure advanced alert settings if needed</li>
              </Box>

              {wizardData.teamMembers.length > 0 && (
                <Alert severity="info" sx={{ mt: 2 }}>
                  {wizardData.teamMembers.length} invitation(s) will be sent when you complete setup.
                </Alert>
              )}
            </Box>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog
      open={open}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown
    >
      <DialogTitle>
        <Stepper activeStep={activeStep} sx={{ pt: 1 }}>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {renderStepContent()}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        {activeStep > 0 && activeStep < STEPS.length - 1 && (
          <Button onClick={handleBack} color="inherit">
            Back
          </Button>
        )}

        {activeStep === 2 && (
          <Button onClick={handleSkip} color="inherit">
            Skip
          </Button>
        )}

        <Box sx={{ flex: 1 }} />

        <Button
          variant="contained"
          onClick={handleNext}
          disabled={
            isSubmitting ||
            (activeStep === 1 && (!wizardData.orgName.trim() || slugChecking || slugAvailable === false))
          }
          startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : null}
        >
          {isSubmitting
            ? 'Setting up...'
            : activeStep === STEPS.length - 1
            ? 'Get Started'
            : 'Continue'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default AccountSetupWizard;
