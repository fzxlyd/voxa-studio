const form = document.getElementById("tts-form");
const textInput = document.getElementById("text");
const voiceSelect = document.getElementById("voice");
const localeInput = document.getElementById("locale");
const rateInput = document.getElementById("rate");
const pitchInput = document.getElementById("pitch");
const rateValue = document.getElementById("rate-value");
const pitchValue = document.getElementById("pitch-value");
const statusText = document.getElementById("status");
const resultSection = document.getElementById("result");
const audioPlayer = document.getElementById("audio-player");
const downloadLink = document.getElementById("download");
const submitButton = document.getElementById("submit");

const setStatus = (message, isError = false) => {
  statusText.textContent = message;
  statusText.classList.toggle("error", isError);
};

const loadVoices = async (locale = "") => {
  setStatus("Loading voices...");

  const query = locale.trim() ? `?locale=${encodeURIComponent(locale.trim())}` : "";
  const response = await fetch(`/api/voices${query}`);

  if (!response.ok) {
    throw new Error(`Failed to load voices (${response.status})`);
  }

  const voices = await response.json();

  voiceSelect.innerHTML = "";

  if (voices.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No voices found";
    voiceSelect.append(option);
    setStatus("No voices available for this locale.", true);
    return;
  }

  for (const voice of voices) {
    const option = document.createElement("option");
    option.value = voice.short_name;
    option.textContent = `${voice.short_name} (${voice.locale})`;
    voiceSelect.append(option);
  }

  setStatus(`Loaded ${voices.length} voices.`);
};

localeInput.addEventListener("change", async () => {
  try {
    await loadVoices(localeInput.value);
  } catch (error) {
    setStatus(error.message || "Voice load failed", true);
  }
});

rateInput.addEventListener("input", () => {
  rateValue.textContent = rateInput.value;
});

pitchInput.addEventListener("input", () => {
  pitchValue.textContent = pitchInput.value;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  submitButton.disabled = true;
  setStatus("Generating speech...");

  try {
    const payload = {
      text: textInput.value,
      voice: voiceSelect.value || undefined,
      rate: Number.parseInt(rateInput.value, 10),
      pitch: Number.parseInt(pitchInput.value, 10),
      format: "mp3",
    };

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

    const audioUrl = data.audio_url;
    audioPlayer.src = audioUrl;
    downloadLink.href = audioUrl;
    resultSection.classList.remove("hidden");

    setStatus(`Generated with ${data.voice}.`);
  } catch (error) {
    setStatus(error.message || "Generation failed", true);
  } finally {
    submitButton.disabled = false;
  }
});

(async () => {
  try {
    await loadVoices();
  } catch (error) {
    setStatus(error.message || "Voice load failed", true);
  }
})();
