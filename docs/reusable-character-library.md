# Elenco reutilizável e direção de animação

Objetivo: nenhuma assinatura externa obrigatória ao cliente. Reutilizar modelos originais/licenciados, renderizar no motor Three.js existente e usar Gemini para decisões semânticas, não reconstrução de personagens.

## Biblioteca proposta (ainda não são arquivos GLB)
- host-v1: apresentador original do canal, aparência a aprovar.
- human-neutral-v1: humano genérico configurável, roupas e cores variantes.
- human-worker-v1: trabalhador, roupa e acessórios removíveis.
- human-business-v1: personagem social, roupa e acessórios removíveis.

Começar com um único rig humano base e variações de aparência; todos com altura e eixos consistentes, pivô nos pés, escala em metros, texturas embutidas, nomes estáveis de articulações. Orçamento inicial a testar no Android: <= 15 mil triângulos por personagem e <= 3 MB por arquivo. Origem/licença e lista de animações verificadas antes de registro. Não publicar o robô existente enquanto sua licença estiver pendente.

Ações: idle, walk, run, turn, talk, point, react, reach, grip, carry, release, sit. Locomoção in-place com deslocamento pelo SceneProgram; mãos e pés exigem IK/contatos para manipulação real. O PR atual seleciona UM clip pelo nome por instância; ainda não implementa sequência de ações, crossfade, retargeting, contato de mãos do GLB ou geração via Gemini.

## Referência técnica: Claude Animated Shorts (ZIP fornecido)
O README e SKILL.md descrevem personagens Canvas2D em billboards (toon.ts/cast.ts) num mundo Three.js/Remotion; não são humanoides GLB. O pipeline é roteiro -> voz e tempos de palavras -> story.ts -> mundo/cast -> pós -> som -> stills -> QA. Separar ações, palco, câmera, iluminação, materiais e pós-produção; fazer inspeção em imagens antes da exportação. Aproveitar princípios e código MIT somente com preservação do aviso de copyright/licença; referências visuais privadas são apenas para estudo e não entram no produto. PT-BR, legendas opcionais e renderização web são escolhas do nosso produto, não regras da skill.

## Próximas entregas verificáveis
1. Validar um GLB humano original com animações nomeadas e carregamento real.
2. Sequência de clips por tempo, transições, IK e contatos.
3. Catálogo disponibilizado ao diretor; referência por ID, ação e destino, nunca URL arbitrária.
4. Cenário, câmeras e iluminação com auditoria geométrica e visual por tomada.
5. Vídeo de 20 s com personagem idêntico em três tomadas, manipulação sem teleporte e áudio importado/gerado localmente.
6. Validar memória, desempenho Android e exportação antes de comercializar.
