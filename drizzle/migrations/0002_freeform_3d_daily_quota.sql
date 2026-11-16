-- CrieSeuVideo free-form 3D trial: one atomic, durable quota per owner UTC day.
-- This migration is staged in a PR. DO NOT apply to production until approved.
-- Only the server's service_role may execute the consuming RPC.
CREATE TABLE IF NOT EXISTS public.freeform_3d_daily_usage (
  user_id uuid NOT NULL,
  utc_day date NOT NULL,
  used integer NOT NULL DEFAULT 0 CHECK (used BETWEEN 0 AND 3),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, utc_day)
);

ALTER TABLE public.freeform_3d_daily_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.freeform_3d_daily_usage FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.freeform_3d_daily_usage TO service_role;

CREATE OR REPLACE FUNCTION public.consume_freeform_3d_quota(
  p_user_id uuid,
  p_utc_day date,
  p_limit integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  next_count integer;
BEGIN
  IF p_user_id IS NULL OR p_utc_day IS NULL OR p_limit IS NULL
     OR p_limit < 1 OR p_limit > 3 THEN
    RETURN false;
  END IF;

  -- Single INSERT ... ON CONFLICT statement provides row-level locking
  -- across concurrent serverless instances. A rejected request consumes
  -- zero additional slots; a valid attempt reserves one before Gemini call.
  INSERT INTO public.freeform_3d_daily_usage(user_id, utc_day, used, updated_at)
  VALUES (p_user_id, p_utc_day, 1, now())
  ON CONFLICT (user_id, utc_day) DO UPDATE
    SET used = public.freeform_3d_daily_usage.used + 1,
        updated_at = now()
    WHERE public.freeform_3d_daily_usage.used < p_limit
  RETURNING used INTO next_count;
  RETURN next_count IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_freeform_3d_quota(uuid, date, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_freeform_3d_quota(uuid, date, integer)
  TO service_role;
