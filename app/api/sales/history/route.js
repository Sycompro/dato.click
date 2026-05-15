import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import sql from 'mssql';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(request) {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(request.url);
    const idApeCaj = searchParams.get('idApeCaj');

    if (!idApeCaj) return NextResponse.json({ error: 'Falta idApeCaj' }, { status: 400 });

    try {
        const pool = await getConnection(session?.user?.company);
        
        // 1. Obtener detalles de la sesión de caja
        const sessionRes = await pool.request()
            .input('idApeCaj', sql.Int, idApeCaj)
            .query("SELECT TOP 1 fecape, hora, apesol FROM dtl_restpos_apecaj WHERE idapecaj = @idApeCaj");
        
        const sessionInfo = sessionRes.recordset[0] ? {
            openingDate: sessionRes.recordset[0].fecape,
            openingTime: sessionRes.recordset[0].hora,
            openingAmount: sessionRes.recordset[0].apesol
        } : null;

        // 2. Obtener lista de ventas
        const salesRes = await pool.request()
            .input('idApeCaj', sql.Int, idApeCaj)
            .query(`
                SELECT 
                    f.ndocu, f.cdocu, f.nomcli, f.ruccli, 
                    CAST(f.totn AS FLOAT) as tota, 
                    f.fecha, f.FecReg, f.flag, f.selpago, f.codven, f.codfdp,
                    CONVERT(VARCHAR(8), f.FecReg, 108) as hora_real,
                    CONVERT(VARCHAR(10), f.FecReg, 103) as fecha_real,
                    c.fecfinpres,
                    COALESCE(NULLIF(f.observ, ''), NULLIF(c.celcli, ''), NULLIF(c.telcli, ''), '') as phone
                FROM mst01fac f
                LEFT JOIN mst01cli c ON f.codcli = c.codcli
                WHERE f.idapecaj = @idApeCaj 
                ORDER BY f.FecReg DESC
            `);

        return NextResponse.json({
            sales: salesRes.recordset.map(s => ({
                ...s,
                status: (s.flag === '9' || s.flag === '*') ? 'ANULADO' : 'ACTIVO',
                paymentType: s.selpago === 1 ? 'EFECTIVO' : 'TARJETA'
            })),
            sessionInfo
        });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
