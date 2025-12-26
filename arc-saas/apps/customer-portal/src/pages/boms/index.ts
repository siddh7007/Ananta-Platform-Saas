/**
 * BOM pages barrel export
 */

export { BomListPage } from './BomList';
// Use unified vertical stepper upload page instead of old horizontal stepper
export { BomUploadUnified as BomUploadPage } from '@/components/bom/unified/BomUploadUnified';
// Keep legacy export for reference (old horizontal stepper)
export { BomUploadPage as BomUploadPageLegacy } from './BomUpload';
export { BomDetailPage } from './BomDetail';
export { RiskAnalysisPage } from './RiskAnalysis';
