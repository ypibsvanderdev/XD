import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());


// In Vercel serverless environments, database.json needs to be written to /tmp if writeable persistence is tried (though transient)
// Locally, use the current project directory for full persistent storage.
const IS_VERCEL = process.env.VERCEL || process.env.NOW_BUILDER;
const DB_FILE = IS_VERCEL ? path.join('/tmp', 'database.json') : path.join(__dirname, '..', 'database.json');

// Initialize database file in /tmp if it doesn't exist
function initDb() {
  if (!fs.existsSync(DB_FILE)) {
    let novaContent = "print('Welcome to XD Licensed Script! Enjoy your execution.')\n-- Place your actual product script code here";
    try {
      const onedrivePath = 'c:/Users/meqda/OneDrive/Documents/hehehehe.txt';
      if (fs.existsSync(onedrivePath)) {
        novaContent = fs.readFileSync(onedrivePath, 'utf8');
      }
    } catch (err) {
      console.error("Could not read local copy of hehehehe.txt during DB initialization", err);
    }

    const defaultData = {
      keys: [],
      scripts: [
        {
          id: "nova-flash-tp",
          name: "Nova Flash TP",
          content: novaContent
        },
        {
          id: "default",
          name: "Default Script",
          content: "print('Welcome to XD Licensed Script! Enjoy your execution.')\n-- Place your actual product script code here"
        }
      ]
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2));
  }
}

function readDb() {
  initDb();
  try {
    const content = fs.readFileSync(DB_FILE, 'utf8');
    const db = JSON.parse(content);
    let modified = false;

    // Schema Migration
    if (db.config && !db.scripts) {
      db.scripts = [
        {
          id: "nova-flash-tp",
          name: "Nova Flash TP",
          content: db.config.scriptContent || ""
        },
        {
          id: "default",
          name: "Default Script",
          content: "print('Welcome to XD Licensed Script! Enjoy your execution.')\n-- Place your actual product script code here"
        }
      ];
      delete db.config;
      modified = true;
    }

    if (!db.scripts) {
      db.scripts = [
        {
          id: "default",
          name: "Default Script",
          content: "print('Welcome to XD Licensed Script! Enjoy your execution.')\n-- Place your actual product script code here"
        }
      ];
      modified = true;
    }

    if (db.keys) {
      db.keys.forEach(k => {
        if (!k.scriptId) {
          k.scriptId = "nova-flash-tp";
          modified = true;
        }
      });
    }

    if (modified) {
      writeDb(db);
    }

    return db;
  } catch (error) {
    console.error("Error reading database file, using fallback empty values", error);
    return { keys: [], scripts: [{ id: "default", name: "Default Script", content: "" }] };
  }
}

function writeDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error writing database file", error);
  }
}

// REST APIs for Dashboard Management
app.get('/api/keys', (req, res) => {
  const db = readDb();
  res.json(db.keys);
});

app.post('/api/keys/generate', (req, res) => {
  const { durationMinutes, label, scriptId } = req.body;
  const db = readDb();
  
  const key = `XD-${uuidv4().replace(/-/g, '').substring(0, 16).toUpperCase()}`;
  const createdAt = Date.now();
  
  let expiresAt = null; // null represents lifetime
  if (durationMinutes && typeof durationMinutes === 'number' && durationMinutes > 0) {
    expiresAt = createdAt + (durationMinutes * 60 * 1000);
  }
  
  // Resolve scriptId, default to first script if not found/provided
  let resolvedScriptId = scriptId || "nova-flash-tp";
  if (db.scripts && !db.scripts.some(s => s.id === resolvedScriptId)) {
    resolvedScriptId = db.scripts[0] ? db.scripts[0].id : "default";
  }
  
  const newKey = {
    key,
    label: label || 'Unnamed Key',
    scriptId: resolvedScriptId,
    createdAt,
    expiresAt,
    isActive: true,
    lastUsed: null,
    ipHistory: []
  };
  
  db.keys.push(newKey);
  writeDb(db);
  
  res.json({ success: true, key: newKey });
});

app.post('/api/keys/revoke', (req, res) => {
  const { key } = req.body;
  const db = readDb();
  
  const index = db.keys.findIndex(k => k.key === key);
  if (index !== -1) {
    db.keys[index].isActive = false;
    writeDb(db);
    return res.json({ success: true, message: "Key revoked successfully" });
  }
  
  res.status(404).json({ success: false, error: "Key not found" });
});

app.post('/api/keys/delete', (req, res) => {
  const { key } = req.body;
  const db = readDb();
  
  db.keys = db.keys.filter(k => k.key !== key);
  writeDb(db);
  res.json({ success: true });
});

app.get('/api/config', (req, res) => {
  const db = readDb();
  const nova = db.scripts.find(s => s.id === "nova-flash-tp") || db.scripts[0];
  res.json({ scriptContent: nova ? nova.content : "" });
});

app.post('/api/config', (req, res) => {
  const { scriptContent } = req.body;
  const db = readDb();
  const nova = db.scripts.find(s => s.id === "nova-flash-tp");
  if (nova) {
    nova.content = scriptContent || "";
  } else {
    db.scripts.push({ id: "nova-flash-tp", name: "Nova Flash TP", content: scriptContent || "" });
  }
  writeDb(db);
  res.json({ success: true, config: { scriptContent: scriptContent || "" } });
});

// New Script Management APIs
app.get('/api/scripts', (req, res) => {
  const db = readDb();
  res.json(db.scripts || []);
});

app.post('/api/scripts', (req, res) => {
  const { id, name, content } = req.body;
  if (!id || !name) {
    return res.status(400).json({ success: false, error: "Script ID and Name are required." });
  }
  const db = readDb();
  if (!db.scripts) db.scripts = [];
  
  const index = db.scripts.findIndex(s => s.id === id);
  if (index !== -1) {
    db.scripts[index].name = name;
    db.scripts[index].content = content || "";
  } else {
    db.scripts.push({ id, name, content: content || "" });
  }
  writeDb(db);
  res.json({ success: true, scripts: db.scripts });
});

app.post('/api/scripts/delete', (req, res) => {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ success: false, error: "Script ID is required." });
  }
  if (id === 'default' || id === 'nova-flash-tp') {
    return res.status(400).json({ success: false, error: "Cannot delete core system scripts." });
  }
  const db = readDb();
  db.scripts = db.scripts.filter(s => s.id !== id);
  writeDb(db);
  res.json({ success: true, scripts: db.scripts });
});

// Lightweight dynamic Lua obfuscator (XOR byte encoding wrapper)
// Prevents static string inspection, dumping, and decompilation.
function obfuscateLua(sourceCode) {
  const secretKey = Math.floor(Math.random() * 254) + 1; // Random XOR key
  const byteString = Array.from(sourceCode).map(char => {
    return char.charCodeAt(0) ^ secretKey;
  }).join(',');

  // Pack the encrypted payload in a dynamically-unwrapping Lua loop.
  // It decrypts the bytes inside the environment, then executes them via loadstring.
  return `--[[\n  Protected by XD Security Layer\n]]\n` +
         `local _xd_payload = {${byteString}}\n` +
         `local _xd_key = ${secretKey}\n` +
         `local _xd_decompressed = ""\n` +
         `for i = 1, #_xd_payload do\n` +
         `  _xd_decompressed = _xd_decompressed .. string.char(bit32.bxor(_xd_payload[i], _xd_key))\n` +
         `end\n` +
         `local _xd_run, _xd_err = loadstring(_xd_decompressed)\n` +
         `if not _xd_run then error("XD Security Validation Fault: " .. tostring(_xd_err)) end\n` +
         `_xd_run()`;
}

// REST API for Loader Verification (used by loadstrings in Lua)
app.get('/api/validate', (req, res) => {
  const keyParam = req.query.key;
  if (!keyParam) {
    return res.status(400).send('--[[\n  Error: Missing key parameter\n]]\nerror("XD Validation Error: Key is required.")');
  }

  const db = readDb();
  const keyObj = db.keys.find(k => k.key === keyParam);

  if (!keyObj) {
    return res.status(403).send('--[[\n  Error: Invalid key\n]]\nerror("XD Validation Error: The provided key is invalid.")');
  }

  if (!keyObj.isActive) {
    return res.status(403).send('--[[\n  Error: Revoked key\n]]\nerror("XD Validation Error: This key has been suspended or revoked.")');
  }

  // Expiration Check
  if (keyObj.expiresAt !== null && Date.now() > keyObj.expiresAt) {
    return res.status(403).send('--[[\n  Error: Expired key\n]]\nerror("XD Validation Error: This license key has expired.")');
  }

  // Update last used metrics
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown';
  keyObj.lastUsed = Date.now();
  if (!keyObj.ipHistory.includes(clientIp)) {
    keyObj.ipHistory.push(clientIp);
  }
  writeDb(db);

  // Return the dynamically obfuscated script for loadstring to execute
  const scriptId = keyObj.scriptId || "nova-flash-tp";
  const targetScript = db.scripts.find(s => s.id === scriptId);
  const scriptContent = targetScript ? targetScript.content : "print('Error: Target script not found for this license key.')";

  const protectedPayload = obfuscateLua(scriptContent);
  res.send(protectedPayload);
});

// For local execution/debugging
if (!IS_VERCEL) {
  const publicPath = path.join(__dirname, '..', 'public');
  app.use(express.static(publicPath));

  app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
  });

  app.get('/loader_template.lua', (req, res) => {
    res.sendFile(path.join(publicPath, 'loader_template.lua'));
  });

  const PORT = process.env.PORT || 3005;
  app.listen(PORT, () => {
    console.log(`[XD] Local licensing server running at http://localhost:${PORT}`);
  });
}

export default app;
