import { AGENTES, trajeSVG } from './suits.js';
import { lineChart } from './charts.js';
import { STRATEGIES, defaultParams } from './engine/strategies.js';
import { backtest, monteCarlo } from './engine/backtest.js';

const $ = (s) => document.querySelector(s);
const dinero = (v) => '$' + Math.round(v).toLocaleString('es-MX');
const pct = (v, signo = true) => (signo && v > 0 ? '+' : '') + (v * 100).toFixed(1) + '%';
const clase = (v) => (v >= 0 ? 'sube' : 'baja');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let estado, portafolio, precios, bitacora;
let ultimoBacktest = null;

// ───── Reloj ─────
setInterval(() => ($('#reloj').textContent = new Date().toLocaleTimeString('es-MX', { hour12: false })), 1000);

// ───── Botón para despertar a los agentes (abre GitHub Actions del repo) ─────
(function enlaceActions() {
  const m = location.hostname.match(/^([^.]+)\.github\.io$/);
  const repo = location.pathname.split('/').filter(Boolean)[0];
  const btn = $('#btn-despertar');
  if (m && repo) btn.href = `https://github.com/${m[1]}/${repo}/actions/workflows/agentes.yml`;
  else btn.style.display = 'none';
})();

async function cargar(nombre) {
  const r = await fetch(`data/${nombre}.json?v=${Date.now()}`);
  if (!r.ok) throw new Error(`No se encontró data/${nombre}.json`);
  return r.json();
}

async function iniciar() {
  try {
    [estado, portafolio, precios, bitacora] = await Promise.all(['state', 'portfolio', 'prices', 'bitacora'].map(cargar));
  } catch (e) {
    document.querySelector('main').innerHTML = `<div class="monitor" style="margin-top:40px"><p class="vacio">Los agentes aún no han hecho su primera corrida.<br>Ve a GitHub → Actions → “Agentes de la guarida” → Run workflow.<br><small>${esc(e.message)}</small></p></div>`;
    return;
  }
  pintarCabecera();
  pintarMuro();
  pintarVitrinas();
  pintarPosiciones();
  pintarBitacora();
  prepararLaboratorio();
  window.addEventListener('resize', debounce(() => { pintarGraficaPortafolio(); if (ultimoBacktest) pintarBacktest(ultimoBacktest); }, 200));
}

function debounce(fn, ms) { let t; return () => { clearTimeout(t); t = setTimeout(fn, ms); }; }

// ───── Cabecera ─────
function pintarCabecera() {
  const b = $('#badge-datos');
  if (estado.modoDemo) { b.textContent = 'MODO DEMO · DATOS SINTÉTICOS'; b.className = 'badge demo'; }
  else if (estado.fuentes.demo) { b.textContent = `DATOS REALES · ${estado.fuentes.demo} EN DEMO`; b.className = 'badge demo'; }
  else { b.textContent = 'DATOS REALES DE MERCADO'; b.className = 'badge real'; }
  $('#fecha-mercado').textContent = 'Cierre ' + estado.fechaMercado;
  const g = new Date(estado.generado);
  $('#pie-generado').textContent = `Última vez que despertaron los agentes: ${g.toLocaleString('es-MX')}`;
}

// ───── Muro de monitores ─────
function pintarMuro() {
  const h = portafolio.historial;
  const ult = h.at(-1), ant = h.at(-2) ?? ult;
  const eco = estado.agentes.eco.datos;
  $('#valor-total').textContent = dinero(ult.valor);
  const dia = ult.valor / ant.valor - 1;
  $('#valor-sub').innerHTML = `<span class="${clase(dia)}">${pct(dia)} hoy</span> · <span class="${clase(eco.rendimiento)}">${pct(eco.rendimiento)}</span> desde ${portafolio.inicio}`;
  pintarGraficaPortafolio();

  const invertido = ult.valor - portafolio.efectivo;
  const kpis = [
    ['RENDIMIENTO', pct(eco.rendimiento), clase(eco.rendimiento), `Capital inicial ${dinero(portafolio.capitalInicial)}`],
    ['VS MERCADO', pct(eco.rendimiento - eco.rendimientoBenchmark), clase(eco.rendimiento - eco.rendimientoBenchmark), `SPY: ${pct(eco.rendimientoBenchmark)}`],
    ['SHARPE', eco.sharpe.toFixed(2), eco.sharpe >= 1 ? 'sube' : '', 'Rendimiento por unidad de riesgo'],
    ['CAÍDA MÁXIMA', pct(-eco.maxDrawdown), 'baja', 'Peor tramo desde un pico'],
    ['EFECTIVO', dinero(portafolio.efectivo), '', `${pct(portafolio.efectivo / ult.valor, false)} del total`],
    ['INVERTIDO', dinero(invertido), '', `${Object.keys(portafolio.posiciones).length} posiciones`],
  ];
  $('#kpis').innerHTML = kpis.map(([k, v, c, n]) => `<div class="monitor kpi"><div class="k">${k}</div><div class="v ${c}">${v}</div><div class="n">${n}</div></div>`).join('');
}

function pintarGraficaPortafolio() {
  const h = portafolio.historial;
  lineChart($('#chart-portafolio'), {
    etiquetas: h.map((x) => x.fecha.slice(5)),
    series: [
      { label: 'Mercado', values: h.map((x) => x.benchmark), color: 'var(--tenue)', dash: '4 4', width: 1.5 },
      { label: 'Agentes', values: h.map((x) => x.valor), color: 'var(--azul)', width: 2.4 },
    ],
  });
}

// ───── Vitrinas ─────
function resumenAgente(id) {
  return estado.agentes[id] ?? { estado: 'ok', resumen: 'Sin informe todavía.', alertas: [], datos: {} };
}

function pintarVitrinas() {
  $('#vitrinas').innerHTML = AGENTES.map((a) => {
    const inf = resumenAgente(a.id);
    return `<button class="vitrina" style="--c:${a.color}" data-id="${a.id}" data-estado="${inf.estado}" aria-label="Abrir expediente de ${a.nombre}">
      <div class="foco"></div>
      <div class="cristal">${trajeSVG(a)}</div>
      <div class="pedestal"></div>
      <div class="placa">
        <div class="nom"><h3>${a.nombre}</h3><span class="led ${inf.estado === 'ok' ? '' : inf.estado}" title="${inf.estado}"></span></div>
        <div class="rol">${a.rol}</div>
        <div class="res">${esc(inf.resumen)}</div>
      </div>
    </button>`;
  }).join('');
  document.querySelectorAll('.vitrina').forEach((v) => v.addEventListener('click', () => abrirExpediente(v.dataset.id)));
}

function tabla(cols, filas) {
  return `<table><thead><tr>${cols.map((c) => `<th class="${c.num ? 'num' : ''}">${c.t}</th>`).join('')}</tr></thead><tbody>${filas.map((f) => `<tr>${cols.map((c) => `<td class="${c.num ? 'num' : ''}">${c.f(f)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function abrirExpediente(id) {
  const a = AGENTES.find((x) => x.id === id);
  const inf = resumenAgente(id);
  const dlg = $('#expediente');
  dlg.style.setProperty('--c', a.color);
  $('#exp-traje').innerHTML = trajeSVG(a);
  $('#exp-modelo').textContent = a.modelo;
  $('#exp-nombre').textContent = a.nombre;
  $('#exp-rol').textContent = a.rol;
  $('#exp-tarea').textContent = a.tarea;

  let html = `<div class="monitor"><div class="monitor-cab"><span>INFORME DE HOY · ${estado.fechaMercado}</span><span>${inf.estado.toUpperCase()}</span></div><p style="margin:0">${esc(inf.resumen)}</p></div>`;
  if (inf.alertas?.length) html += `<div class="alertas">${inf.alertas.map((t) => `<div>${esc(t)}</div>`).join('')}</div>`;
  const d = inf.datos;

  if (id === 'vigia') {
    html += `<div class="monitor tabla-scroll">${tabla([
      { t: 'Activo', f: (r) => `<b>${r.ticker}</b>` },
      { t: 'Precio', num: 1, f: (r) => '$' + r.precio.toFixed(2) },
      { t: '1 día', num: 1, f: (r) => `<span class="${clase(r.cambio1d)}">${pct(r.cambio1d)}</span>` },
      { t: '20 días', num: 1, f: (r) => `<span class="${clase(r.cambio20d)}">${pct(r.cambio20d)}</span>` },
      { t: '60 días', num: 1, f: (r) => `<span class="${clase(r.cambio60d)}">${pct(r.cambio60d)}</span>` },
      { t: 'RSI', num: 1, f: (r) => r.rsi?.toFixed(0) ?? '—' },
      { t: 'Tendencia', f: (r) => `<span class="chip ${r.tendencia === 'alcista' ? 'ok' : r.tendencia === 'bajista' ? 'no' : 'neutral'}">${r.tendencia}</span>` },
      { t: 'Puntaje', num: 1, f: (r) => `<b class="${clase(r.puntaje)}">${r.puntaje}</b>` },
    ], d.ranking)}</div>`;
  } else if (id === 'bastion') {
    html += `<div class="monitor tabla-scroll">${tabla([
      { t: 'Activo', f: (r) => `<b>${r.ticker}</b>` },
      { t: 'Volatilidad', num: 1, f: (r) => pct(r.volatilidad, false) },
      { t: 'Caída máx 1a', num: 1, f: (r) => pct(-r.maxDrawdown) },
      { t: 'VaR 95% día', num: 1, f: (r) => pct(-r.var95) },
      { t: 'Beta', num: 1, f: (r) => r.beta.toFixed(2) },
      { t: 'Peso máx', f: (r) => `<div class="barra-peso" title="${pct(r.pesoMax, false)}"><i style="width:${(r.pesoMax / estado.config.riesgo.pesoMaximo) * 100}%"></i></div>` },
      { t: 'Veredicto', f: (r) => `<span class="chip ${r.aprobado ? 'ok' : 'no'}">${r.aprobado ? 'aprobado' : 'vetado'}</span>` },
    ], d.activos)}</div>
    <p class="tenue" style="margin:0;font-size:.82rem">Límites: volatilidad máxima ${pct(estado.config.riesgo.volatilidadMaxima, false)}, peso máximo ${pct(estado.config.riesgo.pesoMaximo, false)} por activo, modo defensivo si el portafolio cae ${pct(estado.config.riesgo.drawdownLimite, false)}.</p>`;
  } else if (id === 'oraculo') {
    html += `<div class="monitor tabla-scroll">${tabla([
      { t: 'Activo', f: (r) => `<b>${r.ticker}</b>` },
      { t: 'Mejor estrategia (1 año)', f: (r) => r.nombre },
      { t: 'Sharpe', num: 1, f: (r) => r.sharpe.toFixed(2) },
      { t: 'Rend. backtest', num: 1, f: (r) => `<span class="${clase(r.rendimiento)}">${pct(r.rendimiento)}</span>` },
      { t: 'Señal', f: (r) => `<span class="chip ${r.senal === 'COMPRAR' ? 'compra' : 'neutral'}">${r.senal}</span>` },
    ], d.senales)}</div>`;
  } else if (id === 'martillo') {
    html += `<div class="monitor"><div class="monitor-cab"><span>ÓRDENES DE HOY</span></div>${d.ordenes.length ? tablaOrdenes(d.ordenes) : '<p class="tenue" style="margin:0">No hubo órdenes hoy.</p>'}</div>`;
    html += `<div class="monitor"><div class="monitor-cab"><span>POSICIONES</span><span>Efectivo ${dinero(d.efectivo)}</span></div><div class="tabla-scroll">${tablaPosiciones(d.posiciones)}</div></div>`;
  } else if (id === 'eco') {
    html += `<div class="monitor"><ul style="margin:0;padding-left:18px;line-height:1.6">${d.lineas.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></div>`;
  }
  $('#exp-cuerpo').innerHTML = html;
  dlg.showModal();
}
$('#exp-cerrar').addEventListener('click', () => $('#expediente').close());
$('#expediente').addEventListener('click', (e) => { if (e.target.id === 'expediente') e.target.close(); });

// ───── Posiciones, órdenes y bitácora ─────
function tablaPosiciones(pos) {
  if (!pos.length) return '<p class="tenue">Todo en efectivo.</p>';
  return tabla([
    { t: 'Activo', f: (r) => `<b>${r.ticker}</b>` },
    { t: 'Acciones', num: 1, f: (r) => r.acciones.toFixed(2) },
    { t: 'Costo prom.', num: 1, f: (r) => '$' + r.costoPromedio.toFixed(2) },
    { t: 'Precio', num: 1, f: (r) => '$' + r.precio.toFixed(2) },
    { t: 'Valor', num: 1, f: (r) => dinero(r.valor) },
    { t: 'Peso', num: 1, f: (r) => pct(r.peso, false) },
    { t: 'Ganancia', num: 1, f: (r) => `<span class="${clase(r.ganancia)}">${dinero(r.ganancia)}</span>` },
  ], pos);
}

function tablaOrdenes(ord) {
  return tabla([
    { t: 'Fecha', f: (r) => r.fecha },
    { t: 'Lado', f: (r) => `<span class="chip ${r.lado === 'COMPRA' ? 'compra' : 'venta'}">${r.lado}</span>` },
    { t: 'Activo', f: (r) => `<b>${r.ticker}</b>` },
    { t: 'Acciones', num: 1, f: (r) => r.acciones.toFixed(2) },
    { t: 'Precio', num: 1, f: (r) => '$' + r.precio.toFixed(2) },
    { t: 'Monto', num: 1, f: (r) => dinero(r.monto) },
    { t: 'Resultado', num: 1, f: (r) => (r.ganancia != null ? `<span class="${clase(r.ganancia)}">${dinero(r.ganancia)}</span>` : '—') },
  ], ord);
}

function pintarPosiciones() {
  $('#tabla-posiciones').innerHTML = tablaPosiciones(estado.agentes.martillo.datos.posiciones);
  $('#tabla-ordenes').innerHTML = portafolio.operaciones.length ? tablaOrdenes([...portafolio.operaciones].reverse().slice(0, 80)) : '<p class="tenue">Sin órdenes todavía.</p>';
}

function pintarBitacora() {
  $('#bitacora').innerHTML = bitacora.map((e) => `<div class="entrada"><div class="f">▸ ${e.fecha}</div><ul>${e.lineas.slice(0, 2).map((l) => `<li>${esc(l)}</li>`).join('')}</ul>${e.ordenes.length ? `<div class="ord">${e.ordenes.map((o) => `${o.lado === 'COMPRA' ? '▲' : '▼'} ${o.ticker}`).join('  ')}</div>` : ''}</div>`).join('');
}

// ───── Laboratorio ─────
function prepararLaboratorio() {
  const tickers = Object.keys(precios.series);
  $('#lab-ticker').innerHTML = tickers.map((t) => `<option>${t}</option>`).join('');
  $('#lab-estrategia').innerHTML = Object.entries(STRATEGIES).filter(([id]) => id !== 'buyhold').map(([id, s]) => `<option value="${id}">${s.nombre}</option>`).join('') + `<option value="buyhold">${STRATEGIES.buyhold.nombre}</option>`;
  const pintarParams = () => {
    const id = $('#lab-estrategia').value;
    $('#lab-desc').textContent = STRATEGIES[id].descripcion;
    $('#lab-params').innerHTML = STRATEGIES[id].params.map((p) => `<label>${p.label}<input type="number" data-k="${p.key}" value="${p.default}" min="${p.min}" max="${p.max}"></label>`).join('');
  };
  $('#lab-estrategia').addEventListener('change', () => { pintarParams(); simular(); });
  $('#lab-ticker').addEventListener('change', simular);
  $('#lab-periodo').addEventListener('change', simular);
  $('#form-lab').addEventListener('submit', (e) => { e.preventDefault(); simular(); });
  $('#btn-mc').addEventListener('click', proyectar);
  pintarParams();
  simular();
}

function leerParams() {
  const p = defaultParams($('#lab-estrategia').value);
  document.querySelectorAll('#lab-params input').forEach((i) => { const v = Number(i.value); if (isFinite(v) && v > 0) p[i.dataset.k] = v; });
  return p;
}

function simular() {
  const t = $('#lab-ticker').value;
  const id = $('#lab-estrategia').value;
  const n = Number($('#lab-periodo').value);
  const capital = Math.max(100, Number($('#lab-capital').value) || 10000);
  const comisionPct = Math.max(0, Number($('#lab-comision').value) || 0);
  // Calentamiento: usamos días previos al periodo para que los indicadores ya estén listos
  const total = precios.dates.length;
  const ini = Math.max(0, total - n);
  const calent = Math.max(0, ini - 250);
  const closesAll = precios.series[t].slice(calent);
  const posAll = STRATEGIES[id].signals(closesAll, leerParams());
  const off = ini - calent;
  const dates = precios.dates.slice(ini), closes = closesAll.slice(off), pos = posAll.slice(off);
  const res = backtest(dates, closes, pos, { capital, comisionPct });
  const ref = backtest(dates, closes, closes.map(() => 1), { capital, comisionPct });
  ultimoBacktest = { t, id, dates, res, ref, capital };
  pintarBacktest(ultimoBacktest);
  $('#chart-mc').innerHTML = '<p class="vacio">Presiona “Proyectar futuros” para ver el abanico de resultados posibles con esta estrategia.</p>';
  $('#mc-metricas').innerHTML = '';
}

function pintarBacktest({ t, id, dates, res, ref }) {
  const m = res.metricas, r = ref.metricas;
  $('#lab-titulo').textContent = `RESULTADO · ${STRATEGIES[id].nombre.toUpperCase()} EN ${t} · ${dates[0]} → ${dates.at(-1)}`;
  const met = [
    ['Capital final', dinero(m.capitalFinal), dinero(r.capitalFinal), m.capitalFinal >= r.capitalFinal],
    ['Rendimiento', pct(m.rendimiento), pct(r.rendimiento), m.rendimiento >= r.rendimiento],
    ['Anualizado', pct(m.cagr), pct(r.cagr), m.cagr >= r.cagr],
    ['Sharpe', m.sharpe.toFixed(2), r.sharpe.toFixed(2), m.sharpe >= r.sharpe],
    ['Caída máxima', pct(-m.maxDrawdown), pct(-r.maxDrawdown), m.maxDrawdown <= r.maxDrawdown],
    ['Operaciones', m.operaciones, `aciertos ${pct(m.aciertos, false)}`, null],
    ['Tiempo invertido', pct(m.exposicion, false), '', null],
  ];
  $('#lab-metricas').innerHTML = met.map(([k, v, b, gana]) => `<div class="metrica" style="border-color:${gana == null ? 'var(--panel-borde)' : gana ? 'var(--verde)' : 'var(--rojo)'}"><div class="k">${k}</div><div class="v">${v}</div><div class="b">${gana == null ? b : 'vs ' + b}</div></div>`).join('');
  lineChart($('#chart-lab'), {
    etiquetas: dates.map((d) => d.slice(2)),
    series: [
      { label: 'Comprar y mantener', values: ref.equity, color: 'var(--tenue)', dash: '4 4', width: 1.5 },
      { label: 'Estrategia', values: res.equity, color: 'var(--violeta)', width: 2.4 },
    ],
  });
  $('#lab-trades').innerHTML = res.trades.length ? tabla([
    { t: 'Entrada', f: (x) => x.entrada },
    { t: 'Salida', f: (x) => x.salida ?? '<span class="chip neutral">abierta</span>' },
    { t: 'Precio entrada', num: 1, f: (x) => '$' + x.precioEntrada.toFixed(2) },
    { t: 'Precio salida', num: 1, f: (x) => '$' + x.precioSalida.toFixed(2) },
    { t: 'Resultado', num: 1, f: (x) => `<span class="${clase(x.rendimiento)}">${pct(x.rendimiento)}</span>` },
  ], [...res.trades].reverse()) : '<p class="tenue">La estrategia no operó en este periodo.</p>';
}

function proyectar() {
  if (!ultimoBacktest) simular();
  const { res, capital, id, t } = ultimoBacktest;
  const dias = Number($('#mc-dias').value), caminos = Number($('#mc-caminos').value);
  const btn = $('#btn-mc');
  btn.disabled = true; btn.textContent = '◎ Calculando…';
  setTimeout(() => {
    const mc = monteCarlo(res.equity, { dias, caminos, capital, semilla: Date.now() & 0xffff });
    btn.disabled = false; btn.textContent = '◎ Proyectar futuros';
    $('#mc-metricas').innerHTML = [
      ['Prob. de ganar', pct(mc.probGanancia, false)],
      ['Prob. de perder >20%', pct(mc.probPerdida20, false)],
      ['Escenario típico', dinero(mc.mediana)],
      ['Peor 5%', dinero(mc.peor5)],
      ['Mejor 5%', dinero(mc.mejor5)],
    ].map(([k, v]) => `<div class="metrica"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('');
    lineChart($('#chart-mc'), {
      etiquetas: mc.bandas.p50.map((_, i) => 'Día ' + i),
      bandas: [
        { lo: mc.bandas.p5, hi: mc.bandas.p95, color: '#b18cff', opacity: 0.12 },
        { lo: mc.bandas.p25, hi: mc.bandas.p75, color: '#b18cff', opacity: 0.25 },
      ],
      series: [
        { label: 'Peor 5%', values: mc.bandas.p5, color: 'var(--rojo)', width: 1, dash: '3 3' },
        { label: 'Mediana', values: mc.bandas.p50, color: 'var(--violeta)', width: 2.2 },
        { label: 'Mejor 5%', values: mc.bandas.p95, color: 'var(--verde)', width: 1, dash: '3 3' },
      ],
    });
    $('#chart-mc').insertAdjacentHTML('beforeend', `<p class="tenue" style="font-size:.78rem;margin:8px 0 0">${caminos} futuros posibles para ${STRATEGIES[id].nombre} en ${t}, remuestreando sus rendimientos diarios del periodo simulado.</p>`);
  }, 30);
}

iniciar();
