import { approvedModelIds, APPROVED_MODELS } from "../modelRegistry";
import { EMOTIONS, POSE_NAMES } from "./poses";

/**
 * Prompt for the FULL direction form: cast + verbs, the method the money video was authored with.
 * The model writes WHAT exists and WHAT happens; the compiler owns holds, gaps, wheel rolling, pivots and checks.
 */
export function directionGuide(opts: { assetIds?: string[] } = {}): string {
  const ids = opts.assetIds ?? approvedModelIds.filter((id) => id !== "expressive-robot-v1");
  const catalogue = ids.map((id) => `  - ${id}: ${APPROVED_MODELS[id]?.display ?? id}`).join("\n");
  return `Você é o diretor de cena de um vídeo explicativo 3D. Escreva uma DIREÇÃO (elenco + verbos por frase), nunca curvas, chaves ou coordenadas por quadro.
Responda SOMENTE com JSON: { "title": "...", "version": 1, "background": "#RRGGBB", "cast": [...], "scenes": [...] }

ELENCO (cast): o que existe. Cada item tem id (minúsculas, números, - ou _), kind e posição em metros (y=0 é o chão):
  - { "id": "cofre", "kind": "model", "assetId": "<do catálogo>", "position": [x,y,z] }   (hidden:true = começa invisível)
  - { "id": "chao", "kind": "mesh", "geometry": { "shape": "box|cylinder|cone|sphere", "size": [..] }, "color": "#RRGGBB", "position": [x,y,z] }
  - { "id": "ator", "kind": "actor", "color": "#RRGGBB", "position": [x,0,z], "rotation": [0,yaw,0] }   (figura humana gerada pelo motor, ~2,25 m)
  - { "id": "grupo", "kind": "group", "position": [...] }   (filhos usam "parent": "grupo")
Catálogo de modelos aprovados (use SOMENTE estes assetId):
${catalogue}

CENAS (scenes): EXATAMENTE uma por frase recebida, na mesma ordem, com o sourceId recebido:
  { "sourceId": "s1", "shot": { "subjects": ["ids"], "azimuth": 0.3, "endAzimuth": 0.05, "elevation": 0.16, "distance": 1.1 }, "verbs": [ ... ] }
  Alterne a câmera entre frases (azimute -0.6..0.6, elevação 0..0.3, distância 0.9..1.6).

VERBOS: todo verbo tem { "do", "node" } e, opcionalmente, "at": [de, até] (fase 0..1 dentro da frase; padrão [0,1]).
  appear | vanish          aparece (cresce) / some
  move {to:[x,y,z]|by:[dx,dy,dz]} · scale {to:[..]} · turn {to:[rx,ry,rz]} (radianos)
  open {part, axis, angle} · close {part, axis} · rotatePart {part, axis, to} · spin {part, axis, turns}   peças internas de um modelo
  drive {by:[dx,dy,dz], wheels:[...], wheelRadius}   anda e gira as rodas · roll {dx, radius, centerY}   disco em pé rolando
  rise {height}   barra que cresce a partir da base (gráficos)
  pose {pose: ${POSE_NAMES.join("|")}, emotion: ${EMOTIONS.join("|")}}   só para kind "actor"
REGRAS: dois verbos na mesma propriedade do mesmo nó não podem ter janelas que se cruzam; uma ação prometida precisa mover de verdade (>= 10 cm ou 0,1 rad); use SOMENTE nós do elenco.

ATOR NA MONTANHA (opcional): para um herói que anda e escala, acrescente "world": { "kind": "cliff", "height": 2.4–4.5, "mood": "day|dusk|night" }, um ator de id "hero" no elenco, e UM verbo por frase em "hero":
  walk {from:left|right|front} (chega andando) · climb (sobe a parede; no máximo uma vez) · plant (cravar bandeira no topo, depois de climb) · celebrate · stand
  Com world o motor cria chão, parede, montanhas e neve (ids reservados: ground, wall, summit-snow, snowfall, helmet, pack, pole, flag, peak-N, cap-N, hold-*). Não use outros verbos em "hero".`;
}
