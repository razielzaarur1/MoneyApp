import express from 'express';
import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createScraper } from 'israeli-bank-scrapers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());

// --- הגדרת 2 כספות נפרדות (לצורך Docker Volumes נפרדים) ---
const dataDir = path.join(__dirname, 'data'); 
const secretsDir = path.join(__dirname, 'secrets'); 
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
if (!fs.existsSync(secretsDir)) fs.mkdirSync(secretsDir);

const dbPath = path.join(dataDir, 'moneyapp.sqlite');
const credsPath = path.join(secretsDir, 'credentials.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('❌ שגיאה בחיבור למסד הנתונים:', err);
  else console.log('✅ מחובר למסד הנתונים (Data)');
});

const credsDb = new sqlite3.Database(credsPath, (err) => {
  if (err) console.error('❌ שגיאה בחיבור למסד הסודי:', err);
  else console.log('✅ מחובר למסד הסודי (Credentials)');
});

// --- יצירת טבלאות ---
// שים לב: הוסרה עמודת address, נוספה עמודת linkedTransactionId
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, hash TEXT UNIQUE, date TEXT, description TEXT, category TEXT, amount REAL, account TEXT, status TEXT, installments TEXT, originalCategory TEXT, billingDate TEXT, notes TEXT, tags TEXT, linkedTransactionId INTEGER
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY, name TEXT, type TEXT, balance REAL, status TEXT, lastSync TEXT, errorMsg TEXT, billingDate INTEGER DEFAULT 10
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS merchant_categories (merchant TEXT PRIMARY KEY, categoryId TEXT)`);
});

credsDb.serialize(() => {
  credsDb.run(`CREATE TABLE IF NOT EXISTS saved_credentials (
    id TEXT PRIMARY KEY, companyId TEXT, username TEXT, password TEXT
  )`);
});

function guessCategory(categoryName, description) {
  const text = `${categoryName || ''} ${description || ''}`.toLowerCase();
  if (!text.trim()) return 'misc_uncategorized';
  if (text.includes('מזון') || text.includes('סופר') || text.includes('מכולת') || text.includes('שופרסל') || text.includes('רמי לוי') || text.includes('am:pm') || text.includes('אמ פמ')) return 'shop_supermarket';
  if (text.includes('ביגוד') || text.includes('נעליים') || text.includes('אופנה') || text.includes('זארה') || text.includes('קסטרו')) return 'shop_clothing';
  if (text.includes('מסעד') || text.includes('קפה') || text.includes('פאב') || text.includes('וולט') || text.includes('wolt') || text.includes('תן ביס') || text.includes('mcdonald')) return 'dine_fastfood';
  if (text.includes('דלק') || text.includes('תחנת') || text.includes('פז ') || text.includes('סונול') || text.includes('דור אלון') || text.includes('מיקה')) return 'trans_fuel';
  if (text.includes('חשמל') || text.includes('חברת חשמל')) return 'hh_electricity';
  if (text.includes('מים') || text.includes('תאגיד') || text.includes('מי ציונה')) return 'hh_water';
  if (text.includes('ארנונה') || text.includes('עירי')) return 'hh_taxes';
  if (text.includes('ביטוח') || text.includes('הראל') || text.includes('כלל') || text.includes('מגדל') || text.includes('ביטוח ישיר')) return 'hlth_insurance';
  if (text.includes('פארם') || text.includes('בית מרקחת') || text.includes('סופר-פארם') || text.includes('be ')) return 'hlth_pharmacy';
  if (text.includes('תקשורת') || text.includes('סלולר') || text.includes('אינטרנט') || text.includes('סלקום') || text.includes('פלאפון') || text.includes('הוט') || text.includes('פרטנר')) return 'hh_telecom';
  if (text.includes('משכורת') || text.includes('שכר') || text.includes('העברת משכורת')) return 'inc_salary';
  return 'misc_uncategorized';
}

app.get('/api/credentials', (req, res) => {
  credsDb.all('SELECT id, companyId, username FROM saved_credentials', [], (err, rows) => {
    res.json({ credentials: rows || [] });
  });
});

app.post('/api/credentials', (req, res) => {
  const { companyId, username, password } = req.body;
  const id = `${companyId}-${username}`;
  credsDb.run(`INSERT INTO saved_credentials (id, companyId, username, password) VALUES (?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET password=excluded.password`, 
               [id, companyId, username, password], (err) => {
    res.json({ success: !err });
  });
});

app.delete('/api/credentials/:id', (req, res) => {
  credsDb.run(`DELETE FROM saved_credentials WHERE id = ?`, [req.params.id], (err) => {
    res.json({ success: true });
  });
});

app.get('/api/data', (req, res) => {
  db.all('SELECT * FROM transactions ORDER BY date(date) DESC, id DESC', [], (err, transactions) => {
    db.all('SELECT * FROM accounts', [], (err, accounts) => {
      const parsedTransactions = transactions.map(tx => ({
        ...tx, installments: tx.installments ? JSON.parse(tx.installments) : null
      }));
      res.json({ transactions: parsedTransactions, accounts });
    });
  });
});

app.post('/api/update-account', (req, res) => {
  const { id, name, billingDate } = req.body;
  db.run(`UPDATE accounts SET name = ?, billingDate = ? WHERE id = ?`, [name, billingDate, id], (err) => {
    res.json({ success: !err });
  });
});

// עדכון תנועה
app.post('/api/update-transaction', (req, res) => {
  const { transactionId, description, categoryId, notes, tags, applyToAll } = req.body;
  db.run(`UPDATE transactions SET category = ?, notes = ?, tags = ? WHERE id = ?`, 
    [categoryId, notes || '', tags || '', transactionId], (err) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    
    if (applyToAll) {
      db.run(`UPDATE transactions SET category = ? WHERE description = ?`, [categoryId, description]);
    }
    db.run(`INSERT INTO merchant_categories (merchant, categoryId) VALUES (?, ?) ON CONFLICT(merchant) DO UPDATE SET categoryId=excluded.categoryId`, 
            [description, categoryId], () => { res.json({ success: true }); });
  });
});

// ניתוב חדש: קישור בין שתי תנועות
app.post('/api/link-transactions', (req, res) => {
  const { txId1, txId2 } = req.body;
  
  // אם מעבירים null ל-txId2, המשמעות היא ניתוק
  if (!txId2) {
    db.run(`UPDATE transactions SET linkedTransactionId = NULL WHERE id = ? OR linkedTransactionId = ?`, [txId1, txId1], () => {
      res.json({ success: true });
    });
    return;
  }

  // קישור דו-כיווני
  db.run(`UPDATE transactions SET linkedTransactionId = ? WHERE id = ?`, [txId2, txId1], () => {
    db.run(`UPDATE transactions SET linkedTransactionId = ? WHERE id = ?`, [txId1, txId2], () => {
      res.json({ success: true });
    });
  });
});

app.post('/api/sync', async (req, res) => {
  let { companyId, credentials, savedId } = req.body;
  if (savedId) {
    const saved = await new Promise((resolve) => {
      credsDb.get('SELECT * FROM saved_credentials WHERE id = ?', [savedId], (err, row) => resolve(row));
    });
    if (!saved) return res.status(400).json({ success: false, errorMessage: 'פרטי ההתחברות לא נמצאו' });
    companyId = saved.companyId;
    credentials = { id: saved.username, username: saved.username, password: saved.password };
  }

  console.log(`מתחיל סריקה עבור: ${companyId}...`);
  try {
    const mappings = await new Promise((resolve) => {
      db.all('SELECT * FROM merchant_categories', [], (err, rows) => {
        const map = {}; (rows||[]).forEach(r => map[r.merchant] = r.categoryId); resolve(map);
      });
    });

    const options = {
      companyId, startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)), 
      combineInstallments: false, showBrowser: false, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    };

    const scraper = createScraper(options);
    const scrapeResult = await scraper.scrape(credentials);

    if (scrapeResult.success) {
      console.log(`✅ סריקה הצליחה!`);
      const now = new Date().toLocaleString('he-IL');

      scrapeResult.accounts.forEach(acc => {
        const accId = `${companyId}-${acc.accountNumber}`;
        const balance = acc.balance || 0;
        const type = ['leumi', 'hapoalim', 'discount', 'mizrahi'].includes(companyId) ? 'bank' : 'credit';

        db.run(`INSERT INTO accounts (id, name, type, balance, status, lastSync, errorMsg) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET balance=excluded.balance, status='success', lastSync=excluded.lastSync, errorMsg=''`,
          [accId, `${companyId} (${acc.accountNumber})`, type, balance, 'success', now, '']);

        acc.txns.forEach(tx => {
          const hash = `${accId}-${tx.date}-${tx.chargedAmount}-${tx.description}`;
          const txDate = new Date(tx.date).toLocaleDateString('he-IL'); 
          const billingDate = tx.processedDate ? new Date(tx.processedDate).toLocaleDateString('he-IL') : txDate;
          const category = mappings[tx.description] || guessCategory(tx.category, tx.description);
          const installmentsStr = tx.installments ? JSON.stringify(tx.installments) : null;
          const status = tx.status || 'completed';

          db.run(`INSERT OR IGNORE INTO transactions (hash, date, description, category, amount, account, status, installments, originalCategory, billingDate, notes, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [hash, txDate, tx.description, category, tx.chargedAmount, accId, status, installmentsStr, tx.category || '', billingDate, '', '']);
        });
      });
      res.json({ success: true });
    } else {
      res.status(400).json({ success: false, errorType: scrapeResult.errorType, errorMessage: scrapeResult.errorMessage });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.use(express.static(path.join(__dirname, 'frontend/dist')));
app.listen(3001, () => console.log(`🚀 השרת פועל בכתובת http://localhost:3001`));