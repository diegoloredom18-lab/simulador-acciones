# La Guarida · Simulador de inversiones con agentes

Una cueva subterránea de alta tecnología donde cinco trajes blindados, cada uno un agente con una misión, administran un portafolio de **dinero simulado** ($100,000 de inicio). Los agentes despiertan solos cada día hábil en la nube, analizan el mercado, operan y escriben su bitácora. Tú solo abres la página para ver qué hicieron, o usas el laboratorio para probar tus propias estrategias.

> Es un simulador educativo. No mueve dinero real ni es recomendación de inversión.

## Los agentes (trajes)

| Traje | Misión | Qué hace exactamente |
|---|---|---|
| **VIGÍA** · MK-01 | Investigación de mercado | Revisa cada acción de la lista: tendencia (medias de 20 y 50 días), momentum de 60 días y RSI. Le da un puntaje de -100 a +100 y arma el ranking. |
| **BASTIÓN** · MK-02 | Riesgo | Mide volatilidad, caída máxima, VaR 95% y beta. Veta acciones demasiado volátiles, fija el peso máximo de cada una y activa el **modo defensivo** (exposición al 50%) si el portafolio cae más de 12%. |
| **ORÁCULO** · MK-03 | Estrategia y backtesting | Prueba 5 estrategias sobre el último año de cada acción, elige la de mejor Sharpe y emite la señal COMPRAR o FUERA. Descarta señales que contradicen al Vigía. |
| **MARTILLO** · MK-04 | Ejecución | Convierte señales y límites en órdenes simuladas, deja 10% en efectivo, rebalancea y cobra comisión (0.1%) y deslizamiento (0.05%). |
| **ECO** · MK-05 | Reportes | Compara el portafolio contra el mercado (SPY), calcula Sharpe y caída máxima, y escribe la bitácora del día. |

## Cómo funciona sin tu computadora

```
GitHub Actions (gratis, en la nube)          GitHub Pages (gratis, rama gh-pages)
  cada día hábil 22:30 UTC                      tu-usuario.github.io/simulador-acciones
  ├─ descarga precios (Yahoo Finance)           └─ la guarida: muestra lo que hicieron
  ├─ Vigía → Bastión → Oráculo → Martillo → Eco    los agentes + laboratorio de simulación
  └─ guarda resultados en docs/data/*.json  ──►
```

No hay servidor que mantener ni nada que pagar: GitHub corre a los agentes y publica la página.

## Puesta en marcha (una sola vez, ~3 minutos)

1. **Activa GitHub Pages**: en el repo ve a **Settings → Pages → Build and deployment**, deja **Source: Deploy from a branch**, elige la rama **gh-pages** y la carpeta **/ (root)**, y presiona **Save**.
2. **Primera corrida**: ve a **Actions → Agentes de la guarida → Run workflow**. En ~1 minuto termina.
3. Abre **https://TU-USUARIO.github.io/simulador-acciones/**. ¡Listo! Desde ahí los agentes despiertan solos cada día hábil.

### Llaves de API

- **Ninguna es obligatoria.** Los precios vienen de Yahoo Finance, que no pide llave.
- **Opcional, respaldo:** si Yahoo falla, se usa [Alpha Vantage](https://www.alphavantage.co/support/#api-key) (llave gratis, 25 consultas al día). Guárdala en **Settings → Secrets and variables → Actions → New repository secret** con el nombre `ALPHA_VANTAGE_KEY`.
- Si ninguna fuente responde, los agentes usan datos sintéticos y la página muestra el aviso **MODO DEMO**.

## Personalizar

Todo se cambia en [`config.json`](config.json) (editable desde la web de GitHub):

- `watchlist`: las acciones a vigilar. Acepta cualquier símbolo de Yahoo, por ejemplo `WALMEX.MX`, `AMXB.MX` o `BTC-USD`.
- `capitalInicial`, límites de `riesgo` y costos de `ejecucion`.

Para empezar el portafolio de cero: **Actions → Agentes de la guarida → Run workflow** y marca *Borrar el portafolio*.

## Probar en tu computadora (opcional)

```bash
npm run demo     # corre los agentes con datos sintéticos
npm test         # pruebas del motor de simulación
npm run servir   # abre http://localhost:8080
```

Requiere Node 20 o más reciente. No hay dependencias que instalar.

## Estructura

```
agents/           los agentes y el orquestador (Node, sin dependencias)
docs/             la página (HTML + JS puro) que publica GitHub Pages
docs/engine/      motor compartido: indicadores, estrategias, backtest y Monte Carlo
docs/data/        informes que escriben los agentes en cada corrida
config.json       lista de acciones y reglas de riesgo
.github/workflows el horario de los agentes
```
