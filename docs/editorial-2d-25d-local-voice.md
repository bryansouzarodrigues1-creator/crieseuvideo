# Editorial 2D / 2.5D e narração Alex
- Motion 2D usa keyframes declarativos de posição, escala, rotação e opacidade.
- Motion 2.5D é a primeira implementação Canvas em três camadas com paralaxe, não um cenário Three.js completo. A direção vem do Gemini High. Sem fallback Lovable, sem repetição automática, com autenticação e limite inicial de 1500 caracteres por solicitação. Cooldown em memória não substitui cotas duráveis e verificação do faturamento Google.
- O roteiro deve ser preservado; a auditoria informa cobertura de movimentos, não aprova qualidade visual.
- Voz local de teste (desktop): instale Kokoro e soundfile em ambiente Python próprio, eSpeak NG e dependências conforme o sistema. Execute:
  `python scripts/kokoro-local-api.py --origin http://localhost:5173`
  Use a origem exata do site que está aberto (sem barra final). Cole o token mostrado no terminal no painel do estúdio e gere Alex. O navegador chama 127.0.0.1:8765, no mesmo dispositivo, mediante autorização. Se o navegador bloquear conexão local, use WAV importado manualmente. O token não deve ser publicado nem enviado ao servidor do site.
- O primeiro carregamento pode baixar os pesos do modelo. Não há contratação de API, mas há processamento local. O servidor escuta apenas loopback; não exponha publicamente.
- Validação pendente: geração real de áudio, permissões de rede local do navegador, pronúncia e desempenho; Android ainda não tem solução neural integrada. Não vender como produto completo antes disso.
- Próximo teste: tema de 20 segundos com 3 a 5 cenas, comparar 2D e 2.5D, conferir todos os quadros, narrativa e áudio exportado.
