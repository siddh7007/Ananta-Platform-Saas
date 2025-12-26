/**
 * Empty Compare State Component
 * CBP-P2-006: Guidance when no components are selected for comparison
 */

import { ArrowLeftRight, Plus, Search, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ComponentSelector } from './ComponentSelector';

interface EmptyCompareStateProps {
  onAddComponent: (id: string) => void;
}

export function EmptyCompareState({ onAddComponent }: EmptyCompareStateProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <ArrowLeftRight className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        </div>

        <h2 className="text-xl font-semibold mb-2">
          Start Comparing Components
        </h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          Compare specifications, pricing, and availability across multiple components
          to make informed sourcing decisions.
        </p>

        <ComponentSelector
          excludeIds={[]}
          onSelect={onAddComponent}
          trigger={
            <Button size="lg">
              <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
              Add First Component
            </Button>
          }
        />

        {/* Feature highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-10 w-full max-w-2xl">
          <div className="flex flex-col items-center p-4">
            <div className="rounded-full bg-blue-100 dark:bg-blue-900/30 p-2 mb-2">
              <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="font-medium text-sm">Up to 4 Components</h3>
            <p className="text-xs text-muted-foreground text-center mt-1">
              Compare multiple alternatives side by side
            </p>
          </div>

          <div className="flex flex-col items-center p-4">
            <div className="rounded-full bg-amber-100 dark:bg-amber-900/30 p-2 mb-2">
              <ArrowLeftRight className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="font-medium text-sm">Highlight Differences</h3>
            <p className="text-xs text-muted-foreground text-center mt-1">
              Quickly spot variations in specifications
            </p>
          </div>

          <div className="flex flex-col items-center p-4">
            <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-2 mb-2">
              <Search className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="font-medium text-sm">Shareable Links</h3>
            <p className="text-xs text-muted-foreground text-center mt-1">
              Share comparisons with your team
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default EmptyCompareState;
