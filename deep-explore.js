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

            // 1. Buscar tabla de configuración de empresa (confemp01, Tbl_Grupo_Empresarial, etc.)
            console.log("\n--- confemp01 (Config Empresa) ---");
            try {
                let cols = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='confemp01'");
                console.log("Columnas:", cols.recordset.map(r => r.COLUMN_NAME).join(', '));
                let data = await pool.request().query("SELECT TOP 1 * FROM confemp01");
                if (data.recordset.length > 0) {
                    let row = data.recordset[0];
                    // Imprimir cada campo
                    for (let key of Object.keys(row)) {
                        if (row[key] && String(row[key]).trim()) {
                            console.log(`  ${key}: ${String(row[key]).substring(0, 80)}`);
                        }
                    }
                }
            } catch(e) { console.log("No existe o error:", e.message.substring(0,60)); }

            // 2. Buscar Sucursales
            console.log("\n--- Tbl_Sucursal ---");
            try {
                let cols = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Tbl_Sucursal'");
                console.log("Columnas:", cols.recordset.map(r => r.COLUMN_NAME).join(', '));
                let data = await pool.request().query("SELECT * FROM Tbl_Sucursal");
                data.recordset.forEach(row => {
                    console.log("  ->", JSON.stringify(row));
                });
            } catch(e) { console.log("No existe o error:", e.message.substring(0,60)); }

            // 3. Buscar tbl01alm (Almacenes - a veces representan sedes)
            console.log("\n--- tbl01alm (Almacenes) ---");
            try {
                let cols = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='tbl01alm'");
                console.log("Columnas:", cols.recordset.map(r => r.COLUMN_NAME).join(', '));
                let data = await pool.request().query("SELECT * FROM tbl01alm");
                data.recordset.forEach(row => {
                    console.log("  ->", JSON.stringify(row));
                });
            } catch(e) { console.log("No existe o error:", e.message.substring(0,60)); }

            // 4. Buscar tbl01scc (Secciones / Sucursales)
            console.log("\n--- tbl01scc (Sucursales/Secciones) ---");
            try {
                let cols = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='tbl01scc'");
                console.log("Columnas:", cols.recordset.map(r => r.COLUMN_NAME).join(', '));
                let data = await pool.request().query("SELECT * FROM tbl01scc");
                data.recordset.forEach(row => {
                    console.log("  ->", JSON.stringify(row));
                });
            } catch(e) { console.log("No existe o error:", e.message.substring(0,60)); }

            // 5. Buscar tbl01pto (Puntos de venta)
            console.log("\n--- tbl01pto (Puntos de Venta) ---");
            try {
                let cols = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='tbl01pto'");
                console.log("Columnas:", cols.recordset.map(r => r.COLUMN_NAME).join(', '));
                let data = await pool.request().query("SELECT * FROM tbl01pto");
                data.recordset.forEach(row => {
                    console.log("  ->", JSON.stringify(row));
                });
            } catch(e) { console.log("No existe o error:", e.message.substring(0,60)); }

            // 6. Vendedores de esta empresa
            console.log("\n--- tbl01ven (Vendedores) ---");
            try {
                let data = await pool.request().query("SELECT codven, nomven, estado FROM tbl01ven WHERE estado != 'I' OR estado IS NULL");
                data.recordset.forEach(row => {
                    console.log(`  [${row.codven}] ${row.nomven} (${row.estado || 'activo'})`);
                });
            } catch(e) { console.log("No existe o error:", e.message.substring(0,60)); }

            await pool.close();
        }
    } catch (err) {
        console.error("Error global:", err.message);
    }
    sql.close();
}

run();
