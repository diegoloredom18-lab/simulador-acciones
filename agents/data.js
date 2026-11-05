// Obtención de precios históricos.
// Orden: Yahoo Finance (sin llave) -> Alpha Vantage (si hay ALPHA_VANTAGE_KEY) -> datos sintéticos.
import { rng, hashString } from '../docs/engine/indicators.js';

const UA = 'Mozilla/5.0 (compatible; simulador-acciones/1.0)';

async function fromYahoo(ticker, years) {
  let json, ultimoError;
  for (const host of ['query1', 'query2']) {
    try {
      const url = `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${years}y&interval=1d&includeAdjustedClose=true`;
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
      json = await res.json();
      break;
    } catch (e) {
      ultimoError = e;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  if (!json) throw ultimoError;
  const r = json?.chart?.result?.[0];
  if (!r?.timestamp) throw new Error('Yahoo sin datos');
  const adj = r.indicators?.adjclose?.[0]?.adjclose ?? r.indicators?.quote?.[0]?.close;
  const out = [];
  r.timestamp.forEach((t, i) => {
    if (adj[i] != null) out.push([new Date(t * 1000).toISOString().slice(0, 10), +adj[i].toFixed(4)]);
  });
  return out;
}

async function fromAlphaVantage(ticker) {
  const key = process.env.ALPHA_VANTAGE_KEY;
  if (!key) throw new Error('sin ALPHA_VANTAGE_KEY');
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(ticker)}&outputsize=compact&apikey=${key}`;
  const res = await fetch(url);
  const json = await res.json();
  const series = json['Time Series (Daily)'];
  if (!series) throw new Error('Alpha Vantage: ' + (json.Note || json.Information || 'sin datos'));
  return Object.entries(series)
    .map(([d, v]) => [d, +(+v['4. close']).toFixed(4)])
    .sort((a, b) => a[0].localeCompare(b[0]));
}

// Precios sintéticos realistas (caminata aleatoria geométrica) para modo demo o sin internet.
export function synthetic(ticker, years = 2, endDate = new Date()) {
  const r = rng(hashString(ticker));
  const drift = 0.04 + r() * 0.16; // 4%–20% anual
  const vol = ticker === 'SPY' ? 0.17 : 0.2 + r() * 0.35;
  const days = [];
  const d = new Date(endDate);
  while (days.length < years * 252) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) days.unshift(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() - 1);
  }
  let p = 20 + r() * 300;
  const dt = 1 / 252;
  return days.map((day) => {
    const z = Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());
    p *= Math.exp((drift - vol * vol / 2) * dt + vol * Math.sqrt(dt) * z);
    return [day, +p.toFixed(2)];
  });
}

export async function fetchHistory(ticker, { years = 2, modo = 'auto' } = {}) {
  if (modo === 'demo') return { serie: synthetic(ticker, years), fuente: 'demo' };
  const errores = [];
  for (const [fuente, fn] of [['yahoo', () => fromYahoo(ticker, years)], ['alphavantage', () => fromAlphaVantage(ticker)]]) {
    try {
      const serie = await fn();
      if (serie.length > 30) return { serie, fuente };
    } catch (e) {
      errores.push(`${fuente}: ${e.message}`);
    }
  }
  console.warn(`[datos] ${ticker}: usando datos demo (${errores.join(' | ')})`);
  return { serie: synthetic(ticker, years), fuente: 'demo' };
}

// Alinea todas las series al calendario del índice de referencia, rellenando huecos con el último precio.
export function alignToBenchmark(raw, benchmark) {
  const dates = raw[benchmark].map((x) => x[0]);
  const series = {};
  for (const [t, serie] of Object.entries(raw)) {
    const map = new Map(serie);
    let last = serie[0]?.[1] ?? null;
    series[t] = dates.map((d) => {
      if (map.has(d)) last = map.get(d);
      return last;
    });
    // Recorta valores nulos iniciales copiando el primer precio conocido
    const first = series[t].find((v) => v != null);
    series[t] = series[t].map((v) => v ?? first);
  }
  return { dates, series };
}
