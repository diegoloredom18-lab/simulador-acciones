// Indicadores y métricas. Funciona igual en el navegador y en Node (agentes).

export const DIAS_ANIO = 252;

export function sma(values, n) {
  const out = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= n) sum -= values[i - n];
    if (i >= n - 1) out[i] = sum / n;
  }
  return out;
}

export function ema(values, n) {
  const out = new Array(values.length).fill(null);
  const k = 2 / (n + 1);
  let prev = null;
  for (let i = 0; i < values.length; i++) {
    if (i === n - 1) {
      prev = values.slice(0, n).reduce((a, b) => a + b, 0) / n;
      out[i] = prev;
    } else if (i >= n) {
      prev = values[i] * k + prev * (1 - k);
      out[i] = prev;
    }
  }
  return out;
}

// RSI de Wilder
export function rsi(values, n = 14) {
  const out = new Array(values.length).fill(null);
  if (values.length <= n) return out;
  let gain = 0, loss = 0;
  for (let i = 1; i <= n; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  gain /= n; loss /= n;
  out[n] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  for (let i = n + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    gain = (gain * (n - 1) + Math.max(d, 0)) / n;
    loss = (loss * (n - 1) + Math.max(-d, 0)) / n;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

export function dailyReturns(values) {
  const r = [];
  for (let i = 1; i < values.length; i++) r.push(values[i] / values[i - 1] - 1);
  return r;
}

export function mean(a) {
  return a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
}

export function stdev(a) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
}

export function annualVol(values) {
  return stdev(dailyReturns(values)) * Math.sqrt(DIAS_ANIO);
}

export function sharpe(returns) {
  const s = stdev(returns);
  return s === 0 ? 0 : (mean(returns) / s) * Math.sqrt(DIAS_ANIO);
}

// Máxima caída desde un pico, como fracción positiva (0.25 = -25%)
export function maxDrawdown(series) {
  let peak = -Infinity, mdd = 0;
  for (const v of series) {
    if (v > peak) peak = v;
    if (peak > 0) mdd = Math.max(mdd, (peak - v) / peak);
  }
  return mdd;
}

export function currentDrawdown(series) {
  if (!series.length) return 0;
  const peak = Math.max(...series);
  return peak > 0 ? (peak - series[series.length - 1]) / peak : 0;
}

// VaR histórico al 95% de un día, como pérdida positiva
export function var95(returns) {
  if (returns.length < 20) return 0;
  const s = [...returns].sort((a, b) => a - b);
  return -s[Math.floor(s.length * 0.05)];
}

export function beta(returns, marketReturns) {
  const n = Math.min(returns.length, marketReturns.length);
  const a = returns.slice(-n), b = marketReturns.slice(-n);
  const ma = mean(a), mb = mean(b);
  let cov = 0, varb = 0;
  for (let i = 0; i < n; i++) {
    cov += (a[i] - ma) * (b[i] - mb);
    varb += (b[i] - mb) ** 2;
  }
  return varb === 0 ? 0 : cov / varb;
}

export function cagr(startValue, endValue, days) {
  if (startValue <= 0 || days <= 0) return 0;
  return (endValue / startValue) ** (DIAS_ANIO / days) - 1;
}

// Generador pseudoaleatorio con semilla (para simulaciones reproducibles)
export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
