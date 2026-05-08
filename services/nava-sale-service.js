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

      // 0. Obtener Identidad Real desde el ERP (Sesión Activa)
      const requestApe = new sql.Request(transaction);
      const resApe = await requestApe
        .input('idapecaj', sql.Int, idApeCaj)
        .query(`
          SELECT a.nropla, a.codpto, a.codusu, 
          (SELECT TOP 1 codcaj FROM tbl_cajamayor WHERE codpto = a.codpto OR codcaj = '01') as codcaj_sugerido
          FROM dtl_restpos_apecaj a WHERE a.idapecaj = @idapecaj
        `);
      
      if (!resApe.recordset[0]) throw new Error(`No se encontró una sesión activa en el ERP para el ID ${idApeCaj}`);
      
      const erpData = resApe.recordset[0];
      const erpPto = erpData.codpto.trim();
      const erpUsu = erpData.codusu.trim();
      const erpNroPla = erpData.nropla.trim();
      const erpCodCaj = erpData.codcaj_sugerido || '01';

      // A. Gestión de Correlativo (Usando el Pto de Venta del ERP)
      const requestCor = new sql.Request(transaction);
      const resCor = await requestCor
        .input('cdocu', docType)
        .input('codpto', erpPto)
        .query(`SELECT nroini FROM tbl01cor WHERE cdocu = @cdocu AND codpto = @codpto`);

      if (!resCor.recordset[0]) throw new Error(`Sin correlativo para ${docType}`);
      
      const currentNroIni = resCor.recordset[0].nroini.trim(); 
      // Lógica 100% Adaptativa: Respetar serie y longitud numérica del ERP
      const parts = currentNroIni.split('-');
      const series = parts[0]; // Sin suposiciones: Tomamos la serie tal cual viene
      const numPartOriginal = parts.length > 1 ? parts[1] : parts[0];
      const numPartClean = numPartOriginal.replace(/[^0-9]/g, '');
      const nextNum = (parseInt(numPartClean, 10) + 1).toString().padStart(numPartClean.length, '0');
      const nextNdocu = `${series}-${nextNum}`;

      // Mapeo Maestro de Almacenes de Producción (BD01)
      const almMap = {
        '01': '02', '02': '03', '09': '03', '03': '08', 
        '04': '05', '05': '06', '06': '07', '07': '04', 
        '10': '09', '11': '10', '12': '02', '13': '02'
      };
      const erpCodAlm = almMap[erpPto] || erpPto; // Fallback al Pto si no hay mapa

      logger.info(`[DEBUG/Sincro] ndocu: ${nextNdocu} | pto: ${erpPto} | usu: ${erpUsu}`);
      logger.info(`[DEBUG/Sincro] planilla: ${erpNroPla} | caja: ${erpCodCaj}`);

      await requestCor
        .input('nextNdocu', nextNdocu)
        .query(`UPDATE tbl01cor SET nroini = @nextNdocu WHERE cdocu = @cdocu AND codpto = @codpto`);

      // B. Insertar Cabecera (mst01fac)
      const requestMst = new sql.Request(transaction);
      // En Soles, el tcam suele ser 1.0 para evitar divisiones extrañas en triggers
      const safeExchangeRate = 1.0; 
      
      await requestMst
        .input('cdocu', docType.substring(0, 2))
        .input('ndocu', nextNdocu.substring(0, 12))
        .input('fecha', fechaStr.substring(0, 10))
        .input('fven', fechaStr.substring(0, 10))
        .input('codcli', (codcli || '000000').substring(0, 6))
        .input('nomcli', (nomcli || 'CLIENTE VARIOS').substring(0, 60))
        .input('ruccli', (ruccli || '').substring(0, 11))
        .input('totn', sql.Decimal(18, 2), Number(breakdown.total.toFixed(2)))
        .input('toti', sql.Decimal(18, 2), Number(breakdown.tax.toFixed(2)))
        .input('tota', sql.Decimal(18, 2), Number(breakdown.subtotal.toFixed(2)))
        .input('mone', 'S')
        .input('tcam', sql.Decimal(18, 4), safeExchangeRate)
        .input('Codpto', erpPto)
        .input('CodAlm', erpCodAlm)
        .input('idapecaj', sql.Int, idApeCaj)
        .input('selpago', sql.Int, globalSelPago)
        .input('codfdp', globalCodFdp.substring(0, 2))
        .input('codtar', globalCodTar.substring(0, 2))
        .input('compro', 'WEB-POS'.substring(0, 9))
        .input('codusu', erpUsu)
        .input('flag', ' ')
        .input('tfact', (docType === '65' ? 'N' : 'S').substring(0, 1))
        .input('Codcdv', '01')
        .input('codvta', '01')
        .input('codven', (codven || 'V0001').substring(0, 5))
        .input('codsub', '01')
        .input('cajrecib', sql.Decimal(18, 2), Number((cashReceived || breakdown.total).toFixed(2)))
        .input('cajvuelto', sql.Decimal(18, 2), Number((changeGiven || 0).toFixed(2)))
        .input('cobmixta', sql.Int, isMixed ? 1 : 0)
        .query(`
          INSERT INTO mst01fac (cdocu, ndocu, fecha, fven, codcli, nomcli, ruccli, totn, toti, tota, mone, tcam, Codpto, CodAlm, idapecaj, selpago, codfdp, codtar, compro, codusu, flag, tfact, Codcdv, codvta, codven, codsub, cajrecib, cajvuelto, cobmixta)
          VALUES (@cdocu, @ndocu, @fecha, @fven, @codcli, @nomcli, @ruccli, @totn, @toti, @tota, @mone, @tcam, @Codpto, @CodAlm, @idapecaj, @selpago, @codfdp, @codtar, @compro, @codusu, @flag, @tfact, @Codcdv, @codvta, @codven, @codsub, @cajrecib, @cajvuelto, @cobmixta)
        `);

      // C. Detalles (dtl01fac)
      for (const [idx, item] of items.entries()) {
        logger.info(`[DEBUG/Truncado] Item ${idx}: ID=${item.id}(${item.id.length}), Name=${item.name}(${item.name.length})`);
        const itemQty = (item.quantity && item.quantity > 0) ? item.quantity : 1;
        const itemPrice = (item.price && item.price > 0) ? item.price : 0;
        
        const reqDtl = new sql.Request(transaction);
        await reqDtl
          .input('cdocu', docType.substring(0, 2))
          .input('ndocu', nextNdocu.substring(0, 12))
          .input('item', sql.Int, idx + 1)
          .input('codi', item.id.substring(0, 11))
          .input('descr', item.name.substring(0, 80))
          .input('cant', sql.Decimal(18, 4), itemQty)
          .input('preu', sql.Decimal(18, 2), Number(itemPrice.toFixed(2)))
          .input('tota', sql.Decimal(18, 2), Number(((itemPrice * itemQty) / 1.18).toFixed(2)))
          .input('totn', sql.Decimal(18, 2), Number((itemPrice * itemQty).toFixed(2)))
          .input('Codalm', erpCodAlm)
          .input('flag', ' ')
          .input('fecha', fechaStr.substring(0, 10))
          .input('tfact', (docType === '65' ? 'N' : 'S').substring(0, 1))
          .input('tcam', sql.Decimal(18, 4), 1.0)
          .input('mone', 'S')
          .input('umed', 'UND')
          .input('aigv', 'S')
          .query(`
            INSERT INTO dtl01fac (fecha, cdocu, ndocu, tfact, item, codi, descr, cant, preu, tota, totn, Codalm, flag, dsct, dsct2, tcam, mone, umed, aigv)
            VALUES (@fecha, @cdocu, @ndocu, @tfact, @item, @codi, @descr, @cant, @preu, @tota, @totn, @Codalm, @flag, 0, 0, @tcam, @mone, @umed, @aigv)
          `);
      }

      // D. Cobranza (mst01cob)
      const nroRecibo = `R${nextNdocu.substring(1)}`.substring(0, 12);
      const reqMstCob = new sql.Request(transaction);
      await reqMstCob
        .input('cdocu', '38')
        .input('ndocu', nroRecibo)
        .input('crefe', docType.substring(0, 2))
        .input('nrefe', nextNdocu.substring(0, 12))
        .input('fecha', fechaStr.substring(0, 10))
        .input('tmov', 'I')
        .input('glosa', 'VENTA POS WEB'.substring(0, 60))
        .input('codcli', (codcli || '000000').substring(0, 6))
        .input('nomcli', (nomcli || 'CLIENTE VARIOS').substring(0, 60))
        .input('monto', sql.Decimal(18, 4), breakdown.total)
        .input('mone', 'S')
        .input('tcam', sql.Decimal(18, 4), 1)
        .input('flag', '0')
        .input('codven', (codven || 'V0001').substring(0, 5))
        .input('Codpto', erpPto)
        .input('idapecaj', sql.Int, idApeCaj)
        .input('cpago', (isMixed ? 'M' : ((payments[0].id === 'EF' || payments[0].type === 1) ? 'E' : 'T')).substring(0, 1))
        .input('selpago', sql.Int, globalSelPago)
        .input('nplan', erpNroPla)
        .input('codcaj', erpCodCaj)
        .input('codusu', erpUsu)
        .query(`
          INSERT INTO mst01cob (cdocu, ndocu, crefe, nrefe, fecha, tmov, glosa, codcli, nomcli, monto, mone, tcam, flag, codven, Codpto, idapecaj, cpago, selpago, nplan, codcaj, codusu)
          VALUES (@cdocu, @ndocu, @crefe, @nrefe, @fecha, @tmov, @glosa, @codcli, @nomcli, @monto, @mone, @tcam, @flag, @codven, @Codpto, @idapecaj, @cpago, @selpago, @nplan, @codcaj, @codusu)
        `);

      // E. Detalle de Cobro (dtl01cob)
      for (const [idx, p] of payments.entries()) {
        const reqDtlCob = new sql.Request(transaction);
        let codbco = (p.id === 'EF') ? '  ' : p.id;
        if (p.id === '01' || p.id === '02') codbco = '09';

        await reqDtlCob
          .input('cdocu', '38')
          .input('ndocu', nroRecibo)
          .input('npago', sql.Int, idx + 1)
          .input('crefe', docType.substring(0, 2))
          .input('nrefe', nextNdocu.substring(0, 12))
          .input('monto', sql.Decimal(18, 4), p.amount)
          .input('cpago', ((p.id === 'EF' || p.type === 1) ? 'E' : 'T').substring(0, 1))
          .input('codbco', codbco.substring(0, 2))
          .input('mone', 'S')
          .input('tcam', sql.Decimal(18, 4), 1)
          .input('codven', (codven || 'V0001').substring(0, 5))
          .input('valori', sql.Decimal(18, 4), p.amount)
          .input('monori', 'S')
          .input('mtopad', sql.Decimal(18, 4), 0)
          .input('mtopas', sql.Decimal(18, 4), p.amount)
          .input('codn', '      ')
          .input('impdonac', sql.Decimal(18, 4), 0)
          .input('nplan', erpNroPla)
          .query(`
            INSERT INTO dtl01cob (cdocu, ndocu, npago, crefe, nrefe, monto, cpago, codbco, mone, tcam, codven, valori, monori, mtopad, mtopas, codn, impdonac, nplan)
            VALUES (@cdocu, @ndocu, @npago, @crefe, @nrefe, @monto, @cpago, @codbco, @mone, @tcam, @codven, @valori, @monori, @mtopad, @mtopas, @codn, @impdonac, @nplan)
          `);
      }

      await transaction.commit();
      return { success: true, ndocu: nextNdocu, total: breakdown.total };

    } catch (err) {
      logger.error(`[SaleService/MSSQL] ERROR ORIGINAL DETECTADO: ${err.message}`);
      if (transaction) {
          try {
              await transaction.rollback();
          } catch (rollbackErr) {
              logger.warn(`[SaleService/MSSQL] Error en rollback (posiblemente ya abortado): ${rollbackErr.message}`);
          }
      }
      throw err;
    }
  }
}

export default new NavaSaleService();
