// @ts-nocheck
"use client";
import { useState, useEffect, useRef, Suspense, lazy } from "react";
const Scanner = lazy(() => import("@/components/Scanner"));

const C = {
  bg: "#f0ece4", surface: "#1e1c18", card: "#ffffff", border: "rgba(120,105,80,0.15)",
  accent: "#3a5a8a", success: "#3a6a45", warning: "#8a6530", danger: "#8a3530",
  text: "#1e1c18", muted: "#8a7d6a", dim: "#b0a590",
  navBg: "#1e1c18", navText: "rgba(240,236,228,0.9)", navMuted: "rgba(240,236,228,0.35)",
  headerBg: "#1e1c18", headerText: "#f0ece4",
};

function photoUrl(url: string) {
  if (!url) return "";
  if (url.startsWith("onedrive://")) {
    return "/api/photo?id=" + url.replace("onedrive://", "");
  }
  if (url.includes("private.blob.vercel-storage.com")) {
    return "/api/blob?url=" + encodeURIComponent(url);
  }
  return url;
}

const statusLabel: Record<string,string> = { pending:"待配货", packed:"待审核", approved:"已完成", rejected:"待重拍", shipped_unreviewed:"未审核发出" };
const statusColor: Record<string,string> = { pending: C.dim, packed: C.warning, approved: C.success, rejected: C.danger, shipped_unreviewed: "#6b3a8a", history: C.muted };

export default function App() {
  const [unlocked, setUnlocked]       = useState(false);
  const [pinInput, setPinInput]         = useState("");
  const [pinError, setPinError]         = useState(false);
  const [worker, setWorker]           = useState<any>(null);
  const [workers, setWorkers]         = useState<any[]>([]);
  const [orders, setOrders]           = useState<any[]>([]);
  const [tab, setTab]                 = useState("scan");
  const [activeOrder, setActive]      = useState<any>(null);
  const [scanInput, setScanInput]     = useState("");
  const [scanError, setScanError]     = useState("");
  const [syncing, setSyncing]         = useState(false);
  const [lastSync, setLastSync]       = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [previewImg, setPreviewImg] = useState<string|null>(null);
  const scanRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (localStorage.getItem("unlocked") === "1") setUnlocked(true);
    loadWorkers();
    loadOrders();
    const saved = localStorage.getItem("worker");
    if (saved) setWorker(JSON.parse(saved));
  }, []);

  useEffect(() => {
    if (worker && !activeOrder && tab === "scan") scanRef.current?.focus();
  }, [worker, activeOrder, tab]);

  async function loadWorkers() {
    const res = await fetch("/api/workers");
    const data = await res.json();
    setWorkers(data.workers ?? []);
  }

  async function loadOrders() {
    const res = await fetch("/api/orders");
    const data = await res.json();
    setOrders(data.orders ?? []);
  }

  async function syncOrders() {
    setSyncing(true);
    await fetch("/api/orders", { method: "POST" });
    await loadOrders();
    setLastSync(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }));
    setSyncing(false);
  }

  async function resetOrders() {
    if (!confirm("确认重置所有待审核/已拒绝订单回到「待配货」？此操作不可撤销。")) return;
    const res = await fetch("/api/admin/reset", { method: "POST" });
    const data = await res.json();
    await loadOrders();
    alert(`已重置 ${data.reset} 单`);
  }

  async function clearBacklog() {
    if (!confirm("确认清除所有积压订单？这些订单将标记为「未审核发出」，不可撤销。")) return;
    const res = await fetch("/api/admin/clear-backlog", { method: "POST" });
    const data = await res.json();
    await loadOrders();
    alert(`已清除积压 ${data.cleared} 单`);
  }

  async function doScan(code: string) {
    const res = await fetch("/api/scan?code=" + encodeURIComponent(code));
    const data = await res.json();
    if (data.ok) { setActive(data.order); setScanInput(""); setScanError(""); }
    else { setScanError(data.error); setTimeout(() => setScanError(""), 3000); }
  }

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    const val = scanInput.trim();
    if (val) doScan(val);
  }

  async function handleReview(orderSn: string, pass: boolean, comment: string) {
    await fetch("/api/review", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_sn: orderSn, pass, comment, reviewer: worker?.name }) });
    await loadOrders();
  }

  function chooseWorker(w: any) { setWorker(w); localStorage.setItem("worker", JSON.stringify(w)); }

  const now = new Date();
  const todayCutoff = new Date(); todayCutoff.setHours(14,0,0,0);
  const yesterdayCutoff = new Date(); yesterdayCutoff.setDate(yesterdayCutoff.getDate()-1); yesterdayCutoff.setHours(14,0,0,0);
  const todayMidnight = new Date(); todayMidnight.setHours(23,59,59,999);
  const allUnscheduled = orders.filter(o => o.shopee_status === "READY_TO_SHIP");
  const todayDue = allUnscheduled.filter(o => {
    const created = new Date(o.create_time * 1000);
    return created >= yesterdayCutoff && created < todayCutoff;
  });
  const tomorrowDue = allUnscheduled.filter(o => {
    const created = new Date(o.create_time * 1000);
    return created >= todayCutoff && created <= todayMidnight;
  });
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const todayApproved = orders.filter(o => o.review_status === "approved" && o.reviewed_at && o.reviewed_at * 1000 >= todayStart.getTime());


  if (!unlocked) return (
    <div style={{ background:"#1e1c18", minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:32, fontFamily:"sans-serif" }}>
      <img src="/icon.png" alt="PackFlow" style={{ width:100, height:100, borderRadius:20, marginBottom:24, objectFit:"cover" }} />
      <div style={{ fontSize:11, color:"rgba(240,236,228,0.5)", letterSpacing:4, textTransform:"uppercase", marginBottom:32 }}>PackFlow</div>
      <input
        type="password"
        value={pinInput}
        onChange={e => { setPinInput(e.target.value); setPinError(false); }}
        onKeyDown={e => { if(e.key==="Enter") { if(pinInput==="2425"){setUnlocked(true);localStorage.setItem("unlocked","1");}else{setPinError(true);setPinInput("");} }}}
        placeholder="输入密码"
        maxLength={10}
        style={{ background:"rgba(240,236,228,0.08)", border:"1px solid "+(pinError?"#8a3530":"rgba(240,236,228,0.2)"), borderRadius:4, padding:"14px 20px", color:"#f0ece4", fontSize:16, textAlign:"center", outline:"none", width:200, letterSpacing:4, marginBottom:8, fontFamily:"sans-serif" }}
        autoFocus
      />
      {pinError && <div style={{ fontSize:12, color:"#8a3530", marginBottom:8 }}>密码错误</div>}
      <button onClick={() => { if(pinInput==="2425"){setUnlocked(true);localStorage.setItem("unlocked","1");}else{setPinError(true);setPinInput("");} }}
        style={{ background:"rgba(240,236,228,0.1)", border:"1px solid rgba(240,236,228,0.2)", borderRadius:4, padding:"12px 32px", color:"#f0ece4", fontSize:13, cursor:"pointer", letterSpacing:1, fontFamily:"sans-serif", marginTop:4 }}>
        进入
      </button>
    </div>
  );

  if (!worker) return <WorkerPicker workers={workers} onSelect={chooseWorker} onAdd={async (name: string) => {
    await fetch("/api/workers", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({name}) });
    await loadWorkers();
  }} />;

  if (activeOrder) return <PackingDetail order={activeOrder} worker={worker.name}
    onBack={() => { setActive(null); loadOrders(); }} onReload={loadOrders} onPreview={setPreviewImg} />;

  return (
    <div style={{ background: C.bg, minHeight:"100vh" }}>
    <div style={{ background: C.bg, minHeight:"100vh", color: C.text, fontFamily:"var(--font-sans,sans-serif)", maxWidth:480, margin:"0 auto" }}>
      {showScanner && <Suspense fallback={null}><Scanner onScan={(code) => { setShowScanner(false); doScan(code); }} onClose={() => setShowScanner(false)} /></Suspense>}
      {previewImg && (
        <div onClick={() => setPreviewImg(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.92)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <img src={previewImg} alt="" style={{ maxWidth:"100%", maxHeight:"90vh", objectFit:"contain", borderRadius:4 }} />
          <div style={{ position:"absolute", top:20, right:20, color:"#fff", fontSize:24, cursor:"pointer" }}>✕</div>
        </div>
      )}
      <div style={{ borderBottom:"1px solid rgba(240,236,228,0.08)" }}>
        <div style={{ padding:"24px 20px 20px", textAlign:"center", background:C.bg, borderBottom:"1px solid rgba(120,105,80,0.12)" }}>
          <img src="/logo-dark.png" alt="Aether Flow" style={{ height:56, objectFit:"contain", display:"inline-block" }} />
          <div style={{ fontSize:10, color:C.muted, letterSpacing:3, textTransform:"uppercase", marginTop:12 }}>配货打包系统</div>
        </div>
        <div style={{ padding:"10px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", background:C.bg, borderBottom:"1px solid rgba(120,105,80,0.12)" }}>
        <div style={{ fontSize:12, color:C.text, letterSpacing:1 }}>{worker.role==="boss"?"审核🔍":worker.name}</div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={syncOrders} disabled={syncing} style={{ background:"#ffffff", border:"1px solid rgba(120,105,80,0.2)", borderRadius:3, padding:"6px 12px", color:"#1e1c18", fontSize:11, cursor:"pointer" }}>
            {syncing ? "同步中…" : "↻ 同步"+(lastSync?" "+lastSync:"")}</button>
          {worker.role==="boss" && <button onClick={resetOrders} style={{ background:"#ffffff", border:"1px solid rgba(138,53,48,0.35)", borderRadius:3, padding:"4px 10px", color:C.danger, fontSize:11, cursor:"pointer" }}>重置</button>}
          <button onClick={() => { setWorker(null); localStorage.removeItem("worker"); }} style={{ background:"#ffffff", border:"1px solid rgba(120,105,80,0.2)", borderRadius:3, padding:"4px 10px", color:"#1e1c18", fontSize:11, cursor:"pointer" }}>换人</button>
        </div>
      </div>
      </div>
      <div style={{ padding: tab==="history"||tab==="review" ? "20px 0 80px" : "20px 20px 80px" }}>
        {tab==="scan" && <div style={{padding:"0 20px"}}><ScanTab orders={orders} scanInput={scanInput} setScanInput={setScanInput} scanError={scanError} scanRef={scanRef} onScan={handleScan} onSelect={setActive} onSync={syncOrders} syncing={syncing} onOpenScanner={() => setShowScanner(true)} todayDue={todayDue} tomorrowDue={tomorrowDue} worker={worker} onClearBacklog={clearBacklog} /></div>}
        {tab==="list" && <div style={{padding:"0 20px"}}><ListTab orders={orders} onSelect={setActive} /></div>}
        {tab==="review" && worker.role==="boss" && <div style={{padding:"0 20px"}}><ReviewTab orders={orders} onReview={handleReview} /></div>}
        {tab==="history" && <div style={{padding:"0 20px"}}><HistoryTab orders={orders} onPreview={setPreviewImg} /></div>}
        {tab==="review" && worker.role!=="boss" && <div style={{ textAlign:"center", color:C.dim, padding:"60px 0" }}>复核功能仅限复核账号</div>}
      </div>
      <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:480, background:C.bg, borderTop:"1px solid rgba(120,105,80,0.15)", display:"flex" }}>
        {[{id:"history",label:"历史",icon:"🕐"},{id:"scan",label:"配货",icon:"📦"},{id:"review",label:"复核",icon:"✅"}].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex:1, padding:"12px 0", background:"none", border:"none", cursor:"pointer", color:tab===t.id?C.text:C.muted, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
            <span style={{ fontSize:20 }}>{t.icon}</span>
            <span style={{ fontSize:11 }}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
    </div>
  );
}

function WorkerPicker({ workers, onSelect, onAdd }: { workers: any[], onSelect: (w: any) => void, onAdd: (name: string) => void }) {
  const [newName, setNewName] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  return (
    <div style={{ background:"#f0ece4", minHeight:"100vh", display:"flex", flexDirection:"column" }}>
      {/* 顶部品牌区 */}
      <div style={{ padding:"48px 32px 32px", textAlign:"center", borderBottom:"1px solid rgba(120,105,80,0.12)" }}>
        <img src="/logo-dark.png" alt="Aether Flow" style={{ height:52, objectFit:"contain", display:"inline-block", marginBottom:12 }} />
        <div style={{ width:24, height:1, background:"rgba(120,105,80,0.3)", margin:"0 auto 10px" }} />
        <div style={{ fontSize:9, color:"#8a7d6a", letterSpacing:4, textTransform:"uppercase" }}>配货打包系统</div>
      </div>

      {/* 选人区 */}
      <div style={{ flex:1, padding:"32px 24px" }}>
        <div style={{ fontSize:9, color:"#8a7d6a", letterSpacing:3, textTransform:"uppercase", marginBottom:20 }}>选择账号继续</div>
        <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:24 }}>
          {workers.map(w => (
            <button key={w.id} onClick={() => onSelect(w)}
              style={{ background:"#ffffff", border:"1px solid rgba(120,105,80,0.15)", borderRadius:4, padding:"16px 20px", color:"#1e1c18", fontSize:13, fontWeight:400, cursor:"pointer", textAlign:"left", display:"flex", justifyContent:"space-between", alignItems:"center", fontFamily:"inherit" }}>
              <div>
                <div style={{ fontSize:13, color:"#1e1c18", marginBottom:2 }}>{w.role==="boss"?"审核":w.name}</div>
                <div style={{ fontSize:10, color:"#8a7d6a", letterSpacing:1, textTransform:"uppercase" }}>{w.role==="boss"?"复核权限":"配货员"}</div>
              </div>
              <span style={{ color:"#8a7d6a", fontSize:16 }}>→</span>
            </button>
          ))}
        </div>

        {/* 添加员工 */}
        {!showAdd ? (
          <button onClick={() => setShowAdd(true)}
            style={{ width:"100%", background:"transparent", border:"1px dashed rgba(120,105,80,0.3)", borderRadius:4, padding:"13px", color:"#8a7d6a", fontSize:11, letterSpacing:1, textTransform:"uppercase", cursor:"pointer", fontFamily:"inherit" }}>
            + 添加员工
          </button>
        ) : (
          <div style={{ display:"flex", gap:8 }}>
            <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="输入员工姓名"
              style={{ flex:1, background:"#ffffff", border:"1px solid rgba(120,105,80,0.2)", borderRadius:4, padding:"12px 14px", color:"#1e1c18", fontSize:13, outline:"none", fontFamily:"inherit" }} />
            <button onClick={() => { if(newName.trim()){ onAdd(newName.trim()); setNewName(""); setShowAdd(false); }}}
              style={{ background:"#1e1c18", border:"none", borderRadius:4, padding:"0 18px", color:"#f0ece4", fontSize:13, cursor:"pointer" }}>确认</button>
          </div>
        )}
      </div>

      {/* 底部 */}
      <div style={{ padding:"20px 24px", textAlign:"center", borderTop:"1px solid rgba(120,105,80,0.1)" }}>
        <div style={{ fontSize:9, color:"rgba(120,105,80,0.4)", letterSpacing:2, textTransform:"uppercase" }}>Aether Flow · Singapore</div>
      </div>
    </div>
  );
}

function ScanTab({ orders, scanInput, setScanInput, scanError, scanRef, onScan, onSelect, onSync, syncing, onOpenScanner, todayDue, tomorrowDue, worker, onClearBacklog }: any) {
  const [quickList, setQuickList] = useState(null);
  const unscheduled = orders.filter(o => o.shopee_status === "READY_TO_SHIP");

  // 今日配货window：昨天14:00 → 今天14:00，不含明日订单
  const yc = new Date(); yc.setDate(yc.getDate() - 1); yc.setHours(14, 0, 0, 0);
  const tc = new Date(); tc.setHours(14, 0, 0, 0);
  // 积压：昨天14:00之前、status仍为pending的订单
  const backlog = orders.filter(o => o.status === "pending" && o.create_time * 1000 < yc.getTime());
  const todayOrders = orders.filter(o => {
    const t = o.create_time * 1000;
    return t >= yc.getTime() && t < tc.getTime();
  });
  const pending  = todayOrders.filter(o => o.status === "pending");
  const inReview = todayOrders.filter(o => o.review_status === "pending");
  const rejected = todayOrders.filter(o => o.review_status === "rejected");
  const doneInWindow = todayOrders.filter(o => o.review_status === "approved");
  const total = doneInWindow.length;
  return (
    <div>
      {backlog.length > 0 && (
        <div style={{ background:"rgba(138,101,48,0.1)", border:"1px solid rgba(138,101,48,0.35)", borderRadius:8, padding:"12px 14px", marginBottom:12, display:"flex", justifyContent:"space-between", alignItems:"center", gap:12 }}>
          <div>
            <div style={{ fontSize:13, color:C.warning, fontWeight:600 }}>积压未处理 {backlog.length} 单</div>
            <div style={{ fontSize:10, color:C.muted, marginTop:2 }}>昨日14:00前的订单未完成配货</div>
          </div>
          {worker?.role === "boss" && (
            <button onClick={onClearBacklog} style={{ background:C.warning, border:"none", borderRadius:4, padding:"7px 12px", color:"#fff", fontSize:11, cursor:"pointer", whiteSpace:"nowrap", flexShrink:0 }}>
              一键清除
            </button>
          )}
        </div>
      )}
      <div style={{ background:"#ffffff", border:"1px solid rgba(120,105,80,0.15)", borderRadius:4, padding:"16px", marginBottom:16 }}>
        <div style={{ fontSize:9, color:C.muted, letterSpacing:3, textTransform:"uppercase", marginBottom:12 }}>📦 扫描配货</div>
        <form onSubmit={onScan}>
          <div style={{ display:"flex", gap:8, marginBottom:8 }}>
            <input ref={scanRef} value={scanInput} onChange={e=>setScanInput(e.target.value.toUpperCase())} placeholder="扫描或输入面单号…" autoComplete="off"
              style={{ flex:1, background:"#f8f5f0", border:"1px solid rgba(120,105,80,0.2)", borderRadius:3, padding:"10px 12px", color:C.text, fontSize:16, outline:"none" }} />
            <button type="submit" style={{ background:"#1e1c18", border:"none", borderRadius:3, padding:"0 16px", color:"#f0ece4", fontSize:18, cursor:"pointer" }}>→</button>
          </div>
          <button type="button" onClick={onOpenScanner}
            style={{ width:"100%", background:"transparent", border:"1px dashed rgba(120,105,80,0.3)", borderRadius:3, padding:"9px 0", color:C.muted, fontSize:12, letterSpacing:0.5, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
            <span style={{ fontSize:20 }}>📷</span> 摄像头扫码
          </button>
          {scanError && <div style={{ color:C.danger, fontSize:13, marginTop:8 }}>{scanError}</div>}
        </form>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
        <div onClick={() => setQuickList(quickList==="今日完成"?null:"今日完成")}
          style={{ background:quickList==="今日完成"?"rgba(58,90,138,0.08)":C.card, borderRadius:12, padding:"12px 16px", border:"1px solid "+(quickList==="今日完成"?"rgba(58,90,138,0.4)":C.border), display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer" }}>
          <div style={{ fontSize:13, color:C.muted }}>今日完成</div>
          <div style={{ fontSize:20, fontWeight:700, color:C.text }}>{total} 单</div>
        </div>
        <div onClick={() => setQuickList(quickList==="今日配货"?null:"今日配货")}
          style={{ background:quickList==="今日配货"?"rgba(138,53,48,0.08)":C.card, borderRadius:12, padding:"12px 16px", border:"1px solid "+(quickList==="今日配货"?C.danger:todayDue.length>0?C.danger:C.border), display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer" }}>
          <div>
            <div style={{ fontSize:13, color:C.muted }}>今日配货</div>
            <div style={{ fontSize:9, color:C.danger, letterSpacing:1, marginTop:2 }}>今日必发 {todayDue.length} 单</div>
            <div style={{ fontSize:9, color:C.muted, letterSpacing:1, marginTop:1 }}>明日待发 {tomorrowDue.length} 单</div>
          </div>
          <div style={{ fontSize:20, fontWeight:700, color:todayDue.length>0?C.danger:C.muted }}>{todayOrders.length} 单</div>
        </div>
      </div>
      <div style={{ background:C.card, borderRadius:12, padding:"10px 16px", marginBottom:16, border:"1px solid "+C.border }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
          <div style={{ fontSize:12, color:C.muted }}>配货进度</div>
          <div style={{ fontSize:12, color:C.muted }}>{total} / {todayOrders.length}</div>
        </div>
        <div style={{ background:C.border, borderRadius:4, height:6, overflow:"hidden" }}>
          <div style={{ background:C.success, height:"100%", width: todayOrders.length > 0 ? (total / todayOrders.length * 100) + "%" : "0%", borderRadius:4, transition:"width .3s" }} />
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:24 }}>
        {[{label:"待配货",val:pending.length,color:C.accent},{label:"待审核",val:inReview.length,color:C.warning},{label:"待重拍",val:rejected.length,color:C.danger}].map(s => (
          <div key={s.label} onClick={() => setQuickList(quickList===s.label?null:s.label)}
            style={{ background:quickList===s.label?s.color+"22":C.card, borderRadius:12, padding:"14px 12px", textAlign:"center", border:"1px solid "+(quickList===s.label?s.color:C.border), cursor:"pointer" }}>
            <div style={{ fontSize:24, fontWeight:400, color:s.color, fontFamily:"Georgia,serif" }}>{s.val}</div>
            <div style={{ fontSize:9, color:C.muted, marginTop:4, letterSpacing:2, textTransform:"uppercase" }}>{s.label}</div>
          </div>
        ))}
      </div>
      {quickList && (
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:13, color:C.muted, fontWeight:600, marginBottom:10 }}>
            {quickList} ({(quickList==="待配货"?pending:quickList==="待审核"?inReview:quickList==="待重拍"?rejected:quickList==="今日完成"?doneInWindow:unscheduled).length})
            <button onClick={() => setQuickList(null)} style={{ float:"right", background:"none", border:"none", color:C.dim, cursor:"pointer", fontSize:12 }}>收起 ↑</button>
          </div>
          {quickList==="今日配货" && todayDue.length > 0 && (
            <div style={{ fontSize:9, color:C.danger, letterSpacing:2, textTransform:"uppercase", marginBottom:6 }}>今日必发</div>
          )}
          {quickList==="今日配货" && todayDue.map(o => (
            <div key={o.order_sn} style={{ background:"rgba(138,53,48,0.06)", border:"1px solid rgba(138,53,48,0.25)", borderRadius:4, padding:"10px 14px", marginBottom:6 }}>
              <div style={{ fontSize:12, fontWeight:500, color:C.text }}>{o.order_sn}</div>
              <div style={{ fontSize:10, color:C.muted, marginTop:2 }}>{o.items.map(i=>i.model||i.sku).join("、")}</div>
            </div>
          ))}
          {quickList==="今日配货" && tomorrowDue.length > 0 && (
            <div style={{ fontSize:9, color:C.muted, letterSpacing:2, textTransform:"uppercase", margin:"10px 0 6px" }}>明日发货</div>
          )}
          {quickList==="今日配货" && tomorrowDue.map(o => (
            <div key={o.order_sn} style={{ background:"#ffffff", border:"1px solid rgba(120,105,80,0.12)", borderRadius:4, padding:"10px 14px", marginBottom:6 }}>
              <div style={{ fontSize:12, fontWeight:500, color:C.text }}>{o.order_sn}</div>
              <div style={{ fontSize:10, color:C.muted, marginTop:2 }}>{o.items.map(i=>i.model||i.sku).join("、")}</div>
            </div>
          ))}
          {quickList!=="今日配货" && (quickList==="待配货"?pending:quickList==="待审核"?inReview:quickList==="待重拍"?rejected:quickList==="今日完成"?doneInWindow:unscheduled).map(o => (
            <div key={o.order_sn} onClick={() => onSelect(o)}
              style={{ background: quickList==="待重拍"?"rgba(138,53,48,0.05)":"#ffffff", border:"1px solid "+(quickList==="待重拍"?"rgba(138,53,48,0.3)":"rgba(120,105,80,0.12)"), borderRadius:4, padding:"12px 14px", marginBottom:6, cursor:"pointer" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600 }}>{o.order_sn}</div>
                  <div style={{ fontSize:9, color:C.muted, marginTop:4, letterSpacing:2, textTransform:"uppercase" }}>{o.items.map(i=>i.model||i.sku).join("、")}</div>
                  {o.worker && <div style={{ fontSize:11, color:C.dim, marginTop:1 }}>配货员：{o.worker}</div>}
                  {quickList==="待重拍" && o.review_comment && (
                    <div style={{ marginTop:8, background:"rgba(138,53,48,0.08)", border:"1px solid rgba(138,53,48,0.25)", borderRadius:3, padding:"8px 10px" }}>
                      <div style={{ fontSize:10, color:C.danger, fontWeight:700, marginBottom:3, letterSpacing:0.5 }}>⚠️ 复核意见</div>
                      <div style={{ fontSize:12, color:"#5a1a1a", fontWeight:500, lineHeight:1.5 }}>{o.review_comment}</div>
                    </div>
                  )}
                </div>
                <span style={{ color:C.danger, fontSize:14, marginLeft:8 }}>→</span>
              </div>
            </div>
          ))}
          {quickList==="今日配货" && todayDue.length===0 && tomorrowDue.length===0 && (
            <div style={{ textAlign:"center", color:C.dim, fontSize:12, padding:"20px 0" }}>暂无待配货订单</div>
          )}
        </div>
      )}


      {orders.length === 0 && (
        <div style={{ textAlign:"center", padding:"40px 0" }}>
          <div style={{ color:C.dim, fontSize:14, marginBottom:16 }}>暂无订单，先同步一下</div>
          <button onClick={onSync} disabled={syncing} style={{ background:C.accent, border:"none", borderRadius:10, padding:"12px 24px", color:"#fff", fontSize:14, cursor:"pointer" }}>
            {syncing?"同步中…":"↻ 从 Shopee 同步订单"}</button>
        </div>
      )}
      {pending.length > 0 && (
        <div>
          <div style={{ fontSize:13, color:C.muted, fontWeight:600, marginBottom:10 }}>今日待配货 ({pending.length})</div>
          {pending.map(o => (
            <div key={o.order_sn} onClick={() => onSelect(o)} style={{ background:"#ffffff", border:"1px solid rgba(120,105,80,0.12)", borderRadius:4, padding:"12px 14px", marginBottom:6, cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <div style={{ fontSize:13, fontWeight:600 }}>{o.order_sn}</div>
                  <span style={{ fontSize:9, background:o.region==="MY"?"rgba(58,90,138,0.12)":"rgba(58,138,90,0.12)", color:o.region==="MY"?"#3a5a8a":"#3a8a5a", borderRadius:3, padding:"2px 5px", letterSpacing:1 }}>{o.region||"SG"}</span>
                </div>
                <div style={{ fontSize:9, color:C.muted, marginTop:4, letterSpacing:2, textTransform:"uppercase" }}>{o.items.map(i=>i.model||i.sku).join("、")}</div>
              </div>
              <span style={{ color:C.dim }}>→</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ListTab({ orders, onSelect }: any) {
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? orders : orders.filter(o => o.status === filter);
  return (
    <div>
      <div style={{ display:"flex", gap:8, marginBottom:16, overflowX:"auto", paddingBottom:4 }}>
        {["all","pending","packed","approved","rejected"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ background:filter===f?C.accent:C.card, border:"1px solid "+(filter===f?C.accent:C.border), borderRadius:20, padding:"6px 14px", color:filter===f?"#fff":C.muted, fontSize:12, cursor:"pointer", whiteSpace:"nowrap" }}>
            {{all:"全部",pending:"待配货",packed:"待审核",approved:"已通过",rejected:"待重拍"}[f]}
          </button>
        ))}
      </div>
      {filtered.map(o => (
        <div key={o.order_sn} onClick={() => onSelect(o)} style={{ background:C.card, border:"1px solid "+C.border, borderRadius:12, padding:14, marginBottom:10, cursor:"pointer" }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
            <div>
              <div style={{ fontSize:14, fontWeight:600 }}>{o.order_sn}</div>
              <div style={{ fontSize:9, color:C.muted, marginTop:4, letterSpacing:2, textTransform:"uppercase" }}>{o.tracking_number}</div>
            </div>
            <span style={{ background:statusColor[o.status]+"22", color:statusColor[o.status], borderRadius:6, padding:"3px 8px", fontSize:11, fontWeight:600 }}>{statusLabel[o.status]}</span>
          </div>
          {o.items.map((item,i) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:C.muted, marginBottom:3 }}>
              <span>{item.model||item.name.slice(0,30)}</span>
              <span style={{ color:C.text }}>×{item.qty}</span>
            </div>
          ))}
          {o.worker && <div style={{ marginTop:8, fontSize:11, color:C.dim }}>配货员：{o.worker}</div>}
        </div>
      ))}
      {filtered.length === 0 && <div style={{ textAlign:"center", color:C.dim, padding:"40px 0" }}>暂无订单</div>}
    </div>
  );
}

function PackingDetail({ order, worker, onBack, onReload, onPreview }: any) {
  const [photos, setPhotos]     = useState([]);
  const [previews, setPreviews] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [previewImg, setPreviewImg] = useState<string|null>(null);
  const [uploadedUrls, setUploadedUrls] = useState<(string|null|"error")[]>([]);
  const fileRef = useRef(null);

  if (previewImg) return (
    <div onClick={() => setPreviewImg(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.92)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <img src={previewImg} alt="" style={{ maxWidth:"100%", maxHeight:"90vh", objectFit:"contain", borderRadius:4 }} />
      <div style={{ position:"absolute", top:20, right:20, color:"#fff", fontSize:28, cursor:"pointer" }}>✕</div>
    </div>
  );

  if (order.status === "packed" || order.status === "approved") return (
    <div style={{ background:C.bg, minHeight:"100vh", color:C.text, fontFamily:"var(--font-sans,sans-serif)", maxWidth:480, margin:"0 auto" }}>
      <div style={{ padding:"16px 20px", display:"flex", alignItems:"center", gap:12, borderBottom:"1px solid rgba(120,105,80,0.12)" }}>
        <button onClick={onBack} style={{ background:"none", border:"none", color:C.muted, fontSize:20, cursor:"pointer", padding:0 }}>←</button>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:15, fontWeight:500, color:C.text }}>{order.order_sn}</div>
          <div style={{ fontSize:11, color:C.muted }}>{order.tracking_number}</div>
        </div>
        <span style={{ background:statusColor[order.status]+"15", color:statusColor[order.status], borderRadius:3, padding:"4px 10px", fontSize:11 }}>{statusLabel[order.status]}</span>
      </div>
      <div style={{ padding:20 }}>
        <div style={{ background:"#ffffff", borderRadius:4, padding:14, marginBottom:16, border:"1px solid rgba(120,105,80,0.12)" }}>
          <div style={{ fontSize:9, color:C.muted, letterSpacing:3, textTransform:"uppercase", marginBottom:12 }}>配货清单</div>
          {order.items.map((item,i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"8px 0", borderBottom:"1px solid rgba(120,105,80,0.08)" }}>
              {item.image && <img src={item.image} alt="" style={{ width:48, height:48, borderRadius:3, objectFit:"cover", flexShrink:0 }} />}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, color:C.text }}>{item.model||item.name.slice(0,40)}</div>
                <div style={{ fontSize:10, color:C.muted, marginTop:2 }}>{item.sku}</div>
              </div>
              <div style={{ fontSize:18, color:C.text, flexShrink:0 }}>x{item.qty}</div>
            </div>
          ))}
        </div>
        {order.photos.length > 0 && (
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:9, color:C.muted, letterSpacing:3, textTransform:"uppercase", marginBottom:10 }}>配货照片</div>
            {order.photos.map((p,i) => (
              <div key={i} style={{ marginBottom:8, borderRadius:4, overflow:"hidden", border:"1px solid rgba(120,105,80,0.12)" }}>
                <img src={photoUrl(p)} alt="" style={{ width:"100%", display:"block", objectFit:"contain", maxHeight:400 }} />
              </div>
            ))}
          </div>
        )}
        <div style={{ fontSize:11, color:C.muted, textAlign:"center", paddingTop:8 }}>配货员：{order.worker}</div>
      </div>
    </div>
  );


  async function compressImage(file: File): Promise<File> {
    return new Promise(resolve => {
      const img = new Image();
      const blobUrl = URL.createObjectURL(file);
      img.onload = () => {
        const MAX = 1600;
        let { width: w, height: h } = img;
        if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
        if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; }
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        canvas.toBlob(blob => {
          URL.revokeObjectURL(blobUrl);
          resolve(new File([blob!], file.name, { type: "image/jpeg" }));
        }, "image/jpeg", 0.82);
      };
      img.src = blobUrl;
    });
  }

  async function uploadPhoto(file: File, globalIdx: number) {
    try {
      const compressed = await compressImage(file);
      const fd = new FormData();
      fd.append("photo", compressed);
      fd.append("order_sn", order.order_sn);
      const res = await fetch("/api/pack/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!data.ok || !data.url) throw new Error(data.error || "上传失败");
      setUploadedUrls(prev => { const u = [...prev]; u[globalIdx] = data.url; return u; });
    } catch {
      setUploadedUrls(prev => { const u = [...prev]; u[globalIdx] = "error"; return u; });
    }
  }

  function addPhoto(e) {
    const newFiles = Array.from(e.target.files ?? []) as File[];
    if (!newFiles.length) return;
    const startIdx = photos.length;
    const toAdd = newFiles.slice(0, 3 - startIdx);
    if (!toAdd.length) return;
    setPhotos(prev => [...prev, ...toAdd]);
    setPreviews(prev => [...prev, ...toAdd.map(f => URL.createObjectURL(f))]);
    setUploadedUrls(prev => {
      const u = [...prev];
      toAdd.forEach((_, i) => { u[startIdx + i] = null; });
      return u;
    });
    toAdd.forEach((file, localIdx) => uploadPhoto(file, startIdx + localIdx));
  }

  async function submit() {
    const urls = uploadedUrls.slice(0, photos.length);
    if (!urls.length || urls.some(u => u === null || u === "error")) return;
    setSubmitting(true);
    await fetch("/api/pack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_sn: order.order_sn, worker, photos: urls }),
    });
    await onReload();
    onBack();
  }

  const _urls = uploadedUrls.slice(0, photos.length);
  const _done = _urls.filter(u => typeof u === "string").length;
  const _err  = _urls.some(u => u === "error");
  const _all  = photos.length > 0 && _done === photos.length;

  return (
    <div style={{ background:C.bg, minHeight:"100vh", color:C.text, fontFamily:"sans-serif", maxWidth:480, margin:"0 auto" }}>
      <div style={{ padding:"16px 20px", display:"flex", alignItems:"center", gap:12, borderBottom:"1px solid "+C.border }}>
        <button onClick={onBack} style={{ background:"none", border:"none", color:C.muted, fontSize:20, cursor:"pointer", padding:0 }}>←</button>
        <div>
          <div style={{ fontSize:15, fontWeight:600 }}>{order.order_sn}</div>
          <div style={{ fontSize:11, color:C.muted }}>{order.tracking_number} · {order.shipping_carrier}</div>
        </div>
      </div>
      <div style={{ padding:20 }}>
        {order.review_status==="rejected" && (
          <div style={{ background:C.danger+"15", border:"1px solid "+C.danger+"44", borderRadius:12, padding:"12px 14px", marginBottom:20 }}>
            <div style={{ fontSize:13, fontWeight:600, color:C.danger, marginBottom:4 }}>⚠ 审核不通过，请重新拍照</div>
            <div style={{ fontSize:13, color:C.muted }}>{order.review_comment}</div>
          </div>
        )}
        <div style={{ background:C.card, borderRadius:12, padding:16, marginBottom:20, border:"1px solid "+C.border }}>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:12 }}>配货清单</div>
          {order.items.map((item,i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom:"1px solid "+C.border }}>
              {item.image && <img src={item.image} alt="" onClick={() => setPreviewImg(item.image)} style={{ width:56, height:56, borderRadius:8, objectFit:"cover", flexShrink:0, background:C.border, cursor:"pointer" }} />}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13 }}>{item.model||item.name.slice(0,40)}</div>
                <div style={{ fontSize:11, color:C.dim, marginTop:2 }}><HighlightSku sku={item.sku} /></div>
              </div>
              <div style={{ fontSize:22, fontWeight:700, color:C.accent, flexShrink:0 }}>×{item.qty}</div>
            </div>
          ))}
        </div>
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>拍摄配货照片（最多3张）</div>
          <div style={{ fontSize:12, color:C.muted, marginBottom:12 }}>建议：整体全景、商品特写、快递单</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
            {[0,1,2].map(i => (
              <div key={i}
                onClick={() => {
                  if (uploadedUrls[i] === "error") uploadPhoto(photos[i], i);
                  else if (i <= photos.length && photos.length < 3) fileRef.current?.click();
                }}
                style={{ aspectRatio:"1", background:C.card, border:"1.5px dashed "+(i<previews.length?(uploadedUrls[i]==="error"?C.danger:C.success):i===previews.length?C.accent:C.border), borderRadius:10, overflow:"hidden", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:i<previews.length?28:22, color:i<previews.length?C.success:i===previews.length?C.accent:C.dim, position:"relative" }}>
                {previews[i] ? <img src={previews[i]} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : i===previews.length?"+":"○"}
                {previews[i] && uploadedUrls[i] === null && (
                  <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22 }}>⏳</div>
                )}
                {previews[i] && uploadedUrls[i] === "error" && (
                  <div style={{ position:"absolute", inset:0, background:"rgba(138,53,48,0.75)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2, color:"#fff" }}>
                    <span style={{ fontSize:20 }}>✕</span>
                    <span style={{ fontSize:10 }}>点击重试</span>
                  </div>
                )}
                {previews[i] && typeof uploadedUrls[i] === "string" && (
                  <div style={{ position:"absolute", bottom:4, right:4, background:C.success, borderRadius:"50%", width:20, height:20, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:"#fff" }}>✓</div>
                )}
              </div>
            ))}
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={addPhoto} style={{ display:"none" }} multiple />
          {photos.length > 0 && (
            <div style={{ marginTop:8, fontSize:12, color: _all ? C.success : _err ? C.danger : C.warning }}>
              {_all ? `已上传 ${photos.length} 张，可提交` : _err ? "部分照片上传失败，点击重试" : `上传中… ${_done}/${photos.length}`}
            </div>
          )}
        </div>
        <button onClick={submit} disabled={!_all || submitting}
          style={{ width:"100%", background:_all?C.accent:C.border, border:"none", borderRadius:12, padding:"16px 0", color:_all?"#fff":C.dim, fontSize:16, fontWeight:600, cursor:_all?"pointer":"not-allowed" }}>
          {submitting ? "提交中…" : _err ? "上传失败，点击重试" : !_all && photos.length > 0 ? `上传中… (${_done}/${photos.length})` : _all ? `提交配货 (${photos.length}张)` : "请先拍照"}
        </button>
      </div>
    </div>
  );
}

function ReviewTab({ orders, onReview }: any) {
  const [selected, setSelected] = useState(null);
  const [comment, setComment]   = useState("");
  const [checked, setChecked]   = useState([]);
  const [batchComment, setBatchComment] = useState("");
  const toReview = orders.filter(o => o.review_status === "pending");

  function toggleCheck(sn: string) {
    setChecked(prev => prev.includes(sn) ? prev.filter(x=>x!==sn) : [...prev, sn]);
  }

  function batchReview(pass: boolean) {
    checked.forEach(sn => onReview(sn, pass, pass?"":batchComment||"请重新拍照"));
    setChecked([]);
    setBatchComment("");
  }

  if (selected) return (
    <div>
      <button onClick={() => { setSelected(null); setComment(""); }} style={{ background:"none", border:"none", color:C.muted, fontSize:14, cursor:"pointer", padding:"0 0 16px", fontFamily:"inherit" }}>← 返回</button>
      <div style={{ fontSize:15, fontWeight:500, marginBottom:2, color:C.text }}>{selected.order_sn}</div>
      <div style={{ fontSize:11, color:C.muted, marginBottom:16, letterSpacing:1 }}>配货员:{selected.worker}</div>

      <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:16 }}>
        {selected.photos.map((p,i) => (
          <div key={i} style={{ width:"100%", background:"#ffffff", borderRadius:4, overflow:"hidden", border:"1px solid rgba(120,105,80,0.12)" }}>
            <img src={photoUrl(p)} alt="" style={{ width:"100%", display:"block", objectFit:"contain", maxHeight:400 }} />
          </div>
        ))}
        {selected.photos.length===0 && <div style={{ textAlign:"center", color:C.dim, padding:20 }}>暂无照片</div>}
      </div>

      <textarea value={comment} onChange={e=>setComment(e.target.value)} placeholder="不通过时请填写原因..." rows={2}
        style={{ width:"100%", background:"#ffffff", border:"1px solid rgba(120,105,80,0.15)", borderRadius:4, padding:"10px 12px", color:C.text, fontSize:13, fontFamily:"inherit", resize:"none", outline:"none", boxSizing:"border-box", marginBottom:10 }} />
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20 }}>
        <button onClick={() => { onReview(selected.order_sn,false,comment||"请重新拍照"); setSelected(null); setComment(""); }}
          style={{ background:"rgba(138,53,48,0.08)", border:"1px solid rgba(138,53,48,0.2)", borderRadius:4, padding:"13px 0", color:C.danger, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>✕ 不通过</button>
        <button onClick={() => { onReview(selected.order_sn,true,""); setSelected(null); setComment(""); }}
          style={{ background:"#1e1c18", border:"none", borderRadius:4, padding:"13px 0", color:"#f0ece4", fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>✓ 通过</button>
      </div>

      <div style={{ background:"#ffffff", borderRadius:4, padding:14, marginBottom:16, border:"1px solid rgba(120,105,80,0.12)" }}>
        <div style={{ fontSize:9, color:C.muted, letterSpacing:3, textTransform:"uppercase", marginBottom:12 }}>配货清单</div>
        {selected.items.map((item,i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"8px 0", borderBottom:"1px solid rgba(120,105,80,0.08)" }}>
            {item.image && <img src={item.image} alt="" style={{ width:48, height:48, borderRadius:3, objectFit:"cover", flexShrink:0 }} />}
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, color:C.text }}>{item.model||item.name.slice(0,30)}</div>
              <div style={{ fontSize:10, color:C.muted, marginTop:2 }}><HighlightSku sku={item.sku} /></div>
            </div>
            <span style={{ fontSize:18, color:C.text, flexShrink:0 }}>×{item.qty}</span>
          </div>
        ))}
      </div>
    </div>
  );


  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div style={{ fontSize:9, color:C.muted, letterSpacing:3, textTransform:"uppercase" }}>待复核 {toReview.length} 单</div>
        {checked.length > 0 && <div style={{ fontSize:11, color:C.accent }}>已选 {checked.length} 单</div>}
      </div>

      {toReview.length===0 && <div style={{ textAlign:"center", color:C.dim, padding:"40px 0", fontSize:13 }}>暂无待复核订单</div>}

      {toReview.map(o => (
        <div key={o.order_sn} style={{ background:"#ffffff", border:"1px solid "+(checked.includes(o.order_sn)?"rgba(58,90,138,0.5)":"rgba(120,105,80,0.12)"), borderRadius:4, padding:"12px 14px", marginBottom:8, display:"flex", alignItems:"center", gap:12 }}>
          <div onClick={() => toggleCheck(o.order_sn)}
            style={{ width:22, height:22, borderRadius:3, border:"1.5px solid "+(checked.includes(o.order_sn)?C.accent:"rgba(120,105,80,0.35)"), background:checked.includes(o.order_sn)?C.accent:"transparent", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0 }}>
            {checked.includes(o.order_sn) && <span style={{ color:"#fff", fontSize:13, lineHeight:1 }}>✓</span>}
          </div>
          <div style={{ flex:1, cursor:"pointer" }} onClick={() => setSelected(o)}>
            <div style={{ fontSize:13, fontWeight:500, color:C.text }}>{o.order_sn}</div>
            <div style={{ fontSize:10, color:C.muted, marginTop:3 }}>配货员：{o.worker} · {o.photos.length}张照片</div>
            <div style={{ fontSize:10, color:C.muted, marginTop:2 }}>{o.items.map(i=>i.model||i.sku).join(" · ")}</div>
          </div>
          <span style={{ color:C.muted, fontSize:14, cursor:"pointer" }} onClick={() => setSelected(o)}>→</span>
        </div>
      ))}

      {checked.length > 0 && (
        <div style={{ marginTop:12, padding:"14px", background:"#ffffff", borderRadius:4, border:"1px solid rgba(120,105,80,0.15)" }}>
          <textarea value={batchComment} onChange={e=>setBatchComment(e.target.value)} placeholder="批量不通过时填写原因…" rows={2}
            style={{ width:"100%", background:"#f8f5f0", border:"1px solid rgba(120,105,80,0.15)", borderRadius:4, padding:"8px 12px", color:C.text, fontSize:12, fontFamily:"inherit", resize:"none", outline:"none", boxSizing:"border-box", marginBottom:10 }} />
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
            <button onClick={() => batchReview(false)}
              style={{ background:"rgba(138,53,48,0.08)", border:"1px solid rgba(138,53,48,0.2)", borderRadius:4, padding:"11px 0", color:C.danger, fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>✕ 批量不通过</button>
            <button onClick={() => batchReview(true)}
              style={{ background:"#1e1c18", border:"none", borderRadius:4, padding:"11px 0", color:"#f0ece4", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>✓ 批量通过</button>
          </div>
        </div>
      )}

      {orders.filter(o=>o.review_status==="approved"||o.review_status==="rejected").length > 0 && (
        <div style={{ marginTop:24 }}>
          <div style={{ fontSize:9, color:C.muted, letterSpacing:3, textTransform:"uppercase", marginBottom:10 }}>已处理</div>
          {orders.filter(o=>o.review_status==="approved"||o.review_status==="rejected").map(o => (
            <div key={o.order_sn} style={{ background:"#ffffff", border:"1px solid rgba(120,105,80,0.1)", borderRadius:4, padding:"10px 14px", marginBottom:6, display:"flex", justifyContent:"space-between", alignItems:"center", opacity:0.7 }}>
              <div>
                <div style={{ fontSize:12, color:C.text }}>{o.order_sn}</div>
                <div style={{ fontSize:10, color:C.muted, marginTop:2 }}>配货员：{o.worker}</div>
              </div>
              <span style={{ background:statusColor[o.status]+"15", color:statusColor[o.status], borderRadius:3, padding:"3px 8px", fontSize:10 }}>{statusLabel[o.status]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HighlightSku({ sku }: any) {
  if (!sku) return <span>{sku}</span>;
  const parts = sku.split(/(-HR|-H)(?=\b|$|\+)/);
  return (
    <span>
      {parts.map((part, i) => 
        part === "-H" || part === "-HR" ? (
          <span key={i} style={{ background:"rgba(138,101,48,0.15)", color:"#8a6530", borderRadius:3, padding:"1px 4px", fontWeight:600, fontSize:"0.9em" }}>{part}</span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

function HistoryTab({ orders, onPreview }: any) {
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const done = orders.filter(o => o.status === "packed" || o.status === "approved" || o.status === "rejected");
  const filtered = done.filter(o => {
    const matchSearch = !search || o.order_sn.includes(search.toUpperCase()) || (o.worker||"").toUpperCase().includes(search.toUpperCase());
    const matchDate = !dateFilter || new Date(o.create_time * 1000).toISOString().startsWith(dateFilter);
    return matchSearch && matchDate;
  });
  const grouped = filtered.reduce((acc: any, o: any) => {
    const date = new Date(o.create_time * 1000).toLocaleDateString("zh-CN", { month:"long", day:"numeric", weekday:"short" });
    if (!acc[date]) acc[date] = [];
    acc[date].push(o);
    return acc;
  }, {});
  return (
    <div>
      <div style={{ fontSize:9, color:C.muted, letterSpacing:3, textTransform:"uppercase", marginBottom:12 }}>历史订单</div>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索订单号或配货员…"
        style={{ width:"100%", background:"#ffffff", border:"1px solid rgba(120,105,80,0.2)", borderRadius:4, padding:"10px 12px", color:C.text, fontSize:13, outline:"none", boxSizing:"border-box", marginBottom:10 }} />
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
        <input type="date" value={dateFilter} onChange={e=>setDateFilter(e.target.value)}
          style={{ flex:1, background:"#ffffff", border:"1px solid rgba(120,105,80,0.2)", borderRadius:4, padding:"9px 12px", color:dateFilter?C.text:C.muted, fontSize:13, outline:"none", fontFamily:"inherit" }} />
        {dateFilter && <button onClick={() => setDateFilter("")}
          style={{ background:"none", border:"none", color:C.muted, fontSize:13, cursor:"pointer", padding:"0 4px", fontFamily:"inherit" }}>× 清除</button>}
      </div>
      {Object.keys(grouped).length === 0 && <div style={{ textAlign:"center", color:C.dim, padding:"40px 0" }}>暂无历史订单</div>}
      {Object.entries(grouped).map(([date, dayOrders]) => (
        <div key={date} style={{ marginBottom:24 }}>
          <div style={{ fontSize:12, color:C.muted, fontWeight:600, marginBottom:8, paddingBottom:6, borderBottom:"1px solid "+C.border }}>{date} · {dayOrders.length} 单</div>
          {dayOrders.map(o => (
            <div key={o.order_sn} style={{ background:C.card, border:"1px solid "+C.border, borderRadius:12, padding:"12px 14px", marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <div style={{ fontSize:13, fontWeight:600 }}>{o.order_sn}</div>
                <span style={{ background:statusColor[o.status]+"22", color:statusColor[o.status], borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:600 }}>{statusLabel[o.status]}</span>
              </div>
              <div style={{ fontSize:12, color:C.muted, marginBottom:4 }}>{o.items.map(i=>i.model||i.sku).join("、")}</div>
              {o.worker && <div style={{ fontSize:11, color:C.dim }}>配货员：{o.worker}</div>}
              {o.review_comment && <div style={{ fontSize:11, color:C.danger, marginTop:3 }}>复核备注：{o.review_comment}</div>}
              {o.photos.length > 0 && (
                <div style={{ display:"flex", gap:6, marginTop:8 }}>
                  {o.photos.map((p,i) => (
                    <img key={i} src={photoUrl(p)} alt="" onClick={() => onPreview(photoUrl(p))} style={{ width:56, height:56, borderRadius:6, objectFit:"cover", cursor:"pointer" }} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

