# Histórico do plano de teste — substituído pelo pacote pago

O plano anterior de "um vídeo grátis" deixou de ser o produto escolhido.
**O lançamento agora proposto é R$ 1 por TRÊS vídeos 2D básicos de até 15 segundos**, depois de pagamento confirmado.

Consulte os documentos atualizados:
- docs/pix-asaas-vs-manual-checkout.md — comparar Asaas QR estático/dinâmico e Pix manual com comprovante, admin e notificações.
- src/studio/pricing/catalog.ts — categorias de preços por esforço de IA e parâmetros.
- src/studio/freeTrial/trialPolicy.ts — política de elegibilidade baseada em crédito PAGO confirmado no servidor.
- src/studio/payments/receiptReviewPolicy.ts — fluxo financeiro puro de confirmação e liberação condicional.
- src/studio/motionLibrary/registry.ts — componentes 2D reutilizáveis por JSON/tempo, sem código arbitrário.
- skills/crieseuvideo-motion-library/SKILL.md — prompt/skill experimental com critérios de qualidade.

**NADA está em produção.** Ainda não existe checkout Asaas conectado, storage privado de comprovantes, entrega de alertas, banco transacional de créditos ou serviço de geração com custo demonstradamente sustentável. O registro de conta Google, challenge antibot e limites de IP/dispositivo são auxiliares, não substituem confirmação financeira.

Critérios de proteção mantidos: sessão Google verificada no servidor, cota única e ledger idempotente, limite por usuário e orçamento global, não confiar em prints ou botões "Paguei", tokens Asaas separados, RLS de Supabase, cuidados LGPD, aprovação de custo e qualidade dos MP4s antes de vender.
