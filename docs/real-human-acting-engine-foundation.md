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


## Causa comprovada do salto de mais de 11 metros

Nos testes isolados, o pulso ficou dentro da escala humana. Na cena completa, a mão estava em altura normal (~1,24 m), mas o ponto de pega saltava a ~9,51 m. O defeito foi identificado no offset de contato: o código interpretava um deslocamento local de (.01,.02,.10) no osso como se esses valores fossem metros do mundo. Como o GLB possui armadura interna 100x, dez centímetros viravam mais de onze metros.

A função localGripOffsetMetres converte um deslocamento solicitado em metros reais para a unidade local do osso usando sua escala mundial. Um teste independente reproduz e previne esse erro dimensional. O laboratório também rejeita a pega se ela ficar a mais de 16 cm do pulso.

Essa correção não cria um agachamento ou uma entrega convincente por si só. A prova de dois humanos e ferramenta continua separada e exige frames reais.

## Status auditado da continuidade — 17/11/2026

**PR #45 (DRAFT), apenas em branch experimental. Nenhum merge na main, nenhum deploy no Lovable, nenhuma nova chamada Gemini.**

### O que o GitHub provou

- Workflow `44168443337`: 392 testes unitários, TypeScript, GLB Worker/Casual com escala de esqueleto correta, render real 192 quadros/8s 720×1280 H.264, e transferência do objeto sem teleporte > 2,1 mm — **prova técnica de render, não de atuação**.
- Inspeção independente dos frames do MP4: personagens se sobrepõem e a ação de pegar/entregar não é legível. O objeto preso no punho não prova que a mão pegou um objeto.
- Novo `scripts/rigged-human-browser-qa.mjs` reprova interseção de posicionamento de atores, cabeças que se ocultam na câmera e ausência de gesto de pegar comprovado. Execução `44170371823`: falha **esperada** por distância entre centros de atores de 0,635 m, cabeças a 18–36 px entre si na câmera e ausência de animação Pickup/Crouch. O vídeo/relatório continuam exportados, mas o resultado NÃO deve ser aprovado.
- Fonte de movimento CC0 separada `Kinemiq/free-game-animations`, GLB ZIP SHA256 `64ca5ab4a92c9da079c5e88ca509391b0a58a24ccf2a1307b16e2f0fc6b23ffc`. A auditoria `44170798605` encontrou 36 GLBs válidos, incluindo `Action_pick_up_from_a_table`, `Idle_crouching` e `Walk_carrying`, com movimentos esqueléticos reais.
- São arquivos de animação com **0 skins** e **67 canais**, isto é, sem personagem/skinned mesh próprio: requerem rig e retarget, não podem ser ligados diretamente ao Worker.
- Auditoria `44171085645`: apenas 8 de 66 nomes originais têm correspondência direta entre esqueleto fonte e Worker. Os dois rigs são diferentes.
- Mapeamento explícito `lab/rigged-research/retarget-map.json` validado na execução `44171463086`: 61 dos 62 ossos alvos referenciam nomes de ossos animados reais na fonte; `Body` permanece fora de propósito. **Isso valida nomes, NÃO a adaptação da pose, o contato ou o vídeo**.

### Próxima implementação, não concluída

1. Em laboratório isolado, converter a fonte GLB esquelética para um esqueleto reproduzível e gerar clip retargetado aplicando **correção de pose de repouso** (bind pose), escala do quadril e orientação de eixos — não copiar keyframes crus.
2. Verificar num MP4 curto movimentos reais de agachar e pegar sem distorção do tronco, pés, mãos; avaliar contato antes da troca de posse.
3. Fazer correção de raiz/root motion, transição suave entre clips e IK de mãos/pés; uma animação de 0,8s de pickup pode não casar com a geometria de cada objeto.
4. Construir direção semântica (`walk_to`, `pickup`, `carry`, `handoff`, `put_down`) com pré/pós-condições e recusa de ações sem clip/IK válidos; só então ligar o plano Gemini ao motor testado.
5. Repetir QA visual do MP4 para contato, colisão entre pessoas, pés apoiados e enquadramento antes de promover algo ao produto.

**Não confundir 61/62 nomes correspondidos com 61/62 ossos animando corretamente. Nenhuma demonstração de pickup retargetado foi aprovada até esta data.**
