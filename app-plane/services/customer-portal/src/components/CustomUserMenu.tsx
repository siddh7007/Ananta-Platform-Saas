/**
 * Custom UserMenu Component
 *
 * Enhanced user menu with personal settings:
 * - My Profile (avatar, name, email, bio)
 * - Account Settings (password, 2FA, API keys)
 * - Notifications
 * - Theme selection
 * - Logout
 *
 * Only shows user-level settings accessible to all users.
 * Organization-level settings are in the sidebar (admin only).
 */

import React, { useState } from 'react';
import { UserMenu, useLogout, useGetIdentity } from 'react-admin';
import { useNavigate } from 'react-router-dom';
import { getAuthHeaders } from '../services/cnsApi';
import {
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Avatar,
  Box,
  Typography,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import SettingsIcon from '@mui/icons-material/Settings';
import NotificationsIcon from '@mui/icons-material/Notifications';
import PaletteIcon from '@mui/icons-material/Palette';
import LogoutIcon from '@mui/icons-material/Logout';

export const CustomUserMenu: React.FC = () => {
  const navigate = useNavigate();
  const logout = useLogout();
  const { identity, isLoading } = useGetIdentity();

  const handleProfile = () => {
    navigate('/profile');
  };

  const handleAccountSettings = () => {
    navigate('/account/settings');
  };

  const handleNotifications = () => {
    navigate('/notifications');
  };

  const handleTheme = () => {
    navigate('/theme');
  };

  const handleLogout = async () => {
    // Publish logout event for audit trail
    try {
      const middlewareApiUrl = import.meta.env.VITE_MIDDLEWARE_API_URL || 'http://localhost:27700';
      const authHeaders = await getAuthHeaders();
      await fetch(`${middlewareApiUrl}/auth/logout`, {
        method: 'POST',
        headers: authHeaders,
      });
    } catch (err) {
      console.warn('[CustomUserMenu] Failed to publish logout event:', err);
    }
    // Proceed with logout
    logout();
  };

  if (isLoading) return null;

  return (
    <UserMenu
      icon={
        <Avatar
          sx={{
            width: 32,
            height: 32,
            bgcolor: 'secondary.main',
          }}
        >
          {identity?.fullName?.charAt(0)?.toUpperCase() || identity?.email?.charAt(0)?.toUpperCase() || 'U'}
        </Avatar>
      }
    >
      {/* User Info Header */}
      <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="subtitle2" fontWeight={600}>
          {identity?.fullName || 'User'}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {identity?.email || ''}
        </Typography>
      </Box>

      {/* Personal Settings Menu Items */}
      <MenuItem onClick={handleProfile}>
        <ListItemIcon>
          <PersonIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>My Profile</ListItemText>
      </MenuItem>

      <MenuItem onClick={handleAccountSettings}>
        <ListItemIcon>
          <SettingsIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>Account Settings</ListItemText>
      </MenuItem>

      <MenuItem onClick={handleNotifications}>
        <ListItemIcon>
          <NotificationsIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>Notifications</ListItemText>
      </MenuItem>

      <MenuItem onClick={handleTheme}>
        <ListItemIcon>
          <PaletteIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>Theme</ListItemText>
      </MenuItem>

      <Divider sx={{ my: 1 }} />

      <MenuItem onClick={handleLogout}>
        <ListItemIcon>
          <LogoutIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>Logout</ListItemText>
      </MenuItem>
    </UserMenu>
  );
};
