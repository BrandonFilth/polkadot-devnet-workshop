import { describe, expect, it } from 'vitest';
import css from '../styles.css?raw';
import fontsCss from '../fonts/pixel.css?raw';
import mainSource from '../main.ts?raw';
import appSource from '../app.ts?raw';
import { typedLength, TYPE_CPS } from '../lib/typewriter';
import shellSource from './Shell.ts?raw';
import hudSource from './Hud.ts?raw';
import controlesSource from './Controles.ts?raw';
import premiosSource from './Premios.ts?raw';
import { ICON, medalRows, medalSvg, pixelIcon, POLKADOT_LOGO, USDT_HTML, USDT_ROWS, usdtSvg } from './icons';
import rankingSource from './Ranking.ts?raw';
import adminPremiosSource from './AdminPremios.ts?raw';
import { hudBestText } from './Hud';

describe('tema 8 bits: fuentes', () => {
  it('Press Start 2P y Pixelify Sans vienen dentro de la app (sin internet) y se cargan antes de styles.css', () => {
    expect(fontsCss).toMatch(/font-family: 'Press Start 2P'/);
    expect(fontsCss).toMatch(/font-family: 'Pixelify Sans'/);
    expect(fontsCss).not.toMatch(/https?:\/\//);
    expect([...fontsCss.matchAll(/url\('\.\/[a-z0-9-]+\.woff2'\)/g)]).toHaveLength(3);
    expect(mainSource.indexOf("import './fonts/pixel.css'")).toBeLessThan(mainSource.indexOf("import './styles.css'"));
  });

  it('títulos, botones y números en Press Start 2P; el texto en Pixelify Sans', () => {
    expect(css).toMatch(/--display: 'Press Start 2P'/);
    expect(css).toMatch(/--mono: 'Pixelify Sans'/);
  });
});

describe('tema 8 bits: estilo', () => {
  it('nada redondo y marcos de pixel con sombras duras', () => {
    expect(css).toMatch(/#app \*,\s*\n#app \*::before,\s*\n#app \*::after \{\s*\n\s*border-radius: 0 !important;/);
    expect(css).toMatch(/0 calc\(-1 \* var\(--px\)\) 0 0 var\(--fc\)/);
  });

  it('paleta: negro y rosa de Polka-Man, panel azul noche, oro, plata, bronce, verde y cian', () => {
    for (const color of ['#050505', '#ff2867', '#111122', '#ffd166', '#c0c0c0', '#e3965a', '#3ad06a', '#4fc3f7']) expect(css).toContain(color);
  });

  it('líneas de escaneo de CRT que no bloquean toques', () => {
    const block = /#app::after \{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(block).toMatch(/pointer-events:\s*none/);
    expect(block).toMatch(/repeating-linear-gradient/);
  });

  it('cursor ▶ parpadeante en la pestaña activa, por cuadros; nada se mueve con «reducir movimiento»', () => {
    expect(css).toMatch(/\.tabbar-btn\[aria-current='page'\] \.tabbar-label::before/);
    expect(css).toMatch(/animation: px-blink 1s steps\(1\) infinite/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\n\s*#app \.shell-panel:not\(\[hidden\]\),\s*\n\s*#app \.tabbar-btn\[aria-current='page'\] \.tabbar-label::before/);
  });

  it('foco visible en botones, enlaces y campos', () => {
    expect(css).toMatch(/#app button:focus-visible,\s*\n#app a:focus-visible,\s*\n#app input:focus-visible/);
  });
});

describe('íconos pixel', () => {
  it('cada ícono es una cuadrícula de 16×16 con bordes nítidos', () => {
    for (const svg of Object.values(ICON)) {
      expect(svg).toMatch(/viewBox="0 0 16 16"/);
      expect(svg).toMatch(/shape-rendering="crispEdges"/);
      expect(svg).toMatch(/aria-hidden="true"/);
    }
    expect(Object.keys(ICON)).toEqual(expect.arrayContaining(['jugar', 'ranking', 'premios', 'perfil', 'copiar', 'wallet', 'enlace']));
  });

  it('une los pixeles seguidos de una fila en un solo rectángulo', () => {
    expect(pixelIcon(['.##.', '#..#'])).toMatch(/d="M1 0h2v1h-2zM0 1h1v1h-1zM3 1h1v1h-1z"/);
  });
});

describe('texto letra por letra', () => {
  it('avanza a TYPE_CPS letras por segundo y nunca pasa del total', () => {
    expect(typedLength(10, 0)).toBe(0);
    expect(typedLength(100, 500)).toBe(Math.floor(TYPE_CPS / 2));
    expect(typedLength(10, 10_000)).toBe(10);
  });
});

describe('sonido chiptune en la interfaz', () => {
  it('suena en botones y enlaces, no en las flechas del juego ni en los botones de sonido', () => {
    expect(appSource).toMatch(/closest\('button, a\[href\]'\)/);
    expect(appSource).toMatch(/closest\('\.controles, \.sonido-toggle, \.hud-sonido-wrap'\)/);
    expect(appSource).toMatch(/audio\.blip\(\)/);
  });
});

describe('ajustes: Jugar, barra superior, ranking y podio de Premios', () => {
  it('Jugar no lleva la tarjeta de las rondas y su contenido queda centrado', () => {
    expect(appSource).not.toMatch(/createRoundCard/);
    expect(css).toMatch(/\.shell-panel--jugar > \.jugar \{[^}]*flex: 1 0 auto/);
    expect(css).toMatch(/\.shell \.inicio \{\s*\n\s*flex: 1 0 auto;\s*\n\s*justify-content: center;/);
  });

  it('la barra superior: Polka-Man a la izquierda; billetera y Polkadot (blanco, sin rosa) a la derecha', () => {
    expect(shellSource).toMatch(/ICON\.jugar\}<\/span><span>POLKA-MAN<\/span>/);
    expect(shellSource).toMatch(/POLKADOT_LOGO\}<\/span><span class="shell-polkadot-text">POLKADOT<\/span>/);
    expect(shellSource).toMatch(/bar\.append\(brand\);\s*\n\s*if \(opts\.billetera\) bar\.append\(opts\.billetera\);\s*\n\s*bar\.append\(polkadot\);/);
    expect(css).toMatch(/\.shell-polkadot-mark \{[^}]*color: var\(--ink\)/);
    expect(POLKADOT_LOGO).toMatch(/fill="currentColor"/);
    expect(POLKADOT_LOGO.match(/<path /g)).toHaveLength(6);
  });

  it('el ranking va centrado', () => {
    expect(css).toMatch(/\.shell \.ranking h2,[\s\S]*?\.shell \.ranking-table td \{\s*\n\s*text-align: center;/);
  });

  it('medallas de 16×16 con el número del lugar en el centro del disco', () => {
    for (const place of [1, 2, 3] as const) {
      const rows = medalRows(place);
      expect(rows).toHaveLength(16);
      for (const row of rows) expect(row).toHaveLength(16);
      // El número ocupa las columnas 6 a 8 de las filas 8 a 12 y nada más.
      rows.forEach((row, y) => {
        [...row].forEach((ch, x) => {
          if (ch === 'd') expect(x >= 6 && x <= 8 && y >= 8 && y <= 12).toBe(true);
        });
      });
      const svg = medalSvg(place);
      expect(svg).toMatch(/shape-rendering="crispEdges"/);
      expect(svg).toMatch(/class="medal-ribbon"[\s\S]*class="medal-disc"[\s\S]*class="medal-digit"/);
    }
    // Alrededor del número el disco no tiene huecos.
    expect(medalRows(1)[8]!.slice(6, 9)).toBe('#d#');
    for (const place of [1, 2, 3] as const) for (const row of medalRows(place).slice(8, 13)) expect(row.slice(2, 13)).not.toContain('.');
    expect(medalRows(2)[10]!.slice(6, 9)).toBe('ddd');
  });

  it('el podio de Premios lleva medalla, «$» y el lugar para lectores de pantalla', () => {
    expect(premiosSource).toMatch(/medalSvg\(place, 40\)/);
    expect(premiosSource).toMatch(/usd\(amount, false\)/);
    expect(premiosSource).toMatch(/class="sr-only">\$\{placeLabel\(place\)\} lugar:/);
    expect(css).toMatch(/#app \.prize-step \{[^}]*justify-content: center/);
  });
});

describe('ajustes: sonido, HUD y controles de la partida', () => {
  it('la perilla del interruptor de sonido cabe dentro del rosa (3 + 14 + 3 = 20 de alto, 23 + 14 + 3 = 40 de ancho)', () => {
    expect(css).toMatch(/#app \.sonido-switch \{\s*\n\s*width: 40px;\s*\n\s*height: 20px;/);
    expect(css).toMatch(/#app \.sonido-switch::after \{\s*\n\s*top: 3px;\s*\n\s*left: 23px;\s*\n\s*width: 14px;\s*\n\s*height: 14px;/);
  });

  it('el HUD va en dos filas: puntos, ronda y récord arriba; vidas y botones abajo', () => {
    expect(hudSource).toMatch(/top\.append\(stats, best\);/);
    expect(hudSource).toMatch(/actions\.append\(pause, \.\.\.\(sonido \? \[sonido\] : \[\]\), menu\);/);
    expect(hudSource).toMatch(/bottom\.append\(lives, actions\);/);
    expect(hudSource).toMatch(/header\.replaceChildren\(top, bottom\);/);
    // 4 de borde + 4 de relleno + 28 + 48 = 84 = HUD_HEIGHT_PX.
    expect(css).toMatch(/\.hud-fila--datos \{\s*\n\s*height: 28px;/);
    expect(css).toMatch(/\.hud-fila--botones \{\s*\n\s*height: 48px;/);
  });

  it('pausa a la izquierda y flechas a la derecha', () => {
    expect(controlesSource).toMatch(/element\.append\(pause, pad\);/);
    expect(css).toMatch(/#app \.controles \{\s*\n\s*padding: 0 8px 0 24px;/);
  });
});

describe('HUD: récord y vidas', () => {
  it('sin récord se ven ceros; con récord, el número', () => {
    expect(hudBestText(null)).toBe('Récord: 00000');
    expect(hudBestText(1240n)).toBe('Récord: 1240');
    expect(hudSource).not.toMatch(/'—'/);
  });

  it('cada vida es un Polka-Man pixel de 28 px, al nivel de los botones', () => {
    expect(hudSource).toMatch(/dot\.className = 'hud-life';\s*\n\s*dot\.innerHTML = ICON\.jugar;/);
    expect(css).toMatch(/#app \.hud-life \{\s*\n\s*display: block;\s*\n\s*width: 28px;\s*\n\s*height: 28px;\s*\n\s*background: none;/);
    expect(css).toMatch(/#app \.hud-fila \.hud-lives \{\s*\n\s*align-items: center;\s*\n\s*gap: 4px;\s*\n\s*height: 48px;/);
  });
});

describe('Premios: USDT con su logo y sin el total del evento', () => {
  it('el logo de USDT es una cuadrícula de 16×16: disco verde con la T blanca', () => {
    expect(USDT_ROWS).toHaveLength(16);
    for (const row of USDT_ROWS) expect(row).toHaveLength(16);
    expect(usdtSvg()).toMatch(/class="usdt-disc"[\s\S]*class="usdt-t"/);
    expect(USDT_HTML).toMatch(/<span class="usdt"><svg[\s\S]*<\/svg><span>USDT<\/span><\/span>/);
    expect(css).toMatch(/\.usdt-disc \{ fill: #26a17b; \}/);
  });

  it('solo dice cuánto se reparte por ronda, sin «en total»', () => {
    expect(premiosSource).toMatch(/textWithUsdt\(facts, `\$\{usd\(PRIZE_PER_ROUND\)\} por ronda`\);/);
    expect(premiosSource).not.toMatch(/en total|PRIZE_TOTAL/);
  });

  it('la palabra USDT lleva el logo en Premios, el podio del Ranking y el panel de admin', () => {
    expect(premiosSource).toMatch(/<span class="prize-unit">\$\{USDT_HTML\}<\/span>/);
    expect(premiosSource).toMatch(/<p class="eyebrow">Premios en \$\{USDT_HTML\}<\/p>/);
    expect(premiosSource).toMatch(/textWithUsdt\(amount, usd\(w\.amount\)\);/);
    expect(rankingSource).toMatch(/textWithUsdt\(prize, usd\(PRIZE_AMOUNTS\[i\]!\)\);/);
    expect(adminPremiosSource).toMatch(/textWithUsdt\(amount, usd\(w\.amount\)\);/);
  });
});

describe('Ranking: top 3 con medallas y colores', () => {
  it('el podio lleva medalla y no tiene botón de copiar wallet (ese queda en la tabla)', () => {
    expect(rankingSource).toMatch(/place\.innerHTML = `\$\{medalSvg\(\(i \+ 1\) as 1 \| 2 \| 3, 36\)\}<span class="sr-only">\$\{i \+ 1\}\.º lugar:<\/span>`;/);
    expect(rankingSource).toMatch(/li\.append\(place, who, score, prize\);\s*\n\s*ol\.append\(li\);/);
    expect(rankingSource).toMatch(/if \(row\.wallet\) w\.append\(walletButton\(row, cells\[1\]\)\);/);
  });

  it('oro, plata y bronce en el podio y en las 3 primeras filas de la tabla', () => {
    expect(rankingSource).toMatch(/if \(i < 3\) tr\.dataset\.top = String\(i \+ 1\);/);
    expect(css).toMatch(/#app \.ranking-table tr\[data-top='1'\] \{ --top: var\(--gold\); \}/);
    expect(css).toMatch(/#app \.ranking-table tr\[data-top='2'\] \{ --top: var\(--silver\); \}/);
    expect(css).toMatch(/#app \.ranking-table tr\[data-top='3'\] \{ --top: var\(--bronze\); \}/);
    expect(css).toMatch(/#app \.podium-step--2 \{ --fc: var\(--silver\); \}/);
    expect(css).toMatch(/#app \.podium-step--3 \{ --fc: var\(--bronze\); \}/);
  });
});
