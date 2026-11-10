import { describe, expect, it, vi } from 'vitest';
import css from '../styles.css?raw';
import { COPY_FEEDBACK_MS } from '../engine/rules';
import { copyText } from '../lib/clipboard';
import billeteraSource from './Billetera.ts?raw';
import inicioSource from './Inicio.ts?raw';
import shellSource from './Shell.ts?raw';
import { billeteraView, COPIED_LABEL, COPY_FAILED_LABEL } from './Billetera';

const H160 = `0x${'ab12'.repeat(10)}`;

describe('billetera: vista', () => {
  it('sin cuenta no se muestra', () => {
    expect(billeteraView(null, 'idle')).toBeNull();
    expect(billeteraView(undefined, 'idle')).toBeNull();
  });

  it('con cuenta: la dirección EVM acortada y la completa para copiar', () => {
    expect(billeteraView(H160, 'idle')).toEqual({ label: '0xab12…ab12', aria: `Copiar tu dirección ${H160}`, full: H160 });
  });

  it('después de copiar dice «Copiada», o el error si no se pudo', () => {
    expect(billeteraView(H160, 'copiada')?.label).toBe(COPIED_LABEL);
    expect(billeteraView(H160, 'error')?.label).toBe(COPY_FAILED_LABEL);
    expect(COPY_FEEDBACK_MS).toBeGreaterThan(0);
  });

  it('copia la dirección H160 de la cuenta (la que ve el contrato), no la SS58', () => {
    expect(billeteraSource).toMatch(/account\?\.h160/);
    expect(billeteraSource).not.toMatch(/ss58/);
  });

  it('va en la esquina superior derecha: al final de la barra superior de la app', () => {
    expect(shellSource).toMatch(/bar\.append\(brand\);\s*\n\s*if \(opts\.billetera\) bar\.append\(opts\.billetera\);/);
    expect(css).toMatch(/\.shell-bar\s*\{[^}]*justify-content:\s*space-between/);
    expect(css).toMatch(/\.billetera\s*\{/);
    // La pantalla de inicio la sigue aceptando en su esquina, por si se usa sola.
    expect(inicioSource).toMatch(/if \(opts\.billetera\) top\.append\(opts\.billetera\);/);
  });
});

describe('copyText', () => {
  it('usa la API del portapapeles', async () => {
    const writeText = vi.fn(async () => undefined);
    const legacyCopy = vi.fn(() => true);
    expect(await copyText(H160, { writeText, legacyCopy })).toBe(true);
    expect(writeText).toHaveBeenCalledWith(H160);
    expect(legacyCopy).not.toHaveBeenCalled();
  });

  it('si la API falla (iframe sin permiso) usa el método viejo', async () => {
    const writeText = vi.fn(async () => {
      throw new Error('NotAllowedError');
    });
    const legacyCopy = vi.fn(() => true);
    expect(await copyText(H160, { writeText, legacyCopy })).toBe(true);
    expect(legacyCopy).toHaveBeenCalledWith(H160);
  });

  it('sin ninguno de los dos, o si los dos fallan, devuelve false sin lanzar', async () => {
    expect(await copyText(H160, {})).toBe(false);
    expect(
      await copyText(H160, {
        writeText: async () => {
          throw new Error('no');
        },
        legacyCopy: () => {
          throw new Error('no');
        },
      }),
    ).toBe(false);
    expect(await copyText(H160, { legacyCopy: () => false })).toBe(false);
  });
});
