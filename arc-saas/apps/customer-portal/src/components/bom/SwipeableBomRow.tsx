import { useState, useRef, useEffect, ReactNode } from 'react';
import { Share2, Edit2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import type { Bom } from '@/types/bom';

const ACTION_BUTTON_WIDTH = 80; // Width of each action button in pixels
const TOTAL_ACTIONS_WIDTH = ACTION_BUTTON_WIDTH * 3; // 3 buttons
const SWIPE_THRESHOLD = 60; // Minimum swipe distance to reveal actions
const SNAP_THRESHOLD = TOTAL_ACTIONS_WIDTH / 2; // Point at which to snap open/closed

export interface SwipeableBomRowProps {
  /** BOM data */
  bom: Bom;
  /** Content to display in the row */
  children: ReactNode;
  /** Callback when share action is triggered */
  onShare?: (bom: Bom) => void;
  /** Callback when edit action is triggered */
  onEdit?: (bom: Bom) => void;
  /** Callback when delete action is triggered */
  onDelete?: (bom: Bom) => void;
  /** Whether to show the share button */
  showShare?: boolean;
  /** Whether to show the edit button */
  showEdit?: boolean;
  /** Whether to show the delete button */
  showDelete?: boolean;
  /** Additional CSS classes for the wrapper */
  className?: string;
  /** Whether actions are disabled */
  disabled?: boolean;
}

/**
 * SwipeableBomRow - A touch-friendly row component with swipe-to-reveal actions.
 *
 * Features:
 * - Swipe left to reveal action buttons (Share, Edit, Delete)
 * - Swipe right to hide actions
 * - Smooth animations with snap-to-state behavior
 * - Touch-optimized with proper thresholds
 * - Accessible alternatives via context menu
 *
 * @example
 * ```tsx
 * <SwipeableBomRow
 *   bom={bomData}
 *   onEdit={(bom) => navigate(`/boms/${bom.id}/edit`)}
 *   onDelete={(bom) => handleDelete(bom.id)}
 *   onShare={(bom) => handleShare(bom.id)}
 * >
 *   <div>BOM content here</div>
 * </SwipeableBomRow>
 * ```
 */
export function SwipeableBomRow({
  bom,
  children,
  onShare,
  onEdit,
  onDelete,
  showShare = true,
  showEdit = true,
  showDelete = true,
  className,
  disabled = false,
}: SwipeableBomRowProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);

  // Handle action execution - closes the actions after action is taken
  const handleAction = (action?: (bom: Bom) => void) => {
    if (!action || disabled) return;

    action(bom);
    // Smoothly close after action
    setIsRevealed(false);
    setTranslateX(0);
  };

  // Swipe gesture handling
  const { handlers } = useSwipeGesture({
    threshold: SWIPE_THRESHOLD,
    onSwipeLeft: () => {
      if (!disabled) {
        setIsRevealed(true);
        setTranslateX(-TOTAL_ACTIONS_WIDTH);
      }
    },
    onSwipeRight: () => {
      setIsRevealed(false);
      setTranslateX(0);
    },
    preventDefault: false, // Allow native scrolling
  });

  // Mouse/Touch drag handling for precise control
  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled) return;

    setIsDragging(true);
    startXRef.current = e.clientX - translateX;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || disabled) return;

    const currentX = e.clientX - startXRef.current;
    // Constrain movement: 0 (closed) to -TOTAL_ACTIONS_WIDTH (fully open)
    const constrainedX = Math.max(-TOTAL_ACTIONS_WIDTH, Math.min(0, currentX));
    setTranslateX(constrainedX);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging || disabled) return;

    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);

    // Snap to open or closed based on threshold
    if (translateX < -SNAP_THRESHOLD) {
      setIsRevealed(true);
      setTranslateX(-TOTAL_ACTIONS_WIDTH);
    } else {
      setIsRevealed(false);
      setTranslateX(0);
    }
  };

  // Close actions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isRevealed &&
        contentRef.current &&
        !contentRef.current.contains(e.target as Node)
      ) {
        setIsRevealed(false);
        setTranslateX(0);
      }
    };

    if (isRevealed) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isRevealed]);

  // Calculate button visibility
  const visibleButtons = [
    showShare && onShare,
    showEdit && onEdit,
    showDelete && onDelete,
  ].filter(Boolean).length;

  const actualActionsWidth = visibleButtons * ACTION_BUTTON_WIDTH;

  return (
    <div
      className={cn(
        'relative overflow-hidden bg-background',
        className
      )}
      role="group"
      aria-label={`Swipeable row for ${bom.name}`}
    >
      {/* Action Buttons (behind content) */}
      <div
        className="absolute right-0 top-0 bottom-0 flex items-stretch"
        style={{ width: `${actualActionsWidth}px` }}
        aria-hidden={!isRevealed}
      >
        {showShare && onShare && (
          <button
            onClick={() => handleAction(onShare)}
            disabled={disabled}
            className={cn(
              'flex flex-col items-center justify-center gap-1 text-white transition-colors',
              'bg-blue-600 hover:bg-blue-700 active:bg-blue-800',
              'disabled:bg-gray-400 disabled:cursor-not-allowed',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset'
            )}
            style={{ width: `${ACTION_BUTTON_WIDTH}px` }}
            aria-label={`Share ${bom.name}`}
          >
            <Share2 className="h-5 w-5" aria-hidden="true" />
            <span className="text-xs font-medium">Share</span>
          </button>
        )}

        {showEdit && onEdit && (
          <button
            onClick={() => handleAction(onEdit)}
            disabled={disabled}
            className={cn(
              'flex flex-col items-center justify-center gap-1 text-white transition-colors',
              'bg-amber-600 hover:bg-amber-700 active:bg-amber-800',
              'disabled:bg-gray-400 disabled:cursor-not-allowed',
              'focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-inset'
            )}
            style={{ width: `${ACTION_BUTTON_WIDTH}px` }}
            aria-label={`Edit ${bom.name}`}
          >
            <Edit2 className="h-5 w-5" aria-hidden="true" />
            <span className="text-xs font-medium">Edit</span>
          </button>
        )}

        {showDelete && onDelete && (
          <button
            onClick={() => handleAction(onDelete)}
            disabled={disabled}
            className={cn(
              'flex flex-col items-center justify-center gap-1 text-white transition-colors',
              'bg-red-600 hover:bg-red-700 active:bg-red-800',
              'disabled:bg-gray-400 disabled:cursor-not-allowed',
              'focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-inset'
            )}
            style={{ width: `${ACTION_BUTTON_WIDTH}px` }}
            aria-label={`Delete ${bom.name}`}
          >
            <Trash2 className="h-5 w-5" aria-hidden="true" />
            <span className="text-xs font-medium">Delete</span>
          </button>
        )}
      </div>

      {/* Main Content (slides left to reveal actions) */}
      <div
        ref={contentRef}
        className={cn(
          'relative bg-background',
          !isDragging && 'transition-transform duration-200 ease-out',
          disabled && 'opacity-60 pointer-events-none'
        )}
        style={{
          transform: `translateX(${translateX}px)`,
          touchAction: 'pan-y', // Allow vertical scrolling
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        {...handlers}
      >
        {children}
      </div>

      {/* Visual indicator for swipe availability (optional) */}
      {!isRevealed && !disabled && (
        <div
          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/30 pointer-events-none"
          aria-hidden="true"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            className="animate-pulse"
          >
            <path
              d="M7 3L13 10L7 17"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              transform="rotate(180 10 10)"
            />
          </svg>
        </div>
      )}
    </div>
  );
}

export default SwipeableBomRow;
