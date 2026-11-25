# Camada de IA agnóstica de provedor (`src/studio/ai`)

Um único jeito de chamar qualquer IA por API. Cada pipeline (3D, Motion 2D, Cinema 2D, direção semântica) pode usar o mesmo roteador.

## O que resolve (todos com teste)
| Problema real | Comportamento |
|---|---|
| 503 "alta demanda" (visto em `gemini-3.8-flash`, 2×) | repete no MESMO provedor com espera exponencial + jitter e respeita `Retry-After` |
| Resposta cortada (`MAX_TOKENS`; o raciocínio comia o limite de saída) | uma repetição com o dobro de tokens de saída e um nível a menos de raciocínio |
| 429 / cota | pausa o provedor (usa `Retry-After`) e passa ao próximo; nunca martela |
| Gasto silencioso | provedores `paid:true` são pulados, a menos que `allowPaid` / `AI_ALLOW_PAID=1` |
| Cotas grátis (ex.: 20 req/dia) | contador diário local por modelo, para parar antes do provedor negar |
| Custo desconhecido | tokens por chamada; custo só se o preço foi informado (nunca chutado) |
| JSON mal formado ou cena impossível | `askStructured`: valida e devolve ao modelo o MOTIVO MEDIDO, no máximo 1 reparo |
| Schema | Gemini `responseSchema`, OpenAI `json_schema`, Anthropic ferramenta forçada |

Provedores: `gemini`, `openai-compatible` (OpenAI, Groq, OpenRouter, DeepSeek, Mistral…), `anthropic`.

## Configuração (variáveis do servidor; nunca no chat nem no repositório)
`GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` + `OPENAI_MODEL`.
`AI_CHAIN="gemini,gemini-lite,groq,openrouter,anthropic"` define a ordem. `AI_ALLOW_PAID=1` libera Anthropic/OpenAI.
Modelos sobrescrevíveis: `GEMINI_AI_MODEL`, `GEMINI_LITE_MODEL`, `GROQ_MODEL`, `OPENROUTER_MODEL`, `ANTHROPIC_MODEL`.
Os IDs padrão do Gemini 3.x, do Flash-Lite, do Groq e do OpenRouter não foram verificados contra as APIs: confirmar nos painéis.

## Direção semântica (`sceneProgram/direct`)
O modelo escolhe verbos e câmeras de listas fechadas (~400 bytes de resposta); um compilador determinístico gera o `SceneProgram` completo
e os validadores do motor (IK, apoios, penetração) o aprovam. Se a cena é impossível, o motivo medido volta ao modelo (1 reparo).
Parede alta demais para a frase é encurtada automaticamente (com aviso), sem gastar chamada.

## Medir antes de decidir
`AI_SMOKE_EXPLICIT_RUN=1 GEMINI_API_KEY=… bun scripts/ai-smoke.ts` roda as mesmas 4 histórias em cada provedor e imprime:
aprovados (passaram nos validadores do motor), reparos, falhas, latência p50/p95, tokens e **custo por vídeo aprovado**.
`AI_SMOKE_DRY=1` testa o próprio script sem rede. Nunca ligar ao CI automático (gasta cota).

## Limites conhecidos
- Contadores de cota e pausas ficam na memória do processo; em serverless com várias instâncias, trocar por um `QuotaStore` persistente.
- Os adaptadores foram testados com respostas simuladas no formato documentado de cada API; ainda falta uma execução real com chaves.
- Esta camada ainda não está ligada ao `director.ts` da `main`; os pipelines existentes continuam com seus próprios helpers.


## Atualização 2026-11-25 (integração)
- `createBudget` / `router.budget`: orçamento por vídeo compartilhado entre todas as chamadas; ver `docs/integration-ai-engine.md`.
- Truncamento em `thinking: high` mantém High e dobra o espaço de saída.
- `billing: free | unverified | paid` por provedor; `AI_REQUIRE_VERIFIED_FREE=1`; `<PROVEDOR>_BILLING`.
