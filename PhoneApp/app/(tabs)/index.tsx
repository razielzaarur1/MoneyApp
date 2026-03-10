// ==========================================
// PART 1: IMPORTS & CONFIG
// ==========================================
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, TextInput, ActivityIndicator, Alert, LayoutAnimation, UIManager, Platform, StatusBar, Modal } from 'react-native';
import * as Icons from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';
import { LinearGradient } from 'expo-linear-gradient';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const API_URL = 'http://100.106.124.20:3001';

// המרת צבעי Tailwind לצבעים אמיתיים לאפליקציה
const getHexColor = (colorStr, isDark) => {
  if (!colorStr) return '#3b82f6';
  if (colorStr.includes('emerald')) return isDark ? '#34d399' : '#10b981';
  if (colorStr.includes('indigo')) return isDark ? '#818cf8' : '#6366f1';
  if (colorStr.includes('pink')) return isDark ? '#f472b6' : '#ec4899';
  if (colorStr.includes('orange')) return isDark ? '#fb923c' : '#f97316';
  if (colorStr.includes('rose')) return isDark ? '#fb7185' : '#f43f5e';
  if (colorStr.includes('teal')) return isDark ? '#2dd4bf' : '#14b8a6';
  if (colorStr.includes('purple')) return isDark ? '#c084fc' : '#a855f7';
  if (colorStr.includes('amber')) return isDark ? '#fbbf24' : '#f59e0b';
  if (colorStr.includes('sky')) return isDark ? '#38bdf8' : '#0ea5e9';
  if (colorStr.includes('slate')) return isDark ? '#94a3b8' : '#64748b';
  if (colorStr.includes('cyan')) return isDark ? '#22d3ee' : '#0891b2';
  if (colorStr.includes('gray')) return isDark ? '#9ca3af' : '#6b7280';
  return '#3b82f6';
};

const getCategoryMeta = (catId, rawCategories, isDark) => {
  const defaultCat = { id: 'misc_uncategorized', name: 'ללא סיווג', icon: 'MoreHorizontal', hexColor: '#64748b', type: 'expense' };
  if (!catId || !rawCategories) return { main: defaultCat, sub: null };

  const buildMeta = (cat, type) => ({
    ...cat, type, hexColor: getHexColor(cat.color, isDark)
  });

  const inc = (rawCategories.incomes || []).find(c => c.id === catId);
  if (inc) return { main: buildMeta(inc, 'income'), sub: null };

  for (const exp of (rawCategories.expenses || [])) {
    if (exp.id === catId) return { main: buildMeta(exp, 'expense'), sub: null };
    if (exp.subs) {
      const sub = exp.subs.find(s => s.id === catId);
      if (sub) return { main: buildMeta(exp, 'expense'), sub: buildMeta(sub, 'expense') };
    }
  }
  return { main: defaultCat, sub: null };
};

const formatCurrency = (amount) => `₪${Math.abs(amount).toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 2})}`;

const calculateUpcomingCharge = (acc, transactions) => {
  if (acc.type === 'bank') return acc.balance || 0;
  let sum = 0;
  const today = new Date(); today.setHours(0,0,0,0);
  transactions.forEach(tx => {
    if (tx.accountId === acc.id || tx.account === acc.id) {
      const dateStr = tx.billingDate || tx.date;
      if (dateStr) {
        const parts = dateStr.split(/[\/\-.]/);
        if (parts.length >= 3) {
          const d = new Date(parts[2], parts[1] - 1, parts[0]);
          if (tx.status === 'pending' || d >= today) sum += Math.abs(tx.amount || 0);
        }
      }
    }
  });
  return sum > Math.abs(acc.balance || 0) ? sum : Math.abs(acc.balance || 0);
};

const fixTimezone = (dateStr) => {
  if (!dateStr) return 'לאחרונה';
  try {
    let d = new Date(dateStr);
    if (isNaN(d.getTime())) d = new Date(dateStr.replace(' ', 'T') + 'Z');
    // אם גם עכשיו התאריך לא תקין, נחזיר את המחרוזת המקורית כדי למנוע "Invalid Date"
    if (isNaN(d.getTime())) return String(dateStr);
    
    d.setHours(d.getHours() + 2);
    return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) + ' (' + d.toLocaleDateString('he-IL') + ')';
  } catch (e) { return String(dateStr); }
};

// ==========================================
// SHARED COMPONENTS
// ==========================================
const DynamicIcon = ({ name, color, size }) => {
  const IconComponent = Icons[name] || Icons.Zap;
  return <IconComponent color={color} size={size} strokeWidth={2} />;
};

const MonthDropdown = ({ availableMonths, selectedMonth, setSelectedMonth, isDark }) => {
  const [open, setOpen] = useState(false);
  if (!selectedMonth) return null;
  return (
    <>
      <TouchableOpacity onPress={() => setOpen(true)} style={[styles.monthDropdownBtn, isDark ? styles.bgInputDark : styles.bgInputLight]}>
        <Icons.Calendar color="#3b82f6" size={16} />
        <Text style={[styles.monthText, isDark && styles.textWhite]}>{selectedMonth}</Text>
        <Icons.ChevronDown color={isDark ? "#94a3b8" : "#64748b"} size={16} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setOpen(false)}>
          <View style={[styles.monthDropdownMenu, isDark ? styles.bgDark : styles.bgLight]}>
            <Text style={[styles.sectionTitle, isDark && styles.textWhite, {marginBottom: 10, textAlign:'center'}]}>בחר חודש</Text>
            <ScrollView style={{maxHeight: 300}}>
              <TouchableOpacity onPress={() => { setSelectedMonth('all'); setOpen(false); }} style={styles.monthDropdownItem}>
                <Text style={[styles.monthText, selectedMonth === 'all' && {color: '#3b82f6'}, isDark && styles.textWhite]}>הכל (כל הנתונים)</Text>
              </TouchableOpacity>
              {availableMonths.map(m => (
                <TouchableOpacity key={m} onPress={() => { setSelectedMonth(m); setOpen(false); }} style={styles.monthDropdownItem}>
                  <Text style={[styles.monthText, selectedMonth === m && {color: '#3b82f6'}, isDark && styles.textWhite]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const TransactionRow = ({ tx, isDark, rawCategories, isExpanded, onToggle }) => {
  const { main, sub } = getCategoryMeta(tx.categoryId || tx.category, rawCategories, isDark);
  const isIncome = main.type === 'income';
  const iconName = sub?.icon || main.icon;

  return (
    <View style={[styles.txRow, isDark ? styles.txRowDark : styles.txRowLight]}>
      <TouchableOpacity style={styles.txRowHeader} onPress={onToggle} activeOpacity={0.7}>
        <View style={styles.txRowLeft}>
          <View style={[styles.txIconBox, { backgroundColor: isDark ? '#334155' : `${main.hexColor}20` }]}>
            <DynamicIcon name={iconName} size={18} color={main.hexColor} />
          </View>
          <View style={{ flexShrink: 1 }}>
            <View style={{flexDirection: 'row-reverse', alignItems: 'center', gap: 6}}>
              <Text style={[styles.txName, isDark && styles.textWhite]} numberOfLines={1}>{tx.description}</Text>
              {tx.linkedTransactionId && <Icons.Link size={12} color="#3b82f6" />}
              {tx.notes && <Icons.FileText size={10} color={isDark ? '#94a3b8' : '#64748b'} />}
              {tx.tags && <Icons.Tag size={10} color={isDark ? '#94a3b8' : '#64748b'} />}
            </View>
            <View style={[styles.txMeta, { flexWrap: 'wrap', gap: 4, marginTop: 2 }]}>
              <Text style={[styles.txDate, isDark && styles.textGrayDark]}>{tx.date}</Text>
              <Text style={[styles.txDot, isDark && styles.textGrayDark]}>•</Text>
              {/* מציג תת קטגוריה אם ישנה, אחרת מציג ראשית */}
              <View style={[styles.txBadge, isDark && styles.txBadgeDark]}>
                <Text style={[styles.txBadgeText, isDark && styles.textGrayDark]}>{sub ? sub.name : main.name}</Text>
              </View>
              
              {/* הצגת תנועה זמנית אם סגור */}
              {tx.status === 'pending' && (
                <View style={[styles.txBadge, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
                  <Text style={[styles.txBadgeText, { color: isDark ? '#fbbf24' : '#d97706' }]}>זמנית</Text>
                </View>
              )}

              {/* הצגת תשלומים אם קיימים */}
              {(tx.installments || (tx.currentInstallment && tx.totalInstallments)) && (
                <View style={[styles.txBadge, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
                  <Text style={[styles.txBadgeText, { color: isDark ? '#60a5fa' : '#2563eb' }]}>
                    {tx.installments ? tx.installments : `תשלום ${tx.currentInstallment} מתוך ${tx.totalInstallments}`}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
        <View style={styles.txRowRight}>
          <Text style={[styles.txAmount, isIncome ? styles.textIncome : (isDark ? styles.textWhite : styles.textExpense)]} dir="ltr">{isIncome ? '+' : ''}{tx.amount.toLocaleString()} ₪</Text>
          {isExpanded ? <Icons.ChevronUp size={16} color={isDark ? '#94a3b8' : '#cbd5e1'} /> : <Icons.ChevronDown size={16} color={isDark ? '#94a3b8' : '#cbd5e1'} />}
        </View>
      </TouchableOpacity>

      {isExpanded && (
        <View style={[styles.txDetails, isDark ? styles.txDetailsDark : styles.txDetailsLight]}>
          <View style={styles.txDetailsTop}>
            {/* במידה ויש תנועה מקושרת נציג זאת בתיבה בולטת */}
            {tx.linkedTransactionId && (
              <View style={[styles.txDetailBlock, {width: '100%', flexDirection: 'row-reverse', alignItems: 'center', gap: 8, backgroundColor: isDark ? 'rgba(59,130,246,0.1)' : '#eff6ff', padding: 8, borderRadius: 8, marginBottom: 12}]}>
                <Icons.Link size={16} color="#3b82f6" />
                <Text style={[styles.txDetailLabel, isDark && styles.textGrayDark, {marginBottom: 0, fontSize: 12}]}>תנועה קשורה (למשל החזר על הוצאה):</Text>
                <Text style={[styles.txDetailValue, {color: '#3b82f6', fontWeight: 'bold'}]}>#{tx.linkedTransactionId}</Text>
              </View>
            )}
            <View style={styles.txDetailBlock}>
              <Text style={[styles.txDetailLabel, isDark && styles.textGrayDark]}>תאריך עסקה</Text>
              <Text style={[styles.txDetailValue, isDark && styles.textWhite]}>{tx.date}</Text>
            </View>
            <View style={styles.txDetailBlock}>
              <Text style={[styles.txDetailLabel, isDark && styles.textGrayDark]}>קטגוריה מלאה</Text>
              <Text style={[styles.txDetailValue, isDark && styles.textWhite]}>{main.name} {sub ? `> ${sub.name}` : ''}</Text>
            </View>
            {tx.notes && (
              <View style={[styles.txDetailBlock, {width: '100%'}]}>
                <Text style={[styles.txDetailLabel, isDark && styles.textGrayDark]}>הערות</Text>
                <Text style={[styles.txDetailValue, isDark && styles.textWhite]}>{tx.notes}</Text>
              </View>
            )}
            {tx.tags && (
              <View style={[styles.txDetailBlock, {width: '100%'}]}>
                <Text style={[styles.txDetailLabel, isDark && styles.textGrayDark]}>תגיות</Text>
                <Text style={[styles.txDetailValue, isDark && styles.textWhite]}>{tx.tags}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity style={[styles.editBtn, isDark ? styles.editBtnDark : styles.editBtnLight, {marginTop: 12}]} onPress={() => Alert.alert("בקרוב", "עריכת תנועה תפתח כאן")}>
             <Icons.Edit2 size={12} color={isDark ? '#fff' : '#3b82f6'} />
             <Text style={[styles.editBtnText, isDark && styles.textWhite, {color: '#3b82f6'}]}>ערוך תנועה</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

// ==========================================
// SCREENS
// ==========================================
const DashboardScreen = ({ isDark, navigateTo, filteredTxs, totalIncome, totalExpense, balance, availableMonths, selectedMonth, setSelectedMonth, rawCategories }) => {
  const [expandedTxId, setExpandedTxId] = useState(null);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent} showsVerticalScrollIndicator={false}>
      <View style={styles.dashHeader}>
        <View><Text style={[styles.dashTitle, isDark && styles.textWhite]}>סקירה כללית</Text><Text style={[styles.dashSubtitle, isDark && styles.textGrayDark]}>התקציב שלך מעודכן.</Text></View>
        <MonthDropdown availableMonths={availableMonths} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} isDark={isDark} />
      </View>

      <LinearGradient colors={['#2563eb', '#4338ca']} style={styles.balanceCard} start={{x: 0, y: 0}} end={{x: 1, y: 1}}>
        <View style={styles.cardGlow1} /><View style={styles.cardGlow2} />
        <Text style={styles.cardLabel}>מאזן חודשי פנוי</Text>
        <Text style={styles.cardBalance} dir="ltr">{balance < 0 ? '-' : ''}{formatCurrency(balance)}</Text>
        
        <View style={styles.cardStatsRow}>
          <View style={styles.cardStatBox}>
            <View style={styles.statLabelRow}><Icons.TrendingUp size={14} color="#6ee7b7" /><Text style={styles.statLabelText}>הכנסות</Text></View>
            <Text style={styles.statValue} dir="ltr">{formatCurrency(totalIncome)}</Text>
          </View>
          <View style={styles.cardStatBox}>
            <View style={styles.statLabelRow}><Icons.TrendingDown size={14} color="#fda4af" /><Text style={styles.statLabelText}>הוצאות</Text></View>
            <Text style={styles.statValue} dir="ltr">{formatCurrency(totalExpense)}</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, isDark && styles.textWhite]}>תנועות אחרונות</Text>
          <TouchableOpacity onPress={() => navigateTo('transactions')}><Text style={styles.sectionLink}>הצג הכל</Text></TouchableOpacity>
        </View>
        {filteredTxs.length === 0 ? <Text style={styles.emptyText}>אין תנועות</Text> : filteredTxs.slice(0, 4).map(tx => (
          <TransactionRow 
            key={tx.id} 
            tx={tx} 
            isDark={isDark} 
            rawCategories={rawCategories} 
            isExpanded={expandedTxId === tx.id}
            onToggle={() => {
               LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
               setExpandedTxId(expandedTxId === tx.id ? null : tx.id);
            }}
          />
        ))}
      </View>
    </ScrollView>
  );
};

const TransactionsScreen = ({ isDark, filteredTxs, availableMonths, selectedMonth, setSelectedMonth, rawCategories }) => {
  const [filter, setFilter] = useState('all');
  const [expandedTxId, setExpandedTxId] = useState(null);

  const filtered = filteredTxs.filter(tx => {
    const { main } = getCategoryMeta(tx.categoryId || tx.category, rawCategories, isDark);
    if (filter === 'all') return true;
    if (filter === 'income') return main.type === 'income';
    if (filter === 'expense') return main.type === 'expense';
    return true;
  });

  return (
    <View style={styles.screen}>
      <View style={styles.dashHeader}>
        <Text style={[styles.pageTitle, isDark && styles.textWhite, {marginBottom:0}]}>כל התנועות</Text>
        <MonthDropdown availableMonths={availableMonths} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} isDark={isDark} />
      </View>
      
      <View style={[styles.filterBar, isDark ? styles.filterBarDark : styles.filterBarLight]}>
        {[{id: 'all', name:'הכל'}, {id: 'expense', name:'הוצאות'}, {id: 'income', name:'הכנסות'}].map(f => (
          <TouchableOpacity key={f.id} onPress={() => setFilter(f.id)} style={[styles.filterBtn, filter === f.id && styles.filterBtnActive]}>
            <Text style={[styles.filterBtnText, filter === f.id ? styles.filterBtnTextActive : (isDark ? styles.textGrayDark : styles.textGrayLight)]}>{f.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.screenContent}>
        {filtered.length === 0 && <Text style={styles.emptyText}>לא נמצאו תנועות</Text>}
        {filtered.map(tx => (
          <TransactionRow 
            key={tx.id} 
            tx={tx} 
            isDark={isDark} 
            rawCategories={rawCategories}
            isExpanded={expandedTxId === tx.id}
            onToggle={() => {
               LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
               setExpandedTxId(expandedTxId === tx.id ? null : tx.id);
            }}
          />
        ))}
      </ScrollView>
    </View>
  );
};

const ReportsScreen = ({ isDark, filteredTxs, prevMonthTxs, availableMonths, selectedMonth, setSelectedMonth, rawCategories }) => {
  const { catData, totalExp, totalInc } = useMemo(() => {
    const totalsExp = {};
    let tInc = 0;
    filteredTxs.forEach(tx => {
      const { main } = getCategoryMeta(tx.categoryId || tx.category, rawCategories, isDark);
      if (main.type === 'expense') {
        totalsExp[main.id] = (totalsExp[main.id] || 0) + Math.abs(tx.amount || 0);
      } else {
        tInc += Math.abs(tx.amount || 0);
      }
    });
    const sumExp = Object.values(totalsExp).reduce((a,b)=>a+b, 0);
    const mapped = Object.keys(totalsExp).map(catId => {
      const { main } = getCategoryMeta(catId, rawCategories, isDark);
      return { 
        name: main.name, amount: totalsExp[catId], icon: main.icon, hexColor: main.hexColor,
        percent: sumExp ? Math.round((totalsExp[catId]/sumExp)*100) : 0 
      };
    }).sort((a,b) => b.amount - a.amount);
    return { catData: mapped, totalExp: sumExp, totalInc: tInc };
  }, [filteredTxs, rawCategories, isDark]);

  const { prevExp, prevInc } = useMemo(() => {
    let pE = 0, pI = 0;
    prevMonthTxs.forEach(tx => {
      const { main } = getCategoryMeta(tx.categoryId || tx.category, rawCategories, isDark);
      if(main.type === 'expense') pE += Math.abs(tx.amount || 0);
      else pI += Math.abs(tx.amount || 0);
    });
    return { prevExp: pE, prevInc: pI };
  }, [prevMonthTxs, rawCategories, isDark]);

  const expDiff = prevExp ? ((totalExp - prevExp) / prevExp) * 100 : 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent}>
      <View style={styles.dashHeader}>
        <View>
          <Text style={[styles.pageTitle, isDark && styles.textWhite, {marginBottom:0}]}>דוח חודשי מסכם</Text>
          <TouchableOpacity style={{marginTop: 4, flexDirection: 'row-reverse', alignItems: 'center', gap: 4}}>
            <Icons.Edit2 size={12} color="#3b82f6" /><Text style={{color: '#3b82f6', fontSize: 12, fontWeight: 'bold'}}>ערוך תקציב מתוכנן</Text>
          </TouchableOpacity>
        </View>
        <MonthDropdown availableMonths={availableMonths} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} isDark={isDark} />
      </View>

      <View style={[styles.accCard, isDark ? styles.accCardDark : styles.accCardLight]}>
        <Text style={[styles.sectionTitle, isDark && styles.textWhite, {marginBottom: 20}]}>הוצאות לפי קטגוריה</Text>
        {catData.length === 0 && <Text style={styles.emptyText}>אין הוצאות בחודש זה</Text>}
        {catData.map((cat, i) => {
           return (
             <View key={i} style={{marginBottom: 16}}>
               <View style={{flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 6, alignItems:'center'}}>
                 <View style={{flexDirection: 'row-reverse', alignItems:'center', gap: 8}}>
                   <View style={{padding: 6, borderRadius: 8, backgroundColor: isDark ? '#334155' : `${cat.hexColor}20`}}><DynamicIcon name={cat.icon} size={14} color={cat.hexColor}/></View>
                   <Text style={{color: isDark ? '#f8fafc' : '#1e293b', fontSize: 14, fontWeight:'bold'}}>{cat.name}</Text>
                   <Text style={{color: isDark ? '#94a3b8' : '#64748b', fontSize: 12}}>({cat.percent}%)</Text>
                 </View>
                 <Text style={{color: isDark ? '#fff' : '#1e293b', fontWeight: 'bold', fontSize: 14}} dir="ltr">₪ {cat.amount.toLocaleString()}</Text>
               </View>
               <View style={{height: 8, backgroundColor: isDark ? '#334155' : '#f1f5f9', borderRadius: 10, width: '100%', overflow: 'hidden'}}>
                 <View style={{height: '100%', backgroundColor: cat.hexColor, width: `${cat.percent}%`, borderRadius: 10}} />
               </View>
             </View>
           )
        })}
      </View>

      <View style={[styles.accCard, isDark ? styles.accCardDark : styles.accCardLight]}>
        <Text style={[styles.sectionTitle, isDark && styles.textWhite, {marginBottom: 16}]}>השוואה לחודש קודם</Text>
        <View style={{flexDirection: 'row-reverse', gap: 12}}>
          <View style={{flex: 1, padding: 12, borderRadius: 16, backgroundColor: isDark ? 'rgba(51,65,85,0.5)' : '#f8fafc'}}>
            <Text style={{fontSize: 12, color: isDark ? '#94a3b8' : '#64748b', textAlign: 'right'}}>הוצאות</Text>
            <Text style={{fontSize: 18, fontWeight: 'bold', color: isDark ? '#fff' : '#1e293b', textAlign: 'right'}} dir="ltr">{formatCurrency(totalExp)}</Text>
            <View style={{flexDirection: 'row-reverse', alignItems: 'center', gap: 4, marginTop: 6}}>
              {expDiff <= 0 ? <Icons.TrendingDown size={14} color="#10b981" /> : <Icons.TrendingUp size={14} color="#ef4444" />}
              <Text style={{fontSize: 10, color: expDiff <= 0 ? '#10b981' : '#ef4444', fontWeight: 'bold'}}>{Math.abs(expDiff).toFixed(1)}% {expDiff <= 0 ? 'פחות' : 'יותר'}</Text>
            </View>
          </View>
          <View style={{flex: 1, padding: 12, borderRadius: 16, backgroundColor: isDark ? 'rgba(51,65,85,0.5)' : '#f8fafc'}}>
            <Text style={{fontSize: 12, color: isDark ? '#94a3b8' : '#64748b', textAlign: 'right'}}>הכנסות</Text>
            <Text style={{fontSize: 18, fontWeight: 'bold', color: isDark ? '#fff' : '#1e293b', textAlign: 'right'}} dir="ltr">{formatCurrency(totalInc)}</Text>
            <View style={{flexDirection: 'row-reverse', alignItems: 'center', gap: 4, marginTop: 6}}>
              <Text style={{fontSize: 10, color: '#3b82f6', fontWeight: 'bold'}}>חודש קודם: {formatCurrency(prevInc)}</Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const AccountsScreen = ({ isDark, accounts, onSyncSingle, transactions, setAddModalVisible, onDeleteAccount, setEditAccountModal }) => {
  const [syncingId, setSyncingId] = useState(null);

  const triggerLocalSync = async (account) => { 
    setSyncingId(account.id); 
    await onSyncSingle(account.id, account.companyId); 
    setSyncingId(null); 
  };

  const renderAccount = (acc, isBank) => {
    const upcoming = calculateUpcomingCharge(acc, transactions);
    const isSyncing = syncingId === acc.id;
    return (
      <View key={acc.id} style={[styles.accCard, isDark ? styles.accCardDark : styles.accCardLight]}>
        <View style={[styles.accIndicator, {backgroundColor: acc.balance < 0 && isBank ? '#ef4444' : '#10b981'}]} />
        <View style={styles.accTop}>
          <View style={[styles.txIconBox, isDark ? {backgroundColor: '#334155'} : {backgroundColor: isBank ? '#eff6ff' : '#fef2f2'}]}>
            {isBank ? <Icons.Landmark size={18} color="#3b82f6" /> : <Icons.CreditCard size={18} color="#ef4444" />}
          </View>
          <View style={styles.accActions}>
            <TouchableOpacity onPress={() => triggerLocalSync(acc)} disabled={isSyncing} style={[styles.accActionBtn, isDark ? styles.accActionBtnDark : styles.accActionBtnLight]}>
              {isSyncing ? <ActivityIndicator size="small" color="#3b82f6"/> : <Icons.RefreshCw size={14} color={isDark ? '#60a5fa' : '#2563eb'} />}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setEditAccountModal(acc)} style={[styles.accActionBtn, isDark ? styles.accActionBtnDark : styles.accActionBtnLight]}>
              <Icons.Edit2 size={14} color={isDark ? '#94a3b8' : '#64748b'} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onDeleteAccount(acc.id)} style={[styles.accActionBtn, isDark ? styles.accActionBtnDangerDark : styles.accActionBtnDangerLight]}>
              <Icons.Trash2 size={14} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={[styles.accName, isDark && styles.textWhite]}>{acc.name}</Text>
        <View style={styles.accSyncInfo}>
          <Text style={[styles.txDate, isDark && styles.textGrayDark]}>עודכן: {fixTimezone(acc.lastSync)}</Text>
        </View>
        <View style={[styles.accBottom, isDark ? styles.borderTopDark : styles.borderTopLight]}>
          <Text style={[styles.accType, isDark && styles.textGrayDark]}>{isBank ? 'יתרה בעו"ש' : 'חיוב קרוב'}</Text>
          <Text style={[styles.accBalance, isDark && styles.textWhite, !isBank && {color: '#ef4444'}]} dir="ltr">{formatCurrency(isBank ? acc.balance : upcoming)}</Text>
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent}>
      <View style={styles.dashHeader}>
        <Text style={[styles.pageTitle, isDark && styles.textWhite, {marginBottom:0}]}>החשבונות שלי</Text>
        <TouchableOpacity onPress={() => setAddModalVisible(true)} style={[styles.syncBtn]}>
          <Icons.Plus size={14} color="#fff" />
          <Text style={styles.syncBtnText}>הוסף מוסד</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.sectionTitle, isDark && styles.textWhite, {marginBottom: 12}]}>בנקים</Text>
      {accounts.filter(a => a.type === 'bank').map(a => renderAccount(a, true))}
      {accounts.filter(a => a.type === 'bank').length === 0 && <Text style={styles.emptyText}>אין בנקים מחוברים</Text>}

      <Text style={[styles.sectionTitle, isDark && styles.textWhite, {marginBottom: 12, marginTop: 12}]}>כרטיסי אשראי</Text>
      {accounts.filter(a => a.type === 'credit').map(a => renderAccount(a, false))}
      {accounts.filter(a => a.type === 'credit').length === 0 && <Text style={styles.emptyText}>אין אשראי מחובר</Text>}
    </ScrollView>
  );
};

const SettingsScreen = ({ isDark, setIsDark, settings, updateSetting, onLogout, onDeleteUser }) => {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent}>
      <Text style={[styles.pageTitle, isDark && styles.textWhite]}>הגדרות מערכת</Text>

      <View style={[styles.accCard, isDark ? styles.accCardDark : styles.accCardLight, {padding:0, overflow:'hidden'}]}>
        <View style={styles.settingRow}>
          <Text style={[styles.billName, isDark && styles.textWhite]}>מצב תצוגה (אפל/בהיר)</Text>
          <TouchableOpacity onPress={() => setIsDark(!isDark)} style={{padding: 8, backgroundColor: isDark ? '#3730a3' : '#fef3c7', borderRadius: 20}}>
            {isDark ? <Icons.Moon size={20} color="#818cf8"/> : <Icons.Sun size={20} color="#d97706"/>}
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.accCard, isDark ? styles.accCardDark : styles.accCardLight]}>
        <Text style={[styles.sectionTitle, isDark && styles.textWhite, {marginBottom: 16}]}>חיבור לטלגרם</Text>
        <Text style={[styles.txDetailLabel, isDark && styles.textGrayDark]}>מזהה צ'אט לקבלת התראות (Chat ID)</Text>
        <TextInput style={[styles.input, isDark ? styles.inputDark : styles.inputLight]} value={settings?.telegram_chat_id || ''} onChangeText={(v) => updateSetting('telegram_chat_id', v)} keyboardType="numeric" placeholder="12345678" placeholderTextColor={isDark ? '#64748b' : '#94a3b8'} />
      </View>

      <View style={[styles.accCard, isDark ? styles.accCardDark : styles.accCardLight]}>
        <Text style={[styles.sectionTitle, isDark && styles.textWhite, {marginBottom: 16}]}>הגדרות סנכרון אוטומטי</Text>
        
        <Text style={[styles.txDetailLabel, isDark && styles.textGrayDark, {marginBottom: 8}]}>תחילת חודש תקציבי</Text>
        <View style={{flexDirection: 'row-reverse', gap: 8, marginBottom: 20}}>
          {['1', '10', '15'].map(d => (
            <TouchableOpacity key={d} onPress={() => updateSetting('billing_date', d)} style={[styles.filterBtn, {borderWidth: 1, borderColor: isDark ? '#334155' : '#e2e8f0'}, settings?.billing_date === d && styles.filterBtnActive]}>
              <Text style={[styles.filterBtnText, settings?.billing_date === d ? styles.filterBtnTextActive : (isDark ? styles.textWhite : styles.textGrayLight)]}>{d} לחודש</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.txDetailLabel, isDark && styles.textGrayDark, {marginBottom: 8}]}>זמן סריקה לאחור (ברירת מחדל)</Text>
        <View style={{flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8}}>
          {[{v:'1', l:'חודש'}, {v:'6', l:'חצי שנה'}, {v:'12', l:'שנה'}, {v:'24', l:'שנתיים'}, {v:'48', l:'4 שנים'}].map(item => (
            <TouchableOpacity key={item.v} onPress={() => updateSetting('scrape_duration', item.v)} style={[styles.filterBtn, {minWidth: '30%', borderWidth: 1, borderColor: isDark ? '#334155' : '#e2e8f0'}, settings?.scrape_duration === item.v && styles.filterBtnActive]}>
              <Text style={[styles.filterBtnText, settings?.scrape_duration === item.v ? styles.filterBtnTextActive : (isDark ? styles.textWhite : styles.textGrayLight)]}>{item.l}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={[styles.accCard, isDark ? styles.accCardDark : styles.accCardLight]}>
        <TouchableOpacity style={[styles.settingRow, {padding: 0, paddingVertical: 12, borderBottomWidth: 1, borderColor: isDark ? '#334155' : '#f1f5f9'}]} onPress={() => Alert.alert('בקרוב', 'שינוי סיסמה יתווסף בהמשך')}>
          <Text style={{color: isDark ? '#fff' : '#1e293b', fontWeight: 'bold'}}>שינוי סיסמת משתמש</Text>
          <Icons.Lock size={18} color="#64748b" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.settingRow, {padding: 0, paddingVertical: 12, borderBottomWidth: 1, borderColor: isDark ? '#334155' : '#f1f5f9'}]} onPress={onLogout}>
          <Text style={{color: '#64748b', fontWeight: 'bold'}}>התנתק מהמערכת</Text>
          <Icons.LogOut size={18} color="#64748b" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.settingRow, {padding: 0, paddingVertical: 12}]} onPress={onDeleteUser}>
          <Text style={{color: '#ef4444', fontWeight: 'bold'}}>מחק חשבון ונתונים לצמיתות</Text>
          <Icons.UserX size={18} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

// ==========================================
// MAIN APP WRAPPER
// ==========================================
function MainApp({ token, onLogout }) {
  const [activeTab, setActiveTab] = useState('home');
  const [isDark, setIsDark] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [rawCategories, setRawCategories] = useState({});
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState('');
  
  const [addAccountModal, setAddAccountModal] = useState(false);
  const [editAccountModal, setEditAccountModal] = useState(null);

  const fetchData = async () => {
    try {
      const response = await fetch(`${API_URL}/api/data`, { headers: { 'Authorization': `Bearer ${token}`, 'x-app-source': 'mobile' } });
      const data = await response.json();
      if(data.transactions) setTransactions(data.transactions);
      if(data.accounts) setAccounts(data.accounts);
      if(data.settings) setSettings(data.settings);
      if(data.rawCategories) setRawCategories(data.rawCategories);
    } catch (e) { Alert.alert('שגיאה', 'משיכת נתונים נכשלה'); } 
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const updateSetting = async (key, val) => {
    setSettings(prev => ({...prev, [key]: val}));
    try { await fetch(`${API_URL}/api/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'x-app-source': 'mobile' }, body: JSON.stringify({ settings: { [key]: val } }) }); } catch(e){}
  };

  const availableMonths = useMemo(() => {
    if (transactions.length === 0) return [];
    const months = new Set(transactions.map(t => {
      if(!t.date) return null;
      const parts = t.date.split(/[\/\-.]/);
      return parts.length >= 2 ? `${parts[1]}/${parts[2] || new Date().getFullYear()}` : null;
    }).filter(Boolean));
    const sorted = Array.from(months).sort((a, b) => {
      const [mA, yA] = a.split('/'); const [mB, yB] = b.split('/');
      return new Date(yB, mB - 1) - new Date(yA, mA - 1);
    });
    if (!selectedMonth && sorted.length > 0) setSelectedMonth(sorted[0]);
    return sorted;
  }, [transactions]);

  const filteredTxs = useMemo(() => {
    if (selectedMonth === 'all') return transactions;
    return transactions.filter(t => {
      if(!t.date) return false;
      const parts = t.date.split(/[\/\-.]/);
      return `${parts[1]}/${parts[2] || new Date().getFullYear()}` === selectedMonth;
    });
  }, [transactions, selectedMonth]);

  const prevMonthTxs = useMemo(() => {
    if(!selectedMonth || selectedMonth === 'all') return [];
    const [m, y] = selectedMonth.split('/');
    let pM = parseInt(m) - 1, pY = parseInt(y);
    if(pM === 0) { pM = 12; pY -= 1; }
    const target = `${String(pM).padStart(2,'0')}/${pY}`;
    return transactions.filter(t => t.date && t.date.includes(target));
  }, [transactions, selectedMonth]);

  const { totalIncome, totalExpense, balance } = useMemo(() => {
    return filteredTxs.reduce((acc, curr) => {
      const { main } = getCategoryMeta(curr.categoryId || curr.category, rawCategories, isDark);
      if (main.type === 'income') { acc.totalIncome += Math.abs(curr.amount||0); acc.balance += (curr.amount||0); } 
      else { acc.totalExpense += Math.abs(curr.amount||0); acc.balance += (curr.amount||0); }
      return acc;
    }, { totalIncome: 0, totalExpense: 0, balance: 0 });
  }, [filteredTxs, rawCategories, isDark]);

  // APIs Functions
  const handleSyncSingle = async (accountId, companyId) => {
    try {
      const res = await fetch(`${API_URL}/api/sync`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'x-app-source': 'mobile' }, body: JSON.stringify({ accountId, savedCompanyId: companyId, companyId }) });
      const data = await res.json();
      if (data.success) { Alert.alert('הצלחה', 'סונכרן בהצלחה'); fetchData(); } else Alert.alert('שגיאה', data.errorMessage || 'סנכרון נכשל');
    } catch(e) { Alert.alert('שגיאה', 'סנכרון נכשל'); }
  };

  const handleAddAccount = async (companyId, username, password, customDuration) => {
    try {
      await fetch(`${API_URL}/api/credentials`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'x-app-source': 'mobile' }, body: JSON.stringify({ companyId, username, password, scrapeDuration: customDuration || null }) }); 
      const res = await fetch(`${API_URL}/api/sync`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'x-app-source': 'mobile' }, body: JSON.stringify({ companyId, credentials: { id: username, username, password }, customScrapeDuration: customDuration || null }) }); 
      const data = await res.json(); 
      if (data.success) { Alert.alert('הצלחה', 'מוסד נוסף וסונכרן!'); fetchData(); } else Alert.alert('שגיאה', data.errorMessage || 'נכשל');
    } catch(e) { Alert.alert('שגיאת רשת', 'לא הצלחנו להוסיף'); }
    setAddAccountModal(false);
  };

  const handleEditAccount = async (id, name, duration) => {
    try {
      await fetch(`${API_URL}/api/update-account`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'x-app-source': 'mobile' }, body: JSON.stringify({ id, name, scrapeDuration: duration }) });
      fetchData();
    } catch(e) { Alert.alert('שגיאה', 'לא ניתן לעדכן את שם החשבון'); }
    setEditAccountModal(null);
  };

  const handleDeleteAccount = async (id) => {
    Alert.alert('מחיקת חשבון', 'האם אתה בטוח? כל התנועות שלו ימחקו.', [
      { text: 'ביטול', style: 'cancel' },
      { text: 'מחק', style: 'destructive', onPress: async () => {
         try { await fetch(`${API_URL}/api/account/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}`, 'x-app-source': 'mobile' }}); fetchData(); } catch(e){}
      }}
    ]);
  };

  const handleDeleteUser = async () => {
    Alert.alert('אזהרה חמורה', 'מחיקת המשתמש תמחק את כל המידע לצמיתות!', [
      { text: 'ביטול', style: 'cancel' },
      { text: 'מחק לצמיתות', style: 'destructive', onPress: async () => {
         try { await fetch(`${API_URL}/api/auth/delete-user`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}`, 'x-app-source': 'mobile' }}); SecureStore.deleteItemAsync('app_token'); onLogout(); } catch(e){}
      }}
    ]);
  };

  const renderScreen = () => {
    switch(activeTab) {
      case 'home': return <DashboardScreen isDark={isDark} navigateTo={setActiveTab} filteredTxs={filteredTxs} totalIncome={totalIncome} totalExpense={totalExpense} balance={balance} availableMonths={availableMonths} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} rawCategories={rawCategories}/>;
      case 'transactions': return <TransactionsScreen isDark={isDark} filteredTxs={filteredTxs} availableMonths={availableMonths} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} rawCategories={rawCategories}/>;
      case 'reports': return <ReportsScreen isDark={isDark} filteredTxs={filteredTxs} prevMonthTxs={prevMonthTxs} availableMonths={availableMonths} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} rawCategories={rawCategories} />;
      case 'accounts': return <AccountsScreen isDark={isDark} accounts={accounts} transactions={transactions} onSyncSingle={handleSyncSingle} setAddModalVisible={setAddAccountModal} onDeleteAccount={handleDeleteAccount} setEditAccountModal={setEditAccountModal} />;
      case 'settings': return <SettingsScreen isDark={isDark} setIsDark={setIsDark} settings={settings} updateSetting={updateSetting} onLogout={() => {SecureStore.deleteItemAsync('app_token'); onLogout();}} onDeleteUser={handleDeleteUser} />;
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, isDark ? styles.bgDark : styles.bgLight]}>
      {/* Top Bar - Press to refresh */}
      <TouchableOpacity onPress={() => {setLoading(true); fetchData();}} style={[styles.topBar, isDark ? styles.bgDark : styles.bgLight]}>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
          <View style={styles.avatar}>{loading ? <ActivityIndicator size="small" color="#fff"/> : <Text style={styles.avatarText}>K</Text>}</View>
          <Text style={[styles.appTitle, isDark && styles.textWhite]}>כיס חכם</Text>
        </View>
        <Icons.RefreshCw size={18} color={isDark ? '#cbd5e1' : '#64748b'} />
      </TouchableOpacity>
      
      <View style={styles.mainContent}>{renderScreen()}</View>
      
      <View style={[styles.bottomNav, isDark ? styles.bottomNavDark : styles.bottomNavLight]}>
        {[ { id: 'home', label: 'ראשי', icon: Icons.LayoutDashboard }, { id: 'transactions', label: 'תנועות', icon: Icons.List }, { id: 'reports', label: 'דוחות', icon: Icons.PieChart }, { id: 'accounts', label: 'חשבונות', icon: Icons.Wallet }, { id: 'settings', label: 'הגדרות', icon: Icons.Settings } ].map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity key={tab.id} onPress={() => setActiveTab(tab.id)} style={[styles.navItem, isActive && {transform: [{translateY: -4}]}]}>
              <View style={[styles.navIconBox, isActive && (isDark ? styles.navIconActiveDark : styles.navIconActiveLight)]}>
                <tab.icon size={22} color={isActive ? (isDark ? '#60a5fa' : '#2563eb') : (isDark ? '#64748b' : '#94a3b8')} strokeWidth={isActive ? 2.5 : 2} />
              </View>
              <Text style={[styles.navLabel, isActive ? (isDark ? styles.textBlueDark : styles.textBlueLight) : (isDark ? styles.textGrayDark : styles.textGrayLight)]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Add Account Modal */}
      <Modal visible={addAccountModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDark ? styles.bgDark : styles.bgLight, {marginTop: 'auto', paddingBottom: 40}]}>
             <View style={{flexDirection: 'row-reverse', justifyContent:'space-between', marginBottom: 20}}>
               <Text style={[styles.pageTitle, isDark && styles.textWhite, {marginBottom:0}]}>הוספת מוסד חדש</Text>
               <TouchableOpacity onPress={() => setAddAccountModal(false)}><Icons.X color={isDark ? '#fff' : '#000'} /></TouchableOpacity>
             </View>
             <ScrollView>
                <AddAccountForm isDark={isDark} onSave={handleAddAccount} defaultScrape={settings?.scrape_duration || '1'} />
             </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Account Modal */}
      <Modal visible={!!editAccountModal} transparent animationType="fade">
        {editAccountModal && (
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, isDark ? styles.bgDark : styles.bgLight]}>
              <Text style={[styles.dashTitle, isDark && styles.textWhite, {marginBottom: 16}]}>עריכת שם חשבון</Text>
              <EditAccountForm account={editAccountModal} isDark={isDark} onSave={handleEditAccount} onCancel={() => setEditAccountModal(null)} />
            </View>
          </View>
        )}
      </Modal>
    </SafeAreaView>
  );
}

// קומפוננטת עזר לטופס הוספת חשבון בתוך המודאל (ללא תגיות HTML)
const AddAccountForm = ({ isDark, onSave, defaultScrape }) => {
  const [companyId, setCompanyId] = useState('leumi');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [customDuration, setCustomDuration] = useState('');
  const [loading, setLoading] = useState(false);

  const INST_OPTIONS = [
    { id: 'leumi', label: 'לאומי' }, { id: 'hapoalim', label: 'פועלים' }, { id: 'discount', label: 'דיסקונט' }, { id: 'mizrahi', label: 'מזרחי' },
    { id: 'isracard', label: 'ישראכרט' }, { id: 'max', label: 'מקס' }, { id: 'visa-cal', label: 'כאל' }
  ];

  return (
    <View style={{spaceY: 16}}>
       <Text style={[styles.txDetailLabel, isDark && styles.textGrayDark, {marginBottom: 8}]}>בחר מוסד פיננסי</Text>
       <View style={{flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginBottom: 16}}>
          {INST_OPTIONS.map(inst => (
            <TouchableOpacity key={inst.id} onPress={() => setCompanyId(inst.id)} style={[styles.filterBtn, {minWidth: '22%', borderWidth: 1, borderColor: isDark ? '#334155' : '#e2e8f0'}, companyId === inst.id && styles.filterBtnActive]}>
              <Text style={[styles.filterBtnText, companyId === inst.id ? styles.filterBtnTextActive : (isDark ? styles.textWhite : styles.textGrayLight), {fontSize: 12}]}>{inst.label}</Text>
            </TouchableOpacity>
          ))}
       </View>
       
       <Text style={[styles.txDetailLabel, isDark && styles.textGrayDark]}>שם משתמש / ת.ז</Text>
       <TextInput style={[styles.input, isDark ? styles.inputDark : styles.inputLight]} value={username} onChangeText={setUsername} placeholderTextColor={isDark ? '#64748b' : '#94a3b8'} />
       
       <Text style={[styles.txDetailLabel, isDark && styles.textGrayDark]}>סיסמה</Text>
       <TextInput style={[styles.input, isDark ? styles.inputDark : styles.inputLight, {textAlign: 'left'}]} value={password} onChangeText={setPassword} secureTextEntry placeholderTextColor={isDark ? '#64748b' : '#94a3b8'} dir="ltr" />
       
       <Text style={[styles.txDetailLabel, isDark && styles.textGrayDark, {marginBottom: 8}]}>זמן סריקה (ברירת מחדל: {defaultScrape} חודשים)</Text>
       <View style={{flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginBottom: 20}}>
          {[{v:'', l:'ברירת מחדל'}, {v:'1', l:'חודש'}, {v:'6', l:'חצי שנה'}, {v:'12', l:'שנה'}, {v:'24', l:'שנתיים'}].map(item => (
            <TouchableOpacity key={item.v} onPress={() => setCustomDuration(item.v)} style={[styles.filterBtn, {minWidth: '30%', borderWidth: 1, borderColor: isDark ? '#334155' : '#e2e8f0'}, customDuration === item.v && styles.filterBtnActive]}>
              <Text style={[styles.filterBtnText, customDuration === item.v ? styles.filterBtnTextActive : (isDark ? styles.textWhite : styles.textGrayLight), {fontSize: 12}]}>{item.l}</Text>
            </TouchableOpacity>
          ))}
       </View>

       <TouchableOpacity style={styles.loginBtn} onPress={() => {setLoading(true); onSave(companyId, username, password, customDuration);}} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginBtnText}>התחבר וסנכרן נתונים</Text>}
       </TouchableOpacity>
    </View>
  )
}

const EditAccountForm = ({ account, isDark, onSave, onCancel }) => {
  const [name, setName] = useState(account.name);
  const [duration, setDuration] = useState(account.scrapeDuration || '');
  return (
    <View>
      <TextInput style={[styles.input, isDark ? styles.inputDark : styles.inputLight]} value={name} onChangeText={setName} placeholder="שם חשבון" placeholderTextColor={isDark?'#64748b':'#94a3b8'} />
      <Text style={[styles.txDetailLabel, isDark && styles.textGrayDark, {marginBottom: 8}]}>זמן סריקה לאחור לחשבון זה</Text>
      <View style={{flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginBottom: 20}}>
          {[{v:'', l:'ברירת מחדל'}, {v:'1', l:'חודש'}, {v:'6', l:'חצי שנה'}, {v:'12', l:'שנה'}, {v:'24', l:'שנתיים'}].map(item => (
            <TouchableOpacity key={item.v} onPress={() => setDuration(item.v)} style={[styles.filterBtn, {minWidth: '30%', borderWidth: 1, borderColor: isDark ? '#334155' : '#e2e8f0'}, duration === item.v && styles.filterBtnActive]}>
              <Text style={[styles.filterBtnText, duration === item.v ? styles.filterBtnTextActive : (isDark ? styles.textWhite : styles.textGrayLight), {fontSize: 12}]}>{item.l}</Text>
            </TouchableOpacity>
          ))}
       </View>
      <View style={{flexDirection: 'row-reverse', gap: 12}}>
        <TouchableOpacity style={[styles.syncBtn, {flex: 1, justifyContent: 'center'}]} onPress={() => onSave(account.id, name, duration)}>
          <Text style={styles.syncBtnText}>שמור שינויים</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.accActionBtn, {flex: 1, justifyContent: 'center'}]} onPress={onCancel}>
          <Text style={{textAlign: 'center', color: '#64748b', fontWeight: 'bold'}}>ביטול</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function App() {
  const [token, setToken] = useState(null);
  const [isReady, setIsReady] = useState(false);
  useEffect(() => { SecureStore.getItemAsync('app_token').then(t => { if(t) setToken(t); setIsReady(true); }); }, []);
  if (!isReady) return <View style={{flex:1, justifyContent:'center'}}><ActivityIndicator size="large" color="#2563eb" /></View>;
  
  const handleAuth = async (username, password, setLoading) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-app-source': 'mobile' }, body: JSON.stringify({ username, password }) });
      const data = await res.json();
      if (data.success && data.token) { await SecureStore.setItemAsync('app_token', data.token); setToken(data.token); } 
      else Alert.alert('שגיאה', data.message || 'פרטים שגויים');
    } catch (e) { Alert.alert('שגיאת רשת', 'וודא שהשרת רץ באייפי המוגדר'); } finally { setLoading(false); }
  };

  if (!token) {
    const AuthScreen = () => {
      const [u, setU] = useState(''); const [p, setP] = useState(''); const [l, setL] = useState(false);
      return (
        <SafeAreaView style={[styles.safeArea, styles.bgDark, {justifyContent:'center', padding:24}]}>
          <View style={[styles.accCard, styles.accCardDark, {padding:30}]}>
            <Text style={[styles.dashTitle, styles.textWhite, {textAlign:'center', marginBottom:24}]}>התחברות למערכת</Text>
            <TextInput style={[styles.input, styles.inputDark]} placeholder="שם משתמש" placeholderTextColor="#64748b" value={u} onChangeText={setU} autoCapitalize="none" />
            <TextInput style={[styles.input, styles.inputDark]} placeholder="סיסמה" placeholderTextColor="#64748b" value={p} onChangeText={setP} secureTextEntry />
            <TouchableOpacity style={styles.loginBtn} onPress={()=>handleAuth(u,p,setL)} disabled={l}>{l ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginBtnText}>התחבר</Text>}</TouchableOpacity>
          </View>
        </SafeAreaView>
      )
    };
    return <AuthScreen />;
  }
  return <MainApp token={token} onLogout={() => setToken(null)} />;
}

// ==========================================
// STYLES
// ==========================================
const styles = StyleSheet.create({
  safeArea: { flex: 1, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  bgDark: { backgroundColor: '#020617' }, bgLight: { backgroundColor: '#f8fafc' },
  textWhite: { color: '#ffffff' }, textGrayDark: { color: '#94a3b8' }, textGrayLight: { color: '#64748b' },
  textBlueDark: { color: '#60a5fa' }, textBlueLight: { color: '#2563eb' }, textIncome: { color: '#10b981' }, textExpense: { color: '#1e293b' },
  
  topBar: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 15, zIndex: 10 },
  avatar: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: 'white', fontWeight: 'bold' },
  appTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  
  // הוספת מרווח תחתון מכובד שמונע הסתרה על ידי שורת הניווט (Bottom Nav)
  mainContent: { flex: 1 }, screen: { flex: 1, paddingHorizontal: 20 }, screenContent: { paddingBottom: 140, paddingTop: 10 },
  dashHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  dashTitle: { fontSize: 24, fontWeight: 'bold', color: '#1e293b', textAlign: 'right' }, dashSubtitle: { fontSize: 12, color: '#64748b', textAlign: 'right', marginTop: 4 },
  
  monthDropdownBtn: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'transparent' },
  bgInputLight: { backgroundColor: '#e2e8f0' }, bgInputDark: { backgroundColor: '#1e293b' },
  monthText: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  monthDropdownMenu: { width: '80%', padding: 20, borderRadius: 24, shadowColor: '#000', shadowOffset:{width:0,height:10}, shadowOpacity:0.3, shadowRadius:20, elevation:10 },
  monthDropdownItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#334155', alignItems: 'center' },
  
  balanceCard: { borderRadius: 32, padding: 24, overflow: 'hidden', shadowColor: '#2563eb', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10, marginBottom: 24 },
  cardGlow1: { position: 'absolute', top: -50, left: -50, width: 130, height: 130, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 100 },
  cardGlow2: { position: 'absolute', bottom: -50, right: -50, width: 130, height: 130, backgroundColor: 'rgba(49,46,129,0.4)', borderRadius: 100 },
  cardLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '500', textAlign: 'right', marginBottom: 4 },
  cardBalance: { color: 'white', fontSize: 36, fontWeight: '900', textAlign: 'right', marginBottom: 24 },
  cardStatsRow: { flexDirection: 'row-reverse', gap: 12 },
  cardStatBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  statLabelRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: 4 }, statLabelText: { color: 'white', fontSize: 10 },
  statValue: { color: 'white', fontSize: 18, fontWeight: 'bold', textAlign: 'right' },

  section: { marginBottom: 24 }, sectionHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingHorizontal: 4 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b', textAlign: 'right' }, sectionLink: { color: '#3b82f6', fontSize: 14, fontWeight: '600' },
  
  txRow: { borderRadius: 16, borderWidth: 1, marginBottom: 8, overflow: 'hidden' }, txRowLight: { backgroundColor: 'white', borderColor: '#f1f5f9' }, txRowDark: { backgroundColor: '#1e293b', borderColor: '#334155' },
  txRowHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 12 }, txRowLeft: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, flex: 1 },
  txIconBox: { padding: 8, borderRadius: 10 }, txName: { fontSize: 14, fontWeight: '600', color: '#1e293b', textAlign: 'right', marginBottom: 2 },
  txMeta: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }, txDate: { fontSize: 10, color: '#64748b' }, txDot: { fontSize: 10, color: '#cbd5e1' },
  txBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: '#f1f5f9' }, txBadgeDark: { backgroundColor: '#334155' }, txBadgeText: { fontSize: 10, color: '#475569' },
  txRowRight: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }, txAmount: { fontSize: 14, fontWeight: 'bold' },
  txDetails: { borderTopWidth: 1, padding: 12 }, txDetailsLight: { backgroundColor: '#f8fafc', borderColor: '#f1f5f9' }, txDetailsDark: { backgroundColor: 'rgba(0,0,0,0.2)', borderColor: '#334155' },
  txDetailsTop: { flexDirection: 'row-reverse', justifyContent: 'space-between', flexWrap:'wrap', gap: 10 }, txDetailBlock: { width: '48%', alignItems: 'flex-end', marginBottom: 8 },
  txDetailLabel: { fontSize: 10, color: '#64748b', marginBottom: 2 }, txDetailValue: { fontSize: 12, color: '#334155', textAlign: 'right' },
  editBtn: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12 },
  editBtnLight: { backgroundColor: '#eff6ff' }, editBtnDark: { backgroundColor: 'rgba(59,130,246,0.1)' }, editBtnText: { fontSize: 12, fontWeight: 'bold' },

  pageTitle: { fontSize: 24, fontWeight: 'bold', color: '#1e293b', textAlign: 'right', marginBottom: 16 },
  filterBar: { flexDirection: 'row-reverse', padding: 4, borderRadius: 12, marginBottom: 16 }, filterBarLight: { backgroundColor: '#e2e8f0' }, filterBarDark: { backgroundColor: '#1e293b' },
  filterBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 }, filterBtnActive: { backgroundColor: '#2563eb', shadowColor: '#000', shadowOffset: {width:0, height:1}, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 },
  filterBtnText: { fontSize: 14, fontWeight: '600' }, filterBtnTextActive: { color: 'white' },

  accCard: { padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 16, position: 'relative', overflow: 'hidden' }, accCardLight: { backgroundColor: 'white', borderColor: '#f1f5f9' }, accCardDark: { backgroundColor: '#1e293b', borderColor: '#334155' },
  accIndicator: { position: 'absolute', top: 0, right: 0, bottom: 0, width: 4 }, accTop: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  accActions: { flexDirection: 'row-reverse', gap: 6 }, accActionBtn: { padding: 6, borderRadius: 6 }, accActionBtnLight: { backgroundColor: '#f1f5f9' }, accActionBtnDark: { backgroundColor: '#334155' },
  accActionBtnDangerLight: { backgroundColor: '#fef2f2' }, accActionBtnDangerDark: { backgroundColor: 'rgba(239,68,68,0.1)' },
  accName: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', textAlign: 'right', marginBottom: 4 }, accSyncInfo: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, marginBottom: 12 },
  accBottom: { paddingTop: 12, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-end' }, accType: { fontSize: 12, color: '#64748b' }, accBalance: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },

  syncBtn: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, backgroundColor: '#2563eb', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 }, syncBtnActive: { backgroundColor: '#60a5fa' }, syncBtnText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
  settingRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  input: { padding: 16, borderRadius: 12, marginBottom: 16, textAlign: 'right' }, inputLight: { backgroundColor: '#f1f5f9', color: '#1e293b' }, inputDark: { backgroundColor: '#334155', color: '#fff' },
  loginBtn: { backgroundColor: '#2563eb', padding: 16, borderRadius: 12, alignItems: 'center' }, loginBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  emptyText: { textAlign: 'center', color: '#64748b', marginTop: 20 },
  billName: { fontSize: 14, fontWeight: '600', color: '#1e293b', textAlign: 'right' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', padding: 24, borderRadius: 24 },

  // הוספת ריווח תחתון מותאם כדי ליצור הפרדה מכפתורי הניווט של הטלפון
  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row-reverse', justifyContent: 'space-around', alignItems: 'center', paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 34 : 28, borderTopWidth: 1 },
  bottomNavLight: { backgroundColor: 'rgba(255,255,255,0.95)', borderColor: '#e2e8f0' }, bottomNavDark: { backgroundColor: 'rgba(2,6,23,0.95)', borderColor: '#1e293b' },
  navItem: { alignItems: 'center', gap: 4, width: 60 }, navIconBox: { padding: 6, borderRadius: 12 },
  navIconActiveLight: { backgroundColor: '#dbeafe' }, navIconActiveDark: { backgroundColor: 'rgba(37,99,235,0.2)' }, navLabel: { fontSize: 10, fontWeight: '600' }
});