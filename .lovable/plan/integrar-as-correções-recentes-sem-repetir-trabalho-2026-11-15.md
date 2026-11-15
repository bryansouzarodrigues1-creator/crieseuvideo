# Integrar as correções recentes sem repetir trabalho

## O que foi confirmado
- O aplicativo e a `main` pública de `crieseuvideo` estão no mesmo commit: `a2a163e`, de 15/11/2026, 01:43 UTC. As duas últimas alterações são de pacotes, não de animação.
- Existem **dez PRs abertos (#2–#11)**. A atualização do horário 01:53 no repositório não significa que suas mudanças entraram na `main`.
- A cadeia **#6 → #7 → #8 → #9 → #10 → #11** reúne correções de voz, roteiro, exportação, Gemini e novas ações. O #6 já consolida #2–#5: aplicar todos separadamente duplicaria trabalho.
- `animate-stick` é a versão antiga, atualizada pela última vez em 10/11; não deve substituir este estúdio.
- As 19 verificações executadas nesta revisão passaram. Não houve geração com IA, voz ou vídeo pago.

## Entrega
### 1. Atualizar o estúdio com a versão consolidada
- Integrar os arquivos necessários da última proposta, sem substituir configurações, arquivos gerados ou alterações recentes de pacotes do Lovable.
- Recuperar voz já salva em cache; impedir download narrado quando faltarem falas e respeitar “Sem narração”.
- Preservar roteiro e prévia quando a direção falhar, inclusive quando a resposta for uma página de erro em vez de JSON. Não repetir pedidos automaticamente.
- Manter todas as palavras e sua ordem; rejeitar direções que troquem personagens, inventem acontecimentos ou peçam ações sem suporte.
- Preservar o formato verdadeiro do arquivo baixado e detectar interrupções ou perda excessiva de quadros na exportação.

### 2. Usar as novas ações no caminho normal de criação
- Incorporar as ações preparadas de caminhar, correr, ler celular, trabalhar no computador, reagir, esperar e demonstrar passagem do tempo, gráficos e circulação de dinheiro.
- Incorporar a interação preparada de pegar/entregar objetos e sua sequência específica de lanterna, com contatos entre mãos e objeto.
- Usar as cenas pelo roteiro comum, não apenas por uma demonstração especial.
- Incorporar duração automática, opções 15/30/60/90 segundos e valor personalizado de 5–600 segundos, sem novas chamadas de IA ao alterar o tempo. Não cortar fala para cumprir uma duração impossível.
- Preservar Motion 2D, galeria, editor legado e apresentação por quadro para assuntos que ainda não tenham ação executável.

### 3. Preparar Gemini com controle de custo
- Revisar o adaptador de texto do servidor e separar claramente direção de cenas de voz e vídeo.
- Não ativar Gemini, fallback pago ou chamadas reais durante a integração.
- Verificar a disponibilidade dos modelos antes de ativação; a lista escrita no PR não comprova disponibilidade atual ou gratuidade.
- Solicitar uma nova credencial por entrada protegida quando chegar à ativação; não reutilizar a chave exposta no chat.
- Confirmar cota e ausência de faturamento pago no projeto Google. O código sozinho não garante que uma chave seja gratuita.
- Revisar acesso e limites dos pedidos antes de disponibilizar o provedor ao público. Voz continuará separada e poderá consumir créditos quando solicitada.

### 4. Verificar antes de dizer que terminou
- Executar os testes consolidados com pedidos simulados e acrescentar regressões para qualquer adaptação.
- Conferir o caminho normal na tela de celular e computador com roteiros novos, sem IA/TTS reais.
- Conferir 2D/3D, roteiro integral, durações, troca de cenas, retorno no tempo e manutenção da prévia após falhas.
- Gerar um arquivo local de teste com áudio sintético, conferir duração, formato, trilha sonora e quadros. Isso verifica exportação, não qualidade da voz real.
- Inspecionar visualmente momentos de ação e legendas nos formatos 9:16 e 16:9. Testes aprovados não equivalem a aprovação cinematográfica.
- Atualizar a prévia e salvar as alterações; não publicar automaticamente.

## Limite honesto
A proposta mais recente ainda possui **dez receitas de encenação**, além das interações específicas de objetos. Seu próprio diagnóstico reconhece que a IA não consegue criar coreografia arbitrária com esse contrato. Integrá-la melhora os caminhos existentes, mas **não termina um animador universal nem garante o nível dos vídeos de referência**.

O próximo trabalho estrutural será permitir compor ações, personagens, objetos, contatos e tomadas numa linha do tempo validada, usando um catálogo reutilizável de capacidades. Não incluir essa expansão nem o kit Zac Dark nesta integração: ambos exigem avaliação própria, não mais receitas avulsas para esconder a limitação.

## Detalhes técnicos
- Usar o snapshot revisado do PR #11 (`082505a5`) como fonte consolidada, preservando a estrutura TanStack Start e limites de servidor do projeto.
- Adaptar assertions TypeScript não permitidas, isolamento dos segredos, tratamento de status e acesso aos endpoints durante a integração.
- Não importar `.github`, laboratório privado, configuração de hospedagem externa, relatórios derivados de gravações privadas, dependências ou metadados de repositório.
- Documentar decisões estruturais em `AGENTS.md`; guardar apenas código necessário e testes relevantes.
- Bloqueios de aceite final: autorização expressa para teste real de IA/voz e verificação do arquivo no Android do usuário. Até lá, declarar esses itens não verificados.