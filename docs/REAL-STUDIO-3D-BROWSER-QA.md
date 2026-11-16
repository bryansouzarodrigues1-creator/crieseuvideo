# CrieSeuVideo — auditoria no navegador do editor 3D livre (16/11/2026)

## Status
**Aprovado em GitHub Actions**, branch de QA separada da produção. Sem publicação, sem merge e **sem chamadas pagas**.

- GitHub Actions: https://github.com/bryansouzarodrigues1-creator/crieseuvideo/actions/runs/43943876900
- Evidências (6 arquivos, imagens PNG e JSON): https://github.com/bryansouzarodrigues1-creator/crieseuvideo/actions/runs/43943876900/artifacts/14263652311
- 312 testes unitários (45 arquivos), TypeScript e compilação do site + laboratório passaram.
- Chromium/SwiftShader abriu **a interface React do CrieSeuVideo real**, não o laboratório; tela testada: 393×852, cena vertical 720×1280 e horizontal 1280×720.

## Procedimento executado
1. Abrir `/` e aguardar "Do roteiro à animação.".
2. Selecionar "3D livre — Gemini direto". Confirmar **0 requisições** de planejamento nessa ação.
3. Escrever o roteiro "A jarra encaixa na base do liquidificador e suas lâminas começam a girar."; duração **Personalizada: 8 s**; desativar voz para evitar qualquer TTS.
4. Clicar "Programar 3D com Gemini". Interceptar apenas `/api/ai/explainer-plan` e devolver a saída **simulada** com o mesmo contrato normalizado usado pelo servidor, baseada no programa procedural manual do teste #22. Confirmar que a requisição contém `mode:"program"`, `engine:"3d"`, `targetDuration:8` e a frase original exata.
5. Conferir aviso de **4 ações medidas**, além de 3 capturas WebGL da cena em **1.0 s**, **5.0 s** e **7.7 s**. Dimensões corretas, conteúdo não vazio e hashes distintos.
6. Simular **503 Service Unavailable** na segunda geração. Confirmar que o programa anterior, o texto da cena e todos os pixels do quadro de 5.0 s permanecem **idênticos**.
7. Alternar para 16:9 sem nova chamada de IA; confirmar canvas 1280×720 e não vazio.
8. Nenhuma exceção JavaScript não tratada. Os únicos erros de rede previstos foram fontes remotas **bloqueadas deliberadamente** pelo teste offline e o próprio 503 simulado.

## Limitações / o que o teste não comprova
- **Não comprova que o Gemini cria uma cena inédita.** A resposta da API foi simulada e usou programa mecânico previamente escrito, para isolar defeitos da integração UI → API → cena 3D → canvas.
- Não há teste de TTS/MP4 neste QA específico. O MP4 3D foi testado separadamente no PR #22 e no PR #23.
- Ainda não comprovou qualidade cinematográfica, realismo de rig/colisões, interpretação semântica de qualquer roteiro, nem compatibilidade com aparelho Android físico (apenas viewport móvel no Chromium).
- `motionChecks` são autodeclarações opcionais do modelo; a validação numérica detecta movimento/pausas incoerentes quando declaradas, **mas não detecta toda omissão semântica**.
- Modelos GLB seguem IDs autorizados; não há pipeline automático de ingestão dos modelos fal nem custo gratuito garantido.
- A opção não está publicada. Esta branch integra uma cadeia de PRs de rascunho sobre #24; não se deve fazer merge automático.
- Para ensaio real com Gemini será necessário segredo válido em `GEMINI_API_KEY` do servidor de homologação e autorização de custo/cota.

## Decisão de arquitetura
Preservar tanto o 3D procedural gerado por dados quanto a opção de GLB aprovado, sem aceitar JavaScript arbitrário, URLs externas, chave no cliente ou fallback pago silencioso. Só declarar a automação generativa de ponta a ponta comprovada após uma chamada real Gemini **autorizada** sobre um roteiro novo, inspeção dos quadros e exportação.
