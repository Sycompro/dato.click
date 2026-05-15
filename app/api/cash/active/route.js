import { NextResponse } from 'next/server';
import sql from 'mssql';
import { getConnection } from '@/lib/db';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        
        if (!session?.user?.company) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const pool = await getConnection(session.user.company);
        
        // 1. Obtener Tipo de Cambio del día (Venta)
        let exchangeRate = 1;
        try {
            const tcaRes = await pool.request()
                .query("SELECT TOP 1 tcvta FROM tbl01tca WHERE tcvta > 0 ORDER BY fecha DESC");
            
            if (tcaRes.recordset.length > 0 && tcaRes.recordset[0].tcvta > 0) {
                exchangeRate = tcaRes.recordset[0].tcvta;
                console.log(`[API/Cash/Active] TC obtenido de tbl01tca: ${exchangeRate}`);
            } else {
                console.warn("[API/Cash/Active] tbl01tca vacía o tcvta = 0, usando default: 1");
            }
        } catch (e) {
            console.error("[API/Cash/Active] Error consultando tbl01tca:", e.message);
        }

        // 2. Intentar con Esquema ERP (dtl_restpos_apecaj / tbl01pto)
        try {
            const sedeCode = session.user.sedeId?.toString().trim() || '01'; // codpto
            
            // Primero buscamos el ID de apertura actual validando que la sesión esté realmente abierta en dtl_restpos_apecaj
            const ptoRes = await pool.request()
                .input('codpto', sql.Char(6), sedeCode)
                .query(`
                    SELECT p.apecaj 
                    FROM tbl01pto p
                    INNER JOIN dtl_restpos_apecaj a ON p.apecaj = a.idapecaj
                    WHERE LTRIM(RTRIM(p.codpto)) = LTRIM(RTRIM(@codpto))
                      AND a.estado = 0
                `);
            
            let activeId = null;
            if (ptoRes.recordset.length > 0 && ptoRes.recordset[0].apecaj > 0) {
                activeId = ptoRes.recordset[0].apecaj;
            } else {
                // Fallback: Buscar la última abierta en dtl_restpos_apecaj para esta sede (por si no está vinculada en tbl01pto)
                const result = await pool.request()
                    .input('codpto', sql.Char(6), sedeCode)
                    .query("SELECT TOP 1 idapecaj as id FROM dtl_restpos_apecaj WHERE estado = 0 AND LTRIM(RTRIM(codpto)) = LTRIM(RTRIM(@codpto)) ORDER BY idapecaj DESC");
                
                if (result.recordset.length > 0) {
                    activeId = result.recordset[0].id;
                }
            }

            if (activeId) {
                return NextResponse.json({ 
                    id: activeId,
                    exchangeRate
                });
            }
        } catch (e) {
            console.error("[API/Cash/Active] Error buscando por sede:", e.message);
        }

        // 3. Intentar con Esquema POS (Caja)
        try {
            const result = await pool.request()
                .query("SELECT TOP 1 CajaId as id FROM Caja WHERE Vigente = 1 ORDER BY FechaApertura DESC");
            
            if (result.recordset.length > 0) {
                return NextResponse.json({ 
                    id: result.recordset[0].id,
                    exchangeRate
                });
            }
        } catch (e) {
            console.error("[API/Cash/Active] Ningún esquema de caja válido encontrado");
        }
        
        return NextResponse.json({ id: null, exchangeRate, message: 'No hay caja abierta' });

    } catch (err) {
        console.error('[API/Cash/Active] CRITICAL ERROR:', err.message);
        return NextResponse.json({ 
            error: 'Error en la base de datos', 
            details: err.message 
        }, { status: 500 });
    }
}
