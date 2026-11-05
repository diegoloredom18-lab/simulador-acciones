// Orquestador: despierta a los agentes en orden y guarda sus informes para el panel.
// Uso:
//   node agents/run.js              -> corrida diaria normal
//   node agents/run.js --reset      -> borra el portafolio y lo reconstruye con 120 días de historia
//   node agents/run.js --demo       -> usa datos sintéticos (sin internet)
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { fetchHistory, alignToBenchmark } from './data.js';
import { vigia, bastion, oraculo, martillo, eco } from './agentes.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'docs', 'data');
const args = new Set(process.argv.slice(2));
const DIAS_RECONSTRUCCION = 120;
const MIN_HISTORIA = 260; // los agentes necesitan ~1 año de datos para opinar

const readJson = async (f, fallback) => (existsSync(f) ? JSON.parse(await readFile(f, 'utf8')) : fallback);

function nuevoPortafolio(config, fecha, precioBench) {
  return {
    capitalInicial: config.capitalInicial,
    inicio: fecha,
    efectivo: config.capitalInicial,
    posiciones: {},
    operaciones: [],
    historial: [],
    benchmarkAcciones: config.capitalInicial / precioBench,
  };
}

function correrDia(config, dates, series, idx, portafolio) {
  const tickers = config.watchlist;
  const closes = Object.fromEntries(tickers.map((t) => [t, series[t].slice(0, idx + 1)]));
  const ctx = { config, tickers, dates: dates.slice(0, idx + 1), closes, fecha: dates[idx], portafolio };
  const informes = {};
  informes.vigia = vigia(ctx);
  informes.bastion = bastion(ctx);
  informes.oraculo = oraculo(ctx, informes.vigia);
  informes.martillo = martillo(ctx, informes.bastion, informes.oraculo);
  informes.eco = eco(ctx, informes);
  return informes;
}

async function main() {
  const config = JSON.parse(await readFile(path.join(ROOT, 'config.json'), 'utf8'));
  await mkdir(DATA, { recursive: true });

  if (!config.watchlist.includes(config.benchmark)) config.watchlist.unshift(config.benchmark);
  const modo = args.has('--demo') ? 'demo' : 'auto';

  console.log(`[orquestador] Descargando ${config.watchlist.length} activos (modo ${modo})…`);
  const raw = {}, fuentes = {};
  for (const t of config.watchlist) {
    const { serie, fuente } = await fetchHistory(t, { years: config.aniosHistoria, modo });
    raw[t] = serie;
    fuentes[t] = fuente;
  }
  // Si el índice de referencia no es real, todo pasa a demo para que las fechas cuadren
  const { dates, series } = alignToBenchmark(raw, config.benchmark);
  const last = dates.length - 1;
  if (last < MIN_HISTORIA) throw new Error(`Muy poca historia (${dates.length} días). Revisa la fuente de datos.`);

  const portFile = path.join(DATA, 'portfolio.json');
  let portafolio = args.has('--reset') ? null : await readJson(portFile, null);
  let informes;
  const dias = [];
  const registrar = (i) => {
    informes = correrDia(config, dates, series, i, portafolio);
    dias.push({ fecha: dates[i], lineas: informes.eco.datos.lineas, ordenes: informes.martillo.datos.ordenes });
  };

  if (!portafolio) {
    const inicio = Math.max(MIN_HISTORIA, last - DIAS_RECONSTRUCCION);
    console.log(`[orquestador] Portafolio nuevo: reconstruyendo desde ${dates[inicio]}…`);
    portafolio = nuevoPortafolio(config, dates[inicio], series[config.benchmark][inicio]);
    for (let i = inicio; i <= last; i++) registrar(i);
  } else {
    // Ponerse al día con cada sesión que haya pasado desde la última corrida
    const ultimaFecha = portafolio.historial.at(-1)?.fecha;
    let desde = dates.findIndex((d) => d > ultimaFecha);
    if (desde === -1) desde = last; // mismo día: recalcula la última sesión
    for (let i = desde; i <= last; i++) registrar(i);
  }

  const conteo = Object.values(fuentes).reduce((a, f) => ((a[f] = (a[f] ?? 0) + 1), a), {});
  const estado = {
    generado: new Date().toISOString(),
    fechaMercado: dates[last],
    fuentes: conteo,
    modoDemo: (conteo.demo ?? 0) === config.watchlist.length,
    config,
    agentes: informes,
  };

  // Precios para el laboratorio de simulación del navegador
  const precios = { dates, series: Object.fromEntries(Object.entries(series).map(([t, s]) => [t, s.map((v) => +v.toFixed(2))])) };

  // Bitácora: últimos 60 reportes del cronista
  const bitacoraFile = path.join(DATA, 'bitacora.json');
  const bitacora = args.has('--reset') ? [] : await readJson(bitacoraFile, []);
  for (const d of dias) {
    if (bitacora[0]?.fecha === d.fecha) bitacora.shift();
    bitacora.unshift(d);
  }

  await writeFile(path.join(DATA, 'state.json'), JSON.stringify(estado, null, 1));
  await writeFile(path.join(DATA, 'prices.json'), JSON.stringify(precios));
  await writeFile(portFile, JSON.stringify(portafolio, null, 1));
  await writeFile(bitacoraFile, JSON.stringify(bitacora.slice(0, 60), null, 1));

  console.log('[orquestador] Listo.');
  informes.eco.datos.lineas.forEach((l) => console.log('  · ' + l));
}

main().catch((e) => {
  console.error('[orquestador] Error:', e);
  process.exit(1);
});
