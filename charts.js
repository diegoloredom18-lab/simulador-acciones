// Gráficas SVG ligeras, sin librerías. Con cursor que muestra valores al pasar el mouse.

const NS = 'http://www.w3.org/2000/svg';
const fmtDinero = (v) => '$' + Math.round(v).toLocaleString('es-MX');

function escala(min, max, a, b) {
  const d = max - min || 1;
  return (v) => a + ((v - min) / d) * (b - a);
}

function ticks(min, max, n = 4) {
  const paso = (max - min) / n;
  return Array.from({ length: n + 1 }, (_, i) => min + paso * i);
}

/**
 * series: [{ label, values, color, dash?, width? }]
 * bandas: [{ lo:[], hi:[], color, opacity }]  (opcional, para Monte Carlo)
 * etiquetas: arreglo de textos del eje X (fechas o días)
 */
export function lineChart(el, { series = [], bandas = [], etiquetas = [], fmt = fmtDinero, alto = 260 }) {
  el.innerHTML = '';
  const ancho = Math.max(el.clientWidth || 600, 280);
  const m = { t: 12, r: 12, b: 26, l: 64 };
  const todos = [...series.flatMap((s) => s.values), ...bandas.flatMap((b) => [...b.lo, ...b.hi])].filter((v) => v != null && isFinite(v));
  if (!todos.length) return;
  let min = Math.min(...todos), max = Math.max(...todos);
  const pad = (max - min) * 0.06 || 1;
  min -= pad; max += pad;
  const n = Math.max(...series.map((s) => s.values.length), ...bandas.map((b) => b.lo.length));
  const x = escala(0, n - 1, m.l, ancho - m.r);
  const y = escala(min, max, alto - m.b, m.t);

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${ancho} ${alto}`);
  svg.setAttribute('class', 'chart');
  let html = '';
  for (const v of ticks(min, max)) {
    html += `<line x1="${m.l}" x2="${ancho - m.r}" y1="${y(v)}" y2="${y(v)}" class="grid"/>`;
    html += `<text x="${m.l - 8}" y="${y(v) + 4}" class="axis" text-anchor="end">${fmt(v)}</text>`;
  }
  const nx = Math.min(5, n);
  for (let i = 0; i < nx; i++) {
    const idx = Math.round((i / Math.max(1, nx - 1)) * (n - 1));
    const lbl = etiquetas[idx] ?? idx;
    html += `<text x="${x(idx)}" y="${alto - 8}" class="axis" text-anchor="${i === 0 ? 'start' : i === nx - 1 ? 'end' : 'middle'}">${lbl}</text>`;
  }
  for (const b of bandas) {
    const top = b.hi.map((v, i) => `${x(i)},${y(v)}`).join(' ');
    const bot = b.lo.map((v, i) => `${x(i)},${y(v)}`).reverse().join(' ');
    html += `<polygon points="${top} ${bot}" fill="${b.color}" opacity="${b.opacity ?? 0.2}"/>`;
  }
  for (const s of series) {
    const pts = s.values.map((v, i) => (v == null ? null : `${x(i)},${y(v)}`)).filter(Boolean).join(' ');
    html += `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="${s.width ?? 2}" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''} stroke-linejoin="round"/>`;
  }
  html += `<line class="cursor" y1="${m.t}" y2="${alto - m.b}" x1="-10" x2="-10"/>`;
  svg.innerHTML = html;
  el.appendChild(svg);

  const tip = document.createElement('div');
  tip.className = 'tip';
  el.appendChild(tip);
  const cursor = svg.querySelector('.cursor');
  const mover = (ev) => {
    const r = svg.getBoundingClientRect();
    const px = ((ev.clientX - r.left) / r.width) * ancho;
    const i = Math.round(((px - m.l) / (ancho - m.l - m.r)) * (n - 1));
    if (i < 0 || i >= n) return salir();
    cursor.setAttribute('x1', x(i)); cursor.setAttribute('x2', x(i));
    tip.innerHTML = `<b>${etiquetas[i] ?? 'Día ' + i}</b>` + series.map((s) => `<span><i style="background:${s.color}"></i>${s.label}: ${s.values[i] != null ? fmt(s.values[i]) : '—'}</span>`).join('');
    tip.style.display = 'block';
    const left = (x(i) / ancho) * r.width;
    tip.style.left = Math.min(left + 12, r.width - tip.offsetWidth - 4) + 'px';
  };
  const salir = () => { tip.style.display = 'none'; cursor.setAttribute('x1', -10); cursor.setAttribute('x2', -10); };
  svg.addEventListener('pointermove', mover);
  svg.addEventListener('pointerleave', salir);
}
