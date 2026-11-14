/**
 * A canvas recorder encodes frames in real time. Timeline timestamps can be
 * deterministic while the browser still skips frames under load or background
 * tab throttling. These checks prevent reporting visibly truncated recordings
 * as successful exports; they do not replace decoding the final MP4/WebM.
 */
export interface CaptureHealth {
  /** Total distinct frames expected from t=0 through the final timeline frame. */
  expectedFrames: number;
  /** Distinct frames actually submitted to the capture track. */
  submittedFrames: number;
  /** Frames passed over when the capture timer jumped forward. */
  skippedFrames: number;
  /** Maximum number of consecutive timeline frames skipped in a single jump. */
  longestGap: number;
  /** Whether the document became hidden at any point during recording. */
  hiddenDuringExport: boolean;
}

/** Returns a user-facing warning when frame integrity is inadequate. */
export function captureHealthError(stats: CaptureHealth, fps = 30): string | null {
  if (!Number.isFinite(stats.expectedFrames) || stats.expectedFrames < 2 || !Number.isFinite(fps) || fps <= 0) {
    return 'A duração de exportação é inválida.';
  }
  if (stats.hiddenDuringExport) {
    return 'A aba ficou em segundo plano durante a gravação. Mantenha o CrieSeuVideo aberto e a tela ativa para exportar novamente.';
  }
  // A very short scheduling hiccup is tolerated. Larger gaps indicate a
  // browser stall, often when a phone is under heavy GPU/CPU load.
  if (stats.longestGap > Math.ceil(fps * 0.5) ||
      stats.skippedFrames > Math.max(3, Math.floor(stats.expectedFrames * 0.15)) ||
      stats.submittedFrames < 2) {
    return 'O navegador perdeu quadros durante a gravação. Tente novamente com a aba visível ou use uma resolução menor.';
  }
  return null;
}
