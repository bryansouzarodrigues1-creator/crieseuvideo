# CrieSeuVideo — Plano profissional do Cinema 2D

**Status: arquitetura planejada, NAO implementacao concluida.** O PR #108 permanece draft.

## Decisoes
- Foco integral no 2D. Manter os motores 3D intocados.
- Um unico provedor LLM Gemini (modelo gratuito disponivel na chave) em etapas curtas: roteiro, revisao e storyboard.
- Sem chamadas silenciosas ao Lovable pago. Limites/retries explicitos e cache por hash.
- Motor deterministico executa biblioteca validada em vez de Gemini escrever coordenadas/CSS livres.
- Quatro linguagens no mesmo motor: Storytelling SVG, Motion Editorial, Parallax 2.5D, Cutout 2D.

## Pipeline de producao
1. Brief: tema, publico, objetivo, duracao, fatos, CTA.
2. StoryScript: gancho 0–3s, personagem, problema, decisao, prova, licao, CTA. IDs estaveis para frases.
3. TTS: spokenText (sem tags) e performanceText (pontuacao + tags Eleven v4); aprovacao do usuario antes de gastar creditos.
4. Audio: ElevenLabs with-timestamps se suportado pela voz/modelo, ou MP3 importado + forced alignment ElevenLabs (pode custar) ou alinhamento local Whisper.cpp aproximado, com revisao.
5. words.json: palavras com start/end medidos, nunca segundos inventados pelo LLM.
6. Storyboard JSON: Gemini seleciona catalogo, layout seguro, personagens, poses, ambientes, props e anchorWordId.
7. Compilador: valida schema com Zod, IDs, cenas, tempos, colisao de rotulos, contagens e valores.
8. Renderer: renderAt(t) puro a 30 fps em SVG/Canvas, sem setTimeout para deslocar cenas nem randomizacao sem seed.
9. Export: render frame-a-frame + mux de audio master continuo + QA visual e FFprobe.

## Problemas e solucoes
| Problema | Solucao | Validacao |
|---|---|---|
| Roteiros superficiais | roteiro em seis batidas, exemplos concretos, revisao editorial | cada cena possui objetivo e fato/acao |
| Gemini fraco para centenas de coordenadas | JSON declarativo e biblioteca de componentes | validacao do schema sem codigo arbitrario |
| Cotas gratuitas esgotadas | cache, dividir por cenas, retries limitados, geracao por acao explicita, fallback manual | nenhuma chamada paga silenciosa |
| Personagens roboticos | clipes de poses/rig cutout e animacoes de antecipacao/acao/repouso | inspecao de poses e contatos |
| Mesmo visual em cada cena | alternancia de personagens, diagramas e resultados; 1 foco por vez | storyboard variado e legivel |
| Voz e imagem fora de sincronia | tempos por palavra medidos; cenas ancoradas em words.json | checar beats e legendas no audio real |
| Troca de MP3 corta palavra | voz master unica, edicoes por frase e realinhamento | sem lacunas ou repeticoes |
| Tags de TTS viram legendas | fonte clean spokenText separada de performanceText | legendas sem tags |
| Legenda fora da tela | slot exclusivo, medicao de texto e quebra automatica | bounding boxes nas margens seguras |
| Falha no celular | preview responsivo baixa resolucao, export 1080p sob demanda | teste Android real |
| Exportacao perde quadros | frame index/fps, seed fixa, export offline deterministico | contagem frames/duracao/AAC/MP4 conferidos |
| Numeros ou promessas inventados | revisao factual, indicar exemplo ilustrativo, sem monetizacao garantida | roteiro e tela coerentes |
| Credenciais expostas | keys apenas no backend; projeto/API autenticados | sem chave em JS publico |

## Dados de exemplo
- StoryScriptV1: {id, narrativeRole, spokenText, visualIntent, entities}.
- TTS: {spokenText, performanceText, voiceId, approvedAt, scriptHash}.
- WordAlignment: [{id, text, start, end, confidence}].
- DirectorSpecV1: {sceneId, startWordId, endWordId, layout, layers, beats: [{anchorWordId, componentId, preset}]}.
- RenderManifest: {fps, resolution, audioHash, specHash, totalFrames, qaResults}.

## Problemas tecnicos adicionais
- Poses mais sofisticadas devem ser adicionadas a catalogo e testadas antes de liberadas ao Gemini.
- Editor de legendas permite ajuste humano quando aligner tiver baixa confianca.
- Eleven v4 nao aceita SSML break; usar Audio Tags e pontuacao na performanceText.
- Modo gratuito da API Gemini varia por modelo, regiao, conta e rate limit; nao garantir chamadas ilimitadas.
- A API do ElevenLabs nao e presumida gratuita/ilimitada; disponibilizar importar MP3.

## Sequencia de entrega
- P0 contrato StoryScript/DirectorSpec + catalogo + editor (estamos nessa fase no PR #108).
- P1 Gemini em 2 chamadas sob demanda: roteirista e diretor JSON, com schema e cache.
- P2 TTS e upload MP3 + words.json; comparar transcricao real com roteiro.
- P3 renderer, export MP4 por frame e QA automatizado.
- P4 biblioteca Cutout e Parallax, testes Android e revisao profissional.

**Ainda nao existem nesta nova tela:** geracao automatica pelo Gemini, timestamps reais por palavra ou MP4 garantido. Nenhuma chamada paga foi iniciada para registrar este planejamento.