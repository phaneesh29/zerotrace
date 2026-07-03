// Tab switching
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

function setStatus(el, message, kind) {
  el.textContent = message;
  el.className = 'status' + (kind ? ' ' + kind : '');
}

// --- Encode ---
const encodeBtn = document.getElementById('encode-btn');
const promptInput = document.getElementById('prompt');
const encodeStatus = document.getElementById('encode-status');
const encodeResults = document.getElementById('encode-results');
const generatedTextEl = document.getElementById('generated-text');
const watermarkedTextEl = document.getElementById('watermarked-text');
const encodePayloadEl = document.getElementById('encode-payload');
const copyBtn = document.getElementById('copy-watermarked');

encodeBtn.addEventListener('click', async () => {
  const prompt = promptInput.value.trim();
  if (!prompt) {
    setStatus(encodeStatus, 'Please enter a prompt.', 'error');
    return;
  }

  encodeBtn.disabled = true;
  encodeResults.classList.add('hidden');
  setStatus(encodeStatus, 'Generating and watermarking...', 'loading');

  try {
    const res = await fetch('/api/encode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Encode request failed.');
    }

    generatedTextEl.value = data.generatedText;
    watermarkedTextEl.value = data.watermarkedText;
    encodePayloadEl.textContent = JSON.stringify(data.payload, null, 2);
    encodeResults.classList.remove('hidden');
    setStatus(encodeStatus, 'Done.', 'ok');
  } catch (err) {
    setStatus(encodeStatus, err.message, 'error');
  } finally {
    encodeBtn.disabled = false;
  }
});

copyBtn.addEventListener('click', async () => {
  await navigator.clipboard.writeText(watermarkedTextEl.value);
  copyBtn.textContent = 'Copied!';
  setTimeout(() => (copyBtn.textContent = 'Copy Watermarked Text'), 1500);
});

// --- Decode ---
const decodeBtn = document.getElementById('decode-btn');
const decodeInput = document.getElementById('decode-input');
const decodeStatus = document.getElementById('decode-status');
const decodeResults = document.getElementById('decode-results');

const rDetected = document.getElementById('r-detected');
const rSig = document.getElementById('r-sig');
const rConf = document.getElementById('r-conf');
const rIntegrity = document.getElementById('r-integrity');
const eccBlock = document.getElementById('ecc-block');
const warningsBlock = document.getElementById('warnings-block');
const decodePayloadEl = document.getElementById('decode-payload');

function setValue(el, value, goodWhenTrue) {
  el.textContent = String(value);
  el.classList.remove('good', 'bad');
  if (typeof value === 'boolean') {
    el.classList.add(value === goodWhenTrue ? 'good' : 'bad');
  }
}

decodeBtn.addEventListener('click', async () => {
  const text = decodeInput.value;
  if (!text) {
    setStatus(decodeStatus, 'Please paste some text.', 'error');
    return;
  }

  decodeBtn.disabled = true;
  decodeResults.classList.add('hidden');
  setStatus(decodeStatus, 'Running detection...', 'loading');

  try {
    const res = await fetch('/api/decode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Decode request failed.');
    }

    setValue(rDetected, data.detected, true);
    setValue(rSig, data.signatureValid, true);
    rConf.textContent = data.confidence;
    rIntegrity.textContent = data.integrityScore;

    if (data.ecc) {
      eccBlock.textContent =
        `ECC Repairs: BCH ${data.ecc.bchBitsCorrected} bit(s), ` +
        `RS ${data.ecc.rsBytesCorrected} byte(s), ` +
        `${data.ecc.uncorrectableBlocks} block(s) beyond repair`;
    } else {
      eccBlock.textContent = '';
    }

    if (data.warnings && data.warnings.length > 0) {
      warningsBlock.innerHTML = '<strong>Warnings:</strong><ul>' +
        data.warnings.map((w) => `<li>${w}</li>`).join('') + '</ul>';
    } else {
      warningsBlock.innerHTML = '';
    }

    decodePayloadEl.textContent = data.recoveredPayload
      ? JSON.stringify(data.recoveredPayload, null, 2)
      : 'No payload recovered.';

    decodeResults.classList.remove('hidden');
    setStatus(decodeStatus, 'Done.', 'ok');
  } catch (err) {
    setStatus(decodeStatus, err.message, 'error');
  } finally {
    decodeBtn.disabled = false;
  }
});
