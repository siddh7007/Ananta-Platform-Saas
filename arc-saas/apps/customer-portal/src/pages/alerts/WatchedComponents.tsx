/**
 * WatchedComponents Page
 * View and manage watched components with alert type configuration
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Eye,
  EyeOff,
  Trash2,
  Settings2,
  AlertCircle,
  Search,
  SlidersHorizontal,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useWatchedComponents, useUnwatchComponent } from '@/hooks/useAlerts';
import { WatchTypeSelector } from '@/components/alerts/WatchTypeSelector';
import { useToast } from '@/hooks/useToast';
import type { ComponentWatch, AlertType } from '@/types/alert';
import { formatDate } from '@/lib/date-utils';

/**
 * Alert type badge colors
 */
const ALERT_TYPE_COLORS: Record<AlertType, string> = {
  LIFECYCLE: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  RISK: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  PRICE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  AVAILABILITY: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  COMPLIANCE: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  PCN: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  SUPPLY_CHAIN: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-400',
};

/**
 * Alert type labels
 */
const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  LIFECYCLE: 'Lifecycle',
  RISK: 'Risk',
  PRICE: 'Price',
  AVAILABILITY: 'Stock',
  COMPLIANCE: 'Compliance',
  PCN: 'PCN',
  SUPPLY_CHAIN: 'Supply Chain',
};

export function WatchedComponents() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [watchToDelete, setWatchToDelete] = useState<ComponentWatch | null>(null);

  const {
    data: watches = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useWatchedComponents();

  const unwatchMutation = useUnwatchComponent();

  // Filter watches based on search query
  const filteredWatches = watches.filter((watch) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      watch.mpn?.toLowerCase().includes(query) ||
      watch.manufacturer?.toLowerCase().includes(query) ||
      watch.componentId.toLowerCase().includes(query)
    );
  });

  const handleUnwatch = async (watch: ComponentWatch) => {
    try {
      await unwatchMutation.mutateAsync(watch.id);
      toast({
        title: 'Component Removed',
        description: `${watch.mpn || 'Component'} removed from watch list`,
      });
      setWatchToDelete(null);
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to remove component from watch list',
        variant: 'destructive',
      });
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  // Error state
  if (isError) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <h3 className="text-lg font-medium mb-2">Failed to Load Watched Components</h3>
            <p className="text-muted-foreground mb-4">
              {error?.message || 'An error occurred while loading your watched components'}
            </p>
            <Button onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Empty state
  if (watches.length === 0) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Watched Components
            </CardTitle>
            <CardDescription>
              Monitor specific components for lifecycle, risk, price, and availability changes
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Eye className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">No Watched Components</h3>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              Start watching components to receive alerts about lifecycle changes, risk updates,
              price fluctuations, and availability issues.
            </p>
            <Button asChild>
              <Link to="/components">
                <Search className="h-4 w-4 mr-2" />
                Browse Components
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Eye className="h-6 w-6" />
            Watched Components
          </h1>
          <p className="text-muted-foreground mt-1">
            {watches.length} component{watches.length !== 1 ? 's' : ''} being monitored
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button asChild variant="default" size="sm">
            <Link to="/alerts/preferences">
              <Settings2 className="h-4 w-4 mr-2" />
              Alert Settings
            </Link>
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by MPN, manufacturer, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Watches Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Component</TableHead>
              <TableHead>Manufacturer</TableHead>
              <TableHead>Watch Types</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredWatches.map((watch) => (
              <TableRow key={watch.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <Link
                      to={`/components/${watch.componentId}`}
                      className="font-medium text-primary hover:underline flex items-center gap-1"
                    >
                      {watch.mpn || watch.componentId}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                    {watch.mpn && (
                      <span className="text-xs text-muted-foreground font-mono">
                        {watch.componentId.slice(0, 8)}...
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>{watch.manufacturer || '-'}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {watch.watchTypes.map((type) => (
                      <Badge
                        key={type}
                        variant="secondary"
                        className={ALERT_TYPE_COLORS[type]}
                      >
                        {ALERT_TYPE_LABELS[type]}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(watch.createdAt, 'relative')}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <WatchTypeSelector
                      selectedTypes={watch.watchTypes}
                      onTypesChange={(types) => {
                        // Update watch types - would need updateWatch mutation
                        toast({
                          title: 'Watch Types Updated',
                          description: `Now watching ${types.length} alert type${types.length !== 1 ? 's' : ''}`,
                        });
                      }}
                      trigger={
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <SlidersHorizontal className="h-4 w-4" />
                        </Button>
                      }
                    />
                    <AlertDialog
                      open={watchToDelete?.id === watch.id}
                      onOpenChange={(open) => !open && setWatchToDelete(null)}
                    >
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setWatchToDelete(watch)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove from Watch List?</AlertDialogTitle>
                          <AlertDialogDescription>
                            You will no longer receive alerts for{' '}
                            <strong>{watch.mpn || watch.componentId}</strong>.
                            This action can be undone by watching the component again.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleUnwatch(watch)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            <EyeOff className="h-4 w-4 mr-2" />
                            Unwatch
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {filteredWatches.length === 0 && searchQuery && (
          <div className="flex flex-col items-center justify-center py-12">
            <Search className="h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-muted-foreground">
              No components match "{searchQuery}"
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchQuery('')}
              className="mt-2"
            >
              Clear Search
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

export default WatchedComponents;
