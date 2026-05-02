'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { 
    Search, ShoppingCart, User, Plus, Minus, X, Check, 
    ChevronRight, Loader2, UserPlus, ShieldCheck, Trash2, 
    LayoutGrid, Clock, Settings, LogOut, ShoppingBag, Zap, Sparkles, Package,
    Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';

import Sidebar from '@/components/pos/Sidebar';
import ProductCard from '@/components/pos/ProductCard';
import CartItem from '@/components/pos/CartItem';
import PaymentSection from '@/components/pos/PaymentSection';
import SuccessModal from '@/components/pos/SuccessModal';
import CustomerManualModal from '@/components/pos/CustomerManualModal';
import CustomDatePicker from '@/components/pos/CustomDatePicker';
import CartDetailsModal from '@/components/pos/CartDetailsModal';
import SalesHistoryModal from '@/components/pos/SalesHistoryModal';
import CloseCashModal from '@/components/pos/CloseCashModal';

export default function POSPage() {
    const { data: session } = useSession();
    const [searchTerm, setSearchTerm] = useState('');
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isFinalizing, setIsFinalizing] = useState(false);
    const [cart, setCart] = useState([]);
    const [warehouse] = useState('01');
    const [idApeCaj, setIdApeCaj] = useState(null);
    const [isOpeningCash, setIsOpeningCash] = useState(false);
    const [openingAmount, setOpeningAmount] = useState('');
    const [docType, setDocType] = useState('03');
    const [paymentMethod, setPaymentMethod] = useState(1);
    const [selectedTar, setSelectedTar] = useState('');
    const [availableMethods, setAvailableMethods] = useState([]);
    const [customer, setCustomer] = useState({ name: 'CLIENTE VARIOS', ruc: '', code: '000000', phone: '', birthdate: '' });
    const [customerSearch, setCustomerSearch] = useState('');
    const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
    const [showManualModal, setShowManualModal] = useState(false);
    const [showCartModal, setShowCartModal] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [showCloseModal, setShowCloseModal] = useState(false);
    const [manualDoc, setManualDoc] = useState('');
    const [orderSuccess, setOrderSuccess] = useState(null);
    const [mounted, setMounted] = useState(false);
    const [categories, setCategories] = useState([
        { id: 'all', name: 'Todos', icon: LayoutGrid }
    ]);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [cartVisible, setCartVisible] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const searchRef = useRef(null);

    useEffect(() => {
        setMounted(true);
        const checkSize = () => {
            const mobile = window.innerWidth < 1280;
            setIsMobile(mobile);
            if (!mobile) setCartVisible(true);
        };
        checkSize();
        window.addEventListener('resize', checkSize);
        
        Promise.all([
            fetch('/api/cash/active').then(r => r.json()).catch(() => ({})),
            fetch('/api/payment-methods').then(r => r.json()).catch(() => []),
            fetch('/api/products/categories').then(r => r.json()).catch(() => []),
        ]).then(([cashData, methodsData, catsData]) => {
            if (cashData?.id) setIdApeCaj(cashData.id);
            if (Array.isArray(methodsData)) setAvailableMethods(methodsData);
            if (Array.isArray(catsData)) {
                setCategories([
                    { id: 'all', name: 'Todos', icon: LayoutGrid },
                    ...catsData.map(c => ({ id: c.id, name: c.name, icon: Package }))
                ]);
            }
        });

        return () => window.removeEventListener('resize', checkSize);
    }, []);

    useEffect(() => {
        const t = setTimeout(() => fetchProducts(), 250);
        return () => clearTimeout(t);
    }, [searchTerm, selectedCategory]);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const url = `/api/products/search?q=${encodeURIComponent(searchTerm)}&alm=${warehouse}&category=${selectedCategory}`;
            const res = await fetch(url);
            const data = await res.json();
            setProducts(Array.isArray(data) ? data : []);
        } catch { setProducts([]); }
        finally { setLoading(false); }
    };

    const handleOpenCash = async (e) => {
        e.preventDefault();
        setIsOpeningCash(true);
        try {
            const res = await fetch('/api/cash/open', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: parseFloat(openingAmount) || 0 })
            });
            const data = await res.json();
            if (data.success) setIdApeCaj(data.id);
            else alert(data.error || 'Error al abrir caja');
        } catch { alert('Error de conexión'); }
        finally { setIsOpeningCash(false); }
    };

    const handleCustomerSearch = async (e) => {
        const val = e.target.value.replace(/[^0-9]/g, '');
        setCustomerSearch(val);
        
        if (val.length === 8 || val.length === 11) {
            setIsSearchingCustomer(true);
            try {
                const res = await fetch(`/api/customers/search?q=${val}`);
                const { data, message } = await res.json();
                
                if (data) {
                    setCustomer({
                        name: data.nomcli,
                        ruc: data.ruccli,
                        code: data.codcli,
                        address: data.address,
                        phone: data.phone || '',
                        birthdate: data.birthdate || '',
                        isNew: data.isNew,
                        source: data.source
                    });
                } else {
                    if (message) alert(message);
                    setManualDoc(val);
                    setCustomer({ name: 'NO ENCONTRADO', ruc: val, code: 'MANUAL', isNew: false });
                }
            } catch (err) { console.error('Error searching customer', err); }
            finally { setIsSearchingCustomer(false); }
        }
    };

    const handleSaveInternal = async (formData) => {
        setIsSearchingCustomer(true);
        try {
            const res = await fetch('/api/customers/register-internal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await res.json();
            if (data.success) {
                setCustomer({
                    name: `${formData.name} ${formData.lastname}`,
                    ruc: formData.doc,
                    code: 'INTERNO',
                    source: 'RAILWAY'
                });
                setShowManualModal(false);
                alert('Registrado en Base de Datos de Railway');
            }
        } catch { alert('Error al registrar'); }
        finally { setIsSearchingCustomer(false); }
    };

    const registerCustomer = async () => {
        if (!customer.isNew) return;
        setIsSearchingCustomer(true);
        try {
            // Mapeo correcto para la API
            const payload = {
                nomcli: customer.name,
                ruccli: customer.ruc.length === 11 ? customer.ruc : '',
                nrodni: customer.ruc.length === 8 ? customer.ruc : '',
                dircli: customer.address || ''
            };

            const res = await fetch('/api/customers/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                setCustomer(prev => ({ ...prev, code: data.codcli, isNew: false }));
                alert('Cliente registrado exitosamente');
            } else {
                alert('Error al registrar cliente: ' + data.details);
            }
        } catch { alert('Error de conexión'); }
        finally { setIsSearchingCustomer(false); }
    };

    const addToCart = (product) => {
        setCart(prev => {
            const ex = prev.find(i => i.id === product.id);
            if (ex) return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
            return [...prev, { ...product, quantity: 1 }];
        });
    };

    const updateQuantity = (id, delta) =>
        setCart(prev => prev.map(i => i.id === id ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i));

    const removeFromCart = (id) => setCart(prev => prev.filter(i => i.id !== id));

    const finalizeSale = async () => {
        if (!cart.length || !idApeCaj) return;
        setIsFinalizing(true);
        try {
            // 1. Guardar datos extendidos en Railway si existen
            if (customer.phone || customer.birthdate) {
                const names = customer.name.split(' ');
                await fetch('/api/customers/register-internal', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        doc: customer.ruc,
                        name: names[0] || customer.name,
                        lastname: names.slice(1).join(' ') || 'EXTERNO',
                        phone: customer.phone,
                        birthdate: customer.birthdate
                    })
                }).catch(e => console.error('Error saving internal data:', e));
            }

            // 2. Procesar la venta en el ERP (Mapeando a Clientes Varios si es Interno)
            const erpCodCli = (customer.code === 'INTERNO' || customer.code === 'MANUAL') ? '000000' : customer.code;

            const res = await fetch('/api/sales/finalize', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    docType, pointOfSale: '01', 
                    codcli: erpCodCli,
                    nomcli: customer.name, 
                    ruccli: customer.ruc, 
                    items: cart,
                    idApeCaj, paymentMethod, codtar: selectedTar, warehouse
                })
            });
            const result = await res.json();
            if (result.success) { 
                setOrderSuccess(result.documentNumber); 
                setCart([]); 
                setCustomer({ name: 'CLIENTE VARIOS', ruc: '', code: '000000', phone: '', birthdate: '' }); 
                setCustomerSearch(''); 
            }
            else alert('Error: ' + result.details);
        } catch { alert('Error al procesar la venta'); }
        finally { setIsFinalizing(false); }
    };

    const total = cart.reduce((acc, i) => acc + i.price * i.quantity, 0);
    const itemCount = cart.reduce((acc, i) => acc + i.quantity, 0);

    if (!mounted) return null;

    if (!idApeCaj) {
        return (
            <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: "'Inter', sans-serif" }}>
                <form onSubmit={handleOpenCash} style={{
                    background: '#fff', borderRadius: '24px', padding: '40px', width: '100%', maxWidth: '400px',
                    boxShadow: '0 25px 60px rgba(0,0,0,0.3)', textAlign: 'center',
                }}>
                    <div style={{ width: '56px', height: '56px', background: '#3b82f6', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                        <Zap size={24} style={{ color: '#fff', fill: '#fff' }} />
                    </div>
                    <h1 style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', margin: '0 0 4px' }}>Abrir Caja</h1>
                    <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 28px' }}>Ingresa el monto de apertura</p>
                    <div style={{ position: 'relative', marginBottom: '20px' }}>
                        <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '20px', fontWeight: 800, color: '#94a3b8' }}>S/</span>
                        <input type="number" step="0.01" autoFocus required placeholder="0.00"
                            value={openingAmount} onChange={e => setOpeningAmount(e.target.value)}
                            style={{
                                width: '100%', background: '#f8fafc', border: '2px solid #e2e8f0', borderRadius: '14px',
                                padding: '20px 16px 20px 48px', fontSize: '28px', fontWeight: 800, color: '#0f172a',
                                outline: 'none', textAlign: 'right', boxSizing: 'border-box',
                            }}
                        />
                    </div>
                    <button disabled={isOpeningCash} style={{
                        width: '100%', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '14px',
                        padding: '16px', fontSize: '15px', fontWeight: 800, cursor: isOpeningCash ? 'not-allowed' : 'pointer',
                        opacity: isOpeningCash ? 0.6 : 1, boxShadow: '0 4px 14px rgba(59,130,246,0.3)',
                    }}>
                        {isOpeningCash ? 'Abriendo...' : 'Abrir Caja y Comenzar'}
                    </button>
                    <button type="button" onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                        style={{ marginTop: '16px', background: 'none', border: 'none', color: '#94a3b8', fontSize: '12px', cursor: 'pointer' }}>
                        Cerrar sesión
                    </button>
                </form>
            </div>
        );
    }

    return (
        <>
            <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
                * { box-sizing: border-box; margin: 0; padding: 0; }
                html, body { font-family: 'Inter', -apple-system, sans-serif; height: 100%; overflow: hidden; -webkit-font-smoothing: antialiased; background: #f1f5f9; }
                ::-webkit-scrollbar { width: 4px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                .pos-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
                @media (max-width: 1280px) {
                    .ticket-aside { position: fixed !important; top: 0; right: 0; bottom: 0; z-index: 100; transform: translateX(100%); transition: transform 0.3s ease; width: 380px !important; box-shadow: -20px 0 50px rgba(0,0,0,0.1) !important; }
                    .ticket-aside.visible { transform: translateX(0); }
                    .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.3); backdrop-filter: blur(4px); z-index: 90; }
                }
            `}</style>

            <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: '#f1f5f9', position: 'relative' }}>
                <div style={sidebarStyle}>
                    <div style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px' }}>
                        <div style={logoStyle}><Zap size={24} fill="currentColor" /></div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'center' }}>
                            <div style={activeIconStyle}>
                                <LayoutGrid size={22} />
                                <span style={{ fontSize: '10px', fontWeight: 800, marginTop: '4px' }}>Todos</span>
                            </div>
                            <div style={inactiveIconStyle}>
                                <ShoppingBag size={22} />
                                <span style={{ fontSize: '10px', fontWeight: 800, marginTop: '4px' }}>Alim</span>
                            </div>
                            <div style={inactiveIconStyle}>
                                <Zap size={22} />
                                <span style={{ fontSize: '10px', fontWeight: 800, marginTop: '4px' }}>Bebi</span>
                            </div>
                            <div style={inactiveIconStyle}>
                                <Sparkles size={22} />
                                <span style={{ fontSize: '10px', fontWeight: 800, marginTop: '4px' }}>Limp</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
                        <button onClick={() => setShowHistoryModal(true)} style={sidebarBtnStyle}>
                            <Clock size={22} />
                            <span style={btnLabelStyle}>Historial</span>
                        </button>
                        <div style={sidebarBtnStyle}>
                            <Settings size={22} />
                            <span style={btnLabelStyle}>Config</span>
                        </div>
                        <button onClick={() => setShowCloseModal(true)} style={sidebarBtnStyle}>
                            <Lock size={22} />
                            <span style={btnLabelStyle}>Cerrar Caja</span>
                        </button>
                        <button onClick={() => signOut({ callbackUrl: '/auth/signin' })} style={logoutBtnStyle}>
                            <LogOut size={22} />
                            <span style={btnLabelStyle}>Salir</span>
                        </button>
                    </div>
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: '#f8fafc' }}>
                    {/* BUSCADOR PRINCIPAL Y DOCUMENTO */}
                    <div style={{ flexShrink: 0, background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ flex: 1, position: 'relative' }}>
                            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                            <input type="text" placeholder="Buscar productos por nombre o código..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px 12px 10px 38px', fontSize: '13px', fontWeight: 500, color: '#1e293b', outline: 'none' }} />
                        </div>

                        <div style={{ display: isMobile ? 'none' : 'flex', background: '#f1f5f9', borderRadius: '10px', padding: '3px', gap: '3px', flexShrink: 0 }}>
                            {[{ v: '03', l: 'Boleta' }, { v: '01', l: 'Factura' }, { v: '65', l: 'Nota Venta' }].map(({ v, l }) => (
                                <button key={v} onClick={() => setDocType(v)} style={{ padding: '8px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, border: 'none', cursor: 'pointer', background: docType === v ? '#fff' : 'transparent', color: docType === v ? '#3b82f6' : '#64748b', boxShadow: docType === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>{l}</button>
                            ))}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Image 
                                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${session?.user?.email || 'x'}`} 
                                alt="avatar" 
                                width={32} 
                                height={32} 
                                unoptimized
                                style={{ borderRadius: '10px', border: '1px solid #e2e8f0' }} 
                            />
                        </div>
                    </div>

                    {/* BARRA DE CLIENTE HORIZONTAL (NUEVA) */}
                    <div style={{ flexShrink: 0, background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '12px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                            {/* Buscador de DNI/RUC */}
                            <div style={{ width: '240px', position: 'relative' }}>
                                <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} size={14} />
                                <input 
                                    type="text" 
                                    placeholder="DNI o RUC del cliente..." 
                                    value={customerSearch}
                                    onChange={handleCustomerSearch}
                                    style={{ width: '100%', padding: '10px 12px 10px 36px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', fontWeight: 600, outline: 'none' }}
                                />
                                {isSearchingCustomer && <Loader2 style={{ position: 'absolute', right: '10px', top: '30%', animation: 'spin 1s linear infinite', color: '#3b82f6' }} size={14} />}
                            </div>

                            {/* Info Cliente Seleccionado */}
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '16px', borderLeft: '1px solid #f1f5f9', paddingLeft: '20px' }}>
                                <div style={{ minWidth: '150px' }}>
                                    <p style={{ fontSize: '9px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '2px' }}>Cliente</p>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <p style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b', margin: 0 }}>{customer.name}</p>
                                        <button onClick={() => setCustomer({ name: 'CLIENTE VARIOS', ruc: '', code: '000000', phone: '', birthdate: '' })} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}>Limpiar</button>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                    <div style={{ width: '120px' }}>
                                        <label style={{ fontSize: '9px', fontWeight: 800, color: '#94a3b8', display: 'block', marginBottom: '2px' }}>CELULAR</label>
                                        <input 
                                            type="text" 
                                            placeholder="999..."
                                            value={customer.phone || ''}
                                            onChange={e => setCustomer({...customer, phone: e.target.value})}
                                            style={{ width: '100%', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px 8px', fontSize: '11px', fontWeight: 600 }}
                                        />
                                    </div>
                                    <div style={{ width: '140px' }}>
                                        <CustomDatePicker 
                                            label="F. NACIMIENTO"
                                            value={customer.birthdate || ''}
                                            onChange={val => setCustomer({...customer, birthdate: val})}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {customer.isNew && (
                                        <button onClick={registerCustomer} style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 12px', fontSize: '11px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <UserPlus size={14} /> Registrar
                                        </button>
                                    )}
                                    <button onClick={() => { setManualDoc(customerSearch); setShowManualModal(true); }} style={{ background: '#fff', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 12px', fontSize: '11px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <ShieldCheck size={14} /> Menor
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ flexShrink: 0, padding: '16px 20px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', margin: 0 }}>{categories.find(c => c.id === selectedCategory)?.name || 'Todos'}</h2>
                            <p style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>{loading ? 'Cargando...' : `${products.length} productos disponibles`}</p>
                        </div>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px 20px' }}>
                        {loading ? <div className="pos-grid">{Array.from({ length: 12 }).map((_, i) => <div key={i} style={{ background: '#fff', borderRadius: '16px', height: '160px', border: '1px solid #e2e8f0', opacity: 0.5 }} />)}</div> : <div className="pos-grid">{products.map(p => <ProductCard key={p.id} product={p} onAdd={prod => { addToCart(prod); if(isMobile) setCartVisible(true); }} />)}</div>}
                    </div>
                </div>

                <div className={`ticket-aside ${cartVisible ? 'visible' : ''}`} style={{ width: '360px', background: '#fff', display: 'flex', flexDirection: 'column', flexShrink: 0, borderLeft: '1px solid #e2e8f0' }}>
                    <div style={{ padding: '24px 24px 12px', borderBottom: '1px solid #f1f5f9' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ background: '#3b82f6', color: '#fff', borderRadius: '12px', padding: '8px' }}>
                                    <ShoppingCart size={20} />
                                </div>
                                <h2 style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', margin: 0 }}>Ticket de Venta</h2>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button 
                                    onClick={() => setCart([])} 
                                    title="Limpiar Carrito"
                                    style={{ background: '#fff1f2', border: 'none', color: '#ef4444', borderRadius: '10px', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                >
                                    <Trash2 size={18} />
                                </button>
                                <button 
                                    onClick={() => setShowCartModal(true)} 
                                    title="Ver Detalles"
                                    style={{ background: '#eff6ff', border: 'none', color: '#3b82f6', borderRadius: '10px', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                >
                                    <LayoutGrid size={18} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
                        {cart.length === 0 ? <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}><ShoppingCart size={40} style={{ color: '#94a3b8', marginBottom: '8px' }} /><p style={{ fontSize: '12px', fontWeight: 700 }}>Carrito vacío</p></div> : <AnimatePresence mode="popLayout">{cart.map(item => <CartItem key={item.id} item={item} onUpdateQty={updateQuantity} onRemove={removeFromCart} />)}</AnimatePresence>}
                    </div>

                    <PaymentSection total={total} availableMethods={availableMethods} paymentMethod={paymentMethod} selectedTar={selectedTar} onSetMethod={m => { setPaymentMethod(m.type); setSelectedTar(m.id === 'EF' ? '' : m.id); }} onFinalize={finalizeSale} loading={isFinalizing} cartEmpty={cart.length === 0} />
                </div>

                {isMobile && !cartVisible && itemCount > 0 && (
                    <button onClick={() => setCartVisible(true)} style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 80, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '20px', padding: '12px 24px', fontSize: '16px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 10px 25px rgba(59,130,246,0.4)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <ShoppingCart size={20} /><span>S/ {total.toFixed(2)}</span><span style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '8px', fontSize: '12px' }}>{itemCount}</span>
                    </button>
                )}

                {orderSuccess && <SuccessModal orderNumber={orderSuccess} onReset={() => setOrderSuccess(null)} onPrint={() => window.print()} />}
                
                <CustomerManualModal 
                    isOpen={showManualModal} 
                    onClose={() => setShowManualModal(false)} 
                    initialDoc={manualDoc}
                    onSave={handleSaveInternal}
                />
                
                <SalesHistoryModal 
                    isOpen={showHistoryModal} 
                    onClose={() => setShowHistoryModal(false)} 
                    idApeCaj={idApeCaj} 
                />

                <CloseCashModal 
                    isOpen={showCloseModal} 
                    onClose={() => setShowCloseModal(false)} 
                    idApeCaj={idApeCaj}
                    onConfirm={() => signOut({ callbackUrl: '/auth/signin' })}
                />

                <CartDetailsModal 
                    isOpen={showCartModal}
                    onClose={() => setShowCartModal(false)}
                    items={cart}
                    onUpdateQty={updateQuantity}
                    onRemove={removeFromCart}
                    onClear={() => { setCart([]); setShowCartModal(false); }}
                    total={total}
                />
            </div>

                {isMobile && !cartVisible && itemCount > 0 && (
                    <button onClick={() => setCartVisible(true)} style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 80, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '20px', padding: '12px 24px', fontSize: '16px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 10px 25px rgba(59,130,246,0.4)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <ShoppingCart size={20} /><span>S/ {total.toFixed(2)}</span><span style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '8px', fontSize: '12px' }}>{itemCount}</span>
                    </button>
                )}

                {orderSuccess && <SuccessModal orderNumber={orderSuccess} onReset={() => setOrderSuccess(null)} onPrint={() => window.print()} />}
                
                <CustomerManualModal 
                    isOpen={showManualModal} 
                    onClose={() => setShowManualModal(false)} 
                    initialDoc={manualDoc}
                    onSave={handleSaveInternal}
                />
                
                <SalesHistoryModal 
                    isOpen={showHistoryModal} 
                    onClose={() => setShowHistoryModal(false)} 
                    idApeCaj={idApeCaj} 
                />

                <CloseCashModal 
                    isOpen={showCloseModal} 
                    onClose={() => setShowCloseModal(false)} 
                    idApeCaj={idApeCaj}
                    onConfirm={() => signOut({ callbackUrl: '/auth/signin' })}
                />

                <CartDetailsModal 
                    isOpen={showCartModal}
                    onClose={() => setShowCartModal(false)}
                    items={cart}
                    onUpdateQty={updateQuantity}
                    onRemove={removeFromCart}
                    onClear={() => { setCart([]); setShowCartModal(false); }}
                    total={total}
                />
            </div>
        </>
    );
}

const sidebarStyle = { width: '80px', background: '#0f172a', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.05)' };
const logoStyle = { width: '44px', height: '44px', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 8px 20px rgba(37,99,235,0.3)' };
const activeIconStyle = { width: '56px', height: '56px', background: 'rgba(59,130,246,0.15)', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)' };
const inactiveIconStyle = { width: '56px', height: '56px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b', transition: 'all 0.2s', cursor: 'pointer' };
const sidebarBtnStyle = { background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: '#64748b', cursor: 'pointer', padding: '8px 0', width: '100%' };
const logoutBtnStyle = { ...sidebarBtnStyle, color: '#ef4444' };
const btnLabelStyle = { fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' };
