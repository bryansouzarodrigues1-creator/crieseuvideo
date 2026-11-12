CREATE TABLE public.explainer_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  script text NOT NULL,
  plan jsonb NOT NULL,
  keywords text[] NOT NULL DEFAULT '{}',
  engine text NOT NULL DEFAULT '2d',
  rating text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  rated_at timestamptz
);
GRANT ALL ON public.explainer_generations TO service_role;
ALTER TABLE public.explainer_generations ENABLE ROW LEVEL SECURITY;
CREATE INDEX explainer_generations_rating_idx ON public.explainer_generations (rating, rated_at DESC);