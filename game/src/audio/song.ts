// La canción del juego, como dato (igual que el laberinto vive en maze.ts). El tempo vive en rules.ts.
//
// Melodía original compuesta para Polka-Man; no copia ni aproxima el tema de Pac-Man ni otra música de juegos.
//
// La menor, 8 compases de 8 corcheas (64 pasos). Lead en square, bajo en triangle (negras raíz-quinta:
// Am G Am Dm F G Am E) y percusión con ruido: golpe grave en 1 y 3, hat en los contratiempos. En el susto
// se toca más rápido (MUSIC_FRIGHT_BPM) y con hat en cada corchea.

/** Pasos del bucle (corcheas). */
export const SONG_STEPS = 64;

/** Corcheas por compás. */
export const STEPS_PER_BAR = 8;

export type SongVariant = 'normal' | 'susto';

/** Lead, un compás por línea; `.` = silencio (la nota anterior sigue sonando). */
const LEAD_TEXT = [
  'A4 . C5 E5 . D5 C5 .',
  'B4 . G4 B4 D5 . C5 B4',
  'A4 . C5 E5 . G5 F5 E5',
  'D5 . . F5 E5 D5 C5 .',
  'F4 . A4 C5 . B4 A4 .',
  'G4 . B4 D5 . C5 B4 G4',
  'A4 C5 E5 A5 . G5 E5 C5',
  'D5 . B4 . E5 . . .',
];

/** Raíz y quinta del bajo de cada compás. */
const BASS_CHORDS: ReadonlyArray<readonly [string, string]> = [
  ['A2', 'E3'], // Am
  ['G2', 'D3'], // G
  ['A2', 'E3'], // Am
  ['D2', 'A2'], // Dm
  ['F2', 'C3'], // F
  ['G2', 'D3'], // G
  ['A2', 'E3'], // Am
  ['E2', 'B2'], // E
];

const parse = (bar: string) => bar.split(' ').map((n) => (n === '.' ? null : n));

/** Una nota (o null) por paso. */
export const LEAD: ReadonlyArray<string | null> = LEAD_TEXT.flatMap(parse);

/** Bajo: una negra (2 pasos) en cada tiempo, alternando raíz y quinta. */
export const BASS: ReadonlyArray<string | null> = BASS_CHORDS.flatMap(([root, fifth]) => [
  root, null, fifth, null, root, null, fifth, null,
]);

/** Pasos que dura la nota del lead que empieza en `step` (ella más los silencios que la siguen). */
export function leadLength(step: number): number {
  let n = 1;
  while (step + n < SONG_STEPS && LEAD[step + n] === null && n < STEPS_PER_BAR) n++;
  return n;
}

/** Percusión del paso: golpe grave en los tiempos 1 y 3; hat en contratiempos (o en cada corchea en el susto). */
export function drumsAt(step: number, variant: SongVariant): { kick: boolean; hat: boolean } {
  const inBar = step % STEPS_PER_BAR;
  const kick = inBar === 0 || inBar === 4;
  const hat = variant === 'susto' ? true : inBar % 2 === 1;
  return { kick, hat };
}

const SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** «A4» → 440 Hz (afinación igual, La4 = 440). Admite sostenido (#) y bemol (b). */
export function noteToHz(note: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(note);
  if (!m) throw new Error(`Nota inválida: ${note}`);
  const semitone = SEMITONES[m[1]!]! + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  const midi = (Number(m[3]) + 1) * 12 + semitone;
  return 440 * 2 ** ((midi - 69) / 12);
}
