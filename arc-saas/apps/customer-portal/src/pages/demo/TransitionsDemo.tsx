/**
 * PageTransition Demo Page
 *
 * Interactive demo showcasing all transition variants and features.
 * This page can be added to the router for testing and demonstration purposes.
 *
 * To add to router:
 * ```tsx
 * import { TransitionsDemo } from '@/pages/demo/TransitionsDemo';
 *
 * <Route path="/demo/transitions" element={<TransitionsDemo />} />
 * ```
 */

import { useState } from 'react';
import {
  PageTransition,
  usePageTransition,
  PAGE_TRANSITIONS,
  type AnimationVariant,
  type AnimationDuration,
  type TransitionState,
} from '@/components/shared';

export function TransitionsDemo() {
  const [selectedVariant, setSelectedVariant] = useState<AnimationVariant>('fade');
  const [selectedDuration, setSelectedDuration] = useState<AnimationDuration>('normal');
  const [transitionKey, setTransitionKey] = useState(0);
  const [disabled, setDisabled] = useState(false);
  const [lastState, setLastState] = useState<TransitionState>('entered');

  const variants: AnimationVariant[] = ['fade', 'slide-up', 'slide-left', 'slide-right', 'scale', 'none'];
  const durations: AnimationDuration[] = ['fast', 'normal', 'slow'];

  const triggerTransition = () => {
    setTransitionKey((prev) => prev + 1);
  };

  return (
    <div className="container mx-auto py-8 max-w-6xl">
      <h1 className="text-4xl font-bold mb-2">Page Transitions Demo</h1>
      <p className="text-muted-foreground mb-8">
        Interactive playground for testing page transition animations
      </p>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Controls Panel */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-card border rounded-lg p-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-4">Controls</h2>

              {/* Variant Selection */}
              <div className="space-y-2 mb-4">
                <label className="text-sm font-medium">Animation Variant</label>
                <div className="grid grid-cols-2 gap-2">
                  {variants.map((variant) => (
                    <button
                      key={variant}
                      onClick={() => setSelectedVariant(variant)}
                      className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                        selectedVariant === variant
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary hover:bg-secondary/80'
                      }`}
                    >
                      {variant}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration Selection */}
              <div className="space-y-2 mb-4">
                <label className="text-sm font-medium">Duration</label>
                <div className="grid grid-cols-3 gap-2">
                  {durations.map((duration) => (
                    <button
                      key={duration}
                      onClick={() => setSelectedDuration(duration)}
                      className={`px-3 py-2 rounded text-sm font-medium transition-colors ${
                        selectedDuration === duration
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary hover:bg-secondary/80'
                      }`}
                    >
                      {duration}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  fast: 150ms, normal: 200ms, slow: 300ms
                </p>
              </div>

              {/* Disabled Toggle */}
              <div className="flex items-center justify-between mb-4">
                <label className="text-sm font-medium">Disable Animation</label>
                <button
                  onClick={() => setDisabled(!disabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    disabled ? 'bg-primary' : 'bg-secondary'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      disabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Trigger Button */}
              <button
                onClick={triggerTransition}
                className="w-full bg-primary text-primary-foreground px-4 py-3 rounded font-medium hover:bg-primary/90 transition-colors"
              >
                Trigger Transition
              </button>
            </div>

            {/* State Display */}
            <div className="pt-4 border-t space-y-2">
              <h3 className="text-sm font-semibold">Current State</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Variant:</span>
                  <span className="font-mono">{selectedVariant}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Duration:</span>
                  <span className="font-mono">{selectedDuration}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Disabled:</span>
                  <span className="font-mono">{String(disabled)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last State:</span>
                  <span className={`font-mono px-2 py-0.5 rounded text-xs ${getStateColor(lastState)}`}>
                    {lastState}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Key:</span>
                  <span className="font-mono">{transitionKey}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Preset Transitions */}
          <div className="bg-card border rounded-lg p-6">
            <h3 className="text-sm font-semibold mb-3">Quick Presets</h3>
            <div className="space-y-2">
              {Object.entries(PAGE_TRANSITIONS).map(([name, config]) => (
                <button
                  key={name}
                  onClick={() => {
                    setSelectedVariant(config.variant);
                    setSelectedDuration(config.duration);
                    triggerTransition();
                  }}
                  className="w-full text-left px-3 py-2 rounded text-sm hover:bg-secondary transition-colors"
                >
                  <div className="font-medium">{name}</div>
                  <div className="text-xs text-muted-foreground">
                    {config.variant} · {config.duration}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Preview Panel */}
        <div className="lg:col-span-2">
          <div className="bg-card border rounded-lg p-6 min-h-[600px]">
            <h2 className="text-lg font-semibold mb-4">Live Preview</h2>

            <PageTransition
              variant={selectedVariant}
              duration={selectedDuration}
              transitionKey={String(transitionKey)}
              disabled={disabled}
              onTransitionComplete={setLastState}
              className="min-h-[500px] flex items-center justify-center"
            >
              <div className="text-center space-y-6 p-8">
                <div className="w-24 h-24 bg-gradient-to-br from-primary to-primary/50 rounded-2xl mx-auto shadow-lg" />

                <div>
                  <h3 className="text-2xl font-bold mb-2">Content Block</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    This content animates when you trigger a transition. Try different variants and
                    durations to see how they feel.
                  </p>
                </div>

                <div className="inline-flex items-center gap-2 px-4 py-2 bg-secondary rounded-full text-sm">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  Transition #{transitionKey}
                </div>

                <div className="flex gap-4 justify-center pt-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{selectedVariant}</div>
                    <div className="text-xs text-muted-foreground">Variant</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">
                      {selectedDuration === 'fast' ? '150' : selectedDuration === 'normal' ? '200' : '300'}ms
                    </div>
                    <div className="text-xs text-muted-foreground">Duration</div>
                  </div>
                </div>
              </div>
            </PageTransition>
          </div>

          {/* usePageTransition Hook Demo */}
          <div className="bg-card border rounded-lg p-6 mt-6">
            <h2 className="text-lg font-semibold mb-4">usePageTransition Hook Demo</h2>
            <HookDemo />
          </div>
        </div>
      </div>

      {/* Documentation Links */}
      <div className="mt-8 bg-muted/50 border border-muted rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Documentation</h2>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div>
            <h3 className="font-medium mb-2">Component API</h3>
            <p className="text-muted-foreground">
              See <code className="text-xs bg-background px-1 py-0.5 rounded">PageTransition.tsx</code> for
              full component documentation and TypeScript types.
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-2">CSS Classes</h3>
            <p className="text-muted-foreground">
              View <code className="text-xs bg-background px-1 py-0.5 rounded">transitions.css</code> for
              all animation keyframes and styles.
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-2">Usage Examples</h3>
            <p className="text-muted-foreground">
              Check <code className="text-xs bg-background px-1 py-0.5 rounded">PageTransition.examples.tsx</code> for
              15+ real-world usage patterns.
            </p>
          </div>
        </div>
      </div>

      {/* Accessibility Note */}
      <div className="mt-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm">
        <div className="flex gap-2">
          <div className="text-blue-600 dark:text-blue-400">ℹ️</div>
          <div>
            <strong className="text-blue-900 dark:text-blue-100">Accessibility:</strong>
            <span className="text-blue-800 dark:text-blue-200 ml-1">
              All transitions automatically respect <code className="text-xs bg-blue-100 dark:bg-blue-900 px-1 py-0.5 rounded">prefers-reduced-motion</code> user preferences.
              Users with motion sensitivity will see fade transitions only.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Demo component for usePageTransition hook
 */
function HookDemo() {
  const { state, isTransitioning, triggerTransition } = usePageTransition();
  const [count, setCount] = useState(0);

  const handleClick = () => {
    triggerTransition(() => {
      setCount((c) => c + 1);
    }, 'normal');
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        The <code className="text-xs bg-background px-1 py-0.5 rounded">usePageTransition</code> hook
        provides programmatic control over transitions.
      </p>

      <div className="flex items-center gap-4">
        <button
          onClick={handleClick}
          disabled={isTransitioning}
          className="px-4 py-2 bg-primary text-primary-foreground rounded font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isTransitioning ? 'Transitioning...' : 'Trigger Transition'}
        </button>

        <div className="flex gap-4">
          <div>
            <div className="text-sm text-muted-foreground">State</div>
            <div className={`text-sm font-mono px-2 py-1 rounded ${getStateColor(state)}`}>
              {state}
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Count</div>
            <div className="text-sm font-mono px-2 py-1 rounded bg-secondary">
              {count}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Helper to get color class for transition state
 */
function getStateColor(state: TransitionState): string {
  switch (state) {
    case 'entering':
      return 'bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-100';
    case 'entered':
      return 'bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-100';
    case 'exiting':
      return 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100';
    case 'exited':
      return 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100';
  }
}
