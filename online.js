/* 線上功能：Google 登入、雲端存檔、好友（在線燈號）、好友對戰、排行榜。後端用 Firebase（Auth + Firestore）。
   firebase-config.js 沒填設定時，這些功能顯示「尚未開通」，遊戲本身照常可玩。 */
const A = window.APP, cfg = window.FIREBASE_CONFIG;
const V = "10.12.2", CDN = `https://www.gstatic.com/firebasejs/${V}/`;
const ONLINE_MS = 150000;           // 2.5 分鐘內有心跳就算在線
const $ = s => document.querySelector(s);
const esc = A.esc;

let F = null, auth = null, db = null, user = null, loadErr = "";
let pushTimer = 0, beatTimer = 0, unsubs = [], friendUnsubs = [];
const friends = new Map();          // uid → 公開資料
let devUid = "", friendIds = [], invites = new Map(), reqs = new Map(), hiddenReq = new Set(), rankCache = {}, rankCat = "xp", rankScope = "all";

const ON = {
  dirty(force) { if (!user) return; clearTimeout(pushTimer); pushTimer = setTimeout(push, force ? 300 : 2500); },
  renderAccount, renderVs, renderRank,
};
window.ONLINE = ON;

async function boot() {
  if (!cfg) { A.refreshTab(); return; }
  try {
    const [app, au, fs] = await Promise.all([import(CDN + "firebase-app.js"), import(CDN + "firebase-auth.js"), import(CDN + "firebase-firestore.js")]);
    F = { ...au, ...fs };
    const fb = app.initializeApp(cfg);
    auth = au.getAuth(fb); db = fs.initializeFirestore(fb, { experimentalAutoDetectLongPolling: true });   // 某些網路下即時連線會卡住，自動改用長輪詢
    au.getRedirectResult(auth).catch(e => A.toast("登入失敗：" + e.code));
    au.onAuthStateChanged(auth, u => { user = u; loginUI(); u ? onLogin() : onLogout(); });
  } catch (e) { loadErr = "線上功能載入失敗，請檢查網路後重新整理。"; console.error(e); }
  loginUI(); A.refreshTab();
}

/* ---------- 登入與雲端存檔 ---------- */
async function login() {
  const p = new F.GoogleAuthProvider();
  try { await F.signInWithPopup(auth, p); }
  catch (e) {
    if (["auth/popup-blocked", "auth/operation-not-supported-in-this-environment", "auth/cancelled-popup-request"].includes(e.code)) return F.signInWithRedirect(auth, p);
    if (e.code !== "auth/popup-closed-by-user") A.toast("登入失敗：" + e.code);
  }
}
async function loginGuest() {
  try { await F.signInAnonymously(auth); }
  catch (e) { A.toast(["auth/operation-not-allowed", "auth/admin-restricted-operation"].includes(e.code) ? "遊客登入還沒開通（管理者要在 Firebase 啟用「匿名」登入）" : "遊客登入失敗：" + e.code); }
}
async function linkGoogle() {
  try { await F.linkWithPopup(auth, new F.GoogleAuthProvider()); A.toast("已綁定 Google，進度會存在這個帳號"); loginUI(); A.refreshTab(); }
  catch (e) {
    if (e.code === "auth/credential-already-in-use") A.toast("這個 Google 帳號已經有存檔。請先登出遊客，再用 Google 登入（遊客進度不會合併）");
    else if (e.code !== "auth/popup-closed-by-user") A.toast("綁定失敗：" + e.code);
  }
}
// 右上角登入按鈕：未登入才顯示，點開選 Google 或遊客
function loginUI() {
  const w = $("#loginWrap"); if (!w) return;
  w.hidden = !(cfg && auth && !user); if (w.hidden) $("#loginMenu").hidden = true;
}
$("#loginBtn")?.addEventListener("click", e => { e.stopPropagation(); $("#loginMenu").hidden = !$("#loginMenu").hidden; });
$("#loginMenu")?.addEventListener("click", e => { const b = e.target.closest("[data-lg]"); if (!b) return; $("#loginMenu").hidden = true; b.dataset.lg === "guest" ? loginGuest() : login(); });
document.addEventListener("click", () => { const m = $("#loginMenu"); if (m) m.hidden = true; });
const PROGRESS = ["xp", "coins", "gems", "best", "owned", "wrong", "games", "wins", "losses", "name", "avatar", "title", "skin", "lessons", "vsDay"];
function mergeBest(a = {}, b = {}) {
  const o = { ...a };
  for (const [k, v] of Object.entries(b)) o[k] = o[k] == null ? v : (k === "match" || k.startsWith("f_match")) ? Math.min(o[k], v) : Math.max(o[k], v);
  return o;
}
async function onLogin() {
  const ref = F.doc(db, "users", user.uid);
  try {
    const snap = await F.getDoc(ref), S = A.S;
    if (snap.exists()) {
      const c = snap.data();
      const best = mergeBest(S.best, c.best), owned = [...new Set([...A.FREE, ...(S.owned || []), ...(c.owned || [])])];
      if ((c.xp || 0) >= S.xp) PROGRESS.forEach(k => { if (c[k] !== undefined) S[k] = c[k]; });
      S.best = best; S.owned = owned; S.code = c.code;
      S.ach = { ...(S.ach || {}), ...(c.ach || {}) }; S.known = { ...(S.known || {}), ...(c.known || {}) }; S.first = { ...(c.first || {}), ...(S.first || {}) };
      if (c.joined) S.joined = c.joined;
    }
    if (!S.joined) S.joined = new Date().toLocaleDateString("sv");
    if (!S.code) S.code = await makeCode();
    A.checkAch();
    A.save(); A.applySkin(); A.renderChips(); A.hud();
    await push();
    A.toast(`已登入，歡迎 ${S.name}！`);
  } catch (e) { console.error(e); A.toast("讀取雲端存檔失敗：" + (e.code || e.message)); }
  beat(); clearInterval(beatTimer); beatTimer = setInterval(beat, 60000);
  F.getDoc(F.doc(db, "codes", A.DEV_CODE)).then(c => { devUid = c.exists() ? c.data().uid : ""; A.refreshTab(); }).catch(() => {});
  listenFriends(); listenInvites(); listenRequests(); listenLobby(); rejoinRoom();
  A.refreshTab();
}
function onLogout() {
  clearInterval(beatTimer); unsubs.forEach(u => u()); unsubs = []; friendUnsubs.forEach(u => u()); friendUnsubs = [];
  dropRoom(); lobbyRooms = []; friends.clear(); friendIds = []; invites.clear(); reqs.clear(); hiddenReq.clear(); renderInvites();
  A.refreshTab();
}
async function makeCode() {
  const ch = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let t = 0; t < 6; t++) {
    const code = Array.from({ length: 6 }, () => ch[Math.random() * ch.length | 0]).join("");
    try { await F.setDoc(F.doc(db, "codes", code), { uid: user.uid }); return code; } catch (e) { /* 代碼重複就換一個 */ }
  }
  throw new Error("建立好友代碼失敗");
}
function pub() {
  const S = A.S, best = {};
  for (const [k, v] of Object.entries(S.best || {})) if (typeof v === "number") best[k] = v;
  return { name: S.name, avatar: S.avatar, title: S.title, skin: S.skin, xp: S.xp, level: A.lvOf(S.xp), coins: S.coins, best,
    owned: S.owned, wrong: S.wrong, lessons: S.lessons, games: S.games || 0, wins: S.wins || 0, losses: S.losses || 0,
    gems: S.gems || 0, ach: S.ach || {}, achN: Object.keys(S.ach || {}).length, known: S.known || {}, first: S.first || {}, vsDay: S.vsDay || null, joined: S.joined || "",
    code: S.code || "", lastSeen: F.serverTimestamp(), updatedAt: F.serverTimestamp() };
}
async function push() {
  if (!user) return;
  try { await F.setDoc(F.doc(db, "users", user.uid), pub(), { merge: true }); rankCache = {}; }
  catch (e) { console.error(e); }
}
function beat() {
  if (!user || document.visibilityState !== "visible") return;
  F.updateDoc(F.doc(db, "users", user.uid), { lastSeen: F.serverTimestamp() }).catch(() => {});
}
document.addEventListener("visibilitychange", beat);

/* ---------- 好友 ---------- */
function listenFriends() {
  const u = F.onSnapshot(F.collection(db, "users", user.uid, "friends"), snap => {
    friendIds = snap.docs.map(d => d.id);
    A.S.friendsN = friendIds.length; A.checkAch();
    friendUnsubs.forEach(f => f()); friendUnsubs = [];
    for (const id of [...friends.keys()]) if (!friendIds.includes(id)) friends.delete(id);
    for (let i = 0; i < friendIds.length; i += 30) {
      const ids = friendIds.slice(i, i + 30);
      friendUnsubs.push(F.onSnapshot(F.query(F.collection(db, "users"), F.where(F.documentId(), "in", ids)), s => {
        s.docs.forEach(d => friends.set(d.id, d.data()));
        softRender();
      }));
    }
    softRender();
  }, e => console.error(e));
  unsubs.push(u);
}
setInterval(() => { if (user && A.tab === "vs" && !document.activeElement?.matches("input")) renderVs($("#vsBox")); }, 30000);
const seenMs = d => d?.lastSeen?.toMillis ? d.lastSeen.toMillis() : 0;
function statusHtml(d) {
  const ms = Date.now() - seenMs(d);
  if (seenMs(d) && ms < ONLINE_MS) return `<span class="status on"><i></i>在線</span>`;
  if (!seenMs(d)) return `<span class="status"><i></i>離線</span>`;
  const m = ms / 60000, t = m < 60 ? `${m | 0} 分鐘前` : m < 1440 ? `${m / 60 | 0} 小時前` : `${m / 1440 | 0} 天前`;
  return `<span class="status"><i></i>離線・${t}</span>`;
}
async function addFriend(code) {
  code = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) return A.toast("好友代碼是 6 個英數字");
  if (code === A.S.code) return A.toast("這是你自己的代碼");
  if (friendIds.length >= 50) return A.toast("好友最多 50 位");
  try {
    const c = await F.getDoc(F.doc(db, "codes", code));
    if (!c.exists()) return A.toast("找不到這個代碼");
    await sendRequest(c.data().uid);
  } catch (e) { console.error(e); A.toast("加好友失敗：" + (e.code || e.message)); }
}
async function befriend(fid) {
  if (fid === user.uid) return;
  if (friendIds.includes(fid)) return A.toast("你們已經是好友了");
  if (friendIds.length >= 50) return A.toast("好友最多 50 位");
  try {
    const since = F.serverTimestamp();
    await F.setDoc(F.doc(db, "users", user.uid, "friends", fid), { since });
    await F.setDoc(F.doc(db, "users", fid, "friends", user.uid), { since });
    A.sfx.ding(); A.toast("加好友成功！");
  } catch (e) { console.error(e); A.toast("加好友失敗：" + (e.code || e.message)); }
}
async function removeFriend(fid) {
  try {
    await F.deleteDoc(F.doc(db, "users", user.uid, "friends", fid));
    await F.deleteDoc(F.doc(db, "users", fid, "friends", user.uid));
    A.toast("已刪除好友");
  } catch (e) { A.toast("刪除失敗：" + (e.code || e.message)); }
}

/* ---------- 房間對戰 ---------- */
const ROOM_TTL = 30 * 60000;          // 大廳只列出 30 分鐘內開的房間
let room = null, lobbyRooms = [];     // room = 我所在的房間 { code, ref, d, members, round, inGame, sawMe, closed, unRoom, unMem, board }
const ROOM_KEY = "mock1-vocab-room";   // 重新整理後自動回到原本的房間
const saveRoom = c => { try { c ? localStorage.setItem(ROOM_KEY, c) : localStorage.removeItem(ROOM_KEY); } catch (e) { /* 無痕模式等情況存不了就算了 */ } };
const nowMs = d => d?.createdAt?.toMillis ? d.createdAt.toMillis() : Date.now();
const lessonText = d => !d.lessons?.length || d.lessons.length === A.LESSONS.length ? "全部單元" : d.lessons.join("、");
const bookCount = ls => A.WORDS_BOOK().filter(x => ls.includes(x.l)).length;
const softRender = () => { if (A.tab === "vs" && !document.activeElement?.matches("input")) renderVs($("#vsBox")); };
async function hashPw(code, pw) {
  if (!pw) return "";
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code + ":" + pw));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
}
const meInfo = ph => ({ name: A.S.name, av: A.S.avatar, lv: A.lvOf(A.S.xp), ph, r: -1, p: 0, s: 0, at: F.serverTimestamp() });

function listenLobby() {
  const q = F.query(F.collection(db, "rooms"), F.where("isPublic", "==", true), F.where("status", "==", "waiting"));
  unsubs.push(F.onSnapshot(q, snap => {
    lobbyRooms = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => Date.now() - nowMs(r) < ROOM_TTL).sort((a, b) => nowMs(b) - nowMs(a));
    if (!room) softRender();
  }, e => { console.error(e); A.toast("讀取房間列表失敗：" + (e.code || e.message)); }));
}
function listenInvites() {
  unsubs.push(F.onSnapshot(F.collection(db, "users", user.uid, "invites"), snap => {
    invites.clear();
    snap.docs.forEach(d => { const v = d.data(); if (Date.now() - nowMs(v) < 180000) invites.set(d.id, { ref: d.ref, ...v }); else F.deleteDoc(d.ref).catch(() => {}); });
    snap.docChanges().forEach(c => { if (c.type === "added" && invites.has(c.doc.id)) A.sfx.ding(); });
    renderInvites();
  }, e => { console.error(e); A.toast("收不到房間邀請：" + (e.code || e.message)); }));
}
// 好友申請：收到時跳出彈窗（20 秒後收起），沒處理的會留在「對戰」頁的「好友申請」清單
function listenRequests() {
  unsubs.push(F.onSnapshot(F.collection(db, "users", user.uid, "requests"), snap => {
    reqs.clear(); snap.docs.forEach(d => reqs.set(d.id, { ref: d.ref, ...d.data() }));
    snap.docChanges().forEach(c => {
      if (c.type !== "added" || !reqs.has(c.doc.id) || hiddenReq.has(c.doc.id)) return;
      A.sfx.ding(); setTimeout(() => { hiddenReq.add(c.doc.id); renderInvites(); }, 20000);
    });
    renderInvites(); softRender();
  }, e => { console.error(e); A.toast("收不到好友申請：" + (e.code || e.message)); }));
}
async function answerReq(id, yes) {
  const r = reqs.get(id); if (!r) return;
  reqs.delete(id); renderInvites(); softRender();
  try {
    if (yes && !friendIds.includes(id)) await befriend(id);
    await F.deleteDoc(r.ref);
  } catch (e) { A.toast("操作失敗：" + (e.code || e.message)); }
}
async function sendRequest(fid) {
  if (friendIds.includes(fid)) { A.toast("你們已經是好友了"); return true; }
  if (reqs.has(fid)) return answerReq(fid, true).then(() => true);   // 對方也正好申請我，直接成為好友
  try {
    const S = A.S;
    await F.setDoc(F.doc(db, "users", fid, "requests", user.uid), { from: user.uid, fromName: S.name, fromAv: S.avatar, lv: A.lvOf(S.xp), createdAt: F.serverTimestamp() });
    A.sfx.tap(); A.toast("已送出好友申請"); return true;
  } catch (e) { console.error(e); A.toast("送出申請失敗：" + (e.code || e.message) + (e.code === "permission-denied" ? "（Firebase 規則還沒更新）" : "")); return false; }
}
function renderInvites() {
  document.querySelectorAll(".invite").forEach(x => x.remove());
  const rq = [...reqs.entries()].find(([id]) => !hiddenReq.has(id)), box = document.createElement("div");
  box.className = "invite";
  if (rq) {
    const [id, v] = rq;
    box.innerHTML = `<span class="av">${esc(v.fromAv || "🙂")}</span><b style="flex:1;min-width:140px">${esc(v.fromName || "玩家")} 想加你為好友</b>
      <button class="btn small green" data-a="yes" type="button">允許</button><button class="btn small ghost" data-a="no" type="button">拒絕</button>`;
    box.onclick = e => { const a = e.target.closest("button")?.dataset.a; if (a) answerReq(id, a === "yes"); };
    return document.body.append(box);
  }
  const v = [...invites.values()][0]; if (!v) return;
  box.innerHTML = `<span class="av">${esc(v.fromAv)}</span><b style="flex:1;min-width:140px">${esc(v.fromName)} 邀請你加入房間「${esc(v.roomName)}」</b>
    <button class="btn small green" data-a="yes" type="button">加入</button><button class="btn small ghost" data-a="no" type="button">忽略</button>`;
  box.onclick = e => {
    const a = e.target.closest("button")?.dataset.a; if (!a) return;
    invites.delete(v.ref.id); box.remove(); renderInvites();
    F.deleteDoc(v.ref).catch(() => {});
    if (a === "yes") joinRoom(v.code, { ph: v.ph });
  };
  document.body.append(box);
}

async function createRoom(o) {
  if (room) { A.toast("你已經在房間裡了"); return false; }
  const S = A.S;
  try {
    let code = "";
    for (let t = 0; t < 8 && !code; t++) {
      const c = String(100000 + Math.random() * 900000 | 0);
      if (!(await F.getDoc(F.doc(db, "rooms", c))).exists()) code = c;
    }
    if (!code) throw new Error("產生房間號失敗，請再試一次");
    const ph = await hashPw(code, o.pw);
    await F.setDoc(F.doc(db, "rooms", code), { host: user.uid, hostName: S.name, hostAv: S.avatar, name: o.name || `${S.name}的房間`, max: o.max, nq: o.nq,
      lessons: o.lessons, isPublic: o.pub, ph, locked: !!o.pw, status: "waiting", round: 0, qs: [], createdAt: F.serverTimestamp() });
    await F.setDoc(F.doc(db, "rooms", code, "members", user.uid), meInfo(ph));
    A.sfx.tap(); enterRoom(code); return true;
  } catch (e) { console.error(e); A.toast("建立房間失敗：" + (e.code || e.message)); return false; }
}
function askPw(code, name) {
  const m = A.modal(`<h2 style="margin:0">🔒 ${esc(name)}</h2><p class="muted" style="margin:0">這間房間有密碼</p>
    <input class="field" id="jpw" maxlength="12" placeholder="輸入密碼" autocomplete="off">
    <div class="row" style="justify-content:center"><button class="btn" data-ok type="button">加入</button><button class="btn ghost" data-close type="button">取消</button></div>`);
  const inp = m.querySelector("#jpw"), go = () => { if (!inp.value) return; m.remove(); joinRoom(code, { pw: inp.value }); };
  m.querySelector("[data-ok]").onclick = go; inp.onkeydown = e => { if (e.key === "Enter") go(); }; inp.focus();
}
// o.pw = 使用者輸入的密碼；o.ph = 邀請帶來的密碼雜湊（被房間裡的人邀請就不用再輸入密碼）
async function joinRoom(code, o = {}) {
  code = String(code).trim();
  if (!/^\d{6}$/.test(code)) return A.toast("房間號是 6 位數字");
  if (room) return A.toast(room.code === code ? "你已經在這間房間了" : "你已經在房間裡了，先離開才能加入別的房間");
  try {
    const snap = await F.getDoc(F.doc(db, "rooms", code));
    if (!snap.exists()) return A.toast("找不到這個房間");
    const d = snap.data(), ref = snap.ref;
    const mem = await F.getDocs(F.collection(ref, "members")), already = mem.docs.some(x => x.id === user.uid);
    if (d.status === "closed") return A.toast("這間房間已經關閉");
    if (d.status !== "waiting" && !already) return A.toast("這間房間正在對戰中，晚點再來");
    if (!already) {
      if (mem.size >= d.max) return A.toast("房間已滿");
      let ph = o.ph;
      if (ph === undefined) {
        if (d.locked && o.pw === undefined) return askPw(code, d.name);
        ph = await hashPw(code, o.pw || "");
      }
      try { await F.setDoc(F.doc(ref, "members", user.uid), meInfo(ph)); }
      catch (e) { return A.toast(e.code === "permission-denied" ? "密碼錯誤，或房間已經開始" : "加入失敗：" + (e.code || e.message)); }
    }
    A.sfx.tap(); A.showTab("vs"); enterRoom(code);
  } catch (e) { console.error(e); A.toast("加入房間失敗：" + (e.code || e.message)); }
}
function enterRoom(code, round = -1) {
  saveRoom(code);
  const ref = F.doc(db, "rooms", code), r = room = { code, ref, d: null, members: new Map(), round, inGame: false, sawMe: false, closed: false, board: null };
  r.unRoom = F.onSnapshot(ref, s => onRoomSnap(r, s), e => { console.error(e); exitRoom("房間連線失敗：" + (e.code || e.message)); });
  r.unMem = F.onSnapshot(F.collection(ref, "members"), s => {
    if (room !== r) return;
    r.members = new Map(s.docs.map(d => [d.id, d.data()]));
    if (r.members.has(user.uid)) r.sawMe = true;
    else if (r.sawMe) return exitRoom("你已被請出房間");
    if (r.d && r.members.size && !r.members.has(r.d.host) && nextHost(r.members, "")?.[0] === user.uid)   // 房主不告而別（關分頁等）：由最早的成員接手
      F.updateDoc(r.ref, { host: user.uid, hostName: A.S.name, hostAv: A.S.avatar }).catch(() => {});
    if (r.board) r.board(); else if (A.tab === "vs") renderVs($("#vsBox"));
  }, e => console.error(e));
  if (A.tab === "vs") renderVs($("#vsBox"));
  setTimeout(async () => {   // 3 秒還沒收到房間資料就主動抓一次，避免卡在「進入房間中」
    if (room !== r || r.d) return;
    try { const s = await F.getDocFromServer(ref); if (room === r && !r.d) onRoomSnap(r, s); } catch (e) { console.error(e); }
  }, 3000);
}
function onRoomSnap(r, s) {
  if (room !== r) return;
  const d = s.exists() ? s.data() : null;
  if (!d || d.status === "closed") { if (r.inGame) { r.closed = true; return; } return exitRoom("房主關閉了房間"); }
  r.d = d;
  if (d.status === "playing" && d.round !== r.round && r.sawMe) startRoomGame();
  else if (A.tab === "vs" && !r.inGame) renderVs($("#vsBox"));
}
function dropRoom() { const r = room; if (!r) return null; room = null; saveRoom(""); r.unRoom?.(); r.unMem?.(); r.board = null; return r; }
function exitRoom(msg) {
  const r = dropRoom(); if (!r) return;
  if (r.inGame) A.home();
  if (msg) A.toast(msg);
  if (A.tab === "vs") renderVs($("#vsBox"));
}
const nextHost = (members, skip) => [...members].filter(([id]) => id !== skip).sort((a, b) => (a[1].at?.toMillis?.() || 0) - (b[1].at?.toMillis?.() || 0))[0];
async function leaveRoom() {
  const r = dropRoom(); if (!r) return;
  try {
    if (r.d?.host === user.uid) {   // 房主離開：轉給最早加入的下一位，沒人了才關房
      const next = nextHost(r.members, user.uid);
      await F.updateDoc(r.ref, next ? { host: next[0], hostName: next[1].name, hostAv: next[1].av } : { status: "closed" });
    }
    await F.deleteDoc(F.doc(r.ref, "members", user.uid));
  } catch (e) { console.error(e); }
  if (A.tab === "vs") renderVs($("#vsBox"));
}
async function rejoinRoom() {
  let code = ""; try { code = localStorage.getItem(ROOM_KEY) || ""; } catch (e) { /* 讀不到就不回房 */ }
  if (!code || room) return;
  try {
    const ref = F.doc(db, "rooms", code), [rs, ms] = await Promise.all([F.getDoc(ref), F.getDoc(F.doc(ref, "members", user.uid))]);
    if (!rs.exists() || !ms.exists() || rs.data().status === "closed") return saveRoom("");
    const d = rs.data(), playing = d.status === "playing";
    if (playing) F.updateDoc(ms.ref, { p: -1 }).catch(() => {});   // 那一局我已經斷線，不重打，算棄權
    enterRoom(code, playing ? d.round : -1); A.showTab("vs"); A.toast("已回到你的房間");
  } catch (e) { console.error(e); }
}
async function kickMember(uid) { try { await F.deleteDoc(F.doc(room.ref, "members", uid)); } catch (e) { A.toast("操作失敗：" + (e.code || e.message)); } }
async function inviteFriend(fid) {
  const r = room, d = r?.d; if (!d) return;
  try {
    await F.setDoc(F.doc(db, "users", fid, "invites", r.code + "_" + user.uid), { from: user.uid, fromName: A.S.name, fromAv: A.S.avatar, code: r.code, roomName: d.name, ph: d.ph, createdAt: F.serverTimestamp() });
    A.sfx.tap(); A.toast("已送出邀請");
  } catch (e) { A.toast("邀請失敗：" + (e.code || e.message)); }
}
const othersBusy = r => [...r.members].some(([id, m]) => id !== user.uid && m.r === r.d.round && r.d.round > 0 && m.p >= 0 && m.p < r.d.qs.length);
async function startRoom() {
  const r = room, d = r?.d; if (!d || d.host !== user.uid) return;
  if (r.members.size < 2) return A.toast("至少要 2 個人才能開始");
  if (r.inGame || (d.status !== "waiting" && othersBusy(r))) return A.toast("還有人在作答，等大家打完");
  try { await F.updateDoc(r.ref, { status: "playing", qs: A.makeVsQuestions(d.nq, d.lessons), round: (d.round || 0) + 1, startedAt: F.serverTimestamp() }); }
  catch (e) { A.toast("開始失敗：" + (e.code || e.message)); }
}

// 全部玩家用同一組題目；每個人把進度與分數寫在自己的 members 文件，其他人即時看到計分板
function startRoomGame() {
  const r = room, d = r.d, round = d.round, n = d.qs.length, meRef = F.doc(r.ref, "members", user.uid);
  r.round = round; r.inGame = true;
  let my = { p: 0, s: 0 }, mine = null, done = false, tm = 0;
  F.updateDoc(meRef, { r: round, p: 0, s: 0 }).catch(() => {});
  const cur = m => m.r === round;
  const rows = () => [...r.members].map(([id, m]) => id === user.uid ? { id, av: m.av, name: m.name, p: my.p, s: my.s, me: true }
    : { id, av: m.av, name: m.name, p: cur(m) ? m.p : 0, s: cur(m) ? m.s : 0 });
  const others = () => [...r.members].filter(([id]) => id !== user.uid);
  const allDone = () => others().every(([, m]) => cur(m) && (m.p >= n || m.p < 0));
  const vs = {
    qs: d.qs,
    onAnswer: (p, s) => { my = { p, s }; F.updateDoc(meRef, { r: round, p, s }).catch(() => {}); vs.setBoard?.(rows()); },
    onQuit: () => { done = true; r.inGame = false; r.board = null; clearTimeout(tm); F.updateDoc(meRef, { p: -1 }).catch(() => {}); },
    onEnd: (score, right, missed) => {
      mine = { score, right, missed };
      A.openStage(`${A.topBar()}<div class="big" style="font-size:28px">等其他人作答完…</div>
        <p class="center">你的分數 <b>${score}</b>（答對 ${right}/${n}）<br><span id="waitOpp"></span></p>`);
      tm = setTimeout(finish, 90000); r.board();
    },
  };
  r.board = () => {
    if (done) return;
    vs.setBoard?.(rows());
    const w = $("#waitOpp"); if (w) w.textContent = `已完成 ${others().filter(([, m]) => cur(m) && (m.p >= n || m.p < 0)).length}/${others().length} 人`;
    if (mine && allDone()) finish();
  };
  function finish() {
    if (done) return; done = true; clearTimeout(tm); r.inGame = false; r.board = null;
    const list = rows().map(x => x.me ? { ...x, p: n, s: mine.score } : x).sort((a, b) => b.s - a.s);
    const live = list.filter(x => !x.me && x.p >= 0), S = A.S;
    const res = live.some(x => x.s > mine.score) ? "lose" : live.some(x => x.s === mine.score) ? "tie" : "win";
    // 防刷：兩個帳號互打會雙贏，所以每天只有前 5 場有獎勵、同一個對手最多 2 場；對手都棄權不算
    const dk = new Date().toLocaleDateString("sv");
    if (!S.vsDay || S.vsDay.d !== dk) S.vsDay = { d: dk, n: 0, o: {} };
    const rewarded = live.length > 0 && S.vsDay.n < 5 && live.some(x => (S.vsDay.o[x.id] || 0) < 2);
    if (rewarded) { S.vsDay.n++; live.forEach(x => { S.vsDay.o[x.id] = (S.vsDay.o[x.id] || 0) + 1; }); }
    if (rewarded && res === "win") S.wins = (S.wins || 0) + 1; if (res === "lose") S.losses = (S.losses || 0) + 1;
    S.games++;
    const xpGet = rewarded ? mine.right * 4 : 0;
    const coins = A.gain(xpGet, rewarded ? { win: 20, lose: 0, tie: 5 }[res] : 0); A.checkAch(); A.sfx[res === "lose" ? "bad" : "win"]();
    const board = list.map((x, i) => `<div class="person ${x.me ? "me-row" : ""}"><span class="rank r${i + 1}">${i + 1}</span><span class="av">${esc(x.av)}</span>
      <div class="info"><b>${esc(x.name)}${x.me ? "（我）" : ""}</b></div><span class="score">${x.p < 0 ? "棄權" : x.s + " 分"}</span></div>`).join("");
    const closed = r.closed;
    if (closed) { dropRoom(); }
    else if (d.host === user.uid) F.updateDoc(r.ref, { status: "waiting" }).catch(() => {});
    A.openStage(`${A.topBar()}<div class="big">${{ win: "勝利！", lose: "惜敗", tie: "平手" }[res]}</div>
      <p class="center">${rewarded ? `獲得 ${xpGet} XP・<b style="color:var(--gold)">${coins} 金幣</b>` : `<span class="muted">${live.length ? "今天的對戰獎勵已達上限（每天 5 場、同一人 2 場）" : "其他人都棄權了，不計獎勵"}</span>`}${closed ? `<br><span class="muted">房主已關閉房間</span>` : ""}</p>
      <div class="card">${board}</div>
      ${A.missedTable(mine.missed)}
      <div class="bar" style="justify-content:center"><button class="btn" data-act="vs" type="button">${closed ? "回大廳" : "回房間"}</button><button class="btn ghost" data-act="home" type="button">回選單</button></div>`);
    ON.dirty(true);
  }
  A.playQuiz(null, vs);
  vs.setBoard?.(rows());
}

/* ---------- 畫面 ---------- */
function gate(box) {
  if (!cfg) { box.innerHTML = `<div class="card"><h2>線上功能還沒開通</h2><p class="muted" style="margin:0">網站管理者還沒填 Firebase 設定（firebase-config.js）。單機遊戲、商店、個人資料都能正常使用。</p></div>`; return false; }
  if (loadErr) { box.innerHTML = `<div class="card"><h2>線上功能暫時無法使用</h2><p class="muted" style="margin:0">${loadErr}</p></div>`; return false; }
  if (!auth) { box.innerHTML = `<div class="card"><p class="muted">載入中…</p></div>`; return false; }
  if (!user) {
    box.innerHTML = `<div class="card"><h2>登入才能使用</h2><p class="muted" style="margin:0">可以用 Google 或「遊客」登入。登入後能加好友、看誰在線、跟朋友對戰、上排行榜，進度也會存在雲端。遊客不用綁定任何帳號。</p>
      <div class="row"><button class="btn" data-login type="button">用 Google 登入</button><button class="btn ghost" data-guest type="button">遊客登入</button></div></div>`;
    box.querySelector("[data-login]").onclick = login; box.querySelector("[data-guest]").onclick = loginGuest; return false;
  }
  return true;
}
function renderAccount(box) {
  if (!cfg || loadErr || !auth) { box.innerHTML = `<h2>帳號</h2><p class="muted" style="margin:0">${!cfg ? "線上功能還沒開通，目前進度只存在這台裝置。" : loadErr || "載入中…"}</p>`; return; }
  if (!user) {
    box.innerHTML = `<h2>帳號</h2><p class="muted" style="margin:0">目前是訪客，進度只存在這台裝置。登入後會存到雲端，換裝置也接得上；排行榜和好友只會看到你的暱稱，不會顯示 Google 名字或信箱。</p>
      <div class="row"><button class="btn" data-login type="button">用 Google 登入</button><button class="btn ghost" data-guest type="button">遊客登入</button></div>`;
    box.querySelector("[data-login]").onclick = login; box.querySelector("[data-guest]").onclick = loginGuest; return;
  }
  const g = user.isAnonymous;
  box.innerHTML = `<h2>帳號</h2><p class="muted" style="margin:0">${g ? "目前是<b>遊客</b>，進度存在雲端的遊客帳號。清除瀏覽器資料或登出就找不回來，想長期保存請綁定 Google。" : "已用 Google 登入，進度會自動存到雲端。"}</p>
    <div class="row">好友代碼 <span class="code">${esc(A.S.code || "…")}</span></div>
    <div class="row">${g ? `<button class="btn small" data-link type="button">綁定 Google 保存進度</button>` : ""}<button class="btn ghost small" data-logout type="button">登出</button></div>`;
  box.querySelector("[data-link]")?.addEventListener("click", linkGoogle);
  box.querySelector("[data-logout]").onclick = e => A.armed(e.target, g ? "遊客登出後帳號會消失，確定？" : "再按一次確定登出", async () => { await F.signOut(auth); try { localStorage.removeItem("mock1-vocab-game"); } catch (e) {} location.reload(); });   // 本機存檔一併清掉，免得下一個帳號（尤其新遊客）繼承成就和名字
}
function openCreate() {
  if (room) return A.toast("你已經在房間裡了");
  const sel = new Set(A.LESSONS);
  const m = A.modal(`<h2 style="margin:0">建立房間</h2>
    <input class="field" id="rnName" maxlength="14" placeholder="房間名稱（可不填）" autocomplete="off">
    <div class="row" style="justify-content:space-between">人數上限<select class="field" id="rnMax" style="flex:0 0 110px">${[2, 3, 4, 5, 6, 8].map(k => `<option value="${k}" ${k === 4 ? "selected" : ""}>${k} 人</option>`).join("")}</select></div>
    <div class="row" style="justify-content:space-between">題數<select class="field" id="rnNq" style="flex:0 0 110px">${[10, 15, 20].map(k => `<option value="${k}">${k} 題</option>`).join("")}</select></div>
    <div class="row" style="justify-content:space-between"><span><b>單元</b><span class="muted">（可複選）</span></span><span class="row"><button class="btn small ghost" type="button" data-all="1">全選</button><button class="btn small ghost" type="button" data-all="0">全不選</button></span></div>
    <div class="seg" id="rnLs">${A.LESSONS.map(l => `<button class="chip" type="button" data-l="${esc(l)}" aria-pressed="true">${esc(l)}</button>`).join("")}</div>
    <label style="display:flex;gap:8px;align-items:center;text-align:left"><input type="checkbox" id="rnPub" checked> 公開房間（出現在大廳，別人可以直接加入）</label>
    <input class="field" id="rnPw" maxlength="12" placeholder="房間密碼（可不填）" autocomplete="off">
    <div class="row" style="justify-content:center"><button class="btn" data-ok type="button">建立</button><button class="btn ghost" data-close type="button">取消</button></div>`);
  m.addEventListener("click", async e => {
    const all = e.target.closest("[data-all]");
    if (all) {
      const on = all.dataset.all === "1";
      m.querySelectorAll("#rnLs .chip").forEach(x => { on ? sel.add(x.dataset.l) : sel.delete(x.dataset.l); x.setAttribute("aria-pressed", on); });
      return;
    }
    const c = e.target.closest(".chip");
    if (c) { const l = c.dataset.l; sel.has(l) ? sel.delete(l) : sel.add(l); c.setAttribute("aria-pressed", sel.has(l)); return; }
    const ok = e.target.closest("[data-ok]"); if (!ok) return;
    const nq = +m.querySelector("#rnNq").value, ls = A.LESSONS.filter(l => sel.has(l));
    if (!ls.length) return A.toast("至少選一個單元");
    if (bookCount(ls) < Math.max(nq, 8)) return A.toast(`選的單元單字太少（只有 ${bookCount(ls)} 個），多選幾個單元或減少題數`);
    ok.disabled = true;
    const done = await createRoom({ name: m.querySelector("#rnName").value.trim(), max: +m.querySelector("#rnMax").value, nq, lessons: ls,
      pub: m.querySelector("#rnPub").checked, pw: m.querySelector("#rnPw").value.trim() });
    if (done) m.remove(); else ok.disabled = false;
  });
}
function searchBox() {
  let s = $("#roomSearch");
  if (!s) {
    s = document.createElement("form"); s.id = "roomSearch"; s.className = "rsearch"; s.autocomplete = "off";
    s.innerHTML = `<input class="field" inputmode="numeric" maxlength="6" placeholder="輸入房間號" aria-label="房間號"><button class="btn small" type="submit">搜尋加入</button>`;
    s.onsubmit = e => { e.preventDefault(); const i = s.querySelector("input"), v = i.value.trim(); if (!/^\d{6}$/.test(v)) return A.toast("房間號是 6 位數字"); i.value = ""; joinRoom(v); };
    $("#tab-vs").append(s);
  }
  return s;
}
function renderRoom(box) {
  const r = room, d = r.d;
  if (!d) { box.innerHTML = `<div class="card"><p class="muted">進入房間中…</p></div>`; return; }
  const isHost = d.host === user.uid, idle = d.status === "waiting", canStart = idle || (!r.inGame && !othersBusy(r));
  const ms = [...r.members].sort((a, b) => (a[0] === d.host ? -1 : b[0] === d.host ? 1 : 0) || (a[1].at?.toMillis?.() || 0) - (b[1].at?.toMillis?.() || 0));
  const fl = friendIds.map(id => [id, friends.get(id)]).filter(([, f]) => f && !r.members.has(id))
    .sort((x, y) => (Date.now() - seenMs(x[1]) < ONLINE_MS ? 0 : 1) - (Date.now() - seenMs(y[1]) < ONLINE_MS ? 0 : 1));
  box.innerHTML = `
    <div class="card"><div class="bar"><h2>${d.locked ? "🔒 " : ""}${esc(d.name)}</h2><button class="btn small ghost" data-leave type="button">${isHost ? "關閉房間" : "離開房間"}</button></div>
      <div class="row">房間號 <span class="code">${esc(r.code)}</span><button class="btn small ghost" data-copy type="button">複製</button></div>
      <div class="row"><span class="pill">${d.isPublic ? "公開" : "私人"}</span><span class="pill">${r.members.size}/${d.max} 人</span><span class="pill">${d.nq} 題</span><span class="pill">${esc(lessonText(d))}</span></div></div>
    <div class="card"><h2>玩家（${r.members.size}/${d.max}）</h2><div class="list">${ms.map(([id, m]) => {
      const fr = friendIds.includes(id), me = id === user.uid;
      return `<div class="person ${me ? "me-row" : ""}"><span class="av">${esc(m.av)}</span><div class="info"><b>${id === d.host ? "👑 " : ""}${esc(m.name)}${me ? "（我）" : ""}</b><small>Lv ${m.lv || 1}${fr ? "・好友" : ""}</small></div>
        ${!me && !fr ? `<button class="btn small" data-befriend="${id}" type="button">加好友</button>` : ""}
        ${isHost && !me ? `<button class="btn small ghost" data-kick="${id}" type="button" aria-label="請出房間">✕</button>` : ""}</div>`;
    }).join("")}</div>
      ${isHost ? `<button class="btn" data-start type="button" ${r.members.size < 2 || !canStart ? "disabled" : ""}>${canStart ? (r.members.size < 2 ? "至少 2 人才能開始" : "開始對戰") : "對戰進行中…"}</button>`
        : `<p class="muted" style="margin:0">${idle ? "等房主開始對戰…" : "對戰進行中…"}</p>`}
      <p class="muted" style="margin:0">贏 +20 金幣、平手 +5。為了防刷，每天前 5 場、同一位對手最多 2 場有獎勵，對手棄權不算。</p></div>
    <div class="card"><h2>邀請好友</h2>${r.members.size >= d.max ? `<p class="muted" style="margin:0">房間已滿。</p>`
      : fl.length ? `<div class="list">${fl.map(([id, f]) => `<div class="person"><span class="av">${esc(f.avatar || "🙂")}</span>
        <div class="info"><b>${A.nameHtml(f.name || "玩家", id === devUid)}</b><small>Lv ${A.lvOf(f.xp || 0)}・</small>${statusHtml(f)}</div>
        <button class="btn small" data-invite="${id}" type="button">邀請</button></div>`).join("")}</div>`
      : `<p class="muted" style="margin:0">${friendIds.length ? "好友都在房間裡了。" : "還沒有好友，也可以把房間號給朋友。"}</p>`}</div>`;
  box.onclick = e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.leave !== undefined) A.armed(b, "確定？", leaveRoom);
    if (b.dataset.copy !== undefined) navigator.clipboard?.writeText(r.code).then(() => A.toast("已複製房間號"), () => A.toast("房間號是 " + r.code));
    if (b.dataset.start !== undefined) startRoom();
    if (b.dataset.befriend) { b.disabled = true; b.textContent = "送出中…"; sendRequest(b.dataset.befriend).then(ok => { b.textContent = ok ? "已申請" : "加好友"; b.disabled = !!ok; }); }
    if (b.dataset.kick) A.armed(b, "確定？", () => kickMember(b.dataset.kick));
    if (b.dataset.invite) { inviteFriend(b.dataset.invite); b.disabled = true; b.textContent = "已邀請"; }
  };
}
function renderVs(box) {
  const ss = $("#roomSearch");
  if (!gate(box)) { ss?.setAttribute("hidden", ""); return; }
  if (room) { ss?.setAttribute("hidden", ""); return renderRoom(box); }
  searchBox().hidden = false;
  const me = A.S, list = friendIds.map(id => [id, friends.get(id)]).filter(([, d]) => d)
    .sort((x, y) => (Date.now() - seenMs(x[1]) < ONLINE_MS ? 0 : 1) - (Date.now() - seenMs(y[1]) < ONLINE_MS ? 0 : 1) || (y[1].xp || 0) - (x[1].xp || 0));
  const onlineN = list.filter(([, d]) => Date.now() - seenMs(d) < ONLINE_MS).length;
  box.innerHTML = `
    <div class="card"><div class="bar"><h2>房間大廳</h2><button class="btn" data-create type="button">＋ 建立房間</button></div>
      <p class="muted" style="margin:0">開一間房間，選單元、題數、人數，邀請好友或把房間號給朋友；公開房間會出現在下面讓大家加入。也可以用右下角的框輸入房間號直接加入。</p>
      <div class="list">${lobbyRooms.length ? lobbyRooms.map(r => `<div class="person"><span class="av">${esc(r.hostAv || "🙂")}</span>
        <div class="info"><b>${r.locked ? "🔒 " : ""}${esc(r.name)}</b><small>房主 ${esc(r.hostName)}・房間號 ${esc(r.id)}・最多 ${r.max} 人・${r.nq} 題・${esc(lessonText(r))}</small></div>
        <button class="btn small" data-join="${esc(r.id)}" type="button">加入</button></div>`).join("")
        : `<p class="muted">目前沒有公開的房間，自己開一間吧。</p>`}</div></div>
    <div class="card"><div class="bar"><h2>我的好友代碼</h2><span class="code">${esc(me.code || "…")}</span></div>
      <p class="muted" style="margin:0">把代碼給朋友，或輸入朋友的代碼送出好友申請。在房間裡遇到沒加過的人，也可以按「加好友」，對方同意才會成為好友。</p>
      <div class="type"><input class="field" id="fcode" maxlength="6" placeholder="輸入朋友的 6 位代碼" autocapitalize="characters" autocomplete="off"><button class="btn" data-add type="button">加好友</button></div>
      <div class="row"><button class="btn small ghost" data-copy type="button">複製我的代碼</button></div></div>
    ${reqs.size ? `<div class="card" style="border-color:var(--hot)"><h2>好友申請（${reqs.size}）</h2><div class="list">${[...reqs.entries()].map(([id, v]) => `<div class="person"><span class="av">${esc(v.fromAv || "🙂")}</span>
      <div class="info"><b>${esc(v.fromName || "玩家")}</b><small>Lv ${v.lv || 1}・想加你為好友</small></div>
      <button class="btn small green" data-ok="${id}" type="button">允許</button><button class="btn small ghost" data-no="${id}" type="button">拒絕</button></div>`).join("")}</div></div>` : ""}
    <div class="card"><div class="bar"><h2>好友（${list.length}）</h2><span class="status on"><i></i>${onlineN} 人在線</span></div>
      <p class="muted" style="margin:0">開好房間後，在房間裡就能邀請好友。</p>
      <div class="list">${list.length ? list.map(([id, d]) => `<div class="person"><span class="av">${esc(d.avatar || "🙂")}</span>
        <div class="info"><b>${A.nameHtml(d.name || "玩家", id === devUid)}</b><small>${A.titleHtml(d.title || "", id === devUid)}・Lv ${A.lvOf(d.xp || 0)}・</small>${statusHtml(d)}</div>
        <button class="btn small ghost" data-del="${id}" type="button" aria-label="刪除好友">✕</button></div>`).join("")
        : `<p class="muted">還沒有好友，輸入朋友的代碼加一個吧。</p>`}</div></div>`;
  box.onclick = e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.create !== undefined) openCreate();
    if (b.dataset.join) joinRoom(b.dataset.join);
    if (b.dataset.add !== undefined) addFriend($("#fcode").value);
    if (b.dataset.copy !== undefined) navigator.clipboard?.writeText(me.code).then(() => A.toast("已複製代碼"), () => A.toast("代碼是 " + me.code));
    if (b.dataset.del) A.armed(b, "確定？", () => removeFriend(b.dataset.del));
    if (b.dataset.ok) answerReq(b.dataset.ok, true);
    if (b.dataset.no) answerReq(b.dataset.no, false);
  };
  const inp = $("#fcode"); if (inp) inp.onkeydown = e => { if (e.key === "Enter") addFriend(inp.value); };
}
const CATS = [["xp", "等級", "desc"], ["best.quiz", "快問連擊", "desc"], ["best.rock", "單字隕石", "desc"], ["best.spell", "拼字工坊", "desc"],
  ["best.listen", "聽音拼字", "desc"], ["best.match", "配對最快", "asc"], ["wins", "對戰勝場", "desc"], ["achN", "成就數", "desc"]];
const getPath = (d, p) => p.split(".").reduce((o, k) => o?.[k], d);
function fmt(cat, d) {
  const v = getPath(d, cat);
  if (cat === "xp") return `Lv ${A.lvOf(v || 0)}<small class="muted"> ${v || 0} XP</small>`;
  if (cat === "best.match") return `${v.toFixed(1)} 秒`;
  if (cat === "achN") return `${v || 0} 個`;
  return cat === "wins" ? `${v || 0} 勝` : `${v} 分`;
}
async function renderRank(box) {
  if (!gate(box)) return;
  const [cat, label, dir] = CATS.find(c => c[0] === rankCat);
  box.innerHTML = `<div class="card"><div class="seg" id="rkCat">${CATS.map(c => `<button class="chip" data-c="${c[0]}" aria-pressed="${c[0] === rankCat}">${c[1]}</button>`).join("")}</div>
    <div class="seg" id="rkScope"><button class="chip" data-s="all" aria-pressed="${rankScope === "all"}">全部玩家</button><button class="chip" data-s="friends" aria-pressed="${rankScope === "friends"}">只看好友</button></div></div>
    <div class="card"><div class="bar"><h2>${label}排行</h2><span class="muted">${rankScope === "all" ? "前 50 名" : "我和好友"}</span></div><div class="list" id="rkList"><p class="muted">載入中…</p></div></div>`;
  box.querySelector("#rkCat").onclick = e => { const c = e.target.dataset.c; if (c) { rankCat = c; renderRank(box); } };
  box.querySelector("#rkScope").onclick = e => { const s = e.target.dataset.s; if (s) { rankScope = s; renderRank(box); } };
  let rows;
  try {
    if (rankScope === "friends") {
      rows = [[user.uid, pub()], ...friendIds.map(id => [id, friends.get(id)]).filter(([, d]) => d)]
        .filter(([, d]) => cat === "xp" || cat === "wins" || cat === "achN" || getPath(d, cat) != null);
      rows.sort((x, y) => (dir === "asc" ? 1 : -1) * ((getPath(x[1], cat) || 0) - (getPath(y[1], cat) || 0)));
    } else {
      const c = rankCache[cat];
      if (c && Date.now() - c.t < 30000) rows = c.rows;
      else {
        const s = await F.getDocs(F.query(F.collection(db, "users"), F.orderBy(cat, dir), F.limit(50)));
        rows = s.docs.map(d => [d.id, d.data()]); rankCache[cat] = { t: Date.now(), rows };
      }
    }
  } catch (e) { console.error(e); const l = $("#rkList"); if (l) l.innerHTML = `<p class="muted">讀取排行榜失敗（${esc(e.code || e.message)}）</p>`; return; }
  const l = $("#rkList"); if (!l || rankCat !== cat) return;
  l.innerHTML = rows.length ? rows.map(([id, d], i) => `<div class="person ${id === user.uid ? "me-row" : ""}"><span class="rank r${i + 1}">${i + 1}</span><span class="av">${esc(d.avatar || "🙂")}</span>
    <div class="info"><b>${A.nameHtml(d.name || "玩家", id === devUid)}${id === user.uid ? "（我）" : ""}</b><small>${A.titleHtml(d.title || "", id === devUid)}${d.joined ? `・${d.joined} 加入` : ""}</small></div><span class="score">${fmt(cat, d)}</span></div>`).join("")
    : `<p class="muted">還沒有人有這項紀錄，快去玩一場搶第一！</p>`;
}

boot();
