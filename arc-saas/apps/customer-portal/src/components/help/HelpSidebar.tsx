/**
 * Help Sidebar Component
 * CBP-P2-010: Help Center & Documentation Integration
 *
 * Slide-out sidebar with contextual help articles and search.
 */

import { useState, useEffect, useRef } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search,
  ExternalLink,
  Book,
  HelpCircle,
  FileText,
  Wrench,
  Code,
  Shield,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HelpArticle } from './HelpProvider';

interface HelpSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Import useHelp here to avoid circular dependency
import { useHelp } from './HelpProvider';

const CATEGORY_ICONS: Record<string, typeof Book> = {
  'Getting Started': Book,
  Guides: FileText,
  Features: HelpCircle,
  Reference: Code,
  Troubleshooting: Wrench,
  Administration: Shield,
  Developer: Code,
  Support: HelpCircle,
  Concepts: Book,
};

const CATEGORY_COLORS: Record<string, string> = {
  'Getting Started': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Guides: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Features: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  Reference: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  Troubleshooting: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Administration: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  Developer: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  Support: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  Concepts: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
};

export function HelpSidebar({ open, onOpenChange }: HelpSidebarProps) {
  const { relevantArticles, searchArticles, openArticle, currentPage } = useHelp();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<HelpArticle[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search input when sidebar opens
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    } else {
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [open]);

  // Search as user types
  useEffect(() => {
    if (searchQuery.trim()) {
      const results = searchArticles(searchQuery);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, searchArticles]);

  const displayedArticles = searchQuery ? searchResults : relevantArticles;

  const handleArticleClick = (article: HelpArticle) => {
    openArticle(article.id);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-[400px] sm:w-[450px] p-0"
        aria-label="Help sidebar"
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" aria-hidden="true" />
            Help & Documentation
          </SheetTitle>
        </SheetHeader>

        <div className="p-4 border-b">
          {/* Search Input */}
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              ref={searchInputRef}
              placeholder="Search help articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9"
              aria-label="Search help articles"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Keyboard Shortcut Hint */}
          <p className="text-xs text-muted-foreground mt-2">
            Press <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">?</kbd> to toggle help
          </p>
        </div>

        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="p-4 space-y-4">
            {/* Context Indicator */}
            {!searchQuery && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Showing help for:</span>
                <Badge variant="secondary" className="capitalize">
                  {currentPage.replace(/-/g, ' ')}
                </Badge>
              </div>
            )}

            {/* Search Results Info */}
            {searchQuery && (
              <p className="text-sm text-muted-foreground">
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{searchQuery}"
              </p>
            )}

            {/* Articles List */}
            {displayedArticles.length > 0 ? (
              <div className="space-y-2" role="list" aria-label="Help articles">
                {displayedArticles.map((article) => {
                  const CategoryIcon = CATEGORY_ICONS[article.category] || FileText;
                  const categoryColor = CATEGORY_COLORS[article.category] || CATEGORY_COLORS.Reference;

                  return (
                    <button
                      key={article.id}
                      onClick={() => handleArticleClick(article)}
                      className={cn(
                        'w-full text-left p-3 rounded-lg border',
                        'hover:bg-muted/50 transition-colors',
                        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
                      )}
                      role="listitem"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            'p-1.5 rounded',
                            categoryColor
                          )}
                        >
                          <CategoryIcon className="h-4 w-4" aria-hidden="true" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{article.title}</span>
                            <ExternalLink
                              className="h-3 w-3 text-muted-foreground flex-shrink-0"
                              aria-hidden="true"
                            />
                          </div>
                          {article.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {article.description}
                            </p>
                          )}
                          <Badge
                            variant="outline"
                            className="mt-1.5 text-xs"
                          >
                            {article.category}
                          </Badge>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : searchQuery ? (
              <div className="text-center py-8">
                <Search className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="font-medium">No articles found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Try different keywords or{' '}
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-primary hover:underline"
                  >
                    browse all articles
                  </button>
                </p>
              </div>
            ) : (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="font-medium">No articles available</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Help articles for this section are coming soon.
                </p>
              </div>
            )}

            {/* Quick Links */}
            <div className="pt-4 border-t">
              <h3 className="text-sm font-medium mb-3">Quick Links</h3>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  onClick={() => window.open('/docs', '_blank')}
                >
                  <Book className="h-4 w-4 mr-2" aria-hidden="true" />
                  Documentation
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  onClick={() => window.open('/docs/api', '_blank')}
                >
                  <Code className="h-4 w-4 mr-2" aria-hidden="true" />
                  API Reference
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  onClick={() => window.open('/docs/shortcuts', '_blank')}
                >
                  <FileText className="h-4 w-4 mr-2" aria-hidden="true" />
                  Shortcuts
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  onClick={() => window.open('/support', '_blank')}
                >
                  <HelpCircle className="h-4 w-4 mr-2" aria-hidden="true" />
                  Get Support
                </Button>
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

export default HelpSidebar;
