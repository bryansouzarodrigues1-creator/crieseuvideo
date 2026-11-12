import { createFileRoute } from "@tanstack/react-router";

// Logs every generation (script -> plan) and the user's "was this what you wanted?" answer so the director learns from real misses.
export const Route = createFileRoute("/api/ai/feedback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json().catch(() => ({}));
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        if (body.action === "log") {
          const script = String(body.script ?? "").slice(0, 6000);
          if (script.length < 4 || typeof body.plan !== "object") return Response.json({ error: "invalid" }, { status: 400 });
          const plan = JSON.stringify(body.plan).length > 400_000 ? { scenes: [] } : body.plan;
          const keywords = Array.isArray(body.keywords) ? body.keywords.slice(0, 20).map(String) : [];
          const engine = body.engine === "3d" ? "3d" : "2d";
          const { data, error } = await supabaseAdmin.from("explainer_generations").insert({ script, plan, keywords, engine }).select("id").single();
          if (error) return Response.json({ error: error.message }, { status: 500 });
          return Response.json({ id: data.id });
        }
        if (body.action === "rate") {
          const id = String(body.id ?? ""), rating = body.rating === "yes" ? "yes" : body.rating === "no" ? "no" : "";
          if (!/^[0-9a-f-]{36}$/.test(id) || !rating) return Response.json({ error: "invalid" }, { status: 400 });
          const reason = body.reason ? String(body.reason).slice(0, 1000) : null;
          // Only unrated rows can be rated, so a leaked id cannot rewrite history.
          const { error } = await supabaseAdmin.from("explainer_generations").update({ rating, reason, rated_at: new Date().toISOString() }).eq("id", id).is("rating", null);
          if (error) return Response.json({ error: error.message }, { status: 500 });
          return Response.json({ ok: true });
        }
        return Response.json({ error: "invalid" }, { status: 400 });
      },
    },
  },
});
