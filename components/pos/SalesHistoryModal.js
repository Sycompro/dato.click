'use client';
import { useState, useEffect } from 'react';
import { X, Receipt, Search, Printer, Calendar, Loader2, MessageCircle, CheckCircle2, Banknote, CreditCard, UserCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import NumericKeypad from './NumericKeypad';
import AlphanumericKeyboard from './AlphanumericKeyboard';

export default function SalesHistoryModal({ isOpen, onClose, idApeCaj, onPrint, company, onQueueWhatsApp, useScreenKeyboards }) {
    const [sales, setSales] = useState([]);
    const [sessionInfo, setSessionInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const [reprinting, setReprinting] = useState(null);
    const [showSearchKeyboard, setShowSearchKeyboard] = useState(false);
    const [showWaNumpad, setShowWaNumpad] = useState(false);

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
        if (!whatsappPhone || whatsappPhone.length < 9) return;
        
        const activeDb = company || localStorage.getItem('selected_company') || 'BdNava03';
        const logo = localStorage.getItem(`pos_logo_${activeDb}`) || `logocia${activeDb.replace('BdNava', '').padStart(2, '0')}.jpg`;
        const pdfUrl = `${window.location.origin}/api/sales/pdf?logo=${logo}&ndocu=${whatsappSale.ndocu}&cdocu=${whatsappSale.cdocu}&db=${activeDb}&ext=.pdf`;
        const msg = `*¡Gracias por tu compra!* 🤝\n\n` +
                    `📄 *Detalles del pedido:*\n` +
                    `* • Documento:* ${whatsappSale.cdocu === '01' ? 'Factura' : (whatsappSale.cdocu === '03' ? 'Boleta' : 'Nota')} ${whatsappSale.ndocu}\n` +
                    `* • Total:* S/ ${Number(whatsappSale.tota).toFixed(2)}\n\n` +
                    `¡Gracias por tu confianza!`;

        if (onQueueWhatsApp) {
            onQueueWhatsApp(whatsappPhone, msg, pdfUrl);
            setShowWaSuccess(true);
            setTimeout(() => {
                setShowWaSuccess(false);
                setWhatsappSale(null);
            }, 1000);
        } else {
            setSendingWa(true);
            try {
                await fetch('/api/whatsapp/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone: whatsappPhone, message: msg, media_url: pdfUrl })
                });
                setSendingWa(false);
                setShowWaSuccess(true);
                setTimeout(() => {
                    setShowWaSuccess(false);
                    setWhatsappSale(null);
                }, 2000);
            } catch (e) {
                setSendingWa(false);
            }
        }
    };

    if (!isOpen) return null;

    const filteredSales = sales.filter(s => 
        s.ndocu.toLowerCase().includes(filter.toLowerCase()) || 
        s.nomcli.toLowerCase().includes(filter.toLowerCase())
    );

    return (
        <div style={overlayStyle}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={modalStyle}>
                <div style={headerStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={iconBoxStyle}><Receipt size={18} /></div>
                        <div>
                            <h2 style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a', margin: 0 }}>Historial de Ventas</h2>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                <span style={miniTagStyle}>ID #{idApeCaj}</span>
                                {sessionInfo && (
                                    <span style={{ ...miniTagStyle, color: '#3b82f6', background: '#eff6ff' }}>
                                        Apertura: {new Date(sessionInfo.openingDate).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {!loading && (
                            <div style={summaryBoxStyle}>
                                <span style={summaryLabelStyle}>TOTAL SESIÓN</span>
                                <span style={summaryValueStyle}>S/ {sales.reduce((acc, s) => acc + s.tota, 0).toFixed(2)}</span>
                            </div>
                        )}
                        <button onClick={onClose} style={closeBtnStyle}><X size={16} /></button>
                    </div>
                </div>

                <div style={searchBoxStyle}>
                    <Search size={14} style={{ color: '#94a3b8' }} />
                    <input 
                        type="text" 
                        inputMode="none"
                        placeholder="Buscar por documento o cliente..." 
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                        onFocus={() => useScreenKeyboards && setShowSearchKeyboard(true)}
                        style={searchInputStyle}
                    />
                    <AlphanumericKeyboard 
                        isOpen={showSearchKeyboard}
                        onClose={() => setShowSearchKeyboard(false)}
                        onKeyPress={(key) => setFilter(prev => prev + key)}
                        onDelete={() => setFilter(prev => prev.slice(0, -1))}
                        value={filter}
                    />
                </div>

                <div style={contentStyle}>
                    {loading ? (
                        <div style={centerStyle}><Loader2 className="animate-spin" /></div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead style={tableHeaderStyle}>
                                <tr>
                                    <th style={thStyle}>DOCUMENTO</th>
                                    <th style={thStyle}>CLIENTE / IDENTIFICACIÓN</th>
                                    <th style={thStyle}>VENDEDOR</th>
                                    <th style={thStyle}>FECHA / HORA</th>
                                    <th style={{ ...thStyle, textAlign: 'right' }}>TOTAL</th>
                                    <th style={{ ...thStyle, textAlign: 'center' }}>ACCIONES</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSales.map(sale => (
                                    <tr key={sale.ndocu} style={rowStyle}>
                                        <td style={tdStyle}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={docNumStyle}>{sale.ndocu}</span>
                                                    <span style={docTypeStyle}>{sale.cdocu === '01' ? 'FACTURA' : (sale.cdocu === '03' ? 'BOLETA' : 'NOTA')}</span>
                                                </div>
                                                <span style={sale.status === 'ANULADO' ? statusBadgeAnulado : statusBadgeActivo}>
                                                    {sale.status}
                                                </span>
                                            </div>
                                        </td>
                                        <td style={tdStyle}>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={clientNameStyle}>{sale.nomcli.trim()}</span>
                                                <span style={clientIdStyle}>{sale.ruccli ? `DOC: ${sale.ruccli}` : 'SIN DOCUMENTO'}</span>
                                            </div>
                                        </td>
                                        <td style={tdStyle}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#64748b', fontSize: '11px', fontWeight: 600 }}>
                                                <UserCircle size={12} /> {sale.codven || 'V0001'}
                                            </div>
                                        </td>
                                        <td style={{ ...tdStyle, color: '#64748b' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontSize: '10px', fontWeight: 600 }}>{sale.fecha_real || new Date(sale.fecha).toLocaleDateString()}</span>
                                                <span style={{ fontSize: '11px', color: '#1e293b', fontWeight: 700 }}>{sale.hora_real}</span>
                                            </div>
                                        </td>
                                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                                                {sale.paymentType === 'EFECTIVO' ? <Banknote size={12} style={{ color: '#10b981' }} /> : <CreditCard size={12} style={{ color: '#3b82f6' }} />}
                                                <span style={totalStyle}>S/ {sale.tota.toFixed(2)}</span>
                                            </div>
                                        </td>
                                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                                <button onClick={() => openWaModal(sale)} style={actionBtnWa} title="WhatsApp"><MessageCircle size={14} /></button>
                                                <button onClick={() => handleReprint(sale)} disabled={reprinting === sale.ndocu} style={actionBtnPrint} title="Imprimir">
                                                    {reprinting === sale.ndocu ? <Loader2 className="animate-spin" size={14} /> : <Printer size={14} />}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </motion.div>

            {/* Modal de WhatsApp compacto */}
            <AnimatePresence>
                {whatsappSale && (
                    <div style={miniOverlayStyle}>
                        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} style={miniModalStyle}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 900 }}>Enviar Comprobante</h3>
                                <button onClick={() => setWhatsappSale(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={16} /></button>
                            </div>
                            <div style={{ position: 'relative' }}>
                                <input 
                                    type="text" 
                                    inputMode="none"
                                    value={whatsappPhone}
                                    onChange={e => setWhatsappPhone(e.target.value)}
                                    onFocus={() => useScreenKeyboards && setShowWaNumpad(true)}
                                    placeholder="Número de celular..."
                                    style={miniInputStyle}
                                />
                                <NumericKeypad 
                                    isOpen={showWaNumpad}
                                    onClose={() => setShowWaNumpad(false)}
                                    onKeyPress={(key) => { if(key !== '.') setWhatsappPhone(prev => prev + key) }}
                                    onDelete={() => setWhatsappPhone(prev => prev.slice(0, -1))}
                                    value={whatsappPhone}
                                />
                            </div>
                            <button onClick={handleSendWhatsApp} disabled={sendingWa} style={miniSendBtn}>
                                {sendingWa ? <Loader2 className="animate-spin" size={14} /> : <MessageCircle size={14} />}
                                {sendingWa ? 'Enviando...' : 'Enviar ahora'}
                            </button>
                            <AnimatePresence>
                                {showWaSuccess && (
                                    <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={miniToastStyle}>
                                        <CheckCircle2 size={12} /> ¡Enviado!
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

// Estilos Compactos y Profesionales
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' };
const modalStyle = { background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '850px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 70px rgba(0,0,0,0.2)' };
const headerStyle = { padding: '12px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff' };
const iconBoxStyle = { width: '32px', height: '32px', background: '#eff6ff', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f7df9' };
const miniTagStyle = { fontSize: '9px', fontWeight: 800, color: '#64748b', background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px', textTransform: 'uppercase' };
const summaryBoxStyle = { textAlign: 'right', background: '#f8fafc', padding: '6px 12px', borderRadius: '10px', border: '1px solid #f1f5f9' };
const summaryLabelStyle = { fontSize: '8px', fontWeight: 800, color: '#94a3b8', display: 'block' };
const summaryValueStyle = { fontSize: '15px', fontWeight: 900, color: '#10b981' };
const closeBtnStyle = { background: '#f8fafc', border: 'none', color: '#94a3b8', borderRadius: '8px', padding: '6px', cursor: 'pointer' };
const searchBoxStyle = { padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #f8fafc' };
const searchInputStyle = { flex: 1, border: 'none', outline: 'none', fontSize: '12px', fontWeight: 600, color: '#1e293b' };
const contentStyle = { flex: 1, overflowY: 'auto', padding: '0 20px' };
const tableHeaderStyle = { position: 'sticky', top: 0, background: '#fff', zIndex: 10 };
const thStyle = { textAlign: 'left', padding: '10px', fontSize: '9px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid #f1f5f9' };
const tdStyle = { padding: '10px', fontSize: '11px', borderBottom: '1px solid #f8fafc' };
const rowStyle = { transition: 'background 0.1s' };
const docNumStyle = { fontSize: '11px', fontWeight: 800, color: '#0f172a' };
const docTypeStyle = { fontSize: '9px', fontWeight: 700, color: '#94a3b8' };
const statusBadgeActivo = { fontSize: '8px', fontWeight: 900, color: '#10b981', background: '#ecfdf5', padding: '1px 6px', borderRadius: '4px' };
const statusBadgeAnulado = { fontSize: '8px', fontWeight: 900, color: '#ef4444', background: '#fff1f2', padding: '1px 6px', borderRadius: '4px' };
const clientNameStyle = { fontSize: '11px', fontWeight: 700, color: '#1e293b' };
const clientIdStyle = { fontSize: '9px', fontWeight: 600, color: '#94a3b8' };
const totalStyle = { fontSize: '12px', fontWeight: 900, color: '#4f7df9' };
const actionBtnWa = { border: 'none', borderRadius: '6px', padding: '6px', cursor: 'pointer', background: '#ecfdf5', color: '#10b981' };
const actionBtnPrint = { border: 'none', borderRadius: '6px', padding: '6px', cursor: 'pointer', background: '#f8fafc', color: '#64748b' };
const centerStyle = { padding: '60px 0', textAlign: 'center', color: '#94a3b8', fontWeight: 600, display: 'flex', justifyContent: 'center' };
const miniOverlayStyle = { position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, borderRadius: '16px' };
const miniModalStyle = { background: '#fff', padding: '16px', borderRadius: '12px', width: '260px', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', position: 'relative' };
const miniInputStyle = { width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none', marginBottom: '10px' };
const miniSendBtn = { width: '100%', padding: '8px', borderRadius: '8px', border: 'none', background: '#10b981', color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px' };
const miniToastStyle = { position: 'absolute', top: '-40px', left: '50%', transform: 'translateX(-50%)', background: '#10b981', color: '#fff', padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' };
