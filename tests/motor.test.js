import test from 'node:test';
import assert from 'node:assert/strict';
import { sma, rsi, maxDrawdown } from '../docs/engine/indicators.js';
import { STRATEGIES, defaultParams } from '../docs/engine/strategies.js';
import { backtest, monteCarlo } from '../docs/engine/backtest.js';

test('sma calcula promedios móviles', () => {
  assert.deepEqual(sma([1, 2, 3, 4], 2), [null, 1.5, 2.5, 3.5]);
});

test('rsi es 100 en una serie que solo sube', () => {
  const r = rsi(Array.from({ length: 30 }, (_, i) => i + 1), 14);
  assert.equal(r.at(-1), 100);
});

test('maxDrawdown mide la peor caída', () => {
  assert.equal(maxDrawdown([100, 120, 90, 130]), 0.25);
});

test('comprar y mantener sigue al precio (menos costos)', () => {
  const closes = [100, 110, 121];
  const dates = ['a', 'b', 'c'];
  const r = backtest(dates, closes, [1, 1, 1], { capital: 1000, comisionPct: 0, deslizPct: 0 });
  // entra al cierre del día 2 (señal del día 1), así que gana 10%
  assert.ok(Math.abs(r.metricas.rendimiento - 0.1) < 1e-9);
});

test('ninguna estrategia mira al futuro: la señal de hoy no cambia si el futuro cambia', () => {
  const base = Array.from({ length: 300 }, (_, i) => 100 + Math.sin(i / 9) * 10 + i * 0.05);
  for (const id of Object.keys(STRATEGIES)) {
    const a = STRATEGIES[id].signals(base.slice(0, 200), defaultParams(id));
    const b = STRATEGIES[id].signals(base, defaultParams(id)).slice(0, 200);
    assert.deepEqual(a, b, id);
  }
});

test('monte carlo devuelve bandas ordenadas', () => {
  const closes = Array.from({ length: 200 }, (_, i) => 100 * (1 + 0.001) ** i * (1 + 0.02 * Math.sin(i)));
  const mc = monteCarlo(closes, { dias: 50, caminos: 200, capital: 1000 });
  const i = 50;
  assert.ok(mc.bandas.p5[i] <= mc.bandas.p50[i] && mc.bandas.p50[i] <= mc.bandas.p95[i]);
});
