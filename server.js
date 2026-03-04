import express from 'express';
import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createScraper } from 'israeli-bank-scrapers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());

// --- חיבור לכספת (SQLite) ---
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
const dbPath = path.join(dataDir, 'moneyapp.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('❌ שגיאה בחיבור ל-DB:', err);
  else console.log('✅ מחובר למסד הנתונים בהצלחה!');
});

// בניית טבלאות מעודכנות (כולל סטטוס, תשלומים, ותאריך חיוב לכרטיס)
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hash TEXT UNIQUE, 
    date TEXT, description TEXT, category TEXT, amount REAL, account TEXT,
    status TEXT, installments TEXT, originalCategory TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY, name TEXT, type TEXT, balance REAL, status TEXT, lastSync TEXT, errorMsg TEXT, billingDate INTEGER DEFAULT 10
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS merchant_categories (
    merchant TEXT PRIMARY KEY,
    categoryId TEXT
  )`);
});

// פונקציית עזר: קטלוג אוטומטי של בית העסק לפי תיאור וקטגוריית הבנק המקורית
function guessCategory(categoryName, description) {
  const text = `${categoryName || ''} ${description || ''}`.toLowerCase();
  if (!text.trim()) return 'misc_uncategorized';

  if (text.includes('מזון') || text.includes('סופר') || text.includes('מכולת') || text.includes('שופרסל') || text.includes('רמי לוי')) return 'shop_supermarket';
  if (text.includes('ביגוד') || text.includes('נעליים') || text.includes('אופנה') || text.includes('זארה') || text.includes('קסטרו')) return 'shop_clothing';
  if (text.includes('מסעד') || text.includes('קפה') || text.includes('פאב') || text.includes('וולט') || text.includes('wolt') || text.includes('תן ביס')) return 'dine_fastfood';
  if (text.includes('דלק') || text.includes('תחנת') || text.includes('פז') || text.includes('סונול') || text.includes('דור אלון')) return 'trans_fuel';
  if (text.includes('חשמל') || text.includes('חברת חשמל')) return 'hh_electricity';
  if (text.includes('מים') || text.includes('תאגיד') || text.includes('מי ציונה')) return 'hh_water';
  if (text.includes('ארנונה') || text.includes('עירי')) return 'hh_taxes';
  if (text.includes('ביטוח') || text.includes('הראל') || text.includes('כלל') || text.includes('מגדל')) return 'hlth_insurance';
  if (text.includes('פארם') || text.includes('בית מרקחת') || text.includes('סופר-פארם') || text.includes('be')) return 'hlth_pharmacy';
  if (text.includes('תקשורת') || text.includes('סלולר') || text.includes('אינטרנט') || text.includes('סלקום') || text.includes('פלאפון') || text.includes('הוט') || text.includes('פרטנר')) return 'hh_telecom';
  if (text.includes('משכורת') || text.includes('שכר')) return 'inc_salary';

  return 'misc_uncategorized';
}

// --- שליפת נתונים לתצוגה ---
app.get('/api/data', (req, res) => {
  db.all('SELECT * FROM transactions ORDER BY date(date) DESC, id DESC', [], (err, transactions) => {
    db.all('SELECT * FROM accounts', [], (err, accounts) => {
      // המרת מחרוזת התשלומים חזרה לאובייקט JSON עבור ריאקט
      const parsedTransactions = transactions.map(tx => ({
        ...tx,
        installments: tx.installments ? JSON.parse(tx.installments) : null
      }));
      res.json({ transactions: parsedTransactions, accounts });
    });
  });
});

// --- עדכון הגדרות חשבון (שם ותאריך חיוב) ---
app.post('/api/update-account', (req, res) => {
  const { id, name, billingDate } = req.body;
  db.run(`UPDATE accounts SET name = ?, billingDate = ? WHERE id = ?`, [name, billingDate, id], (err) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true });
  });
});

// --- עדכון קטגוריה ו"למידה" של בית העסק ---
app.post('/api/update-category', (req, res) => {
  const { transactionId, description, categoryId } = req.body;
  
  db.run(`UPDATE transactions SET category = ? WHERE id = ?`, [categoryId, transactionId], (err) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    
    db.run(`INSERT INTO merchant_categories (merchant, categoryId) VALUES (?, ?)
            ON CONFLICT(merchant) DO UPDATE SET categoryId=excluded.categoryId`, 
            [description, categoryId], (err) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      
      db.run(`UPDATE transactions SET category = ? WHERE description = ?`, [categoryId, description], (err) => {
        res.json({ success: true });
      });
    });
  });
});

// --- סנכרון נתונים מול הבנקים ---
app.post('/api/sync', async (req, res) => {
  const { companyId, credentials } = req.body;
  console.log(`מתחיל סריקה עבור: ${companyId}... (זה עשוי לקחת דקה או שתיים)`);

  try {
    const mappings = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM merchant_categories', [], (err, rows) => {
        if(err) reject(err);
        const map = {};
        rows.forEach(r => map[r.merchant] = r.categoryId);
        resolve(map);
      });
    });

    const options = {
      companyId,
      startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)), 
      combineInstallments: false, // מחזיר כל תשלום בנפרד (כדי שנוכל לסמן תשלום X מתוך Y)
      showBrowser: false,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, 
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    };

    const scraper = createScraper(options);
    const scrapeResult = await scraper.scrape(credentials);

    if (scrapeResult.success) {
      console.log(`✅ סריקה הצליחה! נמצאו חשבונות ל-${companyId}`);
      const now = new Date().toLocaleString('he-IL');

      scrapeResult.accounts.forEach(acc => {
        const accId = `${companyId}-${acc.accountNumber}`;
        const balance = acc.balance || 0;
        const type = ['leumi', 'hapoalim', 'discount', 'mizrahi'].includes(companyId) ? 'bank' : 'credit';

        db.run(
          `INSERT INTO accounts (id, name, type, balance, status, lastSync, errorMsg) 
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET balance=excluded.balance, status='success', lastSync=excluded.lastSync, errorMsg=''`,
          [accId, `${companyId} (${acc.accountNumber})`, type, balance, 'success', now, '']
        );

        acc.txns.forEach(tx => {
          const hash = `${accId}-${tx.date}-${tx.chargedAmount}-${tx.description}`;
          const txDate = new Date(tx.date).toLocaleDateString('he-IL'); 
          
          // ניסיון לקטלג לפי זיכרון קודם -> אם אין, ניסיון לקטלג אוטומטית לפי מילות מפתח -> אחרת 'ללא סיווג'
          const category = mappings[tx.description] || guessCategory(tx.category, tx.description);
          const installmentsStr = tx.installments ? JSON.stringify(tx.installments) : null;
          const status = tx.status || 'completed';

          db.run(
            `INSERT OR IGNORE INTO transactions (hash, date, description, category, amount, account, status, installments, originalCategory) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [hash, txDate, tx.description, category, tx.chargedAmount, accId, status, installmentsStr, tx.category || '']
          );
        });
      });

      res.json({ success: true });
    } else {
      console.error(`❌ שגיאת סריקה: ${scrapeResult.errorType}`);
      res.status(400).json({ success: false, errorType: scrapeResult.errorType, errorMessage: scrapeResult.errorMessage });
    }
  } catch (error) {
    console.error('שגיאת שרת פנימית:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.use(express.static(path.join(__dirname, 'frontend/dist')));

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🚀 השרת פועל בכתובת http://localhost:${PORT}`);
});