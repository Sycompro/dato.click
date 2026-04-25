import { NextResponse } from 'next/server';
import { getConnection } from '../../../lib/db';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";

export async function GET(request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ success: false, error: 'Acceso Denegado' }, { status: 401 });

    try {
        const pool = await getConnection('BdNava01');
        const data = await pool.request().query('SELECT TOP 5 FecReg, fecha, cdocu, ndocu FROM mst01fac ORDER BY FecReg DESC');

        return NextResponse.json({
            success: true,
            samples: data.recordset
        });
    } catch (e) {
        return NextResponse.json({ error: e.message });
    }
}
