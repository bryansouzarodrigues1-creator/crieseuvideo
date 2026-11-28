# Alex no navegador — experimento isolado

Não altera o estúdio principal nem instala dependências na aplicação. SDK MediaPipe pré-release fixado para avaliação; ainda precisa gerar lockfile, verificar dependências e testar no Android. Não é uma API paga. A síntese usa CPU/WASM no aparelho; a interface não envia o roteiro a um serviço de voz.

Referências: https://developers.google.com/edge/mediapipe/solutions/audio/text_to_speech/index e https://huggingface.co/litert-community/Kokoro-82M .

Em ambiente de desenvolvimento autorizado, instale as dependências desta pasta (npm install; preserve o lockfile produzido). Baixe o bundle CPU oficial `kokoro_int8_fp16.litertlm` e use `KOKORO_MODEL_PATH` para apontar para esse arquivo, executando `npm run prepare` após a instalação. Modelo/SDK não são incluídos neste PR. O preparo copia o WASM e o modelo para a pasta public; confirme licenças, tamanho e hash antes de disponibilizar. `npm run dev` para testar; `npm test` valida o empacotamento WAV sem modelo. Não hospede o laboratório como produto comercial antes de testar a execução real e remover a necessidade de preparo manual para o cliente.

O teste usa exclusivamente pm_alex, PT-BR, 24 kHz, velocidade de 0.75–1.25 e duração máxima de 180 s. Se o SDK fornecer tempos por palavra, exporta um JSON separado. A voz não é substituída silenciosamente. Meça tempo de geração, consumo de memória, pronúncia, cancelamento e importação WAV no estúdio. Compatibilidade real não confirmada.

## Integração experimental com o Studio

Depois de preparar o SDK e o modelo com licenças verificadas, execute `node prepare-studio.mjs` nesta pasta. O script compila o worker e prepara `public/alex-local/` com um manifesto. Esses arquivos são ignorados pelo Git; não são publicados automaticamente. O botão do Studio solicita confirmação antes de baixar o modelo (cerca de 295 MB), gera WAV e importa o áudio no projeto, sem fallback pago. Sem o pacote, exibe um erro explícito.

Antes de publicar: confirme que a hospedagem suporta arquivos desse tamanho, a distribuição comercial dos pesos/SDK, e envie no recurso JS do worker uma política CSP de resposta HTTP `default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; worker-src 'self' blob:` (valide compatibilidade do SDK). O worker bloqueia fetch/XHR externos em código, mas a CSP e o teste de rede no deploy são necessários antes da liberação ao público. O cliente não tem de instalar um servidor Kokoro, mas precisa baixar os pesos. Teste em Android físico antes de prometer compatibilidade.
