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

// בניית טבלאות עם מזהה ייחודי למניעת כפילויות תנועות
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hash TEXT UNIQUE, 
    date TEXT, description TEXT, category TEXT, amount REAL, account TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY, name TEXT, type TEXT, balance REAL, status TEXT, lastSync TEXT, errorMsg TEXT
  )`);
});

// --- שליפת נתונים לתצוגה ---
app.get('/api/data', (req, res) => {
  db.all('SELECT * FROM transactions ORDER BY date(date) DESC, id DESC', [], (err, transactions) => {
    db.all('SELECT * FROM accounts', [], (err, accounts) => {
      res.json({ transactions, accounts });
    });
  });
});

// --- סנכרון נתונים אמיתי מול הבנקים! ---
app.post('/api/sync', async (req, res) => {
  const { companyId, credentials } = req.body;
  console.log(`מתחיל סריקה עבור: ${companyId}... (זה עשוי לקחת דקה או שתיים)`);

  try {
    const options = {
      companyId,
      // מושך נתונים מחודש אחרון אחורה
      startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)), 
      combineInstallments: false,
      showBrowser: false,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, // הכרחי לדוקר
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] // <--- השורה הקריטית שהוספנו!
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

        // שמירה/עדכון של החשבון
        db.run(
          `INSERT INTO accounts (id, name, type, balance, status, lastSync, errorMsg) 
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET balance=excluded.balance, status='success', lastSync=excluded.lastSync, errorMsg=''`,
          [accId, `${companyId} (${acc.accountNumber})`, type, balance, 'success', now, '']
        );

        // שמירת התנועות (תוך התעלמות מכפילויות בזכות ה-UNIQUE constraint)
        acc.txns.forEach(tx => {
          // יצירת חותמת ייחודית לעסקה
          const hash = `${accId}-${tx.date}-${tx.chargedAmount}-${tx.description}`;
          // תרגום תאריך לפורמט קריא ישראלי
          const txDate = new Date(tx.date).toLocaleDateString('he-IL'); 
          
          db.run(
            `INSERT OR IGNORE INTO transactions (hash, date, description, category, amount, account) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [hash, txDate, tx.description, 'כללי', tx.chargedAmount, accId]
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

// הגשת האתר
app.use(express.static(path.join(__dirname, 'frontend/dist')));

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🚀 השרת פועל בכתובת http://localhost:${PORT}`);
});