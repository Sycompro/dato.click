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

        // 1. Datos de Apertura
        const openingRes = await pool.request()
            .input('id', sql.Int, idapecaj)
            .query('SELECT apesol, fecape, hora, codusu, codpto FROM dtl_restpos_apecaj WHERE idapecaj = @id');
        
        const openingData = openingRes.recordset[0];
        if (!openingData) return NextResponse.json({ success: false, error: 'Sesión no encontrada' }, { status: 404 });

        // 2. Desglose de Pagos Dinámico (JOIN con tbl01tar)
        const salesSummary = await pool.request()
            .input('id', sql.Int, idapecaj)
            .query(`
                -- Pagos Mixtos y Digitales
                SELECT 
                    ISNULL(t.nomtar, 'OTROS') as method,
                    c.codtar,
                    SUM(c.totn) as total,
                    COUNT(DISTINCT c.ndocu) as count
                FROM dtl_restpos_cobmixta c
                LEFT JOIN tbl01tar t ON c.codtar = t.codtar
                INNER JOIN mst01fac f ON c.ndocu = f.ndocu AND c.cdocu = f.cdocu
                WHERE f.idapecaj = @id AND c.codtar <> 'NS'
                GROUP BY c.codtar, t.nomtar
                
                UNION ALL
                
                -- Efectivo (Puro + Parte de Mixtos)
                SELECT 
                    'EFECTIVO' as method,
                    '01' as codtar,
                    SUM(monto) as total,
                    SUM(cant) as count
                FROM (
                    -- Efectivo Puro
                    SELECT SUM(totn) as monto, COUNT(*) as cant
                    FROM mst01fac
                    WHERE idapecaj = @id AND selpago = 1 AND NOT EXISTS (
                        SELECT 1 FROM dtl_restpos_cobmixta WHERE ndocu = mst01fac.ndocu AND cdocu = mst01fac.cdocu
                    )
                    UNION ALL
                    -- Parte efectivo de cobros mixtos
                    SELECT SUM(c.totn) as monto, COUNT(*) as cant
                    FROM dtl_restpos_cobmixta c
                    INNER JOIN mst01fac f ON c.ndocu = f.ndocu AND c.cdocu = f.cdocu
                    WHERE f.idapecaj = @id AND c.codtar = 'NS'
                ) as CashData
                HAVING SUM(monto) > 0
            `);

        // 3. Conteo de Documentos Emitidos
        const docBreakdown = await pool.request()
            .input('id', sql.Int, idapecaj)
            .query(`
                SELECT 
                    cdocu,
                    CASE 
                        WHEN cdocu = '01' THEN 'FACTURA'
                        WHEN cdocu = '03' THEN 'BOLETA'
                        WHEN cdocu = '65' THEN 'NOTA DE VENTA'
                        ELSE 'OTROS'
                    END as docName,
                    COUNT(*) as quantity,
                    MIN(ndocu) as rangeStart,
                    MAX(ndocu) as rangeEnd,
                    SUM(totn) as total
                FROM mst01fac
                WHERE idapecaj = @id
                GROUP BY cdocu
            `);

        // 4. Venta por Líneas/Familias (Categorías)
        const lineBreakdown = await pool.request()
            .input('id', sql.Int, idapecaj)
            .query(`
                SELECT 
                    ISNULL(fam.nomfam, 'SIN CATEGORIA') as category,
                    SUM(d.totn) as total,
                    COUNT(*) as itemsSold
                FROM dtl01fac d
                INNER JOIN mst01fac m ON d.ndocu = m.ndocu AND d.cdocu = m.cdocu
                LEFT JOIN prd0101 p ON d.codi = p.codi
                LEFT JOIN tbl01fam fam ON p.codcat = fam.codfam
                WHERE m.idapecaj = @id
                GROUP BY fam.nomfam
            `);

        // 5. Egresos
        const expensesRes = await pool.request()
            .input('id', sql.Int, idapecaj)
            .query('SELECT ISNULL(SUM(monto), 0) as total FROM dtl_restpos_egrcaja WHERE idapecaj = @id');
        
        const totalExpenses = expensesRes.recordset[0]?.total || 0;

        // 6. Cálculo Final
        const cashRow = salesSummary.recordset.find(s => s.method === 'EFECTIVO');
        const cashSales = cashRow ? cashRow.total : 0;
        const expectedCash = (openingData.apesol + cashSales) - totalExpenses;
        const totalSales = salesSummary.recordset.reduce((acc, curr) => acc + curr.total, 0);

        return NextResponse.json({
            success: true,
            summary: {
                opening: openingData.apesol,
                openingDate: openingData.fecape,
                openingHour: openingData.hora,
                user: openingData.codusu,
                pointOfSale: openingData.codpto,
                salesBreakdown: salesSummary.recordset,
                docBreakdown: docBreakdown.recordset,
                lineBreakdown: lineBreakdown.recordset,
                expenses: totalExpenses,
                expectedFinal: expectedCash,
                totalSales
            }
        });

    } catch (error) {
        console.error('[API/CashSummary] Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
