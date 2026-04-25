const sql = require('mssql');

const config = {
    user: 'sa',
    password: 'Gimbra2022',
    server: '192.168.194.169',
    options: { encrypt: false, trustServerCertificate: true }
};

const databases = ['BdNava00','BdNava01','BdNava02','BdNava03','BdNava04','BdNava05'];

async function run() {
    try {
        for (const db of databases) {
            console.log(`\n${'='.repeat(60)}`);
            console.log(`BASE DE DATOS: ${db}`);
            console.log(`${'='.repeat(60)}`);
            
            let pool = await new sql.ConnectionPool({...config, database: db}).connect();

            // 1. Nombre de Empresa desde confemp01
            try {
                let data = await pool.request().query("SELECT TOP 1 nomcia, ruccia, dircia FROM confemp01");
                if (data.recordset.length > 0) {
                    let r = data.recordset[0];
                    console.log(`EMPRESA: ${(r.nomcia || '').trim()}`);
                    console.log(`RUC: ${(r.ruccia || '').trim()}`);
                    console.log(`DIR: ${(r.dircia || '').trim()}`);
                }
            } catch(e) { console.log("confemp01 no encontrada"); }

            // 2. Sucursales
            try {
                let data = await pool.request().query("SELECT * FROM Tbl_Sucursal");
                console.log(`\nSUCURSALES (${data.recordset.length}):`);
                data.recordset.forEach(row => {
                    let keys = Object.keys(row);
                    let vals = keys.map(k => `${k}=${String(row[k]).trim()}`).join(' | ');
                    console.log(`  ${vals}`);
                });
            } catch(e) { console.log("Tbl_Sucursal no encontrada"); }

            // 3. Puntos de venta (sedes físicas)
            try {
                let data = await pool.request().query("SELECT codpto, nompto, codsuc FROM tbl01pto");
                console.log(`\nPUNTOS DE VENTA / SEDES (${data.recordset.length}):`);
                data.recordset.forEach(row => {
                    console.log(`  [${(row.codpto||'').trim()}] ${(row.nompto||'').trim()} -> Sucursal: ${(row.codsuc||'').trim()}`);
                });
            } catch(e) { console.log("tbl01pto no encontrada"); }

            // 4. Almacenes (a veces son sedes)
            try {
                let data = await pool.request().query("SELECT codalm, nomalm FROM tbl01alm");
                console.log(`\nALMACENES (${data.recordset.length}):`);
                data.recordset.forEach(row => {
                    console.log(`  [${(row.codalm||'').trim()}] ${(row.nomalm||'').trim()}`);
                });
            } catch(e) { console.log("tbl01alm no encontrada"); }

            // 5. Vendedores activos
            try {
                let data = await pool.request().query("SELECT codven, nomven, estado FROM tbl01ven");
                console.log(`\nVENDEDORES (${data.recordset.length}):`);
                data.recordset.forEach(row => {
                    console.log(`  [${(row.codven||'').trim()}] ${(row.nomven||'').trim()} (estado: ${row.estado})`);
                });
            } catch(e) { console.log("tbl01ven no encontrada"); }

            await pool.close();
        }
    } catch (err) {
        console.error("Error global:", err.message);
    }
    process.exit(0);
}

run();
