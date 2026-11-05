// Estrategias de trading. Cada una devuelve un arreglo de posiciones (0 = fuera, 1 = dentro)
// calculado SOLO con información hasta ese día. El backtest ejecuta al cierre del día siguiente.
import { sma, rsi } from './indicators.js';

export const STRATEGIES = {
  buyhold: {
    nombre: 'Comprar y mantener',
    descripcion: 'Compra el primer día y no vende nunca. Es la referencia a vencer.',
    params: [],
    signals: (closes) => closes.map(() => 1),
  },
  smaCross: {
    nombre: 'Cruce de medias',
    descripcion: 'Dentro cuando la media rápida está por encima de la lenta (sigue la tendencia).',
    params: [
      { key: 'rapida', label: 'Media rápida (días)', default: 20, min: 2, max: 100 },
      { key: 'lenta', label: 'Media lenta (días)', default: 50, min: 5, max: 250 },
    ],
    signals: (closes, p) => {
      const f = sma(closes, p.rapida), s = sma(closes, p.lenta);
      return closes.map((_, i) => (f[i] !== null && s[i] !== null && f[i] > s[i] ? 1 : 0));
    },
  },
  rsiReversion: {
    nombre: 'Reversión RSI',
    descripcion: 'Compra cuando el RSI marca sobreventa y vende cuando marca sobrecompra.',
    params: [
      { key: 'periodo', label: 'Periodo RSI', default: 14, min: 2, max: 50 },
      { key: 'compra', label: 'Comprar si RSI <', default: 30, min: 5, max: 50 },
      { key: 'venta', label: 'Vender si RSI >', default: 70, min: 50, max: 95 },
    ],
    signals: (closes, p) => {
      const r = rsi(closes, p.periodo);
      let pos = 0;
      return r.map((v) => {
        if (v !== null) {
          if (pos === 0 && v < p.compra) pos = 1;
          else if (pos === 1 && v > p.venta) pos = 0;
        }
        return pos;
      });
    },
  },
  momentum: {
    nombre: 'Momentum',
    descripcion: 'Dentro mientras el rendimiento de los últimos N días sea positivo.',
    params: [{ key: 'ventana', label: 'Ventana (días)', default: 60, min: 5, max: 250 }],
    signals: (closes, p) =>
      closes.map((c, i) => (i >= p.ventana && c / closes[i - p.ventana] - 1 > 0 ? 1 : 0)),
  },
  breakout: {
    nombre: 'Ruptura de máximos',
    descripcion: 'Compra al romper el máximo de N días y sale al perder el mínimo de N/2 días.',
    params: [{ key: 'ventana', label: 'Ventana (días)', default: 40, min: 5, max: 200 }],
    signals: (closes, p) => {
      const n = p.ventana, m = Math.max(2, Math.round(n / 2));
      let pos = 0;
      return closes.map((c, i) => {
        if (i >= n) {
          const hi = Math.max(...closes.slice(i - n, i));
          const lo = Math.min(...closes.slice(i - m, i));
          if (pos === 0 && c > hi) pos = 1;
          else if (pos === 1 && c < lo) pos = 0;
        }
        return pos;
      });
    },
  },
};

export function defaultParams(id) {
  const p = {};
  for (const x of STRATEGIES[id].params) p[x.key] = x.default;
  return p;
}
