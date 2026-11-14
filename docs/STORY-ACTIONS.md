# Coreografia narrativa 2D/3D — primeira versão

Esta implementação acrescenta **ações físicas verificáveis** ao motor existente. Não substitui o editor, os visuais anteriores ou o laboratório.

## Escopo implementado
- `story` opcional no plano de cena, validado pelo texto literal: `action: pickup|handoff|chase`, `prop: lantern|hat|ball|box|key`, `actors: [{name,color}]`.
- Dois atores distintos e objeto móvel com estado de posse no tempo.
- Transferência **Lia → Caio**: sequência de pegar, aproximar, contato de ambas as mãos, troca de dono e afastamento.
- Transformações puras `storyFrame(story, time, duration)`, iguais em prévia e exportação; seek e reprodução fora de ordem não alteram o resultado.
- **Motion 2D:** atores desenhados com passos, articulações dos braços, rostos e objeto independente.
- **Toon 3D:** duas rigs articuladas com cores diferentes, modelos geométricos reais para os cinco objetos, cena e câmera próprias; braços são direcionados por cálculo IK de dois segmentos.
- **Laboratório:** botão `Ensaio da ação · Lia entrega a Caio`, que carrega uma história original, em 2D, sem fazer chamadas de IA, voz ou vídeo generativo.
- **Diretor Gemini:** o prompt passa a poder pedir `story` apenas quando a frase suporta uma ação literal. A normalização rejeita participantes que não aparecem no texto, papéis invertidos na entrega, negação, condicional, objeto trocado e ações fora do repertório.
- Editar o texto de uma cena invalida coreografia antiga quando ela deixa de corresponder às palavras.

## Modelo de dados de exemplo (não contém credenciais)

```json
{
  "text": "Lia pegou uma lanterna e entregou para Caio.",
  "visual": "custom",
  "setting": "room",
  "story": {
    "action": "handoff",
    "prop": "lantern",
    "actors": [
      { "name": "Lia", "color": "#FFB447" },
      { "name": "Caio", "color": "#4AC6BE" }
    ]
  }
}
```

## Como testar sem gastar créditos
1. Compilar a branch `feat/story-action-choreography` em ambiente de desenvolvimento isolado, mantendo a produção intacta.
2. Executar `npm test -- src/studio/explainer/storyAction.test.ts`, `npx tsc --noEmit` e `npm run build`.
3. No laboratório, clicar **Ensaio da ação**, conferir a sequência inteira, pausar em 25%, 53%, 60% e 100%, e buscar descontinuidade do objeto, mãos sobrepostas, objetos cortados ou labels ilegíveis.
4. Mudar para **Toon 3D** na prévia e conferir o contato das mãos e a mudança de posse. WebGL ativo é necessário; um navegador que só suporta 2D não valida essa etapa.
5. Alternar 9:16 e 16:9; conferir legenda/área segura; depois homologar MP4/WebM com trilhas e duração em Chrome Android.
6. Validar com textos negativos (`Lia não entregou a lanterna`), invertidos (`Caio entregou para Lia`) e não suportados: nenhuma coreografia falsa pode ser reproduzida.

## Limitações honestas
- São **três categorias de ação e cinco props**; não há ainda direção universal de personagens, cenários 3D complexos, vento, água, física rígida, colisões completas ou path planning.
- Braços 3D alcançam o objeto somente quando ele está dentro do alcance físico do rig. Em movimentos iniciais fora do alcance, a animação não deve esticar os ossos; a parte inicial de pegar ainda precisa de polimento visual/câmera.
- Se o verbo ou os participantes forem ambíguos, mantém-se o renderer anterior em vez de inventar uma ação. Isso é intencional e reduz falsos positivos.
- Nenhuma chamada real de geração Gemini, TTS ou exportação de vídeo foi executada nesta branch.
- Testes e build novos precisam ser rodados; não considerar esse código pronto para publicação até render real 2D/3D e revisão no Android.

## Integração
Esta branch empilha sobre `work/export-capture-guard-2026-11-14` (PR #7), que por sua vez se apoia em `work/continuity-2026-11-14` (PR #6). Não integrar isoladamente na `main` sem resolver essa cadeia e verificar os testes.
