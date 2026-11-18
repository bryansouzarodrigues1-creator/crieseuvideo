# CrieSeuVideo — mundos procedurais + objetos Gemini (integração experimental)

Data: 18/11/2026 — branch isolada, baseada no PR #53. Não altera a `main` nem o trabalho do Claude em `feat/3d-scenery-kit`.

## Motivação e fonte das duas implementações

- **Claude / kit procedural:** `src/studio/explainer/sceneProgram/scenery.ts` copiado **sem mudanças** da branch `feat/3d-scenery-kit` (arquivo blob `5f641050bb0b8611882e04a7d841c7c8e8547cfd`). Geradores puros de `terrain`, `water`, `tree`, `rock` e `cloud`, com semente explícita e `terrainHeight`.
- **Gemini / compilador de objetos:** PR #53, `planner/worldBlueprints.ts`, permite que um modelo de texto defina novas peças hierárquicas com geometria, cores, repetição e características visuais. `storyboardPipeline.ts` oferece duas passagens de IA (fatos e geometria), ainda **não conectadas à rota do produto**.
- **Mecânica:** PRs #50–#52, com posse persistente, contatos de mãos por eventos e transmissão cinemática associada à carga.

## Integração nova

`planner/worldScenery.ts` recebe:

```json
{
  "version": 1,
  "regions": [
    {
      "id": "ilha", "sourceId": "s1", "shape": "terrain",
      "size": [18, 18, 4], "seed": 9,
      "position": [4, 0, 0], "roughness": 0.7,
      "color": "#59916A"
    },
    {
      "id": "floresta", "sourceId": "s1", "shape": "tree",
      "size": [2.4], "seed": 2, "color": "#84634D",
      "foliage": "#337951",
      "scatter": {
        "ground": "ilha", "count": 7, "seed": 17,
        "spread": [12, 12], "minimumHeight": 0.4
      }
    }
  ]
}
```

O adaptador **não inventa geometrias em vez do kit**: chama `kitMesh` e `terrainHeight` diretamente, reempacotando a saída como malha segura de `SceneProgram`. Árvores/rochas são colocadas em locais determinísticos acima do solo amostrado, sem atravessar a costa. O motor e o objeto podem ter nós e IDs persistentes junto dos ambientes.

Na etapa opcional da futura IA, o JSON pode conter `sceneProgram`, `bindings`, `worldBlueprints` e `worldScenery`; esses dois últimos são **estruturas declarativas**, não scripts JS. O compilador expande a geometria ANTES do movimento.

## Proteções e limites

- IDs únicos contra os nós pré-existentes; fontes de roteiro válidas; não aceita URL/código/shader nem campos desconhecidos.
- Até 16 regiões por proposta; até 20 árvores/rochas distribuídas por região; valida dimensões, semente, cores, segments, dispersão, altura mínima e correspondência do terreno.
- Orçamento próprio de vértices/índices; depois mantém o validador original `normalizeSceneProgram` (máximo de 160 nós e orçamento global de geometria).
- Rejeita itens sem origem válida, índice fora da malha, geometria inválida, floresta sem terreno, duplicação de IDs e geração em regiões costeiras inacessíveis.
- O mesmo input gera os mesmos vértices e posições: facilita recriar, comparar, refazer e corrigir cenários.

## Verificação técnica e visual

- Testes de paisagens que exercitam o **gerador original do Claude** e o `SceneProgram3D` atual em cenários de oficina, rua e porto com objetos do compilador.
- Novo laboratório `lab/world-and-scenery/` combina 3 trechos de seis segundos, com caixa de ferramentas, carrinho, barco, árvores, rochas, nuvens e ilha costeira, e usa a mecânica do PR #52.
- CI `gemini-procedural-worlds-qa.yml`: teste unitário completo, tipos e build.
- CI `gemini-procedural-worlds-visual.yml`: Chromium/Three.js real, checagens de posição da carga, eixos girando e mudanças de pixels, nove screenshots e MP4 de 18s.

## O que ainda NÃO está pronto

1. **Não foi feito merge da branch inteira do Claude.** A `scenery.ts` foi integrada como geradores puros, para evitar conflito com `stage3d.ts` e `score.ts` que estão em evolução em outra branch.
2. Este adaptador exporta **malhas estáticas em t=0**, inclusive água. Ainda não tem ondas atualizadas em runtime, haze/câmera específicos do Claude, instâncias aceleradas com encaixe no terreno, navegação de atores/veículos na malha de relevo nem física de barco.
3. Os JSONs de demo são **exemplos escritos para teste**, não saídas autônomas do Gemini. O fluxo de duas passagens e os validadores podem consumir propostas de Gemini, mas falta chamada real segura e revisão de imagens.
4. Uma forma desenhada por partes não garante reconhecimento artístico. Testes de geometria e mudança de pixels são insuficientes sem revisão visual.
5. A interface do site não foi alterada nem publicada.

## Próximas etapas

A. Revisar os nove quadros por enquadramento, colisão, leitura dos objetos e pertinência dos biomas.

B. Integrar a implementação nativa de água dinâmica, névoa, árvores instanciadas e `ground` do Claude em branch de integração versionada, com testes de regressão. Não aplicar merge bruto de pilhas de PR.

C. Ligar o fluxo Gemini **por feature flag e limite de cotas**, usando chave somente em Secrets e testes de 1 história inédita com revisão automatizada/humana. O pipeline não deve criar um vídeo sem passar na revisão de quadros.

D. Liberar ao usuário primeiro como preview isolado; publicar na `main` apenas após aprovação real dos vídeos.
