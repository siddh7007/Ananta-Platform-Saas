/**
 * Theme Selector Component
 *
 * Dropdown menu for selecting application theme.
 * Supports 4 themes: Light, Dark, Soft Light (mid-light), Soft Dark (mid-dark)
 * Plus system preference option.
 *
 * Features:
 * - Uses resolvedTheme for icon display (shows actual theme when on "system")
 * - Full keyboard navigation (arrows, escape, enter, tab)
 * - ARIA-compliant listbox pattern
 * - No flash on page load (hydration-safe)
 */

import { useTheme } from 'next-themes';
import { useEffect, useState, useRef, useCallback } from 'react';
import { Sun, Moon, SunMedium, CloudMoon, Monitor, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type ThemeOption = {
  value: string;
  label: string;
  icon: typeof Sun;
  description: string;
};

const THEME_OPTIONS: ThemeOption[] = [
  {
    value: 'light',
    label: 'Light',
    icon: Sun,
    description: 'Bright and clear',
  },
  {
    value: 'dark',
    label: 'Dark',
    icon: Moon,
    description: 'Easy on the eyes',
  },
  {
    value: 'mid-light',
    label: 'Soft Light',
    icon: SunMedium,
    description: 'Reduced contrast',
  },
  {
    value: 'mid-dark',
    label: 'Soft Dark',
    icon: CloudMoon,
    description: 'Gentle darkness',
  },
  {
    value: 'system',
    label: 'System',
    icon: Monitor,
    description: 'Match OS setting',
  },
];

function getThemeIcon(theme: string | undefined) {
  switch (theme) {
    case 'light':
      return Sun;
    case 'dark':
      return Moon;
    case 'mid-light':
      return SunMedium;
    case 'mid-dark':
      return CloudMoon;
    default:
      return Monitor;
  }
}

interface ThemeSelectorProps {
  /** Show as icon-only button (for header) or full dropdown */
  variant?: 'icon' | 'dropdown';
  /** Additional CSS classes */
  className?: string;
}

export function ThemeSelector({ variant = 'icon', className }: ThemeSelectorProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset focus index when menu closes
  useEffect(() => {
    if (!isOpen) {
      setFocusedIndex(-1);
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-theme-selector]')) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Focus management
  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && optionRefs.current[focusedIndex]) {
      optionRefs.current[focusedIndex]?.focus();
    }
  }, [focusedIndex, isOpen]);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => {
      if (!prev) {
        // Opening: focus first item or selected item
        const selectedIndex = THEME_OPTIONS.findIndex((opt) => opt.value === theme);
        setFocusedIndex(selectedIndex >= 0 ? selectedIndex : 0);
      }
      return !prev;
    });
  }, [theme]);

  const handleSelect = useCallback(
    (value: string) => {
      setTheme(value);
      setIsOpen(false);
      buttonRef.current?.focus();
    },
    [setTheme]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          setIsOpen(false);
          buttonRef.current?.focus();
          break;

        case 'ArrowDown':
          event.preventDefault();
          if (!isOpen) {
            handleToggle();
          } else {
            setFocusedIndex((prev) => (prev + 1) % THEME_OPTIONS.length);
          }
          break;

        case 'ArrowUp':
          event.preventDefault();
          if (!isOpen) {
            handleToggle();
          } else {
            setFocusedIndex((prev) => (prev - 1 + THEME_OPTIONS.length) % THEME_OPTIONS.length);
          }
          break;

        case 'Enter':
        case ' ':
          event.preventDefault();
          if (isOpen && focusedIndex >= 0) {
            handleSelect(THEME_OPTIONS[focusedIndex].value);
          } else if (!isOpen) {
            handleToggle();
          }
          break;

        case 'Tab':
          // Allow tab to close menu naturally
          if (isOpen) {
            setIsOpen(false);
          }
          break;

        case 'Home':
          if (isOpen) {
            event.preventDefault();
            setFocusedIndex(0);
          }
          break;

        case 'End':
          if (isOpen) {
            event.preventDefault();
            setFocusedIndex(THEME_OPTIONS.length - 1);
          }
          break;
      }
    },
    [isOpen, focusedIndex, handleToggle, handleSelect]
  );

  if (!mounted) {
    // Return placeholder to prevent hydration mismatch
    return (
      <button
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background',
          className
        )}
        disabled
        aria-label="Loading theme selector"
      >
        <div className="h-4 w-4 animate-pulse rounded bg-muted" />
      </button>
    );
  }

  // Use resolvedTheme for the icon (shows actual theme when on "system")
  // But use theme for selection state (to highlight "System" when selected)
  const DisplayIcon = getThemeIcon(resolvedTheme);
  const currentOption = THEME_OPTIONS.find((opt) => opt.value === theme) || THEME_OPTIONS[4];

  // For the label, show the selected option (e.g., "System") not the resolved one
  const displayLabel = currentOption.label;
  // For aria-label, show both if different
  const ariaLabel =
    theme === 'system' && resolvedTheme
      ? `Theme: System (currently ${resolvedTheme}). Click to change.`
      : `Theme: ${displayLabel}. Click to change.`;

  if (variant === 'dropdown') {
    return (
      <div className={cn('relative', className)} data-theme-selector>
        <button
          ref={buttonRef}
          onClick={handleToggle}
          onKeyDown={handleKeyDown}
          className="flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-label={ariaLabel}
        >
          <div className="flex items-center gap-2">
            <DisplayIcon className="h-4 w-4" />
            <span>{displayLabel}</span>
            {theme === 'system' && resolvedTheme && (
              <span className="text-xs text-muted-foreground">({resolvedTheme})</span>
            )}
          </div>
          <ChevronDown
            className={cn('h-4 w-4 transition-transform duration-200', isOpen && 'rotate-180')}
          />
        </button>

        {isOpen && (
          <div
            ref={menuRef}
            className="absolute right-0 top-full z-50 mt-1 w-52 rounded-md border bg-popover p-1 shadow-lg animate-in fade-in-0 zoom-in-95"
            role="listbox"
            aria-label="Select theme"
            tabIndex={-1}
          >
            {THEME_OPTIONS.map((option, index) => {
              const Icon = option.icon;
              const isSelected = theme === option.value;
              const isFocused = focusedIndex === index;

              return (
                <button
                  key={option.value}
                  ref={(el) => (optionRefs.current[index] = el)}
                  onClick={() => handleSelect(option.value)}
                  onKeyDown={handleKeyDown}
                  onMouseEnter={() => setFocusedIndex(index)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-sm px-2 py-2 text-sm outline-none transition-colors',
                    'hover:bg-accent hover:text-accent-foreground',
                    'focus:bg-accent focus:text-accent-foreground',
                    isSelected && 'bg-accent/50',
                    isFocused && 'bg-accent text-accent-foreground'
                  )}
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={isFocused ? 0 : -1}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{option.label}</span>
                    <span className="text-xs text-muted-foreground">{option.description}</span>
                  </div>
                  {isSelected && (
                    <svg
                      className="ml-auto h-4 w-4 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Icon variant (default)
  return (
    <div className={cn('relative', className)} data-theme-selector>
      <button
        ref={buttonRef}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        className="flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        title={ariaLabel}
      >
        <DisplayIcon className="h-4 w-4" />
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          className="absolute right-0 top-full z-50 mt-1 w-44 rounded-md border bg-popover p-1 shadow-lg animate-in fade-in-0 zoom-in-95"
          role="listbox"
          aria-label="Select theme"
          tabIndex={-1}
        >
          {THEME_OPTIONS.map((option, index) => {
            const Icon = option.icon;
            const isSelected = theme === option.value;
            const isFocused = focusedIndex === index;

            return (
              <button
                key={option.value}
                ref={(el) => (optionRefs.current[index] = el)}
                onClick={() => handleSelect(option.value)}
                onKeyDown={handleKeyDown}
                onMouseEnter={() => setFocusedIndex(index)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors',
                  'hover:bg-accent hover:text-accent-foreground',
                  'focus:bg-accent focus:text-accent-foreground',
                  isSelected && 'bg-accent/50',
                  isFocused && 'bg-accent text-accent-foreground'
                )}
                role="option"
                aria-selected={isSelected}
                tabIndex={isFocused ? 0 : -1}
              >
                <Icon className="h-4 w-4" />
                <span>{option.label}</span>
                {isSelected && (
                  <svg
                    className="ml-auto h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ThemeSelector;
