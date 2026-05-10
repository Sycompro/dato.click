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

        // 1. Datos de Apertura y Empresa
        const headerRes = await pool.request()
            .input('id', sql.Int, idapecaj)
            .query(`
                SELECT a.apesol, a.fecape, a.hora, a.codusu, a.codpto, a.nropla,
                       (SELECT TOP 1 RazonSocial FROM Empresa) as nomemp,
                       (SELECT TOP 1 Ruc FROM Empresa) as rucemp,
                       (SELECT TOP 1 Direccion FROM Empresa) as diremp
                FROM dtl_restpos_apecaj a
                WHERE a.idapecaj = @id
            `);
        
        const header = headerRes.recordset[0];
        if (!header) return NextResponse.json({ success: false, error: 'Sesión no encontrada' }, { status: 404 });

        // 2. Desglose de Ventas por Condición (Contado vs Crédito)
        const condRes = await pool.request()
            .input('id', sql.Int, idapecaj)
            .query(`
                SELECT 
                    CASE WHEN LTRIM(RTRIM(codcdv)) = '02' THEN 'Crédito' ELSE 'Contado' END as condicion,
                    SUM(totn) as total,
                    COUNT(*) as cantidad
                FROM mst01fac 
                WHERE idapecaj = @id AND flag <> '*'
                GROUP BY codcdv
            `);

        // 3. Desglose de Pagos (Sección 2 del reporte)
        const paymentsRes = await pool.request()
            .input('id', sql.Int, idapecaj)
            .query(`
                SELECT method, SUM(total) as total
                FROM (
                    -- 1. Pagos desde Cobranza Mixta (incluyendo efectivo 'NS')
                    SELECT 
                        CASE WHEN c.codtar = 'NS' THEN 'EFECTIVO' ELSE ISNULL(t.nomtar, 'OTROS') END as method,
                        SUM(c.recib) as total
                    FROM dtl_restpos_cobmixta c
                    LEFT JOIN tbl01tar t ON c.codtar = t.codtar
                    INNER JOIN mst01fac f ON c.ndocu = f.ndocu AND c.cdocu = f.cdocu
                    WHERE f.idapecaj = @id AND f.flag <> '*'
                    GROUP BY c.codtar, t.nomtar
                    
                    UNION ALL

                    -- 2. Pagos de ventas SIMPLES (no mixtas)
                    SELECT 
                        CASE WHEN ISNULL(f.codtar, '') = '' THEN 'EFECTIVO' ELSE ISNULL(t.nomtar, 'OTROS') END as method,
                        SUM(f.totn) as total
                    FROM mst01fac f
                    LEFT JOIN tbl01tar t ON f.codtar = t.codtar
                    WHERE f.idapecaj = @id AND f.flag <> '*' AND f.cobmixta = 0
                    GROUP BY f.codtar, t.nomtar
                ) AS ResumenPagos
                GROUP BY method
                HAVING SUM(total) > 0
            `);

        // 4. Conteo de Documentos (Sección Docs Emitidos)
        const docsRes = await pool.request()
            .input('id', sql.Int, idapecaj)
            .query(`
                SELECT 
                    f.cdocu,
                    ISNULL(d.nomdoc, 'OTROS') as docName,
                    COUNT(*) as quantity,
                    MIN(f.ndocu) as rangeStart,
                    MAX(f.ndocu) as rangeEnd,
                    SUM(f.totn) as total
                FROM mst01fac f
                LEFT JOIN tbl01doc d ON f.cdocu = d.cdocu
                WHERE f.idapecaj = @id AND f.flag <> '*'
                GROUP BY f.cdocu, d.nomdoc
            `);

        // 5. Anulados
        const nullRes = await pool.request()
            .input('id', sql.Int, idapecaj)
            .query(`
                SELECT COUNT(*) as quantity, ISNULL(SUM(totn), 0) as total 
                FROM mst01fac 
                WHERE idapecaj = @id AND flag = '*'
            `);

        // 6. Venta por Líneas con Porcentajes
        const totalVta = condRes.recordset.reduce((acc, curr) => acc + curr.total, 0);
        const linesRes = await pool.request()
            .input('id', sql.Int, idapecaj)
            .query(`
                SELECT 
                    ISNULL(fam.nomsub, 'OTROS') as category,
                    SUM(d.totn) as total,
                    COUNT(*) as itemsSold
                FROM dtl01fac d
                INNER JOIN mst01fac m ON d.ndocu = m.ndocu AND d.cdocu = m.cdocu
                LEFT JOIN prd0101 p ON d.codi = p.codi
                LEFT JOIN tbl01sbf fam ON LTRIM(RTRIM(fam.codsub)) = LEFT(p.codi, 2) + '-' + LTRIM(RTRIM(p.codcat))
                WHERE m.idapecaj = @id AND m.flag <> '*'
                GROUP BY fam.nomsub
            `);
        
        const lineBreakdown = linesRes.recordset.map(l => ({
            ...l,
            percentage: totalVta > 0 ? (l.total / totalVta) * 100 : 0
        }));

        // 7. Egresos
        const expRes = await pool.request()
            .input('id', sql.Int, idapecaj)
            .query('SELECT ISNULL(SUM(monto), 0) as total FROM dtl_restpos_egrcaja WHERE idapecaj = @id');
        const totalExpenses = expRes.recordset[0].total;

        // 8. Cálculos Finales de Arqueo (Paridad con Reporte ERP)
        const totalCashCollected = paymentsRes.recordset
            .filter(p => p.method === 'EFECTIVO')
            .reduce((acc, curr) => acc + curr.total, 0);
        
        const totalDigitalCollected = paymentsRes.recordset
            .filter(p => p.method !== 'EFECTIVO')
            .reduce((acc, curr) => acc + curr.total, 0);

        const finalCashBalance = header.apesol + totalCashCollected - totalExpenses;

        return NextResponse.json({
            success: true,
            summary: {
                header: {
                    company: header.nomemp,
                    ruc: header.rucemp,
                    address: header.diremp,
                    pointOfSale: header.codpto,
                    user: header.codusu,
                    date: header.fecape,
                    hour: header.hora,
                    nropla: header.nropla
                },
                liquidation: condRes.recordset,
                payments: paymentsRes.recordset,
                documents: docsRes.recordset,
                nullified: nullRes.recordset[0],
                lines: lineBreakdown,
                opening: header.apesol,
                expenses: totalExpenses,
                totalSales: totalVta,
                totals: {
                    cashCollected: totalCashCollected,
                    digitalCollected: totalDigitalCollected,
                    finalCashBalance: finalCashBalance
                }
            }
        });

    } catch (error) {
        console.error('[API/CashSummary] Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
