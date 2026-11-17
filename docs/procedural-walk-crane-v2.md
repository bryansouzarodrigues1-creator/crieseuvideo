# CrieSeuVideo — Caminhada procedural da grua (PR #41)

**Data:** 17/11/2026. **Branch:** `experiment/procedural-walk-crane-20261117`, empilhada sobre o PR #40; **nenhuma mudança na `main`**.

## Resultado validado

GitHub Actions: https://github.com/bryansouzarodrigues1-creator/crieseuvideo/actions/runs/44088050559 — **sucesso**.

- Testes automatizados de auditoria/continuidade/caminhada, TypeScript e build aprovados.
- Chromium com WebGL renderizou a mesma história de 20 s e exportou vídeo **H.264, 720 × 1280, 30 FPS, 600 quadros**.
- Controle H.264 vs quadro final de preview: diferença média **1,425 / 255**.
- Uma resposta simulada do provedor, **zero chamadas reais a Gemini, ElevenLabs ou Lovable**.
- Diagnóstico do motor nos quadros 8%, 34%, 67%, 98%: `proceduralWalkActors: ['worker']`; `maxIKError` próximo de zero (inferior a 1e-12), sem avisos da auditoria independente.

## Implementação

O módulo genérico `src/studio/explainer/sceneProgram/proceduralWalk.ts` analisa o caminho horizontal de um ator e, sem criar novos comandos em JSON, calcula automaticamente:

1. orientação em Y a partir da direção local da trajetória;
2. alternância de pés guiada pela **distância percorrida** (não por um relógio aleatório);
3. pontos de apoio estáveis no mundo durante a fase de apoio e arcos de levantamento somente durante o passo;
4. balanço limitado de braços e quadril; acomodação quando para;
5. poses determinísticas em qualquer ordem de amostragem da timeline.

A solução só é ativada para trajetórias suficientemente longas e praticamente planas, sem contato explícito, rotações ou trajetórias de pés já definidas pelo diretor. Escalada, salto, plataformas móveis, desníveis e física complexa **não foram implementados** por este recurso. O rig mantém o alcance real dos ossos; os sapatos são deslocados em relação ao tornozelo para permanecer no chão.

A fixture `craneExperiment.ts` teve removidas as curvas manuais de pés, a fim de provar que o motor executa o novo movimento por conta própria. Os ângulos de câmera ficaram fixos em cada frase para evitar órbitas sem motivo.

## Comparação visual honesta

A amostra de quadro único do personagem em 1,3 s, 2,5 s e 3,7 s mostra:

- **Antes:** o tronco permanece quase frontal enquanto o ator se desloca lateralmente; passadas pouco reconhecíveis.
- **Depois:** perfil orientado no sentido do deslocamento, pernas se alternam e o peso do corpo responde aos passos.
- **Ainda insuficiente:** expressão/gestual simples; cenário vazio; texto ocupando a parte inferior da ação; o enquadramento da roldana/guincho ainda não demonstra suficientemente a conexão física do motor com a corda e a carga.

A variação **X da posição da câmera** nos quatro instantes auditados caiu de aproximadamente **5,12 m para 2,43 m** (cenas ainda não equivalentes em enquadramento). Isso não é medição de suavidade em cada frame e não prova câmera cinematográfica.

## Próxima etapa recomendada

Não alterar a `main`. Testar direção visual sincronizada com cada fala, câmera por acontecimento e contato real com prop/corda; depois integrar biblioteca de animações de personagens com IK de mãos e terreno.

O vídeo continua escrito como fixture **por agente**, não produzido autonomamente pelo Gemini. Um teste real e autorizado com o Gemini será necessário para validar geração sem autoria manual.
