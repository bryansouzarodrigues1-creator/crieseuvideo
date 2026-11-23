# O problema real do CrieSeuVideo (e o que foi construído contra ele)

Análise do repositório inteiro + da integração com o Gemini. Todos os números abaixo vêm de arquivos do repositório
(`scripts/live/*.project.json`, `scripts/fixtures/titanic.mjs`, `sceneProgram/fixtures.ts`) ou de testes executados.

## Diagnóstico

**O motor não é o gargalo. O gargalo é o nível de abstração em que o Gemini é obrigado a trabalhar.**

1. **O Gemini escreve números espaciais às cegas, em uma única chamada.** Em `sceneProgram/guide.ts` o modelo recebe a tarefa de
   devolver nós, geometrias, curvas por frase, alvos de IK *globais* (mãos/pés), contatos com offsets locais, câmera e
   verificações de movimento: tudo coordenada crua, sem ver o resultado.
2. **O motor sabe muito mais do que o modelo consegue expressar.** Medido:

   | Programa | Nós | Chaves | Contatos | Tamanho |
   |---|---|---|---|---|
   | Fixture do Titanic (escrito por dev) | 81 | 100 | — | ~52 KB |
   | Everest real do Gemini (`everest-attempt-3`) | 8 | 28 | **0** | ~4,8 KB |

   O mesmo motor renderiza o Titanic bonito e o Everest do Gemini com um cone de 2,5 m (o ator tem 2,25 m) onde o
   alpinista já nasce enterrado e a plataforma do cume fica dentro da montanha.
3. **Os validadores pegam erro numérico, não erro de intenção.** `maxIKError < .025`, `validateGroundedAscent`,
   `rejectSolidAscentPenetration` impedem exportar lixo, mas dizem só "fora do alcance". O modelo nunca é avisado em
   linguagem de cena ("essa parede exige passos de 90 cm").
4. **Só existem 3 chamadas reais ao Gemini** (todas Everest, `scripts/live/`). Qualquer ajuste de prompt é cego.
5. **Cinco caminhos fragmentados** (Motion 2D, Toon 3D clássico, SceneProgram, Código 3D, HTML externo): melhorias num não chegam aos outros.
6. **Sincronia só no nível da frase** (fase 0..1 dentro da frase), não da palavra.
7. **Sem saída estruturada**: `ai.ts` pede JSON por MIME type, sem `responseSchema`.
8. **O orçamento de nós do prompt empurra o modelo para primitivas** (caixas, cones) em vez de composição.
9. Até a escalada escrita por dev (`climbing()`) sobe só ~1,1 m: a competência do motor foi demonstrada, não generalizada.

## O que foi construído: direção semântica (`sceneProgram/direct/`)

O Gemini passa a escrever um plano de ~1 KB — **verbos e câmeras de listas fechadas, sem coordenadas**:

```json
{ "world": {"kind":"cliff","height":3.3,"mood":"dusk"}, "hero": {"color":"#DF6B35"},
  "beats": [ {"sourceId":"s1","verb":"walk","camera":"follow","from":"left"},
             {"sourceId":"s2","verb":"climb","camera":"follow"},
             {"sourceId":"s3","verb":"plant","camera":"close"},
             {"sourceId":"s4","verb":"celebrate","camera":"orbit"} ] }
```

Um compilador **determinístico** (`compile.ts`, `verbs.ts`, `world.ts`) transforma isso no `SceneProgram` completo usando as
medidas reais do ator (altura, alcance do braço/perna, passo):

- escala consistente por construção (parede, apoios, bandeira derivados da altura do ator);
- escalada de 4 membros com alternância, contatos gerados **junto** com as chaves de pose (nunca divergem);
- marcha com passos limitados ao alcance da perna; continuidade de pose entre verbos (a pose de cada canal global é
  mantida até a próxima chave, por isso cada verbo começa de onde o anterior terminou);
- verbos consecutivos iguais viram **uma ação contínua** (o motor divide frases longas em pedaços);
- **realimentação medida**: se a frase é curta demais para a parede, o compilador devolve ao Gemini o motivo ("cada passo
  teria 90 cm; reduza world.height para no máximo 2.0 m") e faz uma rodada de reparo (`run.ts`).

Resultado, no mesmo caso de teste: 23 nós, 333 chaves, 26 contatos, ~37 KB de programa gerado a partir de ~1 KB de plano; passa
em `validateContacts()` (IK, apoios, penetração) e renderiza pelo servidor, UI e exportador reais.

## Limites (honestidade)

- O Gemini **real não foi chamado** (sem chave/cota no ambiente de teste): os planos dos testes foram escritos à mão como o
  modelo deveria responder. Falta medir quanto o Gemini acerta verbos/câmeras (esperado: bem mais que coordenadas).
- Hoje só existe o mundo `cliff` e 5 verbos. O ganho vem de crescer essa biblioteca (mundos: floresta, mar, cidade;
  verbos: carregar, empurrar, nadar, apontar) — cada peça nova é reaproveitada por qualquer roteiro.
- Sincronia ainda por frase; ancorar verbos em palavras é o passo seguinte.
- Não toca nos outros quatro caminhos: consolidar projeto/áudio/legenda/exportação continua pendente.
