const sql = require('mssql');

const config = {
    user: 'sa',
    password: 'Gimbra2022',
    server: '192.168.194.169',
    database: 'master', // Probamos primero con master
    options: {
        encrypt: false, // For local dev
        trustServerCertificate: true
    }
};

async function testConnection() {
    try {
        console.log("Connecting to SQL Server at 192.168.194.169...");
        let pool = await sql.connect(config);
        let result = await pool.request().query('SELECT name FROM sys.databases');
        console.log("Connection successful!");
        console.log("Databases found:");
        result.recordset.forEach(db => {
            console.log(`- ${db.name}`);
        });
        sql.close();
    } catch (err) {
        console.error("SQL Connection Error:", err.message);
    }
}

testConnection();
