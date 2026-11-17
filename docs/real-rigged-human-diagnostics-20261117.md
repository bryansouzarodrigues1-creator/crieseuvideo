# CrieSeuVideo — integração de personagens articulados reais (pesquisa isolada)

Data: 17/11/2026. Branch experimental do PR #44, empilhado sobre #42. **Não houve merge/publicação.**

## Objetivo concreto, derivado da referência enviada

Criar 8 segundos com dois personagens humanos articulados em um interior colorido, um deles caminhando até uma ferramenta, demonstrando interação e entregando-a ao segundo. A prova deve usar animações reais de esqueleto, com geometria coerente e ferramenta presa ao pulso, sem simular a qualidade com caixas.

## Recursos reais verificados

Origem: Quaternius *Ultimate Modular Men Pack*, CC0, via fonte pública
`nishit47/Blender-Pre-vis-Pipeline---Screenplay-to-Animatic`, commit `6d6de54a1d7143cf5487462d147bbef039de4837`.

- `Worker.glb` — 1.344.928 bytes; SHA Git blob `eb29e2adb795972e1f475cd25a000975fe260aa9`.
- `Casual Character.glb` — 1.430.660 bytes; SHA Git blob `f31ba8b389268d4df6005cc62d4d7011de728bce`.
- Cada um: 24 clips, entre eles `Walk`, `Idle_Neutral`, `Interact`. Quatro partes de malha (pés, pernas, corpo, cabeça) que compartilham os mesmos 62 índices de ossos. Pulso direito/esquerdo existe como `Wrist.R`/`Wrist.L` no GLB.
- **Não há clip específico de PickUp.** `Interact` não prova uma pegada/entrega convincente.
- Verificação CI passou: https://github.com/bryansouzarodrigues1-creator/crieseuvideo/actions/runs/44117023652 .

## Alterações de engenharia já realizadas

1. A versão anterior de `modelAssets.instantiateModel()` reproduzia TODOS os clips ao mesmo tempo. Corrigido para reproduzir apenas um clip dirigido, em modelo GLB clonado com esqueleto.
2. `RiggedClipPlayer` permite selecionar clips existentes, tempo absoluto, limites de velocidade e nomes de articulações; rejeita ações inventadas sem substituí-las silenciosamente.
3. `SceneProgram3D` aceita que uma peça seja filha do socket de um modelo importado, por exemplo, `rightHand`; falta ainda um schema de direção por clips para geração autônoma de roteiros.
4. Laboratório de duas pessoas foi escrito como **fixture por agente**; nenhum Gemini real participou.
5. Arquivos GLB CC0 apenas em CI e artefatos temporários, não cadastrados como assets públicos do site.

## Resultado da validação real de reprodução

**Não aprovado.** O laboratório de navegador recusou montar o vídeo pois a posição do pulso salta ao trocar de clip.

Evidência: https://github.com/bryansouzarodrigues1-creator/crieseuvideo/actions/runs/44121923321

- Pulso Worker em `t=0`: aproximadamente `[-1.192, 1.144, 0.247]` metros.
- Pulso em `t=3.55`: `[-0.593, 8.599, 7.906]` metros.
- Pulso em `t=5.82`: `[-1.503, -0.830, 10.587]` metros.
- Pulso do Casual em `t=5.82`: aproximadamente `[0.630,1.399,-0.205]` metros.
- O teste reprova porque as mãos diferem mais de **2,22 m na vertical** após aproximação no plano horizontal. Nenhum MP4 deve ser divulgado como sucesso.

O GLB bruto foi analisado separadamente: seu pulso direito em repouso está perto de `[-0.225, 1.037, 0.145]` m; interpolando as curvas originais `Idle_Neutral` e `Interact`, os ossos permanecem aproximadamente dentro do tamanho de um humano (pulso ~1,0–1,4 m de altura). Portanto, os saltos são um problema **da avaliação/reprodução no Three.js desta integração**, não evidência de que o arquivo original está deformado.

Testamos resetar a pose-base e alternar ações por pesos, mas ambos os ensaios continuaram reprovando no teste real. Não considerar essas abordagens uma solução sem prova visual.

## Próximo passo real, sem alternativas ilógicas

Instrumentar `GLTFLoader` + `AnimationMixer` com uma inspeção dos ossos de fato usados em `SkinnedMesh.skeleton` e comparar world matrices antes/depois de avaliar **cada clip isolado**. Somente depois de identificar a transformação que introduz o salto, renderizar os oito segundos, avaliar os quadros e integrar clips/contatos ao schema seguro de SceneProgram.

**Critério de aprovação:** dois humanos visíveis e com poses coerentes, nenhuma articulação fora do corpo, transição entre clips sem salto, ferramenta com continuidade espacial e MP4 de oito segundos realmente produzido pelo motor. CI de sintaxe ou unitários não substitui a prova de navegador.

Não mexer na `main`, não publicar no Lovable e não ativar chamadas reais Gemini até resolver esse bloqueio.
