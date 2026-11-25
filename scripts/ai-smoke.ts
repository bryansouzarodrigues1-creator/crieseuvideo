/**
 * Measures each configured AI provider on the SAME semantic-direction tasks, with real keys from the environment.
 * It spends quota/credits, so it refuses to run without AI_SMOKE_EXPLICIT_RUN=1 (never wire it to automatic CI).
 *
 *   AI_SMOKE_EXPLICIT_RUN=1 GEMINI_API_KEY=… GROQ_API_KEY=… bun scripts/ai-smoke.ts            # free providers only
 *   AI_SMOKE_EXPLICIT_RUN=1 AI_ALLOW_PAID=1 ANTHROPIC_API_KEY=… bun scripts/ai-smoke.ts      # include paid ones
 *   AI_SMOKE_ROUNDS=3 (stories per provider, default 4)   AI_SMOKE_DRY=1 (no network: verifies the harness itself)
 *
 * Output: a table + tmp/ai-smoke-report.json (no keys). "Approved" = parsed AND compiled AND passed the engine's own
 * validators, which is the number that decides cost per approved video.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import {
  createRouter,
  targetsFromEnv,
  type AiEvent,
  type FetchLike,
  type ProviderTarget,
} from "../src/studio/ai";
import { normalizeSceneProgram } from "../src/studio/explainer/sceneProgram/score";
import { SceneProgram3D } from "../src/studio/explainer/sceneProgram/stage3d";
import { directSemanticViaRouter } from "../src/studio/explainer/sceneProgram/direct/viaRouter";

const STORIES = [
  "Ele atravessou a neve até a base da montanha. Depois começou a escalar a parede de gelo, devagar, passo a passo, procurando apoio para cada mão e cada pé, sem olhar para baixo. No topo, cravou a bandeira. E finalmente comemorou.",
  "Todo mundo achava impossível. A parede parecia não ter fim. Mesmo assim, ela subiu, um apoio de cada vez, até a borda. Lá em cima, o vento parou e ela respirou fundo.",
  "Ninguém sabia o que o esperava. Ele chegou ao pé da encosta ao anoitecer e olhou para cima. Subiu a noite inteira, sem pressa e sem parar. Ao amanhecer, estava no cume, em silêncio, vendo o dia nascer.",
  "A história começa com uma dúvida simples. Ela caminhou até o penhasco e ficou parada, pensando. Depois resolveu escalar, mão após mão. No alto, ergueu os braços e riu.",
];
if (process.env.AI_SMOKE_EXPLICIT_RUN !== "1" && process.env.AI_SMOKE_DRY !== "1") {
  console.error(
    "Este script gasta cota/créditos reais. Rode com AI_SMOKE_EXPLICIT_RUN=1 (ou AI_SMOKE_DRY=1 para testar sem rede).",
  );
  process.exit(2);
}

const dry = process.env.AI_SMOKE_DRY === "1",
  rounds = Math.min(Number(process.env.AI_SMOKE_ROUNDS ?? 4), STORIES.length);
const { chain, allowPaid } = targetsFromEnv(
  dry ? { GEMINI_API_KEY: "dry", AI_CHAIN: "gemini" } : process.env,
);
const sentences = (text: string) => text.match(/[^.!?]+[.!?]+/g)!.map((s) => s.trim());
const dryFetch: FetchLike = async (_url, init) => {
  const ids = [...JSON.parse(init.body).contents[0].parts[0].text.matchAll(/^(s\d+):/gm)].map(
    (m) => m[1],
  );
  const verbs = ["walk", "climb", "plant", "celebrate"];
  const beats = ids.map((sourceId: string, i: number) => ({
    sourceId,
    verb: verbs[Math.min(i, 3)],
    camera: "follow",
  }));
  return {
    ok: true,
    status: 200,
    headers: { get: () => null } as unknown as Headers,
    json: async () => ({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  title: "dry",
                  world: { kind: "cliff", height: 3.0, mood: "day" },
                  hero: { color: "#DF6B35" },
                  beats,
                }),
              },
            ],
          },
          finishReason: "STOP",
        },
      ],
      usageMetadata: { promptTokenCount: 700, candidatesTokenCount: 100 },
    }),
  };
};
const pct = (xs: number[], p: number) =>
  xs.length ? [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))] : 0;

const report: Record<string, unknown>[] = [];
for (const target of chain as ProviderTarget[]) {
  if (!target.apiKey) {
    console.log(`- ${target.id}: sem chave, ignorado`);
    continue;
  }
  if (target.paid && !allowPaid) {
    console.log(`- ${target.id}: pago, ignorado (use AI_ALLOW_PAID=1)`);
    continue;
  }
  const events: AiEvent[] = [],
    row = {
      provider: target.id,
      model: target.model,
      stories: rounds,
      approved: 0,
      repairs: 0,
      providerFailures: 0,
      validationFailures: 0,
      latencies: [] as number[],
      inputTokens: 0,
      outputTokens: 0,
      costUsd: undefined as number | undefined,
      problems: {} as Record<string, number>,
    };
  for (let i = 0; i < rounds; i++) {
    const router = createRouter({
      chain: [target],
      allowPaid,
      maxAttemptsPerTarget: 2,
      fetch: dry ? dryFetch : undefined,
      sleep: dry ? async () => {} : undefined,
      onEvent: (e) => events.push(e),
    });
    const sources = sentences(STORIES[i]).map((text, k) => ({
      sourceId: `s${k + 1}`,
      text,
      duration: Math.max(2, text.split(/\s+/).length / 2.6),
    }));
    const r = await directSemanticViaRouter(router, sources);
    if (r.ok) {
      row.repairs += r.rounds - 1;
      try {
        const stage = new SceneProgram3D(normalizeSceneProgram(r.value.program, sources), sources);
        try {
          stage.validateContacts();
          row.approved++;
        } finally {
          stage.dispose();
        }
      } catch (e) {
        row.validationFailures++;
        row.problems[`engine: ${(e as Error).message.slice(0, 60)}`] =
          (row.problems[`engine: ${(e as Error).message.slice(0, 60)}`] ?? 0) + 1;
      }
    } else if (r.stage === "provider") {
      row.providerFailures++;
      row.problems[r.failure.problem] = (row.problems[r.failure.problem] ?? 0) + 1;
    } else {
      row.validationFailures++;
      row.problems[`plan: ${r.message.slice(0, 60)}`] =
        (row.problems[`plan: ${r.message.slice(0, 60)}`] ?? 0) + 1;
    }
  }
  for (const e of events) {
    if (e.ok) {
      row.latencies.push(e.latencyMs ?? 0);
      row.inputTokens += e.usage?.inputTokens ?? 0;
      row.outputTokens += e.usage?.outputTokens ?? 0;
      if (e.costUsd !== undefined) row.costUsd = (row.costUsd ?? 0) + e.costUsd;
    }
  }
  report.push({
    ...row,
    p50Ms: pct(row.latencies, 0.5),
    p95Ms: pct(row.latencies, 0.95),
    costPerApprovedUsd:
      row.costUsd !== undefined && row.approved ? +(row.costUsd / row.approved).toFixed(6) : null,
  });
}
console.table(
  report.map((r) => ({
    provider: r.provider,
    model: r.model,
    approved: `${r.approved}/${r.stories}`,
    repairs: r.repairs,
    providerFail: r.providerFailures,
    planFail: r.validationFailures,
    p50ms: r.p50Ms,
    p95ms: r.p95Ms,
    tokensIn: r.inputTokens,
    tokensOut: r.outputTokens,
    usd: r.costUsd ?? "n/d",
    usdPerApproved: r.costPerApprovedUsd ?? "n/d",
  })),
);
mkdirSync("tmp", { recursive: true });
writeFileSync("tmp/ai-smoke-report.json", JSON.stringify(report, null, 2));
console.log("Relatório: tmp/ai-smoke-report.json");
