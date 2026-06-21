import { Injectable, signal } from '@angular/core';
import { ethers } from 'ethers';
import { Subject } from 'rxjs';

interface InjectedWalletProvider extends ethers.Eip1193Provider {
  on?(
    event: 'accountsChanged' | 'chainChanged' | 'disconnect',
    listener: (...args: unknown[]) => void,
  ): void;
}

export type WalletProviderEvent =
  | { type: 'accountsChanged'; accounts: string[] }
  | { type: 'chainChanged' }
  | { type: 'disconnect' };

@Injectable({ providedIn: 'root' })
export class SignerService {
  private signer: ethers.JsonRpcSigner | null = null;
  private readonly providerEvents = new Subject<WalletProviderEvent>();

  readonly hasSigner = signal(false);
  readonly address = signal<string | null>(null);
  readonly walletAvailable = signal(this.getInjectedProvider() !== null);
  readonly providerEvents$ = this.providerEvents.asObservable();

  constructor() {
    const provider = this.getInjectedProvider();
    provider?.on?.('accountsChanged', (...args) => {
      const accounts = Array.isArray(args[0]) ? (args[0] as string[]) : [];
      this.clear();
      this.providerEvents.next({ type: 'accountsChanged', accounts });
    });
    provider?.on?.('chainChanged', () => {
      this.clear();
      this.providerEvents.next({ type: 'chainChanged' });
    });
    provider?.on?.('disconnect', () => {
      this.clear();
      this.providerEvents.next({ type: 'disconnect' });
    });
  }

  async connect(requestAccess = true, expectedAddress?: string): Promise<string> {
    const injectedProvider = this.getInjectedProvider();
    if (!injectedProvider) {
      this.walletAvailable.set(false);
      throw new Error(
        'MetaMask was not detected in this browser tab. Enable the extension for localhost and reload the page.',
      );
    }
    this.walletAvailable.set(true);

    const method = requestAccess ? 'eth_requestAccounts' : 'eth_accounts';
    const accounts = (await injectedProvider.request({ method })) as string[];
    const account = accounts[0];
    if (!account) {
      throw new Error(requestAccess ? 'No MetaMask account selected' : 'MetaMask is not connected');
    }

    if (expectedAddress && account.toLowerCase() !== expectedAddress.toLowerCase()) {
      throw new Error('Select the MetaMask account used for this authenticated session');
    }

    const provider = new ethers.BrowserProvider(injectedProvider);
    this.signer = await provider.getSigner(account);
    const address = await this.signer.getAddress();
    this.address.set(address);
    this.hasSigner.set(true);
    return address;
  }

  async restore(expectedAddress: string): Promise<boolean> {
    try {
      await this.connect(false, expectedAddress);
      return true;
    } catch {
      this.clear();
      return false;
    }
  }

  async signMessage(message: string): Promise<string> {
    if (!this.signer) throw new Error('MetaMask is not connected');
    return this.signer.signMessage(message);
  }

  getTransactionSigner(): ethers.JsonRpcSigner {
    if (!this.signer) throw new Error('SIGNER_LOST');
    return this.signer;
  }

  clear(): void {
    this.signer = null;
    this.hasSigner.set(false);
    this.address.set(null);
  }

  private getInjectedProvider(): InjectedWalletProvider | null {
    if (typeof window === 'undefined') return null;

    const browser = window as typeof window & {
      ethereum?: InjectedWalletProvider;
    };
    return browser.ethereum ?? null;
  }
}
