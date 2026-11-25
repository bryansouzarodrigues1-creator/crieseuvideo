# Integração: roteador de IA + direção por verbos + revisão visual (branch `integration/ai-engine-20261125`)

Um motor, um compilador, um orçamento. Nada de motor paralelo.

```
roteiro ──► directViaRouter ──► compileDirectionDetailed ──► SceneProgram ──► motor (stage3d)
              │  (forma compact | full)   ▲ cast verbs + verbos de ator            │
              │  reparo medido (1x)       └────────── mesmo compilador              ▼
              ▼                                                          quadros reais (3–7)
        roteador (Gemini/Groq/OpenRouter/Anthropic…)                                │
              ▲  mesmo Budget do vídeo                                              ▼
              └────────────── reviewDirection (imagens + High) ◄────────────────────┘
                                   │ corrigido? só se contar a MESMA história, compilar e não piorar as medições
                                   ▼
                              exportVideo (MP4)
```

## O que existe
| peça | arquivo |
|---|---|
| Roteador (retry, 429, cotas locais, custo) | `src/studio/ai/router.ts` |
| **Orçamento por vídeo** (chamadas e custo, compartilhado) | `src/studio/ai/budget.ts` |
| Direção: elenco + verbos **e** verbos de ator | `.../sceneProgram/direction/direction.ts`, `locomotion.ts` |
| Plano compacto → Direção (não é outro compilador) | `.../sceneProgram/direct/compile.ts` (`semanticToDirection`) |
| Entrada única da IA | `.../direction/viaRouter.ts` (`directViaRouter`) |
| Revisão visual da Direção (qualquer provedor, via imagens) | `.../direction/visualReview.ts` |
| Laço planejar→ver→corrigir→exportar | `.../direction/autonomous.ts` (`produceDirectedVideo`) |
| Serviço de servidor + função autenticada | `src/studio/server/directionService.ts`, `src/studio/directScene.functions.ts` |
| Revisão visual da **grua** (PR #124), intacta | `src/studio/server/geminiVisualReview.ts` |

## Regras do orçamento
- `AI_VIDEO_MAX_CALLS` (padrão **5**) e `AI_VIDEO_MAX_COST_USD` (opcional) valem para o vídeo inteiro: planejamento, reparo, revisão. Cada tentativa HTTP, inclusive retry, conta.
- Reparo de plano e revisão visual **não** reiniciam a contagem. Esgotou → `budget_exhausted`, nada é enviado.
- O servidor guarda o orçamento por `usuário:videoId` por 30 min (em memória). O cliente manda o mesmo `videoId` no plano e na revisão.
- Fluxo normal = 2 chamadas (plano + revisão); com reparo, 3.

## High
Planejamento e revisão pedem `thinking: high`. Se a resposta for cortada, o roteador **dobra o espaço de saída e mantém High** (os níveis menores ainda descem um degrau).

## Custo: o que "gratuito" significa aqui
Uma chave sozinha não prova que a conta não cobra. Cada provedor tem `billing`:
- `free`: confirmado (`<PROVEDOR>_BILLING=free`) ou modelo OpenRouter `:free`;
- `unverified` (padrão do Gemini e Groq): alcançável, mas limitado pelo contador diário local; `AI_REQUIRE_VERIFIED_FREE=1` o bloqueia;
- `paid`: Anthropic/OpenAI, ou OpenRouter fora de `:free`; só com `AI_ALLOW_PAID=1`.
Se a conta do Gemini tem faturamento ligado, defina `GEMINI_BILLING=paid` (e `AI_ALLOW_PAID=1` só se quiser autorizar). Os contadores são em memória.

## Política de falha do laço
Plano falhou → para (nada a exportar). Revisão falhou/rejeitada → **exporta o original**. Exportação falhou → reporta.

## O que NÃO está provado
- Nenhuma chamada real aos provedores a partir desta branch (testes com respostas simuladas no formato de cada API). A prova real do Gemini High é a do PR #124 (revisão da grua).
- `renderFrames`/`exportVideo` são injetados: a ligação com a UI do estúdio (capturar quadros do canvas e chamar `reviewDirectedScene`) ainda não foi feita.
- A revisão da Direção e a da grua (PR #124) são duas funções para dois formatos (cast+verbos vs. plano compacto de entidades). A grua ainda não foi migrada para Direção.
