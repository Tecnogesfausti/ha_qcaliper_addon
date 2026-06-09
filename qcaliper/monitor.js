const els = {
  statusText: document.querySelector("#statusText"),
  toggleButton: document.querySelector("#toggleButton"),
  pulsosCaudalimetro: document.querySelector("#pulsosCaudalimetro"),
  pulsosPulsometro: document.querySelector("#pulsosPulsometro"),
  deltaCaudalimetro: document.querySelector("#deltaCaudalimetro"),
  deltaPulsometro: document.querySelector("#deltaPulsometro"),
  litrosCaudalimetro: document.querySelector("#litrosCaudalimetro"),
  litrosPulsometro: document.querySelector("#litrosPulsometro"),
  factorCaudalimetro: document.querySelector("#factorCaudalimetro"),
  factorPulsometro: document.querySelector("#factorPulsometro"),
  temporalCaudalimetro: document.querySelector("#temporalCaudalimetro"),
  temporalPulsometro: document.querySelector("#temporalPulsometro"),
  markButton: document.querySelector("#markButton"),
  clearButton: document.querySelector("#clearButton"),
  downloadButton: document.querySelector("#downloadButton"),
  logList: document.querySelector("#logList"),
};

let paused = false;
let previous = null;
let samples = [];
let timer = null;

start();

function start() {
  timer = window.setInterval(fetchSample, 1000);
  fetchSample();
  els.toggleButton.addEventListener("click", togglePause);
  els.markButton.addEventListener("click", markEvent);
  els.clearButton.addEventListener("click", clearLog);
  els.downloadButton.addEventListener("click", downloadJson);
}

async function fetchSample() {
  if (paused) return;
  const fetchedAt = new Date();
  try {
    const response = await fetch("/api/raw-pulses", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.errors?.[0]?.error || `HTTP ${response.status}`);

    const sample = normalizeSample(payload, fetchedAt);
    samples.push(sample);
    renderSample(sample);
    renderLog();
    previous = sample;
  } catch (error) {
    els.statusText.textContent = `Error: ${error.message}`;
    els.statusText.className = "error";
  }
}

function normalizeSample(payload, fetchedAt) {
  const values = payload.values || {};
  const sample = {
    timestamp: payload.timestamp,
    local_timestamp: fetchedAt.toISOString(),
    duration_ms: payload.duration_ms,
    pulsos_caudalimetro: valueOf(values.pulsos_caudalimetro),
    pulsos_pulsometro: valueOf(values.pulsos_pulsometro),
    litros_caudalimetro: valueOf(values.litros_caudalimetro),
    litros_pulsometro: valueOf(values.litros_pulsometro),
    factor_caudalimetro: valueOf(values.factor_caudalimetro),
    factor_pulsometro: valueOf(values.factor_pulsometro),
    temporal_caudalimetro: valueOf(values.temporal_caudalimetro),
    temporal_pulsometro: valueOf(values.temporal_pulsometro),
    event: null,
  };

  const dt = previous ? (new Date(sample.local_timestamp) - new Date(previous.local_timestamp)) / 1000 : null;
  sample.delta_pulsos_caudalimetro = previous ? sample.pulsos_caudalimetro - previous.pulsos_caudalimetro : 0;
  sample.delta_pulsos_pulsometro = previous ? sample.pulsos_pulsometro - previous.pulsos_pulsometro : 0;
  sample.pulsos_segundo_caudalimetro = dt > 0 ? sample.delta_pulsos_caudalimetro / dt : 0;
  sample.pulsos_segundo_pulsometro = dt > 0 ? sample.delta_pulsos_pulsometro / dt : 0;
  return sample;
}

function valueOf(entry) {
  return Number.isFinite(entry?.value) ? entry.value : null;
}

function renderSample(sample) {
  els.statusText.textContent = `Actualizado ${new Date(sample.local_timestamp).toLocaleTimeString()} · ${samples.length} muestras`;
  els.statusText.className = "ok";
  els.pulsosCaudalimetro.textContent = fmt(sample.pulsos_caudalimetro, 0);
  els.pulsosPulsometro.textContent = fmt(sample.pulsos_pulsometro, 0);
  els.deltaCaudalimetro.textContent = `Delta ${fmt(sample.delta_pulsos_caudalimetro, 0)} · ${fmt(sample.pulsos_segundo_caudalimetro, 2)} p/s`;
  els.deltaPulsometro.textContent = `Delta ${fmt(sample.delta_pulsos_pulsometro, 0)} · ${fmt(sample.pulsos_segundo_pulsometro, 2)} p/s`;
  els.litrosCaudalimetro.textContent = fmt(sample.litros_caudalimetro, 3);
  els.litrosPulsometro.textContent = fmt(sample.litros_pulsometro, 3);
  els.factorCaudalimetro.textContent = fmt(sample.factor_caudalimetro, 6);
  els.factorPulsometro.textContent = fmt(sample.factor_pulsometro, 6);
  els.temporalCaudalimetro.textContent = fmt(sample.temporal_caudalimetro, 3);
  els.temporalPulsometro.textContent = fmt(sample.temporal_pulsometro, 3);
}

function renderLog() {
  const last = samples.slice(-8).reverse();
  els.logList.classList.toggle("empty", samples.length === 0);
  els.logList.innerHTML = last.map((sample) => `
    <article class="history-card">
      <h3>${new Date(sample.local_timestamp).toLocaleTimeString()}${sample.event ? ` · ${sample.event}` : ""}</h3>
      <p>C ${fmt(sample.pulsos_caudalimetro, 0)} (${fmt(sample.delta_pulsos_caudalimetro, 0)}) · P ${fmt(sample.pulsos_pulsometro, 0)} (${fmt(sample.delta_pulsos_pulsometro, 0)})</p>
    </article>
  `).join("") || "Sin muestras";
}

function togglePause() {
  paused = !paused;
  els.toggleButton.textContent = paused ? "Reanudar" : "Pausar";
  els.statusText.textContent = paused ? "Pausado" : "Reanudado";
}

function markEvent() {
  const label = prompt("Etiqueta del evento", "grifo");
  if (!label || !samples.length) return;
  samples[samples.length - 1].event = label;
  renderLog();
}

function clearLog() {
  samples = [];
  previous = null;
  renderLog();
}

function downloadJson() {
  const blob = new Blob([JSON.stringify(samples, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `pulsos-crudos-${new Date().toISOString().slice(0, 19).replaceAll(":", "")}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function fmt(value, digits = 3) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--";
  return Number(value).toLocaleString("es-ES", { maximumFractionDigits: digits });
}
