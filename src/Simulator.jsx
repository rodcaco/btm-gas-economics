import { useState, useMemo, useCallback, useEffect } from "react";
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Bar, BarChart, ReferenceLine } from "recharts";

// ─── CONSTANTS ───
const YEARS = [2026,2027,2028,2029,2030,2031,2032,2033,2034,2035];
const DEFAULTS = {
  hhBase:3.80, hhGrowth:0.08,
  wahaBasis2026H1:-3.50, wahaBasis2026H2:-1.20, wahaBasis2027:-0.50, wahaBasisLongTerm:-0.30,
  appBasis2026:-0.85, appBasisTightenRate:0.06,
  nglYieldGPM:4.0, nglCompositePrice:8.16, nglPriceGrowth:0.02, ethaneRejectionRate:48,
  cryoCapex:200, cryoOpex:0.35, nglTransport:0.25, nglFracCost:3.00,
  dcCapacityMW:1000, heatRate:6.8, capacityFactor:0.92, gasVolumeMMBtuD:150000,
  permianFirmPremium:1.25, appFirmPremium:0.35, ftReservation:0.55, lateralCost:0.15,
  modelCNGLShare:0.40,
};

// Permian pipeline additions (Bcf/d)
const PERMIAN_PIPES = [
  { name:"GCX Exp.", cap:0.57, year:2026, operator:"KMI" },
  { name:"Blackcomb", cap:2.5, year:2026, operator:"WhiteWater" },
  { name:"Hugh Brinson", cap:1.5, year:2026, operator:"ET" },
  { name:"Saguaro", cap:2.8, year:2027, operator:"ONEOK" },
  { name:"Eiger Express", cap:3.7, year:2028, operator:"WhiteWater" },
  { name:"DeLa Express", cap:2.0, year:2028, operator:"Moss Lake" },
  { name:"Desert SW", cap:1.5, year:2029, operator:"ET" },
  { name:"Tallgrass-REX", cap:2.4, year:2028, operator:"Tallgrass" },
];
const APP_PIPES = [
  { name:"MVP Boost", cap:0.5, year:2027, operator:"EQT" },
  { name:"Transco SSE", cap:1.6, year:2027, operator:"Williams" },
  { name:"MVP Southgate", cap:0.55, year:2028, operator:"EQT" },
  { name:"Kosciusko Jct", cap:1.16, year:2028, operator:"Boardwalk" },
  { name:"KMI MSX+SSE4", cap:3.4, year:2029, operator:"KMI" },
  { name:"Borealis", cap:2.0, year:2030, operator:"Boardwalk" },
];
const DEMAND_DRIVERS = [
  { name:"Data Centers (PJM)", growth:[0.3,0.6,1.0,1.5,2.0,2.5,3.0,3.5,4.0,4.5], color:"#06b6d4" },
  { name:"LNG Feed Gas", growth:[0.5,1.5,2.5,3.0,3.5,4.0,4.5,5.0,5.5,6.0], color:"#f59e0b" },
  { name:"SE Utility (Coal Ret.)", growth:[0.2,0.5,0.8,1.2,1.5,1.8,2.0,2.2,2.4,2.6], color:"#ec4899" },
  { name:"Industrial/Residential", growth:[0.1,0.2,0.2,0.3,0.3,0.4,0.4,0.5,0.5,0.5], color:"#a78bfa" },
];

const C = {
  bg:"#0a0e1a", bg2:"#111827", bg3:"#1a2035",
  border:"#1e293b", borderLight:"#334155",
  cyan:"#06b6d4", cyanDim:"#0e7490",
  green:"#10b981", greenDim:"#059669",
  amber:"#f59e0b", amberDim:"#d97706",
  pink:"#ec4899", pinkDim:"#be185d",
  purple:"#8b5cf6", purpleDim:"#6d28d9",
  red:"#ef4444",
  text:"#e2e8f0", textDim:"#94a3b8", textMuted:"#475569",
  white:"#ffffff",
};

// ─── HELPERS ───
const fmt = v => v < 0 ? `-$${Math.abs(v).toFixed(2)}` : `$${v.toFixed(2)}`;
const fmtM = v => `$${v.toFixed(0)}M`;

function Knob({ value, onChange, min, max, step, label, unit="$", color=C.cyan, size=56 }) {
  const pct = (value - min) / (max - min);
  const angle = pct * 270 - 135;
  const r = size/2 - 6;
  const cx = size/2, cy = size/2;
  const rad = (angle * Math.PI) / 180;
  const ix = cx + r * 0.7 * Math.cos(rad);
  const iy = cy + r * 0.7 * Math.sin(rad);
  const [dragging, setDragging] = useState(false);

  const handleMove = useCallback((clientX, clientY, rect) => {
    const dx = clientX - (rect.left + rect.width/2);
    const dy = clientY - (rect.top + rect.height/2);
    let a = Math.atan2(dy, dx) * 180 / Math.PI;
    let newPct = (a + 135) / 270;
    if (newPct < 0) newPct += 360/270;
    newPct = Math.max(0, Math.min(1, newPct));
    const raw = min + newPct * (max - min);
    const snapped = Math.round(raw / step) * step;
    onChange(Math.max(min, Math.min(max, snapped)));
  }, [min, max, step, onChange]);

  useEffect(() => {
    if (!dragging) return;
    const el = document.getElementById(`knob-${label}`);
    const rect = el?.getBoundingClientRect();
    const onMove = e => { e.preventDefault(); if(rect) handleMove(e.clientX, e.clientY, rect); };
    const onUp = () => setDragging(false);
    const onTouchMove = e => { e.preventDefault(); if(rect && e.touches[0]) handleMove(e.touches[0].clientX, e.touches[0].clientY, rect); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onTouchMove, {passive:false});
    window.addEventListener("touchend", onUp);
    return () => { window.removeEventListener("mousemove",onMove); window.removeEventListener("mouseup",onUp); window.removeEventListener("touchmove",onTouchMove); window.removeEventListener("touchend",onUp); };
  }, [dragging, handleMove, label]);

  const displayVal = unit === "%" ? `${value.toFixed(0)}%` : unit === "" ? value.toFixed(1) : (value < 0 ? `-${unit}${Math.abs(value).toFixed(2)}` : `${unit}${value.toFixed(2)}`);

  return (
    <div className="flex flex-col items-center" style={{userSelect:"none"}}>
      <svg id={`knob-${label}`} width={size} height={size} style={{cursor:"grab", touchAction:"none"}}
        onMouseDown={e => { e.preventDefault(); setDragging(true); const rect = e.currentTarget.getBoundingClientRect(); handleMove(e.clientX, e.clientY, rect); }}
        onTouchStart={e => { setDragging(true); const rect = e.currentTarget.getBoundingClientRect(); if(e.touches[0]) handleMove(e.touches[0].clientX, e.touches[0].clientY, rect); }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.border} strokeWidth={3} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={3}
          strokeDasharray={`${pct * 2 * Math.PI * r} ${2 * Math.PI * r}`}
          strokeDashoffset={2 * Math.PI * r * 0.375}
          strokeLinecap="round" opacity={0.8} />
        <circle cx={ix} cy={iy} r={4} fill={color} filter={`drop-shadow(0 0 4px ${color})`} />
        <text x={cx} y={cy+1} textAnchor="middle" dominantBaseline="middle"
          fill={C.text} fontSize={size < 50 ? 8 : 10} fontFamily="'JetBrains Mono',monospace" fontWeight="bold">
          {displayVal}
        </text>
      </svg>
      <span style={{fontSize:9, color:C.textDim, marginTop:2, textAlign:"center", lineHeight:1.2, maxWidth:size+10}}>{label}</span>
    </div>
  );
}

function GlowText({ children, color=C.cyan, size=24, bold=true }) {
  return <span style={{color, fontSize:size, fontWeight:bold?"800":"400", fontFamily:"'JetBrains Mono',monospace", textShadow:`0 0 12px ${color}40`}}>{children}</span>;
}

function Badge({ children, color=C.cyan }) {
  return <span style={{fontSize:9, padding:"2px 6px", borderRadius:3, background:`${color}20`, color, border:`1px solid ${color}40`, fontWeight:600, fontFamily:"'JetBrains Mono',monospace"}}>{children}</span>;
}

function PipelineBar({ pipe, idx, maxCap, basin }) {
  const color = basin === "permian" ? C.amber : C.cyan;
  const w = (pipe.cap / maxCap) * 100;
  return (
    <div style={{display:"flex", alignItems:"center", gap:6, marginBottom:4}}>
      <span style={{fontSize:9, color:C.textDim, width:90, textAlign:"right", flexShrink:0, fontFamily:"'JetBrains Mono',monospace"}}>{pipe.name}</span>
      <div style={{flex:1, height:14, background:C.bg, borderRadius:3, overflow:"hidden", position:"relative", border:`1px solid ${C.border}`}}>
        <div style={{width:`${w}%`, height:"100%", background:`linear-gradient(90deg, ${color}80, ${color})`, borderRadius:3, transition:"width 0.6s ease"}} />
        <span style={{position:"absolute", right:4, top:0, lineHeight:"14px", fontSize:8, color:C.text, fontFamily:"'JetBrains Mono',monospace"}}>{pipe.cap} Bcf/d</span>
      </div>
      <Badge color={pipe.year <= 2026 ? C.green : pipe.year <= 2028 ? C.amber : C.pink}>{pipe.year}</Badge>
    </div>
  );
}

// ─── MAIN COMPONENT ───
export default function Simulator() {
  const [p, setP] = useState(DEFAULTS);
  const [tab, setTab] = useState("map");
  const [hoverPipe, setHoverPipe] = useState(null);
  const set = useCallback((k,v) => setP(prev=>({...prev,[k]:v})), []);

  // ─── ECONOMIC MODEL ───
  const model = useMemo(() => {
    const results = [];
    for (let i=0; i<YEARS.length; i++) {
      const year = YEARS[i];
      const hh = p.hhBase + p.hhGrowth * i;
      let wahaBasis;
      if(year===2026) wahaBasis = (p.wahaBasis2026H1+p.wahaBasis2026H2)/2;
      else if(year===2027) wahaBasis = p.wahaBasis2027;
      else wahaBasis = p.wahaBasisLongTerm + Math.max(0,(p.wahaBasis2027-p.wahaBasisLongTerm)*Math.pow(0.5,i-2));
      const appBasis = Math.min(p.appBasis2026 + p.appBasisTightenRate*i, -0.10);
      const wahaSpot = hh+wahaBasis;
      const appSpot = hh+appBasis;
      const permianA = Math.max(wahaSpot+p.permianFirmPremium+p.lateralCost+0.03, 0.10);
      const appA = appSpot+p.appFirmPremium+p.ftReservation+p.lateralCost+0.03;
      const rawGasCost = appSpot-0.20;
      const nglPrice = p.nglCompositePrice*Math.pow(1+p.nglPriceGrowth,i);
      const nglRevPerMMBtu = (p.nglYieldGPM*nglPrice)/42*(1-p.ethaneRejectionRate/100*0.3);
      const nglCostPerMMBtu = p.cryoOpex+(p.nglTransport*p.nglYieldGPM/42)+(p.nglFracCost*p.nglYieldGPM/42);
      const netNGL = Math.max(nglRevPerMMBtu-nglCostPerMMBtu,0);
      const annualMMBtu = p.gasVolumeMMBtuD*365*p.capacityFactor;
      const cryoAmort = (p.cryoCapex*1e6/20)/annualMMBtu;
      const appB = rawGasCost-netNGL+p.lateralCost+0.03+cryoAmort;
      const appC = appSpot-netNGL*p.modelCNGLShare+p.appFirmPremium*0.5+p.lateralCost+0.03;
      const hrs = 8760*p.capacityFactor;
      const annMMBtu = p.dcCapacityMW*p.heatRate*hrs;
      // Supply additions (cumulative Bcf/d)
      const permianNewEgress = PERMIAN_PIPES.filter(pp=>pp.year<=year).reduce((s,pp)=>s+pp.cap,0);
      const appNewEgress = APP_PIPES.filter(pp=>pp.year<=year).reduce((s,pp)=>s+pp.cap,0);
      // Demand growth (cumulative Bcf/d from base)
      const totalDemandGrowth = DEMAND_DRIVERS.reduce((s,d)=>s+(d.growth[i]||0),0);
      results.push({
        year, hh:+hh.toFixed(2), wahaBasis:+wahaBasis.toFixed(2), appBasis:+appBasis.toFixed(2),
        wahaSpot:+wahaSpot.toFixed(2), appSpot:+appSpot.toFixed(2),
        permianA:+permianA.toFixed(2), appA:+appA.toFixed(2), appB:+appB.toFixed(2), appC:+appC.toFixed(2),
        netNGL:+netNGL.toFixed(2),
        permianAnnual:+(permianA*annMMBtu/1e6).toFixed(1),
        appBAnnual:+(appB*annMMBtu/1e6).toFixed(1),
        appCAnnual:+(appC*annMMBtu/1e6).toFixed(1),
        permianNewEgress:+permianNewEgress.toFixed(1),
        appNewEgress:+appNewEgress.toFixed(1),
        totalDemandGrowth:+totalDemandGrowth.toFixed(1),
        dcDemand: +(DEMAND_DRIVERS[0].growth[i]||0).toFixed(1),
        lngDemand: +(DEMAND_DRIVERS[1].growth[i]||0).toFixed(1),
        seDemand: +(DEMAND_DRIVERS[2].growth[i]||0).toFixed(1),
        otherDemand: +(DEMAND_DRIVERS[3].growth[i]||0).toFixed(1),
      });
    }
    return results;
  }, [p]);

  const cur = model[0];

  // ─── STYLES ───
  const tabStyle = (active) => ({
    padding:"8px 16px", fontSize:11, fontWeight:700, fontFamily:"'JetBrains Mono',monospace",
    letterSpacing:1, textTransform:"uppercase", cursor:"pointer", border:"none",
    background: active ? `linear-gradient(135deg, ${C.cyan}20, ${C.purple}20)` : "transparent",
    color: active ? C.cyan : C.textMuted,
    borderBottom: active ? `2px solid ${C.cyan}` : `2px solid transparent`,
    transition:"all 0.2s",
  });

  return (
    <div style={{background:C.bg, color:C.text, minHeight:"100vh", fontFamily:"'Nunito Sans','Segoe UI',sans-serif"}}>
      {/* ─── HEADER ─── */}
      <div style={{borderBottom:`1px solid ${C.border}`, padding:"12px 20px", display:"flex", justifyContent:"space-between", alignItems:"center", background:`linear-gradient(180deg, ${C.bg2}, ${C.bg})`}}>
        <div>
          <div style={{display:"flex", alignItems:"center", gap:8}}>
            <div style={{width:8, height:8, borderRadius:"50%", background:C.green, boxShadow:`0 0 8px ${C.green}`}} />
            <span style={{fontSize:14, fontWeight:800, fontFamily:"'JetBrains Mono',monospace", letterSpacing:1}}>BTM GAS ECONOMICS</span>
          </div>
          <span style={{fontSize:10, color:C.textDim, marginLeft:16}}>Permian vs Appalachian · {p.dcCapacityMW} MW · 2026–2035</span>
        </div>
        <div style={{display:"flex", gap:4}}>
          {[
            {k:"map",l:"MARKET MAP"},
            {k:"supply",l:"SUPPLY / DEMAND"},
            {k:"cost",l:"DELIVERED COST"},
            {k:"thesis",l:"THESIS & ASSUMPTIONS"},
          ].map(t => (
            <button key={t.k} onClick={()=>setTab(t.k)} style={tabStyle(tab===t.k)}>{t.l}</button>
          ))}
        </div>
      </div>

      {/* ─── TAB: MARKET MAP ─── */}
      {tab === "map" && (
        <div style={{display:"flex", height:"calc(100vh - 52px)"}}>
          {/* Left: Basin Schematic */}
          <div style={{flex:1, padding:16, overflow:"auto"}}>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, height:"100%"}}>
              {/* PERMIAN BASIN */}
              <div style={{background:`linear-gradient(135deg, ${C.bg2}, ${C.bg3})`, borderRadius:12, border:`1px solid ${C.border}`, padding:16, display:"flex", flexDirection:"column"}}>
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12}}>
                  <div>
                    <div style={{fontSize:12, fontWeight:800, fontFamily:"'JetBrains Mono',monospace", color:C.amber, letterSpacing:1}}>⬡ PERMIAN BASIN</div>
                    <div style={{fontSize:9, color:C.textDim}}>West Texas / New Mexico · Associated Gas</div>
                  </div>
                  <Badge color={C.amber}>MODEL A</Badge>
                </div>

                {/* Flow diagram */}
                <div style={{background:C.bg, borderRadius:8, padding:12, marginBottom:12, border:`1px solid ${C.border}`}}>
                  <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", gap:4}}>
                    {[
                      {label:"WELLHEAD", sub:"29 Bcf/d", color:C.amberDim},
                      {label:"→", sub:"", color:C.textMuted},
                      {label:"GATHER", sub:"G&P", color:C.amberDim},
                      {label:"→", sub:"", color:C.textMuted},
                      {label:"PROCESS", sub:"Targa/ET", color:C.amberDim},
                      {label:"→", sub:"", color:C.textMuted},
                      {label:"WAHA HUB", sub:fmt(cur.wahaSpot), color:C.amber},
                      {label:"→", sub:"", color:C.textMuted},
                      {label:"DATA CTR", sub:fmt(cur.permianA), color:C.green},
                    ].map((n,i) => n.label === "→" ? (
                      <span key={i} style={{color:C.amber, fontSize:14, opacity:0.5}}>›</span>
                    ) : (
                      <div key={i} style={{textAlign:"center", padding:"6px 4px", borderRadius:6, background:i===6?`${C.amber}15`:i===8?`${C.green}15`:"transparent", border:i>=6?`1px solid ${n.color}30`:"none", flex:1, minWidth:0}}>
                        <div style={{fontSize:8, fontWeight:700, fontFamily:"'JetBrains Mono',monospace", color:n.color, whiteSpace:"nowrap"}}>{n.label}</div>
                        <div style={{fontSize:10, fontWeight:800, fontFamily:"'JetBrains Mono',monospace", color:C.text}}>{n.sub}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cost buildup */}
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:9, fontWeight:700, color:C.textMuted, marginBottom:6, fontFamily:"'JetBrains Mono',monospace"}}>COST BUILDUP ($/MMBtu)</div>
                  {[
                    {label:"Waha Spot", val:cur.wahaSpot, pct: Math.max(0,(cur.wahaSpot-(-4))/(8))},
                    {label:"+ Firm Premium", val:p.permianFirmPremium, pct:p.permianFirmPremium/4},
                    {label:"+ Last Mile", val:p.lateralCost+0.03, pct:(p.lateralCost+0.03)/1},
                  ].map((item,i) => (
                    <div key={i} style={{display:"flex", alignItems:"center", gap:6, marginBottom:3}}>
                      <span style={{fontSize:9, color:C.textDim, width:80, textAlign:"right", fontFamily:"'JetBrains Mono',monospace"}}>{item.label}</span>
                      <div style={{flex:1, height:10, background:C.bg2, borderRadius:2, overflow:"hidden"}}>
                        <div style={{width:`${Math.min(100,item.pct*100)}%`, height:"100%", background:`linear-gradient(90deg, ${C.amber}60, ${C.amber})`, borderRadius:2}} />
                      </div>
                      <span style={{fontSize:10, fontFamily:"'JetBrains Mono',monospace", fontWeight:700, color:C.text, width:50, textAlign:"right"}}>{fmt(item.val)}</span>
                    </div>
                  ))}
                  <div style={{display:"flex", justifyContent:"flex-end", marginTop:4, paddingRight:0}}>
                    <div style={{background:`${C.amber}15`, border:`1px solid ${C.amber}40`, borderRadius:6, padding:"4px 10px"}}>
                      <span style={{fontSize:9, color:C.textDim}}>ALL-IN </span>
                      <GlowText color={C.amber} size={16}>{fmt(cur.permianA)}</GlowText>
                    </div>
                  </div>
                </div>

                {/* Pipeline egress */}
                <div style={{flex:1, overflow:"auto"}}>
                  <div style={{fontSize:9, fontWeight:700, color:C.textMuted, marginBottom:6, fontFamily:"'JetBrains Mono',monospace"}}>EGRESS PIPELINE ADDITIONS</div>
                  {PERMIAN_PIPES.map((pipe,i) => <PipelineBar key={i} pipe={pipe} idx={i} maxCap={4} basin="permian" />)}
                  <div style={{marginTop:8, textAlign:"right"}}>
                    <span style={{fontSize:9, color:C.textDim}}>Total New Egress: </span>
                    <span style={{fontSize:12, fontWeight:800, color:C.amber, fontFamily:"'JetBrains Mono',monospace"}}>{PERMIAN_PIPES.reduce((s,pp)=>s+pp.cap,0).toFixed(1)} Bcf/d</span>
                  </div>
                </div>
              </div>

              {/* APPALACHIAN BASIN */}
              <div style={{background:`linear-gradient(135deg, ${C.bg2}, ${C.bg3})`, borderRadius:12, border:`1px solid ${C.border}`, padding:16, display:"flex", flexDirection:"column"}}>
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12}}>
                  <div>
                    <div style={{fontSize:12, fontWeight:800, fontFamily:"'JetBrains Mono',monospace", color:C.cyan, letterSpacing:1}}>⬡ APPALACHIAN BASIN</div>
                    <div style={{fontSize:9, color:C.textDim}}>PA / WV / OH · Intentional Gas</div>
                  </div>
                  <div style={{display:"flex", gap:4}}>
                    <Badge color={C.cyan}>MODEL A</Badge>
                    <Badge color={C.green}>MODEL B</Badge>
                    <Badge color={C.purple}>MODEL C</Badge>
                  </div>
                </div>

                {/* Flow diagram - Model B (with cryo) */}
                <div style={{background:C.bg, borderRadius:8, padding:12, marginBottom:12, border:`1px solid ${C.border}`}}>
                  <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", gap:4}}>
                    {[
                      {label:"WELLHEAD", sub:"36 Bcf/d", color:C.cyanDim},
                      {label:"→", sub:""},
                      {label:"GATHER", sub:"EQT/AM", color:C.cyanDim},
                      {label:"→", sub:""},
                      {label:"CRYO ★", sub:"NGL Split", color:C.green},
                      {label:"→", sub:""},
                      {label:"TETCO M-2", sub:fmt(cur.appSpot), color:C.cyan},
                      {label:"→", sub:""},
                      {label:"DATA CTR", sub:fmt(cur.appB), color:C.green},
                    ].map((n,i) => n.label === "→" ? (
                      <span key={i} style={{color:C.cyan, fontSize:14, opacity:0.5}}>›</span>
                    ) : (
                      <div key={i} style={{textAlign:"center", padding:"6px 4px", borderRadius:6, background:i===4?`${C.green}15`:i===6?`${C.cyan}15`:i===8?`${C.green}15`:"transparent", border:(i===4||i>=6)?`1px solid ${(n.color||C.cyan)}30`:"none", flex:1, minWidth:0}}>
                        <div style={{fontSize:8, fontWeight:700, fontFamily:"'JetBrains Mono',monospace", color:n.color||C.cyanDim, whiteSpace:"nowrap"}}>{n.label}</div>
                        <div style={{fontSize:10, fontWeight:800, fontFamily:"'JetBrains Mono',monospace", color:C.text}}>{n.sub}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{marginTop:6, display:"flex", justifyContent:"center"}}>
                    <div style={{background:`${C.pink}10`, border:`1px solid ${C.pink}30`, borderRadius:4, padding:"2px 8px", display:"flex", alignItems:"center", gap:4}}>
                      <span style={{fontSize:8, color:C.pink}}>NGL REVENUE</span>
                      <span style={{fontSize:10, fontWeight:800, color:C.pink, fontFamily:"'JetBrains Mono',monospace"}}>{fmt(cur.netNGL)}/MMBtu</span>
                      <span style={{fontSize:8, color:C.textDim}}>→ Utopia / ATEX / Mariner East</span>
                    </div>
                  </div>
                </div>

                {/* Three model costs side by side */}
                <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:12}}>
                  {[
                    {label:"Model A", sub:"Buy Dry Gas", val:cur.appA, color:C.cyan},
                    {label:"Model B", sub:"Own Cryo", val:cur.appB, color:C.green},
                    {label:"Model C", sub:"Co-locate", val:cur.appC, color:C.purple},
                  ].map(m => (
                    <div key={m.label} style={{background:C.bg, borderRadius:8, padding:8, textAlign:"center", border:`1px solid ${m.color}30`}}>
                      <div style={{fontSize:8, fontWeight:700, color:m.color, fontFamily:"'JetBrains Mono',monospace"}}>{m.label}</div>
                      <div style={{fontSize:8, color:C.textDim}}>{m.sub}</div>
                      <GlowText color={m.color} size={16}>{fmt(m.val)}</GlowText>
                    </div>
                  ))}
                </div>

                {/* Pipeline egress */}
                <div style={{flex:1, overflow:"auto"}}>
                  <div style={{fontSize:9, fontWeight:700, color:C.textMuted, marginBottom:6, fontFamily:"'JetBrains Mono',monospace"}}>EGRESS / EXPANSION PROJECTS</div>
                  {APP_PIPES.map((pipe,i) => <PipelineBar key={i} pipe={pipe} idx={i} maxCap={4} basin="app" />)}
                  <div style={{marginTop:8, textAlign:"right"}}>
                    <span style={{fontSize:9, color:C.textDim}}>Total New Egress: </span>
                    <span style={{fontSize:12, fontWeight:800, color:C.cyan, fontFamily:"'JetBrains Mono',monospace"}}>{APP_PIPES.reduce((s,pp)=>s+pp.cap,0).toFixed(1)} Bcf/d</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom: Control knobs */}
            <div style={{marginTop:12, background:`linear-gradient(135deg, ${C.bg2}, ${C.bg3})`, borderRadius:12, border:`1px solid ${C.border}`, padding:"12px 16px"}}>
              <div style={{display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:8}}>
                <div style={{display:"flex", flexDirection:"column", alignItems:"center"}}>
                  <div style={{fontSize:8, fontWeight:700, color:C.amber, fontFamily:"'JetBrains Mono',monospace", marginBottom:4, letterSpacing:1}}>PERMIAN</div>
                  <div style={{display:"flex", gap:12}}>
                    <Knob label="Waha H1'26" value={p.wahaBasis2026H1} onChange={v=>set("wahaBasis2026H1",v)} min={-6} max={0} step={0.1} color={C.amber} />
                    <Knob label="Waha 2027+" value={p.wahaBasis2027} onChange={v=>set("wahaBasis2027",v)} min={-2} max={0.5} step={0.1} color={C.amber} />
                    <Knob label="Waha Floor" value={p.wahaBasisLongTerm} onChange={v=>set("wahaBasisLongTerm",v)} min={-1} max={0.2} step={0.05} color={C.amber} />
                    <Knob label="Firm Prem" value={p.permianFirmPremium} onChange={v=>set("permianFirmPremium",v)} min={0.25} max={3} step={0.25} color={C.amber} />
                  </div>
                </div>
                <div style={{display:"flex", flexDirection:"column", alignItems:"center"}}>
                  <div style={{fontSize:8, fontWeight:700, color:C.cyan, fontFamily:"'JetBrains Mono',monospace", marginBottom:4, letterSpacing:1}}>APPALACHIAN</div>
                  <div style={{display:"flex", gap:12}}>
                    <Knob label="Basis '26" value={p.appBasis2026} onChange={v=>set("appBasis2026",v)} min={-2} max={0} step={0.05} color={C.cyan} />
                    <Knob label="Tighten/yr" value={p.appBasisTightenRate} onChange={v=>set("appBasisTightenRate",v)} min={0} max={0.15} step={0.01} color={C.cyan} />
                    <Knob label="FT Cost" value={p.ftReservation} onChange={v=>set("ftReservation",v)} min={0.2} max={1} step={0.05} color={C.cyan} />
                    <Knob label="Firm Prem" value={p.appFirmPremium} onChange={v=>set("appFirmPremium",v)} min={0.1} max={1} step={0.05} color={C.cyan} />
                  </div>
                </div>
                <div style={{display:"flex", flexDirection:"column", alignItems:"center"}}>
                  <div style={{fontSize:8, fontWeight:700, color:C.green, fontFamily:"'JetBrains Mono',monospace", marginBottom:4, letterSpacing:1}}>NGL / CRYO</div>
                  <div style={{display:"flex", gap:12}}>
                    <Knob label="Yield GPM" value={p.nglYieldGPM} onChange={v=>set("nglYieldGPM",v)} min={2} max={7} step={0.5} unit="" color={C.green} />
                    <Knob label="NGL $/MMBtu" value={p.nglCompositePrice} onChange={v=>set("nglCompositePrice",v)} min={4} max={14} step={0.5} color={C.green} />
                    <Knob label="Ethane Rej" value={p.ethaneRejectionRate} onChange={v=>set("ethaneRejectionRate",v)} min={10} max={70} step={5} unit="%" color={C.pink} />
                    <Knob label="Cryo CAPEX" value={p.cryoCapex} onChange={v=>set("cryoCapex",v)} min={100} max={400} step={25} color={C.green} />
                  </div>
                </div>
                <div style={{display:"flex", flexDirection:"column", alignItems:"center"}}>
                  <div style={{fontSize:8, fontWeight:700, color:C.textDim, fontFamily:"'JetBrains Mono',monospace", marginBottom:4, letterSpacing:1}}>MACRO</div>
                  <div style={{display:"flex", gap:12}}>
                    <Knob label="HH Base" value={p.hhBase} onChange={v=>set("hhBase",v)} min={2} max={6} step={0.1} color={C.textDim} />
                    <Knob label="HH Growth" value={p.hhGrowth} onChange={v=>set("hhGrowth",v)} min={-0.2} max={0.3} step={0.02} color={C.textDim} />
                    <Knob label="Heat Rate" value={p.heatRate} onChange={v=>set("heatRate",v)} min={5.5} max={9} step={0.1} unit="" color={C.textDim} />
                    <Knob label="C Split" value={p.modelCNGLShare} onChange={v=>set("modelCNGLShare",v)} min={0.1} max={0.7} step={0.05} unit="" color={C.purple} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB: SUPPLY & DEMAND ─── */}
      {tab === "supply" && (
        <div style={{padding:20, height:"calc(100vh - 52px)", overflow:"auto"}}>
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16}}>
            {/* Demand Growth */}
            <div style={{background:C.bg2, borderRadius:12, border:`1px solid ${C.border}`, padding:16}}>
              <div style={{fontSize:11, fontWeight:800, fontFamily:"'JetBrains Mono',monospace", color:C.cyan, marginBottom:12, letterSpacing:1}}>
                INCREMENTAL GAS DEMAND GROWTH (Bcf/d from 2025 base)
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={model}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="year" tick={{fontSize:10, fill:C.textDim}} stroke={C.border} />
                  <YAxis tick={{fontSize:10, fill:C.textDim}} stroke={C.border} />
                  <Tooltip contentStyle={{background:C.bg2, border:`1px solid ${C.border}`, borderRadius:8, fontSize:10, color:C.text}} />
                  <Area type="monotone" dataKey="otherDemand" name="Industrial/Resi" stackId="1" fill={C.purpleDim} stroke={C.purple} fillOpacity={0.6} />
                  <Area type="monotone" dataKey="seDemand" name="SE Utility" stackId="1" fill={C.pinkDim} stroke={C.pink} fillOpacity={0.6} />
                  <Area type="monotone" dataKey="lngDemand" name="LNG Feed Gas" stackId="1" fill={C.amberDim} stroke={C.amber} fillOpacity={0.6} />
                  <Area type="monotone" dataKey="dcDemand" name="Data Centers" stackId="1" fill={C.cyanDim} stroke={C.cyan} fillOpacity={0.8} />
                  <Legend wrapperStyle={{fontSize:10}} />
                </AreaChart>
              </ResponsiveContainer>
              <div style={{fontSize:9, color:C.textMuted, marginTop:8}}>
                Sources: East Daley, RBN Energy, EIA. Data center demand per EDA Data Center Demand Monitor. LNG includes Plaquemines, CP2, Golden Pass ramp.
              </div>
            </div>

            {/* Egress Additions side by side */}
            <div style={{background:C.bg2, borderRadius:12, border:`1px solid ${C.border}`, padding:16}}>
              <div style={{fontSize:11, fontWeight:800, fontFamily:"'JetBrains Mono',monospace", color:C.amber, marginBottom:12, letterSpacing:1}}>
                CUMULATIVE NEW EGRESS CAPACITY (Bcf/d)
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={model}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="year" tick={{fontSize:10, fill:C.textDim}} stroke={C.border} />
                  <YAxis tick={{fontSize:10, fill:C.textDim}} stroke={C.border} />
                  <Tooltip contentStyle={{background:C.bg2, border:`1px solid ${C.border}`, borderRadius:8, fontSize:10, color:C.text}} />
                  <Bar dataKey="permianNewEgress" name="Permian Egress" fill={C.amber} fillOpacity={0.7} radius={[4,4,0,0]} />
                  <Bar dataKey="appNewEgress" name="Appalachian Egress" fill={C.cyan} fillOpacity={0.7} radius={[4,4,0,0]} />
                  <Line type="monotone" dataKey="totalDemandGrowth" name="Total Demand Growth" stroke={C.pink} strokeWidth={2.5} dot={{r:3, fill:C.pink}} />
                  <Legend wrapperStyle={{fontSize:10}} />
                </ComposedChart>
              </ResponsiveContainer>
              <div style={{fontSize:9, color:C.textMuted, marginTop:8}}>
                Permian egress: GCX Exp, Blackcomb, Hugh Brinson, Saguaro, Eiger, DeLa, Desert SW, Tallgrass-REX. App: MVP Boost, Transco SSE, Southgate, Kosciusko, MSX/SSE4, Borealis.
              </div>
            </div>
          </div>

          {/* Basis Impact */}
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16}}>
            <div style={{background:C.bg2, borderRadius:12, border:`1px solid ${C.border}`, padding:16}}>
              <div style={{fontSize:11, fontWeight:800, fontFamily:"'JetBrains Mono',monospace", color:C.amber, marginBottom:12, letterSpacing:1}}>
                WAHA BASIS TO HENRY HUB
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={model}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="year" tick={{fontSize:10, fill:C.textDim}} stroke={C.border} />
                  <YAxis tick={{fontSize:10, fill:C.textDim}} stroke={C.border} domain={['auto','auto']} />
                  <Tooltip contentStyle={{background:C.bg2, border:`1px solid ${C.border}`, borderRadius:8, fontSize:10, color:C.text}} formatter={v=>[`${fmt(v)}/MMBtu`]} />
                  <ReferenceLine y={0} stroke={C.textMuted} strokeDasharray="3 3" />
                  <defs><linearGradient id="wahaG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.amber} stopOpacity={0.3}/><stop offset="100%" stopColor={C.amber} stopOpacity={0.05}/></linearGradient></defs>
                  <Area type="monotone" dataKey="wahaBasis" name="Waha Basis" fill="url(#wahaG)" stroke={C.amber} strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
              <div style={{display:"flex", justifyContent:"space-between", marginTop:8}}>
                <div style={{textAlign:"center"}}><div style={{fontSize:8, color:C.textMuted}}>2026 AVG</div><GlowText color={C.amber} size={14}>{fmt(cur.wahaBasis)}</GlowText></div>
                <div style={{textAlign:"center"}}><div style={{fontSize:8, color:C.textMuted}}>2030</div><GlowText color={C.amber} size={14}>{fmt(model[4].wahaBasis)}</GlowText></div>
                <div style={{textAlign:"center"}}><div style={{fontSize:8, color:C.textMuted}}>2035</div><GlowText color={C.amber} size={14}>{fmt(model[9].wahaBasis)}</GlowText></div>
              </div>
              <div style={{fontSize:9, color:C.textMuted, marginTop:8}}>~4.5 Bcf/d new pipe in H2 2026 causes sharp basis narrowing. Overbuild (9.5+ Bcf/d new vs ~4-6.5 Bcf/d production growth) compresses Waha toward Henry Hub.</div>
            </div>

            <div style={{background:C.bg2, borderRadius:12, border:`1px solid ${C.border}`, padding:16}}>
              <div style={{fontSize:11, fontWeight:800, fontFamily:"'JetBrains Mono',monospace", color:C.cyan, marginBottom:12, letterSpacing:1}}>
                APPALACHIAN BASIS TO HENRY HUB
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={model}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="year" tick={{fontSize:10, fill:C.textDim}} stroke={C.border} />
                  <YAxis tick={{fontSize:10, fill:C.textDim}} stroke={C.border} domain={['auto','auto']} />
                  <Tooltip contentStyle={{background:C.bg2, border:`1px solid ${C.border}`, borderRadius:8, fontSize:10, color:C.text}} formatter={v=>[`${fmt(v)}/MMBtu`]} />
                  <ReferenceLine y={0} stroke={C.textMuted} strokeDasharray="3 3" />
                  <defs><linearGradient id="appG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.cyan} stopOpacity={0.3}/><stop offset="100%" stopColor={C.cyan} stopOpacity={0.05}/></linearGradient></defs>
                  <Area type="monotone" dataKey="appBasis" name="App. Basis" fill="url(#appG)" stroke={C.cyan} strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
              <div style={{display:"flex", justifyContent:"space-between", marginTop:8}}>
                <div style={{textAlign:"center"}}><div style={{fontSize:8, color:C.textMuted}}>2026</div><GlowText color={C.cyan} size={14}>{fmt(cur.appBasis)}</GlowText></div>
                <div style={{textAlign:"center"}}><div style={{fontSize:8, color:C.textMuted}}>2030</div><GlowText color={C.cyan} size={14}>{fmt(model[4].appBasis)}</GlowText></div>
                <div style={{textAlign:"center"}}><div style={{fontSize:8, color:C.textMuted}}>2035</div><GlowText color={C.cyan} size={14}>{fmt(model[9].appBasis)}</GlowText></div>
              </div>
              <div style={{fontSize:9, color:C.textMuted, marginTop:8}}>Limited new egress (NEPA friction) + accelerating demand (data centers, LNG, SE utilities) = structural basis tightening. Discount narrows gradually, not a one-time pipe event.</div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB: DELIVERED COST ─── */}
      {tab === "cost" && (
        <div style={{padding:20, height:"calc(100vh - 52px)", overflow:"auto"}}>
          {/* KPI strip */}
          <div style={{display:"grid", gridTemplateColumns:"repeat(6, 1fr)", gap:8, marginBottom:16}}>
            {[
              {label:"PERMIAN A (2026)", val:fmt(cur.permianA), color:C.amber},
              {label:"APP. A (2026)", val:fmt(cur.appA), color:C.cyan},
              {label:"APP. B (2026)", val:fmt(cur.appB), color:C.green},
              {label:"APP. C (2026)", val:fmt(cur.appC), color:C.purple},
              {label:"NGL CREDIT", val:fmt(cur.netNGL), color:C.pink},
              {label:"10-YR B vs PERM", val:`${fmtM(Math.abs(model.reduce((s,r)=>s+(r.appBAnnual-r.permianAnnual),0)))}`, color: model.reduce((s,r)=>s+(r.appBAnnual-r.permianAnnual),0) < 0 ? C.green : C.red, sub: model.reduce((s,r)=>s+(r.appBAnnual-r.permianAnnual),0) < 0 ? "App B saves" : "Perm A saves"},
            ].map(kpi => (
              <div key={kpi.label} style={{background:C.bg2, borderRadius:8, border:`1px solid ${kpi.color}30`, padding:"10px 12px", textAlign:"center"}}>
                <div style={{fontSize:8, fontWeight:700, color:C.textMuted, fontFamily:"'JetBrains Mono',monospace", letterSpacing:0.5}}>{kpi.label}</div>
                <div style={{fontSize:18, fontWeight:800, color:kpi.color, fontFamily:"'JetBrains Mono',monospace", textShadow:`0 0 12px ${kpi.color}30`}}>{kpi.val}</div>
                {kpi.sub && <div style={{fontSize:8, color:C.textDim}}>{kpi.sub}</div>}
              </div>
            ))}
          </div>

          {/* Main chart */}
          <div style={{background:C.bg2, borderRadius:12, border:`1px solid ${C.border}`, padding:16, marginBottom:16}}>
            <div style={{fontSize:11, fontWeight:800, fontFamily:"'JetBrains Mono',monospace", color:C.text, marginBottom:12, letterSpacing:1}}>
              ALL-IN DELIVERED FUEL COST ($/MMBtu)
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={model}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis dataKey="year" tick={{fontSize:10, fill:C.textDim}} stroke={C.border} />
                <YAxis tick={{fontSize:10, fill:C.textDim}} stroke={C.border} tickFormatter={v=>`$${v}`} domain={['auto','auto']} />
                <Tooltip contentStyle={{background:C.bg2, border:`1px solid ${C.border}`, borderRadius:8, fontSize:10, color:C.text}} formatter={(v,n)=>[`${fmt(v)}/MMBtu`, n]} />
                <ReferenceLine y={0} stroke={C.textMuted} strokeDasharray="3 3" />
                <Line type="monotone" dataKey="hh" name="Henry Hub" stroke={C.textMuted} strokeWidth={1} strokeDasharray="4 4" dot={false} />
                <Line type="monotone" dataKey="permianA" name="Permian A (Residue)" stroke={C.amber} strokeWidth={3} dot={{r:4, fill:C.amber, stroke:C.bg, strokeWidth:2}} />
                <Line type="monotone" dataKey="appA" name="App. A (Dry Gas)" stroke={C.cyan} strokeWidth={1.5} strokeDasharray="6 3" dot={{r:2, fill:C.cyan}} />
                <Line type="monotone" dataKey="appB" name="App. B (Own Cryo)" stroke={C.green} strokeWidth={3} dot={{r:4, fill:C.green, stroke:C.bg, strokeWidth:2}} />
                <Line type="monotone" dataKey="appC" name="App. C (Co-locate)" stroke={C.purple} strokeWidth={2.5} dot={{r:3, fill:C.purple, stroke:C.bg, strokeWidth:2}} />
                <Legend wrapperStyle={{fontSize:10}} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Annual cost bars */}
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16}}>
            <div style={{background:C.bg2, borderRadius:12, border:`1px solid ${C.border}`, padding:16}}>
              <div style={{fontSize:11, fontWeight:800, fontFamily:"'JetBrains Mono',monospace", color:C.text, marginBottom:12, letterSpacing:1}}>
                ANNUAL FUEL COST · {p.dcCapacityMW} MW ($M/yr)
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={model}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis dataKey="year" tick={{fontSize:10, fill:C.textDim}} stroke={C.border} />
                  <YAxis tick={{fontSize:10, fill:C.textDim}} stroke={C.border} tickFormatter={v=>`$${v}M`} />
                  <Tooltip contentStyle={{background:C.bg2, border:`1px solid ${C.border}`, borderRadius:8, fontSize:10, color:C.text}} formatter={(v,n)=>[`$${v}M/yr`, n]} />
                  <Bar dataKey="permianAnnual" name="Permian A" fill={C.amber} fillOpacity={0.8} radius={[3,3,0,0]} />
                  <Bar dataKey="appBAnnual" name="App. B" fill={C.green} fillOpacity={0.8} radius={[3,3,0,0]} />
                  <Bar dataKey="appCAnnual" name="App. C" fill={C.purple} fillOpacity={0.8} radius={[3,3,0,0]} />
                  <Legend wrapperStyle={{fontSize:10}} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Data table */}
            <div style={{background:C.bg2, borderRadius:12, border:`1px solid ${C.border}`, padding:16, overflow:"auto"}}>
              <div style={{fontSize:11, fontWeight:800, fontFamily:"'JetBrains Mono',monospace", color:C.text, marginBottom:12, letterSpacing:1}}>
                DETAIL TABLE
              </div>
              <table style={{width:"100%", fontSize:10, borderCollapse:"collapse", fontFamily:"'JetBrains Mono',monospace"}}>
                <thead>
                  <tr style={{borderBottom:`1px solid ${C.border}`}}>
                    {["Year","HH","Waha","Perm A","App","App B","App C","NGL"].map(h => (
                      <th key={h} style={{padding:"4px 6px", textAlign:"right", color:C.textMuted, fontWeight:700, fontSize:9}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {model.map((r,i) => (
                    <tr key={r.year} style={{borderBottom:`1px solid ${C.border}`, background:i%2===0?C.bg:"transparent"}}>
                      <td style={{padding:"4px 6px", fontWeight:700, color:C.text}}>{r.year}</td>
                      <td style={{padding:"4px 6px", textAlign:"right", color:C.textDim}}>{fmt(r.hh)}</td>
                      <td style={{padding:"4px 6px", textAlign:"right", color:C.textDim}}>{fmt(r.wahaSpot)}</td>
                      <td style={{padding:"4px 6px", textAlign:"right", color:C.amber, fontWeight:700}}>{fmt(r.permianA)}</td>
                      <td style={{padding:"4px 6px", textAlign:"right", color:C.textDim}}>{fmt(r.appSpot)}</td>
                      <td style={{padding:"4px 6px", textAlign:"right", color:C.green, fontWeight:700}}>{fmt(r.appB)}</td>
                      <td style={{padding:"4px 6px", textAlign:"right", color:C.purple}}>{fmt(r.appC)}</td>
                      <td style={{padding:"4px 6px", textAlign:"right", color:C.pink}}>{fmt(r.netNGL)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB: THESIS & ASSUMPTIONS ─── */}
      {tab === "thesis" && (
        <div style={{padding:20, height:"calc(100vh - 52px)", overflow:"auto", maxWidth:1100, margin:"0 auto"}}>

          {/* Section header helper */}
          {(() => {
            const Section = ({icon, color, title, children}) => (
              <div style={{background:C.bg2, borderRadius:12, border:`1px solid ${C.border}`, padding:20, marginBottom:16}}>
                <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:14}}>
                  <span style={{fontSize:16}}>{icon}</span>
                  <span style={{fontSize:13, fontWeight:800, fontFamily:"'JetBrains Mono',monospace", color, letterSpacing:1}}>{title}</span>
                </div>
                {children}
              </div>
            );
            const P = ({children, dim}) => <p style={{fontSize:12, lineHeight:1.7, color:dim?C.textDim:C.text, marginBottom:10}}>{children}</p>;
            const Strong = ({children, color=C.text}) => <span style={{fontWeight:700, color}}>{children}</span>;
            const Mono = ({children, color=C.cyan}) => <span style={{fontFamily:"'JetBrains Mono',monospace", fontWeight:700, color, fontSize:11}}>{children}</span>;
            const Callout = ({color, title, children}) => (
              <div style={{background:`${color}08`, border:`1px solid ${color}30`, borderRadius:8, padding:14, marginBottom:12, marginTop:8}}>
                {title && <div style={{fontSize:10, fontWeight:800, fontFamily:"'JetBrains Mono',monospace", color, marginBottom:6, letterSpacing:0.5}}>{title}</div>}
                <div style={{fontSize:11, lineHeight:1.7, color:C.text}}>{children}</div>
              </div>
            );
            const Row = ({label, value, note, color=C.textDim}) => (
              <div style={{display:"flex", borderBottom:`1px solid ${C.border}`, padding:"6px 0", alignItems:"baseline"}}>
                <span style={{flex:1, fontSize:11, color:C.textDim}}>{label}</span>
                <span style={{fontSize:12, fontFamily:"'JetBrains Mono',monospace", fontWeight:700, color, minWidth:80, textAlign:"right"}}>{value}</span>
                {note && <span style={{fontSize:10, color:C.textMuted, marginLeft:12, maxWidth:220}}>{note}</span>}
              </div>
            );

            return (<>
            {/* ── THE CORE FRAMEWORK ── */}
            <Section icon="◆" color={C.text} title="THE FUNDAMENTAL QUESTION">
              <P>A data center developer buying gas for behind-the-meter power generation is optimizing two variables simultaneously:</P>
              <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14}}>
                <div style={{background:C.bg, borderRadius:8, padding:14, border:`1px solid ${C.border}`}}>
                  <div style={{fontSize:10, fontWeight:800, color:C.amber, fontFamily:"'JetBrains Mono',monospace", marginBottom:4}}>① METHANE COST</div>
                  <P dim>What you pay per MMBtu for the fuel that runs your gensets. Lower is better. This is the gas price at your delivery point, inclusive of basis, firm premiums, and transport.</P>
                </div>
                <div style={{background:C.bg, borderRadius:8, padding:14, border:`1px solid ${C.border}`}}>
                  <div style={{fontSize:10, fontWeight:800, color:C.pink, fontFamily:"'JetBrains Mono',monospace", marginBottom:4}}>② NGL MARGIN</div>
                  <P dim>The revenue from selling ethane, propane, butane, and C5+ after cryogenic processing, minus cost of processing and transport to market. Higher is better. Only available if you control or participate in the processing step.</P>
                </div>
              </div>
              <P>These two objectives exist in tension: <Strong color={C.amber}>the cheapest methane markets (like Waha) are cheap precisely because the gas has already been processed and the NGLs have already been stripped out by the incumbent midstream operator.</Strong> You get cheap fuel but zero NGL upside.</P>
              <P>The fundamental commercial question driving this model is: <Strong color={C.cyan}>at what point in the supply chain do you take possession of the gas?</Strong> That decision determines which of the three deal models applies — and which basins can support which models.</P>
            </Section>

            {/* ── THREE MODELS ── */}
            <Section icon="◈" color={C.text} title="THE THREE DEAL MODELS">
              <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:16}}>
                {/* Model A */}
                <div style={{background:C.bg, borderRadius:10, border:`1px solid ${C.amber}30`, padding:14}}>
                  <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8}}>
                    <span style={{fontSize:12, fontWeight:800, color:C.amber, fontFamily:"'JetBrains Mono',monospace"}}>MODEL A</span>
                    <Badge color={C.amber}>BUY RESIDUE</Badge>
                  </div>
                  <P dim>Buy dry, pipeline-quality methane from a midstream company or at a hub index. You get cheap fuel but <Strong color={C.amber}>zero NGL upside</Strong> — the processor already captured that value.</P>
                  <div style={{fontSize:10, color:C.textMuted, lineHeight:1.6}}>
                    <div><Strong color={C.text}>Possession point:</Strong> Post-processing hub</div>
                    <div><Strong color={C.text}>Capex:</Strong> Lateral + M&R only</div>
                    <div><Strong color={C.text}>NGL revenue:</Strong> $0</div>
                    <div><Strong color={C.text}>Precedent:</Strong> ET/CloudBurst, ET/Oracle, ET/Fermi</div>
                    <div><Strong color={C.text}>Works in:</Strong> Permian ✓  App ✓  Haynesville ✓</div>
                  </div>
                </div>
                {/* Model B */}
                <div style={{background:C.bg, borderRadius:10, border:`1px solid ${C.green}30`, padding:14}}>
                  <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8}}>
                    <span style={{fontSize:12, fontWeight:800, color:C.green, fontFamily:"'JetBrains Mono',monospace"}}>MODEL B</span>
                    <Badge color={C.green}>OWN CRYO</Badge>
                  </div>
                  <P dim>Take raw wellhead gas directly from a producer, build or control your own cryo plant, extract and sell the NGLs, burn the residue gas. <Strong color={C.green}>You capture both streams.</Strong></P>
                  <div style={{fontSize:10, color:C.textMuted, lineHeight:1.6}}>
                    <div><Strong color={C.text}>Possession point:</Strong> Wellhead / field receipt</div>
                    <div><Strong color={C.text}>Capex:</Strong> ~$150–250M (200 MMcf/d cryo)</div>
                    <div><Strong color={C.text}>NGL revenue:</Strong> {fmt(cur.netNGL)}/MMBtu net</div>
                    <div><Strong color={C.text}>Precedent:</Strong> Cadiz/Harrison Co. thesis</div>
                    <div><Strong color={C.text}>Best in:</Strong> App wet gas ✓✓  Permian* ◐</div>
                  </div>
                </div>
                {/* Model C */}
                <div style={{background:C.bg, borderRadius:10, border:`1px solid ${C.purple}30`, padding:14}}>
                  <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8}}>
                    <span style={{fontSize:12, fontWeight:800, color:C.purple, fontFamily:"'JetBrains Mono',monospace"}}>MODEL C</span>
                    <Badge color={C.purple}>CO-LOCATE</Badge>
                  </div>
                  <P dim>Partner with an existing or new-build processing plant. They process the gas, you take the residue for power, and <Strong color={C.purple}>negotiate a share of the NGL margin</Strong> or a reduced gas price reflecting the NGL credit.</P>
                  <div style={{fontSize:10, color:C.textMuted, lineHeight:1.6}}>
                    <div><Strong color={C.text}>Possession point:</Strong> Processing plant tailgate</div>
                    <div><Strong color={C.text}>Capex:</Strong> Lateral + M&R (no cryo)</div>
                    <div><Strong color={C.text}>NGL revenue:</Strong> {(p.modelCNGLShare*100).toFixed(0)}% of net margin</div>
                    <div><Strong color={C.text}>Precedent:</Strong> MPLX / Antero JV structures</div>
                    <div><Strong color={C.text}>Best in:</Strong> App wet gas ✓✓  Permian ✗ (see below)</div>
                  </div>
                </div>
              </div>
            </Section>

            {/* ── WHY APPALACHIA SUPPORTS ALL THREE ── */}
            <Section icon="⬡" color={C.cyan} title="WHY APPALACHIA SUPPORTS ALL THREE MODELS">
              <P>The Appalachian wet gas window (Harrison County OH, SW PA, northern WV) is structurally suited for Models B and C in ways that no other US basin matches. Four factors converge:</P>

              <Callout color={C.cyan} title="1 — LESS CONSOLIDATED MIDSTREAM">
                In the Permian, virtually every producing acre is dedicated to a major midstream operator (Targa, ET, ONEOK, Enterprise, Kinetik) under long-term GGP agreements with acreage covenants that run with the land. In Appalachia, the picture is different. Eastern Ohio / Harrison County is less locked up. The recent Antero/HG Energy restructuring ($5B+ in transactions) reshuffled midstream dedications. Infinity Natural Resources and smaller operators are growing Utica production without legacy GGP encumbrances. There is more room for an independent operator to build a cryo plant and capture both residue gas and NGL revenue.
              </Callout>

              <Callout color={C.green} title="2 — 48% ETHANE REJECTION = STRANDED VALUE">
                Nearly half of available ethane in Appalachia is currently being rejected into the gas stream — left there because extraction isn't economic at current netbacks. This is value sitting on the table. A co-located cryo + DC operation changes the calculus: you're not competing for NGL transport capacity at market rates, you're unlocking volume that isn't being extracted at all. When you reduce ethane rejection from 48% to, say, 20% in the model, the NGL credit per MMBtu jumps materially.
              </Callout>

              <Callout color={C.pink} title="3 — NGL OFFTAKE INFRASTRUCTURE IN-BASIN">
                Harrison County sits on or adjacent to: the <Mono>Utopia Pipeline</Mono> (KMI, 75 Mb/d to Windsor, Ontario — direct ethane outlet), <Mono>ATEX Express</Mono> (Enterprise, ~190 Mb/d to Mont Belvieu — ethane to Gulf Coast), <Mono>Mariner East 2/2X</Mono> (ET/Sunoco, ~275–375 Mb/d to Marcus Hook — ethane, propane, butane for export), and the <Mono>Falcon Pipeline</Mono> (MPLX, ~100 Mb/d to Shell Monaca cracker). You don't need to build NGL pipe — you need to connect to it.
              </Callout>

              <Callout color={C.purple} title="4 — PRODUCERS ARE ACTIVELY EXPLORING ALTERNATIVE STRUCTURES">
                EQT signed 1.5 Bcf/d of direct data center supply deals in July 2025 (Shippingport 800 MMcf/d, Homer City 665 MMcf/d). Coterra has 330 MMcf/d of power netback deals in the Marcellus. Range Resources is securing new processing capacity and NGL takeaway for 2026. These producers are not passive — they are actively seeking creative marketing structures that diverge from the traditional midstream model. A Model B or C proposal would find receptive counterparties.
              </Callout>
            </Section>

            {/* ── PERMIAN: WHY MODEL A DOMINATES — AND THE EXCEPTIONS ── */}
            <Section icon="⬡" color={C.amber} title="PERMIAN: WHY MODEL A DOMINATES — AND WHERE IT DOESN'T">
              <P><Strong color={C.amber}>The default answer is that Permian is Model A only.</Strong> Here's the structural reasoning — and the important exceptions.</P>

              <Callout color={C.red} title="WHY MODEL B/C IS HARD IN THE PERMIAN">
                <P><Strong color={C.text}>Acreage dedications are near-universal.</Strong> Virtually every producing acre in the Midland and Delaware basins is locked into a long-term GGP agreement with a major midstream operator. These aren't just commercial contracts — they're covenants that run with the land. When acreage changes hands (as in the Diamondback/Endeavor merger), the GGP dedication transfers with it. You can't show up and offer to process a producer's gas — it's already contractually committed to Targa, ET, Enterprise, ONEOK, or Kinetik. The midstream operator controls the molecule from wellpad to residue outlet.</P>
                <P><Strong color={C.text}>The midstream operators would view you as a competitor, not a partner.</Strong> These are $50–100B+ market cap companies with massive scale economies in gathering, processing, and NGL transport. Their business model depends on throughput volume. A data center developer building an independent cryo plant is taking molecules out of their system. They have no incentive to cooperate — and significant incentive to block you via their contractual rights.</P>
                <P><Strong color={C.text}>Associated gas doesn't optimize for gas marketing creativity.</Strong> Permian producers drill for oil and get gas whether they want it or not. Their gas marketing strategy is secondary to their oil economics. They sign GGP contracts that give the midstream company operational control in exchange for reliable takeaway. They are not shopping for alternative gas buyers — they need a place to put the gas so they can keep producing oil.</P>
                <P><Strong color={C.text}>NGL infrastructure is overbuilt and vertically integrated.</Strong> East Daley estimates ~2.27 million b/d of spare NGL pipeline capacity out of the Permian. Targa's Grand Prix + Speedway, Enterprise's Shin Oak, ONEOK's West Texas NGL — these systems are overbuilt and the operators are competing for volume. The fractionation and export infrastructure at Mont Belvieu is world-class. There is no structural NGL bottleneck to exploit — unlike Appalachia's 48% ethane rejection.</P>
              </Callout>

              <Callout color={C.amber} title="THE EXCEPTIONS: WHERE PERMIAN MODEL B* IS POSSIBLE">
                <P>There are execution paths for a Model B variant in the Permian — but they look fundamentally different from the Appalachian version. They require going around the incumbent midstream, not through it.</P>

                <div style={{background:C.bg, borderRadius:8, padding:12, marginTop:10, border:`1px solid ${C.border}`}}>
                  <div style={{fontSize:10, fontWeight:800, color:C.amber, fontFamily:"'JetBrains Mono',monospace", marginBottom:6}}>EXCEPTION 1: OFF-GRID WELLPAD GAS (THE OM TECHNOLOGY MODEL)</div>
                  <P dim>Take raw associated gas directly from a small producer who either (a) doesn't have a GGP contract, (b) has an expiring GGP, or (c) has wellpads too remote for the midstream to connect economically. Process on-site with mobile or modular cryogenic equipment. This is exactly the OM Technology model you're doing DD on — Calgary-based off-grid gas-to-power with modular processing.</P>
                  <P dim><Strong color={C.amber}>The challenge is scale and reliability.</Strong> Wellpad-level supply is inherently variable: individual wells decline, new wells come online on unpredictable schedules, and production from any single pad can fluctuate 20–40% month-to-month. To get firm volumes for a 1 GW data center (~150,000 MMBtu/d), you'd need to aggregate supply across dozens of pads with a hub-and-spoke gathering system — which starts to look like building your own midstream company. OM's approach works for smaller power loads (5–50 MW) but faces scaling challenges at data center scale.</P>
                  <P dim><Strong color={C.amber}>The Permian has significant volumes of gas that is being flared or vented</Strong> despite tighter TRC rules — this gas is, by definition, not being captured by the incumbent midstream. A developer that could aggregate these stranded volumes would access extremely cheap raw gas (the producer is currently getting $0 for it). But the logistics of collecting gas from scattered wellpads across a geographic area and delivering it reliably to a fixed data center site are non-trivial.</P>
                </div>

                <div style={{background:C.bg, borderRadius:8, padding:12, marginTop:10, border:`1px solid ${C.border}`}}>
                  <div style={{fontSize:10, fontWeight:800, color:C.amber, fontFamily:"'JetBrains Mono',monospace", marginBottom:6}}>EXCEPTION 2: GGP CONTRACT EXPIRATIONS</div>
                  <P dim>GGP contracts have terms — typically 10–20 years, often with rolling renewals. As contracts expire, producers have a window to renegotiate or redirect volumes. A data center developer that identifies a large producer with an expiring GGP in a favorable location (near existing transmission, near Waha interconnects) could negotiate a raw gas supply deal before the producer re-ups with the incumbent midstream. This requires deep commercial intelligence on GGP expiration schedules — which are typically not public but can sometimes be inferred from SEC filings (10-K risk factor disclosures) and midstream contract disputes in FERC proceedings.</P>
                </div>

                <div style={{background:C.bg, borderRadius:8, padding:12, marginTop:10, border:`1px solid ${C.border}`}}>
                  <div style={{fontSize:10, fontWeight:800, color:C.amber, fontFamily:"'JetBrains Mono',monospace", marginBottom:6}}>EXCEPTION 3: MIDSTREAM PARTNERSHIP (MODEL C VARIANT)</div>
                  <P dim>Rather than competing with Targa or ET, partner with them. A large enough data center project (~1 GW+) represents 150,000+ MMBtu/d of firm demand — that's a meaningful anchor commitment for a midstream operator's processing plant. The pitch: "We'll take 100% of your residue gas from Plant X under a 15-year take-or-pay, and in exchange we want residue priced at Waha minus $0.50 reflecting the NGL margin you're earning on our volumes." This isn't Model C exactly (you're not getting NGL revenue), but it's a Model A with an NGL-informed negotiation that captures some of the value indirectly through a below-market gas price.</P>
                  <P dim><Strong color={C.amber}>The barrier:</Strong> Targa, ET, and ONEOK already have fully contracted processing output and strong netbacks. They don't need to offer a discount to move their gas — it's already flowing. You'd need to catch them at a moment of overcapacity (e.g., when a new processing plant comes online and isn't fully subscribed) or offer an unusually long/firm commitment that de-risks their capital investment.</P>
                </div>
              </Callout>

              {/* Summary matrix */}
              <div style={{marginTop:16}}>
                <div style={{fontSize:10, fontWeight:800, color:C.textMuted, fontFamily:"'JetBrains Mono',monospace", marginBottom:8, letterSpacing:1}}>MODEL FEASIBILITY MATRIX</div>
                <table style={{width:"100%", fontSize:11, borderCollapse:"collapse", fontFamily:"'JetBrains Mono',monospace"}}>
                  <thead>
                    <tr style={{borderBottom:`2px solid ${C.border}`}}>
                      {["","Permian","App. Wet Gas","App. Dry Gas","Haynesville"].map(h => (
                        <th key={h} style={{padding:"8px", textAlign:"center", color:C.textMuted, fontWeight:700, fontSize:9}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      {model:"Model A (Buy Residue)", vals:["✓ Best near-term cost","✓ Viable","✓ Best for dry gas","✓ Viable"], colors:[C.green,C.green,C.green,C.green]},
                      {model:"Model B (Own Cryo)", vals:["◐ Hard — see exceptions","✓✓ Best fit (Cadiz)","✗ Low NGL content","◐ Rich gas exists but midstream locked"], colors:[C.amber,C.green,C.red,C.amber]},
                      {model:"Model C (Co-locate)", vals:["◐ Possible as negotiation","✓ Most executable near-term","✗ No processing needed","◐ Limited fragmentation"], colors:[C.amber,C.green,C.red,C.amber]},
                      {model:"Model B* (Off-grid/Mobile)", vals:["✓ OM Tech model — scale risk","◐ Less stranded gas","✗ N/A","◐ Some flared gas"], colors:[C.green,C.amber,C.red,C.amber]},
                    ].map(row => (
                      <tr key={row.model} style={{borderBottom:`1px solid ${C.border}`}}>
                        <td style={{padding:"8px", fontWeight:700, color:C.text, fontSize:10}}>{row.model}</td>
                        {row.vals.map((v,i) => (
                          <td key={i} style={{padding:"8px", textAlign:"center", fontSize:10, color:row.colors[i], lineHeight:1.4}}>{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            {/* ── KEY ASSUMPTIONS ── */}
            <Section icon="▤" color={C.textDim} title="MODEL ASSUMPTIONS & SOURCES">
              <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16}}>
                <div>
                  <div style={{fontSize:10, fontWeight:800, color:C.amber, fontFamily:"'JetBrains Mono',monospace", marginBottom:8, letterSpacing:1}}>GAS MARKET</div>
                  <Row label="Henry Hub base (2026)" value={`$${p.hhBase.toFixed(2)}`} note="EIA STEO March 2026; HH spot late Mar" color={C.text} />
                  <Row label="HH annual growth" value={`$${p.hhGrowth.toFixed(2)}/yr`} note="EIA outlook; LNG demand pull + data center load" color={C.text} />
                  <Row label="Waha basis H1 2026" value={`$${p.wahaBasis2026H1.toFixed(2)}`} note="AEGIS Hedging Mar 2026; 75% of days negative YTD" color={C.text} />
                  <Row label="Waha basis H2 2026" value={`$${p.wahaBasis2026H2.toFixed(2)}`} note="AEGIS; ~4.5 Bcf/d new pipe enters service" color={C.text} />
                  <Row label="Waha basis 2027+" value={`$${p.wahaBasis2027.toFixed(2)}`} note="East Daley forecast; basis under $0.50 by 2027" color={C.text} />
                  <Row label="Waha long-term floor" value={`$${p.wahaBasisLongTerm.toFixed(2)}`} note="Structural overbuild (9.5+ Bcf/d new vs ~4-6 growth)" color={C.text} />
                  <Row label="App. basis (2026)" value={`$${p.appBasis2026.toFixed(2)}`} note="AEGIS Dec 2025; EGS summer strip -$0.94" color={C.text} />
                  <Row label="App. basis tightening" value={`$${p.appBasisTightenRate.toFixed(2)}/yr`} note="EQT CFO: 'structurally tighten through end of decade'" color={C.text} />

                  <div style={{fontSize:10, fontWeight:800, color:C.textDim, fontFamily:"'JetBrains Mono',monospace", marginBottom:8, marginTop:16, letterSpacing:1}}>DATA CENTER</div>
                  <Row label="Capacity" value={`${p.dcCapacityMW} MW`} note="~1 GW reference case (Kahla / Cadiz scale)" color={C.text} />
                  <Row label="Heat rate" value={`${p.heatRate} MMBtu/MWh`} note="CCGT (GE 7HA.02 class); lower = more efficient" color={C.text} />
                  <Row label="Capacity factor" value={`${(p.capacityFactor*100).toFixed(0)}%`} note="Baseload AI/HPC assumption; 24/7/365" color={C.text} />
                  <Row label="Annual gas volume" value={`${(p.dcCapacityMW*p.heatRate*8760*p.capacityFactor/1e6).toFixed(1)}M MMBtu`} note="Derived from MW × heat rate × hours × CF" color={C.text} />
                </div>

                <div>
                  <div style={{fontSize:10, fontWeight:800, color:C.green, fontFamily:"'JetBrains Mono',monospace", marginBottom:8, letterSpacing:1}}>NGL & PROCESSING</div>
                  <Row label="NGL yield" value={`${p.nglYieldGPM.toFixed(1)} GPM`} note="Appalachian wet gas 3–5 GPM; Permian 4–7 GPM" color={C.text} />
                  <Row label="NGL composite price" value={`$${p.nglCompositePrice.toFixed(2)}/MMBtu`} note="EIA Natural Gas Weekly (week ending Mar 1, 2026)" color={C.text} />
                  <Row label="NGL price growth" value={`${(p.nglPriceGrowth*100).toFixed(0)}%/yr`} note="Conservative; tied to crude + petchem demand" color={C.text} />
                  <Row label="Ethane rejection rate" value={`${p.ethaneRejectionRate}%`} note="Enkon/East Daley: ~48% of App ethane rejected" color={C.text} />
                  <Row label="Cryo plant CAPEX" value={`$${p.cryoCapex}M`} note="200 MMcf/d cryogenic plant; industry range $150-250M" color={C.text} />
                  <Row label="Processing OPEX" value={`$${p.cryoOpex.toFixed(2)}/MMBtu`} note="Fee-based portion of G&P; EIA upstream cost study" color={C.text} />
                  <Row label="NGL transport" value={`$${p.nglTransport.toFixed(2)}/gal`} note="To Marcus Hook/Mont Belvieu via Mariner East/ATEX" color={C.text} />
                  <Row label="Fractionation fee" value={`$${p.nglFracCost.toFixed(2)}/bbl`} note="Mont Belvieu/Marcus Hook standard; $2-4/bbl range" color={C.text} />

                  <div style={{fontSize:10, fontWeight:800, color:C.purple, fontFamily:"'JetBrains Mono',monospace", marginBottom:8, marginTop:16, letterSpacing:1}}>DELIVERY & PREMIUMS</div>
                  <Row label="Permian firm premium" value={`$${p.permianFirmPremium.toFixed(2)}`} note="Over Waha spot; NGI: $0.50-3.00 for 24/7 firm" color={C.text} />
                  <Row label="App. firm premium" value={`$${p.appFirmPremium.toFixed(2)}`} note="Lower — more stable supply, no flaring distress" color={C.text} />
                  <Row label="App. FT reservation" value={`$${p.ftReservation.toFixed(2)}`} note="FERC-regulated max rate; Tetco/Columbia Gas/EGT" color={C.text} />
                  <Row label="Last-mile lateral" value={`$${p.lateralCost.toFixed(2)}`} note="Short lateral + M&R station; both basins similar" color={C.text} />
                  <Row label="Model C NGL share" value={`${(p.modelCNGLShare*100).toFixed(0)}%`} note="Developer's share of net NGL margin; negotiable" color={C.text} />
                </div>
              </div>
            </Section>

            {/* ── RISK FRAMEWORK ── */}
            <Section icon="⚠" color={C.red} title="KEY RISKS BY MODEL">
              <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12}}>
                <Callout color={C.amber} title="PERMIAN MODEL A RISKS">
                  <div style={{fontSize:11, color:C.textDim, lineHeight:1.7}}>
                    <div style={{marginBottom:4}}>→ <Strong color={C.text}>Waha basis narrows sharply post-H2 2026</Strong> — your fuel cost advantage is a 24-month window, not a structural feature</div>
                    <div style={{marginBottom:4}}>→ <Strong color={C.text}>Firm premium absorbs most of the spot discount</Strong> — the -$2.78 spot price is for distressed, interruptible molecules; firm gas costs $0.50-3.00 more</div>
                    <div style={{marginBottom:4}}>→ <Strong color={C.text}>No NGL hedge</Strong> — you're purely exposed to gas price movements with no revenue diversification</div>
                    <div style={{marginBottom:4}}>→ <Strong color={C.text}>Winter Storm Fern-type events</Strong> — Waha spiked to ~$15/MMBtu in Jan 2026; force majeure provisions are critical</div>
                    <div>→ <Strong color={C.text}>Pipeline maintenance windows</Strong> — further restrict available capacity and drive acute price spikes</div>
                  </div>
                </Callout>
                <Callout color={C.cyan} title="APPALACHIAN MODEL B/C RISKS">
                  <div style={{fontSize:11, color:C.textDim, lineHeight:1.7}}>
                    <div style={{marginBottom:4}}>→ <Strong color={C.text}>Cryo plant execution (Model B)</Strong> — $150-250M capex, 18-24 month build, construction risk, permits in PA/WV/OH</div>
                    <div style={{marginBottom:4}}>→ <Strong color={C.text}>NGL price collapse</Strong> — ethane is floor'd by nat gas price but propane/butane/C5+ track crude; an oil crash hits NGL revenue</div>
                    <div style={{marginBottom:4}}>→ <Strong color={C.text}>NGL offtake risk</Strong> — ATEX contracts expire ~2027-28; Shell Monaca cracker utilization uncertain; Marcus Hook expansion timing</div>
                    <div style={{marginBottom:4}}>→ <Strong color={C.text}>Appalachian basis tightens faster than modeled</Strong> — if data center demand + LNG pull accelerate, EGS discount narrows and raw gas gets more expensive</div>
                    <div>→ <Strong color={C.text}>NEPA/permitting</Strong> — any new pipeline lateral or processing facility faces state-level environmental review</div>
                  </div>
                </Callout>
              </div>
            </Section>

            {/* ── BOTTOM LINE ── */}
            <Section icon="◉" color={C.green} title="BOTTOM LINE">
              <P><Strong color={C.text}>The deal structure that maximizes value is: take raw wet gas → process it yourself or in partnership → sell NGLs → burn the residue.</Strong> The place where that structure is most executable today is Harrison County, Ohio. The Permian can match it on methane cost in 2026 (and beats it handily at current Waha spot) but cannot match it on total economics once NGL revenue is included — and the Permian fuel cost advantage is transient while the Appalachian NGL thesis is structural.</P>
              <P>That said, the Permian isn't Model A-only forever. The off-grid / mobile processing angle (OM Technology model) is a viable path for smaller-scale BTM projects. And as GGP contracts expire over the next 5–10 years, creative deal structures with raw gas in the Permian become increasingly feasible. The question is whether you want to wait for those windows or execute now in Appalachia where the thesis is actionable today.</P>
              <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginTop:14}}>
                <div style={{background:`${C.amber}10`, border:`1px solid ${C.amber}30`, borderRadius:8, padding:12, textAlign:"center"}}>
                  <div style={{fontSize:10, fontWeight:800, color:C.amber, fontFamily:"'JetBrains Mono',monospace"}}>PERMIAN</div>
                  <div style={{fontSize:11, color:C.textDim, marginTop:4}}>Best near-term fuel cost. Model A dominant. Model B* possible at small scale via OM-style off-grid.</div>
                </div>
                <div style={{background:`${C.green}10`, border:`1px solid ${C.green}30`, borderRadius:8, padding:12, textAlign:"center"}}>
                  <div style={{fontSize:10, fontWeight:800, color:C.green, fontFamily:"'JetBrains Mono',monospace"}}>APP. WET (CADIZ)</div>
                  <div style={{fontSize:11, color:C.textDim, marginTop:4}}>Best total economics. Models B/C executable today. NGL upside structural. Most actionable.</div>
                </div>
                <div style={{background:`${C.cyan}10`, border:`1px solid ${C.cyan}30`, borderRadius:8, padding:12, textAlign:"center"}}>
                  <div style={{fontSize:10, fontWeight:800, color:C.cyan, fontFamily:"'JetBrains Mono',monospace"}}>APP. DRY (NE PA)</div>
                  <div style={{fontSize:11, color:C.textDim, marginTop:4}}>Model A only. Cheap gas, stable basis, brownfield coal sites with grid interconnection.</div>
                </div>
              </div>
            </Section>
            </>);
          })()}
        </div>
      )}
    </div>
  );
}
