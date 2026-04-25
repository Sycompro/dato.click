const sql = require('mssql');
const config = {
    user: 'sa',
    password: 'Gimbra2022',
    server: '192.168.194.169',
    options: { encrypt: false, trustServerCertificate: true }
};

// Vamos a buscar en TODAS las tablas de TODAS las BDs alguna que tenga los nombres reales
const dbs = ['BdNava00','BdNava01','BdNava02','BdNava03','BdNava04','BdNava05'];

async function run() {
    for (const db of dbs) {
        const pool = await new sql.ConnectionPool({ ...config, database: db }).connect();
        console.log(`\n${'='.repeat(60)}`);
        console.log(`BASE DE DATOS: ${db}`);
        console.log('='.repeat(60));

        // Buscar tablas con columna "tienda" 
        try {
            const tiendas = await pool.request().query(`
                SELECT TABLE_NAME FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE COLUMN_NAME LIKE '%tienda%' OR COLUMN_NAME LIKE '%codtie%' OR COLUMN_NAME LIKE '%nomtie%'
            `);
            console.log('\nTablas con columnas de "tienda":');
            const unique = [...new Set(tiendas.recordset.map(r => r.TABLE_NAME))];
            console.log('  ', unique.join(', '));
        } catch(e) {}

        // Buscar tabla de tiendas
        try {
            const tables = await pool.request().query(`
                SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_TYPE='BASE TABLE' 
                AND (TABLE_NAME LIKE '%tiend%' OR TABLE_NAME LIKE '%store%')
            `);
            console.log('\nTablas de tienda:');
            for (const t of tables.recordset) {
                console.log('  Tabla:', t.TABLE_NAME);
                const data = await pool.request().query(`SELECT * FROM [${t.TABLE_NAME}]`);
                data.recordset.forEach(r => {
                    const cleaned = {};
                    for (const [k,v] of Object.entries(r)) {
                        cleaned[k] = typeof v === 'string' ? v.trim() : v;
                    }
                    console.log('    ', JSON.stringify(cleaned));
                });
            }
        } catch(e) {}

        // Buscar serie de factura - a veces el nombre de la tienda está en la serie
        try {
            const series = await pool.request().query(`
                SELECT TOP 10 RTRIM(ndocu) as ndocu, RTRIM(Codpto) as Codpto, RTRIM(CodAlm) as CodAlm
                FROM mst01fac 
                WHERE cdocu IN ('01','03') AND flag='0' AND YEAR(fecha) = 2025
                GROUP BY ndocu, Codpto, CodAlm
                ORDER BY ndocu
            `);
            console.log('\nSERIES de documentos (muestra):');
            series.recordset.forEach(r => console.log(`  ${r.ndocu} -> Pto:${r.Codpto}, Alm:${r.CodAlm}`));
        } catch(e) {}

        // Vista o SP de reportes
        try {
            const views = await pool.request().query(`
                SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS 
                WHERE TABLE_NAME LIKE '%venta%' OR TABLE_NAME LIKE '%sede%' OR TABLE_NAME LIKE '%sucur%'
            `);
            if (views.recordset.length > 0) {
                console.log('\nVISTAS de ventas/sedes:');
                views.recordset.forEach(r => console.log('  ', r.TABLE_NAME));
            }
        } catch(e) {}

        // confemp01 - datos empresa
        try {
            const cols = await pool.request().query(`
                SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'confemp01'
            `);
            if (cols.recordset.length > 0) {
                console.log('\nColumnas de confemp01:');
                console.log('  ', cols.recordset.map(c => c.COLUMN_NAME).join(', '));
                const data = await pool.request().query(`SELECT TOP 1 * FROM confemp01`);
                const r = data.recordset[0];
                const cleaned = {};
                for (const [k,v] of Object.entries(r)) {
                    if (typeof v === 'string' && v.trim()) cleaned[k] = v.trim();
                }
                console.log('  Datos:', JSON.stringify(cleaned));
            }
        } catch(e) {}

        await pool.close();
    }
    process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
