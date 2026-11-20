# Material de animação enviado e aplicação no CrieSeuVídeo

Esta revisão usa o arquivo enviado `claude-animation-skills-main.zip`, do projeto [artemnovitckii/claude-animation-skills](https://github.com/artemnovitckii/claude-animation-skills), MIT, copyright 2026 Artem Novitckii. É uma análise do snapshot recebido; os nomes de canais indicam referências de formato, sem comprovar afiliação ou o processo privado desses criadores.

## O que o pacote demonstra

Há dois caminhos. Os templates rápidos recebem uma pequena especificação e produzem uma animação já definida: telefone desmontado, cachorro na estação, casa em blocos, curva, mapa ou planetas. Mudar os rótulos não cria uma máquina, personagem ou história diferente. Os dois motores completos têm rigs, objetos, planos e renderização por tempo; o agente precisa programar a história, renderizar quadros, revisar e corrigir.

O fluxo documentado pelo autor é roteiro -> voz -> tempos -> cenas -> quadros -> revisão -> render -> mixagem -> MP4. A diferença útil para o produto é a combinação de componentes reutilizáveis com direção de cenas e retorno visual. O pacote não fornece um serviço pronto de correção automática nem uma API secreta do Claude.

| Parte do pacote | Recurso útil | Limite para o produto |
| --- | --- | --- |
| `zach-d-films` | Rig articulado, poses, IK de braço, objetos, texturas procedurais, câmeras | Exemplo específico de armaduras; reescrever os planos |
| `stick-figure` | Rig Canvas, expressões, cenários, efeitos e montagem com voz | Exemplo de piratas; voz/alinhamento originais usam pressupostos de inglês |
| Templates rápidos | Desmontagem, mapas, construção, gráficos e composições | Geometria e ações predefinidas |
| Captura de quadros | Revisar planos antes do render completo | Inspeção e correção feitas pelo agente, sem avaliador automático pronto |
| Render por instante | Mesmo tempo deve produzir a mesma imagem | A cena 7 do exemplo 3D ainda memoriza o ponto de soltura entre quadros |

O exemplo 3D fixa Three.js 0.169.0 e captura 720×1280; o comando final sugerido amplia para 1080×1920. O laboratório do site usa core Three.js r187 e outro encoder. Portar os módulos exige adaptação, sem importar o renderer/servidor do exemplo para a origem autenticada.

## O que já foi comprovado no laboratório

O Código 3D recebeu uma resposta real do Gemini 3.6 e a exportou após correções manuais de geometria, contato, movimento e câmera. O programa original, a revisão e a proveniência estão em `scripts/fixtures/code3d-gemini36-crane.*`. O replay dessa revisão não chama a IA. Os detalhes do contrato e isolamento estão em [code3d-experimental.md](code3d-experimental.md).

| Etapa | Situação desta revisão |
| --- | --- |
| Gemini escreve código de uma cena | Comprovado em uma chamada real; isso não comprova generalização |
| Executar isolado e exportar o mesmo `renderAt(t)` | Implementado no laboratório e verificado no navegador |
| Geometria, contato e câmera do vídeo da grua | Corrigidos manualmente; não são reparos universais automáticos |
| Planejar ações, planos e contatos | Instruções no prompt; ainda sem plano separado validado |
| Inspecionar imagens e corrigir falhas automaticamente | Pendente |
| Voz, legendas e duração longa no Código 3D | Pendente; recursos de outros modos não comprovam esta integração |
| Disponibilizar a experiência no site público | Exige integração/publicação e verificação do caminho publicado |

## Aplicação imediata e próximos componentes

Esta revisão reforça o prompt do Código 3D com planos explícitos, fidelidade aos verbos do roteiro, atuação por juntas/alvos e cálculo analítico do instante de soltura. Isso orienta a geração; não comprova uma melhoria visual sem novos vídeos avaliados. Nenhum módulo externo passa a executar na origem do site.

A evolução do processo deve tornar cada etapa observável:

1. Separar o plano de cenas: ação, objetos, duração, enquadramento e contato esperado por plano. Validar cobertura do roteiro e compatibilidade com a duração/voz reais.
2. Disponibilizar componentes confiáveis de rig, pose, easing e contato dentro do runtime isolado. Adaptar os módulos MIT selecionados, preservando crédito/licença, e testar os casos degenerados de IK e conversão entre referenciais.
3. Capturar entrada, ápice/contato e saída de cada plano com o mesmo `renderAt` usado na exportação. Manter imagens, código, tempos e erro juntos.
4. Avaliar imagens contra as ações e contatos planejados. Distinguir falha de execução, repetibilidade, enquadramento e sentido da ação. Um teste de pixels não confirma que o gancho pegou a carga.
5. Corrigir a cena com motivo registrado, número máximo de tentativas e custo explícito. Não repetir chamadas ocultamente; conservar original e revisões.
6. Encadear cenas aprovadas com voz medida e legendas, depois exportar e verificar o arquivo completo. Testar histórias de naturezas diferentes antes de prometer geração ampla.

Até esse circuito estar implementado e exercitado no caminho publicado, apresentar o resultado como laboratório com revisão, sem anunciar que o site já produz automaticamente todo o processo.
