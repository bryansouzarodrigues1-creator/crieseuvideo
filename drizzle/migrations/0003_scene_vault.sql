-- CrieSeuVideo 3D vault: reusable object/place pieces saved from validated programs.
-- Staged in a PR. DO NOT apply to production until approved. Service role only (no policies, RLS on).
-- Stores geometry data, keywords and context STEMS only: never the user's script text.
CREATE TABLE IF NOT EXISTS public.scene_vault (
  id text PRIMARY KEY CHECK (char_length(id) BETWEEN 3 AND 80),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 60),
  kind text NOT NULL CHECK (kind IN ('object', 'place')),
  keywords text[] NOT NULL CHECK (cardinality(keywords) BETWEEN 1 AND 10),
  context_tokens text[] NOT NULL DEFAULT '{}' CHECK (cardinality(context_tokens) <= 24),
  fragment jsonb NOT NULL CHECK (pg_column_size(fragment) < 262144),
  uses integer NOT NULL DEFAULT 0,
  rejects integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS scene_vault_keywords_idx ON public.scene_vault USING gin (keywords);
ALTER TABLE public.scene_vault ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.scene_vault FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.scene_vault TO service_role;

CREATE OR REPLACE FUNCTION public.scene_vault_bump(p_id text, p_field text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_field = 'uses' THEN UPDATE public.scene_vault SET uses = uses + 1 WHERE id = p_id;
  ELSIF p_field = 'rejects' THEN UPDATE public.scene_vault SET rejects = rejects + 1 WHERE id = p_id;
  END IF;
END; $$;
REVOKE ALL ON FUNCTION public.scene_vault_bump(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scene_vault_bump(text, text) TO service_role;
