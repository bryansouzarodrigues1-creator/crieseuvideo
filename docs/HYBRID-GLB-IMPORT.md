# CrieSeuVideo — importação segura de GLB (fal + Gemini + Three.js)

**Estado:** PR experimental empilhado sobre #20 / #19. Não integrado à produção. Nenhuma chamada à API paga fal, Gemini ou Lovable.

## Fluxo híbrido, sem catálogo fechado de histórias

1. Gemini interpreta o roteiro e gera um `sceneProgram` declarativo, com hierarquia, trajetórias, ações e contatos.
2. Se o motor procedural não tiver geometria suficiente para determinado objeto, o usuário poderá optar por um modelo 3D gerado no fal ou por um GLB próprio, **com aprovação de custo e licenças**.
3. A geração retorna um **arquivo GLB**, não uma imagem 2D. O backend deve salvá-lo em armazenamento autorizado, registrar hash, tamanho, origem, direito de uso e propriedades de animação.
4. O catálogo de IDs **não restringe histórias**: só controla a origem de arquivos binários. A IA pode construir formas procedurais novas sem nenhum asset, ou fazer referência a um ID previamente validado, jamais a URLs fornecidas livremente pelo modelo.
5. O `sceneProgram` aceita `kind:"model",assetId:"expressive-robot-v1"` e usa `position`, `rotation`, `scale`, hierarquias, câmera e tracks como qualquer objeto.
6. O motor carrega, valida e instancia o GLB com `GLTFLoader`, clona rigs via `SkeletonUtils`, combina a animação interna com a linha do tempo, e bloqueia exportação se a importação falhar.
7. Os testes devem comparar quadros de prévia e MP4, verificar movimento dos ossos, contato físico, fidelidade do roteiro, licenças e compatibilidade móvel.

## O que foi implementado nesta branch

- Catálogo mínimo de assets aprovados com IDs sem URLs arbitrárias. O `expressive-robot-v1` é um upload já referenciado pelo Lovable, cuja **titularidade/licença e acessibilidade ainda precisam ser verificadas antes de publicação**.
- Normalizador do programa rejeita ID de asset desconhecido, campos executáveis e referências remotas no JSON de cenas.
- Leitor GLB 2.0 faz verificações de assinatura, tamanho máximo (16 MiB), quantidade de nós/malhas, teto de 180 mil triângulos, limite de animações e rejeita recursos externos ou formatos comprimidos sem decoder.
- `GLTFLoader` com clonagem de esqueleto/malhas e `AnimationMixer.setTime`, para permitir voltar a cena, avançar a linha do tempo e exportar determinísticamente.
- O laboratório e o editor esperam pelo asset antes de abrir a prévia ou iniciar a exportação. Se o arquivo falhar, o programa não deve ser substituído por um personagem apresentador genérico.
- Testes unitários com um GLB 2.0 sintético legítimo e QA em Chromium, servindo **um GLB com animação embutida** pelo caminho permitido; renderiza cinco posições diferentes em WebGL.

**Importante:** a prova em Chromium usa um GLB sintético servido pelo teste no mesmo caminho de asset. Não verifica se o arquivo *expressive-robot.glb* original está acessível na infraestrutura de produção. Também não comprova a geração real de Meshy ou Hunyuan, nem movimento animal detalhado.

## Modelos 3D reais disponíveis no fal conectado

Consulta ao catálogo do fal em 16/11/2026:
- `meshy/v7.1/text-to-3d` — GLB em `model_glb`, opcional `rigged_character_glb`, `basic_animations` e `animation_glb` com rigging habilitado. O rigging automático é especialmente voltado a **humanoides**, não a uma tartaruga com mandíbula perfeita.
- `fal-ai/hunyuan-3d/v3.1/rapid/text-to-3d` — gera modelos 3D com URLs de saída.
- `fal-ai/trellis-2` — converte imagens em ativos 3D.

A conexão fal instalada no ChatGPT **não instala automaticamente uma chave fal no backend do Lovable**. Para produção, será necessária uma integração backend própria, com autenticação, cobrança controlada por usuário e armazenamento durável. Não persistir apenas o link temporário do fal.

## Segurança e bloqueios

- Nunca aceitar URLs de modelos ou scripts JS arbitrários no `sceneProgram`; receber somente IDs já aprovados e associados ao projeto.
- Não enviar chaves de fal/Gemini para o frontend.
- Não ativar geração paga sem confirmação do usuário; nunca fazer fallback silencioso para API cobrada.
- Validar licenças antes de tornar um modelo público e registrar direitos de uso.
- No backend, reforçar tamanho por streaming, integridade por SHA-256, malhas/triângulos/texturas e limites de tamanho de imagem — o importador atual é uma primeira defesa, não um sandbox universal contra GLB malicioso.
- Modelos com extensões Draco/Meshopt/KTX2 exigem decoders seguros explicitamente instalados; neste PR são rejeitados.
- Se um modelo possuir esqueleto incompatível, não prometer articulações ou contato físico: usar adaptação de rig ou recusar a cena com diagnóstico.
- Implementar controle de cota e catálogo de assets por projeto/usuário antes de ativar importação de arquivos arbitrários.

## Próximos marcos
1. Inspecionar o GLB real do upload existente no host autorizado e revisar licença/titularidade.
2. Adicionar armazenamento próprio de modelos aprovados, versionamento e hash verificado.
3. Testar um GLB gerado pelo fal **somente após autorização explícita de custo**; preferir um objeto antes de animais complexos.
4. Implementar retargeting de animação, encaixes de mãos/boca, interações físicas e revisão visual frame a frame.
5. Integrar o trabalho útil do Claude (câmeras e legendas) com o programa de cenas do Work após resolução dos conflitos, sem substituí-lo pelo catálogo fechado.
