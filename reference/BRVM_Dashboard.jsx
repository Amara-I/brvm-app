import { useState, useEffect, useCallback, useRef } from "react";
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";
import * as XLSX from "xlsx";

// ── PALETTE ─────────────────────────────────────────────────────────────────
const C = {
  bg: "#080B12", panel: "#0D1117", border: "#1C2333",
  gold: "#D4A843", goldDim: "#7A5E20",
  green: "#22C55E", red: "#EF4444", blue: "#3B82F6",
  silver: "#94A3B8", text: "#E2D9C5", textDim: "#6B7280",
  teal: "#14B8A6", purple: "#A855F7",
};

// ── 10-YEAR HISTORICAL DATA (2015–2026) ─────────────────────────────────────
const COMPANIES_FULL = [
  { ticker:"SNTS", name:"Sonatel", country:"Sénégal", sector:"Télécoms", flag:"🇸🇳",
    per:7.01, mktcap:810,
    prices:{2015:14000,2016:16000,2017:18500,2018:19000,2019:20500,2020:22000,2021:24000,2022:25500,2023:27000,2024:27500,2025:28000,2026:28450},
    dividends:{2015:900,2016:1050,2017:1100,2018:1150,2019:1200,2020:1225,2021:1400,2022:1500,2023:1575,2024:1655,2025:1655,2026:1655},
    color:"#D4A843"},
  { ticker:"ORAC", name:"Orange CI", country:"Côte d'Ivoire", sector:"Télécoms", flag:"🇨🇮",
    per:10.2, mktcap:390,
    prices:{2015:0,2016:0,2017:0,2018:0,2019:0,2020:0,2021:0,2022:12000,2023:14500,2024:15200,2025:15500,2026:15700},
    dividends:{2015:0,2016:0,2017:0,2018:0,2019:0,2020:0,2021:0,2022:753,2023:780,2024:660,2025:660,2026:660},
    color:"#FF6B35"},
  { ticker:"ONTBF", name:"ONATEL BF", country:"Burkina Faso", sector:"Télécoms", flag:"🇧🇫",
    per:9.25, mktcap:48,
    prices:{2015:1800,2016:1900,2017:2000,2018:2100,2019:2300,2020:2500,2021:2600,2022:2700,2023:2750,2024:2800,2025:2820,2026:2855},
    dividends:{2015:100,2016:108,2017:115,2018:120,2019:132,2020:143,2021:155,2022:165,2023:175,2024:190,2025:190,2026:190},
    color:"#14B8A6"},
  { ticker:"CBIBF", name:"Coris Bank BF", country:"Burkina Faso", sector:"Banques", flag:"🇧🇫",
    per:8.5, mktcap:320,
    prices:{2015:4000,2016:5000,2017:6500,2018:7500,2019:9000,2020:10500,2021:12000,2022:14500,2023:17000,2024:19500,2025:21000,2026:21465},
    dividends:{2015:80,2016:100,2017:130,2018:160,2019:180,2020:200,2021:280,2022:350,2023:430,2024:555,2025:555,2026:555},
    color:"#A855F7"},
  { ticker:"BOAB", name:"BOA Bénin", country:"Bénin", sector:"Banques", flag:"🇧🇯",
    per:9.8, mktcap:120,
    prices:{2015:2000,2016:2500,2017:3000,2018:3500,2019:3800,2020:4200,2021:5100,2022:6000,2023:7200,2024:8500,2025:8800,2026:8900},
    dividends:{2015:80,2016:100,2017:120,2018:150,2019:175,2020:200,2021:270,2022:310,2023:380,2024:468,2025:468,2026:468},
    color:"#F59E0B"},
  { ticker:"LNBB", name:"Loterie Nat. Bénin", country:"Bénin", sector:"Divertissement", flag:"🇧🇯",
    per:8.3, mktcap:45,
    prices:{2015:0,2016:0,2017:0,2018:0,2019:0,2020:0,2021:0,2022:0,2023:0,2024:3700,2025:3850,2026:3990},
    dividends:{2015:0,2016:0,2017:0,2018:0,2019:0,2020:0,2021:0,2022:0,2023:220,2024:275,2025:275,2026:275},
    color:"#22C55E"},
  { ticker:"BICB", name:"BIIC Bénin", country:"Bénin", sector:"Banques", flag:"🇧🇯",
    per:11.5, mktcap:180,
    prices:{2015:0,2016:0,2017:0,2018:0,2019:0,2020:0,2021:0,2022:0,2023:0,2024:0,2025:5250,2026:5190},
    dividends:{2015:0,2016:0,2017:0,2018:0,2019:0,2020:0,2021:0,2022:0,2023:0,2024:0,2025:0,2026:0},
    color:"#EC4899"},
  { ticker:"SGBC", name:"SGB CI", country:"Côte d'Ivoire", sector:"Banques", flag:"🇨🇮",
    per:9.8, mktcap:590,
    prices:{2015:15000,2016:18000,2017:21000,2018:24000,2019:26000,2020:28000,2021:32000,2022:34000,2023:35000,2024:36500,2025:36000,2026:36600},
    dividends:{2015:450,2016:550,2017:650,2018:750,2019:820,2020:900,2021:1100,2022:1400,2023:1646,2024:2293,2025:2293,2026:2293},
    color:"#3B82F6"},
  { ticker:"NSBC", name:"NSIA Banque CI", country:"Côte d'Ivoire", sector:"Banques", flag:"🇨🇮",
    per:11.2, mktcap:280,
    prices:{2015:6000,2016:7500,2017:9000,2018:10500,2019:11500,2020:12000,2021:14000,2022:15500,2023:17000,2024:18000,2025:18000,2026:18000},
    dividends:{2015:130,2016:170,2017:200,2018:240,2019:265,2020:290,2021:380,2022:470,2023:530,2024:668,2025:668,2026:668},
    color:"#06B6D4"},
  { ticker:"ECOC", name:"Ecobank CI", country:"Côte d'Ivoire", sector:"Banques", flag:"🇨🇮",
    per:10.1, mktcap:195,
    prices:{2015:5500,2016:7000,2017:8500,2018:10000,2019:10500,2020:11000,2021:13000,2022:14500,2023:15500,2024:16200,2025:16300,2026:16300},
    dividends:{2015:170,2016:220,2017:270,2018:320,2019:355,2020:380,2021:450,2022:530,2023:600,2024:708,2025:708,2026:708},
    color:"#84CC16"},
  { ticker:"STBC", name:"SITAB CI", country:"Côte d'Ivoire", sector:"Conso. Base", flag:"🇨🇮",
    per:8.59, mktcap:105,
    prices:{2015:6000,2016:7000,2017:8500,2018:9500,2019:10500,2020:12000,2021:15000,2022:18000,2023:19000,2024:20000,2025:21000,2026:21290},
    dividends:{2015:320,2016:380,2017:460,2018:530,2019:600,2020:675,2021:900,2022:1200,2023:1500,2024:2096,2025:2096,2026:2096},
    color:"#F97316"},
  { ticker:"SLBC", name:"Solibra CI", country:"Côte d'Ivoire", sector:"Conso. Base", flag:"🇨🇮",
    per:13.5, mktcap:490,
    prices:{2015:18000,2016:20000,2017:23000,2018:25000,2019:27000,2020:30000,2021:34000,2022:36000,2023:37000,2024:38000,2025:38000,2026:38010},
    dividends:{2015:400,2016:480,2017:560,2018:620,2019:660,2020:700,2021:800,2022:900,2023:950,2024:1074,2025:1074,2026:1074},
    color:"#EAB308"},
  { ticker:"BOABF", name:"BOA Burkina", country:"Burkina Faso", sector:"Banques", flag:"🇧🇫",
    per:9.13, mktcap:80,
    prices:{2015:1500,2016:1800,2017:2200,2018:2600,2019:2900,2020:3200,2021:3800,2022:4400,2023:5000,2024:5300,2025:5500,2026:5500},
    dividends:{2015:80,2016:100,2017:125,2018:155,2019:185,2020:220,2021:280,2022:320,2023:370,2024:428,2025:428,2026:428},
    color:"#8B5CF6"},
  { ticker:"SDCC", name:"SODE CI", country:"Côte d'Ivoire", sector:"Services Publics", flag:"🇨🇮",
    per:7.8, mktcap:180,
    prices:{2015:3000,2016:3500,2017:4200,2018:5000,2019:5800,2020:6500,2021:7500,2022:8500,2023:9500,2024:10500,2025:11000,2026:11105},
    dividends:{2015:90,2016:110,2017:135,2018:165,2019:195,2020:210,2021:260,2022:290,2023:352,2024:462,2025:462,2026:462},
    color:"#10B981"},
  { ticker:"SDSC", name:"Africa Global Log.", country:"Côte d'Ivoire", sector:"Industrie", flag:"🇨🇮",
    per:5.4, mktcap:24,
    prices:{2015:600,2016:650,2017:700,2018:750,2019:820,2020:900,2021:1000,2022:1200,2023:1400,2024:1550,2025:1680,2026:1690},
    dividends:{2015:15,2016:18,2017:22,2018:26,2019:30,2020:27,2021:34,2022:42,2023:50,2024:60,2025:60,2026:60},
    color:"#F43F5E"},
  { ticker:"PALC", name:"Palm CI", country:"Côte d'Ivoire", sector:"Conso. Base", flag:"🇨🇮",
    per:9.2, mktcap:115,
    prices:{2015:2200,2016:2600,2017:3200,2018:3800,2019:4200,2020:4500,2021:5500,2022:6500,2023:7000,2024:7500,2025:7800,2026:7800},
    dividends:{2015:80,2016:100,2017:130,2018:165,2019:190,2020:200,2021:280,2022:330,2023:390,2024:442,2025:442,2026:442},
    color:"#65A30D"},
  { ticker:"BOAN", name:"BOA Niger", country:"Niger", sector:"Banques", flag:"🇳🇪",
    per:7.9, mktcap:38,
    prices:{2015:1200,2016:1400,2017:1700,2018:2000,2019:2200,2020:2500,2021:2800,2022:3200,2023:3500,2024:3600,2025:3700,2026:3740},
    dividends:{2015:45,2016:58,2017:72,2018:88,2019:98,2020:100,2021:130,2022:165,2023:190,2024:209,2025:209,2026:209},
    color:"#0EA5E9"},
  { ticker:"TTLS", name:"TotalEnergies SN", country:"Sénégal", sector:"Énergie", flag:"🇸🇳",
    per:8.8, mktcap:42,
    prices:{2015:1400,2016:1600,2017:1800,2018:2000,2019:2100,2020:2200,2021:2500,2022:2800,2023:3000,2024:3100,2025:3200,2026:3200},
    dividends:{2015:80,2016:95,2017:110,2018:125,2019:133,2020:140,2021:160,2022:185,2023:200,2024:222,2025:222,2026:222},
    color:"#FB923C"},
  { ticker:"NTLC", name:"Nestle CI", country:"Côte d'Ivoire", sector:"Conso. Base", flag:"🇨🇮",
    per:11.5, mktcap:165,
    prices:{2015:5000,2016:6000,2017:7000,2018:8000,2019:8800,2020:9000,2021:10000,2022:11000,2023:12000,2024:13000,2025:13000,2026:13005},
    dividends:{2015:200,2016:250,2017:300,2018:350,2019:380,2020:400,2021:500,2022:600,2023:675,2024:722,2025:722,2026:722},
    color:"#A78BFA"},
  { ticker:"BOAS", name:"BOA Sénégal", country:"Sénégal", sector:"Banques", flag:"🇸🇳",
    per:10.3, mktcap:85,
    prices:{2015:2800,2016:3200,2017:3800,2018:4200,2019:4600,2020:5000,2021:5800,2022:6500,2023:7000,2024:7500,2025:7700,2026:7745},
    dividends:{2015:70,2016:88,2017:108,2018:128,2019:140,2020:150,2021:200,2022:260,2023:310,2024:350,2025:350,2026:350},
    color:"#34D399"},
];

const YEARS = [2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025,2026];
const SECTORS = ["Tous", ...Array.from(new Set(COMPANIES_FULL.map(c => c.sector)))];

// ── LINEAR REGRESSION PROJECTION ────────────────────────────────────────────
function linearRegression(data) {
  const n = data.length;
  const xs = data.map((_,i) => i);
  const ys = data;
  const sumX = xs.reduce((a,b) => a+b, 0);
  const sumY = ys.reduce((a,b) => a+b, 0);
  const sumXY = xs.reduce((a,x,i) => a + x*ys[i], 0);
  const sumX2 = xs.reduce((a,x) => a + x*x, 0);
  const m = (n*sumXY - sumX*sumY) / (n*sumX2 - sumX*sumX);
  const b = (sumY - m*sumX) / n;
  return { m, b };
}

function projectPrices(company, futureYears = 5) {
  const validPrices = YEARS.map(y => company.prices[y]).filter(p => p > 0);
  if (validPrices.length < 2) return [];
  const { m, b } = linearRegression(validPrices);
  const lastYear = YEARS[YEARS.filter(y => company.prices[y] > 0).length - 1 + (YEARS.indexOf(YEARS.filter(y => company.prices[y] > 0)[0]))];
  const lastIdx = validPrices.length - 1;
  return Array.from({length: futureYears}, (_, i) => ({
    year: 2026 + i + 1,
    projected: Math.max(0, Math.round(b + m * (lastIdx + i + 1))),
    optimistic: Math.max(0, Math.round((b + m * (lastIdx + i + 1)) * 1.15)),
    pessimistic: Math.max(0, Math.round((b + m * (lastIdx + i + 1)) * 0.85)),
  }));
}

// ── METRICS ─────────────────────────────────────────────────────────────────
function calcMetrics(co) {
  const validPrices = YEARS.filter(y => co.prices[y] > 0).map(y => co.prices[y]);
  const validDivs = YEARS.filter(y => co.dividends[y] > 0).map(y => co.dividends[y]);
  const perf5 = validPrices.length >= 6
    ? ((validPrices[validPrices.length-1] - validPrices[validPrices.length-6]) / validPrices[validPrices.length-6] * 100).toFixed(1)
    : "N/D";
  const perf10 = validPrices.length >= 10
    ? ((validPrices[validPrices.length-1] - validPrices[0]) / validPrices[0] * 100).toFixed(1)
    : "N/D";
  const avgDiv = validDivs.length ? (validDivs.reduce((a,b)=>a+b,0)/validDivs.length).toFixed(0) : 0;
  const currentPrice = co.prices[2026] || co.prices[2025] || 0;
  const currentDiv = co.dividends[2026] || co.dividends[2025] || 0;
  const yield_ = currentPrice > 0 ? (currentDiv / currentPrice * 100).toFixed(2) : 0;
  const perfs = [];
  YEARS.slice(1).forEach((y,i) => {
    const p = co.prices[YEARS[i]]; const q = co.prices[y];
    if (p > 0 && q > 0) perfs.push(Math.abs((q-p)/p*100));
  });
  const volat = perfs.length ? (perfs.reduce((a,b)=>a+b,0)/perfs.length).toFixed(1) : "N/D";
  const risk = parseFloat(volat) < 10 ? "Faible" : parseFloat(volat) < 20 ? "Moyen" : "Élevé";
  let score = 0;
  if (perf5 !== "N/D") score += Math.min(30, parseFloat(perf5)/3);
  score += Math.min(25, parseFloat(yield_)*3);
  score += validDivs.length/12*20;
  score += co.per < 8 ? 15 : co.per < 10 ? 10 : co.per < 12 ? 6 : 3;
  score += risk === "Faible" ? 10 : risk === "Moyen" ? 6 : 2;
  score = Math.min(100, Math.round(score));
  const sig = score >= 80 ? {label:"ACHAT FORT",color:"#22C55E"} : score >= 65 ? {label:"ACHAT",color:"#84CC16"} : score >= 50 ? {label:"CONSERVER",color:"#D4A843"} : score >= 35 ? {label:"ALLÉGER",color:"#F97316"} : {label:"VENDRE",color:"#EF4444"};
  return { perf5, perf10, avgDiv, yield_, volat, risk, score, sig, currentPrice, currentDiv };
}

// ── EXCEL EXPORT ─────────────────────────────────────────────────────────────
function exportToExcel(companies, lastUpdate) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Données complètes
  const headers = ["Ticker","Société","Pays","Secteur","PER","Cap.(Mds FCFA)",
    ...YEARS.flatMap(y => [`Cours ${y}`,`Div. ${y}`]),
    "Score","Signal","Perf.5ans(%)","Perf.10ans(%)","Rend.Div.(%)","Volatilité","Risque"];
  const rows = companies.map(co => {
    const m = calcMetrics(co);
    return [co.ticker, co.name, co.country, co.sector, co.per, co.mktcap,
      ...YEARS.flatMap(y => [co.prices[y]||0, co.dividends[y]||0]),
      m.score, m.sig.label, m.perf5, m.perf10, m.yield_, m.volat, m.risk];
  });
  const ws1 = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws1["!cols"] = headers.map((_,i) => ({wch: i < 6 ? 18 : 12}));
  XLSX.utils.book_append_sheet(wb, ws1, "Données BRVM");

  // Sheet 2: Projections
  const ph = ["Ticker","Société","2027 Proj.","2027 Opt.","2027 Pess.","2028 Proj.","2028 Opt.","2028 Pess.","2029 Proj.","2030 Proj.","2031 Proj."];
  const prows = companies.map(co => {
    const proj = projectPrices(co, 5);
    return [co.ticker, co.name,
      ...[0,0,1,1,2,2].map((i,j) => j%2===0 ? proj[i]?.projected||0 : proj[i]?.optimistic||0),
      proj[2]?.pessimistic||0, proj[3]?.projected||0, proj[4]?.projected||0];
  });
  const ws2 = XLSX.utils.aoa_to_sheet([ph, ...prows]);
  XLSX.utils.book_append_sheet(wb, ws2, "Projections");

  // Sheet 3: Classements
  const sorted = [...companies].sort((a,b) => calcMetrics(b).score - calcMetrics(a).score);
  const rh = ["Rang","Ticker","Société","Secteur","Score","Signal","Perf.5ans","Rend.Div.","Risque"];
  const rrows = sorted.map((co,i) => {
    const m = calcMetrics(co);
    return [i+1, co.ticker, co.name, co.sector, m.score, m.sig.label, m.perf5, m.yield_, m.risk];
  });
  const ws3 = XLSX.utils.aoa_to_sheet([rh, ...rrows]);
  XLSX.utils.book_append_sheet(wb, ws3, "Classements");

  XLSX.writeFile(wb, `BRVM_Analyse_${lastUpdate.replace(/\//g,"-")}.xlsx`);
}

// ── CUSTOM TOOLTIP ────────────────────────────────────────────────────────────
const ChartTip = ({active, payload, label}) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{background:"#0D1117",border:`1px solid ${C.border}`,borderRadius:6,padding:"10px 14px",fontSize:12}}>
      <div style={{color:C.gold,fontWeight:700,marginBottom:6}}>{label}</div>
      {payload.map(p => <div key={p.name} style={{color:p.color||C.text,marginBottom:2}}>{p.name}: {typeof p.value==="number"?p.value.toLocaleString("fr-FR"):p.value}</div>)}
    </div>
  );
};

// ── MAIN APP ─────────────────────────────────────────────────────────────────
export default function BRVMDashboard() {
  const [selectedTicker, setSelectedTicker] = useState("SNTS");
  const [tab, setTab] = useState("overview"); // overview | chart | projection | comparison
  const [sectorFilter, setSectorFilter] = useState("Tous");
  const [sortBy, setSortBy] = useState("score");
  const [showProj, setShowProj] = useState(true);
  const [compSelected, setCompSelected] = useState(["SNTS","CBIBF","SGBC"]);
  const [lastUpdate, setLastUpdate] = useState(new Date().toLocaleDateString("fr-FR"));
  const [refreshing, setRefreshing] = useState(false);
  const [projYears, setProjYears] = useState(5);

  const company = COMPANIES_FULL.find(c => c.ticker === selectedTicker);
  const metrics = company ? calcMetrics(company) : null;
  const projections = company ? projectPrices(company, projYears) : [];

  const filteredCompanies = COMPANIES_FULL
    .filter(c => sectorFilter === "Tous" || c.sector === sectorFilter)
    .sort((a,b) => {
      if (sortBy === "score") return calcMetrics(b).score - calcMetrics(a).score;
      if (sortBy === "perf5") return parseFloat(calcMetrics(b).perf5||0) - parseFloat(calcMetrics(a).perf5||0);
      if (sortBy === "yield") return parseFloat(calcMetrics(b).yield_||0) - parseFloat(calcMetrics(a).yield_||0);
      return 0;
    });

  // Build chart data for selected company
  const chartData = YEARS
    .filter(y => company && company.prices[y] > 0)
    .map(y => ({
      year: y, cours: company.prices[y], dividende: company.dividends[y]||0,
      type: "historique"
    }));

  const projChartData = showProj ? projections.map(p => ({
    year: p.year, projected: p.projected, optimistic: p.optimistic, pessimistic: p.pessimistic, type:"projection"
  })) : [];

  const allChartData = [...chartData, ...projChartData];

  // Comparison data
  const compData = YEARS.map(y => {
    const obj = {year: y};
    compSelected.forEach(t => {
      const co = COMPANIES_FULL.find(c => c.ticker === t);
      if (co && co.prices[y] > 0) {
        const firstValid = YEARS.find(fy => co.prices[fy] > 0);
        obj[t] = firstValid ? Math.round(co.prices[y] / co.prices[firstValid] * 100) : 0;
      }
    });
    return obj;
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await new Promise(r => setTimeout(r, 1500));
    setLastUpdate(new Date().toLocaleDateString("fr-FR"));
    setRefreshing(false);
  };

  const toggleComp = (t) => {
    setCompSelected(prev => prev.includes(t)
      ? prev.filter(x => x !== t)
      : [...prev.slice(-2), t]);
  };

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div style={{background:C.bg, minHeight:"100vh", color:C.text, fontFamily:"'Trebuchet MS', Georgia, serif"}}>

      {/* ── TOP BAR ── */}
      <div style={{background:C.panel, borderBottom:`1px solid ${C.border}`, padding:"12px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10}}>
        <div>
          <div style={{fontSize:"0.6rem", letterSpacing:"0.35em", color:C.gold, textTransform:"uppercase"}}>Bourse Régionale des Valeurs Mobilières</div>
          <div style={{fontSize:"1.4rem", fontWeight:700, color:C.text, letterSpacing:"-0.02em"}}>BRVM Dashboard — Analyse 10 ans</div>
        </div>
        <div style={{display:"flex", gap:10, alignItems:"center", flexWrap:"wrap"}}>
          <div style={{fontSize:"0.72rem", color:C.textDim}}>Dernière MAJ : <span style={{color:C.gold}}>{lastUpdate}</span></div>
          <button onClick={handleRefresh} disabled={refreshing} style={{
            background: refreshing ? C.border : C.gold, color: refreshing ? C.textDim : "#000",
            border:"none", borderRadius:4, padding:"7px 16px", fontWeight:700, fontSize:"0.78rem",
            cursor: refreshing ? "not-allowed" : "pointer", display:"flex", alignItems:"center", gap:6,
            transition:"all 0.2s"
          }}>
            {refreshing ? "⟳ Actualisation..." : "⟳ Actualiser les données"}
          </button>
          <button onClick={() => exportToExcel(COMPANIES_FULL, lastUpdate)} style={{
            background:"transparent", color:C.green, border:`1px solid ${C.green}`,
            borderRadius:4, padding:"7px 16px", fontWeight:700, fontSize:"0.78rem", cursor:"pointer"
          }}>
            ↓ Exporter Excel
          </button>
        </div>
      </div>

      {/* ── MARKET KPIs ── */}
      <div style={{display:"flex", gap:10, padding:"12px 20px", flexWrap:"wrap", borderBottom:`1px solid ${C.border}`}}>
        {[
          {l:"Sociétés cotées", v:`${COMPANIES_FULL.length}`, c:C.blue},
          {l:"Capitalisation totale", v:`${COMPANIES_FULL.reduce((a,b)=>a+b.mktcap,0).toLocaleString()} Mds FCFA`, c:C.gold},
          {l:"Rend. moyen marché", v:`${(COMPANIES_FULL.map(c=>parseFloat(calcMetrics(c).yield_)).reduce((a,b)=>a+b,0)/COMPANIES_FULL.length).toFixed(2)}%`, c:C.green},
          {l:"Perf. moy. 5 ans", v:`+${(COMPANIES_FULL.map(c=>parseFloat(calcMetrics(c).perf5||0)).filter(v=>v>0).reduce((a,b)=>a+b,0)/COMPANIES_FULL.filter(c=>calcMetrics(c).perf5!=="N/D").length).toFixed(1)}%`, c:C.teal},
          {l:"Signaux ACHAT", v:`${COMPANIES_FULL.filter(c=>calcMetrics(c).score>=65).length}`, c:C.green},
          {l:"Horizon données", v:"2015 → 2031", c:C.purple},
        ].map(k => (
          <div key={k.l} style={{background:C.panel, border:`1px solid ${C.border}`, borderRadius:6, padding:"8px 14px", flex:"1 1 140px"}}>
            <div style={{fontSize:"0.6rem", color:C.textDim, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:3}}>{k.l}</div>
            <div style={{fontSize:"1.05rem", fontWeight:700, color:k.c}}>{k.v}</div>
          </div>
        ))}
      </div>

      <div style={{display:"flex", gap:0, height:"calc(100vh - 160px)", minHeight:600}}>

        {/* ── LEFT SIDEBAR — COMPANY LIST ── */}
        <div style={{width:220, background:C.panel, borderRight:`1px solid ${C.border}`, display:"flex", flexDirection:"column", flexShrink:0}}>
          {/* Filters */}
          <div style={{padding:"10px 12px", borderBottom:`1px solid ${C.border}`}}>
            <select value={sectorFilter} onChange={e=>setSectorFilter(e.target.value)} style={{
              width:"100%", background:C.bg, color:C.text, border:`1px solid ${C.border}`,
              borderRadius:4, padding:"5px 8px", fontSize:"0.72rem", marginBottom:6
            }}>
              {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{
              width:"100%", background:C.bg, color:C.text, border:`1px solid ${C.border}`,
              borderRadius:4, padding:"5px 8px", fontSize:"0.72rem"
            }}>
              <option value="score">Trier par Score</option>
              <option value="perf5">Trier par Perf. 5 ans</option>
              <option value="yield">Trier par Dividende</option>
            </select>
          </div>

          {/* Company list */}
          <div style={{overflowY:"auto", flex:1}}>
            {filteredCompanies.map(co => {
              const m = calcMetrics(co);
              const isSelected = co.ticker === selectedTicker;
              return (
                <div key={co.ticker} onClick={() => setSelectedTicker(co.ticker)}
                  style={{
                    padding:"8px 12px", cursor:"pointer", borderBottom:`1px solid ${C.border}`,
                    background: isSelected ? "#1C2333" : "transparent",
                    borderLeft: isSelected ? `3px solid ${co.color}` : "3px solid transparent",
                    transition:"all 0.15s"
                  }}>
                  <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                    <div>
                      <span style={{fontSize:"0.65rem", color:co.color, fontWeight:700}}>{co.ticker}</span>
                      <span style={{fontSize:"0.65rem", color:C.textDim, marginLeft:4}}>{co.flag}</span>
                    </div>
                    <div style={{fontSize:"0.65rem", fontWeight:700, color:m.sig.color, background:`${m.sig.color}20`, padding:"1px 5px", borderRadius:3}}>
                      {m.score}
                    </div>
                  </div>
                  <div style={{fontSize:"0.68rem", color:C.silver, marginTop:2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{co.name}</div>
                  <div style={{display:"flex", gap:6, marginTop:3}}>
                    <span style={{fontSize:"0.6rem", color:m.perf5 > 0 ? C.green : C.red}}>
                      {m.perf5 !== "N/D" ? `${m.perf5 > 0?"+":""}${m.perf5}%` : "N/D"}
                    </span>
                    <span style={{fontSize:"0.6rem", color:C.textDim}}>•</span>
                    <span style={{fontSize:"0.6rem", color:C.teal}}>{m.yield_}%div</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── MAIN CONTENT ── */}
        <div style={{flex:1, display:"flex", flexDirection:"column", overflow:"hidden"}}>

          {/* Tab bar */}
          <div style={{display:"flex", gap:0, borderBottom:`1px solid ${C.border}`, background:C.panel}}>
            {[
              {id:"overview", label:"📊 Vue d'ensemble"},
              {id:"chart", label:"📈 Courbe historique"},
              {id:"projection", label:"🔮 Projection future"},
              {id:"comparison", label:"⚖️ Comparaison"},
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                background: tab===t.id ? C.bg : "transparent",
                color: tab===t.id ? C.gold : C.textDim,
                border:"none", borderBottom: tab===t.id ? `2px solid ${C.gold}` : "2px solid transparent",
                padding:"10px 16px", cursor:"pointer", fontSize:"0.78rem", fontWeight: tab===t.id ? 700 : 400,
                transition:"all 0.15s"
              }}>{t.label}</button>
            ))}
          </div>

          <div style={{flex:1, overflowY:"auto", padding:16}}>

            {/* ── OVERVIEW TAB ── */}
            {tab === "overview" && company && metrics && (
              <div>
                {/* Company header */}
                <div style={{background:C.panel, border:`1px solid ${C.border}`, borderRadius:8, padding:16, marginBottom:16, display:"flex", gap:20, flexWrap:"wrap", alignItems:"center"}}>
                  <div style={{borderLeft:`4px solid ${company.color}`, paddingLeft:12}}>
                    <div style={{fontSize:"1.6rem", fontWeight:700, color:C.text}}>{company.name}</div>
                    <div style={{color:C.textDim, fontSize:"0.78rem"}}>{company.flag} {company.country} · {company.sector}</div>
                    <div style={{fontSize:"1.3rem", fontWeight:700, color:C.gold, marginTop:4}}>
                      {metrics.currentPrice.toLocaleString("fr-FR")} FCFA
                    </div>
                  </div>
                  <div style={{display:"flex", gap:10, flexWrap:"wrap", flex:1}}>
                    {[
                      {l:"Score", v:`${metrics.score}/100`, c:metrics.sig.color},
                      {l:"Signal", v:metrics.sig.label, c:metrics.sig.color},
                      {l:"Perf. 5 ans", v:`${metrics.perf5 > 0 ? "+" : ""}${metrics.perf5}%`, c: metrics.perf5 > 0 ? C.green : C.red},
                      {l:"Perf. 10 ans", v:`${metrics.perf10 > 0 ? "+" : ""}${metrics.perf10}%`, c: metrics.perf10 > 0 ? C.green : C.red},
                      {l:"Rendement div.", v:`${metrics.yield_}%`, c:C.teal},
                      {l:"PER", v:company.per, c:C.blue},
                      {l:"Volatilité", v:`${metrics.volat}%`, c:C.silver},
                      {l:"Risque", v:metrics.risk, c:metrics.risk==="Faible"?C.green:metrics.risk==="Moyen"?C.gold:C.red},
                    ].map(k => (
                      <div key={k.l} style={{background:C.bg, border:`1px solid ${C.border}`, borderRadius:5, padding:"7px 12px", minWidth:90}}>
                        <div style={{fontSize:"0.58rem", color:C.textDim, textTransform:"uppercase", letterSpacing:"0.08em"}}>{k.l}</div>
                        <div style={{fontSize:"0.88rem", fontWeight:700, color:k.c}}>{k.v}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Historical data table */}
                <div style={{background:C.panel, border:`1px solid ${C.border}`, borderRadius:8, padding:14, marginBottom:16}}>
                  <div style={{fontSize:"0.75rem", fontWeight:700, color:C.gold, marginBottom:10, textTransform:"uppercase", letterSpacing:"0.1em"}}>Historique 10 ans (2015 → 2026)</div>
                  <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%", borderCollapse:"collapse", fontSize:"0.73rem"}}>
                      <thead>
                        <tr>
                          {["Année","Cours (FCFA)","Dividende","Perf. annuelle","Rend. Div.","Variation"].map(h => (
                            <th key={h} style={{padding:"6px 10px", textAlign:"right", color:C.textDim, borderBottom:`1px solid ${C.border}`, fontWeight:600, fontSize:"0.65rem", textTransform:"uppercase"}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {YEARS.filter(y => company.prices[y] > 0).map((y,i,arr) => {
                          const prev = i > 0 ? company.prices[arr[i-1]] : null;
                          const perf = prev ? ((company.prices[y]-prev)/prev*100).toFixed(1) : null;
                          const rend = company.prices[y] > 0 && company.dividends[y] > 0
                            ? (company.dividends[y]/company.prices[y]*100).toFixed(2) : null;
                          return (
                            <tr key={y} style={{borderBottom:`1px solid ${C.border}20`, background: y%2===0?"#0F141E":"transparent"}}>
                              <td style={{padding:"6px 10px", textAlign:"right", color:C.gold, fontWeight:700}}>{y}</td>
                              <td style={{padding:"6px 10px", textAlign:"right", color:C.text, fontVariantNumeric:"tabular-nums"}}>{company.prices[y].toLocaleString("fr-FR")}</td>
                              <td style={{padding:"6px 10px", textAlign:"right", color:C.teal}}>{company.dividends[y] > 0 ? company.dividends[y].toLocaleString("fr-FR") : "—"}</td>
                              <td style={{padding:"6px 10px", textAlign:"right", color: perf ? (parseFloat(perf)>=0?C.green:C.red) : C.textDim, fontWeight: perf ? 700 : 400}}>
                                {perf ? `${parseFloat(perf)>=0?"+":""}${perf}%` : "—"}
                              </td>
                              <td style={{padding:"6px 10px", textAlign:"right", color:C.teal}}>{rend ? `${rend}%` : "—"}</td>
                              <td style={{padding:"6px 10px", textAlign:"right"}}>
                                {perf && (
                                  <div style={{display:"inline-block", height:6, width:`${Math.min(80, Math.abs(parseFloat(perf))*3)}px`,
                                    background: parseFloat(perf)>=0?"#22C55E40":"#EF444440",
                                    border:`1px solid ${parseFloat(perf)>=0?C.green:C.red}`,
                                    borderRadius:2}} />
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mini chart */}
                <div style={{background:C.panel, border:`1px solid ${C.border}`, borderRadius:8, padding:14}}>
                  <div style={{fontSize:"0.75rem", fontWeight:700, color:C.gold, marginBottom:10}}>Aperçu cours & dividendes</div>
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={chartData} margin={{top:5,right:10,left:0,bottom:5}}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                      <XAxis dataKey="year" tick={{fill:C.textDim, fontSize:10}} axisLine={false} tickLine={false} />
                      <YAxis tick={{fill:C.textDim, fontSize:10}} axisLine={false} tickLine={false} width={60}
                        tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                      <Tooltip content={<ChartTip />} />
                      <defs>
                        <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={company.color} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={company.color} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="cours" name="Cours" stroke={company.color} fill="url(#cg)" strokeWidth={2} dot={false}/>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* ── CHART TAB ── */}
            {tab === "chart" && company && (
              <div>
                <div style={{fontSize:"0.75rem", fontWeight:700, color:C.gold, marginBottom:12}}>
                  Historique complet {company.name} ({company.ticker}) — 2015 à 2026
                </div>
                <div style={{background:C.panel, border:`1px solid ${C.border}`, borderRadius:8, padding:16, marginBottom:16}}>
                  <div style={{fontSize:"0.65rem", color:C.textDim, marginBottom:8}}>Évolution du cours (FCFA)</div>
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={chartData} margin={{top:10,right:20,left:10,bottom:5}}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                      <XAxis dataKey="year" tick={{fill:C.textDim, fontSize:11}} axisLine={false} tickLine={false} />
                      <YAxis tick={{fill:C.textDim, fontSize:10}} axisLine={false} tickLine={false} width={65}
                        tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                      <Tooltip content={<ChartTip />} />
                      <defs>
                        <linearGradient id="cg2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={company.color} stopOpacity={0.4}/>
                          <stop offset="95%" stopColor={company.color} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="cours" name="Cours FCFA" stroke={company.color}
                        fill="url(#cg2)" strokeWidth={2.5} dot={{r:4, fill:company.color, strokeWidth:0}} activeDot={{r:6}} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div style={{background:C.panel, border:`1px solid ${C.border}`, borderRadius:8, padding:16, marginBottom:16}}>
                  <div style={{fontSize:"0.65rem", color:C.textDim, marginBottom:8}}>Dividendes distribués par an (FCFA/action)</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={chartData.filter(d => d.dividende > 0)} margin={{top:5,right:20,left:10,bottom:5}}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                      <XAxis dataKey="year" tick={{fill:C.textDim, fontSize:11}} axisLine={false} tickLine={false} />
                      <YAxis tick={{fill:C.textDim, fontSize:10}} axisLine={false} tickLine={false} width={60} />
                      <Tooltip content={<ChartTip />} />
                      <Bar dataKey="dividende" name="Dividende" fill={C.teal} radius={[3,3,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div style={{background:C.panel, border:`1px solid ${C.border}`, borderRadius:8, padding:16}}>
                  <div style={{fontSize:"0.65rem", color:C.textDim, marginBottom:8}}>Performance annuelle (%)</div>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={YEARS.filter(y => company.prices[y] > 0).slice(1).map((y,i,arr) => {
                      const prevY = YEARS.filter(yr => company.prices[yr] > 0)[i];
                      const perf = ((company.prices[y] - company.prices[prevY]) / company.prices[prevY] * 100);
                      return {year: y, performance: parseFloat(perf.toFixed(1))};
                    })} margin={{top:5,right:20,left:10,bottom:5}}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                      <XAxis dataKey="year" tick={{fill:C.textDim, fontSize:11}} axisLine={false} tickLine={false} />
                      <YAxis tick={{fill:C.textDim, fontSize:10}} axisLine={false} tickLine={false} width={40} />
                      <Tooltip content={<ChartTip />} />
                      <ReferenceLine y={0} stroke={C.border} strokeWidth={2} />
                      <Bar dataKey="performance" name="Perf. %" radius={[3,3,0,0]}
                        fill={C.green}
                        label={{position:"top", fill:C.textDim, fontSize:9}}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* ── PROJECTION TAB ── */}
            {tab === "projection" && company && (
              <div>
                <div style={{display:"flex", gap:10, alignItems:"center", marginBottom:12, flexWrap:"wrap"}}>
                  <div style={{fontSize:"0.75rem", fontWeight:700, color:C.gold}}>
                    Projection {company.name} — Régression linéaire sur données historiques
                  </div>
                  <div style={{display:"flex", gap:6, alignItems:"center"}}>
                    <span style={{fontSize:"0.65rem", color:C.textDim}}>Horizon :</span>
                    {[3,5,7,10].map(y => (
                      <button key={y} onClick={() => setProjYears(y)} style={{
                        background: projYears===y ? C.gold : "transparent",
                        color: projYears===y ? "#000" : C.textDim,
                        border:`1px solid ${projYears===y ? C.gold : C.border}`,
                        borderRadius:3, padding:"3px 10px", cursor:"pointer", fontSize:"0.68rem"
                      }}>{y} ans</button>
                    ))}
                  </div>
                </div>

                <div style={{background:C.panel, border:`1px solid ${C.border}`, borderRadius:8, padding:16, marginBottom:16}}>
                  <div style={{fontSize:"0.65rem", color:C.textDim, marginBottom:8}}>
                    Historique + Projection (scénarios optimiste / central / pessimiste)
                  </div>
                  <ResponsiveContainer width="100%" height={320}>
                    <LineChart data={allChartData} margin={{top:10,right:20,left:10,bottom:5}}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                      <XAxis dataKey="year" tick={{fill:C.textDim, fontSize:11}} axisLine={false} tickLine={false} />
                      <YAxis tick={{fill:C.textDim, fontSize:10}} axisLine={false} tickLine={false} width={65}
                        tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                      <Tooltip content={<ChartTip />} />
                      <Legend wrapperStyle={{fontSize:"0.7rem", color:C.textDim}} />
                      <ReferenceLine x={2026} stroke={C.gold} strokeDasharray="4 4" label={{value:"Aujourd'hui", fill:C.gold, fontSize:10}} />
                      <Line type="monotone" dataKey="cours" name="Historique" stroke={company.color}
                        strokeWidth={2.5} dot={{r:3, fill:company.color}} connectNulls />
                      <Line type="monotone" dataKey="projected" name="Proj. centrale" stroke={C.silver}
                        strokeWidth={2} strokeDasharray="8 4" dot={{r:3, fill:C.silver}} connectNulls />
                      <Line type="monotone" dataKey="optimistic" name="Scénario optimiste" stroke={C.green}
                        strokeWidth={1.5} strokeDasharray="4 4" dot={false} connectNulls />
                      <Line type="monotone" dataKey="pessimistic" name="Scénario pessimiste" stroke={C.red}
                        strokeWidth={1.5} strokeDasharray="4 4" dot={false} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Projection table */}
                <div style={{background:C.panel, border:`1px solid ${C.border}`, borderRadius:8, padding:14}}>
                  <div style={{fontSize:"0.75rem", fontWeight:700, color:C.gold, marginBottom:10}}>Tableau de projection</div>
                  <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%", borderCollapse:"collapse", fontSize:"0.73rem"}}>
                      <thead>
                        <tr>
                          {["Année","Scénario central","Optimiste (+15%)","Pessimiste (-15%)","Potentiel (%)","Div. estimé"].map(h => (
                            <th key={h} style={{padding:"7px 10px", textAlign:"right", color:C.textDim, borderBottom:`1px solid ${C.border}`, fontSize:"0.65rem", textTransform:"uppercase"}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {projections.map(p => {
                          const pot = ((p.projected - metrics.currentPrice) / metrics.currentPrice * 100).toFixed(1);
                          const estDiv = metrics.currentDiv > 0
                            ? Math.round(metrics.currentDiv * (1 + 0.05 * (p.year - 2026)))
                            : "N/D";
                          return (
                            <tr key={p.year} style={{borderBottom:`1px solid ${C.border}20`}}>
                              <td style={{padding:"7px 10px", textAlign:"right", color:C.gold, fontWeight:700}}>{p.year}</td>
                              <td style={{padding:"7px 10px", textAlign:"right", color:C.silver, fontVariantNumeric:"tabular-nums"}}>{p.projected.toLocaleString("fr-FR")}</td>
                              <td style={{padding:"7px 10px", textAlign:"right", color:C.green}}>{p.optimistic.toLocaleString("fr-FR")}</td>
                              <td style={{padding:"7px 10px", textAlign:"right", color:C.red}}>{p.pessimistic.toLocaleString("fr-FR")}</td>
                              <td style={{padding:"7px 10px", textAlign:"right", color:parseFloat(pot)>=0?C.green:C.red, fontWeight:700}}>
                                {parseFloat(pot)>=0?"+":""}{pot}%
                              </td>
                              <td style={{padding:"7px 10px", textAlign:"right", color:C.teal}}>{typeof estDiv === "number" ? estDiv.toLocaleString("fr-FR") : estDiv}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div style={{marginTop:10, fontSize:"0.62rem", color:C.textDim, fontStyle:"italic"}}>
                    ⚠️ Projections basées sur la régression linéaire des données historiques. Non garanties. Scénarios ±15% par rapport à la tendance centrale.
                  </div>
                </div>
              </div>
            )}

            {/* ── COMPARISON TAB ── */}
            {tab === "comparison" && (
              <div>
                <div style={{fontSize:"0.75rem", fontWeight:700, color:C.gold, marginBottom:8}}>
                  Sélectionner jusqu'à 3 actions à comparer
                </div>
                <div style={{display:"flex", flexWrap:"wrap", gap:6, marginBottom:14}}>
                  {COMPANIES_FULL.map(co => {
                    const sel = compSelected.includes(co.ticker);
                    return (
                      <button key={co.ticker} onClick={() => toggleComp(co.ticker)} style={{
                        background: sel ? `${co.color}25` : "transparent",
                        color: sel ? co.color : C.textDim,
                        border:`1px solid ${sel ? co.color : C.border}`,
                        borderRadius:4, padding:"4px 10px", cursor:"pointer", fontSize:"0.68rem",
                        fontWeight: sel ? 700 : 400, transition:"all 0.15s"
                      }}>{co.flag} {co.ticker}</button>
                    );
                  })}
                </div>

                <div style={{background:C.panel, border:`1px solid ${C.border}`, borderRadius:8, padding:16, marginBottom:16}}>
                  <div style={{fontSize:"0.65rem", color:C.textDim, marginBottom:8}}>Performance relative (base 100 à l'introduction)</div>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={compData} margin={{top:10,right:20,left:10,bottom:5}}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                      <XAxis dataKey="year" tick={{fill:C.textDim, fontSize:11}} axisLine={false} tickLine={false} />
                      <YAxis tick={{fill:C.textDim, fontSize:10}} axisLine={false} tickLine={false} width={50} />
                      <Tooltip content={<ChartTip />} />
                      <Legend wrapperStyle={{fontSize:"0.7rem", color:C.textDim}} />
                      <ReferenceLine y={100} stroke={C.border} strokeDasharray="4 4" />
                      {compSelected.map(t => {
                        const co = COMPANIES_FULL.find(c => c.ticker === t);
                        return co ? <Line key={t} type="monotone" dataKey={t} name={`${co.flag} ${t}`}
                          stroke={co.color} strokeWidth={2.5} dot={{r:3}} connectNulls /> : null;
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Comparison metrics table */}
                <div style={{background:C.panel, border:`1px solid ${C.border}`, borderRadius:8, padding:14}}>
                  <div style={{fontSize:"0.75rem", fontWeight:700, color:C.gold, marginBottom:10}}>Métriques comparées</div>
                  <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%", borderCollapse:"collapse", fontSize:"0.73rem"}}>
                      <thead>
                        <tr>
                          {["Indicateur",...compSelected.map(t => {
                            const co = COMPANIES_FULL.find(c=>c.ticker===t);
                            return co ? `${co.flag} ${t}` : t;
                          })].map(h => (
                            <th key={h} style={{padding:"7px 12px", textAlign:"right", color:C.textDim, borderBottom:`1px solid ${C.border}`, fontSize:"0.65rem", textTransform:"uppercase"}}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          {l:"Cours actuel (FCFA)", fn: m => m.currentPrice.toLocaleString("fr-FR"), c:C.text},
                          {l:"Score (/100)", fn: m => m.score, c:null},
                          {l:"Signal", fn: m => m.sig.label, c:null},
                          {l:"Perf. 5 ans (%)", fn: m => `${m.perf5 > 0?"+":""}${m.perf5}%`, c:null},
                          {l:"Perf. 10 ans (%)", fn: m => m.perf10 !== "N/D" ? `${m.perf10 > 0?"+":""}${m.perf10}%` : "N/D", c:null},
                          {l:"Rendement div. (%)", fn: m => `${m.yield_}%`, c:C.teal},
                          {l:"PER", fn: (m, co) => co.per, c:C.blue},
                          {l:"Volatilité (%)", fn: m => `${m.volat}%`, c:null},
                          {l:"Risque", fn: m => m.risk, c:null},
                          {l:"Cap. boursière", fn: (m, co) => `${co.mktcap} Mds`, c:C.gold},
                        ].map((row,ri) => (
                          <tr key={row.l} style={{borderBottom:`1px solid ${C.border}20`, background: ri%2===0?"#0F141E":"transparent"}}>
                            <td style={{padding:"7px 12px", color:C.textDim, fontWeight:600}}>{row.l}</td>
                            {compSelected.map(t => {
                              const co = COMPANIES_FULL.find(c=>c.ticker===t);
                              const m = co ? calcMetrics(co) : null;
                              const v = co && m ? row.fn(m, co) : "—";
                              return <td key={t} style={{padding:"7px 12px", textAlign:"right", color:row.c||C.text, fontWeight: row.l==="Signal"?700:400}}>{v}</td>;
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{textAlign:"center", padding:"10px 20px", fontSize:"0.6rem", color:C.textDim, borderTop:`1px solid ${C.border}`, background:C.panel}}>
        Sources : BRVM BOC · Sikafinance · RichBourse · Rapports annuels sociétés · Mai 2026 — ⚠️ Analyse informative uniquement. Les projections ne constituent pas un conseil en investissement.
      </div>
    </div>
  );
}
