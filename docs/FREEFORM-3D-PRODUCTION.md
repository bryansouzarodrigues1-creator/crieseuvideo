# CrieSeuVideo — 3D livre no editor real (modo experimental)

## A mudança principal

Antes, o modo **Programar com Gemini** estava implementado no laboratório privado, mas o editor do site real oferecia apenas Criativo e Galeria. Embora o backend tivesse o diretor SceneProgram, o usuário não conseguia pedir diretamente uma cena 3D original por essa interface.

Esta branch cria uma opção **3D livre — Gemini direto** exclusivamente quando o motor está em 3D.

### O que o usuário verá
- Estilos disponíveis: 3D Toon ou Motion 2D. No 3D, aparecem os modos Criativo, Minha galeria e **3D livre**.
- Escolher o modo não dispara nenhuma requisição nem gasta créditos.
- Clicar em **Programar 3D com Gemini** faz **uma** chamada de texto à API Gemini para tentar produzir nós 3D originais, câmeras, keyframes, contatos e `motionChecks`.
- A API direta só usa `GEMINI_API_KEY` do servidor. **Não envia o pedido à IA paga do Lovable**, mesmo que o gateway esteja configurado no restante do aplicativo; não existe retry automático com outro provedor.
- Antes de alterar a prévia, o editor valida o plano com Three.js, geometria, rig, IK, contatos e assets GLB autorizados. Falhas não substituem a prévia anterior por um slide genérico.
- A interface informa a quantidade de verificações matemáticas feitas, quando a IA fornece `motionChecks`, **sem confundi-las com uma revisão artística**.
- Trocar para Motion 2D cancela a seleção 3D livre (o motor 2D do Claude pode ser incorporado em outra branch).

## Contrato de qualidade
- `sceneProgram` suporta novas geometrias, incluindo perfis `lathe`; admite formas genéricas, sem nome de catálogo obrigatório.
- `motionChecks` são opcionais para projetos legados, mas a instrução enviada ao Gemini pede explicitamente provas de movimentos e pausas no tempo.
- A verificação é local e determinística. Rejeita jarras paradas, rotações inexistentes, e movimento indevido no intervalo em que uma peça deveria estar fixa. **Não prova que o objeto tem o aspecto correto nem substitui a avaliação de vídeo.**
- O caminho de GLB só aceita IDs aprovados, não URLs retornadas pela IA. Falta integração de armazenamento/geração autorizada fal e auditoria de licenças.
- `SceneProgram3D.validateContacts` continua responsável por cinemática inversa, escaladas apoiadas, e alguns testes de colisão. Não é um simulador de física universal.

## Custos, segurança, homologação
- Esta implementação foi escrita sem chamar Gemini, Lovable AI, Meshy, Hunyuan, Nano Banana, Veo ou TTS.
- A futura utilização do botão de gerar **poderá consumir tokens/cota de API Gemini**, mesmo que o usuário possua Google AI Pro; a assinatura do aplicativo e a API são cobradas separadamente.
- Para a publicação é necessário instalar uma credencial atual em `GEMINI_API_KEY` nos Secrets do backend; nunca versionar essa chave e rotacionar as chaves compartilhadas em chat.
- Antes de produzir conteúdo para terceiros, implementar limite de uso por usuário, rastreio de cotas/custos, revisão de assets, proteção contra abuso e QA Android.
- O usuário ainda precisa aprovar o merge/publicação. A branch é empilhada sobre `feat/3d-motion-contracts` e PRs #22/#21/#20/#19; nenhum merge automático.

## Procedimento de teste após merge autorizado

1. Abrir o editor em ambiente de homologação e selecionar **3D Toon → 3D livre**.
2. Inserir um roteiro novo sobre máquina, natureza ou objeto, sem fornecer exemplos predefinidos.
3. Confirmar que a seleção do modo não gerou nenhuma chamada à API.
4. Clicar explicitamente em Programar 3D com Gemini uma única vez, com limite de custo previamente acordado.
5. Se a proposta falhar, verificar diagnósticos e usar correção apenas após nova autorização de chamada.
6. Inspecionar a cena 3D em 9:16 e 16:9, com atenção a movimentos falsos e objetos atravessados.
7. Exportar MP4; checar codec, frames, duração, faixa de áudio, legendas e último quadro em Chromium e Android real.

## Limitação principal

A automação está **conectada no código**, mas ainda **não foi testada com uma nova resposta real do Gemini nesta branch**, nem publicada. A demonstração de liquidificador é uma prova do interpretador/renderer, não de geração visual inédita pelo modelo.
