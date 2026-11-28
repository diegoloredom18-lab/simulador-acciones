// Motor de simulación: backtest de una estrategia y proyección Monte Carlo.
import { dailyReturns, sharpe, maxDrawdown, cagr, rng, mean, stdev } from './indicators.js';

/**
 * Ejecuta un backtest de una sola acción.
 * La señal del día i se ejecuta al cierre del día i+1 (sin mirar al futuro).
 */
export function backtest(dates, closes, positions, opts = {}) {
  const capital = opts.capital ?? 10000;
  const comision = (opts.comisionPct ?? 0.1) / 100;
  const desliz = (opts.deslizPct ?? 0.05) / 100;

  let cash = capital, shares = 0, entryPrice = 0, entryDate = null;
  const equity = [], trades = [];
  let diasDentro = 0;

  for (let i = 0; i < closes.length; i++) {
    const price = closes[i];
    const want = i > 0 ? positions[i - 1] : 0;
    if (want === 1 && shares === 0) {
      const fill = price * (1 + desliz);
      shares = cash / (fill * (1 + comision));
      cash -= shares * fill * (1 + comision);
      entryPrice = fill;
      entryDate = dates[i];
    } else if (want === 0 && shares > 0) {
      const fill = price * (1 - desliz);
      cash += shares * fill * (1 - comision);
      trades.push({ entrada: entryDate, salida: dates[i], precioEntrada: entryPrice, precioSalida: fill, rendimiento: fill * (1 - comision) / (entryPrice * (1 + comision)) - 1 });
      shares = 0;
    }
    if (shares > 0) diasDentro++;
    equity.push(cash + shares * price);
  }
  if (shares > 0) {
    const last = closes[closes.length - 1];
    trades.push({ entrada: entryDate, salida: null, precioEntrada: entryPrice, precioSalida: last, rendimiento: last / (entryPrice * (1 + comision)) - 1, abierta: true });
  }

  const rets = dailyReturns(equity);
  const final = equity[equity.length - 1] ?? capital;
  const cerradas = trades.filter((t) => !t.abierta);
  return {
    equity,
    trades,
    metricas: {
      capitalInicial: capital,
      capitalFinal: final,
      rendimiento: final / capital - 1,
      cagr: cagr(capital, final, closes.length),
      sharpe: sharpe(rets),
      maxDrawdown: maxDrawdown(equity),
      operaciones: trades.length,
      aciertos: cerradas.length ? cerradas.filter((t) => t.rendimiento > 0).length / cerradas.length : 0,
      exposicion: closes.length ? diasDentro / closes.length : 0,
    },
  };
}

/**
 * Monte Carlo por remuestreo (bootstrap) de rendimientos diarios históricos.
 * Devuelve percentiles del valor del portafolio para cada día futuro.
 */
export function monteCarlo(closes, { dias = 252, caminos = 500, capital = 10000, semilla = 42 } = {}) {
  const rets = dailyReturns(closes);
  const rand = rng(semilla);
  const finales = [];
  const porDia = Array.from({ length: dias + 1 }, () => []);
  for (let c = 0; c < caminos; c++) {
    let v = capital;
    porDia[0].push(v);
    for (let d = 1; d <= dias; d++) {
      v *= 1 + rets[Math.floor(rand() * rets.length)];
      porDia[d].push(v);
    }
    finales.push(v);
  }
  const pct = (arr, p) => {
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor(p * s.length))];
  };
  const bandas = { p5: [], p25: [], p50: [], p75: [], p95: [] };
  for (const arr of porDia) {
    bandas.p5.push(pct(arr, 0.05));
    bandas.p25.push(pct(arr, 0.25));
    bandas.p50.push(pct(arr, 0.5));
    bandas.p75.push(pct(arr, 0.75));
    bandas.p95.push(pct(arr, 0.95));
  }
  return {
    bandas,
    probGanancia: finales.filter((v) => v > capital).length / finales.length,
    probPerdida20: finales.filter((v) => v < capital * 0.8).length / finales.length,
    mediana: pct(finales, 0.5),
    peor5: pct(finales, 0.05),
    mejor5: pct(finales, 0.95),
    rendimientoDiarioMedio: mean(rets),
    volDiaria: stdev(rets),
  };
}
