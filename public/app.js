document.addEventListener('DOMContentLoaded', () => {
  const keysTableBody = document.getElementById('keys-table-body');
  const generatorForm = document.getElementById('generator-form');
  const keyLabelInput = document.getElementById('key-label');
  const keyDurationSelect = document.getElementById('key-duration');
  const scriptContentTextarea = document.getElementById('script-content');
  const saveScriptBtn = document.getElementById('save-script-btn');
  const copyLoaderBtn = document.getElementById('copy-loader-btn');
  const loaderCodeDisplay = document.getElementById('loader-code-display');

  let selectedKeyForLoader = "XD-YOUR-KEY-HERE";
  let loaderTemplateRaw = "";

  // Get base server URL (useful if deployed)
  const API_BASE = window.location.origin;

  // Initialize and Fetch Initial Dashboard Data
  fetchKeys();
  fetchScriptConfig();
  loadLoaderTemplate();

  // Load the Raw Loader Template
  async function loadLoaderTemplate() {
    try {
      const response = await fetch('../loader_template.lua');
      if (response.ok) {
        loaderTemplateRaw = await response.text();
      } else {
        // Fallback if file fetch fails
        loaderTemplateRaw = `-- [XD Loader Fallback]\nlocal LICENSE_KEY = "XD-YOUR-KEY-HERE"\nlocal SERVER_URL = "http://localhost:3005"\nif not game or not game.HttpGet then error("No HttpGet support") end\nloadstring(game:HttpGet(SERVER_URL .. "/api/validate?key=" .. LICENSE_KEY))()`;
      }
      updateLoaderCodeDisplay();
    } catch (e) {
      console.error("Error loading Lua template", e);
    }
  }

  // Update visual code snippet for loader integration
  function updateLoaderCodeDisplay() {
    if (!loaderTemplateRaw) return;
    let code = loaderTemplateRaw;
    code = code.replace('local LICENSE_KEY = "XD-YOUR-KEY-HERE"', `local LICENSE_KEY = "${selectedKeyForLoader}"`);
    code = code.replace('local SERVER_URL = "http://localhost:3005"', `local SERVER_URL = "${API_BASE}"`);
    loaderCodeDisplay.textContent = code;
  }

  // Retrieve keys list from backend
  async function fetchKeys() {
    try {
      const res = await fetch(`${API_BASE}/api/keys`);
      const keys = await res.json();
      renderKeys(keys);
    } catch (err) {
      console.error("Failed to load keys", err);
    }
  }

  // Retrieve script configuration
  async function fetchScriptConfig() {
    try {
      const res = await fetch(`${API_BASE}/api/config`);
      const config = await res.json();
      scriptContentTextarea.value = config.scriptContent;
    } catch (err) {
      console.error("Failed to load script configurations", err);
    }
  }

  // Render list of keys in DOM table
  function renderKeys(keys) {
    keysTableBody.innerHTML = '';
    
    if (keys.length === 0) {
      keysTableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">
            No licenses issued yet. Use the panel on the left to generate one.
          </td>
        </tr>
      `;
      return;
    }

    // Sort: newest first
    keys.sort((a, b) => b.createdAt - a.createdAt);

    keys.forEach(k => {
      const tr = document.createElement('tr');
      
      const createdStr = new Date(k.createdAt).toLocaleDateString();
      const expiresStr = k.expiresAt 
        ? new Date(k.expiresAt).toLocaleString() 
        : 'Forever';
      
      let statusBadge = '<span class="badge badge-active">Active</span>';
      if (!k.isActive) {
        statusBadge = '<span class="badge badge-suspended">Suspended</span>';
      } else if (k.expiresAt && Date.now() > k.expiresAt) {
        statusBadge = '<span class="badge badge-expired">Expired</span>';
      }

      const lastUsedStr = k.lastUsed 
        ? new Date(k.lastUsed).toLocaleTimeString() 
        : 'Never';

      tr.innerHTML = `
        <td><strong>${escapeHtml(k.label)}</strong></td>
        <td><span class="key-code clickable-key" title="Click to use in Loader snippet">${k.key}</span></td>
        <td>${createdStr}</td>
        <td>${expiresStr}</td>
        <td>${statusBadge}</td>
        <td><span title="IP History: ${k.ipHistory.join(', ') || 'None'}">${lastUsedStr}</span></td>
        <td>
          <div class="actions-cell">
            <button class="btn-action-icon copy-key-btn" title="Copy Key">📋</button>
            <button class="btn-action-icon toggle-key-btn ${k.isActive ? 'suspended' : 'active'}" title="${k.isActive ? 'Revoke' : 'Activate'}">
              ${k.isActive ? '🛑' : '✅'}
            </button>
            <button class="btn-action-icon danger delete-key-btn" title="Delete Permanent">🗑️</button>
          </div>
        </td>
      `;

      // Click key to load it into loader code
      tr.querySelector('.clickable-key').addEventListener('click', () => {
        selectedKeyForLoader = k.key;
        updateLoaderCodeDisplay();
        showNotification(`Loader key set to: ${k.key}`);
      });

      // Action Handlers
      tr.querySelector('.copy-key-btn').addEventListener('click', () => {
        navigator.clipboard.writeText(k.key);
        showNotification("Key copied to clipboard!");
      });

      tr.querySelector('.toggle-key-btn').addEventListener('click', () => {
        toggleKeyStatus(k.key);
      });

      tr.querySelector('.delete-key-btn').addEventListener('click', () => {
        if (confirm("Are you sure you want to permanently delete this license?")) {
          deleteKey(k.key);
        }
      });

      keysTableBody.appendChild(tr);
    });
  }

  // Handle Form Submission - Key Generation
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
        showNotification("License key generated successfully!");
      }
    } catch (err) {
      console.error(err);
      showNotification("Error generating key", true);
    }
  });

  // Save Script payload configuration
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
        showNotification("Target script payload saved successfully!");
      }
    } catch (err) {
      console.error(err);
      showNotification("Failed to save script content", true);
    }
  });

  // Copy loader code script
  copyLoaderBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(loaderCodeDisplay.textContent);
    showNotification("Loader code copied successfully!");
  });

  // API Call - Suspend / Revoke key status
  async function toggleKeyStatus(key) {
    try {
      await fetch(`${API_BASE}/api/keys/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key })
      });
      fetchKeys();
      showNotification("Key state updated");
    } catch (err) {
      console.error(err);
    }
  }

  // API Call - Remove key entirely
  async function deleteKey(key) {
    try {
      await fetch(`${API_BASE}/api/keys/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key })
      });
      fetchKeys();
      showNotification("Key deleted");
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
      background: isError ? 'var(--error-color)' : 'linear-gradient(135deg, var(--accent-purple), var(--accent-blue))',
      color: '#fff',
      padding: '0.8rem 1.6rem',
      borderRadius: '8px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      fontSize: '0.9rem',
      fontWeight: '600',
      zIndex: '1000',
      transition: 'opacity 0.3s ease, transform 0.3s ease',
      transform: 'translateY(20px)',
      opacity: '0'
    });

    // Animate in
    setTimeout(() => {
      notif.style.transform = 'translateY(0)';
      notif.style.opacity = '1';
    }, 50);

    // Fade out and remove
    setTimeout(() => {
      notif.style.transform = 'translateY(20px)';
      notif.style.opacity = '0';
      setTimeout(() => notif.remove(), 300);
    }, 3000);
  }
});
