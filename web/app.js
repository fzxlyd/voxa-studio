const form = document.getElementById("tts-form");
const modeSingleButton = document.getElementById("mode-single");
const modeBatchButton = document.getElementById("mode-batch");
const singleEditor = document.getElementById("single-editor");
const batchEditor = document.getElementById("batch-editor");

const textInput = document.getElementById("text");
const batchTextInput = document.getElementById("batch-text");
const voiceSelect = document.getElementById("voice");
const searchInput = document.getElementById("search");
const localeInput = document.getElementById("locale");
const genderSelect = document.getElementById("gender");
const rateInput = document.getElementById("rate");
const pitchInput = document.getElementById("pitch");

const rateValue = document.getElementById("rate-value");
const pitchValue = document.getElementById("pitch-value");
const charsCount = document.getElementById("chars-count");
const estimate = document.getElementById("estimate");
const batchLines = document.getElementById("batch-lines");
const batchChars = document.getElementById("batch-chars");

const presetsContainer = document.getElementById("presets");
const submitButton = document.getElementById("submit");
const clearButton = document.getElementById("clear-input");
const refreshVoicesButton = document.getElementById("refresh-voices");
const resetFiltersButton = document.getElementById("reset-filters");

const statusText = document.getElementById("status");
const loadedVoices = document.getElementById("loaded-voices");
const historyCount = document.getElementById("history-count");
const totalChars = document.getElementById("total-chars");

const resultPanel = document.getElementById("result");
const resultMeta = document.getElementById("result-meta");
const audioPlayer = document.getElementById("audio-player");
const downloadLink = document.getElementById("download");
const copyLinkButton = document.getElementById("copy-link");

const batchReport = document.getElementById("batch-report");
const historyList = document.getElementById("history-list");
const apiPreview = document.getElementById("api-preview");
const copyCurlButton = document.getElementById("copy-curl");

const state = {
  mode: "single",
  history: [],
  currentAudioUrl: "",
};

const setStatus = (message, tone = "neutral") => {
  statusText.textContent = message;
  statusText.classList.remove("ok", "error");
  if (tone === "ok") {
    statusText.classList.add("ok");
  }
  if (tone === "error") {
    statusText.classList.add("error");
  }
};

const debounce = (fn, wait = 280) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
};

const formatRelative = (isoTime) => {
  const stamp = new Date(isoTime);
  if (Number.isNaN(stamp.getTime())) {
    return "just now";
  }

  const delta = Math.floor((Date.now() - stamp.getTime()) / 1000);
  if (delta < 45) {
    return "just now";
  }
  if (delta < 3600) {
    return `${Math.round(delta / 60)}m ago`;
  }
  if (delta < 86400) {
    return `${Math.round(delta / 3600)}h ago`;
  }
  return `${Math.round(delta / 86400)}d ago`;
};

const updateSingleMetrics = () => {
  const text = textInput.value.trim();
  const chars = text.length;
  const sec = chars === 0 ? 0 : Math.max(1, Math.round(chars / 14));
  charsCount.textContent = `${chars} chars`;
  estimate.textContent = `~${sec} sec`;
};

const updateBatchMetrics = () => {
  const rows = batchTextInput.value
    .split("\n")
    .map((row) => row.trim())
    .filter(Boolean);
  const charTotal = rows.reduce((sum, row) => sum + row.length, 0);
  batchLines.textContent = `${rows.length} lines`;
  batchChars.textContent = `${charTotal} chars`;
};

const currentPayload = () => {
  if (state.mode === "single") {
    return {
      text: textInput.value,
      voice: voiceSelect.value || undefined,
      rate: Number.parseInt(rateInput.value, 10),
      pitch: Number.parseInt(pitchInput.value, 10),
      format: "mp3",
    };
  }

  const texts = batchTextInput.value
    .split("\n")
    .map((row) => row.trim())
    .filter(Boolean)
    .slice(0, 20);

  return {
    texts,
    voice: voiceSelect.value || undefined,
    rate: Number.parseInt(rateInput.value, 10),
    pitch: Number.parseInt(pitchInput.value, 10),
    format: "mp3",
  };
};

const renderApiPreview = () => {
  if (state.mode === "single") {
    const payload = currentPayload();
    apiPreview.textContent = `curl -X POST ${window.location.origin}/api/speak \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(payload, null, 2)}'`;
    return;
  }

  const payload = currentPayload();
  apiPreview.textContent = `curl -X POST ${window.location.origin}/api/speak/batch \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(payload, null, 2)}'`;
};

const applyMode = (mode) => {
  state.mode = mode;

  modeSingleButton.classList.toggle("active", mode === "single");
  modeSingleButton.setAttribute("aria-selected", mode === "single" ? "true" : "false");

  modeBatchButton.classList.toggle("active", mode === "batch");
  modeBatchButton.setAttribute("aria-selected", mode === "batch" ? "true" : "false");

  singleEditor.classList.toggle("active", mode === "single");
  batchEditor.classList.toggle("active", mode === "batch");

  submitButton.textContent = mode === "single" ? "Generate" : "Generate Batch";
  renderApiPreview();
};

const buildVoiceQuery = () => {
  const params = new URLSearchParams();

  if (searchInput.value.trim()) {
    params.set("search", searchInput.value.trim());
  }
  if (localeInput.value.trim()) {
    params.set("locale", localeInput.value.trim());
  }
  if (genderSelect.value.trim()) {
    params.set("gender", genderSelect.value.trim());
  }

  params.set("limit", "300");
  return params.toString();
};

const populateVoiceSelect = (voices, preferred = "") => {
  voiceSelect.innerHTML = "";

  if (!voices.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No voices found";
    voiceSelect.append(option);
    return;
  }

  for (const voice of voices) {
    const option = document.createElement("option");
    option.value = voice.short_name;
    option.textContent = `${voice.short_name} · ${voice.locale}${voice.gender ? ` · ${voice.gender}` : ""}`;
    voiceSelect.append(option);
  }

  const exists = voices.some((voice) => voice.short_name === preferred);
  voiceSelect.value = exists ? preferred : voices[0].short_name;
};

const loadVoices = async () => {
  const previous = voiceSelect.value;
  const query = buildVoiceQuery();
  const url = query ? `/api/voices?${query}` : "/api/voices";

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load voices (${response.status})`);
  }

  const voices = await response.json();
  populateVoiceSelect(voices, previous);
  loadedVoices.textContent = `${voices.length} voices`;

  if (!voices.length) {
    setStatus("No voices match filters.", "error");
  } else {
    setStatus(`Loaded ${voices.length} voices.`, "ok");
  }

  renderApiPreview();
};

const renderPresets = (presets) => {
  presetsContainer.innerHTML = "";

  for (const preset of presets) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "preset-chip";
    button.dataset.text = preset.text;
    button.dataset.locale = preset.locale;
    button.textContent = preset.title;
    presetsContainer.append(button);
  }
};

const loadPresets = async () => {
  const response = await fetch("/api/presets");
  if (!response.ok) {
    throw new Error("Failed to load presets");
  }

  const presets = await response.json();
  renderPresets(presets);
};

const setCurrentOutput = (item, message = "") => {
  resultPanel.classList.remove("empty");
  resultMeta.textContent = `${item.voice} · ${item.locale} · ${item.characters} chars · ${formatRelative(item.created_at)}`;
  audioPlayer.src = item.audio_url;
  downloadLink.href = item.audio_url;
  state.currentAudioUrl = new URL(item.audio_url, window.location.origin).href;

  if (message) {
    setStatus(message, "ok");
  }
};

const renderBatchReport = (batchResult) => {
  if (!batchResult) {
    batchReport.innerHTML = "";
    batchReport.classList.add("hidden");
    return;
  }

  const summary = document.createElement("p");
  summary.className = "batch-summary";
  summary.textContent = `Batch finished in ${batchResult.duration_ms}ms. Success ${batchResult.success}/${batchResult.total}.`;

  const list = document.createElement("ul");
  list.className = "batch-list";

  for (const item of batchResult.items) {
    const li = document.createElement("li");
    li.className = "batch-item";

    const badge = document.createElement("span");
    badge.className = `badge ${item.success ? "ok" : "fail"}`;
    badge.textContent = item.success ? "OK" : "FAILED";

    const preview = document.createElement("div");
    preview.textContent = `${item.index + 1}. ${item.text_preview}`;

    li.append(badge, preview);

    if (item.success && item.result) {
      const audioLink = document.createElement("a");
      audioLink.href = item.result.audio_url;
      audioLink.download = `${item.result.id}.mp3`;
      audioLink.textContent = "Download";
      li.append(audioLink);
    }

    if (!item.success && item.error) {
      const error = document.createElement("div");
      error.textContent = item.error;
      li.append(error);
    }

    list.append(li);
  }

  batchReport.innerHTML = "";
  batchReport.append(summary, list);
  batchReport.classList.remove("hidden");
};

const renderHistory = () => {
  historyList.innerHTML = "";

  if (!state.history.length) {
    const empty = document.createElement("li");
    empty.className = "history-item";
    empty.textContent = "No renders yet.";
    historyList.append(empty);
    return;
  }

  for (const item of state.history) {
    const li = document.createElement("li");
    li.className = "history-item";

    const top = document.createElement("div");
    top.className = "history-top";
    const left = document.createElement("strong");
    left.textContent = item.voice;
    const right = document.createElement("span");
    right.textContent = formatRelative(item.created_at);
    top.append(left, right);

    const meta = document.createElement("div");
    meta.className = "history-meta";
    meta.textContent = `${item.locale} · ${item.characters} chars · ${item.text_preview}`;

    const actions = document.createElement("div");
    actions.className = "history-actions";

    const play = document.createElement("button");
    play.type = "button";
    play.dataset.action = "play";
    play.dataset.id = item.id;
    play.textContent = "Play";

    const download = document.createElement("a");
    download.href = item.audio_url;
    download.download = `${item.id}.mp3`;
    download.textContent = "Download";

    const copy = document.createElement("button");
    copy.type = "button";
    copy.dataset.action = "copy";
    copy.dataset.id = item.id;
    copy.textContent = "Copy";

    const remove = document.createElement("button");
    remove.type = "button";
    remove.dataset.action = "delete";
    remove.dataset.id = item.id;
    remove.textContent = "Delete";

    actions.append(play, download, copy, remove);
    li.append(top, meta, actions);
    historyList.append(li);
  }
};

const loadHistory = async () => {
  const response = await fetch("/api/history?limit=20");
  if (!response.ok) {
    throw new Error("Failed to load history");
  }

  state.history = await response.json();
  renderHistory();
  historyCount.textContent = `${state.history.length} renders`;
};

const loadStats = async () => {
  const response = await fetch("/api/stats");
  if (!response.ok) {
    throw new Error("Failed to load stats");
  }

  const stats = await response.json();
  historyCount.textContent = `${stats.history_count} renders`;
  totalChars.textContent = `${stats.total_characters} chars`;
};

const copyText = async (value) => {
  await navigator.clipboard.writeText(value);
};

const generateSingle = async () => {
  const payload = currentPayload();
  if (!payload.text.trim()) {
    throw new Error("Please enter a script.");
  }

  const response = await fetch("/api/speak", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || "Generation failed");
  }

  setCurrentOutput(data);
  renderBatchReport(null);
  await Promise.all([loadHistory(), loadStats()]);
  setStatus(`Generated with ${data.voice}.`, "ok");
};

const generateBatch = async () => {
  const payload = currentPayload();
  if (!payload.texts.length) {
    throw new Error("Batch mode requires at least one non-empty line.");
  }

  const response = await fetch("/api/speak/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail || "Batch generation failed");
  }

  renderBatchReport(data);

  const firstSuccess = data.items.find((item) => item.success && item.result);
  if (firstSuccess?.result) {
    setCurrentOutput(firstSuccess.result);
  }

  await Promise.all([loadHistory(), loadStats()]);

  if (data.failed > 0) {
    setStatus(`Batch completed with ${data.failed} failed item(s).`, "error");
  } else {
    setStatus(`Batch completed successfully (${data.success}/${data.total}).`, "ok");
  }
};

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  submitButton.disabled = true;
  setStatus(state.mode === "single" ? "Generating..." : "Generating batch...");

  try {
    if (state.mode === "single") {
      await generateSingle();
    } else {
      await generateBatch();
    }
  } catch (error) {
    setStatus(error.message || "Generation failed", "error");
  } finally {
    submitButton.disabled = false;
  }
});

const reloadVoicesDebounced = debounce(async () => {
  try {
    await loadVoices();
  } catch (error) {
    setStatus(error.message || "Voice load failed", "error");
  }
});

modeSingleButton.addEventListener("click", () => applyMode("single"));
modeBatchButton.addEventListener("click", () => applyMode("batch"));

textInput.addEventListener("input", () => {
  updateSingleMetrics();
  renderApiPreview();
});

batchTextInput.addEventListener("input", () => {
  updateBatchMetrics();
  renderApiPreview();
});

rateInput.addEventListener("input", () => {
  rateValue.textContent = `${rateInput.value}%`;
  renderApiPreview();
});

pitchInput.addEventListener("input", () => {
  pitchValue.textContent = `${pitchInput.value}Hz`;
  renderApiPreview();
});

voiceSelect.addEventListener("change", renderApiPreview);
searchInput.addEventListener("input", reloadVoicesDebounced);
localeInput.addEventListener("input", reloadVoicesDebounced);
genderSelect.addEventListener("change", reloadVoicesDebounced);

refreshVoicesButton.addEventListener("click", async () => {
  refreshVoicesButton.disabled = true;
  try {
    await loadVoices();
  } catch (error) {
    setStatus(error.message || "Voice refresh failed", "error");
  } finally {
    refreshVoicesButton.disabled = false;
  }
});

resetFiltersButton.addEventListener("click", async () => {
  searchInput.value = "";
  localeInput.value = "";
  genderSelect.value = "";
  await loadVoices();
});

clearButton.addEventListener("click", () => {
  if (state.mode === "single") {
    textInput.value = "";
    updateSingleMetrics();
  } else {
    batchTextInput.value = "";
    updateBatchMetrics();
  }
  renderApiPreview();
  setStatus("Input cleared.", "ok");
});

presetsContainer.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement) || !target.classList.contains("preset-chip")) {
    return;
  }

  const presetText = target.dataset.text || "";
  const presetLocale = target.dataset.locale || "";

  if (state.mode === "single") {
    textInput.value = presetText;
    updateSingleMetrics();
  } else {
    const current = batchTextInput.value.trim();
    batchTextInput.value = current ? `${current}\n${presetText}` : presetText;
    updateBatchMetrics();
  }

  if (presetLocale) {
    localeInput.value = presetLocale;
    await loadVoices();
  }

  renderApiPreview();
  setStatus(`Preset loaded: ${target.textContent || "template"}.`, "ok");
});

historyList.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const action = target.dataset.action;
  const itemId = target.dataset.id;
  if (!action || !itemId) {
    return;
  }

  const item = state.history.find((entry) => entry.id === itemId);
  if (!item) {
    setStatus("History item not found.", "error");
    return;
  }

  if (action === "play") {
    setCurrentOutput(item, "Loaded from history.");
    return;
  }

  if (action === "copy") {
    try {
      await copyText(new URL(item.audio_url, window.location.origin).href);
      setStatus("Audio link copied.", "ok");
    } catch {
      setStatus("Copy failed.", "error");
    }
    return;
  }

  if (action === "delete") {
    try {
      const response = await fetch(`/api/history/${encodeURIComponent(itemId)}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail || "Delete failed");
      }
      await Promise.all([loadHistory(), loadStats()]);
      setStatus("History item deleted.", "ok");
    } catch (error) {
      setStatus(error.message || "Delete failed", "error");
    }
  }
});

copyLinkButton.addEventListener("click", async () => {
  if (!state.currentAudioUrl) {
    setStatus("No active output to copy.", "error");
    return;
  }

  try {
    await copyText(state.currentAudioUrl);
    setStatus("Output link copied.", "ok");
  } catch {
    setStatus("Copy failed.", "error");
  }
});

copyCurlButton.addEventListener("click", async () => {
  try {
    await copyText(apiPreview.textContent || "");
    setStatus("cURL copied.", "ok");
  } catch {
    setStatus("Copy failed.", "error");
  }
});

const initialize = async () => {
  updateSingleMetrics();
  updateBatchMetrics();
  renderApiPreview();

  try {
    await Promise.all([loadPresets(), loadVoices(), loadHistory(), loadStats()]);
    if (state.history.length) {
      setCurrentOutput(state.history[0]);
    }
    setStatus("Studio ready.", "ok");
  } catch (error) {
    setStatus(error.message || "Failed to initialize", "error");
  }
};

initialize();
