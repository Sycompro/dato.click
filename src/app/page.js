'use client';
import { useState, useEffect, useCallback } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, BarChart, Bar, Cell, Legend, LabelList
} from 'recharts';
import {
    Activity, TrendingUp, Users, Building2,
    DollarSign, BarChart3, Layers, Check, Calendar,
    ArrowUpRight, ArrowDownRight, Store, Gem, Dumbbell,
    Wine, Sparkles, MapPin, ShoppingBag, Receipt,
    Crown, Award, Medal, Hash, RefreshCw,
    FileText, File, FileCheck, FileWarning, Settings2, X,
    Briefcase, Warehouse, Building, Menu, Lock
} from 'lucide-react';
import SmartDatePicker from '@/components/SmartDatePicker';
import { useSession, signIn } from "next-auth/react";

const MONTHS_FULL = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MONTHS_SHORT = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const PALETTE = ['#4880f5','#7c5cfc','#06b6d4','#10b981','#f59e0b','#ec4899','#6366f1','#14b8a6','#f97316','#ef4444'];

const ICONS_MAP = {
    Building2, Store, Warehouse, Building, Briefcase, Award
};

const PERIODS = [
    { k: 'hourly', l: 'Por Hora' },
    { k: 'daily', l: 'Diario' },
    { k: 'weekly', l: 'Semanal' },
    { k: 'monthly', l: 'Mensual' },
    { k: 'annual', l: 'Anual' },
];

function fmt(v) {
    if (!v && v !== 0) return 'S/ 0.00';
    return 'S/ ' + Number(v).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtShort(v) {
    if (!v) return 'S/ 0';
    if (v >= 1000000) return `S/ ${(v/1000000).toFixed(1)}M`;
    if (v >= 1000) return `S/ ${(v/1000).toFixed(0)}k`;
    return `S/ ${v.toFixed(0)}`;
}
function numFmt(v) { return Number(v || 0).toLocaleString(); }

// Custom tooltip
function ChartTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="custom-tooltip">
            <div className="tooltip-label">{label}</div>
            {payload.map((p, i) => (
                <div key={i} className="tooltip-row">
                    <span className="tooltip-dot" style={{ background: p.color }}></span>
                    <span className="tooltip-name">{p.name}</span>
                    <span className="tooltip-val">{fmt(p.value)}</span>
                </div>
            ))}
        </div>
    );
}

export default function Dashboard() {
    const { data: session, status } = useSession();

    const [selectedDbs, setSelectedDbs] = useState(['BdNava00']);
    const [period, setPeriod] = useState('monthly');
    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    
    // ISO Date fallback
    const [exactDate, setExactDate] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    });
    const [weekStr, setWeekStr] = useState('2026-W16'); // Fallback

    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState('overview');

    const [allCompanies, setAllCompanies] = useState([]);
    const [visibleCompanies, setVisibleCompanies] = useState([]);
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useEffect(() => {
        let isMounted = true;
        fetch('/api/companies').then(r => r.json()).then(res => {
            if (res.success && res.data && isMounted) {
                const loaded = res.data.map(c => ({
                    ...c,
                    Icon: ICONS_MAP[c.iconStr] || Building2
                }));
                setAllCompanies(loaded);
                
                const saved = localStorage.getItem('dato_click_visible_companies');
                if (saved) {
                    try {
                        const parsed = JSON.parse(saved);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            setVisibleCompanies(parsed.filter(id => loaded.some(c => c.id === id)));
                        } else setVisibleCompanies(loaded.map(c => c.id));
                    } catch(e) { setVisibleCompanies(loaded.map(c => c.id)); }
                } else setVisibleCompanies(loaded.map(c => c.id));
            }
        });
        return () => isMounted = false;
    }, []);

    const selectOnlyDb = (id) => {
        setSelectedDbs([id]);
        setIsSidebarOpen(false); // Opcional: cerrar el sidebar en móvil
    };

    const toggleDb = (e, id) => {
        e.stopPropagation(); // Evita que se dispare el selectOnlyDb
        setSelectedDbs(prev => {
            if (prev.includes(id)) {
                if (prev.length === 1) return prev;
                return prev.filter(x => x !== id);
            }
            return [...prev, id];
        });
    };

    const toggleCompanyVisibility = (id) => {
        setVisibleCompanies(prev => {
            let next;
            if (prev.includes(id)) {
                if (prev.length === 1) return prev; // Siempre debe haber al menos 1
                next = prev.filter(x => x !== id);
                setSelectedDbs(s => s.includes(id) && s.length > 1 ? s.filter(x => x !== id) : s);
            } else {
                next = [...prev, id];
            }
            localStorage.setItem('dato_click_visible_companies', JSON.stringify(next));
            return next;
        });
    };

    const loadData = useCallback(() => {
        setLoading(true);
        setData([]); // Limpiar datos actuales para evitar confusión visual
        const ids = selectedDbs.join(',');
        let url = `/api/sales?ids=${ids}&period=${period}&year=${year}&month=${month}`;
        if (period === 'daily') url += `&exactDate=${exactDate}`;
        if (period === 'weekly') url += `&weekStr=${weekStr}`;
        
        fetch(url).then(r => r.json())
            .then(json => { 
                if (json.success) {
                    setData(json.data); 
                } else {
                    console.error("API Error:", json.error);
                    setData([]);
                }
            })
            .catch(err => {
                console.error("Fetch failure:", err);
                setData([]);
            })
            .finally(() => setLoading(false));
    }, [selectedDbs, period, year, month, exactDate, weekStr]);

    useEffect(() => { loadData(); }, [loadData]);

    const periodLabel = (() => {
        if (period === 'hourly') {
            if (month) return `Análisis de Horas Punta - ${MONTHS_FULL[month]} ${year}`;
            return `Análisis de Horas Punta - Año ${year}`;
        }
        if (period === 'daily') return exactDate;
        if (period === 'weekly') {
            const wParts = weekStr.split('-W');
            return `Semana ${wParts[1]}, ${wParts[0]}`;
        }
        if (period === 'monthly') return `${MONTHS_FULL[month]} ${year}`;
        if (period === 'annual') return `Año ${year}`;
        return '';
    })();

    const prevPeriodLabel = (() => {
        if (period === 'daily') return 'Día ant.';
        if (period === 'weekly') return 'Sem ant.';
        if (period === 'monthly') {
            const pm = month === 1 ? 12 : month - 1;
            const py = month === 1 ? year - 1 : year;
            return `${MONTHS_SHORT[pm]} ${py}`;
        }
        return `${year - 1}`;
    })();

    const trendTitle = (() => {
        if (period === 'daily') return `Ventas por Hora — ${exactDate}`;
        if (period === 'weekly') return `Ventas por Día — ${periodLabel}`;
        if (period === 'monthly') return `Ventas Diarias — ${MONTHS_FULL[month]} ${year}`;
        if (period === 'annual') return `Ventas Mensuales — ${year}`;
        return '';
    })();

    const mergedTrends = (() => {
        if (!data.length) return [];
        const allLabels = [...new Set(data.flatMap(d => d.trend.map(t => t.label)))].sort((a,b) => {
            if (period === 'daily') return parseInt(a.split(':')[0]) - parseInt(b.split(':')[0]);
            if (period === 'weekly') return 0; // SQL returns them in order
            
            const na = parseInt(a.replace(/\D/g,''));
            const nb = parseInt(b.replace(/\D/g,''));
            return na - nb;
        });
        return allLabels.map(label => {
            let displayName = label;
            if ((period === 'annual') && MONTHS_SHORT[parseInt(label.split('-').pop() || label)]) {
                displayName = MONTHS_SHORT[parseInt(label.split('-').pop() || label)];
            }
            if (period === 'daily' || period === 'weekly' || period === 'monthly') displayName = label;
            
            const point = { name: displayName };
            data.forEach(d => {
                const found = d.trend.find(t => t.label === label);
                point[d.name] = found ? found.neto : 0;
            });
            return point;
        });
    })();

    const totalKpi = data.reduce((acc, d) => ({
        neto: acc.neto + (d.kpi.neto || 0),
        igv: acc.igv + (d.kpi.igv || 0),
        ops: acc.ops + (d.kpi.ops || 0),
    }), { neto: 0, igv: 0, ops: 0 });
    totalKpi.ticket = totalKpi.ops > 0 ? totalKpi.neto / totalKpi.ops : 0;

    const totalPrevNeto = data.reduce((acc, d) => acc + (d.prevKpi?.neto || 0), 0);
    const totalGrowth = totalPrevNeto > 0 ? ((totalKpi.neto - totalPrevNeto) / totalPrevNeto * 100).toFixed(1) : 0;

    const availableYears = [...new Set(data.flatMap(d => d.availableYears || []))].sort((a,b) => b - a);

    // Consolidar doc types del total seleccionado
    const totalDocTypes = (() => {
        const map = {};
        data.forEach(d => {
            (d.docTypes || []).forEach(dt => {
                if (!map[dt.tipo]) map[dt.tipo] = { tipo: dt.tipo, codigo: dt.codigo, cantidad: 0, total: 0 };
                map[dt.tipo].cantidad += dt.cantidad;
                map[dt.tipo].total += dt.total;
            });
        });
        return Object.values(map).sort((a,b) => b.cantidad - a.cantidad);
    })();

    const docIcon = (code) => {
        if (code === '01') return FileText;
        if (code === '03') return File;
        if (code === '07') return FileWarning;
        if (code === '65') return ShoppingBag;
        return FileCheck;
    };
    const docColor = (code) => {
        if (code === '01') return { color: '#4880f5', bg: '#e8f0fe' };
        if (code === '03') return { color: '#10b981', bg: '#e6f7f0' };
        if (code === '07') return { color: '#ef4444', bg: '#fef2f2' };
        if (code === '08') return { color: '#f59e0b', bg: '#fef6e7' };
        if (code === '65') return { color: '#ec4899', bg: '#fce8f3' };
        return { color: '#6366f1', bg: '#f0ecff' };
    };

    const kpiCards = [
        { label: 'Ingreso Neto', value: fmt(totalKpi.neto), sub: periodLabel, Icon: DollarSign, color: '#fff', iconColor: '#4880f5', grad: 'linear-gradient(135deg, #4880f5, #6b9cfa)' },
        { label: 'Operaciones', value: numFmt(totalKpi.ops), sub: 'facturas emitidas', Icon: Receipt, color: '#fff', iconColor: '#7c5cfc', grad: 'linear-gradient(135deg, #7c5cfc, #a78bfa)' },
        { label: 'IGV', value: fmt(totalKpi.igv), sub: 'impuesto generado', Icon: Building2, color: '#fff', iconColor: '#f59e0b', grad: 'linear-gradient(135deg, #f59e0b, #fbbf24)' },
        { label: 'Ticket Prom.', value: fmt(totalKpi.ticket), sub: 'por operación', Icon: BarChart3, color: '#fff', iconColor: '#10b981', grad: 'linear-gradient(135deg, #10b981, #34d399)' },
    ];

    // --- SECURITY GUARDS ---
    if (status === "loading") {
        return (
            <div style={{display:'flex',height:'100vh',alignItems:'center',justifyContent:'center',background:'#f5f6fa'}}>
                <div style={{display:'flex',alignItems:'center',gap:'10px',color:'#4880f5',fontSize:'16px',fontWeight:'700'}}>
                    <RefreshCw className="animate-spin" size={24}/> Cargando...
                </div>
            </div>
        );
    }
    
    if (status === "unauthenticated" || !session) {
        return (
            <div style={{display:'flex',height:'100vh',alignItems:'center',justifyContent:'center',background:'linear-gradient(135deg, #f5f6fa 0%, #eef0f6 100%)'}}>
                <div style={{background:'#fff',padding:'48px 40px',borderRadius:'24px',boxShadow:'0 20px 40px rgba(16,24,64,0.08)',maxWidth:'420px',width:'100%',textAlign:'center'}}>
                    <div style={{width:'64px',height:'64px',borderRadius:'18px',background:'linear-gradient(135deg, #4880f5, #7c5cfc)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',margin:'0 auto 24px',boxShadow:'0 8px 24px rgba(72,128,245,0.3)'}}>
                        <Lock size={32}/>
                    </div>
                    <h1 style={{fontSize:'24px',fontWeight:'800',color:'#1a1d2e',letterSpacing:'-0.03em',marginBottom:'8px'}}>Acceso Restringido</h1>
                    <p style={{fontSize:'14px',color:'#6b7194',lineHeight:'1.6',marginBottom:'32px'}}>Estás intentando acceder a una zona protegida de <b>dato.click</b>.<br/>Inicia sesión con un correo autorizado para continuar.</p>
                    
                    <button onClick={() => signIn('google', { prompt: 'select_account' })} style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'12px',width:'100%',padding:'14px',borderRadius:'12px',border:'1.5px solid #e8ebf2',background:'#fff',color:'#1a1d2e',fontSize:'15px',fontWeight:'700',cursor:'pointer',boxShadow:'0 2px 8px rgba(0,0,0,0.04)',transition:'all 0.2s'}}>
                        <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" style={{width:'22px',height:'22px'}}/>
                        Continuar con Google
                    </button>
                    <div style={{marginTop:'24px',fontSize:'12px',color:'#8b90a7',fontWeight:'500'}}>Powered by Navasof ERP Intelligence</div>
                </div>
            </div>
        );
    }

    return (
        <div className="shell">
            {/* TOP NAV */}
            <header className="topnav">
                <div className="topnav-left">
                    <button className="mobile-menu-btn" onClick={() => setIsSidebarOpen(true)}>
                        <Menu size={20} />
                    </button>
                    <div className="brand">
                        <div className="brand-icon"><Activity size={17} /></div>
                        <span className="brand-name">dato<span className="brand-dot">.click</span></span>
                    </div>
                    <div className="nav-sep"></div>
                    <nav className="tab-nav">
                        {[{k:'overview',l:'Resumen'},{k:'compare',l:'Comparar'},{k:'detail',l:'Detalle'}].map(t => (
                            <button key={t.k} className={`tab ${view===t.k?'active':''}`} onClick={()=>setView(t.k)}>{t.l}</button>
                        ))}
                    </nav>
                </div>
                <div className="topnav-right">
                    <div className="period-switch">
                        {PERIODS.map(p => (
                            <button key={p.k} className={`sw ${period===p.k?'on':''}`} onClick={()=>setPeriod(p.k)}>{p.l}</button>
                        ))}
                    </div>
                    

                     {period === 'daily' && (
                         <SmartDatePicker 
                             mode="daily" 
                             value={exactDate} 
                             onChange={setExactDate} 
                         />
                     )}
                     {period === 'weekly' && (
                         <SmartDatePicker 
                             mode="weekly" 
                             value={weekStr} 
                             onChange={setWeekStr} 
                         />
                     )}
                     {period === 'monthly' && (
                         <SmartDatePicker 
                             mode="monthly" 
                             value={`${year}-${String(month).padStart(2,'0')}`} 
                             onChange={val => {
                                 const [y, m] = val.split('-');
                                 setYear(+y); setMonth(+m);
                             }} 
                         />
                     )}
                     {period === 'annual' && (
                         <SmartDatePicker 
                             mode="annual" 
                             value={year} 
                             onChange={setYear} 
                             availableYears={availableYears}
                         />
                     )}
                    
                    <div className="live-badge"><span className="pulse"></span>En Vivo</div>
                </div>
            </header>

            <div className="body-layout">
                {/* MOBILE OVERLAY */}
                {isSidebarOpen && <div className="mobile-overlay" onClick={() => setIsSidebarOpen(false)}></div>}

                {/* LEFT PANEL */}
                <aside className={`left-panel ${isSidebarOpen ? 'open' : ''}`}>
                    <div className="panel-title"><Layers size={14}/> Empresas</div>
                    <div className="chip-list">
                        {allCompanies.filter(c => visibleCompanies.includes(c.id)).map(c => {
                            const isOn = selectedDbs.includes(c.id);
                            const compData = data.find(d => d.id === c.id);
                            const IconComp = c.Icon;
                            return (
                                <button key={c.id} className={`company-chip ${isOn ? 'on' : ''}`}
                                    onClick={() => selectOnlyDb(c.id)}
                                    style={isOn ? { borderColor: c.color + '40' } : {}}>
                                    <div 
                                        className={`chip-check ${isOn ? 'checked' : ''}`} 
                                        onClick={(e) => toggleDb(e, c.id)}
                                        style={isOn ? { background: c.color } : {}}
                                    >
                                        {isOn && <Check size={11}/>}
                                    </div>
                                    <div className="chip-icon-wrap" style={{ background: c.bg, color: c.color }}>
                                        <IconComp size={15}/>
                                    </div>
                                    <div className="chip-text">
                                        <div className="chip-name">{c.name}</div>
                                        {isOn && compData && (
                                            <div className="chip-stat">{fmtShort(compData.kpi.neto)} · {numFmt(compData.kpi.ops)} ops</div>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                    <div className="panel-footer" style={{ justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Calendar size={13}/> <span>{periodLabel}</span>
                        </div>
                        <button className="settings-btn" onClick={() => setShowConfigModal(true)}>
                            <Settings2 size={14} />
                        </button>
                    </div>
                </aside>

                {/* MAIN */}
                <main className="main">
                    {loading ? (
                        <div className="loader">
                            <div className="spin-wrap"><RefreshCw size={24} className="spin-icon"/></div>
                            <p>Consultando ERP Navasof...</p>
                        </div>
                    ) : (
                        <div className="main-inner">
                            {/* Context */}
                            <div className="context-bar">
                                <div className="context-left">
                                    <h1 className="context-title">{periodLabel}</h1>
                                    <span className="context-sub">{selectedDbs.length} empresa{selectedDbs.length>1?'s':''}</span>
                                </div>
                                {parseFloat(totalGrowth) !== 0 && (
                                    <div className={`growth-pill ${totalGrowth >= 0 ? 'up' : 'down'}`}>
                                        {totalGrowth >= 0 ? <ArrowUpRight size={15}/> : <ArrowDownRight size={15}/>}
                                        <span>{Math.abs(totalGrowth)}% vs {prevPeriodLabel}</span>
                                    </div>
                                )}
                            </div>

                            {/* KPI CARDS - HIDE IN HOURLY */}
                            {period !== 'hourly' && (
                                <div className="kpi-strip">
                                    {kpiCards.map((k, i) => (
                                        <div key={i} className="kpi-box" style={{ background: k.grad }}>
                                            <div className="kpi-icon-wrap" style={{ background: 'rgba(255,255,255,0.25)', color: '#fff' }}>
                                                <k.Icon size={22}/>
                                            </div>
                                            <div className="kpi-body">
                                                <div className="kpi-label" style={{color:'rgba(255,255,255,0.8)'}}>{k.label}</div>
                                                <div className="kpi-val" style={{color:'#fff'}}>{k.value}</div>
                                                <div className="kpi-sub" style={{color:'rgba(255,255,255,0.6)'}}>{k.sub}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* DOCUMENT TYPES - HIDE IN HOURLY */}
                            {period !== 'hourly' && totalDocTypes.length > 0 && (
                                <div className="doc-strip">
                                    {totalDocTypes.map((dt, i) => {
                                        const DIcon = docIcon(dt.codigo);
                                        const dc = docColor(dt.codigo);
                                        return (
                                            <div key={i} className="doc-chip">
                                                <div className="doc-icon" style={{background: dc.bg, color: dc.color}}>
                                                    <DIcon size={16}/>
                                                </div>
                                                <div className="doc-info">
                                                    <span className="doc-type">{dt.tipo}</span>
                                                    <span className="doc-count">{numFmt(dt.cantidad)}</span>
                                                </div>
                                                <span className="doc-total">{fmt(dt.total)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* TREND */}
                            {(view === 'overview' || view === 'compare') && (
                                    <div className="card chart-card">
                                        <div className="card-head">
                                            <h3>{trendTitle}</h3>
                                            <span className="card-badge">{selectedDbs.length} empresa{selectedDbs.length>1?'s':''}</span>
                                        </div>
                                        <div className="chart-wrap" style={{height: 300}}>
                                            {mergedTrends.length > 0 ? (
                                                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                                    <AreaChart data={mergedTrends} margin={{top:5,right:10,bottom:0,left:0}}>
                                                        <defs>
                                                            {data.map(d => (
                                                                <linearGradient key={d.id} id={`g-${d.id}`} x1="0" y1="0" x2="0" y2="1">
                                                                    <stop offset="0%" stopColor={d.color} stopOpacity={0.2}/>
                                                                    <stop offset="100%" stopColor={d.color} stopOpacity={0.01}/>
                                                                </linearGradient>
                                                            ))}
                                                        </defs>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#eef0f6" vertical={false}/>
                                                        <XAxis dataKey="name" stroke="#b0b5c9" fontSize={11} tickLine={false} axisLine={false}/>
                                                        <YAxis stroke="#b0b5c9" fontSize={11} tickLine={false} axisLine={false}
                                                            tickFormatter={v=> v>=1000000 ? `${(v/1000000).toFixed(1)}M` : `${(v/1000).toFixed(0)}k`}/>
                                                        <Tooltip content={<ChartTooltip/>} cursor={{stroke:'#dde0ec',strokeWidth:1,strokeDasharray:'4 4'}}/>
                                                        <Legend iconType="circle" iconSize={8} wrapperStyle={{fontSize:12,paddingTop:12}}/>
                                                        {data.map(d => (
                                                            <Area key={d.id} type="monotone" dataKey={d.name}
                                                                stroke={d.color} strokeWidth={2.5}
                                                                fill={`url(#g-${d.id})`}
                                                                dot={false} activeDot={{r:5,strokeWidth:2.5,stroke:'#fff',fill:d.color}}
                                                                animationDuration={800}
                                                            />
                                                        ))}
                                                    </AreaChart>
                                                </ResponsiveContainer>
                                            ) : (
                                                <div className="empty-chart-msg" style={{height:'100%',display:'flex',alignItems:'center',justifyContent:'center',color:'#b0b5c9',fontSize:'14px'}}>
                                                    Esperando datos del servidor...
                                                </div>
                                            )}
                                        </div>
                                    </div>
                            )}

                            {/* MATRIZ HORARIA - SOLO EN MODO HOURLY */}
                            {period === 'hourly' && (
                                <div className="card col-span-full" style={{marginTop: 20, marginBottom: 20}}>
                                    <div className="card-head" style={{padding: '20px 24px', borderBottom: '1px solid #f0f2f7'}}>
                                        <div>
                                            <h3 style={{margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b'}}>Matriz de Rendimiento Horario</h3>
                                            <p style={{margin: '4px 0 0', fontSize: 12, color: '#64748b'}}>Desglose detallado de operaciones y rentabilidad por rango</p>
                                        </div>
                                    </div>
                                    <div style={{overflowX: 'auto'}}>
                                        <table style={{width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left'}}>
                                            <thead>
                                                <tr style={{background: '#f8fafc', color: '#64748b', borderBottom: '1px solid #f1f5f9'}}>
                                                    <th style={{padding: '12px 24px'}}>Rango Horario</th>
                                                    <th style={{padding: '12px 24px'}}>Empresa</th>
                                                    <th style={{padding: '12px 24px', textAlign: 'right'}}>Ingreso Neto</th>
                                                    <th style={{padding: '12px 24px', textAlign: 'right'}}>Tickets</th>
                                                    <th style={{padding: '12px 24px', textAlign: 'right'}}>Ticket Prom.</th>
                                                    <th style={{padding: '12px 24px', textAlign: 'right'}}>Participación</th>
                                                </tr>
                                            </thead>
                                            <tbody style={{background: '#fff'}}>
                                                {data.flatMap(db => db.trend.map(h => ({ ...h, dbName: db.name, color: db.color })))
                                                    .sort((a,b) => a.periodo - b.periodo || a.dbName.localeCompare(b.dbName))
                                                    .map((row, idx) => (
                                                        <tr key={idx} style={{borderBottom: '1px solid #f1f5f9'}}>
                                                            <td style={{padding: '12px 24px', fontWeight: 600, color: '#475569'}}>{row.label} - {row.periodo + 1}:00</td>
                                                            <td style={{padding: '12px 24px'}}>
                                                                <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                                                                    <div style={{width: 8, height: 8, borderRadius: '50%', background: row.color}}></div>
                                                                    {row.dbName}
                                                                </div>
                                                            </td>
                                                            <td style={{padding: '12px 24px', textAlign: 'right', fontWeight: 700, color: '#0f172a', background: `rgba(16, 185, 129, ${(row.participation || 0) / 30})`}}>
                                                                {fmt(row.neto)}
                                                            </td>
                                                            <td style={{padding: '12px 24px', textAlign: 'right', color: '#64748b'}}>{row.ops} ops</td>
                                                            <td style={{padding: '12px 24px', textAlign: 'right', color: '#64748b'}}>{fmt(row.ticket)}</td>
                                                            <td style={{padding: '12px 24px', textAlign: 'right'}}>
                                                                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10}}>
                                                                    <span style={{fontSize: 11, fontWeight: 700, color: '#64748b'}}>{(row.participation || 0).toFixed(1)}%</span>
                                                                    <div style={{width: 60, height: 6, background: '#f1f5f9', borderRadius: 10, overflow: 'hidden'}}>
                                                                        <div style={{height: '100%', background: row.color, width: `${row.participation || 0}%`}}></div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))
                                                }
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* COMPARE CARDS */}
                            {(view === 'overview' || view === 'compare') && data.length > 1 && (
                                <div className="compare-grid">
                                    {data.map(d => {
                                        const cm = allCompanies.find(c=>c.id===d.id);
                                        const IC = cm?.Icon || Store;
                                        return (
                                            <div key={d.id} className="mini-card">
                                                <div className="mini-head">
                                                    <div className="mini-icon-wrap" style={{background: cm?.bg, color: d.color}}>
                                                        <IC size={15}/>
                                                    </div>
                                                    <span className="mini-name">{d.name}</span>
                                                    {d.growth !== 0 && (
                                                        <span className={`mini-growth ${d.growth>=0?'up':'down'}`}>
                                                            {d.growth>=0?'+':''}{d.growth}%
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="mini-val">{fmtShort(d.kpi.neto)}</div>
                                                <div className="mini-sub">{numFmt(d.kpi.ops)} ops · Ticket {fmtShort(d.kpi.ticket)}</div>
                                                <div className="mini-bar-wrap">
                                                    <div className="mini-bar" style={{
                                                        width: `${Math.min(100,(d.kpi.neto/Math.max(...data.map(x=>x.kpi.neto||1)))*100)}%`,
                                                        background: `linear-gradient(90deg,${d.color},${d.color}66)`
                                                    }}></div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* DETAIL PER COMPANY - HIDE IN HOURLY */}
                            {period !== 'hourly' && (view === 'overview' || view === 'detail') && data.map(d => {
                                const cm = allCompanies.find(c=>c.id===d.id);
                                const IC = cm?.Icon || Store;
                                const maxVend = d.topVendedores.length > 0 ? d.topVendedores[0].total : 1;
                                const compDocTypes = d.docTypes || [];
                                return (
                                    <div key={d.id} className="detail-section">
                                        <div className="detail-header" style={{background: `linear-gradient(135deg, ${cm?.bg || '#eff4ff'}, #ffffff)`}}>
                                            <div className="detail-icon-wrap" style={{background:'#fff',color:d.color}}>
                                                <IC size={18}/>
                                            </div>
                                            <div className="detail-title-group">
                                                <h3>{d.name}</h3>
                                                <span className="detail-period">{periodLabel}</span>
                                            </div>
                                            <div className="detail-meta">
                                                {d.growth !== 0 && (
                                                    <span className={`growth-sm ${d.growth>=0?'up':'down'}`}>
                                                        {d.growth>=0?<ArrowUpRight size={12}/>:<ArrowDownRight size={12}/>}
                                                        {Math.abs(d.growth)}%
                                                    </span>
                                                )}
                                                <span className="detail-amount">{fmt(d.kpi.neto)}</span>
                                            </div>
                                        </div>

                                        {/* KPIs por empresa */}
                                        <div className="detail-kpis">
                                            <div className="dkpi">
                                                <span className="dkpi-label">Operaciones</span>
                                                <span className="dkpi-val">{numFmt(d.kpi.ops)}</span>
                                            </div>
                                            <div className="dkpi">
                                                <span className="dkpi-label">IGV</span>
                                                <span className="dkpi-val">{fmtShort(d.kpi.igv)}</span>
                                            </div>
                                            <div className="dkpi">
                                                <span className="dkpi-label">Ticket Prom.</span>
                                                <span className="dkpi-val">{fmtShort(d.kpi.ticket)}</span>
                                            </div>
                                            {compDocTypes.map((dt, di) => {
                                                const DIcon = docIcon(dt.codigo);
                                                const dc = docColor(dt.codigo);
                                                return (
                                                    <div key={di} className="dkpi dkpi-doc">
                                                        <div className="dkpi-doc-icon" style={{background: dc.bg, color: dc.color}}>
                                                            <DIcon size={13}/>
                                                        </div>
                                                        <div>
                                                            <span className="dkpi-label">{dt.tipo}</span>
                                                            <span className="dkpi-val">{numFmt(dt.cantidad)} <small>{fmt(dt.total)}</small></span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Sedes + Vendedores */}
                                        <div className="detail-body">
                                            <div className="detail-panel">
                                                <h4>Ventas por Sede — {periodLabel}</h4>
                                                {d.ventasPorSede.length > 0 ? (
                                                    <div className="chart-wrap" style={{height: Math.max(180, d.ventasPorSede.length * 40)}}>
                                                        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                                                            <BarChart data={d.ventasPorSede} layout="vertical" margin={{left:10,right:80,top:5,bottom:5}}>
                                                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eef0f6"/>
                                                                <XAxis type="number" fontSize={10} stroke="#b0b5c9" tickLine={false} axisLine={false}
                                                                    tickFormatter={v=> v>=1000000 ? `${(v/1000000).toFixed(1)}M` : `${(v/1000).toFixed(0)}k`}/>
                                                                <YAxis dataKey="sede" type="category" width={140} fontSize={11} stroke="#6b7194" tickLine={false} axisLine={false}/>
                                                                <Tooltip content={<ChartTooltip/>}/>
                                                                <Bar dataKey="total" radius={[0,6,6,0]} barSize={20}>
                                                                    {d.ventasPorSede.map((_,i)=><Cell key={i} fill={PALETTE[i%PALETTE.length]}/>)}
                                                                    <LabelList dataKey="total" position="right" formatter={(val) => fmt(val)} fill="#6b7194" fontSize={11} fontWeight={600} />
                                                                </Bar>
                                                            </BarChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                ) : <p className="empty-msg">Sin datos para este periodo</p>}
                                            </div>
                                            <div className="detail-panel">
                                                <h4>Top 10 Vendedores — {periodLabel}</h4>
                                                {d.topVendedores.length > 0 ? (
                                                    <div className="rank-list">
                                                        {d.topVendedores.map((v,i) => (
                                                            <div key={i} className="rank-row">
                                                                <span className={`rank-n r${i+1}`}>
                                                                    {i===0?<Crown size={12}/>:i===1?<Award size={12}/>:i===2?<Medal size={12}/>:<span>{i+1}</span>}
                                                                </span>
                                                                <div className="rank-info">
                                                                    <span className="rank-name">{v.nom}</span>
                                                                    <div className="rank-bar-wrap">
                                                                        <div className="rank-bar" style={{
                                                                            width: `${(v.total/maxVend)*100}%`,
                                                                            background: `linear-gradient(90deg,${PALETTE[i%PALETTE.length]},${PALETTE[i%PALETTE.length]}55)`
                                                                        }}></div>
                                                                    </div>
                                                                </div>
                                                                <div className="rank-right">
                                                                    <span className="rank-total" style={{fontWeight:600}}>{fmt(v.total)}</span>
                                                                    <span className="rank-ops">{numFmt(v.ops)} ops</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : <p className="empty-msg">Sin datos para este periodo</p>}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </main>
            </div>

            {showConfigModal && (
                <div className="modal-overlay">
                    <div className="modal-box">
                        <div className="modal-header">
                            <h3 className="modal-title"><Settings2 size={18} /> Ajustes de Entidades</h3>
                            <button className="modal-close" onClick={() => setShowConfigModal(false)}><X size={18}/></button>
                        </div>
                        <div className="modal-body">
                            <p className="modal-desc">Selecciona las empresas que deseas mostrar u ocultar en el panel principal.</p>
                            <div className="toggle-list">
                                {allCompanies.map(c => {
                                    const isVisible = visibleCompanies.includes(c.id);
                                    const IconComp = c.Icon;
                                    return (
                                        <div key={c.id} className="toggle-row" onClick={() => toggleCompanyVisibility(c.id)}>
                                            <div className="chip-icon-wrap" style={{ background: c.bg, color: c.color }}>
                                                <IconComp size={15} />
                                            </div>
                                            <div className="toggle-name">{c.name}</div>
                                            <div className={`switch ${isVisible ? 'on' : 'off'}`}>
                                                <div className="switch-thumb"></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
