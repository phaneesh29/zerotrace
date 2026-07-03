// --- Main Tab Switching ---
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// --- Result Sub-Tab Switching (Markdown Preview vs Raw) ---
document.querySelectorAll('.subtab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.subtab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.subtab-panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.subtab).classList.add('active');
  });
});

// Helper for UI status messages
function setStatus(el, message, kind) {
  el.textContent = message;
  el.className = 'status' + (kind ? ' ' + kind : '');
}

// Helper for digital forensics cards styling
function setValue(el, value, goodWhenTrue) {
  el.textContent = String(value);
  el.classList.remove('good', 'bad');
  if (typeof value === 'boolean') {
    el.classList.add(value === goodWhenTrue ? 'good' : 'bad');
  }
}

// --- Encode Flow ---
const encodeBtn = document.getElementById('encode-btn');
const promptInput = document.getElementById('prompt');
const encodeStatus = document.getElementById('encode-status');
const encodeResults = document.getElementById('encode-results');
const generatedTextEl = document.getElementById('generated-text');
const watermarkedTextEl = document.getElementById('watermarked-text');
const renderedMarkdownEl = document.getElementById('rendered-markdown');
const encodePayloadEl = document.getElementById('encode-payload');
const copyBtn = document.getElementById('copy-watermarked');

encodeBtn.addEventListener('click', async () => {
  const prompt = promptInput.value.trim();
  if (!prompt) {
    setStatus(encodeStatus, 'Error: Prompt cannot be empty.', 'error');
    return;
  }

  encodeBtn.disabled = true;
  encodeResults.classList.add('hidden');
  setStatus(encodeStatus, 'Contacting generation engine & signing payload...', 'loading');

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

    // Populate fields
    generatedTextEl.value = data.generatedText;
    watermarkedTextEl.value = data.watermarkedText;
    encodePayloadEl.textContent = JSON.stringify(data.payload, null, 2);
    
    // Render Markdown using marked.js
    if (window.marked && typeof window.marked.parse === 'function') {
      renderedMarkdownEl.innerHTML = window.marked.parse(data.generatedText);
    } else {
      renderedMarkdownEl.innerHTML = `<p>${data.generatedText.replace(/\n/g, '<br>')}</p>`;
    }

    encodeResults.classList.remove('hidden');
    setStatus(encodeStatus, 'Watermark injected successfully.', 'ok');
  } catch (err) {
    setStatus(encodeStatus, err.message, 'error');
  } finally {
    encodeBtn.disabled = false;
  }
});

// Copy button behavior
copyBtn.addEventListener('click', async () => {
  await navigator.clipboard.writeText(watermarkedTextEl.value);
  copyBtn.textContent = 'Copied!';
  copyBtn.classList.add('ok');
  setTimeout(() => {
    copyBtn.textContent = 'Copy Output';
    copyBtn.classList.remove('ok');
  }, 2000);
});

// --- Decode / Verification Flow ---
const decodeBtn = document.getElementById('decode-btn');
const decodeInput = document.getElementById('decode-input');
const decodeStatus = document.getElementById('decode-status');
const decodeResults = document.getElementById('decode-results');

const rDetected = document.getElementById('r-detected');
const rSig = document.getElementById('r-sig');
const rConf = document.getElementById('r-conf');
const rIntegrity = document.getElementById('r-integrity');
const eccBlock = document.getElementById('ecc-block');
const eccHealthBar = document.getElementById('ecc-health-bar');
const warningsBlock = document.getElementById('warnings-block');
const decodePayloadEl = document.getElementById('decode-payload');
const tamperAlert = document.getElementById('tamper-alert');
const alertMsg = document.getElementById('alert-msg');

decodeBtn.addEventListener('click', async () => {
  const text = decodeInput.value;
  if (!text) {
    setStatus(decodeStatus, 'Error: Paste some text block to analyze.', 'error');
    return;
  }

  decodeBtn.disabled = true;
  decodeResults.classList.add('hidden');
  setStatus(decodeStatus, 'Analyzing zero-width channels and checking signature...', 'loading');

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

    // Set stat card values
    setValue(rDetected, data.detected, true);
    setValue(rSig, data.signatureValid, true);
    
    // Confidence and Integrity score formatting
    rConf.textContent = (data.confidence * 100).toFixed(0) + '%';
    rIntegrity.textContent = (data.integrityScore * 100).toFixed(0) + '%';
    
    // Set colors for confidence and integrity
    rConf.className = 'value' + (data.confidence > 0.8 ? ' good' : data.confidence > 0.4 ? ' warn' : ' bad');
    rIntegrity.className = 'value' + (data.integrityScore === 1.0 ? ' good' : data.integrityScore > 0.5 ? ' warn' : ' bad');

    // Telemetry and Health Bar
    if (data.ecc) {
      eccBlock.innerHTML = 
        `<strong>Inner Code (BCH):</strong> Repaired ${data.ecc.bchBitsCorrected} bit(s)<br>` +
        `<strong>Outer Code (RS):</strong> Repaired ${data.ecc.rsBytesCorrected} byte(s)<br>` +
        `<strong>Uncorrectable Blocks:</strong> ${data.ecc.uncorrectableBlocks} block(s)`;

      // Calculate health percentage
      let health = 100;
      eccHealthBar.className = 'progress-bar';
      
      if (data.ecc.uncorrectableBlocks > 0) {
        health = Math.max(10, 100 - (data.ecc.uncorrectableBlocks * 20));
        eccHealthBar.classList.add('danger');
      } else if (data.ecc.totalCorrections > 0) {
        health = Math.max(30, 100 - (data.ecc.totalCorrections * 3));
        eccHealthBar.classList.add('warning');
      }
      eccHealthBar.style.width = health + '%';
    } else {
      eccBlock.textContent = 'No telemetry available.';
      eccHealthBar.style.width = '0%';
    }

    // Warnings list
    if (data.warnings && data.warnings.length > 0) {
      warningsBlock.innerHTML = '<strong>Security Warnings:</strong><ul>' +
        data.warnings.map((w) => `<li>${w}</li>`).join('') + '</ul>';
      warningsBlock.style.display = 'block';
    } else {
      warningsBlock.innerHTML = '';
      warningsBlock.style.display = 'none';
    }

    // Set Tamper Alert Status Banner
    const isTampered = !data.detected || !data.signatureValid || (data.warnings && data.warnings.length > 0) || (data.ecc && data.ecc.uncorrectableBlocks > 0);
    if (isTampered) {
      tamperAlert.className = 'alert-banner error-alert';
      if (!data.detected) {
        alertMsg.textContent = 'No valid ZeroTrace watermark was detected in this text.';
        document.querySelector('.alert-title').textContent = 'No Watermark Detected';
      } else {
        const reasons = [];
        if (!data.signatureValid) reasons.push('the cryptographic signature is invalid (authenticity compromised)');
        if (data.ecc && data.ecc.uncorrectableBlocks > 0) reasons.push('data blocks are uncorrectable (heavy modifications)');
        if (data.warnings.some(w => w.includes('hash mismatch'))) reasons.push('document content mismatch (text edits detected)');
        
        alertMsg.textContent = `Watermark detected, but validation failed: ${reasons.join(', ')}.`;
        document.querySelector('.alert-title').textContent = 'Verification Failed';
      }
    } else {
      tamperAlert.className = 'alert-banner success-alert';
      alertMsg.textContent = 'Validation complete: Cryptographic signature is verified and the document is 100% unmodified.';
      document.querySelector('.alert-title').textContent = 'Verification Successful';
    }

    // Payload display
    decodePayloadEl.textContent = data.recoveredPayload
      ? JSON.stringify(data.recoveredPayload, null, 2)
      : 'No payload recovered.';

    decodeResults.classList.remove('hidden');
    setStatus(decodeStatus, 'Forensics analysis complete.', 'ok');
  } catch (err) {
    setStatus(decodeStatus, err.message, 'error');
  } finally {
    decodeBtn.disabled = false;
  }
});
