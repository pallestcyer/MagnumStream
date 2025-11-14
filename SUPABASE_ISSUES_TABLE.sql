-- Create issues table for issue reporting functionality
-- Run this SQL in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_name TEXT NOT NULL,
  issue_type TEXT NOT NULL CHECK (issue_type IN ('camera', 'recording', 'editing', 'export', 'performance', 'ui', 'other')),
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  notes TEXT
);

-- Create index for faster querying
CREATE INDEX IF NOT EXISTS idx_issues_created_at ON public.issues(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_issues_status ON public.issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_priority ON public.issues(priority);
CREATE INDEX IF NOT EXISTS idx_issues_issue_type ON public.issues(issue_type);

-- Enable Row Level Security (RLS)
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (adjust based on your auth setup)
-- For now, allowing all operations since this is for internal staff use
CREATE POLICY "Allow all operations on issues" ON public.issues
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER issues_updated_at
  BEFORE UPDATE ON public.issues
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Add comment for documentation
COMMENT ON TABLE public.issues IS 'Staff issue reports from MagnumStream dashboard';
COMMENT ON COLUMN public.issues.issue_type IS 'Type of issue: camera, recording, editing, export, performance, ui, other';
COMMENT ON COLUMN public.issues.priority IS 'Priority level: low, medium, high, critical';
COMMENT ON COLUMN public.issues.status IS 'Current status: open, in_progress, resolved, closed';
