'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Dumbbell, Store, Check, Info } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function SettingsModal({ isOpen, onClose, db }) {
    const [businessType, setBusinessType] = useState('gym'); // 'gym' o 'universal'
    const [posLogo, setPosLogo] = useState('');
    const [customName, setCustomName] = useState('');
    const [useCustomName, setUseCustomName] = useState(false);
    const [saved, setSaved] = useState(false);
    const [loading, setLoading] = useState(true);

    const logoKey = `pos_logo_${db}`;
    const typeKey = `pos_business_type_${db}`;

    const availableLogos = [
        { id: 'logocia01.jpg', name: 'Logo Empresa 01' },
        { id: 'logocia02.jpg', name: 'Logo Empresa 02' },
        { id: 'logocia03.jpg', name: 'Logo Empresa 03' },
    ];

    useEffect(() => {
        const fetchSettings = async () => {
            if (!db) return;
            setLoading(true);
            try {
                // Cargar datos locales (Rubro y Logo)
                const storedType = localStorage.getItem(typeKey);
                const storedLogo = localStorage.getItem(logoKey);
                if (storedType) setBusinessType(storedType);
                
                if (storedLogo) {
                    setPosLogo(storedLogo);
                } else {
                    const dbCode = db?.replace('BdNava', '').padStart(2, '0') || '01';
                    setPosLogo(`logocia${dbCode}.jpg`);
                }

                // Cargar datos del servidor (Nombre Personalizado)
                const res = await fetch('/api/company/settings');
                const data = await res.json();
                if (data.company) {
                    setCustomName(data.company.customName || '');
                    setUseCustomName(data.company.useCustomName || false);
                }
            } catch (e) {
                console.error("Error al cargar configuraciones:", e);
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, [db]);

    const handleSave = async () => {
        try {
            // 1. Guardar en LocalStorage (Rubro y Logo)
            localStorage.setItem(typeKey, businessType);
            localStorage.setItem(logoKey, posLogo);

            // 2. Guardar en SQLite (Nombre Personalizado)
            await fetch('/api/company/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customName, useCustomName })
            });

            setSaved(true);
            setTimeout(() => {
                setSaved(false);
                onClose();
                window.location.reload();
            }, 1500);
        } catch (e) {
            alert("Error al guardar la configuración");
        }
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
                    <div style={{ ...contentStyle, maxHeight: '70vh', overflowY: 'auto' }}>
                        {/* RUBRO */}
                        <label style={labelStyle}>RUBRO DEL NEGOCIO</label>
                        <p style={infoTextStyle}>
                            <Info size={14} /> Determina el formato de los mensajes de WhatsApp.
                        </p>

                        <div style={gridStyle}>
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
                                    <h3 style={optionTitleStyle}>Gimnasio</h3>
                                    <p style={optionDescStyle}>Incluye vigencia de membresía en mensajes.</p>
                                </div>
                                {businessType === 'gym' && <div style={checkCircleStyle}><Check size={14} /></div>}
                            </div>

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
                                    <h3 style={optionTitleStyle}>Universal</h3>
                                    <p style={optionDescStyle}>Mensajes estándar de agradecimiento.</p>
                                </div>
                                {businessType === 'universal' && <div style={checkCircleStyle}><Check size={14} /></div>}
                            </div>
                        </div>

                        {/* IDENTIDAD DE MARCA */}
                        <label style={{ ...labelStyle, marginTop: '32px' }}>IDENTIDAD DE MARCA</label>
                        <p style={infoTextStyle}>
                            <Info size={14} /> Personaliza el nombre que aparece en los WhatsApps de membresía.
                        </p>

                        <div style={{ 
                            background: '#f8fafc', padding: '20px', borderRadius: '20px', 
                            border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '16px' 
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ flex: 1 }}>
                                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#1e293b' }}>
                                        Usar Nombre Personalizado
                                    </h4>
                                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>
                                        Activa esta opción para ignorar el nombre del RUC en el ERP.
                                    </p>
                                </div>
                                <div 
                                    onClick={() => setUseCustomName(!useCustomName)}
                                    style={{
                                        width: '48px', height: '24px', borderRadius: '24px',
                                        background: useCustomName ? '#10b981' : '#cbd5e1',
                                        padding: '4px', cursor: 'pointer', transition: 'all 0.3s ease',
                                        display: 'flex', alignItems: 'center',
                                        justifyContent: useCustomName ? 'flex-end' : 'flex-start'
                                    }}
                                >
                                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                                </div>
                            </div>

                            <AnimatePresence>
                                {useCustomName && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        style={{ overflow: 'hidden' }}
                                    >
                                        <input 
                                            type="text"
                                            placeholder="Escribe el nombre de tu negocio aquí..."
                                            value={customName}
                                            onChange={(e) => setCustomName(e.target.value)}
                                            style={{
                                                width: '100%', padding: '12px 16px', borderRadius: '12px',
                                                border: '2px solid #3b82f6', outline: 'none',
                                                fontSize: '14px', fontWeight: 600, color: '#1e293b'
                                            }}
                                        />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* LOGO SELECTOR */}
                        <label style={{ ...labelStyle, marginTop: '32px' }}>LOGO DE COMPROBANTE</label>
                        <p style={infoTextStyle}>
                            <Info size={14} /> Selecciona el logo que aparecerá en el PDF impreso y digital.
                        </p>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                            {availableLogos.map(logo => (
                                <div 
                                    key={logo.id}
                                    onClick={() => setPosLogo(logo.id)}
                                    style={{
                                        padding: '12px', border: '2px solid', borderRadius: '16px',
                                        cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s',
                                        borderColor: posLogo === logo.id ? '#3b82f6' : '#f1f5f9',
                                        background: posLogo === logo.id ? '#eff6ff' : '#fff'
                                    }}
                                >
                                    <div style={{ height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
                                        <img src={`/logos/${logo.id}`} alt={logo.name} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                                    </div>
                                    <span style={{ fontSize: '10px', fontWeight: 800, color: posLogo === logo.id ? '#3b82f6' : '#64748b' }}>{logo.name}</span>
                                </div>
                            ))}
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
