import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import sql from 'mssql';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(request) {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    let sede = searchParams.get('sede') || '';
    const status = searchParams.get('status') || 'all';

    // Si el filtro es "my", usamos la sede de la sesión
    if (sede === 'my' && session?.user?.sedeId) {
        sede = session.user.sedeId;
    }

    try {
        const pool = await getConnection(session?.user?.company);
        
        // Consulta compleja para traer clientes con sus fechas y el nombre del último producto (Plan) comprado
        // que tenga configurados días de membresía (Usr_003)
        let sqlQuery = `
            SELECT 
                RTRIM(c.codcli) as id,
                RTRIM(c.nomcli) as name,
                RTRIM(c.celcli) as phone,
                CONVERT(varchar, c.fecinipres, 23) as startDate,
                CONVERT(varchar, c.fecfinpres, 23) as endDate,
                ISNULL(RTRIM(pun.nompto), 'SEDE 01') as sede,
                ISNULL(RTRIM(tie.DirTie), RTRIM(c.dircli)) as address,
                (
                    SELECT TOP 1 RTRIM(d.descr)
                    FROM dtl01fac d
                    JOIN prd0101 p ON d.codi = p.codi
                    WHERE d.codcli = c.codcli AND ISNUMERIC(p.Usr_003) = 1 AND CAST(p.Usr_003 as int) > 0
                    ORDER BY d.fecha DESC
                ) as planName,
                (
                    SELECT TOP 1 d.totn
                    FROM dtl01fac d
                    JOIN prd0101 p ON d.codi = p.codi
                    WHERE d.codcli = c.codcli AND ISNUMERIC(p.Usr_003) = 1 AND CAST(p.Usr_003 as int) > 0
                    ORDER BY d.fecha DESC
                ) as price,
                h.cnt as historyCount
            FROM mst01cli c
            OUTER APPLY (
                SELECT TOP 1 f.Codpto
                FROM mst01fac f
                JOIN dtl01fac d ON f.cdocu = d.cdocu AND f.ndocu = d.ndocu
                JOIN prd0101 pr ON d.codi = pr.codi
                WHERE f.codcli = c.codcli AND ISNUMERIC(pr.Usr_003) = 1 AND CAST(pr.Usr_003 as int) > 0
                ORDER BY f.fecha DESC
            ) lastSede
            LEFT JOIN tbl01pto pun ON lastSede.Codpto = pun.codpto
            LEFT JOIN tbl_tienda tie ON pun.codtie = tie.codtie AND pun.codsuc = tie.codsuc
            OUTER APPLY (
                SELECT COUNT(*) as cnt
                FROM dtl01fac d2
                JOIN prd0101 p2 ON d2.codi = p2.codi
                WHERE d2.codcli = c.codcli AND ISNUMERIC(p2.Usr_003) = 1 AND CAST(p2.Usr_003 as int) > 0
            ) h
            WHERE (c.nomcli LIKE @query OR c.codcli LIKE @query OR c.celcli LIKE @query)
        `;

        if (sede && sede !== 'all') {
            sqlQuery += " AND lastSede.Codpto = @sede";
        }

        const requestSql = pool.request().input('query', sql.VarChar(100), `%${query}%`);
        if (sede && sede !== 'all') requestSql.input('sede', sql.Char(10), sede);

        const result = await requestSql.query(sqlQuery);

        const getPeruTime = () => {
            const n = new Date();
            return new Date(n.toLocaleString("en-US", {timeZone: "America/Lima"}));
        };

        const now = getPeruTime();
        now.setHours(0,0,0,0);
        
            const in3Days = new Date(now);
            in3Days.setDate(now.getDate() + 3);
            
            const in7Days = new Date(now);
            in7Days.setDate(now.getDate() + 7);

            const data = result.recordset.map(r => {
                let expDate = null;
                if (r.endDate && r.endDate !== '1900-01-01') {
                    const [y, m, d] = r.endDate.split('-').map(Number);
                    expDate = new Date(y, m - 1, d);
                }

                let statusValue = 'Vencido';
                
                if (expDate) {
                    if (expDate < now) statusValue = 'Vencido';
                    else if (expDate <= in3Days) statusValue = 'Por vencer'; // Naranja (3 días)
                    else if (expDate <= in7Days) statusValue = 'Próximo';    // Amarillo (7 días)
                    else statusValue = 'Activo';                            // Verde
                }

            return {
                ...r,
                status: statusValue,
                daysLeft: expDate ? Math.ceil((expDate - now) / (1000 * 60 * 60 * 24)) : 0
            };
        });

        // Ordenar por prioridad: Próximo (Amarillo) -> Por vencer (Naranja) -> Activo (Verde) -> Vencido (Rojo)
        const priority = { 'Próximo': 1, 'Por vencer': 2, 'Activo': 3, 'Vencido': 4 };
        data.sort((a, b) => priority[a.status] - priority[b.status]);

        // Filtrar por estado si es necesario
        const filteredData = status === 'all' ? data : 
                             status === 'por vencer' ? data.filter(d => d.status === 'Por vencer' || d.status === 'Próximo') :
                             data.filter(d => d.status.toLowerCase() === status.toLowerCase());

        // Calcular estadísticas
        const stats = {
            total: data.length,
            active: data.filter(d => d.status === 'Activo').length,
            expiring: data.filter(d => d.status === 'Por vencer' || d.status === 'Próximo').length,
            expired: data.filter(d => d.status === 'Vencido').length
        };

        return NextResponse.json({ members: filteredData, stats });

    } catch (err) {
        console.error('Memberships fetch error:', err);
        return NextResponse.json({ error: 'Error al obtener membresías' }, { status: 500 });
    }
}
