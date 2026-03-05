// ==========================================
// PART 1: IMPORTS & SETUP
// ==========================================
import express from 'express';
import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createScraper } from 'israeli-bank-scrapers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());

// ==========================================
// PART 2: DATABASES INIT
// ==========================================
const dataDir = path.join(__dirname, 'data'); 
const secretsDir = path.join(__dirname, 'secrets'); 
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
if (!fs.existsSync(secretsDir)) fs.mkdirSync(secretsDir);

const dbPath = path.join(dataDir, 'moneyapp.sqlite');
const credsPath = path.join(secretsDir, 'credentials.sqlite');

const db = new sqlite3.Database(dbPath);
const credsDb = new sqlite3.Database(credsPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, hash TEXT UNIQUE, date TEXT, description TEXT, category TEXT, amount REAL, account TEXT, status TEXT, installments TEXT, originalCategory TEXT, billingDate TEXT, notes TEXT, tags TEXT, linkedTransactionId INTEGER)`);
  db.run(`CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, name TEXT, type TEXT, balance REAL, status TEXT, lastSync TEXT, errorMsg TEXT, billingDate INTEGER DEFAULT 10, scrapeDuration INTEGER)`);
  db.run(`CREATE TABLE IF NOT EXISTS merchant_categories (merchant TEXT PRIMARY KEY, categoryId TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`);
  db.run(`ALTER TABLE accounts ADD COLUMN scrapeDuration INTEGER`, (err) => {});
});

credsDb.serialize(() => {
  credsDb.run(`CREATE TABLE IF NOT EXISTS saved_credentials (id TEXT PRIMARY KEY, companyId TEXT, username TEXT, password TEXT, scrapeDuration INTEGER)`);
  credsDb.run(`ALTER TABLE saved_credentials ADD COLUMN scrapeDuration INTEGER`, (err) => {});
});

// ==========================================
// PART 3: HELPER FUNCTIONS
// ==========================================
function guessCategory(categoryName, description) {
  const text = `${categoryName || ''} ${description || ''}`.toLowerCase();
  if (!text.trim()) return 'misc_uncategorized';
  if (text.includes('מזון') || text.includes('סופר') || text.includes('מכולת') || text.includes('שופרסל') || text.includes('רמי לוי')) return 'shop_supermarket';
  if (text.includes('ביגוד') || text.includes('נעליים') || text.includes('אופנה') || text.includes('זארה') || text.includes('קסטרו')) return 'shop_clothing';
  if (text.includes('מסעד') || text.includes('קפה') || text.includes('פאב') || text.includes('וולט') || text.includes('wolt')) return 'dine_fastfood';
  if (text.includes('דלק') || text.includes('תחנת') || text.includes('פז ')) return 'trans_fuel';
  if (text.includes('חשמל') || text.includes('חברת חשמל')) return 'hh_electricity';
  if (text.includes('מים') || text.includes('תאגיד')) return 'hh_water';
  if (text.includes('ארנונה') || text.includes('עירי')) return 'hh_taxes';
  if (text.includes('ביטוח') || text.includes('הראל') || text.includes('כלל') || text.includes('מגדל')) return 'hlth_insurance';
  if (text.includes('פארם') || text.includes('בית מרקחת') || text.includes('סופר-פארם')) return 'hlth_pharmacy';
  if (text.includes('תקשורת') || text.includes('סלולר') || text.includes('אינטרנט') || text.includes('סלקום') || text.includes('פלאפון')) return 'hh_telecom';
  if (text.includes('משכורת') || text.includes('שכר')) return 'inc_salary';
  return 'misc_uncategorized';
}

const formatILDate = (dateVal) => {
  if (!dateVal) return '';
  const d = new Date(dateVal);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

// ==========================================
// PART 4: SAVE SCRAPE RESULT
// ==========================================
async function saveScrapeResult(scrapeResult, companyId, mappings, scrapeDuration) {
  const now = formatILDate(new Date()) + ' ' + new Date().toLocaleTimeString('he-IL');
  for (const acc of scrapeResult.accounts) {
    const accId = `${companyId}-${acc.accountNumber}`;
    const balance = acc.balance || 0;
    const type = ['leumi', 'hapoalim', 'discount', 'mizrahi', 'beinleumi', 'yahav', 'massad', 'pagi', 'union-bank'].includes(companyId) ? 'bank' : 'credit';

    await new Promise((resolve) => {
      db.run(`INSERT INTO accounts (id, name, type, balance, status, lastSync, errorMsg, scrapeDuration) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET balance=excluded.balance, status='success', lastSync=excluded.lastSync, errorMsg='', scrapeDuration=excluded.scrapeDuration`,
        [accId, `${companyId} (${acc.accountNumber})`, type, balance, 'success', now, '', scrapeDuration || null], () => resolve());
    });

    for (const tx of acc.txns) {
      const hash = `${accId}-${tx.date}-${tx.chargedAmount}-${tx.description}`;
      const txDate = formatILDate(tx.date); 
      const billingDate = tx.processedDate ? formatILDate(tx.processedDate) : txDate;
      const category = mappings[tx.description] || guessCategory(tx.category, tx.description);
      const installmentsStr = tx.installments ? JSON.stringify(tx.installments) : null;
      const status = tx.status || 'completed';

      await new Promise((resolve) => {
        db.run(`INSERT OR IGNORE INTO transactions (hash, date, description, category, amount, account, status, installments, originalCategory, billingDate, notes, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [hash, txDate, tx.description, category, tx.chargedAmount, accId, status, installmentsStr, tx.category || '', billingDate, '', ''], () => resolve());
      });
    }
  }
}

// ==========================================
// PART 5: CREDENTIAL ROUTES
// ==========================================
app.get('/api/credentials', (req, res) => {
  credsDb.all('SELECT id, companyId, username FROM saved_credentials', [], (err, rows) => { res.json({ credentials: rows || [] }); });
});

app.post('/api/credentials', (req, res) => {
  const { companyId, username, password, scrapeDuration } = req.body;
  const id = `${companyId}-${username}`;
  credsDb.run(`INSERT INTO saved_credentials (id, companyId, username, password, scrapeDuration) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET password=excluded.password, scrapeDuration=excluded.scrapeDuration`, [id, companyId, username, password, scrapeDuration || null], (err) => { res.json({ success: !err }); });
});

app.delete('/api/credentials/:id', (req, res) => {
  credsDb.run(`DELETE FROM saved_credentials WHERE id = ?`, [req.params.id], (err) => { res.json({ success: true }); });
});

// ==========================================
// PART 6: DATA & SETTINGS ROUTES
// ==========================================
app.get('/api/data', (req, res) => {
  db.all('SELECT * FROM transactions', [], (err, transactions) => {
    db.all('SELECT * FROM accounts', [], (err, accounts) => {
      db.all('SELECT * FROM settings', [], (err, settingsRows) => {
        const parsedTransactions = transactions.map(tx => ({ ...tx, installments: tx.installments ? JSON.parse(tx.installments) : null }));
        parsedTransactions.sort((a, b) => {
          const parseDate = (d) => { if(!d) return 0; const p = d.split(/[\/\-.]/); if(p.length < 3) return 0; return new Date(p[2], p[1]-1, p[0]).getTime(); };
          return parseDate(b.date) - parseDate(a.date);
        });
        const settings = {};
        if (settingsRows) settingsRows.forEach(r => settings[r.key] = r.value);
        res.json({ transactions: parsedTransactions, accounts, settings });
      });
    });
  });
});

app.post('/api/settings', (req, res) => {
  const { key, value } = req.body;
  db.run(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`, [key, value], (err) => { res.json({ success: !err }); });
});

// ==========================================
// PART 7: ACCOUNTS ROUTES
// ==========================================
app.post('/api/update-account', (req, res) => {
  const { id, name, billingDate, scrapeDuration } = req.body;
  db.run(`UPDATE accounts SET name = ?, billingDate = ?, scrapeDuration = ? WHERE id = ?`, [name, billingDate, scrapeDuration || null, id], (err) => { 
    credsDb.run(`UPDATE saved_credentials SET scrapeDuration = ? WHERE id = ?`, [scrapeDuration || null, id], () => { res.json({ success: !err }); });
  });
});

app.delete('/api/account/:id', (req, res) => {
  const accId = req.params.id;
  db.run(`DELETE FROM accounts WHERE id = ?`, [accId], (err) => {
    db.run(`DELETE FROM transactions WHERE account = ?`, [accId], () => { res.json({ success: true }); });
  });
});

// ==========================================
// PART 8: TRANSACTIONS ROUTES
// ==========================================
app.post('/api/update-transaction', (req, res) => {
  const { transactionId, description, categoryId, notes, tags, applyToAll } = req.body;
  db.run(`UPDATE transactions SET category = ?, notes = ?, tags = ? WHERE id = ?`, [categoryId, notes || '', tags || '', transactionId], (err) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    if (applyToAll) { db.run(`UPDATE transactions SET category = ? WHERE description = ?`, [categoryId, description]); }
    db.run(`INSERT INTO merchant_categories (merchant, categoryId) VALUES (?, ?) ON CONFLICT(merchant) DO UPDATE SET categoryId=excluded.categoryId`, [description, categoryId], () => { res.json({ success: true }); });
  });
});

app.post('/api/link-transactions', (req, res) => {
  const { txId1, txId2 } = req.body;
  if (!txId2) {
    db.run(`UPDATE transactions SET linkedTransactionId = NULL WHERE id = ? OR linkedTransactionId = ?`, [txId1, txId1], () => { res.json({ success: true }); });
    return;
  }
  db.run(`UPDATE transactions SET linkedTransactionId = ? WHERE id = ?`, [txId2, txId1], () => {
    db.run(`UPDATE transactions SET linkedTransactionId = ? WHERE id = ?`, [txId1, txId2], () => { res.json({ success: true }); });
  });
});

// ==========================================
// PART 9: SYNC SPECIFIC
// ==========================================
app.post('/api/sync', async (req, res) => {
  let { companyId, credentials, savedCompanyId, accountId, customScrapeDuration } = req.body;
  let finalScrapeDuration = customScrapeDuration;

  // התיקון: חילוץ חכם של שם החברה מתוך מזהה החשבון המלא (למניעת באג ב- visa-cal למשל)
  if (accountId) {
    const knownCompanies = ['leumi', 'hapoalim', 'discount', 'mizrahi', 'beinleumi', 'yahav', 'massad', 'pagi', 'union-bank', 'isracard', 'max', 'visa-cal', 'amex'];
    savedCompanyId = knownCompanies.find(c => accountId.startsWith(c));
  }

  if (savedCompanyId) {
    const saved = await new Promise((resolve) => { credsDb.get('SELECT * FROM saved_credentials WHERE companyId = ?', [savedCompanyId], (err, row) => resolve(row)); });
    if (!saved) return res.status(400).json({ success: false, errorMessage: 'פרטי ההתחברות לא נמצאו בכספת' });
    companyId = saved.companyId;
    credentials = { id: saved.username, username: saved.username, password: saved.password };
    if (!finalScrapeDuration) finalScrapeDuration = saved.scrapeDuration;
  }

  try {
    if (!finalScrapeDuration) {
      finalScrapeDuration = await new Promise((resolve) => { db.get(`SELECT value FROM settings WHERE key = 'scrape_duration'`, (err, row) => resolve(row ? parseInt(row.value) : 1)); });
    }
    const durationInt = parseInt(finalScrapeDuration) || 1;

    console.log(`\n[${new Date().toLocaleTimeString('he-IL')}] 🔄 סריקה: ${companyId} (${durationInt} חודשים)...`);
    const mappings = await new Promise((resolve) => { db.all('SELECT * FROM merchant_categories', [], (err, rows) => { const map = {}; (rows||[]).forEach(r => map[r.merchant] = r.categoryId); resolve(map); }); });
    const startDate = new Date(); startDate.setMonth(startDate.getMonth() - durationInt);

    const options = { companyId, startDate, combineInstallments: false, showBrowser: false, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] };
    const scraper = createScraper(options);
    
    scraper.onProgress((companyId, payload) => { console.log(`[${companyId}] ⏳ סטטוס: ${payload.type}`); });
    const scrapeResult = await scraper.scrape(credentials);

    if (scrapeResult.success) {
      const totalTx = scrapeResult.accounts.reduce((sum, a) => sum + (a.txns ? a.txns.length : 0), 0);
      console.log(`✅ הושלם בהצלחה עבור ${companyId}! נמשכו ${totalTx} תנועות.`);
      await saveScrapeResult(scrapeResult, companyId, mappings, durationInt);
      res.json({ success: true });
    } else {
      console.error(`❌ שגיאה: ${scrapeResult.errorType}`);
      res.status(400).json({ success: false, errorType: scrapeResult.errorType, errorMessage: scrapeResult.errorMessage });
    }
  } catch (error) { 
    res.status(500).json({ success: false, message: error.message }); 
  }
});



// ==========================================
// PART 10: SYNC ALL & START SERVER
// ==========================================
app.post('/api/sync-all', async (req, res) => {
  try {
    const creds = await new Promise((resolve) => credsDb.all('SELECT * FROM saved_credentials', [], (err, rows) => resolve(rows || [])));
    if (creds.length === 0) return res.status(400).json({success: false, message: 'אין חשבונות שמורים'});
    
    const globalScrapeDuration = await new Promise((resolve) => { db.get(`SELECT value FROM settings WHERE key = 'scrape_duration'`, (err, row) => resolve(row ? parseInt(row.value) : 1)); });
    const mappings = await new Promise((resolve) => { db.all('SELECT * FROM merchant_categories', [], (err, rows) => { const map = {}; (rows||[]).forEach(r => map[r.merchant] = r.categoryId); resolve(map); }); });

    let anySuccess = false;
    for (const saved of creds) {
      const duration = saved.scrapeDuration || globalScrapeDuration;
      console.log(`\n[${new Date().toLocaleTimeString('he-IL')}] 🔄 סנכרון גלובלי: ${saved.companyId}...`);
      const startDate = new Date(); startDate.setMonth(startDate.getMonth() - duration);

      const options = { companyId: saved.companyId, startDate, combineInstallments: false, showBrowser: false, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] };
      const scraper = createScraper(options);
      try {
        const scrapeResult = await scraper.scrape({ id: saved.username, username: saved.username, password: saved.password });
        if (scrapeResult.success) { await saveScrapeResult(scrapeResult, saved.companyId, mappings, duration); anySuccess = true; console.log(`✅ הושלם ${saved.companyId}`); }
      } catch(e) {}
    }
    res.json({ success: anySuccess });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

app.use(express.static(path.join(__dirname, 'frontend/dist')));
app.listen(3001, () => console.log(`🚀 השרת פועל בכתובת http://localhost:3001`));