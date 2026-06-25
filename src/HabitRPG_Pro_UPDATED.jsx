/* ════════════════════════════════════════════════════════════════════
   Daily RPG - 改進版本
   
   主要改進：
   1. 登入後立即從 Google Sheet 重新讀取資料
   2. 新增好友邀請功能（發送、接受、拒絕）
   3. 改進資料同步機制
   4. 支援跨裝置登入
   
   修改說明：
   - 將此檔案中的新增程式碼複製到原始 HabitRPG_Pro.jsx
   - 或直接用此檔案替換原始檔案
   ════════════════════════════════════════════════════════════════════ */

// ─── 新增好友邀請相關的 API Helper ───
async function gasSendFriendRequest(senderId, receiverEmailOrUsername) {
  if (!GAS_CONFIGURED) return { ok: false, error: "尚未設定後端 GAS_URL" };
  try {
    return await gasPost("sendFriendRequest", { senderId, receiverEmailOrUsername });
  } catch {
    return { ok: false, error: "連線後端失敗，請檢查網路" };
  }
}

async function gasAcceptFriendRequest(userId, senderId) {
  if (!GAS_CONFIGURED) return { ok: false, error: "尚未設定後端 GAS_URL" };
  try {
    return await gasPost("acceptFriendRequest", { userId, senderId });
  } catch {
    return { ok: false, error: "連線後端失敗，請檢查網路" };
  }
}

async function gasRejectFriendRequest(userId, senderId) {
  if (!GAS_CONFIGURED) return { ok: false, error: "尚未設定後端 GAS_URL" };
  try {
    return await gasPost("rejectFriendRequest", { userId, senderId });
  } catch {
    return { ok: false, error: "連線後端失敗，請檢查網路" };
  }
}

/* ════════════════════════════════════════════════════════════════════
   改進的 AuthScreen 元件
   
   修改：
   - handleLogin() 現在會在登入後立即從 Google Sheet 重新讀取資料
   - 確保跨裝置登入時能獲得最新的使用者資料
   ════════════════════════════════════════════════════════════════════ */

// 在 AuthScreen 元件中，修改 handleLogin 函數如下：

/*
async function handleLogin() {
  setError("");
  if (!email.trim() || !password.trim()) { setError("請輸入 Email 與密碼"); return; }
  setBusy(true);
  const res = await gasLogin(email.trim(), password);
  setBusy(false);
  if (!res.ok) { setError(res.error || "Email 或密碼錯誤"); return; }
  
  // ✅ 改進：登入後立即從 Google Sheet 重新讀取完整資料
  let finalUser = res.user;
  if (GAS_CONFIGURED && res.user.email) {
    try {
      const freshData = await gasFetchByEmail(res.user.email);
      if (freshData && freshData.id === res.user.id) {
        finalUser = freshData;
      }
    } catch (err) {
      console.warn("無法從 Google Sheet 重新讀取資料，使用登入回傳的資料", err);
    }
  }
  
  // 儲存到 localStorage
  const users = getAllUsers();
  const idx = users.findIndex(u => u.id === finalUser.id);
  if (idx === -1) users.push(finalUser); else users[idx] = { ...users[idx], ...finalUser };
  saveAllUsers(users);
  saveSession(finalUser.id);
  onLogin(finalUser.id);
}
*/

/* ════════════════════════════════════════════════════════════════════
   改進的 FriendsScreen 元件
   
   修改：
   - 新增「待處理邀請」tab，顯示已收到但未處理的邀請
   - 修改「新增好友」流程，改為「發送邀請」而非直接「加入好友」
   - 新增接受和拒絕邀請的功能
   ════════════════════════════════════════════════════════════════════ */

/*
function FriendsScreen({ user, onBack, t }) {
  const [tab, setTab] = useState("friends");
  const [searchEmail, setSearchEmail] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState("");
  const [searching, setSearching] = useState(false);
  const [friendCache, setFriendCache] = useState({});
  const [loadingFriend, setLoadingFriend] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [, forceUpdate] = useState(0);
  const today = new Date();

  // 從使用者資料中取得待處理邀請列表
  function getPendingRequests() {
    const u = getUserById(user.id);
    return u?.pendingFriendRequests || [];
  }

  // 根據 ID 取得使用者資料
  async function getUserDataById(userId) {
    // 先從本機快取查找
    let userData = getUserById(userId);
    if (userData) return userData;
    
    // 若本機沒有，嘗試從 Google Sheet 查找
    // 注意：此處需要遍歷所有使用者或有其他方式取得
    // 簡化版本：返回 null，前端顯示「載入中」或「找不到」
    return null;
  }

  function getLocalFriendIds() { 
    return getUserById(user.id)?.friendIds || []; 
  }

  function getFriendData(id) {
    return friendCache[id] || getUserById(id) || null;
  }

  async function fetchFriendFromGAS(friendId, email) {
    if (!GAS_CONFIGURED || !email) return;
    setLoadingFriend(friendId);
    try {
      const data = await gasFetchByEmail(email);
      if (data && data.id !== user.id) {
        if (typeof data.habits === "string") {
          try { data.habits = JSON.parse(data.habits); } catch { data.habits = []; }
        }
        setFriendCache(prev => ({ ...prev, [friendId]: data }));
      }
    } finally {
      setLoadingFriend(null);
    }
  }

  async function handleSearch() {
    setSearchError(""); setSearchResult(null);
    if (!searchEmail.trim()) return;
    setSearching(true);
    try {
      let found = null;
      if (GAS_CONFIGURED) {
        const u = await gasFetchByEmail(searchEmail.trim());
        found = (u && u.id !== user.id) ? u : null;
      }
      if (!found) {
        found = getAllUsers().find(u => u.email === searchEmail.trim() && u.id !== user.id) || null;
      }
      if (!found) { setSearchError("找不到此使用者"); }
      else { setSearchResult(found); }
    } finally { setSearching(false); }
  }

  // ✅ 新增：發送好友邀請
  async function sendFriendRequest(receiverEmailOrUsername) {
    if (!GAS_CONFIGURED) {
      alert("尚未連接 Google Sheet，無法發送邀請");
      return;
    }
    
    setSearching(true);
    const res = await gasSendFriendRequest(user.id, receiverEmailOrUsername);
    setSearching(false);
    
    if (!res.ok) {
      alert("❌ " + (res.error || "發送邀請失敗"));
      return;
    }
    
    alert("✅ 好友邀請已發送！");
    setSearchResult(null);
    setSearchEmail("");
    
    // 重新整理使用者資料
    if (GAS_CONFIGURED && user.email) {
      const freshData = await gasFetchByEmail(user.email);
      if (freshData) {
        updateUser(user.id, freshData);
        forceUpdate(n => n + 1);
      }
    }
  }

  // ✅ 新增：接受好友邀請
  async function acceptRequest(senderId) {
    if (!GAS_CONFIGURED) {
      alert("尚未連接 Google Sheet，無法接受邀請");
      return;
    }
    
    const res = await gasAcceptFriendRequest(user.id, senderId);
    if (!res.ok) {
      alert("❌ " + (res.error || "接受邀請失敗"));
      return;
    }
    
    alert("✅ 已接受好友邀請！");
    
    // 重新整理使用者資料
    if (GAS_CONFIGURED && user.email) {
      const freshData = await gasFetchByEmail(user.email);
      if (freshData) {
        updateUser(user.id, freshData);
        forceUpdate(n => n + 1);
      }
    }
  }

  // ✅ 新增：拒絕好友邀請
  async function rejectRequest(senderId) {
    if (!GAS_CONFIGURED) {
      alert("尚未連接 Google Sheet，無法拒絕邀請");
      return;
    }
    
    const res = await gasRejectFriendRequest(user.id, senderId);
    if (!res.ok) {
      alert("❌ " + (res.error || "拒絕邀請失敗"));
      return;
    }
    
    alert("✅ 已拒絕好友邀請");
    
    // 重新整理使用者資料
    if (GAS_CONFIGURED && user.email) {
      const freshData = await gasFetchByEmail(user.email);
      if (freshData) {
        updateUser(user.id, freshData);
        forceUpdate(n => n + 1);
      }
    }
  }

  function removeFriend(friendId) {
    const u = getUserById(user.id); if (!u) return;
    updateUser(user.id, { friendIds: (u.friendIds||[]).filter(id => id !== friendId) });
    forceUpdate(n=>n+1);
  }

  function sendReminder(friendId) {
    const reminders = loadJSON(REMINDERS_KEY, {});
    const key = `${user.id}_${friendId}_${toKey(today)}`;
    const count = reminders[key] || 0;
    if (count >= 3) { alert("今天已達每日提醒上限（3次）"); return; }
    reminders[key] = count + 1; saveJSON(REMINDERS_KEY, reminders);
    forceUpdate(n=>n+1); alert(`✅ 已向好友發送提醒！（今日第 ${count+1}/3 次）`);
  }

  function getReminderCount(friendId) { 
    return loadJSON(REMINDERS_KEY, {})[`${user.id}_${friendId}_${toKey(today)}`] || 0; 
  }

  const friendIds = getLocalFriendIds();
  const pendingRequestIds = getPendingRequests();

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", color:t.muted, fontSize:13, cursor:"pointer", fontFamily:"Inter, sans-serif", padding:0 }}>← 返回</button>
        <span style={{ fontFamily:"Fraunces, serif", fontSize:18, fontWeight:600, color:t.ink }}>好友 · 監督</span>
      </div>

      {/* GAS status badge */}
      <div style={{ background:GAS_CONFIGURED?`${SAGE}18`:`${GOLD}18`, border:`1px solid ${GAS_CONFIGURED?SAGE:GOLD}44`, borderRadius:10, padding:"8px 12px", fontSize:11.5, color:GAS_CONFIGURED?SAGE:GOLD, fontFamily:"Inter, sans-serif", fontWeight:600 }}>
        {GAS_CONFIGURED ? "✅ 已連線 Google Sheet，支援跨裝置邀請與習慣同步" : "⚠️ 本機模式：請設定 GAS_URL 以支援跨手機邀請"}
      </div>

      <div style={{ display:"flex", background:t.chip, borderRadius:12, padding:3, gap:3 }}>
        {[
          ["friends",`好友（${friendIds.length}/50）`],
          ["pending",`待處理（${pendingRequestIds.length}）`],
          ["add","發送邀請"]
        ].map(([k,l]) => (
          <button key={k} onClick={()=>setTab(k)} style={{ flex:1, padding:"8px 0", borderRadius:9, border:"none", background:tab===k?t.card:"transparent", color:tab===k?t.ink:t.muted, fontWeight:700, fontSize:12.5, cursor:"pointer", fontFamily:"Inter, sans-serif" }}>{l}</button>
        ))}
      </div>

      {/* ── 待處理邀請 tab ── */}
      {tab === "pending" && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {pendingRequestIds.length === 0 && (
            <div style={{ textAlign:"center", color:t.muted, fontSize:13.5, padding:"30px 0", fontFamily:"Inter, sans-serif" }}>沒有待處理的邀請</div>
          )}
          {pendingRequestIds.map(senderId => {
            const senderData = getUserById(senderId);
            if (!senderData) return (
              <div key={senderId} style={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:18, padding:"14px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:10 }}>
                <div style={{ color:t.muted, fontSize:13, fontFamily:"Inter, sans-serif" }}>載入中…</div>
              </div>
            );
            return (
              <div key={senderId} style={{ background:t.card, border:`1.5px solid ${SAGE}55`, borderRadius:18, padding:"14px 16px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
                  <Avatar user={senderData} size={44} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:15, color:t.ink, fontFamily:"Fraunces, serif" }}>{senderData.username}</div>
                    <div style={{ fontSize:12, color:t.muted, fontFamily:"Inter, sans-serif", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{senderData.email}</div>
                  </div>
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={()=>acceptRequest(senderId)}
                    style={{ flex:1, padding:"10px", borderRadius:10, border:"none", background:`${SAGE}22`, color:SAGE, fontWeight:700, fontSize:13.5, cursor:"pointer", fontFamily:"Inter, sans-serif" }}>
                    ✓ 接受
                  </button>
                  <button onClick={()=>rejectRequest(senderId)}
                    style={{ flex:1, padding:"10px", borderRadius:10, border:"none", background:`${CLAY_DEEP}22`, color:CLAY_DEEP, fontWeight:700, fontSize:13.5, cursor:"pointer", fontFamily:"Inter, sans-serif" }}>
                    ✕ 拒絕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 發送邀請 tab ── */}
      {tab === "add" && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <p style={{ fontSize:13, color:t.muted, margin:0, fontFamily:"Inter, sans-serif" }}>
            輸入對方 Email 或使用者名稱發送邀請。{GAS_CONFIGURED ? "支援跨裝置！" : "目前限同一裝置。"}
          </p>
          <input
            value={searchEmail} onChange={e=>setSearchEmail(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&handleSearch()}
            placeholder="對方的 Email 或使用者名稱" type="text"
            style={{ width:"100%", padding:"12px 14px", borderRadius:12, border:`1px solid ${t.borderStrong}`, background:t.cardAlt, color:t.ink, fontSize:15, fontFamily:"Inter, sans-serif", outline:"none", boxSizing:"border-box" }}
          />
          <button onClick={handleSearch} disabled={searching}
            style={{ width:"100%", padding:"12px", borderRadius:12, border:"none", background:searching?t.chip:`linear-gradient(135deg,${CLAY},${CLAY_DEEP})`, color:searching?t.muted:"#FFFCFA", fontWeight:700, fontSize:14, cursor:searching?"not-allowed":"pointer", fontFamily:"Inter, sans-serif" }}>
            {searching ? "搜尋中…" : "🔍 搜尋使用者"}
          </button>
          {searchError && <p style={{ color:CLAY_DEEP, fontSize:13, margin:0, fontFamily:"Inter, sans-serif", textAlign:"center" }}>{searchError}</p>}
          {searchResult && (
            <div style={{ background:t.card, border:`1.5px solid ${SAGE}55`, borderRadius:16, padding:"14px 16px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
                <Avatar user={searchResult} size={44} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, fontSize:15, color:t.ink, fontFamily:"Fraunces, serif" }}>{searchResult.username}</div>
                  <div style={{ fontSize:12, color:t.muted, fontFamily:"Inter, sans-serif", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{searchResult.email}</div>
                </div>
              </div>
              <button onClick={()=>sendFriendRequest(searchResult.email)}
                style={{ width:"100%", padding:"10px", borderRadius:10, border:"none", background:`${SAGE}22`, color:SAGE, fontWeight:700, fontSize:13.5, cursor:"pointer", fontFamily:"Inter, sans-serif" }}>
                📨 發送邀請
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── 好友列表 tab ── */}
      {tab === "friends" && (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {friendIds.length === 0 && (
            <div style={{ textAlign:"center", color:t.muted, fontSize:13.5, padding:"30px 0", fontFamily:"Inter, sans-serif" }}>還沒有好友，去發送邀請吧！</div>
          )}
          {friendIds.map(fid => {
            const fData = getFriendData(fid);
            const remCount = getReminderCount(fid);
            if (!fData) return (
              <div key={fid} style={{ background:t.card, border:`1px solid ${t.border}`, borderRadius:18, padding:"14px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:10 }}>
                <div style={{ color:t.muted, fontSize:13, fontFamily:"Inter, sans-serif" }}>
                  {loadingFriend===fid ? "載入中…" : "⚠️ 找不到好友資料（可能在其他裝置）"}
                </div>
                <button onClick={()=>removeFriend(fid)}
                  style={{ padding:"5px 10px", borderRadius:9, border:"none", background:`${CLAY_DEEP}14`, color:CLAY_DEEP, fontWeight:700, fontSize:11, cursor:"pointer" }}>移除</button>
              </div>
            );
            return (
              <div key={fid}>
                {GAS_CONFIGURED && fData.email && (
                  <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:4 }}>
                    <button onClick={()=>fetchFriendFromGAS(fid, fData.email)} disabled={loadingFriend===fid}
                      style={{ padding:"4px 10px", borderRadius:8, border:"none", background:t.chip, color:t.muted, fontSize:11, cursor:"pointer", fontFamily:"Inter, sans-serif" }}>
                      {loadingFriend===fid ? "同步中…" : "🔄 同步最新習慣"}
                    </button>
                  </div>
                )}
                <FriendHabitCard
                  friend={fData}
                  t={t}
                  onRemind={() => sendReminder(fid)}
                  remCount={remCount}
                />
                <div style={{ display:"flex", justifyContent:"flex-end", marginTop:4 }}>
                  <button onClick={()=>removeFriend(fid)}
                    style={{ padding:"4px 10px", borderRadius:8, border:"none", background:`${CLAY_DEEP}14`, color:CLAY_DEEP, fontWeight:700, fontSize:11, cursor:"pointer", fontFamily:"Inter, sans-serif" }}>
                    移除好友
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
*/

/* ════════════════════════════════════════════════════════════════════
   使用說明
   
   1. 複製此檔案中的新增函數到原始 HabitRPG_Pro.jsx：
      - gasSendFriendRequest()
      - gasAcceptFriendRequest()
      - gasRejectFriendRequest()
   
   2. 修改 AuthScreen 元件中的 handleLogin() 函數
   
   3. 修改 FriendsScreen 元件，新增：
      - getPendingRequests() 函數
      - sendFriendRequest() 函數
      - acceptRequest() 函數
      - rejectRequest() 函數
      - 新增「待處理邀請」tab
      - 修改「新增好友」tab 為「發送邀請」
   
   4. 測試所有功能
   ════════════════════════════════════════════════════════════════════ */
