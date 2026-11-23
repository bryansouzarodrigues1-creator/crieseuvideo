# Orçamento de caixa e cotas do CrieSeuVideo — revisão 23 nov 2026

**Escopo confirmado:** foco 2D; nos planos comuns o assinante gera a voz por conta própria e importa MP3. **Nossa API ElevenLabs só estará disponível no Ultra Pro**, após implementação e limite próprio de créditos. Esta planilha textual NÃO contabiliza impostos ou taxas não confirmadas; custos de plataforma documentados aparecem quando aplicáveis.

## Valor mínimo para ativar a API (não confundir com custo por vídeo)

| Serviço | Aporte mínimo confirmado | Observação |
|---|---:|---|
| Gemini API (prepay) | US$ 5 | A interface pode apresentar valor convertido por região/tier; modo gratuito continua possível com cotas. |
| OpenAI API (prepay) | US$ 5 | Valor padrão mostrado na configuração é US$ 10, mas o mínimo publicado é US$ 5. Desativar recarga automática. |
| OpenRouter | US$ 5 | Há tarifa de 5,5% na compra de créditos do plano Standard, **custo real confirmado**; para primeiro lançamento evitar intermediário se API direta funcionar. |
| Anthropic Claude API | Valor mínimo não confirmado em documentação pública | O Console permite digitar quantidade; verificar no checkout antes de comprometer o plano. |
| DeepSeek API | Valor mínimo não confirmado oficialmente | Consultar checkout. |

Fontes:
- Gemini https://ai.google.dev/gemini-api/docs/billing
- OpenAI https://help.openai.com/en/articles/8264644-setting-up-and-managing-prepaid-api-billing
- OpenRouter https://openrouter.ai/terms/ e https://openrouter.ai/pricing
- Anthropic https://support.claude.com/en/articles/8977456-how-do-i-pay-for-my-claude-api-usage

## Custo marginal de IA (hipótese; não equivale a saldo mínimo)
Tomar 20.000 tokens de entrada e 8.000 de saída **no total por vídeo** (roteiro + direção), sem imagens nem narração. Preços podem mudar e modelos específicos têm regimes especiais:

- Claude Haiku 5.5: entrada US$ 0,10 / 1M; saída US$ 0,50 / 1M => **US$ 0,006 por vídeo** no exemplo.
- OpenAI GPT-6 Luna: no tier Standard a referência é US$ 0,10 / 1M de entrada e US$ 0,50 / 1M de saída => **US$ 0,006 por vídeo**. Tarifas menores de Batch/Flex não garantem baixa latência para a aplicação.
- A etapa de revisão ou replanejamento, se repetir todo o volume, dobra o consumo.
- **Não vender ilimitado de gerações IA.** Renderização 2D local pode ser abundante, mas chamadas de IA, fila e duração de vídeo terão controles.

## Nova proposta comercial para TESTE (não preços publicados)
Sem inclusão de voz ElevenLabs nos planos abaixo.

| Plano | Preço candidato BRL | Vídeos 2D/mês | Tamanho referência | IA em dois passes/vídeo Haiku (se todos usarem) |
|---|---:|---:|---|---:|
| Essencial | R$ 29,90 | 100 | até 2 minutos | US$ 1,20 |
| Criador | R$ 59,90 | 300 | até 2 minutos | US$ 3,60 |
| Pro | R$ 99,90 | 600 | até 2 minutos | US$ 7,20 |
| Ultra Pro | Somente após custos de TTS e infraestrutura | Limite a medir | Voz automática com teto de caracteres | Não definido |

**Atenção:** esses montantes são apenas roteiros/planos IA, sem exportação ou armazenamento. Antes de prometer quantidades públicas, medir renderização, hospedagem, filas e custo de retenção. Separar:
- Edições/reexportações **sem IA**: podem ser muito mais numerosas e quase gratuitas no backend se renderizadas no dispositivo.
- Novas histórias por IA: contabilizar tokens/solicitações e impedir regenerações infinitas.
- Duração total exportada / resolução / concorrência: limites claros para evitar gargalo.

## Fluxo de caixa inicial e gatilho de upgrade
1. Durante desenvolvimento, Gemini Free + templates locais, sem saldo pré-pago.
2. Primeira compra confirmada: reservar saldo mínimo **US$ 5** para **um** provedor selecionado. Não é mensalidade; é crédito consumível.
3. Desligar auto-reload, definir orçamento/limite por projeto e log de tokens, e não usar fallback pago silencioso.
4. Se a API parar por falta de saldo, modo local e importação manual continuam disponíveis; comunicar limitação.
5. Só adicionar segundo provedor ao comprovar maior taxa de vídeos aprovados e margem financeira suficiente.
6. Ultra Pro: adquirir crédito ElevenLabs apenas após pagamento e precificação dos caracteres, sem confundir com planos comuns.

## Teste necessário
Registrar custo REAL de 50 gerações e calcular consumo médio, percentis e retries. Comparar Gemini, Haiku e Luna com o mesmo roteiro e validadores do Cinema 2D; escolher por **custo por vídeo aprovado** e qualidade visual, não por preço bruto por token. Receber a primeira assinatura não substitui testar cobrança, prazo de liberação do dinheiro e disponibilidade de API.
