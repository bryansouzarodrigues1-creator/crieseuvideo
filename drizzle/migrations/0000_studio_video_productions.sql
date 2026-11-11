CREATE TABLE public.studio_productions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 prompt text NOT NULL,
 style text NOT NULL,
 aspect_ratio text NOT NULL DEFAULT '16:9',
 duration integer NOT NULL DEFAULT 6,
 resolution text NOT NULL DEFAULT '720p',
 status text NOT NULL DEFAULT 'creating',
 gateway_id text,
 storage_path text,
 error_message text,
 progress integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.studio_productions TO authenticated;
GRANT ALL ON public.studio_productions TO service_role;
ALTER TABLE public.studio_productions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read productions" ON public.studio_productions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX studio_productions_owner_created ON public.studio_productions(user_id, created_at DESC);
CREATE UNIQUE INDEX studio_one_active_production ON public.studio_productions(user_id) WHERE status IN ('creating', 'queued', 'in_progress');
CREATE TABLE public.studio_ai_state (
 id text PRIMARY KEY,
 status_code integer NOT NULL,
 message text NOT NULL,
 kind text NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.studio_ai_state TO service_role;
ALTER TABLE public.studio_ai_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read video storage" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'studio-videos' AND (storage.foldername(name))[1] = auth.uid()::text);