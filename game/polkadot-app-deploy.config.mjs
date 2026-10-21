// Publicación con icono y manifest. El dominio sale de la variable APP_DOT (ver contenido/06-publicar.md).
export default {
  domain: process.env.APP_DOT,
  displayName: 'Polka-Man',
  description: 'Juego de laberinto en Polkadot: come bolitas, esquiva fantasmas y guarda tu récord en la blockchain.',
  icon: { path: './assets/icono.png', format: 'png' },
  executables: [{ kind: 'app', path: './dist', appVersion: [1, 0, 0] }],
};
