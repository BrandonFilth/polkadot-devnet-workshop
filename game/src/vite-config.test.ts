import { describe, expect, it } from 'vitest';

type Plugin = {
  name: string;
  apply: string;
  resolveId: (id: string) => string | null;
  load: (id: string) => string | null;
};

// Especificador no literal: tsc no intenta tipar vite.config.js (no hay allowJs).
const ruta = new URL('../vite.config.js', import.meta.url).href;
const mod = (await import(/* @vite-ignore */ ruta)) as {
  soloDescriptorDevnet: () => Plugin;
  default: { plugins?: Array<{ name?: string }> };
};

const OTRAS = [
  'devnet-bulletin',
  'devnet-individuality',
  'kusama-asset-hub',
  'paseo-asset-hub',
  'paseo-bulletin',
  'paseo-individuality',
  'polkadot-asset-hub',
  'previewnet-asset-hub',
  'previewnet-bulletin',
  'previewnet-individuality',
];

describe('soloDescriptorDevnet', () => {
  const plugin = mod.soloDescriptorDevnet();

  it('solo se aplica en el build', () => {
    expect(plugin.apply).toBe('build');
  });

  it.each(OTRAS)('cambia %s por un módulo vacío', (subruta) => {
    expect(plugin.resolveId(`@parity/product-sdk-descriptors/${subruta}`)).toBe(
      `\0descriptor-sin-usar:${subruta}`,
    );
  });

  it('deja pasar devnet-asset-hub y otros módulos', () => {
    expect(plugin.resolveId('@parity/product-sdk-descriptors/devnet-asset-hub')).toBeNull();
    expect(plugin.resolveId('@parity/product-sdk/chain')).toBeNull();
  });

  it('el módulo vacío no exporta nada y no toca otros ids', () => {
    expect(plugin.load('\0descriptor-sin-usar:paseo-asset-hub')).toBe('export {};');
    expect(plugin.load('x')).toBeNull();
  });

  it('está registrado en la configuración', () => {
    const nombres = (mod.default.plugins ?? []).map((p) => p?.name);
    expect(nombres).toContain('solo-descriptor-devnet');
  });
});
