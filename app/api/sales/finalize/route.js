import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import sql from 'mssql';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getWarehouseForSede, getStockTableName, getStockColumnName, ERP_CONFIG, calculateTaxBreakdown } from '@/lib/erp-utils';

function incrementCorrelative(current) {
    if (!current || !current.includes('-')) return current;
    const [prefix, number] = current.split('-');
    const nextNum = (parseInt(number, 10) + 1).toString().padStart(number.length, '0');
    return `${prefix}-${nextNum}`;
}

export async function POST(request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await request.json();
    const {
        docType,
        codcli,
        items,
        idApeCaj,
        currency = 'S',
        exchangeRate = 1
    } = body;

    const pool = await getConnection(session.user.company);
    
    // 1. RESOLUCIÓN DE ALMACÉN CENTRALIZADA
    const sedeCode = session.user.sedeId || ERP_CONFIG.DEFAULT_SEDE;
    const warehouse = await getWarehouseForSede(pool, sedeCode);
    const stockField = getStockColumnName(warehouse);
    const prdTable = getStockTableName(warehouse);

    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();

        // 2. CORRELATIVOS
        const corRes = await transaction.request()
            .input('cdocu', sql.Char(2), docType)
            .input('codpto', sql.Char(6), sedeCode)
            .query("SELECT nroini FROM tbl01cor WHERE cdocu = @cdocu AND codpto = @codpto");

        if (corRes.recordset.length === 0) {
            throw new Error(`Correlativo no encontrado para cdocu:${docType} codpto:${sedeCode}`);
        }

        const ndocu = corRes.recordset[0].nroini.trim();
        const nextNdocu = incrementCorrelative(ndocu);

        await transaction.request()
            .input('nextNdocu', sql.Char(12), nextNdocu)
            .input('cdocu', sql.Char(2), docType)
            .input('codpto', sql.Char(6), sedeCode)
            .query("UPDATE tbl01cor SET nroini = @nextNdocu WHERE cdocu = @cdocu AND codpto = @codpto");

        // 3. CÁLCULO DE TOTALES CENTRALIZADO
        const totalVenta = items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
        const isNota = (docType === '65');
        const breakdown = calculateTaxBreakdown(totalVenta, !isNota);
        
        const tfactValue = (docType === '01') ? '1' : (docType === '03' ? '2' : '5');
        const fechaStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

        // 4. LÓGICA DE PAGOS
        const payments = body.payments || [];
        const isMixed = payments.length > 1;
        const isSingleNonCash = payments.length === 1 && payments[0].type !== 1;
        
        let globalSelPago = 1;
        let globalCodFdp = '01';
        let globalCodTar = '  ';
        let globalCompro = '';

        if (isMixed || isSingleNonCash) {
            globalSelPago = 4;
            globalCodFdp = '  ';
            globalCodTar = '0 '; 
        } else if (payments.length === 1) {
            const p = payments[0];
            globalSelPago = p.type;
            globalCodFdp = (p.type === 1) ? '01' : '02';
            
            if (p.id === 'EF' || p.type === 1) {
                globalCodTar = '  ';
            } else if (p.id?.includes('YAPE') && p.id?.includes('QR')) {
                globalCodTar = '04';
            } else if (p.id?.includes('YAPE')) {
                globalCodTar = '06';
            } else {
                globalCodTar = '07'; 
            }
            globalCompro = p.voucher ? p.voucher.substring(0, 6) : '';
        }

        const userCode = session.user.id?.toString().padStart(3, '0').slice(0, 3) || 'POS';

        // 5. INSERCIÓN CABECERA (mst01fac)
        await transaction.request()
            .input('fecha', sql.VarChar(10), fechaStr)
            .input('fven', sql.VarChar(10), fechaStr)
            .input('cdocu', sql.Char(2), docType)
            .input('ndocu', sql.Char(12), ndocu)
            .input('codcli', sql.Char(6), (codcli || '000000').substring(0, 6))
            .input('nomcli', sql.Char(60), (body.nomcli || 'CLIENTE VARIOS').substring(0, 60))
            .input('ruccli', sql.Char(11), (body.ruccli || '').substring(0, 11))
            .input('totn', sql.Decimal(18, 4), breakdown.total)
            .input('toti', sql.Decimal(18, 4), breakdown.tax)
            .input('tota', sql.Decimal(18, 4), breakdown.subtotal)
            .input('mone', sql.Char(1), currency || 'S')
            .input('tcam', sql.Decimal(18, 4), exchangeRate || 1)
            .input('codpto', sql.Char(2), (sedeCode || '01').substring(0, 2))
            .input('codalm', sql.Char(2), (warehouse || '01').substring(0, 2))
            .input('idapecaj', sql.Int, idApeCaj)
            .input('selpago', sql.Int, globalSelPago)
            .input('codfdp', sql.Char(2), globalCodFdp)
            .input('codtar', sql.Char(2), globalCodTar)
            .input('compro', sql.Char(6), globalCompro.substring(0, 6))
            .input('codusu', sql.Char(3), userCode)
            .input('flag', sql.Char(1), '0')
            .input('tfact', sql.Char(1), tfactValue)
            .input('codven', sql.Char(5), (body.codven || 'V0001').substring(0, 5))
            .input('codsub', sql.Char(2), (globalSelPago === 1) ? '01' : '03')
            .query(`
                INSERT INTO mst01fac (fecha, fven, cdocu, ndocu, codcli, nomcli, ruccli, totn, toti, tota, mone, tcam, codpto, CodAlm, idapecaj, selpago, codfdp, codtar, compro, codusu, flag, tfact, Codcdv, codvta, codven, codsub)
                VALUES (@fecha, @fven, @cdocu, @ndocu, @codcli, @nomcli, @ruccli, @totn, @toti, @tota, @mone, @tcam, @codpto, @codalm, @idapecaj, @selpago, @codfdp, @codtar, @compro, @codusu, @flag, @tfact, '01', '01', @codven, @codsub)
            `);

        // 6. COBRANZA MIXTA
        if (isMixed || isSingleNonCash) {
            for (const p of payments) {
                await transaction.request()
                    .input('cdocu', sql.Char(2), docType)
                    .input('ndocu', sql.Char(12), ndocu)
                    .input('codtar', sql.Char(2), (p.id === 'EF' ? 'NS' : p.id).substring(0, 2))
                    .input('amount', sql.Decimal(18, 4), p.amount)
                    .input('selpago', sql.Int, (p.id === 'EF' ? 1 : 3))
                    .query(`
                        INSERT INTO dtl_restpos_cobmixta (cdocu, ndocu, codtar, recib, totn, selpago, impper, cajrecib, monrecib, cajvuelto, monvuelto)
                        VALUES (@cdocu, @ndocu, @codtar, @amount, @amount, @selpago, 0, @amount, 'S', 0, 'S')
                    `);
            }
        }

        // 7. DETALLE Y STOCK DINÁMICO
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const itemBreakdown = calculateTaxBreakdown(item.price * item.quantity, !isNota);
            const itemPriceNeto = itemBreakdown.subtotal / item.quantity;

            await transaction.request()
                .input('fecha', sql.VarChar(10), fechaStr)
                .input('cdocu', sql.Char(2), docType)
                .input('ndocu', sql.Char(12), ndocu)
                .input('tfact', sql.Char(1), tfactValue)
                .input('item', sql.Decimal(18, 4), (i + 1))
                .input('codi', sql.Char(11), (item.id || '').substring(0, 11))
                .input('descr', sql.Char(80), (item.name || '').substring(0, 80))
                .input('cant', sql.Decimal(18, 6), item.quantity)
                .input('preu', sql.Decimal(18, 6), itemPriceNeto)
                .input('tota', sql.Decimal(18, 4), itemBreakdown.subtotal)
                .input('totn', sql.Decimal(18, 4), itemBreakdown.total)
                .input('codalm', sql.Char(2), warehouse.substring(0, 2))
                .input('codcli', sql.Char(6), (codcli || '000000').substring(0, 6))
                .input('codven', sql.Char(5), (body.codven || 'V0001').substring(0, 5))
                .input('tcam', sql.Decimal(18, 4), exchangeRate || 1)
                .query(`
                    INSERT INTO dtl01fac (fecha, cdocu, ndocu, tfact, item, codi, descr, cant, preu, tota, totn, Codalm, codcli, codven, codvta, codcdv, flag, aigv, mone, moneitm, tcam, msto)
                    VALUES (@fecha, @cdocu, @ndocu, @tfact, @item, @codi, @descr, @cant, @preu, @tota, @totn, @codalm, @codcli, @codven, '01', '01', '0', 'S', 'S', 'S', @tcam, 'S')
                `);

            // ACTUALIZACIÓN DE STOCK CENTRALIZADA
            await transaction.request()
                .input('codi', sql.Char(11), item.id)
                .input('cant', sql.Float, item.quantity)
                .query(`
                    DECLARE @table_exists INT;
                    SELECT @table_exists = COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = '${prdTable}';
                    IF @table_exists > 0
                    BEGIN
                        DECLARE @sql NVARCHAR(MAX) = N'UPDATE ${prdTable} SET stoc = stoc - @cant WHERE codi = @codi';
                        EXEC sp_executesql @sql, N'@cant FLOAT, @codi CHAR(11)', @cant, @codi;
                    END
                    UPDATE prd0101 SET ${stockField} = ${stockField} - @cant, stoc = stoc - @cant WHERE codi = @codi
                `);

            // KARDEX DINÁMICO
            const kardexTable = `kdd01${warehouse.padStart(2, '0')}`;
            try {
                await transaction.request()
                    .input('fecha', sql.VarChar(10), fechaStr)
                    .input('cdocu', sql.Char(2), docType)
                    .input('ndocu', sql.Char(12), ndocu)
                    .input('codi', sql.Char(11), (item.id || '').substring(0, 11))
                    .input('cant', sql.Decimal(18, 6), item.quantity)
                    .input('preu', sql.Decimal(18, 6), itemPriceNeto)
                    .input('tota', sql.Decimal(18, 4), itemBreakdown.subtotal)
                    .query(`
                        INSERT INTO ${kardexTable} (fecha, cdocu, ndocu, codn, nomb, tmov, codi, cant, preu, tota, tcam, mone, codven, CodPto, aigv)
                        VALUES (@fecha, @cdocu, @ndocu, '00', 'CLIENTE', 'S', @codi, @cant, @preu, @tota, 1, 'S', 'V0001', '01', 'S')
                    `);
            } catch (e) {}
        }

        await transaction.request()
            .input('fecha', sql.VarChar(10), fechaStr)
            .input('cdocu', sql.Char(2), docType)
            .input('ndocu', sql.Char(12), ndocu)
            .input('codcli', sql.Char(6), (codcli || '000000').substring(0, 6))
            .input('monto', sql.Decimal(18, 4), breakdown.total)
            .input('tcam', sql.Decimal(18, 4), exchangeRate || 1)
            .query(`
                INSERT INTO mst01ccc (fecha, cdocu, ndocu, crefe, nrefe, codcli, nomcli, ruccli, codcdv, monto, saldo, fven, mone, tcam, flag, flagi, codven, codpto, codsub, compro, codscc)
                VALUES (@fecha, @cdocu, @ndocu, @cdocu, @ndocu, @codcli, 'CLIENTE', '', '01', @monto, @monto, @fecha, 'S', @tcam, '0', '0', 'V0001', '01', '01', '', '00')
            `);

        await transaction.commit();
        return NextResponse.json({ 
            success: true, 
            ndocu,
            total: breakdown.total,
            base: breakdown.subtotal,
            igv: breakdown.tax
        });

    } catch (err) {
        if (transaction) await transaction.rollback();
        console.error('[Finalize Error]:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
