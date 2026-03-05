// ==========================================
// PART 1: IMPORTS & SETUP
// ==========================================
import express from 'express';
import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createScraper } from 'israeli-bank-scrapers';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());

const dataDir = path.join(__dirname, 'data'); 
const secretsDir = path.join(__dirname, 'secrets'); 
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
if (!fs.existsSync(secretsDir)) fs.mkdirSync(secretsDir);

// ==========================================
// PART 2: ZERO-KNOWLEDGE ENCRYPTION ENGINE
// ==========================================
// ניהול סשנים בזיכרון בלבד (RAM) - נמחק כשהשרת יורד או משתמש מתנתק
const activeSessions = new Map(); 

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

function encryptData(text, keyBuffer) {
  if (!text && text !== 0) return text;
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, keyBuffer, iv);
    let encrypted = cipher.update(String(text), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (e) { console.error("Encryption Error:", e); return text; }
}

function decryptData(encText, keyBuffer) {
  if (!encText || typeof encText !== 'string' || !encText.includes(':')) return encText; 
  try {
    const [ivHex, authTagHex, encryptedHex] = encText.split(':');
    if (!ivHex || !authTagHex || !encryptedHex) return encText;
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, keyBuffer, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) { return encText; } 
}

// ==========================================
// PART 3: DATABASES INIT
// ==========================================
const dbPath = path.join(dataDir, 'moneyapp.sqlite');
const credsPath = path.join(secretsDir, 'credentials.sqlite');
const db = new sqlite3.Database(dbPath);
const credsDb = new sqlite3.Database(credsPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT UNIQUE, passwordHash TEXT, salt TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, userId TEXT, hash TEXT UNIQUE, date TEXT, description TEXT, category TEXT, amount TEXT, account TEXT, status TEXT, installments TEXT, originalCategory TEXT, billingDate TEXT, notes TEXT, tags TEXT, linkedTransactionId INTEGER)`);
  db.run(`CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, userId TEXT, name TEXT, type TEXT, balance TEXT, status TEXT, lastSync TEXT, errorMsg TEXT, billingDate INTEGER DEFAULT 10, scrapeDuration INTEGER)`);
  db.run(`CREATE TABLE IF NOT EXISTS merchant_categories (merchant TEXT PRIMARY KEY, categoryId TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS settings (key TEXT, userId TEXT, value TEXT, PRIMARY KEY(key, userId))`);
  
  db.run(`ALTER TABLE transactions ADD COLUMN userId TEXT`, (err) => {});
  db.run(`ALTER TABLE accounts ADD COLUMN userId TEXT`, (err) => {});
  db.run(`ALTER TABLE accounts ADD COLUMN scrapeDuration INTEGER`, (err) => {});
});

credsDb.serialize(() => {
  credsDb.run(`CREATE TABLE IF NOT EXISTS saved_credentials (id TEXT PRIMARY KEY, userId TEXT, companyId TEXT, username TEXT, password TEXT, scrapeDuration INTEGER)`);
  credsDb.run(`ALTER TABLE saved_credentials ADD COLUMN userId TEXT`, (err) => {});
  credsDb.run(`ALTER TABLE saved_credentials ADD COLUMN scrapeDuration INTEGER`, (err) => {});
});

// ==========================================
// PART 4: AUTHENTICATION & SESSIONS
// ==========================================
app.post('/api/auth/register', (req, res) => {
  const { username, password } = req.body;
  console.log(`[AUTH] 👤 Registration attempt: ${username}`);
  const userId = crypto.randomUUID();
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = crypto.scryptSync(password, salt, 64).toString('hex');

  db.run(`INSERT INTO users (id, username, passwordHash, salt) VALUES (?, ?, ?, ?)`, [userId, username, passwordHash, salt], function(err) {
    if (err) return res.status(400).json({ success: false, message: 'שם המשתמש כבר קיים' });
    
    // Assign legacy data to first registered user
    db.run(`UPDATE transactions SET userId = ? WHERE userId IS NULL`, [userId]);
    db.run(`UPDATE accounts SET userId = ? WHERE userId IS NULL`, [userId]);
    credsDb.run(`UPDATE saved_credentials SET userId = ? WHERE userId IS NULL`, [userId]);
    
    console.log(`[AUTH] ✅ Registered: ${userId}`);
    res.json({ success: true });
  });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  console.log(`[AUTH] 🔐 Login attempt: ${username}`);
  
  db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
    if (!user) return res.status(401).json({ success: false, message: 'פרטים שגויים' });
    
    const hashVerify = crypto.scryptSync(password, user.salt, 64).toString('hex');
    if (hashVerify !== user.passwordHash) return res.status(401).json({ success: false, message: 'פרטים שגויים' });

    const masterKey = crypto.pbkdf2Sync(password, user.salt, 100000, 32, 'sha256');
    const token = crypto.randomUUID();
    activeSessions.set(token, { userId: user.id, masterKey });
    
    console.log(`[AUTH] ✅ Login success: Master Key in RAM for ${username}`);
    res.json({ success: true, token });
  });
});

const requireAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  const session = activeSessions.get(token);
  if (!session) return res.status(401).json({ success: false, message: 'לא מורשה' });
  req.user = session;
  next();
};

// ==========================================
// PART 5: HELPER FUNCTIONS
// ==========================================
function guessCategory(categoryName, description) {
  const text = `${categoryName || ''} ${description || ''}`.toLowerCase();
  if (!text.trim()) return 'misc_uncategorized';
  if (text.includes('מזון') || text.includes('סופר') || text.includes('מכולת') || text.includes('שופרסל')) return 'shop_supermarket';
  if (text.includes('ביגוד') || text.includes('נעליים') || text.includes('זארה')) return 'shop_clothing';
  if (text.includes('מסעד') || text.includes('קפה') || text.includes('וולט') || text.includes('wolt')) return 'dine_fastfood';
  if (text.includes('דלק') || text.includes('תחנת') || text.includes('פז ')) return 'trans_fuel';
  if (text.includes('חשמל')) return 'hh_electricity';
  if (text.includes('מים') || text.includes('תאגיד')) return 'hh_water';
  if (text.includes('ארנונה') || text.includes('עירי')) return 'hh_taxes';
  if (text.includes('ביטוח') || text.includes('הראל') || text.includes('כלל')) return 'hlth_insurance';
  if (text.includes('פארם') || text.includes('בית מרקחת')) return 'hlth_pharmacy';
  if (text.includes('תקשורת') || text.includes('סלולר') || text.includes('סלקום')) return 'hh_telecom';
  if (text.includes('משכורת') || text.includes('שכר')) return 'inc_salary';
  return 'misc_uncategorized';
}

const formatILDate = (dateVal) => {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

// ==========================================
// PART 6: SAVE SCRAPE RESULT (ENCRYPTED)
// ==========================================
async function saveScrapeResult(scrapeResult, companyId, mappings, scrapeDuration, userId, masterKey) {
  const now = formatILDate(new Date()) + ' ' + new Date().toLocaleTimeString('he-IL');
  for (const acc of scrapeResult.accounts) {
    const accId = `${companyId}-${acc.accountNumber}`;
    const type = ['leumi', 'hapoalim', 'discount', 'mizrahi', 'beinleumi', 'yahav', 'massad', 'pagi', 'union-bank'].includes(companyId) ? 'bank' : 'credit';
    
    const encryptedBalance = encryptData(String(acc.balance || 0), masterKey);

    await new Promise((resolve) => {
      db.run(`INSERT INTO accounts (id, userId, name, type, balance, status, lastSync, errorMsg, scrapeDuration) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET balance=excluded.balance, status='success', lastSync=excluded.lastSync, errorMsg='', scrapeDuration=COALESCE(excluded.scrapeDuration, accounts.scrapeDuration)`,
        [accId, userId, `${companyId} (${acc.accountNumber})`, type, encryptedBalance, 'success', now, '', scrapeDuration || null], () => resolve());
    });

    for (const tx of acc.txns) {
      const hash = `${accId}-${tx.date}-${tx.chargedAmount}-${tx.description}`;
      const txDate = formatILDate(tx.date); 
      const billingDate = tx.processedDate ? formatILDate(tx.processedDate) : txDate;
      const category = mappings[tx.description] || guessCategory(tx.category, tx.description);
      const installmentsStr = tx.installments ? JSON.stringify(tx.installments) : null;
      const status = tx.status || 'completed';

      const encAmount = encryptData(String(tx.chargedAmount), masterKey);
      const encDesc = encryptData(tx.description, masterKey);

      await new Promise((resolve) => {
        db.run(`INSERT OR IGNORE INTO transactions (hash, userId, date, description, category, amount, account, status, installments, originalCategory, billingDate, notes, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [hash, userId, txDate, encDesc, category, encAmount, accId, status, installmentsStr, tx.category || '', billingDate, '', ''], () => resolve());
      });
    }
  }
}

// ==========================================
// PART 7: CREDENTIALS & SETTINGS ROUTES
// ==========================================
app.get('/api/credentials', requireAuth, (req, res) => {
  credsDb.all('SELECT id, companyId, username FROM saved_credentials WHERE userId = ?', [req.user.userId], (err, rows) => { res.json({ credentials: rows || [] }); });
});

app.post('/api/credentials', requireAuth, (req, res) => {
  const { companyId, username, password, scrapeDuration } = req.body;
  const id = `${companyId}-${username}`;
  const encPass = encryptData(password, req.user.masterKey);
  console.log(`[SECRETS] 🔒 Saved Vault Data for ${companyId}`);
  
  credsDb.run(`INSERT INTO saved_credentials (id, userId, companyId, username, password, scrapeDuration) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET password=excluded.password, scrapeDuration=excluded.scrapeDuration`, 
    [id, req.user.userId, companyId, username, encPass, scrapeDuration || null], (err) => { res.json({ success: !err }); });
});

app.delete('/api/credentials/:id', requireAuth, (req, res) => {
  credsDb.run(`DELETE FROM saved_credentials WHERE id = ? AND userId = ?`, [req.params.id, req.user.userId], (err) => { res.json({ success: true }); });
});

app.post('/api/settings', requireAuth, (req, res) => {
  const { key, value } = req.body;
  db.run(`INSERT INTO settings (key, userId, value) VALUES (?, ?, ?) ON CONFLICT(key, userId) DO UPDATE SET value=excluded.value`, [key, req.user.userId, value], (err) => { res.json({ success: !err }); });
});

// ==========================================
// PART 8: DATA & ACCOUNTS ROUTES
// ==========================================
app.get('/api/data', requireAuth, (req, res) => {
  db.all('SELECT * FROM transactions WHERE userId = ?', [req.user.userId], (err, transactions) => {
    db.all('SELECT * FROM accounts WHERE userId = ?', [req.user.userId], (err, accounts) => {
      db.all('SELECT * FROM settings WHERE userId = ?', [req.user.userId], (err, settingsRows) => {
        
        const decryptedAccounts = accounts.map(acc => ({
          ...acc, balance: parseFloat(decryptData(acc.balance, req.user.masterKey)) || 0
        }));

        const parsedTransactions = transactions.map(tx => ({
          ...tx,
          description: decryptData(tx.description, req.user.masterKey),
          amount: parseFloat(decryptData(tx.amount, req.user.masterKey)) || 0,
          notes: decryptData(tx.notes, req.user.masterKey) || '',
          tags: decryptData(tx.tags, req.user.masterKey) || '',
          installments: tx.installments ? JSON.parse(tx.installments) : null
        }));

        parsedTransactions.sort((a, b) => {
          const parseDate = (d) => { if(!d) return 0; const p = d.split(/[\/\-.]/); return new Date(p[2], p[1]-1, p[0]).getTime(); };
          return parseDate(b.date) - parseDate(a.date);
        });

        const settings = {};
        if (settingsRows) settingsRows.forEach(r => settings[r.key] = r.value);
        res.json({ transactions: parsedTransactions, accounts: decryptedAccounts, settings });
      });
    });
  });
});

app.post('/api/update-account', requireAuth, (req, res) => {
  const { id, name, billingDate, scrapeDuration } = req.body;
  db.run(`UPDATE accounts SET name = ?, billingDate = ?, scrapeDuration = ? WHERE id = ? AND userId = ?`, [name, billingDate, scrapeDuration || null, id, req.user.userId], (err) => { 
    credsDb.run(`UPDATE saved_credentials SET scrapeDuration = ? WHERE id = ? AND userId = ?`, [scrapeDuration || null, id, req.user.userId], () => { res.json({ success: !err }); });
  });
});

app.delete('/api/account/:id', requireAuth, (req, res) => {
  const accId = req.params.id;
  db.run(`DELETE FROM accounts WHERE id = ? AND userId = ?`, [accId, req.user.userId], (err) => {
    db.run(`DELETE FROM transactions WHERE account = ? AND userId = ?`, [accId, req.user.userId], () => { res.json({ success: true }); });
  });
});

// ==========================================
// PART 9: TRANSACTIONS ROUTES
// ==========================================
app.post('/api/update-transaction', requireAuth, (req, res) => {
  const { transactionId, description, categoryId, notes, tags, applyToAll } = req.body;
  const encNotes = encryptData(notes, req.user.masterKey);
  const encTags = encryptData(tags, req.user.masterKey);

  db.run(`UPDATE transactions SET category = ?, notes = ?, tags = ? WHERE id = ? AND userId = ?`, [categoryId, encNotes, encTags, transactionId, req.user.userId], (err) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    db.run(`INSERT INTO merchant_categories (merchant, categoryId) VALUES (?, ?) ON CONFLICT(merchant) DO UPDATE SET categoryId=excluded.categoryId`, [description, categoryId], () => { res.json({ success: true }); });
  });
});

app.post('/api/link-transactions', requireAuth, (req, res) => {
  const { txId1, txId2 } = req.body;
  if (!txId2) {
    db.run(`UPDATE transactions SET linkedTransactionId = NULL WHERE (id = ? OR linkedTransactionId = ?) AND userId = ?`, [txId1, txId1, req.user.userId], () => { res.json({ success: true }); });
    return;
  }
  db.run(`UPDATE transactions SET linkedTransactionId = ? WHERE id = ? AND userId = ?`, [txId2, txId1, req.user.userId], () => {
    db.run(`UPDATE transactions SET linkedTransactionId = ? WHERE id = ? AND userId = ?`, [txId1, txId2, req.user.userId], () => { res.json({ success: true }); });
  });
});

// ==========================================
// PART 10: SYNC ROUTES & SERVER START
// ==========================================
app.post('/api/sync', requireAuth, async (req, res) => {
  let { companyId, credentials, savedCompanyId, accountId, customScrapeDuration } = req.body;
  let finalScrapeDuration = customScrapeDuration;

  if (accountId) {
    const knownCompanies = ['leumi', 'hapoalim', 'discount', 'mizrahi', 'beinleumi', 'yahav', 'massad', 'pagi', 'union-bank', 'isracard', 'max', 'visa-cal', 'amex'];
    savedCompanyId = knownCompanies.find(c => accountId.startsWith(c));
  }

  if (savedCompanyId) {
    console.log(`[SCRAPER] 🔍 Looking up vault data for: ${savedCompanyId}`);
    const saved = await new Promise((resolve) => { credsDb.get('SELECT * FROM saved_credentials WHERE companyId = ? AND userId = ?', [savedCompanyId, req.user.userId], (err, row) => resolve(row)); });
    if (!saved) return res.status(400).json({ success: false, errorMessage: 'פרטי ההתחברות לא נמצאו בכספת' });
    
    companyId = saved.companyId;
    const decPass = decryptData(saved.password, req.user.masterKey);
    credentials = { id: saved.username, username: saved.username, password: decPass };
    if (!finalScrapeDuration) finalScrapeDuration = saved.scrapeDuration;
    console.log(`[SCRAPER] 🔓 Vault decrypted successfully for ${companyId}`);
  }

  try {
    if (!finalScrapeDuration) {
      finalScrapeDuration = await new Promise((resolve) => { db.get(`SELECT value FROM settings WHERE key = 'scrape_duration' AND userId = ?`, [req.user.userId], (err, row) => resolve(row ? parseInt(row.value) : 1)); });
    }
    const durationInt = parseInt(finalScrapeDuration) || 1;

    console.log(`\n[SCRAPER] 🚀 Starting Sync: ${companyId} (${durationInt} months)...`);
    const mappings = await new Promise((resolve) => { db.all('SELECT * FROM merchant_categories', [], (err, rows) => { const map = {}; (rows||[]).forEach(r => map[r.merchant] = r.categoryId); resolve(map); }); });
    const startDate = new Date(); startDate.setMonth(startDate.getMonth() - durationInt);

    const options = { companyId, startDate, combineInstallments: false, showBrowser: false, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] };
    const scraper = createScraper(options);
    
    scraper.onProgress((cId, payload) => { console.log(`[${cId}] ⏳ Progress: ${payload.type}`); });
    const scrapeResult = await scraper.scrape(credentials);

    if (scrapeResult.success) {
      const totalTx = scrapeResult.accounts.reduce((sum, a) => sum + (a.txns ? a.txns.length : 0), 0);
      console.log(`[SCRAPER] ✅ Success for ${companyId}! Fetched ${totalTx} transactions.`);
      await saveScrapeResult(scrapeResult, companyId, mappings, durationInt, req.user.userId, req.user.masterKey);
      res.json({ success: true });
    } else {
      console.error(`[SCRAPER] ❌ Error: ${scrapeResult.errorType}`);
      res.status(400).json({ success: false, errorType: scrapeResult.errorType, errorMessage: scrapeResult.errorMessage });
    }
  } catch (error) { 
    res.status(500).json({ success: false, message: error.message }); 
  }
});

app.post('/api/sync-all', requireAuth, async (req, res) => {
  try {
    console.log(`[SCRAPER-ALL] 🌐 Starting global sync for user.`);
    const creds = await new Promise((resolve) => credsDb.all('SELECT * FROM saved_credentials WHERE userId = ?', [req.user.userId], (err, rows) => resolve(rows || [])));
    if (creds.length === 0) return res.json({success: false, message: 'אין חשבונות שמורים בכספת. אנא הוסף מקור.'});
    
    const globalScrapeDuration = await new Promise((resolve) => { db.get(`SELECT value FROM settings WHERE key = 'scrape_duration' AND userId = ?`, [req.user.userId], (err, row) => resolve(row ? parseInt(row.value) : 1)); });
    const mappings = await new Promise((resolve) => { db.all('SELECT * FROM merchant_categories', [], (err, rows) => { const map = {}; (rows||[]).forEach(r => map[r.merchant] = r.categoryId); resolve(map); }); });

    let anySuccess = false;
    for (const saved of creds) {
      const durationInt = parseInt(saved.scrapeDuration) || parseInt(globalScrapeDuration) || 1;
      console.log(`[SCRAPER-ALL] 🔄 Syncing: ${saved.companyId}...`);
      
      const decPass = decryptData(saved.password, req.user.masterKey);
      const startDate = new Date(); startDate.setMonth(startDate.getMonth() - durationInt);

      const options = { companyId: saved.companyId, startDate, combineInstallments: false, showBrowser: false, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] };
      const scraper = createScraper(options);
      try {
        const scrapeResult = await scraper.scrape({ id: saved.username, username: saved.username, password: decPass });
        if (scrapeResult.success) { 
          await saveScrapeResult(scrapeResult, saved.companyId, mappings, durationInt, req.user.userId, req.user.masterKey); 
          anySuccess = true; 
          console.log(`[SCRAPER-ALL] ✅ Completed ${saved.companyId}`); 
        }
      } catch(e) { console.error(`[SCRAPER-ALL] ❌ Error in ${saved.companyId}`, e.message); }
    }
    res.json({ success: anySuccess, message: anySuccess ? 'הסנכרון הושלם' : 'שגיאה בחלק מהחשבונות' });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

app.use(express.static(path.join(__dirname, 'frontend/dist')));
app.listen(3001, () => console.log(`🚀 השרת פועל בכתובת http://localhost:3001`));