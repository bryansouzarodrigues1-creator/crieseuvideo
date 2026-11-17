# Grua — revisão real do movimento humanizado V3 (17/11/2026)

## Base da comparação
- PR de pesquisa #42 empilhado sobre #41, sem merge no main
- GitHub Actions: https://github.com/bryansouzarodrigues1-creator/crieseuvideo/actions/runs/44095004778
- Artefato da execução final: crane-human-gait-v3-20s-engine-qa
- Cena do agente, NÃO gerada por Gemini real
- H.264 720 × 1280, 30 fps, 600 quadros / 20s, sem narração; arquivo e preview verificados
- Browser, testes de rig, verificação de tipos e build: aprovados
- Zero chamadas pagas/IA reais; o provedor no navegador é interceptado

## Mudanças demonstradas
1. Movimentos pequenos de contrarrotação de tronco/cabeça com a passada.
2. Braço com objeto acoplado permanece mais estável; outro braço balança.
3. Inclinação quando carrega carga, sapatos orientados na direção do caminho e flexão limitada na fase de balanço.
4. Articulações visualmente suavizadas e respiração discreta por tempo absoluto; seeking aleatório determinístico.
5. Respeito aos movimentos autorais/contatos e IK — não substitui mocap.

## Revisão visual independente do sucesso do CI
A comparação em 1, 2,5 e 4 segundos mostra melhorias **sutis**, não uma revolução na naturalidade. Em particular, a postura de joelho em certos instantes ainda é exagerada, e o objeto seguro continua preso ao formato rudimentar do rig. O cenário permanece com grande área vazia de céu e pouca demonstração da mecânica. Não deve ser chamado de resultado profissional.

A medição de diferenças de pixels dos primeiros 5 segundos, em 30 amostras a 144 × 256, encontrou em média ~1,86% de pixels com diferença RGB média >25/255 entre V2 e V3. É apenas uma medida de alteração visual (não uma medida objetiva de naturalidade); evidencia que os ganhos ainda são modestos.

## Próxima mudança relevante
Substituir a animação manual/procedural rudimentar por **locomoção com ciclos de caminhada de rig esquelético real** (FBX/GLB licenciado), retargeting, two-bone IK com contato de pés e inversão de movimento por direção. Adicionar estados de ação e carregamento real de objetos e uma direção de câmera/eventos específica; depois comparar os quadros com referência humana. Não fazer merge/publicar sem aprovação visual do usuário.
