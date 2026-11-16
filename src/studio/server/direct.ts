// Server-only: pede ao Gemini a direção 3D de todas as cenas numa única chamada barata e valida o resultado.
import { askAiStructured } from "@/studio/server/ai";
import { directionPrompt, directionSchema } from "@/studio/explainer/direction/prompt";
import { mergeDirections, type Direction } from "@/studio/explainer/direction/direction";

export async function directScenes(texts: string[]): Promise<{ directions: Direction[]; source: "ai" | "fallback"; fromAi: number }> {
  const list = texts.slice(0, 40);
  const ai = list.length ? await askAiStructured(directionPrompt(list), directionSchema(list.length)) : null;
  const merged = mergeDirections(list, ai?.data);
  return { directions: merged.directions, source: merged.fromAi > 0 ? "ai" : "fallback", fromAi: merged.fromAi };
}
