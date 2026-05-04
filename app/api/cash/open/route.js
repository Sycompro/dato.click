import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import sql from 'mssql';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function POST(request) {
    try {
        const session = await getServerSession(authOptions);
        const { amount, pointOfSale = '01' } = await request.json();

        if (!session?.user?.company) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const pool = await getConnection(session.user.company);
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().split(' ')[0].substring(0, 5);

        // --- DETECCIÓN DE ESQUEMA ---
        let schemaType = 'ERP';
        try {
            await pool.request().query("SELECT TOP 0 * FROM dtl_restpos_apecaj");
        } catch (e) {
            schemaType = 'POS';
        }

        if (schemaType === 'ERP') {
            const userCode = session.user.id?.toString().padStart(3, '0').slice(0, 3); // Max 3
            const sedeCode = session.user.sedeId?.toString().padStart(2, '0').slice(0, 2); // Max 2

            const now = new Date();
            const yearSuffix = now.getFullYear().toString().slice(-2);
            const rawTime = now.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit', 
                hour12: true 
            });
            const timeStr = `${yearSuffix} ${rawTime}`.slice(0, 12); // Asegurar max 12 (Ej: "26 01:30 PM")

            // Generar correlativo para nropla
            const countRes = await pool.request()
                .input('codpto', sql.Char(2), sedeCode)
                .query("SELECT COUNT(*) as total FROM dtl_restpos_apecaj WHERE LTRIM(RTRIM(codpto)) = @codpto");
            const nextVal = (countRes.recordset[0].total + 1).toString().padStart(8, '0');
            const nropla = `1${sedeCode}-${nextVal}`.slice(0, 12); // Asegurar max 12

            // Lógica Esquema ERP (dtl_restpos_apecaj)
            const check = await pool.request()
                .input('codpto', sql.Char(2), sedeCode)
                .input('codusu', sql.Char(3), userCode)
                .query("SELECT idapecaj FROM dtl_restpos_apecaj WHERE estado = 0 AND LTRIM(RTRIM(codpto)) = @codpto AND LTRIM(RTRIM(codusu)) = @codusu");

            if (check.recordset.length > 0) {
                return NextResponse.json({ error: 'Tú ya tienes una caja abierta en este punto de venta' }, { status: 400 });
            }

            const transaction = new sql.Transaction(pool);
            await transaction.begin();

            try {
                const result = await transaction.request()
                    .input('fecape', sql.DateTime, now)
                    .input('hora', sql.VarChar(12), timeStr)
                    .input('codpto', sql.Char(2), sedeCode)
                    .input('codusu', sql.Char(3), userCode)
                    .input('apesol', sql.Decimal(18, 2), amount || 0)
                    .input('nropla', sql.Char(12), nropla)
                    .query(`
                        INSERT INTO dtl_restpos_apecaj (fecape, hora, codpto, codusu, tmov, estado, apesol, apedol, apeeur, nropla)
                        VALUES (@fecape, @hora, @codpto, @codusu, 'A', 0, @apesol, 0, 0, @nropla);
                        SELECT SCOPE_IDENTITY() as id;
                    `);
                
                const newId = result.recordset[0].id;

                // ACTUALIZAR TABLA MAESTRA tbl01pto
                await transaction.request()
                    .input('codpto', sql.Char(2), sedeCode)
                    .input('idapecaj', sql.Int, newId)
                    .input('apesol', sql.Decimal(18, 2), amount || 0)
                    .query(`
                        UPDATE tbl01pto 
                        SET estado = 0, 
                            apecaj = @idapecaj, 
                            apecajsol = @apesol,
                            apecajusu = '   ',
                            apecajhra = GETDATE()
                        WHERE codpto = @codpto
                    `);

                await transaction.commit();
                return NextResponse.json({ success: true, id: newId, nropla });
            } catch (err) {
                await transaction.rollback();
                throw err;
            }
        } else {
            // Lógica Esquema POS (DB_GYM y similares)
            const sedeId = session.user.sedeId || 1;
            const check = await pool.request()
                .input('sedeId', sql.Int, sedeId)
                .query("SELECT CajaId FROM Caja WHERE Vigente = 1 AND SedeId = @sedeId");

            if (check.recordset.length > 0) {
                return NextResponse.json({ error: 'Ya existe una caja abierta para esta sede' }, { status: 400 });
            }

            const result = await pool.request()
                .input('fecha', sql.DateTime, now)
                .input('monto', sql.Float, amount || 0)
                .input('sedeId', sql.Int, sedeId)
                .query(`
                    INSERT INTO Caja (FechaApertura, MontoApertura, Vigente, SedeId, EstadoCajaId, Turno)
                    VALUES (@fecha, @monto, 1, @sedeId, 1, 1);
                    SELECT SCOPE_IDENTITY() as id;
                `);
            return NextResponse.json({ success: true, id: result.recordset[0].id });
        }

    } catch (err) {
        console.error('Cash open error:', err);
        return NextResponse.json({ error: 'Error al abrir caja', details: err.message }, { status: 500 });
    }
}
