'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Dumbbell, Store, Check, Info, UploadCloud } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function SettingsModal({ isOpen, onClose, db, onSaved }) {
    const [businessType, setBusinessType] = useState('gym'); // 'gym' o 'universal'
    const [posLogo, setPosLogo] = useState('');
    const [customName, setCustomName] = useState('');
    const [useCustomName, setUseCustomName] = useState(false);
    const [saved, setSaved] = useState(false);
    const [loading, setLoading] = useState(true);
    const [whatsappUrl, setWhatsappUrl] = useState('');
    const [whatsappToken, setWhatsappToken] = useState('');
    const [useScreenKeyboards, setUseScreenKeyboards] = useState(true);

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
                const res = await fetch('/api/company/settings');
                const data = await res.json();
                if (data.company) {
                    setCustomName(data.company.customName || '');
                    setUseCustomName(data.company.useCustomName || false);
                    setPosLogo(data.company.logo || '');
                    setBusinessType(data.company.businessType || 'gym');
                    if (data.whatsapp) {
                        setWhatsappUrl(data.whatsapp.url || '');
                        setWhatsappToken(data.whatsapp.token || '');
                    }
                }
            } catch (e) {
                console.error("Error al cargar configuraciones:", e);
            } finally {
                setLoading(false);
            }
        };

        // Cargar preferencia de teclado desde localStorage (per-device)
        const savedKbd = localStorage.getItem('pos_use_screen_keyboards');
        if (savedKbd !== null) {
            setUseScreenKeyboards(savedKbd === 'true');
        }

        fetchSettings();
    }, [db]);

    const handleLogoUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        if (file.size > 500 * 1024) {
            alert('El archivo es muy pesado. Por favor sube una imagen de menos de 500KB.');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setPosLogo(reader.result);
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        try {
            // Guardar todo en SQL Server a través del API
            await fetch('/api/company/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    customName, 
                    useCustomName,
                    companyLogoUrl: posLogo,
                    businessType,
                    whatsappUrl,
                    whatsappToken
                })
            });

            // Guardar preferencia de teclado localmente
            localStorage.setItem('pos_use_screen_keyboards', useScreenKeyboards);

            setSaved(true);
            setTimeout(() => {
                setSaved(false);
                if (onSaved) onSaved();
                onClose();
            }, 1000);
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

                        {/* COMPORTAMIENTO DEL SISTEMA */}
                        <label style={{ ...labelStyle, marginTop: '32px' }}>INTERFAZ Y TECLADO</label>
                        <p style={infoTextStyle}>
                            <Info size={14} /> Activa o desactiva los teclados de cristal en pantalla.
                        </p>

                        <div style={{ 
                            background: '#f8fafc', padding: '20px', borderRadius: '20px', 
                            border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '16px' 
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ flex: 1 }}>
                                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#1e293b' }}>
                                        Usar Teclados en Pantalla
                                    </h4>
                                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>
                                        Ideal para tablets. Desactívalo si usas una PC con teclado físico.
                                    </p>
                                </div>
                                <div 
                                    onClick={() => setUseScreenKeyboards(!useScreenKeyboards)}
                                    style={{
                                        width: '48px', height: '24px', borderRadius: '24px',
                                        background: useScreenKeyboards ? '#3b82f6' : '#cbd5e1',
                                        padding: '4px', cursor: 'pointer', transition: 'all 0.3s ease',
                                        display: 'flex', alignItems: 'center',
                                        justifyContent: useScreenKeyboards ? 'flex-end' : 'flex-start'
                                    }}
                                >
                                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                                </div>
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

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                            {/* Botón de Subir Personalizado */}
                            <label style={{
                                padding: '12px', border: '2px dashed #cbd5e1', borderRadius: '16px',
                                cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s',
                                background: '#f8fafc', display: 'flex', flexDirection: 'column',
                                alignItems: 'center', justifyContent: 'center'
                            }}>
                                <input 
                                    type="file" 
                                    accept="image/png, image/jpeg" 
                                    onChange={handleLogoUpload} 
                                    style={{ display: 'none' }} 
                                />
                                <UploadCloud size={24} style={{ color: '#94a3b8', marginBottom: '8px' }} />
                                <span style={{ fontSize: '10px', fontWeight: 800, color: '#64748b' }}>Subir Nuevo</span>
                            </label>

                            {/* Mostrar logo personalizado si está en base64 */}
                            {posLogo && posLogo.startsWith('data:image') && (
                                <div style={{
                                    padding: '12px', border: '2px solid', borderRadius: '16px',
                                    cursor: 'pointer', textAlign: 'center',
                                    borderColor: '#3b82f6', background: '#eff6ff'
                                }}>
                                    <div style={{ height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
                                        <img src={posLogo} alt="Mi Logo" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                                    </div>
                                    <span style={{ fontSize: '10px', fontWeight: 800, color: '#3b82f6' }}>Mi Logo (Actual)</span>
                                </div>
                            )}

                            {availableLogos.map(logo => {
                                // No mostrar el predeterminado si hay un base64 activo y choca
                                const isActive = posLogo === logo.id;
                                return (
                                    <div 
                                        key={logo.id}
                                        onClick={() => setPosLogo(logo.id)}
                                        style={{
                                            padding: '12px', border: '2px solid', borderRadius: '16px',
                                            cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s',
                                            borderColor: isActive ? '#3b82f6' : '#f1f5f9',
                                            background: isActive ? '#eff6ff' : '#fff'
                                        }}
                                    >
                                        <div style={{ height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
                                            <img src={`/logos/${logo.id}`} alt={logo.name} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                                        </div>
                                        <span style={{ fontSize: '10px', fontWeight: 800, color: isActive ? '#3b82f6' : '#64748b' }}>{logo.name}</span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* CONFIGURACIÓN WHATSAPP */}
                        <label style={{ ...labelStyle, marginTop: '32px' }}>CONFIGURACIÓN WHATSAPP (EVOLUTION API)</label>
                        <p style={infoTextStyle}>
                            <Info size={14} /> Credenciales para el envío automático de comprobantes y alertas.
                        </p>

                        <div style={{ 
                            background: '#f8fafc', padding: '20px', borderRadius: '20px', 
                            border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '16px' 
                        }}>
                            <div>
                                <label style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', marginBottom: '6px', display: 'block' }}>URL DEL SERVIDOR</label>
                                <input 
                                    type="text"
                                    placeholder="https://api.tu-servidor.com"
                                    value={whatsappUrl}
                                    onChange={(e) => setWhatsappUrl(e.target.value)}
                                    style={modalInputStyle}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', marginBottom: '6px', display: 'block' }}>API KEY / TOKEN</label>
                                <input 
                                    type="password"
                                    placeholder="Tu token de seguridad..."
                                    value={whatsappToken}
                                    onChange={(e) => setWhatsappToken(e.target.value)}
                                    style={modalInputStyle}
                                />
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
const modalInputStyle = {
    width: '100%', padding: '12px 16px', borderRadius: '12px',
    border: '1px solid #e2e8f0', outline: 'none',
    fontSize: '14px', fontWeight: 600, color: '#1e293b', background: '#fff'
};

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
