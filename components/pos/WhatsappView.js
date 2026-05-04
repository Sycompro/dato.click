import { MessageCircle, CheckCircle2, Copy, Save, ShieldCheck, Activity, Loader2, RefreshCcw, History, AlertCircle, Wifi, WifiOff, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

export default function WhatsappView() {
    const [settings, setSettings] = useState({ whatsapp_url: '', whatsapp_token: '' });
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showSaved, setShowSaved] = useState(false);
    const [connStatus, setConnStatus] = useState('unknown'); // unknown, checking, online, offline
    const [testing, setTesting] = useState(false);

    useEffect(() => {
        loadAll();
    }, []);

    const loadAll = async () => {
        setLoading(true);
        try {
            const [sRes, lRes] = await Promise.all([
                fetch('/api/settings/whatsapp'),
                fetch('/api/settings/whatsapp?type=logs')
            ]);
            const sData = await sRes.json();
            const lData = await lRes.json();
            
            setSettings({
                whatsapp_url: sData.whatsapp_url || '',
                whatsapp_token: sData.whatsapp_token || ''
            });
            setLogs(Array.isArray(lData) ? lData : []);
            if (sData.whatsapp_url && sData.whatsapp_token) checkConnection(sData.whatsapp_url, sData.whatsapp_token);
        } catch (e) {
            console.error('Error loading data:', e);
        } finally {
            setLoading(false);
        }
    };

    const checkConnection = async (url, token) => {
        if (!url || !token) return;
        setTesting(true);
        setConnStatus('checking');
        try {
            const res = await fetch('/api/whatsapp/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, token })
            });
            const data = await res.json();
            setConnStatus(data.online ? 'online' : 'offline');
        } catch (e) {
            setConnStatus('offline');
        } finally {
            setTesting(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/settings/whatsapp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            const data = await res.json();
            if (data.success) {
                setShowSaved(true);
                setTimeout(() => setShowSaved(false), 3000);
                checkConnection(settings.whatsapp_url, settings.whatsapp_token);
            } else alert('Error: ' + data.error);
        } catch (e) {
            alert('Error de conexión');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', zIndex: 1000 }}>
            <div style={{ textAlign: 'center' }}>
                <div style={{ position: 'relative', width: '80px', height: '80px', margin: '0 auto 20px' }}>
                    <Loader2 className="animate-spin" size={80} style={{ color: '#3b82f6', opacity: 0.2 }} />
                    <MessageCircle size={32} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#3b82f6' }} />
                </div>
                <p style={{ fontWeight: 800, color: '#1e293b', fontSize: '18px', margin: 0 }}>Cargando panel de control...</p>
                <p style={{ color: '#64748b', fontSize: '14px', marginTop: '8px' }}>Sincronizando con el servidor de mensajería</p>
            </div>
        </div>
    );

    return (
        <div style={{ padding: '40px', maxWidth: '1600px', margin: '0 auto', width: '100%', minHeight: '100vh' }}>
            <AnimatePresence>
                {showSaved && (
                    <motion.div 
                        initial={{ opacity: 0, y: -50, x: '-50%' }}
                        animate={{ opacity: 1, y: 30, x: '-50%' }}
                        exit={{ opacity: 0, y: -50, x: '-50%' }}
                        style={toastStyle}
                    >
                        <CheckCircle2 size={20} /> ¡Configuración guardada y sincronizada!
                    </motion.div>
                )}
            </AnimatePresence>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '32px', alignItems: 'start' }}>
                {/* Column 1: Config */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={cardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px' }}>
                        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                            <div style={iconBoxStyle}><Globe size={24} /></div>
                            <div>
                                <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', margin: 0 }}>Conexión API</h2>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: connStatus === 'online' ? '#10b981' : connStatus === 'offline' ? '#ef4444' : '#94a3b8' }}></div>
                                    <span style={{ fontSize: '12px', fontWeight: 700, color: connStatus === 'online' ? '#10b981' : connStatus === 'offline' ? '#ef4444' : '#64748b' }}>
                                        {connStatus === 'online' ? 'CONECTADO' : connStatus === 'offline' ? 'DESCONECTADO' : 'VERIFICANDO...'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button onClick={() => checkConnection(settings.whatsapp_url, settings.whatsapp_token)} disabled={testing} style={refreshBtnStyle}>
                                {testing ? <Loader2 size={18} className="animate-spin" /> : <Wifi size={18} />}
                            </button>
                            <button onClick={handleSave} disabled={saving} style={saveBtnStyle}>
                                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                <span>{saving ? 'Guardando...' : 'Guardar Ajustes'}</span>
                            </button>
                        </div>
                    </div>

                    <div style={{ marginBottom: '28px' }}>
                        <label style={labelStyle}><Activity size={14} /> URL DEL SERVICIO</label>
                        <input 
                            type="text" 
                            value={settings.whatsapp_url}
                            onChange={e => setSettings({ ...settings, whatsapp_url: e.target.value })}
                            placeholder="https://qr-api-wps-production.up.railway.app"
                            style={inputStyle}
                        />
                    </div>

                    <div style={{ marginBottom: '40px' }}>
                        <label style={labelStyle}><ShieldCheck size={14} /> API KEY / TOKEN DE ACCESO</label>
                        <div style={{ position: 'relative' }}>
                            <input 
                                type="password" 
                                value={settings.whatsapp_token}
                                onChange={e => setSettings({ ...settings, whatsapp_token: e.target.value })}
                                placeholder="Ingrese su token de seguridad..."
                                style={{ ...inputStyle, paddingRight: '50px' }}
                            />
                            <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
                                <ShieldCheck size={20} />
                            </div>
                        </div>
                    </div>

                    <div style={infoBoxStyle}>
                        <AlertCircle size={20} style={{ color: '#3b82f6', flexShrink: 0 }} />
                        <p style={{ fontSize: '13px', color: '#1e293b', margin: 0, lineHeight: '1.6' }}>
                            Esta configuración permite que el POS se comunique con el servidor de WhatsApp. <b>No comparta su Token</b> con personas ajenas a la administración.
                        </p>
                    </div>
                </motion.div>

                {/* Column 2: History */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} style={{ ...cardStyle, flex: 1.5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                            <div style={{ ...iconBoxStyle, background: '#f8fafc', color: '#64748b' }}><History size={24} /></div>
                            <div>
                                <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', margin: 0 }}>Historial de Envíos</h2>
                                <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>Monitor de mensajes en tiempo real</p>
                            </div>
                        </div>
                        <button onClick={loadAll} style={{ ...refreshBtnStyle, background: '#fff', border: '1px solid #e2e8f0' }}>
                            <RefreshCcw size={18} />
                        </button>
                    </div>

                    <div style={{ overflowX: 'auto', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc' }}>
                                    <th style={{ ...thStyle, padding: '16px' }}>DESTINATARIO</th>
                                    <th style={{ ...thStyle, padding: '16px' }}>ESTADO</th>
                                    <th style={{ ...thStyle, padding: '16px' }}>FECHA Y HORA</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.length === 0 ? (
                                    <tr>
                                        <td colSpan="3" style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
                                            <div style={{ marginBottom: '12px', opacity: 0.5 }}><MessageCircle size={40} style={{ margin: '0 auto' }} /></div>
                                            <p style={{ fontWeight: 600, fontSize: '14px' }}>No se han detectado envíos recientes</p>
                                        </td>
                                    </tr>
                                ) : logs.map(log => (
                                    <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ ...tdStyle, padding: '16px', fontWeight: 700 }}>{log.phone}</td>
                                        <td style={{ ...tdStyle, padding: '16px' }}>
                                            <div style={{ 
                                                padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 900,
                                                background: log.status === 'EXITOSO' ? '#ecfdf5' : '#fef2f2',
                                                color: log.status === 'EXITOSO' ? '#10b981' : '#ef4444',
                                                display: 'inline-flex', alignItems: 'center', gap: '6px'
                                            }}>
                                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: log.status === 'EXITOSO' ? '#10b981' : '#ef4444' }}></div>
                                                {log.status}
                                            </div>
                                        </td>
                                        <td style={{ ...tdStyle, padding: '16px', color: '#64748b' }}>
                                            {new Date(log.created_at).toLocaleString('es-PE', { 
                                                timeZone: 'America/Lima',
                                                day: '2-digit', 
                                                month: '2-digit', 
                                                hour: '2-digit', 
                                                minute: '2-digit',
                                                hour12: false
                                            })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}

const cardStyle = {
    background: '#fff',
    borderRadius: '32px',
    padding: '48px',
    boxShadow: '0 20px 60px rgba(15, 23, 42, 0.03)',
    border: '1px solid #f1f5f9',
    height: '100%'
};

const iconBoxStyle = {
    width: '56px',
    height: '56px',
    background: '#eff6ff',
    color: '#3b82f6',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
};

const labelStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '12px',
    fontWeight: 800,
    color: '#94a3b8',
    letterSpacing: '0.05em',
    marginBottom: '12px'
};

const inputStyle = {
    width: '100%',
    padding: '16px 20px',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '16px',
    fontSize: '15px',
    color: '#1e293b',
    outline: 'none',
    transition: 'all 0.3s',
    fontWeight: 600,
    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
};

const saveBtnStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: '#0f172a',
    color: '#fff',
    border: 'none',
    borderRadius: '16px',
    padding: '14px 24px',
    fontSize: '14px',
    fontWeight: 800,
    cursor: 'pointer',
    transition: 'all 0.3s',
    boxShadow: '0 10px 20px rgba(15, 23, 42, 0.1)'
};

const refreshBtnStyle = {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    color: '#64748b',
    borderRadius: '16px',
    padding: '14px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s'
};

const infoBoxStyle = {
    padding: '20px',
    background: '#f0f9ff',
    borderRadius: '20px',
    border: '1px solid #e0f2fe',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px'
};

const thStyle = {
    textAlign: 'left',
    fontSize: '11px',
    fontWeight: 800,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.1em'
};

const tdStyle = {
    fontSize: '14px',
    color: '#1e293b'
};

const toastStyle = {
    position: 'fixed',
    top: '40px',
    left: '50%',
    background: '#0f172a',
    color: '#fff',
    padding: '16px 32px',
    borderRadius: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    fontSize: '15px',
    fontWeight: 700,
    boxShadow: '0 30px 60px rgba(0,0,0,0.2)',
    zIndex: 2000,
    border: '1px solid rgba(255,255,255,0.1)'
};
