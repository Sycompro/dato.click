import sql from 'mssql';

// Determinar si estamos en modo Túnel (Railway + Cloudflare)
const isTunnelMode = process.env.CF_CLIENT_ID && process.env.CF_CLIENT_SECRET;

const sqlConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    // Si hay túnel, forzamos 127.0.0.1 porque start.sh mapea db.syscom.click ahí
    server: isTunnelMode ? '127.0.0.1' : (process.env.DB_SERVER || '127.0.0.1'),
    port: parseInt(process.env.DB_PORT) || 1433,
    connectionTimeout: 30000,
    requestTimeout: 30000,
    pool: {
        max: 50,
        min: 0,
        idleTimeoutMillis: 30000
    },
    options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: true,
    }
};

const pools = {};

export const getConnection = async (databaseName = process.env.DB_NAME_MASTER || process.env.DB_NAME || 'master') => {
    let retries = 3;
    while (retries > 0) {
        try {
            if (pools[databaseName]) {
                const pool = await pools[databaseName];
                if (pool.connected) return pool;
                delete pools[databaseName];
            }

            const configForDb = { ...sqlConfig, database: databaseName };
            console.log(`[SQL] Attempting connection to ${databaseName} via ${sqlConfig.server} (${retries} retries left)...`);
            
            const poolPromise = new sql.ConnectionPool(configForDb).connect();
            pools[databaseName] = poolPromise;
            const pool = await poolPromise;
            
            console.log(`[SQL] CONNECTED: ${databaseName}`);
            return pool;
        } catch (err) {
            retries--;
            console.error(`[SQL] CONNECTION FAILED for ${databaseName}:`, err.message);
            delete pools[databaseName];
            
            if (retries === 0) throw err;
            console.log(`[SQL] Retrying in 2 seconds...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
};
