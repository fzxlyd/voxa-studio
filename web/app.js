const form = document.getElementById("tts-form");
const textInput = document.getElementById("text");
const voiceSelect = document.getElementById("voice");
const searchInput = document.getElementById("search");
const localeInput = document.getElementById("locale");
const genderSelect = document.getElementById("gender");
const rateInput = document.getElementById("rate");
const pitchInput = document.getElementById("pitch");
const rateValue = document.getElementById("rate-value");
const pitchValue = document.getElementById("pitch-value");
const statusText = document.getElementById("status");
const submitButton = document.getElementById("submit");
const refreshVoicesButton = document.getElementById("refresh-voices");
const presetsContainer = document.getElementById("presets");

const charsCount = document.getElementById("chars-count");
const estimate = document.getElementById("estimate");
const loadedVoices = document.getElementById("loaded-voices");
const historyCount = document.getElementById("history-count");
const totalChars = document.getElementById("total-chars");

const resultPanel = document.getElementById("result");
const resultMeta = document.getElementById("result-meta");
const audioPlayer = document.getElementById("audio-player");
const downloadLink = document.getElementById("download");
const copyLinkButton = document.getElementById("copy-link");

const historyList = document.getElementById("history-list");
const apiPreview = document.getElementById("api-preview");
const copyCurlButton = document.getElementById("copy-curl");

const state = {
  history: [],
  currentAudioUrl: "",
};

const setStatus = (message, tone = "neutral") => {
  statusText.textContent = message;
  statusText.classList.remove("error", "ok");
  if (tone === "error") {
    statusText.classList.add("error");
  }
  if (tone === "ok") {
    statusText.classList.add("ok");
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

  const deltaSec = Math.floor((Date.now() - stamp.getTime()) / 1000);
  if (deltaSec < 45) {
    return "just now";
  }
  if (deltaSec < 3600) {
    return `${Math.round(deltaSec / 60)}m ago`;
  }
  if (deltaSec < 86400) {
    return `${Math.round(deltaSec / 3600)}h ago`;
  }
  return `${Math.round(deltaSec / 86400)}d ago`;
};

const updateTextMetrics = () => {
  const raw = textInput.value.trim();
  const chars = raw.length;
  const sec = chars === 0 ? 0 : Math.max(1, Math.round(chars / 14));
  charsCount.textContent = `${chars} chars`;
  estimate.textContent = `~${sec} sec`;
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

const selectedPayload = () => {
  return {
    text: textInput.value,
    voice: voiceSelect.value || undefined,
    rate: Number.parseInt(rateInput.value, 10),
    pitch: Number.parseInt(pitchInput.value, 10),
    format: "mp3",
  };
};

const updateApiPreview = () => {
  const payload = selectedPayload();
  apiPreview.textContent = `curl -X POST ${window.location.origin}/api/speak \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(payload, null, 2)}'`;
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

  const stillExists = voices.some((voice) => voice.short_name === preferred);
  voiceSelect.value = stillExists ? preferred : voices[0].short_name;
};

const loadVoices = async () => {
  const previous = voiceSelect.value;
  const query = buildVoiceQuery();
  const url = query ? `/api/voices?${query}` : "/api/voices";

  setStatus("Loading voices...");
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load voices (${response.status})`);
  }

  const voices = await response.json();
  populateVoiceSelect(voices, previous);
  loadedVoices.textContent = `${voices.length} voices`;

  if (!voices.length) {
    setStatus("No voices match your filter.", "error");
  } else {
    setStatus(`Loaded ${voices.length} voices.`, "ok");
  }
  updateApiPreview();
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

const setCurrentOutput = (item, message) => {
  resultPanel.classList.remove("empty");
  resultMeta.textContent = `${item.voice} · ${item.locale} · ${item.characters} chars · ${formatRelative(item.created_at)}`;
  audioPlayer.src = item.audio_url;
  downloadLink.href = item.audio_url;
  state.currentAudioUrl = new URL(item.audio_url, window.location.origin).href;
  if (message) {
    setStatus(message, "ok");
  }
};

const renderHistory = () => {
  historyList.innerHTML = "";

  if (!state.history.length) {
    const empty = document.createElement("li");
    empty.className = "history-item";
    empty.textContent = "No renders yet. Generate your first clip.";
    historyList.append(empty);
    return;
  }

  for (const item of state.history) {
    const li = document.createElement("li");
    li.className = "history-item";

    const top = document.createElement("div");
    top.className = "history-top";
    const voiceName = document.createElement("strong");
    voiceName.textContent = item.voice;
    const relative = document.createElement("span");
    relative.textContent = formatRelative(item.created_at);
    top.append(voiceName, relative);

    const meta = document.createElement("div");
    meta.className = "history-meta";
    meta.textContent = `${item.locale} · ${item.characters} chars · ${item.text_preview}`;

    const actions = document.createElement("div");
    actions.className = "history-actions";

    const playBtn = document.createElement("button");
    playBtn.type = "button";
    playBtn.dataset.action = "play";
    playBtn.dataset.id = item.id;
    playBtn.textContent = "Play";

    const downloadAnchor = document.createElement("a");
    downloadAnchor.href = item.audio_url;
    downloadAnchor.download = `${item.id}.mp3`;
    downloadAnchor.textContent = "Download";

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.dataset.action = "copy";
    copyBtn.dataset.id = item.id;
    copyBtn.textContent = "Copy Link";

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.dataset.action = "delete";
    deleteBtn.dataset.id = item.id;
    deleteBtn.textContent = "Delete";

    actions.append(playBtn, downloadAnchor, copyBtn, deleteBtn);
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

const copyText = async (text) => {
  await navigator.clipboard.writeText(text);
};

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = selectedPayload();
  if (!payload.text.trim()) {
    setStatus("Please enter a script first.", "error");
    return;
  }

  submitButton.disabled = true;
  setStatus("Generating speech...");

  try {
    const response = await fetch("/api/speak", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || "TTS request failed");
    }

    setCurrentOutput(data, `Generated with ${data.voice}.`);
    await Promise.all([loadHistory(), loadStats()]);
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

searchInput.addEventListener("input", reloadVoicesDebounced);
localeInput.addEventListener("input", reloadVoicesDebounced);
genderSelect.addEventListener("change", reloadVoicesDebounced);
voiceSelect.addEventListener("change", updateApiPreview);

rateInput.addEventListener("input", () => {
  rateValue.textContent = `${rateInput.value}%`;
  updateApiPreview();
});

pitchInput.addEventListener("input", () => {
  pitchValue.textContent = `${pitchInput.value}Hz`;
  updateApiPreview();
});

textInput.addEventListener("input", () => {
  updateTextMetrics();
  updateApiPreview();
});

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

presetsContainer.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  if (!target.classList.contains("preset-chip")) {
    return;
  }

  const presetText = target.dataset.text || "";
  const presetLocale = target.dataset.locale || "";
  textInput.value = presetText;
  if (presetLocale) {
    localeInput.value = presetLocale;
    reloadVoicesDebounced();
  }

  updateTextMetrics();
  updateApiPreview();
  setStatus(`Loaded preset: ${target.textContent || "script"}.`, "ok");
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
    setCurrentOutput(item, "Loaded clip from history.");
    return;
  }

  if (action === "copy") {
    try {
      await copyText(new URL(item.audio_url, window.location.origin).href);
      setStatus("Audio link copied.", "ok");
    } catch {
      setStatus("Failed to copy audio link.", "error");
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
    setStatus("Generate or select an item first.", "error");
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
    setStatus("cURL snippet copied.", "ok");
  } catch {
    setStatus("Copy failed.", "error");
  }
});

const initialize = async () => {
  updateTextMetrics();
  updateApiPreview();

  try {
    await Promise.all([loadPresets(), loadVoices(), loadHistory(), loadStats()]);
    if (state.history.length) {
      setCurrentOutput(state.history[0]);
    }
    setStatus("Studio ready.", "ok");
  } catch (error) {
    setStatus(error.message || "Failed to initialize studio", "error");
  }
};

initialize();
