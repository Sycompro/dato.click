import { CheckCircle2, Receipt, Printer, ArrowRight, MessageCircle, Loader2 } from 'lucide-react';
import { useState } from 'react';

export default function SuccessModal({ orderNumber, onReset, onPrint, customerPhone, total, docType, membershipInfo }) {
    const [phone, setPhone] = useState(customerPhone || '');
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);

    const handleSendWhatsApp = async () => {
        if (!phone || phone.length < 9) return alert('Ingrese un número válido');
        setSending(true);
        try {
            const businessType = localStorage.getItem('pos_business_type') || 'gym';
            const customerName = 'Cliente'; // Podríamos pasar el nombre si fuera necesario
            
            let msg = '';
            // Si el objeto membershipInfo tiene datos, es una membresía
            const isMembership = membershipInfo && membershipInfo.startDate && membershipInfo.endDate;

            if (isMembership) {
                msg = `*¡Bienvenido!* Tu membresía está activa. 🏋️\n\n` +
                      `📋 *Detalles:*\n` +
                      `* • Inicio:* ${membershipInfo.startDate}\n` +
                      `* • Vencimiento:* ${membershipInfo.endDate}\n\n` +
                      `¡Gracias por tu preferencia!`;
            } else {
                msg = `*¡Gracias por tu compra!* 🤝\n\n` +
                      `📄 *Detalles del pedido:*\n` +
                      `* • Documento:* ${docType === '01' ? 'Factura' : (docType === '03' ? 'Boleta' : 'Nota')} ${orderNumber}\n` +
                      `* • Total:* S/ ${Number(total).toFixed(2)}\n\n` +
                      `¡Gracias por tu confianza!`;
            }

            const pdfUrl = `${window.location.origin}/api/sales/pdf?ndocu=${orderNumber}&cdocu=${docType}`;
            
            const res = await fetch('/api/whatsapp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    phone, 
                    message: msg,
                    media_url: pdfUrl
                })
            });
            const data = await res.json();
            if (data.success) {
                setSent(true);
                setTimeout(() => setSent(false), 3000);
            } else {
                alert('Error al enviar: ' + data.error);
            }
        } catch (e) {
            alert('Error de conexión');
        } finally {
            setSending(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(8px)', zIndex: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
        }}>
            <div style={{
                background: '#fff', borderRadius: '24px', padding: '32px',
                maxWidth: '420px', width: '100%', textAlign: 'center',
                boxShadow: '0 25px 60px rgba(0,0,0,0.15)',
                position: 'relative', overflow: 'hidden',
            }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
                    background: 'linear-gradient(to right, #10b981, #3b82f6, #8b5cf6)' }} />

                <div style={{
                    width: '60px', height: '60px', background: '#ecfdf5', borderRadius: '18px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 16px', color: '#10b981',
                }}>
                    <CheckCircle2 size={32} strokeWidth={1.5} />
                </div>

                <h2 style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', margin: '0 0 4px' }}>¡Venta Exitosa!</h2>
                <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 20px' }}>Documento generado correctamente</p>

                <div style={{
                    background: '#f8fafc', borderRadius: '16px', padding: '16px',
                    marginBottom: '20px', border: '1px solid #f1f5f9',
                    position: 'relative',
                }}>
                    <p style={{ fontSize: '8px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '4px' }}>
                        {docType === '01' ? 'Factura' : (docType === '03' ? 'Boleta' : 'Nota')} N°
                    </p>
                    <p style={{ fontSize: '24px', fontWeight: 900, color: '#3b82f6', margin: 0 }}>{orderNumber}</p>
                </div>

                {/* WhatsApp Section */}
                <div style={{ marginBottom: '20px', textAlign: 'left' }}>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>Enviar a WhatsApp</p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <input 
                            type="text" 
                            placeholder="999888777" 
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                            style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none' }}
                        />
                        <button 
                            onClick={handleSendWhatsApp}
                            disabled={sending || sent}
                            style={{ 
                                background: sent ? '#10b981' : '#25d366', 
                                color: '#fff', border: 'none', borderRadius: '12px', 
                                padding: '0 16px', cursor: 'pointer', transition: 'all 0.2s',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                        >
                            {sending ? <Loader2 className="animate-spin" size={18} /> : (sent ? <CheckCircle2 size={18} /> : <MessageCircle size={18} />)}
                        </button>
                    </div>
                </div>

                <button onClick={onReset} style={{
                    width: '100%', background: '#0f172a', color: '#fff', border: 'none',
                    borderRadius: '14px', padding: '14px', fontSize: '14px', fontWeight: 800,
                    cursor: 'pointer', marginBottom: '8px', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', gap: '8px',
                }}>
                    Nueva Venta <ArrowRight size={16} />
                </button>
                <button onClick={onPrint} style={{
                    width: '100%', background: '#fff', color: '#64748b', border: '1px solid #e2e8f0',
                    borderRadius: '12px', padding: '10px', fontSize: '12px', fontWeight: 600,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                }}>
                    <Printer size={14} /> Imprimir Ticket
                </button>
            </div>
        </div>
    );
}
