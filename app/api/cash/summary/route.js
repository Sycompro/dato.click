import { NextResponse } from 'next/server';
import sql from 'mssql';
import { getConnection } from '@/lib/db';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const idapecaj = searchParams.get('idapecaj');

        if (!idapecaj) {
            return NextResponse.json({ success: false, error: 'ID de apertura requerido' }, { status: 400 });
        }

        const session = await getServerSession(authOptions);
        const pool = await getConnection(session?.user?.company);

        // 1. Obtener Monto Inicial
        const openingRes = await pool.request()
            .input('id', sql.Int, idapecaj)
            .query('SELECT apesol, fecape, hora, codusu FROM dtl_restpos_apecaj WHERE idapecaj = @id');
        
        const openingData = openingRes.recordset[0];
        if (!openingData) return NextResponse.json({ success: false, error: 'Sesión no encontrada' }, { status: 404 });

        // 2. Obtener Ventas por Medio de Pago (Desglose Mixto + Simples)
        // Nota: Las ventas mixtas y digitales están en dtl_restpos_cobmixta. 
        // Las de efectivo puro (selpago=1) que no se desglosaron están en mst01fac.
        
        const salesSummary = await pool.request()
            .input('id', sql.Int, idapecaj)
            .query(`
                SELECT 
                    'Digital/Mixto' as method,
                    c.codtar,
                    SUM(c.totn) as total
                FROM dtl_restpos_cobmixta c
                INNER JOIN mst01fac f ON c.ndocu = f.ndocu AND c.cdocu = f.cdocu
                WHERE f.idapecaj = @id
                GROUP BY c.codtar
                
                UNION ALL
                
                SELECT 
                    'Efectivo' as method,
                    'NS' as codtar,
                    SUM(totn) as total
                FROM mst01fac
                WHERE idapecaj = @id AND selpago = 1 AND NOT EXISTS (
                    SELECT 1 FROM dtl_restpos_cobmixta WHERE ndocu = mst01fac.ndocu AND cdocu = mst01fac.cdocu
                )
                GROUP BY selpago
            `);

        // 3. Obtener Egresos (Gastos)
        const expensesRes = await pool.request()
            .input('id', sql.Int, idapecaj)
            .query('SELECT SUM(monto) as total FROM dtl_restpos_egrcaja WHERE idapecaj = @id');
        
        const totalExpenses = expensesRes.recordset[0]?.total || 0;

        // 4. Calcular Saldo Final Esperado (Solo Efectivo + Apertura - Gastos)
        const cashSales = salesSummary.recordset.find(s => s.method === 'Efectivo')?.total || 0;
        const expectedCash = (openingData.apesol + cashSales) - totalExpenses;
        const totalSales = salesSummary.recordset.reduce((acc, curr) => acc + curr.total, 0);

        return NextResponse.json({
            success: true,
            summary: {
                opening: openingData.apesol,
                salesBreakdown: salesSummary.recordset,
                expenses: totalExpenses,
                expectedFinal: expectedCash,
                totalSales
            }
        });

    } catch (error) {
        console.error('Error in cash summary API:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
