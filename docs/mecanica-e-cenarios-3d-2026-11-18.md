# CrieSeuVideo — mecânica causal + variedade de ambientes 3D

Data da implementação: 18/11/2026. Este é um **laboratório técnico isolado** na pilha PR #39 → #50 → #51. Nenhuma alteração publicada na `main`.

## Por que esta etapa existe

Até o PR #51 o planejador determinava a posição da carga, mas o motor visual girava por um total de voltas arbitrário (parâmetro `motorVisuals.revolutions`). Isso permite animações numericamente válidas mas sem relação física.

O trabalho complementar do Claude já possui um gerador procedural 3D de terreno, água, árvores, rochas e nuvens em `feat/3d-scenery-kit`. **Não duplicamos nem reescrevemos esse kit**. A integração dos dois trabalhos exige resolver as branches e validar a composição no navegador.

## O que mudou no compilador

- `mechanicalDrives` acrescentado como vínculo opcional entre mecanismo semântico e objeto movido.
- `mechanicalDrives[mecanismo] = {output, radius, travelDirection, parts}`.
- `radius` é o raio efetivo em metros do tambor ou roda; `travelDirection` é direção normalizada de movimento.
- Cada peça em `parts` tem um nó 3D verdadeiro, eixo de rotação e razão assinada de engrenagem.
- Para o evento `operate`, o compilador calcula **ângulo = deslocamento projetado / raio × razão**, com sinal. Se a carga volta, a peça gira ao contrário.
- Peças rotativas precisam estar hierarquicamente vinculadas à máquina ou à carga, não serem objetos soltos.
- Rejeita eixo ausente, dois motores controlando o mesmo nó, giro manual contraditório, deslocamento fora do eixo, razão/raio/índice inválidos e `motorVisuals` arbitrário quando `mechanicalDrives` está ativo.
- O Gemini na etapa opcional de modelagem agora pode declarar `mechanicalDrives` sem gerar keyframes de movimento por conta própria; o schema é normalizado com limites de quantidade e valores. **Ainda não foi validada uma geração ao vivo do Gemini.**

## Cenários diferentes usados na prova

| Ambiente | Objeto | Máquina | Mecânica comprovada |
| --- | --- | --- | --- |
| Oficina | caixa de ferramentas | motor de esteira | deslocamento linear e tambor |
| Cidade | carrinho de materiais | guincho de armazém | transporte e engrenagens contrarrotativas |
| Porto | barco pequeno | guincho do cais | deslocamento na água e tambor |

Esses modelos são **fixtures de laboratório**, produzidos em primitivas Three.js com contexto visível, não cenários comerciais aprovados nem objetos gerados autonomamente por IA. As transições são programadas pelos mesmos eventos, e o ângulo de duas engrenagens é calculado pelo mesmo motor em todas as situações.

## Ainda faltam

- A transmissão atual é **cinemática**: não calcula torque, peso, tensão de cabo, engrenagens rígidas, colisão universal, flutuação do barco ou resistência do terreno.
- As cenas de cidade/porto usam guincho visível, mas ainda não têm uma corda fisicamente contínua conectando a máquina ao carrinho/barco; isso será um gate de plausibilidade visual antes de produção.
- Falta navegação por obstáculos, resposta de suspensão de carro/veículo, interação humana corporal completa e gestos com dedos.
- O kit de paisagem do Claude está em **outra branch**; não há razão para fingir que ele já está integrado com este compilador.
- O modo `motorVisuals` legado segue aceito apenas onde não foi fornecida uma transmissão cinemática causal.
- O laboratório não usa narração, Gemini real, APIs pagas nem faz deploy.

## Verificações

`mechanicalDrives.test.ts` executa os três ambientes no `SceneProgram3D`, testa vínculo entre distância e velocidade angular, sinal inverso, contato de hierarquia e detecção de entradas inválidas. `storyboardPipeline.test.ts` rejeita respostas com campos mecânicos não autorizados. O workflow de render cria um MP4 de 18 segundos (3 × 6) com nove quadros de controle e relatório por cenário.

A aprovação de testes de software **não** deve ser descrita como qualidade de animação natural. Somente revisar os quadros finais pode revelar onde a câmera, a conexão física e os objetos ainda falham.

## Estratégia segura de integração

1. Manter PR #51 isolado e este trabalho como PR dependente.
2. O Claude finaliza o cenário e validação visual na branch `feat/3d-scenery-kit`.
3. Criar branch específica de integração com revisão dos diffs; reconciliar os schemas de geometria e ações por testes. Não misturar dois agentes na mesma branch.
4. Construir três histórias totalmente inéditas pelo Gemini real **somente após autorização e configuração de credenciais seguras**, validar e aprovar visualmente antes de publicar.
