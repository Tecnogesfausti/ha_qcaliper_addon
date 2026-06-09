const STORAGE_KEYS = {
  config: "calibreriego.config",
  history: "calibreriego.history",
};

const FLOW_PROFILES = {
  drip: { durationSeconds: 900, settleSeconds: 8, sampleIntervalSeconds: 10, autoStopMode: "off", idleStopSeconds: 20 },
  standard: { durationSeconds: 180, settleSeconds: 5, sampleIntervalSeconds: 5, autoStopMode: "off", idleStopSeconds: 15 },
  frequentSink: { durationSeconds: 90, settleSeconds: 5, sampleIntervalSeconds: 2, autoStopMode: "on", idleStopSeconds: 8, relay: "manual_sin_rele" },
  cistern: { durationSeconds: 75, settleSeconds: 8, sampleIntervalSeconds: 2, autoStopMode: "on", idleStopSeconds: 10, relay: "manual_sin_rele" },
  washer: { durationSeconds: 180, settleSeconds: 10, sampleIntervalSeconds: 5, autoStopMode: "on", idleStopSeconds: 20, relay: "manual_sin_rele" },
  spray: { durationSeconds: 60, settleSeconds: 3, sampleIntervalSeconds: 2, autoStopMode: "off", idleStopSeconds: 10 },
  custom: null,
};

const RELAYS = [
  "manual_sin_rele",
  "switch.riego_rele1",
  "switch.riego_rele2",
  "switch.riego_rele3",
  "switch.riego_rele4",
  "switch.riego_rele5",
  "switch.riego_rele6",
  "switch.riego_rele7",
  "switch.riego_rele8",
  "switch.riego2_rele1",
  "switch.riego2_rele2",
  "switch.riego2_rele3",
  "switch.riego2_rele4",
  "switch.riego2_rele5",
  "switch.riego2_rele6",
  "switch.riego2_rele7",
  "switch.riego2_rele8",
];

const ENTITIES = {
  pulsosCaudalimetro: "sensor.controlh2oficina_pulsos_caudalimetro",
  pulsosPulsometro: "sensor.controlh2oficina_pulsos_pulsometro",
  pulsosSesionCaudalimetro: "sensor.controlh2oficina_pulsos_sesion_caudalimetro",
  pulsosSesionPulsometro: "sensor.controlh2oficina_pulsos_sesion_pulsometro",
  litrosCaudalimetro: "sensor.controlh2oficina_sensor_litros_acumulados_caudalimetro",
  litrosPulsometro: "sensor.controlh2oficina_sensor_litros_acumulados_pulsometro",
  inputRealCaudalimetro: "input_number.lectura_real_contador_caudalimetro",
  inputRealPulsometro: "input_number.lectura_real_contador_pulsometro",
  factorCaudalimetro: "sensor.controlh2oficina_pulsos_calculados_por_litro_caudalimetro",
  factorPulsometro: "sensor.controlh2oficina_pulsos_calculados_por_litro_pulsometro",
};

const els = {
  haUrl: document.querySelector("#haUrl"),
  haToken: document.querySelector("#haToken"),
  connectionStatus: document.querySelector("#connectionStatus"),
  saveConfigButton: document.querySelector("#saveConfigButton"),
  testConnectionButton: document.querySelector("#testConnectionButton"),
  emergencyButton: document.querySelector("#emergencyButton"),
  flowProfile: document.querySelector("#flowProfile"),
  sensorMode: document.querySelector("#sensorMode"),
  relaySelect: document.querySelector("#relaySelect"),
  durationSeconds: document.querySelector("#durationSeconds"),
  settleSeconds: document.querySelector("#settleSeconds"),
  sampleIntervalSeconds: document.querySelector("#sampleIntervalSeconds"),
  autoStopMode: document.querySelector("#autoStopMode"),
  idleStopSeconds: document.querySelector("#idleStopSeconds"),
  realInitial: document.querySelector("#realInitial"),
  realFinal: document.querySelector("#realFinal"),
  trialNotes: document.querySelector("#trialNotes"),
  startButton: document.querySelector("#startButton"),
  finishManualButton: document.querySelector("#finishManualButton"),
  runStatus: document.querySelector("#runStatus"),
  countdown: document.querySelector("#countdown"),
  sampleCount: document.querySelector("#sampleCount"),
  progressBar: document.querySelector("#progressBar"),
  resultList: document.querySelector("#resultList"),
  saveTrialButton: document.querySelector("#saveTrialButton"),
  saveRealReadingsButton: document.querySelector("#saveRealReadingsButton"),
  historyList: document.querySelector("#historyList"),
  exportHistoryButton: document.querySelector("#exportHistoryButton"),
  exportCsvButton: document.querySelector("#exportCsvButton"),
  clearHistoryButton: document.querySelector("#clearHistoryButton"),
  modeSampleButton: document.querySelector("#modeSampleButton"),
  modeHistoryButton: document.querySelector("#modeHistoryButton"),
  modeHelp: document.querySelector("#modeHelp"),
  sampleModePanel: document.querySelector("#sampleModePanel"),
  historyModePanel: document.querySelector("#historyModePanel"),
  historySensorMode: document.querySelector("#historySensorMode"),
  historyFrom: document.querySelector("#historyFrom"),
  historyTo: document.querySelector("#historyTo"),
  historyRealInitial: document.querySelector("#historyRealInitial"),
  historyRealFinal: document.querySelector("#historyRealFinal"),
  historyNotes: document.querySelector("#historyNotes"),
  historyAnalyzeButton: document.querySelector("#historyAnalyzeButton"),
  historyLoadButton: document.querySelector("#historyLoadButton"),
  historySummary: document.querySelector("#historySummary"),
};

let activeTrial = null;
let latestResult = null;
let timerId = null;
let sampleTimerId = null;
let relayWatchTimerId = null;
let currentMode = "sample";
let loadedServerTrials = [];

init();

function init() {
  RELAYS.forEach((relay) => {
    const option = document.createElement("option");
    option.value = relay;
    option.textContent = relay === "manual_sin_rele" ? "Manual sin rele" : relay;
    els.relaySelect.append(option);
  });
  els.relaySelect.value = "switch.riego_rele7";

  const config = readJson(STORAGE_KEYS.config, {});
  els.haUrl.value = config.haUrl || els.haUrl.value;
  els.haToken.value = config.haToken || els.haToken.value;
  updateConnectionStatus();
  renderHistory();

  applyFlowProfile();

  els.flowProfile.addEventListener("change", applyFlowProfile);
  [els.durationSeconds, els.settleSeconds, els.sampleIntervalSeconds, els.idleStopSeconds].forEach((input) => {
    input.addEventListener("input", () => {
      els.flowProfile.value = "custom";
    });
  });
  els.saveConfigButton.addEventListener("click", saveConfig);
  els.testConnectionButton.addEventListener("click", testConnection);
  els.emergencyButton.addEventListener("click", emergencyStop);
  els.startButton.addEventListener("click", startCalibration);
  els.finishManualButton.addEventListener("click", finishCalibration);
  els.saveTrialButton.addEventListener("click", saveLatestTrial);
  els.saveRealReadingsButton.addEventListener("click", saveRealReadingsToHa);
  els.exportHistoryButton.addEventListener("click", exportHistory);
  els.exportCsvButton.addEventListener("click", exportCsv);
  els.clearHistoryButton.addEventListener("click", clearHistory);
  els.modeSampleButton.addEventListener("click", () => setMode("sample"));
  els.modeHistoryButton.addEventListener("click", () => setMode("history"));
  els.historyAnalyzeButton.addEventListener("click", analyzeHistoricalAdjustments);
  els.historyLoadButton.addEventListener("click", loadServerTrials);
  setMode("sample");
}

function setMode(mode) {
  currentMode = mode;
  const sampleMode = mode === "sample";
  els.modeSampleButton.classList.toggle("active", sampleMode);
  els.modeHistoryButton.classList.toggle("active", !sampleMode);
  els.modeSampleButton.setAttribute("aria-pressed", String(sampleMode));
  els.modeHistoryButton.setAttribute("aria-pressed", String(!sampleMode));
  els.sampleModePanel.classList.toggle("hidden", !sampleMode);
  els.historyModePanel.classList.toggle("hidden", sampleMode);
  els.resultList.parentElement.classList.toggle("hidden", !sampleMode);
  els.historyList.parentElement.classList.toggle("hidden", !sampleMode);
  els.modeHelp.textContent = sampleMode
    ? "Preparar una prueba corta o media con relé, lectura real inicial y lectura final."
    : "Comparar varios consumos entre fechas usando el historial guardado y las lecturas reales del contador.";
}

async function loadServerTrials() {
  try {
    setBusy(true);
    const payload = await requestLocalGetJson("/api/trials");
    loadedServerTrials = Array.isArray(payload.trials) ? payload.trials : [];
    renderHistoricalSummary("Pruebas cargadas del servidor: " + loadedServerTrials.length);
  } catch (error) {
    renderHistoricalSummary(`No se pudieron cargar pruebas del servidor: ${error.message}`);
  } finally {
    setBusy(false);
  }
}

function analyzeHistoricalAdjustments() {
  const allTrials = [...readJson(STORAGE_KEYS.history, []), ...loadedServerTrials];
  const from = parseDateTimeInput(els.historyFrom.value);
  const to = parseDateTimeInput(els.historyTo.value);
  const sensorMode = els.historySensorMode.value;
  const filtered = allTrials.filter((trial) => {
    const ts = new Date(trial.createdAt || trial.created_at || trial.timestamp_inicio || trial.timestamp || 0);
    if (Number.isNaN(ts.getTime())) return false;
    if (from && ts < from) return false;
    if (to && ts > to) return false;
    if (sensorMode !== "both" && trial.sensorMode && trial.sensorMode !== sensorMode) return false;
    return true;
  });

  const sensors = sensorMode === "both" ? ["caudalimetro", "pulsometro"] : [sensorMode];
  const rows = sensors.map((sensor) => summarizeTrials(filtered, sensor));
  const notes = els.historyNotes.value.trim();
  renderHistoricalSummary(buildHistoricalSummary(rows, filtered.length, notes, from, to));
}

function summarizeTrials(trials, sensor) {
  const valid = trials.filter((trial) => trial && trial.valid !== false);
  let deltaPulsos = 0;
  let deltaLitrosHa = 0;
  let deltaReal = 0;
  let weightedDuration = 0;
  let weightedError = 0;
  let count = 0;

  for (const trial of valid) {
    const r = resultForSensor(trial, sensor);
    if (!r) continue;
    deltaPulsos += r.deltaPulsos;
    deltaLitrosHa += r.deltaLitrosHa;
    deltaReal += r.deltaReal;
    weightedDuration += r.durationSeconds || 0;
    weightedError += (r.errorPorcentaje || 0) * Math.max(1, r.deltaReal || 0);
    count += 1;
  }

  const factorActual = meanResultValue(valid, sensor, "factorActual");
  const factorCorreccion = deltaLitrosHa > 0 ? deltaReal / deltaLitrosHa : null;
  const pulsosPorLitroNuevo = deltaReal > 0 ? deltaPulsos / deltaReal : null;
  const litrosPorPulsoReal = deltaPulsos > 0 ? deltaReal / deltaPulsos : null;
  const errorHaPct = deltaReal > 0 ? ((deltaLitrosHa - deltaReal) / deltaReal) * 100 : null;
  const errorActualPct = deltaReal > 0 && factorActual ? (((deltaPulsos / factorActual) - deltaReal) / deltaReal) * 100 : null;

  return {
    sensor,
    count,
    deltaPulsos,
    deltaLitrosHa,
    deltaReal,
    factorActual,
    factorCorreccion,
    pulsosPorLitroNuevo,
    litrosPorPulsoReal,
    errorHaPct,
    errorActualPct,
    avgDuration: count ? weightedDuration / count : 0,
    avgError: deltaReal > 0 ? weightedError / deltaReal : 0,
  };
}

function resultForSensor(trial, sensor) {
  if (!trial) return null;
  if (Array.isArray(trial.results)) {
    const result = trial.results.find((item) => item?.key === sensor || item?.name?.toLowerCase().includes(sensor));
    if (result) return result;
  }
  if (trial.results && !Array.isArray(trial.results) && trial.results[sensor]) return trial.results[sensor];
  return null;
}

function meanResultValue(trials, sensor, key) {
  const values = [];
  for (const trial of trials) {
    const r = resultForSensor(trial, sensor);
    if (!r) continue;
    const value = Number(r[key]);
    if (Number.isFinite(value)) values.push(value);
  }
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildHistoricalSummary(rows, totalTrials, notes, from, to) {
  const rangeText = [from ? from.toLocaleString("es-ES") : "inicio", to ? to.toLocaleString("es-ES") : "fin"].join(" -> ");
  const lines = [
    `Pruebas usadas: ${totalTrials}`,
    `Rango: ${rangeText}`,
  ];
  if (notes) lines.push(`Notas: ${notes}`);
  rows.forEach((row) => {
    lines.push(`${row.sensor}: ${row.count} pruebas, ${fmt(row.deltaReal, 2)} L reales, ${fmt(row.deltaPulsos, 0)} pulsos, factor actual ${fmt(row.factorActual, 6)}, factor nuevo ${fmt(row.pulsosPorLitroNuevo, 6)}, error HA ${fmt(row.errorHaPct, 2)} %`);
  });
  return lines.join("\n");
}

function renderHistoricalSummary(text) {
  els.historySummary.className = text ? "history-summary" : "history-summary empty";
  els.historySummary.textContent = text || "Sin analisis historico";
}

function parseDateTimeInput(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}


function saveConfig() {
  const config = getConfig();
  localStorage.setItem(STORAGE_KEYS.config, JSON.stringify(config));
  updateConnectionStatus("Configuracion guardada");
}

async function testConnection() {
  try {
    setBusy(true);
    await readEntityNumberAny(ENTITIES.pulsosSesionCaudalimetro, ENTITIES.pulsosCaudalimetro);
    updateConnectionStatus("Conexion correcta", true);
  } catch (error) {
    updateConnectionStatus(error.message, false);
  } finally {
    setBusy(false);
  }
}

async function startCalibration() {
  clearResult();

  try {
    const duration = getPositiveNumber(els.durationSeconds.value, "duracion");
    const settle = getNonNegativeNumber(els.settleSeconds.value, "margen final");
    const sampleInterval = getPositiveNumber(els.sampleIntervalSeconds.value, "muestreo");
    const idleStopSeconds = getPositiveNumber(els.idleStopSeconds.value, "inactividad");
    if (duration > 1800) throw new Error("La duracion maxima es 1800 segundos");
    if (sampleInterval > 60) throw new Error("El muestreo maximo es 60 segundos");
    if (idleStopSeconds > 120) throw new Error("La inactividad maxima es 120 segundos");

    const realInitial = getPositiveNumber(els.realInitial.value, "lectura real inicial");
    els.realFinal.value = "";

    setBusy(true);
    setRunStatus("Leyendo muestra inicial", "--", 0);
    const initialSample = await readSample();

    activeTrial = {
      id: createId(),
      sensorMode: els.sensorMode.value,
      flowProfile: els.flowProfile.value,
      relay: els.relaySelect.value,
      durationSeconds: duration,
      actualDurationSeconds: null,
      relayEndReason: null,
      relayWasOn: false,
      settleSeconds: settle,
      sampleIntervalSeconds: sampleInterval,
      autoStopOnIdle: els.autoStopMode.value === "on",
      idleStopSeconds,
      sawPulseMovement: false,
      lastPulseChangeSeconds: 0,
      notes: els.trialNotes.value.trim(),
      realInitial,
      realFinal: null,
      initialSample,
      finalSample: null,
      samples: [withSampleMeta(initialSample, "initial", 0)],
      createdAt: new Date().toISOString(),
    };
    updateSampleCount();

    if (activeTrial.relay === "manual_sin_rele") {
      setRunStatus("Registro manual activo", `${duration}s`, 0);
    } else {
      setRunStatus("Activando rele temporizado", `${duration}s`, 0);
      await startTimedRelay(activeTrial.relay, duration);
    }

    els.finishManualButton.disabled = false;
    startRelayWatcher();
    startSampleLogger(duration, settle, sampleInterval);
    runCountdown(duration + settle);
  } catch (error) {
    abortRun(error.message);
  } finally {
    setBusy(false, true);
  }
}

async function finishCalibration() {
  if (!activeTrial) return;

  try {
    setBusy(true);
    stopCountdown();
    stopSampleLogger();
    stopRelayWatcher();

    if (!activeTrial.actualDurationSeconds) {
      activeTrial.actualDurationSeconds = elapsedTrialSeconds();
    }

    if (!activeTrial.finalSample) {
      setRunStatus("Leyendo muestra final", "--", 100);
      activeTrial.finalSample = await readSample();
      activeTrial.samples.push(withSampleMeta(activeTrial.finalSample, "final", elapsedTrialSeconds()));
      updateSampleCount();
    }

    const realFinal = Number(els.realFinal.value);
    if (!(realFinal > 0)) {
      setRunStatus("Introduce lectura real final", "--", 100);
      els.finishManualButton.disabled = false;
      return;
    }
    if (realFinal <= activeTrial.realInitial) {
      setRunStatus("La lectura real final debe ser mayor", "--", 100);
      els.finishManualButton.disabled = false;
      return;
    }

    activeTrial.realFinal = realFinal;
    latestResult = calculateTrial(activeTrial);
    renderResult(latestResult);
    setRunStatus("Prueba calculada", "--", 100);
    els.saveTrialButton.disabled = !latestResult.valid;
    els.saveRealReadingsButton.disabled = !latestResult.valid;
    els.finishManualButton.disabled = true;
  } catch (error) {
    abortRun(error.message);
  } finally {
    setBusy(false);
  }
}

async function emergencyStop() {
  try {
    stopCountdown();
    stopSampleLogger();
    stopRelayWatcher();
    setRunStatus("Enviando parada", "--", els.progressBar.value);
    await stopRelays();
    setRunStatus("Parada enviada", "--", els.progressBar.value);
  } catch (error) {
    setRunStatus(`Error parada: ${error.message}`, "--", els.progressBar.value);
  }
}

async function readSample() {
  const [
    pulsosCaudalimetro,
    pulsosPulsometro,
    litrosCaudalimetro,
    litrosPulsometro,
    factorCaudalimetro,
    factorPulsometro,
  ] = await Promise.all([
    readEntityNumber(ENTITIES.pulsosCaudalimetro),
    readEntityNumber(ENTITIES.pulsosPulsometro),
    readEntityNumber(ENTITIES.litrosCaudalimetro),
    readEntityNumber(ENTITIES.litrosPulsometro),
    readEntityNumber(ENTITIES.factorCaudalimetro),
    readEntityNumber(ENTITIES.factorPulsometro),
  ]);

  const [sesionCaudalimetro, sesionPulsometro] = await Promise.all([
    readEntityNumberAny(ENTITIES.pulsosSesionCaudalimetro, ENTITIES.pulsosCaudalimetro),
    readEntityNumberAny(ENTITIES.pulsosSesionPulsometro, ENTITIES.pulsosPulsometro),
  ]);

  return {
    timestamp: new Date().toISOString(),
    pulsos_caudalimetro: pulsosCaudalimetro,
    pulsos_pulsometro: pulsosPulsometro,
    pulsos_sesion_caudalimetro: sesionCaudalimetro.value,
    pulsos_sesion_pulsometro: sesionPulsometro.value,
    pulsos_caudalimetro_source: sesionCaudalimetro.source,
    pulsos_pulsometro_source: sesionPulsometro.source,
    litros_caudalimetro: litrosCaudalimetro,
    litros_pulsometro: litrosPulsometro,
    factor_caudalimetro: factorCaudalimetro,
    factor_pulsometro: factorPulsometro,
  };
}


async function readEntityNumberAny(primaryEntityId, fallbackEntityId) {
  try {
    return {
      value: await readEntityNumber(primaryEntityId),
      source: primaryEntityId,
    };
  } catch (primaryError) {
    if (!fallbackEntityId) throw primaryError;
    return {
      value: await readEntityNumber(fallbackEntityId),
      source: fallbackEntityId,
      fallback_reason: primaryError.message,
    };
  }
}

async function readEntityNumber(entityId) {
  const data = await readEntity(entityId);
  const value = Number(data.state);
  if (data.state === "" || data.state === "unknown" || data.state === "unavailable" || !Number.isFinite(value)) {
    throw new Error(`${entityId} no tiene una lectura numerica valida`);
  }
  return value;
}

async function readEntity(entityId) {
  return requestHa(`/api/states/${encodeURIComponent(entityId)}`);
}



async function startTimedRelay(relay, seconds) {
  try {
    return await requestLocalJson("/api/timed-relay", { rele: relay, segundos: seconds });
  } catch (error) {
    if (!shouldFallbackToDirectHa(error)) throw error;
    return callService("script", "riego_rele_temporizado", {
      rele: relay,
      segundos: seconds,
    });
  }
}

async function stopRelays() {
  try {
    return await requestLocalJson("/api/stop-relays", {});
  } catch (error) {
    if (!shouldFallbackToDirectHa(error)) throw error;
    return callService("script", "riego_apagar_reles_api", {});
  }
}

async function requestLocalJson(path, body) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || `Servidor local responde ${response.status}`);
  }
  return payload;
}


async function requestLocalGetJson(path) {
  const response = await fetch(path, { method: "GET" });
  const payload = await response.json();
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || `Servidor local responde ${response.status}`);
  }
  return payload;
}

function isLocalProxy() {
  return window.location.protocol.startsWith("http") && window.location.hostname !== "";
}

function shouldFallbackToDirectHa(error) {
  const message = String(error?.message || error || "");
  return message.includes("404") || message.includes("Failed to fetch") || message.includes("NetworkError") || message.includes("Servidor local");
}

async function turnOnScript(entityId, variables = null) {
  const body = { entity_id: entityId };
  if (variables) body.variables = variables;
  return callService("script", "turn_on", body);
}

async function callService(domain, service, body) {
  return requestHa(`/api/services/${domain}/${service}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function requestHa(path, options = {}) {
  const { haUrl, haToken } = getConfig();
  const useLocalProxy = isLocalProxy();
  if (!useLocalProxy && (!haUrl || !haToken)) throw new Error("Configura HA_URL y HA_TOKEN");

  const url = useLocalProxy ? `/api/ha${path}` : `${haUrl.replace(/\/$/, "")}${path}`;
  const headers = { "Content-Type": "application/json" };
  if (!useLocalProxy) headers.Authorization = `Bearer ${haToken}`;

  const response = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body,
  });

  if (!response.ok) {
    let detail = "";
    try {
      const payload = await response.json();
      detail = payload.error ? `: ${payload.error}` : "";
    } catch {}
    throw new Error(`Home Assistant responde ${response.status}${detail}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

function calculateTrial(trial) {
  const deltaReal = trial.realFinal - trial.realInitial;
  const durationForCalc = trial.actualDurationSeconds || trial.durationSeconds;
  const results = [];

  if (trial.sensorMode === "caudalimetro" || trial.sensorMode === "both") {
    results.push(calculateSensor({
      name: "Caudalimetro",
      key: "caudalimetro",
      deltaPulsos: trial.finalSample.pulsos_sesion_caudalimetro - trial.initialSample.pulsos_sesion_caudalimetro,
      deltaLitrosHa: trial.finalSample.litros_caudalimetro - trial.initialSample.litros_caudalimetro,
      deltaReal,
      durationSeconds: durationForCalc,
      minPulsos: 20,
      pulseSource: trial.initialSample.pulsos_caudalimetro_source,
      preferredPulseSource: ENTITIES.pulsosSesionCaudalimetro,
      factorActual: trial.initialSample.factor_caudalimetro,
    }));
  }

  if (trial.sensorMode === "pulsometro" || trial.sensorMode === "both") {
    results.push(calculateSensor({
      name: "Pulsometro",
      key: "pulsometro",
      deltaPulsos: trial.finalSample.pulsos_sesion_pulsometro - trial.initialSample.pulsos_sesion_pulsometro,
      deltaLitrosHa: trial.finalSample.litros_pulsometro - trial.initialSample.litros_pulsometro,
      deltaReal,
      durationSeconds: durationForCalc,
      minPulsos: 500,
      pulseSource: trial.initialSample.pulsos_pulsometro_source,
      preferredPulseSource: ENTITIES.pulsosSesionPulsometro,
      factorActual: trial.initialSample.factor_pulsometro,
    }));
  }

  return {
    ...trial,
    deltaReal,
    results,
    valid: results.every((result) => result.valid),
  };
}

function calculateSensor({ name, key, deltaPulsos, deltaLitrosHa, deltaReal, durationSeconds, minPulsos, pulseSource, preferredPulseSource, factorActual }) {
  const errors = [];
  const warnings = [];
  if (!(deltaReal > 0)) errors.push("delta real no positivo");
  if (!(deltaPulsos > 0)) errors.push("delta pulsos no positivo");
  if (!(deltaLitrosHa > 0)) errors.push("delta litros HA no positivo");

  const pulsosPorLitroNuevo = errors.length ? null : deltaPulsos / deltaReal;
  const litrosPorPulsoReal = errors.length ? null : deltaReal / deltaPulsos;
  const caudalLMinReal = errors.length ? null : deltaReal / (durationSeconds / 60);
  const litrosEstimadosAntiguo = errors.length || !(factorActual > 0) ? null : deltaPulsos / factorActual;
  const errorAntiguoPorcentaje = litrosEstimadosAntiguo === null ? null : ((litrosEstimadosAntiguo - deltaReal) / deltaReal) * 100;
  const errorPorcentaje = errors.length ? null : ((deltaLitrosHa - deltaReal) / deltaReal) * 100;

  if (!errors.length && deltaReal < 5) warnings.push("menos de 5 L reales");
  if (!errors.length && deltaPulsos < minPulsos) warnings.push(`menos de ${minPulsos} pulsos`);
  if (!errors.length && durationSeconds < 120) warnings.push("duracion menor de 120 s");
  if (!errors.length && Math.abs(errorPorcentaje) > 25) warnings.push("error absoluto mayor de 25%");
  if (pulseSource && preferredPulseSource && pulseSource !== preferredPulseSource) warnings.push("usando acumulado por falta de pulsos de sesion");

  return {
    name,
    key,
    deltaPulsos,
    deltaLitrosHa,
    deltaReal,
    durationSeconds,
    pulseSource,
    factorCorreccion: errors.length ? null : deltaReal / deltaLitrosHa,
    pulsosPorLitroNuevo,
    litrosPorPulsoReal,
    caudalLMinReal,
    litrosEstimadosAntiguo,
    errorAntiguoPorcentaje,
    variacionFactorPorcentaje: errors.length || !(factorActual > 0) ? null : ((pulsosPorLitroNuevo - factorActual) / factorActual) * 100,
    factorActual,
    errorPorcentaje,
    valid: errors.length === 0,
    suspect: warnings.length > 0,
    errors,
    warnings,
  };
}

function renderResult(trial) {
  els.resultList.classList.remove("empty");
  els.resultList.innerHTML = "";

  trial.results.forEach((result) => {
    const card = document.createElement("article");
    card.className = "result-card";
    card.innerHTML = `
      <h3>${result.name} <span class="${result.valid ? "ok" : "error"}">${result.valid ? "valido" : "invalido"}</span></h3>
      <div class="metric-grid">
        ${metric("Litros reales", fmt(result.deltaReal))}
        ${metric("Litros HA", fmt(result.deltaLitrosHa))}
        ${metric("Pulsos sesion", fmt(result.deltaPulsos))}
        ${metric("Factor actual", fmt(result.factorActual, 6))}
        ${metric("Pulsos/L real", fmt(result.pulsosPorLitroNuevo, 6))}
        ${metric("L/pulso real", fmt(result.litrosPorPulsoReal, 6))}
        ${metric("Caudal real", `${fmt(result.caudalLMinReal, 3)} L/min`)}
        ${metric("Factor correccion", fmt(result.factorCorreccion, 6))}
        ${metric("Cambio factor", `${fmt(result.variacionFactorPorcentaje, 3)} %`)}
        ${metric("Error HA", `${fmt(result.errorPorcentaje, 3)} %`)}
        ${metric("Error antiguo", `${fmt(result.errorAntiguoPorcentaje, 3)} %`)}
      </div>
      ${result.errors.length ? `<p class="error">${result.errors.join(", ")}</p>` : ""}
      ${result.warnings.length ? `<p class="warning">Sospechosa: ${result.warnings.join(", ")}</p>` : ""}
    `;
    els.resultList.append(card);
  });
}

function metric(label, value) {
  return `<div class="metric"><span>${label}</span><strong>${value}</strong></div>`;
}

async function saveLatestTrial() {
  if (!latestResult?.valid) return;
  const history = readJson(STORAGE_KEYS.history, []);
  history.unshift(latestResult);
  localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(history.slice(0, 100)));
  renderHistory();

  if (isLocalProxy()) {
    try {
      const saved = await requestLocalJson("/api/save-trial", latestResult);
      setRunStatus(`Prueba guardada en servidor: ${saved.id}`, "--", els.progressBar.value);
    } catch (error) {
      setRunStatus(`Guardada local, no en servidor: ${error.message}`, "--", els.progressBar.value);
    }
  } else {
    setRunStatus("Prueba guardada localmente", "--", els.progressBar.value);
  }
}

async function saveRealReadingsToHa() {
  if (!latestResult?.valid) return;

  const calls = [];
  if (latestResult.sensorMode === "caudalimetro" || latestResult.sensorMode === "both") {
    calls.push(callService("input_number", "set_value", {
      entity_id: ENTITIES.inputRealCaudalimetro,
      value: latestResult.realFinal,
    }));
  }
  if (latestResult.sensorMode === "pulsometro" || latestResult.sensorMode === "both") {
    calls.push(callService("input_number", "set_value", {
      entity_id: ENTITIES.inputRealPulsometro,
      value: latestResult.realFinal,
    }));
  }

  try {
    setBusy(true);
    await Promise.all(calls);
    setRunStatus("Lectura real guardada en HA", "--", els.progressBar.value);
  } catch (error) {
    setRunStatus(`No se pudo guardar: ${error.message}`, "--", els.progressBar.value);
  } finally {
    setBusy(false);
  }
}

function renderHistory() {
  const history = readJson(STORAGE_KEYS.history, []);
  els.historyList.innerHTML = "";
  els.historyList.classList.toggle("empty", history.length === 0);

  if (!history.length) {
    els.historyList.textContent = "Sin pruebas guardadas";
    return;
  }

  history.forEach((trial) => {
    const card = document.createElement("article");
    card.className = "history-card";
    const summary = trial.results
      .map((result) => `${result.name}: ${fmt(result.pulsosPorLitroNuevo, 4)} pulsos/L`)
      .join(" | ");
    card.innerHTML = `
      <h3>${new Date(trial.createdAt).toLocaleString()}</h3>
      <p>${trial.relay} · ${trial.flowProfile || "manual"} · ${fmt(trial.actualDurationSeconds || trial.durationSeconds, 1)}s reales · ${fmt(trial.deltaReal)} L reales · ${trial.samples?.length || 0} muestras</p>
      <p>${summary}</p>
    `;
    els.historyList.append(card);
  });
}

function exportHistory() {
  const history = readJson(STORAGE_KEYS.history, []);
  const blob = new Blob([JSON.stringify(history, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `calibreriego-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}


function exportCsv() {
  const history = readJson(STORAGE_KEYS.history, []);
  const header = [
    "trial_id", "created_at", "profile", "relay", "duration_seconds", "actual_duration_seconds", "relay_end_reason", "sample_interval_seconds", "auto_stop_on_idle", "idle_stop_seconds", "notes",
    "sample_timestamp", "phase", "elapsed_seconds",
    "pulsos_caudalimetro", "pulsos_pulsometro", "pulsos_sesion_caudalimetro", "pulsos_sesion_pulsometro",
    "litros_caudalimetro", "litros_pulsometro", "factor_caudalimetro", "factor_pulsometro",
    "pulsos_caudalimetro_source", "pulsos_pulsometro_source",
    "real_initial", "real_final", "delta_real"
  ];
  const rows = [header];

  history.forEach((trial) => {
    (trial.samples || []).forEach((sample) => {
      rows.push([
        trial.id, trial.createdAt, trial.flowProfile || "", trial.relay, trial.durationSeconds, trial.actualDurationSeconds || "", trial.relayEndReason || "", trial.sampleIntervalSeconds || "", trial.autoStopOnIdle || false, trial.idleStopSeconds || "", trial.notes || "",
        sample.timestamp, sample.phase, sample.elapsed_seconds,
        sample.pulsos_caudalimetro, sample.pulsos_pulsometro, sample.pulsos_sesion_caudalimetro, sample.pulsos_sesion_pulsometro,
        sample.litros_caudalimetro, sample.litros_pulsometro, sample.factor_caudalimetro, sample.factor_pulsometro,
        sample.pulsos_caudalimetro_source, sample.pulsos_pulsometro_source,
        trial.realInitial, trial.realFinal, trial.deltaReal,
      ]);
    });
  });

  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `calibreriego-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function clearHistory() {
  if (!confirm("Vaciar el historial local de calibraciones?")) return;
  localStorage.removeItem(STORAGE_KEYS.history);
  renderHistory();
}


function applyFlowProfile() {
  const profile = FLOW_PROFILES[els.flowProfile.value];
  if (!profile) return;
  els.durationSeconds.value = profile.durationSeconds;
  els.settleSeconds.value = profile.settleSeconds;
  els.sampleIntervalSeconds.value = profile.sampleIntervalSeconds;
  els.autoStopMode.value = profile.autoStopMode || "off";
  els.idleStopSeconds.value = profile.idleStopSeconds || 10;
  if (profile.relay) els.relaySelect.value = profile.relay;
}


function startRelayWatcher() {
  stopRelayWatcher();
  if (!activeTrial || activeTrial.relay === "manual_sin_rele") return;

  relayWatchTimerId = window.setInterval(async () => {
    if (!activeTrial || activeTrial.finalSample) return;
    try {
      const relayState = await readEntity(activeTrial.relay);
      const elapsed = elapsedTrialSeconds();
      if (relayState.state === "on") {
        activeTrial.relayWasOn = true;
        return;
      }
      if (activeTrial.relayWasOn && relayState.state === "off") {
        activeTrial.actualDurationSeconds = elapsed;
        activeTrial.relayEndReason = elapsed + 1 < activeTrial.durationSeconds ? "relay_off_early" : "relay_off";
        setRunStatus("Rele apagado, tomando muestra final", "--", 100);
        await finishCalibration();
      }
    } catch (error) {
      setRunStatus(`Error vigilando rele: ${error.message}`, els.countdown.textContent, els.progressBar.value);
    }
  }, 1000);
}

function stopRelayWatcher() {
  if (relayWatchTimerId) window.clearInterval(relayWatchTimerId);
  relayWatchTimerId = null;
}

function startSampleLogger(durationSeconds, settleSeconds, sampleIntervalSeconds) {
  stopSampleLogger();
  const totalSeconds = durationSeconds + settleSeconds;
  sampleTimerId = window.setInterval(async () => {
    if (!activeTrial || activeTrial.finalSample) return;
    const elapsed = elapsedTrialSeconds();
    if (elapsed >= totalSeconds) return;

    try {
      const sample = await readSample();
      const phase = elapsed <= durationSeconds ? "running" : "settle";
      activeTrial.samples.push(withSampleMeta(sample, phase, elapsed));
      updatePulseActivity(sample, elapsed);
      updateSampleCount();

      if (shouldAutoFinishForIdle(elapsed)) {
        setRunStatus("Sin pulsos, esperando lectura final", "--", 100);
        await finishCalibration();
      }
    } catch (error) {
      setRunStatus(`Error logger: ${error.message}`, els.countdown.textContent, els.progressBar.value);
    }
  }, sampleIntervalSeconds * 1000);
}


function updatePulseActivity(sample, elapsedSeconds) {
  if (!activeTrial || activeTrial.samples.length < 2) return;
  const previousSample = activeTrial.samples[activeTrial.samples.length - 2];
  let delta = 0;

  if (activeTrial.sensorMode === "caudalimetro" || activeTrial.sensorMode === "both") {
    delta += Math.max(0, sample.pulsos_sesion_caudalimetro - previousSample.pulsos_sesion_caudalimetro);
  }
  if (activeTrial.sensorMode === "pulsometro" || activeTrial.sensorMode === "both") {
    delta += Math.max(0, sample.pulsos_sesion_pulsometro - previousSample.pulsos_sesion_pulsometro);
  }

  if (delta > 0) {
    activeTrial.sawPulseMovement = true;
    activeTrial.lastPulseChangeSeconds = elapsedSeconds;
  }
}

function shouldAutoFinishForIdle(elapsedSeconds) {
  if (!activeTrial?.autoStopOnIdle) return false;
  if (!activeTrial.sawPulseMovement) return false;
  return elapsedSeconds - activeTrial.lastPulseChangeSeconds >= activeTrial.idleStopSeconds;
}

function stopSampleLogger() {
  if (sampleTimerId) window.clearInterval(sampleTimerId);
  sampleTimerId = null;
}

function withSampleMeta(sample, phase, elapsedSeconds) {
  return {
    ...sample,
    phase,
    elapsed_seconds: Number(elapsedSeconds.toFixed(3)),
  };
}

function elapsedTrialSeconds() {
  if (!activeTrial?.createdAt) return 0;
  return Math.max(0, (Date.now() - new Date(activeTrial.createdAt).getTime()) / 1000);
}

function updateSampleCount() {
  els.sampleCount.textContent = String(activeTrial?.samples?.length || 0);
}

function runCountdown(totalSeconds) {
  const started = Date.now();
  const totalMs = totalSeconds * 1000;
  stopCountdown();

  timerId = window.setInterval(() => {
    const elapsedMs = Date.now() - started;
    const remainingMs = Math.max(0, totalMs - elapsedMs);
    const remainingSeconds = Math.ceil(remainingMs / 1000);
    const progress = Math.min(100, (elapsedMs / totalMs) * 100);
    setRunStatus("Esperando fin de riego", `${remainingSeconds}s`, progress);

    if (remainingMs <= 0) {
      if (activeTrial && !activeTrial.relayEndReason) {
        activeTrial.actualDurationSeconds = elapsedTrialSeconds();
        activeTrial.relayEndReason = "timer_elapsed";
      }
      finishCalibration();
    }
  }, 500);
}

function stopCountdown() {
  if (timerId) window.clearInterval(timerId);
  timerId = null;
}

function abortRun(message) {
  stopCountdown();
  stopSampleLogger();
  stopRelayWatcher();
  activeTrial = null;
  latestResult = null;
  els.finishManualButton.disabled = true;
  els.saveTrialButton.disabled = true;
  els.saveRealReadingsButton.disabled = true;
  setRunStatus(`Abortado: ${message}`, "--", 0);
}

function clearResult() {
  latestResult = null;
  els.resultList.className = "result-list empty";
  els.resultList.textContent = "Sin prueba calculada";
  els.saveTrialButton.disabled = true;
  els.saveRealReadingsButton.disabled = true;
  updateSampleCount();
}

function setRunStatus(text, countdown, progress) {
  els.runStatus.textContent = text;
  els.countdown.textContent = countdown;
  els.progressBar.value = progress;
}

function setBusy(isBusy, allowManualFinish = false) {
  els.startButton.disabled = isBusy;
  els.testConnectionButton.disabled = isBusy;
  els.saveConfigButton.disabled = isBusy;
  if (!allowManualFinish) els.finishManualButton.disabled = isBusy || !activeTrial;
}

function updateConnectionStatus(message, ok) {
  const config = getConfig();
  if (message) {
    els.connectionStatus.textContent = message;
    els.connectionStatus.className = ok === false ? "error" : "ok";
    return;
  }
  els.connectionStatus.textContent = config.haUrl ? "Conexion pendiente de prueba" : "Sin conexion configurada";
  els.connectionStatus.className = "";
}

function getConfig() {
  return {
    haUrl: els.haUrl.value.trim(),
    haToken: els.haToken.value.trim(),
  };
}

function getPositiveNumber(value, label) {
  const number = Number(value);
  if (!(number > 0)) throw new Error(`${label} debe ser mayor que 0`);
  return number;
}

function getNonNegativeNumber(value, label) {
  const number = Number(value);
  if (!(number >= 0)) throw new Error(`${label} no puede ser negativo`);
  return number;
}

function readJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}


function createId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  const random = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${random}`;
}

function fmt(value, digits = 3) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--";
  return Number(value).toLocaleString("es-ES", {
    maximumFractionDigits: digits,
  });
}
