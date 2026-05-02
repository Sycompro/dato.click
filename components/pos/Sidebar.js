'use client';
import { LayoutGrid, ShoppingBag, Zap, Sparkles, History, Settings, LogOut, Lock } from 'lucide-react';

export default function Sidebar({ onSignOut, onOpenCloseCash, onOpenHistory }) {
    return (
        <aside style={{
            width: '68px',
            background: '#0f172a',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '16px 0',
            gap: '4px',
            flexShrink: 0,
            zIndex: 40,
        }}>
            {/* Logo */}
            <div style={{
                width: '40px', height: '40px', background: '#3b82f6', borderRadius: '12px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px',
            }}>
                <Zap size={18} style={{ color: '#fff', fill: '#fff' }} />
            </div>

            {/* Acciones principales - Menu Limpio */}
            <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <div style={activeIconStyle}><LayoutGrid size={22} /></div>
            </div>

            {/* Bottom icons */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginTop: 'auto' }}>
                <button onClick={onOpenHistory} title="Historial de Ventas" style={bottomBtnStyle}><History size={18} /></button>
                <button onClick={onOpenCloseCash} title="Cerrar Caja" style={bottomBtnStyle}><Lock size={18} /></button>
                <button title="Ajustes" style={bottomBtnStyle}><Settings size={18} /></button>
                <button onClick={onSignOut} title="Salir" style={{ ...bottomBtnStyle, color: '#f87171' }}>
                    <LogOut size={18} />
                </button>
            </div>
        </aside>
    );
}

const bottomBtnStyle = {
    width: '36px', height: '36px', borderRadius: '10px',
    background: 'transparent', border: 'none', color: '#475569',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer',
};

const activeIconStyle = { 
    width: '48px', height: '48px', 
    background: 'rgba(59,130,246,0.15)', 
    borderRadius: '12px', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    color: '#3b82f6', 
    border: '1px solid rgba(59,130,246,0.2)',
    cursor: 'pointer'
};
