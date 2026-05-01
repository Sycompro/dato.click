'use client';

import { useState, useEffect } from 'react';
import { Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2, ChevronDown, Lock, User, CheckCircle2, ShieldCheck, ShoppingCart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function SignInContent() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [error, setError] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    // Cargar empresas al iniciar
    const fetchCompanies = async () => {
      try {
        const res = await fetch('/api/companies');
        const data = await res.json();
        if (Array.isArray(data)) {
          setCompanies(data);
          // Pre-seleccionar la primera si hay
          if (data.length > 0) setSelectedCompany(data[0]);
        }
      } catch (err) {
        console.error('Error fetching companies:', err);
      }
    };
    fetchCompanies();
  }, []);

  const handleNextStep = (e) => {
    e.preventDefault();
    if (!selectedCompany) { setError('Por favor selecciona una empresa'); return; }
    setError('');
    setStep(2);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const result = await signIn('credentials', {
        code: selectedCompany.code,
        username: username.trim(),
        password: password.trim(),
        redirect: false,
        callbackUrl: '/pos'
      });
      if (result?.error) {
        setError('Usuario o contraseña incorrectos para esta sede');
        setIsLoading(false);
      } else {
        router.push('/pos');
        router.refresh();
      }
    } catch {
      setError('Ocurrió un error de conexión');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex overflow-hidden font-sans">
      
      {/* ── PANEL IZQUIERDO: Branding (Tablet/Desktop) ── */}
      <div className="hidden lg:flex w-[45%] bg-[#0f172a] relative overflow-hidden flex-col justify-between p-16">
        {/* Círculos decorativos de fondo */}
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-5%] left-[-5%] w-[400px] h-[400px] bg-cyan-600/10 rounded-full blur-[100px]" />

        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-16">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/40">
              <ShoppingCart className="text-white w-8 h-8" />
            </div>
            <div>
              <h1 className="text-white text-2xl font-black tracking-tight leading-none">SyscomPro</h1>
              <p className="text-blue-400/60 text-[10px] font-black uppercase tracking-[0.2em] mt-1">POS Cloud ERP</p>
            </div>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h2 className="text-5xl font-black text-white leading-[1.1] mb-8 tracking-tighter">
              Control total de tu <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">negocio</span> en tiempo real.
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed max-w-md">
              La plataforma más avanzada para la gestión de ventas multisede, conectada directamente a tu ERP oficial.
            </p>
          </motion.div>
        </div>

        <div className="relative z-10 grid grid-cols-2 gap-4">
          <div className="p-6 bg-white/5 border border-white/10 rounded-[2rem] backdrop-blur-sm">
            <ShieldCheck className="text-blue-400 w-10 h-10 mb-4" />
            <h4 className="text-white font-bold mb-1">Seguridad</h4>
            <p className="text-slate-500 text-xs">Encriptación de punto a punto en cada venta.</p>
          </div>
          <div className="p-6 bg-white/5 border border-white/10 rounded-[2rem] backdrop-blur-sm">
            <CheckCircle2 className="text-cyan-400 w-10 h-10 mb-4" />
            <h4 className="text-white font-bold mb-1">ERP Sinc</h4>
            <p className="text-slate-500 text-xs">Sincronización instantánea con tu sede central.</p>
          </div>
        </div>
      </div>

      {/* ── PANEL DERECHO: Login ── */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-24 relative">
        {/* Formas decorativas móviles */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full blur-[80px] opacity-50" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-50 rounded-full blur-[80px] opacity-50" />

        <div className="w-full max-w-[480px] relative z-10">
          
          <div className="mb-12">
            <h3 className="text-slate-400 font-black uppercase tracking-[0.3em] text-[10px] mb-4">Bienvenido de nuevo</h3>
            <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-2">
              {step === 1 ? 'Selecciona tu Empresa' : 'Inicia Sesión'}
            </h2>
            <p className="text-slate-500">
              {step === 1 ? 'Elige la empresa a la que deseas acceder hoy.' : `Ingresa tus credenciales para ${selectedCompany?.name}`}
            </p>
          </div>

          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.form 
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleNextStep}
                className="space-y-8"
              >
                <div className="space-y-4">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Empresa / Sede</label>
                  <div className="relative group">
                    <Building2 className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                    <select 
                      value={selectedCompany?.id || ''}
                      onChange={(e) => {
                        const comp = companies.find(c => c.id === parseInt(e.target.value));
                        setSelectedCompany(comp);
                      }}
                      className="w-full bg-white border-2 border-slate-100 focus:border-blue-500 rounded-[1.5rem] py-5 pl-16 pr-12 appearance-none outline-none transition-all font-bold text-slate-700 shadow-xl shadow-slate-200/40 cursor-pointer"
                    >
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.id.toString().padStart(2, '0')} - {c.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {error && (
                  <div className="bg-rose-50 text-rose-600 p-4 rounded-2xl border border-rose-100 flex items-center gap-3 text-sm font-bold">
                    <AlertCircle className="w-5 h-5" /> {error}
                  </div>
                )}

                <button 
                  type="submit"
                  className="w-full bg-slate-900 hover:bg-black text-white py-6 rounded-[1.5rem] font-black text-xl shadow-2xl shadow-slate-900/20 active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                  Continuar <ChevronDown className="w-6 h-6 -rotate-90" />
                </button>
              </motion.form>
            ) : (
              <motion.form 
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleLogin}
                className="space-y-6"
              >
                {/* Badge Empresa Seleccionada */}
                <div className="bg-blue-50 border border-blue-100 p-5 rounded-[1.5rem] flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Empresa Seleccionada</p>
                      <p className="font-bold text-slate-900">{selectedCompany?.name}</p>
                    </div>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setStep(1)}
                    className="text-xs font-black text-blue-600 hover:underline"
                  >
                    Cambiar
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="relative group">
                    <User className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                    <input 
                      type="text" 
                      required
                      placeholder="Usuario"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full bg-white border-2 border-slate-100 focus:border-blue-500 rounded-[1.5rem] py-5 pl-16 pr-6 outline-none transition-all font-bold text-slate-700 shadow-xl shadow-slate-200/40"
                    />
                  </div>
                  <div className="relative group">
                    <Lock className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                    <input 
                      type="password" 
                      required
                      placeholder="Contraseña"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-white border-2 border-slate-100 focus:border-blue-500 rounded-[1.5rem] py-5 pl-16 pr-6 outline-none transition-all font-bold text-slate-700 shadow-xl shadow-slate-200/40"
                    />
                  </div>
                </div>

                {error && (
                  <div className="bg-rose-50 text-rose-600 p-4 rounded-2xl border border-rose-100 flex items-center gap-3 text-sm font-bold">
                    <AlertCircle className="w-5 h-5" /> {error}
                  </div>
                )}

                <button 
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 rounded-[1.5rem] font-black text-xl shadow-2xl shadow-blue-600/30 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isLoading ? 'Verificando...' : 'Entrar al POS'}
                  {!isLoading && <ChevronDown className="w-6 h-6 -rotate-90" />}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          <div className="mt-12 flex items-center justify-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Conexión Segura v2.5</span>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        body { font-family: 'Plus Jakarta Sans', sans-serif; }
      `}</style>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInContent />
    </Suspense>
  );
}

const AlertCircle = ({ className }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
);
