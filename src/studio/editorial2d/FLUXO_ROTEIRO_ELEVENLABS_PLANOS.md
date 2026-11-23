# Cinema 2D — Jornada de criação, narração e planos (proposta)

Status em 23/11/2026: integração parcial no PR #108; nenhum plano/pagamento publicado e nenhuma chamada paga de IA nesta etapa.

## Jornada ideal do usuário no celular
1. Escolher tema, público e modelo visual: Storytelling 2D, Motion Editorial, Cutout 2D ou Parallax leve.
2. Escolher duração pretendida e áudio:
   - Narração: Gemini futuramente gera um roteiro, o usuário revisa, aprova, gera MP3 com a PRÓPRIA conta ElevenLabs e importa.
   - Sem narração: Gemini futuramente monta ação visual, textos curtos e ritmo pela duração desejada; música/efeitos opcionais.
   - Automático: roteiro escrito ou MP3 classificado como voz sugere narração; caso contrário, sem fala. MP3 sem classificação exige confirmação — extensão não identifica voz ou música.
3. Gemini gratuito (quando conectado) produz StoryScriptV1 em JSON: gancho 0–3s, conflito, personagens, fatos, virada, solução, CTA, texto falado. Não usar fallback Lovable/Claude pago sem autorização.
4. Editor mostra texto limpo e texto para atuação (tags opcionais); aprovação antes de gastar créditos externos.
5. Usuário gera voz contínua na ElevenLabs, escuta, baixa MP3 e importa.
6. Duração real do MP3 é mestre: não cortar, acelerar ou alongar voz. Botão ajusta os limites de cenas ao áudio; não equivale a alinhamento por palavra.
7. Futuro alinhador cria words.json (tempos por palavra) para disparos visuais e legendas. Até lá mostrar "sincronia por duração" apenas.
8. Sem voz, duração pretendida é mestre e motor cria cenas por eventos visuais (futuro diretor Gemini).
9. Renderizador SVG+Canvas gera prévia; QA local verifica limites, texto, contagens, tempo e screenshots. Gemini Vision somente sob uso autorizado e limite de custo.
10. Exportador MP4 integrado depende de áudio, QA, Android e estabilidade de render; nesta versão só PNG/JSON.

## Durações

- Presets de interface: 30s, 60s, 120s, 180s, 300s; limite técnico editor 15s–600s.
- Vídeos maiores compostos por atos de ~20–35s, mantendo mesmos recursos, personagens, áudio e arquivo mestre.
- Estimativa provisória de locução 120–168 palavras/min serve apenas para roteiro; MP3 determina a duração real.
- Alterar duração no protótipo apenas redistribui tempos das mesmas cenas; não gera história nova.
- Sem voz não significa congelar uma cena por minutos: futuro planejador precisa acrescentar ações, comparações e contexto.

## Planos candidatos — NÃO publicados nem aprovados

| Plano | Novos projetos assistidos por IA/mês (hipótese) | Duração máxima por vídeo | Voz |
|---|---:|---:|---|
| Demonstração | a medir | 30–60s | MP3 importado |
| Essencial | 100 | 2min | MP3 do próprio usuário |
| Criador | 300 | 3min | MP3 do próprio usuário |
| Pro | 600 | 5min | MP3 do próprio usuário |
| Ultra Pro | definir após benchmark | até 10min inicialmente | ElevenLabs API do produto, com franquia de caracteres |

**Não são limites comerciais ativos.** Precisamos medir renderização, consumo de IA e custos antes de vender esses benefícios.
- Reedições e reexports locais são diferentes de novos roteiros gerados por IA e podem ter cotas maiores.
- Limites de assinatura devem ser validados pelo backend, nunca apenas HTML ou JavaScript no celular.
- ElevenLabs por nossa API só no Ultra Pro; demais usuários usam sua própria conta/MP3 externo sem compartilhar senhas nem chaves.

## Guia ElevenLabs incorporado ao aplicativo
1. Criar conta em https://elevenlabs.io.
2. Abrir Text to Speech em https://elevenlabs.io/text-to-speech.
3. Colar roteiro aprovado e escolher voz, idioma e modelo; tags dependem da compatibilidade da versão.
4. Gerar fala e ouvir. Regenerações podem consumir créditos.
5. Baixar MP3 depois de gerar ou pelo histórico.
6. Importar no CrieSeuVideo e marcar se MP3 contém fala ou música.
7. Ajustar limites de cena para duração do MP3 sem acelerar o áudio.
8. Plano gratuito ElevenLabs = uso não comercial com atribuição; monetização requer direitos comerciais apropriados.

Fontes verificadas:
- https://elevenlabs.io/docs/pt/eleven-creative/quickstart
- https://elevenlabs.io/docs/pt/eleven-creative/playground/text-to-speech
- https://elevenlabs.io/docs/overview/administration/billing

## Contratos de dados futuros
- VideoIntent = {topic, audience, durationPreset, narrationMode, scriptSource, templateId, planId}.
- StoryScript = {version, text, sentences:[{id, spokenText, storyBeat, expectedVisual}]}.
- NarrationMaster = {kind:'voice'|'music'|'none', mp3AssetId, durationSeconds, transcriptHash, licenseAck, alignedWords}.
- Timeline = {sceneId, start, end, narrationAnchors, components}.
- ProjectPlanPolicy = {maxNewAIGenerationsPerMonth, maxDurationSeconds, voiceIncludedChars, maxExports, allowedStyles}.
- Intenção explícita prevalece. Não tratar MP3 desconhecido como voz sem confirmar.
- Autorização, limite de tentativas e orçamento de IA/voz são responsabilidade do backend.

## Implementado nesta branch
- Passo a passo dentro do editor: ElevenLabs, roteiro limpo, performance e botão Copiar.
- Decisão Auto / Voz / Sem voz + classificação de MP3.
- Presets de duração; player que mantém áudio no tempo real, sem rate proporcional; botão de adaptar cenas.
- Testes unitários de classificação e duration reflow.

## Ainda pendente
- Gemini gerar StoryScriptV1 e DirectorSpec.
- Alinhamento por palavra, transcrição e timecodes verificáveis.
- Exportação MP4 no Cinema 2D.
- Regras de assinaturas aplicadas no servidor; pagamentos.
- QA em Android com voz real.
