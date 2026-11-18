# CrieSeuVideo — integração nativa de cenário procedural (18/11/2026)

## Origem e escopo
Branch isolada baseada no PR #55, sem alterações na main, no Lovable, no banco ou nas Secrets.
Os arquivos `score.ts` e `stage3d.ts` foram incorporados **integralmente** da branch do Claude `feat/3d-scenery-kit` (PR #54), depois de comparar linhas com os arquivos originais da branch #55: a implementação do Claude adiciona suporte às cinco formas procedurais sem remover a validação de contatos, a coreografia ou as funções do planejador.

`planner/worldScenery.ts` continua usando `kitMesh` para auditar índices, cores, vértices, orçamento e determinismo, mas a saída para `SceneProgram` agora usa formas tipadas `terrain`, `water`, `tree`, `rock`, `cloud` com seus parâmetros. Não serializa milhares de triângulos estáticos para a IA.

## Resultado técnico esperado
- Água: `SceneProgram3D.update(t)` reamostra os vértices da superfície com `waterMesh(params,t)`; o arquivo MP4 pode conter ondas variáveis ao longo dos quadros. Isso **não** representa física de fluidos nem contato de barcos com ondas.
- Terreno: renderização nativa com cores por vértice e relevo do kit original do Claude; `worldScenery` preserva a semente e resolução.
- Vegetação e rochas: continuam com posição pré-calculada sobre `terrainHeight` para manter o resultado verificável, estático e compatível com os IDs do planejador. Repetição via InstancedMesh e snap ground do Claude ficam disponíveis a programas que usam `repeat.ground`, mas o adaptador de dispersão ainda cria os nós da forma antiga.
- Neblina: a distância do fog agora segue a distância da tomada, conforme o renderer do Claude.
- Integração: nós de carga, eixos, engrenagens e contato das mãos permanecem os da branch #55.

## Evidências necessárias
- `bun run test`, `bunx tsc --noEmit`, `bun run build` via CI sem Gemini real.
- Teste de regressão que compara o buffer de vértices da mesma água em t=0 e t=1,2, usando o renderizador real.
- Laboratório Chromium 18 s com vídeo H264 e nove PNGs: inspecionar se água/vegetação aparecem, sem cortes no horizonte, e se ações não regressaram.

## O que ainda falta
- Pés/rodas seguindo altura irregular do terreno em movimento: não implementado aqui.
- Dinâmica real de embarcação, colisões com o relevo, vento em árvores e reação dos atores a fluidos: não implementados.
- O Gemini de duas passagens continua desligado das rotas públicas e não foi chamado ao vivo.
- Narração, legendas, qualidade semântica de novos roteiros e produção cinematográfica exigem provas separadas.
- Não fazer merge/deploy até visual QA e aprovação dos resultados.
