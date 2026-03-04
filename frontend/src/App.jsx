import React, { useState, useEffect, useMemo } from 'react';
import { 
  Home, CreditCard, ListOrdered, PieChart, Settings,
  RefreshCw, AlertCircle, CheckCircle2, TrendingUp, TrendingDown,
  Building, Wallet, Plus, Shield, ChevronLeft, ChevronDown, ChevronUp,
  ShoppingBag, Utensils, Car,
  MoreHorizontal, Calendar, Edit2, X, Tag, Check, Lock,
  Heart, Users, Ticket, Plane, Briefcase, Landmark, Info, Clock
} from 'lucide-react';

// --- Icon Mapping Helper ---
const IconMap = {
  Home, ShoppingBag, Car, Heart, Users, Ticket, Utensils, Plane, Briefcase, Landmark, MoreHorizontal, Wallet, Tag
};

// --- Category Tree ---
const INCOMES = {
  id: 'income_main', name: 'הכנסות', icon: 'Wallet', color: 'text-green-600', bg: 'bg-green-50', barBg: 'bg-green-500', type: 'income',
  subs: [
    { id: 'inc_salary', name: 'משכורת' },
    { id: 'inc_allowance', name: 'קצבה או מלגה' },
    { id: 'inc_property', name: 'הכנסה מנכס' },
    { id: 'inc_business', name: 'הכנסה מעסק' },
    { id: 'inc_dividends', name: 'דיווידנדים תקבולים ורווחים' },
    { id: 'inc_misc', name: 'הכנסות - שונות' }
  ]
};

const EXPENSES = [
  {
    id: 'exp_household', name: 'משק בית', icon: 'Home', color: 'text-indigo-600', bg: 'bg-indigo-50', barBg: 'bg-indigo-500', type: 'expense',
    subs: [
      { id: 'hh_telecom', name: 'חשבונות טלפון, טלוויזיה ואינטרנט' },
      { id: 'hh_mortgage', name: 'משכנתא' },
      { id: 'hh_rent', name: 'דמי שכירות' },
      { id: 'hh_taxes', name: 'ארנונה ורשות מקומית' },
      { id: 'hh_committee', name: 'ועד בית' },
      { id: 'hh_water', name: 'מים' },
      { id: 'hh_gas', name: 'גז והסקה' },
      { id: 'hh_electricity', name: 'חשמל' },
      { id: 'hh_insurance', name: 'ביטוח דירה' },
      { id: 'hh_maintenance', name: 'אחזקת בית ותיקונים' },
      { id: 'hh_cleaning', name: 'ניקיון וכביסה' },
      { id: 'hh_gardening', name: 'גינון ונוי' },
      { id: 'hh_misc', name: 'משק בית - שונות' }
    ]
  },
  {
    id: 'exp_shopping', name: 'עושים קניות', icon: 'ShoppingBag', color: 'text-pink-600', bg: 'bg-pink-50', barBg: 'bg-pink-500', type: 'expense',
    subs: [
      { id: 'shop_supermarket', name: 'מזון, משקאות, סופר ומכולת' },
      { id: 'shop_furniture', name: 'ריהוט ואביזרים לבית' },
      { id: 'shop_electronics', name: 'מוצרי חשמל, מחשבים ואלקטרוניקה' },
      { id: 'shop_clothing', name: 'בגדים, נעליים ואקססוריז' },
      { id: 'shop_jewelry', name: 'תכשיטים ושעונים' },
      { id: 'shop_tobacco', name: 'סיגריות, טבק ומוצרי עישון' },
      { id: 'shop_misc', name: 'עושים קניות - שונות' }
    ]
  },
  {
    id: 'exp_transport', name: 'רכב ותחבורה', icon: 'Car', color: 'text-orange-600', bg: 'bg-orange-50', barBg: 'bg-orange-500', type: 'expense',
    subs: [
      { id: 'trans_fuel', name: 'דלק וטעינה לרכב' },
      { id: 'trans_rental', name: 'השכרת רכב' },
      { id: 'trans_public', name: 'תחבורה ציבורית' },
      { id: 'trans_parking', name: 'חנייה' },
      { id: 'trans_fines', name: 'קנסות ודו"חות' },
      { id: 'trans_garage', name: 'מוסך, אחזקת רכב ואביזרים' },
      { id: 'trans_tolls', name: 'כבישי אגרה' },
      { id: 'trans_insurance', name: 'ביטוחי רכב' },
      { id: 'trans_misc', name: 'רכב ותחבורה - שונות' }
    ]
  },
  {
    id: 'exp_health', name: 'בריאות וטיפוח אישי', icon: 'Heart', color: 'text-red-500', bg: 'bg-red-50', barBg: 'bg-red-500', type: 'expense',
    subs: [
      { id: 'hlth_alternative', name: 'רפואה משלימה' },
      { id: 'hlth_services', name: 'שירותי בריאות, ייעוץ וטיפול' },
      { id: 'hlth_insurance', name: 'ביטוחי בריאות וחיים' },
      { id: 'hlth_dental', name: 'רפואת שיניים' },
      { id: 'hlth_optical', name: 'עיניים ואופטיקה' },
      { id: 'hlth_pharmacy', name: 'בתי מרקחת וחנויות פארם' },
      { id: 'hlth_beauty', name: 'מספרה, טיפולי יופי ומוצרי טיפוח' },
      { id: 'hlth_fitness', name: 'כושר' },
      { id: 'hlth_misc', name: 'בריאות וטיפוח אישי - שונות' }
    ]
  },
  {
    id: 'exp_family', name: 'ילדים, משפחה והשכלה', icon: 'Users', color: 'text-teal-600', bg: 'bg-teal-50', barBg: 'bg-teal-500', type: 'expense',
    subs: [
      { id: 'fam_school', name: 'גן ובית ספר' },
      { id: 'fam_higher_ed', name: 'השכלה גבוהה' },
      { id: 'fam_activities', name: 'צהרונים, חוגים, פעילויות וקייטנות' },
      { id: 'fam_babysitter', name: 'שמרטף (בייביסיטר)' },
      { id: 'fam_toys', name: 'צעצועים, משחקים ודמי כיס' },
      { id: 'fam_baby', name: 'מוצרים לגיל הרך' },
      { id: 'fam_support', name: 'תמיכה בבני משפחה ודמי מזונות' },
      { id: 'fam_pets', name: 'חיות מחמד' },
      { id: 'fam_misc', name: 'ילדים, משפחה והשכלה - שונות' }
    ]
  },
  {
    id: 'exp_leisure', name: 'פנאי, תרבות והעשרה', icon: 'Ticket', color: 'text-purple-600', bg: 'bg-purple-50', barBg: 'bg-purple-500', type: 'expense',
    subs: [
      { id: 'leis_shows', name: 'הצגות, הופעות וקולנוע' },
      { id: 'leis_gifts', name: 'מתנות, חתונות ואירועים' },
      { id: 'leis_music', name: 'מוזיקה וקריאה' },
      { id: 'leis_workshops', name: 'סדנאות ושיעורים' },
      { id: 'leis_hobbies', name: 'ציוד לתחביבים וספורט' },
      { id: 'leis_sports', name: 'אירועי ספורט' },
      { id: 'leis_misc', name: 'פנאי, תרבות והעשרה - שונות' }
    ]
  },
  {
    id: 'exp_dining', name: 'אוכלים בחוץ', icon: 'Utensils', color: 'text-amber-600', bg: 'bg-amber-50', barBg: 'bg-amber-500', type: 'expense',
    subs: [
      { id: 'dine_fastfood', name: 'מזון מהיר ומשלוחים' },
      { id: 'dine_restaurants', name: 'בתי קפה, מסעדות ופאבים' },
      { id: 'dine_misc', name: 'אוכלים בחוץ - שונות' }
    ]
  },
  {
    id: 'exp_travel', name: 'חופשות וטיולים', icon: 'Plane', color: 'text-sky-600', bg: 'bg-sky-50', barBg: 'bg-sky-500', type: 'expense',
    subs: [
      { id: 'trvl_flights', name: 'טיסות' },
      { id: 'trvl_attractions', name: 'אטרקציות' },
      { id: 'trvl_accommodation', name: 'לינה' },
      { id: 'trvl_misc', name: 'חופשות וטיולים - שונות' }
    ]
  },
  {
    id: 'exp_business', name: 'שירותים עיסקיים', icon: 'Briefcase', color: 'text-slate-600', bg: 'bg-slate-50', barBg: 'bg-slate-500', type: 'expense',
    subs: [
      { id: 'biz_delivery', name: 'דואר ומשלוחים' },
      { id: 'biz_legal', name: 'הנה"ח ושירותים משפטיים' },
      { id: 'biz_marketing', name: 'שיווק, פרסום ודפוס' },
      { id: 'biz_consulting', name: 'ייעוץ והשתלמויות' },
      { id: 'biz_misc', name: 'שירותים עיסקיים - שונות' }
    ]
  },
  {
    id: 'exp_financial', name: 'שירותים פיננסיים', icon: 'Landmark', color: 'text-emerald-600', bg: 'bg-emerald-50', barBg: 'bg-emerald-500', type: 'expense',
    subs: [
      { id: 'fin_loans', name: 'פירעון הלוואה' },
      { id: 'fin_fees', name: 'עמלות' },
      { id: 'fin_interest', name: 'תשלומי ריביות והפסדים' },
      { id: 'fin_misc', name: 'שירותים פיננסיים - שונות' }
    ]
  },
  {
    id: 'exp_misc', name: 'שונות', icon: 'MoreHorizontal', color: 'text-gray-600', bg: 'bg-gray-50', barBg: 'bg-gray-500', type: 'expense',
    subs: [
      { id: 'misc_taxes', name: 'מיסים ושרותי ממשלה' },
      { id: 'misc_religion', name: 'דת ותשמישי קדושה' },
      { id: 'misc_donations', name: 'תרומות' },
      { id: 'misc_gambling', name: 'הימורים' },
      { id: 'misc_uncategorized', name: 'ללא סיווג' },
      { id: 'misc_other', name: 'שונות' }
    ]
  }
];

const ALL_CATEGORIES = [INCOMES, ...EXPENSES];

const getCategoryDetails = (subCatId) => {
  if (!subCatId) return { mainCat: EXPENSES[10], subCat: EXPENSES[10].subs[4] }; 
  for (const mainCat of ALL_CATEGORIES) {
    const subCat = mainCat.subs.find(sub => sub.id === subCatId);
    if (subCat) return { mainCat, subCat };
  }
  return { mainCat: EXPENSES[10], subCat: EXPENSES[10].subs[4] };
};

// פונקציה לחישוב "חיוב קרוב" לכרטיסי אשראי - סוכמת עסקאות ממתינות (pending) 
// או עסקאות שהן במסגרת מחזור החיוב הנוכחי ועדיין לא חויבו
const calculateUpcomingCharge = (acc, transactions) => {
  if (acc.type === 'bank') return acc.balance; 
  
  const accountTxs = transactions.filter(t => t.accountId === acc.id || t.account === acc.id);
  const today = new Date();
  let upcomingSum = 0;

  accountTxs.forEach(tx => {
    // 1. עסקאות ממתינות
    if (tx.status === 'pending') {
      upcomingSum += tx.amount;
    } else {
      // 2. עסקאות עתידיות שטרם ירדו
      const parts = tx.date.split('/');
      if(parts.length === 3) {
        const txDate = new Date(parts[2], parts[1] - 1, parts[0]);
        if (txDate > today) {
          upcomingSum += tx.amount;
        }
      }
    }
  });
  
  // אם מצאנו עסקאות עתידיות/ממתינות, נציג אותן. אחרת, נשתמש ביתרה שהבנק מחזיר.
  return upcomingSum !== 0 ? upcomingSum : acc.balance;
};

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [loading, setLoading] = useState(true);

  const [selectedTx, setSelectedTx] = useState(null);
  const [editingAccount, setEditingAccount] = useState(null);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/data');
      if (!res.ok) throw new Error('Failed to fetch data');
      const data = await res.json();
      
      const mappedTransactions = (data.transactions || []).map(tx => ({
        ...tx,
        categoryId: tx.category || 'misc_uncategorized'
      }));

      setTransactions(mappedTransactions);
      setAccounts(data.accounts || []);
      
      const months = new Set(mappedTransactions.map(tx => {
        const parts = tx.date.split('/');
        return parts.length === 3 ? `${parts[1]}/${parts[2]}` : null;
      }).filter(Boolean));
      
      const available = Array.from(months).sort((a, b) => {
        const [mA, yA] = a.split('/');
        const [mB, yB] = b.split('/');
        return new Date(yB, mB) - new Date(yA, mA);
      });
      
      if(available.length > 0 && !selectedMonth) {
        setSelectedMonth(available[0]);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const availableMonths = useMemo(() => {
    const months = new Set(transactions.map(tx => {
      const parts = tx.date.split('/');
      return parts.length === 3 ? `${parts[1]}/${parts[2]}` : null;
    }).filter(Boolean));
    return Array.from(months).sort((a, b) => {
      const [mA, yA] = a.split('/');
      const [mB, yB] = b.split('/');
      return new Date(yB, mB) - new Date(yA, mA);
    });
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    if (!selectedMonth) return transactions;
    return transactions.filter(tx => tx.date.endsWith(selectedMonth));
  }, [transactions, selectedMonth]);

  const handleUpdateTxCategory = async (txId, newSubCatId) => {
    const txToUpdate = transactions.find(t => t.id === txId);
    if(txToUpdate) {
      try {
        await fetch('/api/update-category', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transactionId: txId,
            description: txToUpdate.description,
            categoryId: newSubCatId
          })
        });
        fetchData();
      } catch (error) {
        console.error("Failed to update category:", error);
      }
    }
    setSelectedTx(null);
  };

  const handleEditAccountSubmit = async (accountId, newName, billingDate) => {
    try {
      await fetch('/api/update-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: accountId, name: newName, billingDate })
      });
      fetchData(); 
    } catch (e) {
      console.error(e);
    }
    setEditingAccount(null);
  };

  const getAccountName = (accId) => accounts.find(a => a.id === accId)?.name || accId;

  const sharedProps = {
    transactions, filteredTransactions, accounts, ALL_CATEGORIES, getCategoryDetails,
    selectedMonth, setSelectedMonth, availableMonths,
    onTxClick: setSelectedTx, getAccountName,
    setEditingAccount, onAddClick: () => setIsSyncModalOpen(true)
  };

  const renderView = () => {
    if (loading) return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <RefreshCw size={40} className="text-blue-500 animate-spin" />
        <p className="text-gray-500 font-medium">טוען נתונים מהכספת...</p>
      </div>
    );

    switch (activeTab) {
      case 'overview': return <OverviewView {...sharedProps} />;
      case 'transactions': return <TransactionsView {...sharedProps} />;
      case 'accounts': return <AccountsView {...sharedProps} />;
      case 'budget': return <BudgetView {...sharedProps} />;
      case 'settings': return <SettingsView />;
      default: return <OverviewView {...sharedProps} />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans text-gray-800" dir="rtl">
      
      <aside className="w-64 bg-white border-l border-gray-200 flex flex-col shadow-sm shrink-0 z-10 hidden md:flex">
        <div className="p-6 flex items-center gap-3 border-b border-gray-100">
          <div className="bg-blue-600 p-2 rounded-lg text-white shadow-md shadow-blue-500/20">
            <Wallet size={24} />
          </div>
          <span className="text-xl font-bold">כיס חכם</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <SidebarItem icon={<Home size={20} />} label="סקירה כללית" active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
          <SidebarItem icon={<ListOrdered size={20} />} label="תנועות" active={activeTab === 'transactions'} onClick={() => setActiveTab('transactions')} />
          <SidebarItem icon={<CreditCard size={20} />} label="חשבונות ואשראי" active={activeTab === 'accounts'} onClick={() => setActiveTab('accounts')} />
          <SidebarItem icon={<PieChart size={20} />} label="תקציב ופילוח" active={activeTab === 'budget'} onClick={() => setActiveTab('budget')} />
        </nav>

        <div className="p-4 border-t border-gray-100">
          <SidebarItem icon={<Settings size={20} />} label="הגדרות" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 relative h-screen overflow-hidden">
        <header className="bg-white h-16 border-b border-gray-200 flex items-center justify-between px-4 md:px-8 shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-lg md:text-xl font-semibold text-gray-800 hidden sm:block">
              {activeTab === 'overview' && 'סקירה כללית'}
              {activeTab === 'transactions' && 'כל התנועות'}
              {activeTab === 'accounts' && 'ניהול מקורות מידע'}
              {activeTab === 'budget' && 'תקציב ופילוח'}
              {activeTab === 'settings' && 'הגדרות מקומיות'}
            </h1>
            
            {['transactions', 'budget', 'overview'].includes(activeTab) && availableMonths.length > 0 && (
              <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
                <Calendar size={16} className="text-gray-500" />
                <select 
                  className="bg-transparent text-sm font-medium outline-none text-gray-700 cursor-pointer"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                >
                  {availableMonths.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-4 md:gap-6">
            <button 
              onClick={() => setIsSyncModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white p-2 sm:px-4 sm:py-2 rounded-lg shadow-sm flex items-center gap-2 transition-colors text-sm font-medium"
            >
              <Plus size={18} />
              <span className="hidden sm:inline">הוסף מקור מידע</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto bg-gray-50/50 p-4 md:p-8">
          <div className="max-w-7xl mx-auto pb-20 md:pb-10">
            {renderView()}
          </div>
        </div>

        <nav className="md:hidden absolute bottom-0 w-full bg-white border-t border-gray-200 px-4 py-2 pb-safe flex justify-between items-center z-20">
            <MobileNavItem icon={<Home size={22} />} label="ראשי" active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
            <MobileNavItem icon={<ListOrdered size={22} />} label="תנועות" active={activeTab === 'transactions'} onClick={() => setActiveTab('transactions')} />
            <MobileNavItem icon={<CreditCard size={22} />} label="חשבונות" active={activeTab === 'accounts'} onClick={() => setActiveTab('accounts')} />
            <MobileNavItem icon={<PieChart size={22} />} label="תקציב" active={activeTab === 'budget'} onClick={() => setActiveTab('budget')} />
        </nav>

        {selectedTx && (
          <TransactionModal 
            tx={selectedTx} 
            ALL_CATEGORIES={ALL_CATEGORIES}
            accounts={accounts}
            getCategoryDetails={getCategoryDetails}
            onClose={() => setSelectedTx(null)}
            onSave={handleUpdateTxCategory}
          />
        )}

        {editingAccount && (
          <EditAccountModal 
            account={editingAccount}
            onClose={() => setEditingAccount(null)}
            onSave={handleEditAccountSubmit}
          />
        )}

        {isSyncModalOpen && (
          <SyncModal 
            onClose={() => setIsSyncModalOpen(false)} 
            onSuccess={() => {
              setIsSyncModalOpen(false);
              fetchData();
            }}
          />
        )}
      </main>
    </div>
  );
}

// ==========================================
// Views
// ==========================================

function OverviewView({ filteredTransactions, accounts, onTxClick, getCategoryDetails, getAccountName, transactions }) {
  const totalBalance = accounts.filter(a => a.type === 'bank').reduce((sum, a) => sum + Math.max(0, a.balance), 0);
  
  // הכנסות = כל תנועה שהסוג שלה במערכת הוא הכנסה (לפי העץ) וגם תנועות חיוביות
  const monthIncome = filteredTransactions.reduce((sum, t) => {
    const { mainCat } = getCategoryDetails(t.categoryId);
    if (mainCat.type === 'income' || t.amount > 0) return sum + Math.abs(t.amount);
    return sum;
  }, 0);

  // הוצאות = כל תנועה שלילית שאינה מוגדרת במפורש כהכנסה
  const monthExpenses = filteredTransactions.reduce((sum, t) => {
    const { mainCat } = getCategoryDetails(t.categoryId);
    if (mainCat.type !== 'income' && t.amount < 0) return sum + Math.abs(t.amount);
    return sum;
  }, 0);

  const banks = accounts.filter(a => a.type === 'bank');
  const credits = accounts.filter(a => a.type === 'credit');

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="יתרת עו״ש כוללת" amount={`₪ ${totalBalance.toLocaleString(undefined, {minimumFractionDigits:2})}`} trend="סה״כ בכל הבנקים" isPositive={true} icon={<Building size={24} className="text-blue-600" />} color="blue" />
        <StatCard title="הוצאות החודש" amount={`₪ ${monthExpenses.toLocaleString(undefined, {minimumFractionDigits:2})}`} trend="סיכום כרטיסים ועו״ש" isPositive={false} icon={<TrendingDown size={24} className="text-red-600" />} color="red" />
        <StatCard title="הכנסות החודש" amount={`₪ ${monthIncome.toLocaleString(undefined, {minimumFractionDigits:2})}`} trend="משכורות והעברות" isPositive={true} icon={<TrendingUp size={24} className="text-green-600" />} color="green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-lg font-bold">תנועות אחרונות</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-gray-50/80 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-2 font-semibold">תאריך</th>
                    <th className="px-4 py-2 font-semibold">תיאור וקטגוריה</th>
                    <th className="px-4 py-2 font-semibold">חשבון מחיוב</th>
                    <th className="px-4 py-2 font-semibold">סכום</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredTransactions.slice(0, 5).map((tx) => {
                    const { mainCat, subCat } = getCategoryDetails(tx.categoryId);
                    const Icon = IconMap[mainCat.icon] || Tag;
                    const amountColor = mainCat.type === 'income' || tx.amount > 0 ? 'text-green-600' : 'text-gray-900';
                    return (
                      <tr key={tx.id} onClick={() => onTxClick(tx)} className="hover:bg-blue-50/30 transition-colors cursor-pointer group">
                        <td className="px-4 py-2.5 text-xs text-gray-500 w-24 whitespace-nowrap">{tx.date}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${mainCat.bg} ${mainCat.color} shrink-0`}>
                              <Icon size={14} />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-gray-800 leading-tight flex items-center gap-2">
                                {tx.description}
                                {tx.status === 'pending' && <span className="bg-orange-100 text-orange-700 text-[10px] px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1"><Clock size={10}/> ממתין</span>}
                                {tx.installments && <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded-full font-medium">תשלום {tx.installments.number} מתוך {tx.installments.total}</span>}
                              </span>
                              <span className="text-[11px] text-gray-500 mt-0.5">{mainCat.name} • {subCat.name}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">{getAccountName(tx.accountId || tx.account)}</td>
                        <td className={`px-4 py-2.5 text-sm font-bold ${amountColor} text-left whitespace-nowrap`} dir="ltr">
                          {tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(2)} ₪
                        </td>
                      </tr>
                    );
                  })}
                  {filteredTransactions.length === 0 && (
                      <tr><td colSpan="4" className="text-center py-8 text-gray-500">אין תנועות בחודש זה</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
             <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
               <CreditCard size={20} className="text-purple-600" /> כרטיסי אשראי
             </h2>
             <div className="space-y-3">
               {credits.length === 0 ? <p className="text-sm text-gray-500">אין כרטיסים מקושרים</p> : credits.map(acc => {
                 const upcoming = calculateUpcomingCharge(acc, transactions);
                 return (
                 <div key={acc.id} className="p-4 border border-gray-100 rounded-xl bg-purple-50/20 hover:border-purple-200 transition-colors">
                   <div className="flex justify-between items-start mb-2">
                     <h3 className="font-semibold text-gray-800">{acc.name}</h3>
                     {acc.status === 'error' && <AlertCircle size={14} className="text-red-500" />}
                   </div>
                   <div className="flex justify-between items-end">
                     <span className="text-xs text-gray-500">חיוב קרוב ({acc.billingDate || 10} לחודש):</span>
                     <span className="font-bold text-red-600" dir="ltr">
                       {Math.abs(upcoming).toLocaleString('he-IL', { style: 'currency', currency: 'ILS' })}
                     </span>
                   </div>
                 </div>
               )})}
             </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
             <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
               <Building size={20} className="text-blue-600" /> חשבונות בנק
             </h2>
             <div className="space-y-3">
               {banks.length === 0 ? <p className="text-sm text-gray-500">אין בנקים מקושרים</p> : banks.map(acc => (
                 <div key={acc.id} className="p-4 border border-gray-100 rounded-xl bg-blue-50/20 hover:border-blue-200 transition-colors">
                   <div className="flex justify-between items-start mb-2">
                     <h3 className="font-semibold text-gray-800">{acc.name}</h3>
                     {acc.status === 'success' && <CheckCircle2 size={14} className="text-green-500" />}
                   </div>
                   <div className="flex justify-between items-end">
                     <span className="text-xs text-gray-500">יתרה נוכחית:</span>
                     <span className={`font-bold ${acc.balance < 0 ? 'text-red-600' : 'text-green-600'}`} dir="ltr">
                       {acc.balance.toLocaleString('he-IL', { style: 'currency', currency: 'ILS' })}
                     </span>
                   </div>
                 </div>
               ))}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TransactionsView({ filteredTransactions, ALL_CATEGORIES, onTxClick, getCategoryDetails, getAccountName }) {
  const [filterType, setFilterType] = useState('all'); 

  const displayedTxs = useMemo(() => {
    if (filterType === 'all') return filteredTransactions;
    return filteredTransactions.filter(t => {
      const { mainCat } = getCategoryDetails(t.categoryId);
      return mainCat.type === filterType;
    });
  }, [filteredTransactions, filterType, getCategoryDetails]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-in fade-in duration-500">
      <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50/30">
        <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 hide-scrollbar">
          <button onClick={() => setFilterType('all')} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filterType === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            כל התנועות
          </button>
          <button onClick={() => setFilterType('expense')} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filterType === 'expense' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            הוצאות בלבד
          </button>
          <button onClick={() => setFilterType('income')} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filterType === 'income' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            הכנסות בלבד
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-right">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-4 py-2 font-semibold border-b border-gray-100">תאריך</th>
              <th className="px-4 py-2 font-semibold border-b border-gray-100">תיאור וקטגוריה</th>
              <th className="px-4 py-2 font-semibold border-b border-gray-100 hidden sm:table-cell">חשבון מחיוב</th>
              <th className="px-4 py-2 font-semibold border-b border-gray-100">סכום</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {displayedTxs.map((tx) => {
              const { mainCat, subCat } = getCategoryDetails(tx.categoryId);
              const Icon = IconMap[mainCat.icon] || Tag;
              const amountColor = mainCat.type === 'income' || tx.amount > 0 ? 'text-green-600' : 'text-gray-900';

              return (
                <tr key={tx.id} onClick={() => onTxClick(tx)} className="hover:bg-blue-50/50 transition-colors cursor-pointer group">
                  <td className="px-4 py-2.5 text-xs text-gray-500 w-20 sm:w-28 whitespace-nowrap">{tx.date}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${mainCat.bg} ${mainCat.color} shrink-0`}>
                        <Icon size={16} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-800 leading-tight flex items-center gap-2">
                            {tx.description}
                            {tx.status === 'pending' && <span className="bg-orange-100 text-orange-700 text-[10px] px-1.5 py-0.5 rounded-full font-medium flex items-center gap-1"><Clock size={10}/> ממתין</span>}
                            {tx.installments && <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded-full font-medium">תשלום {tx.installments.number} מתוך {tx.installments.total}</span>}
                        </span>
                        <span className="text-[11px] text-gray-500 mt-0.5">{mainCat.name} • {subCat.name}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 hidden sm:table-cell">{getAccountName(tx.accountId || tx.account)}</td>
                  <td className={`px-4 py-2.5 text-sm font-bold ${amountColor} text-left whitespace-nowrap`} dir="ltr">
                    {tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(2)} ₪
                  </td>
                </tr>
              );
            })}
            {displayedTxs.length === 0 && (
              <tr><td colSpan="4" className="text-center py-12 text-gray-400">לא נמצאו תנועות.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AccountsView({ accounts, setEditingAccount, onAddClick, transactions }) {
  const banks = accounts.filter(a => a.type === 'bank');
  const credits = accounts.filter(a => a.type === 'credit');

  const renderAccountCard = (account) => {
    const upcoming = calculateUpcomingCharge(account, transactions);
    return (
    <div key={account.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full hover:border-blue-200 transition-colors group relative">
      <div className="flex justify-between items-start mb-6">
        <div className={`p-4 rounded-xl ${account.type === 'bank' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
          {account.type === 'bank' ? <Building size={28} /> : <CreditCard size={28} />}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditingAccount(account)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100" title="הגדרות חשבון">
            <Edit2 size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1">
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">{account.name}</h3>
        <p className={`text-sm mt-1 flex items-center gap-1.5 font-medium text-green-600`}>
          <CheckCircle2 size={14} /> מחובר ופעיל
        </p>
      </div>

      <div className="mt-6 pt-6 border-t border-gray-100">
        <p className="text-sm text-gray-500 mb-1">
          {account.type === 'bank' ? 'יתרה נוכחית' : `חיוב קרוב (${account.billingDate || 10} לחודש)`}
        </p>
        <p className={`text-2xl font-bold ${account.type === 'credit' || account.balance < 0 ? 'text-red-600' : 'text-gray-800'}`} dir="ltr">
          {account.type === 'credit' 
            ? Math.abs(upcoming).toLocaleString('he-IL', { style: 'currency', currency: 'ILS' })
            : account.balance.toLocaleString('he-IL', { style: 'currency', currency: 'ILS' })
          }
        </p>
      </div>
    </div>
  )};

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-6 border-b pb-2 flex items-center gap-2">
          <CreditCard size={24} className="text-purple-600" /> כרטיסי אשראי
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {credits.map(renderAccountCard)}
          <button onClick={onAddClick} className="bg-white border-2 border-dashed border-gray-200 p-6 rounded-2xl flex flex-col items-center justify-center text-gray-400 hover:text-purple-600 hover:border-purple-300 transition-all min-h-[250px] group">
            <Plus size={32} className="mb-2 group-hover:scale-110 transition-transform" />
            <span className="font-bold">הוסף כרטיס אשראי</span>
          </button>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-gray-800 mb-6 border-b pb-2 flex items-center gap-2">
          <Building size={24} className="text-blue-600" /> חשבונות עו״ש
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {banks.map(renderAccountCard)}
          <button onClick={onAddClick} className="bg-white border-2 border-dashed border-gray-200 p-6 rounded-2xl flex flex-col items-center justify-center text-gray-400 hover:text-blue-600 hover:border-blue-300 transition-all min-h-[250px] group">
            <Plus size={32} className="mb-2 group-hover:scale-110 transition-transform" />
            <span className="font-bold">הוסף חשבון בנק</span>
          </button>
        </div>
      </section>
    </div>
  );
}

function BudgetView({ filteredTransactions, getCategoryDetails }) {
  const expenses = filteredTransactions.filter(t => {
      const { mainCat } = getCategoryDetails(t.categoryId);
      return mainCat.type !== 'income' && t.amount < 0;
  });
  const totalExpenses = expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const budgetLimit = 8000; 
  const percentage = Math.min(100, Math.round((totalExpenses / budgetLimit) * 100));

  const grouped = {};
  expenses.forEach(t => {
    const { mainCat } = getCategoryDetails(t.categoryId);
    grouped[mainCat.id] = (grouped[mainCat.id] || 0) + Math.abs(t.amount);
  });

  const sortedCategories = Object.keys(grouped)
    .map(catId => {
       const { mainCat } = getCategoryDetails(EXPENSES.find(e => e.id === catId)?.subs[0]?.id || '');
       return {
         cat: mainCat,
         amount: grouped[catId],
         percent: Math.round((grouped[catId] / totalExpenses) * 100)
       };
    })
    .sort((a, b) => b.amount - a.amount);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 animate-in fade-in duration-500">
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-center items-center text-center">
        <h2 className="text-xl font-bold text-gray-800 mb-2">סה״כ הוצאות בחודש זה</h2>
        <p className="text-gray-500 mb-8">מתוך תקציב מתוכנן של ₪{budgetLimit.toLocaleString()}</p>
        <p className="text-6xl font-extrabold text-red-600 mb-10 tracking-tight" dir="ltr">
          {totalExpenses.toLocaleString(undefined, {minimumFractionDigits:2})} ₪
        </p>
        
        <div className="w-full max-w-md bg-gray-100 rounded-full h-4 mb-3 overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-1000 ${percentage > 90 ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${percentage}%` }}></div>
        </div>
        <p className="text-sm font-bold text-gray-600">נוצלו {percentage}% מהתקציב החודשי</p>
      </div>

      <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-gray-800 mb-8 flex items-center gap-2">
          <PieChart className="text-blue-500" /> פירוט הוצאות לפי קטגוריות
        </h2>
        <div className="space-y-6">
          {sortedCategories.length === 0 ? (
            <p className="text-gray-400 text-center py-10">אין הוצאות לחודש זה.</p>
          ) : (
            sortedCategories.map((item, idx) => {
              const Icon = IconMap[item.cat.icon] || Tag;
              return (
                <div key={idx} className="group">
                  <div className="flex justify-between items-end mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-md ${item.cat.bg} ${item.cat.color}`}>
                        <Icon size={14} />
                      </div>
                      <span className="font-bold text-gray-700">{item.cat.name}</span>
                      <span className="text-xs text-gray-400">({item.percent}%)</span>
                    </div>
                    <span className="text-gray-800 font-bold">₪ {item.amount.toLocaleString(undefined, {minimumFractionDigits:2})}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div className={`${item.cat.barBg} h-full rounded-full transition-all duration-1000`} style={{ width: `${item.percent}%` }}></div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  );
}

function SettingsView() {
  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-lg font-bold text-gray-800">הגדרות מקומיות</h2>
        </div>
        <div className="divide-y divide-gray-100">
          <SettingsRow icon={<Shield size={22} />} label="הצפנה מתקדמת" description="הנתונים נשמרים מקומית על המחשב שלך בלבד" />
          <SettingsRow icon={<Settings size={22} />} label="ייצוא נתונים" description="הורד גיבוי של כל הנתונים השמורים באפליקציה" />
        </div>
      </div>
    </div>
  );
}

// ==========================================
// Modals (Design Updates based on PDF)
// ==========================================

function TransactionModal({ tx, ALL_CATEGORIES, getCategoryDetails, accounts, onClose, onSave }) {
  const currentDetails = getCategoryDetails(tx.categoryId);
  // הגדרת הלשונית הפעילה בתחילה לפי סוג הקטגוריה הנוכחית (הוצאה/הכנסה)
  const [activeTabType, setActiveTabType] = useState(currentDetails.mainCat.type);
  const [expandedMainCat, setExpandedMainCat] = useState(currentDetails.mainCat.id);
  
  const acc = accounts.find(a => a.id === tx.accountId || a.id === tx.account);

  const displayCategories = activeTabType === 'expense' ? EXPENSES : [INCOMES];

  return (
    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
      <div className="bg-gray-100 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* כותרת מודאל כמו בתמונה */}
        <div className="bg-white p-4 border-b border-gray-100 flex justify-between items-center shrink-0">
           <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-800"><X size={20} /></button>
           <h3 className="text-lg font-bold text-gray-800">עריכת תנועה</h3>
           <div className="w-8"></div> {/* סתם יישור לאמצע */}
        </div>

        {/* פרטי העסקה */}
        <div className="bg-white p-6 pb-4 flex flex-col items-center border-b border-gray-100 shrink-0">
          <h2 className="text-2xl font-black text-gray-800">{tx.description}</h2>
          <p className="text-sm text-gray-500 mt-1">{tx.date}</p>
          <p className={`text-3xl font-black mt-3 ${tx.amount < 0 && activeTabType !== 'income' ? 'text-gray-900' : 'text-green-600'}`} dir="ltr">
            {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString(undefined, {minimumFractionDigits: 2})} ₪
          </p>
        </div>

        {/* לשוניות (הוצאות / הכנסות) כמו בקובץ PDF */}
        <div className="bg-white flex border-b border-gray-200 shrink-0">
          <button 
            onClick={() => setActiveTabType('expense')} 
            className={`flex-1 py-3 text-center font-bold text-sm transition-colors ${activeTabType === 'expense' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            הוצאות
          </button>
          <button 
            onClick={() => setActiveTabType('income')} 
            className={`flex-1 py-3 text-center font-bold text-sm transition-colors ${activeTabType === 'income' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            הכנסות
          </button>
        </div>

        {/* רשימת ענפים (אקורדיון כמו ב-PDF) */}
        <div className="p-4 overflow-y-auto flex-1">
          <p className="text-sm font-bold text-gray-600 mb-3 px-2">ואיזה ענף?</p>
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
            {displayCategories.map((mainCat, index) => {
              const Icon = IconMap[mainCat.icon] || Tag;
              const isExpanded = expandedMainCat === mainCat.id;
              return (
                <div key={mainCat.id} className={`${index > 0 ? 'border-t border-gray-100' : ''}`}>
                  <button 
                    onClick={() => setExpandedMainCat(isExpanded ? null : mainCat.id)}
                    className="w-full p-4 flex justify-between items-center hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${mainCat.bg} ${mainCat.color}`}>
                        <Icon size={18} />
                      </div>
                      <span className={`font-bold ${isExpanded ? 'text-blue-600' : 'text-gray-800'}`}>{mainCat.name}</span>
                    </div>
                    {isExpanded ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
                  </button>
                  
                  {isExpanded && (
                    <div className="bg-gray-50/50 border-t border-gray-50 flex flex-col">
                      {mainCat.subs.map(sub => {
                        const isSelected = currentDetails.subCat.id === sub.id;
                        return (
                          <button
                            key={sub.id}
                            onClick={() => onSave(tx.id, sub.id)} // שמירה מידית בלחיצה על תת הקטגוריה
                            className="p-4 pr-14 text-right hover:bg-blue-50 transition-colors flex justify-between items-center group border-b border-gray-100 last:border-0"
                          >
                            <span className={`text-sm ${isSelected ? 'font-bold text-blue-600' : 'text-gray-600 group-hover:text-gray-900'}`}>{sub.name}</span>
                            {isSelected && <Check size={18} className="text-blue-600" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function EditAccountModal({ account, onClose, onSave }) {
  const [name, setName] = useState(account.name);
  const [billingDate, setBillingDate] = useState(account.billingDate || 10);

  return (
    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 p-6 space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-bold text-gray-800">הגדרות {account.type === 'bank' ? 'חשבון' : 'כרטיס'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-800"><X size={20} /></button>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-2">שם תצוגה</label>
          <input 
            type="text" 
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-lg font-bold"
          />
        </div>

        {account.type === 'credit' && (
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">תאריך חיוב קרוב (לצורך חישוב הוצאות)</label>
            <select 
              value={billingDate}
              onChange={e => setBillingDate(parseInt(e.target.value))}
              className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
            >
              {[1, 2, 10, 12, 15, 20].map(d => (
                <option key={d} value={d}>ה-{d} לחודש</option>
              ))}
            </select>
          </div>
        )}

        <button 
          onClick={() => onSave(account.id, name, billingDate)}
          className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 transition-colors shadow-md"
        >
          שמור שינויים
        </button>
      </div>
    </div>
  );
}

function SyncModal({ onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [companyId, setCompanyId] = useState('leumi');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          credentials: { id: username, username: username, password: password }
        })
      });
      
      const data = await res.json();
      if (data.success) {
        onSuccess(); 
      } else {
        setError(data.errorMessage || data.message || 'שגיאה בחיבור. ודא שפרטי ההתחברות נכונים.');
      }
    } catch (err) {
      setError('שגיאת תקשורת עם השרת המקומי.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden relative animate-in zoom-in-95 duration-200">
        <div className="bg-blue-600 p-6 text-white flex justify-between items-center">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Lock size={20} /> חיבור מוסד פיננסי
          </h2>
          <button onClick={onClose} disabled={loading} className="hover:bg-white/20 p-1 rounded transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-gray-600 mb-4 bg-blue-50 p-3 rounded-lg border border-blue-100">
            הפרטים נשלחים ישירות לבנק/חברת האשראי, מוצפנים ונשמרים רק אצלך.
          </p>

          {error && (
            <div className="p-3 bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm font-medium flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" /><span>{error}</span>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">בחר בנק/כרטיס אשראי</label>
            <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500">
              <option value="leumi">בנק לאומי</option>
              <option value="hapoalim">בנק הפועלים</option>
              <option value="discount">בנק דיסקונט</option>
              <option value="mizrahi">בנק מזרחי טפחות</option>
              <option value="max">מקס (Max)</option>
              <option value="isracard">ישראכרט</option>
              <option value="visa-cal">כאל (Cal)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">שם משתמש / ת.ז</label>
            <input type="text" required value={username} onChange={(e) => setUsername(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">סיסמה</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-left" dir="ltr" />
          </div>

          <button type="submit" disabled={loading} className={`w-full py-4 rounded-xl font-bold text-white transition-all mt-6 shadow-md flex justify-center items-center gap-2 ${loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {loading ? <><RefreshCw size={20} className="animate-spin" />סורק ומושך נתונים... (ממתין לדפדפן)</> : 'התחבר וסנכרן נתונים'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ==========================================
// Reusable Sub-components
// ==========================================

function SidebarItem({ icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all font-medium ${
        active 
          ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-100' 
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border border-transparent'
      }`}
    >
      <span className={active ? 'text-blue-600' : 'text-gray-400'}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function MobileNavItem({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center w-16 transition-colors ${active ? 'text-blue-600' : 'text-gray-400'}`}>
      <div className={`mb-1 transition-transform ${active ? 'scale-110' : ''}`}>{icon}</div>
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

function StatCard({ title, amount, trend, isPositive, icon, color }) {
  const bgColors = { blue: 'bg-blue-50', green: 'bg-green-50', red: 'bg-red-50' };
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-start justify-between hover:shadow-md transition-shadow group">
      <div>
        <p className="text-sm font-medium text-gray-500 mb-2">{title}</p>
        <h3 className="text-3xl font-black text-gray-800 mb-3 tracking-tight" dir="ltr">{amount}</h3>
        <p className={`text-sm font-medium flex items-center gap-1 ${isPositive ? 'text-green-600' : 'text-gray-500'}`}>
          <span dir="ltr">{trend}</span>
        </p>
      </div>
      <div className={`p-4 rounded-xl ${bgColors[color]} group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
    </div>
  );
}

function SettingsRow({ icon, label, description }) {
  return (
    <button className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors text-right">
      <div className="flex items-center gap-4 text-gray-800">
        <div className="p-3 bg-gray-100 rounded-xl text-gray-600">
          {icon}
        </div>
        <div>
          <h3 className="font-bold text-base">{label}</h3>
          <p className="text-sm text-gray-500 mt-0.5">{description}</p>
        </div>
      </div>
      <ChevronLeft size={20} className="text-gray-400" />
    </button>
  );
}