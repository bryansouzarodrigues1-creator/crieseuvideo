# CrieSeuVideo — continuidade técnica do Work, 16/11/2026

**Objetivo autorizado pelo proprietário:** evoluir o Toon3D do produto real para encenar histórias com movimentos coerentes e interações físicas. Prioridade: animação 3D funcional, **antes** de fotorrealismo, mundos complexos ou refazer a interface.

## Fontes conferidas

- GitHub `bryansouzarodrigues1-creator/crieseuvideo`, PRs #6–#19.
- Arquivos originais do Work de 14–15 de novembro: `CrieSeuVideo_3D_validacao_2026-11-14.md`, `CrieSeuVideo_Fluxo_Normal_Duracao_2026-11-14.md`, `CrieSeuVideo_Validacao_3D_2026-11-15.md`, `CrieSeuVideo_Cenas_Programaveis_2026-11-15.md`, `CrieSeuVideo_Teste_Autorizado_Gemini_2026-11-15.md` e `CrieSeuVideo_Teste_Real_Gemini_2026-11-15.md`.
- Programa normalizado da chamada real Gemini preservado no repositório: `scripts/live/everest-attempt-2.project.json` e `scripts/live/everest-attempt-3.project.json`; cadeia de verificação SHA-256 em `scripts/live/everest-capture.json`.

## Evolução ordenada (PRs empilhados; não integrados na main)

1. **#6–#8:** laboratório Work, integração e fluxo de prévia/exportação, coreografia 2D/3D com personagens e objetos.
2. **#9–#10:** atuação Lia/Caio 100% Toon3D; andamento/apoios e transferência de lanterna; entrada normal de roteiro e duração automática, 15/30/60/90 s ou personalizada 5–600 s.
3. **#11–#12:** contrato de respostas HTTP, timeline compartilhada e objetos persistentes; guindaste/elevador/atuação. Três MP4 H.264/AAC com voz Piper local, 47.373 s/15 s/30 s e 211 testes aprovados naquele estágio.
4. **#13–#16:** grounding de ações, compatibilidade de resposta JSON Gemini, evitar vídeo não solicitado na entrada do site e não substituir ação 3D indisponível por apresentador genérico.
5. **#17:** linguagem de programação declarativa de cena 3D com meshes, hierarquias, materiais, personagens articulados, curvas, câmera, contatos e validação; programa escrito pela IA sem execução de JavaScript arbitrário. Laboratório v11: 272 testes, MP4 de 42 s, exemplos **escritos pelo desenvolvedor**, não gerados realmente pelo Gemini.
6. **#18:** laboratório v13, integração da resposta real do Gemini e resgate de proposta rejeitada. Três chamadas com roteiro literal `Ele conseguiu escalar o monte Everest mas...`, todas autorizadas e consumidas. Terceira resposta produziu 8 nós, 7 curvas, zero contatos, 15 s/450 quadros; passou alcance IK mas **reprovou visualmente** (ator atravessou plataforma e apenas subiu, sem escalar). 279 testes, build e decodificação do MP4 aprovados. QA em `https://github.com/bryansouzarodrigues1-creator/crieseuvideo/actions/runs/43755996902`.
7. **#19 (esta branch):** auditoria física adicional: exige apoios verdadeiros em subidas, rejeita contato distante/enterrado em superfície e pé/base atravessando caixas sólidas. O teste com a terceira resposta real do Gemini foi atualizado para exigir **rejeição**, preservando os dados originais. Prompt dá instruções de contato ao diretor. Nenhuma chamada nova ao Gemini.

## Limites reais

- **A aprovação de testes unitários ou decodificação do MP4 não equivale a qualidade visual.** O produto possui engine 3D programático funcional para alguns exemplos, mas não gera qualquer atuação de forma convincente.
- Verificação de #19 é conservadora e **não é um motor de física geral**: trata elevação em escaladas de personagens e colisão básica de plataforma box; não cobre geometria triangular arbitrária, fluidos, veículos nem materiais fotorealistas.
- A IA ainda precisa de revisão visual de quadros e realimentação sobre estética, colisões e interpretação. Um erro matemático de IK é diferente de uma cena que conta a história de forma errada.
- Três chamadas autorizadas ao Gemini para Everest **já foram gastas**. Não repetir, enviar novas imagens a modelos, gerar TTS, publicar no Lovable ou gastar créditos de IA sem nova autorização explícita do usuário.
- Projeto público e main/Lovable estão separados das branches empilhadas. Não publicar/merge automático; não forçar push/rebase de branches sincronizadas ao Lovable.
- Teste Android físico ainda pendente; viewport móvel Chromium não prova funcionamento no dispositivo.

## Próximas ações, em ordem

1. Concluir GitHub Actions de #19 com 281 testes e browser QA completo, documentar resultados honestamente.
2. Usar capturas existentes para testar regras de contato com a **geometria real do terreno** e bloquear subidas/atravessamentos errados antes de mostrar preview.
3. Implementar máquina de apoio alternado para pés/mãos, orientação corporal, distribuição de peso, câmera que enquadra os pontos de contato e pequenos movimentos secundários; preservar a linguagem aberta do diretor.
4. Adicionar auditoria visual automática offline (quadros comparados, silhueta, atravessamento e enquadramento) e, somente com autorização, enviar para modelo multimodal um conjunto de frames e diagnósticos para corrigir proposta.
5. Validar **um novo roteiro 3D sem presets temáticos**, com movimento convincente e MP4 completo; comparar prévia e exportação em 9:16 e 16:9; só então testar Android real, narração e expandir catálogo.
6. Manter as melhorias revertíveis e em PRs empilhados; só integrar na produção depois de resultados visuais aprovados pelo usuário.

## Links

- Laboratório privado: https://crieseuvideo-laboratorio.linedmulberry8.chatgpt.site
- Histórico de PRs: https://github.com/bryansouzarodrigues1-creator/crieseuvideo/pulls
- Continuação específica: https://github.com/bryansouzarodrigues1-creator/crieseuvideo/pull/19
