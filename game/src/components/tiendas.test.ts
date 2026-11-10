import { describe, expect, it } from 'vitest';
import css from '../styles.css?raw';
import appSource from '../app.ts?raw';
import premiosSource from './Premios.ts?raw';
import perfilSource from './Perfil.ts?raw';
import tiendasSource from './Tiendas.ts?raw';
import { BINANCE_ANDROID_URL, BINANCE_IOS_URL, NOVA_WALLET_ANDROID_URL, NOVA_WALLET_IOS_URL } from '../contract/config';
import { WALLET_HINT } from './Perfil';
import { splitApps, STORE_APPS } from './Tiendas';
import { ICON } from './icons';

describe('Binance y Nova Wallet: enlaces a las tiendas oficiales', () => {
  it('cada app tiene su ficha oficial en App Store y Google Play', () => {
    expect(STORE_APPS.binance).toEqual({ name: 'Binance', ios: BINANCE_IOS_URL, android: BINANCE_ANDROID_URL });
    expect(STORE_APPS.nova).toEqual({ name: 'Nova Wallet', ios: NOVA_WALLET_IOS_URL, android: NOVA_WALLET_ANDROID_URL });
    expect(BINANCE_IOS_URL).toBe('https://apps.apple.com/app/binance-buy-bitcoin-crypto/id1436799971');
    expect(BINANCE_ANDROID_URL).toBe('https://play.google.com/store/apps/details?id=com.binance.dev');
    expect(NOVA_WALLET_IOS_URL).toBe('https://apps.apple.com/app/nova-polkadot-wallet/id1597119355');
    expect(NOVA_WALLET_ANDROID_URL).toBe('https://play.google.com/store/apps/details?id=io.novafoundation.nova.market');
  });

  it('splitApps separa las menciones de Binance y Nova Wallet del resto del texto', () => {
    expect(splitApps(WALLET_HINT).filter((p) => p === 'binance' || p === 'nova')).toEqual(['binance', 'nova']);
    expect(splitApps('Usa Binance o Nova Wallet.')).toEqual(['Usa ', 'binance', ' o ', 'nova', '.']);
    expect(splitApps('Nova Wallet')).toEqual(['nova']);
    expect(splitApps('Sin apps')).toEqual(['Sin apps']);
    expect(splitApps('')).toEqual([]);
  });

  it('Premios y Perfil convierten los nombres en enlaces que abren el diálogo', () => {
    expect(premiosSource).toMatch(/textWithApps\(appsStep, appsStep\.textContent \?\? '', \(app\) => opts\.onApp\(app\)\)/);
    expect(perfilSource).toMatch(/textWithApps\(walletHint, view\.wallet\.hint, \(app\) => opts\.onApp\(app\)\)/);
    expect(appSource).toMatch(/onApp: \(app\) => tiendas\.open\(app\)/);
  });

  it('el diálogo pregunta iOS o Android, con su logo, y abre la tienda en otra pestaña', () => {
    expect(tiendasSource).toMatch(/'iPhone \(iOS\)'/);
    expect(tiendasSource).toMatch(/'Android'/);
    expect(tiendasSource).toMatch(/a\.target = '_blank';\s*\n\s*a\.rel = 'noopener noreferrer';/);
    expect(tiendasSource).toMatch(/link\.href = s\.os === 'ios' \? a\.ios : a\.android;/);
    expect(Object.keys(ICON)).toEqual(expect.arrayContaining(['apple', 'android']));
    expect(css).toMatch(/\.app-link \{[^}]*text-decoration: underline/);
  });
});

describe('Jugar no pausa la partida al empezar', () => {
  it('la pausa por otra pestaña mira la pestaña, no `covers` (que en el primer cuadro aún dice inicio)', () => {
    expect(appSource).toMatch(/if \(shellRef\.tab !== 'jugar'\) setPaused\(state, true\);/);
    expect(appSource).not.toMatch(/if \(shellRef\.covers\) setPaused/);
  });
});
