# Alex no navegador — experimento isolado

Não altera o estúdio principal nem instala dependências na aplicação. SDK MediaPipe pré-release fixado para avaliação; ainda precisa gerar lockfile, verificar dependências e testar no Android. Não é uma API paga. A síntese usa CPU/WASM no aparelho; a interface não envia o roteiro a um serviço de voz.

Referências: https://developers.google.com/edge/mediapipe/solutions/audio/text_to_speech/index e https://huggingface.co/litert-community/Kokoro-82M .

Em ambiente de desenvolvimento autorizado, instale as dependências desta pasta (npm install; preserve o lockfile produzido). Baixe o bundle CPU oficial `kokoro_int8_fp16.litertlm` e use `KOKORO_MODEL_PATH` para apontar para esse arquivo, executando `npm run prepare` após a instalação. Modelo/SDK não são incluídos neste PR. O preparo copia o WASM e o modelo para a pasta public; confirme licenças, tamanho e hash antes de disponibilizar. `npm run dev` para testar; `npm test` valida o empacotamento WAV sem modelo. Não hospede o laboratório como produto comercial antes de testar a execução real e remover a necessidade de preparo manual para o cliente.

O teste usa exclusivamente pm_alex, PT-BR, 24 kHz, velocidade de 0.75–1.25 e duração máxima de 180 s. Se o SDK fornecer tempos por palavra, exporta um JSON separado. A voz não é substituída silenciosamente. Meça tempo de geração, consumo de memória, pronúncia, cancelamento e importação WAV no estúdio. Compatibilidade real não confirmada.
