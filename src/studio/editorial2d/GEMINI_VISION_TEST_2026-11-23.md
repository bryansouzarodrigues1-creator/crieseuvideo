# Cinema 2D — Gemini Vision (teste real 23/11/2026)

**Resultado:** foi possível enviar capturas reais ao Gemini e obter diagnóstico estruturado. O motor **ainda não** aplica patches automaticamente e **não foi reavaliado pelo Gemini após os patches**. Este relatório não certifica qualidade profissional.

## Experimentos

1. `gemini-3.8-flash`: HTTP 503. Uma nova tentativa retornou também HTTP 503. Relatos de sobrecarga no Fórum Google Developers.
2. `gemini-3.6-flash`, default thinking, maxOutputTokens 2600: HTTP 200, mas `finishReason=MAX_TOKENS`; saída incompleta.
3. `gemini-3.6-flash`, minimal thinking, maxOutputTokens 6500: HTTP 200, **success**, diagnóstico JSON de 3 capturas.
   - Tokens reportados: prompt 3593, output 1042, total 4635.
   - Três imagens: `ovos_05s.png`, `loja_10s.png`, `loja_20s.png`.
   - Score geral Gemini: **54/100**; avaliação subjetiva e de apenas três frames.

## Achados do Gemini

- `ovos_05s`: leitura boa, qualidade do desenho inferior à referência. Personagens simples, ambiente vazio. Clareza 75/100; acabamento 45/100.
- `loja_10s`: placa mal integrada à fachada, moedas parecendo bolinhas sem destino. Clareza 60/100; acabamento 40/100.
- `loja_20s`: textos legíveis, mas parece slide financeiro estático e com áreas vazias. Clareza 85/100; acabamento 50/100.
- Veredito: narrativa básica cumprida, acabamento visual insuficiente para publicação.

## Correções executadas após a revisão

- `StoryBlock.cash_register`: componente reutilizável de caixa com moedas caindo e rótulo de pedidos, substituindo grade de moedas sem contexto no exemplo da loja.
- Reposicionamento da placa `LOJA DO BAIRRO` entre o toldo e a vitrine, integrado à fachada.
- `equation.chart='split_bar'`: gráfico que diferencia custos e sobra, derivado dos valores do próprio JSON; não é decoração arbitrária.
- Foram adicionados testes de contrato para os novos componentes.
- Chromium visual QA **passou** após os patches no run GitHub `45195228025` (19 screenshots, sem chamadas de IA). Build e TypeScript passaram no run `45195038743` anterior às alterações do controle manual; verificar o workflow final para o commit de congelamento do PR.

## Regras de custo adicionadas

- O workflow Gemini foi alterado para `workflow_dispatch` (disparo manual) e o script exige `GEMINI_TEST_EXPLICIT_RUN=true`.
- O workflow normal `editorial2d-visual-qa.yml` permanece automático, mas não chama nenhum provedor.
- Nenhuma geração pelo Lovable/Claude foi acionada. Gemini 3.6 é o mesmo provedor, modelo alternativo após indisponibilidade do 3.8.
- Não repetir automaticamente chamadas Gemini a cada commit.

## Próxima verificação

Para medir melhora real, selecionar os mesmos timestamps de antes e depois, fazer revisão cega pelo mesmo Gemini, comparar se o julgamento coincide com QA visual humano e só então converter sugestões semânticas em patches automáticos com whitelists.
