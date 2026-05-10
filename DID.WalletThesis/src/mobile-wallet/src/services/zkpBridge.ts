type PendingRequest = { resolve: (val: any) => void; reject: (err: Error) => void };

class ZkpBridge {
  private pending = new Map<string, PendingRequest>();
  private injectFn: ((js: string) => void) | null = null;
  private counter = 0;
  private ready = false;
  private queue: Array<() => void> = [];

  register(injectFn: (js: string) => void) {
    this.injectFn = injectFn;
    this.ready = true;
    this.queue.forEach(fn => fn());
    this.queue = [];
  }

  unregister() {
    this.injectFn = null;
    this.ready = false;
  }

  handleMessage(data: string) {
    try {
      const msg = JSON.parse(data);
      const req = this.pending.get(msg.id);
      if (!req) return;
      this.pending.delete(msg.id);
      if (msg.type === 'error') {
        req.reject(new Error(msg.error ?? 'ZKP bridge error'));
      } else {
        req.resolve(msg);
      }
    } catch (e) {
      console.error('[ZkpBridge] failed to parse message', e);
    }
  }

  private send(payload: object): Promise<any> {
    return new Promise((resolve, reject) => {
      const dispatch = () => {
        if (!this.injectFn) {
          reject(new Error('ZKP bridge not registered'));
          return;
        }
        const id = String(++this.counter);
        this.pending.set(id, { resolve, reject });
        const js = `window.__zkpReceive(${JSON.stringify({ ...payload, id })});true;`;
        this.injectFn(js);
      };

      if (this.ready) {
        dispatch();
      } else {
        this.queue.push(dispatch);
      }
    });
  }

  async prove(
    input: Record<string, any>,
    wasmB64: string,
    zkeyB64: string,
  ): Promise<{ proof: any; publicSignals: string[] }> {
    const result = await this.send({ type: 'prove', input, wasm: wasmB64, zkey: zkeyB64 });
    return { proof: result.proof, publicSignals: result.publicSignals };
  }

  async verify(
    proof: any,
    publicSignals: string[],
    vkey: any,
  ): Promise<boolean> {
    const result = await this.send({ type: 'verify', proof, publicSignals, vkey });
    return result.valid as boolean;
  }
}

export default new ZkpBridge();
