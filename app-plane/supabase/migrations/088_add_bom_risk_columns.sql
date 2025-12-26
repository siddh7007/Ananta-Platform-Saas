-- Migration: Add risk analysis columns to boms table
-- Required for BOMResultsSummary component

-- Add risk score (0-100, higher = more risky)
ALTER TABLE public.boms ADD COLUMN IF NOT EXISTS risk_score INTEGER DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100);

-- Add risk grade (A, B, C, D, F)
ALTER TABLE public.boms ADD COLUMN IF NOT EXISTS risk_grade TEXT DEFAULT 'N/A' CHECK (risk_grade IN ('A', 'B', 'C', 'D', 'F', 'N/A'));

-- Add risk factors breakdown as JSONB
ALTER TABLE public.boms ADD COLUMN IF NOT EXISTS risk_factors JSONB DEFAULT '{
  "lifecycle": 0,
  "supply_chain": 0,
  "compliance": 0,
  "obsolescence": 0,
  "single_source": 0
}'::jsonb;

-- Add component count for quick access
ALTER TABLE public.boms ADD COLUMN IF NOT EXISTS component_count INTEGER DEFAULT 0;

-- Add metadata for additional info
ALTER TABLE public.boms ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create index for risk-based queries
CREATE INDEX IF NOT EXISTS idx_boms_risk_score ON public.boms(risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_boms_risk_grade ON public.boms(risk_grade);

COMMENT ON COLUMN public.boms.risk_score IS 'Overall risk score 0-100 (higher = more risky)';
COMMENT ON COLUMN public.boms.risk_grade IS 'Letter grade A-F based on risk score';
COMMENT ON COLUMN public.boms.risk_factors IS 'Breakdown of risk by category (lifecycle, supply_chain, compliance, obsolescence, single_source)';
