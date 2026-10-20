import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../engine/types';
import { routeEvent } from './route';
import type { Sfx } from './sfx';

const spy = () => {
  const calls: string[] = [];
  const rec = (name: string) => (...args: unknown[]) => calls.push(args.length ? `${name}(${args.join(',')})` : name);
  const sfx: Sfx = {
    onDotEaten: rec('onDotEaten'),
    onPowerDot: rec('onPowerDot'),
    onGhostEaten: rec('onGhostEaten'),
    onDeath: rec('onDeath'),
    onRoundClear: rec('onRoundClear'),
    onGameOver: rec('onGameOver'),
    onTap: rec('onTap'),
    setFrightened: rec('setFrightened'),
  };
  return { calls, sfx };
};

describe('routeEvent', () => {
  it.each<[GameEvent, string[]]>([
    [{ type: 'orbe', tile: 3 }, ['onDotEaten']],
    [{ type: 'especial', tile: 3 }, ['onPowerDot']],
    [{ type: 'fantasmaComido', ghostId: 1, points: 400, pos: { x: 1, y: 2 } }, ['onGhostEaten(400)']],
    [{ type: 'muerte', pos: { x: 1, y: 2 } }, ['onDeath']],
    [{ type: 'rondaLimpia', round: 2 }, ['onRoundClear']],
    [{ type: 'finPartida', score: 900 }, ['onGameOver']],
    [{ type: 'inicio' }, []],
  ])('%o → %o', (event, expected) => {
    const { calls, sfx } = spy();
    routeEvent(event, sfx);
    expect(calls).toEqual(expected);
  });
});
