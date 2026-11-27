import { APPROVED_MODELS } from "../modelRegistry";
import { EMOTIONS, POSE_NAMES } from "./poses";
import { directionModels, MESH_SHAPES } from "./strict";

/**
 * Prompt for the FULL direction form: cast + verbs, the method the money video was authored with.
 * The model writes WHAT exists and WHAT happens; the compiler owns holds, gaps, wheel rolling, pivots and checks.
 */
export function directionGuide(opts: { assetIds?: string[] } = {}): string {
  const ids = opts.assetIds ?? directionModels().map(([id]) => id);
  const catalogue = ids.map(catalogueEntry).join("\n");
  return `Você é o diretor de cena de um vídeo explicativo 3D. Escreva uma DIREÇÃO (elenco + verbos por frase), nunca curvas, chaves ou coordenadas por quadro.
Responda SOMENTE com JSON: { "title": "...", "version": 1, "background": "#RRGGBB", "cast": [...], "scenes": [...] }

ELENCO (cast): o que existe. Cada item tem id (minúsculas, números, - ou _), kind e posição em metros (y=0 é o chão):
  - { "id": "cofre", "kind": "model", "assetId": "<do catálogo>", "position": [x,y,z] }   (hidden:true = começa invisível)
  - { "id": "chao", "kind": "mesh", "geometry": { "shape": "${MESH_SHAPES.join("|")}", "size": [..] }, "color": "#RRGGBB", "position": [x,y,z] }
  - { "id": "ator", "kind": "actor", "color": "#RRGGBB", "position": [x,0,z], "rotation": [0,yaw,0] }   (figura humana gerada pelo motor, ~2,25 m)
  - { "id": "grupo", "kind": "group", "position": [...] }   (filhos usam "parent": "grupo")
  Modelos não aceitam geometry nem color. Use "scale": [s,s,s] no elenco para equilibrar tamanhos (um pallet pequeno ao lado de um cofre).
Catálogo de modelos aprovados (use SOMENTE estes assetId; tamanhos reais sem escala, origem indicada):
${catalogue}

CENAS (scenes): EXATAMENTE uma por frase recebida, na mesma ordem, com o sourceId recebido:
  { "sourceId": "s1", "shot": { "subjects": ["ids"], "azimuth": 0.3, "endAzimuth": 0.05, "elevation": 0.16, "distance": 1.1 }, "verbs": [ ... ] }
  Alterne a câmera entre frases (azimute -0.6..0.6, elevação 0..0.3, distância 0.9..1.6).

VERBOS: todo verbo tem { "do", "node" } e, opcionalmente, "at": [de, até] (fase 0..1 dentro da frase; padrão [0,1]).
  appear | vanish          aparece (cresce) / some
  move {to:[x,y,z]|by:[dx,dy,dz]} · scale {to:[..]} · turn {to:[rx,ry,rz]} (radianos)
  open {part} · close {part} · spin {part, turns} · rotatePart {part, to}   peças internas do catálogo; eixo, ângulo, rodas e raios vêm do catálogo (não os escreva, a menos que queira outro ângulo: "angle")
  drive {by:[dx,0,dz]}   o veículo anda PARA A FRENTE dele (+Z do modelo, girado pelo yaw) e as rodas giram sozinhas; andar de lado é rejeitado (gire antes com turn)
  roll {dx}   disco de pé (moeda) rolando ao longo de +X
  rise {height}   barra que cresce a partir da base (gráficos)
  pose {pose: ${POSE_NAMES.join("|")}, emotion: ${EMOTIONS.join("|")}}   só para kind "actor"
COMPOSIÇÃO (erros reais já vistos em vídeos gerados): (1) nada pode ficar ENTRE a câmera e o assunto da cena: a câmera padrão está em +Z, então um objeto grande com z maior que o do assunto o esconde; afaste-os (≥ 3 m) ou mude o azimuth. (2) Para mostrar a TRASEIRA de um veículo (porta traseira, −Z) use azimuth perto de 3.1 naquela cena. (3) Só chame de "aparece/sai/entra" o que a câmera realmente enquadra: coloque em subjects de cada cena todos os itens que participam da ação e mantenha-os a no máximo ~8 m uns dos outros. (4) Um objeto que sai de dentro de outro (malote saindo do caminhão) começa na posição interna e se move para fora; não surge no ar. (5) Um veículo que 'chega' deve parar a uma distância clara do que está na cena, sem atravessá-lo. (6) Modelos com frente (cofre: porta e volante) têm a frente em +Z: a câmera só os vê de frente quando o yaw (rotation[1]) do modelo é ≈ ao azimuth do plano. NUNCA gire o cofre 180° de costas para a câmera; para a câmera ver a porta aberta, deixe o yaw perto do azimuth. REGRAS: o mundo é em metros, +Y para cima, a câmera padrão olha de +Z para −Z; inclua sempre um chão (mesh box largo e fino com topo em y=0) quando não usar world; cada cena precisa de pelo menos um movimento visível que ilustre a frase; não misture move (suave) com drive/roll (linear) no mesmo nó; dois verbos na mesma propriedade do mesmo nó não podem ter janelas que se cruzam; uma ação prometida precisa mover de verdade (>= 10 cm ou 0,1 rad); use SOMENTE nós do elenco.

ATOR NA MONTANHA (opcional): para um herói que anda e escala, acrescente "world": { "kind": "cliff", "height": 2.4–4.5, "mood": "day|dusk|night" }, um ator de id "hero" no elenco, e UM verbo por frase em "hero":
  walk {from:left|right|front} (chega andando) · climb (sobe a parede; no máximo uma vez) · plant (cravar bandeira no topo, depois de climb) · celebrate · stand
  Com world o motor cria chão, parede, montanhas e neve (ids reservados: ground, wall, summit-snow, snowfall, helmet, pack, pole, flag, peak-N, cap-N, hold-*). Não use outros verbos em "hero".

EXEMPLO de sintaxe (outro tema; só ilustra o formato):
${JSON.stringify(DIRECTION_EXAMPLE)}`;
}

function catalogueEntry(id: string): string {
  const info = APPROVED_MODELS[id];
  const c = info?.catalogue;
  if (!c) return `  - ${id}: ${info?.display ?? id}`;
  const lines = [
    `  - ${id}: ${c.description} ${c.size.join(" × ")} m (largura × altura × profundidade). Origem: ${c.origin}.`,
  ];
  for (const p of c.parts?.filter((q) => q.kind !== "wheel") ?? [])
    lines.push(
      `      peça "${p.name}" (${p.kind}, eixo ${p.axis}${p.openAngle !== undefined ? `, ângulo padrão ${p.openAngle}` : ""}): ${p.note}`,
    );
  const wheels = c.parts?.filter((q) => q.kind === "wheel") ?? [];
  if (wheels.length)
    lines.push(
      `      rodas: ${wheels.map((w) => w.name).join(", ")} (raio ${c.wheelRadius} m): use drive, elas giram sozinhas.`,
    );
  if (c.roll) lines.push(`      rola de pé ao longo de +X com roll (raio ${c.roll.radius} m).`);
  if (c.interiorFloorY !== undefined)
    lines.push(
      `      piso interno em y=${c.interiorFloorY}: modelos pequenos dentro dele usam position y=${c.interiorFloorY}.`,
    );
  return lines.join("\n");
}

/** A tiny, model-agnostic example of the syntax. A test compiles it, so it cannot rot. */
export const DIRECTION_EXAMPLE = {
  version: 1,
  background: "#BFD8E6",
  cast: [
    {
      id: "chao",
      kind: "mesh",
      geometry: { shape: "box", size: [60, 0.2, 60] },
      position: [0, -0.1, 0],
      color: "#C9D6DF",
    },
    { id: "cofre", kind: "model", assetId: "giant-safe-v1", position: [0, 0, 0] },
    {
      id: "pessoa",
      kind: "actor",
      color: "#1E3A8A",
      position: [2.2, 0, 1.8],
      rotation: [0, -0.55, 0],
    },
    {
      id: "caixa",
      kind: "mesh",
      hidden: true,
      geometry: { shape: "box", size: [0.6, 0.6, 0.6] },
      position: [0, 0.6, 0],
      color: "#F59E0B",
    },
  ],
  scenes: [
    {
      sourceId: "s1",
      shot: {
        subjects: ["cofre", "pessoa"],
        azimuth: 0.3,
        endAzimuth: 0.05,
        elevation: 0.16,
        distance: 1.15,
      },
      verbs: [
        { do: "spin", node: "cofre", part: "volante", turns: 1, at: [0, 0.4] },
        { do: "open", node: "cofre", part: "porta", at: [0.4, 0.95] },
        { do: "pose", node: "pessoa", pose: "surprised", emotion: "surprised", at: [0, 0.2] },
      ],
    },
    {
      sourceId: "s2",
      shot: { subjects: ["cofre", "caixa"], azimuth: 0.05, elevation: 0.2, distance: 1.1 },
      verbs: [
        { do: "appear", node: "caixa", at: [0, 0.3] },
        { do: "move", node: "caixa", to: [0, 0.6, 3], at: [0.3, 1] },
      ],
    },
  ],
};
