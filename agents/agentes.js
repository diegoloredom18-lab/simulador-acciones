// Los cinco agentes. Cada uno recibe el contexto del día (solo datos hasta esa fecha)
// y devuelve un informe { estado, resumen, alertas, datos }.
import { sma, rsi, dailyReturns, annualVol, maxDrawdown, currentDrawdown, var95, beta, sharpe } from '../docs/engine/indicators.js';
import { STRATEGIES, defaultParams } from '../docs/engine/strategies.js';
import { backtest } from '../docs/engine/backtest.js';

const clip = (x, a, b) => Math.max(a, Math.min(b, x));
const pct = (x) => `${(x * 100).toFixed(1)}%`;

// ───────────────────────── VIGÍA · Investigación de mercado ─────────────────────────
export function vigia(ctx) {
  const filas = ctx.tickers.map((t) => {
    const c = ctx.closes[t];
    const n = c.length - 1;
    const s20 = sma(c, 20)[n], s50 = sma(c, 50)[n];
    const r = rsi(c, 14)[n];
    const ch = (k) => (n >= k ? c[n] / c[n - k] - 1 : 0);
    const tendencia = s20 && s50 ? (s20 > s50 ? 'alcista' : 'bajista') : 'neutral';
    const puntaje = Math.round(
      (tendencia === 'alcista' ? 35 : tendencia === 'bajista' ? -35 : 0) +
      clip(ch(60) * 150, -35, 35) +
      clip(((r ?? 50) - 50) * 0.6, -30, 30)
    );
    return { ticker: t, precio: c[n], cambio1d: ch(1), cambio20d: ch(20), cambio60d: ch(60), rsi: r, tendencia, puntaje };
  }).sort((a, b) => b.puntaje - a.puntaje);

  const alcistas = filas.filter((f) => f.tendencia === 'alcista').length;
  const alertas = filas.filter((f) => f.rsi > 75 || f.rsi < 25).map((f) => `${f.ticker}: RSI extremo (${f.rsi.toFixed(0)})`);
  return {
    estado: alertas.length ? 'alerta' : 'ok',
    resumen: `${alcistas} de ${filas.length} activos en tendencia alcista. Mejor puntaje: ${filas[0].ticker} (${filas[0].puntaje}).`,
    alertas,
    datos: { ranking: filas },
  };
}

// ───────────────────────── BASTIÓN · Gestión de riesgo ─────────────────────────
export function bastion(ctx) {
  const { riesgo } = ctx.config;
  const ventana = 252;
  const mercado = dailyReturns(ctx.closes[ctx.config.benchmark].slice(-ventana));
  const filas = ctx.tickers.map((t) => {
    const c = ctx.closes[t].slice(-ventana);
    const vol = annualVol(c);
    const rets = dailyReturns(c);
    const aprobado = vol <= riesgo.volatilidadMaxima;
    const pesoMax = aprobado ? clip((riesgo.volatilidadObjetivo / vol) * riesgo.pesoMaximo, 0.02, riesgo.pesoMaximo) : 0;
    return { ticker: t, volatilidad: vol, maxDrawdown: maxDrawdown(c), var95: var95(rets), beta: beta(rets, mercado), aprobado, pesoMax };
  });

  const valores = ctx.portafolio.historial.map((h) => h.valor);
  const ddPortafolio = currentDrawdown(valores);
  const defensivo = ddPortafolio >= riesgo.drawdownLimite;
  const multiplicador = defensivo ? 0.5 : 1;
  const alertas = [];
  if (defensivo) alertas.push(`Portafolio cae ${pct(ddPortafolio)} desde su máximo: MODO DEFENSIVO, exposición al 50%.`);
  filas.filter((f) => !f.aprobado).forEach((f) => alertas.push(`${f.ticker} vetado: volatilidad ${pct(f.volatilidad)}`));

  return {
    estado: defensivo ? 'critico' : alertas.length ? 'alerta' : 'ok',
    resumen: defensivo
      ? `Modo defensivo activado (caída ${pct(ddPortafolio)}).`
      : `${filas.filter((f) => f.aprobado).length} activos aprobados. Caída actual del portafolio: ${pct(ddPortafolio)}.`,
    alertas,
    datos: { activos: filas, drawdownPortafolio: ddPortafolio, defensivo, multiplicador },
  };
}

// ───────────────────────── ORÁCULO · Estrategia y backtesting ─────────────────────────
export function oraculo(ctx, informeVigia) {
  const ventana = 252;
  const puntajes = Object.fromEntries(informeVigia.datos.ranking.map((r) => [r.ticker, r.puntaje]));
  const filas = ctx.tickers.map((t) => {
    const c = ctx.closes[t].slice(-ventana);
    const d = ctx.dates.slice(-ventana);
    let mejor = null;
    for (const [id, st] of Object.entries(STRATEGIES)) {
      const pos = st.signals(c, defaultParams(id));
      const bt = backtest(d, c, pos, { capital: 10000 });
      const cand = { estrategia: id, nombre: st.nombre, sharpe: bt.metricas.sharpe, rendimiento: bt.metricas.rendimiento, posicion: pos[pos.length - 1] };
      if (!mejor || cand.sharpe > mejor.sharpe) mejor = cand;
    }
    let senal = mejor.posicion === 1 ? 'COMPRAR' : 'FUERA';
    let motivo = `${mejor.nombre} (Sharpe ${mejor.sharpe.toFixed(2)})`;
    if (senal === 'COMPRAR' && puntajes[t] < -40) {
      senal = 'FUERA';
      motivo += ' · descartada por Vigía (puntaje muy negativo)';
    }
    return { ticker: t, ...mejor, senal, motivo };
  });
  const compras = filas.filter((f) => f.senal === 'COMPRAR');
  return {
    estado: 'ok',
    resumen: compras.length ? `Señal de compra en ${compras.map((f) => f.ticker).join(', ')}.` : 'Sin señales de compra: recomienda efectivo.',
    alertas: [],
    datos: { senales: filas },
  };
}

// ───────────────────────── MARTILLO · Ejecución de órdenes (simuladas) ─────────────────────────
export function martillo(ctx, informeBastion, informeOraculo) {
  const cfg = ctx.config.ejecucion;
  const port = ctx.portafolio;
  const precio = (t) => ctx.closes[t][ctx.closes[t].length - 1];
  const valorPosiciones = () => Object.entries(port.posiciones).reduce((s, [t, p]) => s + p.acciones * precio(t), 0);
  const total = port.efectivo + valorPosiciones();

  const riesgo = Object.fromEntries(informeBastion.datos.activos.map((a) => [a.ticker, a]));
  const candidatos = informeOraculo.datos.senales.filter((s) => s.senal === 'COMPRAR' && riesgo[s.ticker]?.aprobado);
  const objetivo = {};
  let suma = candidatos.reduce((s, c) => s + riesgo[c.ticker].pesoMax, 0);
  const tope = (1 - cfg.reservaEfectivo) * informeBastion.datos.multiplicador;
  const escala = suma > tope ? tope / suma : informeBastion.datos.multiplicador;
  candidatos.forEach((c) => (objetivo[c.ticker] = riesgo[c.ticker].pesoMax * escala));

  const ordenes = [];
  const todos = new Set([...Object.keys(port.posiciones), ...Object.keys(objetivo)]);
  // Primero ventas (liberan efectivo), luego compras
  const plan = [...todos].map((t) => {
    const actual = (port.posiciones[t]?.acciones ?? 0) * precio(t);
    const meta = (objetivo[t] ?? 0) * total;
    return { t, delta: meta - actual, meta };
  }).filter((p) => Math.abs(p.delta) > cfg.umbralRebalanceo * total || (p.meta === 0 && port.posiciones[p.t]))
    .sort((a, b) => a.delta - b.delta);

  for (const { t, delta, meta } of plan) {
    const p = precio(t);
    if (delta < 0) {
      const pos = port.posiciones[t];
      const vender = meta === 0 ? pos.acciones : Math.min(pos.acciones, -delta / p);
      const fill = p * (1 - cfg.deslizamientoPct / 100);
      const neto = vender * fill * (1 - cfg.comisionPct / 100);
      port.efectivo += neto;
      const ganancia = (fill - pos.costoPromedio) * vender;
      pos.acciones -= vender;
      if (pos.acciones < 1e-6) delete port.posiciones[t];
      ordenes.push({ fecha: ctx.fecha, ticker: t, lado: 'VENTA', acciones: +vender.toFixed(4), precio: +fill.toFixed(2), monto: +neto.toFixed(2), ganancia: +ganancia.toFixed(2), motivo: meta === 0 ? 'Salida por señal/riesgo' : 'Reducir peso' });
    } else {
      const fill = p * (1 + cfg.deslizamientoPct / 100);
      const gasto = Math.min(delta, port.efectivo);
      if (gasto < 1) continue;
      const acciones = gasto / (fill * (1 + cfg.comisionPct / 100));
      const pos = port.posiciones[t] ?? { acciones: 0, costoPromedio: 0 };
      pos.costoPromedio = (pos.costoPromedio * pos.acciones + fill * acciones) / (pos.acciones + acciones);
      pos.acciones += acciones;
      port.posiciones[t] = pos;
      port.efectivo -= gasto;
      ordenes.push({ fecha: ctx.fecha, ticker: t, lado: 'COMPRA', acciones: +acciones.toFixed(4), precio: +fill.toFixed(2), monto: +gasto.toFixed(2), motivo: 'Entrada/aumento por señal' });
    }
  }
  port.operaciones.push(...ordenes);

  const valor = port.efectivo + valorPosiciones();
  const bench = port.benchmarkAcciones * precio(ctx.config.benchmark);
  const ultimo = port.historial[port.historial.length - 1];
  if (ultimo?.fecha === ctx.fecha) port.historial.pop();
  port.historial.push({ fecha: ctx.fecha, valor: +valor.toFixed(2), benchmark: +bench.toFixed(2) });

  const posiciones = Object.entries(port.posiciones).map(([t, p]) => ({
    ticker: t, acciones: p.acciones, costoPromedio: p.costoPromedio, precio: precio(t),
    valor: p.acciones * precio(t), peso: (p.acciones * precio(t)) / valor, ganancia: (precio(t) - p.costoPromedio) * p.acciones,
  })).sort((a, b) => b.valor - a.valor);

  return {
    estado: 'ok',
    resumen: ordenes.length ? `${ordenes.length} órdenes ejecutadas (${ordenes.filter((o) => o.lado === 'COMPRA').length} compras, ${ordenes.filter((o) => o.lado === 'VENTA').length} ventas).` : 'Sin cambios: el portafolio ya está en su objetivo.',
    alertas: [],
    datos: { ordenes, posiciones, efectivo: port.efectivo, valor },
  };
}

// ───────────────────────── ECO · Reportes y bitácora ─────────────────────────
export function eco(ctx, informes) {
  const h = ctx.portafolio.historial;
  const ult = h[h.length - 1], ant = h[h.length - 2] ?? ult, ini = h[0];
  const rend = ult.valor / ctx.portafolio.capitalInicial - 1;
  const rendBench = ult.benchmark / ctx.portafolio.capitalInicial - 1;
  const dia = ult.valor / ant.valor - 1;
  const rets = dailyReturns(h.map((x) => x.valor));
  const lineas = [
    `Valor del portafolio: $${ult.valor.toLocaleString('es-MX', { maximumFractionDigits: 0 })} (${dia >= 0 ? '+' : ''}${pct(dia)} hoy).`,
    `Desde el ${ini.fecha}: ${rend >= 0 ? '+' : ''}${pct(rend)} vs ${rendBench >= 0 ? '+' : ''}${pct(rendBench)} del ${ctx.config.benchmark}. ${rend >= rendBench ? 'Le vamos ganando al mercado.' : 'El mercado nos va ganando.'}`,
    `Vigía: ${informes.vigia.resumen}`,
    `Bastión: ${informes.bastion.resumen}`,
    `Oráculo: ${informes.oraculo.resumen}`,
    `Martillo: ${informes.martillo.resumen}`,
  ];
  const alertas = Object.values(informes).flatMap((i) => i.alertas);
  return {
    estado: alertas.length ? 'alerta' : 'ok',
    resumen: lineas[1],
    alertas: [],
    datos: { lineas, rendimiento: rend, rendimientoBenchmark: rendBench, sharpe: sharpe(rets), maxDrawdown: maxDrawdown(h.map((x) => x.valor)), totalAlertas: alertas.length },
  };
}
