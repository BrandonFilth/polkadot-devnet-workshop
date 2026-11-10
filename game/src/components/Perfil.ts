// Pestaña Perfil: cuenta (conectar y dirección EVM para copiar), username, wallet de premios, sonido y,
// solo para el admin del contrato, la entrada a sus paneles (hora de inicio y pago de premios).
import { PRIZE_NETWORK } from '../contract/config';
import { parseWallet } from '../contract/prizes';
import type { HostPhase, Hub } from '../hub/hub';
import { shortAddress } from '../lib/format';
import type { Mine } from './FinDePartida';
import { ICON } from './icons';
import { textWithApps, type AppId } from './Tiendas';

/** Wallet de premios: dirección, null (no tiene), undefined (todavía no se lee o falló). */
export type Payout = `0x${string}` | null | undefined;

export interface PerfilView {
  account: { state: 'fuera' | 'esperando' | 'error' | 'desconectada' | 'conectada'; text: string };
  username: { text: string; label: string; disabled: boolean } | null;
  wallet: { text: string; saved: boolean; editable: boolean; hint: string };
  admin: boolean;
}

export const WALLET_HINT = `Recomendado: tu dirección de depósito de USDT en Binance, red ${PRIZE_NETWORK}. También sirve una wallet de autocustodia como Nova Wallet.`;

/** Qué muestra el perfil. Puro: se prueba sin DOM. */
export function perfilView(i: { host: HostPhase; connected: boolean; mine: Mine; payout: Payout; busy: boolean; admin: boolean }): PerfilView {
  const account: PerfilView['account'] =
    i.host === 'fuera'
      ? { state: 'fuera', text: 'Abre Polka-Man en la Polkadot App para conectar tu cuenta.' }
      : i.connected
        ? { state: 'conectada', text: 'Cuenta conectada' }
        : i.host === 'error'
          ? { state: 'error', text: 'No hay conexión con la Polkadot App.' }
          : i.host === 'listo'
            ? { state: 'desconectada', text: 'Conecta tu cuenta para guardar récords y cobrar premios.' }
            : { state: 'esperando', text: 'Conectando con la Polkadot App…' };
  const known = i.connected && i.mine !== null && i.mine !== 'error' ? i.mine : null;
  const username = i.connected
    ? known
      ? { text: known.username || 'Sin username', label: known.username ? 'Cambiar' : 'Elegir', disabled: i.busy }
      : { text: i.mine === 'error' ? 'No se pudo leer' : 'Leyendo…', label: 'Elegir', disabled: true }
    : null;
  const wallet = !i.connected
    ? { text: 'Conecta tu cuenta para registrar tu wallet.', saved: false, editable: false, hint: WALLET_HINT }
    : i.payout === undefined
      ? { text: 'Leyendo tu wallet…', saved: false, editable: !i.busy, hint: WALLET_HINT }
      : i.payout === null
        ? { text: 'Todavía no registras una wallet.', saved: false, editable: !i.busy, hint: WALLET_HINT }
        : { text: `Tus premios llegan a ${shortAddress(i.payout)}`, saved: true, editable: !i.busy, hint: WALLET_HINT };
  return { account, username, wallet, admin: i.connected && i.admin };
}

export interface Perfil {
  readonly element: HTMLElement;
  /** Ajusta la vista al Hub. Solo toca el DOM si algo cambió. */
  sync(): void;
  /** Pone el foco en el campo de la wallet (desde el recordatorio o desde Premios). */
  focusWallet(): void;
}

export function createPerfil(opts: {
  hub: Hub;
  mine(): Mine;
  payout(): Payout;
  isAdmin(): boolean;
  /** Botón para copiar la dirección EVM de la cuenta (components/Billetera.ts). */
  billetera: HTMLElement;
  /** Toggles de Música y Efectos. */
  sonido: HTMLElement;
  onUsername(): void;
  onAdminInicio(): void;
  onAdminPremios(): void;
  /** Después de guardar o quitar la wallet: app.ts la relee. */
  onWalletSaved(): void;
  /** «Binance» o «Nova Wallet» en la sugerencia: abre el diálogo para instalar esa app. */
  onApp(app: AppId): void;
}): Perfil {
  const { hub } = opts;
  const element = document.createElement('div');
  element.className = 'perfil';

  const heading = document.createElement('h2');
  heading.className = 'perfil-title';
  heading.textContent = 'Perfil';

  // Cuenta
  const cuenta = document.createElement('section');
  cuenta.className = 'card';
  cuenta.setAttribute('aria-labelledby', 'perfil-cuenta');
  const cuentaTitle = document.createElement('h3');
  cuentaTitle.id = 'perfil-cuenta';
  cuentaTitle.textContent = 'Tu cuenta';
  const cuentaText = document.createElement('p');
  cuentaText.className = 'card-text';
  cuentaText.setAttribute('role', 'status');
  const connect = document.createElement('button');
  connect.type = 'button';
  connect.className = 'overlay-action btn-block';
  connect.textContent = 'Conectar cuenta';
  connect.addEventListener('click', () => {
    const s = hub.getState();
    if (s.busy) return;
    if (s.host === 'error') void hub.start();
    else if (s.host === 'listo' && s.account === null) void hub.connect();
  });
  const addressRow = document.createElement('div');
  addressRow.className = 'perfil-address';
  const addressLabel = document.createElement('span');
  addressLabel.className = 'field-label';
  addressLabel.textContent = 'Dirección de tu cuenta (EVM)';
  addressRow.append(addressLabel, opts.billetera);
  cuenta.append(cuentaTitle, cuentaText, connect, addressRow);

  // Username
  const user = document.createElement('section');
  user.className = 'card card--row';
  user.setAttribute('aria-labelledby', 'perfil-username');
  const userInfo = document.createElement('div');
  const userTitle = document.createElement('h3');
  userTitle.id = 'perfil-username';
  userTitle.textContent = 'Username';
  const userText = document.createElement('p');
  userText.className = 'card-text';
  userInfo.append(userTitle, userText);
  const userButton = document.createElement('button');
  userButton.type = 'button';
  userButton.className = 'overlay-secondary btn-compact';
  userButton.addEventListener('click', () => opts.onUsername());
  user.append(userInfo, userButton);

  // Wallet de premios
  const wallet = document.createElement('form');
  wallet.className = 'card';
  wallet.noValidate = true;
  wallet.setAttribute('aria-labelledby', 'perfil-wallet');
  const walletTitle = document.createElement('h3');
  walletTitle.id = 'perfil-wallet';
  walletTitle.innerHTML = `${ICON.wallet}<span>Wallet para tus premios</span>`;
  const walletText = document.createElement('p');
  walletText.className = 'card-text perfil-wallet-now';
  const walletLabel = document.createElement('label');
  walletLabel.htmlFor = 'perfil-wallet-input';
  walletLabel.className = 'field-label';
  walletLabel.textContent = 'Dirección 0x… donde quieres recibir USDT';
  const walletInput = document.createElement('input');
  walletInput.id = 'perfil-wallet-input';
  walletInput.type = 'text';
  walletInput.inputMode = 'text';
  walletInput.autocomplete = 'off';
  walletInput.autocapitalize = 'none';
  walletInput.spellcheck = false;
  walletInput.placeholder = '0x…';
  walletInput.maxLength = 64;
  walletInput.setAttribute('aria-describedby', 'perfil-wallet-hint perfil-wallet-msg');
  const walletHint = document.createElement('p');
  walletHint.id = 'perfil-wallet-hint';
  walletHint.className = 'card-note';
  const walletMsg = document.createElement('p');
  walletMsg.id = 'perfil-wallet-msg';
  walletMsg.className = 'form-message';
  walletMsg.setAttribute('role', 'alert');
  const walletActions = document.createElement('div');
  walletActions.className = 'form-actions';
  const walletSave = document.createElement('button');
  walletSave.type = 'submit';
  walletSave.className = 'overlay-action';
  walletSave.textContent = 'Guardar wallet';
  const walletRemove = document.createElement('button');
  walletRemove.type = 'button';
  walletRemove.className = 'overlay-secondary';
  walletRemove.textContent = 'Quitar';
  walletActions.append(walletSave, walletRemove);
  wallet.append(walletTitle, walletText, walletLabel, walletInput, walletHint, walletMsg, walletActions);

  let sending = false;
  const send = async (target: `0x${string}` | null) => {
    if (sending) return;
    sending = true;
    walletMsg.textContent = '';
    shownKey = '';
    sync();
    try {
      const r = await hub.setPayoutWallet(target);
      if (r.ok) {
        walletInput.value = '';
        opts.onWalletSaved();
      } else {
        const p = hub.getState().progress;
        walletMsg.textContent = p?.op === 'wallet' && p.step === 'error' && p.message === r.message ? '' : r.message;
      }
    } finally {
      sending = false;
      shownKey = '';
      sync();
    }
  };
  wallet.addEventListener('submit', (e) => {
    e.preventDefault();
    const parsed = parseWallet(walletInput.value);
    if (!parsed.ok) {
      walletMsg.textContent = parsed.message;
      walletInput.focus();
      return;
    }
    void send(parsed.wallet);
  });
  walletInput.addEventListener('input', () => {
    walletMsg.textContent = '';
  });
  walletRemove.addEventListener('click', () => void send(null));
  wallet.addEventListener('keydown', (e) => e.stopPropagation());

  // Sonido
  const sonido = document.createElement('section');
  sonido.className = 'card';
  sonido.setAttribute('aria-labelledby', 'perfil-sonido');
  const sonidoTitle = document.createElement('h3');
  sonidoTitle.id = 'perfil-sonido';
  sonidoTitle.textContent = 'Sonido';
  sonido.append(sonidoTitle, opts.sonido);

  // Admin
  const admin = document.createElement('section');
  admin.className = 'card card--admin';
  admin.setAttribute('aria-labelledby', 'perfil-admin');
  admin.hidden = true;
  const adminTitle = document.createElement('h3');
  adminTitle.id = 'perfil-admin';
  adminTitle.innerHTML = `${ICON.escudo}<span>Admin</span>`;
  const adminActions = document.createElement('div');
  adminActions.className = 'form-actions';
  const adminInicio = document.createElement('button');
  adminInicio.type = 'button';
  adminInicio.className = 'overlay-secondary';
  adminInicio.textContent = 'Hora de inicio';
  adminInicio.addEventListener('click', () => opts.onAdminInicio());
  const adminPremios = document.createElement('button');
  adminPremios.type = 'button';
  adminPremios.className = 'overlay-action';
  adminPremios.textContent = 'Pagar premios';
  adminPremios.addEventListener('click', () => opts.onAdminPremios());
  adminActions.append(adminPremios, adminInicio);
  admin.append(adminTitle, adminActions);

  element.append(heading, cuenta, user, wallet, sonido, admin);

  let shownKey = '';
  const sync = () => {
    const s = hub.getState();
    const view = perfilView({
      host: s.host,
      connected: s.account !== null,
      mine: opts.mine(),
      payout: opts.payout(),
      busy: s.busy || sending,
      admin: opts.isAdmin(),
    });
    const key = JSON.stringify(view);
    if (key === shownKey) return;
    shownKey = key;
    cuentaText.textContent = view.account.text;
    cuenta.dataset.state = view.account.state;
    connect.hidden = view.account.state !== 'desconectada' && view.account.state !== 'error';
    connect.textContent = view.account.state === 'error' ? 'Reintentar' : 'Conectar cuenta';
    connect.disabled = s.busy;
    addressRow.hidden = view.account.state !== 'conectada';
    user.hidden = view.username === null;
    if (view.username) {
      userText.textContent = view.username.text;
      userButton.textContent = view.username.label;
      userButton.disabled = view.username.disabled;
      userButton.setAttribute('aria-label', `${view.username.label} username`);
    }
    walletText.textContent = view.wallet.text;
    walletText.classList.toggle('perfil-wallet-now--ok', view.wallet.saved);
    // Solo se rearma si cambia el texto: así los botones «Binance» y «Nova Wallet» no pierden el foco.
    if (walletHint.dataset.text !== view.wallet.hint) {
      walletHint.dataset.text = view.wallet.hint;
      textWithApps(walletHint, view.wallet.hint, (app) => opts.onApp(app));
    }
    walletInput.disabled = !view.wallet.editable;
    walletSave.disabled = !view.wallet.editable;
    walletRemove.hidden = !view.wallet.saved;
    walletRemove.disabled = !view.wallet.editable;
    walletLabel.hidden = !s.account;
    walletInput.hidden = !s.account;
    walletActions.hidden = !s.account;
    admin.hidden = !view.admin;
  };

  return {
    element,
    sync,
    focusWallet() {
      if (!walletInput.hidden) walletInput.focus({ preventScroll: false });
      wallet.scrollIntoView({ block: 'center' });
    },
  };
}
