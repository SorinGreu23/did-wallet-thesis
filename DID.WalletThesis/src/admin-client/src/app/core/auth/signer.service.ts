import { Injectable, signal } from '@angular/core';
import { ethers } from 'ethers';

@Injectable({ providedIn: 'root' })
export class SignerService {
  private wallet: ethers.Wallet | null = null;
  readonly hasSigner = signal(false);
  readonly address = signal<string | null>(null);

  /** Initialize asynchronously to avoid blocking the main thread */
  async initialize(privateKey: string): Promise<string> {
    // Yield to the browser before the heavy EC operation
    await new Promise(resolve => setTimeout(resolve, 0));
    this.wallet = new ethers.Wallet(privateKey);
    const addr = this.wallet.address;
    this.address.set(addr);
    this.hasSigner.set(true);
    return addr;
  }

  async signMessage(message: string): Promise<string> {
    if (!this.wallet) throw new Error('Signer not initialized');
    // Yield before signing so UI can update
    await new Promise(resolve => setTimeout(resolve, 0));
    return this.wallet.signMessage(message);
  }

  /** Returns the wallet connected to the given provider for sending transactions. */
  getConnectedWallet(provider: ethers.JsonRpcProvider): ethers.Wallet {
    if (!this.wallet) throw new Error('Signer not initialized');
    return this.wallet.connect(provider);
  }

  clear(): void {
    this.wallet = null;
    this.hasSigner.set(false);
    this.address.set(null);
  }
}
