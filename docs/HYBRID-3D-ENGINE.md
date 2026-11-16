# CrieSeuVideo — plano do motor híbrido de animação (16/11/2026)

## Direção aprovada
O objetivo não é manter um catálogo de 12 cenários nem fazer o Gemini escolher imagens estáticas. É **deixar o Gemini programar novos objetos, materiais, personagens, câmeras e trajetórias 3D por cena**, com opções para recorrer a modelos GLB/GLTF e mídia generativa quando forem mais adequados. Não reconstruir o site ou substituir a linguagem de programação da branch Work.

## Pipeline proposto (sem chamadas automáticas a serviços pagos)

1. **Roteiro original → cenas com ações e fatos.** Preserve palavras, negações, ordem e duração. Não inferir que um liquidificador real está dentro da boca de uma tartaruga quando o texto é hipotético/metafórico: usar direção semântica.
2. **Gemini de texto → grafo declarativo de cena**, via `sceneProgram`. O modelo fornece nós, pais, materiais, shapes, rotações, trajetórias, contatos e câmeras. O servidor valida todos os campos e rejeita código remoto, URLs, shaders e limites de geometria.
3. **Motor procedural Three.js (preferencial):** primitivas, malhas de triângulos, tubos, superfícies de revolução (nova `lathe`, PR híbrido), InstancedMesh e rigs hierárquicos. Permite gerar **um novo tipo de jarra, vaso, roda, coluna, recipiente** sem existir asset com esse nome.
4. **Resolver recursos com licenças:** se o roteiro exige uma criatura anatômica complexa, um personagem detalhado, rotação mecânica ou roupas, consultar modelos validados GLB/GLTF com esqueleto, ponto de contato, dimensões, texturas e licença clara. A biblioteca **não é uma lista de histórias autorizadas**; apenas acelera qualidade.
5. **Fallback explícito e consentido:** se uma cena não puder ser representada com qualidade suficiente em 3D, solicitar autorização para usar imagem gerada (textura/fundo/ilustração 2D) ou vídeo gerativo (tomada de plano cinematográfico). Nunca fingir que é 3D editável; apresentar o custo estimado **antes** de chamar a API.
6. **Checagem física e narrativa:** IK, pés no chão, contatos, penetração de sólidos, continuidade, câmera, fidelidade do texto e revisão dos quadros. A cena Everest falhou apesar do MP4 ser válido; essa falha deve continuar reprovada por regra e regressão.
7. **Exportação:** renderizar quadros determinísticos, somar TTS/legendas, gerar MP4 com H.264/AAC, validar arquivo, duração e último quadro; testar Android real antes de publicar.

## O que esta branch implementa de fato

- Novo tipo de superfície genérica `lathe`, especificado por `profile: [[radius,height],...]` e `segments`.
- `normalizeSceneProgram` limita comprimento, coordenadas, resolução e custo de vértices; rejeita campos extras e valores não finitos.
- `SceneProgram3D` cria `THREE.LatheGeometry` em tempo de execução: material, hierarquia, animação e câmera permanecem no contrato existente.
- Prompt da IA ensina a criar novos objetos com esse recurso, em vez de pedir `liquidificador` como ID fixo.
- Testes sem IA: recipiente de liquidificador animado; outros perfis; verificações de segurança, limites e seek.
- Este trabalho **não** oferece ainda uma tartaruga com esqueleto completo nem video diffusion. Também não ativa o Google AI Pro como API.

## Exemplo de saída 3D inédita

```json
{
  "id": "recipiente-modelado-pela-ia",
  "kind": "mesh",
  "contextSourceId": "s1",
  "position": [0, 0.5, 0],
  "color": "#C5E8F3",
  "geometry": {
    "shape": "lathe",
    "profile": [[0, 0], [0.3, 0], [0.4, 0.25], [0.55, 0.9], [0.56, 1.1]],
    "segments": 32
  },
  "material": {
    "roughness": 0.08,
    "metalness": 0,
    "opacity": 0.5,
    "emissive": "#000000",
    "emissiveIntensity": 0
  }
}
```

O nome no JSON não aciona nenhum objeto predefinido: **é a geometria, calculada pela IA, que determina sua forma**. O renderer não precisa conhecer `liquidificador`.

## Reuso do trabalho Claude

- Integrar `captionStyles.ts` e o planner de câmeras de `feat/direcao-3d-gemini` **após resolver conflitos em branch separada e testar**.
- Usar `direction/catalog.ts` como escolha de estética rápida apenas no modo legado; não substituir o `sceneProgram` universal.
- Evitar incorporar o fallback `rise_from_below` como se fosse escalada física.
- Não fazer merge automático dos trabalhos concorrentes do Work/Claude.

## Google AI Pro e custos
A assinatura Google AI Pro amplia cotas do Google AI Studio, incluindo capacidade de prototipagem com modelos premium. **Não inclui automaticamente chamadas da API de desenvolvimento do CrieSeuVideo**; API e Cloud Billing são tratados separadamente. Para o site publicado, usar chave de servidor segura, limites por usuário, budget/limites do projeto Google, cache de resultados e nunca passar para API paga sem ação explícita.

## Marcos de qualidade

1. **No custo:** desenho/render e exportação de um recipiente procedural em 3D, com movimento real e teste de segurança, sem Gemini.
2. **Depois de autorização específica:** uma chamada Gemini real para inventar uma forma nova, fora dos modelos de teste, e passar pelo mesmo validador.
3. **Depois:** um vídeo com duas classes de cena (objeto mecânico + fenômeno natural), sem pessoas e sem depender de catálogo.
4. **Depois:** resolver animais e personagens articulados via modelos/rigs apropriados; validar movimento/contatos.
5. **Produção:** relatório de proveniência de assets, cotas, vídeo final verificado em Android e aprovação artística.

## Limites
Não existem garantias de que texto puro gere malhas complexas realistas. Os geradores de imagem Nano Banana entregam pixels, não um GLB riggado. Adicionar `lathe` expande a linguagem procedural, mas não substitui assets 3D detalhados, geradores mesh-to-3D ou simulação física de alto nível.
