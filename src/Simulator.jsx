import { useState, useMemo, useCallback, useEffect } from "react";
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Bar, BarChart, ReferenceLine } from "recharts";

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
const PERMIAN_PIPES = [
  { name:"GCX Exp.", cap:0.57, year:2026, operator:"KMI" },
  { name:"Blackcomb", cap:2.5, year:2026, operator:"WhiteWater/Targa/MPLX" },
  { name:"Hugh Brinson Ph.1", cap:1.5, year:2026, operator:"Energy Transfer" },
  { name:"Saguaro Connector", cap:2.8, year:2027, operator:"ONEOK" },
  { name:"Eiger Express", cap:3.7, year:2028, operator:"WhiteWater/ONEOK/MPLX/Enbridge" },
  { name:"DeLa Express", cap:2.0, year:2028, operator:"Moss Lake Partners" },
  { name:"Desert Southwest", cap:1.5, year:2029, operator:"Energy Transfer" },
  { name:"Tallgrass-REX", cap:2.4, year:2028, operator:"Tallgrass Energy" },
];
const APP_PIPES = [
  { name:"MVP Boost", cap:0.5, year:2027, operator:"EQT/MVP LLC" },
  { name:"Transco SSE", cap:1.6, year:2027, operator:"Williams" },
  { name:"MVP Southgate", cap:0.55, year:2028, operator:"EQT/MVP LLC" },
  { name:"Kosciusko Jct", cap:1.16, year:2028, operator:"Boardwalk Pipelines" },
  { name:"KMI MSX+SSE4", cap:3.4, year:2029, operator:"Kinder Morgan" },
  { name:"Borealis", cap:2.0, year:2030, operator:"Boardwalk Pipelines" },
];
const DEMAND_DRIVERS = [
  { name:"Data Centers (PJM)", growth:[0.3,0.6,1.0,1.5,2.0,2.5,3.0,3.5,4.0,4.5], color:"#2563eb" },
  { name:"LNG Feed Gas", growth:[0.5,1.5,2.5,3.0,3.5,4.0,4.5,5.0,5.5,6.0], color:"#b45309" },
  { name:"SE Utility (Coal Ret.)", growth:[0.2,0.5,0.8,1.2,1.5,1.8,2.0,2.2,2.4,2.6], color:"#9f1239" },
  { name:"Industrial/Residential", growth:[0.1,0.2,0.2,0.3,0.3,0.4,0.4,0.5,0.5,0.5], color:"#6b7280" },
];

// Sources database — each source gets an ID that can be referenced
const SOURCES = [
  { id:"S1", short:"EIA STEO Mar 2026", full:"U.S. Energy Information Administration, Short-Term Energy Outlook, March 2026", url:"https://www.eia.gov/outlooks/steo", tabs:["map","supply","cost"], category:"Production & Price" },
  { id:"S2", short:"EIA Today in Energy", full:"EIA Today in Energy — Permian takeaway, Appalachian production, NGL exports", url:"https://www.eia.gov/todayinenergy", tabs:["map","supply","thesis"], category:"Production & Price" },
  { id:"S3", short:"AEGIS Hedging — Permian Basis Brief", full:"AEGIS Hedging, Permian Basin Basis Brief (Jan–Mar 2026 updates)", url:"https://aegis-hedging.com/insights", tabs:["map","cost","supply"], category:"Pricing & Basis" },
  { id:"S4", short:"AEGIS Hedging — Appalachian Basis Brief", full:"AEGIS Hedging, Appalachian Basin Basis Brief (Oct 2025, Dec 2025, Jan 2026)", url:"https://aegis-hedging.com/insights", tabs:["map","cost","supply"], category:"Pricing & Basis" },
  { id:"S5", short:"East Daley Analytics", full:"East Daley Analytics, Daley Note — Permian/Appalachia pipeline, flow, and data center demand analysis", url:"https://eastdaley.com", tabs:["map","supply","thesis"], category:"Infrastructure & Flows" },
  { id:"S6", short:"RBN Energy", full:"RBN Energy, 'Don't Stop Believin' — Marcellus/Utica Gas Production and Pipeline Egress (Nov 2025)", url:"https://rbnenergy.com", tabs:["supply","thesis"], category:"Infrastructure & Flows" },
  { id:"S7", short:"NGI Forward Look", full:"Natural Gas Intelligence, Forward Look — Tetco M-2, Eastern Gas South forward prices", url:"https://naturalgasintel.com", tabs:["cost","map"], category:"Pricing & Basis" },
  { id:"S8", short:"EIA Natural Gas Weekly", full:"EIA Natural Gas Weekly Update — NGL composite price ($8.16/MMBtu, week ending Mar 1, 2026)", url:"https://www.eia.gov/naturalgas/weekly", tabs:["map","thesis"], category:"NGL Economics" },
  { id:"S9", short:"Enkon Energy Advisors", full:"Enkon Energy Advisors, 'ET Marcus Hook Expansion to Reshape Appalachian Ethane Market' (Aug 2025)", url:"https://enkonenergy.com", tabs:["thesis"], category:"NGL Economics" },
  { id:"S10", short:"FRED / St. Louis Fed", full:"FRED, Mont Belvieu Propane Spot (DPROPANEMBTX series, Feb 2026: 60.5¢/gal)", url:"https://fred.stlouisfed.org", tabs:["thesis"], category:"NGL Economics" },
  { id:"S11", short:"Energy Transfer IR", full:"Energy Transfer LP — Press releases and earnings transcripts (CloudBurst, Oracle, Fermi deals)", url:"https://ir.energytransfer.com", tabs:["map","thesis"], category:"Operator Filings" },
  { id:"S12", short:"EQT Corp. IR", full:"EQT Corporation — Q2/Q3 2025 earnings, Shippingport (800 MMcf/d) and Homer City (665 MMcf/d) gas supply agreements", url:"https://ir.eqt.com", tabs:["supply","thesis"], category:"Operator Filings" },
  { id:"S13", short:"Targa Resources IR", full:"Targa Resources Corp. — Speedway pipeline, Grand Prix capacity, Mont Belvieu fractionation expansions", url:"https://targaresources.com/investors", tabs:["map","thesis"], category:"Operator Filings" },
  { id:"S14", short:"Williams Cos. IR", full:"Williams Companies — Transco SSE FERC approval (Feb 2026), Regional Energy Access, future VA expansion", url:"https://investor.williams.com", tabs:["supply","thesis"], category:"Operator Filings" },
  { id:"S15", short:"Boardwalk Pipelines", full:"Boardwalk Pipeline Partners LP — Borealis Pipeline open season (2 Bcf/d), Kosciusko Junction FID", url:"https://boardwalkpipelines.com", tabs:["supply","thesis"], category:"Operator Filings" },
  { id:"S16", short:"KMI IR / FERC EA", full:"Kinder Morgan Inc. — MSX + SSE4 FERC Environmental Assessment (Jan 2026, 3.4 Bcf/d combined)", url:"https://www.kindermorgan.com/investor-relations", tabs:["supply"], category:"Operator Filings" },
  { id:"S17", short:"OGJ Pipeline Inventory", full:"Oil & Gas Journal — Comprehensive pipeline project inventories, Permian roundups (Jun 2025)", url:"https://www.ogj.com", tabs:["map","supply"], category:"Infrastructure & Flows" },
  { id:"S18", short:"FERC eLibrary", full:"FERC eLibrary — Interstate pipeline dockets, certificates, 549D capacity data", url:"https://www.ferc.gov", tabs:["supply","thesis"], category:"Regulatory" },
  { id:"S19", short:"SEC EDGAR", full:"SEC EDGAR — Executed gas supply agreements (EQT, Coterra, Range) as 10-K/8-K exhibits; GGP contracts", url:"https://www.sec.gov/cgi-bin/browse-edgar", tabs:["thesis"], category:"Operator Filings" },
  { id:"S20", short:"Dallas Fed Energy Survey", full:"Federal Reserve Bank of Dallas — Energy Survey, Permian oil breakevens ~$61–62/bbl", url:"https://www.dallasfed.org", tabs:["thesis"], category:"Production & Price" },
  { id:"S21", short:"Hart Energy / NGI — EQT Deals", full:"Hart Energy and NGI coverage of EQT 1.5 Bcf/d data center supply agreements (Jul 2025)", url:"https://www.hartenergy.com", tabs:["thesis","supply"], category:"Data Center Demand" },
  { id:"S22", short:"East Daley — Data Center Monitor", full:"East Daley Analytics, Data Center Demand Monitor — state-level DC tracking, PA project pipeline", url:"https://eastdaley.com", tabs:["supply","thesis"], category:"Data Center Demand" },
  { id:"S23", short:"Measured Depth (Substack)", full:"Measured Depth, 'How the growing Southeast ended up with only one pipeline' (Feb 2026)", url:"https://www.measureddepth.com", tabs:["supply","thesis"], category:"Infrastructure & Flows" },
  { id:"S24", short:"NAESB / Energy Bar Assoc.", full:"NAESB Base Contract for Sale and Purchase of Natural Gas (2006 version); Energy Bar Association law review", url:"https://www.naesb.org", tabs:["thesis"], category:"Regulatory" },
  { id:"S25", short:"Range Resources 8-K", full:"Range Resources Corp. — 2025 marketing update: 300 MMcf/d processing, 250 MMcf/d transport, 20 Mb/d NGL takeaway secured for 2026", url:"https://www.sec.gov", tabs:["thesis"], category:"Operator Filings" },
];

// ─── RESEARCH PALETTE ───
const T = {
  bg:"#faf8f5", bgCard:"#ffffff", bgAccent:"#f3f1ec", bgDark:"#1c2536",
  border:"#ddd8d0", borderLight:"#eae6df", borderDark:"#c4bfb6",
  navy:"#1c2536", navyLight:"#2d3a4f", navyMid:"#3d4f6a",
  permian:"#b45309", permianLight:"#d97706", permianBg:"#fef3e2",
  app:"#1e5f8a", appLight:"#2e7eb3", appBg:"#edf5fb",
  green:"#276749", greenLight:"#2f855a", greenBg:"#f0faf4",
  purple:"#5b3a8c", purpleLight:"#7c5cbf", purpleBg:"#f5f0fb",
  ngl:"#9f1239", nglLight:"#be185d", nglBg:"#fef1f5",
  text:"#2d2a26", textMid:"#5c5750", textLight:"#8a857d",
  white:"#ffffff", red:"#b91c1c", redBg:"#fef2f2",
};
const mono = "'IBM Plex Mono','Menlo',monospace";
const serif = "'Georgia','Cambria','Times New Roman',serif";
const sans = "'IBM Plex Sans','Helvetica Neue','Segoe UI',sans-serif";

const fmt = v => v < 0 ? `\u2013$${Math.abs(v).toFixed(2)}` : `$${v.toFixed(2)}`;

// ─── COMPONENTS ───
function Knob({ value, onChange, min, max, step, label, unit="$", color=T.app, size=52 }) {
  const pct = (value - min) / (max - min);
  const r = size/2 - 5, cx = size/2, cy = size/2;
  const angle = pct * 270 - 135;
  const rad = (angle * Math.PI) / 180;
  const ix = cx + r * 0.72 * Math.cos(rad), iy = cy + r * 0.72 * Math.sin(rad);
  const [dragging, setDragging] = useState(false);
  const handleMove = useCallback((clientX, clientY, rect) => {
    const dx = clientX - (rect.left + rect.width/2), dy = clientY - (rect.top + rect.height/2);
    let a = Math.atan2(dy, dx) * 180 / Math.PI;
    let np = (a + 135) / 270;
    if (np < 0) np += 360/270;
    np = Math.max(0, Math.min(1, np));
    onChange(Math.max(min, Math.min(max, Math.round((min + np * (max - min)) / step) * step)));
  }, [min, max, step, onChange]);
  useEffect(() => {
    if (!dragging) return;
    const el = document.getElementById(`k-${label}`);
    const rect = el?.getBoundingClientRect();
    const m = e => { e.preventDefault(); if(rect) handleMove(e.clientX, e.clientY, rect); };
    const u = () => setDragging(false);
    const tm = e => { e.preventDefault(); if(rect && e.touches[0]) handleMove(e.touches[0].clientX, e.touches[0].clientY, rect); };
    window.addEventListener("mousemove",m); window.addEventListener("mouseup",u);
    window.addEventListener("touchmove",tm,{passive:false}); window.addEventListener("touchend",u);
    return () => { window.removeEventListener("mousemove",m); window.removeEventListener("mouseup",u); window.removeEventListener("touchmove",tm); window.removeEventListener("touchend",u); };
  }, [dragging, handleMove, label]);
  const dv = unit==="%" ? `${value.toFixed(0)}%` : unit==="" ? value.toFixed(1) : (value<0?`\u2013${unit}${Math.abs(value).toFixed(2)}`:`${unit}${value.toFixed(2)}`);
  return (
    <div style={{display:"flex", flexDirection:"column", alignItems:"center", userSelect:"none"}}>
      <svg id={`k-${label}`} width={size} height={size} style={{cursor:"grab", touchAction:"none"}}
        onMouseDown={e=>{e.preventDefault();setDragging(true);const r=e.currentTarget.getBoundingClientRect();handleMove(e.clientX,e.clientY,r);}}
        onTouchStart={e=>{setDragging(true);const r=e.currentTarget.getBoundingClientRect();if(e.touches[0])handleMove(e.touches[0].clientX,e.touches[0].clientY,r);}}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={T.borderLight} strokeWidth={2.5} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={2.5}
          strokeDasharray={`${pct*2*Math.PI*r} ${2*Math.PI*r}`} strokeDashoffset={2*Math.PI*r*0.375} strokeLinecap="round" opacity={0.85} />
        <circle cx={ix} cy={iy} r={3.5} fill={color} />
        <text x={cx} y={cy+1} textAnchor="middle" dominantBaseline="middle" fill={T.text} fontSize={9} fontFamily={mono} fontWeight="600">{dv}</text>
      </svg>
      <span style={{fontSize:8, color:T.textLight, marginTop:2, textAlign:"center", lineHeight:1.1, maxWidth:size+8, fontFamily:sans}}>{label}</span>
    </div>
  );
}

function Badge({ children, color=T.app }) {
  return <span style={{fontSize:8, padding:"2px 6px", borderRadius:2, background:`${color}12`, color, border:`1px solid ${color}25`, fontWeight:600, fontFamily:mono, letterSpacing:0.3, textTransform:"uppercase"}}>{children}</span>;
}

function Metric({ label, value, sub, color=T.text }) {
  return (
    <div style={{background:T.bgCard, borderRadius:6, border:`1px solid ${T.border}`, padding:"10px 12px", textAlign:"center"}}>
      <div style={{fontSize:8, fontWeight:600, color:T.textLight, fontFamily:sans, textTransform:"uppercase", letterSpacing:0.5}}>{label}</div>
      <div style={{fontSize:17, fontWeight:700, color, fontFamily:mono, marginTop:2}}>{value}</div>
      {sub && <div style={{fontSize:8, color:T.textLight, marginTop:1}}>{sub}</div>}
    </div>
  );
}

function PipeBar({ pipe, maxCap, color }) {
  const w = (pipe.cap / maxCap) * 100;
  const yrColor = pipe.year <= 2026 ? T.green : pipe.year <= 2028 ? T.permian : T.ngl;
  return (
    <div style={{display:"flex", alignItems:"center", gap:6, marginBottom:3}}>
      <span style={{fontSize:9, color:T.textMid, width:100, textAlign:"right", flexShrink:0, fontFamily:mono}}>{pipe.name}</span>
      <div style={{flex:1, height:12, background:T.bgAccent, borderRadius:2, overflow:"hidden", position:"relative", border:`1px solid ${T.borderLight}`}}>
        <div style={{width:`${w}%`, height:"100%", background:color, opacity:0.7, borderRadius:2}} />
        <span style={{position:"absolute", right:4, top:0, lineHeight:"12px", fontSize:8, color:T.text, fontFamily:mono}}>{pipe.cap}</span>
      </div>
      <Badge color={yrColor}>{pipe.year}</Badge>
    </div>
  );
}

function TabLink({ tab, setTab, label }) {
  return <span onClick={()=>setTab(tab)} style={{color:T.app, textDecoration:"underline", cursor:"pointer", fontWeight:600}}>{label}</span>;
}

const ttStyle = {background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:4, fontSize:10, color:T.text, fontFamily:sans, boxShadow:"0 2px 8px rgba(0,0,0,0.08)"};

// ─── DEFAULT TAB CONFIG ───
const DEFAULT_TABS = [
  { key: "map", label: "Market Map" },
  { key: "supply", label: "Supply & Demand" },
  { key: "cost", label: "Delivered Cost" },
  { key: "thesis", label: "Thesis & Assumptions" },
  { key: "sources", label: "Sources" },
];

// ─── MAIN ───
export default function Simulator() {
  const [p, setP] = useState(DEFAULTS);
  const [tab, setTab] = useState("map");
  const [tabOrder, setTabOrder] = useState(DEFAULT_TABS);
  const [draggedTab, setDraggedTab] = useState(null);
  const [dragOverTab, setDragOverTab] = useState(null);
  const set = useCallback((k,v) => setP(prev=>({...prev,[k]:v})), []);

  // Drag and drop handlers
  const handleDragStart = useCallback((e, tabKey) => {
    setDraggedTab(tabKey);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', tabKey);
    // Make the drag image slightly transparent
    e.currentTarget.style.opacity = '0.5';
  }, []);

  const handleDragEnd = useCallback((e) => {
    e.currentTarget.style.opacity = '1';
    setDraggedTab(null);
    setDragOverTab(null);
  }, []);

  const handleDragOver = useCallback((e, tabKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (tabKey !== draggedTab) {
      setDragOverTab(tabKey);
    }
  }, [draggedTab]);

  const handleDragLeave = useCallback(() => {
    setDragOverTab(null);
  }, []);

  const handleDrop = useCallback((e, targetTabKey) => {
    e.preventDefault();
    if (!draggedTab || draggedTab === targetTabKey) return;

    setTabOrder(prev => {
      const newOrder = [...prev];
      const draggedIndex = newOrder.findIndex(t => t.key === draggedTab);
      const targetIndex = newOrder.findIndex(t => t.key === targetTabKey);

      if (draggedIndex === -1 || targetIndex === -1) return prev;

      // Remove dragged item and insert at new position
      const [removed] = newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, removed);

      return newOrder;
    });

    setDraggedTab(null);
    setDragOverTab(null);
  }, [draggedTab]);

  const model = useMemo(() => {
    const res = [];
    for (let i=0; i<YEARS.length; i++) {
      const year = YEARS[i], hh = p.hhBase + p.hhGrowth*i;
      let wb; if(year===2026) wb=(p.wahaBasis2026H1+p.wahaBasis2026H2)/2; else if(year===2027) wb=p.wahaBasis2027; else wb=p.wahaBasisLongTerm+Math.max(0,(p.wahaBasis2027-p.wahaBasisLongTerm)*Math.pow(0.5,i-2));
      const ab = Math.min(p.appBasis2026+p.appBasisTightenRate*i, -0.10);
      const ws = hh+wb, as2 = hh+ab;
      const pA = Math.max(ws+p.permianFirmPremium+p.lateralCost+0.03, 0.10);
      const aA = as2+p.appFirmPremium+p.ftReservation+p.lateralCost+0.03;
      const raw = as2-0.20;
      const np2 = p.nglCompositePrice*Math.pow(1+p.nglPriceGrowth,i);
      const nRev = (p.nglYieldGPM*np2)/42*(1-p.ethaneRejectionRate/100*0.3);
      const nCost = p.cryoOpex+(p.nglTransport*p.nglYieldGPM/42)+(p.nglFracCost*p.nglYieldGPM/42);
      const nNet = Math.max(nRev-nCost,0);
      const amm = p.gasVolumeMMBtuD*365*p.capacityFactor;
      const cA = (p.cryoCapex*1e6/20)/amm;
      const aB = raw-nNet+p.lateralCost+0.03+cA;
      const aC = as2-nNet*p.modelCNGLShare+p.appFirmPremium*0.5+p.lateralCost+0.03;
      const hrs = 8760*p.capacityFactor, annM = p.dcCapacityMW*p.heatRate*hrs;
      const pEgr = PERMIAN_PIPES.filter(x=>x.year<=year).reduce((s,x)=>s+x.cap,0);
      const aEgr = APP_PIPES.filter(x=>x.year<=year).reduce((s,x)=>s+x.cap,0);
      const dGr = DEMAND_DRIVERS.reduce((s,d)=>s+(d.growth[i]||0),0);
      res.push({ year, hh:+hh.toFixed(2), wahaBasis:+wb.toFixed(2), appBasis:+ab.toFixed(2), wahaSpot:+ws.toFixed(2), appSpot:+as2.toFixed(2),
        permianA:+pA.toFixed(2), appA:+aA.toFixed(2), appB:+aB.toFixed(2), appC:+aC.toFixed(2), netNGL:+nNet.toFixed(2),
        permianAnn:+(pA*annM/1e6).toFixed(1), appBAnn:+(aB*annM/1e6).toFixed(1), appCAnn:+(aC*annM/1e6).toFixed(1),
        pEgr:+pEgr.toFixed(1), aEgr:+aEgr.toFixed(1), dGr:+dGr.toFixed(1),
        dc:+(DEMAND_DRIVERS[0].growth[i]||0).toFixed(1), lng:+(DEMAND_DRIVERS[1].growth[i]||0).toFixed(1),
        se:+(DEMAND_DRIVERS[2].growth[i]||0).toFixed(1), oth:+(DEMAND_DRIVERS[3].growth[i]||0).toFixed(1),
      });
    }
    return res;
  }, [p]);

  const c = model[0];

  const tabBtn = (key, label) => {
    const isActive = tab === key;
    const isDragging = draggedTab === key;
    const isDragOver = dragOverTab === key;

    return (
      <button
        key={key}
        draggable
        onClick={() => setTab(key)}
        onDragStart={(e) => handleDragStart(e, key)}
        onDragEnd={handleDragEnd}
        onDragOver={(e) => handleDragOver(e, key)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, key)}
        style={{
          padding: "8px 14px",
          fontSize: 10,
          fontWeight: 600,
          fontFamily: sans,
          letterSpacing: 0.4,
          cursor: isDragging ? "grabbing" : "grab",
          background: isActive ? T.bgCard : "transparent",
          color: isActive ? T.navy : T.textLight,
          border: isActive ? `1px solid ${T.border}` : "1px solid transparent",
          borderBottom: isActive ? `1px solid ${T.bgCard}` : "none",
          borderRadius: isActive ? "4px 4px 0 0" : 0,
          marginBottom: isActive ? -1 : 0,
          position: "relative",
          zIndex: isActive ? 1 : 0,
          opacity: isDragging ? 0.5 : 1,
          transform: isDragOver ? "scale(1.05)" : "scale(1)",
          boxShadow: isDragOver ? `0 0 0 2px ${T.app}40` : "none",
          transition: "transform 0.15s ease, box-shadow 0.15s ease",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 8, opacity: 0.4, cursor: "grab" }}>⋮⋮</span>
          {label}
        </span>
      </button>
    );
  };

  // Shared P / Strong / Section for thesis + sources
  const P = ({children}) => <p style={{fontSize:12, lineHeight:1.75, color:T.text, marginBottom:10, fontFamily:sans}}>{children}</p>;
  const Pd = ({children}) => <p style={{fontSize:11, lineHeight:1.7, color:T.textMid, marginBottom:8, fontFamily:sans}}>{children}</p>;
  const B = ({children, color=T.text}) => <span style={{fontWeight:700, color}}>{children}</span>;
  const M = ({children, color=T.app}) => <span style={{fontFamily:mono, fontWeight:600, color, fontSize:11}}>{children}</span>;
  const Callout = ({color, bg, title, children}) => (
    <div style={{background:bg||T.bgAccent, border:`1px solid ${color}30`, borderLeft:`3px solid ${color}`, borderRadius:"0 4px 4px 0", padding:14, marginBottom:12}}>
      {title && <div style={{fontSize:10, fontWeight:700, fontFamily:sans, color, marginBottom:6, textTransform:"uppercase", letterSpacing:0.5}}>{title}</div>}
      <div style={{fontSize:11, lineHeight:1.7, color:T.text, fontFamily:sans}}>{children}</div>
    </div>
  );
  const ARow = ({label, value, note, color=T.text}) => (
    <div style={{display:"flex", borderBottom:`1px solid ${T.borderLight}`, padding:"5px 0", alignItems:"baseline", gap:8}}>
      <span style={{flex:1, fontSize:10, color:T.textMid, fontFamily:sans}}>{label}</span>
      <span style={{fontSize:11, fontFamily:mono, fontWeight:600, color, minWidth:70, textAlign:"right"}}>{value}</span>
      {note && <span style={{fontSize:9, color:T.textLight, maxWidth:200, fontFamily:sans}}>{note}</span>}
    </div>
  );

  return (
    <div style={{background:T.bg, color:T.text, minHeight:"100vh", fontFamily:sans}}>
      {/* HEADER */}
      <div style={{background:T.bgDark, padding:"14px 24px", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
        <div>
          <div style={{fontSize:15, fontWeight:700, color:T.white, fontFamily:serif, letterSpacing:0.3}}>Behind-the-Meter Gas Economics</div>
          <div style={{fontSize:10, color:"#94a3b8", fontFamily:sans}}>Permian vs. Appalachian Basin · {p.dcCapacityMW} MW Reference Case · 2026–2035</div>
        </div>
        <div style={{fontSize:9, color:"#64748b", fontFamily:mono}}>DECA · INTERNAL USE · MARCH 2026</div>
      </div>

      {/* TABS - Draggable */}
      <div style={{borderBottom:`1px solid ${T.border}`, padding:"0 24px", display:"flex", gap:2, background:T.bgAccent}}>
        {tabOrder.map(t => tabBtn(t.key, t.label))}
        <span style={{marginLeft:"auto", fontSize:8, color:T.textLight, alignSelf:"center", fontFamily:sans, opacity:0.6}}>
          drag to reorder
        </span>
      </div>

      {/* ═══════ MARKET MAP ═══════ */}
      {tab === "map" && (
        <div style={{padding:20, overflow:"auto"}}>
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16}}>
            {/* PERMIAN */}
            <div style={{background:T.bgCard, borderRadius:6, border:`1px solid ${T.border}`, padding:16}}>
              <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12}}>
                <div><div style={{fontSize:13, fontWeight:700, fontFamily:serif, color:T.permian}}>Permian Basin</div><div style={{fontSize:9, color:T.textLight}}>West Texas / New Mexico · Associated Gas</div></div>
                <Badge color={T.permian}>Model A Only</Badge>
              </div>
              <div style={{background:T.permianBg, borderRadius:4, padding:10, marginBottom:12, border:`1px solid ${T.permian}20`}}>
                <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", gap:2}}>
                  {[{l:"Wellhead",s:"29 Bcf/d"},{l:"→"},{l:"Gather/Process",s:"Targa / ET"},{l:"→"},{l:"Waha Hub",s:fmt(c.wahaSpot)},{l:"→"},{l:"DC Site",s:fmt(c.permianA)}].map((n,i) =>
                    n.l==="→" ? <span key={i} style={{color:T.permian, fontSize:12, opacity:0.4}}>›</span> :
                    <div key={i} style={{textAlign:"center", flex:1, padding:"4px 2px", borderRadius:4, background:i>=4?T.bgCard:"transparent", border:i>=4?`1px solid ${T.border}`:"none"}}>
                      <div style={{fontSize:7, fontWeight:700, color:T.permian, fontFamily:mono, textTransform:"uppercase"}}>{n.l}</div>
                      <div style={{fontSize:10, fontWeight:700, fontFamily:mono, color:T.text}}>{n.s}</div>
                    </div>
                  )}
                </div>
              </div>
              <div style={{marginBottom:12}}>
                <div style={{fontSize:9, fontWeight:700, color:T.textLight, fontFamily:sans, textTransform:"uppercase", letterSpacing:0.5, marginBottom:6}}>Cost Buildup</div>
                {[{l:"Waha Spot",v:c.wahaSpot,pct:Math.max(0,(c.wahaSpot+4)/8)},{l:"+ Firm Premium",v:p.permianFirmPremium,pct:p.permianFirmPremium/4},{l:"+ Last Mile",v:p.lateralCost+0.03,pct:(p.lateralCost+0.03)/1}].map((x,i)=>(
                  <div key={i} style={{display:"flex", alignItems:"center", gap:6, marginBottom:2}}>
                    <span style={{fontSize:9, color:T.textLight, width:80, textAlign:"right", fontFamily:mono}}>{x.l}</span>
                    <div style={{flex:1, height:8, background:T.bgAccent, borderRadius:2, overflow:"hidden"}}><div style={{width:`${Math.min(100,x.pct*100)}%`, height:"100%", background:T.permian, opacity:0.6, borderRadius:2}} /></div>
                    <span style={{fontSize:10, fontFamily:mono, fontWeight:600, color:T.text, width:50, textAlign:"right"}}>{fmt(x.v)}</span>
                  </div>
                ))}
                <div style={{textAlign:"right", marginTop:6}}><span style={{fontSize:9, color:T.textLight}}>All-in: </span><span style={{fontSize:16, fontWeight:700, fontFamily:mono, color:T.permian}}>{fmt(c.permianA)}</span><span style={{fontSize:9, color:T.textLight}}>/MMBtu</span></div>
              </div>
              <div style={{fontSize:9, fontWeight:700, color:T.textLight, fontFamily:sans, textTransform:"uppercase", letterSpacing:0.5, marginBottom:6}}>Egress Additions (Bcf/d)</div>
              {PERMIAN_PIPES.map((pipe,i) => <PipeBar key={i} pipe={pipe} maxCap={4} color={T.permian} />)}
              <div style={{textAlign:"right", marginTop:6}}><span style={{fontSize:9, color:T.textLight}}>Total: </span><M color={T.permian}>{PERMIAN_PIPES.reduce((s,x)=>s+x.cap,0).toFixed(1)} Bcf/d</M></div>
            </div>

            {/* APPALACHIAN */}
            <div style={{background:T.bgCard, borderRadius:6, border:`1px solid ${T.border}`, padding:16}}>
              <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12}}>
                <div><div style={{fontSize:13, fontWeight:700, fontFamily:serif, color:T.app}}>Appalachian Basin</div><div style={{fontSize:9, color:T.textLight}}>PA / WV / OH · Intentional Gas Production</div></div>
                <div style={{display:"flex", gap:3}}><Badge color={T.app}>A</Badge><Badge color={T.green}>B</Badge><Badge color={T.purple}>C</Badge></div>
              </div>
              <div style={{background:T.appBg, borderRadius:4, padding:10, marginBottom:8, border:`1px solid ${T.app}20`}}>
                <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", gap:2}}>
                  {[{l:"Wellhead",s:"36 Bcf/d"},{l:"→"},{l:"Gather",s:"EQT / AM"},{l:"→"},{l:"Cryo ★",s:"NGL Split"},{l:"→"},{l:"Tetco M-2",s:fmt(c.appSpot)},{l:"→"},{l:"DC Site",s:fmt(c.appB)}].map((n,i) =>
                    n.l==="→" ? <span key={i} style={{color:T.app, fontSize:12, opacity:0.4}}>›</span> :
                    <div key={i} style={{textAlign:"center", flex:1, padding:"4px 2px", borderRadius:4, background:(i===4||i>=6)?T.bgCard:"transparent", border:(i===4||i>=6)?`1px solid ${T.border}`:"none"}}>
                      <div style={{fontSize:7, fontWeight:700, color:i===4?T.green:T.app, fontFamily:mono, textTransform:"uppercase"}}>{n.l}</div>
                      <div style={{fontSize:10, fontWeight:700, fontFamily:mono, color:T.text}}>{n.s}</div>
                    </div>
                  )}
                </div>
                <div style={{marginTop:6, textAlign:"center"}}>
                  <span style={{fontSize:9, background:T.nglBg, border:`1px solid ${T.ngl}25`, borderRadius:3, padding:"2px 8px", fontFamily:mono, color:T.ngl}}>
                    NGL Credit: {fmt(c.netNGL)}/MMBtu → Utopia / ATEX / Mariner East
                  </span>
                </div>
              </div>
              <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:12}}>
                {[{l:"Model A",s:"Buy Dry Gas",v:c.appA,cl:T.app,bg:T.appBg},{l:"Model B",s:"Own Cryo",v:c.appB,cl:T.green,bg:T.greenBg},{l:"Model C",s:"Co-locate",v:c.appC,cl:T.purple,bg:T.purpleBg}].map(m=>(
                  <div key={m.l} style={{background:m.bg, borderRadius:4, padding:8, textAlign:"center", border:`1px solid ${m.cl}20`}}>
                    <div style={{fontSize:8, fontWeight:700, color:m.cl, fontFamily:mono}}>{m.l}</div>
                    <div style={{fontSize:8, color:T.textLight}}>{m.s}</div>
                    <div style={{fontSize:15, fontWeight:700, color:m.cl, fontFamily:mono}}>{fmt(m.v)}</div>
                  </div>
                ))}
              </div>
              <div style={{fontSize:9, fontWeight:700, color:T.textLight, fontFamily:sans, textTransform:"uppercase", letterSpacing:0.5, marginBottom:6}}>Egress / Expansion Projects</div>
              {APP_PIPES.map((pipe,i) => <PipeBar key={i} pipe={pipe} maxCap={4} color={T.app} />)}
              <div style={{textAlign:"right", marginTop:6}}><span style={{fontSize:9, color:T.textLight}}>Total: </span><M color={T.app}>{APP_PIPES.reduce((s,x)=>s+x.cap,0).toFixed(1)} Bcf/d</M></div>
            </div>
          </div>

          {/* KNOBS */}
          <div style={{background:T.bgCard, borderRadius:6, border:`1px solid ${T.border}`, padding:"12px 16px"}}>
            <div style={{display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:12}}>
              {[
                {title:"Permian", color:T.permian, knobs:[
                  {l:"Waha H1'26",k:"wahaBasis2026H1",min:-6,max:0,step:0.1},
                  {l:"Waha 2027+",k:"wahaBasis2027",min:-2,max:0.5,step:0.1},
                  {l:"Waha Floor",k:"wahaBasisLongTerm",min:-1,max:0.2,step:0.05},
                  {l:"Firm Prem",k:"permianFirmPremium",min:0.25,max:3,step:0.25},
                ]},
                {title:"Appalachian", color:T.app, knobs:[
                  {l:"Basis '26",k:"appBasis2026",min:-2,max:0,step:0.05},
                  {l:"Tighten/yr",k:"appBasisTightenRate",min:0,max:0.15,step:0.01},
                  {l:"FT Cost",k:"ftReservation",min:0.2,max:1,step:0.05},
                  {l:"Firm Prem",k:"appFirmPremium",min:0.1,max:1,step:0.05},
                ]},
                {title:"NGL / Cryo", color:T.green, knobs:[
                  {l:"Yield GPM",k:"nglYieldGPM",min:2,max:7,step:0.5,u:""},
                  {l:"NGL $/MMBtu",k:"nglCompositePrice",min:4,max:14,step:0.5},
                  {l:"Ethane Rej",k:"ethaneRejectionRate",min:10,max:70,step:5,u:"%"},
                  {l:"Cryo CAPEX",k:"cryoCapex",min:100,max:400,step:25},
                ]},
                {title:"Macro", color:T.textMid, knobs:[
                  {l:"HH Base",k:"hhBase",min:2,max:6,step:0.1},
                  {l:"HH Growth",k:"hhGrowth",min:-0.2,max:0.3,step:0.02},
                  {l:"Heat Rate",k:"heatRate",min:5.5,max:9,step:0.1,u:""},
                  {l:"C Split",k:"modelCNGLShare",min:0.1,max:0.7,step:0.05,u:""},
                ]},
              ].map(g => (
                <div key={g.title} style={{display:"flex", flexDirection:"column", alignItems:"center"}}>
                  <div style={{fontSize:8, fontWeight:700, color:g.color, fontFamily:sans, marginBottom:4, textTransform:"uppercase", letterSpacing:0.5}}>{g.title}</div>
                  <div style={{display:"flex", gap:10}}>
                    {g.knobs.map(k => <Knob key={k.k} label={k.l} value={p[k.k]} onChange={v=>set(k.k,v)} min={k.min} max={k.max} step={k.step} unit={k.u||"$"} color={g.color} />)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══════ SUPPLY & DEMAND ═══════ */}
      {tab === "supply" && (
        <div style={{padding:20, overflow:"auto"}}>
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16}}>
            <div style={{background:T.bgCard, borderRadius:6, border:`1px solid ${T.border}`, padding:16}}>
              <div style={{fontSize:12, fontWeight:700, fontFamily:serif, color:T.navy, marginBottom:12}}>Incremental Gas Demand Growth (Bcf/d from 2025 base)</div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={model}><CartesianGrid strokeDasharray="3 3" stroke={T.borderLight} /><XAxis dataKey="year" tick={{fontSize:9,fill:T.textLight}} stroke={T.border} /><YAxis tick={{fontSize:9,fill:T.textLight}} stroke={T.border} /><Tooltip contentStyle={ttStyle} />
                  <Area type="monotone" dataKey="oth" name="Industrial/Resi" stackId="1" fill="#9ca3af" stroke="#6b7280" fillOpacity={0.4} />
                  <Area type="monotone" dataKey="se" name="SE Utility" stackId="1" fill="#fda4af" stroke={T.ngl} fillOpacity={0.5} />
                  <Area type="monotone" dataKey="lng" name="LNG Feed Gas" stackId="1" fill="#fcd34d" stroke={T.permian} fillOpacity={0.5} />
                  <Area type="monotone" dataKey="dc" name="Data Centers" stackId="1" fill="#93c5fd" stroke={T.app} fillOpacity={0.6} />
                  <Legend wrapperStyle={{fontSize:9}} />
                </AreaChart>
              </ResponsiveContainer>
              <div style={{fontSize:9, color:T.textLight, marginTop:6}}>Sources: East Daley, RBN Energy, EIA. DC demand per EDA Data Center Demand Monitor [S5, S22].</div>
            </div>
            <div style={{background:T.bgCard, borderRadius:6, border:`1px solid ${T.border}`, padding:16}}>
              <div style={{fontSize:12, fontWeight:700, fontFamily:serif, color:T.navy, marginBottom:12}}>Cumulative New Egress Capacity (Bcf/d)</div>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={model}><CartesianGrid strokeDasharray="3 3" stroke={T.borderLight} /><XAxis dataKey="year" tick={{fontSize:9,fill:T.textLight}} stroke={T.border} /><YAxis tick={{fontSize:9,fill:T.textLight}} stroke={T.border} /><Tooltip contentStyle={ttStyle} />
                  <Bar dataKey="pEgr" name="Permian Egress" fill={T.permian} fillOpacity={0.6} radius={[3,3,0,0]} />
                  <Bar dataKey="aEgr" name="App. Egress" fill={T.app} fillOpacity={0.6} radius={[3,3,0,0]} />
                  <Line type="monotone" dataKey="dGr" name="Demand Growth" stroke={T.ngl} strokeWidth={2} dot={{r:2.5,fill:T.ngl}} />
                  <Legend wrapperStyle={{fontSize:9}} />
                </ComposedChart>
              </ResponsiveContainer>
              <div style={{fontSize:9, color:T.textLight, marginTop:6}}>Sources: Operator IR filings, OGJ, FERC dockets [S11–S18].</div>
            </div>
          </div>
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16}}>
            {[{title:"Waha Basis to Henry Hub", key:"wahaBasis", color:T.permian, bg:T.permianBg, note:"~4.5 Bcf/d new pipe in H2 2026 causes sharp narrowing. East Daley forecasts overbuild. [S3, S5]"},
              {title:"Appalachian Basis to Henry Hub", key:"appBasis", color:T.app, bg:T.appBg, note:"Limited new egress (NEPA friction) + accelerating demand = structural tightening. [S4, S6]"}
            ].map(b => (
              <div key={b.key} style={{background:T.bgCard, borderRadius:6, border:`1px solid ${T.border}`, padding:16}}>
                <div style={{fontSize:12, fontWeight:700, fontFamily:serif, color:T.navy, marginBottom:12}}>{b.title}</div>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={model}><CartesianGrid strokeDasharray="3 3" stroke={T.borderLight} /><XAxis dataKey="year" tick={{fontSize:9,fill:T.textLight}} stroke={T.border} /><YAxis tick={{fontSize:9,fill:T.textLight}} stroke={T.border} domain={['auto','auto']} /><Tooltip contentStyle={ttStyle} formatter={v=>[fmt(v)]} /><ReferenceLine y={0} stroke={T.textLight} strokeDasharray="3 3" />
                    <Area type="monotone" dataKey={b.key} fill={b.bg} stroke={b.color} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
                <div style={{display:"flex", justifyContent:"space-between", marginTop:8}}>
                  {[0,4,9].map(i=><div key={i} style={{textAlign:"center"}}><div style={{fontSize:8, color:T.textLight}}>{model[i].year}</div><div style={{fontSize:13, fontWeight:700, fontFamily:mono, color:b.color}}>{fmt(model[i][b.key])}</div></div>)}
                </div>
                <div style={{fontSize:9, color:T.textLight, marginTop:8}}>{b.note}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══════ DELIVERED COST ═══════ */}
      {tab === "cost" && (
        <div style={{padding:20, overflow:"auto"}}>
          <div style={{display:"grid", gridTemplateColumns:"repeat(6, 1fr)", gap:8, marginBottom:16}}>
            <Metric label="Permian A (2026)" value={fmt(c.permianA)} color={T.permian} />
            <Metric label="App. A (2026)" value={fmt(c.appA)} color={T.app} />
            <Metric label="App. B (2026)" value={fmt(c.appB)} color={T.green} />
            <Metric label="App. C (2026)" value={fmt(c.appC)} color={T.purple} />
            <Metric label="NGL Credit" value={fmt(c.netNGL)} color={T.ngl} />
            <Metric label="10-yr B vs Perm" value={`${Math.abs(model.reduce((s,r)=>s+(r.appBAnn-r.permianAnn),0)).toFixed(0)}M`} color={model.reduce((s,r)=>s+(r.appBAnn-r.permianAnn),0)<0?T.green:T.red} sub={model.reduce((s,r)=>s+(r.appBAnn-r.permianAnn),0)<0?"App B saves":"Perm A saves"} />
          </div>
          <div style={{background:T.bgCard, borderRadius:6, border:`1px solid ${T.border}`, padding:16, marginBottom:16}}>
            <div style={{fontSize:12, fontWeight:700, fontFamily:serif, color:T.navy, marginBottom:12}}>All-In Delivered Fuel Cost ($/MMBtu)</div>
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={model}><CartesianGrid strokeDasharray="3 3" stroke={T.borderLight} /><XAxis dataKey="year" tick={{fontSize:9,fill:T.textLight}} stroke={T.border} /><YAxis tick={{fontSize:9,fill:T.textLight}} stroke={T.border} tickFormatter={v=>`$${v}`} domain={['auto','auto']} /><Tooltip contentStyle={ttStyle} formatter={(v,n)=>[`${fmt(v)}/MMBtu`,n]} /><ReferenceLine y={0} stroke={T.textLight} strokeDasharray="3 3" />
                <Line type="monotone" dataKey="hh" name="Henry Hub" stroke={T.textLight} strokeWidth={1} strokeDasharray="4 4" dot={false} />
                <Line type="monotone" dataKey="permianA" name="Permian A" stroke={T.permian} strokeWidth={2.5} dot={{r:3,fill:T.permian,stroke:T.bgCard,strokeWidth:2}} />
                <Line type="monotone" dataKey="appA" name="App. A" stroke={T.app} strokeWidth={1.5} strokeDasharray="6 3" dot={{r:2,fill:T.app}} />
                <Line type="monotone" dataKey="appB" name="App. B (Cryo)" stroke={T.green} strokeWidth={2.5} dot={{r:3,fill:T.green,stroke:T.bgCard,strokeWidth:2}} />
                <Line type="monotone" dataKey="appC" name="App. C (Split)" stroke={T.purple} strokeWidth={2} dot={{r:2.5,fill:T.purple,stroke:T.bgCard,strokeWidth:2}} />
                <Legend wrapperStyle={{fontSize:9}} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16}}>
            <div style={{background:T.bgCard, borderRadius:6, border:`1px solid ${T.border}`, padding:16}}>
              <div style={{fontSize:12, fontWeight:700, fontFamily:serif, color:T.navy, marginBottom:12}}>Annual Fuel Cost · {p.dcCapacityMW} MW ($M/yr)</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={model}><CartesianGrid strokeDasharray="3 3" stroke={T.borderLight} /><XAxis dataKey="year" tick={{fontSize:9,fill:T.textLight}} stroke={T.border} /><YAxis tick={{fontSize:9,fill:T.textLight}} stroke={T.border} tickFormatter={v=>`$${v}M`} /><Tooltip contentStyle={ttStyle} formatter={(v,n)=>[`$${v}M/yr`,n]} />
                  <Bar dataKey="permianAnn" name="Permian A" fill={T.permian} fillOpacity={0.7} radius={[2,2,0,0]} />
                  <Bar dataKey="appBAnn" name="App. B" fill={T.green} fillOpacity={0.7} radius={[2,2,0,0]} />
                  <Bar dataKey="appCAnn" name="App. C" fill={T.purple} fillOpacity={0.7} radius={[2,2,0,0]} />
                  <Legend wrapperStyle={{fontSize:9}} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{background:T.bgCard, borderRadius:6, border:`1px solid ${T.border}`, padding:16, overflow:"auto"}}>
              <div style={{fontSize:12, fontWeight:700, fontFamily:serif, color:T.navy, marginBottom:12}}>Summary</div>
              <table style={{width:"100%", fontSize:10, borderCollapse:"collapse", fontFamily:mono}}>
                <thead><tr style={{borderBottom:`2px solid ${T.border}`}}>
                  {["Year","HH","Waha","Perm A","App","App B","App C","NGL"].map(h=><th key={h} style={{padding:"4px 5px", textAlign:"right", color:T.textLight, fontWeight:600, fontSize:8, fontFamily:sans}}>{h}</th>)}
                </tr></thead>
                <tbody>{model.map((r,i)=>(
                  <tr key={r.year} style={{borderBottom:`1px solid ${T.borderLight}`, background:i%2===0?T.bg:"transparent"}}>
                    <td style={{padding:"3px 5px", fontWeight:700, color:T.text}}>{r.year}</td>
                    <td style={{padding:"3px 5px", textAlign:"right", color:T.textLight}}>{fmt(r.hh)}</td>
                    <td style={{padding:"3px 5px", textAlign:"right", color:T.textLight}}>{fmt(r.wahaSpot)}</td>
                    <td style={{padding:"3px 5px", textAlign:"right", color:T.permian, fontWeight:700}}>{fmt(r.permianA)}</td>
                    <td style={{padding:"3px 5px", textAlign:"right", color:T.textLight}}>{fmt(r.appSpot)}</td>
                    <td style={{padding:"3px 5px", textAlign:"right", color:T.green, fontWeight:700}}>{fmt(r.appB)}</td>
                    <td style={{padding:"3px 5px", textAlign:"right", color:T.purple}}>{fmt(r.appC)}</td>
                    <td style={{padding:"3px 5px", textAlign:"right", color:T.ngl}}>{fmt(r.netNGL)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ THESIS & ASSUMPTIONS ═══════ */}
      {tab === "thesis" && (
        <div style={{padding:20, overflow:"auto", maxWidth:1050, margin:"0 auto"}}>
          {/* THE CORE QUESTION */}
          <div style={{background:T.bgCard, borderRadius:6, border:`1px solid ${T.border}`, padding:20, marginBottom:16}}>
            <div style={{fontSize:14, fontWeight:700, fontFamily:serif, color:T.navy, marginBottom:14}}>The Fundamental Question</div>
            <P>A data center developer buying gas for BTM power generation optimizes two variables simultaneously: <B color={T.permian}>methane cost</B> (what you pay per MMBtu for fuel — lower is better) and <B color={T.ngl}>NGL margin</B> (revenue from selling ethane, propane, butane, and C5+ after cryogenic processing, minus cost of processing and transport — higher is better). These exist in tension: the cheapest methane markets are cheap precisely because the gas has already been processed and the NGLs stripped by the incumbent midstream operator.</P>
            <P>The fundamental commercial question is: <B>at what point in the supply chain do you take possession of the gas?</B> That decision determines which deal model applies.</P>
          </div>

          {/* THREE MODELS */}
          <div style={{background:T.bgCard, borderRadius:6, border:`1px solid ${T.border}`, padding:20, marginBottom:16}}>
            <div style={{fontSize:14, fontWeight:700, fontFamily:serif, color:T.navy, marginBottom:14}}>Three Deal Models</div>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:16}}>
              {[
                {l:"Model A",s:"Buy Residue Gas",cl:T.permian,bg:T.permianBg, desc:"Buy dry, pipeline-quality methane at a hub index. Zero NGL upside — the processor already captured it.", details:["Possession: Post-processing hub","Capex: Lateral + M&R only","NGL revenue: $0",`Precedent: ET/CloudBurst, ET/Oracle`,"Works in: Permian ✓  App ✓  Haynesville ✓"]},
                {l:"Model B",s:"Own Cryo Plant",cl:T.green,bg:T.greenBg, desc:"Take raw wellhead gas, build/control your own cryo, extract and sell NGLs, burn the residue. Capture both streams.", details:["Possession: Wellhead / field receipt","Capex: ~$150–250M (200 MMcf/d cryo)",`NGL revenue: ${fmt(c.netNGL)}/MMBtu net`,"Precedent: Cadiz/Harrison Co. thesis","Best in: App wet gas ✓✓  Permian ◐"]},
                {l:"Model C",s:"Co-locate / Split",cl:T.purple,bg:T.purpleBg, desc:"Partner with an existing processor. They process, you take residue for power, negotiate a share of NGL margin.", details:["Possession: Processing plant tailgate","Capex: Lateral + M&R (no cryo)",`NGL share: ${(p.modelCNGLShare*100).toFixed(0)}% of net margin`,"Precedent: MPLX / Antero JV structures","Best in: App wet gas ✓✓  Permian ✗"]},
              ].map(m => (
                <div key={m.l} style={{background:m.bg, borderRadius:4, border:`1px solid ${m.cl}20`, padding:14}}>
                  <div style={{display:"flex", justifyContent:"space-between", marginBottom:6}}><span style={{fontSize:12, fontWeight:700, fontFamily:serif, color:m.cl}}>{m.l}</span><Badge color={m.cl}>{m.s}</Badge></div>
                  <Pd>{m.desc}</Pd>
                  {m.details.map((d,i)=><div key={i} style={{fontSize:10, color:T.textMid, lineHeight:1.5, fontFamily:sans}}>{d}</div>)}
                </div>
              ))}
            </div>
          </div>

          {/* WHY APPALACHIA */}
          <div style={{background:T.bgCard, borderRadius:6, border:`1px solid ${T.border}`, padding:20, marginBottom:16}}>
            <div style={{fontSize:14, fontWeight:700, fontFamily:serif, color:T.app, marginBottom:14}}>Why Appalachia Supports All Three Models</div>
            <Callout color={T.app} bg={T.appBg} title="1 — Less Consolidated Midstream">
              In the Permian, virtually every producing acre is dedicated to a major midstream operator under long-term GGP agreements with acreage covenants that run with the land. In Appalachia, the wet gas window in eastern Ohio / Harrison County is less locked up. The Antero/HG Energy restructuring ($5B+ in transactions, Dec 2025) reshuffled midstream dedications. Infinity Natural Resources and smaller operators are growing Utica production without legacy GGP encumbrances. [<TabLink tab="sources" setTab={setTab} label="S19, S21" />]
            </Callout>
            <Callout color={T.green} bg={T.greenBg} title="2 — 48% Ethane Rejection = Stranded Value">
              Nearly half of available ethane in Appalachia is currently being rejected into the gas stream because extraction isn't economic at current netbacks. A co-located cryo + DC operation changes the calculus by unlocking volume that isn't being extracted at all. [<TabLink tab="sources" setTab={setTab} label="S9, S5" />]
            </Callout>
            <Callout color={T.ngl} bg={T.nglBg} title="3 — NGL Offtake Infrastructure In-Basin">
              Harrison County sits on or adjacent to: Utopia Pipeline (KMI, 75 Mb/d), ATEX Express (Enterprise, ~190 Mb/d), Mariner East 2/2X (ET/Sunoco, ~275–375 Mb/d), and Falcon Pipeline (MPLX, ~100 Mb/d to Shell Monaca). You connect to existing NGL pipe, not build it. [<TabLink tab="sources" setTab={setTab} label="S9, S13" />]
            </Callout>
            <Callout color={T.purple} bg={T.purpleBg} title="4 — Producers Actively Exploring Alternative Structures">
              EQT signed 1.5 Bcf/d of direct DC supply deals in July 2025. Coterra has 330 MMcf/d of power netback deals in the Marcellus. Range Resources secured new processing + NGL takeaway for 2026. These producers seek creative marketing structures diverging from the traditional midstream model. [<TabLink tab="sources" setTab={setTab} label="S12, S21, S25" />]
            </Callout>
          </div>

          {/* WHY PERMIAN IS DIFFERENT */}
          <div style={{background:T.bgCard, borderRadius:6, border:`1px solid ${T.border}`, padding:20, marginBottom:16}}>
            <div style={{fontSize:14, fontWeight:700, fontFamily:serif, color:T.permian, marginBottom:14}}>Permian: Why Model A Dominates — and Where It Doesn't</div>
            <Callout color={T.red} bg={T.redBg} title="Why Model B/C Is Hard in the Permian">
              <Pd><B>Acreage dedications are near-universal.</B> Virtually every producing acre in the Midland and Delaware basins is locked into a long-term GGP with Targa, ET, ONEOK, Enterprise, or Kinetik. These are covenants running with the land. You cannot offer to process a producer's gas — it's already committed. [<TabLink tab="sources" setTab={setTab} label="S11, S13, S19" />]</Pd>
              <Pd><B>The midstream operators would view you as a competitor.</B> These are $50–100B+ companies with massive scale economies. A DC developer building an independent cryo plant takes molecules out of their system. They have no incentive to cooperate and contractual rights to block you.</Pd>
              <Pd><B>Associated gas doesn't optimize for marketing creativity.</B> Permian producers drill for oil and get gas whether they want it or not. Gas marketing is secondary to oil economics. They need reliable takeaway, not alternative buyers. [<TabLink tab="sources" setTab={setTab} label="S20" />]</Pd>
              <Pd><B>NGL infrastructure is overbuilt.</B> East Daley estimates ~2.27 MMb/d of spare NGL pipe capacity out of the Permian. There is no structural NGL bottleneck to exploit — unlike Appalachia's 48% ethane rejection. [<TabLink tab="sources" setTab={setTab} label="S5, S13" />]</Pd>
            </Callout>
            <Callout color={T.permian} bg={T.permianBg} title="Exception 1: Off-Grid Wellpad Gas (The OM Technology Model)">
              Take raw associated gas from small producers without GGP contracts, or from wellpads too remote for the midstream. Process with mobile/modular cryogenic equipment. This is the OM Technology model. <B>The challenge is scale:</B> wellpad supply fluctuates 20–40% month-to-month; aggregating to 150,000 MMBtu/d for 1 GW requires dozens of pads and starts to resemble building your own midstream company. Works at 5–50 MW, faces scaling challenges at DC scale. [<TabLink tab="sources" setTab={setTab} label="S20" />]
            </Callout>
            <Callout color={T.permian} bg={T.permianBg} title="Exception 2: GGP Contract Expirations">
              GGP contracts have 10–20 year terms with rolling renewals. As contracts expire, producers have a window to renegotiate. A DC developer identifying a producer with an expiring GGP in a favorable location could negotiate a raw gas deal before re-up with the incumbent. Requires deep commercial intelligence on expiration schedules — sometimes inferrable from SEC 10-K risk factors. [<TabLink tab="sources" setTab={setTab} label="S19" />]
            </Callout>
            <Callout color={T.permian} bg={T.permianBg} title="Exception 3: Midstream Partnership (Model C Variant)">
              Rather than competing with Targa/ET, partner with them. A 1 GW+ DC project represents 150,000+ MMBtu/d of firm demand — a meaningful anchor for a processing plant. Pitch: "We'll take 100% of your residue from Plant X under 15-year take-or-pay; in exchange, price at Waha minus $0.50 reflecting the NGL margin." This is Model A with NGL-informed negotiation. <B>Barrier:</B> incumbent processors have fully contracted output and strong netbacks today — you need a moment of overcapacity or offer an unusually long/firm commitment.
            </Callout>
          </div>

          {/* ASSUMPTIONS */}
          <div style={{background:T.bgCard, borderRadius:6, border:`1px solid ${T.border}`, padding:20, marginBottom:16}}>
            <div style={{fontSize:14, fontWeight:700, fontFamily:serif, color:T.navy, marginBottom:14}}>Model Assumptions</div>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:20}}>
              <div>
                <div style={{fontSize:10, fontWeight:700, color:T.permian, fontFamily:sans, marginBottom:8, textTransform:"uppercase", letterSpacing:0.5}}>Gas Market</div>
                <ARow label="Henry Hub base (2026)" value={`$${p.hhBase.toFixed(2)}`} note="EIA STEO Mar 2026 [S1]" />
                <ARow label="HH annual growth" value={`$${p.hhGrowth.toFixed(2)}/yr`} note="EIA outlook [S1]" />
                <ARow label="Waha basis H1 2026" value={fmt(p.wahaBasis2026H1)} note="AEGIS Mar 2026 [S3]" />
                <ARow label="Waha basis 2027+" value={fmt(p.wahaBasis2027)} note="East Daley [S5]" />
                <ARow label="App. basis (2026)" value={fmt(p.appBasis2026)} note="AEGIS Dec 2025 [S4]" />
                <ARow label="App. basis tightening" value={`$${p.appBasisTightenRate.toFixed(2)}/yr`} note="EQT CFO [S12]" />
                <div style={{fontSize:10, fontWeight:700, color:T.textMid, marginBottom:8, marginTop:16, textTransform:"uppercase", letterSpacing:0.5}}>Data Center</div>
                <ARow label="Capacity" value={`${p.dcCapacityMW} MW`} note="Reference case" />
                <ARow label="Heat rate" value={`${p.heatRate}`} note="GE 7HA.02 class CCGT" />
                <ARow label="Capacity factor" value={`${(p.capacityFactor*100).toFixed(0)}%`} note="Baseload AI/HPC" />
              </div>
              <div>
                <div style={{fontSize:10, fontWeight:700, color:T.green, fontFamily:sans, marginBottom:8, textTransform:"uppercase", letterSpacing:0.5}}>NGL & Processing</div>
                <ARow label="NGL yield" value={`${p.nglYieldGPM.toFixed(1)} GPM`} note="App wet gas [S8]" />
                <ARow label="NGL composite" value={`$${p.nglCompositePrice.toFixed(2)}`} note="EIA weekly [S8]" />
                <ARow label="Ethane rejection" value={`${p.ethaneRejectionRate}%`} note="Enkon/East Daley [S9, S5]" />
                <ARow label="Cryo CAPEX" value={`$${p.cryoCapex}M`} note="200 MMcf/d plant" />
                <ARow label="Processing OPEX" value={fmt(p.cryoOpex)} note="EIA upstream study" />
                <ARow label="Frac fee" value={`$${p.nglFracCost.toFixed(2)}/bbl`} note="Mont Belvieu std" />
                <div style={{fontSize:10, fontWeight:700, color:T.purple, marginBottom:8, marginTop:16, textTransform:"uppercase", letterSpacing:0.5}}>Delivery & Premiums</div>
                <ARow label="Permian firm premium" value={fmt(p.permianFirmPremium)} note="NGI [S7]" />
                <ARow label="App. firm premium" value={fmt(p.appFirmPremium)} note="Lower — stable supply" />
                <ARow label="App. FT reservation" value={fmt(p.ftReservation)} note="FERC max rate [S18]" />
                <ARow label="Model C NGL share" value={`${(p.modelCNGLShare*100).toFixed(0)}%`} note="Negotiable" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ SOURCES ═══════ */}
      {tab === "sources" && (
        <div style={{padding:20, overflow:"auto", maxWidth:1050, margin:"0 auto"}}>
          <div style={{background:T.bgCard, borderRadius:6, border:`1px solid ${T.border}`, padding:20, marginBottom:16}}>
            <div style={{fontSize:14, fontWeight:700, fontFamily:serif, color:T.navy, marginBottom:4}}>Sources & References</div>
            <Pd>All data in this model is sourced from publicly available, free-access or limited-free-access resources. Source IDs (e.g., S1) are referenced throughout the Thesis & Assumptions tab and chart annotations. Click tab names below to navigate.</Pd>
          </div>

          {/* Group by category */}
          {["Production & Price","Pricing & Basis","Infrastructure & Flows","NGL Economics","Operator Filings","Data Center Demand","Regulatory"].map(cat => {
            const items = SOURCES.filter(s => s.category === cat);
            if (!items.length) return null;
            return (
              <div key={cat} style={{background:T.bgCard, borderRadius:6, border:`1px solid ${T.border}`, padding:20, marginBottom:12}}>
                <div style={{fontSize:12, fontWeight:700, fontFamily:serif, color:T.navy, marginBottom:12, borderBottom:`1px solid ${T.borderLight}`, paddingBottom:8}}>{cat}</div>
                {items.map(src => (
                  <div key={src.id} style={{display:"flex", gap:12, padding:"8px 0", borderBottom:`1px solid ${T.borderLight}`, alignItems:"flex-start"}}>
                    <div style={{minWidth:32}}><span style={{fontSize:10, fontWeight:700, fontFamily:mono, color:T.app, background:T.appBg, padding:"2px 4px", borderRadius:2}}>{src.id}</span></div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:11, fontWeight:600, color:T.text, fontFamily:sans, marginBottom:2}}>{src.full}</div>
                      <a href={src.url} target="_blank" rel="noopener noreferrer" style={{fontSize:10, color:T.app, fontFamily:mono, wordBreak:"break-all", textDecoration:"none", display:"block"}} onMouseOver={e=>e.target.style.textDecoration="underline"} onMouseOut={e=>e.target.style.textDecoration="none"}>{src.url}</a>
                    </div>
                    <div style={{display:"flex", gap:3, flexShrink:0, flexWrap:"wrap", maxWidth:200}}>
                      {src.tabs.map(t => (
                        <span key={t} onClick={()=>setTab(t)} style={{fontSize:8, padding:"1px 5px", borderRadius:2, background:T.bgAccent, border:`1px solid ${T.border}`, color:T.textMid, cursor:"pointer", fontFamily:sans, fontWeight:600}}>
                          {t === "map" ? "Market Map" : t === "supply" ? "Supply/Demand" : t === "cost" ? "Delivered Cost" : "Thesis"}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}

          <div style={{background:T.bgAccent, borderRadius:6, border:`1px solid ${T.border}`, padding:16, marginTop:8}}>
            <div style={{fontSize:10, color:T.textLight, fontFamily:sans, lineHeight:1.6}}>
              <B color={T.textMid}>Note on data currency:</B> All pricing data reflects the most recent publicly available figures as of March 2026. Forward curves and basis strips are indicative and subject to daily market movement. Pipeline in-service dates reflect operator guidance as of the most recent public announcement and are subject to construction, regulatory, and permitting risk. NGL composite pricing reflects the EIA weekly assessment for the week ending March 1, 2026.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
