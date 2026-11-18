# CrieSeuVideo — planejador de acontecimentos 3D, etapa 1

## Objetivo

Separar **compreender a história** de **desenhar e animar**. O planejador não
gera caixas, coordenadas nem movimentos arbitrários. Ele registra uma sequência
de fatos para o motor executar e verifica suas pré-condições.

Este trabalho foi feito em uma branch isolada a partir do SHA `5e76ac5` do
PR #39. Nenhum arquivo de colisão/aparência, cofre de peças, Supabase, rota
de produção ou `main` foi modificado.

## O que o contrato já faz

- Identidades persistentes: atores, objetos transportáveis (`prop`),
  mecanismos e locais.
- Estado inicial e resultado: `at`, `heldBy`, `on`, `active`, `mode`.
- Ações: `focus`, `move`, `pick_up`, `carry`, `put_down`,
  `activate`, `deactivate`, `operate`, `change`, `react`.
- Dependências e ordem dos fatos: `dependsOn` cita ações concluídas, eventos
  mantêm ordem temporal e IDs existentes do roteiro. Trecho `evidence`
  precisa existir literalmente na fala original.
- Restrições de causalidade: não transportar sem estar segurando, não apoiar
  longe do ator, não usar motor desligado, não mover carga por mecanismo
  que não a controle, não dar apoio em objeto distante.
- Propagação de objetos sobre outros: mover uma plataforma leva junto a
  **mesma** carga apoiada sobre ela. Não é criada uma nova caixa no andar
  superior.
- Relatório de mudanças por evento (`effects`) e estados finais
  (`finalStates`). Avisos de trechos sem acontecimento e excessos de foco.

A interface é `compileStoryEvents(proposal, sourceBeats)` em
`src/studio/explainer/sceneProgram/planner/events.ts`. O prompt da futura
etapa de direção é produzido por `storyEventsPrompt()`, em `prompt.ts`,
que **não chama nenhuma IA por conta própria**.

## Exemplo conceitual

No vídeo da obra, um evento `pick_up` muda a caixa de livre para
`heldBy: trabalhador`. `carry` muda a posição do trabalhador e da mesma
caixa. `put_down` deixa `on: plataforma`. `activate` liga o guincho.
`operate` exige o guincho ativo e controlar a plataforma; move a
plataforma e também a caixa apoiada.

A linguagem de eventos não usa metro, eixo XYZ, curva ou câmera. Isso é
proposital: o motor poderá escolher uma ação visual adequada sem alterar
o fato narrado.

## O que NÃO está concluído

1. Nenhuma chamada real ao Gemini foi feita. O planejador ainda não foi
   conectado a `src/studio/server/director.ts`, de propósito para evitar
   conflitos com outro agente no PR #39.
2. O `sceneProgram` atual ainda não reproduz automaticamente eventos
   desse contrato. Falta o **compilador de ações** (eventos -> movimentos
   e relações físicas), tratamento de falhas, asset resolver e sincronização
   com voz/legendas.
3. A `evidence` literal não comprova o significado de uma cena. Por
   exemplo, uma frase de um roteiro pode ser mal interpretada mesmo citada
   corretamente. A etapa semântica ainda requer avaliação do modelo e
   revisão humana da animação.
4. Sem vídeo novo, não há prova de melhoria visual ainda.
5. O contrato v1 impõe limites e serialização conservadora quando duas
   ações disputam o mesmo objeto/ator. Concorrência física avançada é
   parte da próxima etapa, não foi simulada aqui.

## Próxima ordem de implementação

**P0:** integrar o PR #39 na branch de integração primeiro, com migração
do cofre ainda desativada; resolver a divergência com os PRs #46-#48
usando diff e testes, não um merge cego. Esta branch do planejador
foi deliberadamente iniciada em cima do #39 para minimizar conflito.

**P1:** criar executor/compilador que interpreta `effects` e agenda ações
no Three.js: pegar/soltar, apoio, percurso, funcionamento de mecanismo.
Não derivar a posição da carga e rotação do motor por curvas independentes
sem conexão física.

**P2:** usar o Gemini para criar primeiro esse JSON de fatos, validar;
somente depois solicitar modelos/movimentos para os fatos aprovados.
Exigir decisões explícitas para reparo e limites de custo/cota do usuário.

**P3:** renderizar 3 roteiros inéditos e revisar se objetos preservam
identidade, se cada ação exibe causa/consequência, e se narração/
legendas correspondem aos acontecimentos. Só então iniciar deploy.

## Critério de verdade

Passar em unitários, TypeScript e build demonstra **integridade de
software**, não animação profissional. Nenhum código desta etapa foi
publicado em `main` ou implantado no Lovable.
