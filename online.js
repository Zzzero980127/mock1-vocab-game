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
let devUid = "", friendIds = [], waiting = null, invites = new Map(), rankCache = {}, rankCat = "xp", rankScope = "all";

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
    auth = au.getAuth(fb); db = fs.getFirestore(fb);
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
  listenFriends(); listenInvites();
  A.refreshTab();
}
function onLogout() {
  clearInterval(beatTimer); unsubs.forEach(u => u()); unsubs = []; friendUnsubs.forEach(u => u()); friendUnsubs = [];
  friends.clear(); friendIds = []; invites.clear(); renderInvites();
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
        if (A.tab === "vs") renderVs($("#vsBox"));
      }));
    }
    if (A.tab === "vs") renderVs($("#vsBox"));
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
    const fid = c.data().uid;
    if (friendIds.includes(fid)) return A.toast("你們已經是好友了");
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

/* ---------- 好友對戰 ---------- */
async function challenge(fid) {
  if (waiting) return A.toast("你已經在等一場對戰了");
  const f = friends.get(fid) || {}, S = A.S;
  try {
    const ref = await F.addDoc(F.collection(db, "matches"), {
      a: user.uid, b: fid, aName: S.name, aAv: S.avatar, bName: f.name || "好友", bAv: f.avatar || "🙂",
      status: "pending", qs: A.makeVsQuestions(10), sa: 0, sb: 0, pa: 0, pb: 0, createdAt: F.serverTimestamp() });
    const timer = setTimeout(() => { if (waiting?.id === ref.id) cancelWait("對方沒有回應"); }, 60000);
    const un = F.onSnapshot(ref, s => {
      const d = s.data(); if (!d || waiting?.id !== ref.id) return;
      if (d.status === "playing") { clearTimeout(timer); un(); waiting = null; startMatch(ref, d, "a"); }
      if (d.status === "declined") { clearTimeout(timer); cancelWait(`${d.bName} 婉拒了挑戰`); }
    });
    waiting = { id: ref.id, ref, name: f.name, un, timer };
    A.sfx.tap(); renderVs($("#vsBox"));
  } catch (e) { console.error(e); A.toast("發起挑戰失敗：" + (e.code || e.message)); }
}
function cancelWait(msg) {
  if (!waiting) return;
  const w = waiting; waiting = null; w.un(); clearTimeout(w.timer);
  F.updateDoc(w.ref, { status: "cancelled" }).catch(() => {});
  if (msg) A.toast(msg);
  if (A.tab === "vs") renderVs($("#vsBox"));
}
function listenInvites() {
  const q = F.query(F.collection(db, "matches"), F.where("b", "==", user.uid), F.where("status", "==", "pending"));
  unsubs.push(F.onSnapshot(q, snap => {
    invites.clear();
    snap.docs.forEach(d => {
      const v = d.data(), t = v.createdAt?.toMillis ? v.createdAt.toMillis() : Date.now();
      if (Date.now() - t < 90000) invites.set(d.id, { ref: d.ref, ...v });
    });
    snap.docChanges().forEach(c => { if (c.type === "added" && invites.has(c.doc.id)) A.sfx.ding(); });
    renderInvites();
  }, e => { console.error(e); A.toast("收不到對戰邀請：" + (e.code || e.message)); }));
}
function renderInvites() {
  document.querySelectorAll(".invite").forEach(x => x.remove());
  const first = [...invites.entries()][0]; if (!first) return;
  const [id, v] = first, box = document.createElement("div");
  box.className = "invite";
  box.innerHTML = `<span class="av">${esc(v.aAv)}</span><b style="flex:1;min-width:140px">${esc(v.aName)} 向你發起單字對戰！</b>
    <button class="btn small green" data-a="yes" type="button">接受</button><button class="btn small ghost" data-a="no" type="button">拒絕</button>`;
  box.onclick = async e => {
    const a = e.target.closest("button")?.dataset.a; if (!a) return;
    invites.delete(id); box.remove();
    if (a === "no") return F.updateDoc(v.ref, { status: "declined" }).catch(() => {});
    try {
      const s = await F.getDoc(v.ref);
      if (s.data()?.status !== "pending") return A.toast("這場挑戰已經失效");
      await F.updateDoc(v.ref, { status: "playing" });
      startMatch(v.ref, s.data(), "b");
    } catch (err) { A.toast("加入對戰失敗：" + (err.code || err.message)); }
  };
  document.body.append(box);
}
function startMatch(ref, d, side) {
  const o = side === "a" ? "b" : "a", oppName = `${d[o + "Av"]} ${d[o + "Name"]}`;
  let opp = { p: 0, s: 0 }, mine = null, done = false, un = null, tm = 0;
  const vs = {
    qs: d.qs, opp: oppName,
    onAnswer: (n, sc) => F.updateDoc(ref, { ["p" + side]: n, ["s" + side]: sc }).catch(() => {}),
    onQuit: () => { un?.(); clearTimeout(tm); F.updateDoc(ref, { ["p" + side]: -1 }).catch(() => {}); },
    onEnd: (score, right, missed) => {
      mine = { score, right, missed };
      A.openStage(`${A.topBar()}<div class="big" style="font-size:28px">等對手作答完…</div>
        <p class="center">你的分數 <b>${score}</b>（答對 ${right}/10）<br><span id="waitOpp">${esc(oppName)}：第 ${opp.p} 題</span></p>`);
      tm = setTimeout(finish, 90000);
      window.__vsStop = () => { un?.(); clearTimeout(tm); };
      check();
    },
  };
  un = F.onSnapshot(ref, s => {
    const v = s.data(); if (!v) return;
    opp = { p: v["p" + o], s: v["s" + o] };
    vs.setOpp?.(Math.max(0, opp.p), opp.s);
    const w = $("#waitOpp"); if (w) w.textContent = opp.p < 0 ? `${oppName} 中途離開了` : `${oppName}：第 ${opp.p} 題`;
    check();
  });
  function check() { if (mine && !done && (opp.p >= d.qs.length || opp.p < 0)) finish(); }
  function finish() {
    if (done) return; done = true; un?.(); clearTimeout(tm);
    const S = A.S, quit = opp.p < 0, res = quit || mine.score > opp.s ? "win" : mine.score < opp.s ? "lose" : "tie";
    // 防刷：兩個帳號互打會雙贏，所以每天只有前 5 場有獎勵、同一個對手最多 2 場，對手棄權不算
    const oppId = side === "a" ? d.b : d.a, dk = new Date().toLocaleDateString("sv");
    if (!S.vsDay || S.vsDay.d !== dk) S.vsDay = { d: dk, n: 0, o: {} };
    const rewarded = !quit && S.vsDay.n < 5 && (S.vsDay.o[oppId] || 0) < 2;
    if (rewarded) { S.vsDay.n++; S.vsDay.o[oppId] = (S.vsDay.o[oppId] || 0) + 1; }
    if (rewarded && res === "win") S.wins = (S.wins || 0) + 1; if (res === "lose") S.losses = (S.losses || 0) + 1;
    S.games++;
    const xpGet = rewarded ? mine.right * 4 : 0;
    const coins = A.gain(xpGet, rewarded ? { win: 20, lose: 0, tie: 5 }[res] : 0); A.checkAch(); A.sfx[res === "lose" ? "bad" : "win"]();
    F.updateDoc(ref, { status: "done" }).catch(() => {});
    A.openStage(`${A.topBar()}<div class="big">${{ win: "勝利！", lose: "惜敗", tie: "平手" }[res]}</div>
      <p class="center">你 <b>${mine.score}</b> ： <b>${quit ? "棄權" : opp.s}</b> ${esc(oppName)}<br>${rewarded ? `獲得 ${xpGet} XP・<b style="color:var(--gold)">${coins} 金幣</b>` : `<span class="muted">${quit ? "對手棄權，不計獎勵" : "今天的對戰獎勵已達上限（每天 5 場、同一人 2 場）"}</span>`}</p>
      ${A.missedTable(mine.missed)}
      <div class="bar" style="justify-content:center"><button class="btn" data-act="vs" type="button">回好友列表</button><button class="btn ghost" data-act="home" type="button">回選單</button></div>`);
    ON.dirty(true);
  }
  A.playQuiz(null, vs);
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
  box.querySelector("[data-logout]").onclick = e => A.armed(e.target, g ? "遊客登出後帳號會消失，確定？" : "再按一次確定登出", () => F.signOut(auth));
}
function renderVs(box) {
  if (!gate(box)) return;
  const me = A.S, list = friendIds.map(id => [id, friends.get(id)]).filter(([, d]) => d)
    .sort((x, y) => (Date.now() - seenMs(x[1]) < ONLINE_MS ? 0 : 1) - (Date.now() - seenMs(y[1]) < ONLINE_MS ? 0 : 1) || (y[1].xp || 0) - (x[1].xp || 0));
  const onlineN = list.filter(([, d]) => Date.now() - seenMs(d) < ONLINE_MS).length;
  box.innerHTML = `
    ${waiting ? `<div class="card" style="border-color:var(--hot)"><div class="bar"><b>等待 ${esc(waiting.name)} 接受挑戰…（最多 60 秒）</b><button class="btn small ghost" data-cancel type="button">取消</button></div></div>` : ""}
    <div class="card"><div class="bar"><h2>我的好友代碼</h2><span class="code">${esc(me.code || "…")}</span></div>
      <p class="muted" style="margin:0">把代碼給朋友，或輸入朋友的代碼加好友。</p>
      <div class="type"><input class="field" id="fcode" maxlength="6" placeholder="輸入朋友的 6 位代碼" autocapitalize="characters" autocomplete="off"><button class="btn" data-add type="button">加好友</button></div>
      <div class="row"><button class="btn small ghost" data-copy type="button">複製我的代碼</button></div></div>
    <div class="card"><div class="bar"><h2>好友（${list.length}）</h2><span class="status on"><i></i>${onlineN} 人在線</span></div>
      <p class="muted" style="margin:0">對戰：同一組 10 題快問，限時作答，看誰分數高。贏 +20 金幣、平手 +5。為了防刷，每天前 5 場、同一位好友最多 2 場有獎勵，對手棄權不算。</p>
      <div class="list">${list.length ? list.map(([id, d]) => `<div class="person"><span class="av">${esc(d.avatar || "🙂")}</span>
        <div class="info"><b>${A.nameHtml(d.name || "玩家", id === devUid)}</b><small>${A.titleHtml(d.title || "", id === devUid)}・Lv ${A.lvOf(d.xp || 0)}・</small>${statusHtml(d)}</div>
        <button class="btn small" data-vs="${id}" type="button" ${waiting ? "disabled" : ""}>挑戰</button>
        <button class="btn small ghost" data-del="${id}" type="button" aria-label="刪除好友">✕</button></div>`).join("")
        : `<p class="muted">還沒有好友，輸入朋友的代碼加一個吧。</p>`}</div></div>`;
  box.onclick = e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.add !== undefined) addFriend($("#fcode").value);
    if (b.dataset.copy !== undefined) navigator.clipboard?.writeText(me.code).then(() => A.toast("已複製代碼"), () => A.toast("代碼是 " + me.code));
    if (b.dataset.vs) { const d = friends.get(b.dataset.vs); if (Date.now() - seenMs(d) >= ONLINE_MS) A.toast("對方目前離線，可能收不到挑戰"); challenge(b.dataset.vs); }
    if (b.dataset.del) A.armed(b, "確定？", () => removeFriend(b.dataset.del));
    if (b.dataset.cancel !== undefined) cancelWait();
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
