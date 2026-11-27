/**
 * Advisory checks: problems the model should fix if it can (framing, facing, occlusion), but that must never make a whole
 * generation fail. The first answer that has problems is sent back ONCE with the measured reasons (the repair round of
 * askStructured); if the repaired answer still has them, it is accepted and the problems are kept as warnings.
 * Hard errors (strict parser, compiler, engine limits) are not advisory: they always reject.
 */
export function advisory<P>(
  check: ((program: P) => string[]) | undefined,
  sink?: (problems: string[]) => void,
): (program: P) => string[] {
  let asked = false;
  return (program) => {
    const problems = check?.(program) ?? [];
    if (!problems.length) return [];
    if (!asked) {
      asked = true;
      return problems;
    }
    sink?.(problems);
    return [];
  };
}
