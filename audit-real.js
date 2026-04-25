const sql = require('mssql');
const config = {
    user: 'sa',
    password: 'Gimbra2022',
    server: '192.168.194.169',
    options: { encrypt: false, trustServerCertificate: true }
};

const dbs = ['BdNava00','BdNava01','BdNava02','BdNava03','BdNava04','BdNava05'];

async function run() {
    for (const db of dbs) {
        const pool = await new sql.ConnectionPool({ ...config, database: db }).connect();
        
        console.log('\n' + '='.repeat(70));
        console.log(`BASE DE DATOS: ${db}`);
        console.log('='.repeat(70));

        // 1. Buscar NOMBRE REAL de la empresa en TODAS las tablas posibles
        const empresaTables = [
            { table: 'confemp01', cols: '*' },
            { table: 'tbl_empresa', cols: '*' },
            { table: 'confcia01', cols: '*' },
            { table: 'tblcia', cols: '*' },
            { table: 'tbl01cia', cols: '*' },
        ];

        for (const t of empresaTables) {
            try {
                const r = await pool.request().query(`SELECT TOP 1 ${t.cols} FROM [${t.table}]`);
                if (r.recordset.length > 0) {
                    console.log(`\n✅ TABLA ${t.table}:`);
                    const row = r.recordset[0];
                    for (const [k, v] of Object.entries(row)) {
                        if (v !== null && v !== '' && v !== 0) {
                            const val = typeof v === 'string' ? v.trim() : v;
                            if (val !== '' && val !== '1900-01-01T00:00:00.000Z') {
                                console.log(`    ${k}: ${val}`);
                            }
                        }
                    }
                }
            } catch(e) {
                // tabla no existe, seguir
            }
        }

        // 2. Buscar tablas que puedan contener el nombre de la empresa
        try {
            const tables = await pool.request().query(`
                SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_TYPE='BASE TABLE' 
                AND (TABLE_NAME LIKE '%conf%' OR TABLE_NAME LIKE '%cia%' 
                     OR TABLE_NAME LIKE '%empr%' OR TABLE_NAME LIKE '%param%'
                     OR TABLE_NAME LIKE '%config%' OR TABLE_NAME LIKE '%datos%')
                ORDER BY TABLE_NAME
            `);
            console.log('\n📋 TABLAS DE CONFIGURACIÓN/EMPRESA:');
            for (const t of tables.recordset) {
                console.log(`    ${t.TABLE_NAME}`);
                // Intentar leer columnas que puedan tener nombre/ruc
                try {
                    const cols = await pool.request().query(`
                        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
                        WHERE TABLE_NAME = '${t.TABLE_NAME}' 
                        AND (COLUMN_NAME LIKE '%nom%' OR COLUMN_NAME LIKE '%raz%' 
                             OR COLUMN_NAME LIKE '%ruc%' OR COLUMN_NAME LIKE '%cia%'
                             OR COLUMN_NAME LIKE '%emp%' OR COLUMN_NAME LIKE '%desc%')
                    `);
                    if (cols.recordset.length > 0) {
                        const colNames = cols.recordset.map(c => c.COLUMN_NAME);
                        const selectCols = colNames.join(', ');
                        try {
                            const data = await pool.request().query(`SELECT TOP 1 ${selectCols} FROM [${t.TABLE_NAME}]`);
                            if (data.recordset.length > 0) {
                                const row = data.recordset[0];
                                for (const [k, v] of Object.entries(row)) {
                                    if (v && typeof v === 'string' && v.trim()) {
                                        console.log(`      → ${k}: "${v.trim()}"`);
                                    }
                                }
                            }
                        } catch(e2) {}
                    }
                } catch(e2) {}
            }
        } catch(e) {}

        // 3. Buscar en la tabla confcia (configuración de la compañía)
        try {
            const tables = await pool.request().query(`
                SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_TYPE='BASE TABLE' 
                AND TABLE_NAME LIKE '%cia%'
            `);
            for (const t of tables.recordset) {
                try {
                    const r = await pool.request().query(`SELECT TOP 3 * FROM [${t.TABLE_NAME}]`);
                    if (r.recordset.length > 0) {
                        console.log(`\n📌 ${t.TABLE_NAME} (${r.recordset.length} filas):`);
                        r.recordset.forEach(row => {
                            const cleaned = {};
                            for (const [k,v] of Object.entries(row)) {
                                if (v !== null && v !== '' && v !== 0) {
                                    cleaned[k] = typeof v === 'string' ? v.trim() : v;
                                }
                            }
                            if (Object.keys(cleaned).length > 0) {
                                console.log('    ', JSON.stringify(cleaned));
                            }
                        });
                    }
                } catch(e2) {}
            }
        } catch(e) {}

        // 4. Tiendas y sedes
        console.log('\n🏪 TIENDAS (tbl_tienda):');
        try {
            const r = await pool.request().query('SELECT codtie, RTRIM(nomtie) as nomtie, RTRIM(DirTie) as DirTie, estado FROM tbl_tienda');
            r.recordset.forEach(t => console.log(`    [${t.codtie.trim()}] ${t.nomtie} | ${t.DirTie} | estado=${t.estado}`));
        } catch(e) { console.log('    No existe'); }

        console.log('\n🏢 SUCURSALES (Tbl_Sucursal):');
        try {
            const r = await pool.request().query('SELECT * FROM Tbl_Sucursal');
            r.recordset.forEach(s => {
                const cleaned = {};
                for (const [k,v] of Object.entries(s)) {
                    cleaned[k] = typeof v === 'string' ? v.trim() : v;
                }
                console.log('    ', JSON.stringify(cleaned));
            });
        } catch(e) { console.log('    No existe'); }

        await pool.close();
    }
    process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
