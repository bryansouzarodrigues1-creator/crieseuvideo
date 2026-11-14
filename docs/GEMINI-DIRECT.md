# Google Gemini direto — direção de cenas (servidor)

## Estado
Esta integração é de **texto/JSON**, não gera vídeo por difusão nem narração.
O desenho final continua executado pelos motores Motion 2D e Toon 3D.
O código fica isolado em uma branch de desenvolvimento até testes e publicação autorizada.

## Configuração segura
Configure as seguintes variáveis/Secrets no backend do projeto Lovable:

- `GEMINI_API_KEY` — chave de API criada no Google AI Studio. **Obrigatória** para modo Gemini.
- `AI_TEXT_PROVIDER=gemini` — usa Google diretamente para os endpoints que chamam `askAi`; não chama Lovable se a chave faltar ou se o Google negar por cota.
- `GEMINI_TEXT_MODEL=gemini-3.6-flash` — padrão. Opcionalmente `gemini-3.5-flash-lite`, ambas em lista restrita.
- `AI_TEXT_PROVIDER=lovable` — comportamento atual do app. É o padrão enquanto não houver configuração.
- `AI_TEXT_FALLBACK=gemini` — opção específica: com `AI_TEXT_PROVIDER=lovable`, somente quando Lovable responde 402/429 permite tentar Google diretamente. **Não habilite por padrão** se o objetivo for gastar zero créditos Lovable.

Nunca coloque a chave em arquivos `src/`, frontend, `.env` versionado ou mensagens e logs. Se uma chave já foi compartilhada publicamente, revogue e crie outra.

## Cotas e custos
- A API Gemini possui faixas gratuitas por modelo e projeto, mas isso **não é equivalente a um modo gratuito forçado**.
- **Antes de ativar** verifique no Google AI Studio/Google Cloud que a chave está em um projeto sem faturamento habilitado (ou com restrições apropriadas). Este adaptador **não impede cobrança se a chave estiver vinculada a um projeto faturável**.
- O módulo não faz retry automático nem troca Google por Lovable quando Google retorna 429. O diretor recebe uma falha estruturada e pausa com aviso; o usuário pode escolher explicitamente “Criar sem IA”. Os endpoints legados mantêm a assinatura nullable por compatibilidade.
- Não usar API de vídeo, áudio, busca web ou ferramentas extras neste adaptador.
- O código usa a API `generateContent` com `responseMimeType: application/json`.

## Direção e voz
- A direção usa no máximo duas solicitações simultâneas e para de iniciar etapas após falha.
- Erros de credencial, cota e JSON incompleto ficam visíveis. Não há substituição silenciosa por um vídeo básico.
- O retorno identifica o provedor/modelo, sem incluir credenciais.
- No modo Gemini, criar cenas não aciona automaticamente a narração Lovable. A voz continua sendo uma ação separada.

## Testes sem custo
Rodar `npm test -- src/studio/server/ai.test.ts`. Os testes simulam HTTP e não enviam solicitações reais.
Depois executar `npm run build` em uma cópia isolada do projeto. Somente então fazer uma chamada voluntária de diagnóstico no plano gratuito, se o proprietário autorizar.

## Escopo não coberto
- `/api/ai/narrate` continua usando gateway Lovable, ou ElevenLabs quando explicitamente selecionado.
- `/api/ai/transcribe` continua no gateway Lovable.
- A API direta não substitui o agente construtor do Lovable nem fornece hospedagem gratuita.
- O controle de quota operacional por usuário e rate limiting do backend devem ser adicionados antes de abertura pública em grande escala.
