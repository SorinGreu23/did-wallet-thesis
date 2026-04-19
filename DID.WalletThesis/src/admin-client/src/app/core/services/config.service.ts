import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

interface AppConfig {
  euRootDid: string;
  rpcUrl: string;
  accreditationRegistryAddress: string;
}

interface CredentialConfig {
  rpcUrl: string;
  credentialRegistryAddress: string;
}

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private readonly http = inject(HttpClient);
  private readonly _euRootDid = signal<string>('');
  private readonly _rpcUrl = signal<string>('');
  private readonly _accreditationRegistryAddress = signal<string>('');
  private readonly _credentialRegistryAddress = signal<string>('');

  readonly euRootDid = this._euRootDid.asReadonly();
  readonly rpcUrl = this._rpcUrl.asReadonly();
  readonly accreditationRegistryAddress = this._accreditationRegistryAddress.asReadonly();
  readonly credentialRegistryAddress = this._credentialRegistryAddress.asReadonly();

  async load(): Promise<void> {
    const [config, credConfig] = await Promise.all([
      firstValueFrom(this.http.get<AppConfig>('/api/config')),
      firstValueFrom(this.http.get<CredentialConfig>('/api/credentials/config')),
    ]);
    this._euRootDid.set(config.euRootDid);
    this._rpcUrl.set(config.rpcUrl);
    this._accreditationRegistryAddress.set(config.accreditationRegistryAddress);
    this._credentialRegistryAddress.set(credConfig.credentialRegistryAddress);
  }
}

