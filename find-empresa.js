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
        console.log(`\n${'='.repeat(60)}`);
        console.log(`BD: ${db}`);
        console.log('='.repeat(60));

        // Buscar columnas con nombre de empresa/razón social/RUC en TODAS las tablas
        const colSearch = await pool.request().query(`
            SELECT TABLE_NAME, COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE COLUMN_NAME LIKE '%razon%' 
               OR COLUMN_NAME LIKE '%razso%'
               OR COLUMN_NAME LIKE '%nomempre%'
               OR COLUMN_NAME LIKE '%noment%'
               OR COLUMN_NAME LIKE '%nomcia%'
               OR COLUMN_NAME LIKE '%ruccia%'
               OR COLUMN_NAME LIKE '%dircia%'
               OR COLUMN_NAME LIKE '%razonsocial%'
               OR COLUMN_NAME LIKE '%rzsocial%'
               OR COLUMN_NAME LIKE '%empresa%'
            ORDER BY TABLE_NAME
        `);

        console.log('\n🔍 Columnas con nombre de empresa:');
        const tablesWithEmpresa = [...new Set(colSearch.recordset.map(r => r.TABLE_NAME))];
        
        for (const tableName of tablesWithEmpresa) {
            const matchingCols = colSearch.recordset
                .filter(r => r.TABLE_NAME === tableName)
                .map(r => r.COLUMN_NAME);
            
            try {
                const selectStr = matchingCols.join(', ');
                const data = await pool.request().query(`SELECT TOP 1 ${selectStr} FROM [${tableName}]`);
                if (data.recordset.length > 0) {
                    const row = data.recordset[0];
                    const hasValue = Object.values(row).some(v => v && typeof v === 'string' && v.trim().length > 3);
                    if (hasValue) {
                        console.log(`  📌 ${tableName}:`);
                        for (const [k,v] of Object.entries(row)) {
                            if (v && typeof v === 'string' && v.trim()) {
                                console.log(`      ${k} = "${v.trim()}"`);
                            }
                        }
                    }
                }
            } catch(e) {}
        }

        // También buscar tblcia, tbl_cia, confcia, conf_cia, etc.
        const ciaTables = await pool.request().query(`
            SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_TYPE='BASE TABLE' 
            AND (TABLE_NAME LIKE 'tblcia%' OR TABLE_NAME LIKE 'tbl_cia%' 
                 OR TABLE_NAME LIKE 'confcia%' OR TABLE_NAME LIKE 'conf_cia%'
                 OR TABLE_NAME LIKE 'tbl01cia%' OR TABLE_NAME LIKE 'cia%'
                 OR TABLE_NAME LIKE '%licencia%')
        `);
        for (const t of ciaTables.recordset) {
            try {
                const data = await pool.request().query(`SELECT TOP 1 * FROM [${t.TABLE_NAME}]`);
                if (data.recordset.length > 0) {
                    console.log(`  📌 ${t.TABLE_NAME}:`);
                    const row = data.recordset[0];
                    for (const [k,v] of Object.entries(row)) {
                        if (v !== null && v !== '' && v !== 0) {
                            const val = typeof v === 'string' ? v.trim() : v;
                            if (val !== '') console.log(`      ${k} = ${JSON.stringify(val)}`);
                        }
                    }
                }
            } catch(e) {}
        }

        // Buscar en tbl_parametros
        try {
            const params = await pool.request().query(`
                SELECT * FROM tbl_parametros 
                WHERE CODPAR LIKE '%EMPRESA%' OR CODPAR LIKE '%CIA%' 
                   OR CODPAR LIKE '%RAZON%' OR CODPAR LIKE '%RUC%'
                   OR CODPAR LIKE '%NOMBRE%'
                   OR VALOR LIKE '%S.A.C%' OR VALOR LIKE '%E.I.R.L%'
            `);
            if (params.recordset.length > 0) {
                console.log('  📌 tbl_parametros (empresa/cia):');
                params.recordset.forEach(r => {
                    const cleaned = {};
                    for (const [k,v] of Object.entries(r)) {
                        if (v !== null && v !== '') cleaned[k] = typeof v === 'string' ? v.trim() : v;
                    }
                    console.log('    ', JSON.stringify(cleaned));
                });
            }
        } catch(e) {}

        await pool.close();
    }
    process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
