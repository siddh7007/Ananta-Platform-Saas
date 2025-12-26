import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OptionsConfigStepProps {
  bomName: string;
  bomDescription: string;
  autoEnrich: boolean;
  enrichmentLevel: 'basic' | 'standard' | 'comprehensive';
  onBomNameChange: (name: string) => void;
  onBomDescriptionChange: (description: string) => void;
  onAutoEnrichChange: (autoEnrich: boolean) => void;
  onEnrichmentLevelChange: (level: 'basic' | 'standard' | 'comprehensive') => void;
  onBack: () => void;
  onNext: () => void;
}

const enrichmentLevelOptions = [
  {
    value: 'basic' as const,
    label: 'Basic',
    desc: 'Component matching and basic specs',
  },
  {
    value: 'standard' as const,
    label: 'Standard',
    desc: 'Includes lifecycle status and pricing',
  },
  {
    value: 'comprehensive' as const,
    label: 'Comprehensive',
    desc: 'Full data including alternates and risk analysis',
  },
];

export function OptionsConfigStep({
  bomName,
  bomDescription,
  autoEnrich,
  enrichmentLevel,
  onBomNameChange,
  onBomDescriptionChange,
  onAutoEnrichChange,
  onEnrichmentLevelChange,
  onBack,
  onNext,
}: OptionsConfigStepProps) {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Enrichment Options</h2>
      </div>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">
            BOM Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={bomName}
            onChange={(e) => onBomNameChange(e.target.value)}
            placeholder="Enter BOM name"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Description</label>
          <textarea
            value={bomDescription}
            onChange={(e) => onBomDescriptionChange(e.target.value)}
            placeholder="Optional description for this BOM"
            rows={3}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>

        <div className="rounded-lg border p-4">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="autoEnrich"
              checked={autoEnrich}
              onChange={(e) => onAutoEnrichChange(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300"
            />
            <label htmlFor="autoEnrich" className="flex-1">
              <span className="font-medium">Auto-enrich components</span>
              <p className="text-sm text-muted-foreground">
                Automatically match components and fetch data after upload
              </p>
            </label>
          </div>

          {autoEnrich && (
            <div className="mt-4 space-y-2 border-t pt-4">
              <label className="text-sm font-medium">Enrichment Level</label>
              <div className="grid gap-2">
                {enrichmentLevelOptions.map((opt) => (
                  <label
                    key={opt.value}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors',
                      enrichmentLevel === opt.value
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-muted/50'
                    )}
                  >
                    <input
                      type="radio"
                      name="enrichmentLevel"
                      value={opt.value}
                      checked={enrichmentLevel === opt.value}
                      onChange={(e) =>
                        onEnrichmentLevelChange(
                          e.target.value as 'basic' | 'standard' | 'comprehensive'
                        )
                      }
                      className="h-4 w-4"
                    />
                    <div>
                      <span className="font-medium">{opt.label}</span>
                      <p className="text-xs text-muted-foreground">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!bomName}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
