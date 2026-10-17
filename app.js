/* 一模單字遊樂場：遊戲、金幣、商店、個人資料（離線也能用）。線上功能（登入、好友、對戰、排行）在 online.js */
const BOOKN = DATA.length;   // 課本單字 id 0..BOOKN-1 永遠不變；大考詞彙表接在後面（舊紀錄不會錯亂）
const W = DATA.map((x, i) => ({ ...x, id: i })).concat(typeof BANK === "undefined" ? [] : BANK.map((r, i) => ({ w: r[0], p: r[1], c: r[2], l: "Lv" + r[3], lv: r[3], b: 1, id: BOOKN + i })));
const $ = s => document.querySelector(s);
const LESSONS = [...new Set(W.filter(x => !x.b).map(x => x.l))];
const KEY = "mock1-vocab-game";

// ---------- 更新日誌（新版本加在最上面） ----------
const CHANGELOG = [
  { v: "2.7.10", date: "2026-10-17", items: [
    "極光造型重做：改用即時繪製的波浪光幕，綠、青、紫的簾幕會像真的極光一樣起伏流動，不再是燈管"
  ]},
  { v: "2.7.9", date: "2026-10-17", items: [
    "極光造型改成縮時攝影風格：清晰的垂直光柱快速飄移、擺動、閃爍、變色，不再模糊"
  ]},
  { v: "2.7.8", date: "2026-10-17", items: [
    "星空造型：星星會閃爍、整片星空緩慢飄移；熔岩造型：底部岩漿光暈起伏、火星往上飄"
  ]},
  { v: "2.7.7", date: "2026-10-17", items: [
    "修正「極光」造型幾乎看不出動畫：改成兩層會飄動、變形的綠紫極光光幕"
  ]},
  { v: "2.7.6", date: "2026-10-17", items: [
    "輸入框裡重聽發音的快捷鍵改成數字 1（Ctrl+空白、Tab 都會被系統搶走，已移除）；Alt+R 仍可用"
  ]},
  { v: "2.7.5", date: "2026-10-17", items: [
    "拼字工坊多了「🔊 聽發音」按鈕（不扣分，可重複聽），每題開始也會自動唸一次（跟著「自動發音」設定）；快捷鍵數字 1 可以重聽"
  ]},
  { v: "2.7.4", date: "2026-10-17", items: [
    "拼字工坊「提示一個字母」現在按下去就直接扣 10 分（分數可以變負的），不能再免費狂按"
  ]},
  { v: "2.7.3", date: "2026-10-17", items: [
    "房間大廳每間房顯示「目前人數/人數上限」，人數歸零的房間會從大廳消失"
  ]},
  { v: "2.7.2", date: "2026-10-17", items: [
    "修正進入房間偶爾卡在「進入房間中…」要重新整理的問題"
  ]},
  { v: "2.7.1", date: "2026-10-17", items: [
    "👑 王冠頭像改成 10000 金幣才能買（已經買過的不受影響）"
  ]},
  { v: "2.6.3", date: "2026-10-17", items: [
    "房主離開房間時，房主會轉給最早加入的下一位；房間沒人了才會關閉",
    "房主不告而別（直接關分頁）時，剩下的人會自動接手房主"
  ]},
  { v: "2.7", date: "2026-10-17", items: [
    "對戰改成「房間」：在對戰頁按「建立房間」，可選單元、題數（10/15/20）、人數上限（2～8 人）、公開或私人、要不要設密碼",
    "公開房間會出現在大廳讓大家直接加入；也可以用右下角的框輸入 6 位房間號加入，有密碼要輸入密碼",
    "房間裡可以邀請好友（對方畫面會跳出加入通知，被邀請的不用輸入密碼）；遇到沒加過的玩家，旁邊有「加好友」按鈕；房主可以把人請出房間",
    "在房間裡按「加好友」會送出好友申請：對方畫面跳出「允許／拒絕」，彈窗消失後申請會留在對戰頁的「好友申請」清單",
    "多人對戰有即時計分板，結束後顯示名次；原本的一對一「挑戰」按鈕改成房間邀請",
  ]},
  { v: "2.6.2", date: "2026-10-17", items: [
    "修正：登出後本機存檔會被清空，新建的遊客不會再繼承上一個帳號的成就和名字"
  ]},
  { v: "2.6.1", date: "2026-10-17", items: [
    "單字隕石：同一局不再重複出現相同單字（全部出過一輪才重新洗牌）"
  ]},
  { v: "2.6", date: "2026-10-17", items: [
    "右上角新增登入按鈕，可選「Google 登入」或「遊客登入」；遊客不用綁定任何帳號，一樣能加好友、對戰、上排行榜",
    "遊客可以在個人資料隨時「綁定 Google」把進度保存下來",
  ] },
  { v: "2.5.1", date: "2026-10-17", items: [
    "好友對戰防刷：獎勵降為贏 +20 金幣、平手 +5、輸 0；每天前 5 場、同一位好友最多 2 場有獎勵（經驗值、勝場也一起算），對手棄權不給獎勵",
  ] },
  { v: "2.5", date: "2026-10-17", items: [
    "出題改成「沒考過的字先出現」，要先把整個字庫考過一輪才會重複，不能靠刷同一批字",
    "「快問之王」變難：要選課本全部課次，快問連擊拿到 4500 分；新增「大考快問王」（大考 4000 全選）",
    "新增熟練度成就：一模滿分腦（336 字）、四千單通關、六千單宗師。要把整個字庫每個字都考過，且「第一次作答」正確率 90% 以上才拿得到",
    "成就卡片會顯示已測字數與首答正確率",
    "高階成就（閃電配對、聽力王、隕石、拼字、快問）都要在字庫全選的範圍拿到成績才算，只開一課不行；新增隕石毀滅者、拼字大師、大考順風耳、大考拼字王",
  ] },
  { v: "2.4", date: "2026-10-17", items: [
    "新增「字庫」切換：課本 336 字／Lv1～3（約 3000 字，對應全樺模考第一、二次）／Lv1～4（約 4000 字，對應第三～五次）／Lv1～6（約 6000 字）",
    "字庫來源是大考中心《高中英文參考詞彙表》（111 學年起適用），可以用 Lv1～Lv6 按鈕只練某幾級",
    "大考字庫的中文是字典自動轉成繁體，個別字義可能不夠精準，以課本與老師為準",
  ] },
  { v: "2.3", date: "2026-10-17", items: [
    "史詩、傳說成就解鎖時有全螢幕特效：旋轉光芒、獎盃砸下、火花爆開＋專屬音效",
    "已解鎖的史詩、傳說成就卡片會有流動的光邊",
    "新增隱藏成就「遊戲設計者」（只有作者本人拿得到），名字會有金色流光和 DEV 徽章",
  ] },
  { v: "2.2", date: "2026-10-17", items: [
    "新增成就系統：20 個成就，可以先預覽條件和進度；稱號改成解鎖成就才拿得到，不能用金幣買",
    "用 Google 登入會拿到「歡迎加入」成就，並顯示加入日期",
    "新增寶石：每升一級 +1、每 5 級 +5，解鎖成就也會給寶石（越難給越多）",
    "商店新增寶石區：稀有頭像，以及星空、熔岩、極光三種特殊造型",
    "排行榜新增「成就數」",
  ] },
  { v: "2.1", date: "2026-10-17", items: [
    "題目是英文時，一出題就先自動唸（設定改名為「出題自動唸英文」）",
    "題目旁加「🔊 再聽一次」按鈕，快捷鍵 R；在輸入框裡打字時改用 Alt+R 或 Ctrl+空白鍵",
    "配對消除點英文卡片時會唸出來",
  ] },
  { v: "2.0", date: "2026-10-17", items: [
    "升等送金幣，每玩一場也會拿到一些金幣",
    "新增商店：解鎖「單字隕石」「聽音拼字」、網頁造型（深海、櫻花、森林、霓虹、黑金）、頭像、稱號",
    "新增個人資料：改暱稱、換頭像和稱號，看自己的各項紀錄",
    "可以用 Google 帳號登入，進度存在雲端，換手機或電腦也接得上",
    "新增好友：用好友代碼加好友，好友在線會亮綠燈",
    "新增好友對戰：同一組 10 題快問，即時看到對方分數，贏了多拿金幣",
    "新增排行榜：等級、各遊戲最高分、對戰勝場，可切換全部玩家／只看好友",
    "新增更新日誌",
  ] },
  { v: "1.1", date: "2026-10-17", items: ["加入音效（答對、答錯、連擊、爆炸、倒數）", "新增「聽音拼字」模式", "網站改放 GitHub Pages"] },
  { v: "1.0", date: "2026-10-17", items: ["配對消除、快問連擊、單字隕石、拼字工坊四個模式", "錯題本、課次篩選、單字發音"] },
];

// ---------- 商品 ----------
const MODES = [
  { m: "match", tag: "MATCH", name: "配對消除", desc: "英文和中文配成一對，越快越好，配錯加罰 1 秒。", price: 0 },
  { m: "quiz", tag: "COMBO", name: "快問連擊", desc: "15 題四選一、限時 10 秒，連續答對分數加倍。", price: 0 },
  { m: "spell", tag: "SPELL", name: "拼字工坊", desc: "看中文，用打亂的字母拼出單字，可用鍵盤直接打。", price: 0 },
  { m: "rock", tag: "METEOR", name: "單字隕石", desc: "中文隕石往下掉，打出英文擊碎它。掉到地上要抄一次答案。", price: 100 },
  { m: "listen", tag: "LISTEN", name: "聽音拼字", desc: "只聽發音，把單字打出來。打錯一次給中文提示，再錯就公布答案。", price: 150 },
];
const SKINS = [
  { k: "default", name: "預設", desc: "跟著系統深淺色", price: 0, sw: ["#eef1f8", "#ff6a1a", "#0a9c95"] },
  { k: "sakura", name: "櫻花", desc: "粉嫩春天", price: 120, sw: ["#fff4f7", "#e8487a", "#7c6cf0"] },
  { k: "forest", name: "森林", desc: "護眼綠", price: 120, sw: ["#eef5ea", "#d9822b", "#2f8f4e"] },
  { k: "ocean", name: "深海", desc: "深藍夜讀", price: 150, sw: ["#0b2236", "#ffb02e", "#4fd1ff"] },
  { k: "neon", name: "霓虹", desc: "電玩感", price: 200, sw: ["#0a0716", "#ff3fa4", "#2ff3e0"] },
  { k: "gold", name: "黑金", desc: "尊爵不凡", price: 300, sw: ["#121110", "#e8b64c", "#7fc8a9"] },
  { k: "galaxy", name: "星空", desc: "滿天星斗", price: 15, cur: "gem", sw: ["#0d0b24", "#b18cff", "#ffd36b"] },
  { k: "lava", name: "熔岩", desc: "火山爆發", price: 15, cur: "gem", sw: ["#1a0b07", "#ff5a1f", "#ffc23d"] },
  { k: "aurora", name: "極光", desc: "會流動的極光", price: 25, cur: "gem", sw: ["#06141f", "#3df5b0", "#8a7dff"] },
];
const AVATARS = [["🙂", 0], ["🐱", 0], ["🐶", 0], ["🐰", 30], ["🐸", 30], ["🐧", 40], ["🦊", 50], ["🐼", 50], ["🐯", 60], ["🦉", 60], ["🐙", 80], ["🦄", 120], ["🐲", 150], ["🚀", 150], ["👑", 10000],
  ["🦖", 5, "gem"], ["🪐", 8, "gem"], ["🌈", 8, "gem"], ["🔥", 10, "gem"], ["⚡", 10, "gem"], ["🦋", 12, "gem"], ["💎", 20, "gem"], ["🏆", 25, "gem"]];
// 成就：p() 回傳 [目前進度, 目標]；解鎖送稱號和寶石
const knownN = () => Object.keys(S.known || {}).length;
const DEV_CODE = "4T623X";   // 遊戲作者的好友代碼
const isMeDev = () => S.code === DEV_CODE;
// 熟練度：一個字庫「每個字都考過」且「第一次作答」正確率達標，才算讀熟（重複刷同一批字沒用）
const idsOf = k => { const r = k === "book" ? W.filter(x => !x.b) : W.filter(x => x.b && x.lv <= (k === "c4000" ? 4 : 6)); return r.map(x => x.id); };
const _ids = {};
function mastery(k) {
  const ids = _ids[k] = _ids[k] || idsOf(k); let seen = 0, ok = 0;
  for (const i of ids) if (S.first[i] !== undefined) { seen++; ok += S.first[i]; }
  return { total: ids.length, seen, acc: seen ? ok / seen : 0 };
}
const masteryP = (k, th) => () => { const m = mastery(k); return [m.seen >= m.total && m.acc >= th ? m.total : Math.min(m.seen, m.total - 1), m.total]; };
const masteryNote = k => () => { const m = mastery(k); return `已測 ${m.seen}/${m.total} 字・首答正確率 ${(m.acc * 100).toFixed(1)}%`; };
const ACH = [
  { id: "dev", name: "遊戲設計者", desc: "親手打造了這座單字遊樂場", title: "遊戲設計者", gems: 50, tier: 4, hidden: true, icon: "⚡", p: () => [isMeDev() ? 1 : 0, 1] },
  { id: "welcome", name: "歡迎加入", desc: "登入遊樂場（Google 或遊客）", title: "新進玩家", gems: 5, tier: 0, p: () => [S.joined ? 1 : 0, 1] },
  { id: "g10", name: "小試身手", desc: "玩 10 場遊戲", title: "熱身完畢", gems: 2, tier: 0, p: () => [S.games, 10] },
  { id: "g50", name: "遊樂場常客", desc: "玩 50 場遊戲", title: "遊樂場常客", gems: 5, tier: 1, p: () => [S.games, 50] },
  { id: "g200", name: "單字狂熱", desc: "玩 200 場遊戲", title: "單字狂熱者", gems: 15, tier: 2, p: () => [S.games, 200] },
  { id: "lv5", name: "漸入佳境", desc: "升到 Lv 5", title: "漸入佳境", gems: 3, tier: 0, p: () => [lvOf(S.xp), 5] },
  { id: "lv10", name: "十全十美", desc: "升到 Lv 10", title: "十級玩家", gems: 8, tier: 1, p: () => [lvOf(S.xp), 10] },
  { id: "lv20", name: "一模霸主", desc: "升到 Lv 20", title: "一模霸主", gems: 20, tier: 2, p: () => [lvOf(S.xp), 20] },
  { id: "w100", name: "百字斬", desc: "答對過 100 個不同的單字", title: "百字斬", gems: 5, tier: 1, p: () => [knownN(), 100] },
  { id: "wall", name: "單字之神", desc: "336 個課本單字全部答對過", title: "單字之神", gems: 30, tier: 3, p: () => [Object.keys(S.known || {}).filter(i => i < BOOKN).length, BOOKN] },
  { id: "m15", name: "配對快手", desc: "配對消除 15 秒內完成", title: "配對快手", gems: 5, tier: 1, p: () => [S.best.match && S.best.match <= 15 ? 1 : 0, 1] },
  { id: "m10", name: "閃電配對", desc: "字庫選課本 336 字全部課次，配對消除 8 秒內完成", title: "閃電手", gems: 10, tier: 2, p: () => [fb("match") && fb("match") <= 8 ? 1 : 0, 1] },
  { id: "q2500", name: "連擊大師", desc: "快問連擊拿到 2500 分", title: "連擊大師", gems: 5, tier: 1, p: () => [S.best.quiz || 0, 2500] },
  { id: "q4500", name: "快問之王", desc: "字庫選課本 336 字、全部課次全選，快問連擊拿到 4500 分", title: "快問之王", gems: 12, tier: 2, p: () => [fb("quiz") || 0, 4500] },
  { id: "q4000", name: "大考快問王", desc: "字庫選大考 4000（Lv1～4 全選），快問連擊拿到 4500 分", title: "大考快問王", gems: 20, tier: 3, p: () => [fb("quiz", "c4000") || 0, 4500] },
  { id: "mbook", name: "一模滿分腦", desc: "336 個課本單字全部考過，第一次作答正確率 90% 以上", title: "一模熟讀者", gems: 25, tier: 3, p: masteryP("book", .9), note: masteryNote("book") },
  { id: "m4000", name: "四千單通關", desc: "大考 4000 字（Lv1～4）全部考過，第一次作答正確率 90% 以上", title: "四千單達人", gems: 60, tier: 3, p: masteryP("c4000", .9), note: masteryNote("c4000") },
  { id: "m6000", name: "六千單宗師", desc: "大考 6000 字（Lv1～6）全部考過，第一次作答正確率 90% 以上", title: "六千單宗師", gems: 120, tier: 3, p: masteryP("c6000", .9), note: masteryNote("c6000") },
  { id: "r300", name: "隕石獵人", desc: "單字隕石拿到 300 分", title: "隕石獵人", gems: 6, tier: 1, p: () => [S.best.rock || 0, 300] },
  { id: "s250", name: "拼字工匠", desc: "拼字工坊拿到 250 分", title: "拼字工匠", gems: 6, tier: 1, p: () => [S.best.spell || 0, 250] },
  { id: "l250", name: "順風耳", desc: "字庫選課本 336 字全部課次，聽音拼字 10 題全部一次聽對（250 分）", title: "聽力王", gems: 10, tier: 2, p: () => [fb("listen") || 0, 250] },
  { id: "r600", name: "隕石毀滅者", desc: "字庫選課本 336 字全部課次，單字隕石拿到 600 分", title: "隕石毀滅者", gems: 12, tier: 2, p: () => [fb("rock") || 0, 600] },
  { id: "s250f", name: "拼字大師", desc: "字庫選課本 336 字全部課次，拼字工坊拿到滿分 250", title: "拼字大師", gems: 12, tier: 2, p: () => [fb("spell") || 0, 250] },
  { id: "l4000", name: "大考順風耳", desc: "字庫選大考 4000（Lv1～4 全選），聽音拼字 10 題全部一次聽對", title: "大考順風耳", gems: 25, tier: 3, p: () => [fb("listen", "c4000") || 0, 250] },
  { id: "s4000", name: "大考拼字王", desc: "字庫選大考 4000（Lv1～4 全選），拼字工坊拿到滿分 250", title: "大考拼字王", gems: 25, tier: 3, p: () => [fb("spell", "c4000") || 0, 250] },
  { id: "f1", name: "交個朋友", desc: "加 1 位好友", title: "好夥伴", gems: 3, tier: 0, p: () => [S.friendsN || 0, 1] },
  { id: "f5", name: "人氣王", desc: "加 5 位好友", title: "人氣王", gems: 8, tier: 1, p: () => [S.friendsN || 0, 5] },
  { id: "v1", name: "首勝", desc: "對戰贏 1 場", title: "初露鋒芒", gems: 3, tier: 0, p: () => [S.wins || 0, 1] },
  { id: "v10", name: "對戰常勝軍", desc: "對戰贏 10 場", title: "對戰常勝軍", gems: 15, tier: 2, p: () => [S.wins || 0, 10] },
];
const TIERS = [["普通", "var(--muted)"], ["稀有", "var(--cool)"], ["史詩", "var(--hot)"], ["傳說", "var(--gold)"], ["開發者", "#ff3fa4"]];
const FREE = ["game:match", "game:quiz", "game:spell", "skin:default", "av:🙂", "av:🐱", "av:🐶", "title:單字新手"];

const lvOf = xp => Math.floor(xp / 300) + 1;
let S = { xp: 0, wrong: {}, best: {}, lessons: LESSONS.slice(), bank: "book", lvs: [1, 2, 3, 4, 5, 6], wrongOnly: false, autoSay: true, sfx: true,
  owned: FREE.slice(), skin: "default", name: "", avatar: "🙂", title: "單字新手", games: 0, wins: 0, losses: 0, seenVer: "", gems: 0, ach: {}, known: {}, first: {}, joined: "" };
try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) {}
if (!S.first) S.first = {};   // 每個字「第一次作答」對或錯（1/0），算熟練度正確率用，之後重複作答不影響
if (S.coins === undefined) S.coins = 100 + (lvOf(S.xp) - 1) * 60;   // 舊玩家補發已升過的等級
S.owned = [...new Set([...FREE, ...(S.owned || [])])];
if (!S.name) S.name = "玩家" + (1000 + Math.random() * 9000 | 0);
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} window.ONLINE?.dirty?.(); };
const owns = k => S.owned.includes(k);

const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const norm = s => s.toLowerCase().replace(/[….]+/g, " ").replace(/\s+/g, " ").trim();
const typable = x => /^[a-z' -]+$/i.test(x.w);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pos = x => x.p ? x.p : "片語";
const seenW = x => S.first[x.id] !== undefined || S.known[x.id] || S.wrong[x.id];   // 這個字以前考過嗎
function pick(list, n, keys, fresh) {    // 取 n 個，keys 欄位不重複（避免 fair 名詞/形容詞同時出現）；fresh=沒考過的字優先，不能靠重複刷同一批字
  const out = [], seen = keys.map(() => new Set());
  let L = shuffle(list); if (fresh) L = [...L.filter(x => !seenW(x)), ...L.filter(seenW)];
  for (const x of L) {
    if (keys.some((k, i) => seen[i].has(x[k]))) continue;
    keys.forEach((k, i) => seen[i].add(x[k])); out.push(x);
    if (out.length === n) break;
  }
  return out;
}
function speak(w, rate = .9) {
  try { const u = new SpeechSynthesisUtterance(w.replace(/…/g, " ").replace(/\b(sth|sb)\./g, "")); u.lang = "en-US"; u.rate = rate; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) {}
}
const sayIf = w => S.autoSay && speak(w);
let AC = null;
function ctx() { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === "suspended") AC.resume(); return AC; }
function tone(notes, type = "sine", vol = .18) {   // notes: [[頻率, 開始秒, 長度秒], ...]
  if (!S.sfx) return;
  try {
    const ac = ctx(), t = ac.currentTime;
    for (const [f, at, len] of notes) {
      const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(0, t + at); g.gain.linearRampToValueAtTime(vol, t + at + .01); g.gain.exponentialRampToValueAtTime(.001, t + at + len);
      o.connect(g).connect(ac.destination); o.start(t + at); o.stop(t + at + len + .05);
    }
  } catch (e) {}
}
function noise(len = .35, vol = .25) {
  if (!S.sfx) return;
  try {
    const ac = ctx(), b = ac.createBuffer(1, ac.sampleRate * len, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
    const src = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter();
    f.type = "lowpass"; f.frequency.value = 900; g.gain.value = vol; src.buffer = b;
    src.connect(f).connect(g).connect(ac.destination); src.start();
  } catch (e) {}
}
const sfx = {
  ok: () => tone([[880, 0, .12], [1320, .08, .18]]),
  bad: () => tone([[220, 0, .18], [165, .12, .25]], "square", .08),
  tap: () => tone([[600, 0, .05]], "triangle", .1),
  combo: n => tone([[660, 0, .08], [880, .06, .08], [1100 + Math.min(n, 15) * 40, .12, .2]], "triangle", .14),
  boom: () => { noise(); tone([[140, 0, .3]], "sawtooth", .08); },
  land: () => tone([[300, 0, .15], [200, .1, .15], [120, .2, .35]], "sawtooth", .08),
  win: () => tone([[523, 0, .15], [659, .12, .15], [784, .24, .15], [1047, .36, .4]], "triangle", .16),
  warn: () => tone([[1000, 0, .04]], "square", .05),
  coin: () => tone([[988, 0, .08], [1319, .07, .25]], "square", .07),
  epic: () => { tone([[392, 0, .14], [523, .12, .14], [659, .24, .14], [784, .36, .14], [1047, .5, .7], [1319, .5, .7], [1568, .62, .8]], "sawtooth", .07);
    tone([[196, 0, .5], [262, .5, .9]], "triangle", .16); noise(.9, .12); },
  levelup: () => tone([[523, 0, .12], [659, .1, .12], [784, .2, .12], [1047, .3, .12], [784, .42, .1], [1047, .52, .5]], "triangle", .18),
  ding: () => tone([[1175, 0, .15], [1568, .12, .3]], "sine", .2),
};
let replayFn = null;   // 目前題目的「再聽一次」
const replayBtn = (id = "replay") => `<button class="btn ghost small" id="${id}" type="button" title="快捷鍵 R（輸入框裡用數字 1 或 Alt+R）">🔊 再聽一次 <kbd>R</kbd></button>`;
document.addEventListener("keydown", e => {
  if (!replayFn || e.repeat) return;
  const typing = replayFn.digit || e.target.matches?.("input, textarea");
  const hot = typing ? e.code === "Digit1" || e.code === "Numpad1" || e.key === "1" || (e.altKey && e.code === "KeyR")
    : (e.code === "KeyR" && !e.ctrlKey && !e.altKey && !e.metaKey);
  if (hot) { e.preventDefault(); replayFn(); }
});
function toast(t) { const d = document.createElement("div"); d.className = "toast"; d.textContent = t; document.body.append(d); setTimeout(() => d.remove(), 2600); }
function modal(html) {
  const m = document.createElement("div"); m.className = "modal"; m.innerHTML = `<div class="box">${html}</div>`;
  m.addEventListener("click", e => { if (e.target === m || e.target.closest("[data-close]")) m.remove(); });
  document.body.append(m); return m;
}
// 加經驗值：每 3 XP 給 1 金幣，升等另外送 50 + 10×等級
function gain(xp, extraCoins = 0) {
  const L0 = lvOf(S.xp); S.xp += xp;
  const L1 = lvOf(S.xp); let bonus = 0;
  let gems = 0;
  for (let L = L0 + 1; L <= L1; L++) { bonus += 50 + 10 * L; gems += L % 5 ? 1 : 5; }
  S.gems += gems;
  const got = Math.round(xp / 3) + extraCoins + bonus;
  S.coins += got; save(); renderTop();
  if (L1 > L0) setTimeout(() => {
    sfx.levelup();
    modal(`<div class="big" style="font-size:34px">LEVEL UP</div><div class="av lg" style="margin:0 auto">${S.avatar}</div>
      <h2>升到 Lv ${L1}！</h2><p class="muted" style="margin:0">升等獎勵 <b style="color:var(--gold)">+${bonus} 金幣</b>・<b style="color:var(--gem)">+${gems} 寶石</b></p>
      <button class="btn" data-close type="button">太好了</button>`);
    checkAch();
  }, 600);
  return got;
}
function miss(x) { if (S.first[x.id] === undefined) S.first[x.id] = 0; S.wrong[x.id] = (S.wrong[x.id] || 0) + 1; save(); hud(); }
function hit(x) { if (S.first[x.id] === undefined) S.first[x.id] = 1; S.known[x.id] = 1; if (S.wrong[x.id]) { if (--S.wrong[x.id] <= 0) delete S.wrong[x.id]; save(); hud(); } }

const bankMax = () => ({ c3000: 3, c4000: 4, c6000: 6 })[S.bank] || 0;
const uni = () => S.bank === "book" ? W.filter(x => !x.b) : W.filter(x => x.b && x.lv <= bankMax());   // 目前字庫全部單字（出干擾選項用）
const lvSel = () => { const m = S.lvs.filter(v => v <= bankMax()); return m.length ? m : [1, 2, 3, 4, 5, 6]; };   // 切字庫後選的級別超出範圍就當全選
const fullScope = () => !S.wrongOnly && (S.bank === "book" ? LESSONS.every(l => S.lessons.includes(l)) : lvSel().length >= bankMax());
const bankKey = () => S.bank === "book" ? "book" : "c" + (bankMax() * 1000 || 6000);   // 與字庫對應的紀錄鍵
function recFull(m, v) {   // 字庫全選時另外記一份「全範圍紀錄」，高階成就看這個
  if (!fullScope()) return; const k = `f_${m}_${bankKey()}`, o = S.best[k];
  if (o == null || (m === "match" ? v < o : v > o)) S.best[k] = v;
}
const fb = (m, k = "book") => S.best[`f_${m}_${k}`];
const BANKS = [["book", "課本 336"], ["c3000", "模考前兩次 3000"], ["c4000", "模考後三次 4000"], ["c6000", "大考 6000"]];
function pool(filter) {
  let p = S.bank === "book" ? W.filter(x => !x.b && S.lessons.includes(x.l)) : uni().filter(x => lvSel().includes(x.lv));
  if (S.wrongOnly) p = p.filter(x => S.wrong[x.id]);
  return filter ? p.filter(filter) : p;
}
function applySkin() { if (S.skin === "default") document.documentElement.removeAttribute("data-skin"); else document.documentElement.dataset.skin = S.skin; auroraCanvas(S.skin === "aurora"); }

// 極光：用 canvas 逐欄畫波浪光幕（下緣亮、往上淡出），形狀隨時間流動
let auroraRaf = 0;
function auroraCanvas(on) {
  let cv = document.getElementById("auroraCv");
  if (!on) { cancelAnimationFrame(auroraRaf); auroraRaf = 0; if (cv) cv.remove(); return; }
  if (auroraRaf) return;
  if (!cv) { cv = document.createElement("canvas"); cv.id = "auroraCv"; document.body.prepend(cv); }
  const ctx = cv.getContext("2d");
  const mk = stops => { const g = document.createElement("canvas"); g.width = 1; g.height = 64; const c = g.getContext("2d"); const gr = c.createLinearGradient(0, 0, 0, 64); stops.forEach(([o, col]) => gr.addColorStop(o, col)); c.fillStyle = gr; c.fillRect(0, 0, 1, 64); return g; };
  const strips = [
    mk([[0, "rgba(160,110,255,0)"], [.45, "rgba(150,110,255,.22)"], [.8, "rgba(80,255,170,.75)"], [.96, "rgba(170,255,210,1)"], [1, "rgba(80,255,170,0)"]]),
    mk([[0, "rgba(255,120,220,0)"], [.5, "rgba(170,110,255,.2)"], [.85, "rgba(60,225,255,.7)"], [.97, "rgba(190,250,255,.95)"], [1, "rgba(60,225,255,0)"]]),
    mk([[0, "rgba(90,255,170,0)"], [.6, "rgba(90,255,170,.3)"], [.93, "rgba(210,255,170,.8)"], [1, "rgba(210,255,170,0)"]]),
  ];
  const still = matchMedia("(prefers-reduced-motion:reduce)").matches;
  const size = () => { cv.width = Math.ceil(innerWidth / 3); cv.height = Math.ceil(innerHeight / 3); };
  size(); addEventListener("resize", size);
  const draw = ms => {
    if (document.documentElement.dataset.skin !== "aurora") { auroraCanvas(false); return; }
    const t = ms / 1000 * 1.6, W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H); ctx.globalCompositeOperation = "lighter";
    strips.forEach((st, k) => {
      const base = [.42, .55, .32][k], ph = k * 2.1;
      for (let x = 0; x < W; x++) {
        const y = H * (base + .1 * Math.sin(x * .016 + t * .5 + ph) + .06 * Math.sin(x * .037 - t * .8 + ph) + .025 * Math.sin(x * .09 + t * 1.6));
        const h = H * (.3 + .13 * Math.sin(x * .02 + t * .4 + ph * 2) + .08 * Math.sin(x * .07 - t * 1.1));
        let a = .55 + .45 * Math.sin(x * .05 + t * 1.2 + ph) * Math.sin(x * .013 - t * .5 + ph);
        a *= .6 + .4 * Math.sin(x * .8 + t * 3 + k) ** 2;   // 細小的垂直光絲
        ctx.globalAlpha = Math.max(0, Math.min(1, a)) * .85;
        ctx.drawImage(st, 0, 0, 1, 64, x, y - h, 1, h);
      }
    });
    ctx.globalAlpha = 1;
    if (!still) auroraRaf = requestAnimationFrame(draw);
  };
  auroraRaf = requestAnimationFrame(draw);
}
// 名字／稱號的顯示（作者有專屬特效）
const nameHtml = (name, dev) => dev ? `<span class="shine dev-glow">${esc(name)}</span><span class="devbadge">DEV</span>` : esc(name);
const titleHtml = (title, dev) => title === "遊戲設計者" ? (dev ? `<span class="shine">⚡ 遊戲設計者</span>` : "") : esc(title);
function renderTop() {
  const L = lvOf(S.xp), into = S.xp - (L - 1) * 300;
  $("#meAv").textContent = S.avatar; $("#meName").innerHTML = nameHtml(S.name, isMeDev()); $("#meTitle").innerHTML = titleHtml(S.title, isMeDev()); $("#meBtn").classList.toggle("dev", isMeDev());
  $("#coins").textContent = S.coins; $("#gems").textContent = S.gems; $("#lv").textContent = L; $("#xp").textContent = S.xp;
  $("#xpNext").textContent = `再 ${300 - into} XP 升 Lv ${L + 1}`; $("#xpFill").style.width = into / 3 + "%";
}
function bestText(m) {
  const b = S.best[m]; if (!b) return "還沒玩過";
  return m === "match" ? `最快 ${b.toFixed(1)} 秒` : `最高 ${b} 分`;
}
function hud() {
  renderTop();
  $("#wc").textContent = Object.keys(S.wrong).length;
  $("#poolInfo").textContent = `目前題庫 ${pool().length} 個`;
  $("#menu").innerHTML = MODES.map(o => {
    const lock = !owns("game:" + o.m);
    return `<button class="mode ${lock ? "locked" : ""}" data-m="${o.m}"><span class="tag">${lock ? "🔒 " : ""}${o.tag}</span><h3>${o.name}</h3><p>${o.desc}</p>
      <span class="best">${lock ? `${o.price} 金幣解鎖` : bestText(o.m)}</span></button>`;
  }).join("");
}
function renderChips() {
  const bk = BANKS.map(([k, n]) => `<button class="chip" data-bank="${k}" aria-pressed="${S.bank === k}">${n}</button>`).join("") + `<span style="flex-basis:100%"></span>`;
  if (S.bank === "book") {
    const all = S.lessons.length === LESSONS.length;
    $("#chips").innerHTML = bk + `<button class="chip" data-l="*" aria-pressed="${all}">全部</button>` +
      LESSONS.map(l => `<button class="chip" data-l="${l}" aria-pressed="${!all && S.lessons.includes(l)}">${l}</button>`).join("");
  } else {
    const LV = Array.from({ length: bankMax() }, (_, i) => i + 1), sel = S.lvs.filter(v => v <= bankMax()), all = sel.length === LV.length;
    $("#chips").innerHTML = bk + `<button class="chip" data-lv="*" aria-pressed="${all}">全部</button>` +
      LV.map(v => `<button class="chip" data-lv="${v}" aria-pressed="${!all && sel.includes(v)}">Lv${v}</button>`).join("");
  }
}
$("#chips").onclick = e => {
  const t = e.target.closest("button"); if (!t) return;
  if (t.dataset.bank) { S.bank = t.dataset.bank; save(); renderChips(); hud(); return; }
  if (t.dataset.lv) {
    const LV = Array.from({ length: bankMax() }, (_, i) => i + 1), v = t.dataset.lv, sel = S.lvs.filter(x => x <= bankMax());
    if (v === "*") S.lvs = [1, 2, 3, 4, 5, 6];
    else { const n = +v; if (sel.length === LV.length) S.lvs = [n]; else { S.lvs = sel.includes(n) ? sel.filter(x => x !== n) : [...sel, n]; if (!S.lvs.length) S.lvs = [1, 2, 3, 4, 5, 6]; } }
    save(); renderChips(); hud(); return;
  }
  const l = t.dataset.l; if (!l) return;
  if (l === "*") S.lessons = LESSONS.slice();
  else if (S.lessons.length === LESSONS.length) S.lessons = [l];
  else { S.lessons = S.lessons.includes(l) ? S.lessons.filter(x => x !== l) : [...S.lessons, l]; if (!S.lessons.length) S.lessons = LESSONS.slice(); }
  save(); renderChips(); hud();
};
$("#wrongOnly").checked = S.wrongOnly; $("#autoSay").checked = S.autoSay;
$("#wrongOnly").onchange = e => { S.wrongOnly = e.target.checked; save(); hud(); };
$("#autoSay").onchange = e => { S.autoSay = e.target.checked; save(); };
$("#sfx").checked = S.sfx; $("#sfx").onchange = e => { S.sfx = e.target.checked; save(); if (S.sfx) sfx.ok(); };
// 需要確認的按鈕：第一次按變「再按一次確定」，3 秒內再按才執行
function armed(btn, label, fn) {
  if (btn.dataset.armed && Date.now() - btn.dataset.armed < 3000) { delete btn.dataset.armed; fn(); return; }
  const old = btn.textContent; btn.dataset.armed = Date.now(); btn.textContent = label;
  setTimeout(() => { if (btn.isConnected && btn.dataset.armed) { delete btn.dataset.armed; btn.textContent = old; } }, 3000);
}
$("#clearWrong").onclick = e => armed(e.target, "再按一次確定清空", () => { S.wrong = {}; save(); hud(); e.target.textContent = "清空錯題本"; toast("錯題本已清空"); });

/* ---------- 分頁 ---------- */
let curTab = "games";
function showTab(t) {
  curTab = t;
  document.querySelectorAll("#nav button").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === t));
  document.querySelectorAll(".tab").forEach(s => s.hidden = s.id !== "tab-" + t);
  refreshTab();
}
function refreshTab() {
  const O = window.ONLINE;
  if (curTab === "shop") renderShop();
  if (curTab === "me") renderMe();
  if (curTab === "ach") renderAch();
  if (curTab === "log") { if (S.seenVer !== CHANGELOG[0].v) { S.seenVer = CHANGELOG[0].v; save(); } renderLogDot(); }
  if (curTab === "vs") O ? O.renderVs($("#vsBox")) : $("#vsBox").innerHTML = offline();
  if (curTab === "rank") O ? O.renderRank($("#rankBox")) : $("#rankBox").innerHTML = offline();
}
const offline = () => `<div class="card"><h2>線上功能載入中…</h2><p class="muted">如果一直沒出現，請確認網路連線後重新整理。</p></div>`;
$("#nav").onclick = e => { const b = e.target.closest("button"); if (b) showTab(b.dataset.tab); };
$("#meBtn").onclick = () => showTab("me");
function renderLogDot() {
  const b = $("#logTab"), d = b.querySelector(".dot"), want = S.seenVer !== CHANGELOG[0].v;
  if (want && !d) b.insertAdjacentHTML("beforeend", `<span class="dot"></span>`); if (!want && d) d.remove();
}
$("#clList").innerHTML = CHANGELOG.map((c, i) => `<div class="cl"><span class="v">v${c.v}</span> <span class="muted">${c.date}</span>${i === 0 ? '<span class="new">最新</span>' : ""}
  <ul>${c.items.map(t => `<li>${esc(t)}</li>`).join("")}</ul></div>`).join("");
$("#verText")?.replaceChildren(`v${CHANGELOG[0].v}`);

/* ---------- 成就 ---------- */
const today = () => new Date().toLocaleDateString("sv");
let achQ = [];
function checkAch() {
  let n = 0;
  for (const a of ACH) {
    if (S.ach[a.id]) continue;
    const [c, g] = a.p(); if (c < g) continue;
    S.ach[a.id] = a.id === "welcome" ? S.joined : today(); S.gems += a.gems;
    if (!owns("title:" + a.title)) S.owned.push("title:" + a.title);
    achQ.push(a); n++;
  }
  if (!n) return;
  save(); renderTop(); if (curTab === "ach") renderAch();
  if (achQ.length === n) popAch();
}
function bigAch(a, done) {
  const t = TIERS[a.tier]; sfx.epic();
  const el = document.createElement("div"); el.className = "fx"; el.style.setProperty("--tc", t[1]);
  const cols = ["#ffd76b", "#ff8a3d", "#ff3fa4", "#6be3ff", "#b18cff", "#ffffff"];
  const sparks = Array.from({ length: 40 }, (_, i) => {
    const ang = i / 40 * Math.PI * 2 + Math.random() * .3, dist = 140 + Math.random() * 260;
    return `<i class="spark" style="--x:${Math.cos(ang) * dist}px;--y:${Math.sin(ang) * dist}px;--c:${cols[i % cols.length]};animation-delay:${.35 + Math.random() * .2}s"></i>`;
  }).join("");
  el.innerHTML = `<div class="rays"></div>${sparks}<div class="core">
    <div class="tierlbl">${t[0]}成就</div><div class="big-trophy">${a.icon || "🏆"}</div>
    <h2 class="shine">${esc(a.name)}</h2><p style="margin:0;opacity:.85">${esc(a.desc)}</p>
    <p style="margin:0">獲得稱號「<b class="shine">${esc(a.title)}</b>」・<b style="color:#c9b3ff">+${a.gems} 寶石</b></p>
    <button class="btn" type="button">收下</button></div>`;
  el.querySelector("button").onclick = () => { el.remove(); done(); };
  document.body.append(el);
}
function popAch() {
  const a = achQ[0]; if (!a) return;
  if (a.tier >= 2) return bigAch(a, () => { achQ.shift(); popAch(); });
  sfx.ding();
  const el = document.createElement("div"); el.className = "achpop";
  el.innerHTML = `<span class="trophy" style="color:${TIERS[a.tier][1]}">🏆</span><span><small>成就解鎖・${TIERS[a.tier][0]}</small><b>${esc(a.name)}</b><small>稱號「${esc(a.title)}」・<span style="color:var(--gem)">+${a.gems} 寶石</span></small></span>`;
  el.onclick = () => showTab("ach");
  document.body.append(el);
  setTimeout(() => { el.remove(); achQ.shift(); popAch(); }, 2800);
}
function renderAch() {
  const list = ACH.filter(a => !a.hidden || S.ach[a.id]), done = list.filter(a => S.ach[a.id]).length;
  $("#achBox").innerHTML = `<div class="card"><div class="bar"><h2>成就 ${done} / ${list.length}</h2><span class="pill gem">寶石 <b>${S.gems}</b></span></div>
    <p class="muted" style="margin:0">達成條件就自動解鎖，拿到稱號和寶石。寶石可以在商店買稀有頭像和特殊造型。${S.joined ? `你在 <b>${S.joined}</b> 加入遊樂場。` : "用 Google 登入就能拿到「歡迎加入」。"}</p>
    <div class="xpbar"><i style="width:${done / list.length * 100}%"></i></div></div>
    <div class="achs">${list.map(a => {
      const got = S.ach[a.id], [c, g] = a.p(), t = TIERS[a.tier];
      return `<div class="ach ${got ? "got" : ""} ${got && a.tier >= 2 ? "epic" : ""}" style="--tc:${t[1]}">
        <div class="bar"><span class="trophy">${got ? a.icon || "🏆" : "🔒"}</span><span class="tier">${t[0]}</span></div>
        <b>${esc(a.name)}</b><small>${esc(a.desc)}</small>
        <div class="plate"><span class="av">${S.avatar}</span><span><b>${nameHtml(S.name, isMeDev())}</b><small>${a.id === "dev" ? titleHtml(a.title, true) : esc(a.title)}</small></span></div>
        <small>獎勵：稱號「${esc(a.title)}」・<span style="color:var(--gem)">${a.gems} 寶石</span></small>
        ${got ? `<small class="ok">${a.id === "welcome" ? "加入日期" : "解鎖於"} ${got}</small>`
          : `<div class="xpbar"><i style="width:${Math.min(1, c / g) * 100}%"></i></div><small>${Math.min(c, g)} / ${g}</small>${a.note ? `<small>${a.note()}</small>` : ""}`}
      </div>`; }).join("")}</div>`;
}

/* ---------- 商店 ---------- */
const CUR = { coin: ["金幣", "var(--gold)", "coins"], gem: ["寶石", "var(--gem)", "gems"] };
function buy(k, price, btn, cur = "coin") {
  const [label, , field] = CUR[cur];
  if (S[field] < price) { sfx.bad(); toast(`${label}不夠，還差 ${price - S[field]}`); return; }
  armed(btn, `確定花 ${price} ${label}？`, () => { S[field] -= price; S.owned.push(k); save(); sfx.coin(); toast("購買成功！"); hud(); renderShop(); });
}
function renderShop() {
  const sec = (title, sub, items) => `<div class="card"><div class="bar"><h2>${title}</h2><span class="muted">${sub}</span></div><div class="shop">${items}</div></div>`;
  const btn = (k, price, on, use, cur = "coin") => owns(k)
    ? (use ? `<button class="btn small ${on ? "green" : "ghost"}" data-use="${esc(k)}" type="button">${on ? "使用中" : "使用"}</button>` : `<span class="muted">已解鎖</span>`)
    : `<span class="price" style="color:${CUR[cur][1]}">${price} ${CUR[cur][0]}</span><button class="btn small ${cur === "gem" ? "gemb" : ""}" data-buy="${esc(k)}" data-p="${price}" data-cur="${cur}" type="button">購買</button>`;
  const skin = s => `<div class="item ${S.skin === s.k ? "on" : ""}"><span class="swatch">${s.sw.map(c => `<i style="background:${c}"></i>`).join("")}</span><b>${s.name}</b><small>${s.desc}</small>${btn("skin:" + s.k, s.price, S.skin === s.k, 1, s.cur)}</div>`;
  const av = ([a, p, cur]) => `<div class="item ${S.avatar === a ? "on" : ""}"><span class="ico">${a}</span>${btn("av:" + a, p, S.avatar === a, 1, cur)}</div>`;
  $("#shopBox").innerHTML = `<div class="card"><div class="bar"><h2>商店</h2><span class="row"><span class="pill coin">金幣 <b>${S.coins}</b></span><span class="pill gem">寶石 <b>${S.gems}</b></span></span></div>
    <p class="muted" style="margin:0">金幣：玩一場約 5～25，升等送 50 + 10×等級，對戰贏 +40。寶石：每升一級 +1、每 5 級 +5，解鎖成就也會給。稱號要靠成就解鎖。</p></div>` +
    sec("💎 寶石商店", "稀有頭像與特殊造型", SKINS.filter(s => s.cur === "gem").map(skin).join("") + AVATARS.filter(a => a[2] === "gem").map(av).join("")) +
    sec("遊戲", "解鎖新玩法", MODES.filter(o => o.price).map(o => `<div class="item ${owns("game:" + o.m) ? "on" : ""}"><span class="ico" style="font:400 18px var(--f-display);color:var(--hot)">${o.tag}</span><b>${o.name}</b><small>${o.desc}</small>${btn("game:" + o.m, o.price)}</div>`).join("")) +
    sec("網頁造型", "換整個網站的配色", SKINS.filter(s => s.cur !== "gem").map(skin).join("")) +
    sec("頭像", "顯示在名字旁邊", AVATARS.filter(a => a[2] !== "gem").map(av).join(""));
}
function use(k) {
  const [type, v] = [k.slice(0, k.indexOf(":")), k.slice(k.indexOf(":") + 1)];
  if (type === "skin") { S.skin = v; applySkin(); }
  if (type === "av") S.avatar = v;
  if (type === "title") S.title = v;
  save(); sfx.tap(); renderTop(); refreshTab();
}
$("#shopBox").onclick = e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.buy) buy(b.dataset.buy, +b.dataset.p, b, b.dataset.cur);
  if (b.dataset.use) use(b.dataset.use);
};

/* ---------- 個人資料 ---------- */
const myTitles = () => S.owned.filter(k => k.startsWith("title:")).map(k => k.slice(6));
function renderMe() {
  const L = lvOf(S.xp), done = ACH.filter(a => S.ach[a.id]).length, total = ACH.filter(a => !a.hidden || S.ach[a.id]).length;
  $("#meBox").innerHTML = `<div class="card"><div class="row" style="gap:14px"><span class="av lg">${S.avatar}</span>
      <div style="flex:1;min-width:0"><h2>${nameHtml(S.name, isMeDev())}</h2><span class="muted">${titleHtml(S.title, isMeDev())}・Lv ${L}・XP ${S.xp}・金幣 ${S.coins}・寶石 ${S.gems}</span>
      <br><span class="muted">${S.joined ? `${S.joined} 加入` : "訪客（尚未登入）"}・成就 ${done}/${total}</span></div></div>
    <label class="muted" for="nameIn">暱稱（最多 12 字，好友和排行榜會看到）</label>
    <div class="type"><input class="field" id="nameIn" maxlength="12" value="${esc(S.name)}"><button class="btn" id="nameSave" type="button">儲存</button></div></div>
    <div class="card"><h2>頭像</h2><div class="chips">${AVATARS.filter(([a]) => owns("av:" + a)).map(([a]) => `<button class="chip" style="font-size:22px" data-use="av:${a}" aria-pressed="${S.avatar === a}">${a}</button>`).join("")}</div>
      <h2>稱號</h2><div class="chips">${myTitles().map(t => `<button class="chip" data-use="title:${esc(t)}" aria-pressed="${S.title === t}">${esc(t)}</button>`).join("")}</div>
      <p class="muted" style="margin:0">稱號靠解鎖成就取得，到「成就」頁看還有哪些。</p>
      <h2>網頁造型</h2><div class="chips">${SKINS.filter(s => owns("skin:" + s.k)).map(s => `<button class="chip" data-use="skin:${s.k}" aria-pressed="${S.skin === s.k}">${s.name}</button>`).join("")}</div>
      <p class="muted" style="margin:0">更多頭像和造型在商店買。</p></div>
    <div class="card"><h2>我的紀錄</h2><div class="tbl"><table>
      <tr><th>項目</th><th>紀錄</th></tr>
      ${MODES.map(o => `<tr><td>${o.name}</td><td>${owns("game:" + o.m) ? bestText(o.m) : "未解鎖"}</td></tr>`).join("")}
      <tr><td>總遊戲場數</td><td>${S.games}</td></tr><tr><td>對戰</td><td>${S.wins} 勝 ${S.losses} 敗</td></tr>
      <tr><td>答對過的單字</td><td>${knownN()} / ${W.length}</td></tr>
      <tr><td>錯題本</td><td>${Object.keys(S.wrong).length} 個字</td></tr></table></div></div>
    <div class="card" id="accountBox"></div>`;
  window.ONLINE ? window.ONLINE.renderAccount($("#accountBox")) : $("#accountBox").innerHTML = `<h2>帳號</h2><p class="muted">線上功能載入中…</p>`;
}
$("#meBox").onclick = e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.use) use(b.dataset.use);
  if (b.id === "nameSave") {
    const v = $("#nameIn").value.trim().slice(0, 12);
    if (!v) { toast("暱稱不能空白"); return; }
    S.name = v; save(); renderTop(); renderMe(); toast("暱稱已更新");
  }
};

/* ---------- 共用：舞台與結算 ---------- */
let stopFn = null;
const stage = $("#stage");
function openStage(html) { replayFn = null; if (curTab !== "games") showTab("games"); $("#gamesHome").hidden = true; stage.hidden = false; stage.innerHTML = html; window.scrollTo(0, 0); }
function home() { replayFn = null; if (stopFn) stopFn(); stopFn = null; stage.hidden = true; $("#gamesHome").hidden = false; hud(); }
const topBar = (name, hudHtml = "") => `<div class="bar"><button class="btn ghost" data-act="home" type="button">← 選單</button><div class="hud">${hudHtml}</div></div>`;
stage.addEventListener("click", e => {
  const a = e.target.closest("[data-act]"); if (!a) return;
  if (a.dataset.act === "home") home();
  if (a.dataset.act === "again") start(a.dataset.m);
  if (a.dataset.act === "say") speak(a.dataset.w);
  if (a.dataset.act === "vs") { home(); showTab("vs"); }
});
function missedTable(missed) {
  const uniq = [...new Map(missed.map(x => [x.id, x])).values()];
  return uniq.length ? `<h3 style="margin:8px 0 0">這次要再看一眼的（已加入錯題本）</h3>
    <div class="tbl"><table class="words"><tr><th>單字</th><th>詞性</th><th>中文</th><th>課</th><th></th></tr>
    ${uniq.map(x => `<tr><td>${esc(x.w)}</td><td>${esc(pos(x))}</td><td>${esc(x.c)}</td><td>${x.l}</td><td><button class="say" data-act="say" data-w="${esc(x.w)}">發音</button></td></tr>`).join("")}</table></div>`
    : `<p class="center">全對，沒有錯字！</p>`;
}
function result(m, bigText, line, missed, xp) {
  if (stopFn) stopFn(); stopFn = null;
  S.games++; const coins = gain(xp); sfx.win(); checkAch();
  openStage(`${topBar()}
    <div class="big">${bigText}</div>
    <p class="center">${line}<br>獲得 ${xp} XP・<b style="color:var(--gold)">${coins} 金幣</b></p>
    ${missedTable(missed)}
    <div class="bar" style="justify-content:center"><button class="btn" data-act="again" data-m="${m}" type="button">再玩一次</button><button class="btn ghost" data-act="home" type="button">回選單</button></div>`);
  window.ONLINE?.dirty?.(true);
}
function start(m) {
  if (stopFn) stopFn(); stopFn = null;
  const o = MODES.find(x => x.m === m);
  if (!owns("game:" + m)) { showTab("shop"); toast(`「${o.name}」要 ${o.price} 金幣解鎖`); return; }
  const need = { match: 6, quiz: 4, rock: 3, spell: 3, listen: 3 }[m];
  const f = m === "rock" || m === "listen" ? typable : m === "spell" ? (x => /^[a-z]{3,12}$/i.test(x.w)) : null;
  if (pool(f).length < need) { toast(S.wrongOnly ? "錯題本的字太少，先關掉「只練錯題本」" : "選的範圍單字太少，多選幾個課次或級別"); home(); return; }
  ({ match: playMatch, quiz: playQuiz, rock: playRock, spell: playSpell, listen: playListen })[m](pool(f));
}
$("#menu").onclick = e => { const b = e.target.closest(".mode"); if (b) start(b.dataset.m); };

// 好友對戰的題目：兩邊用同一組題目與選項
function makeVsQuestions(n = 10, lessons) {
  const BW = W.filter(x => !x.b);   // 好友對戰固定用課本單字；lessons=房主選的單元
  const src = lessons?.length ? BW.filter(x => lessons.includes(x.l)) : BW;
  return pick(src, Math.min(n, src.length), ["w"]).map(x => {
    const enQ = Math.random() < .5;
    const others = pick(BW.filter(y => y.c !== x.c && y.w !== x.w), 3, [enQ ? "c" : "w"]);
    return { id: x.id, enQ, o: shuffle([x, ...others]).map(y => y.id) };
  });
}

/* ---------- 配對消除 ---------- */
function playMatch(P) {
  const set = pick(P, 6, ["w", "c"], true);
  const tiles = shuffle(set.flatMap(x => [{ x, t: "en", s: x.w }, { x, t: "zh", s: x.c }]));
  openStage(`${topBar("", `<span class="pill">時間 <b id="tm">0.0</b></span><span class="pill">罰秒 <b id="pen">0</b></span>`)}
    <p class="center" style="margin:0">點一個英文、再點它的中文（順序不拘）</p>
    <div class="grid">${tiles.map((o, i) => `<button class="tile ${o.t}" data-i="${i}">${esc(o.s)}</button>`).join("")}</div>`);
  const t0 = performance.now(); let pen = 0, left = 6, sel = null; const missed = [];
  const iv = setInterval(() => $("#tm").textContent = ((performance.now() - t0) / 1000 + pen).toFixed(1), 100);
  stopFn = () => clearInterval(iv);
  stage.querySelector(".grid").onclick = e => {
    const b = e.target.closest(".tile"); if (!b) return;
    const o = tiles[b.dataset.i];
    if (o.t === "en") sayIf(o.x.w);
    if (!sel) { sel = b; b.classList.add("sel"); sfx.tap(); return; }
    if (sel === b) { b.classList.remove("sel"); sel = null; return; }
    const o1 = tiles[sel.dataset.i];
    if (o1.x === o.x && o1.t !== o.t) {
      sel.classList.add("done"); b.classList.add("done"); sfx.ok(); sayIf(o.x.w); hit(o.x);
      sel = null;
      if (--left === 0) {
        const t = (performance.now() - t0) / 1000 + pen;
        const best = !S.best.match || t < S.best.match; if (best) S.best.match = t; recFull("match", t);
        result("match", t.toFixed(1) + "s", best ? "新紀錄！" : `最佳紀錄 ${S.best.match.toFixed(1)} 秒`, missed, 20 + Math.max(0, Math.round(40 - t)));
      }
    } else {
      pen += 1; $("#pen").textContent = pen; sfx.bad(); miss(o1.x); missed.push(o1.x);
      [sel, b].forEach(el => { el.classList.remove("sel", "shake"); void el.offsetWidth; el.classList.add("shake"); });
      sel = null;
    }
  };
}


/* ---------- 快問連擊（好友對戰也用這個，vs 帶入固定題目與回呼） ---------- */
function playQuiz(P, vs) {
  const qs = vs ? vs.qs.map(q => W[q.id]) : pick(P, Math.min(15, P.length), ["w"], true);
  let i = 0, score = 0, combo = 0, right = 0, raf = 0, locked = false, dead = false; const missed = [];
  openStage(`${topBar("", `<span class="pill">題 <b id="qn">1</b>/${qs.length}</span><span class="pill">分數 <b id="sc">0</b></span>`)}
    ${vs ? `<div class="vsboard" id="vsb"></div>` : ""}
    <div class="timer"><i id="tbar"></i></div><div class="q" id="q"></div><div class="combo" id="cb"></div><div class="opts" id="opts"></div>`);
  stopFn = () => { dead = true; cancelAnimationFrame(raf); document.removeEventListener("keydown", key); vs?.onQuit?.(); };
  // 房間對戰的即時計分板：rows = [{ av, name, p, s, me }]，依分數排序
  if (vs) vs.setBoard = rows => {
    const b = $("#vsb"); if (dead || !b) return;
    b.innerHTML = [...rows].sort((x, y) => y.s - x.s).map((r, k) => `<div class="vsrow${r.me ? " me" : ""}"><span class="rk">${k + 1}</span><span class="nm">${esc(r.av)} ${esc(r.name)}</span>
      <div class="xpbar"><i style="width:${Math.max(0, r.p) / qs.length * 100}%"></i></div><span class="sc">${r.p < 0 ? "離開" : r.s + " 分"}</span></div>`).join("");
  };
  function key(e) { const n = +e.key; if (n >= 1 && n <= 4) stage.querySelectorAll(".opt")[n - 1]?.click(); }
  document.addEventListener("keydown", key);
  function next() {
    if (dead) return;
    if (i >= qs.length) {
      if (vs) { dead = true; cancelAnimationFrame(raf); document.removeEventListener("keydown", key); stopFn = null; return vs.onEnd(score, right, missed); }
      const best = !S.best.quiz || score > S.best.quiz; if (best) S.best.quiz = score;
      recFull("quiz", score);
      return result("quiz", score, `答對 ${right}/${qs.length}${best ? "・新紀錄！" : ""}`, missed, right * 4);
    }
    const x = qs[i], enQ = vs ? vs.qs[i].enQ : Math.random() < .5; locked = false;
    const opts = vs ? vs.qs[i].o.map(id => W[id]) : shuffle([x, ...pick((vs ? W : uni()).filter(y => y.c !== x.c && y.w !== x.w), 3, [enQ ? "c" : "w"])]);
    $("#qn").textContent = i + 1;
    $("#q").className = "q" + (enQ ? " en" : "");
    $("#q").innerHTML = enQ ? `${esc(x.w)}<small>${esc(pos(x))}</small><span style="display:block;margin-top:8px">${replayBtn()}</span>` : `${esc(x.c)}<small>${esc(pos(x))}</small>`;
    replayFn = enQ ? () => speak(x.w) : null;
    if (enQ) $("#replay").onclick = replayFn;
    $("#opts").innerHTML = opts.map((o, k) => `<button class="opt ${enQ ? "" : "en"}" data-k="${k}"><kbd>${k + 1}</kbd>${esc(enQ ? o.c : o.w)}</button>`).join("");
    if (enQ) sayIf(x.w);
    const t0 = performance.now(), T = 10000;
    let beep = 3;
    const tick = () => { const r = 1 - (performance.now() - t0) / T; if (r * 10 < beep && beep > 0) { beep--; sfx.warn(); } $("#tbar").style.width = Math.max(0, r) * 100 + "%"; if (r <= 0) answer(-1, 0); else raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    $("#opts").onclick = e => { const b = e.target.closest(".opt"); if (b) answer(+b.dataset.k, 1 - (performance.now() - t0) / T); };
    function answer(k, r) {
      if (locked) return; locked = true; cancelAnimationFrame(raf);
      const btns = stage.querySelectorAll(".opt"), ok = k >= 0 && opts[k] === x;
      btns[opts.indexOf(x)].classList.add("ok");
      if (ok) {
        combo++; right++; hit(x); if (!enQ) sayIf(x.w); combo >= 3 ? sfx.combo(combo) : sfx.ok();
        const mul = Math.min(3, 1 + Math.floor(combo / 3) * .5);
        score += Math.round((100 + r * 100) * mul);
        $("#cb").textContent = combo >= 3 ? `${combo} 連擊 ×${mul}` : "";
      } else {
        if (k >= 0) btns[k].classList.add("no");
        combo = 0; miss(x); missed.push(x); sfx.bad(); $("#cb").textContent = k < 0 ? "時間到" : "";
      }
      $("#sc").textContent = score; i++;
      if (vs) vs.onAnswer(i, score);
      setTimeout(next, ok ? 650 : 1500);
    }
  }
  next();
}

/* ---------- 單字隕石 ---------- */
function playRock(P) {
  let score = 0, lives = 3, combo = 0, n = 0, dur = 13000, raf = 0, cur = null, t0 = 0, copying = false, last = null; const missed = [], used = new Set();
  openStage(`${topBar("", `<span class="pill">生命 <b id="lf">♥♥♥</b></span><span class="pill">分數 <b id="sc">0</b></span><span class="pill">速度 <b id="spd">1</b></span>`)}
    <div class="arena" id="ar"><div class="ground"></div></div>
    <div class="msg" id="msg">打出英文後按 Enter</div>
    <form class="type" id="fm" autocomplete="off"><input id="in" placeholder="輸入英文單字" autocapitalize="off" spellcheck="false"><button class="btn" type="submit">發射</button></form>`);
  const ar = $("#ar"), inp = $("#in"), msg = $("#msg");
  stopFn = () => cancelAnimationFrame(raf);
  const accept = x => new Set(W.filter(y => y.c === x.c && typable(y)).map(y => norm(y.w)));
  function spawn() {
    let x; if (P.every(y => used.has(y))) used.clear();   // 本局不重複：全部出過才重新洗牌
    const left = P.filter(y => !used.has(y) && y !== last), nw = left.filter(y => !seenW(y)), src = nw.length ? nw : left.length ? left : P;
    x = src[Math.random() * src.length | 0];
    used.add(x); last = x; cur = { x, el: document.createElement("div") };
    cur.el.className = "rock"; cur.el.innerHTML = `${esc(x.c)}<small>${esc(pos(x))}・${x.l}</small>`;
    ar.append(cur.el); t0 = performance.now(); raf = requestAnimationFrame(fall);
  }
  function fall() {
    const r = (performance.now() - t0) / dur, h = ar.clientHeight - cur.el.offsetHeight - 10;
    cur.el.style.top = Math.min(r, 1) * h + "px";
    if (r >= 1) return land(); raf = requestAnimationFrame(fall);
  }
  function land() {
    lives--; combo = 0; miss(cur.x); missed.push(cur.x); sfx.land();
    $("#lf").textContent = "♥".repeat(lives) + "♡".repeat(3 - lives);
    sayIf(cur.x.w);
    if (lives <= 0) return end();
    copying = true; cur.el.style.borderColor = "var(--bad)";
    msg.className = "msg bad"; msg.innerHTML = `答案是 <code>${esc(cur.x.w)}</code>，抄一次再繼續`;
    inp.value = ""; inp.focus();
  }
  function end() {
    const best = !S.best.rock || score > S.best.rock; if (best) S.best.rock = score; recFull("rock", score);
    result("rock", score, `擊碎 ${n} 顆隕石${best ? "・新紀錄！" : ""}`, missed, n * 3);
  }
  $("#fm").onsubmit = e => {
    e.preventDefault(); const v = norm(inp.value); if (!v || !cur) return;
    if (copying) {
      if (v === norm(cur.x.w)) { copying = false; cur.el.remove(); msg.className = "msg"; msg.textContent = "好，下一顆！"; inp.value = ""; spawn(); }
      else { sfx.bad(); inp.classList.remove("shake"); void inp.offsetWidth; inp.classList.add("shake"); }
      return;
    }
    if (accept(cur.x).has(v)) {
      cancelAnimationFrame(raf); n++; combo++; hit(cur.x); sfx.boom(); sayIf(cur.x.w);
      score += 10 * Math.min(5, 1 + Math.floor(combo / 3));
      dur = Math.max(5000, dur - 350); $("#spd").textContent = Math.round(13000 / dur * 10) / 10;
      $("#sc").textContent = score; msg.className = "msg good"; msg.textContent = combo >= 3 ? `${combo} 連擊！` : "擊碎！";
      const el = cur.el; el.classList.add("boom"); setTimeout(() => el.remove(), 350);
      inp.value = ""; spawn();
    } else { sfx.bad(); msg.className = "msg bad"; msg.textContent = "不對，再試試"; inp.select(); }
  };
  inp.focus(); spawn();
}

/* ---------- 拼字工坊 ---------- */
function playSpell(P) {
  const qs = pick(P, Math.min(10, P.length), ["w"], true);
  let i = 0, score = 0, right = 0; const missed = [];
  openStage(`${topBar("", `<span class="pill">題 <b id="qn">1</b>/${qs.length}</span><span class="pill">分數 <b id="sc">0</b></span>`)}
    <div class="q" id="q"></div><div class="slots" id="sl"></div><div class="letters" id="lt"></div>
    <div class="msg" id="msg"></div>
    <div class="bar" style="justify-content:center"><button class="btn ghost" id="sayB" type="button">🔊 聽發音 <kbd>1</kbd></button><button class="btn ghost" id="hintB" type="button">提示一個字母（−10）</button><button class="btn ghost" id="skipB" type="button">看答案</button></div>`);
  let x, ans, letters, slots, hints, tries, done, dead = false;
  function key(e) {
    if (done) return;
    if (e.key === "Backspace") { e.preventDefault(); undo(); return; }
    if (/^[a-z]$/i.test(e.key)) { const k = letters.findIndex((c, j) => !c.used && c.ch === e.key.toLowerCase()); if (k >= 0) put(k); }
  }
  document.addEventListener("keydown", key);
  stopFn = () => { dead = true; document.removeEventListener("keydown", key); };
  function next() {
    if (dead) return;
    if (i >= qs.length) {
      const best = !S.best.spell || score > S.best.spell; if (best) S.best.spell = score; recFull("spell", score);
      return result("spell", score, `拼對 ${right}/${qs.length}${best ? "・新紀錄！" : ""}`, missed, right * 4);
    }
    x = qs[i]; ans = x.w.toLowerCase(); hints = 0; tries = 0; done = false;
    letters = shuffle([...ans]).map(ch => ({ ch, used: false }));
    slots = Array(ans.length).fill(null);
    $("#qn").textContent = i + 1;
    $("#q").innerHTML = `${esc(x.c)}<small>${esc(pos(x))}・${ans.length} 個字母</small>`;
    $("#msg").className = "msg"; $("#msg").textContent = "";
    draw(); sayIf(x.w);
  }
  function draw() {
    $("#sl").className = "slots";
    $("#sl").innerHTML = slots.map((s, j) => `<button class="slot ${s ? "fill" : ""} ${s && s.hint ? "hint" : ""}" data-j="${j}">${s ? s.ch : ""}</button>`).join("");
    $("#lt").innerHTML = letters.map((c, k) => `<button class="let ${c.used ? "used" : ""}" data-k="${k}">${c.ch}</button>`).join("");
  }
  function put(k) {
    const j = slots.indexOf(null); if (j < 0) return;
    letters[k].used = true; slots[j] = { ch: letters[k].ch, k }; sfx.tap(); draw();
    if (!slots.includes(null)) check();
  }
  function undo(j) {
    if (j === undefined) { for (j = slots.length - 1; j >= 0 && !(slots[j] && !slots[j].hint); j--); }
    if (j < 0 || !slots[j] || slots[j].hint) return;
    letters[slots[j].k].used = false; slots[j] = null; draw();
  }
  function check() {
    if (slots.map(s => s.ch).join("") === ans) {
      done = true; right++; const pts = Math.max(5, 30 - tries * 5); score += pts;
      tries ? miss(x) : hit(x); if (tries) missed.push(x);
      $("#sc").textContent = score; $("#sl").classList.add("ok"); sfx.ok();
      $("#msg").className = "msg good"; $("#msg").textContent = `正確 +${pts}`; sayIf(x.w);
      i++; setTimeout(next, 900);
    } else {
      tries++; sfx.bad(); $("#msg").className = "msg bad"; $("#msg").textContent = "順序不對，點格子把字母拿回來";
      $("#sl").classList.remove("shake"); void $("#sl").offsetWidth; $("#sl").classList.add("shake");
    }
  }
  $("#lt").onclick = e => { const b = e.target.closest(".let"); if (b && !done) put(+b.dataset.k); };
  $("#sl").onclick = e => { const b = e.target.closest(".slot"); if (b && !done) undo(+b.dataset.j); };
  $("#sayB").onclick = () => { if (!done) speak(x.w); };
  replayFn = () => { if (!done) speak(x.w); }; replayFn.digit = true;   // 拼字時 R 是字母，所以重聽用數字 1
  $("#hintB").onclick = () => {
    if (done) return;
    // 把錯位的字母全部收回，填入下一個正確字母
    slots.forEach((s, j) => { if (s && !s.hint && s.ch !== ans[j]) { letters[s.k].used = false; slots[j] = null; } });
    const j = slots.findIndex((s, j) => !s || s.ch !== ans[j]); if (j < 0) return;
    if (slots[j]) { letters[slots[j].k].used = false; }
    const k = letters.findIndex(c => !c.used && c.ch === ans[j]);
    letters[k].used = true; slots[j] = { ch: ans[j], k, hint: true }; hints++; score -= 10; $("#sc").textContent = score; draw();   // 提示當下就倒扣 10 分，分數可以變負的
    if (!slots.includes(null)) check();
  };
  $("#skipB").onclick = () => {
    if (done) return; done = true; miss(x); missed.push(x);
    $("#msg").className = "msg bad"; $("#msg").innerHTML = `答案是 <code>${esc(x.w)}</code>`; speak(x.w);
    i++; setTimeout(next, 1800);
  };
  next();
}

/* ---------- 聽音拼字 ---------- */
function playListen(P) {
  const qs = pick(P, Math.min(10, P.length), ["w"], true);
  let i = 0, score = 0, right = 0, x, tries, done, dead = false; const missed = [];
  stopFn = () => { dead = true; };
  openStage(`${topBar("", `<span class="pill">題 <b id="qn">1</b>/${qs.length}</span><span class="pill">分數 <b id="sc">0</b></span>`)}
    <div class="bar" style="justify-content:center;padding-top:20px"><button class="btn" id="play" type="button" title="快捷鍵 R；輸入框裡用 數字 1 或 Alt+R">🔊 再聽一次 <kbd>1</kbd></button><button class="btn ghost" id="slow" type="button">慢速</button></div>
    <div class="q" id="q" style="min-height:90px"></div>
    <div class="msg" id="msg"></div>
    <form class="type" id="fm" autocomplete="off"><input id="in" placeholder="輸入聽到的單字" autocapitalize="off" spellcheck="false"><button class="btn" type="submit">送出</button></form>
    <div class="bar" style="justify-content:center"><button class="btn ghost" id="skipB" type="button">看答案</button></div>`);
  const inp = $("#in"), msg = $("#msg"), q = $("#q");
  $("#play").onclick = () => { speak(x.w); inp.focus(); };
  replayFn = () => speak(x.w);
  $("#slow").onclick = () => { speak(x.w, .55); inp.focus(); };
  const show = () => { q.className = "q en"; q.innerHTML = `${esc(x.w)}<small>${esc(pos(x))}・${esc(x.c)}</small>`; };
  function next() {
    if (dead) return;
    if (i >= qs.length) {
      const best = !S.best.listen || score > S.best.listen; if (best) S.best.listen = score; recFull("listen", score);
      return result("listen", score, `聽對 ${right}/${qs.length}${best ? "・新紀錄！" : ""}`, missed, right * 4);
    }
    x = qs[i]; tries = 0; done = false;
    const n = x.w.split(" ").length;
    $("#qn").textContent = i + 1; q.className = "q"; q.innerHTML = `<small>${n > 1 ? `片語，${n} 個字` : `${x.w.length} 個字母`}</small>`;
    msg.className = "msg"; msg.textContent = "聽到什麼就打什麼，按 Enter 送出";
    inp.value = ""; inp.focus(); setTimeout(() => speak(x.w), 250);
  }
  function reveal() {
    done = true; miss(x); missed.push(x); sfx.bad(); show();
    msg.className = "msg bad"; msg.textContent = "記一下拼法"; speak(x.w); i++; setTimeout(next, 2200);
  }
  $("#fm").onsubmit = e => {
    e.preventDefault(); if (done) return; const v = norm(inp.value); if (!v) return;
    if (v === norm(x.w)) {
      done = true; right++; const pts = tries ? 10 : 25; score += pts; $("#sc").textContent = score;
      tries ? miss(x) : hit(x); if (tries) missed.push(x); sfx.ok(); show();
      msg.className = "msg good"; msg.textContent = `正確 +${pts}`; i++; setTimeout(next, 1300);
    } else if (++tries === 1) {
      sfx.bad(); msg.className = "msg bad"; msg.textContent = `不對。提示：${pos(x)}　${x.c}`; inp.select(); speak(x.w, .7);
    } else reveal();
  };
  $("#skipB").onclick = () => { if (!done) reveal(); };
  next();
}

$("#total")?.replaceChildren(String(BOOKN));
applySkin(); renderChips(); hud(); renderLogDot(); setTimeout(checkAch, 800);
window.APP = { get S() { return S; }, set S(v) { S = v; }, save, checkAch, nameHtml, titleHtml, DEV_CODE, toast, sfx, modal, esc, lvOf, gain, owns, FREE, renderTop, hud, applySkin, renderChips,
  refreshTab, showTab, openStage, topBar, home, LESSONS, WORDS_BOOK: () => W.filter(x => !x.b), missedTable, playQuiz, makeVsQuestions, armed, get tab() { return curTab; } };
