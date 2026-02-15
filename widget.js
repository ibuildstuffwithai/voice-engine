/**
 * Voice Engine Widget
 * 
 * Embeddable voice call button for any web page.
 * Drop this script + call VoiceWidget.init() to add voice calling to your app.
 * 
 * Usage:
 *   <script src="/voice-widget.js"></script>
 *   <script>
 *     VoiceWidget.init({
 *       serverUrl: 'ws://localhost:3460',
 *       voice: 'NATF2',
 *       persona: 'You are a helpful assistant.',
 *       agentName: 'Nova',
 *       agentAvatar: '/img/nova.png',
 *       theme: 'dark', // 'dark' or 'light'
 *       position: 'bottom-right', // 'bottom-right', 'bottom-left', 'inline'
 *       containerId: null, // For inline mode, mount inside this element
 *     });
 *   </script>
 */

(function() {
  'use strict';

  const DEFAULT_CONFIG = {
    serverUrl: `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}`,
    voice: 'NATF2',
    persona: 'You are a helpful AI assistant.',
    agentName: 'AI Agent',
    agentAvatar: null,
    theme: 'dark',
    position: 'bottom-right',
    containerId: null,
    accentColor: '#c026d3',
  };

  let config = {};
  let state = {
    isActive: false,
    isConnecting: false,
    ws: null,
    mediaStream: null,
    audioContext: null,
    analyser: null,
    processor: null,
    sessionId: null,
    duration: 0,
    durationInterval: null,
  };

  function init(userConfig = {}) {
    config = { ...DEFAULT_CONFIG, ...userConfig };
    injectStyles();
    createUI();
  }

  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .ve-widget { font-family: 'Inter', -apple-system, sans-serif; z-index: 10000; }
      .ve-widget.bottom-right { position: fixed; bottom: 24px; right: 24px; }
      .ve-widget.bottom-left { position: fixed; bottom: 24px; left: 24px; }

      .ve-fab {
        width: 56px; height: 56px; border-radius: 50%; border: none; cursor: pointer;
        background: ${config.accentColor}; color: white; font-size: 24px;
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 4px 20px rgba(192, 38, 211, 0.4);
        transition: all 0.3s; position: relative;
      }
      .ve-fab:hover { transform: scale(1.08); box-shadow: 0 6px 28px rgba(192, 38, 211, 0.6); }
      .ve-fab.active { background: #ef4444; animation: ve-pulse 2s infinite; }

      @keyframes ve-pulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5); }
        50% { box-shadow: 0 0 0 12px rgba(239, 68, 68, 0); }
      }

      .ve-panel {
        position: absolute; bottom: 68px; right: 0; width: 320px;
        background: ${config.theme === 'dark' ? '#1a1a1e' : '#ffffff'};
        border: 1px solid ${config.theme === 'dark' ? '#2a2a2e' : '#e5e5e5'};
        border-radius: 16px; padding: 24px; display: none;
        box-shadow: 0 8px 40px rgba(0,0,0,0.3);
        color: ${config.theme === 'dark' ? '#e0e0e0' : '#1a1a1a'};
      }
      .ve-panel.open { display: block; }

      .ve-agent { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
      .ve-agent-avatar {
        width: 48px; height: 48px; border-radius: 50%;
        background: ${config.accentColor}22; display: flex; align-items: center;
        justify-content: center; font-size: 20px; flex-shrink: 0;
      }
      .ve-agent-avatar img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
      .ve-agent-name { font-weight: 600; font-size: 16px; }
      .ve-agent-status { font-size: 12px; color: #888; }
      .ve-agent-status.active { color: #22c55e; }

      .ve-timer { text-align: center; font-size: 32px; font-weight: 300; font-variant-numeric: tabular-nums; margin: 16px 0; letter-spacing: 2px; }

      .ve-visualizer { width: 100%; height: 40px; border-radius: 8px; background: ${config.theme === 'dark' ? '#111114' : '#f5f5f5'}; margin-bottom: 16px; }

      .ve-call-btn {
        width: 100%; padding: 12px; border: none; border-radius: 10px; font-size: 15px;
        font-weight: 600; cursor: pointer; transition: all 0.2s; font-family: inherit;
      }
      .ve-call-btn.start { background: ${config.accentColor}; color: white; }
      .ve-call-btn.start:hover { filter: brightness(1.1); }
      .ve-call-btn.end { background: #ef4444; color: white; }
      .ve-call-btn.end:hover { background: #dc2626; }
    `;
    document.head.appendChild(style);
  }

  function createUI() {
    const container = config.containerId
      ? document.getElementById(config.containerId)
      : document.body;

    const widget = document.createElement('div');
    widget.className = `ve-widget ${config.position}`;
    widget.innerHTML = `
      <div class="ve-panel" id="ve-panel">
        <div class="ve-agent">
          <div class="ve-agent-avatar" id="ve-avatar">
            ${config.agentAvatar ? `<img src="${config.agentAvatar}" alt="">` : '🎙️'}
          </div>
          <div>
            <div class="ve-agent-name">${config.agentName}</div>
            <div class="ve-agent-status" id="ve-status">Ready to call</div>
          </div>
        </div>
        <div class="ve-timer" id="ve-timer" style="display:none">00:00</div>
        <canvas class="ve-visualizer" id="ve-visualizer"></canvas>
        <button class="ve-call-btn start" id="ve-call-btn">Start Call</button>
      </div>
      <button class="ve-fab" id="ve-fab" title="Voice Call">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
        </svg>
      </button>
    `;
    container.appendChild(widget);

    // Event listeners
    document.getElementById('ve-fab').onclick = togglePanel;
    document.getElementById('ve-call-btn').onclick = toggleCall;

    // Init canvas
    const canvas = document.getElementById('ve-visualizer');
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);
    ctx.fillStyle = config.theme === 'dark' ? '#111114' : '#f5f5f5';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function togglePanel() {
    const panel = document.getElementById('ve-panel');
    panel.classList.toggle('open');
  }

  async function toggleCall() {
    if (state.isActive) {
      endCall();
    } else {
      await startCall();
    }
  }

  async function startCall() {
    const btn = document.getElementById('ve-call-btn');
    const fab = document.getElementById('ve-fab');
    const statusEl = document.getElementById('ve-status');
    const timerEl = document.getElementById('ve-timer');

    try {
      state.isConnecting = true;
      statusEl.textContent = 'Connecting...';
      statusEl.className = 'vce-agent-status';

      // Get mic
      state.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 24000, channelCount: 1, echoCancellation: true, noiseSuppression: true }
      });

      state.audioContext = new AudioContext({ sampleRate: 24000 });
      const source = state.audioContext.createMediaStreamSource(state.mediaStream);
      state.analyser = state.audioContext.createAnalyser();
      state.analyser.fftSize = 256;
      source.connect(state.analyser);

      // WebSocket
      state.ws = new WebSocket(`${config.serverUrl}/voice`);
      state.ws.binaryType = 'arraybuffer';

      state.ws.onopen = () => {
        state.ws.send(JSON.stringify({
          type: 'start',
          voice: config.voice,
          persona: config.persona,
          agentId: config.agentName,
        }));
      };

      state.ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
          const msg = JSON.parse(event.data);
          if (msg.type === 'connected') {
            state.isActive = true;
            state.isConnecting = false;
            statusEl.textContent = 'Connected';
            statusEl.className = 've-agent-status active';
            timerEl.style.display = 'block';
            startTimer();
            startAudioCapture();
            startVisualization();
          } else if (msg.type === 'session_created') {
            state.sessionId = msg.id;
            statusEl.textContent = 'Connecting to backend...';
          } else if (msg.type === 'error') {
            statusEl.textContent = msg.message;
            endCall();
          }
        } else {
          playAudio(event.data);
        }
      };

      state.ws.onclose = () => { if (state.isActive) endCall(); };
      state.ws.onerror = () => { statusEl.textContent = 'Connection failed'; endCall(); };

      btn.textContent = 'End Call';
      btn.className = 've-call-btn end';
      fab.classList.add('active');

    } catch (e) {
      statusEl.textContent = `Error: ${e.message}`;
      state.isConnecting = false;
    }
  }

  function startAudioCapture() {
    if (!state.audioContext || !state.mediaStream) return;
    const source = state.audioContext.createMediaStreamSource(state.mediaStream);
    state.processor = state.audioContext.createScriptProcessor(4096, 1, 1);
    state.processor.onaudioprocess = (e) => {
      if (state.ws?.readyState === WebSocket.OPEN) {
        const f32 = e.inputBuffer.getChannelData(0);
        const i16 = new Int16Array(f32.length);
        for (let i = 0; i < f32.length; i++) {
          i16[i] = Math.max(-32768, Math.min(32767, Math.floor(f32[i] * 32768)));
        }
        state.ws.send(i16.buffer);
      }
    };
    source.connect(state.processor);
    state.processor.connect(state.audioContext.destination);
  }

  function playAudio(buf) {
    try {
      if (!state.audioContext) return;
      const i16 = new Int16Array(buf);
      const f32 = new Float32Array(i16.length);
      for (let i = 0; i < i16.length; i++) f32[i] = i16[i] / 32768;
      const ab = state.audioContext.createBuffer(1, f32.length, 24000);
      ab.getChannelData(0).set(f32);
      const src = state.audioContext.createBufferSource();
      src.buffer = ab;
      src.connect(state.audioContext.destination);
      src.start();
    } catch(e) {}
  }

  function startTimer() {
    state.duration = 0;
    const timerEl = document.getElementById('ve-timer');
    state.durationInterval = setInterval(() => {
      state.duration++;
      const m = String(Math.floor(state.duration / 60)).padStart(2, '0');
      const s = String(state.duration % 60).padStart(2, '0');
      timerEl.textContent = `${m}:${s}`;
    }, 1000);
  }

  function startVisualization() {
    const canvas = document.getElementById('ve-visualizer');
    const ctx = canvas.getContext('2d');
    const bufLen = state.analyser.frequencyBinCount;
    const data = new Uint8Array(bufLen);
    const bg = config.theme === 'dark' ? '#111114' : '#f5f5f5';

    function draw() {
      if (!state.isActive) return;
      requestAnimationFrame(draw);
      state.analyser.getByteFrequencyData(data);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width / 2, canvas.height / 2);
      const w = (canvas.width / 2 / bufLen) * 2.5;
      let x = 0;
      for (let i = 0; i < bufLen; i++) {
        const h = (data[i] / 255) * (canvas.height / 2);
        ctx.fillStyle = config.accentColor;
        ctx.globalAlpha = 0.6 + (data[i] / 255) * 0.4;
        ctx.fillRect(x, canvas.height / 2 - h, w - 1, h);
        x += w;
      }
      ctx.globalAlpha = 1;
    }
    draw();
  }

  function endCall() {
    state.isActive = false;
    state.isConnecting = false;
    if (state.ws) { try { state.ws.close(); } catch(e) {} state.ws = null; }
    if (state.processor) { try { state.processor.disconnect(); } catch(e) {} state.processor = null; }
    if (state.mediaStream) { state.mediaStream.getTracks().forEach(t => t.stop()); state.mediaStream = null; }
    if (state.audioContext) { try { state.audioContext.close(); } catch(e) {} state.audioContext = null; }
    if (state.durationInterval) { clearInterval(state.durationInterval); state.durationInterval = null; }
    state.analyser = null;

    const btn = document.getElementById('ve-call-btn');
    const fab = document.getElementById('ve-fab');
    const statusEl = document.getElementById('ve-status');
    const timerEl = document.getElementById('ve-timer');

    if (btn) { btn.textContent = 'Start Call'; btn.className = 've-call-btn start'; }
    if (fab) fab.classList.remove('active');
    if (statusEl) { statusEl.textContent = 'Ready to call'; statusEl.className = 've-agent-status'; }
    if (timerEl) timerEl.style.display = 'none';
  }

  // Expose globally
  window.VoiceWidget = { init, startCall, endCall, getState: () => state };
})();
