# Experimento isolado — grua em três etapas (20 segundos)

Data: 17/11/2026. Base: branch `feat/3d-toon-look` / PR #39.

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

No GitHub Actions, o workflow `Crane 20s offline browser experiment`
é executado apenas na branch `experiment/crane-action-audit-20261117`.
Ele não usa credenciais Gemini/ElevenLabs/Lovable. O arquivo
`crane-20s-agent-authored-offline-qa` contém MP4 e frames de auditoria
se os arquivos forem produzidos, mesmo se uma verificação final falhar.

Localmente, depois de instalar as dependências e o Chromium do Playwright:

```sh
bunx vitest run src/studio/explainer/sceneProgram/actionDensity.test.ts \
  src/studio/explainer/sceneProgram/craneExperiment.test.ts
bun run build
node lab/build.mjs
SCENE_PROGRAM_EXPERIMENT=crane bun scripts/scene-program-qa.mjs
```

## Auditoria geral incluída

`actionDensity.ts` calcula movimentos medidos da timeline sem confiar
nos `motionChecks` enviados pelo modelo. Emite avisos sobre frases
praticamente imóveis, intervalos imóveis >=1,5 s e translação de
ator sem movimento correspondente das pernas. Não força correções nem
modifica projetos salvos.

Limite importante: curvas ativas **não comprovam** visibilidade,
objeto correto, física, humor, narrativa, qualidade visual ou sincronismo
da fala. O auditor também não prova caminhada convincente quando os pés se
movem. Aprovação humana deve inspecionar o MP4 e frames.

## Comparação A/B proposta

- **A / baseline:** `craneExperiment.ts`, autoria programática controlada.
- **B / IA:** exatamente o mesmo texto e duração com o Gemini real escrevendo
  o SceneProgram em uma sessão autorizada e isolada, sem fallback e sem retries
  inesperados, após avaliar o orçamento. Ainda NÃO executada neste PR.
- **C / direção por agente:** geração por um agente que pode inspecionar seus
  quadros e revisar o programa, ao contrário de uma resposta única.
  Ainda NÃO executada neste PR.

Pontuação de revisão: correção da ação (0–10), movimento visível (0–10),
legibilidade do mecanismo (0–10), consistência do cenário (0–10),
câmera e ritmo (0–10), aparência (0–10).

Não mesclar no `main`/não publicar no Lovable antes de revisão humana e
validação de fluxos reais. Não confundir fixture, CI e geração Gemini real.


## Evidência de revisão do primeiro MP4 (rodada A1)

Run: https://github.com/bryansouzarodrigues1-creator/crieseuvideo/actions/runs/44079757662

- O navegador exportou 600 quadros / 20.000 s, H.264 720 × 1280 a 30 FPS.
  O MP4 e oito capturas 9:16/16:9 foram recuperados do artefato
  `crane-20s-agent-authored-offline-qa`.
- O job terminou vermelho **após a exportação** por uma asserção antiga:
  exigia 5 solicitações simuladas para as 3 fixtures do conjunto padrão.
  O experimento opt-in corretamente faz 1 solicitação simulada. A asserção e
  o concat do conjunto normal foram condicionados no commit seguinte.
- Revisão humana da planilha de quadros 8%, 34%, 67% e 98%:
  - **Movimento/continuidade:** carga persistente sobe, roldana e engrenagem
    recebem animação; a primeira frase tem movimento de pernas e reação.
  - **Composição:** muito céu/área vazia em todos os planos; o objeto que importa
    fica relativamente pequeno, e partes do prédio e da máquina são cortadas.
  - **Demonstração:** no trecho de guincho, o motor aparece tarde ou é
    parcialmente obstruído; ainda falta mostrar claramente a ligação física
    entre motor, tambor, cabo, roldana e carga.
  - **Legendas:** as falas de várias palavras cobrem a faixa dos objetos,
    ao contrário do ritmo palavra por palavra do vídeo de referência.
  - **Arte:** blocos muito simples, fundo pouco detalhado e nenhum trabalho
    de texturas, cenário encenado ou efeitos físicos convincentes.

**Veredito:** sucesso técnico de renderização; **reprovação visual/narrativa**
frente à referência. Não usar como publicidade de "qualidade profissional".

Prioridades após esta revisão: (1) mostrar o mecanismo certo na palavra certa,
(2) enquadrar o sujeito e abrir espaço para legenda, (3) evitar fundos vazios,
(4) fazer cabo e carga seguirem causalmente o motor, (5) adicionar modelos
reutilizáveis e rigging, (6) revisar vídeo novamente antes de qualquer merge.

## Comparação quantitativa de ritmo contra referência (somente diagnóstico)

Fonte: MP4 de referência enviado pelo proprietário (`1000857556.mp4`) e o
MP4 real da calibração da grua (20 s). Foram analisados os primeiros 20 s de
cada vídeo, com 40 amostras, imagens redimensionadas para 144 × 256 e
39 pares separados por ~0,5 s. Um pixel foi classificado como alterado se
a diferença média RGB ultrapassou 25/255.

| Indicador | Referência | Calibração |
| --- | ---: | ---: |
| Mediana de pixels alterados em cada intervalo | **49,7%** | **4,6%** |
| Intervalos com menos de 3% da imagem alterada | **0/39** | **12/39** |

**Limitação da métrica:** inclui movimento de câmera, trocas de plano,
legendas, compressão, iluminação e alterações do cenário, não somente
movimento físico de objetos. Não demonstra correção do roteiro nem qualidade
artística. É, porém, uma medida reprodutível de **densidade de mudanças
visuais**, consistente com a sensação de vídeo lento/parado relatada.

Não copiar nem incluir o vídeo de referência no repositório. Guardar somente
o diagnóstico e usar a referência para inspeção privada/estudo de linguagem.

## Fechamento da prova A1 — CI verde

Execução final: https://github.com/bryansouzarodrigues1-creator/crieseuvideo/actions/runs/44080778857

O workflow **passou** no motor real de navegador com o script opt-in,
incluindo 1 resposta **simulada** do provedor, zero cobranças, validação do
programa, montagem, frames 9:16 e 16:9, navegação aleatória, recuperação
de projeto e MP4 H.264 com **600 quadros / 20 s**, 720 × 1280.
Erro médio no último quadro exportado versus preview: **1,39/255**.

O auditor de curvas registrou três trechos com múltiplas propriedades
animadas (5, 5, 8) e **zero avisos** de corpo imóvel/glide. A mediana de
alteração visual foi somente **4,6%**, contra **49,7%** da referência nos
mesmos 20 segundos. Isso prova que **a verificação de curvas, isoladamente,
ainda não mede a energia visual da animação**.

Próxima camada necessária: auditoria de quadros/ótica em conjunto com
verificação semântica de ação e avaliação visual multimodal, antes de concluir
que um vídeo está pronto. A aprovação técnica não se converte em aprovação
artística automática.
