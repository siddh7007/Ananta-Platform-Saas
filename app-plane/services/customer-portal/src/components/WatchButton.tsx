/**
 * Watch Button Component
 *
 * Toggle button for watching/unwatching a component.
 * Shows watch status and opens type selector on click.
 */

import React, { useState } from 'react';
import {
  Button,
  IconButton,
  Tooltip,
  CircularProgress,
  Popover,
  Box,
} from '@mui/material';
import {
  Visibility as EyeIcon,
  VisibilityOff as EyeOffIcon,
  Notifications as BellIcon,
  NotificationsOff as BellOffIcon,
} from '@mui/icons-material';
import { useNotify } from 'react-admin';
import { WatchTypeSelector } from './WatchTypeSelector';
import {
  useIsWatched,
  useAddWatch,
  useRemoveWatch,
  useUpdateWatchTypes,
  getEnabledWatchTypes,
  WatchType,
} from '../hooks/useComponentWatch';

export interface WatchButtonProps {
  /** Component ID to watch */
  componentId: string;
  /** MPN for display */
  mpn?: string;
  /** Manufacturer for display */
  manufacturer?: string;
  /** Button variant */
  variant?: 'button' | 'icon';
  /** Button size */
  size?: 'small' | 'medium' | 'large';
  /** Show label on button */
  showLabel?: boolean;
  /** Custom label for watched state */
  watchedLabel?: string;
  /** Custom label for unwatched state */
  unwatchedLabel?: string;
  /** Callback when watch state changes */
  onWatchChange?: (isWatched: boolean) => void;
}

export const WatchButton: React.FC<WatchButtonProps> = ({
  componentId,
  mpn,
  manufacturer,
  variant = 'button',
  size = 'medium',
  showLabel = true,
  watchedLabel = 'Watching',
  unwatchedLabel = 'Watch',
  onWatchChange,
}) => {
  const notify = useNotify();
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

  // Hooks
  const { isWatched, watch, loading: checkingWatch } = useIsWatched(componentId);
  const { addWatch, adding } = useAddWatch({
    onSuccess: () => {
      notify(`Now watching ${mpn || 'component'}`, { type: 'success' });
      onWatchChange?.(true);
    },
    onError: (error) => {
      notify(error.message, { type: 'error' });
    },
  });
  const { removeWatch, removing } = useRemoveWatch({
    onSuccess: () => {
      notify(`Stopped watching ${mpn || 'component'}`, { type: 'info' });
      onWatchChange?.(false);
      setAnchorEl(null);
    },
    onError: (error) => {
      notify(error.message, { type: 'error' });
    },
  });
  const { updateWatchTypes, updating } = useUpdateWatchTypes({
    onSuccess: () => {
      notify('Watch preferences updated', { type: 'success' });
    },
    onError: (error) => {
      notify(error.message, { type: 'error' });
    },
  });

  const loading = checkingWatch || adding || removing || updating;
  const popoverOpen = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (isWatched) {
      // If already watching, open selector to edit types
      setAnchorEl(event.currentTarget);
    } else {
      // If not watching, open selector to add watch
      setAnchorEl(event.currentTarget);
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSaveWatchTypes = async (watchTypes: WatchType[]) => {
    if (watchTypes.length === 0) {
      notify('Please select at least one alert type', { type: 'warning' });
      return;
    }

    if (isWatched && watch) {
      // Update existing watch
      await updateWatchTypes(watch.id, componentId, watchTypes);
    } else {
      // Add new watch
      await addWatch(componentId, watchTypes);
    }

    setAnchorEl(null);
  };

  const handleRemoveWatch = async () => {
    if (watch) {
      await removeWatch(watch.id);
    }
  };

  // Get current watch types if watching
  const currentWatchTypes = watch ? getEnabledWatchTypes(watch) : [];

  // Icon variant
  if (variant === 'icon') {
    return (
      <>
        <Tooltip title={isWatched ? 'Edit watch settings' : 'Watch this component'}>
          <span>
            <IconButton
              onClick={handleClick}
              disabled={loading}
              size={size}
              color={isWatched ? 'primary' : 'default'}
            >
              {loading ? (
                <CircularProgress size={size === 'small' ? 16 : 20} />
              ) : isWatched ? (
                <BellIcon />
              ) : (
                <BellOffIcon />
              )}
            </IconButton>
          </span>
        </Tooltip>

        <Popover
          open={popoverOpen}
          anchorEl={anchorEl}
          onClose={handleClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'left',
          }}
        >
          <WatchTypeSelector
            componentId={componentId}
            mpn={mpn}
            manufacturer={manufacturer}
            initialWatchTypes={currentWatchTypes}
            onSave={handleSaveWatchTypes}
            onRemove={isWatched ? handleRemoveWatch : undefined}
            onCancel={handleClose}
          />
        </Popover>
      </>
    );
  }

  // Button variant
  return (
    <>
      <Button
        onClick={handleClick}
        disabled={loading}
        size={size}
        variant={isWatched ? 'contained' : 'outlined'}
        color={isWatched ? 'primary' : 'inherit'}
        startIcon={
          loading ? (
            <CircularProgress size={16} />
          ) : isWatched ? (
            <EyeIcon />
          ) : (
            <EyeOffIcon />
          )
        }
      >
        {showLabel && (isWatched ? watchedLabel : unwatchedLabel)}
      </Button>

      <Popover
        open={popoverOpen}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
      >
        <WatchTypeSelector
          componentId={componentId}
          mpn={mpn}
          manufacturer={manufacturer}
          initialWatchTypes={currentWatchTypes}
          onSave={handleSaveWatchTypes}
          onRemove={isWatched ? handleRemoveWatch : undefined}
          onCancel={handleClose}
        />
      </Popover>
    </>
  );
};
