# Personagens sobre terreno procedural — ligação groundTo (18/11/2026)

Experimento empilhado sobre o PR #56, sem alterações de main ou publicação.

## Contrato
Um nó `kind:'actor'` pode declarar `groundTo:'idDeTerreno'`. O id deve referenciar uma malha `geometry.shape:'terrain'` estática, com nó raiz, escala 1, rotação 0 e sem instâncias ou track de transformação. O personagem também deve estar na raiz. O validador rejeita identidades inválidas, uso em outros tipos de nós, terreno animado e hierarquia incompatível.

Durante `SceneProgram3D.update(t)`, a posição X/Z vem exclusivamente das curvas de movimento validadas; o renderer amostra `terrainHeight` do mesmo kit procedural Claude e adiciona a altura da superfície ao Y autorado do personagem. Se o ator sair da extensão do terreno, a renderização falha explicitamente para não mostrar uma caminhada sobre apoio inexistente.

Esta correção é **opt-in**: sem groundTo, o comportamento antigo permanece intocado. Quando o sistema de separação de corpos move o personagem, o apoio do root é reamostrado.

## Limites
- O root do personagem segue o relevo, mas não existe ainda adaptação independente do apoio de cada pé (foot IK em declives), orientação de tornozelos à normal da superfície ou navegação por obstáculos.
- Não trata terreno animado, montanhas móveis, escadas, saltos entre terrenos, veículos ou objetos presos à encosta.
- Não transforma clips do GLB em locomoção profissional; é uma base explícita para testes posteriores.
- Não foi feita chamada ao Gemini real. JSON de exemplo e testes são autorados.

## Verificação
`terrainActors.test.ts` simula caminhada e valida altura continuamente, compatibilidade de cenas antigas, rejeições de vínculos inválidos e saída de terreno. O CI da branch executa todos os testes, TypeScript e build. Não fazer merge/deploy antes do visual QA com passos visíveis e continuidade física.
