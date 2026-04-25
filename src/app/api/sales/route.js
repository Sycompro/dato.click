import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getConnection } from '../../../lib/db';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";

// Colores visuales para distinguir cada BD en el dashboard
const DB_COLORS = {
    'BdNava00': '#4880f5',
    'BdNava01': '#ec4899',
    'BdNava02': '#10b981',
    'BdNava03': '#7c5cfc',
    'BdNava04': '#6366f1',
    'BdNava05': '#f59e0b',
};

const ALL_DBS = ['BdNava00','BdNava01','BdNava02','BdNava03','BdNava04','BdNava05'];

// ============================================================
// Expresión SQL para convertir montos a Soles
// Si la moneda es 'D' (dólar), multiplica por tipo de cambio
// ============================================================
const NETO_SQL = `CASE WHEN f.mone = 'D' THEN f.totn * f.tcam ELSE f.totn END`;
const IGV_SQL  = `CASE WHEN f.mone = 'D' THEN f.toti * f.tcam ELSE f.toti END`;

export async function GET(request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ success: false, error: 'Acceso Denegado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const ids = searchParams.get('ids');
    const period = searchParams.get('period') || 'monthly'; // daily, weekly, monthly, annual
    const year = parseInt(searchParams.get('year')) || new Date().getFullYear();
    const month = parseInt(searchParams.get('month')) || (new Date().getMonth() + 1);
    const exactDate = searchParams.get('exactDate'); // 'YYYY-MM-DD'
    const weekStr = searchParams.get('weekStr'); // 'YYYY-Wxx'

    let dbList = ids ? ids.split(',').filter(id => id.match(/^BdNava0[0-5]$/)) : ALL_DBS;

    try {
        const results = [];

        for (const dbId of dbList) {
            const pool = await getConnection(dbId);

            // ============ NOMBRE REAL DE LA EMPRESA (desde el ERP) ============
            let companyName = dbId;
            let companyRuc = '';
            try {
                const emisor = await pool.request().query(
                    `SELECT TOP 1 RTRIM(nomcia) as nomcia, RTRIM(ruccia) as ruccia FROM tbl_enavasoft_emisor`
                );
                if (emisor.recordset.length > 0) {
                    companyName = emisor.recordset[0].nomcia || dbId;
                    companyRuc = emisor.recordset[0].ruccia || '';
                }
            } catch(e) {
                // Si no existe la tabla, usar el nombre de la BD
            }
            const color = DB_COLORS[dbId] || '#4880f5';

            // ============================================================
            // Filtro de fecha aplicado a TODAS las consultas
            // ============================================================
            let dateFilter = '';
            if (period === 'daily' && exactDate) {
                dateFilter = `AND f.fecha >= '${exactDate} 00:00:00' AND f.fecha <= '${exactDate} 23:59:59'`;
            } else if (period === 'hourly') {
                // Lógica Diferente: El filtro de fecha depende de si hay un día exacto o un mes/año
                if (exactDate) {
                    dateFilter = `AND f.fecha >= '${exactDate} 00:00:00' AND f.fecha <= '${exactDate} 23:59:59'`;
                } else if (month) {
                    dateFilter = `AND YEAR(f.fecha) = ${year} AND MONTH(f.fecha) = ${month}`;
                } else {
                    dateFilter = `AND YEAR(f.fecha) = ${year}`;
                }
            } else if (period === 'weekly' && weekStr) {
                const wYear = parseInt(weekStr.split('-W')[0]);
                const wNum = parseInt(weekStr.split('-W')[1]);
                dateFilter = `AND YEAR(f.fecha) = ${wYear} AND DATEPART(ISOWK, f.fecha) = ${wNum}`;
            } else if (period === 'monthly') {
                dateFilter = `AND YEAR(f.fecha) = ${year} AND MONTH(f.fecha) = ${month}`;
            } else if (period === 'annual') {
                dateFilter = `AND YEAR(f.fecha) = ${year}`;
            } else {
                dateFilter = `AND YEAR(f.fecha) = ${year}`; // Fallback safe
            }

            // FIX #1: Flag correcto — solo documentos válidos (flag='0')
            // FIX #3: Facturas (01), Boletas (03) y Notas de Venta (65)
            const baseWhere = `WHERE f.flag = '0' AND RTRIM(f.cdocu) IN ('01','03','65') ${dateFilter}`;

            // ============ KPIs ============
            // FIX #2: Conversión de moneda — dólares a soles
            const kpi = await pool.request().query(`
                SELECT COUNT(*) as ops, 
                    ISNULL(SUM(${NETO_SQL}),0) as neto,
                    ISNULL(SUM(${IGV_SQL}),0) as igv, 
                    ISNULL(AVG(${NETO_SQL}),0) as ticket
                FROM mst01fac f ${baseWhere}
            `);

            // ============ DESGLOSE POR TIPO DE DOCUMENTO ============
            const docTypes = await pool.request().query(`
                SELECT 
                    RTRIM(f.cdocu) as codigo,
                    CASE RTRIM(f.cdocu)
                        WHEN '01' THEN 'Facturas'
                        WHEN '03' THEN 'Boletas'
                        WHEN '65' THEN 'Notas Venta'
                        ELSE 'Otros (' + RTRIM(f.cdocu) + ')'
                    END as tipo,
                    COUNT(*) as cantidad,
                    ISNULL(SUM(${NETO_SQL}),0) as total
                FROM mst01fac f ${baseWhere}
                GROUP BY f.cdocu
                ORDER BY cantidad DESC
            `);

            // ============ TREND ============
            let trendQuery = '';
            if (period === 'hourly') {
                const totalNetoQuery = await pool.request().query(`SELECT ISNULL(SUM(${NETO_SQL}),0) as total FROM mst01fac f ${baseWhere}`);
                const globalTotal = totalNetoQuery.recordset[0].total || 1;

                trendQuery = `
                    SELECT 
                        DATEPART(HOUR, f.FecReg) as periodo,
                        CAST(DATEPART(HOUR, f.FecReg) AS VARCHAR) + ':00' as label,
                        COUNT(*) as ops, 
                        ISNULL(SUM(${NETO_SQL}),0) as neto,
                        ISNULL(AVG(${NETO_SQL}),0) as ticket,
                        (ISNULL(SUM(${NETO_SQL}),0) / CAST(${globalTotal} AS FLOAT) * 100.0) as participation
                    FROM mst01fac f ${baseWhere}
                    GROUP BY DATEPART(HOUR, f.FecReg) ORDER BY periodo
                `;
            } else if (period === 'daily') {
                trendQuery = `
                    SELECT DATEPART(HOUR, f.FecReg) as periodo,
                        CAST(DATEPART(HOUR, f.FecReg) AS VARCHAR) + ':00' as label,
                        COUNT(*) as ops, ISNULL(SUM(${NETO_SQL}),0) as neto
                    FROM mst01fac f ${baseWhere}
                    GROUP BY DATEPART(HOUR, f.FecReg) ORDER BY periodo
                `;
            } else if (period === 'weekly') {
                trendQuery = `
                    SELECT DATEPART(WEEKDAY, f.fecha) as periodo,
                        DATENAME(WEEKDAY, f.fecha) as label,
                        COUNT(*) as ops, ISNULL(SUM(${NETO_SQL}),0) as neto
                    FROM mst01fac f ${baseWhere}
                    GROUP BY DATEPART(WEEKDAY, f.fecha), DATENAME(WEEKDAY, f.fecha)
                    ORDER BY periodo
                `;
            } else if (period === 'monthly') {
                trendQuery = `
                    SELECT DAY(f.fecha) as periodo,
                        CAST(DAY(f.fecha) AS VARCHAR) as label,
                        COUNT(*) as ops, ISNULL(SUM(${NETO_SQL}),0) as neto
                    FROM mst01fac f ${baseWhere}
                    GROUP BY DAY(f.fecha) ORDER BY periodo
                `;
            } else if (period === 'annual') {
                trendQuery = `
                    SELECT MONTH(f.fecha) as periodo,
                        DATENAME(MONTH, CONCAT('2000-', MONTH(f.fecha), '-01')) as label,
                        COUNT(*) as ops, ISNULL(SUM(${NETO_SQL}),0) as neto
                    FROM mst01fac f ${baseWhere}
                    GROUP BY MONTH(f.fecha) ORDER BY periodo
                `;
            }
            const trend = await pool.request().query(trendQuery);

            // ============ TOP VENDEDORES ============
            const topVend = await pool.request().query(`
                SELECT TOP 10 RTRIM(v.nomven) as nom, SUM(${NETO_SQL}) as total, COUNT(*) as ops
                FROM mst01fac f INNER JOIN tbl01ven v ON RTRIM(f.codven)=RTRIM(v.codven)
                ${baseWhere}
                GROUP BY v.nomven ORDER BY total DESC
            `);

            // ============ VENTAS POR SEDE ============
            // Usamos la cadena: mst01fac.Codpto -> tbl01pto.codtie -> tbl_tienda.nomtie
            // Esto agrupa por tienda real (varios puntos de venta pueden pertenecer a la misma tienda)
            const bySede = await pool.request().query(`
                SELECT RTRIM(t.nomtie) as sede, 
                    SUM(${NETO_SQL}) as total, COUNT(*) as ops
                FROM mst01fac f 
                INNER JOIN tbl01pto p ON RTRIM(f.Codpto) = RTRIM(p.codpto)
                INNER JOIN tbl_tienda t ON RTRIM(p.codtie) = RTRIM(t.codtie)
                ${baseWhere}
                GROUP BY t.nomtie ORDER BY total DESC
            `);

            const sedesCorregidas = bySede.recordset;


            // ============ PERIODO ANTERIOR ============
            let prevKpi = { neto: 0, ops: 0 };
            try {
                let prevFilter = '';
                if (period === 'daily') {
                    const pm = month === 1 ? 12 : month - 1;
                    const py = month === 1 ? year - 1 : year;
                    prevFilter = `AND YEAR(f.fecha) = ${py} AND MONTH(f.fecha) = ${pm}`;
                } else if (period === 'weekly') {
                    const pm = month === 1 ? 12 : month - 1;
                    const py = month === 1 ? year - 1 : year;
                    prevFilter = `AND YEAR(f.fecha) = ${py} AND MONTH(f.fecha) = ${pm}`;
                } else if (period === 'monthly') {
                    const pm = month === 1 ? 12 : month - 1;
                    const py = month === 1 ? year - 1 : year;
                    prevFilter = `AND YEAR(f.fecha) = ${py} AND MONTH(f.fecha) = ${pm}`;
                } else {
                    prevFilter = `AND YEAR(f.fecha) = ${year - 1}`;
                }
                const prev = await pool.request().query(`
                    SELECT COUNT(*) as ops, ISNULL(SUM(${NETO_SQL}),0) as neto
                    FROM mst01fac f WHERE f.flag = '0' AND RTRIM(f.cdocu) IN ('01','03') ${prevFilter}
                `);
                prevKpi = prev.recordset[0];
            } catch(e) {}

            const growth = prevKpi.neto > 0
                ? ((kpi.recordset[0].neto - prevKpi.neto) / prevKpi.neto * 100).toFixed(1) : 0;

            const years = await pool.request().query(`
                SELECT DISTINCT YEAR(fecha) as y FROM mst01fac WHERE fecha IS NOT NULL ORDER BY y DESC
            `);

            results.push({
                id: dbId, name: companyName, color: color, ruc: companyRuc,
                kpi: kpi.recordset[0], growth: parseFloat(growth), prevKpi,
                trend: trend.recordset, topVendedores: topVend.recordset,
                ventasPorSede: sedesCorregidas,
                docTypes: docTypes.recordset,
                availableYears: years.recordset.map(r => r.y),
            });
        }
        return NextResponse.json({ success: true, data: results });
    } catch (error) {
        console.error("Sales API Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
