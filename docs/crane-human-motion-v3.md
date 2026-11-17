# Caminhada mais humana — prova V3, grua (20 s)

Data: 17/11/2026. PR #42 (DRAFT), empilhado sobre #41 e #40. Sem merge nem publicação em `main`.

## O que mudou no motor

- Rig do `ProgramActor3D`: articulações arredondadas, sapatos com cantos suaves e respiração de malha determinística. Preserva as poses explícitas e contato IK.
- `proceduralWalk.ts`: rotação sutil dos ombros e compensação na cabeça, inclinação do tronco quando há objeto na mão, oscilação de peso, alternância de braços e estabilidade da mão que segura um objeto.
- `stage3d.ts`: detecta objetos ligados aos sockets `leftHand`/`rightHand` e evita oscilação grande da mão ocupada.
- **Correção importante:** os pés agora se orientam para a direção efetiva do deslocamento. Antes, o ator virava para o lado, mas a orientação padrão dos sapatos ainda usava o ângulo antigo, o que causava a impressão de deslizamento lateral.
- Rotação leve da ponta do pé apenas durante a fase de balanço, mantendo os pés apoiados quando não caminham.
- A caminhada continua habilitada apenas em terreno plano com trajetória válida e sem poses de pés, rotações de raiz ou contatos explícitos.

## Verificação reproduzível

- Workflow de navegador: https://github.com/bryansouzarodrigues1-creator/crieseuvideo/actions/runs/44095004778
- Status: **sucesso**.
- Chrome/software WebGL criou vídeo H264 vertical de 20 s, 720 x 1280, 30 FPS e 600 quadros.
- Último quadro exportado vs. prévia: erro médio 1,425/255.
- Uma resposta do modelo **simulada/interceptada**, 0 chamadas reais pagas, nenhum acesso Lovable ou ElevenLabs; `browserErrors: []`.
- Auditoria de movimento: 0 alertas; teste de alcance IK, foot heading e contatos verde.
- Revisão visual dos instantes 1,5 s; 2,7 s; 3,8 s: a orientação e o braço ocupado melhoraram, mas as passadas ainda parecem caricatas; composição e cenário continuam simples, sem aderência profissional ao vídeo de referência.

## Limites reais

Este teste é um **programa de cena escrito pelo agente como fixture de calibração**, não prova geração espontânea pelo Gemini. Nenhum modelo de movimento humano real ou física biomecânica está presente. Restam melhorias de aterrissagem dos pés, variação de ritmo, transições entre ações, gestos de esforço e interação causal com ferramentas e carga. Não confundir CI aprovado com qualidade audiovisual aprovada.

## Próximo controle

Manter o PR #42 como DRAFT. Rodar suíte completa de regressão sobre as outras fixtures de SceneProgram, especialmente escalada/contatos, antes de considerar merge em branch de integração. Não alterar `main` sem autorização do usuário.
