# CrieSeuVideo — revisão de continuidade, 20/11/2026

Base revisada: `main` em `5b1201e`, após integração do PR #85. Referência visual/técnica consultada: HTML da grua enviado pelo usuário, 3.390 linhas, com objetos hierárquicos e encenação por capítulos.

## Mapa do produto

| Caminho | O que existe | Limite atual |
| --- | --- | --- |
| Estúdio Motion 2D | Desenho em Canvas, biblioteca local, voz por cena, legendas, exportação | Qualidade da direção e das ilustrações depende da saída da IA |
| Toon clássico | Three.js, rig procedural, apresentação de arte 2D no cenário | A apresentação diante de uma tela não satisfaz a referência de acontecimentos encenados |
| 3D avançado | Gemini/Lovable → JSON validado → cenários procedurais e ações causais | 2–7 entidades, 1–3 ações, sequências de 8–12 s; uma ação por alvo distinto |
| Laboratório `/motor-3d` | Moto, arca e prisão escritas para prova do motor, exportação determinística | Não são novas gerações por IA |
| Código 3D `/motor-3d/codigo` | Código Three.js novo por roteiro, isolado em iframe | Experimental, 8–12 s, sem narração/legendas e geração real ainda não comprovada |
| Rascunhos #53–#59 | Objetos compostos, kit de paisagens, água animada, terreno/atores, lotes de mundos | Há código experimental fora da principal; não equivale a funcionalidade publicada |

## Falhas e divergências encontradas

1. A página pública consultada ainda exibia autorização extra e o provedor Automático, enquanto `main` já removeu essa caixa e escolheu Gemini direto. O laboratório publicado também não oferecia o link Código 3D. Integração GitHub/Lovable e publicação são etapas distintas.
2. O PR #85 acrescentou testes offline, mas não uma prova de inicialização/exportação do iframe no navegador. O WIP parou por falta de créditos de programação do Lovable; isso não comprova que a cota da API Gemini acabou.
3. O player permitia exportar replay divergente; mensagens de ready aceitavam durações fora de 8–12 s.
4. Erros/substituições descartavam os resolvedores de quadros, deixando os pedidos pendentes até timeout. Cancelamento não interrompia imediatamente um quadro aguardado.
5. Importação assíncrona da biblioteca podia usar o token da próxima carga. Faltava liberar explicitamente recursos e URLs do sandbox.
6. Havia referência a documentação do Código 3D inexistente e nenhum caminho de salvar/reabrir um programa para revisá-lo sem cobrar outra geração.

Esta revisão corrige o ciclo de execução/exportação, permite salvar/reabrir `.js`, compartilha a validação sintática, endurece duração/replay e acrescenta testes de provedor e navegador. O prompt passa a exigir causalidade e contatos explícitos, sem prometer melhoria artística ainda não observada.

## Continuidade

Primeiro comprovar o player e o arquivo exportado com fixture identificada. Depois verificar **uma geração real autenticada** do modo Código 3D e revisar os quadros do começo, içamento, giro, contato e final. A prova exige resultado da API, execução e exportação; testes simulados não a substituem.

Somente depois dessa prova, promover a versão validada ao site e ampliar duração, montagem, narração/legendas e avaliação visual do conteúdo gerado. Os recursos experimentais dos rascunhos devem ser comparados e integrados por capacidade, preservando a continuidade mecânica e os contratos existentes.

## Validação

Na revisão local: 240 testes passaram; TypeScript e build passaram. A prova de navegador e o render serão registrados no workflow e no PR correspondente. Não houve geração real de Gemini nesta revisão nem publicação no site.
