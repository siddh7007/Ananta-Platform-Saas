/**
 * WatchTypeSelector Component
 * Select which alert types to watch for a component
 */

import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Package,
  Shield,
  FileText,
  Link2,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import type { AlertType } from '@/types/alert';

interface WatchTypeSelectorProps {
  selectedTypes: AlertType[];
  onTypesChange: (types: AlertType[]) => void;
  disabled?: boolean;
  trigger?: React.ReactNode;
}

interface AlertTypeOption {
  type: AlertType;
  label: string;
  description: string;
  icon: React.ElementType;
}

const ALERT_TYPE_OPTIONS: AlertTypeOption[] = [
  {
    type: 'LIFECYCLE',
    label: 'Lifecycle Changes',
    description: 'EOL, NRND, obsolescence notifications',
    icon: AlertTriangle,
  },
  {
    type: 'RISK',
    label: 'Risk Score',
    description: 'Risk threshold exceeded alerts',
    icon: TrendingUp,
  },
  {
    type: 'PRICE',
    label: 'Price Changes',
    description: 'Significant price increases/decreases',
    icon: DollarSign,
  },
  {
    type: 'AVAILABILITY',
    label: 'Stock & Availability',
    description: 'Low stock, lead time changes',
    icon: Package,
  },
  {
    type: 'COMPLIANCE',
    label: 'Compliance',
    description: 'Regulatory and compliance updates',
    icon: Shield,
  },
  {
    type: 'PCN',
    label: 'PCN Notices',
    description: 'Product Change Notifications',
    icon: FileText,
  },
  {
    type: 'SUPPLY_CHAIN',
    label: 'Supply Chain',
    description: 'Supply chain disruptions',
    icon: Link2,
  },
];

export function WatchTypeSelector({
  selectedTypes,
  onTypesChange,
  disabled = false,
  trigger,
}: WatchTypeSelectorProps) {
  const [open, setOpen] = useState(false);
  const [localSelection, setLocalSelection] = useState<AlertType[]>(selectedTypes);

  // Sync local state when prop changes
  useEffect(() => {
    setLocalSelection(selectedTypes);
  }, [selectedTypes]);

  const handleToggleType = (type: AlertType) => {
    setLocalSelection((prev) =>
      prev.includes(type)
        ? prev.filter((t) => t !== type)
        : [...prev, type]
    );
  };

  const handleSelectAll = () => {
    setLocalSelection(ALERT_TYPE_OPTIONS.map((opt) => opt.type));
  };

  const handleSelectNone = () => {
    setLocalSelection([]);
  };

  const handleApply = () => {
    onTypesChange(localSelection);
    setOpen(false);
  };

  const handleCancel = () => {
    setLocalSelection(selectedTypes);
    setOpen(false);
  };

  const selectedCount = localSelection.length;
  const totalCount = ALERT_TYPE_OPTIONS.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        {trigger || (
          <Button variant="outline" size="sm" className="h-8">
            <span>Watch Types</span>
            <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
              {selectedCount}/{totalCount}
            </span>
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="px-4 py-3 border-b">
          <h4 className="font-medium text-sm">Select Alert Types</h4>
          <p className="text-xs text-muted-foreground mt-1">
            Choose which alerts to receive for this component
          </p>
        </div>

        <div className="px-2 py-2 flex gap-2 border-b">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={handleSelectAll}
          >
            Select All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={handleSelectNone}
          >
            Select None
          </Button>
        </div>

        <div className="max-h-[300px] overflow-y-auto py-2">
          {ALERT_TYPE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = localSelection.includes(option.type);

            return (
              <div
                key={option.type}
                className="flex items-start gap-3 px-4 py-2 hover:bg-muted/50 cursor-pointer"
                onClick={() => handleToggleType(option.type)}
              >
                <Checkbox
                  id={`watch-type-${option.type}`}
                  checked={isSelected}
                  onCheckedChange={() => handleToggleType(option.type)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <Label
                      htmlFor={`watch-type-${option.type}`}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {option.label}
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {option.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <Separator />

        <div className="flex justify-end gap-2 px-4 py-3">
          <Button variant="ghost" size="sm" onClick={handleCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleApply}>
            <Check className="h-4 w-4 mr-1" />
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default WatchTypeSelector;
