import euGeoData from '../../assets/eu-geo.json';

export interface EuCountry {
  code: string;
  name: string;
  regions: string[];
}

class EuGeoService {
  private countries: EuCountry[] = euGeoData.countries as EuCountry[];

  getCountries(): EuCountry[] {
    return this.countries;
  }

  getCountryByCode(code: string): EuCountry | undefined {
    return this.countries.find((c) => c.code === code);
  }

  getRegionsForCountry(countryCode: string): string[] {
    return this.getCountryByCode(countryCode)?.regions ?? [];
  }

  isEuCountry(code: string): boolean {
    return this.countries.some((c) => c.code === code);
  }
}

export default new EuGeoService();
