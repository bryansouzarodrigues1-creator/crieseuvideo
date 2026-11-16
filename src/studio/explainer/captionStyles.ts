// Estilos de legenda medidos em vídeos de referência de narrativa curta. Lógica pura (sem canvas) para ser testável;
// render.ts só desenha o que este módulo decide.
//  - line:            legenda atual do estúdio (até 2 linhas, palavra ativa em amarelo, base da tela).
//  - single_word:     uma palavra grande por vez, branca com contorno preto grosso, ~58% da altura; destaques em amarelo (estilo flat 2D do TikTok).
//  - subtitle_yellow: 2 a 3 palavras por vez, minúsculas, amarelas com contorno escuro fino, ~62% da altura (estilo ferraria 3D).

export const CAPTION_STYLES = {
  line: 'até 2 linhas na base da tela, palavra ativa em amarelo (padrão)',
  single_word: 'uma palavra grande por vez no meio da tela, destaques em amarelo',
  subtitle_yellow: 'duas ou três palavras por vez, minúsculas e amarelas, no meio da tela',
} as const;
export type CaptionStyle = keyof typeof CAPTION_STYLES;
export const CAPTION_STYLE_IDS = Object.keys(CAPTION_STYLES) as CaptionStyle[];
export const DEFAULT_CAPTION_STYLE: CaptionStyle = 'line';

export interface CaptionLook {
  perPage: number;
  upper: boolean;
  /** Centro vertical da legenda como fração da altura do quadro. */
  yFrac: number;
  /** Tamanho da fonte em unidades de design (u = min(w,h)/1080). */
  size: number;
  minSize: number;
  fill: string;
  /** Cor de palavras destacadas (scene.highlight). */
  emphasis: string;
  stroke: string;
  strokeWidth: number;
}

export const LOOKS: Record<Exclude<CaptionStyle, 'line'>, CaptionLook> = {
  single_word: { perPage: 1, upper: true, yFrac: 0.58, size: 112, minSize: 48, fill: '#FFFFFF', emphasis: '#FFD23F', stroke: '#111111', strokeWidth: 14 },
  subtitle_yellow: { perPage: 3, upper: false, yFrac: 0.62, size: 58, minSize: 30, fill: '#FFE066', emphasis: '#FFFFFF', stroke: '#1A1208', strokeWidth: 8 },
};

export const normalizeCaptionStyle = (v: unknown): CaptionStyle => (CAPTION_STYLE_IDS.includes(v as CaptionStyle) ? (v as CaptionStyle) : DEFAULT_CAPTION_STYLE);

/** Quebra N palavras em páginas de até `perPage`, preferindo terminar a página em pontuação (a frase respira onde o texto respira). */
export function pagesOf(words: string[], perPage: number): { from: number; to: number }[] {
  const per = Math.max(1, Math.floor(perPage));
  const pages: { from: number; to: number }[] = [];
  let from = 0;
  for (let i = 0; i < words.length; i++) {
    const end = i - from + 1 >= per || /[.,:;!?…]$/.test(words[i]!);
    if (end) { pages.push({ from, to: i }); from = i + 1; }
  }
  if (from < words.length) pages.push({ from, to: words.length - 1 });
  return pages;
}

/** Página que contém a palavra ativa (a última, se o índice passar do fim). */
export function pageAt(pages: { from: number; to: number }[], index: number) {
  return pages.find((p) => index >= p.from && index <= p.to) ?? pages[pages.length - 1] ?? null;
}
