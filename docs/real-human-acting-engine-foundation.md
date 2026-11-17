# Base técnica do novo motor de atuação 3D

Data: 17/11/2026. Pesquisa isolada sobre PR #44; nada publicado na main.

## Diagnóstico fundamentado

O vídeo real Gemini de 12 segundos movimentava coordenadas de corpo, mão e caixa, mas não havia atuação: nenhum agachamento real, nenhuma pegada física, cenário muito vazio e 85 de 360 quadros reprovados por alcance IK.

O GLB CC0 Quaternius Worker usa Armature com escala interna 100x e quatro SkinnedMeshes. Box3.setFromObject inflou os limites do modelo. O laboratório aplicou escala ~0.02947 e gerou um trabalhador minúsculo. A correção riggedScale.ts mede cabeça e pés do esqueleto real, não os limites de malha. O Chrome testou Walk, Idle_Neutral e Interact, isoladamente e em sequência, com posições de punho na faixa ~1.09 m a ~1.52 m sem saltos. Testes unitários cobrem escala 100x e malhas com limites exagerados.

Esta evidência não comprova captura de movimento, agachamento ou pegada convincente. A sequência completa de dois humanos continua um teste separado. O sucesso do RiggedClipPlayer em uma cópia calibrada não identifica sozinho a causa completa das falhas do laboratório antigo, que usava a cena GLB original diretamente.

## Arquitetura futura (proposta, ainda NÃO implementada)

O Gemini deve dirigir ações autorizadas, nunca inventar posição de cada osso ou URL de GLB:

- walk_to(ator, destino, ritmo): clip de locomoção coerente com root motion, pé apoiado e distância.
- turn_toward(ator, alvo): virada animada, não movimento lateral do corpo parado.
- crouch(ator, objeto): clip real e alvo de pega alcançável.
- grab(ator, objeto, pegada): validar contato antes de prender o objeto ao osso da mão.
- carry(ator, objeto, destino): respeitar proprietário, peso e pega contínua.
- handoff(atorA, atorB, objeto): preparar as duas mãos, conferir distâncias, trocar proprietário sem teleporte.
- put_down(ator, objeto, superfície): apoio real antes da soltura.

Cada ação exigirá pré-condições e pós-condições observáveis, com falha explícita se faltar clip, articulação, alcance, objeto ou superfície.

## O que falta para provar atuação humana

1. Modelos CC0/compatíveis, licenciados e com esqueletos verificados.
2. Clips reais de caminhar, parar, virar, agachar, pegar, carregar, entregar e soltar, com transições suaves. O pacote atual tem Walk e Interact, mas NÃO contém uma animação Pickup comprovada.
3. Calibração de esqueleto, root motion, IK de mãos/pés e transformação de pega.
4. Estado único do objeto: chão -> mão A -> mão B -> bancada, sem teleportar.
5. Diretor por acontecimentos e sincronização com palavras; câmera mostra a ação em vez do cenário vazio.
6. Revisão visual real: MP4 no Chromium, contatos, poses plausíveis, enquadramento, densidade e compreensão da narrativa.

## Próximo teste de qualidade

Uma cena de 8 s: o trabalhador caminha, para, abaixa, pega a caixa, levanta e a entrega ao colega. Não aprovar se o motor só usar Walk + Interact e mover a caixa separadamente, mesmo com todos os testes de sintaxe verdes.

## Regras do projeto

Toda pesquisa no PR experimental, sem merge na main, sem publicação no Lovable, sem Gemini/ElevenLabs no teste técnico, sem declarar cena programada pelo agente como uma criação autônoma da IA. Avaliar o resultado visual antes de promover o código.
