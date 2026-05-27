import { DefaultNamingStrategy, type NamingStrategyInterface } from 'typeorm';

function toSnakeCase(str: string): string {
  return str.replace(/([A-Z])/g, (match) => `_${match.toLowerCase()}`).replace(/^_/, '');
}

export class SnakeCaseNamingStrategy extends DefaultNamingStrategy implements NamingStrategyInterface {
  override columnName(
    propertyName: string,
    customName: string | undefined,
    embeddedPrefixes: string[],
  ): string {
    const name = customName ?? toSnakeCase(propertyName);
    if (embeddedPrefixes.length) {
      return toSnakeCase(embeddedPrefixes.join('_')) + '_' + name;
    }
    return name;
  }
}
