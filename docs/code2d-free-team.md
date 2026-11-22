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

Lovable AI Gateway não participa do caminho gratuito.
Gemini High sozinho continua sendo um modo separado.

## Chaves e modelos (configurar no SERVIDOR)

GROQ_API_KEY: https://console.groq.com/keys
OPENROUTER_API_KEY: https://openrouter.ai/settings/keys
GEMINI_API_KEY: opcional, criado no Google AI Studio.

CODE2D_GROQ_MODEL: opcional, aceita openai/gpt-oss-120b ou qwen/qwen3.8-27b.
CODE2D_OPENROUTER_MODEL: opcional, aceita particle-ai/particle-1:free,
nvidia/nemotron-3-ultra-550b-a55b:free ou openrouter/free.
CODE2D_SKIP_GEMINI_DIRECTION=true: omite Gemini na etapa opcional.

Não use VITE_ nas chaves, nem as inclua na interface, GitHub, logs ou MP4.
Faltando uma das duas chaves essenciais, não se faz nenhuma chamada.

## Limites e proteção
- Uma execução pode usar até 3 solicitações externas; zero retries automáticos.
- Não há troca para modelos pagos do OpenRouter nem Lovable.
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

## Falta antes de declarar o produto pronto
- Testar com chaves reais em contas verificadamente gratuitas.
- Produção por etapas persistidas para evitar timeouts de serverless em
  3 inferências consecutivas.
- Renderização e auditoria visual completas: personagens, cenários, ações,
  contato entre objetos, câmera, continuidade e sem imagens estáticas.
- Voz, legendas sincronizadas e MP4 completo de 40 segundos no Android.
- Rever qualidade, repetição de frames e autoria dos resultados antes de publicar.
