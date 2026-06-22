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
const DB_FILE = path.join('/tmp', 'database.json');

// Initialize database file in /tmp if it doesn't exist
function initDb() {
  if (!fs.existsSync(DB_FILE)) {
    const defaultData = {
      keys: [],
      config: {
        scriptContent: "print('Welcome to XD Licensed Script! Enjoy your execution.')\n-- Place your actual product script code here"
      }
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2));
  }
}

function readDb() {
  initDb();
  try {
    const content = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error("Error reading database file, using fallback empty values", error);
    return { keys: [], config: { scriptContent: "" } };
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
  const { durationMinutes, label } = req.body;
  const db = readDb();
  
  const key = `XD-${uuidv4().replace(/-/g, '').substring(0, 16).toUpperCase()}`;
  const createdAt = Date.now();
  
  let expiresAt = null; // null represents lifetime
  if (durationMinutes && typeof durationMinutes === 'number' && durationMinutes > 0) {
    expiresAt = createdAt + (durationMinutes * 60 * 1000);
  }
  
  const newKey = {
    key,
    label: label || 'Unnamed Key',
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
  res.json(db.config);
});

app.post('/api/config', (req, res) => {
  const { scriptContent } = req.body;
  const db = readDb();
  
  db.config.scriptContent = scriptContent || "";
  writeDb(db);
  
  res.json({ success: true, config: db.config });
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
  const protectedPayload = obfuscateLua(db.config.scriptContent);
  res.send(protectedPayload);
});

export default app;
