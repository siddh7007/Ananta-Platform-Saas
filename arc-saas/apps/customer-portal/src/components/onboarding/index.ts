/**
 * Onboarding Components
 * First-time user onboarding flow for BOM management tool
 *
 * Usage:
 * ```tsx
 * import { OnboardingProvider, OnboardingOverlay, useOnboarding } from '@/components/onboarding';
 *
 * // Wrap your app with OnboardingProvider
 * <OnboardingProvider>
 *   <App />
 *   <OnboardingOverlay />
 * </OnboardingProvider>
 *
 * // Use the hook in components to interact with onboarding
 * const { startOnboarding, resetOnboarding } = useOnboarding();
 * ```
 *
 * Data attributes for targeting:
 * - Add `data-onboarding="target-id"` to elements you want to highlight
 * - Example: `<Button data-onboarding="bom-upload-button">Upload BOM</Button>`
 */

export { OnboardingProvider, useOnboarding } from './OnboardingProvider';
export { OnboardingOverlay } from './OnboardingOverlay';
export type { OnboardingStep } from './OnboardingProvider';
