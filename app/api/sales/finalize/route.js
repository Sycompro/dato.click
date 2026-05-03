import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import sql from 'mssql';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

function incrementCorrelative(current) {
    if (!current || !current.includes('-')) return current;
    const [prefix, number] = current.split('-');
    const nextNum = (parseInt(number, 10) + 1).toString().padStart(number.length, '0');
    return `${prefix}-${nextNum}`;
}

export async function POST(request) {
    const session = await getServerSession(authOptions);
    const body = await request.json();
    const {
        docType,
        pointOfSale,
        codcli,
        items,
        idApeCaj,
        paymentMethod,
        warehouse,
        currency = 'S',
        exchangeRate = 1
    } = body;

    const pool = await getConnection(session?.user?.company);
    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();

        // 1. Obtener y actualizar correlativo
        const sedeCode = session.user.sedeId; // codpto
        const corRes = await transaction.request()
            .input('cdocu', sql.Char(2), docType)
            .input('codpto', sql.Char(6), sedeCode)
            .query("SELECT nroini FROM tbl01cor WHERE cdocu = @cdocu AND codpto = @codpto");

        if (corRes.recordset.length === 0) {
            throw new Error(`Correlativo no encontrado para cdocu:${docType} codpto:${sedeCode}`);
        }

        const ndocu = corRes.recordset[0].nroini.trim();
        const nextNdocu = incrementCorrelative(ndocu);

        // Actualizar el correlativo en la base de datos inmediatamente
        await transaction.request()
            .input('nextNdocu', sql.Char(12), nextNdocu)
            .input('cdocu', sql.Char(2), docType)
            .input('codpto', sql.Char(6), sedeCode)
            .query("UPDATE tbl01cor SET nroini = @nextNdocu WHERE cdocu = @cdocu AND codpto = @codpto");

        // 2. Calcular totales (Navasoft: totn=Total, tota=Afecto, toti=IGV)
        // Nota de Venta (65) no desglosa IGV en cabecera
        const totalVenta = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
        const isNota = (docType === '65');
        const totalAfecto = isNota ? totalVenta : (totalVenta / 1.18);
        const totalIGV = isNota ? 0 : (totalVenta - totalAfecto);

        // Definir Flags según estándar Navasoft
        const flagValue = '0';
        // 01: Factura -> tfact 1
        // 03: Boleta  -> tfact 2
        // 65: Nota    -> tfact 5
        const tfactValue = (docType === '01') ? '1' : (docType === '03' ? '2' : '5');
        
        // Fecha solo (sin hora) para compatibilidad con filtros ERP
        const todayDate = new Date();
        todayDate.setHours(0,0,0,0);

        // 3. Insertar Cabecera (mst01fac)
        const isCard = paymentMethod === 3;
        const codfdp = isCard ? '02' : '01';
        const comproBase = isCard ? `${(body.codtar || '03').substring(0, 2)}/` : '';
        const codscc = '00';

        try {
            await transaction.request()
                .input('fecha', sql.DateTime, todayDate)
                .input('fven', sql.DateTime, todayDate)
                .input('cdocu', sql.Char(2), docType)
                .input('ndocu', sql.Char(12), ndocu)
                .input('codcli', sql.Char(6), (codcli || '000000').substring(0, 6))
                .input('nomcli', sql.Char(60), (body.nomcli || 'CLIENTE VARIOS').substring(0, 60))
                .input('ruccli', sql.Char(11), (body.ruccli || '').substring(0, 11))
                .input('totn', sql.Decimal(18, 4), totalVenta)   // TOTAL
                .input('toti', sql.Decimal(18, 4), totalIGV)     // IGV
                .input('tota', sql.Decimal(18, 4), totalAfecto)  // AFECTO (Base)
                .input('mone', sql.Char(1), currency || 'S')
                .input('tcam', sql.Decimal(18, 4), exchangeRate || 1)
                .input('codpto', sql.Char(2), (sedeCode || '01').substring(0, 2))
                .input('codalm', sql.Char(2), (warehouse || '01').substring(0, 2))
                .input('idapecaj', sql.Int, idApeCaj)
                .input('selpago', sql.Int, paymentMethod || 1)
                .input('codfdp', sql.Char(2), codfdp)
                .input('codtar', sql.Char(2), (body.codtar || '').substring(0, 2))
                .input('compro', sql.Char(6), comproBase)
                .input('codscc', sql.Char(2), codscc)
                .input('codusu', sql.Char(3), 'POS') // Solo 3 caracteres permitidos
                .input('monrecib', sql.Char(1), 'S')
                .input('monvuelto', sql.Char(1), 'S')
                .input('flag', sql.Char(1), flagValue)
                .input('tfact', sql.Char(1), tfactValue)
                .input('codcdv', sql.Char(2), '01')
                .input('codvta', sql.Char(2), '01')
                .input('codven', sql.Char(5), (body.codven || 'V0001').substring(0, 5))
                .input('codsub', sql.Char(2), isCard ? '03' : '01')
                .query(`
                    INSERT INTO mst01fac (fecha, fven, cdocu, ndocu, codcli, nomcli, ruccli, totn, toti, tota, mone, tcam, codpto, CodAlm, idapecaj, selpago, codfdp, codtar, compro, codscc, codusu, monrecib, monvuelto, flag, tfact, Codcdv, codvta, codven, codsub)
                    VALUES (@fecha, @fven, @cdocu, @ndocu, @codcli, @nomcli, @ruccli, @totn, @toti, @tota, @mone, @tcam, @codpto, @codalm, @idapecaj, @selpago, @codfdp, @codtar, @compro, @codscc, @codusu, @monrecib, @monvuelto, @flag, @tfact, @codcdv, @codvta, @codven, @codsub)
                `);
        } catch (sqlErr) {
            console.error('SQL Error in mst01fac:', sqlErr);
            throw sqlErr;
        }

        // 4. Insertar Detalle (dtl01fac) y Actualizar Stock
        const stockField = `stk${(warehouse || '01').padStart(2, '0')}`;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];

            // Insertar Detalle
            // Desglose de montos por ítem según tipo de documento
            const itemTotalConIGV = item.price * item.quantity;
            const itemPriceNeto = isNota ? item.price : (item.price / 1.18);
            const itemTotalNeto = isNota ? itemTotalConIGV : (itemPriceNeto * item.quantity);
            const itemAigv = isNota ? 'N' : 'S';

            await transaction.request()
                .input('fecha', sql.DateTime, todayDate)
                .input('cdocu', sql.Char(2), docType)
                .input('ndocu', sql.Char(12), ndocu)
                .input('tfact', sql.Char(1), tfactValue)
                .input('item', sql.Decimal(18, 4), (i + 1))
                .input('codi', sql.Char(11), (item.id || '').substring(0, 11))
                .input('descr', sql.Char(80), (item.name || '').substring(0, 80))
                .input('cant', sql.Decimal(18, 6), item.quantity)
                .input('preu', sql.Decimal(18, 6), itemPriceNeto)
                .input('tota', sql.Decimal(18, 4), itemTotalNeto)
                .input('totn', sql.Decimal(18, 4), itemTotalConIGV)
                .input('codalm', sql.Char(2), (warehouse || '01').substring(0, 2))
                .input('codcli', sql.Char(6), (codcli || '000000').substring(0, 6))
                .input('codven', sql.Char(5), (body.codven || 'V0001').substring(0, 5))
                .input('codvta', sql.Char(2), '01')
                .input('codcdv', sql.Char(2), '01')
                .input('flag', sql.Char(1), flagValue)
                .input('aigv', sql.Char(1), itemAigv)
                .input('mone', sql.Char(1), 'S')
                .input('tcam', sql.Decimal(18, 4), exchangeRate || 1)
                .input('msto', sql.Char(1), 'S')
                .query(`
                    INSERT INTO dtl01fac (fecha, cdocu, ndocu, tfact, item, codi, descr, cant, preu, tota, totn, Codalm, codcli, codven, codvta, codcdv, flag, aigv, mone, moneitm, tcam, msto)
                    VALUES (@fecha, @cdocu, @ndocu, @tfact, @item, @codi, @descr, @cant, @preu, @tota, @totn, @codalm, @codcli, @codven, @codvta, @codcdv, @flag, @aigv, @mone, @mone, @tcam, @msto)
                `);

            // Actualizar Stock (Almacén + Consolidado)
            await transaction.request()
                .input('codi', sql.Char(11), item.id)
                .input('cant', sql.Float, item.quantity)
                .query(`
                    UPDATE prd0101 
                    SET ${stockField} = ${stockField} - @cant,
                        stoc = stoc - @cant 
                    WHERE codi = @codi
                `);
        }

        // 5. Actualizar el correlativo para la siguiente venta
        await transaction.request()
            .input('cdocu', sql.Char(2), docType)
            .input('codpto', sql.Char(6), sedeCode)
            .input('nextCor', sql.Char(12), nextNdocu)
            .query("UPDATE tbl01cor SET nroini = @nextCor WHERE cdocu = @cdocu AND codpto = @codpto");

        // 6. Insertar en Cuentas por Cobrar (mst01ccc)
        await transaction.request()
            .input('fecha', sql.DateTime, todayDate)
            .input('cdocu', sql.Char(2), docType)
            .input('ndocu', sql.Char(12), ndocu)
            .input('codcli', sql.Char(6), (codcli || '000000').substring(0, 6))
            .input('nomcli', sql.Char(60), (body.nomcli || 'CLIENTE VARIOS').substring(0, 60))
            .input('ruccli', sql.Char(11), (body.ruccli || '').substring(0, 11))
            .input('monto', sql.Decimal(18, 4), totalVenta)
            .input('saldo', sql.Decimal(18, 4), totalVenta)
            .input('fven', sql.DateTime, todayDate)
            .input('mone', sql.Char(1), 'S')
            .input('tcam', sql.Decimal(18, 4), exchangeRate || 1)
            .input('codven', sql.Char(5), (body.codven || 'V0001').substring(0, 5))
            .input('codpto', sql.Char(2), (sedeCode || '01').substring(0, 2))
            .input('codsub', sql.Char(2), isCard ? '03' : '01')
            .input('compro_ccc', sql.Char(6), comproBase)
            .input('codscc', sql.Char(2), codscc)
            .query(`
                INSERT INTO mst01ccc (fecha, cdocu, ndocu, crefe, nrefe, codcli, nomcli, ruccli, codcdv, monto, saldo, fven, mone, tcam, flag, flagi, codven, codpto, codsub, compro, codscc)
                VALUES (@fecha, @cdocu, @ndocu, @cdocu, @ndocu, @codcli, @nomcli, @ruccli, '01', @monto, @saldo, @fven, @mone, @tcam, '0', '0', @codven, @codpto, @codsub, @compro_ccc, @codscc)
            `);

        // 6. Insertar en dtl01ccc (Solo Factura necesita esto para visibilidad en caja)
        if (docType === '01') {
            await transaction.request()
                .input('fecha', sql.DateTime, todayDate)
                .input('codcli', sql.Char(6), (codcli || '000000').substring(0, 6))
                .input('cdocu', sql.Char(2), docType)
                .input('ndocu', sql.Char(12), ndocu)
                .input('monto', sql.Decimal(18, 4), totalVenta)
                .input('tcam', sql.Decimal(18, 4), exchangeRate || 1)
                .input('glosa', sql.Char(50), (items[0]?.name || 'VENTA WEB').substring(0, 50))
                .query(`
                    INSERT INTO dtl01ccc (fecha, codcli, tmov, cdocu, ndocu, crefe, nrefe, glosa, cargo, abono, mone, tcam, cpago, mpago, npago, ipago, nplan, idunico, fecreg, compro)
                    VALUES (@fecha, @codcli, 'C', @cdocu, @ndocu, @cdocu, @ndocu, @glosa, @monto, 0, 'S', @tcam, '', '', '', 0, '', NEWID(), GETDATE(), '03/')
                `);
        }

        // 7. Actualizar ficha de cliente en Navasoft (si aplica)
        if (codcli && codcli !== '000000' && codcli !== 'NUEVO_ERP' && codcli !== 'INTERNO') {
            const customerPhone = body.phone || '';
            const customerBirthdate = body.birthdate ? new Date(body.birthdate) : null;

            await transaction.request()
                .input('codcli', sql.Char(6), codcli.substring(0, 6))
                .input('celcli', sql.VarChar(40), customerPhone)
                .input('fecnac', sql.DateTime, customerBirthdate)
                .query(`
                    UPDATE mst01cli 
                    SET celcli = @celcli, fecnac = @fecnac 
                    WHERE codcli = @codcli
                `);
        }

        await transaction.commit();

        return NextResponse.json({
            success: true,
            message: 'Venta finalizada con éxito',
            documentNumber: ndocu
        });

    } catch (error) {
        if (transaction) await transaction.rollback();
        console.error('Transaction error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
