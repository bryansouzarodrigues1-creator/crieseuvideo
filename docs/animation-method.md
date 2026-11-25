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
O formato é JSON puro de propósito: um modelo de linguagem escreve a direção em vez de curvas cruas.
**Ligado ao roteador de IA** (`direction/viaRouter.ts`, `directViaRouter`): forma `full` = este elenco + verbos
(com o catálogo de modelos aprovados no prompt); forma `compact` = só um verbo por frase. As duas passam pelo MESMO
`compileDirectionDetailed`. Veja `docs/integration-ai-engine.md`.

## 5b. Ator na montanha (verbos de ator)
Com `world: { kind: 'cliff', height, mood }` e um ator de id `hero`, uma cena pode ter UM verbo de ator em `hero`:
`walk` · `climb` · `plant` · `celebrate` · `stand`. O corpo, a passada, os apoios e as janelas de contato vêm dos
verbos de corpo medido (`direct/verbs.ts`); ninguém escreve coordenadas. Os outros membros do elenco continuam usando os
verbos de elenco na mesma direção. `hero` não aceita outros verbos (conflito é erro explicado).

## 6. Como saber se ficou bom
`npx vitest run src/studio/explainer/sceneProgram` e, para olhar de verdade, renderizar quadros por cena
no navegador (ver `deterministic3dExport.ts`).
