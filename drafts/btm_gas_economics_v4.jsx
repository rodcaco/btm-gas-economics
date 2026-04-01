import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Bar, BarChart, ReferenceLine, AreaChart, Area } from "recharts";

/*
 * BTM Gas Economics — Permian vs. Appalachian
 * Internal working model · Deca · March 2026
 *
 * Aesthetic: LaTeX / Computer Modern — pure white, thin rules,
 * justified text, numbered sections, booktabs tables, no decoration.
 */

const YEARS = [2026,2027,2028,2029,2030,2031,2032,2033,2034,2035];
const D = {
  hhBase:3.80, hhGrowth:0.08, wahaBasis2026H1:-3.50, wahaBasis2026H2:-1.20,
  wahaBasis2027:-0.50, wahaBasisLongTerm:-0.30, appBasis2026:-0.85, appBasisTightenRate:0.06,
  nglYieldGPM:4.0, nglCompositePrice:8.16, nglPriceGrowth:0.02, ethaneRejectionRate:48,
  cryoCapex:200, cryoOpex:0.35, nglTransport:0.25, nglFracCost:3.00,
  dcCapacityMW:1000, heatRate:6.8, capacityFactor:0.92, gasVolumeMMBtuD:150000,
  permianFirmPremium:1.25, appFirmPremium:0.35, ftReservation:0.55, lateralCost:0.15,
  modelCNGLShare:0.40,
};
const P_PIPES = [
  {n:"Gulf Coast Express Exp.",c:0.57,y:2026,o:"Kinder Morgan"},
  {n:"Blackcomb Pipeline",c:2.5,y:2026,o:"WhiteWater / Targa / MPLX"},
  {n:"Hugh Brinson Pipeline Ph. 1",c:1.5,y:2026,o:"Energy Transfer"},
  {n:"Saguaro Connector",c:2.8,y:2027,o:"ONEOK"},
  {n:"Eiger Express",c:3.7,y:2028,o:"WhiteWater / ONEOK / MPLX / Enbridge"},
  {n:"DeLa Express",c:2.0,y:2028,o:"Moss Lake Partners"},
  {n:"Desert Southwest",c:1.5,y:2029,o:"Energy Transfer"},
  {n:"Tallgrass Permian\u2013REX",c:2.4,y:2028,o:"Tallgrass Energy"},
];
const A_PIPES = [
  {n:"MVP Boost (compression)",c:0.5,y:2027,o:"EQT / MVP LLC"},
  {n:"Transco SSE",c:1.6,y:2027,o:"Williams"},
  {n:"MVP Southgate Extension",c:0.55,y:2028,o:"EQT / MVP LLC"},
  {n:"Kosciusko Junction",c:1.16,y:2028,o:"Boardwalk Pipelines"},
  {n:"KMI MSX + SSE4",c:3.4,y:2029,o:"Kinder Morgan"},
  {n:"Borealis Pipeline",c:2.0,y:2030,o:"Boardwalk Pipelines"},
];
const DEMAND = [
  {name:"Data Centers (PJM)",g:[.3,.6,1,1.5,2,2.5,3,3.5,4,4.5]},
  {name:"LNG Feed Gas",g:[.5,1.5,2.5,3,3.5,4,4.5,5,5.5,6]},
  {name:"SE Utility / Coal Ret.",g:[.2,.5,.8,1.2,1.5,1.8,2,2.2,2.4,2.6]},
  {name:"Industrial / Residential",g:[.1,.2,.2,.3,.3,.4,.4,.5,.5,.5]},
];
const SOURCES = [
  {id:1,s:"EIA STEO",f:"U.S. Energy Information Administration, Short-Term Energy Outlook, March 2026.",u:"eia.gov/outlooks/steo",t:["map","sd","cost"],c:"Price"},
  {id:2,s:"EIA Today in Energy",f:"EIA Today in Energy \u2014 Permian takeaway, Appalachian production trends, NGL export records.",u:"eia.gov/todayinenergy",t:["map","sd","th"],c:"Price"},
  {id:3,s:"AEGIS Hedging \u2014 Permian",f:"AEGIS Hedging, Permian Basin Basis Brief, Jan\u2013Mar 2026 updates.",u:"aegis-hedging.com/insights",t:["map","cost","sd"],c:"Basis"},
  {id:4,s:"AEGIS Hedging \u2014 Appalachia",f:"AEGIS Hedging, Appalachian Basin Basis Brief, Oct 2025, Dec 2025, Jan 2026.",u:"aegis-hedging.com/insights",t:["map","cost","sd"],c:"Basis"},
  {id:5,s:"East Daley Analytics",f:"East Daley Analytics, Daley Note \u2014 pipeline, flow, rig count, data center demand analysis.",u:"eastdaley.com",t:["map","sd","th"],c:"Infra"},
  {id:6,s:"RBN Energy",f:"RBN Energy, \u2018Don\u2019t Stop Believin\u2019\u2019 \u2014 Marcellus/Utica production and pipeline egress, Nov 2025.",u:"rbnenergy.com",t:["sd","th"],c:"Infra"},
  {id:7,s:"NGI Forward Look",f:"Natural Gas Intelligence, Forward Look \u2014 Tetco M-2 and Eastern Gas South forward fixed prices.",u:"naturalgasintel.com",t:["cost","map"],c:"Basis"},
  {id:8,s:"EIA Natural Gas Weekly",f:"EIA Natural Gas Weekly Update \u2014 NGL composite price ($8.16/MMBtu, week ending Mar 1, 2026).",u:"eia.gov/naturalgas/weekly",t:["map","th"],c:"NGL"},
  {id:9,s:"Enkon Energy Advisors",f:"Enkon, \u2018ET Marcus Hook Expansion to Reshape Appalachian Ethane Market,\u2019 Aug 2025.",u:"enkonenergy.com",t:["th"],c:"NGL"},
  {id:10,s:"FRED / St. Louis Fed",f:"FRED, Mont Belvieu Propane Spot Price (DPROPANEMBTX), Feb 2026: 60.5\u00a2/gal.",u:"fred.stlouisfed.org",t:["th"],c:"NGL"},
  {id:11,s:"Energy Transfer IR",f:"Energy Transfer LP \u2014 press releases and earnings: CloudBurst, Oracle, Fermi gas supply agreements.",u:"ir.energytransfer.com",t:["map","th"],c:"Operator"},
  {id:12,s:"EQT Corp. IR",f:"EQT Corp. \u2014 Q2/Q3 2025 earnings; Shippingport (800 MMcf/d) and Homer City (665 MMcf/d) supply deals.",u:"ir.eqt.com",t:["sd","th"],c:"Operator"},
  {id:13,s:"Targa Resources IR",f:"Targa Resources \u2014 Speedway, Grand Prix capacity, Mont Belvieu fractionation expansions.",u:"targaresources.com/investors",t:["map","th"],c:"Operator"},
  {id:14,s:"Williams Cos. IR",f:"Williams \u2014 Transco SSE FERC approval (Feb 2026), Regional Energy Access, future VA expansion.",u:"investor.williams.com",t:["sd","th"],c:"Operator"},
  {id:15,s:"Boardwalk Pipelines",f:"Boardwalk Pipeline Partners \u2014 Borealis open season (2 Bcf/d), Kosciusko Junction FID.",u:"boardwalkpipelines.com",t:["sd","th"],c:"Operator"},
  {id:16,s:"Kinder Morgan IR",f:"KMI \u2014 MSX + SSE4 FERC Environmental Assessment, Jan 2026 (3.4 Bcf/d combined).",u:"kindermorgan.com",t:["sd"],c:"Operator"},
  {id:17,s:"Oil & Gas Journal",f:"OGJ \u2014 pipeline project inventories, Permian roundups, Jun 2025.",u:"ogj.com",t:["map","sd"],c:"Infra"},
  {id:18,s:"FERC eLibrary",f:"FERC \u2014 interstate pipeline dockets, certificates, capacity filings.",u:"ferc.gov",t:["sd","th"],c:"Regulatory"},
  {id:19,s:"SEC EDGAR",f:"SEC EDGAR \u2014 executed gas supply agreements and GGP contracts as 10-K/8-K exhibits.",u:"sec.gov/cgi-bin/browse-edgar",t:["th"],c:"Operator"},
  {id:20,s:"Dallas Fed Energy Survey",f:"Federal Reserve Bank of Dallas \u2014 Energy Survey: Permian oil breakevens ~$61\u201362/bbl.",u:"dallasfed.org",t:["th"],c:"Price"},
  {id:21,s:"Hart Energy / NGI",f:"Hart Energy and NGI coverage of EQT 1.5 Bcf/d data center supply agreements, Jul 2025.",u:"hartenergy.com",t:["th","sd"],c:"DC"},
  {id:22,s:"East Daley DC Monitor",f:"East Daley, Data Center Demand Monitor \u2014 state-level project tracking.",u:"eastdaley.com",t:["sd","th"],c:"DC"},
  {id:23,s:"Measured Depth",f:"Measured Depth (Substack), \u2018How the growing Southeast ended up with only one pipeline,\u2019 Feb 2026.",u:"measureddepth.com",t:["sd","th"],c:"Infra"},
  {id:24,s:"NAESB / Energy Bar Assoc.",f:"NAESB Base Contract (2006); Energy Bar Association analysis of long-term suitability.",u:"naesb.org",t:["th"],c:"Regulatory"},
  {id:25,s:"Range Resources 8-K",f:"Range Resources \u2014 300 MMcf/d processing, 250 MMcf/d transport, 20 Mb/d NGL takeaway secured for 2026.",u:"sec.gov",t:["th"],c:"Operator"},
];

const $ = v => v < 0 ? `\u2013$${Math.abs(v).toFixed(2)}` : `$${v.toFixed(2)}`;

// Rotary knob with drag — muted academic palette
function Knob({ value, onChange, min, max, step, label, unit="$", color="#555", size=54 }) {
  const pct = (value - min) / (max - min);
  const r = size/2 - 5, cx = size/2, cy = size/2;
  const startAngle = -135, sweep = 270;
  const angle = startAngle + pct * sweep;
  const rad = (angle * Math.PI) / 180;
  const ix = cx + r * 0.68 * Math.cos(rad), iy = cy + r * 0.68 * Math.sin(rad);
  // Arc path for the track and fill
  const arcPath = (startDeg, endDeg, radius) => {
    const s = (startDeg * Math.PI) / 180, e = (endDeg * Math.PI) / 180;
    const x1 = cx + radius * Math.cos(s), y1 = cy + radius * Math.sin(s);
    const x2 = cx + radius * Math.cos(e), y2 = cy + radius * Math.sin(e);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`;
  };
  const [dragging, setDragging] = useState(false);
  const handleMove = useCallback((clientX, clientY, rect) => {
    const dx = clientX - (rect.left + rect.width / 2), dy = clientY - (rect.top + rect.height / 2);
    let a = Math.atan2(dy, dx) * 180 / Math.PI;
    let np = (a - startAngle) / sweep;
    if (np < -0.1) np += 360 / sweep;
    np = Math.max(0, Math.min(1, np));
    const snapped = Math.round((min + np * (max - min)) / step) * step;
    onChange(Math.max(min, Math.min(max, +snapped.toFixed(6))));
  }, [min, max, step, onChange]);
  useEffect(() => {
    if (!dragging) return;
    const el = document.getElementById(`knob-${label}`);
    const rect = el?.getBoundingClientRect();
    const m = e => { e.preventDefault(); if (rect) handleMove(e.clientX, e.clientY, rect); };
    const u = () => setDragging(false);
    const tm = e => { e.preventDefault(); if (rect && e.touches[0]) handleMove(e.touches[0].clientX, e.touches[0].clientY, rect); };
    window.addEventListener("mousemove", m); window.addEventListener("mouseup", u);
    window.addEventListener("touchmove", tm, { passive: false }); window.addEventListener("touchend", u);
    return () => { window.removeEventListener("mousemove", m); window.removeEventListener("mouseup", u); window.removeEventListener("touchmove", tm); window.removeEventListener("touchend", u); };
  }, [dragging, handleMove, label]);
  const dec = step < 0.1 ? 2 : step < 1 ? 2 : 0;
  const dv = unit === "%" ? `${value.toFixed(0)}%` : unit === "" ? value.toFixed(dec) : (value < 0 ? `\u2013$${Math.abs(value).toFixed(dec)}` : `$${value.toFixed(dec)}`);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", userSelect: "none", gap: 1 }}>
      <svg id={`knob-${label}`} width={size} height={size} style={{ cursor: "grab", touchAction: "none" }}
        onMouseDown={e => { e.preventDefault(); setDragging(true); const r = e.currentTarget.getBoundingClientRect(); handleMove(e.clientX, e.clientY, r); }}
        onTouchStart={e => { setDragging(true); const r = e.currentTarget.getBoundingClientRect(); if (e.touches[0]) handleMove(e.touches[0].clientX, e.touches[0].clientY, r); }}>
        {/* Track */}
        <path d={arcPath(startAngle, startAngle + sweep, r)} fill="none" stroke="#e5e5e5" strokeWidth={2.5} strokeLinecap="round" />
        {/* Fill */}
        {pct > 0.005 && <path d={arcPath(startAngle, startAngle + Math.max(1, pct * sweep), r)} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" opacity={0.75} />}
        {/* Indicator dot */}
        <circle cx={ix} cy={iy} r={3} fill={color} />
        {/* Value */}
        <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fill="#222" fontSize={9} fontFamily="'Latin Modern Mono', monospace" fontWeight="600">{dv}</text>
      </svg>
      <span style={{ fontSize: 8, color: "#888", textAlign: "center", lineHeight: 1.15, maxWidth: size + 6, fontFamily: "'Latin Modern Roman', serif" }}>{label}</span>
    </div>
  );
}

// Inline number editor kept for non-map tabs
function Num({value, onChange, min, max, step, suffix=""}) {
  const dec = step < 0.1 ? 2 : step < 1 ? 2 : 0;
  return (
    <span style={{display:"inline-flex", alignItems:"center", gap:1}}>
      <button onClick={()=>onChange(Math.max(min, +(value-step).toFixed(4)))} style={{border:"none", background:"none", cursor:"pointer", fontSize:10, color:"#999", padding:"0 2px", lineHeight:1}}>\u25C0</button>
      <span style={{fontVariantNumeric:"tabular-nums", minWidth:40, textAlign:"center", fontWeight:600}}>{value < 0 ? `\u2013${Math.abs(value).toFixed(dec)}` : value.toFixed(dec)}{suffix}</span>
      <button onClick={()=>onChange(Math.min(max, +(value+step).toFixed(4)))} style={{border:"none", background:"none", cursor:"pointer", fontSize:10, color:"#999", padding:"0 2px", lineHeight:1}}>\u25B6</button>
    </span>
  );
}

function Ref({id, setTab}) {
  return <sup onClick={()=>setTab("src")} style={{cursor:"pointer", color:"#2563eb", fontSize:"0.75em", fontWeight:400}}>[{id}]</sup>;
}

export default function App() {
  const [p, setP] = useState(D);
  const [tab, setTab] = useState("map");
  const s = useCallback((k,v) => setP(x=>({...x,[k]:v})), []);
  const [tabOrder, setTabOrder] = useState([{k:"map",l:"Market Map"},{k:"sd",l:"Supply \u0026 Demand"},{k:"cost",l:"Delivered Cost"},{k:"th",l:"Thesis"},{k:"src",l:"Sources"}]);
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const tabRefs = useRef([]);

  const model = useMemo(() => {
    const r = [];
    for (let i=0;i<YEARS.length;i++) {
      const y=YEARS[i], hh=p.hhBase+p.hhGrowth*i;
      let wb; if(y===2026) wb=(p.wahaBasis2026H1+p.wahaBasis2026H2)/2; else if(y===2027) wb=p.wahaBasis2027; else wb=p.wahaBasisLongTerm+Math.max(0,(p.wahaBasis2027-p.wahaBasisLongTerm)*Math.pow(0.5,i-2));
      const ab=Math.min(p.appBasis2026+p.appBasisTightenRate*i,-0.10), ws=hh+wb, as_=hh+ab;
      const pA=Math.max(ws+p.permianFirmPremium+p.lateralCost+0.03,0.10);
      const aA=as_+p.appFirmPremium+p.ftReservation+p.lateralCost+0.03;
      const raw=as_-0.20, np=p.nglCompositePrice*Math.pow(1+p.nglPriceGrowth,i);
      const nR=(p.nglYieldGPM*np)/42*(1-p.ethaneRejectionRate/100*0.3);
      const nC=p.cryoOpex+(p.nglTransport*p.nglYieldGPM/42)+(p.nglFracCost*p.nglYieldGPM/42);
      const nN=Math.max(nR-nC,0), amm=p.gasVolumeMMBtuD*365*p.capacityFactor;
      const cA=(p.cryoCapex*1e6/20)/amm;
      const aB=raw-nN+p.lateralCost+0.03+cA, aC=as_-nN*p.modelCNGLShare+p.appFirmPremium*0.5+p.lateralCost+0.03;
      const ann=p.dcCapacityMW*p.heatRate*8760*p.capacityFactor;
      const pE=P_PIPES.filter(x=>x.y<=y).reduce((s,x)=>s+x.c,0), aE=A_PIPES.filter(x=>x.y<=y).reduce((s,x)=>s+x.c,0);
      const dG=DEMAND.reduce((s,d)=>s+(d.g[i]||0),0);
      // Supply/demand balance (Bcf/d)
      const pProd = 27.6 + 1.5*i; // Permian production trajectory (EIA: ~27.6 in 2026, growing ~1.5/yr tied to oil)
      const pExistEgress = 21.5; // existing long-haul egress pre-2026 additions
      const pTotalEgress = pExistEgress + pE;
      const pUtilization = Math.min(pProd / pTotalEgress, 1.15); // can exceed 100% = constrained
      const aProd = 36.4 + 0.4*i; // Appalachian: 36.4 Bcf/d, modest growth (~0.4/yr, takeaway limited)
      const aExistEgress = 24.5; // existing takeaway (EIA: grew to 24.5 by 2020, +MVP 2.0 in 2024)
      const aTotalEgress = aExistEgress + aE;
      const aUtilization = Math.min(aProd / aTotalEgress, 1.10);
      const aInBasinDemand = 20 + 0.5*i; // NE regional demand: ~20 Bcf/d base + growth from DC/heating
      const aSurplusForExport = aProd - aInBasinDemand; // must be evacuated via pipes
      r.push({year:y, hh:+hh.toFixed(2), wb:+wb.toFixed(2), ab:+ab.toFixed(2), ws:+ws.toFixed(2), as:+as_.toFixed(2),
        pA:+pA.toFixed(2), aA:+aA.toFixed(2), aB:+aB.toFixed(2), aC:+aC.toFixed(2), nN:+nN.toFixed(2),
        pAnn:+(pA*ann/1e6).toFixed(1), aBAnn:+(aB*ann/1e6).toFixed(1), aCAnn:+(aC*ann/1e6).toFixed(1),
        pE:+pE.toFixed(1), aE:+aE.toFixed(1), dG:+dG.toFixed(1),
        dc:+(DEMAND[0].g[i]||0).toFixed(1), lng:+(DEMAND[1].g[i]||0).toFixed(1),
        se:+(DEMAND[2].g[i]||0).toFixed(1), oth:+(DEMAND[3].g[i]||0).toFixed(1),
        pProd:+pProd.toFixed(1), pTotalEgr:+pTotalEgress.toFixed(1), pUtil:+pUtilization.toFixed(2),
        aProd:+aProd.toFixed(1), aTotalEgr:+aTotalEgress.toFixed(1), aUtil:+aUtilization.toFixed(2),
        aInBasin:+aInBasinDemand.toFixed(1), aSurplus:+aSurplusForExport.toFixed(1),
      });
    }
    return r;
  }, [p]);

  const c = model[0];
  const tenYrDelta = model.reduce((s,r)=>s+(r.aBAnn-r.pAnn),0);

  // CSS injected once
  useEffect(() => {
    const id = "latex-fonts";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      @import url('https://fonts.cdnfonts.com/css/latin-modern-roman');
      @import url('https://fonts.cdnfonts.com/css/latin-modern-mono');
      .lx { font-family: 'Latin Modern Roman', 'Palatino Linotype', 'Book Antiqua', Palatino, 'Times New Roman', serif; }
      .lm { font-family: 'Latin Modern Mono', 'Courier New', monospace; }
      .lx-body { font-size: 11.5px; line-height: 1.72; color: #1a1a1a; text-align: justify; hyphens: auto; }
      .lx-h1 { font-size: 18px; font-weight: 700; margin: 24px 0 8px; color: #111; }
      .lx-h2 { font-size: 14px; font-weight: 700; margin: 18px 0 6px; color: #111; font-style: italic; }
      .lx-h3 { font-size: 12px; font-weight: 700; margin: 12px 0 4px; color: #333; }
      .lx-rule { border: none; border-top: 0.6px solid #111; margin: 6px 0; }
      .lx-rule-thin { border: none; border-top: 0.4px solid #ccc; margin: 4px 0; }
      .lx-sc { font-variant: small-caps; letter-spacing: 0.04em; }
      .lx-tab { border-collapse: collapse; width: 100%; font-size: 10.5px; }
      .lx-tab th { font-weight: 400; font-style: italic; padding: 4px 8px; text-align: right; color: #555; }
      .lx-tab th:first-child { text-align: left; }
      .lx-tab td { padding: 4px 8px; text-align: right; font-variant-numeric: tabular-nums; }
      .lx-tab td:first-child { text-align: left; font-weight: 600; }
      .lx-tab thead tr { border-top: 1.5px solid #111; border-bottom: 0.8px solid #111; }
      .lx-tab tbody tr { border-bottom: 0.3px solid #ddd; }
      .lx-tab tbody tr:last-child { border-bottom: 1.5px solid #111; }
      .lx-tab-wrap { overflow-x: auto; margin: 10px 0; }
      .lx-fn { font-size: 9.5px; color: #666; margin-top: 12px; line-height: 1.5; }
      .lx-em { font-style: italic; }
      .lx-bf { font-weight: 700; }
      .lx-link { color: #2563eb; cursor: pointer; text-decoration: none; border-bottom: 0.5px solid #93c5fd; }
      .lx-param { display: inline-flex; align-items: center; gap: 2px; font-size: 10.5px; padding: 1px 0; }
      .lx-param button { border: none; background: none; cursor: pointer; font-size: 9px; color: #aaa; padding: 0 1px; }
      .lx-param button:hover { color: #333; }
      .lx-aside { background: #f9f9f7; border-left: 2px solid #ddd; padding: 10px 14px; margin: 10px 0; font-size: 11px; }
      .tab-bar { display: flex; gap: 0; border-bottom: 0.6px solid #111; position: relative; }
      .tab-btn { padding: 7px 16px; font-size: 10.5px; cursor: grab; border: none; background: none; color: #888; font-weight: 400; border-bottom: 1.5px solid transparent; transition: color 0.15s, border-bottom-color 0.15s, transform 0.25s cubic-bezier(0.2,0,0,1), opacity 0.2s; position: relative; user-select: none; -webkit-user-select: none; }
      .tab-btn:hover { color: #333; }
      .tab-btn.active { color: #111; border-bottom-color: #111; font-weight: 600; }
      .tab-btn.dragging { opacity: 0.4; cursor: grabbing; }
      .tab-btn.drag-over-left { transform: translateX(8px); }
      .tab-btn.drag-over-right { transform: translateX(-8px); }
    `;
    document.head.appendChild(style);
  }, []);

  const ttStyle = { background:"#fff", border:"0.5px solid #ccc", borderRadius:0, fontSize:10, padding:"4px 8px", boxShadow:"none" };
  const chartClr = { pA:"#b45309", aA:"#6b7280", aB:"#276749", aC:"#7c3aed", hh:"#bbb", ngl:"#be185d" };

  return (
    <div className="lx" style={{background:"#fff", minHeight:"100vh", maxWidth:960, margin:"0 auto", padding:"0 40px 60px"}}>
      {/* TITLE */}
      <div style={{textAlign:"center", padding:"32px 0 20px"}}>
        <div style={{fontSize:22, fontWeight:700}}>Behind-the-Meter Gas Economics</div>
        <div style={{fontSize:14, marginTop:2}}>Permian Basin vs. Appalachian Basin</div>
        <div style={{fontSize:11, color:"#666", marginTop:6}}>Internal Working Model &middot; {p.dcCapacityMW} MW Reference Case &middot; March 2026</div>
        <hr className="lx-rule" style={{maxWidth:200, margin:"14px auto 0"}} />
      </div>

      {/* TAB BAR — drag to reorder */}
      <div className="tab-bar">
        {tabOrder.map((t, i) => {
          let cls = `tab-btn lx${tab===t.k?" active":""}`;
          if (dragIdx === i) cls += " dragging";
          if (dragOverIdx === i && dragIdx !== null && dragIdx !== i) {
            cls += dragIdx < i ? " drag-over-left" : " drag-over-right";
          }
          return (
            <button
              key={t.k}
              ref={el => { tabRefs.current[i] = el; }}
              className={cls}
              draggable
              onClick={() => setTab(t.k)}
              onDragStart={e => {
                setDragIdx(i);
                e.dataTransfer.effectAllowed = "move";
                // Create a minimal ghost
                const ghost = e.currentTarget.cloneNode(true);
                ghost.style.cssText = "position:absolute;top:-1000px;padding:6px 14px;font-size:10px;background:#fff;border:0.5px solid #ccc;opacity:0.9;font-family:inherit;";
                document.body.appendChild(ghost);
                e.dataTransfer.setDragImage(ghost, ghost.offsetWidth/2, ghost.offsetHeight/2);
                requestAnimationFrame(() => document.body.removeChild(ghost));
              }}
              onDragOver={e => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dragIdx !== null && dragIdx !== i) setDragOverIdx(i);
              }}
              onDragEnter={e => {
                e.preventDefault();
                if (dragIdx !== null && dragIdx !== i) setDragOverIdx(i);
              }}
              onDragLeave={() => {
                if (dragOverIdx === i) setDragOverIdx(null);
              }}
              onDrop={e => {
                e.preventDefault();
                if (dragIdx !== null && dragIdx !== i) {
                  setTabOrder(prev => {
                    const next = [...prev];
                    const [moved] = next.splice(dragIdx, 1);
                    next.splice(i, 0, moved);
                    return next;
                  });
                }
                setDragIdx(null);
                setDragOverIdx(null);
              }}
              onDragEnd={() => {
                setDragIdx(null);
                setDragOverIdx(null);
              }}
            >
              {t.l}
            </button>
          );
        })}
      </div>

      {/* ═══════════ MARKET MAP ═══════════ */}
      {tab==="map" && <div style={{marginTop:16}}>

        {/* ── COST WATERFALLS — the headline ── */}
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:28, marginBottom:28}}>

          {/* PERMIAN WATERFALL */}
          <div>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", borderBottom:"1.5px solid #111", paddingBottom:4, marginBottom:12}}>
              <div className="lx" style={{fontSize:15, fontWeight:700}}>Permian Basin</div>
              <span style={{fontSize:10, color:"#888"}}>Model A &middot; Buy Residue</span>
            </div>
            {(() => {
              const items = [
                {l:"Waha spot price", v:Math.max(c.ws,0), color:"#c9a96e", note:$(c.ws)+"/MMBtu"},
                {l:"Firm supply premium", v:p.permianFirmPremium, color:"#8b5e3c", note:"+"+$(p.permianFirmPremium)},
                {l:"Last-mile delivery", v:p.lateralCost+0.03, color:"#d4c5b0", note:"+"+$(p.lateralCost+0.03)},
              ];
              const total = items.reduce((s,x)=>s+x.v,0);
              const maxW = Math.max(total, 6);
              return items.map((item,i) => (
                <div key={i} style={{display:"flex", alignItems:"center", gap:0, marginBottom:5}}>
                  <span style={{fontSize:9.5, color:"#666", width:120, textAlign:"right", paddingRight:10}}>{item.l}</span>
                  <div style={{flex:1, height:16, background:"#f5f3ef", position:"relative"}}>
                    <div style={{width:`${(item.v/maxW)*100}%`, height:"100%", background:item.color, opacity:0.65, transition:"width 0.3s"}} />
                  </div>
                  <span className="lm" style={{fontSize:10, fontWeight:600, width:70, textAlign:"right", paddingLeft:6}}>{item.note}</span>
                </div>
              ));
            })()}
            <div style={{borderTop:"1.5px solid #111", marginTop:8, paddingTop:6, display:"flex", justifyContent:"space-between", alignItems:"baseline"}}>
              <span style={{fontSize:10, color:"#888"}}>All-in delivered cost</span>
              <span><span className="lm" style={{fontSize:26, fontWeight:700, color:"#333"}}>{$(c.pA)}</span><span style={{fontSize:10, color:"#888"}}> /MMBtu</span></span>
            </div>
            <div style={{display:"flex", gap:12, marginTop:8}}>
              <span style={{fontSize:9, color:"#999"}}>Annual fuel cost ({p.dcCapacityMW} MW):</span>
              <span className="lm" style={{fontSize:10, fontWeight:600}}>${c.pAnn}M/yr</span>
              <span style={{fontSize:9, color:"#999"}}>NGL to developer:</span>
              <span className="lm" style={{fontSize:10, fontWeight:600}}>$0</span>
            </div>
          </div>

          {/* APPALACHIAN WATERFALL — Model B */}
          <div>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", borderBottom:"1.5px solid #111", paddingBottom:4, marginBottom:12}}>
              <div className="lx" style={{fontSize:15, fontWeight:700}}>Appalachian Basin</div>
              <span style={{fontSize:10, color:"#888"}}>Model B &middot; Own Cryo</span>
            </div>
            {(() => {
              const raw = Math.max(c.as - 0.20, 0);
              const proc = +(p.cryoOpex + (p.cryoCapex*1e6/20)/(p.gasVolumeMMBtuD*365*p.capacityFactor)).toFixed(3);
              const last = p.lateralCost + 0.03;
              const ngl = c.nN;
              const maxW = Math.max(raw + proc + last, 5);
              const items = [
                {l:"Raw gas cost", v:raw, color:"#6699bb", note:$(raw)+"/MMBtu", neg:false},
                {l:"Processing + cryo amort.", v:proc, color:"#2c5f7c", note:"+"+$(proc), neg:false},
                {l:"Last-mile delivery", v:last, color:"#a3c4d6", note:"+"+$(last), neg:false},
                {l:"NGL credit (subtracted)", v:ngl, color:"#b04060", note:"\u2013"+$(ngl), neg:true},
              ];
              return items.map((item,i) => (
                <div key={i} style={{display:"flex", alignItems:"center", gap:0, marginBottom:5}}>
                  <span style={{fontSize:9.5, color:item.neg?"#b04060":"#666", width:120, textAlign:"right", paddingRight:10, fontStyle:item.neg?"italic":"normal"}}>{item.l}</span>
                  <div style={{flex:1, height:16, background:item.neg?"#fdf2f5":"#f3f6f9", position:"relative"}}>
                    <div style={{width:`${(item.v/maxW)*100}%`, height:"100%", background:item.color, opacity:item.neg?0.4:0.55, transition:"width 0.3s", ...(item.neg?{backgroundImage:"repeating-linear-gradient(135deg, transparent, transparent 2px, rgba(255,255,255,0.5) 2px, rgba(255,255,255,0.5) 4px)"}:{}) }} />
                  </div>
                  <span className="lm" style={{fontSize:10, fontWeight:600, width:70, textAlign:"right", paddingLeft:6, color:item.neg?"#b04060":"inherit"}}>{item.note}</span>
                </div>
              ));
            })()}
            <div style={{borderTop:"1.5px solid #111", marginTop:8, paddingTop:6, display:"flex", justifyContent:"space-between", alignItems:"baseline"}}>
              <span style={{fontSize:10, color:"#888"}}>Model B all-in delivered</span>
              <span><span className="lm" style={{fontSize:26, fontWeight:700, color:"#333"}}>{$(c.aB)}</span><span style={{fontSize:10, color:"#888"}}> /MMBtu</span></span>
            </div>
            {/* Other models inline */}
            <div style={{display:"flex", gap:0, marginTop:8, borderTop:"0.5px solid #ddd", borderBottom:"0.5px solid #ddd"}}>
              {[{l:"Model A (buy dry)",v:c.aA},{l:"Model B (own cryo)",v:c.aB,bold:true},{l:"Model C (co-locate, "+Math.round(p.modelCNGLShare*100)+"%)",v:c.aC}].map((m,i)=>(
                <div key={i} style={{flex:1, padding:"5px 0", textAlign:"center", borderRight:i<2?"0.5px solid #ddd":"none"}}>
                  <div style={{fontSize:8, color:"#999"}}>{m.l}</div>
                  <div className="lm" style={{fontSize:m.bold?16:13, fontWeight:m.bold?700:600, color:"#333"}}>{$(m.v)}</div>
                </div>
              ))}
            </div>
            <div style={{display:"flex", gap:12, marginTop:6}}>
              <span style={{fontSize:9, color:"#999"}}>NGL revenue ({p.dcCapacityMW} MW):</span>
              <span className="lm" style={{fontSize:10, fontWeight:600, color:"#b04060"}}>{$(c.nN)}/MMBtu</span>
              <span style={{fontSize:9, color:"#999"}}>\u2192 Utopia &middot; ATEX &middot; Mariner East</span>
            </div>
          </div>
        </div>

        {/* ── SUPPLY CHAIN — annotated tables ── */}
        <div className="lx-body">
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:28}}>
            <div>
              <div className="lx-h3" style={{marginTop:0}}>Permian supply chain (Model A)</div>
              <div className="lx-tab-wrap"><table className="lx-tab lm" style={{fontSize:10}}>
                <thead><tr><th style={{textAlign:"left"}}>Stage</th><th>Key Operators</th><th>Metric</th><th>Src</th></tr></thead>
                <tbody>
                  <tr><td>Wellhead</td><td style={{textAlign:"right"}}>Producers (oil-driven)</td><td style={{textAlign:"right"}}>{c.pProd} Bcf/d</td><td style={{textAlign:"right"}}><Ref id="1" setTab={setTab} /></td></tr>
                  <tr><td>Gather &amp; Process</td><td style={{textAlign:"right"}}>Targa, ET, ONEOK, Enterprise</td><td style={{textAlign:"right"}}>$0.65&ndash;1.30 embedded</td><td style={{textAlign:"right"}}><Ref id="11,13" setTab={setTab} /></td></tr>
                  <tr><td>Waha Hub</td><td style={{textAlign:"right"}}>&mdash;</td><td style={{textAlign:"right"}}>{$(c.ws)}/MMBtu</td><td style={{textAlign:"right"}}><Ref id="3" setTab={setTab} /></td></tr>
                  <tr><td>Firm supply</td><td style={{textAlign:"right"}}>Marketer / producer</td><td style={{textAlign:"right"}}>+{$(p.permianFirmPremium)} premium</td><td style={{textAlign:"right"}}><Ref id="7" setTab={setTab} /></td></tr>
                  <tr><td>Last mile</td><td style={{textAlign:"right"}}>Lateral + M&amp;R</td><td style={{textAlign:"right"}}>+{$(p.lateralCost+0.03)}</td><td style={{textAlign:"right"}}></td></tr>
                </tbody>
              </table></div>
              <p style={{fontSize:10, color:"#888", marginTop:4}}>Egress: {c.pTotalEgr} Bcf/d total capacity <Ref id="5,17" setTab={setTab} /> &middot; Utilization: {Math.round(c.pUtil*100)}% &middot; NGL to developer: $0</p>
            </div>
            <div>
              <div className="lx-h3" style={{marginTop:0}}>Appalachian supply chain (Model B)</div>
              <div className="lx-tab-wrap"><table className="lx-tab lm" style={{fontSize:10}}>
                <thead><tr><th style={{textAlign:"left"}}>Stage</th><th>Key Operators</th><th>Metric</th><th>Src</th></tr></thead>
                <tbody>
                  <tr><td>Wellhead</td><td style={{textAlign:"right"}}>EQT, Expand, Coterra, Range</td><td style={{textAlign:"right"}}>{c.aProd} Bcf/d</td><td style={{textAlign:"right"}}><Ref id="1,6" setTab={setTab} /></td></tr>
                  <tr><td>Gathering</td><td style={{textAlign:"right"}}>EQT/Equitrans, Antero, MPLX</td><td style={{textAlign:"right"}}>$0.15&ndash;0.35 embedded</td><td style={{textAlign:"right"}}><Ref id="12,25" setTab={setTab} /></td></tr>
                  <tr><td>Cryo processing &#9733;</td><td style={{textAlign:"right"}}>Developer-owned or JV</td><td style={{textAlign:"right"}}>NGL: {$(c.nN)} credit</td><td style={{textAlign:"right"}}><Ref id="8,9" setTab={setTab} /></td></tr>
                  <tr><td>Hub (Tetco M-2)</td><td style={{textAlign:"right"}}>Enbridge (Tetco)</td><td style={{textAlign:"right"}}>{$(c.as)}/MMBtu</td><td style={{textAlign:"right"}}><Ref id="4,7" setTab={setTab} /></td></tr>
                  <tr><td>FT + last mile</td><td style={{textAlign:"right"}}>Interstate pipe + lateral</td><td style={{textAlign:"right"}}>+{$(p.ftReservation + p.lateralCost + 0.03)}</td><td style={{textAlign:"right"}}><Ref id="18" setTab={setTab} /></td></tr>
                </tbody>
              </table></div>
              <p style={{fontSize:10, color:"#888", marginTop:4}}>Egress: {c.aTotalEgr} Bcf/d total <Ref id="5,14" setTab={setTab} /> &middot; Utilization: {Math.round(c.aUtil*100)}% &middot; In-basin demand: {c.aInBasin} Bcf/d <Ref id="6" setTab={setTab} /> &middot; Surplus for export: {c.aSurplus} Bcf/d</p>
            </div>
          </div>

          {/* Pipeline bars side by side */}
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:28, marginTop:16}}>
            {[
              {title:"Permian egress additions", pipes:P_PIPES, color:"#8b5e3c", total:P_PIPES.reduce((a,x)=>a+x.c,0)},
              {title:"Appalachian egress additions", pipes:A_PIPES, color:"#2c5f7c", total:A_PIPES.reduce((a,x)=>a+x.c,0)},
            ].map(basin => (
              <div key={basin.title}>
                <div style={{fontSize:9.5, textTransform:"uppercase", letterSpacing:"0.06em", color:"#888", marginBottom:6}}>{basin.title} &mdash; {basin.total.toFixed(1)} Bcf/d</div>
                {basin.pipes.map((pipe,i) => (
                  <div key={i} style={{display:"flex", alignItems:"center", gap:0, marginBottom:2}}>
                    <span className="lm" style={{fontSize:8.5, color:"#777", width:118, textAlign:"right", paddingRight:8, overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis"}}>{pipe.n}</span>
                    <div style={{flex:1, height:10, background:"#f5f3ef", position:"relative"}}>
                      <div style={{width:`${(pipe.c/4)*100}%`, height:"100%", background:basin.color, opacity:0.45}} />
                    </div>
                    <span className="lm" style={{fontSize:8.5, fontWeight:600, color:"#555", width:28, textAlign:"right", paddingLeft:4}}>{pipe.c}</span>
                    <span className="lm" style={{fontSize:8, color:"#999", width:30, textAlign:"right"}}>{pipe.y}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* ── Knobs ── */}
        <div style={{borderTop:"1.5px solid #111", paddingTop:14, marginTop:20}}>
          <div className="lx" style={{fontSize:12, fontWeight:700, color:"#333", marginBottom:12}}>Adjustable Parameters</div>
          <div style={{display:"flex", gap:32, flexWrap:"wrap", justifyContent:"space-between"}}>
            {[
              {title:"Permian Basis", color:"#8b5e3c", knobs:[
                {l:"Waha H1 '26",k:"wahaBasis2026H1",min:-6,max:0,step:0.1},
                {l:"Waha 2027+",k:"wahaBasis2027",min:-2,max:0.5,step:0.1},
                {l:"Waha Floor",k:"wahaBasisLongTerm",min:-1,max:0.2,step:0.05},
                {l:"Firm Prem.",k:"permianFirmPremium",min:0.25,max:3,step:0.25},
              ]},
              {title:"Appalachian Basis", color:"#2c5f7c", knobs:[
                {l:"Basis '26",k:"appBasis2026",min:-2,max:0,step:0.05},
                {l:"Tighten/yr",k:"appBasisTightenRate",min:0,max:0.15,step:0.01},
                {l:"FT Cost",k:"ftReservation",min:0.2,max:1,step:0.05},
                {l:"Firm Prem.",k:"appFirmPremium",min:0.1,max:1,step:0.05},
              ]},
              {title:"NGL & Processing", color:"#276749", knobs:[
                {l:"Yield (GPM)",k:"nglYieldGPM",min:2,max:7,step:0.5,u:""},
                {l:"NGL $/MMBtu",k:"nglCompositePrice",min:4,max:14,step:0.5},
                {l:"C\u2082 Rejection",k:"ethaneRejectionRate",min:10,max:70,step:5,u:"%"},
                {l:"Cryo CAPEX",k:"cryoCapex",min:100,max:400,step:25,u:""},
                {l:"Proc. OPEX",k:"cryoOpex",min:0.15,max:0.8,step:0.05},
              ]},
              {title:"Macro & Plant", color:"#555", knobs:[
                {l:"HH Base",k:"hhBase",min:2,max:6,step:0.1},
                {l:"HH Growth",k:"hhGrowth",min:-0.2,max:0.3,step:0.02},
                {l:"Heat Rate",k:"heatRate",min:5.5,max:9,step:0.1,u:""},
                {l:"C NGL Split",k:"modelCNGLShare",min:0.1,max:0.7,step:0.05,u:""},
              ]},
            ].map(g => (
              <div key={g.title}>
                <div style={{fontSize:8.5, fontWeight:700, letterSpacing:"0.07em", color:g.color, textTransform:"uppercase", marginBottom:8}}>{g.title}</div>
                <div style={{display:"flex", gap:12}}>
                  {g.knobs.map(k => <Knob key={k.k} label={k.l} value={p[k.k]} onChange={v=>s(k.k,v)} min={k.min} max={k.max} step={k.step} unit={k.u||"$"} color={g.color} />)}
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="lx-fn" style={{marginTop:10}}>Sources: <span className="lx-link" onClick={()=>setTab("th")}>&sect;4.6</span>, <span className="lx-link" onClick={()=>setTab("src")}>&sect;5</span>.</p>
      </div>}

      {/* ═══════════ SUPPLY & DEMAND ═══════════ */}
      {tab==="sd" && <div className="lx-body" style={{marginTop:16}}>
        <div className="lx-h1">2. &ensp;Supply &amp; Demand Dynamics</div>
        <p>This section contextualizes the basis trajectories driving the cost model. The key question for each basin: <em>how does the supply/demand balance evolve, and what does that mean for the price of gas at the delivery point?</em></p>

        {/* ── CURRENT STATE — snapshot table ── */}
        <div className="lx-h2">2.1 &ensp;Current State (2026 Baseline)</div>
        <div className="lx-tab-wrap"><table className="lx-tab lm">
          <thead><tr><th style={{textAlign:"left"}}></th><th>Permian</th><th>Appalachian</th><th>US Total</th><th style={{textAlign:"left", paddingLeft:8}}>Src</th></tr></thead>
          <tbody>
            <tr><td>Marketed gas production</td><td style={{textAlign:"right"}}>{c.pProd} Bcf/d</td><td style={{textAlign:"right"}}>{c.aProd} Bcf/d</td><td style={{textAlign:"right"}}>~118 Bcf/d</td><td style={{paddingLeft:8}}><Ref id="1" setTab={setTab} /></td></tr>
            <tr><td>Share of US production</td><td style={{textAlign:"right"}}>~24%</td><td style={{textAlign:"right"}}>~31%</td><td style={{textAlign:"right"}}>100%</td><td style={{paddingLeft:8}}><Ref id="1" setTab={setTab} /></td></tr>
            <tr><td>Gas type</td><td style={{textAlign:"right"}}>Associated (oil byproduct)</td><td style={{textAlign:"right"}}>Intentional (gas wells)</td><td style={{textAlign:"right"}}>&mdash;</td><td style={{paddingLeft:8}}></td></tr>
            <tr><td>Long-haul egress capacity (existing)</td><td style={{textAlign:"right"}}>21.5 Bcf/d</td><td style={{textAlign:"right"}}>24.5 Bcf/d</td><td style={{textAlign:"right"}}>&mdash;</td><td style={{paddingLeft:8}}><Ref id="2,5" setTab={setTab} /></td></tr>
            <tr><td>Egress capacity (with 2026 additions)</td><td style={{textAlign:"right"}}>{c.pTotalEgr} Bcf/d</td><td style={{textAlign:"right"}}>{c.aTotalEgr} Bcf/d</td><td style={{textAlign:"right"}}>&mdash;</td><td style={{paddingLeft:8}}><Ref id="5,17" setTab={setTab} /></td></tr>
            <tr><td>Utilization (production / egress)</td><td style={{textAlign:"right"}} className="lx-bf">{Math.round(c.pUtil*100)}%</td><td style={{textAlign:"right"}} className="lx-bf">{Math.round(c.aUtil*100)}%</td><td style={{textAlign:"right"}}>&mdash;</td><td style={{paddingLeft:8}}></td></tr>
            <tr><td>In-basin demand</td><td style={{textAlign:"right"}}>~3&ndash;5 Bcf/d (low)</td><td style={{textAlign:"right"}}>{c.aInBasin} Bcf/d</td><td style={{textAlign:"right"}}>&mdash;</td><td style={{paddingLeft:8}}><Ref id="6" setTab={setTab} /></td></tr>
            <tr><td>Surplus requiring export</td><td style={{textAlign:"right"}}>~{(c.pProd - 4).toFixed(0)} Bcf/d</td><td style={{textAlign:"right"}}>{c.aSurplus} Bcf/d</td><td style={{textAlign:"right"}}>&mdash;</td><td style={{paddingLeft:8}}></td></tr>
            <tr><td>Benchmark hub price (2026 avg)</td><td style={{textAlign:"right"}}>{$(c.ws)}/MMBtu (Waha)</td><td style={{textAlign:"right"}}>{$(c.as)}/MMBtu (Tetco M-2)</td><td style={{textAlign:"right"}}>{$(c.hh)} (HH)</td><td style={{paddingLeft:8}}><Ref id="3,4,7" setTab={setTab} /></td></tr>
            <tr><td>Basis to Henry Hub</td><td style={{textAlign:"right"}}>{$(c.wb)}</td><td style={{textAlign:"right"}}>{$(c.ab)}</td><td style={{textAlign:"right"}}>&mdash;</td><td style={{paddingLeft:8}}><Ref id="3,4" setTab={setTab} /></td></tr>
            <tr><td>Active rig count</td><td style={{textAlign:"right"}}>~300 (oil rigs)</td><td style={{textAlign:"right"}}>~39 (gas rigs)</td><td style={{textAlign:"right"}}>~550</td><td style={{paddingLeft:8}}><Ref id="1" setTab={setTab} /></td></tr>
            <tr><td>Producer breakeven</td><td style={{textAlign:"right"}}>~$61&ndash;62/bbl (oil)</td><td style={{textAlign:"right"}}>~$1.75&ndash;2.50/MMBtu</td><td style={{textAlign:"right"}}>&mdash;</td><td style={{paddingLeft:8}}><Ref id="20" setTab={setTab} /></td></tr>
          </tbody>
        </table></div>
        <p className="lx-fn">Sources: EIA STEO March 2026 <Ref id="1" setTab={setTab} />, AEGIS Hedging <Ref id="3,4" setTab={setTab} />, East Daley <Ref id="5" setTab={setTab} />, RBN Energy <Ref id="6" setTab={setTab} />, Dallas Fed <Ref id="20" setTab={setTab} />. Appalachian egress includes MVP (2.0 Bcf/d, operational June 2024) and Williams Regional Energy Access (0.8 Bcf/d, late 2024) <Ref id="14" setTab={setTab} />.</p>

        {/* ── WHY EACH BASIS EXISTS ── */}
        <div className="lx-h2">2.2 &ensp;Why the Basis Discounts Exist</div>
        <p><b>Permian (Waha):</b> Production (~{c.pProd} Bcf/d) exceeds outbound egress capacity. Producers of associated gas <em>must</em> dispose of the gas to continue producing oil. When all outbound pipes are full, the only buyers are local consumers or entities with spare pipe capacity, who demand a negative price &mdash; they are being paid to take the gas. The Waha basis averaged {$(c.wb)}/MMBtu in 2026 because utilization stands at {Math.round(c.pUtil*100)}%. This is a <b>capacity constraint</b> story, and it resolves as new pipes enter service.</p>
        <p><b>Appalachian (Eastern Gas South / Tetco M-2):</b> Production (~{c.aProd} Bcf/d) exceeds the sum of in-basin demand ({c.aInBasin} Bcf/d) plus available export egress. The surplus must be evacuated via long-haul pipes to the Midwest, Southeast, and Gulf Coast. The basis discount ({$(c.ab)}/MMBtu to HH) reflects this evacuation cost. Unlike the Permian, Appalachian gas has never gone negative because: (a) in-basin demand is large and diverse, (b) production is intentional and can be curtailed, and (c) the basin has more diverse pipeline outlets. This is a <b>structural friction</b> story, and it <em>tightens</em> as demand grows faster than new egress.</p>

        {/* ── PRODUCTION VS EGRESS TRAJECTORIES ── */}
        <div className="lx-h2">2.3 &ensp;Production vs. Egress Capacity</div>
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:24}}>
          <div>
            <div className="lx-h3">Permian (Bcf/d)</div>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={model} margin={{top:5,right:5,left:0,bottom:5}}>
                <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
                <XAxis dataKey="year" tick={{fontSize:9}} stroke="#ccc" />
                <YAxis tick={{fontSize:9}} stroke="#ccc" domain={[15,45]} />
                <Tooltip contentStyle={ttStyle} formatter={(v,n)=>[v+" Bcf/d",n]} />
                <Bar dataKey="pTotalEgr" name="Egress capacity" fill="#c9a96e" fillOpacity={0.4} />
                <Line type="monotone" dataKey="pProd" name="Production" stroke="#8b5e3c" strokeWidth={2} dot={{r:2}} />
                <Legend wrapperStyle={{fontSize:9}} />
              </ComposedChart>
            </ResponsiveContainer>
            <p className="lx-fn">When production exceeds the bar (egress), Waha goes negative. The gap closes in H2 2026 as ~4.5 Bcf/d of new capacity enters service, then egress overshoots production by 2028&ndash;2029. East Daley forecasts overbuild <Ref id="5" setTab={setTab} />.</p>
          </div>
          <div>
            <div className="lx-h3">Appalachian (Bcf/d)</div>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={model} margin={{top:5,right:5,left:0,bottom:5}}>
                <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
                <XAxis dataKey="year" tick={{fontSize:9}} stroke="#ccc" />
                <YAxis tick={{fontSize:9}} stroke="#ccc" domain={[15,45]} />
                <Tooltip contentStyle={ttStyle} formatter={(v,n)=>[v+" Bcf/d",n]} />
                <Bar dataKey="aTotalEgr" name="Egress capacity" fill="#6699bb" fillOpacity={0.3} />
                <Line type="monotone" dataKey="aProd" name="Production" stroke="#2c5f7c" strokeWidth={2} dot={{r:2}} />
                <Line type="monotone" dataKey="aInBasin" name="In-basin demand" stroke="#999" strokeWidth={1} strokeDasharray="4 4" dot={false} />
                <Legend wrapperStyle={{fontSize:9}} />
              </ComposedChart>
            </ResponsiveContainer>
            <p className="lx-fn">Production growth is constrained by takeaway + gas prices. In-basin demand (dashed) grows with data centers. The gap between production and in-basin demand = surplus requiring evacuation. New egress is limited by NEPA <Ref id="6,23" setTab={setTab} />.</p>
          </div>
        </div>

        {/* ── DEMAND DRIVERS ── */}
        <div className="lx-h2">2.4 &ensp;Demand Growth: Where the Incremental Bcf/d Come From</div>
        <p>Four categories of incremental gas demand drive basis tightening and price formation over the model period. All figures are <em>incremental</em> above the 2025 baseline.</p>
        <div className="lx-tab-wrap"><table className="lx-tab lm">
          <thead><tr><th style={{textAlign:"left"}}>Driver</th><th>2026</th><th>2028</th><th>2030</th><th>2035</th><th style={{textAlign:"left", paddingLeft:12}}>Mechanism</th></tr></thead>
          <tbody>
            <tr><td>Data centers (PJM/ERCOT)</td><td style={{textAlign:"right"}}>+0.3</td><td style={{textAlign:"right"}}>+1.0</td><td style={{textAlign:"right"}}>+2.0</td><td style={{textAlign:"right"}}>+4.5</td><td style={{paddingLeft:12}}>Gas-fired gen. for AI/HPC; EQT 1.5 Bcf/d signed <Ref id="12,21,22" setTab={setTab} /></td></tr>
            <tr><td>LNG feed gas</td><td style={{textAlign:"right"}}>+0.5</td><td style={{textAlign:"right"}}>+2.5</td><td style={{textAlign:"right"}}>+3.5</td><td style={{textAlign:"right"}}>+6.0</td><td style={{paddingLeft:12}}>Plaquemines, CP2, Golden Pass, Corpus Stage 3 <Ref id="2,5" setTab={setTab} /></td></tr>
            <tr><td>SE utility (coal retirement)</td><td style={{textAlign:"right"}}>+0.2</td><td style={{textAlign:"right"}}>+0.8</td><td style={{textAlign:"right"}}>+1.5</td><td style={{textAlign:"right"}}>+2.6</td><td style={{paddingLeft:12}}>Gas-for-coal substitution in AL, GA, FL, NC <Ref id="14,16,23" setTab={setTab} /></td></tr>
            <tr><td>Industrial / residential</td><td style={{textAlign:"right"}}>+0.1</td><td style={{textAlign:"right"}}>+0.2</td><td style={{textAlign:"right"}}>+0.3</td><td style={{textAlign:"right"}}>+0.5</td><td style={{paddingLeft:12}}>Baseline growth in heating, industrial processes</td></tr>
            <tr style={{borderTop:"1.5px solid #111"}}><td className="lx-bf">Total incremental demand</td><td style={{textAlign:"right"}} className="lx-bf">+1.1</td><td style={{textAlign:"right"}} className="lx-bf">+4.5</td><td style={{textAlign:"right"}} className="lx-bf">+7.3</td><td style={{textAlign:"right"}} className="lx-bf">+13.6</td><td></td></tr>
          </tbody>
        </table></div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={model} margin={{top:5,right:5,left:0,bottom:5}}>
            <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
            <XAxis dataKey="year" tick={{fontSize:9}} stroke="#ccc" />
            <YAxis tick={{fontSize:9}} stroke="#ccc" label={{value:"Bcf/d (incr.)",angle:-90,position:"insideLeft",style:{fontSize:9}}} />
            <Tooltip contentStyle={ttStyle} />
            <Area type="monotone" dataKey="oth" name="Industrial/Resi." stackId="1" fill="#d4d4d4" stroke="#9ca3af" fillOpacity={0.5} />
            <Area type="monotone" dataKey="se" name="SE Utility" stackId="1" fill="#fca5a5" stroke="#b91c1c" fillOpacity={0.4} />
            <Area type="monotone" dataKey="lng" name="LNG Feed Gas" stackId="1" fill="#fcd34d" stroke="#b45309" fillOpacity={0.4} />
            <Area type="monotone" dataKey="dc" name="Data Centers" stackId="1" fill="#93c5fd" stroke="#1d4ed8" fillOpacity={0.5} />
            <Legend wrapperStyle={{fontSize:9}} />
          </AreaChart>
        </ResponsiveContainer>

        {/* ── BASIS IMPLICATIONS ── */}
        <div className="lx-h2">2.5 &ensp;Basis Implications</div>
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:24}}>
          {[{k:"wb",title:"Waha Basis to Henry Hub",c:"#b45309",note:"Permian egress overbuild drives basis toward zero. The extreme negative pricing of 2024\u20132026 is a temporary phenomenon. By 2028, ~17 Bcf/d of new egress serves ~4\u20136.5 Bcf/d of production growth. The Waha discount as a fuel cost advantage is transient."},
            {k:"ab",title:"Appalachian Basis to Henry Hub",c:"#1d4ed8",note:"Appalachian basis tightens gradually, driven by demand growth outpacing limited new egress. Unlike the Permian (one-time pipe events), this is a secular trend. EQT CFO (mid-2025): \u201CWe are as confident as ever that Appalachian basis should structurally tighten through the end of the decade.\u201D The discount as a fuel cost advantage is durable but narrowing."}
          ].map(b=>(
            <div key={b.k}>
              <div className="lx-h3">{b.title}</div>
              <ResponsiveContainer width="100%" height={150}>
                <LineChart data={model} margin={{top:5,right:5,left:0,bottom:5}}>
                  <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
                  <XAxis dataKey="year" tick={{fontSize:9}} stroke="#ccc" />
                  <YAxis tick={{fontSize:9}} stroke="#ccc" domain={['auto','auto']} />
                  <Tooltip contentStyle={ttStyle} formatter={v=>[$(v)+"/MMBtu"]} />
                  <ReferenceLine y={0} stroke="#aaa" strokeDasharray="2 2" />
                  <Line type="monotone" dataKey={b.k} stroke={b.c} strokeWidth={1.5} dot={{r:2}} />
                </LineChart>
              </ResponsiveContainer>
              <div className="lm" style={{display:"flex", justifyContent:"space-between", fontSize:10, marginTop:4}}>
                {[0,4,9].map(i=><span key={i}>{model[i].year}: <b>{$(model[i][b.k])}</b></span>)}
              </div>
              <p style={{fontSize:10, color:"#666", marginTop:6, lineHeight:1.6}}>{b.note}</p>
            </div>
          ))}
        </div>

        {/* ── SUMMARY TABLE ── */}
        <div className="lx-h2">2.6 &ensp;Supply/Demand Balance Summary</div>
        <div className="lx-tab-wrap"><table className="lx-tab lm" style={{fontSize:10}}>
          <thead><tr><th style={{textAlign:"left"}}>Year</th><th>Permian Prod.</th><th>Perm. Egress</th><th>Perm. Util.</th><th>Waha Basis</th><th>App. Prod.</th><th>App. Egress</th><th>App. Util.</th><th>App. Basis</th><th>Demand \u0394</th></tr></thead>
          <tbody>{model.map(r=>(
            <tr key={r.year}>
              <td>{r.year}</td>
              <td style={{textAlign:"right"}}>{r.pProd}</td>
              <td style={{textAlign:"right"}}>{r.pTotalEgr}</td>
              <td style={{textAlign:"right", color:r.pUtil>0.95?"#b91c1c":"inherit", fontWeight:r.pUtil>0.95?700:400}}>{Math.round(r.pUtil*100)}%</td>
              <td style={{textAlign:"right", color:"#b45309", fontWeight:600}}>{$(r.wb)}</td>
              <td style={{textAlign:"right"}}>{r.aProd}</td>
              <td style={{textAlign:"right"}}>{r.aTotalEgr}</td>
              <td style={{textAlign:"right", color:r.aUtil>0.95?"#b91c1c":"inherit", fontWeight:r.aUtil>0.95?700:400}}>{Math.round(r.aUtil*100)}%</td>
              <td style={{textAlign:"right", color:"#1d4ed8", fontWeight:600}}>{$(r.ab)}</td>
              <td style={{textAlign:"right"}}>+{r.dG}</td>
            </tr>
          ))}</tbody>
        </table></div>
        <p className="lx-fn">Utilization above 95% (red) indicates structural constraint = wider basis discount. Permian utilization drops below 80% by 2028 as egress overshoots production growth. Appalachian utilization remains elevated through the decade due to limited new pipe. Production trajectories are model assumptions adjustable in <span className="lx-link" onClick={()=>setTab("map")}>&sect;1.4</span>.</p>
      </div>}

      {/* ═══════════ DELIVERED COST ═══════════ */}
      {tab==="cost" && <div className="lx-body" style={{marginTop:16}}>
        <div className="lx-h1">3. &ensp;Delivered Cost Comparison</div>

        <div className="lx-h2">3.1 &ensp;All-In Fuel Cost Trajectory ($/MMBtu)</div>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={model} margin={{top:5,right:5,left:0,bottom:5}}>
            <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
            <XAxis dataKey="year" tick={{fontSize:9,fontFamily:"Latin Modern Roman"}} stroke="#ccc" />
            <YAxis tick={{fontSize:9,fontFamily:"Latin Modern Roman"}} stroke="#ccc" tickFormatter={v=>`$${v}`} domain={['auto','auto']} />
            <Tooltip contentStyle={ttStyle} formatter={(v,n)=>[$(v)+"/MMBtu",n]} />
            <ReferenceLine y={0} stroke="#aaa" strokeDasharray="2 2" />
            <Line type="monotone" dataKey="hh" name="Henry Hub" stroke={chartClr.hh} strokeWidth={1} strokeDasharray="4 4" dot={false} />
            <Line type="monotone" dataKey="pA" name="Permian A" stroke={chartClr.pA} strokeWidth={2} dot={{r:2.5,fill:chartClr.pA}} />
            <Line type="monotone" dataKey="aA" name="App. A" stroke={chartClr.aA} strokeWidth={1} strokeDasharray="5 3" dot={{r:1.5}} />
            <Line type="monotone" dataKey="aB" name="App. B (Cryo)" stroke={chartClr.aB} strokeWidth={2} dot={{r:2.5,fill:chartClr.aB}} />
            <Line type="monotone" dataKey="aC" name="App. C (Split)" stroke={chartClr.aC} strokeWidth={1.5} dot={{r:2,fill:chartClr.aC}} />
            <Legend wrapperStyle={{fontSize:9, fontFamily:"Latin Modern Roman"}} />
          </ComposedChart>
        </ResponsiveContainer>

        <div className="lx-h2">3.2 &ensp;Annual Fuel Cost, {p.dcCapacityMW} MW ($M/yr)</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={model} margin={{top:5,right:5,left:0,bottom:5}}>
            <CartesianGrid stroke="#eee" strokeDasharray="3 3" />
            <XAxis dataKey="year" tick={{fontSize:9}} stroke="#ccc" /><YAxis tick={{fontSize:9}} stroke="#ccc" tickFormatter={v=>`$${v}M`} />
            <Tooltip contentStyle={ttStyle} formatter={(v,n)=>[`$${v}M/yr`,n]} />
            <Bar dataKey="pAnn" name="Permian A" fill={chartClr.pA} fillOpacity={0.6} radius={[2,2,0,0]} />
            <Bar dataKey="aBAnn" name="App. B" fill={chartClr.aB} fillOpacity={0.6} radius={[2,2,0,0]} />
            <Bar dataKey="aCAnn" name="App. C" fill={chartClr.aC} fillOpacity={0.5} radius={[2,2,0,0]} />
            <Legend wrapperStyle={{fontSize:9}} />
          </BarChart>
        </ResponsiveContainer>

        <p>Ten-year cumulative fuel cost differential (App. B vs. Permian A): <span className="lm lx-bf" style={{color:tenYrDelta<0?"#276749":"#b91c1c"}}>${Math.abs(tenYrDelta).toFixed(0)}M</span> {tenYrDelta < 0 ? "savings under App. B" : "savings under Permian A"}.</p>

        <div className="lx-h2">3.3 &ensp;Summary Table</div>
        <div className="lx-tab-wrap"><table className="lx-tab lm">
          <thead><tr><th style={{textAlign:"left"}}>Year</th><th>HH</th><th>Waha</th><th style={{color:chartClr.pA}}>Perm. A</th><th>App. Spot</th><th style={{color:chartClr.aB}}>App. B</th><th style={{color:chartClr.aC}}>App. C</th><th style={{color:chartClr.ngl}}>NGL Cr.</th></tr></thead>
          <tbody>{model.map(r=>(
            <tr key={r.year}><td>{r.year}</td><td>{$(r.hh)}</td><td>{$(r.ws)}</td><td style={{fontWeight:600,color:chartClr.pA}}>{$(r.pA)}</td><td>{$(r.as)}</td><td style={{fontWeight:600,color:chartClr.aB}}>{$(r.aB)}</td><td style={{color:chartClr.aC}}>{$(r.aC)}</td><td style={{color:chartClr.ngl}}>{$(r.nN)}</td></tr>
          ))}</tbody>
        </table></div>
      </div>}

      {/* ═══════════ THESIS ═══════════ */}
      {tab==="th" && <div className="lx-body" style={{marginTop:16}}>
        <div className="lx-h1">4. &ensp;Thesis &amp; Assumptions</div>

        <div className="lx-h2">4.1 &ensp;The Fundamental Question</div>
        <p>A data center developer purchasing gas for behind-the-meter generation optimizes two variables: <em>methane cost</em> ($/MMBtu for fuel) and <em>NGL margin</em> (revenue from selling extracted liquids, net of processing and transport). These exist in tension: the cheapest methane markets are cheap <em>because</em> the gas has already been processed and the NGLs stripped by the incumbent midstream operator.</p>
        <p>The fundamental commercial question is: <b>at what point in the supply chain do you take possession of the gas?</b></p>

        <div className="lx-h2">4.2 &ensp;Three Deal Models</div>
        <p><b>Model A</b> (Buy Residue Gas). Purchase dry, pipeline-quality methane at a hub index. Zero NGL upside. Precedents: Energy Transfer/CloudBurst, ET/Oracle, ET/Fermi<Ref id="11" setTab={setTab} />. Works in any basin.</p>
        <p><b>Model B</b> (Own Cryo). Take raw wellhead gas, build or control a cryogenic plant, extract and sell NGLs, burn residue. Captures both revenue streams. CAPEX ~$150–250M for a 200 MMcf/d facility. Requires willing producer without binding GGP and accessible NGL offtake infrastructure<Ref id="8,9" setTab={setTab} />.</p>
        <p><b>Model C</b> (Co-locate / Split). Partner with an existing processor: they process, you take residue for power and negotiate a share of the NGL margin. Lower CAPEX than B but less NGL upside capture. Structures similar to MPLX / Antero Midstream JVs<Ref id="19" setTab={setTab} />.</p>

        <div className="lx-h2">4.3 &ensp;Why Appalachia Supports All Three Models</div>
        <p><b>Less consolidated midstream.</b> In the Permian, virtually every producing acre is dedicated to a major midstream operator (Targa, ET, ONEOK, Enterprise, Kinetik) under GGP agreements with acreage covenants running with the land. In Appalachia, the wet gas window in eastern Ohio and Harrison County is less locked up. The Antero/HG Energy restructuring ($5B+ in transactions, December 2025) reshuffled midstream dedications. Infinity Natural Resources and smaller operators are growing Utica production without legacy encumbrances<Ref id="19,21" setTab={setTab} />.</p>
        <p><b>48% ethane rejection represents stranded value.</b> Nearly half of available ethane in Appalachia is currently rejected into the gas stream because extraction is uneconomic at prevailing netbacks. A co-located cryo + DC operation changes this calculus by monetizing volume that is not being extracted at all<Ref id="5,9" setTab={setTab} />.</p>
        <p><b>NGL offtake infrastructure is in-basin.</b> Harrison County is adjacent to: Utopia Pipeline (KMI, 75 Mb/d to Windsor, ON), ATEX Express (Enterprise, ~190 Mb/d to Mont Belvieu), Mariner East 2/2X (ET/Sunoco, ~275–375 Mb/d to Marcus Hook), and Falcon Pipeline (MPLX, ~100 Mb/d to Shell Monaca cracker). The developer connects to existing NGL pipe rather than building it<Ref id="9,13" setTab={setTab} />.</p>
        <p><b>Producers are actively exploring alternative structures.</b> EQT signed ~1.5 Bcf/d of direct data center supply agreements in July 2025. Coterra has 330 MMcf/d of power netback deals. Range Resources secured new processing and NGL takeaway for 2026<Ref id="12,21,25" setTab={setTab} />.</p>

        <div className="lx-h2">4.4 &ensp;Permian: Why Model A Dominates — and Where It Doesn't</div>
        <p className="lx-bf">The default answer is that the Permian is Model A only. The structural reasoning:</p>
        <p><em>Acreage dedications are near-universal.</em> Virtually every producing acre in the Midland and Delaware basins is locked into a long-term GGP agreement. These are covenants that run with the land — when acreage changes hands, the GGP transfers. You cannot offer to process a producer's gas because it is already contractually committed<Ref id="11,13,19" setTab={setTab} />.</p>
        <p><em>Associated gas does not optimize for marketing creativity.</em> Permian producers drill for oil. Gas marketing is secondary. They need reliable takeaway, not alternative buyers<Ref id="20" setTab={setTab} />.</p>
        <p><em>NGL infrastructure is overbuilt.</em> East Daley estimates ~2.27 MMb/d of spare NGL pipeline capacity out of the Permian. There is no structural NGL bottleneck to exploit<Ref id="5,13" setTab={setTab} />.</p>

        <p className="lx-bf" style={{marginTop:16}}>However, three exceptions exist:</p>
        <div className="lx-aside">
          <p><b>Exception 1: Off-grid wellpad gas.</b> Take raw associated gas from small producers without GGP contracts, or from wellpads too remote for the midstream to connect economically. Process with mobile or modular cryogenic equipment. This is the OM Technology model. The challenge is scale: wellpad-level supply fluctuates 20–40% month-to-month, and aggregating to ~150,000 MMBtu/d for 1 GW requires dozens of pads. Works at 5–50 MW; faces scaling challenges at data center scale.</p>
          <p><b>Exception 2: GGP contract expirations.</b> GGP contracts have 10–20 year terms with rolling renewals. As contracts expire, producers have a window to renegotiate. A developer identifying a producer with an expiring GGP in a favorable location could negotiate a raw gas deal before the producer re-ups with the incumbent midstream. Requires commercial intelligence on expiration schedules, sometimes inferrable from 10-K risk factor disclosures<Ref id="19" setTab={setTab} />.</p>
          <p style={{marginBottom:0}}><b>Exception 3: Midstream partnership with NGL-informed pricing.</b> Rather than competing with Targa or ET, partner with them. A 1 GW+ project represents ~150,000 MMBtu/d of firm demand — a meaningful anchor commitment. The pitch: take 100% of residue from a specific processing plant under a 15-year take-or-pay, at Waha minus a negotiated discount reflecting the NGL margin the processor earns on those volumes. This is Model A with NGL-informed negotiation, not Model C proper. The barrier: incumbent processors have fully contracted output and strong netbacks today.</p>
        </div>

        <div className="lx-h2">4.5 &ensp;Model Feasibility by Basin</div>
        <div className="lx-tab-wrap"><table className="lx-tab">
          <thead><tr><th style={{textAlign:"left"}}></th><th>Permian</th><th>App. Wet Gas</th><th>App. Dry Gas</th><th>Haynesville</th></tr></thead>
          <tbody>
            <tr><td>Model A (buy residue)</td><td>Best near-term cost</td><td>Viable</td><td>Best for dry gas</td><td>Viable</td></tr>
            <tr><td>Model B (own cryo)</td><td style={{color:"#b45309"}}>Hard — see exceptions</td><td style={{fontWeight:700}}>Best fit (Cadiz)</td><td style={{color:"#999"}}>Low NGL content</td><td style={{color:"#b45309"}}>Possible but locked</td></tr>
            <tr><td>Model C (co-locate)</td><td style={{color:"#b45309"}}>Possible as negotiation</td><td style={{fontWeight:700}}>Most executable</td><td style={{color:"#999"}}>No processing needed</td><td style={{color:"#b45309"}}>Limited fragmentation</td></tr>
            <tr><td>Model B* (off-grid/mobile)</td><td>OM model — scale risk</td><td style={{color:"#999"}}>Less stranded gas</td><td style={{color:"#999"}}>N/A</td><td style={{color:"#999"}}>Limited</td></tr>
          </tbody>
        </table></div>

        <div className="lx-h2">4.6 &ensp;Assumptions</div>
        <p>All adjustable parameters are listed in the <span className="lx-link" onClick={()=>setTab("map")}>Market Map</span> tab, §1.4. Key sources:</p>
        <div className="lx-tab-wrap"><table className="lx-tab" style={{fontSize:10}}>
          <thead><tr><th style={{textAlign:"left"}}>Parameter</th><th style={{textAlign:"left"}}>Source</th></tr></thead>
          <tbody>
            <tr><td>Henry Hub base ($3.80)</td><td style={{textAlign:"left"}}>EIA STEO March 2026 <Ref id="1" setTab={setTab} />; late-March spot</td></tr>
            <tr><td>Waha basis trajectory</td><td style={{textAlign:"left"}}>AEGIS Hedging <Ref id="3" setTab={setTab} />; East Daley <Ref id="5" setTab={setTab} /></td></tr>
            <tr><td>App. basis &amp; tightening</td><td style={{textAlign:"left"}}>AEGIS <Ref id="4" setTab={setTab} />; EQT CFO (mid-2025) <Ref id="12" setTab={setTab} /></td></tr>
            <tr><td>NGL composite ($8.16/MMBtu)</td><td style={{textAlign:"left"}}>EIA Natural Gas Weekly, Mar 1 2026 <Ref id="8" setTab={setTab} /></td></tr>
            <tr><td>Ethane rejection (48%)</td><td style={{textAlign:"left"}}>Enkon <Ref id="9" setTab={setTab} />; East Daley <Ref id="5" setTab={setTab} /></td></tr>
            <tr><td>Cryo CAPEX ($200M / 200 MMcf/d)</td><td style={{textAlign:"left"}}>Industry range $150&ndash;250M; midstream IR comps <Ref id="13" setTab={setTab} /></td></tr>
            <tr><td>Permian firm premium ($1.25)</td><td style={{textAlign:"left"}}>NGI reporting <Ref id="7" setTab={setTab} />; range $0.50&ndash;3.00</td></tr>
            <tr><td>Permian breakevens (~$61&ndash;62/bbl)</td><td style={{textAlign:"left"}}>Dallas Fed Energy Survey <Ref id="20" setTab={setTab} /></td></tr>
          </tbody>
        </table></div>
      </div>}

      {/* ═══════════ SOURCES ═══════════ */}
      {tab==="src" && <div className="lx-body" style={{marginTop:16}}>
        <div className="lx-h1">5. &ensp;Sources &amp; References</div>
        <p>All data is sourced from publicly available resources. Bracketed numbers (e.g., [3]) appear throughout the <span className="lx-link" onClick={()=>setTab("th")}>Thesis</span> tab and chart footnotes. Click a tab name below to navigate.</p>

        {["Price","Basis","Infra","NGL","Operator","DC","Regulatory"].map(cat => {
          const items = SOURCES.filter(x=>x.c===cat);
          if (!items.length) return null;
          const label = {Price:"Production & Price", Basis:"Pricing & Basis", Infra:"Infrastructure & Flows", NGL:"NGL Economics", Operator:"Operator Filings", DC:"Data Center Demand", Regulatory:"Regulatory"}[cat];
          return (
            <div key={cat} style={{marginBottom:16}}>
              <div className="lx-h3" style={{marginTop:16}}>{label}</div>
              <hr className="lx-rule-thin" />
              {items.map(src => (
                <div key={src.id} style={{display:"flex", gap:10, padding:"5px 0", borderBottom:"0.3px solid #eee", alignItems:"baseline"}}>
                  <span className="lm" style={{minWidth:24, fontSize:10, color:"#666", textAlign:"right"}}>[{src.id}]</span>
                  <div style={{flex:1}}>
                    <span style={{fontSize:11}}>{src.f}</span>
                    <a href={src.u.startsWith("http") ? src.u : "https://"+src.u} target="_blank" rel="noopener noreferrer" className="lm" style={{fontSize:10, color:"#2563eb", marginLeft:6, textDecoration:"none", borderBottom:"0.5px solid #93c5fd"}}>{src.u}</a>
                  </div>
                  <div style={{display:"flex", gap:4, flexShrink:0}}>
                    {src.t.map(t => {
                      const label = {map:"§1",sd:"§2",cost:"§3",th:"§4"}[t]||t;
                      return <span key={t} className="lx-link lm" onClick={()=>setTab(t)} style={{fontSize:9, padding:"0 2px"}}>{label}</span>;
                    })}
                  </div>
                </div>
              ))}
            </div>
          );
        })}

        <hr className="lx-rule" style={{marginTop:20}} />
        <p className="lx-fn"><em>Note on data currency.</em> All pricing data reflects the most recent publicly available figures as of March 2026. Forward curves and basis strips are indicative and subject to daily market movement. Pipeline in-service dates reflect operator guidance and are subject to construction, regulatory, and permitting risk.</p>
      </div>}

      {/* FOOTER */}
      <div style={{marginTop:40, paddingTop:12, borderTop:"0.6px solid #111", display:"flex", justifyContent:"space-between", fontSize:9, color:"#999"}}>
        <span>Deca &middot; Internal Use Only</span>
        <span>Rodolfo Baquerizo</span>
        <span>Prepared March 2026</span>
      </div>
    </div>
  );
}
