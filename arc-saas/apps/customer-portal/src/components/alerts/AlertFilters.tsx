import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon, Search, X } from 'lucide-react';
import { format } from 'date-fns';
import type { AlertType, AlertSeverity, AlertStatus, AlertFilters } from '@/types/alert';

interface AlertFiltersProps {
  filters: AlertFilters;
  onChange: (filters: AlertFilters) => void;
}

const alertTypes: { value: AlertType; label: string }[] = [
  { value: 'LIFECYCLE', label: 'Lifecycle' },
  { value: 'RISK', label: 'Risk' },
  { value: 'PRICE', label: 'Price' },
  { value: 'AVAILABILITY', label: 'Availability' },
  { value: 'COMPLIANCE', label: 'Compliance' },
  { value: 'PCN', label: 'PCN' },
  { value: 'SUPPLY_CHAIN', label: 'Supply Chain' },
];

const severityOptions: { value: AlertSeverity; label: string }[] = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
  { value: 'info', label: 'Info' },
];

const statusOptions: { value: AlertStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'read', label: 'Read' },
];

export function AlertFilters({ filters, onChange }: AlertFiltersProps) {
  const handleTypeChange = (value: string) => {
    const currentTypes = filters.types || [];
    const newTypes = value === 'all'
      ? undefined
      : currentTypes.includes(value as AlertType)
      ? currentTypes.filter((t) => t !== value)
      : [...currentTypes, value as AlertType];

    onChange({ ...filters, types: newTypes });
  };

  const handleSeverityChange = (value: string) => {
    const currentSeverities = filters.severities || [];
    const newSeverities = value === 'all'
      ? undefined
      : currentSeverities.includes(value as AlertSeverity)
      ? currentSeverities.filter((s) => s !== value)
      : [...currentSeverities, value as AlertSeverity];

    onChange({ ...filters, severities: newSeverities });
  };

  const handleStatusChange = (value: AlertStatus | 'all') => {
    onChange({ ...filters, status: value === 'all' ? undefined : value });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...filters, search: e.target.value || undefined });
  };

  const handleDateRangeChange = (type: 'from' | 'to', date: Date | undefined) => {
    if (!date) {
      onChange({ ...filters, dateRange: undefined });
      return;
    }

    const currentRange = filters.dateRange;
    const newRange = {
      from: type === 'from' ? date : currentRange?.from || date,
      to: type === 'to' ? date : currentRange?.to || date,
    };

    onChange({ ...filters, dateRange: newRange });
  };

  const clearFilters = () => {
    onChange({
      types: undefined,
      severities: undefined,
      status: undefined,
      search: undefined,
      dateRange: undefined,
    });
  };

  const hasActiveFilters = !!(
    filters.types?.length ||
    filters.severities?.length ||
    filters.status ||
    filters.search ||
    filters.dateRange
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search alerts..."
            value={filters.search || ''}
            onChange={handleSearchChange}
            className="pl-9"
          />
        </div>

        {/* Status Filter */}
        <Select value={filters.status || 'all'} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Severity Filter */}
        <Select value={filters.severities?.[0] || 'all'} onValueChange={handleSeverityChange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            {severityOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Type Filter */}
        <Select value={filters.types?.[0] || 'all'} onValueChange={handleTypeChange}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {alertTypes.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date Range */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[200px] justify-start">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filters.dateRange?.from ? (
                filters.dateRange.to ? (
                  <>
                    {format(filters.dateRange.from, 'MMM dd')} -{' '}
                    {format(filters.dateRange.to, 'MMM dd')}
                  </>
                ) : (
                  format(filters.dateRange.from, 'MMM dd, yyyy')
                )
              ) : (
                <span>Date range</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="p-3 space-y-2">
              <div>
                <p className="text-sm font-medium mb-2">From</p>
                <Calendar
                  mode="single"
                  selected={filters.dateRange?.from}
                  onSelect={(date) => handleDateRangeChange('from', date)}
                />
              </div>
              <div>
                <p className="text-sm font-medium mb-2">To</p>
                <Calendar
                  mode="single"
                  selected={filters.dateRange?.to}
                  onSelect={(date) => handleDateRangeChange('to', date)}
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button variant="ghost" onClick={clearFilters} className="gap-2">
            <X className="h-4 w-4" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
