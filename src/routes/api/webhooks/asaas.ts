import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/webhooks/asaas')({
 server: {
  handlers: {
   POST: async ({ request }) => {
    const { handleAsaasWebhook } = await import('@/studio/payments/asaasWebhook.server');
    return handleAsaasWebhook(request);
   },
  },
 },
});
