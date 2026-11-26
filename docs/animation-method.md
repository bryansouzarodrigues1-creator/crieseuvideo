# Como as animações são montadas (método de direção)

Uma animação não é escrita como curvas soltas. Ela é uma **direção**: um elenco + verbos por cena.
O compilador (`src/studio/explainer/sceneProgram/direction/direction.ts`) transforma isso num
`SceneProgram`, e o `normalizeSceneProgram` continua sendo a única barreira de segurança.
Exemplo completo: `demo/moneyWithdrawalDirection.ts` (vídeo de 52 s, 7 cenas).

## 1. Elenco (`cast`)
O que existe no mundo: `model` (GLB aprovado em `modelRegistry.ts`), `mesh`, `actor` (figura gerada em
código, sem GLB), `group`. `hidden: true` começa invisível (escala 0,01; a engine não tem canal de visibilidade).

## 2. Uma cena por frase do roteiro
Cada cena tem `sourceId`, a **câmera** (`subjects`, `azimuth`, `endAzimuth`, `elevation`, `distance`) e a lista de **verbos**.
Todo verbo tem uma janela `at: [de, até]` em fase 0..1 dentro da cena (padrão `[0,1]`).

## 3. Verbos
| verbo | efeito |
|---|---|
| `appear` / `vanish` | cresce até a escala do elenco / some (escala 0,01) |
| `move` (`to` ou `by`), `scale`, `turn` | transformação do nó |
| `open` / `close` / `rotatePart` / `spin` | gira uma **peça interna** de um GLB (porta, volante) em um eixo |
| `drive` | anda por um vetor e gira as rodas (`distância / raio`), sempre linear |
| `roll` | disco em pé rolando em +X; gira pelo CENTRO (usa chaves densas) |
| `rise` | altura de uma barra que cresce a partir da base (gráficos) |
| `pose` | pose do ator (`rest`, `surprised`, `head`, `shrug`) + emoção |

## 4. Regras que o compilador garante
- **Sem lacunas:** antes de cada verbo ele grava uma chave que *segura* o valor anterior; nada "escorrega" entre cenas.
- **Sem sobreposição:** dois verbos na mesma propriedade (nó + canal + peça) com janelas cruzadas dão erro. Propriedades diferentes podem se sobrepor.
- **Suave ou linear, não os dois** na mesma propriedade.
- **Pivots dos GLBs são sagrados:** só a rotação das peças é alterada.
- **Cada movimento prometido vira uma verificação** (`motionChecks`, no máximo 60, as maiores primeiro): um verbo que quase não se move falha antes de exportar.

## 5. Como usar
```ts
const program = compileDirection(direction, sources);   // sources = frases com duração
```
O formato é JSON puro de propósito: um modelo de linguagem pode escrever a direção em vez de curvas cruas.
## O Gemini escreve a direção

`direction/aiDirection.ts` ensina o Gemini a escrever esse JSON em vez de trilhas cruas:

- `directionPrompt(sources)` monta o prompt com o roteiro, as regras e o **catálogo de modelos**, lido de `modelRegistry.ts` (campo `catalogue`: tamanho, peças, eixos, ângulo de abertura, raio de roda). Registrar um modelo com `catalogue` é tudo para oferecê-lo à IA; nada é fixo no código.
- `directionResponseSchema(ids)` é o `responseSchema` do Gemini (dica, não segurança).
- `parseDirection` valida com lista de campos permitidos e **preenche os padrões do catálogo** (ângulo de porta, nomes e raio das rodas, raio da moeda × escala), então a IA diz *o que acontece*, não números do motor.
- `checkDirectionAnswer` é o validador do provedor: só aceita o que passa por `parseDirection` + `compileDirection` + `normalizeSceneProgram`.
- Servidor: `generateAi3DDirection` em `ai3d.functions.ts`, com login, `confirmCost`, uma chamada por vez, cooldown compartilhado, sem retry escondido e sem vídeo de demonstração como substituto. Aceita 1–8 frases, até 60 s.

`drive` anda sempre **para a frente do veículo** (+Z girado pelo yaw); movimento de lado é rejeitado.

Falta: revisão visual (Gemini Vision sobre quadros renderizados), mais verbos (andar, pegar, carregar), checagem de colisão e mais modelos no catálogo.

## 6. Como saber se ficou bom
`npx vitest run src/studio/explainer/sceneProgram` e, para olhar de verdade, renderizar quadros por cena
no navegador (ver `deterministic3dExport.ts`).
