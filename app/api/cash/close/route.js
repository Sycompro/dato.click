import { NextResponse } from 'next/server';
import sql from 'mssql';
import { getConnection } from '@/lib/db';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function POST(request) {
    try {
        const body = await request.json();
        const { idapecaj, totals } = body; // totals: array of { selpago, codtar, totnsis, totnfis }

        if (!idapecaj) {
            return NextResponse.json({ success: false, error: 'ID de apertura requerido' }, { status: 400 });
        }

        const session = await getServerSession(authOptions);
        const pool = await getConnection(session?.user?.company);
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            const now = new Date();
            const codusu = session?.user?.id?.toString().padStart(3, '0').slice(0, 3) || 'POS';

            // 1. Insertar en dtl_restpos_arqueo por cada medio de pago
            for (let i = 0; i < totals.length; i++) {
                const item = totals[i];
                await transaction.request()
                    .input('idapecaj', sql.Int, idapecaj)
                    .input('idarqueo', sql.Int, i + 1)
                    .input('selpago', sql.Int, item.selpago)
                    .input('codtar', sql.Char(2), (item.codtar || '  ').substring(0, 2))
                    .input('fecha', sql.DateTime, now)
                    .input('codusu', sql.Char(3), codusu.substring(0, 3))
                    .input('totnfis', sql.Decimal(18, 4), item.totnfis || item.totnsis)
                    .input('totnsis', sql.Decimal(18, 4), item.totnsis)
                    .query(`
                        INSERT INTO dtl_restpos_arqueo (idapecaj, idarqueo, selpago, codtar, fecha, codusu, totnfis, totnsis, obser)
                        VALUES (@idapecaj, @idarqueo, @selpago, @codtar, @fecha, @codusu, @totnfis, @totnsis, '')
                    `);
            }

            // 2. Actualizar dtl_restpos_apecaj (Marcar como cerrado)
            await transaction.request()
                .input('id', sql.Int, idapecaj)
                .input('feccie', sql.DateTime, now)
                .query('UPDATE dtl_restpos_apecaj SET estado = 1, feccie = @feccie WHERE idapecaj = @id');

            await transaction.commit();
            return NextResponse.json({ success: true });

        } catch (err) {
            await transaction.rollback();
            throw err;
        }

    } catch (error) {
        console.error('Error in cash close API:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
