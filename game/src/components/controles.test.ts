import { describe, expect, it } from 'vitest';
// Texto de styles.css y del componente (vite.config.js deja pasar estos ?raw a los tests).
import css from '../styles.css?raw';
import source from './Controles.ts?raw';
import app from '../app.ts?raw';
import perfilSource from './Perfil.ts?raw';
import { CONTROL_PREFS_KEY, createControlPrefs } from '../input/controlPrefs';
import { joystickDirections, knobOffset, wantedKey } from '../input/joystick';

/** Cuerpos (juntos) de todas las reglas cuyo selector es exactamente `selector`. */
const rule = (selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?:^|\\n)\\s*${escaped}\\s*\\{([^}]*)\\}`, 'g');
  return [...css.replace(/\r\n/g, '\n').matchAll(re)].map((m) => m[1]).join('\n');
};

describe('controles: flechas', () => {
  it('el pad de flechas no deja hacer scroll ni zoom', () => {
    expect(rule('.dpad')).toMatch(/touch-action:\s*none/);
    expect(css).toMatch(/\.stage, \.controles, \.dpad \{ touch-action: none; \}/);
  });

  it('cada flecha bloquea gestos y el menú de mantener presionado', () => {
    const btn = rule('.controles .dpad-btn');
    expect(btn).toMatch(/touch-action:\s*none/);
    expect(btn).toMatch(/-webkit-touch-callout:\s*none/);
    expect(btn).toMatch(/user-select:\s*none/);
  });

  it('no queda nada del joystick flotante viejo (el joystick fijo de Perfil es otro)', () => {
    for (const text of [css, source]) {
      expect(text).not.toMatch(/\.stick|stick-zone/);
      expect(text).not.toContain('Toca y arrastra');
      expect(text).not.toContain('createFloatingStick');
    }
    // Ningún archivo del juego (salvo esta prueba) menciona el joystick viejo.
    const all = import.meta.glob<string>('/src/**/*.{ts,css}', { query: '?raw', import: 'default', eager: true });
    const files = Object.entries(all).filter(([path]) => !path.endsWith('/controles.test.ts'));
    expect(files.length).toBeGreaterThan(10);
    for (const [path, text] of files) {
      expect(text, path).not.toContain('floatingStick');
      expect(text, path).not.toContain('JOYSTICK_');
    }
  });

  it('las flechas se encogen si la fila de controles no alcanza (vertical y horizontal)', () => {
    const dpad = rule('.dpad');
    expect(dpad).toContain('min(var(--dpad-btn)');
    expect(dpad).toContain('var(--controls-avail, var(--controls-h))');
    // Una sola regla para las dos orientaciones: ya no hay bloque horizontal solo para .dpad.
    expect(css.replace(/\r\n/g, '\n')).not.toMatch(/@media \(pointer: coarse\) and \(orientation: landscape\) \{\s*\.dpad \{/);
  });

  it('app.ts pone el alto real de la fila en vertical y lo quita fuera de vertical', () => {
    expect(app).toContain("setProperty('--controls-avail'");
    expect(app).toContain("removeProperty('--controls-avail')");
    expect(app).toContain("setProperty('--dpad-pad'");
  });

  it('un dedo con captura, sin scroll, pedido recto y vibración que falla en silencio', () => {
    expect(source).toContain('setPointerCapture');
    expect(source).toContain('preventDefault');
    expect(source).toContain('lostpointercapture');
    expect(source).toContain('pointercancel');
    expect(source).toContain('createDpad');
    expect(source).toContain('setDirections(state, frame.dir, null)');
    expect(source).toMatch(/try \{\s*navigator\.vibrate\(DPAD_HAPTIC_MS\)/);
  });

  it('nombres accesibles en español', () => {
    for (const label of ['Arriba', 'Abajo', 'Izquierda', 'Derecha', 'Flechas']) {
      expect(source).toContain(`'${label}'`);
    }
  });

  it('textos sin signos de exclamación', () => {
    expect(source).not.toMatch(/[¡!]['"`]/);
    expect(source).not.toMatch(/['"`>][^'"`<]*¡/);
  });
});

describe('controles: cruceta o joystick fijo', () => {
  it('la preferencia se guarda en el teléfono; por defecto cruceta; valores raros se ignoran', () => {
    const data = new Map<string, string>();
    const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
    const p = createControlPrefs(storage);
    expect(p.mode).toBe('cruceta');
    const seen: string[] = [];
    p.subscribe((m) => seen.push(m));
    p.setMode('joystick');
    expect(data.get(CONTROL_PREFS_KEY)).toBe('joystick');
    expect(createControlPrefs(storage).mode).toBe('joystick');
    p.setMode('joystick');
    expect(seen).toEqual(['joystick']);
    data.set(CONTROL_PREFS_KEY, 'volante');
    expect(createControlPrefs(storage).mode).toBe('cruceta');
    expect(createControlPrefs(null).mode).toBe('cruceta');
    const roto = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('lleno'); } };
    const q = createControlPrefs(roto);
    q.setMode('joystick');
    expect(q.mode).toBe('joystick');
  });

  it('el joystick: zona muerta al centro, 4 rectas y diagonales como el swipe; la palanca no sale de la base', () => {
    expect(joystickDirections(5, 5)).toBeNull();
    expect(joystickDirections(0, -40)).toEqual({ primary: 'arriba', secondary: null });
    expect(joystickDirections(40, 2)).toEqual({ primary: 'derecha', secondary: null });
    expect(joystickDirections(30, -30)).toEqual({ primary: 'derecha', secondary: 'arriba' });
    expect(knobOffset(10, 0, 50)).toEqual({ x: 10, y: 0 });
    const k = knobOffset(300, 400, 50);
    expect(Math.hypot(k.x, k.y)).toBeCloseTo(50);
    expect(wantedKey({ primary: 'arriba', secondary: 'derecha' })).toBe('arriba|derecha');
  });

  it('Controles muestra uno u otro según Perfil; el joystick bloquea gestos y suelta al pausar', () => {
    expect(source).toMatch(/pad\.hidden = mode !== 'cruceta';\s*\n\s*joy\.hidden = mode !== 'joystick';/);
    expect(source).toMatch(/joy\.setPointerCapture/);
    expect(source).toMatch(/releaseDirections\(state\);/);
    expect(source).toMatch(/if \(joyId !== null && state\.phase !== 'listo' && state\.phase !== 'jugando'\) releaseJoy\(\);/);
    expect(rule('.joystick')).toMatch(/touch-action:\s*none/);
    expect(app).toMatch(/createControles\(state, controlPrefs\)/);
    expect(perfilSource).toMatch(/setAttribute\('role', 'radiogroup'\)/);
    expect(perfilSource).toMatch(/opts\.controls\?\.setMode\(mode\)/);
  });
});
