# CrieSeuVideo — 1 vídeo grátis, sem falir a plataforma
**Rascunho técnico de lançamento (23/11/2026).** Este documento NÃO aplica SQL, NÃO publica o site e NÃO habilita geração paga. Ativar somente com banco, OAuth e auditoria funcionando.

## Produto
- Usuário entra via **Google OAuth (Supabase Auth)** e pode obter **1 vídeo experimental MP4 de até 20 segundos**, em 9:16 ou 16:9, com limite de resolução e marca d'água opcionais transparentes.
- Enquanto a qualidade não for aprovada, exibir claramente "modo experimental". Não prometer vídeo profissional.
- O vídeo é um **crédito por identidade Google**, não "1 por login" nem "1 por sessão".
- Não é um plano ilimitado: se a fila/cota global estourar, informar disponibilidade futura sem cobrar silenciosamente.
- Usuários pagos dependem de entitlement validado no servidor, separado da conta gratuita.

## Cadastro Google
1. Criar/selecionar OAuth client no Google Cloud Console e autorizar a URL **de callback do Supabase**.
2. Em Supabase Auth → Providers → Google, configurar client ID/secret sem inseri-los no git. Definir Site URL + URLs de redirecionamento do próprio CrieSeuVideo.
3. A rota experimental /teste-gratis chama `supabase.auth.signInWithOAuth({provider:'google'})`.
4. Backend exige JWT validado pelo middleware existente e **identidade Google realmente vinculada** via `auth.identities` ou `app_metadata.providers` firmado pelo Supabase, nunca por `user_metadata` editável.
5. Google OAuth não certifica uma pessoa única: usuários podem ter múltiplas contas.

## Cota transacional no Supabase (ainda não implementada/aplicada)
Banco de dados com tabela `public.studio_trial_claims` acessível **somente ao serviço** para escrita.
Campos sugeridos: `user_id uuid PRIMARY KEY REFERENCES auth.users(id)`,
`claim_id uuid UNIQUE`, `state` CHECK (`reserved`, `dispatched`, `completed`, `unknown`),
`video_id`, `estimated_cost_cents`, `actual_cost_cents`, `duration_seconds`,
`created_at`, `dispatched_at`, `completed_at`, `device_hash` e `network_hash`.

1. Verificar sessão, Google, CAPTCHA no servidor, duração, plano/entitlement e orçamento global antes de chamar qualquer API.
2. Criar `INSERT` atômico com `user_id UNIQUE`, `ON CONFLICT DO NOTHING RETURNING`: só um clique ganha, mesmo em múltiplas abas e múltiplos servidores. **Maps/setTimeout em memória não garantem essa propriedade.**
3. Marcar `dispatched` antes de chamar provedor. Se houver timeout ambíguo, `unknown`, manter cota bloqueada até reconciliação — não permitir cobrança duplicada.
4. Gravar vídeo concluído, validar MP4, marcar `completed` e liberar link do usuário; somente então anunciar a entrega.
5. Se falha ocorreu ANTES de enviar um job à IA (sem custo), remover a reserva idempotentemente; se foi DEPOIS, conciliá-la com provedor antes de eventual reembolso.
6. Ação administrativa para devolver crédito após erro confirmado; registrar auditoria de estornos.
7. Adotar uma fila com teto de gasto global diário e por solicitação; nunca usar fallback pago automático para o vídeo gratuito.
8. Habilitar RLS, `GRANT` só ao service role para escrita; permitir leitura apenas da própria situação por endpoint seguro. Função SECURITY DEFINER não deve ser pública.
9. Atualizar tipos gerados e criar migração pelo CLI/Drizzle apropriado; auditar no projeto Supabase REAL e testar corrida entre requisições simultâneas antes de integrar ao endpoint de produção `createProduction` e ao futuro Code2D.

## Antifraude sem abusar da privacidade
**A única restrição firme é a cota transacional por usuário.** Camadas adicionais:
- **Dispositivo:** cookie próprio pseudônimo aleatório (ID UUID), assinada pelo servidor. Não é ID físico, não é infalível; apagar cookies / usar outro navegador reseta. Evitar fingerprint invisível/canvas/audio, MAC, IMEI e dados biométricos.
- **IP:** derivar SOMENTE no servidor de cabeçalho de edge confiável, nunca um IP declarado em JSON pelo cliente. Armazenar HMAC com sal secreto rotativo e retenção curta para identificar criação anômala de contas. Não gravar IP bruto no banco de benefícios.
- Famílias, hotéis, escolas, bibliotecas e operadoras usam IP compartilhado: **não bloquear automaticamente** um segundo usuário só por IP igual.
- **Turnstile** no cadastro e no pedido gratuito; validar token no servidor via Siteverify, com verificação de domínio/ação.
- Limitar inscrições, criação de novas contas por rede, solicitações por conta e taxa global. Risco alto passa por desafio ou análise; não punir indiscriminadamente.
- Aviso de privacidade claro, finalidade específica, retenção de sinais por até 30 dias, controle de acesso e exclusão conforme LGPD. HASH com segredo continua dado pseudonimizado quando pode ser associado.
- Nunca coletar segredos de conta Google, fotos, contatos ou localização exata do usuário.

## Economia e qualidade
- Um teste gratuito com 5 cenas de 8s custa mais em chamadas do que uma prévia de 15–20s com 2–3 cenas; escolher limite explícito.
- O custo de gerar código em API ≠ custo de renderização, TTS, storage, banda, suporte, monitoramento e reexecuções.
- Conferir no dashboard gasto total/dia, custo real por usuário, % de falhas, repetição de cenas, taxa de exportação MP4 e conversão para assinatura.
- Modelos gratuitos de terceiros são CAPACIDADE DE DESENVOLVIMENTO, não garantia de 1 vídeo grátis para cada novo usuário. Um backend único compartilha o mesmo teto de requisições entre todos os clientes.
- Controlar custos por operação: roteiro leve, direção em JSON, código por cena, sandbox/validador local, 1 reparo no máximo com teto; não reservar Claude/OpenAI caros para solicitações gratuitas.
- Como os dois vídeos de referência 2D são majoritariamente motion graphics, construir primeiro uma biblioteca reutilizável de cartões, tipografia, gráficos, efeitos, movimentos e transições. Para vídeo de fazenda 3D, usar motor/biblioteca 3D dedicado; não pedir que Canvas 2D recrie a modelagem 3D inteira.

## Condições de lançamento
- [ ] Google OAuth configurado e testado no ambiente real.
- [ ] Migração real aplicada, RLS auditada e teste de concorrência aprovado.
- [ ] Verificação Turnstile no servidor, proxy IP confiável e retenção de dados.
- [ ] Cota integrada a TODOS os endpoints que gastam créditos (produção, Code2D, Code3D, narração e vídeo generativo quando aplicável).
- [ ] Modo pago bypass apenas com entitlement confiável de servidor.
- [ ] MP4 verdadeiro feito por IA e aprovado visualmente; nada de fixture manual.
- [ ] Budget global, fila, painel de custo e botão administrativo de estorno.
