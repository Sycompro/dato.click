import sql from 'mssql';
import { getConnection } from '@/lib/db';
import logger from '@/lib/logger';
import { calculateTaxBreakdown } from '@/lib/erp-utils';

class NavaSaleService {
  async finalize(data, dbName) {
    const pool = await getConnection(dbName);
    const transaction = new sql.Transaction(pool);

    try {
      logger.info(`[SaleService/MSSQL] Iniciando venta nativa en ${dbName}`);

      const {
        docType, codcli, nomcli, ruccli, items, payments, 
        idApeCaj, warehouse, codven, exchangeRate,
        cashReceived, changeGiven
      } = data;

      const breakdown = calculateTaxBreakdown(items);
      const now = new Date();
      const fechaStr = now.toISOString().split('T')[0];
      const isMixed = payments.length > 1;

      let globalSelPago = 1; 
      let globalCodFdp = '01'; 
      let globalCodTar = '  ';

      if (isMixed) {
          globalSelPago = 4;
          globalCodFdp = '01';
      } else if (payments.length === 1) {
          const p = payments[0];
          if (p.id !== 'EF' && p.type !== 1) {
              globalSelPago = 3; 
              globalCodFdp = (p.id === '01' || p.id === '02') ? '04' : '03';
              globalCodTar = p.id;
          }
      }

      await transaction.begin();

      // A. Gestión de Correlativo
      const requestCor = new sql.Request(transaction);
      const resCor = await requestCor
        .input('cdocu', sql.Char(2), docType)
        .input('codpto', sql.Char(2), warehouse.substring(0, 2))
        .query(`SELECT nroini FROM tbl01cor WHERE cdocu = @cdocu AND codpto = @codpto`);

      if (!resCor.recordset[0]) throw new Error(`Sin correlativo para ${docType}`);
      
      const currentNroIni = resCor.recordset[0].nroini.trim(); 
      const [series, numStr] = currentNroIni.split('-');
      const nextNdocu = `${series}-${(parseInt(numStr, 10) + 1).toString().padStart(8, '0')}`;
      
      // Actualizar correlativo
      await requestCor
        .input('nextNdocu', sql.Char(12), nextNdocu)
        .query(`UPDATE tbl01cor SET nroini = @nextNdocu WHERE cdocu = @cdocu AND codpto = @codpto`);

      // B. Insertar Cabecera (mst01fac)
      const requestMst = new sql.Request(transaction);
      await requestMst
        .input('cdocu', sql.Char(2), docType)
        .input('ndocu', sql.Char(12), nextNdocu)
        .input('fecha', sql.VarChar(10), fechaStr)
        .input('fven', sql.VarChar(10), fechaStr)
        .input('codcli', sql.Char(6), (codcli || '000000').substring(0, 6))
        .input('nomcli', sql.Char(60), (nomcli || 'CLIENTE VARIOS').substring(0, 60))
        .input('ruccli', sql.Char(11), (ruccli || '').substring(0, 11))
        .input('totn', sql.Decimal(18, 4), breakdown.total)
        .input('toti', sql.Decimal(18, 4), breakdown.tax)
        .input('tota', sql.Decimal(18, 4), breakdown.subtotal)
        .input('mone', sql.Char(1), 'S')
        .input('tcam', sql.Decimal(18, 4), exchangeRate || 1)
        .input('Codpto', sql.Char(2), warehouse.substring(0, 2))
        .input('CodAlm', sql.Char(2), warehouse.substring(0, 2))
        .input('idapecaj', sql.Int, idApeCaj)
        .input('selpago', sql.Int, globalSelPago)
        .input('codfdp', sql.Char(2), globalCodFdp)
        .input('codtar', sql.Char(2), globalCodTar)
        .input('compro', sql.Char(10), 'WEB-POS')
        .input('codusu', sql.Char(3), 'WEB')
        .input('flag', sql.Char(1), ' ')
        .input('tfact', sql.Char(1), (docType === '65' ? 'N' : 'S'))
        .input('Codcdv', sql.Char(2), '01')
        .input('codvta', sql.Char(2), '01')
        .input('codven', sql.Char(5), (codven || 'V0001').substring(0, 5))
        .input('codsub', sql.Char(2), '01')
        .input('cajrecib', sql.Decimal(18, 4), cashReceived || breakdown.total)
        .input('cajvuelto', sql.Decimal(18, 4), changeGiven || 0)
        .input('cobmixta', sql.Int, isMixed ? 1 : 0)
        .query(`
          INSERT INTO mst01fac (cdocu, ndocu, fecha, fven, codcli, nomcli, ruccli, totn, toti, tota, mone, tcam, Codpto, CodAlm, idapecaj, selpago, codfdp, codtar, compro, codusu, flag, tfact, Codcdv, codvta, codven, codsub, cajrecib, cajvuelto, cobmixta)
          VALUES (@cdocu, @ndocu, @fecha, @fven, @codcli, @nomcli, @ruccli, @totn, @toti, @tota, @mone, @tcam, @Codpto, @CodAlm, @idapecaj, @selpago, @codfdp, @codtar, @compro, @codusu, @flag, @tfact, @Codcdv, @codvta, @codven, @codsub, @cajrecib, @cajvuelto, @cobmixta)
        `);

      // C. Detalles (dtl01fac)
      for (const [idx, item] of items.entries()) {
        const reqDtl = new sql.Request(transaction);
        await reqDtl
          .input('cdocu', sql.Char(2), docType)
          .input('ndocu', sql.Char(12), nextNdocu)
          .input('item', sql.Int, idx + 1)
          .input('codi', sql.VarChar(20), item.id.substring(0, 20))
          .input('descr', sql.VarChar(100), item.name.substring(0, 100))
          .input('cant', sql.Decimal(18, 4), item.quantity)
          .input('preu', sql.Decimal(18, 4), item.price)
          .input('tota', sql.Decimal(18, 4), (item.price * item.quantity) / 1.18)
          .input('totn', sql.Decimal(18, 4), item.price * item.quantity)
          .input('Codalm', sql.Char(2), warehouse.substring(0, 2))
          .input('flag', sql.Char(1), ' ')
          .query(`
            INSERT INTO dtl01fac (cdocu, ndocu, item, codi, descr, cant, preu, tota, totn, Codalm, flag, dsct, dsct2)
            VALUES (@cdocu, @ndocu, @item, @codi, @descr, @cant, @preu, @tota, @totn, @Codalm, @flag, 0, 0)
          `);
      }

      // D. Cobranza (mst01cob)
      const nroRecibo = `R${nextNdocu.substring(1)}`;
      const reqMstCob = new sql.Request(transaction);
      await reqMstCob
        .input('cdocu', sql.Char(2), '38')
        .input('ndocu', sql.Char(12), nroRecibo)
        .input('crefe', sql.Char(2), docType)
        .input('nrefe', sql.Char(12), nextNdocu)
        .input('fecha', sql.VarChar(10), fechaStr)
        .input('tmov', sql.Char(1), 'I')
        .input('glosa', sql.Char(60), 'VENTA POS WEB')
        .input('codcli', sql.Char(6), (codcli || '000000').substring(0, 6))
        .input('nomcli', sql.Char(60), (nomcli || 'CLIENTE VARIOS').substring(0, 60))
        .input('monto', sql.Decimal(18, 4), breakdown.total)
        .input('mone', sql.Char(1), 'S')
        .input('tcam', sql.Decimal(18, 4), 1)
        .input('flag', sql.Char(1), '0')
        .input('codven', sql.Char(5), (codven || 'V0001').substring(0, 5))
        .input('Codpto', sql.Char(2), warehouse.substring(0, 2))
        .input('idapecaj', sql.Int, idApeCaj)
        .input('cpago', sql.Char(1), isMixed ? 'M' : ((payments[0].id === 'EF' || payments[0].type === 1) ? 'E' : 'T'))
        .input('selpago', sql.Int, globalSelPago)
        .query(`
          INSERT INTO mst01cob (cdocu, ndocu, crefe, nrefe, fecha, tmov, glosa, codcli, nomcli, monto, mone, tcam, flag, codven, Codpto, idapecaj, cpago, selpago)
          VALUES (@cdocu, @ndocu, @crefe, @nrefe, @fecha, @tmov, @glosa, @codcli, @nomcli, @monto, @mone, @tcam, @flag, @codven, @Codpto, @idapecaj, @cpago, @selpago)
        `);

      // E. Detalle de Cobro (dtl01cob)
      for (const [idx, p] of payments.entries()) {
        const reqDtlCob = new sql.Request(transaction);
        let codbco = (p.id === 'EF') ? '  ' : p.id;
        if (p.id === '01' || p.id === '02') codbco = '09';

        await reqDtlCob
          .input('cdocu', sql.Char(2), '38')
          .input('ndocu', sql.Char(12), nroRecibo)
          .input('npago', sql.Int, idx + 1)
          .input('crefe', sql.Char(2), docType)
          .input('nrefe', sql.Char(12), nextNdocu)
          .input('monto', sql.Decimal(18, 4), p.amount)
          .input('cpago', sql.Char(1), (p.id === 'EF' || p.type === 1) ? 'E' : 'T')
          .input('codbco', sql.Char(2), codbco.substring(0, 2))
          .input('mone', sql.Char(1), 'S')
          .input('tcam', sql.Decimal(18, 4), 1)
          .input('codven', sql.Char(5), (codven || 'V0001').substring(0, 5))
          .input('valori', sql.Decimal(18, 4), p.amount)
          .input('monori', sql.Char(1), 'S')
          .input('mtopad', sql.Decimal(18, 4), 0)
          .input('mtopas', sql.Decimal(18, 4), p.amount)
          .input('codn', sql.Char(1), ' ')
          .input('impdonac', sql.Decimal(18, 4), 0)
          .query(`
            INSERT INTO dtl01cob (cdocu, ndocu, npago, crefe, nrefe, monto, cpago, codbco, mone, tcam, codven, valori, monori, mtopad, mtopas, codn, impdonac)
            VALUES (@cdocu, @ndocu, @npago, @crefe, @nrefe, @monto, @cpago, @codbco, @mone, @tcam, @codven, @valori, @monori, @mtopad, @mtopas, @codn, @impdonac)
          `);
      }

      await transaction.commit();
      return { success: true, ndocu: nextNdocu, total: breakdown.total };

    } catch (err) {
      if (transaction) await transaction.rollback();
      logger.error(`[SaleService/MSSQL] Error: ${err.message}`);
      throw err;
    }
  }
}

export default new NavaSaleService();
