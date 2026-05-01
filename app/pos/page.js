'use client';

import { useState, useEffect } from 'react';
import { Search, ShoppingCart, Package, Info, Plus, Minus, X, CheckCircle2, AlertCircle, Receipt, User, Clock, Lock, Banknote, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';

export default function POSPage() {
    const { data: session } = useSession();
    const [searchTerm, setSearchTerm] = useState('');
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isFinalizing, setIsFinalizing] = useState(false);
    const [cart, setCart] = useState([]);
    const [warehouse, setWarehouse] = useState('01');
    const [idApeCaj, setIdApeCaj] = useState(null);
    const [docType, setDocType] = useState('03'); // 03 = Boleta
    const [paymentMethod, setPaymentMethod] = useState(1); // 1 = Efectivo
    const [selectedTar, setSelectedTar] = useState(''); // Código de tarjeta
    const [availableMethods, setAvailableMethods] = useState([]);
    const [customer, setCustomer] = useState({ name: 'CLIENTE VARIOS', ruc: '', code: '000000' });
    const [orderSuccess, setOrderSuccess] = useState(null);
    const [printedItems, setPrintedItems] = useState([]);
    const [showCustomerForm, setShowCustomerForm] = useState(false);
    const [newCustomer, setNewCustomer] = useState({ 
        nomcli: '', ruccli: '', nrodni: '', dircli: '', telcli: '', email: '' 
    });
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        // Cargar caja activa al iniciar
        const loadCaja = async () => {
            try {
                const res = await fetch('/api/cash/active');
                const data = await res.json();
                if (data.id) {
                    setIdApeCaj(data.id);
                }
            } catch (e) { 
                console.error('Error cargando caja:', e); 
            }
        };

        const fetchMethods = async () => {
            try {
                const res = await fetch('/api/payment-methods');
                const data = await res.json();
                if (Array.isArray(data)) {
                    setAvailableMethods(data);
                } else {
                    setAvailableMethods([]);
                }
            } catch (e) {
                console.error('Methods load error:', e);
                setAvailableMethods([]);
            }
        };

        loadCaja();
        fetchMethods();
    }, []);

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (searchTerm.length >= 3) {
                searchProducts();
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm]);

    if (!mounted) return null;

    const searchProducts = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/products/search?q=${searchTerm}&alm=${warehouse}`);
            const data = await res.json();
            setProducts(data);
        } catch (error) {
            console.error('Search error:', error);
        } finally {
            setLoading(false);
        }
    };

    const addToCart = (product) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                return prev.map(item => 
                    item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
                );
            }
            return [...prev, { ...product, quantity: 1 }];
        });
    };

    const updateQuantity = (id, delta) => {
        setCart(prev => prev.map(item => {
            if (item.id === id) {
                const newQty = Math.max(1, item.quantity + delta);
                return { ...item, quantity: newQty };
            }
            return item;
        }));
    };

    const finalizeSale = async () => {
        if (cart.length === 0) return;
        setIsFinalizing(true);
        try {
            let currentCliCode = customer.code;

            // Si el cliente es nuevo (de API externa), registrarlo primero
            if (currentCliCode === 'NUEVO') {
                const regRes = await fetch('/api/customers/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        nomcli: customer.name,
                        ruccli: customer.ruc.length === 11 ? customer.ruc : '',
                        nrodni: customer.ruc.length === 8 ? customer.ruc : '',
                        dircli: customer.address || ''
                    })
                });
                const regData = await regRes.json();
                if (regData.success) {
                    currentCliCode = regData.codcli;
                } else {
                    throw new Error('No se pudo registrar el cliente nuevo');
                }
            }

            const res = await fetch('/api/sales/finalize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    docType,
                    pointOfSale: '01',
                    codcli: currentCliCode,
                    nomcli: customer.name,
                    ruccli: customer.ruc,
                    items: cart,
                    idApeCaj,
                    paymentMethod,
                    codtar: selectedTar,
                    warehouse
                })
            });
            const result = await res.json();
            if (result.success) {
                setPrintedItems([...cart]); // Guardar para la impresión
                setOrderSuccess(result.documentNumber);
                setCart([]);
            } else {
                alert('Error: ' + result.details);
            }
        } catch (error) {
            console.error('Finalize error:', error);
            alert('Error: ' + error.message);
        } finally {
            setIsFinalizing(false);
        }
    };

    const total = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

    return (
        <div className="min-h-screen bg-[#0f172a] text-white p-4 lg:p-8 font-sans overflow-x-hidden">
            <header className="mb-8 flex flex-col md:flex-row justify-between items-center bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-3xl gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl shadow-lg shadow-cyan-500/20">
                        <Package className="w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                            {session?.user?.company || 'Syscom POS Cloud'}
                        </h1>
                        <div className="flex items-center gap-2 mt-1">
                            <p className="text-slate-400 text-sm flex items-center gap-1">
                                <User className="w-3 h-3 text-cyan-400" /> {session?.user?.name || 'Cajero'}
                            </p>
                            <span className="text-slate-600">•</span>
                            <p className="text-slate-400 text-sm flex items-center gap-1">
                                <Package className="w-3 h-3 text-cyan-400" /> Almacén: {warehouse}
                            </p>
                            <span className="text-slate-600">•</span>
                            <p className={`text-sm font-bold flex items-center gap-1 ${idApeCaj ? 'text-emerald-400' : 'text-rose-400'}`}>
                                <Clock className="w-3 h-3" /> {idApeCaj ? `Caja: ${idApeCaj}` : 'Caja Cerrada'}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-6">
                    <button 
                        onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                        className="px-4 py-2 bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 hover:border-rose-500/40 transition-all rounded-xl text-sm font-semibold flex items-center gap-2"
                    >
                        <Lock className="w-4 h-4" /> Salir
                    </button>
                    <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                        {['01', '03', '65'].map(type => (
                            <button
                                key={type}
                                onClick={() => setDocType(type)}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${docType === type ? 'bg-cyan-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            >
                                {type === '01' ? 'Factura' : type === '03' ? 'Boleta' : 'Nota'}
                            </button>
                        ))}
                    </div>
                    
                    <Link href="/pos/history" className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/10 flex items-center gap-2 group ml-2">
                        <Clock className="w-5 h-5 text-slate-400 group-hover:text-cyan-400" />
                    </Link>
                    <Link href="/pos/close-cash" className="p-3 bg-rose-500/10 hover:bg-rose-500/20 rounded-xl transition-all border border-rose-500/20 flex items-center gap-2 group ml-2">
                        <Lock className="w-5 h-5 text-rose-400" />
                    </Link>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Panel de Búsqueda y Productos */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl blur opacity-25 group-focus-within:opacity-50 transition duration-1000"></div>
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Escribe el nombre o código del producto..."
                                className="w-full bg-[#1e293b] border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-cyan-500 outline-none transition-all text-lg"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4">
                        <AnimatePresence>
                            {products.map((product) => (
                                <motion.div
                                    key={product.id}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    whileHover={{ y: -5 }}
                                    className="bg-white/5 border border-white/10 p-5 rounded-3xl hover:bg-white/10 transition-all group relative overflow-hidden"
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex-1">
                                            <h3 className="font-bold text-lg leading-tight group-hover:text-cyan-400 transition-colors line-clamp-2">
                                                {product.name}
                                            </h3>
                                            <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest">{product.brand}</p>
                                        </div>
                                        <span className="bg-cyan-500/20 text-cyan-400 px-3 py-1 rounded-full text-xs font-black">
                                            {product.unit}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <p className="text-3xl font-black text-white">S/ {product.price.toFixed(2)}</p>
                                            <p className={`text-sm mt-1 font-bold ${product.stock > 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                                                {product.stock > 0 ? `Stock: ${product.stock}` : 'Sin Stock'}
                                            </p>
                                        </div>
                                        <button 
                                            onClick={() => addToCart(product)}
                                            className="bg-gradient-to-br from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 p-4 rounded-2xl transition-all shadow-lg shadow-cyan-500/20 active:scale-90"
                                        >
                                            <Plus className="w-6 h-6" />
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Panel de Carrito / Detalle */}
                <div className="space-y-6">
                    {/* Búsqueda de Clientes */}
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-6 shadow-xl">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <User className="text-cyan-400" /> Datos del Cliente
                        </h3>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                                <input 
                                    type="text" 
                                    placeholder="RUC o DNI..."
                                    className="w-full bg-black/20 border border-white/10 rounded-xl py-2 pl-10 pr-4 focus:ring-1 focus:ring-cyan-500 outline-none transition-all text-sm"
                                    onKeyDown={async (e) => {
                                        if (e.key === 'Enter') {
                                            const val = e.currentTarget.value;
                                            if (val.length === 8 || val.length === 11) {
                                                const res = await fetch(`/api/customers/search?q=${val}`);
                                                const result = await res.json();
                                                if (result.data) {
                                                    setCustomer({
                                                        name: result.data.nomcli,
                                                        ruc: result.data.ruccli || result.data.nrodni,
                                                        code: result.data.codcli,
                                                        address: result.data.address
                                                    });
                                                } else {
                                                    alert('Cliente no encontrado');
                                                }
                                            }
                                        }
                                    }}
                                />
                            </div>
                            <button 
                                onClick={() => setShowCustomerForm(true)}
                                className="bg-white/5 hover:bg-white/10 p-2 rounded-xl transition-colors border border-white/10"
                            >
                                <Plus className="w-5 h-5 text-cyan-400" />
                            </button>
                        </div>
                        
                        <div className="mt-4 p-4 bg-cyan-500/5 border border-cyan-500/20 rounded-2xl">
                            <p className="text-xs text-cyan-500 font-bold uppercase mb-1">Cliente Seleccionado</p>
                            <p className="font-bold text-sm line-clamp-1">{customer.name}</p>
                            <p className="text-xs text-slate-500">{customer.ruc || 'Sin documento'}</p>
                            {customer.code === 'NUEVO' && (
                                <span className="inline-block mt-2 px-2 py-0.5 bg-orange-500/20 text-orange-400 text-[10px] font-bold rounded uppercase">
                                    Nuevo (Se registrará al finalizar)
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 h-fit sticky top-8 shadow-2xl">
                        <h2 className="text-2xl font-black mb-8 flex items-center gap-3">
                            <ShoppingCart className="text-cyan-400 w-8 h-8" /> Mi Carrito
                        </h2>
                        
                        <div className="space-y-4 max-h-[40vh] overflow-y-auto mb-8 pr-2 custom-scrollbar">
                            {cart.length === 0 ? (
                                <div className="text-center py-16 text-slate-500">
                                    <ShoppingCart className="w-16 h-16 mx-auto mb-4 opacity-20" />
                                    <p className="italic font-medium">El carrito está vacío</p>
                                </div>
                            ) : (
                                cart.map((item) => (
                                    <motion.div 
                                        layout
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        key={item.id} 
                                        className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5 group"
                                    >
                                        <div className="flex-1">
                                            <p className="text-sm font-bold line-clamp-1">{item.name}</p>
                                            <div className="flex items-center gap-4 mt-2">
                                                <div className="flex items-center bg-black/30 rounded-lg overflow-hidden border border-white/5">
                                                    <button onClick={() => updateQuantity(item.id, -1)} className="p-1 hover:bg-white/10 text-cyan-400"><Minus className="w-4 h-4" /></button>
                                                    <span className="px-3 font-bold text-sm">{item.quantity}</span>
                                                    <button onClick={() => addToCart(item)} className="p-1 hover:bg-white/10 text-cyan-400"><Plus className="w-4 h-4" /></button>
                                                </div>
                                                <span className="text-xs text-slate-400">x S/ {item.price.toFixed(2)}</span>
                                            </div>
                                        </div>
                                        <div className="text-right ml-4">
                                            <p className="font-black text-cyan-400 text-lg">S/ {(item.price * item.quantity).toFixed(2)}</p>
                                            <button 
                                                onClick={() => setCart(cart.filter(c => c.id !== item.id))}
                                                className="text-rose-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </div>

                        <div className="border-t border-white/10 pt-8 space-y-4">
                            <div className="flex justify-between text-slate-400">
                                <span>Subtotal</span>
                                <span className="font-bold">S/ {(total / 1.18).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-slate-400">
                                <span>Impuestos (18%)</span>
                                <span className="font-bold">S/ {(total - (total / 1.18)).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-4xl font-black text-white pt-4 border-t border-white/10 mb-8">
                                <span>Total</span>
                                <span className="text-cyan-400">S/ {total.toFixed(2)}</span>
                            </div>

                            {/* Métodos de Pago */}
                            <div className="mb-6">
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-3">Método de Pago</p>
                                <div className="grid grid-cols-2 gap-2">
                                    {availableMethods.map(method => (
                                        <button
                                            key={method.id}
                                            onClick={() => {
                                                setPaymentMethod(method.type);
                                                setSelectedTar(method.id === 'EF' ? '' : method.id);
                                            }}
                                            className={`flex items-center justify-center gap-2 py-3 rounded-xl border transition-all text-[10px] font-bold ${
                                                (method.id === 'EF' && paymentMethod === 1) || (selectedTar === method.id)
                                                    ? 'bg-cyan-500 border-cyan-400 text-white shadow-lg shadow-cyan-500/20'
                                                    : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                                            }`}
                                        >
                                            {method.type === 1 ? <Banknote className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
                                            {method.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button 
                                disabled={cart.length === 0 || isFinalizing}
                                onClick={finalizeSale}
                                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 py-6 rounded-2xl font-black text-xl shadow-xl shadow-cyan-500/20 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed mt-8 flex items-center justify-center gap-3"
                            >
                                {isFinalizing ? (
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                                ) : (
                                    <>
                                        Finalizar Venta <CheckCircle2 className="w-6 h-6" />
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal de Éxito */}
            <AnimatePresence>
                {orderSuccess && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    >
                        <motion.div 
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            className="bg-slate-900 border border-white/10 p-10 rounded-[3rem] max-w-md w-full text-center shadow-2xl"
                        >
                            <div className="w-24 h-24 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Receipt className="w-12 h-12" />
                            </div>
                            <h2 className="text-3xl font-black mb-2">¡Venta Exitosa!</h2>
                            <p className="text-slate-400 mb-8">El documento se ha registrado correctamente en el sistema.</p>
                            
                            <div className="bg-white/5 p-6 rounded-3xl mb-8">
                                <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Número de Documento</p>
                                <p className="text-4xl font-black text-cyan-400 font-mono">{orderSuccess}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <button 
                                    onClick={() => window.print()}
                                    className="bg-cyan-500 text-white py-4 rounded-2xl font-bold text-lg hover:bg-cyan-400 transition-colors flex items-center justify-center gap-2"
                                >
                                    Imprimir <Receipt className="w-5 h-5" />
                                </button>
                                <button 
                                    onClick={() => setOrderSuccess(null)}
                                    className="bg-white text-black py-4 rounded-2xl font-bold text-lg hover:bg-slate-200 transition-colors"
                                >
                                    Nueva Venta
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Modal de Registro de Cliente Manual */}
            <AnimatePresence>
                {showCustomerForm && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-4"
                    >
                        <motion.div 
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="bg-slate-900 border border-white/10 p-8 rounded-[2.5rem] max-w-lg w-full shadow-2xl"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <User className="text-cyan-400" /> Nuevo Cliente
                                </h2>
                                <button onClick={() => setShowCustomerForm(false)} className="text-slate-500 hover:text-white">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1 ml-1">DNI / RUC</label>
                                        <input 
                                            type="text" 
                                            className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 focus:ring-1 focus:ring-cyan-500 outline-none text-sm"
                                            value={newCustomer.ruccli}
                                            onChange={(e) => setNewCustomer({...newCustomer, ruccli: e.target.value})}
                                            placeholder="Documento"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1 ml-1">Teléfono</label>
                                        <input 
                                            type="text" 
                                            className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 focus:ring-1 focus:ring-cyan-500 outline-none text-sm"
                                            value={newCustomer.telcli}
                                            onChange={(e) => setNewCustomer({...newCustomer, telcli: e.target.value})}
                                            placeholder="Opcional"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1 ml-1">Nombre Completo / Razón Social</label>
                                    <input 
                                        type="text" 
                                        className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 focus:ring-1 focus:ring-cyan-500 outline-none text-sm"
                                        value={newCustomer.nomcli}
                                        onChange={(e) => setNewCustomer({...newCustomer, nomcli: e.target.value})}
                                        placeholder="Nombre del cliente"
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1 ml-1">Dirección</label>
                                    <input 
                                        type="text" 
                                        className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 focus:ring-1 focus:ring-cyan-500 outline-none text-sm"
                                        value={newCustomer.dircli}
                                        onChange={(e) => setNewCustomer({...newCustomer, dircli: e.target.value})}
                                        placeholder="Dirección fiscal o de entrega"
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1 ml-1">Email</label>
                                    <input 
                                        type="email" 
                                        className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 focus:ring-1 focus:ring-cyan-500 outline-none text-sm"
                                        value={newCustomer.email}
                                        onChange={(e) => setNewCustomer({...newCustomer, email: e.target.value})}
                                        placeholder="ejemplo@correo.com"
                                    />
                                </div>
                            </div>

                            <button 
                                onClick={async () => {
                                    if (!newCustomer.nomcli || !newCustomer.ruccli) return alert('Nombre y Documento son obligatorios');
                                    
                                    const res = await fetch('/api/customers/register', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            ...newCustomer,
                                            nrodni: newCustomer.ruccli.length === 8 ? newCustomer.ruccli : '',
                                            ruccli: newCustomer.ruccli.length === 11 ? newCustomer.ruccli : ''
                                        })
                                    });
                                    const result = await res.json();
                                    if (result.success) {
                                        setCustomer({
                                            name: newCustomer.nomcli,
                                            ruc: newCustomer.ruccli,
                                            code: result.codcli,
                                            address: newCustomer.dircli
                                        });
                                        setShowCustomerForm(false);
                                        setNewCustomer({ nomcli: '', ruccli: '', nrodni: '', dircli: '', telcli: '', email: '' });
                                    } else {
                                        alert('Error al registrar: ' + result.error);
                                    }
                                }}
                                className="w-full bg-cyan-500 hover:bg-cyan-400 py-4 rounded-2xl font-black text-lg mt-8 shadow-xl shadow-cyan-500/20 transition-all"
                            >
                                GUARDAR CLIENTE
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Ticket de Impresión (Oculto en pantalla, visible en print) */}
            <div id="ticket-print" className="hidden">
                <div className="text-center mb-4">
                    <h2 className="font-bold text-lg uppercase">Dato.Click POS</h2>
                    <p className="text-xs">RUC: 20123456789</p>
                    <p className="text-xs text-wrap">Av. Principal 123 - Lima</p>
                    <p className="text-xs">Tel: (01) 456-7890</p>
                </div>

                <div className="border-t border-b border-black py-2 mb-4 text-[10px]">
                    <p className="flex justify-between">
                        <span>{docType === '01' ? 'FACTURA' : 'BOLETA'} ELECTRÓNICA</span>
                        <span className="font-bold">{orderSuccess}</span>
                    </p>
                    <p>Fecha: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</p>
                    <p className="mt-1 uppercase">Cliente: {customer.name}</p>
                    <p>Doc: {customer.ruc}</p>
                </div>

                <table className="w-full text-[10px] mb-4">
                    <thead>
                        <tr className="border-b border-black">
                            <th className="text-left">CANT</th>
                            <th className="text-left">DESCRIPCIÓN</th>
                            <th className="text-right">TOTAL</th>
                        </tr>
                    </thead>
                    <tbody>
                        {printedItems.length > 0 ? printedItems.map((item, idx) => (
                            <tr key={idx}>
                                <td>{item.quantity}</td>
                                <td className="uppercase">{item.name}</td>
                                <td className="text-right">S/ {(item.price * item.quantity).toFixed(2)}</td>
                            </tr>
                        )) : (
                            <tr><td colSpan="3" className="text-center italic">Cargando...</td></tr>
                        )}
                    </tbody>
                </table>

                <div className="border-t border-black pt-2 text-xs space-y-1">
                    <div className="flex justify-between">
                        <span>SUBTOTAL:</span>
                        <span>S/ {(printedItems.reduce((acc, item) => acc + (item.price * item.quantity), 0) / 1.18).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>IGV (18%):</span>
                        <span>S/ {(printedItems.reduce((acc, item) => acc + (item.price * item.quantity), 0) - (printedItems.reduce((acc, item) => acc + (item.price * item.quantity), 0) / 1.18)).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-sm">
                        <span>TOTAL:</span>
                        <span>S/ {printedItems.reduce((acc, item) => acc + (item.price * item.quantity), 0).toFixed(2)}</span>
                    </div>
                </div>

                <div className="text-center mt-8 text-[10px]">
                    <p>¡Gracias por su compra!</p>
                    <p>Representación impresa de {docType === '01' ? 'Factura' : 'Boleta'} Electrónica</p>
                </div>
            </div>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.05); }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(34, 211, 238, 0.5); border-radius: 10px; }
                .text-gradient { background: linear-gradient(to right, #22d3ee, #3b82f6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }

                @media print {
                    body * { visibility: hidden; }
                    #ticket-print, #ticket-print * { visibility: visible; }
                    #ticket-print {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 80mm;
                        color: black !important;
                        background: white !important;
                        padding: 5mm;
                        font-family: 'Courier New', Courier, monospace;
                        font-size: 12px;
                    }
                    .no-print { display: none !important; }
                }
            `}</style>
        </div>
    );
}
