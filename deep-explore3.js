const sql = require('mssql');

const config = {
    user: 'sa',
    password: 'Gimbra2022',
    server: '192.168.194.169',
    options: { encrypt: false, trustServerCertificate: true }
};

const databases = ['BdNava00','BdNava01','BdNava02','BdNava03','BdNava04','BdNava05'];
const fs = require('fs');

let output = '';
function log(msg) { output += msg + '\n'; }

async function run() {
    try {
        for (const db of databases) {
            log(`\n${'='.repeat(60)}`);
            log(`BASE DE DATOS: ${db}`);
            log(`${'='.repeat(60)}`);
            
            let pool = await new sql.ConnectionPool({...config, database: db}).connect();

            // Nombre empresa
            try {
                let data = await pool.request().query("SELECT TOP 1 nomcia, ruccia, dircia FROM confemp01");
                if (data.recordset.length > 0) {
                    let r = data.recordset[0];
                    log(`EMPRESA: ${(r.nomcia || '').trim()}`);
                    log(`RUC: ${(r.ruccia || '').trim()}`);
                    log(`DIR: ${(r.dircia || '').trim()}`);
                }
            } catch(e) { log("confemp01 no encontrada"); }

            // Sucursales
            try {
                let data = await pool.request().query("SELECT * FROM Tbl_Sucursal");
                log(`\nSUCURSALES (${data.recordset.length}):`);
                data.recordset.forEach(row => {
                    log(`  [${(row.CodSuc||'').trim()}] ${(row.NomSuc||'').trim()}`);
                });
            } catch(e) { log("Tbl_Sucursal no encontrada"); }

            // Puntos de venta
            try {
                let data = await pool.request().query("SELECT codpto, nompto, codsuc FROM tbl01pto");
                log(`\nPUNTOS DE VENTA / SEDES (${data.recordset.length}):`);
                data.recordset.forEach(row => {
                    log(`  [${(row.codpto||'').trim()}] ${(row.nompto||'').trim()} -> Sucursal: ${(row.codsuc||'').trim()}`);
                });
            } catch(e) { log("tbl01pto no encontrada"); }

            // Almacenes
            try {
                let data = await pool.request().query("SELECT codalm, nomalm FROM tbl01alm");
                log(`\nALMACENES (${data.recordset.length}):`);
                data.recordset.forEach(row => {
                    log(`  [${(row.codalm||'').trim()}] ${(row.nomalm||'').trim()}`);
                });
            } catch(e) { log("tbl01alm no encontrada"); }

            // Vendedores
            try {
                let data = await pool.request().query("SELECT codven, nomven, estado FROM tbl01ven WHERE estado = 1 OR estado = '1' OR estado = 'A'");
                log(`\nVENDEDORES ACTIVOS (${data.recordset.length}):`);
                data.recordset.forEach(row => {
                    log(`  [${(row.codven||'').trim()}] ${(row.nomven||'').trim()}`);
                });
            } catch(e) { log("tbl01ven no encontrada"); }

            await pool.close();
        }
    } catch (err) {
        log("Error global: " + err.message);
    }
    
    fs.writeFileSync('db-analysis.txt', output);
    console.log("Análisis completo guardado en db-analysis.txt");
    process.exit(0);
}

run();
