# Laboratório de motores visuais 2D / 2.5D

Esta branch é **experimental** e não deve ser publicada como um site de cobranças. É separada da main, do PR #107 (Asaas) e do PR #110 (mascote).

## Arquivos
- `public/labs/motores-2d-25d.html`: vitrine para celular, links para os dois exemplos.
- `public/labs/editorial-dark.html`: protótipo **original** de 30s, 1080x1920 lógico, 8 templates declarativos. Não depende da execução do GSAP para funcionar; quando CDN indisponível, usa fallback de animação por tempo absoluto. O texto inclui aviso explícito de números **fictícios**.
- `public/labs/ar-condicionado-25d.html`: HTML do Gemini **preservado** conforme upload do usuário (8s, 5 módulos: BoxRoom3D, PaperActor2D, SpriteProp2D, PriceFlipBoard, CameraRail25D). Usa Three.js r128 por CDN e WebGL; ainda não recebeu validação visual de execução neste ambiente.

## Testes efetuados

**Editorial**: Playwright/Chromium em viewport móvel 390x844, CDN externo bloqueado, renderização sem erros de JS, 8 cenas e 24 amostras em áreas seguras sem problemas, mesmo timestamp retorna o mesmo hash do canvas, 390px de largura sem scroll horizontal. Foram registradas capturas da cena em 9 timestamps diferentes. Sintaxe JS conferida com `node --check`.

**2.5D Gemini**: arquivo fonte verificado quanto aos cinco módulos, contrato SCENE_SPEC de 8s, câmera em keyframes, 4 poses/expressões e controles declarados no HTML. JS validado com `node --check`. **NÃO** existe prova neste teste de que o WebGL carregou, de que a cena é visualmente correta ou de que o motor exporta MP4. O navegador de teste não pode baixar os scripts r128 dos CDNs externos.

## Problemas arquiteturais identificados

1. **Não há exportador MP4 completo** em nenhum dos dois HTMLs. O vídeo final requer render frame a frame, muxagem de áudio e codificação MP4.
2. **Interface de frame não compartilhada**: editorial expõe `window.CSVEditorial.seekFrame(n)`; 2.5D mantém `renderAtTime(t)` interna e depende do loop de `requestAnimationFrame`. Antes de integrar no motor principal, criar adapter 2.5D exposto e testar dois renders repetidos.
3. **Áudio 2.5D não é inteiramente reproduzível** porque `ProceduralSound25D.noiseBuffer` usa `Math.random()`. Substituir por gerador semeado e áudio offline antes de exportar.
4. **Sincronismo 2.5D de 8s ainda não depende de TTS**: palavras usam tempos fixos no JSON. Integrar word-level timestamps de ElevenLabs ou alinhador para narrativas arbitrárias.
5. **Números e selo editorial são demonstração**, não dados verificados de mercado. Para publicar análises reais, validar PTAX/fontes e tempo de referência.

## Aceitação para incorporar ao motor oficial
- Renderizar cenas em Android e Chromium, sem corte e sem perda de WebGL.
- Contrato de cena versionado e validado (schema, assets, textos e timestamps).
- Exportação real MP4 9:16, no mínimo 30 fps, duração exata e áudio sincronizado.
- Capturas por cena comparadas visualmente e teste de determinismo para mesmo frame.
- Avaliar desempenho (tempo por frame, pico de memória, tamanho do pacote) e só então promover ao produto.
