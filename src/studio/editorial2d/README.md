# CrieSeuVideo — protótipo Cinema Editorial 2D

Primeira etapa da arquitetura proposta na análise do Gemini: separar **Direção** (SceneSpec declarativo) de **Renderização** (componentes testados).

- \`sceneSpec.ts\`: contrato tipado, resolver de âncoras \`atWord\` e validação básica.
- \`pizzariaSpec.ts\`: fixture da simulação 500 clientes, 250 pedidos a mais, +R$ 20.000 de **faturamento**, não lucro.
- \`sceneSpec.test.ts\`: verificações do contrato.
- Protótipo executável isolado: \`/prototypes/editorial2d/pizzaria_12s.html\`.

**Estado:** demonstração isolada e contrato de dados; ainda não há conexão com o Gemini/planner do app nem exportação validada na produção. O HTML usa renderização determinística local para funcionar offline e carrega GSAP da CDN quando disponível. A master timeline GSAP ainda é auxiliar.

**Próxima integração:** escolher o preset editorial no Studio, fazer a API Gemini retornar \`SceneSpec\`, consumir o contrato em componentes 2D reais, sincronizar com \`words.json\` e executar QA de colisões/safe areas e exportação de frames. Não mesclar como funcionalidade final antes desses testes.
