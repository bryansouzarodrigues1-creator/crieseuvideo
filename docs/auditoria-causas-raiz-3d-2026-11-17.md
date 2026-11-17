# Auditoria de causas-raiz — CrieSeuVideo 3D
Data: 17/11/2026 · Investigação de leitura, sem alteração do aplicativo/produção

## Escopo e evidências

- Código: `main` e pilha experimental PR #46, #47, #48. As PRs permanecem DRAFT e não estão integradas à `main`. A árvore de `main` não possui `src/studio/explainer/sceneProgram/`; portanto os recursos de laboratório não equivalem à versão implantada.
- Referência fornecida pelo usuário: `1000857556.mp4`, 177.6627s, 720×1280/30fps, H264 **com AAC**, analisada apenas em seus primeiros 30s.
- Experimento: `cement-hoist-30s.mp4` do GitHub Actions `44187198716`, 30s, 720×1280/24fps, H264 **sem áudio**, animado por código manual. CI aprovou 406 testes, compilação, bounds de câmera e 5 provas de mudança de pixels. **Não foi gerado autonomamente pelo Gemini.**
- Estudo de ritmo: em 29 intervalos (t=0..28s, comparação com t+0,5s), quadros reamostrados para 180×320; pixel marcado se qualquer canal BGR muda mais de 20/255. Mudança média **55,06% na referência** e **6,47% na nossa exportação**. Esse contraste inclui cortes, legendas, transições e cenários da referência; **não** equivale a qualidade de movimento nem a benchmark neutro de movimento humano. Piores trechos do teste incluem 9–9,5s (0,26%) e 13–13,5s (0,29%).
- A última aprovação do PR #48 é `44193233040` (409 testes). **São testes de software e heurísticas**, não aceitação semântica dos vídeos.

## Causas-raiz verificadas, em ordem de prioridade

### CR1 — Falta de representação obrigatória de história e eventos (CRÍTICA)
`src/studio/server/director.ts` chama `askAiResult(...SCENE_PROGRAM_GUIDE...)` para criar um **único JSON gigante** com nós, keyframes e câmera; ele retorna o plano depois de normalização, sem etapa separada de storyboard de ações e consequências, nem revisão de quadros pelo modelo.

`src/studio/explainer/sceneProgram/score.ts` guarda `nodes`, `tracks`, `shots`, `contacts`, `cables`, `motionChecks`, mas não uma entidade/evento formal que defina `precondição -> agente -> alvo -> ação -> pós-condição`. Quando uma pessoa "pega o saco", o sistema não exige um evento de posse nem prova de que o mesmo saco entrou no palete. Quando motor "aciona" palete, o sistema não representa essa causalidade.

**Efeito:** vídeo com peças girando, trabalhador deslizando e objeto subindo sem encenação que conecte os fatos.

### CR2 — Movimento do mecanismo não é causal (CRÍTICA)
No laboratório `lab/cement-hoist-30s/program.ts`, os tracks de `pallet.position`, `upper-pulley.rotation`, `big-gear.rotation`, `small-gear.rotation` e `drum.rotation` são **curvas independentes**.

O constraint `cables:[{node:'rope-body',from:'upper-pulley',to:'load-hook'}]` mantém um cilindro geometricamente ligado ao gancho, mas não faz `motor -> engrenagem -> tambor -> comprimento de cabo -> altura da carga`. A prova de erro geométrico quase zero **não** é prova de transferência de força ou de efeito mecânico.

**Efeito:** motor girando não conta visualmente a causa da subida.

### CR3 — Planejamento temporal e edição muito pobres (ALTA)
O laboratório de 30s possui um único `sourceId=s1` e 5 cortes de câmera nas fases [0,0.24,0.40,0.54,0.78] — durações **7.2, 4.8, 4.2, 7.2 e 6.6 s**. A referência mostra muito mais eventos e demonstrações relevantes, com narração, legendas, close-ups e consequências.

Os cuts de `score.ts` contêm somente enquadramento, `subjects` e `hide`. Não há `reveal/impact/outcome` nem prova da informação transmitida no plano. Adicionar cuts automaticamente pode gerar **mais repetição**, se os novos planos não tiverem estados diferentes.

**Efeito:** longos períodos com quase nenhuma mudança de imagem ou de significado.

### CR4 — Segmentação textual pode destruir a lógica de frases (ALTA)
`scriptScenes()` divide por pontuação e, depois, a cada **18 palavras** (`MAX_SCENE_WORDS=18`), mesmo no meio de uma oração. No arquivo real preservado `crieseuvideo-guindaste-projeto-narrado.json` há 9 cenas, incluindo fragmentos isolados `"com o gancho."`, `"espaço acima da obra."` e `"com a caçamba do caminhão."`, cada um com segundos próprios de exibição.

Esse exemplo usa a arquitetura anterior `production`, não o laboratório `sceneProgram`, mas comprova um risco na segmentação comum e na organização cronológica atual.

**Efeito:** fragmentos que não são ações completas viram cenas e cortes, criando repetições e interrupções absurdas.

### CR5 — Catálogo de ativos incapaz de cobrir assuntos variados (ALTA)
`modelRegistry.ts` registra **um único GLB aprovado por ID** (`expressive-robot-v1`), cujo status de licença ainda requer revisão. Objetos novos são construídos essencialmente de `box`, `sphere`, `capsule`, `cone`, `cylinder`, `torus`, `tube`, `lathe`, malhas de vértices e grupos; há teto de **160 definições de nós**, **256 tracks**, e orçamento de 250 mil vértices. Para um vídeo de 30–120s com vários ambientes, isso força economia visual extrema e tarefas de modelagem excessivas para o LLM em uma única resposta.

**Efeito:** sacos, máquinas, vegetação e pessoas visualmente genéricos. **Não** é falta intrínseca de capacidade do Three.js.

### CR6 — Animação física limitada a curvas, contatos específicos e cabo geométrico (ALTA)
`ProgramTrack` altera posição, rotação e escala, mais canais de ator. `ProgramContact` conecta alvo a membro de `actor` em intervalo, mas não é um sistema universal de posse, pega-solta e apoio para qualquer objeto. `ProgramCable` conecta extremidades, mas não simula peso, motor nem colisão. O fallback de caminhada compensa ausência de clipes, não fornece narrativa de tarefas.

**Efeito:** personagens "patinam", objetos parecem flutuar, não existe transição convincente de pegar/apoiar/transportar, mesmo com curvas suaves.

### CR7 — Critérios automáticos aprovam coisa errada (ALTA)
`motionChecks` demonstram só a alteração em transformações. `cutActivity` e pixel-motion confirmam atividade, mas até um motor girando num close vazio pode passar. O recém-criado `storyContinuity.ts` mede tomadas longas, câmera repetida e mudança de foco, **não entende significado nem prova causalidade** (o próprio código avisa).

Os testes de diretor usam `vi.mock('./ai')`; CI de laboratório usa cena feita manualmente. **409 testes aprovados não medem qualidade de um vídeo novo gerado de verdade pela IA.**

### CR8 — Laboratório não contém áudio e referência não alimenta o diretor (MÉDIA/ALTA)
`1000857556.mp4` possui AAC; o laboratório usa FFmpeg `-an` e gera H264 sem áudio. `exportTimeline.ts` demonstra que o site tem mecanismos de mixagem de voz fora desse laboratório, mas eles não foram usados no ensaio.

O `DirectorInput` recebe `script`, ajustes e propostas anteriores; não recebe uma análise da sequência de referência, dos eventos em cada tomada, nem transcrição do vídeo de entrada. Portanto o sistema não pode automaticamente "reproduzir os 30s" por um vídeo de referência sem um estágio de extração de conteúdo.

**Efeito:** perde-se a sincronização e a função explicativa da narração/legenda; o julgamento de correspondência com a referência fica incompleto.

### CR9 — CI lento não é a mesma coisa que animação lenta (MÉDIA)
No histórico `44187198716`, o render de 720 quadros começou aproximadamente 22:11:31Z e terminou 22:14:25Z (~174s, 4.1 quadros gerados por segundo em navegador headless). Isso é **throughput de renderização**, diferente da cadência percebida do vídeo: nele há 24 FPS, mas ações insuficientes no plano.

**Efeito:** não resolver repetição comprando GPU; acelerar render reduz tempo de geração, não cria eventos novos.

## O que a pesquisa externa confirma (e o que não confirma)

- **Three.js** permite importação de GLB, `AnimationClip`, `AnimationMixer` e blending — é plataforma de execução, não IA que compreende histórias. [Documentação Animation System](https://threejs.org/manual/pages/animation-system.html) e [GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html).
- **glTF 2.0** guarda malha, hierarquia, skins, keyframes, materiais; o padrão **não define ordem de playback, auto-play nem lógica de encenação**. [Especificação Khronos](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html).
- **Blender NLA** organiza e reaproveita blocos de animação, enquanto Geometry Nodes suporta criação procedural e instâncias. [Manual NLA](https://docs.blender.org/manual/en/5.3/editors/nla/introduction.html), [Geometry Nodes Instances](https://docs.blender.org/manual/en/latest/modeling/geometry_nodes/instances.html).
- **Rapier** oferece colisões, corpos rígidos e joints/motores para máquinas que exigem física; pode compor com Three.js, mas **não substitui direção de história nem animação artisticamente autorada**. [Rapier docs](https://rapier.rs/docs/), [Joints JS](https://rapier.rs/docs/user_guides/javascript/joints/).

Nenhuma fonte externa comprova que o CrieSeuVideo alcança qualidade profissional apenas adicionando mais plugins, modelos de IA ou shaders; é necessária uma arquitetura de produção.

## Proposta de correção — preservar o site e o Three.js

1. **Novo documento intermediário, não novo renderer:** texto/voz/referência -> **storyboard de eventos** com tempo, agente/objeto ID persistente, ação, estado inicial, estado final, justificativa visual e ponto de câmera. Esse planejamento deve ser revisado **antes de gerar malhas**. Não basta reforçar o prompt: ele precisa de schema, validações e contrato de dados separáveis.
2. **Asset resolver:** a IA escolhe entre GLBs licenciados, primitivas estilizadas parametrizadas e ativos 3D gerados/curados fora do LLM de texto; cada ativo tem rig/slots, escalas e aparência consistente. Se o objeto não puder ser criado, sinalizar impossibilidade e oferecer revisão em vez de esfera genérica.
3. **Action compiler:** transformar eventos em ações reutilizáveis e estados, com `attach/detach`, `pick/place`, `move along path`, `motor/drum/cable`, contato, velocidade e consequências; retarget de clipes para humanos apenas quando a cena requer. Physics engine onde for relevante, não como substituição de todas as animações.
4. **Direção cinematográfica:** câmera segue a ação, não objetos aleatórios. Cada corte tem propósito (orientação -> problema -> demonstração -> efeito), duração baseada no evento e sincronismo com falas.
5. **Render e revisão:** antes dos 720 quadros, produzir storyboard de 8–16 quadros, prévia de 3–5s, **auditoria semântica de cada beat**, correção local do que falhou. Só então render MP4 inteiro com narração/legendas.
6. **Gate de aceitação:** 3 roteiros inéditos (mecanismo/objeto orgânico/veículo ou animal), um deles com transporte e entrega, gerados por **Gemini real sem codificação manual de cada assunto**. Exigir identidade persistente, início-meio-fim, cortes justificados, objeto reconhecível, áudio/caption sincronizado e nenhuma falha visual bloqueadora. Métricas estruturais ajudam; avaliação humana continua obrigatória.

## Ordem e limites realistas

**P0:** separar planejamento semântico das malhas + corrigir split no meio de oração; dados/validação causal.
**P1:** asset resolver com 10–20 GLBs estilisticamente consistentes e elementos proceduralmente combináveis (licenciamento e armazenamento), ações de posse e máquinas coerentes.
**P2:** prévia curta com revisão automática/humana, edição e sincronização de som/captions.
**P3:** GPU/Blender offline para efeitos mais complexos, se a qualidade visual ou latência justificar.

**Não recomendado agora:** reescrever do zero em outra plataforma, fabricar mais keyframes no JS de um único vídeo, aumentar só quantidade de cortes, ou tornar humanos fotorrealistas antes de resolver a história.

## Estado da auditoria

Esta branch altera **apenas um documento**. Nenhum deploy, merge, chave/API Gemini ou geração paga. Não há prova ainda de geração autônoma semanticamente correta; este documento é um diagnóstico e plano técnico, não declaração de solução pronta.
