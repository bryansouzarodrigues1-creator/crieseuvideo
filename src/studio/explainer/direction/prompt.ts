// Ensina o Gemini o contrato de direção: guia em português + JSON Schema para saída estruturada.
import {
  ACTIONS, ACTION_IDS, CAMERA_MOVES, CAMERA_MOVE_IDS, ENTRANCES, ENTRANCE_IDS, ENVIRONMENTS, ENVIRONMENT_IDS, EXPRESSION_IDS,
  OUTFITS, OUTFIT_IDS, PLACEMENTS, PROPS, PROP_IDS, SHOTS, SHOT_IDS,
} from './catalog';

const list = (o: Record<string, string>) => Object.entries(o).map(([k, v]) => `  - ${k}: ${v}`).join('\n');

/** Exemplo real (vídeo de referência do Everest) usado como few-shot. */
export const EXAMPLE_TEXT = 'Ele conseguiu escalar o monte Everest, mas...';
export const EXAMPLE_DIRECTION = {
  environment: 'summit', outfit: 'yellow_jacket', action: 'idle', entrance: 'rise_from_below', expression: 'confused', placement: 'center',
  props: ['flag'], cameraMove: 'push_in', shot: 'medium', intensity: 0.7, board: false, unsupported: [],
};

export const DIRECTION_GUIDE = `Você dirige cenas 3D de um estúdio de animação (estilo cartoon low-poly de narrativas curtas para redes sociais).
Para CADA cena escolha, SOMENTE entre as opções abaixo, como ela deve ser filmada. Nunca invente valores fora das listas.
environment (onde acontece):
${list(ENVIRONMENTS)}
action (o que o personagem faz):
${list(ACTIONS)}
entrance (como o personagem chega):
${list(ENTRANCES)}
expression: ${EXPRESSION_IDS.join(', ')}
outfit (roupa):
${list(Object.fromEntries(Object.entries(OUTFITS).map(([k, v]) => [k, v.label])))}
placement: ${PLACEMENTS.join(', ')} (onde o personagem fica na tela)
props (itens do cenário, até 3):
${list(PROPS)}
cameraMove (movimento de câmera):
${list(CAMERA_MOVES)}
shot (enquadramento):
${list(SHOTS)}
intensity: número de 0 a 1 (quão forte é o movimento de câmera; 0.5 a 0.8 é natural).
board: true mostra um quadro de ilustração ao lado do personagem (bom para explicar conceitos abstratos); false é uma cena "de mundo" com personagem e cenário (bom para narrativa: escalar, viajar, correr, praia...).
REGRAS:
- Ilustre o que a frase diz de forma literal (montanha → summit; dinheiro → office/hold_coins; celular → hold_phone).
- Varie: nunca repita o mesmo cameraMove com o mesmo shot em cenas seguidas. Alterne planos abertos, médios e fechados.
- Se a cena pedir algo que as listas não permitem (ex.: personagem nadando, voando, dois personagens), escolha a opção mais próxima e descreva o que faltou em "unsupported" (frase curta em português). Nunca finja que o motor sabe fazer.
- Não escreva nem altere o texto das cenas.
EXEMPLO: cena "${EXAMPLE_TEXT}" => ${JSON.stringify(EXAMPLE_DIRECTION)}`;

const str = (values: readonly string[], description?: string) => ({ type: 'string', enum: [...values], ...(description ? { description } : {}) });

/** Schema (JSON Schema simples, aceito pela saída estruturada do Gemini) da resposta: uma direção por cena, ligada pelo índice. */
export function directionSchema(maxScenes = 40) {
  return {
    type: 'object',
    properties: {
      directions: {
        type: 'array',
        maxItems: maxScenes,
        items: {
          type: 'object',
          properties: {
            index: { type: 'integer', minimum: 0, description: 'Número da cena, começando em 0.' },
            environment: str(ENVIRONMENT_IDS),
            outfit: str(OUTFIT_IDS),
            action: str(ACTION_IDS),
            entrance: str(ENTRANCE_IDS),
            expression: str(EXPRESSION_IDS),
            placement: str(PLACEMENTS),
            props: { type: 'array', maxItems: 3, items: str(PROP_IDS) },
            cameraMove: str(CAMERA_MOVE_IDS),
            shot: str(SHOT_IDS),
            intensity: { type: 'number', minimum: 0, maximum: 1 },
            board: { type: 'boolean' },
            unsupported: { type: 'array', maxItems: 5, items: { type: 'string' } },
          },
          required: ['index', 'environment', 'action', 'entrance', 'expression', 'cameraMove', 'shot', 'intensity', 'board'],
        },
      },
    },
    required: ['directions'],
  } as const;
}

/** Monta o pedido de direção para a lista de cenas (só os textos: a IA não pode alterá-los). */
export function directionPrompt(texts: string[]) {
  return `${DIRECTION_GUIDE}\n\nCENAS (índice: texto):\n${texts.map((t, i) => `${i}: ${t}`).join('\n')}\n\nResponda uma direção para cada cena, com o campo index igual ao número da cena.`;
}
