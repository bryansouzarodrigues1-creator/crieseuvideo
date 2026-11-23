# Benchmark Gemini vs Claude (direcao visual, sem compras antecipadas)

## Diagnostico
O modelo atual recebe prompt+JSON e produz uma animacao, mas nao recebe os quadros renderizados. Assim, qualquer outro modelo textual tambem trabalharia as cegas. Gemini e Claude aceitam imagens em suas APIs, desde que o app envie screenshots pela API multimodal. Somente trocar o modelo nao resolve a falta de feedback.

## Status da implementacao
- Criado script `scripts/editorial2d-visual-qa.mjs` que abre a rota `/cinema-2d` no Chromium, percorre os templates Ovos e Loja, captura frames, testa bounds de titulo/legendas, seek deterministico e erro de pagina.
- GitHub Actions `.github/workflows/editorial2d-visual-qa.yml` arquiva PNGs e relatorio JSON, sem keys e sem chamadas Gemini/Claude.
- Nao existe ainda endpoint para enviar screenshots ao Gemini Vision nem correcoes automatizadas aplicadas. Proximo PR: endpoint autenticado e opt-in com limites por sessao.

## Ciclo fechado (proxima etapa)
1. Gemini recebe roteiro e devolve DiretorSpec com IDs de cena, componentes, ancoras de palavras e parametros predefinidos.
2. Renderizador executa sem IA; e o browser QA captura cada cena em inicio, 25%, 50%, 75%, fim; amostrar tambem quadros ao redor das transicoes.
3. Linter local verifica JSON, texto fora da margem, occlusao conhecida, contagens, ausencia de componentes, timestamps e determinismo. Falhas de regra sao corrigidas localmente sempre que possivel.
4. Quadros suspeitos viram contato visual 3-6 imagens pequenas. Com permissao explicita e quota, Gemini Vision recebe imagens+contexto da cena e devolve apenas erros especificos: {sceneId,time,kind,severity,evidence,patchProposal}.
5. Correcao permitida somente em whitelist de parametros (posicao, escala, tempo, layout); mudancas editoriais/semanticas exigem revisao. Aplicar maximo de 2 iteracoes e somente apos validacao do schema.
6. Re-renderizar quadros alterados, executar QA novamente e salvar manifest + custo. Se continuar reprovado, nao exportar como aprovado automaticamente.

## O que nenhuma captura isolada detecta
- Movimento robotico e contacto fisico errado exigem multiplos quadros proximos ou video curto, nao apenas colagem.
- Qualidade narrativa, duracao, tom e retencao pedem avaliação humana em testes com publico.
- Sem ground truth a IA pode inventar problemas. Gravar evidencia com timestamp e screenshot antes de aceitar alteracao.

## Comparacao justa (quando houver saldo Claude de US$ 5)
Usar o MESMO catalogo 2D, o MESMO roteiro e o MESMO QA. Nao colocar a IA para gerar HTML livre.
Rodar 10-15 prompts: historias de negocios, fatos/curiosidades, personagens com props, personagens espelhados, multiplos numerais e sequencias narrativas.
Avaliar com scorecard: Coerencia roteiro 0-5, objetos corretos 0-5, boa composicao 0-5, validacao JSON 0/1, frames que passaram QA (%), numero de re-renderizacoes, uso de tokens, latencia e custo por video aprovado.
Fazer A/B: Gemini sem feedback, Gemini com screenshots, Haiku com screenshots e Sonnet com screenshots em um subconjunto de cenas dificeis. Se Gemini+Vision chegar perto do Claude, manter Gemini para reduzir custo.

## Regras financeiras
Confirmado pelo usuario em sua conta Anthropic: minimo exibido US$ 5. Nao usar esse saldo ate fechar o loop Gemini visual. Desativar recarga automatica. Contratar somente apos primeiro recebimento e teste controlado.
Gemini Free tem cotas; chamadas multimodais e imagens tambem consomem tokens. Arquivar screenshots localmente nao consome tokens. Nao enviar imagens por default.

## Fontes atuais
- Anthropic Models: https://platform.claude.com/docs/en/models/overview
- Claude Vision: https://platform.claude.com/docs/en/build-with-claude/vision
- Gemini image understanding: https://ai.google.dev/gemini-api/docs/image-understanding
- Claude prepaid: https://support.claude.com/en/articles/8977456-how-do-i-pay-for-my-claude-api-usage