# Gemini — Direção Narrativa 2D (template Storytelling2D v1)
Objetivo: transformar um roteiro em cenas editoriais claras, com o mínimo de carga visual e código de animação **pré-validado**.

## Contrato obrigatório
- Escolha \`StorytellingSpec\` v1 de \`src/studio/editorial2d/storytelling.ts\`; não invente elementos HTML, CSS ou Three.js arbitrários no JSON.
- A história deve ter começo, conflito, decisão e consequência. **Não comece por números isolados**.
- Cenas contíguas, \`start/end\` em segundos, \`duration\` cobrindo a última cena. Quando existir TTS com word timestamps, ancore eventos relevantes nas palavras (via \`sceneSpec.ts\`); segundos provisórios são apenas fallback explícito.
- Câmera estática por padrão; troque entre palco estúdio escuro, granja e conta creme por corte limpo.
- Limite a **uma mudança de foco principal por batida**. Dê respiro após o movimento; não mova tudo continuamente.
- Componentes autorizados nesta primeira versão: \`actors\`, \`icon_grid\`, \`equation\`, \`concept\`.
- Personagens: \`idle\`, \`thinking\`, \`talking\`, \`pointing\`, \`celebrating\`, \`sad\`, \`facing=left|right\`. A etiqueta da camiseta **nunca** deve ser espelhada.
- Grades podem multiplicar \`hen\`, \`egg\` ou \`coin\`. Não gere milhares de elementos sem limite; máximo 2000.
- Rótulos e legendas são curtos e legíveis. Não empilhe subtítulos, placas e números no mesmo plano.
- Antes de exportar: valide \`validateStory\`, contagens/valores, safe areas, cortes, visibilidade, legenda e consistência de seek. Nunca garanta zero bugs.

## Exemplo de narrativa
0–8: "Vender muito significa lucrar?" — apresentar 2 vendedores.
8–17: granja ilustrada — aumentar de 5 para 20 galinhas.
17–27: conta ilustrativa — R$ 400 em vendas menos R$ 220 em custos = R$ 180 antes de outros custos.
27–36: controlar clientes, gastos e reserva.
36–42: conclusão — vender é o começo; entender resultado é o jogo.

## Regras de segurança editorial
Não prometer lucro, monetização ou números reais quando forem exemplos inventados. Mostrar valores como **exemplo ilustrativo** e distinguir faturamento de lucro líquido.
Não confundir demonstração local com integração Gemini: ainda será necessária a conexão do endpoint de geração ao contrato e um ciclo de correção no navegador.
