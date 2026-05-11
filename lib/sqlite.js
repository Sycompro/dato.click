import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

let db = null;

export async function getSQLiteDb() {
    if (db) return db;

    const dbPath = path.join(process.cwd(), 'web_pos_settings.db');
    
    db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    // Crear tabla de configuraciones si no existe
    await db.exec(`
        CREATE TABLE IF NOT EXISTS web_config (
            company_id TEXT PRIMARY KEY,
            custom_name TEXT,
            use_custom_name INTEGER DEFAULT 0
        )
    `);

    return db;
}
