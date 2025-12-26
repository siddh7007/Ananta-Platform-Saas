/**
 * Range Filter Component
 * CBP-P2-002: Numeric range filtering for parametric search
 */

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

interface RangePreset {
  label: string;
  value: [number, number];
}

interface RangeFilterProps {
  min: number;
  max: number;
  unit: string;
  value?: [number, number];
  onChange: (value: [number, number] | undefined) => void;
  presets?: RangePreset[];
  step?: number;
  className?: string;
}

function formatValue(value: number, unit: string): string {
  if (unit === 'Ω') {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}MΩ`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}kΩ`;
    return `${value}Ω`;
  }
  if (unit === 'µF') {
    if (value >= 1000) return `${(value / 1000).toFixed(1)}mF`;
    if (value < 0.001) return `${(value * 1000000).toFixed(0)}pF`;
    if (value < 1) return `${(value * 1000).toFixed(0)}nF`;
    return `${value}µF`;
  }
  if (unit === 'V') {
    if (value >= 1000) return `${(value / 1000).toFixed(1)}kV`;
    return `${value}V`;
  }
  return `${value}${unit}`;
}

export function RangeFilter({
  min,
  max,
  unit,
  value,
  onChange,
  presets = [],
  step = 1,
  className,
}: RangeFilterProps) {
  const [localMin, setLocalMin] = useState<string>(value ? String(value[0]) : '');
  const [localMax, setLocalMax] = useState<string>(value ? String(value[1]) : '');
  const [activePreset, setActivePreset] = useState<string | null>(null);

  // Sync local state with prop value
  useEffect(() => {
    if (value) {
      setLocalMin(String(value[0]));
      setLocalMax(String(value[1]));
      // Check if value matches a preset
      const matchingPreset = presets.find(
        (p) => p.value[0] === value[0] && p.value[1] === value[1]
      );
      setActivePreset(matchingPreset?.label ?? null);
    } else {
      setLocalMin('');
      setLocalMax('');
      setActivePreset(null);
    }
  }, [value, presets]);

  const handleMinChange = (newMin: string) => {
    setLocalMin(newMin);
    setActivePreset(null);
  };

  const handleMaxChange = (newMax: string) => {
    setLocalMax(newMax);
    setActivePreset(null);
  };

  const handleApply = () => {
    const minVal = parseFloat(localMin);
    const maxVal = parseFloat(localMax);

    if (!isNaN(minVal) && !isNaN(maxVal) && minVal <= maxVal) {
      onChange([minVal, maxVal]);
    }
  };

  const handleClear = () => {
    setLocalMin('');
    setLocalMax('');
    setActivePreset(null);
    onChange(undefined);
  };

  const handlePresetClick = (preset: RangePreset) => {
    if (activePreset === preset.label) {
      // Deselect if already active
      handleClear();
    } else {
      setLocalMin(String(preset.value[0]));
      setLocalMax(String(preset.value[1]));
      setActivePreset(preset.label);
      onChange(preset.value);
    }
  };

  const handleSliderChange = (values: number[]) => {
    if (values.length === 2) {
      setLocalMin(String(values[0]));
      setLocalMax(String(values[1]));
      setActivePreset(null);
      onChange([values[0], values[1]]);
    }
  };

  const sliderValues = [
    value ? value[0] : min,
    value ? value[1] : max,
  ];

  return (
    <div className={cn('space-y-4', className)}>
      {/* Presets */}
      {presets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <Button
              key={preset.label}
              variant={activePreset === preset.label ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePresetClick(preset)}
              aria-pressed={activePreset === preset.label}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      )}

      {/* Slider (only show if range is reasonable) */}
      {max - min <= 1000 && (
        <div className="px-2">
          <Slider
            value={sliderValues}
            min={min}
            max={max}
            step={step}
            onValueChange={handleSliderChange}
            className="w-full"
            aria-label={`Range from ${formatValue(sliderValues[0], unit)} to ${formatValue(sliderValues[1], unit)}`}
          />
          <div className="flex justify-between mt-1 text-xs text-muted-foreground">
            <span>{formatValue(sliderValues[0], unit)}</span>
            <span>{formatValue(sliderValues[1], unit)}</span>
          </div>
        </div>
      )}

      {/* Manual Input */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="range-min" className="text-xs">
            Min ({unit})
          </Label>
          <Input
            id="range-min"
            type="number"
            value={localMin}
            onChange={(e) => handleMinChange(e.target.value)}
            placeholder={String(min)}
            className="h-8 text-sm"
            min={min}
            max={max}
            aria-label={`Minimum ${unit}`}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="range-max" className="text-xs">
            Max ({unit})
          </Label>
          <Input
            id="range-max"
            type="number"
            value={localMax}
            onChange={(e) => handleMaxChange(e.target.value)}
            placeholder={String(max)}
            className="h-8 text-sm"
            min={min}
            max={max}
            aria-label={`Maximum ${unit}`}
          />
        </div>
      </div>

      {/* Apply/Clear Buttons */}
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="flex-1"
          onClick={handleApply}
          disabled={!localMin || !localMax}
        >
          Apply
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          disabled={!value}
        >
          Clear
        </Button>
      </div>
    </div>
  );
}

export default RangeFilter;
