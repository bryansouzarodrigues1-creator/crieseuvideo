# CrieSeuVideo: experimento DirectSemantic e ciclo visual (23/11/2026)

**Não publicado.** Este laboratório responde ao diagnóstico de que gerar centenas de coordenadas em uma única chamada é uma estratégia ruim. A alternativa: modelo produz ações curtas em JSON; compilador determina se a sequência é causal; motor existente calcula as transformações e renderiza; validador mede 3 quadros e permite exatamente UMA correção.

## Conteúdo implementado neste PR
- `src/studio/semantic/directSemantic.ts`: esquema Zod de verbos `move_to`, `pick_up`, `place_on`, `look_at`; valida atores, zonas, objetos, durações, conflito temporal do ator, alcance semântico de um objeto e necessidade de andar até o apoio antes de soltá-lo.
- `src/studio/semantic/visualLoop.ts`: contrato para receber quadros RGBA de um renderizador, conferir variação, repetibilidade A→B→A e metadados de texto cortado e interseção. `validateWithSingleRepair` aceita adaptadores externos de render e de modelo e limita a 1 reparo.
- Testes offline de validade e tentativa única — ZERO chamadas reais de API, sem secrets.

## Ainda NÃO implementado
- Este código não é a camada `directSemantic` citada pelo trabalho Work. Não encontrei tal arquivo nas branches `main`, `feature/editorial-2d-scenespec-v1-20261123` ou `experiment/code2d-multi-agent-free-pipeline-20261122` quando consultadas. Pode estar apenas no ambiente de trabalho não versionado.
- O compilador produz **intenção semântica validada**. Ainda NÃO conecta rigs de personagens, cinemática inversa (IK), mundo/âncoras existentes, câmera, renderizador Canvas/Three.js, narração ou MP4. Andar até `tool_rack` é um evento semântico, não prova de trajeto físico.
- `inspectVisualProbe` detecta certos erros objetivos, mas diferença de pixels NÃO prova atuação humana, contato correto ou qualidade artística. `intersections` e `clippedLabels` devem vir de medições reais do motor.
- Nenhum adaptador OpenAI/Claude/Gemini foi ligado, porque não há autorização de gastar saldo ou credenciais dessas APIs. A eventual crítica multimodal precisará de screenshots reais e API com suporte a imagens.
- O PR #108 tem um `SceneSpec` editorial declarativo separado. Evitar duplicar o schema: uma futura integração deve mapear verbos de ações ao mundo/slots e ao conjunto de componentes já versionados.

## Critério de teste justo entre provedores (NÃO executado)
- Mesmos cinco roteiros curtos, mesmo prompt de verbos, JSON schema, duração, verba de entrada/saída e limites de raciocínio explícitos.
- Cobrar e registrar tokens de raciocínio, entrada e saída; retries, status, qualidade de planos compilados e custo de revisão.
- Cada provedor recebe as mesmas chances: primeiro planejamento, render de 3 quadros, 1 crítica/correção se necessária. Congelar versão dos modelos e seed quando houver.
- Métricas: % de planos compilados, % de planos renderizados sem falhas, quantos passaram análise de movimento, número de correções, custo total por vídeo e exportação MP4 aprovada.
- Provedores por callback sem chaves no código; limite global de custo. Não confundir créditos do editor Lovable/Work com tokens grátis de API.

## Exemplo de direção por verbos
```json
{
  "version": 1, "duration": 8,
  "zones": [{"id":"door"},{"id":"car"},{"id":"rack"}],
  "actors":[{"id":"worker","startZone":"door"}],
  "props":[{"id":"wheel","startZone":"car"}],
  "actions":[
    {"id":"e1","actorId":"worker","verb":"move_to","zoneId":"car","at":0,"duration":2},
    {"id":"e2","actorId":"worker","verb":"pick_up","propId":"wheel","at":2,"duration":1},
    {"id":"e3","actorId":"worker","verb":"move_to","zoneId":"rack","at":3,"duration":2},
    {"id":"e4","actorId":"worker","verb":"place_on","propId":"wheel","zoneId":"rack","at":5,"duration":1}
  ]
}
```
A IA **não** escolhe coordenadas X/Y/Z. O motor resolve o espaço, contato, arco, velocidade, câmera e poses após receber a intenção.

## Próxima integração prioritária
1. Expor inventário de rigs/âncoras/ações disponíveis ao planejador.
2. Adapter de verbos para `sceneProgram/planner/choreographer.ts` ou `editorial2d/sceneSpec.ts`.
3. Medir prévia real no navegador e retornar posições de mãos, apoios, colisões e safe areas.
4. Revisar uma única vez a intenção semântica (não reescrever 8.000 tokens de coordenadas).
5. Comparar 5 roteiros idênticos nos modelos, e exportar MP4 real antes de anunciar melhora na qualidade.
