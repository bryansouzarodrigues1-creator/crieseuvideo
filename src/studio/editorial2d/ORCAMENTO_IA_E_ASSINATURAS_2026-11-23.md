# Orçamento de IA e voz para assinaturas — 23 nov 2026

Valores de referência são preços publicados pelos fornecedores, não cotações personalizadas, e podem mudar. Valores em USD. Impostos, câmbio, tarifas de pagamentos, hospedagem, CPU, storage e suporte não estão incluídos.

## Critério de comparação
- Uso: 1 vídeo narrativo 2D de ~2 minutos com roteiro + storyboard JSON; 20.000 tokens de ENTRADA e 8.000 de SAÍDA entre chamadas (HIPÓTESE, não medição).
- IA gera apenas roteiro e cena declarativa. Não gera pixels de vídeo nem código HTML gigante.
- Formula: custoIA = (tokensEntrada * taxaEntrada + tokensSaida * taxaSaida) / 1.000.000.

| Modelo | Entrada US$/1M | Saída US$/1M | 20k entrada + 8k saída |
|---|---:|---:|---:|
| GPT-6 Luna | 0.05 | 0.25 | 0.0030 |
| Gemini 2.5 Flash-Lite (pago) | 0.10 | 0.40 | 0.0052 |
| Claude Haiku 5.5 (prompt até 100k) | 0.10 | 0.50 | 0.0060 |
| DeepSeek Flash (fora de pico) | 0.15 | 0.60 | 0.0078 |
| DeepSeek Flash (pico) | 0.30 | 1.20 | 0.0156 |
| Gemini 3.1 Flash-Lite (pago) | 0.25 | 1.50 | 0.0170 |
| GPT-6.1 Terra | 0.50 | 2.50 | 0.0300 |

Fontes de preços:
- OpenAI: https://developers.openai.com/api/docs/pricing
- Gemini: https://ai.google.dev/gemini-api/docs/pricing
- Anthropic: https://www.anthropic.com/claude/haiku
- DeepSeek: https://api-docs.deepseek.com/quick_start/pricing/

## Voz via ElevenLabs
- Fonte: https://elevenlabs.io/pricing/api
- Eleven v4: US$ 0,08 / mil caracteres.
- Eleven v4 Turbo: US$ 0,04 / mil caracteres.
- Exemplo de vídeo com 2.000 caracteres: v4 US$ 0,16; v4 Turbo US$ 0,08.
- TTS pode envolver regenerações: 25% de consumo adicional de caracteres implica multiplicar por 1,25.
- Áudio vindo do usuário: custo de geração de voz terceirizada para nós = US$ 0 (mas alinhamento, processamento, armazenamento e termos de licença ainda podem custar).

## Cenário de 20 vídeos por assinante por mês
- Planejador Haiku 5.5, com duas passagens completas: 20 * (0.006 * 2) = US$ 0,24.
- Voz Eleven v4, 2.000 caracteres por vídeo: 20 * 0.16 = US$ 3,20.
- Regeneração de voz 25% adicional: US$ 0,80; subtotal voz = US$ 4,00.
- **Subtotal IA + voz = US$ 4,24 por assinante**. NÃO é o custo total operacional!
- Em 100 assinantes usando a cota inteira: 2.000 vídeos; IA US$ 24 + voz US$ 400 com extra de 25% = US$ 424, antes de outros custos.
- Custos de exportação/hospedagem, pagamentos e suporte precisam ser medidos para definir preço final em BRL.

## Política comercial proposta para teste
- Plano grátis: previews limitados em resolucao reduzida; geração por Gemini grátis se a cota permitir, sem prometer disponibilidade.
- Plano de entrada: créditos mensais de planejamento e exportação 2D, voz por MP3 enviado pelo usuário (BYO).
- Plano criador: adicionar minutos/créditos limitados de ElevenLabs, com consumo visível antes da geração.
- Plano maior: mais créditos, prioridade de fila e regenerações controladas. Não vender 'ilimitado'.
- Cancelamento/estorno: política transparente, contabilizar custos externos apenas após pagamentos confirmados e autorizações explícitas.
- Controle por usuario: teto de créditos, tamanho de roteiro, max retries, cota de TTS, duracao e formato de exportação.
- Orçamento central por provedor: teto mensal, alerta ao atingir 70/90/100%, proibição de fallback pago silencioso e logs de tokens/latência/falhas.

## Validação de qualidade antes da compra
- Criar conjunto de 15 temas (finanças, negócios, história/curiosidade), três execuções cada por Gemini, Luna, Haiku e opcional Terra.
- Resultado avaliado com os mesmos requisitos: coerência, factualidade, 1 ideia visual por beat, JSON válido, assets existentes, sobreposição, custo real/geração, retries e tempo.
- Métrica 'custo por vídeo aprovado' = cobrança total de IA / número de vídeos que passam QA (mais informativa do que preço por token).
- Não aceitar parecer de um único provedor como prova; comparar vídeos efetivamente renderizados e aprovados.

## Integração necessária (AINDA NÃO FEITA)
- Criar AI provider router com seleção explícita, medição de tokens e cache.
- Modo gratuito mantém Gemini sem fallback pago, mas aviso em caso de quota.
- Criar cobrança e contabilidade antes de oferecer voz incluída.
- Verificar licença de uso comercial e direito de disponibilizar vozes a clientes pela API.
- Nunca incluir API keys no frontend; usar segredo e checar identidade no backend.