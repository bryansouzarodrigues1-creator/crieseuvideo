/**
 * One budget per VIDEO, shared by every AI call that video makes (planning, repair rounds, visual review, visual repair).
 * A per-ask cap is not enough: each repair or review is a new ask and used to restart the count.
 */
export interface BudgetLimit {
  /** Hard cap of HTTP calls for the whole video, retries included. */
  maxCalls: number;
  /** Optional cap on the estimated cost (only providers with a known price contribute). */
  maxCostUsd?: number;
}
export interface Budget {
  readonly limit: BudgetLimit;
  /** Reserves one HTTP call. False means the video is out of budget and nothing must be sent. */
  take(): boolean;
  /** Books the cost of a finished call. */
  charge(costUsd?: number): void;
  used(): { calls: number; costUsd: number };
  remaining(): number;
}
export function createBudget(limit: BudgetLimit): Budget {
  let calls = 0,
    cost = 0;
  const open = () =>
    calls < limit.maxCalls && (limit.maxCostUsd === undefined || cost < limit.maxCostUsd);
  return {
    limit,
    take() {
      if (!open()) return false;
      calls++;
      return true;
    },
    charge(costUsd) {
      if (costUsd) cost += costUsd;
    },
    used: () => ({ calls, costUsd: +cost.toFixed(6) }),
    remaining: () => Math.max(0, limit.maxCalls - calls),
  };
}
