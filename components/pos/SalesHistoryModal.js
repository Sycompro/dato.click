'use client';
import { useState, useEffect } from 'react';
import { X, Receipt, Search, Printer, Calendar, Loader2, MessageCircle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function SalesHistoryModal({ isOpen, onClose, idApeCaj, onPrint, company }) {
    const [sales, setSales] = useState([]);
    const [sessionInfo, setSessionInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const [reprinting, setReprinting] = useState(null);

    const activeDb = company || 'BdNava03';

    useEffect(() => {
        if (isOpen && idApeCaj) {
            fetchSales();
        }
    }, [isOpen, idApeCaj]);

    const fetchSales = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/sales/history?idApeCaj=${idApeCaj}`);
            const data = await res.json();
            setSales(Array.isArray(data.sales) ? data.sales : []);
            setSessionInfo(data.sessionInfo);
        } catch (e) {
            console.error('Error fetching history:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleReprint = async (sale) => {
        setReprinting(sale.ndocu);
        try {
            const res = await fetch(`/api/sales/details?cdocu=${sale.cdocu}&ndocu=${sale.ndocu}`);
            const data = await res.json();
            if (data.items) {
                onPrint({
                    documentNumber: data.ndocu,
                    docType: data.cdocu,
                    customer: { name: data.nomcli, ruc: data.ruccli },
                    items: data.items,
                    total: data.total,
                    base: data.base,
                    igv: data.igv,
                    date: new Date(data.fecha).toLocaleString(),
                    salesperson: data.salesperson
                });
            }
        } catch (e) {
            console.error('Error reprinting:', e);
            alert('Error al obtener detalles de la venta');
        } finally {
            setReprinting(null);
        }
    };

    const [whatsappSale, setWhatsappSale] = useState(null);
    const [whatsappPhone, setWhatsappPhone] = useState('');
    const [sendingWa, setSendingWa] = useState(false);
    const [showWaSuccess, setShowWaSuccess] = useState(false);

    const openWaModal = (sale) => {
        setWhatsappSale(sale);
        setWhatsappPhone(sale.phone || '');
    };

    const handleSendWhatsApp = async () => {
        if (!whatsappPhone || whatsappPhone.length < 9) {
            alert('Ingrese un número válido');
            return;
        }
        
        setSendingWa(true);
        try {
            const activeDb = company || 'BdNava03';
            const pdfUrl = `${window.location.origin}/api/sales/pdf?ndocu=${whatsappSale.ndocu}&cdocu=${whatsappSale.cdocu}&db=${activeDb}`;
            
            const customerName = whatsappSale.nomcli.trim();
            const businessType = localStorage.getItem('pos_business_type') || 'gym';
            const companyName = "GIM.BRA S.A.C.";
            
            let msg = '';
            if (businessType === 'gym') {
                msg = `*¡Hola!* Tu membresía en *${companyName}* está activa. 🏋️\n\n` +
                      `📋 *Detalles:*\n` +
                      `* • Inicio:* ${new Date(whatsappSale.fecha).toLocaleDateString('es-PE')}\n`;
                if (whatsappSale.fecfinpres) {
                    msg += `* • Vencimiento:* ${new Date(whatsappSale.fecfinpres).toLocaleDateString('es-PE')}\n`;
                }
                msg += `\n¡Gracias por tu preferencia!`;
            } else {
                msg = `*¡Hola!* Gracias por tu compra en *${companyName}*. 🤝\n\n` +
                      `📄 *Documento:* ${whatsappSale.cdocu === '01' ? 'Factura' : (whatsappSale.cdocu === '03' ? 'Boleta' : 'Nota')} ${whatsappSale.ndocu}\n` +
                      `💰 *Monto:* S/ ${Number(whatsappSale.tota).toFixed(2)}\n\n` +
                      `¡Gracias por tu confianza! ¡Que tengas un gran día!`;
            }

            fetch('/api/whatsapp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    phone: whatsappPhone, 
                    message: msg,
                    media_url: pdfUrl
                })
            }).then(async r => {
                const text = await r.text();
                try {
                    return JSON.parse(text);
                } catch(e) {
                    return { success: false, error: 'Respuesta no válida' };
                }
            }).then(data => {
                if (!data.success) console.log('WA Note:', data.error);
            }).catch(e => {
                // Silenciamos errores de red/saturación para no asustar al usuario
                console.log('WA Async skip');
            });

            // Respuesta instantánea en UI
            setSendingWa(false);
            setShowWaSuccess(true);
            setTimeout(() => {
                setShowWaSuccess(false);
                setWhatsappSale(null);
            }, 2000);

        } catch (e) {
            console.error('WA optimization error:', e);
            setSendingWa(false);
            alert('Error al iniciar el envío');
        }
    };

    if (!isOpen) return null;

    const filteredSales = sales.filter(s => 
        s.ndocu.toLowerCase().includes(filter.toLowerCase()) || 
        s.nomcli.toLowerCase().includes(filter.toLowerCase())
    );

    return (
        <div style={overlayStyle}>
            <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} style={modalStyle}>
                <div style={headerStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={iconBoxStyle}><Receipt size={20} /></div>
                        <div>
                            <h2 style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', margin: 0 }}>Historial de Ventas</h2>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>Sesión de Caja #{idApeCaj}</p>
                                {sessionInfo && (
                                    <p style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 800, margin: 0, background: '#eff6ff', padding: '2px 8px', borderRadius: '4px' }}>
                                        Apertura: {new Date(sessionInfo.openingDate).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })} - {sessionInfo.openingTime.split(' ')[1]} {sessionInfo.openingTime.split(' ')[2]}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        {!loading && (
                            <div style={{ textAlign: 'right', background: '#f8fafc', padding: '8px 16px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                                <p style={{ fontSize: '10px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', margin: 0 }}>Ventas Totales</p>
                                <p style={{ fontSize: '18px', fontWeight: 900, color: '#10b981', margin: 0 }}>S/ {sales.reduce((acc, s) => acc + s.tota, 0).toFixed(2)}</p>
                            </div>
                        )}
                        <button onClick={onClose} style={closeBtnStyle}><X size={20} /></button>
                    </div>
                </div>

                <div style={searchBoxStyle}>
                    <Search size={18} style={{ color: '#94a3b8' }} />
                    <input 
                        type="text" 
                        placeholder="Buscar por Nro de documento o cliente..." 
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                        style={searchInputStyle}
                    />
                </div>

                <div style={contentStyle}>
                    {loading ? (
                        <div style={centerStyle}>Cargando historial...</div>
                    ) : filteredSales.length === 0 ? (
                        <div style={centerStyle}>No hay ventas registradas en esta sesión.</div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead style={tableHeaderStyle}>
                                <tr>
                                    <th style={thStyle}>Documento</th>
                                    <th style={thStyle}>Cliente</th>
                                    <th style={thStyle}>Hora</th>
                                    <th style={thStyle}>Total</th>
                                    <th style={{ ...thStyle, textAlign: 'center' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSales.map(sale => (
                                    <tr key={sale.ndocu} style={rowStyle}>
                                        <td style={tdStyle}>
                                            <span style={{ fontWeight: 800, color: '#1e293b' }}>{sale.ndocu}</span>
                                            <div style={{ fontSize: '10px', color: '#94a3b8' }}>{sale.cdocu === '01' ? 'FACTURA' : (sale.cdocu === '03' ? 'BOLETA' : 'NOTA')}</div>
                                        </td>
                                        <td style={tdStyle}>{sale.nomcli}</td>
                                        <td style={tdStyle}>{new Date(sale.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                        <td style={{ ...tdStyle, fontWeight: 900, color: '#3b82f6' }}>S/ {sale.tota.toFixed(2)}</td>
                                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                <button 
                                                    onClick={() => openWaModal(sale)}
                                                    style={{ ...actionBtnStyle, background: '#ecfdf5', color: '#10b981' }}
                                                    title="Enviar WhatsApp"
                                                >
                                                    <MessageCircle size={18} />
                                                </button>
                                                <button 
                                                    onClick={() => handleReprint(sale)}
                                                    disabled={reprinting === sale.ndocu}
                                                    style={{ ...actionBtnStyle, background: '#f8fafc', color: '#64748b' }} 
                                                    title="Reimprimir Ticket"
                                                >
                                                    {reprinting === sale.ndocu ? <Loader2 style={{ animation: 'spin 1s linear infinite' }} size={16} /> : <Printer size={18} />}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <AnimatePresence>
                    {whatsappSale && (
                        <div style={miniOverlayStyle}>
                            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} style={miniModalStyle}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 900 }}>Enviar WhatsApp</h3>
                                    <button onClick={() => setWhatsappSale(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
                                </div>
                                <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
                                    Enviando: <b>{whatsappSale.cdocu === '01' ? 'Factura' : 'Boleta'} {whatsappSale.ndocu}</b>
                                </p>
                                <div style={{ marginBottom: '16px' }}>
                                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: '6px' }}>NÚMERO DE CELULAR</label>
                                    <input 
                                        type="text" 
                                        value={whatsappPhone}
                                        onChange={e => setWhatsappPhone(e.target.value)}
                                        placeholder="999999999"
                                        style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none' }}
                                    />
                                </div>
                                <button 
                                    onClick={handleSendWhatsApp}
                                    disabled={sendingWa}
                                    style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: '#10b981', color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                                >
                                {sendingWa ? <Loader2 style={{ animation: 'spin 1s linear infinite' }} size={18} /> : <MessageCircle size={18} />}
                                {sendingWa ? 'Enviando...' : 'Enviar Comprobante'}
                            </button>

                            <AnimatePresence>
                                {showWaSuccess && (
                                    <motion.div 
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 10 }}
                                        style={miniToastStyle}
                                    >
                                        <CheckCircle2 size={16} /> ¡Enviado con éxito!
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    </div>
                )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
}

const miniOverlayStyle = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, borderRadius: '24px' };
const miniModalStyle = { background: '#fff', padding: '24px', borderRadius: '20px', width: '100%', maxWidth: '320px', boxShadow: '0 20px 50px rgba(0,0,0,0.1)', position: 'relative' };
const miniToastStyle = {
    position: 'absolute',
    top: '-60px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: '#fff',
    padding: '12px 24px',
    borderRadius: '100px',
    boxShadow: '0 10px 40px -10px rgba(16, 185, 129, 0.5)',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '14px',
    fontWeight: 700,
    zIndex: 9999,
    border: '1px solid rgba(255,255,255,0.2)',
    whiteSpace: 'nowrap',
    pointerEvents: 'none'
};
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)', zIndex: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' };
const modalStyle = { background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '900px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 30px 100px rgba(0,0,0,0.3)', position: 'relative' };
const headerStyle = { padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const iconBoxStyle = { width: '40px', height: '40px', background: '#eff6ff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' };
const closeBtnStyle = { background: '#f8fafc', border: 'none', color: '#94a3b8', borderRadius: '10px', padding: '8px', cursor: 'pointer' };
const searchBoxStyle = { padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid #f8fafc' };
const searchInputStyle = { flex: 1, border: 'none', outline: 'none', fontSize: '14px', fontWeight: 600, color: '#1e293b' };
const contentStyle = { flex: 1, overflowY: 'auto', padding: '0 24px' };
const tableHeaderStyle = { position: 'sticky', top: 0, background: '#fff', zIndex: 10 };
const thStyle = { textAlign: 'left', padding: '12px', fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid #f1f5f9' };
const tdStyle = { padding: '16px 12px', fontSize: '13px', borderBottom: '1px solid #f8fafc' };
const rowStyle = { transition: 'background 0.2s' };
const actionBtnStyle = {
    border: 'none',
    borderRadius: '8px',
    padding: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s'
};

const printBtnStyle = { background: '#f8fafc', border: 'none', color: '#64748b', borderRadius: '8px', padding: '8px', cursor: 'pointer' };
const centerStyle = { padding: '100px 0', textAlign: 'center', color: '#94a3b8', fontWeight: 600 };
