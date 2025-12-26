/**
 * CommandItem Component
 *
 * Individual result item in the command palette
 * Displays icon, label, keyboard shortcut hints, and optional badge
 */

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

export interface CommandItemData {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Icon component */
  icon?: LucideIcon;
  /** Optional keyboard shortcut hint (e.g., "g b") */
  shortcut?: string;
  /** Badge text (e.g., "New", count) */
  badge?: string | number;
  /** Optional description */
  description?: string;
  /** Callback when item is selected */
  onSelect: () => void;
  /** Category for grouping */
  category?: string;
}

interface CommandItemProps {
  item: CommandItemData;
  isSelected: boolean;
  onClick: () => void;
}

export function CommandItem({ item, isSelected, onClick }: CommandItemProps) {
  const Icon = item.icon;

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
        isSelected
          ? 'bg-primary text-primary-foreground'
          : 'hover:bg-muted text-foreground'
      )}
      aria-selected={isSelected}
    >
      {/* Icon */}
      {Icon && (
        <Icon
          className={cn(
            'h-5 w-5 shrink-0',
            isSelected ? 'text-primary-foreground' : 'text-muted-foreground'
          )}
          aria-hidden="true"
        />
      )}

      {/* Label and description */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <span className="truncate text-sm font-medium">{item.label}</span>
        {item.description && (
          <span
            className={cn(
              'truncate text-xs',
              isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'
            )}
          >
            {item.description}
          </span>
        )}
      </div>

      {/* Badge */}
      {item.badge && (
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
            isSelected
              ? 'bg-primary-foreground/20 text-primary-foreground'
              : 'bg-primary/10 text-primary'
          )}
        >
          {item.badge}
        </span>
      )}

      {/* Keyboard shortcut hint */}
      {item.shortcut && (
        <kbd
          className={cn(
            'ml-auto hidden shrink-0 rounded border px-2 py-1 text-xs font-medium sm:inline-block',
            isSelected
              ? 'border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground'
              : 'border-border bg-muted text-muted-foreground'
          )}
        >
          {item.shortcut}
        </kbd>
      )}
    </button>
  );
}

/**
 * CommandGroup Component
 *
 * Groups command items by category
 */
interface CommandGroupProps {
  heading: string;
  children: ReactNode;
}

export function CommandGroup({ heading, children }: CommandGroupProps) {
  return (
    <div className="overflow-hidden">
      <div className="px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {heading}
        </h3>
      </div>
      <div className="space-y-1 px-2">{children}</div>
    </div>
  );
}

/**
 * CommandEmpty Component
 *
 * Displayed when no results match the search query
 */
interface CommandEmptyProps {
  query: string;
}

export function CommandEmpty({ query }: CommandEmptyProps) {
  return (
    <div className="py-12 text-center">
      <p className="text-sm text-muted-foreground">
        No results found for{' '}
        <span className="font-medium text-foreground">{query}</span>
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Try a different search term
      </p>
    </div>
  );
}
