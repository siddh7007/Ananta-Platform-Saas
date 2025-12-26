/**
 * Collapsible Sidebar
 * CBP-P1-006: Collapsible Sidebar Navigation
 */

import { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/contexts/SidebarContext';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface SidebarProps {
  children: ReactNode;
  className?: string;
}

export function Sidebar({ children, className }: SidebarProps) {
  const { isCollapsed, toggle } = useSidebar();

  return (
    <aside
      id="main-navigation"
      className={cn(
        'flex flex-col border-r bg-card transition-all duration-300',
        isCollapsed ? 'w-16' : 'w-64',
        className
      )}
      aria-label="Main navigation"
    >
      <div className="flex-1 overflow-y-auto py-4">
        {children}
      </div>

      <div className="border-t p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggle}
          className="w-full justify-center"
          aria-expanded={!isCollapsed ? 'true' : 'false'}
          aria-controls="main-navigation"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4 mr-2" />
              <span>Collapse</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}

interface SidebarItemProps {
  icon: ReactNode;
  label: string;
  href?: string;
  onClick?: () => void;
  isActive?: boolean;
  disabled?: boolean;
}

export function SidebarItem({
  icon,
  label,
  href = '#',
  onClick,
  isActive,
  disabled,
}: SidebarItemProps) {
  const { isCollapsed } = useSidebar();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (disabled) {
      e.preventDefault();
      return;
    }
    if (onClick) {
      e.preventDefault();
      onClick();
    }
  };

  const content = (
    <a
      href={href}
      onClick={handleClick}
      className={cn(
        'flex items-center gap-3 px-3 py-2 mx-2 rounded-md transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        isActive && 'bg-accent text-accent-foreground',
        disabled && 'opacity-50 pointer-events-none cursor-not-allowed',
        isCollapsed && 'justify-center px-2'
      )}
      aria-current={isActive ? 'page' : undefined}
      aria-disabled={disabled ? 'true' : undefined}
      tabIndex={disabled ? -1 : undefined}
    >
      <span className="flex-shrink-0" aria-hidden="true">{icon}</span>
      {!isCollapsed && <span className="truncate">{label}</span>}
    </a>
  );

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

interface SidebarGroupProps {
  title?: string;
  children: ReactNode;
}

export function SidebarGroup({ title, children }: SidebarGroupProps) {
  const { isCollapsed } = useSidebar();

  return (
    <div className="mb-4" role="group" aria-label={title}>
      {title && !isCollapsed && (
        <h3 className="px-4 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {title}
        </h3>
      )}
      <div>{children}</div>
    </div>
  );
}
