// Trajes blindados originales, uno por agente. SVG generado en código.
// Cada traje comparte una base humanoide y cambia casco, hombreras, emblema y accesorios.

export const AGENTES = [
  {
    id: 'vigia', nombre: 'VIGÍA', modelo: 'MK-01 · Reconocimiento', rol: 'Investigación de mercado',
    tarea: 'Escanea cada activo de la lista: tendencia (medias de 20 y 50 días), momentum de 60 días y RSI. Asigna un puntaje de -100 a +100 y arma el ranking del día.',
    color: '#5cc8ff', variante: 'explorador',
  },
  {
    id: 'bastion', nombre: 'BASTIÓN', modelo: 'MK-02 · Blindaje pesado', rol: 'Gestión de riesgo',
    tarea: 'Mide volatilidad, caída máxima, VaR 95% y beta de cada activo. Veta los demasiado volátiles, fija el peso máximo de cada uno y activa el modo defensivo si el portafolio cae demasiado.',
    color: '#ffb547', variante: 'tanque',
  },
  {
    id: 'oraculo', nombre: 'ORÁCULO', modelo: 'MK-03 · Inteligencia táctica', rol: 'Estrategia y backtesting',
    tarea: 'Prueba cinco estrategias sobre el último año de cada activo, elige la de mejor Sharpe y emite la señal: COMPRAR o FUERA. Descarta señales que contradicen al Vigía.',
    color: '#b18cff', variante: 'capa',
  },
  {
    id: 'martillo', nombre: 'MARTILLO', modelo: 'MK-04 · Asalto', rol: 'Ejecución de órdenes',
    tarea: 'Convierte señales y límites de riesgo en órdenes simuladas: calcula el peso objetivo de cada posición, guarda una reserva de efectivo y rebalancea con comisión y deslizamiento.',
    color: '#ff5d6c', variante: 'asalto',
  },
  {
    id: 'eco', nombre: 'ECO', modelo: 'MK-05 · Comunicaciones', rol: 'Reportes y bitácora',
    tarea: 'Reúne lo que hicieron los demás, compara el portafolio contra el mercado (SPY), calcula Sharpe y caída máxima, y escribe la bitácora diaria.',
    color: '#3ddc97', variante: 'antena',
  },
];

const METAL = '#1b232c', METAL2 = '#2a3540', BORDE = '#3c4a57';

function casco(v, c) {
  const base = `<path d="M44 20 Q60 6 76 20 L78 40 Q60 50 42 40 Z" fill="${METAL2}" stroke="${BORDE}" stroke-width="1"/>`;
  const visores = {
    explorador: `<path d="M45 28 L75 28 L73 35 L47 35 Z" fill="${c}" class="visor"/><rect x="58" y="2" width="4" height="16" rx="1" fill="${METAL2}" stroke="${BORDE}"/><circle cx="60" cy="3" r="2" fill="${c}" class="visor"/>`,
    tanque: `<path d="M41 18 Q60 2 79 18 L81 42 Q60 54 39 42 Z" fill="${METAL2}" stroke="${BORDE}"/><rect x="47" y="29" width="26" height="4" rx="1" fill="${c}" class="visor"/><path d="M50 38 h20" stroke="${BORDE}" stroke-width="2"/>`,
    capa: `<path d="M38 42 Q36 12 60 6 Q84 12 82 42 Q60 30 38 42 Z" fill="#141a21" stroke="${BORDE}"/><circle cx="53" cy="30" r="3" fill="${c}" class="visor"/><circle cx="67" cy="30" r="3" fill="${c}" class="visor"/>`,
    asalto: `<path d="M46 31 L60 36 L74 31 L72 27 L60 31 L48 27 Z" fill="${c}" class="visor"/><path d="M44 20 L36 12 L46 16 Z M76 20 L84 12 L74 16 Z" fill="${METAL2}" stroke="${BORDE}"/>`,
    antena: `<ellipse cx="60" cy="30" rx="12" ry="4" fill="${c}" class="visor"/><path d="M42 26 L34 24 L34 36 L42 34 Z M78 26 L86 24 L86 36 L78 34 Z" fill="${METAL2}" stroke="${BORDE}"/><path d="M34 24 L30 8" stroke="${BORDE}" stroke-width="2"/><circle cx="30" cy="7" r="2.5" fill="${c}" class="visor"/>`,
  };
  return base + visores[v];
}

function emblema(v, c) {
  const e = {
    explorador: `<path d="M60 72 L68 82 L60 92 L52 82 Z" fill="none" stroke="${c}" stroke-width="2.5"/><circle cx="60" cy="82" r="2.5" fill="${c}"/>`,
    tanque: `<path d="M50 72 H70 V84 Q60 96 50 84 Z" fill="none" stroke="${c}" stroke-width="2.5"/><path d="M60 75 V90" stroke="${c}" stroke-width="2"/>`,
    capa: `<circle cx="60" cy="82" r="9" fill="none" stroke="${c}" stroke-width="2.5"/><circle cx="60" cy="82" r="3" fill="${c}"/>`,
    asalto: `<path d="M50 76 L60 84 L70 76 M50 84 L60 92 L70 84" fill="none" stroke="${c}" stroke-width="2.5"/>`,
    antena: `<path d="M52 88 Q60 70 68 88 M48 92 Q60 62 72 92" fill="none" stroke="${c}" stroke-width="2.2"/><circle cx="60" cy="88" r="2.5" fill="${c}"/>`,
  };
  return `<g class="nucleo">${e[v]}</g>`;
}

export function trajeSVG(agente) {
  const { variante: v, color: c } = agente;
  const anchoHombro = v === 'tanque' ? 18 : v === 'asalto' ? 14 : 11;
  const capa = v === 'capa'
    ? `<path d="M34 56 Q20 140 14 206 L60 196 L106 206 Q100 140 86 56 Z" fill="#0d1218" stroke="${BORDE}" stroke-width="1"/>`
    : '';
  const guantes = v === 'asalto' ? 9 : 7;
  return `
<svg viewBox="0 0 120 220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Traje ${agente.nombre}">
  <defs>
    <linearGradient id="g-${agente.id}" x1="0" x2="1">
      <stop offset="0" stop-color="${METAL}"/><stop offset=".5" stop-color="${METAL2}"/><stop offset="1" stop-color="${METAL}"/>
    </linearGradient>
  </defs>
  ${capa}
  <!-- piernas -->
  <path d="M46 126 L58 126 L57 168 L55 206 L42 206 L44 168 Z" fill="url(#g-${agente.id})" stroke="${BORDE}"/>
  <path d="M62 126 L74 126 L76 168 L78 206 L65 206 L63 168 Z" fill="url(#g-${agente.id})" stroke="${BORDE}"/>
  <path d="M44 164 h13 M63 164 h13" stroke="${c}" stroke-width="1.5" opacity=".7"/>
  <rect x="40" y="203" width="17" height="7" rx="2" fill="${METAL2}" stroke="${BORDE}"/>
  <rect x="63" y="203" width="17" height="7" rx="2" fill="${METAL2}" stroke="${BORDE}"/>
  <!-- brazos -->
  <path d="M36 60 L28 100 L26 128 L34 128 L40 100 L44 66 Z" fill="url(#g-${agente.id})" stroke="${BORDE}"/>
  <path d="M84 60 L92 100 L94 128 L86 128 L80 100 L76 66 Z" fill="url(#g-${agente.id})" stroke="${BORDE}"/>
  <rect x="${30 - guantes / 2}" y="126" width="${guantes + 4}" height="${guantes + 3}" rx="2" fill="${METAL2}" stroke="${BORDE}"/>
  <rect x="${90 - guantes / 2 - 4}" y="126" width="${guantes + 4}" height="${guantes + 3}" rx="2" fill="${METAL2}" stroke="${BORDE}"/>
  <!-- torso -->
  <path d="M40 54 L80 54 L78 100 L72 118 L48 118 L42 100 Z" fill="url(#g-${agente.id})" stroke="${BORDE}"/>
  <path d="M46 100 L74 100 M48 108 L72 108" stroke="${BORDE}" stroke-width="1.5"/>
  <rect x="44" y="116" width="32" height="10" rx="2" fill="${METAL2}" stroke="${BORDE}"/>
  <rect x="56" y="118" width="8" height="6" rx="1" fill="${c}" opacity=".8"/>
  ${emblema(v, c)}
  <!-- hombreras -->
  <path d="M40 52 Q${40 - anchoHombro} 52 ${38 - anchoHombro} 70 L42 72 Z" fill="${METAL2}" stroke="${BORDE}"/>
  <path d="M80 52 Q${80 + anchoHombro} 52 ${82 + anchoHombro} 70 L78 72 Z" fill="${METAL2}" stroke="${BORDE}"/>
  <!-- cuello y casco -->
  <rect x="52" y="44" width="16" height="12" fill="${METAL}" stroke="${BORDE}"/>
  ${casco(v, c)}
</svg>`;
}
