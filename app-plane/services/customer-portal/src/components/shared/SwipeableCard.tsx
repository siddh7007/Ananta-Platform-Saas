import React, { useRef, useEffect } from 'react';
import { Card, CardContent, Box, IconButton, Tooltip } from '@mui/material';
import { useSwipeActions, SwipeActionsConfig } from '../../hooks/useSwipeActions';

export interface SwipeableCardProps {
  children: React.ReactNode;
  swipeConfig: SwipeActionsConfig;
  onClick?: () => void;
  className?: string;
  elevation?: number;
}

/**
 * SwipeableCard - Card with swipe gesture support
 *
 * Swipe left: Show left actions (e.g., delete)
 * Swipe right: Show right actions (e.g., archive, mark as read)
 *
 * @example
 * <SwipeableCard
 *   swipeConfig={{
 *     leftActions: [{ label: 'Delete', icon: <DeleteIcon />, onAction: handleDelete }],
 *     rightActions: [{ label: 'Archive', icon: <ArchiveIcon />, onAction: handleArchive }],
 *   }}
 * >
 *   <BOMCardContent data={bom} />
 * </SwipeableCard>
 */
export const SwipeableCard: React.FC<SwipeableCardProps> = ({
  children,
  swipeConfig,
  onClick,
  className = '',
  elevation = 1,
}) => {
  const { swipeState, handlers, reset, executeAction } = useSwipeActions(swipeConfig);
  const cardRef = useRef<HTMLDivElement>(null);

  // Auto-reset after action is snapped
  useEffect(() => {
    if (swipeState.isSnapped) {
      const timer = setTimeout(() => {
        executeAction(swipeState.direction);
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [swipeState.isSnapped, swipeState.direction, executeAction]);

  const handleCardClick = () => {
    if (swipeState.isSnapped) {
      reset();
    } else if (onClick) {
      onClick();
    }
  };

  const renderActions = (
    actions: SwipeActionsConfig['leftActions'],
    side: 'left' | 'right'
  ) => {
    if (!actions || actions.length === 0) return null;

    return (
      <Box
        className={`swipe-actions swipe-actions-${side}`}
        sx={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          [side]: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          bgcolor: side === 'left' ? 'error.light' : 'success.light',
          color: 'white',
          opacity: swipeState.isSnapped ? 1 : 0,
          transition: 'opacity 0.2s',
        }}
      >
        {actions.map((action, idx) => (
          <Tooltip key={idx} title={action.label}>
            <IconButton
              size="small"
              onClick={() => {
                action.onAction();
                reset();
              }}
              sx={{
                color: 'white',
                bgcolor: action.color || 'rgba(255, 255, 255, 0.2)',
                '&:hover': {
                  bgcolor: action.color || 'rgba(255, 255, 255, 0.3)',
                },
                minWidth: '48px',
                minHeight: '48px',
              }}
            >
              {action.icon}
            </IconButton>
          </Tooltip>
        ))}
      </Box>
    );
  };

  return (
    <Box
      ref={cardRef}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        touchAction: 'pan-y', // Allow vertical scrolling
      }}
      className={className}
    >
      {/* Left actions (appear when swiping left) */}
      {renderActions(swipeConfig.leftActions, 'left')}

      {/* Right actions (appear when swiping right) */}
      {renderActions(swipeConfig.rightActions, 'right')}

      {/* Main card content */}
      <Card
        {...handlers}
        onClick={handleCardClick}
        elevation={swipeState.isSwiping ? 4 : elevation}
        className={`swipeable-card ${swipeState.isSwiping ? 'swiping' : ''} ${
          swipeState.direction === 'left' ? 'swiped-left' : ''
        } ${swipeState.direction === 'right' ? 'swiped-right' : ''}`}
        sx={{
          transform: `translateX(${swipeState.offset}px)`,
          transition: swipeState.isSwiping ? 'none' : 'transform 0.2s ease-out',
          cursor: onClick ? 'pointer' : 'default',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
      >
        <CardContent>{children}</CardContent>
      </Card>
    </Box>
  );
};

export default SwipeableCard;
