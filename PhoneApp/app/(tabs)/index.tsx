import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Wallet, ArrowDownCircle, ArrowUpCircle, Bell, Home as HomeIcon, List, Plus, PieChart, User, CreditCard, Landmark, Briefcase, ShoppingCart, Home, Car, Coffee, MoreHorizontal } from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';

// ==========================================
// הגדרות רשת וחיבור לשרת (שנה ל-IP של המחשב שלך!)
// ==========================================
// חובה לשנות את ה-IP לכתובת ה-IPv4 המקומית של המחשב שלך
// לדוגמה: http://192.168.1.15:3000
const API_URL = 'http://100.106.124.20:3001'; 

const categoryIcons = {
  'משכורת': <Briefcase color="#10b981" size={20} />,
  'מזון': <ShoppingCart color="#f97316" size={20} />,
  'דיור': <Home color="#3b82f6" size={20} />,
  'תחבורה': <Car color="#a855f7" size={20} />,
  'פנאי': <Coffee color="#ec4899" size={20} />,
  'אחר': <MoreHorizontal color="#64748b" size={20} />
};

// ==========================================
// מסך התחברות (Login)
// ==========================================
function AuthScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if(!username || !password) return Alert.alert('שגיאה', 'אנא הזן שם משתמש וסיסמה');
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json();
      
      if (data.success && data.token) {
        await SecureStore.setItemAsync('app_token', data.token);
        onLogin(data.token);
      } else {
        Alert.alert('שגיאת התחברות', data.message || 'פרטים שגויים');
      }
    } catch (error) {
      Alert.alert('שגיאת רשת', 'לא ניתן להתחבר לשרת. ודא שה-IP נכון והשרת רץ.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { justifyContent: 'center', padding: 24 }]}>
      <View style={styles.card}>
        <Text style={[styles.greeting, { textAlign: 'center', marginBottom: 24 }]}>התחברות לכיס חכם</Text>
        <TextInput 
          style={styles.input} 
          placeholder="שם משתמש" 
          value={username} 
          onChangeText={setUsername} 
          autoCapitalize="none"
        />
        <TextInput 
          style={styles.input} 
          placeholder="סיסמה (Master Password)" 
          value={password} 
          onChangeText={setPassword} 
          secureTextEntry 
        />
        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>היכנס</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ==========================================
// האפליקציה המרכזית (לאחר התחברות)
// ==========================================
function MainApp({ token, onLogout }) {
  const [activeTab, setActiveTab] = useState('home');
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  // משיכת הנתונים מהשרת (בדיוק כמו ב-React Web)
  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/data`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if(data.transactions) setTransactions(data.transactions);
      if(data.accounts) setAccounts(data.accounts);
    } catch (error) {
      Alert.alert('שגיאה', 'לא הצלחנו למשוך נתונים מהשרת');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync('app_token');
    onLogout();
  };

  const { totalIncome, totalExpense, balance } = useMemo(() => {
    return transactions.reduce(
      (acc, curr) => {
        // בשרת שלך הכנסות הן חיוביות והוצאות הן שליליות
        const amount = curr.amount || 0;
        if (amount > 0) {
          acc.totalIncome += amount;
          acc.balance += amount;
        } else {
          acc.totalExpense += Math.abs(amount);
          acc.balance += amount; // מאחר וזה כבר במינוס
        }
        return acc;
      },
      { totalIncome: 0, totalExpense: 0, balance: 0 }
    );
  }, [transactions]);

  const formatCurrency = (amount) => `₪${Math.abs(amount).toLocaleString(undefined, {minimumFractionDigits: 0})}`;

  const renderHome = () => (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>היי! 👋</Text>
          <Text style={styles.subtitle}>התקציב שלך מעודכן.</Text>
        </View>
        <TouchableOpacity style={styles.bellButton} onPress={fetchData}>
          {loading ? <ActivityIndicator size="small" color="#475569" /> : <Bell color="#475569" size={24} />}
        </TouchableOpacity>
      </View>

      {/* Main Balance Card */}
      <View style={styles.cardMain}>
        <Text style={styles.cardSubtitle}>יתרה כוללת (עו"ש + אשראי)</Text>
        <Text style={styles.cardBalance} dir="ltr">{balance < 0 ? '-' : ''}{formatCurrency(balance)}</Text>
        
        <View style={styles.cardStats}>
          <View style={styles.statBox}>
            <View style={styles.statHeader}>
              <ArrowDownCircle color="#dbeafe" size={16} />
              <Text style={styles.statLabel}>הוצאות החודש</Text>
            </View>
            <Text style={styles.statAmount}>{formatCurrency(totalExpense)}</Text>
          </View>
          <View style={styles.statBox}>
            <View style={styles.statHeader}>
              <ArrowUpCircle color="#dbeafe" size={16} />
              <Text style={styles.statLabel}>הכנסות החודש</Text>
            </View>
            <Text style={styles.statAmount}>{formatCurrency(totalIncome)}</Text>
          </View>
        </View>
      </View>

      {/* Recent Transactions Preview */}
      <View style={styles.recentSection}>
        <View style={styles.recentHeader}>
          <TouchableOpacity onPress={() => setActiveTab('transactions')}><Text style={styles.linkText}>הכל</Text></TouchableOpacity>
          <Text style={styles.sectionTitle}>תנועות אחרונות</Text>
        </View>
        
        <View style={styles.txList}>
          {transactions.length === 0 && !loading && <Text style={{textAlign: 'center', padding: 20}}>אין תנועות</Text>}
          {transactions.slice(0, 5).map((tx) => (
            <View key={tx.id} style={styles.txItem}>
              <Text style={[styles.txAmount, { color: tx.amount > 0 ? '#059669' : '#0f172a' }]} dir="ltr">
                {tx.amount > 0 ? '+' : '-'}{formatCurrency(tx.amount)}
              </Text>
              <View style={styles.txDetails}>
                <Text style={styles.txTitle}>{tx.description}</Text>
                <Text style={styles.txDate}>{tx.date} • {tx.account || 'לא ידוע'}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );

  const renderProfile = () => (
    <ScrollView style={styles.container}>
      <Text style={[styles.greeting, {marginBottom: 20}]}>הפרופיל שלי</Text>
      <View style={styles.card}>
        <View style={{ alignItems: 'center', marginBottom: 20 }}>
          <View style={{ width: 80, height: 80, backgroundColor: '#dbeafe', borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
             <User color="#2563eb" size={40} />
          </View>
          <Text style={{ fontSize: 20, fontWeight: 'bold' }}>משתמש מחובר</Text>
        </View>
        
        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuItemText}>ניהול חשבונות וכרטיסים (API)</Text>
          <Text style={{ color: '#10b981', fontSize: 12, backgroundColor: '#d1fae5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>{accounts.length} מחוברים</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
          <Text style={[styles.menuItemText, { color: '#ef4444' }]}>התנתק מהמערכת</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {activeTab === 'home' && renderHome()}
      {activeTab === 'transactions' && <View style={styles.container}><Text style={styles.greeting}>תנועות (בפיתוח)</Text></View>}
      {activeTab === 'add' && <View style={styles.container}><Text style={styles.greeting}>הוספה (בפיתוח)</Text></View>}
      {activeTab === 'analytics' && <View style={styles.container}><Text style={styles.greeting}>ניתוח (בפיתוח)</Text></View>}
      {activeTab === 'profile' && renderProfile()}

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('profile')}>
          <User color={activeTab === 'profile' ? '#2563eb' : '#94a3b8'} size={24} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('analytics')}>
          <PieChart color={activeTab === 'analytics' ? '#2563eb' : '#94a3b8'} size={24} />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.fab} onPress={() => setActiveTab('add')}>
          <Plus color="white" size={32} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('transactions')}>
          <List color={activeTab === 'transactions' ? '#2563eb' : '#94a3b8'} size={24} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('home')}>
          <HomeIcon color={activeTab === 'home' ? '#2563eb' : '#94a3b8'} size={24} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ==========================================
// Component Root (מנהל את המעבר בין התחברות לאפליקציה)
// ==========================================
export default function App() {
  const [token, setToken] = useState(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // בודק אם יש טוקן שמור כשהאפליקציה נפתחת
    const loadToken = async () => {
      const savedToken = await SecureStore.getItemAsync('app_token');
      if (savedToken) setToken(savedToken);
      setIsReady(true);
    };
    loadToken();
  }, []);

  if (!isReady) return <SafeAreaView style={[styles.safeArea, {justifyContent: 'center'}]}><ActivityIndicator size="large" color="#2563eb" /></SafeAreaView>;

  return token ? <MainApp token={token} onLogout={() => setToken(null)} /> : <AuthScreen onLogin={setToken} />;
}

// ==========================================
// Styles
// ==========================================
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8fafc' },
  container: { padding: 16 },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  greeting: { fontSize: 24, fontWeight: 'bold', color: '#0f172a', textAlign: 'right' },
  subtitle: { fontSize: 14, color: '#64748b', textAlign: 'right' },
  bellButton: { padding: 8, backgroundColor: 'white', borderRadius: 99, borderWidth: 1, borderColor: '#f1f5f9' },
  
  cardMain: { backgroundColor: '#2563eb', borderRadius: 24, padding: 24, marginBottom: 24 },
  cardSubtitle: { color: '#dbeafe', fontSize: 14, marginBottom: 4, textAlign: 'right' },
  cardBalance: { color: 'white', fontSize: 36, fontWeight: 'bold', marginBottom: 24, textAlign: 'right' },
  cardStats: { flexDirection: 'row-reverse', gap: 16 },
  statBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 16, padding: 12 },
  statHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: 4 },
  statLabel: { color: '#dbeafe', fontSize: 12 },
  statAmount: { color: 'white', fontSize: 18, fontWeight: 'bold', textAlign: 'right' },

  card: { backgroundColor: 'white', borderRadius: 24, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  input: { backgroundColor: '#f1f5f9', padding: 16, borderRadius: 12, marginBottom: 16, textAlign: 'right' },
  button: { backgroundColor: '#2563eb', padding: 16, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },

  recentSection: { marginBottom: 20 },
  recentHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
  linkText: { color: '#2563eb', fontSize: 14, fontWeight: '500' },
  
  txList: { backgroundColor: 'white', borderRadius: 24, padding: 16 },
  txItem: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  txDetails: { alignItems: 'flex-end', flex: 1, marginRight: 12 },
  txTitle: { fontWeight: 'bold', fontSize: 14, color: '#0f172a', textAlign: 'right' },
  txDate: { fontSize: 12, color: '#64748b', marginTop: 2, textAlign: 'right' },
  txAmount: { fontWeight: 'bold', fontSize: 16 },

  menuItem: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  menuItemText: { fontSize: 16, fontWeight: '500', color: '#334155' },

  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'white', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 16, paddingBottom: 32, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  navItem: { alignItems: 'center', padding: 8 },
  fab: { width: 60, height: 60, backgroundColor: '#2563eb', borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginTop: -40, shadowColor: '#2563eb', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
});