/**
 * Status Colors Configuration
 *
 * Color-blind safe palette for status indicators with icons.
 * Each status has both color AND icon to ensure accessibility.
 *
 * Palette Design:
 * - Success: Emerald (blue-green, distinguishable)
 * - Warning: Amber (yellow-orange, high contrast)
 * - Error: Red (universally recognized)
 * - Info: Blue (cool tone)
 * - Pending: Slate (neutral gray)
 * - Processing: Purple (distinct from blue)
 *
 * All colors pass WCAG 4.5:1 contrast requirements
 */

import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Clock,
  Loader2,
  FileText,
  Upload,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

export interface StatusConfig {
  bg: string;
  border: string;
  text: string;
  icon: LucideIcon;
  label: string;
  animate?: boolean;
}

export const STATUS_CONFIG = {
  success: {
    bg: 'bg-emerald-50 dark:bg-emerald-950',
    border: 'border-emerald-200 dark:border-emerald-800',
    text: 'text-emerald-700 dark:text-emerald-300',
    icon: CheckCircle2,
    label: 'Success',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-950',
    border: 'border-amber-200 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-300',
    icon: AlertTriangle,
    label: 'Warning',
  },
  error: {
    bg: 'bg-red-50 dark:bg-red-950',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-700 dark:text-red-300',
    icon: XCircle,
    label: 'Error',
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-950',
    border: 'border-blue-200 dark:border-blue-800',
    text: 'text-blue-700 dark:text-blue-300',
    icon: Info,
    label: 'Information',
  },
  pending: {
    bg: 'bg-slate-50 dark:bg-slate-950',
    border: 'border-slate-200 dark:border-slate-800',
    text: 'text-slate-700 dark:text-slate-300',
    icon: Clock,
    label: 'Pending',
  },
  processing: {
    bg: 'bg-purple-50 dark:bg-purple-950',
    border: 'border-purple-200 dark:border-purple-800',
    text: 'text-purple-700 dark:text-purple-300',
    icon: Loader2,
    label: 'Processing',
    animate: true,
  },
  draft: {
    bg: 'bg-gray-50 dark:bg-gray-950',
    border: 'border-gray-200 dark:border-gray-800',
    text: 'text-gray-700 dark:text-gray-300',
    icon: FileText,
    label: 'Draft',
  },
  uploading: {
    bg: 'bg-cyan-50 dark:bg-cyan-950',
    border: 'border-cyan-200 dark:border-cyan-800',
    text: 'text-cyan-700 dark:text-cyan-300',
    icon: Upload,
    label: 'Uploading',
    animate: true,
  },
  enriching: {
    bg: 'bg-violet-50 dark:bg-violet-950',
    border: 'border-violet-200 dark:border-violet-800',
    text: 'text-violet-700 dark:text-violet-300',
    icon: Sparkles,
    label: 'Enriching',
    animate: true,
  },
  completed: {
    bg: 'bg-emerald-50 dark:bg-emerald-950',
    border: 'border-emerald-200 dark:border-emerald-800',
    text: 'text-emerald-700 dark:text-emerald-300',
    icon: CheckCircle2,
    label: 'Completed',
  },
  partial: {
    bg: 'bg-amber-50 dark:bg-amber-950',
    border: 'border-amber-200 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-300',
    icon: AlertTriangle,
    label: 'Partial',
  },
  failed: {
    bg: 'bg-red-50 dark:bg-red-950',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-700 dark:text-red-300',
    icon: XCircle,
    label: 'Failed',
  },
  cancelled: {
    bg: 'bg-gray-50 dark:bg-gray-950',
    border: 'border-gray-200 dark:border-gray-800',
    text: 'text-gray-500 dark:text-gray-400',
    icon: XCircle,
    label: 'Cancelled',
  },
} as const satisfies Record<string, StatusConfig>;

export type StatusType = keyof typeof STATUS_CONFIG;
