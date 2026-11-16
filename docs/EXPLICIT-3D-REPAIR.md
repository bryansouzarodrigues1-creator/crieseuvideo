# CrieSeuVideo — reparo explícito de programa 3D (16/11/2026)

## Problema resolvido
No laboratório havia "Corrigir com Gemini" após uma proposta rejeitada, mas **o editor principal não oferecia a correção** nem a rota `/api/ai/explainer-plan` repassava ao navegador o `candidate` limitado criado pelo diretor. Isso forçava o usuário a gerar do zero e perdia o diagnóstico que o motor já conhecia.

## Implementado
1. A rota de direção real devolve o campo `candidate` **somente** quando `DirectorError` o tem. O payload possui `sourceSignature` e JSON de cena limitado a 90 KB; não é renderizável sem passar pelo normalizador.
2. O editor distingue falha de infraestrutura (HTTP 503, quota etc.) de programação inválida (`invalid_scene_program`, `source_mismatch`) e da falha de validação WebGL/IK local.
3. Em caso de proposta inválida, o editor preserva a cena anterior e oferece **Corrigir com Gemini**. Nenhuma chamada é feita automaticamente.
4. O segundo clique envia o roteiro original com `repairIssue` e `previousProposal` rejeitada, ou `previousProgram` normalizado, quando disponível. O diretor confere que o programa foi criado para **o mesmo texto** antes de chamar a API.
5. Editar o roteiro, trocar para 2D/outro modo, gerar sem IA ou obter sucesso invalida a proposta anterior.
6. O motor continua rejeitando código JS, URLs, shaders não autorizados, contatos impossíveis, cenas sem geometria válida e movimentos falsos.
7. O Gemini Direct é o provedor do modo livre, com fallback para gateway Lovable desabilitado.

## QA real (simulado, sem gasto)
- [GitHub Actions aprovado](https://github.com/bryansouzarodrigues1-creator/crieseuvideo/actions/runs/43945351020): **314 testes em 45 arquivos**, TypeScript, build do site e laboratório, WebGL real no Chromium.
- [Capturas e relatório](https://github.com/bryansouzarodrigues1-creator/crieseuvideo/actions/runs/43945351020/artifacts/14263299730).
- O teste abriu o editor real, selecionou 3D livre, gerou cena procedural com resposta **simulada**, comprovou três quadros e 4 movimentos verificados, e preservou a imagem pixel a pixel após um 503 simulado.
- Depois simulou **502 invalid_scene_program** contendo um `candidate` rejeitado com campo JS não permitido. O botão "Corrigir com Gemini" apareceu **sem chamada automática**; após clicar, enviou `previousProposal` + `repairIssue`. A resposta simulada corrigida foi validada e aceita. Total de 4 chamadas **interceptadas pelo teste**, nenhuma enviada a serviços de IA reais.

## Limites / riscos a tratar
- Não temos ainda uma geração nova e inédita feita pelo **Gemini real** nessa branch.
- Uma descrição de movimento pode estar semanticamente errada embora `motionChecks` passe; qualidade exige análise visual e criticagem externa.
- Correção é uma nova chamada de API e **pode consumir cota/crédito**, mesmo usando a assinatura Google AI Pro; não está ativada em produção.
- Como o código já suporta retornar até 90 KB de proposta inválida, confirmar limites de HTTP, rate limiting, política de retenção e dados do usuário antes de publicar.
- O app ainda não exibe relatório de custo real de tokens nem prova Android físico. Habilitar orçamento e limites por usuário antes da abertura pública.
- A cadeia de PRs #17–#26 permanece isolada; não publicar/mesclar automaticamente.
- Trabalho 2D do Claude preservado.
