# CrieSeuVideo — UMA chamada real Gemini na última versão experimental 3D (17/11/2026)

## Execução auditável

Autorização explícita do usuário: gerar um vídeo via API Gemini no motor mais recente. Esta prova foi executada em uma branch descartável baseada em \`fcf2e0df444551aecffc88da2bebeafeb7051548\` (PR #44, ainda DRAFT); \`main\` inalterada.

- Inferência original: https://github.com/bryansouzarodrigues1-creator/crieseuvideo/actions/runs/44136484717
- Replay offline dos mesmos bytes: https://github.com/bryansouzarodrigues1-creator/crieseuvideo/actions/runs/44138164821
- Modelo verificado por GET de metadados (0 inferências): \`gemini-3.6-flash\`.
- **1 chamada \`generateContent\`** na primeira execução; sem fallback, sem retries, sem gateway Lovable.
- **0 chamadas de Gemini** durante as tentativas de renderizar e durante o replay direto.
- Roteiro original (12 segundos):
  1. “Na obra, um trabalhador caminha até uma caixa de ferramentas, se abaixa e a pega do chão.”
  2. “Depois ele entrega a caixa ao colega, que a recebe e a leva até uma bancada.”

## Programa REAL devolvido pela IA

Foi aprovado pelo validador estrutural do SceneProgram e preservado integralmente na evidência do workflow.

- Cenas: 2 (\`s1\` e \`s2\`), duração exatamente 12s, sem narração gravada.
- **5 nós:** plano de chão, uma bancada em caixa, uma caixa de ferramentas vermelha, dois atores Toon \`actor\` (não são GLBs humanos).
- Geometria usada: **apenas \`box\`**. Não gerou paredes, canteiro de obras, andaimes ou outros detalhes ambientais.
- **5 tracks:** posição dos dois atores, mão direita do primeiro, mão esquerda do segundo, posição da caixa.
- **2 shots**, **2 contatos** e **4 motionChecks**.
- SHA256 do JSON original: \`fdde4050b4abfa48f180424695642ddd0569a8d49bda58ef720df3f620b4e028\`.

Os modelos CC0 \`Worker.glb\` e \`Casual.glb\` introduzidos como pesquisa no PR #44 não são selecionáveis pelo prompt atual, não foram cadastrados no catálogo de modelos de produção e a reprodução de clips do laboratório ainda falha. **Portanto este vídeo foi produzido pelo motor mais recente, mas usando o tipo antigo de ator \`actor\`, não um GLB humano.** Não esconder essa diferença.

## Resultado de navegador e MP4

A primeira tentativa pela interface React do Studio expirou esperando o estado de visualização. Uma reprodução isolada abriu o MESMO SceneProgram original diretamente na classe \`SceneProgram3D\` com WebGL e exportou o vídeo para diagnóstico.

- Duração técnica: **12,000 s**.
- Quadros: **360**, H.264, 720x1280, 30 FPS.
- Frames distintos em amostras separadas por meio segundo: **24/24** (movimento presente).
- **85/360 quadros rejeitados por IK**, erro máximo de aproximadamente **0,563 m** durante amostragem. A validação geral registra uma falha ligeiramente maior no instante inicial do contato:
  - \`t=1,5242\` s
  - \`worker1.rightHand\` deve alcançar centro da caixa \`[0.6, 0.125, 0]\`
  - raiz do ator \`[0.3, 0, 0]\`
  - distância não alcançável: erro **~0,568 m**.
- A visualização preservou o estado da cena e câmera reais; quando o motor rejeitou um frame, a ferramenta de QA renderizou apenas uma **imagem diagnóstica**, sem considerar aquele quadro uma exportação fisicamente válida.
- O job de replay terminou com **exit code 4 intencional**, status \`DIAGNOSTIC_ONLY_REJECTED_IK\`; o MP4 permanece disponível no artefato GitHub.
- Nenhum erro JS de navegador e nenhuma requisição externa não autorizada durante replay.

## Avaliação visual de quadros reais (não opinião de um teste unitário)

A cena ilustra os trabalhadores e a caixa, mas NÃO acompanha o nível da referência do usuário:
- duas figuras muito parecidas, 3D pouco expressivo;
- fundo com céu grande e chão cinza, sem construção de obra;
- trabalhador não executa um agachamento real; o braço tenta alcançar um ponto impossível;
- a caixa se desloca por keyframes e chega à bancada; isso não comprova pegada, transferência de peso, contato nem entrega física convincente;
- enquadramento distante, pequena densidade de ações visíveis;
- sem voz e sem legendas.

## Diagnóstico fundamentado e prioridades

O resultado comprova **uma ligação real de ponta a ponta entre API Gemini e o SceneProgram**, mas também revela quatro deficiências concretas:

1. **Geração semântica:** o prompt/contrato permite compor um “canteiro de obras” usando apenas uma caixa no chão e um banco. Requer direção de ambiente e biblioteca de assets adequados.
2. **Atuação humana:** o tipo \`actor\` do programa ainda não possui um clipe humano concreto de agachar-pegar-entregar; não basta solicitar um alvo da mão perto do chão.
3. **Contato/IK:** a mão não alcança o objeto com o corpo ereto. Corrigir via sequenciamento validado de locomoção, agachamento, pegada, transporte e transferência física. Não afrouxar silenciosamente o validador.
4. **Exportabilidade:** o fluxo do Studio precisa registrar o erro físico em vez de parecer travado; a QA visual deve continuar independente do teste estrutural.

Para o próximo teste real, primeiro registrar e validar clips GLB CC0 e sockets do esqueleto, depois permitir ao Gemini selecionar clips aprovados e objetos. Somente depois de uma prova offline verde e visualmente convincente pedir uma nova inferência. **Não efetuar retries automáticos.**

## Restrições e integridade

- Nenhum merge \`main\`, publicação no Lovable, nova chave, gravação de ElevenLabs ou segundo pedido de IA.
- Programas JSON e vídeo são evidências do proprietário; não usar como treinamento automático sem consentimento específico.
- A primeira execução de geração foi bem-sucedida; a aceitação física/renderização padrão **não**. O vídeo exportado pela ferramenta diagnóstica não deve ser anunciado como versão final aprovada.
