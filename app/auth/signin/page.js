'use client';

import { useState } from 'react';
import { Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2, User, Lock, ArrowRight, AlertCircle, Loader2, KeyRound, CheckCircle2 } from 'lucide-react';

function SignInContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get('callbackUrl') || '/pos';
    
    const [step, setStep] = useState(1); // 1 = código empresa, 2 = usuario/contraseña
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [code, setCode] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const handleVerifyCode = (e) => {
        e.preventDefault();
        if (!code.trim()) {
            setError('El código de empresa es obligatorio');
            return;
        }
        setError('');
        setStep(2);
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const result = await signIn('credentials', {
                code: code.trim(),
                username: username.trim(),
                password: password.trim(),
                redirect: false,
                callbackUrl
            });

            if (result?.error) {
                setError('Código, usuario o contraseña incorrectos');
                setIsLoading(false);
            } else {
                router.push(callbackUrl);
                router.refresh();
            }
        } catch (err) {
            setError('Ocurrió un error de conexión');
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full max-w-md p-8 relative z-10">
            <div className="bg-[#1a1a1a]/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl shadow-black/50">
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-purple-600 mb-6 shadow-lg shadow-blue-600/20">
                        <Building2 className="text-white w-8 h-8" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Acceso POS</h1>
                    <p className="text-gray-400">
                        {step === 1 ? 'Ingresa el código de tu empresa' : 'Ingresa tus credenciales de sede'}
                    </p>
                </div>

                {/* Indicador de pasos */}
                <div className="flex items-center justify-center gap-3 mb-8">
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${step >= 1 ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-slate-500'}`}>
                        <KeyRound className="w-3 h-3" /> Empresa
                    </div>
                    <div className="w-6 h-px bg-white/10" />
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${step >= 2 ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-slate-500'}`}>
                        <User className="w-3 h-3" /> Acceso
                    </div>
                </div>

                {step === 1 ? (
                    <form onSubmit={handleVerifyCode} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-400 ml-1">Código de Empresa</label>
                            <div className="relative group">
                                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
                                <input
                                    type="text"
                                    required
                                    autoFocus
                                    placeholder="Ej: gimobile24"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 text-white rounded-2xl py-3.5 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all placeholder:text-gray-600"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 text-red-400 bg-red-400/10 border border-red-400/20 p-3 rounded-xl text-sm">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold py-4 rounded-2xl transition-all shadow-lg shadow-blue-600/25 active:scale-[0.98] flex items-center justify-center gap-2 group mt-4"
                        >
                            Verificar Empresa
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleLogin} className="space-y-5">
                        {/* Empresa verificada */}
                        <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                            <div className="flex-1">
                                <p className="text-xs text-emerald-400 font-bold uppercase">Empresa</p>
                                <p className="text-sm text-white font-medium">{code}</p>
                            </div>
                            <button 
                                type="button" 
                                onClick={() => { setStep(1); setError(''); }}
                                className="text-xs text-slate-400 hover:text-white transition-colors"
                            >
                                Cambiar
                            </button>
                        </div>

                        {/* Usuario */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-400 ml-1">Usuario</label>
                            <div className="relative group">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
                                <input
                                    type="text"
                                    required
                                    autoFocus
                                    placeholder="Ingresa tu usuario"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 text-white rounded-2xl py-3.5 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all placeholder:text-gray-600"
                                />
                            </div>
                        </div>

                        {/* Contraseña */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-400 ml-1">Contraseña</label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
                                <input
                                    type="password"
                                    required
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 text-white rounded-2xl py-3.5 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all placeholder:text-gray-600"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 text-red-400 bg-red-400/10 border border-red-400/20 p-3 rounded-xl text-sm">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold py-4 rounded-2xl transition-all shadow-lg shadow-blue-600/25 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group mt-4"
                        >
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    Ingresar al POS
                                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>
                )}

                <div className="mt-8 pt-8 border-t border-white/5 text-center">
                    <p className="text-xs text-gray-500 uppercase tracking-widest font-medium">Syscom Pro Ventas v2.0</p>
                </div>
            </div>
        </div>
    );
}

export default function SignInPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] relative overflow-hidden">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 blur-[120px] rounded-full" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 blur-[120px] rounded-full" />
            
            <Suspense fallback={<div className="text-white relative z-10 flex flex-col items-center"><Loader2 className="w-8 h-8 animate-spin mb-4" />Cargando...</div>}>
                <SignInContent />
            </Suspense>
        </div>
    );
}
