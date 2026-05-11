'use client';
import { useState, useEffect } from 'react';
import { 
    Megaphone, Users, UserCheck, UserX, CheckSquare, 
    MessageSquare, Sparkles, Send, Gift, Info, 
    ArrowRight, Loader2, Search, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function PromotionsView({ members, onSendBulk, companyName }) {
    const [target, setTarget] = useState('active'); // 'all', 'active', 'expired', 'selected'
    const [selectedIds, setSelectedIds] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [message, setMessage] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [isSending, setIsSending] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });

    const templates = [
        { 
            id: 'promo_2x1', 
            label: 'Promoción 2x1', 
            category: 'promo',
            icon: <Gift size={16} />,
            text: `¡Hola [Nombre]! 🎁 En *${companyName}* tenemos una promo increíble: ¡TRAE A UN AMIGO Y PAGUEN 2x1! Válido solo esta semana. ¡Te esperamos para entrenar doble! 💪🏋️`
        },
        { 
            id: 'recuperacion', 
            label: 'Recuperación Socio', 
            category: 'promo',
            icon: <RefreshCw size={16} />,
            text: `¡Te extrañamos, [Nombre]! 🥺 En *${companyName}* queremos que vuelvas con todo. Renueva tu plan hoy y te regalamos 1 semana adicional. ¡No pierdas tu ritmo! 🔥`
        },
        { 
            id: 'comunicado_mante', 
            label: 'Mantenimiento', 
            category: 'info',
            icon: <Info size={16} />,
            text: `Estimado [Nombre], te informamos que por mantenimiento preventivo, *${companyName}* cerrará sus puertas el día [Fecha]. Agradecemos tu comprensión. ✨`
        },
        { 
            id: 'feriado', 
            label: 'Horario Feriado', 
            category: 'info',
            icon: <Clock size={16} />,
            text: `¡Hola [Nombre]! 📢 Te informamos nuestro horario para este feriado: [Horario]. ¡Organiza tus entrenos y no te detengas! ⚡`
        },
        { 
            id: 'motivacion', 
            label: 'Motivación Semanal', 
            category: 'motivacion',
            icon: <Sparkles size={16} />,
            text: `¡Vamos [Nombre]! 🔥 "La disciplina es el puente entre las metas y los logros". Te esperamos hoy en *${companyName}* para superar tus límites. 🏆`
        }
    ];

    const filteredMembers = members.filter(m => {
        if (target === 'active') return m.status === 'Activo' || m.status === 'Por vencer';
        if (target === 'expired') return m.status === 'Vencido';
        return true;
    }).filter(m => 
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        m.phone.includes(searchTerm)
    );

    const toggleSelect = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleSelectTemplate = (t) => {
        setSelectedTemplate(t.id);
        setMessage(t.text);
    };

    const handleSend = async () => {
        let targets = [];
        if (target === 'selected') {
            targets = members.filter(m => selectedIds.includes(m.id));
        } else {
            targets = members.filter(m => {
                if (target === 'active') return m.status === 'Activo' || m.status === 'Por vencer';
                if (target === 'expired') return m.status === 'Vencido';
                return true;
            });
        }

        if (targets.length === 0) return alert('No hay destinatarios seleccionados');
        if (!message) return alert('El mensaje no puede estar vacío');

        setIsSending(true);
        setProgress({ current: 0, total: targets.length });

        // Enviamos a la cola de forma masiva
        for (const member of targets) {
            const personalizedMsg = message.replace('[Nombre]', member.name);
            onSendBulk(member.phone, personalizedMsg);
            setProgress(prev => ({ ...prev, current: prev.current + 1 }));
        }

        setTimeout(() => {
            setIsSending(false);
            setMessage('');
            setSelectedIds([]);
            setSelectedTemplate(null);
            alert(`¡Éxito! Se han enviado ${targets.length} mensajes a la cola de procesamiento.`);
        }, 1000);
    };

    return (
        <div style={containerStyle}>
            <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '20px', height: '100%' }}>
                
                {/* COLUMNA IZQUIERDA: CONFIGURACIÓN */}
                <div style={configPanelStyle}>
                    <div style={sectionHeaderStyle}>
                        <Users size={18} color="#3b82f6" />
                        <h3 style={sectionTitleStyle}>1. Seleccionar Audiencia</h3>
                    </div>

                    <div style={targetGridStyle}>
                        <button onClick={() => setTarget('active')} style={{ ...targetBtnStyle, background: target === 'active' ? '#eff6ff' : '#fff', borderColor: target === 'active' ? '#3b82f6' : '#e2e8f0', color: target === 'active' ? '#3b82f6' : '#64748b' }}>
                            <UserCheck size={18} />
                            <span>Solo Activos</span>
                        </button>
                        <button onClick={() => setTarget('expired')} style={{ ...targetBtnStyle, background: target === 'expired' ? '#fef2f2' : '#fff', borderColor: target === 'expired' ? '#ef4444' : '#e2e8f0', color: target === 'expired' ? '#ef4444' : '#64748b' }}>
                            <UserX size={18} />
                            <span>Solo Vencidos</span>
                        </button>
                        <button onClick={() => setTarget('all')} style={{ ...targetBtnStyle, background: target === 'all' ? '#f8fafc' : '#fff', borderColor: target === 'all' ? '#1e293b' : '#e2e8f0', color: target === 'all' ? '#1e293b' : '#64748b' }}>
                            <Users size={18} />
                            <span>Todos</span>
                        </button>
                        <button onClick={() => setTarget('selected')} style={{ ...targetBtnStyle, background: target === 'selected' ? '#f5f3ff' : '#fff', borderColor: target === 'selected' ? '#8b5cf6' : '#e2e8f0', color: target === 'selected' ? '#8b5cf6' : '#64748b' }}>
                            <CheckSquare size={18} />
                            <span>Selección Manual</span>
                        </button>
                    </div>

                    {target === 'selected' && (
                        <div style={selectionListStyle}>
                            <div style={searchBoxStyle}>
                                <Search size={14} color="#94a3b8" />
                                <input 
                                    placeholder="Buscar socio..." 
                                    style={searchInputStyle} 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div style={memberListScrollStyle}>
                                {filteredMembers.map(m => (
                                    <div key={m.id} onClick={() => toggleSelect(m.id)} style={{ ...memberItemStyle, background: selectedIds.includes(m.id) ? '#f5f3ff' : 'transparent' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <input type="checkbox" checked={selectedIds.includes(m.id)} readOnly />
                                            <span style={{ fontSize: '12px', fontWeight: 600 }}>{m.name}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div style={selectionFooterStyle}>
                                {selectedIds.length} seleccionados
                            </div>
                        </div>
                    )}

                    <div style={{ ...sectionHeaderStyle, marginTop: '24px' }}>
                        <Sparkles size={18} color="#8b5cf6" />
                        <h3 style={sectionTitleStyle}>2. Elegir Plantilla</h3>
                    </div>
                    <div style={templateGridStyle}>
                        {templates.map(t => (
                            <button 
                                key={t.id} 
                                onClick={() => handleSelectTemplate(t)}
                                style={{ 
                                    ...templateBtnStyle, 
                                    background: selectedTemplate === t.id ? '#f5f3ff' : '#fff',
                                    borderColor: selectedTemplate === t.id ? '#8b5cf6' : '#f1f5f9'
                                }}
                            >
                                {t.icon}
                                <span>{t.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* COLUMNA DERECHA: EDITOR Y PREVIEW */}
                <div style={editorPanelStyle}>
                    <div style={sectionHeaderStyle}>
                        <MessageSquare size={18} color="#10b981" />
                        <h3 style={sectionTitleStyle}>3. Personalizar Mensaje</h3>
                    </div>
                    
                    <div style={editorContainerStyle}>
                        <div style={textareaHeaderStyle}>
                            <span style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8' }}>CONTENIDO DEL MENSAJE</span>
                            <span style={{ fontSize: '11px', color: '#64748b' }}>Usa <b>[Nombre]</b> para personalizar</span>
                        </div>
                        <textarea 
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Escribe el mensaje de tu promoción aquí..."
                            style={textareaStyle}
                        />
                        
                        <div style={previewSectionStyle}>
                            <div style={previewHeaderStyle}>
                                <div style={whatsappIconStyle}><MessageSquare size={12} color="#fff" /></div>
                                <span style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>Vista Previa WhatsApp</span>
                            </div>
                            <div style={bubbleStyle}>
                                {message ? message.replace('[Nombre]', 'Socio Ejemplo') : 'El mensaje aparecerá aquí...'}
                            </div>
                        </div>
                    </div>

                    <div style={actionAreaStyle}>
                        {isSending ? (
                            <div style={progressContainerStyle}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>Enviando mensajes...</span>
                                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#3b82f6' }}>{progress.current} / {progress.total}</span>
                                </div>
                                <div style={progressBarBgStyle}>
                                    <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${(progress.current / progress.total) * 100}%` }}
                                        style={progressBarFillStyle}
                                    />
                                </div>
                            </div>
                        ) : (
                            <button onClick={handleSend} style={sendBtnStyle}>
                                <Megaphone size={20} />
                                <span>Iniciar Envío Masivo</span>
                                <ArrowRight size={18} />
                            </button>
                        )}
                        <p style={disclaimerStyle}>
                            * Los mensajes se enviarán de forma secuencial a través de la cola de WhatsApp activa para evitar bloqueos.
                        </p>
                    </div>
                </div>

            </div>
        </div>
    );
}

// ICONOS EXTRA
function RefreshCw(props) { return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path><path d="M8 16H3v5"></path></svg>; }
function Clock(props) { return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>; }

// ESTILOS
const containerStyle = { height: '100%', padding: '20px', overflow: 'hidden', display: 'flex', flexDirection: 'column' };
const configPanelStyle = { background: '#fff', borderRadius: '24px', border: '1px solid #f1f5f9', padding: '24px', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' };
const sectionHeaderStyle = { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' };
const sectionTitleStyle = { fontSize: '14px', fontWeight: 900, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 };

const targetGridStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' };
const targetBtnStyle = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '12px', borderRadius: '16px', border: '1px solid', fontSize: '11px', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s' };

const templateGridStyle = { display: 'grid', gridTemplateColumns: '1fr', gap: '8px' };
const templateBtnStyle = { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', borderRadius: '12px', border: '1px solid', fontSize: '12px', fontWeight: 700, color: '#475569', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' };

const editorPanelStyle = { background: '#fff', borderRadius: '24px', border: '1px solid #f1f5f9', padding: '32px', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)' };
const editorContainerStyle = { flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' };

const textareaHeaderStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const textareaStyle = { width: '100%', flex: 1, minHeight: '150px', padding: '20px', borderRadius: '20px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '14px', lineHeight: '1.6', outline: 'none', resize: 'none', color: '#1e293b' };

const previewSectionStyle = { background: '#f1f5f9', padding: '20px', borderRadius: '20px', border: '1px dashed #cbd5e1' };
const previewHeaderStyle = { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' };
const whatsappIconStyle = { width: '20px', height: '20px', background: '#25d366', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' };
const bubbleStyle = { background: '#fff', padding: '12px 16px', borderRadius: '0 15px 15px 15px', fontSize: '13px', color: '#334155', maxWidth: '85%', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', whiteSpace: 'pre-wrap' };

const actionAreaStyle = { marginTop: '32px', textAlign: 'center' };
const sendBtnStyle = { width: '100%', height: '60px', borderRadius: '20px', border: 'none', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: '#fff', fontSize: '16px', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', cursor: 'pointer', boxShadow: '0 20px 25px -5px rgba(37,99,235,0.3)', transition: 'all 0.2s' };
const disclaimerStyle = { fontSize: '11px', color: '#94a3b8', marginTop: '16px', fontWeight: 500 };

const selectionListStyle = { marginTop: '12px', border: '1px solid #e2e8f0', borderRadius: '16px', overflow: 'hidden', background: '#fff' };
const searchBoxStyle = { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderBottom: '1px solid #f1f5f9' };
const searchInputStyle = { border: 'none', outline: 'none', fontSize: '12px', flex: 1 };
const memberListScrollStyle = { maxHeight: '180px', overflowY: 'auto', padding: '4px' };
const memberItemStyle = { padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', transition: 'background 0.2s' };
const selectionFooterStyle = { padding: '8px 12px', background: '#f8fafc', fontSize: '11px', fontWeight: 800, color: '#64748b', textAlign: 'center', borderTop: '1px solid #f1f5f9' };

const progressContainerStyle = { width: '100%', padding: '10px 0' };
const progressBarBgStyle = { width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' };
const progressBarFillStyle = { height: '100%', background: '#3b82f6', borderRadius: '4px' };
