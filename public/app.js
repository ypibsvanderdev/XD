document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const navItems = document.querySelectorAll('.nav-item');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const pageTitle = document.getElementById('page-title');
  const pageDesc = document.getElementById('page-desc');

  const keysTableBody = document.getElementById('keys-table-body');
  const telemetryTableBody = document.getElementById('telemetry-table-body');
  const generatorForm = document.getElementById('generator-form');
  const keyLabelInput = document.getElementById('key-label');
  const keyDurationSelect = document.getElementById('key-duration');
  
  const scriptContentTextarea = document.getElementById('script-content');
  const editorGutter = document.querySelector('.editor-gutter');
  const saveScriptBtn = document.getElementById('save-script-btn');
  
  const copyLoaderBtn = document.getElementById('copy-loader-btn');
  const loaderCodeDisplay = document.getElementById('loader-code-display');

  // Stats Counters
  const statTotalKeys = document.getElementById('stat-total-keys');
  const statActiveKeys = document.getElementById('stat-active-keys');
  const statTotalHits = document.getElementById('stat-total-hits');

  let selectedKeyForLoader = "XD-YOUR-KEY-HERE";
  let loaderTemplateRaw = "";
  const API_BASE = window.location.origin;

  // Page titles dictionary
  const pageDetails = {
    dashboard: { title: "DRM Overview", desc: "Monitor licenses, metrics, and manage target scripts." },
    payload: { title: "Payload Compilation", desc: "Write product script payloads served to verified execution clients." },
    telemetry: { title: "Validation Analytics", desc: "Real-time audit logs of validating license check-ins and client telemetry." },
    integration: { title: "Integration Hub", desc: "Copy client loader script templates to link inside your project." }
  };

  // 1. Navigation Tab Switching
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tabId = item.getAttribute('data-tab');
      
      // Update sidebar nav states
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');

      // Show/Hide Panes
      tabPanes.forEach(pane => pane.classList.remove('active'));
      const activePane = document.getElementById(`tab-${tabId}`);
      if (activePane) activePane.classList.add('active');

      // Update titles
      const info = pageDetails[tabId];
      if (info) {
        pageTitle.textContent = info.title;
        pageDesc.textContent = info.desc;
      }
    });
  });

  // 2. Editor Gutter Line Number Calculation
  function updateEditorGutter() {
    const lines = scriptContentTextarea.value.split('\n').length;
    let gutterHTML = '';
    for (let i = 1; i <= Math.max(lines, 1); i++) {
      gutterHTML += `<span class="gutter-num">${i}</span>`;
    }
    editorGutter.innerHTML = gutterHTML;
  }

  scriptContentTextarea.addEventListener('input', updateEditorGutter);
  scriptContentTextarea.addEventListener('scroll', () => {
    editorGutter.scrollTop = scriptContentTextarea.scrollTop;
  });

  // 3. API Requests & Key Management
  fetchKeys();
  fetchScriptConfig();
  loadLoaderTemplate();

  // Load the Lua template snippet
  async function loadLoaderTemplate() {
    try {
      const response = await fetch('../loader_template.lua');
      if (response.ok) {
        loaderTemplateRaw = await response.text();
      } else {
        loaderTemplateRaw = `-- [XD Loader Fallback]\nlocal LICENSE_KEY = "XD-YOUR-KEY-HERE"\nlocal SERVER_URL = "http://localhost:3005"\nif not game or not game.HttpGet then error("No HttpGet support") end\nloadstring(game:HttpGet(SERVER_URL .. "/api/validate?key=" .. LICENSE_KEY))()`;
      }
      updateLoaderCodeDisplay();
    } catch (e) {
      console.error("Error loading Lua template", e);
    }
  }

  function updateLoaderCodeDisplay() {
    if (!loaderTemplateRaw) return;
    let code = loaderTemplateRaw;
    code = code.replace('local LICENSE_KEY = "XD-YOUR-KEY-HERE"', `local LICENSE_KEY = "${selectedKeyForLoader}"`);
    code = code.replace('local SERVER_URL = "http://localhost:3005"', `local SERVER_URL = "${API_BASE}"`);
    loaderCodeDisplay.textContent = code;
  }

  async function fetchKeys() {
    try {
      const res = await fetch(`${API_BASE}/api/keys`);
      const keys = await res.json();
      renderKeys(keys);
      renderTelemetry(keys);
      calculateStats(keys);
    } catch (err) {
      console.error("Failed to load keys", err);
    }
  }

  async function fetchScriptConfig() {
    try {
      const res = await fetch(`${API_BASE}/api/config`);
      const config = await res.json();
      scriptContentTextarea.value = config.scriptContent;
      updateEditorGutter();
    } catch (err) {
      console.error("Failed to load script configs", err);
    }
  }

  // Calculate top bar metrics
  function calculateStats(keys) {
    let total = keys.length;
    let active = keys.filter(k => k.isActive && (!k.expiresAt || Date.now() < k.expiresAt)).length;
    let checkins = keys.reduce((acc, k) => acc + (k.lastUsed ? 1 : 0), 0); // basic tally of validated logs

    statTotalKeys.textContent = total;
    statActiveKeys.textContent = active;
    statTotalHits.textContent = checkins;
  }

  // Render Table: Keys
  function renderKeys(keys) {
    keysTableBody.innerHTML = '';
    
    if (keys.length === 0) {
      keysTableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2rem;">
            No active licenses found. Issue a key on the left to start.
          </td>
        </tr>
      `;
      return;
    }

    keys.sort((a, b) => b.createdAt - a.createdAt);

    keys.forEach(k => {
      const tr = document.createElement('tr');
      const expiresStr = k.expiresAt ? new Date(k.expiresAt).toLocaleDateString() : 'Forever';
      
      let statusBadge = '<span class="badge badge-active">Active</span>';
      if (!k.isActive) {
        statusBadge = '<span class="badge badge-suspended">Suspended</span>';
      } else if (k.expiresAt && Date.now() > k.expiresAt) {
        statusBadge = '<span class="badge badge-expired">Expired</span>';
      }

      tr.innerHTML = `
        <td><strong>${escapeHtml(k.label)}</strong></td>
        <td><span class="key-code clickable-key" title="Select for Loader integration">${k.key}</span></td>
        <td>${expiresStr}</td>
        <td>${statusBadge}</td>
        <td>
          <div class="actions-cell">
            <button class="btn-action-icon copy-key-btn" title="Copy Key">📋</button>
            <button class="btn-action-icon toggle-key-btn" title="${k.isActive ? 'Suspend' : 'Activate'}">
              ${k.isActive ? '🛑' : '✅'}
            </button>
            <button class="btn-action-icon danger delete-key-btn" title="Delete Permanent">🗑️</button>
          </div>
        </td>
      `;

      // Select key for loader script
      tr.querySelector('.clickable-key').addEventListener('click', () => {
        selectedKeyForLoader = k.key;
        updateLoaderCodeDisplay();
        showNotification(`Selected key loaded into loader snippet: ${k.key}`);
      });

      // Actions
      tr.querySelector('.copy-key-btn').addEventListener('click', () => {
        navigator.clipboard.writeText(k.key);
        showNotification("Key copied to clipboard!");
      });

      tr.querySelector('.toggle-key-btn').addEventListener('click', () => {
        toggleKeyStatus(k.key);
      });

      tr.querySelector('.delete-key-btn').addEventListener('click', () => {
        if (confirm("Are you sure you want to permanently delete this license key?")) {
          deleteKey(k.key);
        }
      });

      keysTableBody.appendChild(tr);
    });
  }

  // Render Table: Telemetry logs
  function renderTelemetry(keys) {
    telemetryTableBody.innerHTML = '';
    
    // Filter out keys that have never checked in
    const checkinKeys = keys.filter(k => k.lastUsed);

    if (checkinKeys.length === 0) {
      telemetryTableBody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2.5rem;">
            No check-in telemetry recorded yet. Clients must execute their loader scripts first.
          </td>
        </tr>
      `;
      return;
    }

    checkinKeys.sort((a, b) => b.lastUsed - a.lastUsed);

    checkinKeys.forEach(k => {
      const tr = document.createElement('tr');
      const lastUsedStr = new Date(k.lastUsed).toLocaleString();
      const ipHistoryStr = k.ipHistory.join(', ') || 'N/A';

      tr.innerHTML = `
        <td><strong>${escapeHtml(k.label)}</strong></td>
        <td><span class="key-code">${k.key}</span></td>
        <td>${lastUsedStr}</td>
        <td><span class="key-code" title="${ipHistoryStr}">${k.ipHistory[k.ipHistory.length - 1] || 'Unknown'}</span></td>
      `;
      telemetryTableBody.appendChild(tr);
    });
  }

  // Handle Form Submit: Generate License
  generatorForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const label = keyLabelInput.value.trim();
    const durationVal = keyDurationSelect.value;
    
    let durationMinutes = null;
    if (durationVal !== 'forever') {
      durationMinutes = parseInt(durationVal);
    }

    try {
      const response = await fetch(`${API_BASE}/api/keys/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, durationMinutes })
      });
      const data = await response.json();
      if (data.success) {
        keyLabelInput.value = '';
        selectedKeyForLoader = data.key.key;
        await fetchKeys();
        updateLoaderCodeDisplay();
        showNotification("Key generated successfully!");
      }
    } catch (err) {
      console.error(err);
      showNotification("Error generating license key", true);
    }
  });

  // Save Script Payload Content
  saveScriptBtn.addEventListener('click', async () => {
    const scriptContent = scriptContentTextarea.value;
    try {
      const response = await fetch(`${API_BASE}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptContent })
      });
      const data = await response.json();
      if (data.success) {
        showNotification("Script saved and encryption keys compiled!");
      }
    } catch (err) {
      console.error(err);
      showNotification("Failed to save script payload", true);
    }
  });

  // Copy loader script
  copyLoaderBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(loaderCodeDisplay.textContent);
    showNotification("Loader code copied to clipboard!");
  });

  async function toggleKeyStatus(key) {
    try {
      await fetch(`${API_BASE}/api/keys/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key })
      });
      fetchKeys();
      showNotification("License state updated");
    } catch (err) {
      console.error(err);
    }
  }

  async function deleteKey(key) {
    try {
      await fetch(`${API_BASE}/api/keys/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key })
      });
      fetchKeys();
      showNotification("License key deleted permanent");
    } catch (err) {
      console.error(err);
    }
  }

  // Helpers
  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function showNotification(msg, isError = false) {
    const notif = document.createElement('div');
    notif.className = `toast-notification ${isError ? 'error' : ''}`;
    notif.textContent = msg;
    document.body.appendChild(notif);
    
    // Style toast on the fly for elegance
    Object.assign(notif.style, {
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      background: isError ? 'var(--color-error)' : 'linear-gradient(135deg, var(--accent-neon-purple), var(--accent-neon-blue))',
      color: '#fff',
      padding: '0.85rem 1.6rem',
      borderRadius: '8px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      fontSize: '0.9rem',
      fontWeight: '600',
      zIndex: '1000',
      transition: 'opacity 0.3s ease, transform 0.3s ease',
      transform: 'translateY(20px)',
      opacity: '0'
    });

    setTimeout(() => {
      notif.style.transform = 'translateY(0)';
      notif.style.opacity = '1';
    }, 50);

    setTimeout(() => {
      notif.style.transform = 'translateY(20px)';
      notif.style.opacity = '0';
      setTimeout(() => notif.remove(), 300);
    }, 3000);
  }
});
