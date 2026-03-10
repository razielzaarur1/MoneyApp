// ==========================================
// PART 1: IMPORTS, STYLES & ERROR BOUNDARY
// ==========================================
import React, { useState, useEffect, useMemo } from 'react';
import * as Icons from 'lucide-react'; // ייבוא כל האייקונים כדי שנוכל לבחור מתוכם דינמית
import { 
  Home, CreditCard, ListOrdered, PieChart, Settings, RefreshCw, AlertCircle, CheckCircle2, TrendingUp, TrendingDown,
  Building, Wallet, Plus, Shield, ChevronLeft, ChevronDown, ChevronUp, ChevronRight, ShoppingBag, Utensils, Car, 
  Link as LinkIcon, Unlink, MoreHorizontal, Calendar, Edit2, X, Tag as TagIcon, Check, Lock, Clock, AlignLeft, 
  FileText, Save, Download, Info, Sun, Moon, Activity, ArrowDownRight, ArrowUpRight, Trash2, View, Unlock
} from 'lucide-react';

const themeStyles = `
  body { font-family: 'Assistant', sans-serif; font-weight: 400; }
  :root {
    --color-bg-main: #f8fafc; --color-bg-card: rgba(255, 255, 255, 0.85); --color-bg-card-hover: rgba(255, 255, 255, 1);
    --color-bg-input: rgba(241, 245, 249, 0.8); --color-text-main: #334155; --color-text-muted: #64748b;
    --color-border: rgba(203, 213, 225, 0.8); --color-nav-bg: rgba(255, 255, 255, 0.85); --shadow-card: 0 4px 20px -2px rgba(0, 0, 0, 0.05);
  }
  .dark-theme {
    --color-bg-main: #020617; --color-bg-card: rgba(15, 23, 42, 0.6); --color-bg-card-hover: rgba(30, 41, 59, 0.8);
    --color-bg-input: rgba(15, 23, 42, 0.8); --color-text-main: #f1f5f9; --color-text-muted: #94a3b8;
    --color-border: rgba(51, 65, 85, 0.5); --color-nav-bg: rgba(15, 23, 42, 0.8); --shadow-card: 0 4px 30px rgba(0,0,0,0.4);
  }
  .custom-scrollbar::-webkit-scrollbar { width: 6px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 10px; }
`;

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) return (<div style={{ padding: '2rem', color: 'red', direction: 'ltr', background: '#fee' }}><h2>🚨 משהו השתבש בריאקט!</h2><pre>{this.state.error?.toString()}</pre></div>);
    return this.props.children;
  }
}

// קומפוננטה חכמה שמציירת אייקון מתוך טקסט (מתוך ה-JSON)
const DynamicIcon = ({ name, ...props }) => {
  const IconComponent = Icons[name] || Icons.HelpCircle;
  return <IconComponent {...props} />;
};

// ==========================================
// PART 2: UTILS, AUTH FETCH & SHARED UI
// ==========================================
const getCategoryDetails = (subCatId, categories) => {
  const defaultCat = { id: 'misc_uncategorized', name: 'ללא סיווג', icon: 'MoreHorizontal', color: 'text-slate-500', bg: 'bg-slate-500/10', type: 'expense' };
  if (!subCatId || !categories) return { mainCat: defaultCat, subCat: defaultCat }; 
  
  const incomeCat = (categories.incomes || []).find(inc => inc.id === subCatId);
  if (incomeCat) return { mainCat: incomeCat, subCat: incomeCat };
  
  for (const mainCat of (categories.expenses || [])) {
    const subCat = mainCat.subs?.find(sub => sub.id === subCatId);
    if (subCat) return { mainCat, subCat };
  }
  return { mainCat: defaultCat, subCat: defaultCat };
};

const getCustomMonthYear = (dateString, startDay) => {
  if (!dateString || typeof dateString !== 'string') return null;
  const parts = dateString.split(/[\/\-.]/);
  if (parts.length >= 3) {
    let d = parseInt(parts[0], 10); let m = parseInt(parts[1], 10); let y = parseInt(parts[2], 10);
    let start = parseInt(startDay, 10) || 1;
    if (start > 1 && d < start) { m -= 1; if (m < 1) { m = 12; y -= 1; } }
    return `${String(m).padStart(2, '0')}/${y}`;
  }
  return null;
};

const calculateUpcomingCharge = (acc, transactions) => {
  if (acc.type === 'bank') return acc.balance || 0; 
  let scraperBalance = Math.abs(acc.balance || 0);
  const accountTxs = transactions.filter(t => t.accountId === acc.id || t.account === acc.id);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let upcomingTxsSum = 0;
  accountTxs.forEach(tx => {
    const dateStr = tx.billingDate || tx.date;
    if(!dateStr || typeof dateStr !== 'string') return;
    const parts = dateStr.split(/[\/\-.]/);
    if (parts.length >= 3) {
      const bDate = new Date(parts[2], parts[1] - 1, parts[0]);
      if (tx.status === 'pending' || bDate >= today) upcomingTxsSum += Math.abs(tx.amount || 0);
    }
  });
  return upcomingTxsSum > scraperBalance ? upcomingTxsSum : scraperBalance;
};

const authFetch = async (url, options = {}) => {
  const token = sessionStorage.getItem('app_token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const response = await fetch(url, { ...options, headers });
  if (response.status === 401) { sessionStorage.removeItem('app_token'); window.location.reload(); }
  return response;
};

const NeonCard = ({ children, className = "", noPadding = false }) => (
  <div className={`bg-[var(--color-bg-card)] backdrop-blur-xl border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-[var(--shadow-card)] transition-colors ${noPadding ? '' : 'p-6'} ${className}`}>{children}</div>
);

function StatCard({ title, amount, trend, icon, color }) {
  const colorMap = { blue: 'text-blue-500 bg-blue-500/10', green: 'text-emerald-500 bg-emerald-500/10', red: 'text-rose-500 bg-rose-500/10' };
  const bgClass = colorMap[color] || colorMap.blue;
  return (
    <NeonCard className="relative group">
      <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl -mr-8 -mt-8 transition-all ${bgClass}`}></div>
      <div className="relative z-10 flex justify-between items-start">
        <div>
          <div className="text-[var(--color-text-muted)] text-sm mb-1">{title}</div>
          <div dir="ltr" className="text-3xl font-medium text-[var(--color-text-main)] text-right">{amount}</div>
          <div className="text-xs text-[var(--color-text-muted)] mt-2">{trend}</div>
        </div>
        <div className={`p-3 rounded-xl ${bgClass} transition-transform group-hover:scale-110`}>{icon || <TagIcon size={24}/>}</div>
      </div>
    </NeonCard>
  );
}

function MobileNavItem({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center w-16 transition-colors ${active ? 'text-indigo-600' : 'text-[var(--color-text-muted)]'}`}>
      <div className={`mb-1 ${active ? 'scale-110' : ''}`}>{icon || <Home size={22}/>}</div><span className="text-[10px]">{label}</span>
    </button>
  );
}


// ==========================================
// PART 3: AUTH SCREEN
// ==========================================
function AuthScreen({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
    try {
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
      const data = await res.json();
      if (data.success) {
        if (isRegister) { setIsRegister(false); setError('נרשמת בהצלחה! כעת התחבר עם המפתח שיצרת.'); } 
        else { sessionStorage.setItem('app_token', data.token); onLogin(data.token); }
      } else { setError(data.message || 'שגיאה בפעולה'); }
    } catch(e) { setError('שגיאת תקשורת'); }
    setLoading(false);
  };

  return (
    <div dir="rtl" className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
         <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-[100px]"></div>
         <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px]"></div>
      </div>
      <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-700 p-8 rounded-3xl w-full max-w-md shadow-2xl relative z-10">
        <div className="text-center mb-8">
           <div className="inline-flex p-4 bg-indigo-500/10 rounded-2xl text-indigo-400 mb-4"><Lock size={32}/></div>
           <h1 className="text-3xl font-bold text-white tracking-tight">כספת כיס חכם</h1>
           <p className="text-slate-400 mt-2 text-sm">הנתונים שלך מוצפנים ונפתחים רק עם המפתח הזה.</p>
        </div>
        {error && <div className="p-3 bg-rose-500/10 text-rose-400 rounded-xl mb-6 text-sm font-medium text-center border border-rose-500/20">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-5">
           <div><label className="text-sm font-medium text-slate-400 mb-1 block">שם משתמש</label><input type="text" required value={username} onChange={e=>setUsername(e.target.value)} className="w-full bg-slate-900/50 border border-slate-700 text-white p-3 rounded-xl outline-none focus:border-indigo-500 transition-colors" /></div>
           <div><label className="text-sm font-medium text-slate-400 mb-1 block">מפתח כספת (סיסמה)</label><input type="password" required value={password} onChange={e=>setPassword(e.target.value)} className="w-full bg-slate-900/50 border border-slate-700 text-white p-3 rounded-xl outline-none focus:border-indigo-500 transition-colors text-left" dir="ltr" /></div>
           <button type="submit" disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] disabled:opacity-50">{loading ? 'מפענח...' : isRegister ? 'יצירת כספת מוצפנת' : 'פתח כספת'}</button>
        </form>
        <div className="mt-6 text-center"><button onClick={() => {setIsRegister(!isRegister); setError('');}} className="text-sm text-slate-400 hover:text-white transition-colors">{isRegister ? 'יש לך כבר מפתח? התחבר עכשיו' : 'משתמש חדש? צור כספת אישית'}</button></div>
      </div>
    </div>
  );
}


// ==========================================
// PART 4: MAIN APP SHELL & STATE
// ==========================================
function MainApp({ onLogout }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState({ incomes: [], expenses: [] }); // קטגוריות דינמיות
  const [appSettings, setAppSettings] = useState({ scrape_duration: '1', month_start_date: '1' });
  const [selectedMonth, setSelectedMonth] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [theme, setTheme] = useState('light');
  
  const [toast, setToast] = useState({ show: false, msg: '', type: 'info' });
  const showToast = (msg, type = 'info') => { setToast({ show: true, msg, type }); setTimeout(() => setToast({ show: false, msg: '', type: 'info' }), 4000); };

  const [selectedTx, setSelectedTx] = useState(null);
  const [selectedViewTx, setSelectedViewTx] = useState(null);
  const [editingAccount, setEditingAccount] = useState(null);
  const [syncModalType, setSyncModalType] = useState(null);
  const [isAddTxModalOpen, setIsAddTxModalOpen] = useState(false);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/data');
      const data = await res.json();
      const mappedTransactions = (data.transactions || []).map(tx => ({ ...tx, categoryId: tx.category || 'misc_uncategorized' }));
      setTransactions(mappedTransactions);
      setAccounts(data.accounts || []);
      const settings = data.settings || { scrape_duration: '1', month_start_date: '1' };
      setAppSettings(settings);
      if (data.rawCategories) setCategories(data.rawCategories);
      
      const monthStart = settings.month_start_date || '1';
      const months = new Set(mappedTransactions.map(tx => getCustomMonthYear(tx.date, monthStart)).filter(Boolean));
      const available = Array.from(months).sort((a, b) => { const [mA, yA] = a.split('/'); const [mB, yB] = b.split('/'); return new Date(yB, mB - 1) - new Date(yA, mA - 1); });
      if(available.length > 0 && !selectedMonth) setSelectedMonth(available[0]);
    } catch (error) {}
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSyncAll = async () => {
    setIsSyncingAll(true); showToast('מתחיל סנכרון כללי...', 'info');
    try { 
      const res = await authFetch('/api/sync-all', { method: 'POST' }); 
      const data = await res.json();
      if(data.success) { showToast('סנכרון הסתיים בהצלחה', 'success'); await fetchData(); }
      else showToast(data.message || 'שגיאה בסנכרון', 'error');
    } catch(e) { showToast('שגיאת תקשורת', 'error'); }
    setIsSyncingAll(false);
  };

  const handleUpdateSetting = async (key, value) => {
    try {
      await authFetch('/api/settings', { method: 'POST', body: JSON.stringify({ key, value }) });
      setAppSettings(prev => ({...prev, [key]: value}));
    } catch(e) {}
  };

  const availableMonths = useMemo(() => {
    const monthStart = appSettings.month_start_date || '1';
    const months = new Set(transactions.map(tx => getCustomMonthYear(tx.date, monthStart)).filter(Boolean));
    return Array.from(months).sort((a, b) => { const [mA, yA] = a.split('/'); const [mB, yB] = b.split('/'); return new Date(yB, mB - 1) - new Date(yA, mA - 1); });
  }, [transactions, appSettings.month_start_date]);

  const filteredTransactions = useMemo(() => {
    if (!selectedMonth || selectedMonth === 'all') return transactions;
    const monthStart = appSettings.month_start_date || '1';
    return transactions.filter(tx => getCustomMonthYear(tx.date, monthStart) === selectedMonth);
  }, [transactions, selectedMonth, appSettings.month_start_date]);

  const allExistingTags = useMemo(() => {
    const tagSet = new Set(); transactions.forEach(t => { if (t.tags) t.tags.split(',').forEach(tag => { if (tag.trim()) tagSet.add(tag.trim()); }); });
    return Array.from(tagSet);
  }, [transactions]);

  const handleUpdateTransaction = async (txData) => {
    try { await authFetch('/api/update-transaction', { method: 'POST', body: JSON.stringify(txData) }); fetchData(); } catch (error) {}
    setSelectedTx(null); setSelectedViewTx(null);
  };

  const handleAddManualTransaction = async (txData) => {
    try { 
      await authFetch('/api/add-transaction', { method: 'POST', body: JSON.stringify(txData) }); 
      fetchData(); 
      showToast('התנועה נוספה בהצלחה', 'success'); 
    } catch (error) { showToast('שגיאה בהוספת תנועה', 'error'); }
  };
  
  const handleLinkTransactions = async (txId1, txId2) => {
    try { await authFetch('/api/link-transactions', { method: 'POST', body: JSON.stringify({ txId1, txId2 }) }); fetchData(); } catch (error) {}
  };

  const handleDeleteAccount = async (accountId) => {
    if(window.confirm('מחיקת חשבון תמחוק גם את כל התנועות שלו. להמשיך?')) {
      try { await authFetch(`/api/account/${accountId}`, { method: 'DELETE' }); fetchData(); showToast('חשבון נמחק', 'success'); } catch (e) {}
    }
  }

  const handleDeleteUser = async () => {
    if(window.confirm('אזהרה חמורה: פעולה זו תמחק לחלוטין את כל המידע שלך, החשבונות, והתנועות מהמערכת ללא דרך שחזור. האם אתה בטוח שברצונך להמשיך?')) {
      try { await authFetch(`/api/auth/delete-user`, { method: 'DELETE' }); showToast('המשתמש והנתונים נמחקו', 'success'); onLogout(); } catch (e) { showToast('שגיאה במחיקת המשתמש', 'error'); }
    }
  };

  const handleSyncAccount = async (accountId) => {
    setIsSyncingAll(true); showToast('מסנכרן חשבון נבחר...', 'info');
    try {
      const res = await authFetch('/api/sync', { method: 'POST', body: JSON.stringify({ accountId: accountId }) });
      const data = await res.json();
      if(data.success) { showToast('סונכרן בהצלחה!', 'success'); fetchData(); }
      else { showToast('שגיאת התחברות. נדרש לעדכן פרטים.', 'error'); setSyncModalType('all'); }
    } catch(e){ showToast('שגיאת תקשורת', 'error'); }
    setIsSyncingAll(false);
  }

  const handleEditAccountSubmit = async (accountId, newName, billingDate, scrapeDuration) => {
    try { await authFetch('/api/update-account', { method: 'POST', body: JSON.stringify({ id: accountId, name: newName, billingDate, scrapeDuration }) }); fetchData(); } catch (e) {}
    setEditingAccount(null);
  };

  const getAccountName = (accId) => {
    if (accId === 'wallet') return 'ארנק (מזומן)';
    return accounts.find(a => a.id === accId)?.name || accId;
  };

  const sharedProps = {
    transactions, filteredTransactions, accounts, getCategoryDetails, selectedMonth, setSelectedMonth, availableMonths, 
    allExistingTags, appSettings, handleUpdateSetting, theme, toggleTheme, onTxClick: setSelectedTx, getAccountName, 
    handleLinkTransactions, setEditingAccount, onAddClick: setSyncModalType, handleDeleteAccount, handleSyncAccount, getCustomMonthYear, onViewTxClick: setSelectedViewTx,
    handleDeleteUser, showToast, onAddManualTx: () => setIsAddTxModalOpen(true), categories
  };

  const NAV_ITEMS = [
    { id: 'overview', label: 'סקירה', icon: Home }, { id: 'transactions', label: 'תנועות', icon: ListOrdered },
    { id: 'reports', label: 'דוחות', icon: PieChart }, { id: 'accounts', label: 'חשבונות', icon: CreditCard },
    { id: 'settings', label: 'הגדרות', icon: Settings }
  ];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: themeStyles }} />
      <div dir="rtl" className={`min-h-screen text-[var(--color-text-main)] overflow-x-hidden flex flex-col md:flex-row transition-colors duration-500 ${theme === 'dark' ? 'dark-theme bg-[#020617]' : 'bg-slate-50'}`}>
        <div className="fixed top-0 right-0 w-[800px] h-[800px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none transition-opacity"></div>
        <div className="fixed bottom-0 left-0 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none transition-opacity"></div>

        <nav className="fixed bottom-4 md:bottom-auto md:top-1/2 md:-translate-y-1/2 left-4 md:left-auto md:right-8 right-4 z-40 hidden md:block">
          <div className="bg-[var(--color-nav-bg)] backdrop-blur-2xl border border-[var(--color-border)] rounded-full p-2 md:p-3 flex md:flex-col gap-2 shadow-[0_4px_30px_rgba(0,0,0,0.1)] transition-colors">
             {NAV_ITEMS.map(item => {
               const Icon = item.icon; const isActive = activeTab === item.id;
               return (<button key={item.id} onClick={() => setActiveTab(item.id)} className={`relative p-3 md:p-4 rounded-full flex items-center justify-center transition-all duration-300 group ${isActive ? 'bg-indigo-600 text-white' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)] hover:bg-[var(--color-bg-input)]'}`}><Icon size={24} strokeWidth={isActive ? 2 : 1.5} /></button>);
             })}
          </div>
        </nav>

        <main className="flex-1 p-4 md:p-12 md:pr-40 pb-32 md:pb-12 min-h-screen relative z-10">
          <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 bg-[var(--color-bg-card)] p-5 md:p-6 rounded-2xl md:rounded-3xl border border-[var(--color-border)] shadow-[var(--shadow-card)] backdrop-blur-xl">
            <div><h1 className="text-3xl text-[var(--color-text-main)] font-medium flex items-center gap-3">כיס חכם <button onClick={onLogout} className="text-xs bg-rose-500/10 text-rose-500 px-3 py-1.5 rounded-lg hover:bg-rose-500 hover:text-white transition-colors flex items-center gap-1 font-bold"><Unlock size={14}/> יציאה מהחשבון</button></h1></div>
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {['transactions', 'overview', 'reports', 'budget'].includes(activeTab) && availableMonths.length > 0 && (
                <div className="flex items-center gap-2 bg-[var(--color-bg-input)] px-4 py-2 rounded-xl border border-[var(--color-border)]">
                  <Calendar size={18} className="text-indigo-500" />
                  <select className="bg-transparent text-sm outline-none text-[var(--color-text-main)] cursor-pointer" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
                    <option value="all">הכל (כל הנתונים)</option>
                    {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              )}
              <button onClick={handleSyncAll} disabled={isSyncingAll} className="bg-[var(--color-bg-input)] border border-[var(--color-border)] hover:bg-[var(--color-bg-card-hover)] text-[var(--color-text-main)] p-2 rounded-xl flex items-center gap-2 transition-colors text-sm">
                <RefreshCw size={16} className={isSyncingAll ? "animate-spin text-indigo-500" : ""} /><span className="hidden sm:inline">{isSyncingAll ? 'מסנכרן...' : 'רענן הכל'}</span>
              </button>
              <button onClick={() => setSyncModalType('all')} className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-xl flex items-center gap-2 transition-all text-sm">
                <Plus size={16} /><span className="hidden sm:inline">הוסף מקור</span>
              </button>
            </div>
          </header>
          <div className="relative z-10">
            {loading ? (<div className="flex flex-col items-center justify-center h-64 gap-4"><RefreshCw size={40} className="text-indigo-500 animate-spin" /><p className="text-[var(--color-text-muted)]">טוען ומפענח נתונים...</p></div>) : (
              <ErrorBoundary>
                {activeTab === 'overview' && <OverviewView {...sharedProps} />}
                {activeTab === 'transactions' && <TransactionsView {...sharedProps} />}
                {activeTab === 'reports' && <ReportsView {...sharedProps} />}
                {activeTab === 'accounts' && <AccountsView {...sharedProps} />}
                {activeTab === 'budget' && <BudgetView {...sharedProps} />}
                {activeTab === 'settings' && <SettingsView {...sharedProps} />}
              </ErrorBoundary>
            )}
          </div>
        </main>

        {toast.show && (
          <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full shadow-lg text-white flex items-center gap-2 animate-in slide-in-from-top-4 fade-in duration-300 ${toast.type === 'success' ? 'bg-emerald-500' : toast.type === 'error' ? 'bg-rose-500' : 'bg-blue-500'}`}>
            {toast.type === 'success' && <CheckCircle2 size={18}/>}{toast.type === 'error' && <AlertCircle size={18}/>}{toast.type === 'info' && <RefreshCw size={18} className="animate-spin"/>}
            <span className="text-sm font-medium">{toast.msg}</span>
          </div>
        )}
        <nav className="md:hidden fixed bottom-0 w-full bg-[var(--color-nav-bg)] border-t border-[var(--color-border)] px-4 py-2 pb-safe flex justify-between items-center z-40 backdrop-blur-xl">
            <MobileNavItem icon={<Home size={22} />} label="ראשי" active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
            <MobileNavItem icon={<ListOrdered size={22} />} label="תנועות" active={activeTab === 'transactions'} onClick={() => setActiveTab('transactions')} />
            <MobileNavItem icon={<PieChart size={22} />} label="דוחות" active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} />
            <MobileNavItem icon={<CreditCard size={22} />} label="חשבונות" active={activeTab === 'accounts'} onClick={() => setActiveTab('accounts')} />
        </nav>
        {selectedTx && <TransactionModal tx={selectedTx} {...sharedProps} onClose={() => setSelectedTx(null)} onSave={handleUpdateTransaction} onLink={handleLinkTransactions} />}
        {selectedViewTx && <TransactionViewModal tx={selectedViewTx} {...sharedProps} onClose={() => setSelectedViewTx(null)} onEdit={(t) => {setSelectedViewTx(null); setSelectedTx(t);}} />}
        {editingAccount && <EditAccountModal account={editingAccount} onClose={() => setEditingAccount(null)} onSave={handleEditAccountSubmit} />}
        {syncModalType && <SyncModal type={syncModalType} scrapeDuration={appSettings.scrape_duration} onClose={() => setSyncModalType(null)} onSuccess={() => { setSyncModalType(null); fetchData(); }} />}
        {isAddTxModalOpen && <AddTransactionModal accounts={accounts} onClose={() => setIsAddTxModalOpen(false)} onSave={handleAddManualTransaction} getCategoryDetails={getCategoryDetails} categories={categories} />}
      </div>
    </>
  );
}


// ==========================================
// PART 5: OVERVIEW VIEW
// ==========================================
function OverviewView({ filteredTransactions, accounts, onTxClick, getCategoryDetails, getAccountName, transactions, categories }) {
  const totalBalance = accounts.filter(a => a.type === 'bank').reduce((sum, a) => sum + Math.max(0, a.balance || 0), 0);
  const monthIncome = filteredTransactions.reduce((sum, t) => { 
    if (t.categoryId === 'misc_uncategorized') return t.amount > 0 ? sum + (t.amount||0) : sum;
    const { mainCat } = getCategoryDetails(t.categoryId, categories); 
    return mainCat.type === 'income' ? sum + (t.amount||0) : sum; 
  }, 0);

  const monthExpenses = filteredTransactions.reduce((sum, t) => { 
    if (t.categoryId === 'misc_uncategorized') return t.amount < 0 ? sum + (t.amount||0) : sum;
    const { mainCat } = getCategoryDetails(t.categoryId, categories); 
    return mainCat.type !== 'income' ? sum + (t.amount||0) : sum; 
  }, 0);
  const monthlyBalance = monthIncome - Math.abs(monthExpenses);

  const banks = accounts.filter(a => a.type === 'bank');
  const credits = accounts.filter(a => a.type === 'credit');

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="יתרת עו״ש" amount={`₪${(totalBalance||0).toLocaleString(undefined, {minimumFractionDigits:0})}`} trend="סה״כ בכל הבנקים" icon={<Building size={24} className="text-blue-600" />} color="blue" />
        <StatCard title="הכנסות החודש" amount={`₪${(monthIncome||0).toLocaleString(undefined, {minimumFractionDigits:0})}`} trend="סיכום כל ההכנסות" icon={<TrendingUp size={24} className="text-emerald-600" />} color="green" />
        <StatCard title="הוצאות החודש" amount={`₪${(Math.abs(monthExpenses)||0).toLocaleString(undefined, {minimumFractionDigits:0})}`} trend="סיכום כרטיסים ועו״ש" icon={<TrendingDown size={24} className="text-rose-600" />} color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <NeonCard noPadding>
            <div className="p-4 border-b border-[var(--color-border)]"><h2 className="text-lg text-[var(--color-text-main)]">תנועות אחרונות</h2></div>
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead><tr className="bg-[var(--color-bg-input)] border-b border-[var(--color-border)] text-[var(--color-text-muted)] text-sm"><th className="p-3 font-normal">תאריך</th><th className="p-3 font-normal text-center">סמל</th><th className="p-3 font-normal">שם העסק</th><th className="p-3 font-normal">קטגוריה</th><th className="p-3 font-normal">חשבון מחיוב</th><th className="p-3 font-normal text-center">סכום</th></tr></thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {filteredTransactions.slice(0, 6).map((tx) => {
                    const { mainCat, subCat } = getCategoryDetails(tx.categoryId, categories); 
                    const iconName = subCat?.icon || mainCat?.icon || 'Tag'; 
                    const isIncome = mainCat.type === 'income' || tx.amount > 0;
                    return (
                      <tr key={tx.id} onClick={() => onTxClick(tx)} className="hover:bg-[var(--color-bg-card-hover)] transition-colors cursor-pointer text-sm text-[var(--color-text-main)]">
                        <td className="p-3 text-[var(--color-text-muted)] whitespace-nowrap">{tx.date}</td>
                        <td className="p-3 text-center"><div className={`w-8 h-8 rounded-lg inline-flex items-center justify-center ${mainCat.bg} ${mainCat.color}`}><DynamicIcon name={iconName} size={16} /></div></td>
                        <td className="p-3"><div className="flex items-center gap-2">{tx.description}{tx.linkedTransactionId && <LinkIcon size={12} className="text-indigo-500"/>}{tx.installments && <span className="bg-indigo-500/10 text-indigo-500 text-[10px] px-1.5 py-0.5 rounded">תשלום {tx.installments.number}/{tx.installments.total}</span>}{tx.status === 'pending' && <span className="bg-orange-500/10 text-orange-500 text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1"><Clock size={10}/> ממתין</span>}</div></td>
                        <td className="p-3 text-[var(--color-text-muted)]">{mainCat.type === 'income' ? mainCat.name : `${mainCat.name} • ${subCat?.name}`}</td><td className="p-3 text-[var(--color-text-muted)]">{getAccountName(tx.accountId || tx.account)}</td><td className={`p-3 text-center ${isIncome ? 'text-emerald-500' : ''}`} dir="ltr">{isIncome ? '+' : ''}{(tx.amount||0).toFixed(2)} ₪</td>
                      </tr>
                    );
                  })}
                  {filteredTransactions.length === 0 && <tr><td colSpan="6" className="text-center py-8 text-[var(--color-text-muted)]">אין תנועות בחודש זה</td></tr>}
                </tbody>
              </table>
            </div>
          </NeonCard>
        </div>
        <div className="space-y-6">
           <NeonCard><h2 className="text-lg mb-2 text-[var(--color-text-main)] flex items-center gap-2"><PieChart size={20} className="text-indigo-500"/> מאזן החודש</h2><div dir="ltr" className={`text-4xl font-medium text-right ${monthlyBalance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{monthlyBalance > 0 ? '+' : ''}{monthlyBalance.toLocaleString()} ₪</div></NeonCard>
           <NeonCard><h2 className="text-lg mb-4 text-[var(--color-text-main)] flex items-center gap-2"><CreditCard size={20} className="text-rose-500"/> אשראי: חיוב קרוב</h2><div className="space-y-3">{credits.length === 0 ? <p className="text-sm text-[var(--color-text-muted)]">אין כרטיסים</p> : credits.map(acc => { const upcoming = calculateUpcomingCharge(acc, transactions); return (<div key={acc.id} className="flex justify-between items-center p-3 bg-[var(--color-bg-input)] rounded-xl border border-[var(--color-border)]"><span className="text-[var(--color-text-main)] text-sm">{acc.name}</span><span className="text-rose-500 text-sm" dir="ltr">{(upcoming||0).toLocaleString(undefined, {minimumFractionDigits: 0})} ₪</span></div>)}) }</div></NeonCard>
           <NeonCard><h2 className="text-lg mb-4 text-[var(--color-text-main)] flex items-center gap-2"><Building size={20} className="text-blue-500"/> בנקים: יתרה</h2><div className="space-y-3">{banks.length === 0 ? <p className="text-sm text-[var(--color-text-muted)]">אין בנקים</p> : banks.map(acc => (<div key={acc.id} className="flex justify-between items-center p-3 bg-[var(--color-bg-input)] rounded-xl border border-[var(--color-border)]"><span className="text-[var(--color-text-main)] text-sm">{acc.name}</span><span className={`text-sm ${(acc.balance||0) < 0 ? 'text-rose-500' : 'text-emerald-500'}`} dir="ltr">{(acc.balance||0).toLocaleString(undefined, {minimumFractionDigits: 0})} ₪</span></div>))}</div></NeonCard>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// PART 6: TRANSACTIONS VIEW
// ==========================================
function TransactionsView({ filteredTransactions, onTxClick, getCategoryDetails, getAccountName, appSettings, getCustomMonthYear, onAddManualTx, categories }) {
  const [filterType, setFilterType] = useState('all'); 
  const displayedTxs = useMemo(() => {
    let txs = filteredTransactions;
    if (filterType !== 'all') { txs = filteredTransactions.filter(t => { const { mainCat } = getCategoryDetails(t.categoryId, categories); return mainCat.type === filterType; }); }
    return txs.sort((a,b) => { const da = a.date.split('/').reverse().join(''); const db = b.date.split('/').reverse().join(''); return db.localeCompare(da); });
  }, [filteredTransactions, filterType, getCategoryDetails, categories]);

  const renderGroupedRows = () => {
    const rows = []; let currentMonth = null; let currentDay = null;
    const today = new Date(); const todayStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
    const currentAppMonth = getCustomMonthYear(todayStr, appSettings.month_start_date || '1');

    displayedTxs.forEach(tx => {
      const txMonth = getCustomMonthYear(tx.date, appSettings.month_start_date || '1'); const txDay = tx.date;
      if (txMonth !== currentMonth) {
        if (txMonth !== currentAppMonth) { rows.push(<tr key={`month-${txMonth}`} className="bg-[var(--color-bg-main)] border-b border-[var(--color-border)]"><td colSpan="6" className="px-4 py-3 text-base font-bold text-[var(--color-text-main)] bg-indigo-500/5 text-center">{txMonth}</td></tr>); }
        currentMonth = txMonth; currentDay = null;
      }
      if (txDay !== currentDay) {
        rows.push(<tr key={`day-${txDay}`} className="bg-[var(--color-bg-input)] border-b border-[var(--color-border)]"><td colSpan="6" className="px-4 py-2 text-sm font-medium text-[var(--color-text-muted)]">{txDay}</td></tr>);
        currentDay = txDay;
      }

      const { mainCat, subCat } = getCategoryDetails(tx.categoryId, categories); 
      const iconName = subCat?.icon || mainCat?.icon || 'Tag'; 
      const isIncome = mainCat.type === 'income' || tx.amount > 0;
      
      rows.push(
        <tr key={tx.id} onClick={() => onTxClick(tx)} className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-card-hover)] transition-colors cursor-pointer text-[var(--color-text-main)]">
          <td className="p-4 text-base text-[var(--color-text-muted)] whitespace-nowrap">{tx.date}</td>
          <td className="p-4 text-center"><div className={`w-10 h-10 rounded-xl inline-flex items-center justify-center ${mainCat.bg} ${mainCat.color}`}><DynamicIcon name={iconName} size={20} /></div></td>
          <td className="p-4"><div className="flex items-center gap-2 text-base font-medium">{tx.description}{tx.installments && <span className="bg-indigo-500/10 text-indigo-500 text-xs px-2 py-0.5 rounded">תשלום {tx.installments.number}/{tx.installments.total}</span>}{tx.status === 'pending' && <span className="bg-orange-500/10 text-orange-500 text-xs px-2 py-0.5 rounded flex items-center gap-1"><Clock size={12}/> ממתין</span>}{tx.linkedTransactionId && <LinkIcon size={14} className="text-indigo-500"/>}</div>
            {(tx.tags || tx.notes) && (<div className="flex gap-2 mt-1.5">{tx.tags && tx.tags.split(',').filter(t=>t.trim()).map(tag => <span key={tag} className="text-sm bg-[var(--color-bg-input)] border border-[var(--color-border)] text-[var(--color-text-muted)] px-2 py-0.5 rounded">{tag.trim()}</span>)}{tx.notes && <span className="text-sm bg-[var(--color-bg-input)] border border-[var(--color-border)] text-[var(--color-text-muted)] px-2 py-0.5 rounded flex items-center gap-1"><AlignLeft size={14}/> הערה</span>}</div>)}
          </td>
          <td className="p-4 text-base text-[var(--color-text-muted)]">{mainCat.type === 'income' ? mainCat.name : `${mainCat.name} • ${subCat?.name}`}</td>
          <td className="p-4 text-base text-[var(--color-text-muted)]">{getAccountName(tx.accountId || tx.account)}</td>
          <td className={`p-4 text-center font-bold text-base ${isIncome ? 'text-emerald-500' : ''}`} dir="ltr">{isIncome ? '+' : ''}{(tx.amount||0).toFixed(2)} ₪</td>
        </tr>
      );
    });
    if (rows.length === 0) return <tr><td colSpan="6" className="text-center py-12 text-[var(--color-text-muted)] text-lg">לא נמצאו תנועות</td></tr>;
    return rows;
  };

  return (
    <div className="animate-in fade-in duration-500 space-y-6">
      <div className="flex flex-col sm:flex-row gap-3 w-full justify-between items-start sm:items-center">
        <div className="flex gap-2 w-full overflow-x-auto pb-2 hide-scrollbar">
          <button onClick={() => setFilterType('all')} className={`px-5 py-2 rounded-xl text-base transition-colors border ${filterType === 'all' ? 'bg-[var(--color-text-main)] text-[var(--color-bg-main)] border-transparent' : 'bg-[var(--color-bg-card)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}>הכל</button>
          <button onClick={() => setFilterType('expense')} className={`px-5 py-2 rounded-xl text-base transition-colors border ${filterType === 'expense' ? 'bg-[var(--color-text-main)] text-[var(--color-bg-main)] border-transparent' : 'bg-[var(--color-bg-card)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}>הוצאות בלבד</button>
          <button onClick={() => setFilterType('income')} className={`px-5 py-2 rounded-xl text-base transition-colors border ${filterType === 'income' ? 'bg-emerald-600 text-white border-transparent' : 'bg-[var(--color-bg-card)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}>הכנסות בלבד</button>
        </div>
        <button onClick={onAddManualTx} className="w-full sm:w-auto px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-indigo-500 transition-colors shrink-0 shadow-lg">
          <Plus size={16}/> הוסף תנועה ידנית
        </button>
      </div>
      <NeonCard noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse min-w-[800px]">
            <thead><tr className="bg-[var(--color-bg-input)] border-b border-[var(--color-border)] text-[var(--color-text-muted)] text-base"><th className="p-4 font-normal w-24">תאריך</th><th className="p-4 font-normal text-center w-12">סמל</th><th className="p-4 font-normal">שם העסק</th><th className="p-4 font-normal">קטגוריה</th><th className="p-4 font-normal">חשבון מחיוב</th><th className="p-4 font-normal text-center">סכום</th></tr></thead>
            <tbody>{renderGroupedRows()}</tbody>
          </table>
        </div>
      </NeonCard>
    </div>
  );
}

// ==========================================
// PART 7: REPORTS VIEW
// ==========================================
function ReportsView({ filteredTransactions, getCategoryDetails, onViewTxClick, getAccountName, categories }) {
  const [expandedMainCat, setExpandedMainCat] = useState(null);
  
  const incomes = filteredTransactions.filter(t => { 
    if (t.categoryId === 'misc_uncategorized') return t.amount > 0;
    const { mainCat } = getCategoryDetails(t.categoryId, categories); 
    return mainCat.type === 'income'; 
  });
  const expenses = filteredTransactions.filter(t => { 
    if (t.categoryId === 'misc_uncategorized') return t.amount < 0;
    const { mainCat } = getCategoryDetails(t.categoryId, categories); 
    return mainCat.type !== 'income'; 
  });

  const totalIncome = incomes.reduce((sum, t) => sum + (t.amount || 0), 0);
  const totalExpense = expenses.reduce((sum, t) => sum - (t.amount || 0), 0);

  const groupedExpenses = useMemo(() => {
    const grouped = {};
    expenses.forEach(t => {
      const { mainCat, subCat } = getCategoryDetails(t.categoryId, categories);
      if (!grouped[mainCat.id]) grouped[mainCat.id] = { mainCat, amount: 0, subs: {} };
      grouped[mainCat.id].amount -= (t.amount || 0); 
      if(!grouped[mainCat.id].subs[subCat.id]) grouped[mainCat.id].subs[subCat.id] = { subCat, amount: 0, txs: [] };
      grouped[mainCat.id].subs[subCat.id].amount -= (t.amount || 0);
      grouped[mainCat.id].subs[subCat.id].txs.push(t);
    });
    return Object.values(grouped).sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  }, [expenses, getCategoryDetails, categories]);

  const groupedIncomes = useMemo(() => {
    const grouped = {};
    incomes.forEach(t => {
      const { mainCat } = getCategoryDetails(t.categoryId, categories);
      if (!grouped[mainCat.id]) grouped[mainCat.id] = { mainCat, amount: 0, txs: [] };
      grouped[mainCat.id].amount += (t.amount || 0);
      grouped[mainCat.id].txs.push(t);
    });
    return Object.values(grouped).sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  }, [incomes, getCategoryDetails, categories]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <NeonCard noPadding className="order-1">
          <div className="p-6 border-b border-[var(--color-border)] bg-[var(--color-bg-input)]"><h2 className="text-lg text-[var(--color-text-muted)] mb-1">סה״כ הוצאות</h2><p className="text-4xl text-rose-500" dir="ltr">{(totalExpense||0).toLocaleString(undefined, {minimumFractionDigits:0})} ₪</p></div>
          <div className="divide-y divide-[var(--color-border)]">
            {groupedExpenses.length === 0 ? <p className="text-center text-[var(--color-text-muted)] py-8">אין הוצאות</p> : groupedExpenses.map(item => {
              const isExpanded = expandedMainCat === item.mainCat.id;
              return (
                <div key={item.mainCat.id}>
                  <button onClick={() => setExpandedMainCat(isExpanded ? null : item.mainCat.id)} className="w-full flex justify-between items-center p-5 hover:bg-[var(--color-bg-card-hover)] transition-colors group">
                    <div className="flex items-center gap-4"><div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.mainCat.bg} transition-all`}><DynamicIcon name={item.mainCat.icon} size={18} className={item.mainCat.color} strokeWidth={1.5}/></div><span className="text-lg font-bold text-[var(--color-text-main)]">{item.mainCat.name}</span></div>
                    <div className="flex items-center gap-3"><span className="text-lg font-bold text-[var(--color-text-main)]" dir="ltr">{(Math.abs(item.amount)||0).toLocaleString(undefined, {minimumFractionDigits:0})} ₪</span><ChevronDown size={18} className={`text-[var(--color-text-muted)] transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} /></div>
                  </button>
                  <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-[1500px]' : 'max-h-0'}`}>
                    <div className="p-2 bg-[var(--color-bg-input)] border-t border-[var(--color-border)]">
                      {Object.values(item.subs).sort((a,b) => Math.abs(b.amount) - Math.abs(a.amount)).map(sub => {
                        return (
                          <div key={sub.subCat.id} className="p-3 rounded-lg hover:bg-[var(--color-bg-card)] transition-all group">
                            <div className="flex justify-between items-center mb-2">
                              <div className="flex items-center gap-3 text-[var(--color-text-main)]"><DynamicIcon name={sub.subCat.icon} size={18} className="text-[var(--color-text-muted)]" /><span className="text-base font-bold">{sub.subCat.name}</span></div>
                              <span className="text-base font-bold text-[var(--color-text-main)]" dir="ltr">{(Math.abs(sub.amount)||0).toLocaleString(undefined, {minimumFractionDigits:0})} ₪</span>
                            </div>
                            <div className="pl-8 pr-2 space-y-2">
                              {sub.txs.map(tx => (
                                <div key={tx.id} onClick={() => onViewTxClick(tx)} className="flex justify-between text-sm p-2 hover:bg-[var(--color-bg-input)] rounded-lg cursor-pointer">
                                  <span className="text-[var(--color-text-main)] truncate max-w-[150px] font-medium">{tx.description}</span>
                                  <span dir="ltr" className={`font-bold ${tx.amount > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    {tx.amount > 0 ? '+' : (tx.amount < 0 ? '-' : '')}{Math.abs(tx.amount||0).toFixed(0)} ₪
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </NeonCard>

        <NeonCard noPadding className="order-2">
          <div className="p-6 border-b border-[var(--color-border)] bg-[var(--color-bg-input)]"><h2 className="text-lg text-[var(--color-text-muted)] mb-1">סה״כ הכנסות</h2><p className="text-4xl text-emerald-500" dir="ltr">{totalIncome > 0 ? '+' : ''}{(totalIncome||0).toLocaleString(undefined, {minimumFractionDigits:0})} ₪</p></div>
          <div className="divide-y divide-[var(--color-border)]">
            {groupedIncomes.length === 0 ? <p className="text-center text-[var(--color-text-muted)] py-8">אין הכנסות</p> : groupedIncomes.map(item => {
              return (
                <div key={item.mainCat.id} className="w-full flex flex-col p-5 hover:bg-[var(--color-bg-card-hover)] transition-colors group border-b border-[var(--color-border)] last:border-0">
                  <div className="flex justify-between items-center"><div className="flex items-center gap-4"><div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.mainCat.bg}`}><DynamicIcon name={item.mainCat.icon} size={18} className={item.mainCat.color} strokeWidth={1.5} /></div><span className="text-lg font-bold text-[var(--color-text-main)]">{item.mainCat.name}</span></div><span className="text-emerald-500 text-lg font-bold" dir="ltr">+{(item.amount||0).toLocaleString(undefined, {minimumFractionDigits:0})} ₪</span></div>
                  <div className="mt-4 pl-14 pr-2 space-y-2">
                    {item.txs.map(tx => (
                      <div key={tx.id} onClick={() => onViewTxClick(tx)} className="flex justify-between text-sm p-2 hover:bg-[var(--color-bg-input)] rounded-lg cursor-pointer">
                        <span className="text-[var(--color-text-main)] truncate max-w-[150px] font-medium">{tx.description}</span>
                        <span dir="ltr" className={`font-bold ${tx.amount > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {tx.amount > 0 ? '+' : (tx.amount < 0 ? '-' : '')}{Math.abs(tx.amount||0).toFixed(0)} ₪
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </NeonCard>
      </div>
    </div>
  );
}

// ==========================================
// PART 8: ACCOUNTS, BUDGET & SETTINGS VIEWS
// ==========================================
function AccountsView({ accounts, handleDeleteAccount, handleSyncAccount, onAddClick, transactions, setEditingAccount }) {
  const banks = accounts.filter(a => a.type === 'bank');
  const credits = accounts.filter(a => a.type === 'credit');

  const renderAccountCard = (account) => {
    const upcoming = calculateUpcomingCharge(account, transactions); const isCredit = account.type === 'credit';
    return (
    <div key={account.id} className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-2xl p-4 flex items-center justify-between shadow-sm hover:border-indigo-300 transition-colors">
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 flex items-center justify-center rounded-xl ${isCredit ? 'bg-rose-500/10 text-rose-500' : 'bg-blue-500/10 text-blue-500'}`}>{isCredit ? <CreditCard size={20} strokeWidth={1.5} /> : <Building size={20} strokeWidth={1.5} />}</div>
        <div>
          <div className="text-[var(--color-text-main)] font-bold">{account.name}</div>
          <div className="text-[var(--color-text-muted)] text-xs mt-0.5">{isCredit ? 'חיוב קרוב: ' : 'יתרה: '} <span className={isCredit || (account.balance||0) < 0 ? 'text-rose-500' : 'text-emerald-500'} dir="ltr">{isCredit ? (upcoming||0).toLocaleString() : (account.balance||0).toLocaleString()} ₪</span></div>
        </div>
      </div>
      <div className="flex items-center gap-1">
         <button onClick={() => setEditingAccount(account)} className="p-2 text-[var(--color-text-muted)] hover:text-indigo-500 hover:bg-[var(--color-bg-input)] rounded-lg transition-colors" title="ערוך"><Edit2 size={16}/></button>
         <button onClick={() => handleSyncAccount(account.id)} className="p-2 text-[var(--color-text-muted)] hover:text-emerald-500 hover:bg-[var(--color-bg-input)] rounded-lg transition-colors" title="סנכרון ידני"><RefreshCw size={16}/></button>
         <button onClick={() => handleDeleteAccount(account.id)} className="p-2 text-[var(--color-text-muted)] hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors" title="מחק חשבון"><Trash2 size={16}/></button>
      </div>
    </div>
  )};

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <section><div className="flex items-center justify-between mb-4"><h2 className="text-xl text-[var(--color-text-main)] flex items-center gap-2"><CreditCard size={20} className="text-rose-500" /> כרטיסי אשראי</h2><button onClick={() => onAddClick('credit')} className="text-sm text-indigo-500 flex items-center gap-1 hover:text-indigo-600"><Plus size={16}/> הוסף</button></div><div className="space-y-3">{credits.map(renderAccountCard)}</div></section>
      <section><div className="flex items-center justify-between mb-4"><h2 className="text-xl text-[var(--color-text-main)] flex items-center gap-2"><Building size={20} className="text-blue-500" /> חשבונות בנק</h2><button onClick={() => onAddClick('bank')} className="text-sm text-indigo-500 flex items-center gap-1 hover:text-indigo-600"><Plus size={16}/> הוסף</button></div><div className="space-y-3">{banks.map(renderAccountCard)}</div></section>
    </div>
  );
}

function BudgetView({ filteredTransactions, getCategoryDetails, categories }) {
  const expenses = filteredTransactions.filter(t => { 
    if (t.categoryId === 'misc_uncategorized') return t.amount < 0;
    const { mainCat } = getCategoryDetails(t.categoryId, categories); 
    return mainCat.type !== 'income'; 
  });
  const totalExpenses = expenses.reduce((sum, t) => sum - (t.amount || 0), 0);
  const budgetLimit = 8000; const percentage = Math.min(100, Math.round((totalExpenses / budgetLimit) * 100)) || 0;
  const grouped = {}; expenses.forEach(t => { 
    const { mainCat } = getCategoryDetails(t.categoryId, categories); 
    grouped[mainCat.id] = (grouped[mainCat.id] || 0) - (t.amount || 0); 
  });
  
  const sortedCategories = Object.keys(grouped).map(catId => { 
    const mainCat = categories.expenses?.find(e => e.id === catId) || { name: 'שונות', color: 'text-slate-500', bg: 'bg-slate-500/10', icon: 'MoreHorizontal' };
    return { cat: mainCat, amount: grouped[catId], percent: Math.round((grouped[catId] / totalExpenses) * 100) || 0 }; 
  }).sort((a, b) => b.amount - a.amount);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 animate-in fade-in duration-500">
      <NeonCard className="flex flex-col justify-center items-center text-center"><h2 className="text-xl text-[var(--color-text-main)] mb-2">סה״כ הוצאות בחודש זה</h2><p className="text-[var(--color-text-muted)] mb-8">מתוך תקציב מתוכנן של ₪{budgetLimit.toLocaleString()}</p><p className="text-6xl text-rose-500 mb-10 tracking-tight" dir="ltr">{(totalExpenses||0).toLocaleString(undefined, {minimumFractionDigits:0})} ₪</p><div className="w-full max-w-md bg-[var(--color-bg-input)] rounded-full h-3 mb-3 overflow-hidden"><div className={`h-full rounded-full transition-all duration-1000 ${percentage > 90 ? 'bg-rose-500' : 'bg-indigo-500'}`} style={{ width: `${percentage}%` }}></div></div><p className="text-sm text-[var(--color-text-muted)]">נוצלו {percentage}% מהתקציב</p></NeonCard>
      <NeonCard><h2 className="text-xl text-[var(--color-text-main)] mb-8 flex items-center gap-2"><PieChart className="text-indigo-500" /> פירוט הוצאות</h2><div className="space-y-6">{sortedCategories.map((item, idx) => { return (<div key={idx} className="group"><div className="flex justify-between items-end mb-2"><div className="flex items-center gap-2"><div className={`p-1.5 rounded-md ${item.cat.bg} ${item.cat.color}`}><DynamicIcon name={item.cat.icon} size={14} /></div><span className="text-[var(--color-text-main)] font-medium">{item.cat.name}</span><span className="text-xs text-[var(--color-text-muted)]">({item.percent}%)</span></div><span className="text-[var(--color-text-main)] font-medium" dir="ltr">{(item.amount||0).toLocaleString(undefined, {minimumFractionDigits:0})} ₪</span></div><div className="w-full bg-[var(--color-bg-input)] rounded-full h-2 overflow-hidden"><div className={`bg-indigo-500 h-full rounded-full transition-all duration-1000`} style={{ width: `${item.percent}%` }}></div></div></div>) })}</div></NeonCard>
    </div>
  );
}

function SettingsView({ appSettings, handleUpdateSetting, theme, toggleTheme, handleDeleteUser, setIsChangePassModalOpen }) {
  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-500">
      <NeonCard noPadding>
        <div className="p-6 border-b border-[var(--color-border)] bg-[var(--color-bg-input)]">
          <h2 className="text-xl text-[var(--color-text-main)]">הגדרות מתקדמות</h2>
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          
          <div className="p-6 flex items-center justify-between hover:bg-[var(--color-bg-card-hover)] transition-colors">
            <div>
              <h3 className="text-[var(--color-text-main)] text-lg">חיבור לטלגרם</h3>
              <p className="text-sm text-[var(--color-text-muted)]">הכנס את ה-Chat ID שלך כדי לקבל התראות וסנכרון</p>
            </div>
            <input 
              type="text" 
              placeholder="לדוגמה: 123456789"
              value={appSettings.telegram_chat_id || ''} 
              onChange={(e) => handleUpdateSetting('telegram_chat_id', e.target.value.trim())}
              className="w-40 p-2.5 bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-xl outline-none focus:border-indigo-500 text-[var(--color-text-main)] font-medium text-left"
              dir="ltr"
            />
          </div>

          <div className="p-6 flex items-center justify-between hover:bg-[var(--color-bg-card-hover)] transition-colors"><div><h3 className="text-[var(--color-text-main)] text-lg">עיצוב מערכת</h3><p className="text-sm text-[var(--color-text-muted)]">יום או לילה</p></div><button onClick={toggleTheme} className="flex items-center gap-2 bg-[var(--color-bg-input)] border border-[var(--color-border)] px-4 py-2 rounded-xl text-[var(--color-text-main)] transition-all font-medium">{theme === 'dark' ? <><Sun size={18} className="text-amber-500"/> בהיר</> : <><Moon size={18} className="text-indigo-500"/> כהה</>}</button></div>
          <div className="p-6 flex items-center justify-between hover:bg-[var(--color-bg-card-hover)] transition-colors"><div><h3 className="text-[var(--color-text-main)] text-lg">תחילת חודש תקציבי</h3><p className="text-sm text-[var(--color-text-muted)]">לפי איזה יום לסנן את החודש?</p></div><select value={appSettings.month_start_date || '1'} onChange={(e) => handleUpdateSetting('month_start_date', e.target.value)} className="w-40 p-2.5 bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-xl outline-none focus:border-indigo-500 text-[var(--color-text-main)] cursor-pointer font-medium"><option value="1">1 לחודש (רגיל)</option><option value="10">10 לחודש (אשראי)</option><option value="15">15 לחודש</option></select></div>
          <div className="p-6 flex items-center justify-between hover:bg-[var(--color-bg-card-hover)] transition-colors"><div><h3 className="text-[var(--color-text-main)] text-lg">זמן סריקת נתונים גלובלי</h3><p className="text-sm text-[var(--color-text-muted)]">ברירת המחדל בעת הוספת חשבון</p></div><select value={appSettings.scrape_duration || '1'} onChange={(e) => handleUpdateSetting('scrape_duration', e.target.value)} className="w-40 p-2.5 bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-xl outline-none focus:border-indigo-500 text-[var(--color-text-main)] cursor-pointer font-medium"><option value="1">חודש 1 (מהיר)</option><option value="6">חצי שנה</option><option value="12">שנה</option><option value="24">שנתיים</option><option value="48">4 שנים</option></select></div>
          
          <div className="p-6 flex items-center justify-between hover:bg-[var(--color-bg-card-hover)] transition-colors">
            <div><h3 className="text-[var(--color-text-main)] text-lg">אבטחת חשבון</h3><p className="text-sm text-[var(--color-text-muted)]">החלפת מפתח הכספת שלך</p></div>
            <button onClick={() => setIsChangePassModalOpen(true)} className="px-5 py-2.5 bg-indigo-500/10 text-indigo-600 font-bold rounded-xl hover:bg-indigo-500 hover:text-white transition-colors">שנה סיסמה</button>
          </div>
          
          <div className="p-6 flex items-center justify-between hover:bg-[var(--color-bg-card-hover)] transition-colors bg-rose-500/5">
            <div><h3 className="text-rose-500 text-lg font-bold">מחיקת חשבון</h3><p className="text-sm text-[var(--color-text-muted)]">פעולה זו תמחק את כל הנתונים שלך לצמיתות</p></div>
            <button onClick={handleDeleteUser} className="px-5 py-2.5 bg-rose-500/10 text-rose-600 font-bold rounded-xl hover:bg-rose-600 hover:text-white transition-colors">מחק חשבון ונתונים</button>
          </div>

        </div>
      </NeonCard>
    </div>
  );
}

// ==========================================
// PART 9: MODALS 
// ==========================================
function TransactionViewModal({ tx, getCategoryDetails, getAccountName, onClose, onEdit, categories }) {
  const { mainCat, subCat } = getCategoryDetails(tx.categoryId, categories);
  const iconName = subCat?.icon || mainCat?.icon || 'Tag';
  const isIncome = mainCat.type === 'income' || tx.amount > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-3xl w-full max-w-md shadow-2xl p-6">
        <div className="flex justify-between items-start mb-6">
          <button onClick={onClose} className="p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-input)] rounded-full transition-colors"><X size={20} /></button>
          <div className="text-right flex-1 pr-4">
            <h3 className="text-xl text-[var(--color-text-main)] font-bold leading-tight">{tx.description}</h3>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">{getAccountName(tx.accountId || tx.account)}</p>
          </div>
        </div>

        <div className="flex items-center justify-center py-6 border-y border-[var(--color-border)] mb-6">
           <div className={`text-5xl font-black tracking-tight ${isIncome ? 'text-emerald-500' : 'text-[var(--color-text-main)]'}`} dir="ltr">
             {isIncome ? '+' : ''}{(tx.amount||0).toLocaleString(undefined, {minimumFractionDigits:2})} ₪
           </div>
        </div>

        <div className="space-y-4 mb-6">
           <div className="flex justify-between items-center text-sm"><span className="text-[var(--color-text-muted)]">תאריך עסקה:</span><span className="text-[var(--color-text-main)] font-medium">{tx.date}</span></div>
           <div className="flex justify-between items-center text-sm"><span className="text-[var(--color-text-muted)]">קטגוריה:</span><span className="flex items-center gap-2 text-[var(--color-text-main)] font-medium"><DynamicIcon name={iconName} size={14} className={mainCat.color} /> {mainCat.name} {subCat && `• ${subCat.name}`}</span></div>
           {tx.notes && (<div className="bg-[var(--color-bg-input)] p-3 rounded-xl text-sm text-[var(--color-text-main)]"><span className="text-[var(--color-text-muted)] block mb-1 text-xs">הערות:</span>{tx.notes}</div>)}
           {tx.tags && (<div className="flex flex-wrap gap-2 pt-2">{tx.tags.split(',').filter(t=>t.trim()).map(tag => <span key={tag} className="text-[10px] font-bold bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 px-2 py-1 rounded">{tag.trim()}</span>)}</div>)}
        </div>
        <button onClick={() => onEdit(tx)} className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl flex items-center justify-center gap-2 font-bold shadow-lg">
          <Edit2 size={16}/> ערוך תנועה
        </button>
      </div>
    </div>
  );
}

function TransactionModal({ tx, getCategoryDetails, accounts, transactions, onClose, onSave, onLink, onTxClick, categories }) {
  const currentDetails = getCategoryDetails(tx.categoryId, categories);
  const [notes, setNotes] = useState(tx.notes || '');
  const [tags, setTags] = useState(tx.tags ? tx.tags.split(',').map(t=>t.trim()) : []);
  const [tagInput, setTagInput] = useState('');
  const [applyToAll, setApplyToAll] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const linkedTx = tx.linkedTransactionId ? transactions.find(t => t.id === tx.linkedTransactionId) : null;
  const linkableTxs = transactions.filter(t => t.id !== tx.id && !t.linkedTransactionId).slice(0, 20); 
  const [activeTabType, setActiveTabType] = useState(currentDetails.mainCat.type);
  const [view, setView] = useState('main'); 
  const [selectedMainCatObj, setSelectedMainCatObj] = useState(currentDetails.mainCat);
  const [selectedSubCatId, setSelectedSubCatId] = useState(currentDetails.subCat?.id || '');
  const acc = accounts.find(a => a.id === tx.accountId || a.id === tx.account);
  
  useEffect(() => { const originalStyle = window.getComputedStyle(document.body).overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = originalStyle; }; }, []);
  const handleAddTag = (tag) => { if (tag && !tags.includes(tag)) setTags([...tags, tag]); setTagInput(''); };
  const removeTag = (tagToRemove) => setTags(tags.filter(t => t !== tagToRemove));
  const handleSave = () => { onSave({ transactionId: tx.id, description: tx.description, categoryId: selectedSubCatId, notes, tags: tags.join(','), applyToAll }); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-6">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-[var(--color-bg-card)] border border-[var(--color-border)] w-full max-w-5xl rounded-3xl shadow-2xl flex flex-col md:flex-row h-[90vh] md:h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200">
        
        <div className="w-full md:w-1/2 flex flex-col border-l border-[var(--color-border)] bg-[var(--color-bg-main)] h-1/2 md:h-full overflow-hidden">
          <div className="p-6 flex justify-between items-start bg-[var(--color-bg-card)] border-b border-[var(--color-border)] shrink-0"><button onClick={onClose} className="p-2 bg-[var(--color-bg-input)] rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]"><X size={20} /></button><div className="text-right flex-1 mr-4"><h3 className="text-xl text-[var(--color-text-main)] font-bold">{tx.description}</h3><p className="text-sm text-[var(--color-text-muted)] mt-1">{acc?.name || tx.account}</p></div></div>
          <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1 min-h-0">
            <div className="text-center"><p className={`text-5xl font-black ${tx.amount < 0 ? 'text-[var(--color-text-main)]' : 'text-emerald-500'}`} dir="ltr">{tx.amount > 0 ? '+' : ''}{(tx.amount||0).toLocaleString(undefined, {minimumFractionDigits: 2})} <span className="text-2xl opacity-50">₪</span></p></div>
            <div className="grid grid-cols-2 gap-4"><div className="bg-[var(--color-bg-input)] p-4 rounded-xl text-center"><p className="text-xs text-[var(--color-text-muted)] mb-1">תאריך עסקה</p><p className="text-[var(--color-text-main)] font-bold">{tx.date}</p></div><div className="bg-[var(--color-bg-input)] p-4 rounded-xl text-center"><p className="text-xs text-[var(--color-text-muted)] mb-1">תאריך חיוב</p><p className="text-[var(--color-text-main)] font-bold">{tx.billingDate}</p></div></div>
            <div className="bg-indigo-500/5 p-5 rounded-2xl border border-indigo-500/10">
              <p className="text-sm text-indigo-500 font-bold mb-3 flex items-center gap-2"><LinkIcon size={18}/> תנועה מקושרת</p>
              {linkedTx ? (<div className="flex justify-between items-center bg-[var(--color-bg-card)] p-4 rounded-xl shadow-sm"><div className="flex flex-col cursor-pointer hover:text-indigo-500" onClick={() => onTxClick(linkedTx)}><span className="text-[var(--color-text-main)] font-bold">{linkedTx.description}</span><span className="text-xs text-[var(--color-text-muted)]">{linkedTx.date} • <span dir="ltr">{(linkedTx.amount||0)}₪</span></span></div><button onClick={() => onLink(tx.id, null)} className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg"><Unlink size={18}/></button></div>) : isLinking ? (<div className="space-y-3"><select onChange={(e) => { if(e.target.value) { onLink(tx.id, e.target.value); setIsLinking(false); }}} className="w-full p-3 text-sm border border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-main)] rounded-xl outline-none"><option value="">-- בחר תנועה לקישור --</option>{linkableTxs.map(t => <option key={t.id} value={t.id}>{t.date} - {t.description} ({(t.amount||0)}₪)</option>)}</select><button onClick={() => setIsLinking(false)} className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]">ביטול</button></div>) : (<button onClick={() => setIsLinking(true)} className="w-full bg-[var(--color-bg-card)] border-2 border-dashed border-indigo-500/30 p-3 rounded-xl text-sm text-indigo-500 font-bold hover:bg-indigo-500/10">+ קשר לתנועה אחרת</button>)}
            </div>
            <div><label className="block text-sm font-bold text-[var(--color-text-muted)] mb-2">הערות</label><textarea value={notes} onChange={e => setNotes(e.target.value)} rows="2" className="w-full p-4 bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-xl focus:border-indigo-500 text-[var(--color-text-main)] outline-none text-sm resize-none"></textarea></div>
            <div>
              <label className="block text-sm font-bold text-[var(--color-text-muted)] mb-2">תגיות</label>
              <div className="bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded-xl p-3 flex flex-wrap gap-2 items-center focus-within:border-indigo-500">{tags.map(tag => (<span key={tag} className="bg-indigo-500/10 text-indigo-600 px-2 py-1 rounded text-xs font-bold flex items-center gap-1">{tag} <X size={12} className="cursor-pointer" onClick={() => removeTag(tag)}/></span>))}<input type="text" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddTag(tagInput))} placeholder="הוסף תגית ו-Enter..." className="bg-transparent outline-none text-[var(--color-text-main)] text-sm px-2 flex-1" /></div>
            </div>
            <label className="flex items-center gap-3 p-4 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-xl cursor-pointer hover:bg-[var(--color-bg-card-hover)] shadow-sm"><div className="relative flex items-center justify-center shrink-0"><input type="checkbox" checked={applyToAll} onChange={e => setApplyToAll(e.target.checked)} className="peer sr-only" /><div className="w-5 h-5 bg-[var(--color-bg-input)] border border-[var(--color-border)] rounded peer-checked:bg-indigo-500 peer-checked:border-indigo-500 transition-all"></div><Check size={14} className="absolute text-white opacity-0 peer-checked:opacity-100 transition-opacity"/></div><span className="text-sm font-bold text-[var(--color-text-main)]">שנה בכל התנועות הדומות</span></label>
          </div>
          <div className="p-6 shrink-0 bg-[var(--color-bg-card)] border-t border-[var(--color-border)]"><button onClick={handleSave} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-lg py-3 rounded-xl font-bold shadow-lg">שמור שינויים</button></div>
        </div>

        <div className="w-full md:w-1/2 flex flex-col bg-[var(--color-bg-card)] h-1/2 md:h-full overflow-hidden">
          <div className="flex bg-[var(--color-bg-input)] border-b border-[var(--color-border)] p-2 shrink-0"><button onClick={() => { setActiveTabType('expense'); setView('main'); }} className={`flex-1 py-3 text-center text-sm font-bold rounded-xl transition-all ${activeTabType === 'expense' ? 'bg-[var(--color-bg-card)] text-[var(--color-text-main)] shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}>הוצאות</button><button onClick={() => { setActiveTabType('income'); setView('main'); }} className={`flex-1 py-3 text-center text-sm font-bold rounded-xl transition-all ${activeTabType === 'income' ? 'bg-[var(--color-bg-card)] text-[var(--color-text-main)] shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}>הכנסות</button></div>
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar min-h-0">
            {activeTabType === 'income' ? (
              <div className="grid grid-cols-2 gap-3">
                 {(categories.incomes || []).map(cat => { 
                   const isSelected = selectedSubCatId === cat.id; 
                   return (
                     <button type="button" key={cat.id} onClick={() => setSelectedSubCatId(cat.id)} 
                       className={`flex flex-col items-center p-4 rounded-xl border transition-all ${isSelected ? `${cat.bg} ${cat.color} border-current` : 'border-[var(--color-border)] bg-[var(--color-bg-input)] hover:border-emerald-500'}`}>
                       <DynamicIcon name={cat.icon} size={24} className={`mb-2 ${isSelected ? 'text-current' : cat.color}`} strokeWidth={1.5} />
                       <span className={`text-sm font-medium text-center ${isSelected ? 'text-current' : 'text-[var(--color-text-main)]'}`}>{cat.name}</span>
                     </button>
                   )
                 })}
              </div>
            ) : view === 'main' ? (
              <div className="grid grid-cols-2 gap-3">
                 {(categories.expenses || []).map(mainCat => { 
                   const isSelected = selectedMainCatObj?.id === mainCat.id; 
                   return (
                     <button type="button" key={mainCat.id} onClick={() => { setSelectedMainCatObj(mainCat); setView('sub'); }} 
                       className={`flex flex-col items-center p-4 rounded-xl border transition-all ${isSelected ? `${mainCat.bg} ${mainCat.color} border-current` : 'border-[var(--color-border)] bg-[var(--color-bg-input)] hover:border-indigo-500'}`}>
                       <DynamicIcon name={mainCat.icon} size={24} className={`mb-2 ${isSelected ? 'text-current' : mainCat.color}`} strokeWidth={1.5} />
                       <span className={`text-sm font-medium text-center ${isSelected ? 'text-current' : 'text-[var(--color-text-main)]'}`}>{mainCat.name}</span>
                     </button>
                   )
                 })}
              </div>
            ) : (
              <div>
                 <div className="flex items-center justify-between mb-4 sticky top-0 bg-[var(--color-bg-card)] z-10 py-2 border-b border-[var(--color-border)]">
                   <h4 className={`text-lg font-bold ${selectedMainCatObj?.color || 'text-[var(--color-text-main)]'} flex items-center gap-2`}>
                     <DynamicIcon name={selectedMainCatObj?.icon} size={20} className="text-current" /> {selectedMainCatObj?.name}
                   </h4>
                   <button type="button" onClick={() => setView('main')} className="text-sm text-[var(--color-text-muted)] flex items-center hover:text-[var(--color-text-main)]">חזור <ChevronRight size={16} /></button>
                 </div>
                 <div className="grid grid-cols-2 gap-3 pb-8">
                   {(selectedMainCatObj?.subs || []).map(sub => { 
                     const isSelected = selectedSubCatId === sub.id; 
                     return (
                       <button type="button" key={sub.id} onClick={() => setSelectedSubCatId(sub.id)} 
                         className={`flex flex-col items-center justify-center p-4 border rounded-xl transition-all ${isSelected ? `${selectedMainCatObj?.bg} ${selectedMainCatObj?.color} border-current` : 'border-[var(--color-border)] bg-[var(--color-bg-input)] hover:border-indigo-500'}`}>
                         <DynamicIcon name={sub.icon} size={24} className={`mb-2 ${isSelected ? 'text-current' : 'text-[var(--color-text-muted)]'}`} strokeWidth={1.5} />
                         <span className={`text-sm font-medium text-center ${isSelected ? 'text-current' : 'text-[var(--color-text-main)]'}`}>{sub.name}</span>
                       </button>
                     );
                   })}
                 </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AddTransactionModal({ accounts, onClose, onSave, getCategoryDetails, categories }) {
  const todayStr = `${String(new Date().getDate()).padStart(2, '0')}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${new Date().getFullYear()}`;
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayStr);
  const [accountId, setAccountId] = useState('wallet');
  const [notes, setNotes] = useState('');
  const [type, setType] = useState('expense');
  const [selectedSubCatId, setSelectedSubCatId] = useState('misc_uncategorized');
  
  const [view, setView] = useState('main'); 
  const [selectedMainCatObj, setSelectedMainCatObj] = useState(categories.expenses?.[0] || null);

  const handleSave = (e) => {
     e.preventDefault();
     if (!description || !amount || !accountId) return;
     onSave({ description, amount, date, accountId, notes, categoryId: selectedSubCatId, type });
     onClose();
  };

  return (
     <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-6">
       <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose}></div>
       <div className="relative bg-[var(--color-bg-card)] border border-[var(--color-border)] w-full max-w-5xl rounded-3xl shadow-2xl flex flex-col md:flex-row h-[90vh] md:h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200">
         
         <div className="w-full md:w-1/2 flex flex-col bg-[var(--color-bg-main)] border-l border-[var(--color-border)] h-1/2 md:h-full overflow-hidden">
            <div className="p-6 flex justify-between items-center bg-[var(--color-bg-card)] border-b border-[var(--color-border)] shrink-0">
              <h3 className="text-xl text-[var(--color-text-main)] font-bold">הוספת תנועה ידנית</h3>
              <button type="button" onClick={onClose} className="p-2 bg-[var(--color-bg-input)] rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]"><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1 min-h-0">
               <div><label className="text-sm font-bold text-[var(--color-text-muted)] block mb-1">שם העסק / תיאור</label><input type="text" required value={description} onChange={e=>setDescription(e.target.value)} className="w-full p-3 bg-[var(--color-bg-input)] text-[var(--color-text-main)] border border-[var(--color-border)] rounded-xl outline-none" placeholder="לדוגמה: מזומן מהכספומט" /></div>
               <div className="flex gap-4">
                 <div className="flex-1"><label className="text-sm font-bold text-[var(--color-text-muted)] block mb-1">סכום (₪)</label><input type="number" step="0.01" min="0" required value={amount} onChange={e=>setAmount(e.target.value)} className="w-full p-3 bg-[var(--color-bg-input)] text-[var(--color-text-main)] border border-[var(--color-border)] rounded-xl outline-none text-left" dir="ltr" placeholder="0.00" /></div>
                 <div className="flex-1"><label className="text-sm font-bold text-[var(--color-text-muted)] block mb-1">תאריך</label><input type="text" required value={date} onChange={e=>setDate(e.target.value)} className="w-full p-3 bg-[var(--color-bg-input)] text-[var(--color-text-main)] border border-[var(--color-border)] rounded-xl outline-none text-center" dir="ltr" /></div>
               </div>
               <div>
                 <label className="text-sm font-bold text-[var(--color-text-muted)] block mb-1">חשבון מחיוב / מזוכֶּה</label>
                 <select required value={accountId} onChange={e=>setAccountId(e.target.value)} className="w-full p-3 bg-[var(--color-bg-input)] text-[var(--color-text-main)] border border-[var(--color-border)] rounded-xl outline-none">
                    <option value="wallet">ארנק (מזומן)</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                 </select>
               </div>
               <div><label className="text-sm font-bold text-[var(--color-text-muted)] block mb-1">הערות (אופציונלי)</label><textarea value={notes} onChange={e=>setNotes(e.target.value)} rows="2" className="w-full p-3 bg-[var(--color-bg-input)] text-[var(--color-text-main)] border border-[var(--color-border)] rounded-xl outline-none resize-none"></textarea></div>
               
               <div className="mt-4 bg-[var(--color-bg-card)] p-4 rounded-xl border border-[var(--color-border)] flex items-center justify-between">
                 <span className="text-sm text-[var(--color-text-muted)] font-bold">סיווג נבחר:</span>
                 <span className={`text-sm font-bold ${getCategoryDetails(selectedSubCatId, categories)?.mainCat?.color || (type === 'income' ? 'text-emerald-500' : 'text-indigo-500')}`}>
                   {getCategoryDetails(selectedSubCatId, categories)?.subCat?.name || (type === 'income' ? 'הכנסה כללית' : 'ללא סיווג')}
                 </span>
               </div>
               
               <button type="submit" className={`w-full text-white text-lg py-3 rounded-xl font-bold shadow-lg mt-4 transition-colors ${type === 'income' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-indigo-600 hover:bg-indigo-500'}`}>שמור תנועה</button>
            </form>
         </div>

         <div className="w-full md:w-1/2 flex flex-col bg-[var(--color-bg-card)] h-1/2 md:h-full overflow-hidden">
            <div className="flex bg-[var(--color-bg-input)] border-b border-[var(--color-border)] p-2 shrink-0">
               <button type="button" onClick={() => { setType('expense'); setView('main'); setSelectedSubCatId('misc_uncategorized'); }} className={`flex-1 py-3 text-center text-sm font-bold rounded-xl transition-all ${type === 'expense' ? 'bg-[var(--color-bg-card)] text-[var(--color-text-main)] shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}>הוצאות</button>
               <button type="button" onClick={() => { setType('income'); setView('main'); setSelectedSubCatId('inc_misc'); }} className={`flex-1 py-3 text-center text-sm font-bold rounded-xl transition-all ${type === 'income' ? 'bg-[var(--color-bg-card)] text-[var(--color-text-main)] shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]'}`}>הכנסות</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar min-h-0">
              {type === 'income' ? (
                <div className="grid grid-cols-2 gap-3">
                   {(categories.incomes || []).map(cat => { 
                     const isSelected = selectedSubCatId === cat.id; 
                     return (
                       <button type="button" key={cat.id} onClick={() => setSelectedSubCatId(cat.id)} 
                         className={`flex flex-col items-center p-4 rounded-xl border transition-all ${isSelected ? `${cat.bg} ${cat.color} border-current` : 'border-[var(--color-border)] bg-[var(--color-bg-input)] hover:border-emerald-500'}`}>
                         <DynamicIcon name={cat.icon} size={24} className={`mb-2 ${isSelected ? 'text-current' : cat.color}`} strokeWidth={1.5} />
                         <span className={`text-sm font-medium text-center ${isSelected ? 'text-current' : 'text-[var(--color-text-main)]'}`}>{cat.name}</span>
                       </button>
                     )
                   })}
                </div>
              ) : view === 'main' ? (
                <div className="grid grid-cols-2 gap-3">
                   {(categories.expenses || []).map(mainCat => { 
                     const isSelected = selectedMainCatObj?.id === mainCat.id; 
                     return (
                       <button type="button" key={mainCat.id} onClick={() => { setSelectedMainCatObj(mainCat); setView('sub'); }} 
                         className={`flex flex-col items-center p-4 rounded-xl border transition-all ${isSelected ? `${mainCat.bg} ${mainCat.color} border-current` : 'border-[var(--color-border)] bg-[var(--color-bg-input)] hover:border-indigo-500'}`}>
                         <DynamicIcon name={mainCat.icon} size={24} className={`mb-2 ${isSelected ? 'text-current' : mainCat.color}`} strokeWidth={1.5} />
                         <span className={`text-sm font-medium text-center ${isSelected ? 'text-current' : 'text-[var(--color-text-main)]'}`}>{mainCat.name}</span>
                       </button>
                     )
                   })}
                </div>
              ) : (
                <div>
                   <div className="flex items-center justify-between mb-4 sticky top-0 bg-[var(--color-bg-card)] z-10 py-2 border-b border-[var(--color-border)]">
                     <h4 className={`text-lg font-bold ${selectedMainCatObj?.color || 'text-[var(--color-text-main)]'} flex items-center gap-2`}>
                       <DynamicIcon name={selectedMainCatObj?.icon} size={20} className="text-current" /> {selectedMainCatObj?.name}
                     </h4>
                     <button type="button" onClick={() => setView('main')} className="text-sm text-[var(--color-text-muted)] flex items-center hover:text-[var(--color-text-main)]">חזור <ChevronRight size={16} /></button>
                   </div>
                   <div className="grid grid-cols-2 gap-3 pb-8">
                     {(selectedMainCatObj?.subs || []).map(sub => { 
                       const isSelected = selectedSubCatId === sub.id; 
                       return (
                         <button type="button" key={sub.id} onClick={() => setSelectedSubCatId(sub.id)} 
                           className={`flex flex-col items-center justify-center p-4 border rounded-xl transition-all ${isSelected ? `${selectedMainCatObj?.bg} ${selectedMainCatObj?.color} border-current` : 'border-[var(--color-border)] bg-[var(--color-bg-input)] hover:border-indigo-500'}`}>
                           <DynamicIcon name={sub.icon} size={24} className={`mb-2 ${isSelected ? 'text-current' : 'text-[var(--color-text-muted)]'}`} strokeWidth={1.5} />
                           <span className={`text-sm font-medium text-center ${isSelected ? 'text-current' : 'text-[var(--color-text-main)]'}`}>{sub.name}</span>
                         </button>
                       );
                     })}
                   </div>
                </div>
              )}
            </div>
         </div>
       </div>
     </div>
  );
}

function EditAccountModal({ account, onClose, onSave }) {
  const [name, setName] = useState(account.name);
  const [scrapeDuration, setScrapeDuration] = useState(account.scrapeDuration || '');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose}></div><div className="relative bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-3xl w-full max-w-sm shadow-2xl p-6 space-y-4"><div className="flex justify-between items-center mb-2"><h3 className="text-xl font-bold text-[var(--color-text-main)]">הגדרות חשבון</h3><button onClick={onClose} className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]"><X size={20} /></button></div><div><label className="text-sm font-bold text-[var(--color-text-muted)] mb-1 block">שם תצוגה</label><input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full p-3 bg-[var(--color-bg-input)] text-[var(--color-text-main)] border border-[var(--color-border)] rounded-xl outline-none" /></div><div><label className="text-sm font-bold text-[var(--color-text-muted)] mb-1 block">זמן משיכת נתונים ספציפי</label><select value={scrapeDuration} onChange={e => setScrapeDuration(e.target.value)} className="w-full p-3 bg-[var(--color-bg-input)] text-[var(--color-text-main)] border border-[var(--color-border)] rounded-xl outline-none"><option value="">-- הגדרת ברירת מחדל --</option><option value="1">1 חודש</option><option value="6">חצי שנה</option><option value="12">שנה</option><option value="24">שנתיים</option><option value="48">4 שנים</option></select></div><button onClick={() => onSave(account.id, name, account.billingDate, scrapeDuration)} className="w-full py-3.5 font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl mt-4">שמור שינויים</button></div></div>
  );
}

function SyncModal({ type, scrapeDuration, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false); const [companyId, setCompanyId] = useState(type === 'credit' ? 'isracard' : 'leumi'); const [username, setUsername] = useState(''); const [password, setPassword] = useState(''); const [customDuration, setCustomDuration] = useState('');
  const handleSubmit = async (e) => { e.preventDefault(); setLoading(true); try { await authFetch('/api/credentials', { method: 'POST', body: JSON.stringify({ companyId, username, password, scrapeDuration: customDuration || null }) }); const res = await authFetch('/api/sync', { method: 'POST', body: JSON.stringify({ companyId, credentials: { id: username, username, password }, customScrapeDuration: customDuration || null }) }); const data = await res.json(); if (data.success) onSuccess(); } catch (err) {} finally { setLoading(false); } };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose}></div><div className="relative bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-3xl w-full max-w-sm shadow-2xl p-6"><div className="flex justify-between items-center mb-6"><h2 className="text-xl font-bold text-[var(--color-text-main)]">חיבור מוסד חדש</h2><button onClick={onClose} className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-main)]"><X size={20} /></button></div><form onSubmit={handleSubmit} className="space-y-4"><div><label className="text-sm font-bold text-[var(--color-text-muted)] block mb-1">מוסד פיננסי</label><select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="w-full p-3 bg-[var(--color-bg-input)] text-[var(--color-text-main)] border border-[var(--color-border)] rounded-xl outline-none">{type !== 'credit' && (<optgroup label="בנקים"><option value="leumi">בנק לאומי</option><option value="hapoalim">בנק הפועלים</option><option value="discount">בנק דיסקונט</option><option value="mizrahi">בנק מזרחי טפחות</option><option value="beinleumi">הבנק הבינלאומי / אוצר החייל</option><option value="yahav">בנק יהב</option><option value="massad">בנק מסד</option><option value="pagi">פג"י</option><option value="union-bank">בנק אגוד</option></optgroup>)}{type !== 'bank' && (<optgroup label="כרטיסי אשראי"><option value="isracard">ישראכרט</option><option value="max">מקס (Max)</option><option value="visa-cal">כאל (Cal)</option><option value="amex">אמריקן אקספרס</option></optgroup>)}</select></div><div className="flex gap-2"><div className="flex-1"><input type="text" placeholder="שם משתמש / ת.ז" required value={username} onChange={(e) => setUsername(e.target.value)} className="w-full p-3 bg-[var(--color-bg-input)] text-[var(--color-text-main)] border border-[var(--color-border)] rounded-xl outline-none" /></div><div className="flex-1"><input type="password" placeholder="סיסמה" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3 bg-[var(--color-bg-input)] text-[var(--color-text-main)] border border-[var(--color-border)] rounded-xl outline-none text-left" dir="ltr" /></div></div><div><label className="text-sm font-bold text-[var(--color-text-muted)] block mb-1">זמן סריקה (ברירת מחדל: {scrapeDuration} חודשים)</label><select value={customDuration} onChange={(e) => setCustomDuration(e.target.value)} className="w-full p-3 bg-[var(--color-bg-input)] text-[var(--color-text-main)] border border-[var(--color-border)] rounded-xl outline-none"><option value="">השתמש בהגדרת ברירת מחדל</option><option value="1">1 חודש</option><option value="6">חצי שנה</option><option value="12">שנה</option><option value="24">שנתיים</option><option value="48">4 שנים</option></select></div><button type="submit" disabled={loading} className="w-full py-3.5 font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl mt-4 flex justify-center items-center gap-2">{loading ? <><RefreshCw size={18} className="animate-spin"/> מתחבר...</> : 'התחבר וסנכרן נתונים'}</button></form></div></div>
  );
}

export default function App() {
  const [token, setToken] = useState(sessionStorage.getItem('app_token'));
  const handleLogout = () => { sessionStorage.removeItem('app_token'); setToken(null); };
  
  return (
    <ErrorBoundary>
      {token ? <MainApp onLogout={handleLogout} /> : <AuthScreen onLogin={setToken} />}
    </ErrorBoundary>
  );
}