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
import rateLimit from 'express-rate-limit'; 
import TelegramBot from 'node-telegram-bot-api';
import cron from 'node-cron';


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());

const dataDir = path.join(__dirname, 'data'); 
const secretsDir = path.join(__dirname, 'secrets'); 
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
if (!fs.existsSync(secretsDir)) fs.mkdirSync(secretsDir);

console.log('[SYSTEM] 🛠️ File system verified.');

// ==========================================
// PART 2: TELEGRAM UI CONSTANTS & ENGINE
// ==========================================
let bot = null;
if (process.env.TELEGRAM_BOT_TOKEN) {
  bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
  console.log(`[TELEGRAM] 🤖 Bot initialized and polling for messages...`);
} else {
  console.log(`[TELEGRAM] ⚠️ No Bot Token found. Telegram features are disabled.`);
}

const BOT_CATEGORIES = {
  incomes: [
    { id: 'inc_salary', name: 'משכורת', emoji: '💼' },
    { id: 'inc_allowance', name: 'קצבה או מלגה', emoji: '🏛️' },
    { id: 'inc_property', name: 'הכנסה מנכס', emoji: '🏠' },
    { id: 'inc_business', name: 'הכנסה מעסק', emoji: '👔' },
    { id: 'inc_dividends', name: 'דיווידנדים ורווחים', emoji: '📈' },
    { id: 'inc_misc', name: 'הכנסות שונות', emoji: '➕' }
  ],
  expenses: [
    { id: 'exp_household', name: 'משק בית', emoji: '🏠', subs: [{ id: 'hh_telecom', name: 'טלפון ואינטרנט', emoji: '📺' }, { id: 'hh_mortgage', name: 'משכנתא', emoji: '🔑' }, { id: 'hh_rent', name: 'דמי שכירות', emoji: '🏡' }, { id: 'hh_taxes', name: 'ארנונה', emoji: '🏛️' }, { id: 'hh_committee', name: 'ועד בית', emoji: '👥' }, { id: 'hh_water', name: 'מים', emoji: '💧' }, { id: 'hh_gas', name: 'גז והסקה', emoji: '🔥' }, { id: 'hh_electricity', name: 'חשמל', emoji: '⚡' }, { id: 'hh_insurance', name: 'ביטוח דירה', emoji: '🛡️' }, { id: 'hh_maintenance', name: 'אחזקת בית', emoji: '🔨' }, { id: 'hh_cleaning', name: 'ניקיון', emoji: '✨' }, { id: 'hh_gardening', name: 'גינון', emoji: '🌿' }, { id: 'hh_misc', name: 'שונות', emoji: '➕' }] },
    { id: 'exp_shopping', name: 'עושים קניות', emoji: '🛍️', subs: [{ id: 'shop_supermarket', name: 'סופר ומכולת', emoji: '🛒' }, { id: 'shop_furniture', name: 'ריהוט לבית', emoji: '🛋️' }, { id: 'shop_electronics', name: 'אלקטרוניקה', emoji: '💻' }, { id: 'shop_clothing', name: 'בגדים והנעלה', emoji: '👕' }, { id: 'shop_jewelry', name: 'תכשיטים', emoji: '⌚' }, { id: 'shop_tobacco', name: 'טבק ועישון', emoji: '🚬' }, { id: 'shop_misc', name: 'שונות', emoji: '➕' }] },
    { id: 'exp_transport', name: 'רכב ותחבורה', emoji: '🚗', subs: [{ id: 'trans_fuel', name: 'דלק וטעינה', emoji: '⛽' }, { id: 'trans_rental', name: 'השכרת רכב', emoji: '🚙' }, { id: 'trans_public', name: 'תחבורה ציבורית', emoji: '🚌' }, { id: 'trans_parking', name: 'חנייה', emoji: '🅿️' }, { id: 'trans_fines', name: 'קנסות', emoji: '📜' }, { id: 'trans_garage', name: 'מוסך ואחזקה', emoji: '🔧' }, { id: 'trans_tolls', name: 'כבישי אגרה', emoji: '🛣️' }, { id: 'trans_insurance', name: 'ביטוח רכב', emoji: '🛡️' }, { id: 'trans_misc', name: 'שונות', emoji: '➕' }] },
    { id: 'exp_health', name: 'בריאות וטיפוח', emoji: '❤️', subs: [{ id: 'hlth_alternative', name: 'רפואה משלימה', emoji: '🌿' }, { id: 'hlth_services', name: 'ייעוץ וטיפול', emoji: '🩺' }, { id: 'hlth_insurance', name: 'ביטוחי בריאות', emoji: '💓' }, { id: 'hlth_dental', name: 'רפואת שיניים', emoji: '🦷' }, { id: 'hlth_optical', name: 'אופטיקה', emoji: '👓' }, { id: 'hlth_pharmacy', name: 'בתי מרקחת', emoji: '💊' }, { id: 'hlth_beauty', name: 'טיפולי יופי', emoji: '✂️' }, { id: 'hlth_fitness', name: 'כושר', emoji: '🏋️' }, { id: 'hlth_misc', name: 'שונות', emoji: '➕' }] },
    { id: 'exp_family', name: 'משפחה והשכלה', emoji: '👨‍👩‍👧‍👦', subs: [{ id: 'fam_school', name: 'גן ובית ספר', emoji: '🎒' }, { id: 'fam_higher_ed', name: 'השכלה גבוהה', emoji: '🎓' }, { id: 'fam_activities', name: 'חוגים', emoji: '⛺' }, { id: 'fam_babysitter', name: 'בייביסיטר', emoji: '👶' }, { id: 'fam_toys', name: 'משחקים', emoji: '🎮' }, { id: 'fam_baby', name: 'גיל הרך', emoji: '🍼' }, { id: 'fam_support', name: 'תמיכה', emoji: '🤝' }, { id: 'fam_pets', name: 'חיות מחמד', emoji: '🐕' }, { id: 'fam_misc', name: 'שונות', emoji: '➕' }] },
    { id: 'exp_leisure', name: 'פנאי ותרבות', emoji: '🎟️', subs: [{ id: 'leis_shows', name: 'הופעות וקולנוע', emoji: '🍿' }, { id: 'leis_gifts', name: 'מתנות ואירועים', emoji: '🎁' }, { id: 'leis_music', name: 'מוזיקה וקריאה', emoji: '🎵' }, { id: 'leis_workshops', name: 'סדנאות', emoji: '🎨' }, { id: 'leis_hobbies', name: 'תחביבים', emoji: '🚴' }, { id: 'leis_sports', name: 'ספורט', emoji: '🏆' }, { id: 'leis_misc', name: 'שונות', emoji: '➕' }] },
    { id: 'exp_dining', name: 'אוכלים בחוץ', emoji: '🍽️', subs: [{ id: 'dine_fastfood', name: 'מזון מהיר', emoji: '🍔' }, { id: 'dine_restaurants', name: 'מסעדות ופאבים', emoji: '🍻' }, { id: 'dine_misc', name: 'שונות', emoji: '🍽️' }] },
    { id: 'exp_travel', name: 'חופשות וטיולים', emoji: '✈️', subs: [{ id: 'trvl_flights', name: 'טיסות', emoji: '🛫' }, { id: 'trvl_attractions', name: 'אטרקציות', emoji: '🗺️' }, { id: 'trvl_accommodation', name: 'לינה', emoji: '🏨' }, { id: 'trvl_misc', name: 'שונות', emoji: '➕' }] },
    { id: 'exp_business', name: 'שירותים עיסקיים', emoji: '💼', subs: [{ id: 'biz_delivery', name: 'דואר ומשלוחים', emoji: '📦' }, { id: 'biz_legal', name: 'הנה"ח ומשפטי', emoji: '📄' }, { id: 'biz_marketing', name: 'שיווק', emoji: '🖨️' }, { id: 'biz_consulting', name: 'ייעוץ', emoji: '💡' }, { id: 'biz_misc', name: 'שונות', emoji: '➕' }] },
    { id: 'exp_financial', name: 'פיננסים', emoji: '🏦', subs: [{ id: 'fin_loans', name: 'פירעון הלוואה', emoji: '📉' }, { id: 'fin_fees', name: 'עמלות', emoji: '💸' }, { id: 'fin_interest', name: 'ריביות', emoji: '📊' }, { id: 'fin_misc', name: 'שונות', emoji: '➕' }] },
    { id: 'exp_misc', name: 'שונות', emoji: '❓', subs: [{ id: 'misc_taxes', name: 'מיסים', emoji: '🏛️' }, { id: 'misc_religion', name: 'דת ותרומות', emoji: '🤝' }, { id: 'misc_gambling', name: 'הימורים', emoji: '🎲' }, { id: 'misc_uncategorized', name: 'ללא סיווג', emoji: '❓' }, { id: 'misc_other', name: 'שונות', emoji: '➕' }] }
  ]
};

const MAIN_KEYBOARD = {
  reply_markup: {
    keyboard: [
      [{ text: '🔄 סנכרון' }, { text: '📊 מאזן חודשי' }],
      [{ text: '⏰ שעת עדכון' }]
    ],
    resize_keyboard: true,
    is_persistent: true
  }
};

const pendingStates = new Map(); 

const getTxKeyboard = (step, txId, extraData = null) => {
  let keyboard = [];
  if (step === 'main') {
    keyboard = [
      [{ text: '🏷️ שינוי קטגוריה', callback_data: `menu_${txId}_type` }],
      [{ text: '📝 הוספת הערה', callback_data: `menu_${txId}_note` }, { text: '✅ אישור תנועה', callback_data: `ok_${txId}` }]
    ];
  } 
  else if (step === 'type') {
    keyboard = [
      [{ text: '💸 הוצאה', callback_data: `menu_${txId}_exp` }, { text: '💰 הכנסה', callback_data: `menu_${txId}_inc` }],
      [{ text: '🔙 חזור', callback_data: `menu_${txId}_main` }]
    ];
  }
  else if (step === 'inc') {
    let row = [];
    BOT_CATEGORIES.incomes.forEach((cat, i) => {
      row.push({ text: `${cat.emoji} ${cat.name}`, callback_data: `set_${txId}_${cat.id}` });
      if (row.length === 2 || i === BOT_CATEGORIES.incomes.length - 1) { keyboard.push(row); row = []; }
    });
    keyboard.push([{ text: '🔙 חזור', callback_data: `menu_${txId}_type` }]);
  }
  else if (step === 'exp') {
    let row = [];
    BOT_CATEGORIES.expenses.forEach((cat, i) => {
      row.push({ text: `${cat.emoji} ${cat.name}`, callback_data: `subs_${txId}_${cat.id}` });
      if (row.length === 2 || i === BOT_CATEGORIES.expenses.length - 1) { keyboard.push(row); row = []; }
    });
    keyboard.push([{ text: '🔙 חזור', callback_data: `menu_${txId}_type` }]);
  }
  else if (step === 'subs' && extraData) {
    const parentCat = BOT_CATEGORIES.expenses.find(c => c.id === extraData);
    if (parentCat && parentCat.subs) {
      let row = [];
      parentCat.subs.forEach((sub, i) => {
        row.push({ text: `${sub.emoji} ${sub.name}`, callback_data: `set_${txId}_${sub.id}` });
        if (row.length === 2 || i === parentCat.subs.length - 1) { keyboard.push(row); row = []; }
      });
    }
    keyboard.push([{ text: '🔙 חזור', callback_data: `menu_${txId}_exp` }]);
  }
  return { inline_keyboard: keyboard };
};

// ==========================================
// PART 3: ZERO-KNOWLEDGE ENCRYPTION ENGINE
// ==========================================
const activeSessions = new Map(); 
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; 
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
  } catch (e) { 
    console.error(`[CRYPTO] ❌ Encryption Error:`, e);
    return text; 
  }
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
  } catch (e) { 
    // console.error(`[CRYPTO] ⚠️ Decryption failed for a string (might be normal if split-key used)`);
    return encText; 
  } 
}

// ==========================================
// PART 4: DATABASES INIT
// ==========================================
const dbPath = path.join(dataDir, 'moneyapp.sqlite');
const credsPath = path.join(secretsDir, 'credentials.sqlite');
const db = new sqlite3.Database(dbPath);
const credsDb = new sqlite3.Database(credsPath);

db.serialize(() => {
  console.log(`[DB] 🗄️ Initializing main DB: ${dbPath}`);
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
  console.log(`[DB] 🔐 Initializing credentials DB: ${credsPath}`);
  credsDb.run(`CREATE TABLE IF NOT EXISTS saved_credentials (id TEXT PRIMARY KEY, userId TEXT, companyId TEXT, username TEXT, password TEXT, scrapeDuration INTEGER)`);
  credsDb.run(`ALTER TABLE saved_credentials ADD COLUMN userId TEXT`, (err) => {});
  credsDb.run(`ALTER TABLE saved_credentials ADD COLUMN scrapeDuration INTEGER`, (err) => {});
});

// ==========================================
// PART 5: AUTHENTICATION & SESSIONS
// ==========================================
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, message: { success: false, message: 'יותר מדי ניסיונות התחברות, נסה שוב מאוחר יותר.' } });

app.post('/api/auth/register', (req, res) => {
  const { username, password } = req.body;
  console.log(`[AUTH] 👤 Registration attempt: ${username}`);
  const userId = crypto.randomUUID();
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = crypto.scryptSync(password, salt, 64).toString('hex');

  db.run(`INSERT INTO users (id, username, passwordHash, salt) VALUES (?, ?, ?, ?)`, [userId, username, passwordHash, salt], function(err) {
    if (err) {
      console.error(`[AUTH] ❌ Registration failed for ${username}: Name already exists`);
      return res.status(400).json({ success: false, message: 'שם המשתמש כבר קיים' });
    }
    db.run(`UPDATE transactions SET userId = ? WHERE userId IS NULL`, [userId]);
    db.run(`UPDATE accounts SET userId = ? WHERE userId IS NULL`, [userId]);
    credsDb.run(`UPDATE saved_credentials SET userId = ? WHERE userId IS NULL`, [userId]);
    console.log(`[AUTH] ✅ Registration successful for ${username} (ID: ${userId})`);
    res.json({ success: true });
  });
});

app.post('/api/auth/login', loginLimiter, (req, res) => {
  const { username, password } = req.body;
  console.log(`[AUTH] 🔐 Login attempt: ${username}`);
  db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
    if (!user) {
      console.error(`[AUTH] ❌ Login failed: User ${username} not found`);
      return res.status(401).json({ success: false, message: 'פרטים שגויים' });
    }
    const hashVerify = crypto.scryptSync(password, user.salt, 64).toString('hex');
    if (hashVerify !== user.passwordHash) {
      console.error(`[AUTH] ❌ Login failed: Incorrect password for ${username}`);
      return res.status(401).json({ success: false, message: 'פרטים שגויים' });
    }
    const masterKey = crypto.pbkdf2Sync(password, user.salt, 100000, 32, 'sha256');
    const token = crypto.randomUUID();
    activeSessions.set(token, { userId: user.id, masterKey, expiresAt: Date.now() + SESSION_TIMEOUT_MS });
    console.log(`[AUTH] ✅ Login success: ${username}. Session created.`);
    res.json({ success: true, token });
  });
});

const requireAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  const session = activeSessions.get(token);
  if (!session || Date.now() > session.expiresAt) {
    if (session) {
      console.log(`[AUTH] 🕒 Session expired for user ${session.userId}. Removing...`);
      activeSessions.delete(token); 
    }
    return res.status(401).json({ success: false, message: 'לא מורשה או שהחיבור פג תוקף' });
  }
  session.expiresAt = Date.now() + SESSION_TIMEOUT_MS;
  req.user = session;
  next();
};

// ==========================================
// PART 6: HELPER FUNCTIONS
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
// PART 7: SAVE SCRAPE RESULT & TELEGRAM NOTIFY
// ==========================================
async function saveScrapeResult(scrapeResult, companyId, mappings, scrapeDuration, userId, masterKey, chatIdFromSync = null) {
  const now = formatILDate(new Date()) + ' ' + new Date().toLocaleTimeString('he-IL');
  const userChatId = chatIdFromSync || await new Promise(res => db.get(`SELECT value FROM settings WHERE key = 'telegram_chat_id' AND userId = ?`, [userId], (err, row) => res(row ? row.value : null)));
  let newTxCount = 0;

  console.log(`[DB-SAVE] 💾 Processing scrape results for ${companyId}...`);

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
      const exists = await new Promise(res => db.get(`SELECT id FROM transactions WHERE hash = ?`, [hash], (err, row) => res(row)));
      if (exists) continue; 

      newTxCount++;
      const txDate = formatILDate(tx.date); 
      const billingDate = tx.processedDate ? formatILDate(tx.processedDate) : txDate;
      const category = mappings[tx.description] || guessCategory(tx.category, tx.description);
      const installmentsStr = tx.installments ? JSON.stringify(tx.installments) : null;
      const status = tx.status || 'completed';

      const encAmount = encryptData(String(tx.chargedAmount), masterKey);
      const encDesc = encryptData(tx.description, masterKey);
      const encCategory = encryptData(category, masterKey);
      const encOriginalCategory = encryptData(tx.category || '', masterKey);

      const txId = await new Promise((resolve) => {
        db.run(`INSERT INTO transactions (hash, userId, date, description, category, amount, account, status, installments, originalCategory, billingDate, notes, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [hash, userId, txDate, encDesc, encCategory, encAmount, accId, status, installmentsStr, encOriginalCategory, billingDate, '', ''], function() { resolve(this.lastID); });
      });

      console.log(`[DB-SAVE] ✨ New Transaction saved: ${tx.description} | Amount: ${tx.chargedAmount} | Cat: ${category}`);

      if (userChatId && bot && status !== 'pending') {
        const messageText = `💳 *תנועה חדשה!*\n====================\n🏪 *עסק:* ${tx.description}\n💰 *סכום:* ₪${tx.chargedAmount}\n📅 *תאריך:* ${txDate}\n🏦 *חשבון:* ${companyId} (${acc.accountNumber})`;
        console.log(`[TELEGRAM] 📤 Sending notification to ${userChatId} for Tx ID: ${txId}`);
        bot.sendMessage(userChatId, messageText, { parse_mode: 'Markdown', reply_markup: JSON.stringify(getTxKeyboard('main', txId)) });
      }
    }
  }
  console.log(`[DB-SAVE] ✅ Finished ${companyId}. Total new transactions: ${newTxCount}`);
  return newTxCount;
}

// ==========================================
// PART 8: CREDENTIALS & SETTINGS ROUTES
// ==========================================
app.get('/api/credentials', requireAuth, (req, res) => {
  db.get(`SELECT salt FROM users WHERE id = ?`, [req.user.userId], (err, user) => {
    if (!user) return res.json({ credentials: [] });
    const botKey = crypto.pbkdf2Sync(process.env.SERVER_SECRET_KEY, user.salt, 100000, 32, 'sha256');
    credsDb.all('SELECT id, companyId, username FROM saved_credentials WHERE userId = ?', [req.user.userId], (err, rows) => { 
      if (!rows) return res.json({ credentials: [] });
      const decryptedCredentials = rows.map(row => ({ id: row.id, companyId: row.companyId, username: decryptData(row.username, botKey) }));
      res.json({ credentials: decryptedCredentials }); 
    });
  });
});

app.post('/api/credentials', requireAuth, (req, res) => {
  const { companyId, username, password, scrapeDuration } = req.body;
  const id = crypto.createHash('sha256').update(`${companyId}-${username}`).digest('hex');
  console.log(`[API] 📥 Request to save credentials for ${companyId}`);

  if (!process.env.SERVER_SECRET_KEY) {
    console.error(`[API] ❌ FATAL: SERVER_SECRET_KEY is missing.`);
    return res.status(500).json({ success: false, error: 'Missing server secret' });
  }

  db.get(`SELECT salt FROM users WHERE id = ?`, [req.user.userId], (err, user) => {
    if (!user) return res.status(400).json({ success: false });
    try {
        const botKey = crypto.pbkdf2Sync(process.env.SERVER_SECRET_KEY, user.salt, 100000, 32, 'sha256');
        const encUsername = encryptData(username, botKey);
        const encPass = encryptData(password, botKey);

        credsDb.run(`INSERT INTO saved_credentials (id, userId, companyId, username, password, scrapeDuration) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET username=excluded.username, password=excluded.password, scrapeDuration=excluded.scrapeDuration`, 
          [id, req.user.userId, companyId, encUsername, encPass, scrapeDuration || null], (err) => { 
             if(err) console.error(`[API] ❌ Error saving credentials:`, err);
             else console.log(`[API] ✅ Credentials encrypted and saved for ${companyId}`);
             res.json({ success: !err }); 
        });
    } catch (error) { 
      console.error(`[API] ❌ Credentials encryption crash:`, error);
      res.status(500).json({ success: false }); 
    }
  });
});

app.delete('/api/credentials/:id', requireAuth, (req, res) => {
  console.log(`[API] 🗑️ Deleting credential ${req.params.id}`);
  credsDb.run(`DELETE FROM saved_credentials WHERE id = ? AND userId = ?`, [req.params.id, req.user.userId], (err) => { res.json({ success: true }); });
});

app.post('/api/settings', requireAuth, (req, res) => {
  const { key, value } = req.body;
  console.log(`[API] ⚙️ Updating setting: ${key}`);
  db.run(`INSERT INTO settings (key, userId, value) VALUES (?, ?, ?) ON CONFLICT(key, userId) DO UPDATE SET value=excluded.value`, [key, req.user.userId, value], (err) => { res.json({ success: !err }); });
});

// ==========================================
// PART 9: DATA & ACCOUNTS ROUTES
// ==========================================
app.get('/api/data', requireAuth, (req, res) => {
  db.get(`SELECT salt FROM users WHERE id = ?`, [req.user.userId], (err, user) => {
    if (!user) return res.status(400).json({ success: false });
    const botKey = crypto.pbkdf2Sync(process.env.SERVER_SECRET_KEY, user.salt, 100000, 32, 'sha256');

    const smartDecrypt = (cipherText) => {
      let decrypted = decryptData(cipherText, req.user.masterKey);
      if (decrypted && decrypted.includes(':')) { 
        let botDecrypted = decryptData(cipherText, botKey);
        if (botDecrypted && !botDecrypted.includes(':')) return botDecrypted;
      }
      return decrypted;
    };

    db.all('SELECT * FROM transactions WHERE userId = ?', [req.user.userId], (err, transactions) => {
      db.all('SELECT * FROM accounts WHERE userId = ?', [req.user.userId], (err, accounts) => {
        db.all('SELECT * FROM settings WHERE userId = ?', [req.user.userId], (err, settingsRows) => {
          const decryptedAccounts = accounts.map(acc => ({ ...acc, balance: parseFloat(decryptData(acc.balance, req.user.masterKey)) || 0 }));
          const parsedTransactions = transactions.map(tx => ({
            ...tx,
            description: smartDecrypt(tx.description),
            amount: parseFloat(smartDecrypt(tx.amount)) || 0,
            category: smartDecrypt(tx.category), 
            originalCategory: smartDecrypt(tx.originalCategory),
            notes: smartDecrypt(tx.notes) || '',
            tags: smartDecrypt(tx.tags) || '',
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
});

app.post('/api/update-account', requireAuth, (req, res) => {
  const { id, name, billingDate, scrapeDuration } = req.body;
  console.log(`[API] ✏️ Updating account: ${id}`);
  db.run(`UPDATE accounts SET name = ?, billingDate = ?, scrapeDuration = ? WHERE id = ? AND userId = ?`, [name, billingDate, scrapeDuration || null, id, req.user.userId], (err) => { 
    credsDb.run(`UPDATE saved_credentials SET scrapeDuration = ? WHERE id = ? AND userId = ?`, [scrapeDuration || null, id, req.user.userId], () => { res.json({ success: !err }); });
  });
});

app.delete('/api/account/:id', requireAuth, (req, res) => {
  const accId = req.params.id;
  console.log(`[API] 🗑️ Deleting account and transactions: ${accId}`);
  db.run(`DELETE FROM accounts WHERE id = ? AND userId = ?`, [accId, req.user.userId], (err) => {
    db.run(`DELETE FROM transactions WHERE account = ? AND userId = ?`, [accId, req.user.userId], () => { res.json({ success: true }); });
  });
});

app.post('/api/update-transaction', requireAuth, (req, res) => {
  const { transactionId, description, categoryId, notes, tags } = req.body;
  console.log(`[API] ✏️ Updating transaction: ${transactionId} to Cat: ${categoryId}`);
  const encCategory = encryptData(categoryId, req.user.masterKey);
  const encNotes = encryptData(notes, req.user.masterKey);
  const encTags = encryptData(tags, req.user.masterKey);

  db.run(`UPDATE transactions SET category = ?, notes = ?, tags = ? WHERE id = ? AND userId = ?`, [encCategory, encNotes, encTags, transactionId, req.user.userId], (err) => {
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

app.post('/api/add-transaction', requireAuth, (req, res) => {
  const { date, description, categoryId, amount, accountId, notes, type } = req.body;
  console.log(`[API] ➕ Adding manual transaction: ${description}`);
  
  let finalAmount = parseFloat(amount) || 0;
  if (type === 'expense' && finalAmount > 0) finalAmount = -finalAmount;
  if (type === 'income' && finalAmount < 0) finalAmount = Math.abs(finalAmount);

  const hash = `manual-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const encAmount = encryptData(String(finalAmount), req.user.masterKey);
  const encDesc = encryptData(description, req.user.masterKey);
  const encCategory = encryptData(categoryId, req.user.masterKey);
  const encNotes = encryptData(notes || '', req.user.masterKey);
  const encOriginalCategory = encryptData('manual', req.user.masterKey);

  db.run(`INSERT INTO transactions (hash, userId, date, description, category, amount, account, status, originalCategory, billingDate, notes, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [hash, req.user.userId, date, encDesc, encCategory, encAmount, accountId, 'completed', encOriginalCategory, date, encNotes, ''], function(err) {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true, transactionId: this.lastID });
  });
});

// ==========================================
// PART 10: TELEGRAM CALLBACKS & LISTENER
// ==========================================
if (bot) {
  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text || '';
    console.log(`[TELEGRAM] 📥 Received message from ${chatId}: "${text}"`);

    if (pendingStates.has(chatId)) {
      const state = pendingStates.get(chatId);
      console.log(`[TELEGRAM] ⏳ User is in pending state: ${state.type}`);
      db.get(`SELECT userId, salt FROM settings JOIN users ON settings.userId = users.id WHERE settings.key = 'telegram_chat_id' AND settings.value = ?`, [String(chatId)], (err, user) => {
        if (!user) return;
        const botKey = crypto.pbkdf2Sync(process.env.SERVER_SECRET_KEY, user.salt, 100000, 32, 'sha256');

        if (state.type === 'note') {
          const encNote = encryptData(text, botKey);
          db.run(`UPDATE transactions SET notes = ? WHERE id = ? AND userId = ?`, [encNote, state.txId, user.userId], () => {
            console.log(`[TELEGRAM] ✅ Note saved for Tx ${state.txId}`);
            bot.sendMessage(chatId, '✅ ההערה נשמרה בהצלחה!', MAIN_KEYBOARD);
            bot.sendMessage(chatId, `חזרת לתפריט הראשי של התנועה:`, { reply_markup: JSON.stringify(getTxKeyboard('main', state.txId)) });
            pendingStates.delete(chatId);
          });
        } 
        else if (state.type === 'time') {
          const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
          if (!timeRegex.test(text)) {
            console.log(`[TELEGRAM] ❌ Invalid time format entered: ${text}`);
            return bot.sendMessage(chatId, '❌ פורמט לא חוקי. אנא הקלד שעה בפורמט HH:MM (לדוגמה: 08:30 או 20:00).');
          }
          db.run(`INSERT INTO settings (key, userId, value) VALUES ('sync_time', ?, ?) ON CONFLICT(key, userId) DO UPDATE SET value=excluded.value`, [user.userId, text], () => {
            console.log(`[TELEGRAM] ✅ Sync time updated to ${text} for user ${user.userId}`);
            bot.sendMessage(chatId, `⏰ מעולה! הנתונים שלך יסונכרנו אוטומטית בכל יום בשעה ${text}.`, MAIN_KEYBOARD);
            pendingStates.delete(chatId);
          });
        }
      });
      return; 
    }

    if (text === '/start') {
      console.log(`[TELEGRAM] 🚀 Sent welcome message to ${chatId}`);
      return bot.sendMessage(chatId, `ברוך הבא ל-MoneyApp!\nה-Chat ID שלך הוא: \`${chatId}\`\nהזן אותו בהגדרות באתר.`, { parse_mode: 'Markdown', ...MAIN_KEYBOARD });
    }

    db.get(`SELECT userId FROM settings WHERE key = 'telegram_chat_id' AND value = ?`, [String(chatId)], async (err, row) => {
      if (!row) {
        console.log(`[TELEGRAM] ❌ Unrecognized Chat ID: ${chatId}`);
        return bot.sendMessage(chatId, 'לא זוהה משתמש מקושר. אנא קשר את ה-Chat ID בהגדרות האתר.');
      }
      const userId = row.userId;

      if (text === '🔄 סנכרון' || text === '/sync') {
        console.log(`[TELEGRAM] 🔄 Manual sync requested by user ${userId}`);
        bot.sendMessage(chatId, '⏳ בודק תנועות חדשות...', MAIN_KEYBOARD);
        runBackgroundSync(userId, chatId, false);
      } 
      else if (text === '⏰ שעת עדכון') {
        console.log(`[TELEGRAM] ⏰ Time update requested by user ${userId}`);
        pendingStates.set(chatId, { type: 'time' });
        bot.sendMessage(chatId, 'הקלד את השעה שבה תרצה לקבל את העדכון היומי בפורמט 24h (לדוגמה: 20:00):', { reply_markup: { remove_keyboard: true } });
      }
      else if (text === '📊 מאזן חודשי') {
        console.log(`[TELEGRAM] 📊 Balance requested by user ${userId}`);
        db.get(`SELECT salt FROM users WHERE id = ?`, [userId], (err, user) => {
          if (!user) return;
          const botKey = crypto.pbkdf2Sync(process.env.SERVER_SECRET_KEY, user.salt, 100000, 32, 'sha256');
          
          const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
          const currentYear = new Date().getFullYear();

          db.all(`SELECT amount, category FROM transactions WHERE userId = ? AND date LIKE ?`, [userId, `%/${currentMonth}/${currentYear}`], (err, txs) => {
            let totalIncome = 0; let totalExpense = 0;
            
            (txs || []).forEach(tx => {
              const rawAmt = decryptData(tx.amount, botKey);
              const rawCat = decryptData(tx.category, botKey) || '';
              
              if (!rawAmt || rawAmt.includes(':')) {
                console.log(`[TELEGRAM] ⚠️ Skipped calculating a transaction (Decryption failed/old key)`);
                return; 
              }
              
              // משתמשים במספר המקורי במקום Math.abs כדי לשמור על סימן הכסף
              const originalAmt = parseFloat(rawAmt) || 0;
              
              if (rawCat.startsWith('inc_')) {
                totalIncome += originalAmt;
              } else if (rawCat !== 'misc_uncategorized') {
                // פחות כפול מינוס = פלוס. לכן מספר שלילי יגדיל את ההוצאות.
                // אם שמנו 'הוצאה' על מספר חיובי (זיכוי), זה יקטין את ההוצאות.
                totalExpense -= originalAmt;
              } else {
                // מצב ברירת מחדל בו לא ניתן סיווג למערכת
                if (originalAmt > 0) totalIncome += originalAmt;
                else totalExpense -= originalAmt;
              }
            });
            
            const balance = totalIncome - totalExpense;
            console.log(`[TELEGRAM] 📊 Balance calculated: Inc: ${totalIncome}, Exp: ${totalExpense}`);
            const msg = `📊 *מאזן חודש נוכחי*\n\n💰 הכנסות: ₪${totalIncome.toFixed(2)}\n💸 הוצאות: ₪${totalExpense.toFixed(2)}\n\n⚖️ *מאזן: ₪${balance.toFixed(2)}*`;
            bot.sendMessage(chatId, msg, { parse_mode: 'Markdown', ...MAIN_KEYBOARD });
          });
        });
      }
    });
  });

  bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    const msgId = query.message.message_id;
    const data = query.data; 

    const parts = data.split('_');
    const action = parts[0]; 
    const txId = parts[1];
    const extraData = parts.slice(2).join('_'); 

    console.log(`[TELEGRAM] 🖱️ Inline Button Clicked: ${action} | Tx: ${txId} | Extra: ${extraData}`);

    db.get(`SELECT userId, salt FROM settings JOIN users ON settings.userId = users.id WHERE settings.key = 'telegram_chat_id' AND settings.value = ?`, [String(chatId)], (err, user) => {
      if (!user) return bot.answerCallbackQuery(query.id, { text: 'משתמש לא נמצא' });

      if (action === 'menu') {
        if (extraData === 'note') {
           pendingStates.set(chatId, { type: 'note', txId: txId });
           bot.sendMessage(chatId, '✏️ הקלד את ההערה שתרצה לשמור עבור תנועה זו:', { reply_markup: { remove_keyboard: true } });
           return bot.answerCallbackQuery(query.id);
        }
        bot.editMessageReplyMarkup(getTxKeyboard(extraData, txId), { chat_id: chatId, message_id: msgId });
        return bot.answerCallbackQuery(query.id);
      }
      
      if (action === 'subs') {
        bot.editMessageReplyMarkup(getTxKeyboard('subs', txId, extraData), { chat_id: chatId, message_id: msgId });
        return bot.answerCallbackQuery(query.id);
      }

      if (action === 'ok') {
        console.log(`[TELEGRAM] ✅ Transaction ${txId} confirmed by user`);
        bot.answerCallbackQuery(query.id, { text: '✅ התנועה אושרה וסווגה!' });
        return bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: msgId });
      }

      if (action === 'set') {
        const botKey = crypto.pbkdf2Sync(process.env.SERVER_SECRET_KEY, user.salt, 100000, 32, 'sha256');
        const encCategory = encryptData(extraData, botKey);
        db.run(`UPDATE transactions SET category = ? WHERE id = ? AND userId = ?`, [encCategory, txId, user.userId], (err) => {
          if (err) {
            console.error(`[TELEGRAM] ❌ Failed to update category for Tx ${txId}:`, err);
            return bot.answerCallbackQuery(query.id, { text: '❌ שגיאה בשמירה' });
          }
          console.log(`[TELEGRAM] ✅ Category updated to ${extraData} for Tx ${txId}`);
          bot.answerCallbackQuery(query.id, { text: '✅ הקטגוריה עודכנה!' });
          bot.editMessageReplyMarkup(getTxKeyboard('main', txId), { chat_id: chatId, message_id: msgId });
        });
      }
    });
  });
}


// ==========================================
// PART 11: BACKGROUND AUTO-SYNC & CRON
// ==========================================
async function runBackgroundSync(userId, chatId, isScheduled = true) {
  console.log(`\n==========================================`);
  console.log(`[SYNC-ENGINE] 🚀 Starting Background Sync for User: ${userId} (Scheduled: ${isScheduled})`);
  console.log(`==========================================`);
  
  if (chatId && bot && !isScheduled) bot.sendMessage(chatId, '⏳ סנכרון התחיל...', MAIN_KEYBOARD);

  try {
    const creds = await new Promise(res => credsDb.all('SELECT * FROM saved_credentials WHERE userId = ?', [userId], (err, rows) => res(rows || [])));
    if (creds.length === 0) {
      console.log(`[SYNC-ENGINE] ⚠️ No accounts configured in vault.`);
      if (chatId && bot && !isScheduled) bot.sendMessage(chatId, '❌ אין חשבונות שמורים במערכת.', MAIN_KEYBOARD);
      return;
    }

    const user = await new Promise(res => db.get(`SELECT salt FROM users WHERE id = ?`, [userId], (err, row) => res(row)));
    const botKey = crypto.pbkdf2Sync(process.env.SERVER_SECRET_KEY, user.salt, 100000, 32, 'sha256');
    const globalScrapeDuration = await new Promise(res => db.get(`SELECT value FROM settings WHERE key = 'scrape_duration' AND userId = ?`, [userId], (err, row) => res(row ? parseInt(row.value) : 1)));
    const mappings = await new Promise(res => db.all('SELECT * FROM merchant_categories', [], (err, rows) => { const map = {}; (rows||[]).forEach(r => map[r.merchant] = r.categoryId); res(map); }));

    let totalNewTx = 0;
    let anySuccess = false;

    for (const saved of creds) {
      const decUser = decryptData(saved.username, botKey);
      const decPass = decryptData(saved.password, botKey);
      
      if (!decPass || decPass.includes(':')) {
        console.log(`[SYNC-ENGINE] ❌ Decryption failed for ${saved.companyId}. Skipping.`);
        continue;
      }

      const maskedUser = decUser ? decUser.substring(0, 2) + '***' + decUser.slice(-2) : 'Unknown';
      console.log(`[SYNC-ENGINE] 🔄 Scraping [${saved.companyId}] with User [${maskedUser}]...`);

      const durationInt = parseInt(saved.scrapeDuration) || parseInt(globalScrapeDuration) || 1;
      const startDate = new Date(); startDate.setMonth(startDate.getMonth() - durationInt);
      const options = { companyId: saved.companyId, startDate, combineInstallments: false, showBrowser: false, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] };
      const scraper = createScraper(options);
      
      try {
        const scrapeResult = await scraper.scrape({ id: decUser, username: decUser, password: decPass });
        if (scrapeResult.success) {
          console.log(`[SYNC-ENGINE] ✅ Scraping successful for ${saved.companyId}.`);
          anySuccess = true;
          const newTx = await saveScrapeResult(scrapeResult, saved.companyId, mappings, durationInt, userId, botKey, chatId);
          totalNewTx += newTx;
        } else {
          console.error(`[SYNC-ENGINE] ⚠️ Scraping failed for ${saved.companyId}: ${scrapeResult.errorType} - ${scrapeResult.errorMessage}`);
        }
      } catch (e) { 
        console.error(`[SYNC-ENGINE] ❌ Scraper Exception for ${saved.companyId}:`, e.message); 
      }
    }

    console.log(`[SYNC-ENGINE] 🏁 Sync Process Finished. Total New Txs: ${totalNewTx}`);
    
    if (chatId && bot) {
       if (totalNewTx > 0) {
         bot.sendMessage(chatId, `✅ הסנכרון הסתיים! נוספו ${totalNewTx} תנועות חדשות.`, MAIN_KEYBOARD);
       } 
       else if (!isScheduled) {
         if (!anySuccess) bot.sendMessage(chatId, '⚠️ הסנכרון הסתיים עם שגיאות.', MAIN_KEYBOARD);
         else bot.sendMessage(chatId, '✅ הסנכרון הסתיים. לא נמצאו תנועות חדשות.', MAIN_KEYBOARD);
       }
    }
  } catch (error) { 
    console.error(`[SYNC-ENGINE] ❌ Critical Sync Error:`, error); 
  }
}

cron.schedule('* * * * *', () => {
  const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hour12: false });
  const currentTimeString = formatter.format(new Date()); 
  
  db.all(`SELECT u.id as userId, s1.value as chatId, COALESCE(s2.value, '20:00') as syncTime FROM users u JOIN settings s1 ON u.id = s1.userId AND s1.key = 'telegram_chat_id' LEFT JOIN settings s2 ON u.id = s2.userId AND s2.key = 'sync_time'`, [], (err, users) => {
    if (!users) return;
    users.forEach(user => {
      if (user.syncTime === currentTimeString) {
        console.log(`[CRON] ⏰ Scheduled time hit (${currentTimeString} IL Time) for user ${user.userId}. Launching silent sync.`);
        runBackgroundSync(user.userId, user.chatId, true);
      }
    });
  });
});

// ==========================================
// PART 12: MANUAL SYNC ROUTES & SERVER START
// ==========================================
app.post('/api/sync', requireAuth, async (req, res) => {
  let { companyId, credentials, savedCompanyId, accountId, customScrapeDuration } = req.body;
  let finalScrapeDuration = customScrapeDuration;

  if (accountId) {
    const knownCompanies = ['leumi', 'hapoalim', 'discount', 'mizrahi', 'beinleumi', 'yahav', 'massad', 'pagi', 'union-bank', 'isracard', 'max', 'visa-cal', 'amex'];
    savedCompanyId = knownCompanies.find(c => accountId.startsWith(c));
  }

  try {
    if (savedCompanyId) {
      console.log(`[API-SYNC] 🔍 Loading vault data for ${savedCompanyId}`);
      const saved = await new Promise((resolve) => { credsDb.get('SELECT * FROM saved_credentials WHERE companyId = ? AND userId = ?', [savedCompanyId, req.user.userId], (err, row) => resolve(row)); });
      if (!saved) return res.status(400).json({ success: false, errorMessage: 'פרטי ההתחברות לא נמצאו בכספת' });
      
      companyId = saved.companyId;
      const user = await new Promise(res => db.get(`SELECT salt FROM users WHERE id = ?`, [req.user.userId], (err, row) => res(row)));
      const botKey = crypto.pbkdf2Sync(process.env.SERVER_SECRET_KEY, user.salt, 100000, 32, 'sha256');
      
      credentials = { id: decryptData(saved.username, botKey), username: decryptData(saved.username, botKey), password: decryptData(saved.password, botKey) };
      if (!finalScrapeDuration) finalScrapeDuration = saved.scrapeDuration;
    }

    if (!finalScrapeDuration) {
      finalScrapeDuration = await new Promise((resolve) => { db.get(`SELECT value FROM settings WHERE key = 'scrape_duration' AND userId = ?`, [req.user.userId], (err, row) => resolve(row ? parseInt(row.value) : 1)); });
    }
    const durationInt = parseInt(finalScrapeDuration) || 1;
    const mappings = await new Promise((resolve) => { db.all('SELECT * FROM merchant_categories', [], (err, rows) => { const map = {}; (rows||[]).forEach(r => map[r.merchant] = r.categoryId); resolve(map); }); });
    const startDate = new Date(); startDate.setMonth(startDate.getMonth() - durationInt);

    console.log(`[API-SYNC] 🚀 Starting manual sync for ${companyId}`);
    const options = { companyId, startDate, combineInstallments: false, showBrowser: false, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] };
    const scraper = createScraper(options);
    
    scraper.onProgress((cId, payload) => { console.log(`[API-SYNC] ⏳ Progress for ${cId}: ${payload.type}`); });
    const scrapeResult = await scraper.scrape(credentials);

    if (scrapeResult.success) {
      console.log(`[API-SYNC] ✅ Scrape success. Saving data...`);
      // VITAL FIX: Encrypting with Bot Key so both site and telegram can read!
      const userForSync = await new Promise(res => db.get(`SELECT salt FROM users WHERE id = ?`, [req.user.userId], (err, row) => res(row)));
      const syncBotKey = crypto.pbkdf2Sync(process.env.SERVER_SECRET_KEY, userForSync.salt, 100000, 32, 'sha256');
      
      await saveScrapeResult(scrapeResult, companyId, mappings, durationInt, req.user.userId, syncBotKey);
      res.json({ success: true });
    } else {
      console.error(`[API-SYNC] ❌ Scrape Failed: ${scrapeResult.errorType}`);
      res.status(400).json({ success: false, errorType: scrapeResult.errorType, errorMessage: scrapeResult.errorMessage });
    }
  } catch (error) { 
    console.error(`[API-SYNC] ❌ Error:`, error);
    res.status(500).json({ success: false, message: error.message }); 
  }
});

app.post('/api/sync-all', requireAuth, async (req, res) => {
  console.log(`[API-SYNC-ALL] 🌐 Global sync requested by user`);
  try {
    const creds = await new Promise((resolve) => credsDb.all('SELECT * FROM saved_credentials WHERE userId = ?', [req.user.userId], (err, rows) => resolve(rows || [])));
    if (creds.length === 0) return res.json({success: false, message: 'אין חשבונות שמורים בכספת.'});
    
    const globalScrapeDuration = await new Promise((resolve) => { db.get(`SELECT value FROM settings WHERE key = 'scrape_duration' AND userId = ?`, [req.user.userId], (err, row) => resolve(row ? parseInt(row.value) : 1)); });
    const mappings = await new Promise((resolve) => { db.all('SELECT * FROM merchant_categories', [], (err, rows) => { const map = {}; (rows||[]).forEach(r => map[r.merchant] = r.categoryId); resolve(map); }); });
    const user = await new Promise(res => db.get(`SELECT salt FROM users WHERE id = ?`, [req.user.userId], (err, row) => res(row)));
    const botKey = crypto.pbkdf2Sync(process.env.SERVER_SECRET_KEY, user.salt, 100000, 32, 'sha256');

    let anySuccess = false;
    for (const saved of creds) {
      console.log(`[API-SYNC-ALL] 🔄 Processing ${saved.companyId}...`);
      const durationInt = parseInt(saved.scrapeDuration) || parseInt(globalScrapeDuration) || 1;
      const decUser = decryptData(saved.username, botKey);
      const decPass = decryptData(saved.password, botKey);
      const startDate = new Date(); startDate.setMonth(startDate.getMonth() - durationInt);

      const options = { companyId: saved.companyId, startDate, combineInstallments: false, showBrowser: false, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] };
      const scraper = createScraper(options);
      try {
        const scrapeResult = await scraper.scrape({ id: decUser, username: decUser, password: decPass });
        if (scrapeResult.success) { 
          // VITAL FIX: Encrypting with Bot Key so both site and telegram can read!
          await saveScrapeResult(scrapeResult, saved.companyId, mappings, durationInt, req.user.userId, botKey); 
          anySuccess = true; 
          console.log(`[API-SYNC-ALL] ✅ Completed ${saved.companyId}`);
        }
      } catch(e) { console.error(`[API-SYNC-ALL] ❌ Error in ${saved.companyId}:`, e.message); }
    }
    console.log(`[API-SYNC-ALL] 🏁 Global sync finished.`);
    res.json({ success: anySuccess, message: anySuccess ? 'הסנכרון הושלם' : 'שגיאה בחלק מהחשבונות' });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
});

app.use(express.static(path.join(__dirname, 'frontend/dist')));
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
  ==========================================
  🚀 MoneyApp Server is Live!
  📡 URL: http://localhost:${PORT}
  ==========================================
  `);
});