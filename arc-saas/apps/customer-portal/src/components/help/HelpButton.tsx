/**
 * Help Button Component
 * CBP-P2-010: Help Center & Documentation Integration
 *
 * Button component for accessing contextual help,
 * available in both icon-only and inline modes.
 */

import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useHelp } from './HelpProvider';
import type { HelpArticle } from './HelpProvider';

interface HelpButtonProps {
  /**
   * Filter articles by topic/category
   */
  topic?: string;
  /**
   * Show as inline help (smaller, embedded)
   */
  inline?: boolean;
  /**
   * Additional CSS classes
   */
  className?: string;
  /**
   * Specific articles to show (overrides context-based)
   */
  articles?: HelpArticle[];
}

export function HelpButton({ topic, inline, className, articles }: HelpButtonProps) {
  const { relevantArticles, openArticle, openHelp } = useHelp();

  // Determine which articles to show
  const displayArticles = articles
    ? articles
    : topic
    ? relevantArticles.filter(
        (a) =>
          a.category.toLowerCase() === topic.toLowerCase() ||
          a.id.toLowerCase().includes(topic.toLowerCase()) ||
          a.keywords?.some((k) => k.toLowerCase().includes(topic.toLowerCase()))
      )
    : relevantArticles;

  // Inline mode - small button with popover
  if (inline) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex items-center justify-center',
              'h-4 w-4 rounded-full',
              'bg-muted hover:bg-muted/80 transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
              className
            )}
            aria-label="Show help"
          >
            <HelpCircle className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3" align="start">
          {displayArticles.length > 0 ? (
            <>
              <p className="text-sm font-medium mb-2">Related Help</p>
              <div className="space-y-1">
                {displayArticles.slice(0, 3).map((article) => (
                  <button
                    key={article.id}
                    onClick={() => openArticle(article.id)}
                    className={cn(
                      'w-full text-left text-sm p-2 rounded',
                      'hover:bg-muted transition-colors',
                      'focus:outline-none focus:ring-2 focus:ring-ring'
                    )}
                  >
                    <span className="block font-medium">{article.title}</span>
                    {article.description && (
                      <span className="block text-xs text-muted-foreground line-clamp-1">
                        {article.description}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {displayArticles.length > 3 && (
                <button
                  onClick={openHelp}
                  className="w-full text-center text-xs text-primary hover:underline mt-2"
                >
                  View all {displayArticles.length} articles
                </button>
              )}
            </>
          ) : (
            <div className="text-center py-2">
              <p className="text-sm text-muted-foreground">No specific help available</p>
              <button
                onClick={openHelp}
                className="text-xs text-primary hover:underline mt-1"
              >
                Open Help Center
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    );
  }

  // Standard mode - icon button
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={openHelp}
      className={className}
      aria-label="Open help"
    >
      <HelpCircle className="h-5 w-5" aria-hidden="true" />
    </Button>
  );
}

/**
 * Help Button with badge showing number of relevant articles
 */
export function HelpButtonWithBadge({ className }: { className?: string }) {
  const { relevantArticles, openHelp } = useHelp();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={openHelp}
      className={cn('relative', className)}
      aria-label={`Open help (${relevantArticles.length} articles)`}
    >
      <HelpCircle className="h-5 w-5" aria-hidden="true" />
      {relevantArticles.length > 0 && (
        <Badge
          variant="secondary"
          className="absolute -top-1 -right-1 h-4 min-w-[16px] p-0 flex items-center justify-center text-[10px]"
        >
          {relevantArticles.length}
        </Badge>
      )}
    </Button>
  );
}

export default HelpButton;
