import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import sql from 'mssql';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(request) {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(request.url);
    const codcli = searchParams.get('codcli');

    if (!codcli) return NextResponse.json({ error: 'Falta codcli' }, { status: 400 });

    try {
        const pool = await getConnection(session?.user?.company);
        
        // Buscamos todas las ventas de este cliente que contengan productos de membresía
        const result = await pool.request()
            .input('codcli', sql.Char(10), codcli)
            .query(`
                SELECT 
                    f.ndocu as document,
                    CONVERT(varchar, f.fecha, 23) as date,
                    RTRIM(d.descr) as planName,
                    d.totn as price,
                    f.cdocu as docType
                FROM dtl01fac d
                JOIN mst01fac f ON d.ndocu = f.ndocu AND d.cdocu = f.cdocu
                JOIN prd0101 p ON d.codi = p.codi
                WHERE d.codcli = @codcli 
                  AND ISNUMERIC(p.Usr_003) = 1 
                  AND CAST(p.Usr_003 as int) > 0
                ORDER BY f.fecha DESC, f.FecReg DESC
            `);

        return NextResponse.json(result.recordset);
    } catch (err) {
        console.error('History fetch error:', err);
        return NextResponse.json({ error: 'Error al obtener historial' }, { status: 500 });
    }
}
