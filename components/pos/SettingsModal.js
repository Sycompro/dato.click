'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Dumbbell, Store, Check, Info } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function SettingsModal({ isOpen, onClose }) {
    const [businessType, setBusinessType] = useState('gym'); // 'gym' o 'universal'
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem('pos_business_type');
        if (stored) setBusinessType(stored);
    }, []);

    const handleSave = () => {
        localStorage.setItem('pos_business_type', businessType);
        setSaved(true);
        setTimeout(() => {
            setSaved(false);
            onClose();
        }, 1500);
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div style={overlayStyle}>
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    style={modalStyle}
                >
                    {/* Header */}
                    <div style={headerStyle}>
                        <div>
                            <h2 style={titleStyle}>Configuración del POS</h2>
                            <p style={subtitleStyle}>Ajusta el comportamiento del sistema según tu negocio</p>
                        </div>
                        <button onClick={onClose} style={closeButtonStyle}><X size={20} /></button>
                    </div>

                    {/* Content */}
                    <div style={contentStyle}>
                        <label style={labelStyle}>RUBRO DEL NEGOCIO</label>
                        <p style={infoTextStyle}>
                            <Info size={14} /> Selecciona el rubro para personalizar los mensajes de WhatsApp automáticos.
                        </p>

                        <div style={gridStyle}>
                            {/* Opción GYM */}
                            <div 
                                onClick={() => setBusinessType('gym')}
                                style={{
                                    ...optionCardStyle,
                                    borderColor: businessType === 'gym' ? '#3b82f6' : '#e2e8f0',
                                    background: businessType === 'gym' ? '#eff6ff' : '#fff'
                                }}
                            >
                                <div style={{ ...iconWrapperStyle, background: businessType === 'gym' ? '#3b82f6' : '#f1f5f9', color: businessType === 'gym' ? '#fff' : '#64748b' }}>
                                    <Dumbbell size={24} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <h3 style={optionTitleStyle}>Gimnasio / Centro Fitness</h3>
                                    <p style={optionDescStyle}>Mensajes con fecha de inicio, vencimiento y bienvenida al socio.</p>
                                </div>
                                {businessType === 'gym' && <div style={checkCircleStyle}><Check size={14} /></div>}
                            </div>

                            {/* Opción UNIVERSAL */}
                            <div 
                                onClick={() => setBusinessType('universal')}
                                style={{
                                    ...optionCardStyle,
                                    borderColor: businessType === 'universal' ? '#3b82f6' : '#e2e8f0',
                                    background: businessType === 'universal' ? '#eff6ff' : '#fff'
                                }}
                            >
                                <div style={{ ...iconWrapperStyle, background: businessType === 'universal' ? '#3b82f6' : '#f1f5f9', color: businessType === 'universal' ? '#fff' : '#64748b' }}>
                                    <Store size={24} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <h3 style={optionTitleStyle}>Comercio Universal</h3>
                                    <p style={optionDescStyle}>Mensajes estándar de agradecimiento con detalle de compra y monto.</p>
                                </div>
                                {businessType === 'universal' && <div style={checkCircleStyle}><Check size={14} /></div>}
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div style={footerStyle}>
                        <button onClick={onClose} style={cancelButtonStyle}>Cancelar</button>
                        <button onClick={handleSave} style={saveButtonStyle}>
                            {saved ? '¡Configuración Guardada!' : 'Guardar Cambios'}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}

// Estilos
const overlayStyle = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px'
};

const modalStyle = {
    background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '550px',
    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden'
};

const headerStyle = {
    padding: '24px 32px', borderBottom: '1px solid #f1f5f9', display: 'flex',
    alignItems: 'center', justifyContent: 'space-between'
};

const titleStyle = { margin: 0, fontSize: '20px', fontWeight: 900, color: '#1e293b' };
const subtitleStyle = { margin: '4px 0 0', fontSize: '13px', color: '#64748b' };
const closeButtonStyle = { background: '#f1f5f9', border: 'none', borderRadius: '12px', padding: '8px', cursor: 'pointer', color: '#64748b' };

const contentStyle = { padding: '32px' };
const labelStyle = { display: 'block', fontSize: '11px', fontWeight: 900, color: '#94a3b8', letterSpacing: '0.05em', marginBottom: '8px' };
const infoTextStyle = { fontSize: '13px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '24px' };

const gridStyle = { display: 'flex', flexDirection: 'column', gap: '16px' };

const optionCardStyle = {
    display: 'flex', alignItems: 'center', gap: '20px', padding: '20px', borderRadius: '20px',
    border: '2px solid transparent', cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative'
};

const iconWrapperStyle = {
    width: '56px', height: '56px', borderRadius: '16px', display: 'flex',
    alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease'
};

const optionTitleStyle = { margin: 0, fontSize: '16px', fontWeight: 800, color: '#1e293b' };
const optionDescStyle = { margin: '4px 0 0', fontSize: '13px', color: '#64748b', lineHeight: '1.4' };

const checkCircleStyle = {
    position: 'absolute', top: '12px', right: '12px', background: '#3b82f6',
    color: '#fff', borderRadius: '50%', width: '22px', height: '22px',
    display: 'flex', alignItems: 'center', justifyContent: 'center'
};

const footerStyle = { padding: '24px 32px', background: '#f8fafc', display: 'flex', gap: '12px', justifyContent: 'flex-end' };
const cancelButtonStyle = { background: 'transparent', border: 'none', color: '#64748b', fontWeight: 700, cursor: 'pointer', padding: '12px 20px' };
const saveButtonStyle = {
    background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '14px',
    padding: '12px 28px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.3)'
};
