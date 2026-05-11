'use client';
import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { 
    Search, Filter, Plus, Users, Clock, AlertCircle, 
    CheckCircle2, XCircle, ChevronDown, MoreVertical, 
    RefreshCw, Calendar, MessageCircle, Edit3, Trash2,
    FileText, Download, MapPin, CreditCard, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import WhatsAppMessageModal from './WhatsAppMessageModal';

export default function MembershipsView({ onRenew, onQueueWhatsApp, companyName }) {
    const { data: session } = useSession();
    const [loading, setLoading] = useState(true);
    
    // Si companyName no viene de settings, intentamos usar el de la sesión
    const finalCompanyName = companyName || session?.user?.name || session?.user?.company || 'nuestro gimnasio';
    const [members, setMembers] = useState([]);
    const [stats, setStats] = useState({ total: 0, active: 0, expiring: 0, expired: 0 });
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterSede, setFilterSede] = useState('my');
    const [renewingMember, setRenewingMember] = useState(null);
    const [plans, setPlans] = useState([]);
    const [planSearchTerm, setPlanSearchTerm] = useState('');
    const [isExtension, setIsExtension] = useState(false);
    const [expandedMember, setExpandedMember] = useState(null);
    const [memberHistory, setMemberHistory] = useState({});
    const [loadingHistory, setLoadingHistory] = useState(false);
    
    // Estados para WhatsApp
    const [showWAModal, setShowWAModal] = useState(false);
    const [selectedMemberWA, setSelectedMemberWA] = useState(null);
    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

    // ESTADOS PARA PESTAÑAS Y CUMPLEAÑOS
    const [activeTab, setActiveTab] = useState('memberships'); 
    const [birthdays, setBirthdays] = useState([]);
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [loadingBirthdays, setLoadingBirthdays] = useState(false);

    const monthNames = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];

    useEffect(() => {
        if (activeTab === 'memberships') {
            fetchMemberships();
        } else {
            fetchBirthdays();
        }
    }, [searchTerm, filterStatus, filterSede, activeTab, selectedMonth]);

    const fetchBirthdays = async () => {
        setLoadingBirthdays(true);
        try {
            const res = await fetch(`/api/memberships/birthdays?month=${selectedMonth}`);
            const data = await res.json();
            if (data.success) {
                setBirthdays(data.birthdays || []);
            }
        } catch (e) {
            console.error("Error al cargar cumpleaños:", e);
        } finally {
            setLoadingBirthdays(false);
        }
    };

    useEffect(() => {
        const t = setTimeout(() => fetchPlans(), 300);
        return () => clearTimeout(t);
    }, [planSearchTerm]);

    const fetchMemberships = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/memberships/list?q=${searchTerm}&status=${filterStatus}&sede=${filterSede}`);
            const data = await res.json();
            setMembers(data.members || []);
            setStats(data.stats || { total: 0, active: 0, expiring: 0, expired: 0 });
        } catch (error) {
            console.error('Error fetching members:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchPlans = async () => {
        try {
            const res = await fetch(`/api/products/search?q=${encodeURIComponent(planSearchTerm)}`);
            const data = await res.json();
            setPlans(Array.isArray(data) ? data : []);
        } catch (e) { console.error('Error fetching plans', e); }
    };

    const fetchHistory = async (member) => {
        if (expandedMember === member.id) {
            setExpandedMember(null);
            return;
        }
        
        setExpandedMember(member.id);
        if (memberHistory[member.id]) return;

        setLoadingHistory(true);
        try {
            const res = await fetch(`/api/memberships/history?codcli=${member.id}`);
            const data = await res.json();
            setMemberHistory(prev => ({ ...prev, [member.id]: data }));
        } catch (e) {
            console.error('Error fetching history:', e);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleProcessRenewal = (plan) => {
        if (onRenew) {
            onRenew(renewingMember, plan);
            setRenewingMember(null);
            setPlanSearchTerm('');
            setIsExtension(false);
        } else {
            alert('Función de venta no disponible en este modo');
        }
    };

    return (
        <div style={containerStyle}>
            {/* CABECERA Y NAVEGACIÓN COMPACTA */}
            <div style={headerContainerStyle}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <h1 style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-0.5px' }}>
                        {activeTab === 'memberships' ? 'Membresías' : activeTab === 'birthdays' ? 'Cumpleaños' : 'Promociones'}
                    </h1>
                    <p style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>
                        {activeTab === 'memberships' ? 'Seguimiento y renovación' : activeTab === 'birthdays' ? 'Eventos del mes' : 'Gestión de ofertas'}
                    </p>
                </div>

                <div style={tabsWrapperStyle}>
                    <button 
                        onClick={() => setActiveTab('memberships')}
                        style={{ ...tabStyle, ...(activeTab === 'memberships' ? activeTabActiveStyle : {}) }}
                    >
                        <Users size={14} /> Membresías
                    </button>
                    <button 
                        onClick={() => setActiveTab('promotions')}
                        style={{ ...tabStyle, ...(activeTab === 'promotions' ? activeTabActiveStyle : {}) }}
                    >
                        <RefreshCw size={14} /> Promociones
                    </button>
                    <button 
                        onClick={() => setActiveTab('birthdays')}
                        style={{ ...tabStyle, ...(activeTab === 'birthdays' ? birthdayTabActiveStyle : {}) }}
                    >
                        <Calendar size={14} /> Cumpleaños
                    </button>
                </div>
            </div>

            {activeTab === 'memberships' ? (
                <>
                    {/* RESUMEN DE ESTADOS (Compacto) */}
                    <div style={statsCompactGridStyle}>
                        <StatCard 
                            title="ACTIVAS" 
                            count={stats.active} 
                            icon={<CheckCircle2 size={16} />} 
                            color="#10b981" 
                            bgColor="#f0fdf4" 
                        />
                        <StatCard 
                            title="POR VENCER" 
                            count={stats.expiring} 
                            icon={<AlertCircle size={16} />} 
                            color="#f59e0b" 
                            bgColor="#fffbeb" 
                        />
                        <StatCard 
                            title="VENCIDAS" 
                            count={stats.expired} 
                            icon={<XCircle size={16} />} 
                            color="#ef4444" 
                            bgColor="#fef2f2" 
                        />
                        <StatCard 
                            title="TOTAL" 
                            count={stats.total} 
                            icon={<Users size={16} />} 
                            color="#3b82f6" 
                            bgColor="#eff6ff" 
                        />
                    </div>

                    {/* BARRA DE ACCIÓN Y FILTROS INTEGRADA */}
                    <div style={integratedFilterBarStyle}>
                        <div style={compactSearchWrapperStyle}>
                            <Search size={16} style={{ color: '#94a3b8' }} />
                            <input 
                                type="text" 
                                placeholder="Buscar miembro o teléfono..." 
                                style={searchInputStyle}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <select 
                                style={compactSelectStyle}
                                value={filterSede}
                                onChange={(e) => setFilterSede(e.target.value)}
                            >
                                <option value="all">Sedes</option>
                                <option value="my">Mi Sede</option>
                            </select>
                            <select 
                                style={compactSelectStyle} 
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                            >
                                <option value="all">Estado</option>
                                <option value="activo">Activos</option>
                                <option value="por vencer">Casi vencidos</option>
                                <option value="vencido">Vencidos</option>
                            </select>
                        </div>
                    </div>

                    {/* Tabla de Resultados */}
                    <div style={tableContainerStyle}>
                        <div style={tableHeaderStyle}>
                            <span style={{ flex: 2 }}>Miembro</span>
                            <span style={{ flex: 1.5 }}>Sede</span>
                            <span style={{ flex: 1.5 }}>Plan</span>
                            <span style={{ flex: 1 }}>Inicio</span>
                            <span style={{ flex: 1.2 }}>Vencimiento</span>
                            <span style={{ flex: 1 }}>Estado</span>
                            <span style={{ flex: 1 }}>Precio</span>
                            <span style={{ flex: 1 }}>Acciones</span>
                        </div>

                        {loading ? (
                            <div style={loadingStyle}>Cargando membresías...</div>
                        ) : (members || []).length === 0 ? (
                            <div style={loadingStyle}>No se encontraron membresías.</div>
                        ) : (
                            (members || []).map((member, idx) => (
                                <div key={member.id}>
                                    <motion.div 
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        style={{
                                            ...tableRowStyle,
                                            borderLeft: expandedMember === member.id ? '4px solid #3b82f6' : '4px solid transparent',
                                            background: expandedMember === member.id ? '#f8fafc' : '#fff'
                                        }}
                                    >
                                        {/* Miembro */}
                                        <div style={{ flex: 2, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={avatarStyle}>{member.name.charAt(0)}</div>
                                            <div>
                                                <div style={memberNameStyle}>{member.name}</div>
                                                <div style={memberPhoneStyle}>{member.phone}</div>
                                            </div>
                                        </div>

                                        {/* Sede */}
                                        <div style={{ flex: 1.5 }}>
                                            <div style={sedeNameStyle}><MapPin size={14} /> {member.sede}</div>
                                            <div style={sedeAddrStyle}>{member.address}</div>
                                        </div>

                                        {/* Plan */}
                                        <div style={{ flex: 1.5, color: '#475569', fontSize: '13px' }}>
                                            {member.planName || 'Sin plan registrado'}
                                        </div>

                                        {/* Inicio */}
                                        <div style={{ flex: 1, color: '#64748b', fontSize: '13px' }}>
                                            {member.startDate ? (() => {
                                                const [y, m, d] = member.startDate.split('-');
                                                return new Date(y, m - 1, d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
                                            })() : '-'}
                                        </div>

                                        {/* Vencimiento */}
                                        <div style={{ flex: 1.2 }}>
                                            <div style={getExpStyle(member.status)}>
                                                {member.endDate && member.endDate !== '1900-01-01' ? (() => {
                                                    const [y, m, d] = member.endDate.split('-');
                                                    return new Date(y, m - 1, d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
                                                })() : 'Sin fecha'}
                                            </div>
                                            <div style={daysLeftStyle}>{member.daysLeft > 0 ? `${member.daysLeft}d restantes` : member.daysLeft < 0 ? `Vencido hace ${Math.abs(member.daysLeft)}d` : ''}</div>
                                        </div>

                                        {/* Estado */}
                                        <div style={{ flex: 1 }}>
                                            <span style={getStatusBadgeStyle(member.status)}>{member.status}</span>
                                        </div>

                                        {/* Precio */}
                                        <div style={{ flex: 1, fontWeight: '600', color: '#1e293b' }}>
                                            {member.price ? `S/${parseFloat(member.price).toFixed(2)}` : '-'}
                                        </div>

                                        <div style={{ flex: 1, display: 'flex', gap: '10px', color: '#94a3b8', alignItems: 'center' }}>
                                            <RefreshCw 
                                                size={16} 
                                                style={{ 
                                                    ...actionIconStyle, 
                                                    color: member.status === 'Vencido' ? '#3b82f6' : '#cbd5e1',
                                                    opacity: member.status === 'Vencido' ? 1 : 0.5
                                                }} 
                                                title="Renovar"
                                                onClick={() => {
                                                    if (member.status !== 'Vencido') {
                                                        alert('Esta membresía aún se encuentra vigente. Si desea agregar más tiempo antes de que venza, use la opción "Extender" (icono de calendario).');
                                                        return;
                                                    }
                                                    setIsExtension(false);
                                                    setRenewingMember(member);
                                                }}
                                            />
                                            <MessageCircle 
                                                size={16} 
                                                style={{ ...actionIconStyle, color: '#10b981' }} 
                                                title="Enviar WhatsApp"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedMemberWA(member);
                                                    setShowWAModal(true);
                                                }}
                                            />
                                            <Calendar 
                                                size={16} 
                                                style={{ 
                                                    ...actionIconStyle, 
                                                    color: (member.status === 'Activo' || member.status === 'Por vencer') ? '#10b981' : '#cbd5e1',
                                                    opacity: (member.status === 'Activo' || member.status === 'Por vencer') ? 1 : 0.5
                                                }} 
                                                title="Extender"
                                                onClick={() => {
                                                    if (member.status === 'Vencido') {
                                                        alert('Esta membresía ya expiró. Use la opción "Renovar" (flechas azules) para iniciar un nuevo periodo hoy mismo.');
                                                        return;
                                                    }
                                                    setIsExtension(true);
                                                    setRenewingMember(member);
                                                }}
                                            />
                                            <Clock 
                                                size={16} 
                                                style={{ 
                                                    ...actionIconStyle, 
                                                    color: (expandedMember === member.id || member.historyCount > 1) ? '#8b5cf6' : '#cbd5e1',
                                                    opacity: (expandedMember === member.id || member.historyCount > 1) ? 1 : 0.4
                                                }} 
                                                title={member.historyCount > 1 ? "Ver historial de extensiones" : "Sin historial previo"}
                                                onClick={() => fetchHistory(member)}
                                            />
                                            <Trash2 size={16} style={{ ...actionIconStyle, color: '#fca5a5' }} />
                                        </div>
                                    </motion.div>

                                    {/* Panel Desplegable de Historial */}
                                    <AnimatePresence>
                                        {expandedMember === member.id && (
                                            <motion.div 
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                style={{ overflow: 'hidden', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}
                                            >
                                                <div style={{ padding: '20px 40px 24px 70px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                                        <div style={{ width: '4px', height: '14px', background: '#8b5cf6', borderRadius: '2px' }} />
                                                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                            Historial de Operaciones
                                                        </span>
                                                    </div>

                                                    {loadingHistory && !memberHistory[member.id] ? (
                                                        <div style={{ padding: '10px', fontSize: '12px', color: '#94a3b8' }}>Consultando base de datos...</div>
                                                    ) : (memberHistory[member.id] || []).length === 0 ? (
                                                        <div style={{ padding: '10px', fontSize: '12px', color: '#94a3b8' }}>No se encontraron operaciones previas.</div>
                                                    ) : (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                            {(memberHistory[member.id] || []).map((entry, hIdx) => (
                                                                <div key={hIdx} style={{ 
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
                                                                    background: hIdx === 0 ? '#fff' : 'transparent',
                                                                    padding: '10px 16px', borderRadius: '10px',
                                                                    border: hIdx === 0 ? '1px solid #e2e8f0' : '1px solid transparent',
                                                                    boxShadow: hIdx === 0 ? '0 2px 4px rgba(0,0,0,0.02)' : 'none'
                                                                }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                                        <div style={{ 
                                                                            width: '32px', height: '32px', borderRadius: '8px', 
                                                                            background: hIdx === 0 ? '#f5f3ff' : '#f1f5f9',
                                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                            color: hIdx === 0 ? '#8b5cf6' : '#94a3b8'
                                                                        }}>
                                                                            <FileText size={14} />
                                                                        </div>
                                                                        <div>
                                                                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>{entry.planName}</div>
                                                                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>{entry.document} • {entry.docType === '01' ? 'Factura' : 'Boleta'}</div>
                                                                        </div>
                                                                    </div>
                                                                    <div style={{ textAlign: 'right' }}>
                                                                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>
                                                                            {(() => {
                                                                                const parts = entry.date.split('-');
                                                                                if (parts.length === 3) {
                                                                                    const [y, m, d] = parts;
                                                                                    return new Date(y, m - 1, d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
                                                                                }
                                                                                return entry.date;
                                                                            })()}
                                                                        </div>
                                                                        <div style={{ fontSize: '12px', fontWeight: 800, color: '#10b981' }}>S/ {entry.price.toFixed(2)}</div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            ))
                        )}
                    </div>
                </div>
                </>
            ) : activeTab === 'birthdays' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                        <select 
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            style={monthSelectStyle}
                        >
                            {monthNames.map((m, i) => (
                                <option key={i+1} value={i+1}>{m}</option>
                            ))}
                        </select>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#64748b' }}>
                            {birthdays.length} socios cumplen en {monthNames[selectedMonth-1]}
                        </span>
                    </div>

                    <div style={birthdayGridStyle}>
                        {loadingBirthdays ? (
                            <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Consultando cumpleaños...</div>
                        ) : birthdays.length === 0 ? (
                            <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: '#94a3b8' }}>No hay cumpleaños registrados para este mes.</div>
                        ) : birthdays.map((b, i) => {
                            const isToday = b.birthDay === new Date().getDate() && b.birthMonth === (new Date().getMonth() + 1);
                            return (
                                <motion.div 
                                    key={b.codcli}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: i * 0.05 }}
                                    style={{ 
                                        ...birthdayCardStyle,
                                        background: isToday ? '#fff1f2' : '#fff',
                                        borderColor: isToday ? '#fda4af' : '#f1f5f9'
                                    }}
                                >
                                    {/* Fecha Calendario */}
                                    <div style={{ ...calendarDateStyle, background: isToday ? '#f43f5e' : '#94a3b8' }}>
                                        <div style={{ fontSize: '18px', fontWeight: 900 }}>{b.birthDay}</div>
                                        <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>{monthNames[b.birthMonth-1].substring(0,3)}</div>
                                    </div>

                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 800, fontSize: '13px', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {b.nomcli}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#f43f5e' }}>{b.age} años</span>
                                            <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: '#cbd5e1' }} />
                                            <span style={{ fontSize: '12px', color: '#64748b' }}>{b.birthDay} de {monthNames[b.birthMonth-1].toLowerCase()}</span>
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <MessageCircle size={12} /> {b.phone || 'Sin teléfono'}
                                        </div>
                                        {isToday && (
                                            <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', color: '#f43f5e', fontSize: '11px', fontWeight: 800 }}>
                                                <RefreshCw size={12} className="animate-spin" /> ¡Cumpleaños hoy!
                                            </div>
                                        )}
                                    </div>

                                    <button 
                                        onClick={() => {
                                            setSelectedMemberWA({ id: b.codcli, name: b.nomcli, phone: b.phone });
                                            setShowWAModal(true);
                                        }}
                                        style={{ ...birthdayActionBtnStyle, background: isToday ? '#f43f5e' : '#f1f5f9', color: isToday ? '#fff' : '#64748b' }}
                                    >
                                        <MessageCircle size={16} />
                                    </button>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                    <RefreshCw size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                    <p>Módulo de Promociones en desarrollo...</p>
                </div>
            )}



            {/* MODAL DE WHATSAPP */}
            <WhatsAppMessageModal 
                isOpen={showWAModal}
                onClose={() => setShowWAModal(false)}
                member={selectedMemberWA}
                companyName={finalCompanyName}
                onSend={(phone, msg) => {
                    if (onQueueWhatsApp) {
                        onQueueWhatsApp(phone, msg);
                        // Mostrar Toast de éxito
                        setToast({ show: true, message: 'Mensaje enviado a la cola de WhatsApp', type: 'success' });
                        setTimeout(() => setToast({ ...toast, show: false }), 3000);
                    }
                }}
            />

            {/* TOAST NOTIFICATION */}
            <AnimatePresence>
                {toast.show && (
                    <motion.div
                        initial={{ opacity: 0, y: -50, x: '-50%' }}
                        animate={{ opacity: 1, y: 20, x: '-50%' }}
                        exit={{ opacity: 0, y: -50, x: '-50%' }}
                        style={{
                            position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)',
                            background: toast.type === 'success' ? '#10b981' : '#ef4444',
                            color: '#fff', padding: '12px 24px', borderRadius: '12px',
                            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', zIndex: 10000,
                            display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600'
                        }}
                    >
                        {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                        {toast.message}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Modal de Renovación */}
            {renewingMember && (
                <div style={modalOverlayStyle}>
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={renewalModalStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ 
                                    ...iconBoxStyle, 
                                    background: isExtension ? '#ecfdf5' : '#eff6ff', 
                                    color: isExtension ? '#10b981' : '#3b82f6' 
                                }}>
                                    {isExtension ? <Calendar size={20} /> : <RefreshCw size={20} />}
                                </div>
                                <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                                    {isExtension ? 'Extender membresía' : 'Renovar membresía'}
                                </h2>
                            </div>
                            <button onClick={() => { setRenewingMember(null); setPlanSearchTerm(''); setIsExtension(false); }} style={closeBtnStyle}><X size={20} /></button>
                        </div>

                        <div style={{ 
                            ...infoBannerStyle, 
                            background: isExtension ? '#f0fdf4' : '#eff6ff', 
                            border: `1px solid ${isExtension ? '#dcfce7' : '#dbeafe'}`,
                            borderLeft: `6px solid ${isExtension ? '#10b981' : '#3b82f6'}`,
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            {/* Decoración de fondo sutil */}
                            <div style={{ 
                                position: 'absolute', right: '-10px', top: '-10px', opacity: 0.05, transform: 'rotate(15deg)' 
                            }}>
                                {isExtension ? <Calendar size={80} /> : <RefreshCw size={80} />}
                            </div>

                            <div style={{ fontWeight: 900, color: '#0f172a', fontSize: '18px', letterSpacing: '-0.5px' }}>{renewingMember.name}</div>
                            <div style={{ fontSize: '13px', color: '#64748b', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Clock size={14} />
                                {isExtension ? 'Vigencia hasta el: ' : 'Venció el: '}
                                <span style={{ fontWeight: 700, color: '#475569' }}>
                                    {renewingMember.endDate && renewingMember.endDate !== '1900-01-01' 
                                        ? (() => {
                                            const [y, m, d] = renewingMember.endDate.split('-');
                                            return new Date(y, m - 1, d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
                                        })()
                                        : 'Sin registro previo'}
                                </span>
                            </div>

                            <div style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '8px', 
                                marginTop: '16px', 
                                padding: '8px 12px',
                                borderRadius: '12px',
                                background: isExtension ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                                color: isExtension ? '#059669' : '#2563eb', 
                                fontWeight: 800, 
                                fontSize: '12px' 
                            }}>
                                <div style={{ 
                                    width: '18px', height: '18px', borderRadius: '6px', 
                                    background: isExtension ? '#10b981' : '#3b82f6', 
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: '#fff'
                                }}>
                                    <CheckCircle2 size={12} />
                                </div>
                                {isExtension ? 'NUEVA VIGENCIA CONSECUTIVA' : 'RENOVACIÓN INMEDIATA (DESDE HOY)'}
                            </div>
                        </div>

                        <div style={{ marginTop: '24px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 800, color: '#94a3b8', marginBottom: '12px', display: 'block' }}>
                                {isExtension ? 'BUSCAR PLAN PARA EXTENSIÓN' : 'BUSCAR PLAN DE RENOVACIÓN'}
                            </label>
                            
                            {/* Buscador de Planes */}
                            <div style={{ ...searchWrapperStyle, height: '44px', marginBottom: '16px', padding: '0 12px' }}>
                                <Search size={16} style={{ color: '#94a3b8' }} />
                                <input 
                                    autoFocus
                                    type="text" 
                                    placeholder="Escriba el nombre del plan..." 
                                    style={{ ...searchInputStyle, fontSize: '13px' }}
                                    value={planSearchTerm}
                                    onChange={(e) => setPlanSearchTerm(e.target.value)}
                                />
                            </div>

                            <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {plans.length === 0 ? (
                                    <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                                        No se encontraron planes que coincidan
                                    </div>
                                ) : plans.map(plan => (
                                    <button 
                                        key={plan.id} 
                                        onClick={() => handleProcessRenewal(plan)}
                                        style={planOptionStyle}
                                    >
                                        <div style={{ textAlign: 'left' }}>
                                            <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '14px' }}>{plan.name}</div>
                                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>Código: {plan.userCode}</div>
                                        </div>
                                        <div style={{ fontWeight: 800, color: isExtension ? '#059669' : '#10b981' }}>S/{parseFloat(plan.price).toFixed(2)}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}

// Sub-componente Tarjeta
function StatCard({ title, count, icon, color, bgColor }) {
    return (
        <div style={{ ...statCardStyle, background: bgColor }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '10px', fontWeight: '800', color, letterSpacing: '0.5px' }}>{title}</span>
                <span style={{ fontSize: '22px', fontWeight: '800', color: '#1e293b', marginTop: '2px' }}>{count}</span>
            </div>
            <div style={{ color, opacity: 0.8 }}>{icon}</div>
        </div>
    );
}

// Estilos
const containerStyle = { padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flex: 1, background: '#f8fafc' };

const headerContainerStyle = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
    background: '#fff', padding: '12px 16px', borderRadius: '16px', 
    border: '1px solid #f1f5f9', boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
};

const statsCompactGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' };

const statCardStyle = {
    padding: '10px 14px', borderRadius: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    border: '1px solid rgba(0,0,0,0.04)', transition: 'all 0.2s'
};

const integratedFilterBarStyle = { 
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px',
    background: '#fff', padding: '8px 12px', borderRadius: '14px', border: '1px solid #f1f5f9'
};

const compactSearchWrapperStyle = { 
    flex: 1, display: 'flex', alignItems: 'center', gap: '10px', background: '#f1f5f9',
    padding: '0 12px', borderRadius: '10px', height: '36px', border: '1px solid #e2e8f0'
};

const compactSelectStyle = { 
    height: '36px', padding: '0 10px', borderRadius: '10px', border: '1px solid #e2e8f0', 
    fontSize: '12px', fontWeight: '600', color: '#475569', background: '#fff', cursor: 'pointer'
};

const searchInputStyle = { background: 'transparent', border: 'none', outline: 'none', width: '100%', fontSize: '13px', color: '#1e293b' };

const tableContainerStyle = { background: '#fff', borderRadius: '16px', border: '1px solid #f1f5f9', overflow: 'hidden' };

const tableHeaderStyle = { 
    display: 'flex', padding: '12px 20px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9',
    fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px'
};

const tableRowStyle = { 
    display: 'flex', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid #f1f5f9',
    transition: 'background 0.2s', cursor: 'default'
};

const avatarStyle = { 
    width: '32px', height: '32px', borderRadius: '8px', background: '#eff6ff', 
    color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '13px'
};

const memberNameStyle = { fontSize: '13px', fontWeight: '700', color: '#1e293b' };
const memberPhoneStyle = { fontSize: '11px', color: '#94a3b8' };

const sedeNameStyle = { fontSize: '12px', fontWeight: '700', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' };
const sedeAddrStyle = { fontSize: '10px', color: '#94a3b8', marginTop: '1px' };

const getStatusBadgeStyle = (status) => ({
    padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: '800',
    background: status === 'Activo' ? '#ecfdf5' : 
                status === 'Por vencer' ? '#fff7ed' : 
                status === 'Próximo' ? '#fefce8' : '#fef2f2',
    color: status === 'Activo' ? '#10b981' : 
           status === 'Por vencer' ? '#f97316' : 
           status === 'Próximo' ? '#eab308' : '#ef4444'
});

const getExpStyle = (status) => ({
    fontSize: '12px', fontWeight: '700',
    color: status === 'Activo' ? '#10b981' : 
           status === 'Por vencer' ? '#f97316' : 
           status === 'Próximo' ? '#eab308' : '#ef4444'
});

const daysLeftStyle = { fontSize: '10px', color: '#94a3b8', marginTop: '1px' };

const actionIconStyle = { cursor: 'pointer', transition: 'color 0.2s' };

const loadingStyle = { padding: '30px', textAlign: 'center', color: '#64748b', fontSize: '13px' };

const iconBoxStyle = { width: '44px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' };

const modalOverlayStyle = { position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const renewalModalStyle = { background: '#fff', padding: '32px', borderRadius: '24px', width: '100%', maxWidth: '450px', boxShadow: '0 30px 60px rgba(0,0,0,0.12)', border: '1px solid #f1f5f9' };
const closeBtnStyle = { background: '#f8fafc', border: 'none', color: '#94a3b8', borderRadius: '10px', padding: '8px', cursor: 'pointer' };
const infoBannerStyle = { padding: '20px', background: '#eff6ff', borderRadius: '16px', border: '1px solid #dbeafe' };
const planOptionStyle = {
    width: '100%', padding: '16px', borderRadius: '14px', border: '1px solid #f1f5f9', background: '#fff',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'all 0.2s'
};

const tabsWrapperStyle = { 
    display: 'flex', gap: '4px', background: '#f1f5f9', 
    padding: '4px', borderRadius: '12px'
};

const tabStyle = { 
    display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '9px', 
    border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '12px', fontWeight: '700', 
    transition: 'all 0.2s', color: '#64748b'
};

const activeTabActiveStyle = { background: '#fff', color: '#0f172a', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' };

const birthdayTabActiveStyle = { 
    background: '#f43f5e', 
    color: '#fff', boxShadow: '0 4px 6px -1px rgba(244,63,94,0.2)' 
};

const monthSelectStyle = {
    padding: '8px 12px', borderRadius: '10px', border: '1px solid #e2e8f0', 
    fontSize: '13px', fontWeight: '700', color: '#1e293b', background: '#fff',
    cursor: 'pointer'
};

const birthdayGridStyle = {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px'
};

const birthdayCardStyle = {
    padding: '12px', borderRadius: '16px', border: '1px solid #f1f5f9',
    display: 'flex', alignItems: 'center', gap: '12px', position: 'relative',
    background: '#fff'
};

const calendarDateStyle = {
    width: '48px', height: '54px', borderRadius: '12px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    color: '#fff', flexShrink: 0
};

const birthdayActionBtnStyle = {
    width: '36px', height: '36px', borderRadius: '10px', border: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    transition: 'all 0.2s'
};
