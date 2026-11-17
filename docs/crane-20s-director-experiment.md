# Experimento isolado — grua em três etapas (20 segundos)

Data: 17/11/2026. Base: branch \`feat/3d-toon-look\` / PR #39.

## Pergunta

O CrieSeuVideo consegue mostrar ações mecânicas contínuas e não apenas
apresentar objetos enquanto a narração descreve mudanças?

A primeira prova **não é geração autônoma por IA**. Trata-se de uma calibração
escrita pelo agente, usando exatamente o contrato público do SceneProgram.
Ela serve de controle para localizar limitações no motor, não para provar que
Gemini ou ChatGPT conseguirão escrever a cena sem correções.

## Roteiro e critérios

Duração-alvo: 20 s, em três frases/etapas.

1. Um trabalhador carrega cimento e perde a força: deve caminhar e reagir.
2. Instala uma roldana: a roda gira, a corda encurta e a carga sobe.
3. Monta um guincho: o motor, o tambor e a engrenagem giram; a **mesma** carga sobe ao alto.

A animação usa cena e IDs persistentes; os testes medem continuidade da carga,
movimentos independentes de cada etapa, ausência de personagem deslizando com
as pernas estáticas, validação do contrato, exportação MP4 H264/30 FPS,
ambos os formatos, comparação de quadros renderizados e busca em tempo aleatório.

## Como rodar

No GitHub Actions, o workflow \`Crane 20s offline browser experiment\`
é executado apenas na branch \`experiment/crane-action-audit-20261117\`.
Ele não usa credenciais Gemini/ElevenLabs/Lovable. O arquivo
\`crane-20s-agent-authored-offline-qa\` contém MP4 e frames de auditoria
**somente se o workflow passar**.

Localmente, depois de instalar as dependências e o Chromium do Playwright:

\`\`\`sh
bunx vitest run src/studio/explainer/sceneProgram/actionDensity.test.ts \
  src/studio/explainer/sceneProgram/craneExperiment.test.ts
bun run build
node lab/build.mjs
SCENE_PROGRAM_EXPERIMENT=crane bun scripts/scene-program-qa.mjs
\`\`\`

## Auditoria geral incluída

\`actionDensity.ts\` calcula movimentos medidos da timeline sem confiar
nos \`motionChecks\` enviados pelo modelo. Emite avisos sobre frases
praticamente imóveis, intervalos imóveis >=1,5 s e translação de
ator sem movimento correspondente das pernas. Não força correções nem
modifica projetos salvos.

Limite importante: curvas ativas **não comprovam** visibilidade,
objeto correto, física, humor, narrativa, qualidade visual ou sincronismo
da fala. O auditor também não prova caminhada convincente quando os pés se
movem. Aprovação humana deve inspecionar o MP4 e frames.

## Comparação A/B proposta

- **A / baseline:** \`craneExperiment.ts\`, autoria programática controlada.
- **B / IA:** exatamente o mesmo texto e duração com o Gemini real escrevendo
  o SceneProgram em uma sessão autorizada e isolada, sem fallback e sem retries
  inesperados, após avaliar o orçamento. Ainda NÃO executada neste PR.
- **C / direção por agente:** geração por um agente que pode inspecionar seus
  quadros e revisar o programa, ao contrário de uma resposta única.
  Ainda NÃO executada neste PR.

Pontuação de revisão: correção da ação (0–10), movimento visível (0–10),
legibilidade do mecanismo (0–10), consistência do cenário (0–10),
câmera e ritmo (0–10), aparência (0–10).

Não mesclar no \`main\`/não publicar no Lovable antes de revisão humana e
validação de fluxos reais. Não confundir fixture, CI e geração Gemini real.
