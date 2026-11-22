# Code2D — equipe gratuita de agentes (experimental)

## Objetivo
Converter um tema de 30–60 s em roteiro e código Canvas com uma equipe de IAs,
preservando motor, player, exportador e sandbox do CrieSeuVideo. Não se geram
vídeos nos provedores: apenas texto, roteiros e JavaScript.

## Fluxo por clique autenticado
1. Roteiro e storyboard: Groq GPT-OSS 120B.
2. Direção visual opcional: Gemini direto, com thinkingLevel HIGH. Em caso de
   falha ou ausência de chave, a etapa aparece como SKIPPED, jamais aprovada.
3. Código de animação: OpenRouter Particle-1 :free.
4. Validação: Zod (roteiro e tempos), Acorn (código), replay de quadros em
   sandbox de origem opaca. Prova técnica não é aprovação artística.

Lovable AI Gateway participa APENAS se o usuário marcar "Revisão Lovable"
no Code2D. Essa etapa consome crédito do gateway do aplicativo quando disponível,
que não equivale automaticamente aos 5 créditos diários gratuitos de construção
no editor. Sem confirmação explícita, zero chamadas ao gateway.
Gemini High sozinho continua sendo um modo separado.

## Chaves e modelos (configurar no SERVIDOR)

GROQ_API_KEY: https://console.groq.com/keys
OPENROUTER_API_KEY: https://openrouter.ai/settings/keys
GEMINI_API_KEY: opcional, criado no Google AI Studio.

CODE2D_GROQ_MODEL: opcional, aceita openai/gpt-oss-120b ou qwen/qwen3.8-27b.
CODE2D_OPENROUTER_MODEL: opcional, aceita particle-ai/particle-1:free,
nvidia/nemotron-3-ultra-550b-a55b:free ou openrouter/free.
CODE2D_SKIP_GEMINI_DIRECTION=true: omite Gemini na etapa opcional.
LOVABLE_API_KEY: opcional e separado, exclusivamente no servidor. Se faltar,
a revisão opcional é indicada como skipped sem chamada.
LOVABLE_AI_MODEL: opcional; o código atual tem como padrão google/gemini-3.7-flash
no gateway do Lovable, o que NÃO garante mais inteligência que Gemini High.
A seleção de outros modelos exige confirmação de disponibilidade/custo na conta.

As chaves GROQ_API_KEY, OPENROUTER_API_KEY e GEMINI_API_KEY citadas pelo
usuário na conversa NÃO foram cadastradas automaticamente via esta conexão:
as ferramentas de GitHub disponíveis não escrevem secrets e não se deve
colá-las no Git ou em mensagens do agente Lovable. Cadastre chaves rotacionadas
em Lovable Cloud > Secrets ou no ambiente do servidor que realmente executa
as funções, nunca em VITE_ nem no frontend.

Não use VITE_ nas chaves, nem as inclua na interface, GitHub, logs ou MP4.
Faltando uma das duas chaves essenciais, não se faz nenhuma chamada.

## Limites e proteção
- Uma execução pode fazer até 8 solicitações por clique no pior caso
  de fallback (até 3 por função). Por isso o modo multiagente pode consumir
  a cota gratuita de vários serviços, mesmo sem produzir vídeo. Sem retries
  para o mesmo modelo/função; não confundir fallback entre fornecedores com
  tentativas ilimitadas.
- Não há troca para modelos pagos do OpenRouter. Lovable só é usado com opt-in
  explícito e pode cobrar por inferência, independentemente dos créditos de build.
- Ter chave Groq/Gemini não garante que sua conta seja gratuita. Confira o
  plano e a cobrança antes de fazer testes reais.
- O OpenRouter anuncia 50 pedidos gratuitos/dia (sem compra de créditos)
  para seus modelos :free; a cota é compartilhada e pode ser esgotada.
- Os provedores externos recebem tema, roteiro e/ou storyboard. Não inclua
  conteúdo confidencial sem avaliar os termos, retenção e privacidade.
- Código gerado é executado em iframe sandboxed sem mesma origem e com CSP
  bloqueando rede; código malicioso ainda pode consumir CPU.
- No futuro, o sistema deve manter cotas persistentes por usuário, controle
  de orçamento, fila de processamento e proteção contra abuso.

## Fallback experimental — PR #106

Quando uma etapa falha, uma alternativa **da mesma função** pode continuar, sem
trocar um modelo gratuito por modelo pago:

- Roteiro: Groq -> Gemini HIGH -> OpenRouter gratuito.
- Direção: Gemini HIGH -> Groq -> OpenRouter gratuito.
- Programação Canvas: OpenRouter gratuito -> Gemini HIGH -> Groq.
- Na etapa Gemini, uma chave alternativa de servidor pode ser tentada
  EXCLUSIVAMENTE após falha de credencial, autorização ou cota
  (401/403/404/429); para erros gerais 5xx, preferir outro provedor.
- Cada resposta precisa ser validada; se falhar JSON, cronologia ou sintaxe,
  o relatório registra `failed` e tenta outro provedor permitido.
- No máximo 3 tentativas por função e 8 chamadas externas por clique de
  usuário, contando a revisão Lovable se explicitamente habilitada.
- O Lovable AI Gateway não é fallback gratuito: somente a opção de revisão
  selecionada pelo usuário pode chamá-lo e cobrar seus créditos.
- Não há retries infinitos, redeploy ou publicação automáticos.
- O sistema não considera código válido sinônimo de qualidade artística.
- Essa lógica ainda precisa de teste real de provedores; testes de CI são
  mockados e não verificam cotas, billing nem validade das credenciais.

## Falta antes de declarar o produto pronto
- Testar com chaves reais em contas verificadamente gratuitas.
- Produção por etapas persistidas para evitar timeouts de serverless em
  3 inferências consecutivas.
- Renderização e auditoria visual completas: personagens, cenários, ações,
  contato entre objetos, câmera, continuidade e sem imagens estáticas.
- Voz, legendas sincronizadas e MP4 completo de 40 segundos no Android.
- Rever qualidade, repetição de frames e autoria dos resultados antes de publicar.
