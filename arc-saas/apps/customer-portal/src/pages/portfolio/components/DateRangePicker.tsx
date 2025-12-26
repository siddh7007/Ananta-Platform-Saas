/**
 * Date Range Picker Component
 * CBP-P2-001: Portfolio Date Filtering
 */

import { useState } from 'react';
import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter, subQuarters } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type DateRangePreset =
  | 'today'
  | 'yesterday'
  | 'last7days'
  | 'last30days'
  | 'last90days'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisQuarter'
  | 'lastQuarter'
  | 'custom';

export interface DateRange {
  from: Date;
  to: Date;
  preset: DateRangePreset;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

const PRESET_LABELS: Record<DateRangePreset, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  last7days: 'Last 7 days',
  last30days: 'Last 30 days',
  last90days: 'Last 90 days',
  thisMonth: 'This month',
  lastMonth: 'Last month',
  thisQuarter: 'This quarter',
  lastQuarter: 'Last quarter',
  custom: 'Custom range',
};

function getPresetRange(preset: DateRangePreset): { from: Date; to: Date } {
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  switch (preset) {
    case 'today':
      return { from: startOfDay, to: today };
    case 'yesterday': {
      const yesterday = subDays(startOfDay, 1);
      const yesterdayEnd = new Date(yesterday);
      yesterdayEnd.setHours(23, 59, 59, 999);
      return { from: yesterday, to: yesterdayEnd };
    }
    case 'last7days':
      return { from: subDays(startOfDay, 7), to: today };
    case 'last30days':
      return { from: subDays(startOfDay, 30), to: today };
    case 'last90days':
      return { from: subDays(startOfDay, 90), to: today };
    case 'thisMonth':
      return { from: startOfMonth(today), to: today };
    case 'lastMonth': {
      const lastMonth = subMonths(today, 1);
      return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
    }
    case 'thisQuarter':
      return { from: startOfQuarter(today), to: today };
    case 'lastQuarter': {
      const lastQuarter = subQuarters(today, 1);
      return { from: startOfQuarter(lastQuarter), to: endOfQuarter(lastQuarter) };
    }
    default:
      return { from: subDays(startOfDay, 30), to: today };
  }
}

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handlePresetChange = (preset: string) => {
    if (preset === 'custom') {
      setIsOpen(true);
      return;
    }
    const range = getPresetRange(preset as DateRangePreset);
    onChange({ ...range, preset: preset as DateRangePreset });
  };

  const handleCalendarSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (range?.from && range?.to) {
      onChange({
        from: range.from,
        to: range.to,
        preset: 'custom',
      });
    } else if (range?.from) {
      // Single date selected, use as both from and to
      onChange({
        from: range.from,
        to: range.from,
        preset: 'custom',
      });
    }
  };

  const formatRange = () => {
    if (value.preset !== 'custom') {
      return PRESET_LABELS[value.preset];
    }
    return `${format(value.from, 'MMM d, yyyy')} - ${format(value.to, 'MMM d, yyyy')}`;
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Select value={value.preset} onValueChange={handlePresetChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select range" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="today">{PRESET_LABELS.today}</SelectItem>
          <SelectItem value="yesterday">{PRESET_LABELS.yesterday}</SelectItem>
          <SelectItem value="last7days">{PRESET_LABELS.last7days}</SelectItem>
          <SelectItem value="last30days">{PRESET_LABELS.last30days}</SelectItem>
          <SelectItem value="last90days">{PRESET_LABELS.last90days}</SelectItem>
          <SelectItem value="thisMonth">{PRESET_LABELS.thisMonth}</SelectItem>
          <SelectItem value="lastMonth">{PRESET_LABELS.lastMonth}</SelectItem>
          <SelectItem value="thisQuarter">{PRESET_LABELS.thisQuarter}</SelectItem>
          <SelectItem value="lastQuarter">{PRESET_LABELS.lastQuarter}</SelectItem>
          <SelectItem value="custom">{PRESET_LABELS.custom}</SelectItem>
        </SelectContent>
      </Select>

      {value.preset === 'custom' && (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'justify-start text-left font-normal',
                !value && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" aria-hidden="true" />
              <span>{formatRange()}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={value.from}
              selected={{ from: value.from, to: value.to }}
              onSelect={handleCalendarSelect}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

export default DateRangePicker;
