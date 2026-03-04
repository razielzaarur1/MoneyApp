import React, { useState, useEffect, useMemo } from 'react';

import {

  Home, CreditCard, ListOrdered, PieChart, Settings, Bell, Search,

  RefreshCw, AlertCircle, CheckCircle2, TrendingUp, TrendingDown,

  Building, Wallet, Plus, User, Shield, LogOut, ChevronLeft,

  ShoppingBag, Utensils, Car, Zap, Shirt, ArrowRightLeft,

  MoreHorizontal, Calendar, Edit2, X, Filter, Tag, Check, Lock

} from 'lucide-react';



// --- Icon Mapping Helper ---

const IconMap = {

  ShoppingBag, Utensils, Car, Zap, Shirt, ArrowRightLeft, Wallet, MoreHorizontal, Tag

};



// --- Initial Categories ---

const initialCategories = [

  { id: 'supermarket', name: 'סופרמרקט', icon: 'ShoppingBag', color: 'text-blue-600', bg: 'bg-blue-50', barBg: 'bg-blue-500' },

  { id: 'restaurants', name: 'מסעדות ובילויים', icon: 'Utensils', color: 'text-pink-600', bg: 'bg-pink-50', barBg: 'bg-pink-500' },

  { id: 'transport', name: 'רכב ותחבורה', icon: 'Car', color: 'text-orange-600', bg: 'bg-orange-50', barBg: 'bg-orange-500' },

  { id: 'bills', name: 'חשבונות', icon: 'Zap', color: 'text-indigo-600', bg: 'bg-indigo-50', barBg: 'bg-indigo-500' },

  { id: 'leisure', name: 'פנאי וביגוד', icon: 'Shirt', color: 'text-purple-600', bg: 'bg-purple-50', barBg: 'bg-purple-500' },

  { id: 'transfers', name: 'העברות', icon: 'ArrowRightLeft', color: 'text-teal-600', bg: 'bg-teal-50', barBg: 'bg-teal-500' },

  { id: 'income', name: 'הכנסות', icon: 'Wallet', color: 'text-green-600', bg: 'bg-green-50', barBg: 'bg-green-500' },

  { id: 'general', name: 'כללי', icon: 'MoreHorizontal', color: 'text-gray-600', bg: 'bg-gray-50', barBg: 'bg-gray-500' },

];



export default function App() {

  const [activeTab, setActiveTab] = useState('overview');

  const [transactions, setTransactions] = useState([]);

  const [accounts, setAccounts] = useState([]);

  const [categories, setCategories] = useState(initialCategories);

  const [selectedMonth, setSelectedMonth] = useState('');

  const [loading, setLoading] = useState(true);

 

  // Modals state

  const [selectedTx, setSelectedTx] = useState(null);

  const [editingAccount, setEditingAccount] = useState(null);

  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);



  // משיכת נתונים אמיתיים מהשרת שלנו

  const fetchData = () => {

    setLoading(true);

    fetch('/api/data')

      .then(res => res.json())

      .then(data => {

        // המרת הנתונים מהשרת לתמיכה בקטגוריות של ה-UI

        const mappedTransactions = (data.transactions || []).map(tx => ({

          ...tx,

          categoryId: tx.categoryId || 'general' // ברירת מחדל

        }));

       

        setTransactions(mappedTransactions);

        setAccounts(data.accounts || []);

       

        // הגדרת החודש הדיפולטיבי לחודש האחרון שיש בו תנועות

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

       

        setLoading(false);

      })

      .catch(err => {

        console.error("שגיאה במשיכת נתונים:", err);

        setLoading(false);

      });

  };



  useEffect(() => {

    fetchData();

  }, []);



  // Computed data

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



  // Handlers

  const handleUpdateTxCategory = (txId, newCategoryId) => {

    setTransactions(transactions.map(tx => tx.id === txId ? { ...tx, categoryId: newCategoryId } : tx));

    setSelectedTx(null);

  };



  const handleAddCategory = (newCatName) => {

    const newId = `cat_${Date.now()}`;

    const newCat = {

      id: newId,

      name: newCatName,

      icon: 'Tag',

      color: 'text-gray-700',

      bg: 'bg-gray-100',

      barBg: 'bg-gray-500'

    };

    setCategories([...categories, newCat]);

    return newId;

  };



  const handleRenameAccount = (accountId, newName) => {

    setAccounts(accounts.map(a => a.id === accountId ? { ...a, name: newName } : a));

    setEditingAccount(null);

  };



  const getAccountName = (accId) => accounts.find(a => a.id === accId)?.name || accId;

  const getCategory = (catId) => categories.find(c => c.id === catId) || categories.find(c => c.id === 'general');



  const sharedProps = {

    transactions, filteredTransactions, accounts, categories,

    selectedMonth, setSelectedMonth, availableMonths,

    onTxClick: setSelectedTx, getCategory, getAccountName,

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

     

      {/* Sidebar */}

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



      {/* Main Container */}

      <main className="flex-1 flex flex-col min-w-0 relative h-screen overflow-hidden">

        {/* Header */}

        <header className="bg-white h-16 border-b border-gray-200 flex items-center justify-between px-4 md:px-8 shrink-0">

          <div className="flex items-center gap-4">

            <h1 className="text-lg md:text-xl font-semibold text-gray-800 hidden sm:block">

              {activeTab === 'overview' && 'בוקר טוב, ישראל! 👋'}

              {activeTab === 'transactions' && 'כל התנועות'}

              {activeTab === 'accounts' && 'ניהול מקורות מידע'}

              {activeTab === 'budget' && 'תקציב ופילוח'}

              {activeTab === 'settings' && 'הגדרות מערכת'}

            </h1>

           

            {/* Global Month Selector */}

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

            <button className="relative text-gray-500 hover:text-blue-600 transition-colors hidden sm:block">

              <Bell size={20} />

            </button>

            <div className="w-9 h-9 bg-gradient-to-tr from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold shadow-md cursor-pointer hover:opacity-90">

              י

            </div>

          </div>

        </header>



        {/* Content Area */}

        <div className="flex-1 overflow-auto bg-gray-50/50 p-4 md:p-8">

          <div className="max-w-7xl mx-auto pb-20 md:pb-10">

            {renderView()}

          </div>

        </div>



        {/* תפריט תחתון למובייל */}

        <nav className="md:hidden absolute bottom-0 w-full bg-white border-t border-gray-200 px-4 py-2 pb-safe flex justify-between items-center z-20">

            <MobileNavItem icon={<Home size={22} />} label="ראשי" active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />

            <MobileNavItem icon={<ListOrdered size={22} />} label="תנועות" active={activeTab === 'transactions'} onClick={() => setActiveTab('transactions')} />

            <MobileNavItem icon={<CreditCard size={22} />} label="חשבונות" active={activeTab === 'accounts'} onClick={() => setActiveTab('accounts')} />

            <MobileNavItem icon={<PieChart size={22} />} label="תקציב" active={activeTab === 'budget'} onClick={() => setActiveTab('budget')} />

        </nav>



        {/* Modals */}

        {selectedTx && (

          <TransactionModal

            tx={selectedTx}

            categories={categories}

            accounts={accounts}

            getCategory={getCategory}

            onClose={() => setSelectedTx(null)}

            onSave={handleUpdateTxCategory}

            onAddCategory={handleAddCategory}

          />

        )}



        {editingAccount && (

          <EditAccountModal

            account={editingAccount}

            onClose={() => setEditingAccount(null)}

            onSave={handleRenameAccount}

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



function OverviewView({ filteredTransactions, accounts, onTxClick, getCategory, getAccountName }) {

  const totalBalance = accounts.filter(a => a.type === 'bank').reduce((sum, a) => sum + Math.max(0, a.balance), 0);

  const monthExpenses = filteredTransactions.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const monthIncome = filteredTransactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);



  const banks = accounts.filter(a => a.type === 'bank');

  const credits = accounts.filter(a => a.type === 'credit');



  return (

    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        <StatCard title="יתרת עו״ש כוללת" amount={`₪ ${totalBalance.toLocaleString(undefined, {minimumFractionDigits:2})}`} trend="סה״כ בכל הבנקים" isPositive={true} icon={<Building size={24} className="text-blue-600" />} color="blue" />

        <StatCard title="הוצאות החודש" amount={`₪ ${monthExpenses.toLocaleString(undefined, {minimumFractionDigits:2})}`} trend="סיכום כרטיסים ועו״ש" isPositive={false} icon={<TrendingDown size={24} className="text-red-600" />} color="red" />

        <StatCard title="הכנסות החודש" amount={`₪ ${monthIncome.toLocaleString(undefined, {minimumFractionDigits:2})}`} trend="משכורות והעברות" isPositive={true} icon={<TrendingUp size={24} className="text-green-600" />} color="green" />

      </div>



      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        <div className="lg:col-span-2 space-y-8">

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

            <div className="p-6 border-b border-gray-100 flex justify-between items-center">

              <h2 className="text-lg font-bold">תנועות אחרונות</h2>

            </div>

            <div className="overflow-x-auto">

              <table className="w-full text-right">

                <thead className="bg-gray-50/80 text-gray-500 text-sm border-b border-gray-100">

                  <tr>

                    <th className="px-6 py-4 font-medium">תאריך</th>

                    <th className="px-6 py-4 font-medium">תיאור וקטגוריה</th>

                    <th className="px-6 py-4 font-medium">חשבון מחיוב</th>

                    <th className="px-6 py-4 font-medium">סכום</th>

                  </tr>

                </thead>

                <tbody className="divide-y divide-gray-50">

                  {filteredTransactions.slice(0, 5).map((tx) => {

                    const cat = getCategory(tx.categoryId);

                    const Icon = IconMap[cat.icon] || Tag;

                    return (

                      <tr key={tx.id} onClick={() => onTxClick(tx)} className="hover:bg-blue-50/30 transition-colors cursor-pointer group">

                        <td className="px-6 py-4 text-sm text-gray-500">{tx.date}</td>

                        <td className="px-6 py-4">

                          <div className="flex items-center gap-3">

                            <div className={`p-2 rounded-lg ${cat.bg} ${cat.color} shrink-0`}>

                              <Icon size={16} />

                            </div>

                            <div>

                              <p className="text-sm font-bold text-gray-800">{tx.description}</p>

                              <p className="text-[11px] text-gray-500 mt-0.5">{cat.name}</p>

                            </div>

                          </div>

                        </td>

                        <td className="px-6 py-4 text-sm text-gray-500">{getAccountName(tx.accountId || tx.account)}</td>

                        <td className={`px-6 py-4 text-sm font-bold ${tx.amount > 0 ? 'text-green-600' : 'text-gray-800'} text-left`} dir="ltr">

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

          {/* Credit Cards Section */}

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">

             <h2 className="text-lg font-bold mb-4 flex items-center gap-2">

               <CreditCard size={20} className="text-purple-600" /> כרטיסי אשראי

             </h2>

             <div className="space-y-3">

               {credits.length === 0 ? <p className="text-sm text-gray-500">אין כרטיסים מקושרים</p> : credits.map(acc => (

                 <div key={acc.id} className="p-4 border border-gray-100 rounded-xl bg-purple-50/20 hover:border-purple-200 transition-colors">

                   <div className="flex justify-between items-start mb-2">

                     <h3 className="font-semibold text-gray-800">{acc.name}</h3>

                     {acc.status === 'error' && <AlertCircle size={14} className="text-red-500" />}

                   </div>

                   <div className="flex justify-between items-end">

                     <span className="text-xs text-gray-500">חיוב קרוב:</span>

                     <span className="font-bold text-red-600" dir="ltr">

                       {Math.abs(acc.balance).toLocaleString('he-IL', { style: 'currency', currency: 'ILS' })}

                     </span>

                   </div>

                 </div>

               ))}

             </div>

          </div>



          {/* Banks Section */}

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



function TransactionsView({ filteredTransactions, categories, onTxClick, getCategory, getAccountName }) {

  const [filterCat, setFilterCat] = useState('all');



  const displayedTxs = filterCat === 'all'

    ? filteredTransactions

    : filteredTransactions.filter(t => t.categoryId === filterCat);



  return (

    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-in fade-in duration-500">

      <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50/30">

        <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 hide-scrollbar">

          <button

            onClick={() => setFilterCat('all')}

            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filterCat === 'all' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}

          >

            כל התנועות

          </button>

          {categories.map(cat => (

            <button

              key={cat.id}

              onClick={() => setFilterCat(cat.id)}

              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap flex items-center gap-2 transition-colors

                ${filterCat === cat.id ? `${cat.barBg} text-white` : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}

            >

              {cat.name}

            </button>

          ))}

        </div>

      </div>



      <div className="overflow-x-auto">

        <table className="w-full text-right">

          <thead className="bg-white text-gray-400 text-xs uppercase tracking-wider">

            <tr>

              <th className="px-6 py-4 font-semibold border-b border-gray-100">תאריך</th>

              <th className="px-6 py-4 font-semibold border-b border-gray-100">תיאור וקטגוריה</th>

              <th className="px-6 py-4 font-semibold border-b border-gray-100">חשבון מחיוב</th>

              <th className="px-6 py-4 font-semibold border-b border-gray-100">סכום</th>

            </tr>

          </thead>

          <tbody className="divide-y divide-gray-50">

            {displayedTxs.map((tx) => {

              const cat = getCategory(tx.categoryId);

              const Icon = IconMap[cat.icon] || Tag;

              return (

                <tr key={tx.id} onClick={() => onTxClick(tx)} className="hover:bg-gray-50 transition-colors cursor-pointer group">

                  <td className="px-6 py-4 text-sm text-gray-500">{tx.date}</td>

                  <td className="px-6 py-4">

                    <div className="flex items-center gap-3">

                      <div className={`p-2 rounded-full ${cat.bg} ${cat.color} shrink-0`}>

                        <Icon size={16} />

                      </div>

                      <div>

                        <p className="text-sm font-bold text-gray-800 group-hover:text-blue-600 transition-colors">{tx.description}</p>

                        <p className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1">

                          <Tag size={10} /> {cat.name}

                        </p>

                      </div>

                    </div>

                  </td>

                  <td className="px-6 py-4 text-sm text-gray-500">{getAccountName(tx.accountId || tx.account)}</td>

                  <td className={`px-6 py-4 text-sm font-bold ${tx.amount > 0 ? 'text-green-600' : 'text-gray-800'} text-left`} dir="ltr">

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



function AccountsView({ accounts, setEditingAccount, onAddClick }) {

  const banks = accounts.filter(a => a.type === 'bank');

  const credits = accounts.filter(a => a.type === 'credit');



  const renderAccountCard = (account) => (

    <div key={account.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full hover:border-blue-200 transition-colors group relative">

      <div className="flex justify-between items-start mb-6">

        <div className={`p-4 rounded-xl ${account.type === 'bank' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>

          {account.type === 'bank' ? <Building size={28} /> : <CreditCard size={28} />}

        </div>

        <div className="flex gap-2">

          <button onClick={() => setEditingAccount(account)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100" title="שנה שם">

            <Edit2 size={16} />

          </button>

          <button className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="סנכרן עכשיו">

            <RefreshCw size={16} className={account.status === 'syncing' ? 'animate-spin text-blue-500' : ''} />

          </button>

        </div>

      </div>



      <div className="flex-1">

        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">

          {account.name}

        </h3>

        <p className={`text-sm mt-1 flex items-center gap-1.5 font-medium

          ${account.status === 'success' ? 'text-green-600' :

            account.status === 'error' ? 'text-red-600' : 'text-blue-600'}`}

        >

          {account.status === 'success' && <CheckCircle2 size={14} />}

          {account.status === 'error' && <AlertCircle size={14} />}

          {account.status === 'syncing' && <RefreshCw size={14} className="animate-spin" />}

          {account.status === 'success' && 'מחובר ופעיל'}

          {account.status === 'error' && 'שגיאת התחברות'}

          {account.status === 'syncing' && 'בסנכרון...'}

        </p>

      </div>



      <div className="mt-6 pt-6 border-t border-gray-100">

        <p className="text-sm text-gray-500 mb-1">{account.type === 'bank' ? 'יתרה נוכחית' : 'חיוב קרוב'}</p>

        <p className={`text-2xl font-bold ${account.type === 'credit' || account.balance < 0 ? 'text-red-600' : 'text-gray-800'}`} dir="ltr">

          {account.type === 'credit'

            ? Math.abs(account.balance).toLocaleString('he-IL', { style: 'currency', currency: 'ILS' })

            : account.balance.toLocaleString('he-IL', { style: 'currency', currency: 'ILS' })

          }

        </p>

      </div>



      {account.status === 'error' && (

        <div className="mt-4 bg-red-50 border border-red-100 p-3 rounded-xl flex justify-between items-center">

          <p className="text-xs text-red-700 font-medium">{account.errorMsg}</p>

          <button className="text-xs bg-white border border-red-200 text-red-600 font-bold rounded px-2 py-1 hover:bg-red-50">תקן</button>

        </div>

      )}

    </div>

  );



  return (

    <div className="space-y-10 animate-in fade-in duration-500">

     

      {/* Credit Cards */}

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



      {/* Banks */}

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



function BudgetView({ filteredTransactions, categories, getCategory }) {

  const expenses = filteredTransactions.filter(t => t.amount < 0);

  const totalExpenses = expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const budgetLimit = 8000;

  const percentage = Math.min(100, Math.round((totalExpenses / budgetLimit) * 100));



  const grouped = {};

  expenses.forEach(t => {

    grouped[t.categoryId] = (grouped[t.categoryId] || 0) + Math.abs(t.amount);

  });



  const sortedCategories = Object.keys(grouped)

    .map(catId => ({

       cat: getCategory(catId),

       amount: grouped[catId],

       percent: Math.round((grouped[catId] / totalExpenses) * 100)

    }))

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

          <h2 className="text-lg font-bold text-gray-800">הגדרות חשבון ופרופיל</h2>

        </div>

        <div className="divide-y divide-gray-100">

          <SettingsRow icon={<User size={22} />} label="פרופיל אישי" description="עריכת שם, אימייל וסיסמה" />

          <SettingsRow icon={<Bell size={22} />} label="התראות חכמות" description="הגדרת התראות למייל ולסמס על חריגות תקציב" />

          <SettingsRow icon={<Shield size={22} />} label="אבטחה והרשאות" description="ניהול מפתחות הצפנה עבור ה-Scrapers המקומיים" />

        </div>

      </div>

      <button className="w-full sm:w-auto px-8 py-4 bg-red-50 text-red-600 font-bold rounded-2xl flex items-center justify-center gap-3 hover:bg-red-100 transition-colors">

        <LogOut size={20} /> התנתק מהמערכת

      </button>

    </div>

  );

}



// ==========================================

// Modals

// ==========================================



function TransactionModal({ tx, categories, getCategory, accounts, onClose, onSave, onAddCategory }) {

  const [selectedCat, setSelectedCat] = useState(tx.categoryId);

  const [newCatName, setNewCatName] = useState('');

  const [isAddingMode, setIsAddingMode] = useState(false);



  const acc = accounts.find(a => a.id === tx.accountId || a.id === tx.account);

  const currentCat = getCategory(selectedCat);



  const handleSave = () => {

    onSave(tx.id, selectedCat);

  };



  const handleCreateCategory = () => {

    if(newCatName.trim()){

      const newId = onAddCategory(newCatName);

      setSelectedCat(newId);

      setIsAddingMode(false);

      setNewCatName('');

    }

  };



  return (

    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">

      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">

       

        <div className="bg-gray-50/80 p-6 border-b border-gray-100 flex justify-between items-start">

           <div>

             <span className="px-3 py-1 bg-white border border-gray-200 rounded-full text-xs font-bold text-gray-500 shadow-sm mb-3 inline-block">

               {tx.date}

             </span>

             <h3 className="text-2xl font-black text-gray-800 leading-tight">{tx.description}</h3>

             <p className="text-sm text-gray-500 flex items-center gap-1 mt-2">

               <Building size={14} /> שולם דרך: <span className="font-bold">{acc?.name || tx.account}</span>

             </p>

           </div>

           <button onClick={onClose} className="p-2 bg-white rounded-full text-gray-400 hover:text-gray-800 shadow-sm border border-gray-100">

             <X size={18} />

           </button>

        </div>



        <div className="p-6 border-b border-gray-100 text-center">

          <p className="text-sm text-gray-500 mb-1">סכום העסקה</p>

          <p className={`text-4xl font-black ${tx.amount < 0 ? 'text-red-600' : 'text-green-600'}`} dir="ltr">

            {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString(undefined, {minimumFractionDigits: 2})} ₪

          </p>

        </div>



        <div className="p-6 bg-white space-y-4">

          <label className="block text-sm font-bold text-gray-700">שיוך לקטגוריה:</label>

         

          {!isAddingMode ? (

            <div className="space-y-3">

              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">

                {categories.map(cat => {

                  const Icon = IconMap[cat.icon] || Tag;

                  const isSelected = selectedCat === cat.id;

                  return (

                    <button

                      key={cat.id}

                      onClick={() => setSelectedCat(cat.id)}

                      className={`flex items-center gap-2 p-3 rounded-xl border transition-all text-right

                        ${isSelected ? `border-${cat.color.split('-')[1]}-500 bg-${cat.bg.split('-')[1]}-50 shadow-sm ring-1 ring-${cat.color.split('-')[1]}-500` : 'border-gray-200 hover:bg-gray-50'}`}

                    >

                      <div className={`p-1.5 rounded-md ${cat.bg} ${cat.color}`}><Icon size={14} /></div>

                      <span className={`text-sm font-medium ${isSelected ? 'text-gray-900' : 'text-gray-600'}`}>{cat.name}</span>

                      {isSelected && <Check size={14} className={`mr-auto ${cat.color}`} />}

                    </button>

                  )

                })}

              </div>

              <button

                onClick={() => setIsAddingMode(true)}

                className="w-full py-3 border border-dashed border-gray-300 rounded-xl text-sm font-bold text-blue-600 hover:bg-blue-50 transition-colors flex justify-center items-center gap-2"

              >

                <Plus size={16} /> יצירת קטגוריה חדשה

              </button>

            </div>

          ) : (

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">

              <input

                autoFocus

                type="text"

                placeholder="שם הקטגוריה החדשה..."

                value={newCatName}

                onChange={e => setNewCatName(e.target.value)}

                className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"

              />

              <div className="flex gap-2">

                <button onClick={handleCreateCategory} className="flex-1 bg-blue-600 text-white font-bold py-2 rounded-lg text-sm hover:bg-blue-700">שמור</button>

                <button onClick={() => setIsAddingMode(false)} className="flex-1 bg-white border border-gray-300 text-gray-600 font-bold py-2 rounded-lg text-sm hover:bg-gray-100">ביטול</button>

              </div>

            </div>

          )}

        </div>



        <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">

          <button onClick={handleSave} className="flex-1 bg-gray-900 text-white font-bold py-3.5 rounded-xl hover:bg-black transition-colors shadow-md">

            שמור שינויים באפליקציה

          </button>

        </div>



      </div>

    </div>

  );

}



function EditAccountModal({ account, onClose, onSave }) {

  const [name, setName] = useState(account.name);



  return (

    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">

      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 p-6 space-y-6">

        <div className="flex justify-between items-center">

          <h3 className="text-xl font-bold text-gray-800">שינוי שם תצוגה</h3>

          <button onClick={onClose} className="text-gray-400 hover:text-gray-800"><X size={20} /></button>

        </div>

       

        <div>

          <label className="block text-sm font-medium text-gray-600 mb-2">שם {account.type === 'bank' ? 'החשבון' : 'הכרטיס'}</label>

          <input

            type="text"

            value={name}

            onChange={e => setName(e.target.value)}

            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-lg font-bold"

          />

        </div>



        <button

          onClick={() => onSave(account.id, name)}

          className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 transition-colors shadow-md"

        >

          שמור שינוי באפליקציה

        </button>

      </div>

    </div>

  );

}



function SyncModal({ onClose, onSuccess }) {

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({

    companyId: 'leumi',

    username: '',

    password: '',

    extra: ''

  });



  const handleSubmit = async (e) => {

    e.preventDefault();

    setLoading(true);

    setError(null);



    const credentials = { password: formData.password };



    if (formData.companyId === 'isracard') {

      credentials.id = formData.username;

      credentials.card6Digits = formData.extra;

    } else if (formData.companyId === 'discount') {

      credentials.id = formData.username;

      credentials.num = formData.extra;

    } else if (formData.companyId === 'hapoalim') {

      credentials.userCode = formData.username;

    } else {

      credentials.username = formData.username;

    }



    try {

      const res = await fetch('/api/sync', {

        method: 'POST',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify({ companyId: formData.companyId, credentials })

      });

      const data = await res.json();

     

      if (data.success) {

        onSuccess();

      } else {

        setError(`שגיאה: ${data.errorMessage || data.errorType || data.message || 'שגיאה לא ידועה'}`);

        setLoading(false);

      }

    } catch (err) {

      setError("שגיאת תקשורת עם השרת המקומי. בדוק את הטרמינל.");

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

            הפרטים מוצפנים ונשלחים ישירות לאתר הבנק דרך המחשב שלך בלבד.

          </p>

         

          <div>

            <label className="block text-sm font-medium text-gray-700 mb-1">בחר בנק/כרטיס אשראי</label>

            <select

              value={formData.companyId}

              onChange={e => setFormData({...formData, companyId: e.target.value, extra: ''})}

              className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"

            >

              <option value="leumi">בנק לאומי</option>

              <option value="hapoalim">בנק הפועלים</option>

              <option value="discount">בנק דיסקונט</option>

              <option value="mizrahi">בנק מזרחי</option>

              <option value="max">מקס (Max)</option>

              <option value="isracard">ישראכרט</option>

              <option value="visa-cal">ויזה כאל</option>

            </select>

          </div>



          <div>

            <label className="block text-sm font-medium text-gray-700 mb-1">

              {['isracard', 'discount'].includes(formData.companyId) ? 'תעודת זהות' :

               formData.companyId === 'hapoalim' ? 'קוד משתמש' : 'שם משתמש'}

            </label>

            <input

              type="text" required

              value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})}

              className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"

            />

          </div>



          <div>

            <label className="block text-sm font-medium text-gray-700 mb-1">סיסמה</label>

            <input

              type="password" required

              value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})}

              className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-left" dir="ltr"

            />

          </div>



          {formData.companyId === 'isracard' && (

            <div>

              <label className="block text-sm font-medium text-gray-700 mb-1">6 ספרות אחרונות של הכרטיס</label>

              <input type="text" required maxLength="6"

                value={formData.extra} onChange={e => setFormData({...formData, extra: e.target.value})}

                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"

              />

            </div>

          )}



          {formData.companyId === 'discount' && (

            <div>

              <label className="block text-sm font-medium text-gray-700 mb-1">קוד מזהה (num)</label>

              <input type="text" required

                value={formData.extra} onChange={e => setFormData({...formData, extra: e.target.value})}

                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"

              />

            </div>

          )}



          {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-100">{error}</div>}



          <button

            type="submit" disabled={loading}

            className={`w-full py-4 rounded-xl font-bold text-white transition-all mt-6 shadow-md ${loading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}

          >

            {loading ? (

              <span className="flex items-center justify-center gap-2">

                <RefreshCw size={20} className="animate-spin" />

                מתחבר לבנק (עשוי לקחת כדקה)...

              </span>

            ) : 'התחבר וסנכרן נתונים'}

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