# Voz local — etapa experimental

O modo de custo zero usa somente vozes instaladas no aparelho para **prévia**. Web Speech não entrega PCM exportável, portanto prévia não entra no MP4. Importar MP3/WAV próprio ou licenciado usa a duração real e não chama IA automaticamente. A API de narração em nuvem fica bloqueada até existir autorização server-side por plano, reserva de cota e saldo. Não criar múltiplas contas para contornar cotas.

## Experimento Kokoro (desktop, ainda não validado neste projeto)

Modelo: https://huggingface.co/hexgrad/Kokoro-82M (pesos Apache-2.0; conferir também dependências antes de redistribuir). Instalar Python e eSpeak NG conforme o sistema, em ambiente virtual separado. Instalação e primeiro download podem precisar de internet e centenas de MB; inferência é local.

```bash
python -m venv .venv-voice
# Ative o ambiente virtual conforme seu sistema.
python -m pip install kokoro soundfile
python scripts/kokoro-local-voice.py roteiro.txt narracao.wav --voice pm_alex --speed 1.0
```

Vozes candidatas: pm_alex, pm_santa (masculinas), pf_dora (feminina). O script exporta WAV mono PCM16, 24 kHz. O player avançado aceita arquivos de 0,5–30 segundos por sequência; divida o roteiro para esse teste. Não é ainda integração neural no navegador nem prova de qualidade. Validar pronúncia, tempo, memória e compatibilidade Android antes de disponibilizar ao cliente.
