import { createFileRoute } from "@tanstack/react-router";
import { askAi } from "@/studio/server/ai";
import {
  buildContextualDirectorFallback,
  validateAndNormalizeDirectorResponse,
  VALID_ACTIONS,
  VALID_CAMERAS,
  VALID_DRAMATIC_INTENTS,
  VALID_EMOTIONAL_STATES,
  VALID_ENVIRONMENTS,
  VALID_EXPRESSIONS,
  VALID_FILTERS,
  VALID_ICONS,
  VALID_MANEUVERS,
  VALID_PROPS,
  VALID_SFX,
} from "@/studio/utils/cinematicDirector";

export const Route = createFileRoute("/api/ai/script-to-full-video")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json().catch(() => ({}));
        const script = String(body.script ?? "").slice(0, 20000);
        const safeAspectRatio = body.aspectRatio === "9:16" ? "9:16" : "16:9";
        const text = await askAi(`Você é o Diretor Cinematográfico do StickStory Studio.
Analise a história/roteiro do usuário e dirija uma sequência de 3 a 6 cenas cinematográficas com personagens stick figure estilizados.
História/Roteiro do usuário:
"""${script}"""

REGRAS DE DIREÇÃO:
1. NUNCA escolha ações de forma genérica pelo número da cena. Toda ação, expressão, ambiente, câmera e beat deve decorrer do significado dramático e do contexto real daquela cena.
2. Mantenha continuidade visual do protagonista entre as cenas.
3. Para cada cena, defina:
   - dramaticIntent: uma de [${VALID_DRAMATIC_INTENTS.join(', ')}]
   - emotionalState: uma de [${VALID_EMOTIONAL_STATES.join(', ')}]
   - action: uma de [${VALID_ACTIONS.join(', ')}]
   - expression: uma de [${VALID_EXPRESSIONS.join(', ')}]
   - prop: uma de [${VALID_PROPS.join(', ')}]
   - environment: uma de [${VALID_ENVIRONMENTS.join(', ')}]
   - cameraEffect: uma de [${VALID_CAMERAS.join(', ')}]
   - soundEffect: uma de [${VALID_SFX.join(', ')}]
   - visualFilter: uma de [${VALID_FILTERS.join(', ')}]
   - floatingIcon: uma de [${VALID_ICONS.join(', ')}]
   - beats: 3 a 4 beats temporais por cena cobrindo opening_anticipation, development_action, climax_reaction e settle_recovery, cada um com action, expression, maneuver (uma de [${VALID_MANEUVERS.join(', ')}]), intensity (0.2 a 1.0), anticipation (0.1 a 1.0), reaction (0.1 a 1.0) e settle (0.2 a 1.0).
Formato JSON: { "title": string, "scenes": [ { "title", "narration", "dramaticIntent", "emotionalState", "action", "expression", "prop", "environment", "cameraEffect", "soundEffect", "visualFilter", "floatingIcon", "beats": [ { "narrativePhase", "dramaticIntent", "spokenSegment", "action", "expression", "maneuver", "intensity", "anticipation", "reaction", "settle" } ] } ] }`);
        if (!text) return Response.json(buildContextualDirectorFallback(script, safeAspectRatio));
        try {
          return Response.json(validateAndNormalizeDirectorResponse(text, script, safeAspectRatio));
        } catch (e) {
          console.warn("Director validation failed, using fallback", e);
          return Response.json(buildContextualDirectorFallback(script, safeAspectRatio));
        }
      },
    },
  },
});
