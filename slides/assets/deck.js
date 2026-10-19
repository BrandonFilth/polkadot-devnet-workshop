// Navegación compartida: flechas, F para pantalla completa, #n abre la diapositiva n.
const deck = document.getElementById('deck');
const slides = [...deck.querySelectorAll('.slide')];
let i = 0;

function fit() {
  const s = Math.min(innerWidth / 1600, innerHeight / 900);
  deck.style.transform = `translate(-50%, -50%) scale(${s})`;
}

function show(n) {
  i = Math.max(0, Math.min(slides.length - 1, n));
  slides.forEach((s, k) => s.classList.toggle('on', k === i));
  const pad = (v) => String(v).padStart(2, '0');
  document.getElementById('count').textContent = `${pad(i + 1)} / ${pad(slides.length)}`;
  document.getElementById('progress').style.width = `${((i + 1) / slides.length) * 100}%`;
  // En la última diapositiva, el contador avisa a qué capítulo lleva la flecha.
  const siguiente = deck.dataset.next?.match(/^(\d+)/)?.[1];
  if (i === slides.length - 1 && siguiente) document.getElementById('count').textContent += `  → ${siguiente}`;
  history.replaceState(null, '', `#${i + 1}`);
}

// Las presentaciones están encadenadas: después de la última diapositiva sigue el capítulo
// siguiente (data-next) y antes de la primera, el final del anterior (data-prev).
function next() {
  if (i === slides.length - 1 && deck.dataset.next) location.href = deck.dataset.next;
  else show(i + 1);
}
function prev() {
  if (i === 0 && deck.dataset.prev) location.href = `${deck.dataset.prev}#fin`;
  else show(i - 1);
}

addEventListener('keydown', (e) => {
  if (['ArrowRight', 'PageDown', ' '].includes(e.key)) next();
  if (['ArrowLeft', 'PageUp'].includes(e.key)) prev();
  if (e.key === 'Home') show(0);
  if (e.key === 'End') show(slides.length - 1);
  if (e.key.toLowerCase() === 'f') document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
});
addEventListener('click', (e) => { if (!e.target.closest('a')) (e.clientX > innerWidth / 3 ? next : prev)(); });
addEventListener('resize', fit);

fit();
show(location.hash === '#fin' ? slides.length - 1 : (parseInt(location.hash.slice(1), 10) || 1) - 1);
