# CrieSeuVideo — protótipo Cinema Editorial 2D

Primeira etapa da arquitetura proposta na análise do Gemini: separar **Direção** (SceneSpec declarativo) de **Renderização** (componentes testados).

- \`sceneSpec.ts\`: contrato tipado, resolver de âncoras \`atWord\` e validação básica.
- \`pizzariaSpec.ts\`: fixture da simulação 500 clientes, 250 pedidos a mais, +R$ 20.000 de **faturamento**, não lucro.
- \`sceneSpec.test.ts\`: verificações do contrato.
- Protótipo executável isolado: \`/prototypes/editorial2d/pizzaria_12s.html\`.

**Estado:** demonstração isolada e contrato de dados; ainda não há conexão com o Gemini/planner do app nem exportação validada na produção. O HTML usa renderização determinística local para funcionar offline e carrega GSAP da CDN quando disponível. A master timeline GSAP ainda é auxiliar.

**Próxima integração:** escolher o preset editorial no Studio, fazer a API Gemini retornar \`SceneSpec\`, consumir o contrato em componentes 2D reais, sincronizar com \`words.json\` e executar QA de colisões/safe areas e exportação de frames. Não mesclar como funcionalidade final antes desses testes.


## Cinema 2D — navegação e edição experimental
- Rota `/cinema-2d` disponível na branch deste PR, acessível pelo botão **Cinema 2D** na barra do estúdio quando a branch for implantada.
- `StoryFrame.tsx`: renderizador SVG determinístico de personagens, grade de ícones, equações e cartelas. Mantém labels fora do grupo espelhado.
- `Storytelling2DStudio.tsx`: play/pause, scrub, alteração de títulos e legendas, tempos das cenas, carregamento opcional de MP3, captura PNG e importação/exportação do JSON.
- Templates originais: **Vendedor de Ovos (42s)** e **Loja e Lucro (34s)** com cenas reutilizadas.
- **Não consome créditos de IA:** nesta etapa a geração pelo Gemini **não** está ativada.
- **Limites:** áudio enviado só acompanha a timeline proporcionalmente, sem timestamps fonéticos; não há exportação MP4/WebM dentro desta tela. Protótipos HTML separados continuam disponíveis.
- Para reproduzir fielmente um roteiro longo, faltam alinhador de palavras, biblioteca maior de props e renderização de vídeo revisada.

## Checks
`bun run test`, `bun run build` e `bunx tsc --noEmit` são executados por `studio-home-no-demo-qa.yml` em PRs contra `main`.
