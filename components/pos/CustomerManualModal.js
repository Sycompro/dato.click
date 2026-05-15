'use client';
import { useState } from 'react';
import { X, User, Phone, ShieldCheck, Save, Info } from 'lucide-react';
import CustomDatePicker from './CustomDatePicker';
import NumericKeypad from './NumericKeypad';

export default function CustomerManualModal({ isOpen, onClose, initialDoc, onSave }) {
    const [formData, setFormData] = useState({
        doc: initialDoc || '',
        name: '',
        lastname: '',
        phone: '',
        birthdate: ''
    });

    const [showDocNumpad, setShowDocNumpad] = useState(false);
    const [showPhoneNumpad, setShowPhoneNumpad] = useState(false);

    const handleDocKeyPress = (key) => {
        if (key === '.') return;
        setFormData(prev => ({ ...prev, doc: prev.doc + key }));
    };

    const handleDocDelete = () => {
        setFormData(prev => ({ ...prev, doc: prev.doc.slice(0, -1) }));
    };

    const handlePhoneKeyPress = (key) => {
        if (key === '.') return;
        if (formData.phone.length < 9) {
            setFormData(prev => ({ ...prev, phone: prev.phone + key }));
        }
    };

    const handlePhoneDelete = () => {
        setFormData(prev => ({ ...prev, phone: prev.phone.slice(0, -1) }));
    };

    if (!isOpen) return null;

    return (
        <div style={overlayStyle}>
            <div style={modalStyle}>
                {/* Header */}
                <div style={headerStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={iconBoxStyle}><User size={20} /></div>
                        <div>
                            <h2 style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', margin: 0 }}>Registro Manual</h2>
                            <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>Menores de edad o Extranjeros (Interno)</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={closeBtnStyle}><X size={20} /></button>
                </div>

                {/* Form */}
                <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={infoBoxStyle}>
                        <Info size={14} />
                        <span>Este registro es para control interno y no se enviará al sistema contable Navasoft.</span>
                    </div>

                    <div style={fieldGroupStyle}>
                        <label style={labelStyle}>DNI o CE</label>
                        <div style={inputWrapperStyle}>
                            <ShieldCheck size={16} style={inputIconStyle} />
                            <input 
                                type="text" 
                                inputMode="none"
                                value={formData.doc} 
                                onChange={e => setFormData({...formData, doc: e.target.value})} 
                                onFocus={() => setShowDocNumpad(true)}
                                style={inputStyle} 
                                placeholder="Nro de documento" 
                            />
                            <NumericKeypad 
                                isOpen={showDocNumpad}
                                onClose={() => setShowDocNumpad(false)}
                                onKeyPress={handleDocKeyPress}
                                onDelete={handleDocDelete}
                                value={formData.doc}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div style={fieldGroupStyle}>
                            <label style={labelStyle}>Nombres</label>
                            <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} style={inputStyle} placeholder="Ej: Juan" />
                        </div>
                        <div style={fieldGroupStyle}>
                            <label style={labelStyle}>Apellidos</label>
                            <input type="text" value={formData.lastname} onChange={e => setFormData({...formData, lastname: e.target.value})} style={inputStyle} placeholder="Ej: Pérez" />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div style={fieldGroupStyle}>
                            <label style={labelStyle}>Celular (Opcional)</label>
                            <div style={inputWrapperStyle}>
                                <Phone size={16} style={inputIconStyle} />
                                <input 
                                    type="text" 
                                    inputMode="none"
                                    value={formData.phone} 
                                    onChange={e => setFormData({...formData, phone: e.target.value})} 
                                    onFocus={() => setShowPhoneNumpad(true)}
                                    style={inputStyle} 
                                    placeholder="999..." 
                                />
                                <NumericKeypad 
                                    isOpen={showPhoneNumpad}
                                    onClose={() => setShowPhoneNumpad(false)}
                                    onKeyPress={handlePhoneKeyPress}
                                    onDelete={handlePhoneDelete}
                                    value={formData.phone}
                                />
                            </div>
                        </div>
                        <div style={fieldGroupStyle}>
                            <CustomDatePicker 
                                label="F. Nacimiento (Opcional)"
                                value={formData.birthdate}
                                onChange={(val) => setFormData({...formData, birthdate: val})}
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div style={footerStyle}>
                    <button onClick={onClose} style={cancelBtnStyle}>Cancelar</button>
                    <button onClick={() => onSave(formData)} style={saveBtnStyle}>
                        <Save size={18} /> Guardar en Railway
                    </button>
                </div>
            </div>
        </div>
    );
}

const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' };
const modalStyle = { background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '480px', boxShadow: '0 25px 60px rgba(0,0,0,0.2)', overflow: 'hidden' };
const headerStyle = { padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const iconBoxStyle = { width: '40px', height: '40px', background: '#f1f5f9', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' };
const closeBtnStyle = { background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' };
const fieldGroupStyle = { display: 'flex', flexDirection: 'column', gap: '6px' };
const labelStyle = { fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' };
const inputWrapperStyle = { position: 'relative' };
const inputIconStyle = { position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#cbd5e1' };
const inputStyle = { width: '100%', padding: '12px 14px 12px 38px', borderRadius: '12px', border: '2px solid #f1f5f9', fontSize: '14px', fontWeight: 600, outline: 'none', transition: 'all 0.2s ease', boxSizing: 'border-box' };
const infoBoxStyle = { padding: '12px', background: '#eff6ff', borderRadius: '12px', color: '#3b82f6', fontSize: '11px', fontWeight: 600, display: 'flex', gap: '10px', alignItems: 'center', border: '1px solid #dbeafe' };
const footerStyle = { padding: '20px 24px', background: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '12px' };
const cancelBtnStyle = { background: 'none', border: 'none', color: '#64748b', fontSize: '14px', fontWeight: 700, cursor: 'pointer', padding: '10px 20px' };
const saveBtnStyle = { background: '#0f172a', color: '#fff', border: 'none', borderRadius: '14px', padding: '12px 24px', fontSize: '14px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(15,23,42,0.2)' };
