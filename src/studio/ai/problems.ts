import type { Problem } from "./types";

export const problemFromStatus = (status: number): Problem => {
  if (status === 400 || status === 422) return "invalid_request";
  if (status === 401) return "unauthorized";
  if (status === 402) return "billing_required";
  if (status === 403) return "forbidden";
  if (status === 404) return "model_unavailable";
  if (status === 408) return "timeout";
  if (status === 413) return "invalid_request";
  if (status === 429) return "quota";
  return status >= 500 ? "service_unavailable" : "invalid_response";
};

/** Worth trying the SAME provider again after a pause (overload, hiccup). 503 "high demand" is the commonest real-world case. */
export const isTransient = (p: Problem) =>
  p === "service_unavailable" || p === "timeout" || p === "network" || p === "empty_response";
/** Moving on to the next provider is useful; retrying here is not. */
export const cooldownMs = (p: Problem, retryAfterMs?: number): number => {
  if (p === "quota") return Math.min(Math.max(retryAfterMs ?? 60_000, 5_000), 15 * 60_000);
  if (
    p === "unauthorized" ||
    p === "billing_required" ||
    p === "forbidden" ||
    p === "model_unavailable"
  )
    return 10 * 60_000;
  return 0;
};

export const parseRetryAfter = (value: string | null | undefined): number | undefined => {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds) * 1000;
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
};

/** Safe, secret-free explanation for the interface. */
export const PROBLEM_PT: Record<Problem, string> = {
  not_configured: "chave não configurada no servidor",
  unauthorized: "chave rejeitada (401)",
  forbidden: "acesso ao modelo não autorizado (403)",
  quota: "cota ou limite de chamadas atingido (429)",
  billing_required: "créditos ou faturamento indisponíveis (402)",
  model_unavailable: "modelo indisponível (404)",
  invalid_request: "o provedor recusou a configuração da chamada (400/422)",
  service_unavailable: "serviço sobrecarregado ou indisponível (5xx)",
  timeout: "tempo de resposta esgotado",
  network: "falha de comunicação com o provedor",
  empty_response: "a IA respondeu sem conteúdo",
  truncated_response: "a resposta foi cortada antes de terminar (limite de saída)",
  refused: "a IA recusou ou bloqueou a resposta",
  invalid_response: "resposta fora do formato do provedor",
  local_limit: "limite diário local atingido",
  paid_blocked: "provedor pago bloqueado (sem autorização de gasto)",
  unverified_blocked: "provedor gratuito não verificado bloqueado (modo só-gratuito confirmado)",
  budget_exhausted: "orçamento de chamadas deste vídeo esgotado",
  cooling_down: "provedor em pausa depois de erro recente",
};
