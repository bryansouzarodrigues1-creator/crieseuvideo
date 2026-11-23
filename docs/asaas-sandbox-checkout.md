# Checkout Asaas Sandbox — implementação isolada (PR #107)

**Status: somente sandbox, bloqueado por padrão, não publicar como cobrança real.**
Este módulo não acessa a API em produção mesmo que um operador erre ASAAS_ENV: a rota aceita apenas o valor exato 'sandbox'. Não inclua chaves no GitHub, no chat, em parâmetros VITE_* ou no navegador.

## O que já existe

- Na base do projeto **Crieseuvideo** do Lovable, e não no Supabase de outros aplicativos, foram criadas tabelas públicas com RLS: csv_payment_orders, csv_payment_events, csv_credit_ledger, csv_credit_wallets.
- Políticas SELECT apenas para a conta dona dos pedidos/créditos; nenhuma escrita por anon/authenticated. Apenas o serviço grava.
- RPC csv_apply_verified_payment(uuid,text,text), permitida apenas a service_role. Essa função aplica em uma transação o evento deduplicado, o estado paid, uma compra +3 no ledger e +3 no saldo.
- startIntroPixSandbox exige sessão do usuário com provedor Google e usa SKU intro-2d do catálogo do servidor: R$1,00 / 3 créditos.
- QR estático do Asaas: 900 segundos, 1 pagamento, referência do pedido; retorna apenas código Pix do sandbox.
- Webhook POST /api/webhooks/asaas: valida header asaas-access-token por comparação de hashes, confirma o pagamento com GET /v3/payments/:id do Asaas Sandbox e confronta provider_qr_id, valor exato em centavos, billingType=PIX e status RECEIVED antes de chamar RPC.
- Página /teste-pix (modo teste) fica oculta por padrão, mesmo dentro do PR.

## Segredos a configurar manualmente no backend do projeto correto

Somente em Secrets do Lovable/servidor, nunca nesta conversa:

- ASAAS_ENV=sandbox
- ASAAS_API_KEY = nova chave gerada **no Asaas Sandbox** (não reutilizar a de produção exposta)
- ASAAS_PIX_ADDRESS_KEY = chave Pix cadastrada no ambiente de sandbox
- ASAAS_WEBHOOK_TOKEN = token independente configurado no webhook do Asaas
- ASAAS_CHECKOUT_ENABLED=true **somente quando homologar em sandbox**
- VITE_ASAAS_SANDBOX_DEMO=true somente para disponibilizar visualmente a tela de teste (não é segredo)

O webhook configurado no Asaas Sandbox deve apontar para HTTPS://DOMINIO-DO-APP/api/webhooks/asaas.
Nunca configure este webhook para eventos de produção enquanto o módulo estiver em teste.

## Homologação obrigatória antes de ativar qualquer checkout real

1. Confirmar valores de tarifa reais para a conta CPF no painel Asaas > Taxas. O QR estático e sua conciliação devem ser aceitos; conferir se R$1 faz sentido líquido.
2. Criar 1 QR estático no sandbox, simular recebimento e confirmar que o pedido só muda a paid depois do evento Asaas autenticado e da consulta GET ao provedor.
3. Reenviar o mesmo evento, enviar evento com ID diferente para o mesmo pagamento, valor 0,99/1,01, outro QR, token inválido e eventos fora de ordem. O saldo deve ser +3 uma única vez.
4. Validar RLS: um usuário não pode ver pedidos/saldo de outro; usuário não pode inserir nem escrever créditos; anon não executa a RPC.
5. Confirmar que as chamadas à geração de vídeos **consomem créditos atomicamente**, não apenas exibem o saldo. Atualmente a ponte até o motor 2D NÃO FOI IMPLEMENTADA: não vender ou liberar produções como pagas.
6. Desenvolver fluxo de estorno/chargeback, alerta operacional, notificações e auditoria de pagamentos; sem isso continuar apenas no sandbox.
7. Medir 3 MP4s reais de até 15s para validar margem e qualidade, antes de permitir cobranças de verdade.

## Verificações atuais e limites

As tabelas, RLS e privilégios da RPC foram consultados no banco e confirmados. A integração com API do Asaas e o fluxo real de pagamento ainda NÃO foram validados sem chave sandbox. O PR segue em rascunho sem merge. Não foi realizada cobrança nem configurado webhook real.
