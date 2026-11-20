/** Owns every pending exported frame, including timeouts, cancellation and disposal. */
export class FrameRequests {
  private seq = 0;
  private pending = new Map<number, {
    resolve: (bitmap: ImageBitmap) => void;
    reject: (error: Error) => void;
  }>();

  constructor(private send: (message: { type: 'frame'; t: number; seq: number }) => void,
    private timeoutMs = 10_000) {}

  request(t: number, signal: AbortSignal): Promise<ImageBitmap> {
    if (signal.aborted) return Promise.reject(new Error('Exportação cancelada.'));
    return new Promise((resolve, reject) => {
      const seq = ++this.seq;
      const finish = () => {
        clearTimeout(timer);
        signal.removeEventListener('abort', abort);
        this.pending.delete(seq);
      };
      const fail = (error: Error) => { finish(); reject(error); };
      const abort = () => fail(new Error('Exportação cancelada.'));
      const timer = setTimeout(() => fail(new Error('A cena parou de responder durante a exportação.')), this.timeoutMs);
      this.pending.set(seq, { resolve: (b) => { finish(); resolve(b); }, reject: fail });
      signal.addEventListener('abort', abort, { once: true });
      try { this.send({ type: 'frame', t, seq }); } catch { fail(new Error('Não foi possível solicitar o quadro.')); }
    });
  }

  receive(seq: number, bitmap: ImageBitmap): void {
    const request = this.pending.get(seq);
    if (request) request.resolve(bitmap);
    else bitmap.close();
  }

  cancel(reason: string): void {
    for (const request of this.pending.values()) request.reject(new Error(reason));
  }
}
