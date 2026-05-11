'use client';
import { useState, useEffect } from 'react';
import { 
    X, Send, Sparkles, MessageCircle, Gift, 
    Calendar, Bell, Heart, Dumbbell, Award, 
    Zap, Clock, ShoppingBag
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function WhatsAppMessageModal({ isOpen, onClose, member, onSend, companyName = 'nuestro gimnasio', forceCategory = null }) {
    const [message, setMessage] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(forceCategory);

    // Si cambia el forceCategory o el miembro, resetear
    useEffect(() => {
        if (forceCategory) {
            setSelectedCategory(forceCategory);
            // Seleccionar automáticamente la primera plantilla de la categoría forzada
            if (templates[forceCategory]) {
                setMessage(templates[forceCategory][0]);
            }
        } else {
            setSelectedCategory(null);
            setMessage('');
        }
    }, [forceCategory, member?.id, isOpen]);

    // Formatear fecha para el mensaje
    const formatMsgDate = (dateStr) => {
        if (!dateStr || dateStr === '1900-01-01') return 'pronto';
        try {
            const [y, m, d] = dateStr.split('-');
            return new Date(y, m - 1, d).toLocaleDateString('es-ES', { day: '2-digit', month: 'long' });
        } catch (e) { return dateStr; }
    };

    const categories = [
        { id: 'cumpleanos', label: 'Cumpleaños', icon: <Gift size={16} />, color: '#f43f5e' },
        { id: 'vencimiento', label: 'Vencimiento', icon: <Calendar size={16} />, color: '#f97316' },
        { id: 'bienvenida', label: 'Bienvenida', icon: <Heart size={16} />, color: '#ec4899' },
        { id: 'motivacion', label: 'Motivación', icon: <Dumbbell size={16} />, color: '#3b82f6' },
        { id: 'ausencia', label: 'Ausencia', icon: <Clock size={16} />, color: '#64748b' },
        { id: 'pago', label: 'Pago Pend.', icon: <Zap size={16} />, color: '#eab308' },
        { id: 'promo', label: 'Promo VIP', icon: <Gift size={16} />, color: '#8b5cf6' },
        { id: 'logro', label: 'Logro/Felic.', icon: <Award size={16} />, color: '#10b981' },
    ];

        cumpleanos: [
            `¡Feliz cumpleaños *${member?.name}*! 🎂🥳 De parte de todo el equipo de *${companyName}*, te deseamos un día increíble lleno de salud y muchos entrenamientos. ¡A celebrar! 🎈🥤\n\nTu familia de *${companyName}*`,
            `¡Hoy es un día especial, *${member?.name}*! 🎉 El equipo de *${companyName}* te desea un muy feliz cumpleaños. ¡Gracias por ser parte de nuestra comunidad! 🏋️✨\n\nAtentamente, *${companyName}*`
        ],
        vencimiento: [
            `¡Hola *${member?.name}*! 🏋️ Te saludamos de *${companyName}*. Te recordamos que tu plan vence el *${formatMsgDate(member?.endDate)}*. ¡No detengas tu progreso! Te esperamos hoy para entrenar. 💪\n\nTu equipo de *${companyName}*`,
            `¡Atención *${member?.name}*! 🚨 Tu membresía en *${companyName}* está por finalizar. Asegura tu renovación y sigue con ese gran ritmo. ¡Te esperamos! 🔥\n\nAtentamente, *${companyName}*`
        ],
        bienvenida: [
            `¡Bienvenido a *${companyName}*, *${member?.name}*! 🎉 Estamos felices de acompañarte en este camino. Hoy empieza tu transformación. ¡A darle con todo! ⚡\n\nTu equipo de *${companyName}*`,
            `¡Hola *${member?.name}*! 👋 Gracias por elegir *${companyName}*. Estamos aquí para apoyarte en cada entrenamiento. ¡Nos vemos en el área! 🏋️\n\nAtentamente, *${companyName}*`
        ],
        motivacion: [
            `¡Vamos *${member?.name}*! 🔥 En *${companyName}* creemos en tu potencial. La disciplina de hoy es el éxito de mañana. ¡Te esperamos para sudar la camiseta! 🏆\n\nTu equipo de *${companyName}* 💪`,
            `¡Buen día *${member?.name}*! 🌟 El único entrenamiento malo es el que no se hace. ¡Ven a *${companyName}* y libera tu energía! ⚡\n\nTu equipo de *${companyName}*`
        ],
        ausencia: [
            `¡Te extrañamos en *${companyName}*, *${member?.name}*! 🥺 Hace unos días no te vemos por aquí. ¡Regresa hoy y recupera tu racha! 💪\n\nTu equipo de *${companyName}*`,
            `¡Hola *${member?.name}*! 👋 ¿Todo bien? No dejes que el esfuerzo invertido se pierda. ¡Te esperamos en *${companyName}* para retomar con fuerza! 🏋️\n\nTu equipo de *${companyName}*`
        ],
        pago: [
            `Estimado *${member?.name}*, le saludamos de *${companyName}* para recordarle que tiene un pago pendiente. Por favor, acérquese a recepción para regularizarlo. ¡Saludos! 💳\n\nAdministración de *${companyName}*`,
            `¡Hola *${member?.name}*! 👋 En *${companyName}* tenemos un registro de pago pendiente. Si ya lo realizó, por favor ignore este mensaje. ¡Gracias! ✨\n\nAtentamente, *${companyName}*`
        ],
        promo: [
            `¡Exclusivo para ti, *${member?.name}*! 🎁 Solo por esta semana en *${companyName}*, renueva tu plan y llévate un beneficio especial. ¡Pregunta en recepción! 🚀\n\nTu equipo de *${companyName}*`,
            `¡Hola *${member?.name}*! 🔥 Tenemos una promoción VIP para nuestros miembros activos. No dejes pasar esta oportunidad en *${companyName}*. 💎\n\nAtentamente, *${companyName}*`
        ],
        logro: [
            `¡Felicidades *${member?.name}*! 🥳 En *${companyName}* hemos notado tu gran constancia. Estás logrando tus metas. ¡Eres una inspiración! 🥇\n\nTu equipo de *${companyName}*`,
            `¡Increíble progreso, *${member?.name}*! 👏 Tu dedicación en *${companyName}* está dando frutos. ¡A seguir ganando! 🔥\n\nTu equipo de *${companyName}*`
        ]
    };

    const handleSelectTemplate = (text) => {
        setMessage(text);
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div style={overlayStyle} onClick={onClose}>
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    style={modalStyle} 
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div style={headerStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={iconBoxStyle}><MessageCircle size={20} color="#fff" /></div>
                            <div>
                                <h3 style={titleStyle}>Mensaje a {member?.name}</h3>
                                <p style={subtitleStyle}>{member?.phone}</p>
                            </div>
                        </div>
                        <button onClick={onClose} style={closeBtnStyle}><X size={20} /></button>
                    </div>

                    <div style={contentStyle}>
                        {/* Categorías (Solo si no hay categoría forzada) */}
                        {!forceCategory && (
                            <div style={{ marginBottom: '20px' }}>
                                <label style={labelStyle}>CATEGORÍAS INTELIGENTES</label>
                                <div style={categoryGridStyle}>
                                    {categories.map(cat => (
                                    <button 
                                        key={cat.id}
                                        onClick={() => setSelectedCategory(cat.id)}
                                        style={{
                                            ...categoryBtnStyle,
                                            borderColor: selectedCategory === cat.id ? cat.color : '#e2e8f0',
                                            background: selectedCategory === cat.id ? `${cat.color}10` : '#fff',
                                            color: selectedCategory === cat.id ? cat.color : '#64748b'
                                        }}
                                    >
                                        {cat.icon}
                                        <span>{cat.label}</span>
                                    </button>
                                ))}
                                </div>
                            </div>
                        )}
                        {/* Plantillas Sugeridas */}
                        {selectedCategory && (
                            <motion.div 
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                style={{ marginBottom: '20px' }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                                    <Sparkles size={14} color="#8b5cf6" />
                                    <label style={labelStyle}>SUGERENCIAS DE IA</label>
                                </div>
                                <div style={templateListStyle}>
                                    {templates[selectedCategory].map((t, i) => (
                                        <div 
                                            key={i} 
                                            onClick={() => handleSelectTemplate(t)}
                                            style={templateItemStyle}
                                        >
                                            {t}
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}

                        {/* Editor de Mensaje */}
                        <div style={{ marginBottom: '20px' }}>
                            <label style={labelStyle}>MENSAJE PERSONALIZADO</label>
                            <textarea 
                                style={textareaStyle}
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Escribe tu mensaje aquí o selecciona una sugerencia..."
                            />
                        </div>
                    </div>

                    {/* Footer */}
                    <div style={footerStyle}>
                        <button onClick={onClose} style={cancelBtnStyle}>Cancelar</button>
                        <button 
                            disabled={!message}
                            onClick={() => {
                                onSend(member.phone, message);
                                onClose();
                            }}
                            style={{
                                ...sendBtnStyle,
                                opacity: !message ? 0.6 : 1,
                                cursor: !message ? 'not-allowed' : 'pointer'
                            }}
                        >
                            <Send size={18} />
                            Enviar WhatsApp
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}

const overlayStyle = {
    position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
    background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000
};

const modalStyle = {
    width: '100%', maxWidth: '500px', background: '#fff', borderRadius: '24px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden'
};

const headerStyle = {
    padding: '24px', borderBottom: '1px solid #f1f5f9', display: 'flex',
    alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)'
};

const iconBoxStyle = {
    width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)',
    display: 'flex', alignItems: 'center', justifyContent: 'center'
};

const titleStyle = { color: '#fff', fontSize: '18px', fontWeight: '700', margin: 0 };
const subtitleStyle = { color: 'rgba(255,255,255,0.6)', fontSize: '13px', margin: 0 };
const closeBtnStyle = { background: 'none', border: 'none', color: '#fff', cursor: 'pointer', opacity: 0.7 };

const contentStyle = { padding: '24px', maxHeight: '70vh', overflowY: 'auto' };

const labelStyle = { 
    fontSize: '11px', fontWeight: '800', color: '#94a3b8', 
    marginBottom: '10px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' 
};

const categoryGridStyle = { 
    display: 'grid', 
    gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', 
    gap: '6px' 
};

const categoryBtnStyle = {
    display: 'flex', 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: '10px',
    padding: '8px 12px', 
    borderRadius: '12px', 
    border: '1px solid', 
    fontSize: '11px',
    fontWeight: '600', 
    cursor: 'pointer', 
    transition: 'all 0.2s',
    textAlign: 'left'
};

const templateListStyle = { display: 'flex', flexDirection: 'column', gap: '8px' };

const templateItemStyle = {
    padding: '12px', background: '#f8fafc', borderRadius: '12px', fontSize: '13px',
    color: '#334155', cursor: 'pointer', border: '1px solid #e2e8f0', transition: 'all 0.2s',
    lineHeight: '1.4'
};

const textareaStyle = {
    width: '100%', height: '120px', padding: '16px', borderRadius: '16px',
    border: '1px solid #e2e8f0', fontSize: '14px', color: '#1e293b', resize: 'none',
    outline: 'none', focus: { borderColor: '#3b82f6' }
};

const footerStyle = {
    padding: '20px 24px', background: '#f8fafc', borderTop: '1px solid #f1f5f9',
    display: 'flex', gap: '12px', justifyContent: 'flex-end'
};

const cancelBtnStyle = {
    padding: '10px 20px', borderRadius: '12px', background: 'none',
    border: 'none', color: '#64748b', fontSize: '14px', fontWeight: '600', cursor: 'pointer'
};

const sendBtnStyle = {
    display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 24px',
    borderRadius: '12px', background: '#10b981', color: '#fff', fontSize: '14px',
    fontWeight: '600', border: 'none', transition: 'all 0.2s', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)'
};
