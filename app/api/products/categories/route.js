import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    try {
        const pool = await getConnection(session.user.company);
        
        // Intentar primero categorías marcadas para POS (Compatible con CHAR e INT)
        let result = await pool.request().query(`
            SELECT DISTINCT 
                LTRIM(RTRIM(codsub)) as id, 
                LTRIM(RTRIM(nomsub)) as name 
            FROM tbl01sbf 
            WHERE LTRIM(RTRIM(CAST(restpos AS VARCHAR))) IN ('S', '1')
            ORDER BY name ASC
        `);

        // Si no hay ninguna marcada, traer todas las que tengan productos activos
        if (result.recordset.length === 0) {
            result = await pool.request().query(`
                SELECT DISTINCT 
                    LTRIM(RTRIM(s.codsub)) as id, 
                    LTRIM(RTRIM(s.nomsub)) as name 
                FROM tbl01sbf s
                INNER JOIN prd0101 p ON s.codsub = p.codsub
                WHERE p.estado = 1
                ORDER BY name ASC
            `);
        }

        return NextResponse.json(result.recordset);
    } catch (err) {
        console.error('[API/Categories] Error:', err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
