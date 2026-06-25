import React, { useState, useEffect } from 'react';

/* ─── Design tokens ─── */
const CLAY = "#C1644B", CLAY_DEEP = "#9C4A35";
const SAGE = "#6E8763";
const GOLD = "#C99A3E", AMETHYST = "#8B6A9E";
const COIN = "#D4A72C";

const LIGHT = {
  bg: "linear-gradient(160deg, #FBF1E9 0%, #F3E3DD 45%, #ECD9DE 100%)",
  card: "#FFFCFA", cardAlt: "#FBF6F3", ink: "#3A2E2C",
  muted: "#9C8A85", mutedSoft: "#B4A39E",
  border: "rgba(58,46,44,0.08)", borderStrong: "rgba(58,46,44,0.16)",
  chip: "rgba(58,46,44,0.06)", overlay: "rgba(58,46,44,0.4)",
};
const DARK = {
  bg: "linear-gradient(160deg, #241B19 0%, #2B2020 45%, #2F2228 100%)",
  card: "#332726", cardAlt: "#3B2E2C", ink: "#F3E9E4",
  muted: "#B8A39C", mutedSoft: "#8C7972",
  border: "rgba(255,245,240,0.08)", borderStrong: "rgba(255,245,240,0.16)",
  chip: "rgba(255,245,240,0.07)", overlay: "rgba(10,6,5,0.55)",
};

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..700&family=Inter:wght@400;500;600;700&display=swap');`;

const CATEGORIES = [
  { key: "health",  label: "健康",   emoji: "🏃", color: SAGE },
  { key: "study",   label: "學習",   emoji: "📚", color: AMETHYST },
  { key: "work",    label: "工作",   emoji: "💼", color: "#5C7A93" },
  { key: "finance", label: "財務",   emoji: "💰", color: GOLD },
  { key: "growth",  label: "個人成長", emoji: "🎯", color: CLAY },
];

const LEVEL_STEP = 150;
const XP_PER_COMPLETION = 10;
const COINS_PER_CHECKIN = 5;
const COINS_CHALLENGE_COMPLETE = 30;

const PLANT_STAGES = [
  { level: 15, emoji: "🌸", label: "盛開" },
  { level: 10, emoji: "🌳", label: "大樹" },
  { level: 6,  emoji: "🪴", label: "小樹" },
  { level: 3,  emoji: "🌿", label: "幼苗" },
  { level: 1,  emoji: "🌱", label: "種子" },
];

const ALL_TITLES = [
  { id: "rookie",     label: "新人冒險者", cost: 0,    desc: "剛開始旅程（預設）",    emoji: "🌱" },
  { id: "apprentice", label: "習慣學徒",  cost: 50,   desc: "連續打卡 7 天後可解鎖", emoji: "📖" },
  { id: "focused",    label: "專注者",    cost: 150,  desc: "30 天挑戰老手",         emoji: "🎯" },
  { id: "disciplined",label: "自律達人",  cost: 300,  desc: "金幣收藏家的榮耀",      emoji: "⚔️" },
  { id: "master",     label: "習慣大師",  cost: 600,  desc: "傳奇等級的意志力",      emoji: "🏆" },
  { id: "legend",     label: "傳說冒險者", cost: 1200, desc: "最高榮耀稱號",          emoji: "👑" },
];

const DEFAULT_AVATARS = [
  { id: "male",       emoji: "🧑", label: "男生角色" },
  { id: "female",     emoji: "👩", label: "女生角色" },
  { id: "adventurer", emoji: "🧙", label: "冒險家" },
  { id: "student",    emoji: "🎓", label: "學生" },
  { id: "athlete",    emoji: "🏋️", label: "運動員" },
];

const EMOJI_CHOICES = ["💧","🏃","📖","🧘","🍎","😴","✍️","🎨","💪","🦷","🌞","🎯","掃除","🥗","🚴","🛏️","📵","🙏","🎵","🐶","🧺","☕","🚭","🌱"];

/* ══════════════════════════════════════════
   Google Apps Script 後端設定
   ══════════════════════════════════════════ */
const GAS_URL = "https://script.google.com/macros/s/AKfycbybaOzoA-tLbfpt3ZwDSkh1IhvLDhF2ZQ2qxdUxEkAtgu0YDbIfs3rXgOGxNZg9jAlpQg/exec";
const GAS_CONFIGURED = !GAS_URL.includes("YOUR_SCRIPT_ID");

/* ══════════════════════════════════════════
   GAS API helpers
   ══════════════════════════════════════════ */
async function gasPost(action, payload) {
  const r = await fetch(GAS_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({ action, ...payload }),
  });
  return r.json();
}

async function gasRegister(username, email, password) {
  if (!GAS_CONFIGURED) return { ok: false, error: "尚未設定後端 GAS_URL" };
  try { return await gasPost("register", { username, email, password }); }
  catch { return { ok: false, error: "連線後端失敗" }; }
}

async function gasLogin(email, password) {
  if (!GAS_CONFIGURED) return { ok: false, error: "尚未設定後端 GAS_URL" };
  try { return await gasPost("login", { email, password }); }
  catch { return { ok: false, error: "連線後端失敗" }; }
}

async function gasFetchByEmail(email) {
  if (!GAS_CONFIGURED) return null;
  try {
    const url = `${GAS_URL}?action=search&email=${encodeURIComponent(email)}`;
    const r = await fetch(url);
    const data = await r.json();
    return data.found ? data.user : null;
  } catch { return null; }
}

async function gasSyncUser(user) {
  if (!GAS_CONFIGURED) return { ok: false };
  try {
    return await gasPost("upsert", {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatarPreset: user.avatarPreset,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        activeTitle: user.activeTitle,
        level: levelInfo(computeUserXP(user)).level,
        coins: user.coins || 0,
        habits: JSON.stringify(user.habits || []),
        friendIds: JSON.stringify(user.friendIds || []),
        unlockedTitles: JSON.stringify(user.unlockedTitles || ["rookie"]),
        claimedChallenges: JSON.stringify(user.claimedChallenges || []),
        pendingFriendRequests: JSON.stringify(user.pendingFriendRequests || []),
      },
    });
  } catch { return { ok: false }; }
}

/* ─── 好友相關 API ─── */
async function gasSendFriendRequest(senderId, receiverEmailOrUsername) {
  if (!GAS_CONFIGURED) return { ok: false, error: "尚未設定後端 GAS_URL" };
  try { return await gasPost("sendFriendRequest", { senderId, receiverEmailOrUsername }); }
  catch { return { ok: false, error: "連線後端失敗" }; }
}

async function gasAcceptFriendRequest(userId, senderId) {
  if (!GAS_CONFIGURED) return { ok: false, error: "尚未設定後端 GAS_URL" };
  try { return await gasPost("acceptFriendRequest", { userId, senderId }); }
  catch { return { ok: false, error: "連線後端失敗" }; }
}

async function gasRejectFriendRequest(userId, senderId) {
  if (!GAS_CONFIGURED) return { ok: false, error: "尚未設定後端 GAS_URL" };
  try { return await gasPost("rejectFriendRequest", { userId, senderId }); }
  catch { return { ok: false, error: "連線後端失敗" }; }
}

/* ─── Helpers ─── */
function pad(n) { return String(n).padStart(2, "0"); }
function toKey(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate()+n); return r; }
function startOfWeek(d) {
  const r = new Date(d); const day = r.getDay();
  r.setDate(r.getDate() + (day === 0 ? -6 : 1 - day)); r.setHours(0,0,0,0); return r;
}
function loadJSON(key, def) {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : def; } catch { return def; }
}
function saveJSON(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

function computeStreak(completions, today) {
  let streak = 0, cursor = new Date(today);
  if (!completions.includes(toKey(today))) cursor = addDays(cursor, -1);
  while (completions.includes(toKey(cursor))) { streak++; cursor = addDays(cursor, -1); }
  return streak;
}

function rateForDays(habits, today, days) {
  if (!habits.length) return 0;
  let total = 0;
  habits.forEach(h => {
    let count = 0;
    for (let i = 0; i < days; i++) {
      if ((h.completions||[]).includes(toKey(addDays(today, -i)))) count++;
    }
    total += Math.round((count / days) * 100);
  });
  return Math.round(total / habits.length);
}

function plantStage(level) { return PLANT_STAGES.find(p => level >= p.level) || PLANT_STAGES[PLANT_STAGES.length-1]; }
function levelInfo(xp) {
  const level = 1 + Math.floor(xp / LEVEL_STEP);
  const within = xp % LEVEL_STEP;
  return { level, within, pct: Math.round((within / LEVEL_STEP) * 100) };
}

function getWeekChallenge(habits, today) {
  if (!habits.length) return null;
  const ws = startOfWeek(today);
  const wsKey = toKey(ws);
  const seed = wsKey.replace(/-/g,"");
  const idx = parseInt(seed.slice(-2), 10) % habits.length;
  const habit = habits[idx];
  const days = Array.from({length:7}).map((_,i) => addDays(ws, i));
  const countDone = days.filter(d => d <= today && (habit.completions||[]).includes(toKey(d))).length;
  const complete = countDone === 7;
  return { habit, days, wsKey, countDone, complete };
}

/* ─── Local storage backend ─── */
const USERS_KEY = "rpg:users";
const SESSION_KEY = "rpg:session";
const REMINDERS_KEY = "rpg:reminders";

function getAllUsers() { return loadJSON(USERS_KEY, []); }
function saveAllUsers(u) { saveJSON(USERS_KEY, u); }
function getCurrentSession() { return loadJSON(SESSION_KEY, null); }
function saveSession(uid) { saveJSON(SESSION_KEY, uid); }
function clearSession() { localStorage.removeItem(SESSION_KEY); }
function getUserById(uid) { return getAllUsers().find(u => u.id === uid) || null; }
function updateUser(uid, patch) {
  const users = getAllUsers();
  const idx = users.findIndex(u => u.id === uid);
  if (idx === -1) return;
  users[idx] = { ...users[idx], ...patch };
  saveAllUsers(users);
}
function computeUserXP(user) {
  return (user.habits||[]).reduce((s,h) => {
    const uniqueDays = new Set(h.completions||[]).size;
    return s + uniqueDays * XP_PER_COMPLETION;
  }, 0);
}

/* ══════════════════════════════════════════
   Components
   ══════════════════════════════════════════ */
function ProgressBar({ value, color, t, height = 8 }) {
  return (
    <div style={{ width:"100%", height, borderRadius:height, background:t.chip, overflow:"hidden" }}>
      <div style={{ width:`${Math.min(100,value)}%`, height:"100%", borderRadius:height, background:color, transition:"width 0.5s cubic-bezier(.22,1,.36,1)" }} />
    </div>
  );
}

function Avatar({ user, size = 44 }) {
  if (user?.avatarUrl) return <img src={user.avatarUrl} alt="" style={{ width:size, height:size, borderRadius:"50%", objectFit:"cover", flexShrink:0 }} />;
  const preset = DEFAULT_AVATARS.find(a => a.id === user?.avatarPreset) || DEFAULT_AVATARS[0];
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", background:`${CLAY}22`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*0.48, flexShrink:0 }}>
      {preset.emoji}
    </div>
  );
}

function CoinBadge({ coins, style={} }) {
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, background:`${COIN}20`, border:`1px solid ${COIN}55`, borderRadius:10, padding:"3px 9px", fontFamily:"Fraunces, serif", fontWeight:700, fontSize:13.5, color:COIN, ...style }}>
      🪙 {coins}
    </span>
  );
}

function StatCard({ label, value, color, t }) {
  return (
    <div style={{ background:t.cardAlt, borderRadius:14, padding:"12px 8px", textAlign:"center", flex:1 }}>
      <div style={{ fontFamily:"Fraunces, serif", fontWeight:700, fontSize:20, color:color||t.ink }}>{value}</div>
      <div style={{ fontSize:10.5, color:t.muted, fontFamily:"Inter, sans-serif", marginTop:3 }}>{label}</div>
    </div>
  );
}

/* ─── Screens ─── */
function AuthScreen({ onLogin, t }) {
  const [tab, setTab] = useState("login");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [user, setUser] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleLogin() {
    setError(""); setBusy(true);
    const res = await gasLogin(email, pass);
    if (res.ok) {
      const u = res.user;
      const all = getAllUsers();
      if (!all.find(x=>x.id===u.id)) saveAllUsers([...all, u]);
      else updateUser(u.id, u);
      saveSession(u.id); onLogin(u.id);
    } else { setError(res.error || "登入失敗"); }
    setBusy(false);
  }

  async function handleRegister() {
    setError(""); setBusy(true);
    const res = await gasRegister(user, email, pass);
    if (res.ok) {
      const u = res.user;
      saveAllUsers([...getAllUsers(), u]);
      saveSession(u.id); onLogin(u.id);
    } else { setError(res.error || "註冊失敗"); }
    setBusy(false);
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"flex", gap:8, background:t.chip, padding:4, borderRadius:12 }}>
        {["login","reg"].map(k=><button key={k} onClick={()=>setTab(k)} style={{ flex:1, padding:"8px", borderRadius:9, border:"none", background:tab===k?t.card:"transparent", color:tab===k?t.ink:t.muted, fontWeight:700, fontSize:13, cursor:"pointer" }}>{k==="login"?"登入":"註冊"}</button>)}
      </div>
      {error && <div style={{ color:CLAY, fontSize:12, textAlign:"center" }}>{error}</div>}
      <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
        {tab==="reg" && <input placeholder="冒險者名稱" value={user} onChange={e=>setUser(e.target.value)} style={{ width:"100%", padding:12, borderRadius:10, border:`1px solid ${t.border}`, background:t.cardAlt, color:t.ink }} />}
        <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} style={{ width:"100%", padding:12, borderRadius:10, border:`1px solid ${t.border}`, background:t.cardAlt, color:t.ink }} />
        <input placeholder="密碼" type="password" value={pass} onChange={e=>setPass(e.target.value)} style={{ width:"100%", padding:12, borderRadius:10, border:`1px solid ${t.border}`, background:t.cardAlt, color:t.ink }} />
        <button onClick={tab==="login"?handleLogin:handleRegister} disabled={busy} style={{ width:"100%", padding:14, borderRadius:12, border:"none", background:busy?t.muted:CLAY, color:"#fff", fontWeight:700, cursor:"pointer" }}>{busy?"處理中...":(tab==="login"?"登入":"建立帳號")}</button>
      </div>
    </div>
  );
}

function ProfileScreen({ user, onBack, onSave, t }) {
  const [username, setUsername] = useState(user.username);
  const [bio, setBio] = useState(user.bio || "");
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <button onClick={onBack} style={{ alignSelf:"flex-start", background:"none", border:"none", color:t.muted, cursor:"pointer" }}>← 返回</button>
      <div style={{ textAlign:"center" }}><Avatar user={user} size={80} /></div>
      <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="名稱" style={{ width:"100%", padding:12, borderRadius:10, border:`1px solid ${t.border}`, background:t.cardAlt, color:t.ink }} />
      <textarea value={bio} onChange={e=>setBio(e.target.value)} placeholder="個人簡介" style={{ width:"100%", padding:12, borderRadius:10, border:`1px solid ${t.border}`, background:t.cardAlt, color:t.ink, minHeight:80 }} />
      <button onClick={()=>onSave({username, bio})} style={{ padding:14, borderRadius:12, border:"none", background:CLAY, color:"#fff", fontWeight:700, cursor:"pointer" }}>儲存設定</button>
    </div>
  );
}

function FriendsScreen({ user, onBack, t }) {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  async function handleAdd() {
    setMsg("發送中...");
    const res = await gasSendFriendRequest(user.id, email);
    setMsg(res.ok ? "邀請已發送！" : (res.error || "發送失敗"));
  }
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <button onClick={onBack} style={{ alignSelf:"flex-start", background:"none", border:"none", color:t.muted, cursor:"pointer" }}>← 返回</button>
      <h2 style={{ fontFamily:"Fraunces, serif", margin:0 }}>👥 好友系統</h2>
      <div style={{ display:"flex", gap:8 }}>
        <input placeholder="好友 Email 或名稱" value={email} onChange={e=>setEmail(e.target.value)} style={{ flex:1, padding:12, borderRadius:10, border:`1px solid ${t.border}`, background:t.cardAlt, color:t.ink }} />
        <button onClick={handleAdd} style={{ padding:"0 16px", borderRadius:10, border:"none", background:SAGE, color:"#fff", fontWeight:700, cursor:"pointer" }}>新增</button>
      </div>
      {msg && <div style={{ fontSize:12, color:SAGE }}>{msg}</div>}
      <div style={{ color:t.muted, fontSize:13 }}>好友列表功能開發中...</div>
    </div>
  );
}

function TitlesScreen({ user, onBack, onUpdate, t }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <button onClick={onBack} style={{ alignSelf:"flex-start", background:"none", border:"none", color:t.muted, cursor:"pointer" }}>← 返回</button>
      <h2 style={{ fontFamily:"Fraunces, serif", margin:0 }}>🏆 稱號成就</h2>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {ALL_TITLES.map(tt => (
          <div key={tt.id} onClick={()=>onUpdate({activeTitle:tt.id})} style={{ padding:14, borderRadius:14, border:`2px solid ${user.activeTitle===tt.id?GOLD:t.border}`, background:t.card, cursor:"pointer" }}>
            <div style={{ fontSize:16, fontWeight:700 }}>{tt.emoji} {tt.label}</div>
            <div style={{ fontSize:12, color:t.muted }}>{tt.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HabitFormSheet({ initial, onClose, onSave, t }) {
  const [name, setName] = useState(initial?.name || "");
  const [emoji, setEmoji] = useState(initial?.emoji || "💧");
  return (
    <div style={{ position:"fixed", inset:0, background:t.overlay, display:"flex", alignItems:"flex-end", zIndex:100 }}>
      <div style={{ width:"100%", background:t.card, borderTopLeftRadius:24, borderTopRightRadius:24, padding:24, animation:"fade-in 0.3s ease" }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:20 }}>
          <h3 style={{ margin:0 }}>{initial?"編輯習慣":"新增習慣"}</h3>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer" }}>✕</button>
        </div>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="習慣名稱" style={{ width:"100%", padding:12, borderRadius:10, border:`1px solid ${t.border}`, background:t.cardAlt, color:t.ink, marginBottom:16 }} />
        <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:20 }}>
          {EMOJI_CHOICES.map(e=><button key={e} onClick={()=>setEmoji(e)} style={{ fontSize:20, width:40, height:40, borderRadius:8, border:`2px solid ${emoji===e?CLAY:"transparent"}`, background:t.chip }}>{e}</button>)}
        </div>
        <button onClick={()=>onSave({name, emoji, category:"health"})} style={{ width:"100%", padding:14, borderRadius:12, border:"none", background:CLAY, color:"#fff", fontWeight:700 }}>儲存</button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   Main App
   ══════════════════════════════════════════ */
export default function App() {
  const [darkMode, setDarkMode] = useState(()=>loadJSON("rpg:dark", false));
  const t = darkMode ? DARK : LIGHT;
  const [screen, setScreen] = useState("auth");
  const [userId, setUserId] = useState(null);
  const [user, setUser] = useState(null);
  const [subScreen, setSubScreen] = useState(null);
  const [view, setView] = useState("today");
  const [showAdd, setShowAdd] = useState(false);
  const [coinToast, setCoinToast] = useState(null);

  useEffect(() => {
    const session = getCurrentSession();
    if (session) {
      const u = getUserById(session);
      if (u) {
        setUserId(session); setUser(u); setScreen("home");
        if (GAS_CONFIGURED && u.email) {
          gasFetchByEmail(u.email).then(remote => {
            if (remote) { updateUser(session, remote); setUser(getUserById(session)); }
          });
        }
      }
    }
  }, []);

  function refreshUser() { const u = getUserById(userId); if (u) setUser({...u}); }
  function showCoinGain(amount, reason) { setCoinToast({amount, reason, id:Date.now()}); setTimeout(()=>setCoinToast(null), 2000); }
  function handleLogin(uid) { setUserId(uid); setUser(getUserById(uid)); setScreen("home"); }
  function handleLogout() { clearSession(); setUserId(null); setUser(null); setScreen("auth"); }
  
  function toggleHabit(id) {
    const u = getUserById(userId); if (!u) return;
    const today = toKey(new Date());
    let earned = 0;
    const habits = (u.habits||[]).map(h => {
      if (h.id !== id) return h;
      const done = (h.completions||[]).includes(today);
      if (done) return {...h, completions: h.completions.filter(d=>d!==today)};
      if (!(h.rewardedDays||[]).includes(today)) earned = COINS_PER_CHECKIN;
      return {...h, completions: [...(h.completions||[]), today], rewardedDays: [...(h.rewardedDays||[]), today]};
    });
    updateUser(userId, {habits, coins: (u.coins||0) + earned});
    if (earned > 0) showCoinGain(earned, "習慣打卡");
    refreshUser(); gasSyncUser(getUserById(userId));
  }

  if (screen === "auth") return (
    <div style={{ width:"100%", minHeight:"100vh", background:t.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <style>{FONT_IMPORT + `* { box-sizing:border-box; } body { margin:0; }`}</style>
      <div style={{ width:"100%", maxWidth:400, padding:20 }}>
        <div style={{ textAlign:"center", marginBottom:30 }}><div style={{ fontSize:50 }}>🌱</div><h1 style={{ fontFamily:"Fraunces, serif", color:t.ink }}>Daily RPG</h1></div>
        <div style={{ background:t.card, borderRadius:20, padding:24 }}><AuthScreen onLogin={handleLogin} t={t} /></div>
      </div>
    </div>
  );

  if (!user) return null;
  const xp = computeUserXP(user); const {level, pct} = levelInfo(xp);
  const plant = plantStage(level);

  const wrapper = (child) => (
    <div style={{ width:"100%", minHeight:"100vh", background:t.bg, display:"flex", justifyContent:"center", padding:20 }}>
      <style>{FONT_IMPORT + `* { box-sizing:border-box; } body { margin:0; }`}</style>
      <div style={{ width:"100%", maxWidth:600 }}>{child}</div>
    </div>
  );

  if (subScreen === "profile") return wrapper(<ProfileScreen user={user} onBack={()=>setSubScreen(null)} onSave={p=>{updateUser(userId,p);refreshUser();gasSyncUser(getUserById(userId));setSubScreen(null);}} t={t} />);
  if (subScreen === "friends") return wrapper(<FriendsScreen user={user} onBack={()=>setSubScreen(null)} t={t} />);
  if (subScreen === "titles") return wrapper(<TitlesScreen user={user} onBack={()=>setSubScreen(null)} onUpdate={p=>{updateUser(userId,p);refreshUser();setSubScreen(null);}} t={t} />);

  return (
    <div style={{ width:"100%", minHeight:"100vh", background:t.bg, display:"flex", justifyContent:"center", padding:"20px 20px 100px" }}>
      <style>{FONT_IMPORT + `* { box-sizing:border-box; } body { margin:0; }`}</style>
      {coinToast && <div style={{ position:"fixed", top:20, left:"50%", transform:"translateX(-50%)", background:COIN, color:"#fff", padding:"8px 16px", borderRadius:20, zIndex:200 }}>🪙 +{coinToast.amount} {coinToast.reason}</div>}
      <div style={{ width:"100%", maxWidth:600 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div style={{ display:"flex", gap:10, alignItems:"center" }} onClick={()=>setSubScreen("profile")}><Avatar user={user} /><div style={{ fontWeight:700, color:t.ink }}>{user.username}</div></div>
          <div style={{ display:"flex", gap:8 }}>
            <CoinBadge coins={user.coins||0} />
            <button onClick={()=>setSubScreen("friends")} style={{ border:"none", background:t.chip, borderRadius:8, padding:8 }}>👥</button>
            <button onClick={()=>setDarkMode(!darkMode)} style={{ border:"none", background:t.chip, borderRadius:8, padding:8 }}>{darkMode?"☀️":"🌙"}</button>
          </div>
        </div>
        <div style={{ background:t.card, borderRadius:16, padding:16, marginBottom:20 }}>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:6 }}><span>Lv.{level} {plant.emoji}</span><span>{xp} XP</span></div>
          <ProgressBar value={pct} color={CLAY} t={t} />
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {(user.habits||[]).map(h => (
            <div key={h.id} onClick={()=>toggleHabit(h.id)} style={{ background:t.card, borderRadius:14, padding:16, display:"flex", alignItems:"center", gap:12, cursor:"pointer", border:`2px solid ${(h.completions||[]).includes(toKey(new Date()))?SAGE:"transparent"}` }}>
              <div style={{ fontSize:24 }}>{h.emoji}</div>
              <div style={{ flex:1, fontWeight:700, color:t.ink }}>{h.name}</div>
              <div>{(h.completions||[]).includes(toKey(new Date()))?"✅":"⭕"}</div>
            </div>
          ))}
          <button onClick={()=>setShowAdd(true)} style={{ padding:16, borderRadius:14, border:`2px dashed ${t.borderStrong}`, background:"none", color:t.muted, cursor:"pointer" }}>+ 新增習慣</button>
        </div>
      </div>
      {showAdd && <HabitFormSheet onClose={()=>setShowAdd(false)} onSave={h=>{updateUser(userId,{habits:[...(user.habits||[]), {id:`h_${Date.now()}`, ...h, completions:[]}]});refreshUser();setShowAdd(false);}} t={t} />}
    </div>
  );
}
