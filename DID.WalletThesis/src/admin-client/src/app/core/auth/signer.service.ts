import { Injectable, signal } from '@angular/core';
import { ethers } from 'ethers';

@Injectable({ providedIn: 'root' })
export class SignerService {
  private wallet: ethers.Wallet | null = null;
  readonly hasSigner = signal(false);
  readonly address = signal<string | null>(null);

  initialize(privateKey: string): string {
    this.wallet = new ethers.Wallet(privateKey);
    const addr = this.wallet.address;
    this.address.set(addr);
    this.hasSigner.set(true);
    return addr;
  }

  async signMessage(message: string): Promise<string> {
    if (!this.wallet) throw new Error('Signer not initialized');
    return this.wallet.signMessage(message);
  }

  clear(): void {
    this.wallet = null;
    this.hasSigner.set(false);
    this.address.set(null);
  }
}
