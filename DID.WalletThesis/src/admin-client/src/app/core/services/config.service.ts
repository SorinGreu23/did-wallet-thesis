import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

interface AppConfig {
  euRootDid: string;
}

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private readonly http = inject(HttpClient);
  private readonly _euRootDid = signal<string>('');

  readonly euRootDid = this._euRootDid.asReadonly();

  async load(): Promise<void> {
    const config = await firstValueFrom(
      this.http.get<AppConfig>('/api/config')
    );
    this._euRootDid.set(config.euRootDid);
  }
}

