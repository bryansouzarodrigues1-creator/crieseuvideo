# Evolução profissional do estúdio
## Direção 3D pelo Gemini (branch feat/direcao-3d-gemini) — 16/11/2026
- [x] Catálogo único de capacidades do motor 3D (cenário, ação, entrada, roupa, props, câmera) em `direction/catalog.ts`.
- [x] Gemini só escolhe itens do catálogo (saída estruturada); o que vier inválido é trocado por padrão seguro e pedidos que o motor não faz vão para `unsupported`.
- [x] Plano B determinístico pelas palavras da cena (a cena do Everest vira topo nevado + jaqueta amarela + bandeira) e câmera dirigida determinística por tempo (`direction/camera.ts`).
- [x] Testes unitários da direção e da câmera (50 testes de lógica pura passando, rodados fora do Vitest).
- [x] Formato REST do Gemini conferido na documentação oficial (`generationConfig.responseFormat.text`); modelo padrão `gemini-3.5-flash` (sobrescreva com GEMINI_MODEL).
- [ ] Verificar o renderer 3D (`toon3d.ts`: topo nevado, bandeira, entrada, câmera) rodando o app: não foi possível sem instalar dependências.
- [ ] Rodar `npm test`, `npm run lint` e `npm run build` completos antes de ir para a main.
- [ ] Ativar o Gemini: pelo gateway da Lovable (padrão, LOVABLE_API_KEY) ou direto (AI_PROVIDER=gemini + GEMINI_API_KEY em Secrets, nunca no repositório).

## Revisão das atualizações do GitHub — 15/11/2026
- [x] Comparar a main do GitHub com o app e identificar as propostas recentes.
- [x] Revisar a cadeia consolidada dos PRs #6 → #7 → #8 → #9 → #10 → #11, que inclui as correções dos PRs #2–#5.
- [ ] Integrar e adaptar as correções revisadas: aguarda aprovação do plano de integração.
- [ ] Validar direção, narração em cache, duração e encenação com respostas simuladas e vídeos locais, sem chamadas pagas: depende da integração.
- [ ] Ativar Gemini direto: depende de credencial segura e confirmação de faturamento/cota do projeto Google; não usar a chave publicada no chat.

## Histórico das etapas anteriores
- [x] Criar uma tela de produção livre com estilos 2D, 3D, anime e motion graphics.
- [x] Integrar geração real de vídeo por IA, com conta, armazenamento privado e histórico.
- [x] Preservar o editor de cenas e simplificar os controles no celular.
- [x] Verificar tela de celular, chamada real da IA e recebimento do MP4.
- [ ] Verificar geração, histórico privado e download pela conta do usuário: aguarda primeira entrada com Google ou Lovable.

## Primeira etapa
- [x] Instalar ferramentas de modelos e animação 3D.
- [x] Integrar modelos GLB e imagens próprias ao palco existente.
- [x] Permitir selecionar animações do modelo e editar títulos ao vivo.
- [x] Conferir reprodução, troca 2D/3D e visualização no celular.

Revisão completa da coreografia do motor antigo continua fora desta etapa; vídeo gerado não é um modelo 3D editável.
## Narração e animação natural
- [x] Narração natural por cena, com legenda e duração calculadas pela voz, e áudio no vídeo baixado.
- [x] Personagem com braços, respiração, piscadas, olhar e boca falando; transições de câmera entre cenas.
- [x] Novos desenhos grátis: gráfico subindo e dinheiro.
- [ ] Baixar vídeo com voz no aparelho do usuário: não testável no navegador de teste.
