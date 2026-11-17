# Experimento — Caminhada mais humana (V3)

Data: 17/11/2026. Branch isolada: `experiment/human-gait-crane-20261117`.
Base PR #41. PR #43 em rascunho. **Nenhuma alteração em `main`**.

## Resultado verificável

- GitHub Actions: https://github.com/bryansouzarodrigues1-creator/crieseuvideo/actions/runs/44093389063 — **sucesso**.
- Browser WebGL real: 20 s, H.264, 720×1280, 30 fps, 600 quadros, sem áudio.
- Testes automatizados, TypeScript, build e renderização no Chromium aprovados.
- Zero chamadas reais Gemini / ElevenLabs / Lovable. Uma chamada simulada (fixture de programa escrita por agente).
- `maxIKError` nas amostras de renderização: em torno de 5e-16, sem erro de alcance de pé/mão; zero avisos da auditoria de movimento.
- Último quadro exportado comparado com preview: diferença RGB média de 1,419/255.

## O que mudou no motor (não apenas no vídeo de teste)

1. Separação do grupo da coluna/ombros (`spine`) e quadril/pernas no `actor3d.ts` para permitir compensação torácica.
2. A caminhada procedural agora faz transferência sutil de peso para a perna de apoio, contrarrotação de tronco e cabeça e rotação do sapato durante cada passada (heel landing/toe off moderados).
3. Pé acompanha a direção do ator; tornozelo continua usando IK, sem alterar comprimento dos ossos.
4. Braço que segura objeto anexado à mão deixa de balançar como se estivesse livre.
5. Determinismo de posições e atitudes quando o usuário procura tempos fora de ordem; continuam valendo as exclusões para contato autorado, pés autorados, escada e subida.

## Comparação visual honesta

Foi renderizado o mesmo programa de 20 segundos (três etapas da grua) em V2 e V3 e comparados quadros de 1,0 s, 2,3 s, 3,5 s e 5 s. A V3 mostra diferenças **sutis** de postura do quadril e pernas. O resultado ainda é visivelmente estilizado e robótico. O teste não prova marcha biomecanicamente realista.

Limitações visíveis: passo pouco expressivo, pés pouco articulados, rig geométrico simples, movimento de carga ainda pouco convincente, cenário vazio e dinâmica da história com cortes insuficientes. Os sistemas de equilíbrio e anatomia reais, deformação de malha por skinning, motion capture, animações de interação e correção visual multimodal ainda faltam.

**Próxima prioridade:** importar personagens GLB/VRM com esqueleto humanoide e clips licenciados de caminhada/pegar/carregar; retargeting, IK de pés e mãos e sincronização física com objetos. A IA deve decidir objetivos e eventos, não coordenar manualmente cada osso.

Nenhum merge ou publicação sem revisão do resultado.
