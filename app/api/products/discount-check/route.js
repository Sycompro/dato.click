import { getConnection } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function GET(req) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.company) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const pool = await getConnection(session.user.company);
        const result = await pool.request().query(`
            SELECT TOP 1 
                codi as id, 
                codf as userCode, 
                descr as name, 
                umed as unit,
                marc as brand
            FROM prd0101 
            WHERE codf = 'DS00' OR codi = 'DS00'
        `);

        if (result.recordset.length === 0) {
            return NextResponse.json({ exists: false });
        }

        return NextResponse.json({ 
            exists: true, 
            product: {
                ...result.recordset[0],
                id: result.recordset[0].id.trim(),
                userCode: result.recordset[0].userCode.trim(),
                name: result.recordset[0].name.trim(),
                brand: (result.recordset[0].brand || '').trim()
            }
        });

    } catch (err) {
        console.error('Error checking discount item:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
