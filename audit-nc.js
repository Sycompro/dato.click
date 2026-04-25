const sql = require('mssql');
const config = {
    user: 'sa',
    password: 'Gimbra2022',
    server: '192.168.194.169',
    options: { encrypt: false, trustServerCertificate: true }
};

async function run() {
    const dbs = ['BdNava01', 'BdNava02']; // Sample DBs
    for (const db of dbs) {
        const pool = await new sql.ConnectionPool({ ...config, database: db }).connect();
        
        console.log(`\n=== BD: ${db} ===`);
        // Select credit notes (07)
        const q = `
            SELECT TOP 5
                RTRIM(f.cdocu) as doc,
                CONVERT(VARCHAR, f.fecha, 23) as fecha,
                f.totn,
                f.toti
            FROM mst01fac f
            WHERE f.flag = '0' AND RTRIM(f.cdocu) = '07'
        `;
        const rt = await pool.request().query(q);
        console.log(rt.recordset);
        await pool.close();
    }
}

run().catch(console.error);
