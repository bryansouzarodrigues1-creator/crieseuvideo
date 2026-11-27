/* eslint-disable @typescript-eslint/no-explicit-any -- mocked provider payloads */
import { describe, expect, it } from "vitest";
import type { FetchLike } from "../ai";
import { budgetFor, runDirection, runDirectionReview, sourcesFromScript } from "./directionService";

const script =
  "Ele atravessou a neve até a base da montanha. Depois subiu a parede de gelo devagar, passo a passo, sem olhar para baixo. No topo, comemorou.";
const plan = {
  world: { kind: "cliff", height: 3.2, mood: "day" },
  hero: { color: "#DF6B35" },
  beats: [
    { sourceId: "s1", verb: "walk", camera: "follow", from: "left" },
    { sourceId: "s2", verb: "stand", camera: "wide" },
    { sourceId: "s3", verb: "celebrate", camera: "orbit" },
  ],
};
const gem = (text: string) => ({
  candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }],
  usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 80 },
});
const fetchOf = (bodies: unknown[]) => {
  const calls: any[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body), headers: init.headers });
    return {
      ok: true,
      status: 200,
      headers: { get: () => null } as unknown as Headers,
      json: async () => bodies[Math.min(calls.length - 1, bodies.length - 1)],
    };
  };
  return { fetch, calls };
};
const env = { GEMINI_API_KEY: "server-key", GEMINI_BILLING: "free", AI_VIDEO_MAX_CALLS: "2" };

describe("direction service", () => {
  it("splits a script into sentences and refuses unusable ones", () => {
    expect(sourcesFromScript(script).map((s) => s.sourceId)).toEqual(["s1", "s2", "s3"]);
    expect(() => sourcesFromScript("Oi. Tchau.")).toThrow(/12 a 350/);
  });
  it("plans through the router with the key from the SERVER env, and reports calls/providers without secrets", async () => {
    const f = fetchOf([gem(JSON.stringify(plan))]);
    const r = await runDirection(
      { script, videoId: "video-aaaa1", form: "compact", confirmCost: true },
      env,
      "u1",
      f.fetch,
    );
    expect(r).toMatchObject({
      ok: true,
      aiCalls: 1,
      callsLeft: 1,
      providers: ["gemini/gemini-3.6-flash"],
    });
    expect(f.calls[0].headers["x-goog-api-key"]).toBe("server-key");
    expect(JSON.stringify(r)).not.toContain("server-key");
    expect(JSON.parse((r as any).programJson).nodes.length).toBeGreaterThan(10);
  });
  it("planning and review of the SAME video share one budget; a different video starts its own", async () => {
    const f = fetchOf([gem(JSON.stringify({ issues: [], correctedDirection: null }))]);
    const frames = [0, 2, 4].map((time) => ({
      time,
      mimeType: "image/png" as const,
      base64: "A".repeat(64),
    }));
    const direction = JSON.parse(
      (
        (await runDirection(
          { script, videoId: "video-bbbb2", form: "compact", confirmCost: true },
          env,
          "u2",
          fetchOf([gem(JSON.stringify(plan))]).fetch,
        )) as any
      ).directionJson,
    );
    const review = await runDirectionReview(
      { script, videoId: "video-bbbb2", direction, frames, confirmCost: true },
      env,
      "u2",
      f.fetch,
    );
    expect(review).toMatchObject({ status: "unchanged", aiCalls: 2, callsLeft: 0 });
    // budget (2) is now spent for this video: nothing more is sent
    const again = await runDirection(
      { script, videoId: "video-bbbb2", form: "compact", confirmCost: true },
      env,
      "u2",
      f.fetch,
    );
    expect(again).toMatchObject({ ok: false, aiCalls: 2 });
    expect(f.calls).toHaveLength(1);
    expect(budgetFor("u2:video-cccc3", env).remaining()).toBe(2);
  });
  it("rejects requests without explicit cost confirmation or with unknown fields", async () => {
    await expect(
      runDirection({ script, videoId: "video-dddd4", confirmCost: false }, env, "u3"),
    ).rejects.toThrow();
    await expect(
      runDirection({ script, videoId: "video-dddd4", confirmCost: true, apiKey: "x" }, env, "u3"),
    ).rejects.toThrow();
  });
});
