# Pix de R$ 1: Asaas ou comprovante manual (especificação experimental)

Estado: NENHUM CHECKOUT ATIVADO; não há Pix pessoal salvo no repositório. O PR #107 ainda é um rascunho.

## Decisão inicial
A oferta é R$ 1 por três vídeos 2D simples (até 15 segundos, usando biblioteca parametrizada). Não vender antes de aprovar o custo real e a qualidade de um MP4 produzido pela IA.

O Asaas aceita Pix por cobranças dinâmicas, por chave e por QR estático. A documentação não demonstra proibição geral de cobranças avulsas de R$ 1; o mínimo de R$ 10 citado refere-se às PARCELAS. Porém a taxa pública de QR dinâmico pode consumir quase todo ou todo R$ 1: atualmente preço-padrão promocional por recebimento de R$ 0,79 e R$ 1,59 depois, sujeito ao contrato específico. Pessoas físicas podem receber até 100 Pix/mês gratuitamente por chave ou QR estático (confirmar na conta). Para pessoa jurídica não presumir a gratuidade.

Antes de publicar, consultar Menu do usuário > Taxas no Asaas e criar cobrança avulsa de R$ 1 no SANDBOX, nunca cobrar um usuário real como teste de integração.

Referências oficiais:
- https://www.asaas.com/pix-asaas
- https://docs.asaas.com/docs/cobrancas-via-pix
- https://docs.asaas.com/reference/criar-qrcode-estatico
- https://docs.asaas.com/docs/receba-eventos-do-asaas-no-seu-endpoint-de-webhook

## Alternativa A: Asaas Pix estático (preferida se tarifa viável)
1. Um pedido por usuário, Pix de exatamente R$ 1. Se API e tarifa permitirem, criar QR estático individual, com value=1.00, allowsMultiplePayments=false e externalReference=orderId, associando pixQrCodeId à ordem (confirmar retorno real da API).
2. Webhook Asaas notifica o servidor no evento PAYMENT_RECEIVED ou PAYMENT_CONFIRMED. Exigir webhook authToken recebido em header asaas-access-token, diferente da chave da API, e conciliação com pedido, valor, status e conta.
3. Registrar event.id e pagamento/txid sob UNIQUE: webhooks podem ser entregues mais de uma vez. Nunca emitir créditos duas vezes.
4. Uma única transação atômica confirma ordem + emite três créditos + registra notificação; cliente acompanha status no site. Não precisa comprovante nem clicar Paguei.
5. Se as tarifas consumirem o valor, NÃO ativar checkout de R$ 1 por QR dinâmico.

## Alternativa B: Pix direto com foto e aprovação manual (temporária)
1. Usuário entra com Google, vê Pix configurado pelo administrador FORA do GitHub (segredo/configuração segura) e cria orderId com status waiting_payment.
2. Botão "Já paguei, enviar comprovante": upload privado de JPEG/PNG/PDF limitado, verificação de tamanho e tipo. Status proof_submitted; NÃO concede créditos.
3. Servidor salva pedido e notificação para ADMIN; envia alerta via canal integrado (email, Telegram bot ou Web Push após implementação). Não prometer entrega instantânea nem afirmar envio antes de ter serviço real.
4. Administrador autenticado revisa a imagem e, PRINCIPALMENTE, o extrato da instituição que recebe o Pix. Confere valor exato R$ 1, data, conta de destino, identificador EndToEndId/txid único e não utilizado. Não confiar só em print.
5. Admin aprova ou rejeita. Aprovação registra referência do banco UNIQUE e libera 3 créditos na mesma transação, marcando pagamento como paid; rejeição retorna o motivo ao usuário. Dedupe impede duas aprovações por um mesmo recibo.
6. O usuário recebe notificação durável no painel e, caso tenha dado permissão e serviço esteja configurado, push no dispositivo; email alternativo quando necessário. Realtime/polling mostra o status mesmo se push não chegar.
7. Comprovantes e sinais de risco exigem storage privado, RLS, controles de retenção e aviso de privacidade. Não expor extratos nem chave administrativa no browser.

## Banco e segurança — ainda não implementados no projeto real
- payment_orders: id, userId, amountCents=100, method, stage, providerPaymentId, pixQrId, proofPath, timestamps.
- payment_receipts: orderId, unique bank EndToEndId ou providerPaymentId, verifiedBy, source e timestamp. Não confiar em imagem sem extrato.
- credit_ledger: append-only, unique(orderId,purchase), delta=+3 na compra aprovada, delta=-1 por job com idempotência e possíveis estornos auditáveis.
- admin_notifications e user_notifications: pedidos a conferir e resultado; autorização servidor e leitura apenas por destinatário.
- Chave Pix e API key apenas em configuração segura; Google OAuth é identidade, mas não prova que a pessoa seja única; IP e dispositivo são sinais de risco, não banimentos automáticos.
- O módulo src/studio/payments/receiptReviewPolicy.ts valida decisões puras sem emitir crédito, sem receber dinheiro e sem notificar. Testes garantem que imagem e clique Paguei jamais sejam aceitos como confirmação financeira.

## Endpoints planejados, não existentes ainda
POST /orders/start — criar pedido e QR ou instruções Pix.
POST /orders/:id/proof — anexo privado e alerta administrativo.
POST /admin/orders/:id/review — decisão apenas de admin com extrato conciliado.
POST /webhooks/asaas — evento autenticado e idempotente.
GET /me/orders/:id — status e saldo de créditos do próprio usuário.

## Antes de lançar
Confirmar tarifa da conta Asaas, homologar Pix R$ 1 no sandbox, configurar secrets, implementar e testar banco real do CrieSeuVideo e concorrência; integrar upload seguro, notificações reais e fluxo admin; validar três MP4s de 15 segundos com custo líquido aceitável; só então publicar checkout.
