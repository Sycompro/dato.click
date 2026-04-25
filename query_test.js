const sql = require('mssql');
const config = {
    user: 'sa', password: 'Odin2024$$', server: '192.168.194.169', database: 'BdNava00', options: { encrypt: false, trustServerCertificate: true }
};
sql.connect(config).then(pool => {
    return pool.request().query("SELECT name FROM sys.tables WHERE name LIKE '%cia%' OR name LIKE '%emp%' OR name LIKE '%par%' OR name LIKE '%cfg%' OR name LIKE '%loc%' OR name LIKE '%sed%'");
}).then(res => {
    console.log("Tables:");
    console.log(JSON.stringify(res.recordset));
    process.exit(0);
}).catch(console.error);
