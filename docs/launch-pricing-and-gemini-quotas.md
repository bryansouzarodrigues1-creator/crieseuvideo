# CrieSeuVideo — margem por vídeo e Gemini (pré-lançamento)
Atualizado em 24/11/2026. Plano interno, **não é tabela de preços publicada nem custos efetivamente medidos**.

## O que é vendável agora
- **Editor Motion 2D:** roteiro em cenas, canvas procedural, prévia, legendas em zonas seguras, exportação por navegador (MP4 quando suportado, WebM em outros). Esse é o produto que pode começar pequeno, após validação de geração do usuário final.
- **3D Toon e 3D programático:** ainda em melhoria de câmera, ações e QA visual. Não vender como cinematográfico garantido.
- **Narração:** considerar o custo de TTS em separado; exportador aceita faixas e voz por cena, mas nem todo provedor externo está habilitado ou homologado.
- **Pix:** PR #107 ainda experimental; não disponibilizar checkout de preço real antes de testar confirmação, estorno e débito de crédito por trabalho.

## Modelo de margem confortável

Para cada vídeo, o custo variável completo é:
`C = tokens de IA (entrada+saída+reparos) + TTS/voz + render/armazenamento + taxas de pagamento alocadas + suporte/reembolsos estimados`.

Defina `P_liquido = preço de venda - impostos/taxas de pagamento reais`. Como **meta operacional, não margem garantida**, só publique um plano se `C <= 0,30 * P_liquido`. Reservar o resto para custos fixos, aquisição de clientes, risco e lucro.

Exemplo **meramente hipotético**: se uma venda de R$ 9,90 deixar R$ 9,00 líquidos, gastar no máximo R$ 2,70 em custos variáveis completos para uma contribuição de 70% antes de custos fixos. Não assumir que os valores de API, taxas ou impostos sejam os desse exemplo.

### Experimentos de oferta (sem preços públicos)
1. **2D Inicial:** vídeo curto de até 15–20s, número pequeno de cenas, render procedural com texto; TTS opcional/cobrado conforme custo; até 1 revisão de texto/roteiro no servidor. Só lançar depois de medir custo por conclusão, não por tentativa.
2. **2D Criador:** até 30s, mais cenas/legendas, cenas revisáveis e exportação; teto de tokens e de tentativas por projeto.
3. **Vídeo por encomenda:** trabalho de escopo fechado validado com cliente; preço cobre horas de revisão/produção e uso adicional de IA. Não anunciar duração ou resultado sem validar.
4. **3D/2.5D Premium:** só após prova de qualidade visual e exportação reprodutível.

### Oferta de teste R$1 / três créditos de 15s
Tal oferta **não pode ser tratada como plano rentável automaticamente**: 3 vídeos, taxa Asaas e TTS poderiam consumir o preço de R$ 1. Se for executada, tratá-la como aquisição de clientes com orçamento de subsídio explícito, sem TTS pago, com templates 2D baratos, apenas uma compra de teste por conta elegível, trava antifraude, teto estrito por vídeo e fluxo de estorno. O suporte precisa ser incluído no cálculo.

## Medições obrigatórias antes de definir preço
Guardar por produção (lado servidor): provedor e modelo, tokens de entrada/saída, ferramentas chamadas, duração renderizada, CPU/memória ou custo da renderização, TTS, retries, preço pago, taxas reais, falhas e tempo humano de revisão. Registrar custo de **vídeo concluído**, incluindo tentativas falhas, e comparar percentis (p50/p90), não apenas média.

Proteções: limite por usuário/dia; limite de duração/cenas/roteiro; orçamento de tokens por cena e por produção; no máximo uma reescrita automática sem autorização; job idempotente; fila com backoff em 429; pausa de vendas caso a capacidade da API não sustente as entregas. Não cobrar crédito de cliente por renderização com falha.

## Múltiplas chaves gratuitas do Gemini
- **Não usar chaves no frontend:** nenhuma variável `VITE_*` contendo chave secreta; guardar em Secrets privados do servidor.
- A documentação oficial informa que RPM/TPM/RPD são **por projeto**, não por chave. Colocar várias chaves do **mesmo** projeto não adiciona capacidade.
- Não montar rotação entre contas/projetos para driblar limites; seguir as condições de uso, obter capacidade autorizada ou plano pago. Separação legítima por aplicações/projetos só com justificativa real e limites próprios.
- Priorizar uma chave primária, fila limitada com backoff em `RESOURCE_EXHAUSTED`, escolha de modelo econômico e comunicação transparente se a geração ficar indisponível.
- Chave secundária somente para rotação operacional/revogação e resiliência autorizada, não como mecanismo de multiplicação de cotas gratuitas.
- **Free Tier:** as condições de uso de conteúdo do Google diferem do Paid; rever privacidade e consentimento do usuário antes de enviar roteiros de clientes.

Fontes oficiais:
- https://ai.google.dev/gemini-api/docs/rate-limits — rate limits per project.
- https://ai.google.dev/gemini-api/docs/pricing — free tier / paid tier, modelo e preço atual.
- https://ai.google.dev/gemini-api/docs/api-key — gestão de chaves.
- https://developers.google.com/terms — termos de APIs Google.

## Go/no-go para lançamento
Antes de cobrar: (a) usuário entra/volta com Google no Android, (b) produtor 2D completa ao menos uma geração automática+exportação, (c) custo p90 concluído abaixo do teto do plano, (d) Pix Sandbox confirmado e créditos descontados por vídeo com RLS, (e) suporte a falha, reembolso e indisponibilidade; (f) landing não promete volume e qualidade além do que existe.
