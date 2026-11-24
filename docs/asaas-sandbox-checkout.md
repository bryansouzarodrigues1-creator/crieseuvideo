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


## Continuação após cadastrar ASAAS_API_KEY no Lovable Cloud (23/11/2026)

O responsável pelo projeto informou que cadastrou a chave no campo `ASAAS_API_KEY`. **Isso é uma confirmação de configuração manual, não validação da chave**: o PR #107 ainda não está em produção nem possui um backend de teste publicado com essas alterações.

Foi incluída a função `probeAsaasSandboxCredential()` em `src/studio/payments/asaas.server.ts`: chamada interna e **somente leitura** a `GET https://api-sandbox.asaas.com/v3/myAccount/status/`. Ela não gera cobranças, não retorna dados da conta, não expõe segredo, não possui rota pública e nunca muda o ambiente para produção. Testes automatizados verificam isso. A execução real dependerá de disponibilizar o código em ambiente com os Secrets.

**Configuração restante, SEM nova mensagem para a IA do Lovable**:
1. Definir `ASAAS_ENV=sandbox` como Secret/configuração do servidor.
2. Cadastrar **uma chave Pix na conta de destino do Asaas Sandbox** e registrar o seu identificador em `ASAAS_PIX_ADDRESS_KEY`.
3. Criar um token exclusivo de webhook com 32–255 caracteres sem espaços e registrar o mesmo valor em `ASAAS_WEBHOOK_TOKEN` (não reutilizar a API Key).
4. Criar o webhook na conta **Sandbox** de destino, vinculado à URL de HTTPS do backend de teste e aos eventos de cobrança; conferir o token e logs na página de Integrações do Asaas.
5. Habilitar `ASAAS_CHECKOUT_ENABLED=true` apenas na implantação de homologação sandbox, nunca em produção.

**Procedimento oficial de simulação**: requer DUAS contas de Sandbox, a recebedora (com chave Pix e QR estático) e outra pagadora com saldo. O QR gerado na recebedora fornece um `payload`; a outra conta executa `POST /v3/pix/qrCodes/pay`. Validar a cobrança gerada, `pixQrCodeId`, webhook e liberação de 3 créditos uma única vez. Sem necessidade de dinheiro real.

**Referências**:
- https://docs.asaas.com/docs/testar-pagamento-de-qrcodes-pix
- https://docs.asaas.com/reference/criar-qrcode-estatico
- https://docs.asaas.com/docs/criar-novo-webhook-pela-aplicacao-web
- https://docs.asaas.com/reference/consultar-situacao-cadastral-da-conta

**Bloqueador atual**: Somente a chave API foi informada como cadastrada. Ainda não há confirmação da chave Pix, do token de webhook nem de um ambiente com PR #107 implantado. O sistema de consumo de créditos na geração/exportação 2D e os fluxos de estorno também seguem pendentes. Não liberar compras reais.


## Atualização: homologação com a única API Key já cadastrada

Esta revisão não altera o site publicado nem os Secrets. A API Key existente é suficiente para uma **sondagem de conectividade** no endpoint interno `checkAsaasSandboxConnection`: o browser chama `/teste-pix` com sessão Supabase válida e o servidor faz apenas `GET /v3/myAccount/status/` no Asaas Sandbox (sem cobrança). O teste de credencial funciona mesmo se `ASAAS_ENV` ainda não estiver definido, mas falha se a variável indicar um ambiente não Sandbox.

**Para criar um QR estático com menos configurações:** o backend tenta usar `ASAAS_PIX_ADDRESS_KEY` se configurada. Se não existir, consulta `GET /v3/pix/addressKeys?status=ACTIVE&limit=100` e só escolhe automaticamente **quando houver exatamente uma chave Pix ativa**. Em caso de zero ou várias chaves, não faz escolha nem cria chave bancária automaticamente; o operador deve selecionar uma chave Pix no backend ou cadastrar uma no Asaas Sandbox. A criação de QR estático é `POST /v3/pix/qrCodes/static` com valor R$ 1,00, `allowsMultiplePayments=false` e `expirationSeconds=900`.

**Sem webhook no primeiro teste:** a rota protegida `verifyMyPixSandboxPayment` consulta os pagamentos reais do QR diretamente na API Sandbox via `GET /v3/payments?pixQrCodeId=...`, reconsulta o pagamento por ID, confere `RECEIVED`, `PIX`, valor e QR exatos e usa a RPC privilegiada de forma atômica e idempotente para liberar 3 créditos. Nenhum status fornecido pelo navegador é confiável. Esse polling manual serve **somente na homologação**; configure o `ASAAS_WEBHOOK_TOKEN` e Webhooks para o fluxo definitivo.

### Configurações de ativação Sandbox

- `ASAAS_API_KEY`: já informada como salva manualmente pelo usuário, ainda não testada por conexão autenticada.
- `ASAAS_ENV=sandbox`: exigida no backend para criação/consulta de pagamentos de teste.
- `ASAAS_CHECKOUT_ENABLED=true`: chave de habilitação intencional **somente para implantação isolada de homologação**. Nunca habilitar no site público antes do teste ponta a ponta.
- `ASAAS_PIX_ADDRESS_KEY`: opcional se existir exatamente **uma** chave Pix ativa no Asaas Sandbox; recomendável configurar de forma explícita quando houver várias.
- `ASAAS_WEBHOOK_TOKEN`: não é necessário para testar a **conciliação manual** no Sandbox, mas é obrigatório antes de cadastrar e usar o webhook no Asaas.

A tela `/teste-pix` mostra a checagem de conectividade para usuários logados mesmo com checkout desativado; permanece bloqueado o botão de criar Pix enquanto `VITE_ASAAS_SANDBOX_DEMO` não estiver configurado. Esta variável pública controla **apenas a apresentação da tela**, não autoriza operações financeiras, que dependem exclusivamente do backend.

### Limites importantes

- Ainda não há teste de Pix end-to-end no Asaas com a chave configurada. CI simula a API com mocks e não faz chamadas reais.
- A liberação de créditos **não significa** que a geração de vídeos já está descontando saldo. Não vender em produção até integrar consumo atômico de créditos e processos de estorno.
- Ao criar uma cobrança dinâmica em vez do QR estático, o Asaas exige criar um cliente com CPF/CNPJ; não é possível assumir que o CPF da conta Asaas é o CPF do comprador. Portanto, esta revisão mantém o QR **estático**.
- Para simular pagamento de QR entre contas Sandbox, a documentação Asaas pede uma segunda conta Sandbox com saldo, autenticação própria e chave Pix cadastrada na conta recebedora. Não enviar credenciais no chat.

Fontes oficiais:
- https://docs.asaas.com/reference/listar-chaves
- https://docs.asaas.com/reference/criar-qrcode-estatico
- https://docs.asaas.com/reference/criar-novo-cliente
- https://docs.asaas.com/docs/receba-eventos-do-asaas-no-seu-endpoint-de-webhook
- https://docs.asaas.com/docs/testar-pagamento-de-qrcodes-pix
