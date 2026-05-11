'use client';
import { useState, useEffect } from 'react';
import { 
    Megaphone, Users, UserCheck, UserX, CheckSquare, 
    MessageSquare, Sparkles, Send, Gift, Info, 
    ArrowRight, Loader2, Search, Trash2, Zap,
    TrendingUp, Target, Clock, Calendar, Wand2, ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function PromotionsView({ members, onSendBulk, companyName }) {
    const [target, setTarget] = useState('active'); // segments...
    const [selectedIds, setSelectedIds] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [message, setMessage] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [isSending, setIsSending] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });

    // SEGMENTOS INTELIGENTES
    const segments = [
        { id: 'active', label: 'Socios Activos', icon: <UserCheck size={18} />, color: '#10b981', desc: 'Fidelización y anuncios' },
        { id: 'expiring', label: 'Por Vencer (7d)', icon: <Clock size={18} />, color: '#f59e0b', desc: 'Prevención de bajas' },
        { id: 'expired', label: 'Vencidos Recientes', icon: <UserX size={18} />, color: '#ef4444', desc: 'Recuperación de socios' },
        { id: 'inactive', label: 'Dormidos (15d+)', icon: <ShieldAlert size={18} />, color: '#6366f1', desc: 'Socio que no viene' },
        { id: 'selected', label: 'Selección Manual', icon: <CheckSquare size={18} />, color: '#8b5cf6', desc: 'Envío personalizado' }
    ];

    const templates = [
        { 
            id: 'promo_2x1', label: 'Promoción 2x1', icon: <Gift size={16} />,
            text: `¡Hola [Nombre]! 🎁 En *${companyName}* tenemos una promo increíble: ¡TRAE A UN AMIGO Y PAGUEN 2x1! Válido solo esta semana. ¡Te esperamos! 💪🏋️`
        },
        { 
            id: 'recuperacion', label: 'Regreso VIP', icon: <TrendingUp size={16} />,
            text: `¡Hola [Nombre]! 🥺 Te extrañamos mucho. Tu plan de [Plan] venció hace poco. Renueva hoy mismo y recibe un 20% de descuento. ¡Vuelve con todo! 🔥`
        },
        { 
            id: 'urgencia', label: 'Últimos Días', icon: <Zap size={16} />,
            text: `¡Atención [Nombre]! 🚨 Te quedan solo [DiasRestantes] días de entrenamiento. No pierdas tu progreso en *${companyName}*. ¡Renueva hoy mismo! 💪`
        }
    ];

    // LÓGICA DE FILTRADO INTELIGENTE
    const getTargetMembers = () => {
        const now = new Date();
        return members.filter(m => {
            const expDate = m.endDate ? new Date(m.endDate) : null;
            const daysLeft = expDate ? Math.ceil((expDate - now) / (1000 * 60 * 60 * 24)) : -1;

            if (target === 'active') return m.status === 'Activo';
            if (target === 'expiring') return daysLeft >= 0 && daysLeft <= 7;
            if (target === 'expired') return m.status === 'Vencido';
            if (target === 'inactive') return m.status === 'Activo'; // Aquí iría lógica de última visita si existiera
            if (target === 'selected') return selectedIds.includes(m.id);
            return true;
        });
    };

    const targetMembers = getTargetMembers();
    const filteredDisplay = targetMembers.filter(m => 
        m.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleMagicWand = (tone) => {
        let newMsg = message;
        if (tone === 'fun') newMsg = "🚀 " + message + " ¡Va a estar increíble! 🔥💪";
        if (tone === 'formal') newMsg = "Estimado [Nombre], " + message.toLowerCase() + " Quedamos a su disposición.";
        if (tone === 'urgent') newMsg = "🔴 AVISO IMPORTANTE: " + message + " ¡Última oportunidad!";
        setMessage(newMsg);
    };

    const handleSend = async () => {
        if (targetMembers.length === 0) return alert('No hay destinatarios');
        if (!message) return alert('Escribe un mensaje');

        setIsSending(true);
        setProgress({ current: 0, total: targetMembers.length });

        for (const member of targetMembers) {
            let personalizedMsg = message
                .replace('[Nombre]', member.name)
                .replace('[Plan]', member.planName || 'tu plan')
                .replace('[DiasRestantes]', member.daysRemaining || 'pocos');
            
            onSendBulk(member.phone, personalizedMsg);
            setProgress(prev => ({ ...prev, current: prev.current + 1 }));
            await new Promise(r => setTimeout(r, 200)); // Pequeño delay para no saturar UI
        }

        setTimeout(() => {
            setIsSending(false);
            alert(`Campaña finalizada. ${targetMembers.length} mensajes procesados.`);
        }, 1000);
    };

    return (
        <div style={containerStyle}>
            {/* CABECERA DASHBOARD */}
            <div style={dashboardHeaderStyle}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 900, color: '#1e293b' }}>Marketing Inteligente</h2>
                    <p style={{ margin: 0, color: '#64748b', fontSize: '14px', fontWeight: 500 }}>Potencia tus ventas y recupera socios de forma automática.</p>
                </div>
                <div style={impactCardStyle}>
                    <div style={impactIconStyle}><TrendingUp size={20} color="#10b981" /></div>
                    <div>
                        <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b' }}>ALCANCE ESTIMADO</div>
                        <div style={{ fontSize: '18px', fontWeight: 900, color: '#1e293b' }}>{targetMembers.length} Personas</div>
                    </div>
                </div>
            </div>

            <div style={mainLayoutStyle}>
                
                {/* 1. SELECCIÓN DE SEGMENTO */}
                <div style={sidePanelStyle}>
                    <div style={labelStyle}>1. ELEGIR AUDIENCIA</div>
                    <div style={segmentsGridStyle}>
                        {segments.map(s => (
                            <button 
                                key={s.id} 
                                onClick={() => setTarget(s.id)}
                                style={{
                                    ...segmentCardStyle,
                                    borderColor: target === s.id ? s.color : '#f1f5f9',
                                    background: target === s.id ? `${s.color}08` : '#fff'
                                }}
                            >
                                <div style={{ ...segmentIconBoxStyle, color: s.color, background: `${s.color}15` }}>{s.icon}</div>
                                <div style={{ textAlign: 'left' }}>
                                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b' }}>{s.label}</div>
                                    <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 600 }}>{s.desc}</div>
                                </div>
                            </button>
                        ))}
                    </div>

                    {target === 'selected' && (
                        <div style={manualSelectionBoxStyle}>
                            <div style={selectionSearchStyle}>
                                <Search size={14} color="#94a3b8" />
                                <input placeholder="Buscar socio..." style={selectionInputStyle} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                            </div>
                            <div style={selectionListStyle}>
                                {members.filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase())).map(m => (
                                    <div key={m.id} onClick={() => setSelectedIds(prev => prev.includes(m.id) ? prev.filter(i => i !== m.id) : [...prev, m.id])} style={{ ...selectionItemStyle, background: selectedIds.includes(m.id) ? '#f5f3ff' : 'transparent' }}>
                                        <input type="checkbox" checked={selectedIds.includes(m.id)} readOnly />
                                        <span>{m.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* 2. COMPOSICIÓN DEL MENSAJE */}
                <div style={centerPanelStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={labelStyle}>2. REDACTAR CAMPAÑA</div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => { setMessage(''); setSelectedTemplate(null); }} style={aiBtnStyle} title="Limpiar Mensaje"><Trash2 size={14} /> Limpiar</button>
                            <button onClick={() => handleMagicWand('fun')} style={aiBtnStyle} title="Tono Divertido"><Wand2 size={14} /> Divertido</button>
                            <button onClick={() => handleMagicWand('formal')} style={aiBtnStyle} title="Tono Formal"><Zap size={14} /> Profesional</button>
                        </div>
                    </div>

                    <div style={editorWrapperStyle}>
                        <div style={templatesRowStyle}>
                            {templates.map(t => (
                                <button key={t.id} onClick={() => { setSelectedTemplate(t.id); setMessage(t.text); }} style={{ ...miniTemplateBtnStyle, background: selectedTemplate === t.id ? '#1e293b' : '#fff', color: selectedTemplate === t.id ? '#fff' : '#64748b' }}>
                                    {t.icon} {t.label}
                                </button>
                            ))}
                        </div>
                        <textarea 
                            style={mainTextareaStyle} 
                            placeholder="¿Qué quieres decirle a tus socios hoy?"
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                        />
                        <div style={tokensRowStyle}>
                            {['[Nombre]', '[Plan]', '[DiasRestantes]'].map(token => (
                                <span key={token} style={tokenTagStyle} onClick={() => setMessage(message + ' ' + token)}>{token}</span>
                            ))}
                        </div>
                    </div>

                    <div style={finalActionBoxStyle}>
                        {isSending ? (
                            <div style={progressBoxStyle}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', fontWeight: 800 }}>
                                    <span>PROCESANDO CAMPAÑA...</span>
                                    <span>{progress.current} / {progress.total}</span>
                                </div>
                                <div style={progressBgStyle}><motion.div animate={{ width: `${(progress.current/progress.total)*100}%` }} style={progressFillStyle} /></div>
                            </div>
                        ) : (
                            <button onClick={handleSend} style={mainSendBtnStyle}>
                                <Megaphone size={20} />
                                LANZAR CAMPAÑA AHORA
                                <ArrowRight size={20} />
                            </button>
                        )}
                    </div>
                </div>

                {/* 3. VISTA PREVIA SMART */}
                <div style={previewPanelStyle}>
                    <div style={labelStyle}>VISTA PREVIA</div>
                    <div style={iphoneMockupStyle}>
                        <div style={iphoneHeaderStyle} />
                        <div style={whatsappContentStyle}>
                            <div style={waBubbleStyle}>
                                {message ? message.replace('[Nombre]', 'Juan').replace('[Plan]', 'Rutina 1 Mes').replace('[DiasRestantes]', '3') : 'Tu mensaje aparecerá aquí...'}
                                <div style={waTimeStyle}>10:15 AM ✓✓</div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}

// ESTILOS PREMIUM
const containerStyle = { height: '100%', padding: '30px', display: 'flex', flexDirection: 'column', gap: '25px', background: '#f8fafc' };

const dashboardHeaderStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const impactCardStyle = { display: 'flex', alignItems: 'center', gap: '15px', background: '#fff', padding: '12px 20px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' };
const impactIconStyle = { width: '40px', height: '40px', background: '#ecfdf5', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' };

const mainLayoutStyle = { flex: 1, display: 'grid', gridTemplateColumns: '300px 1fr 300px', gap: '25px', overflow: 'hidden' };

const sidePanelStyle = { display: 'flex', flexDirection: 'column', gap: '12px' };
const labelStyle = { fontSize: '11px', fontWeight: 900, color: '#94a3b8', letterSpacing: '1px', marginBottom: '8px' };

const segmentsGridStyle = { display: 'flex', flexDirection: 'column', gap: '10px' };
const segmentCardStyle = { display: 'flex', alignItems: 'center', gap: '15px', padding: '12px 16px', borderRadius: '18px', border: '2px solid', cursor: 'pointer', transition: 'all 0.2s' };
const segmentIconBoxStyle = { width: '42px', height: '42px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' };

const centerPanelStyle = { background: '#fff', borderRadius: '32px', border: '1px solid #e2e8f0', padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.05)' };

const editorWrapperStyle = { flex: 1, display: 'flex', flexDirection: 'column', gap: '15px' };
const templatesRowStyle = { display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '5px' };
const miniTemplateBtnStyle = { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 15px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' };

const mainTextareaStyle = { flex: 1, width: '100%', padding: '25px', borderRadius: '24px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '15px', lineHeight: '1.6', color: '#1e293b', outline: 'none', resize: 'none' };

const tokensRowStyle = { display: 'flex', gap: '10px' };
const tokenTagStyle = { padding: '6px 12px', borderRadius: '8px', background: '#eff6ff', color: '#3b82f6', fontSize: '11px', fontWeight: 800, cursor: 'pointer' };

const aiBtnStyle = { display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '11px', fontWeight: 700, color: '#64748b', cursor: 'pointer' };

const finalActionBoxStyle = { marginTop: '10px' };
const mainSendBtnStyle = { width: '100%', height: '65px', borderRadius: '20px', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#fff', border: 'none', fontSize: '16px', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', cursor: 'pointer', boxShadow: '0 20px 25px -5px rgba(15,23,42,0.3)' };

const previewPanelStyle = { display: 'flex', flexDirection: 'column', alignItems: 'center' };
const iphoneMockupStyle = { width: '260px', height: '520px', background: '#fff', borderRadius: '40px', border: '8px solid #1e293b', position: 'relative', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.2)' };
const iphoneHeaderStyle = { height: '30px', background: '#1e293b', width: '120px', margin: '0 auto', borderRadius: '0 0 15px 15px' };
const whatsappContentStyle = { flex: 1, padding: '15px', background: '#e5ddd5', height: 'calc(100% - 30px)', backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundSize: 'contain' };
const waBubbleStyle = { background: '#fff', padding: '10px 12px', borderRadius: '0 15px 15px 15px', fontSize: '12px', color: '#334155', position: 'relative', boxShadow: '0 1px 1px rgba(0,0,0,0.1)' };
const waTimeStyle = { fontSize: '9px', color: '#94a3b8', textAlign: 'right', marginTop: '4px' };

const manualSelectionBoxStyle = { background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', overflow: 'hidden' };
const selectionSearchStyle = { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', borderBottom: '1px solid #f1f5f9' };
const selectionInputStyle = { border: 'none', outline: 'none', fontSize: '12px', flex: 1 };
const selectionListStyle = { maxHeight: '200px', overflowY: 'auto' };
const selectionItemStyle = { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' };

const progressBoxStyle = { width: '100%', padding: '10px 0' };
const progressBgStyle = { width: '100%', height: '10px', background: '#f1f5f9', borderRadius: '5px', overflow: 'hidden' };
const progressFillStyle = { height: '100%', background: '#3b82f6' };
