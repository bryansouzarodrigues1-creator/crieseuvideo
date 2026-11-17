/** The build writes these bundled public assets before compiling the Worker. */
declare module '*generated/assets.json' {
  const assets: Record<string, { type: string; body: string }>;
  export default assets;
}
