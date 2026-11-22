# CrieSeuVideo — avaliação da arquitetura Code2D e papel do agente Lovable

Este plano é só uma avaliação. Nada de código, chaves ou publicação muda nesta etapa.

## 1. O que existe hoje (verificado)

- A versão principal do site tem o estúdio 2D/3D, o modo de IA 3D com JSON compacto e o protótipo "Gemini — Código 3D" (com testes, do pedido #85).
- **A arquitetura Code2D (pedidos #105 e #106) ainda não está no site.** Não encontrei nenhuma referência a Groq, OpenRouter ou Code2D no código atual. Ela só existe nos pedidos de mudança do GitHub.
- Chaves cadastradas hoje: `GEMINI_API_KEY`, `LOVABLE_API_KEY` (gerenciada pelo Lovable) e `LOVABLE_CRON_SECRET`. `GROQ_API_KEY` e `OPENROUTER_API_KEY` ainda não existem.

## 2. Avaliação crítica da cadeia Groq → Gemini → OpenRouter → navegador

Pontos fortes:
- Cada etapa produz texto ou código, e o navegador desenha. Não há custo de vídeo gerativo.
- Separar storyboard, direção e programação permite usar um modelo barato e rápido em cada etapa.

Riscos:
1. **Três provedores e três pontos de falha.** Cada um tem cota, formato de erro e chave próprios. Uma falha no meio desperdiça as chamadas anteriores. O sistema precisa parar com aviso claro, sem refazer a geração sozinho.
2. **A versão de cada etapa se perde.** Se o Gemini "às vezes" dirige ("quando disponível"), o mesmo roteiro gera vídeos diferentes. Cada geração deve registrar qual provedor e qual modelo foram usados em cada etapa.
3. **Código de Canvas escrito pelo OpenRouter é código de terceiros.** Ele deve rodar na mesma caixa isolada já usada no Código 3D (iframe sem acesso à conta e sem rede), nunca direto no site.
4. **Fidelidade ao roteiro.** Groq e OpenRouter podem inventar ou cortar falas. É preciso manter a regra atual: o texto final usa só as palavras do usuário, na ordem.
5. **Entrada e saída validadas por contrato.** O storyboard e a direção precisam de um formato verificado, e o código precisa de checagem de sintaxe e de replay por tempo antes de ir para a tela.
6. **Custo e cota.** Sem limite por usuário e por dia, um único usuário pode esgotar a cota gratuita dos três provedores.

## 3. Créditos do agente Lovable × créditos de IA dentro do app

- **Créditos do editor/agente** (os 5 diários e os do plano): pagam o trabalho do Lovable construindo, revisando e corrigindo o projeto. Não são usados quando um visitante gera um vídeo.
- **Créditos de IA do app (AI Gateway / `LOVABLE_API_KEY`)**: pagam as chamadas de IA que o site faz quando alguém usa o app. Saem do saldo do workspace, com 4 créditos de IA incluídos por mês.
- **Groq, OpenRouter e Gemini direto**: são cobrados por cada provedor na sua própria conta. Não usam créditos do Lovable.

## 4. Papel sugerido para os 5 créditos diários do Lovable

Usar o Lovable como engenheiro revisor e diretor de qualidade, não como gerador de conteúdo:
1. **Integração:** trazer um pedido do GitHub já aprovado por vez (primeiro o #105, depois o #106) e conferir se o site continua funcionando.
2. **Verificação:** rodar os testes, checar o site no navegador com uma resposta simulada (sem chamar IA paga) e checar a caixa isolada.
3. **Diagnóstico:** quando um vídeo sair errado, ler o registro da geração e apontar qual etapa falhou.
4. **Revisão crítica:** apontar riscos de segurança, custo e fidelidade antes de juntar um pedido do ChatGPT/Claude/Gemini.
5. **Evitar:** pedir ao Lovable para escrever código grande do zero ou repetir algo que outro agente já entregou.

Ordem sugerida: um pedido por dia, com integração, testes e relatório curto.

## 5. Como configurar as chaves (sem expor valores)

1. Gere cada chave no painel do provedor: console do Groq, painel do OpenRouter e Google AI Studio. Uma chave do AI Studio normalmente começa com `AIza`.
2. No Lovable, abra **Configurações do projeto → Secrets** e adicione três chaves com estes nomes exatos: `GROQ_API_KEY`, `OPENROUTER_API_KEY` e `GEMINI_API_KEY`. A `GEMINI_API_KEY` já existe: use "atualizar" se for trocá-la.
3. Nunca cole uma chave no chat, no GitHub, no código ou em arquivos `.env`. As chaves que já apareceram no chat devem ser apagadas no painel do provedor e trocadas por novas.
4. O código só lê as chaves no servidor. O navegador e a caixa isolada nunca recebem chave.
5. Defina limites de gasto ou de cota no painel de cada provedor e não ative faturamento automático.

## 6. Próximo passo (quando aprovado, em modo Build)

- Revisar o código dos pedidos #105 e #106 no GitHub.
- Integrar o #105 sem mexer no Motion 2D, no 3D Toon nem no Código 3D.
- Rodar os testes e verificar no navegador com respostas simuladas, sem chamada real.
- Relatar o que passou e o que ainda depende das chaves novas.

## Detalhes técnicos

- Servidor: um adaptador por provedor dentro de funções de servidor protegidas por login. Cada um faz uma chamada por etapa e devolve um erro seguro (`not_configured`, `quota`, `unauthorized`, etc.), sem fallback silencioso.
- Execução: o código de Canvas roda no iframe `sandbox="allow-scripts"` com CSP sem rede, reaproveitando `src/studio/code3d/sandbox.ts`.
- Registro: cada geração guarda provedor e modelo por etapa e a validação de cada uma, sem salvar prompts privados nem chaves.
