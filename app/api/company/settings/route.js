import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import sql from 'mssql';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    try {
        const dbName = session?.user?.company;
        const pool = await getConnection(dbName);
        const masterPool = await getConnection('BdNavaSys');
        const dbCode = session?.user?.company?.replace('BdNava', '').padStart(2, '0') || '01';

        // 1. Obtener datos globales de la Cia (Emisor) desde SQL Server Maestro
        let emisor = { nomcia: 'MI EMPRESA', ruccia: '', dircia: '' };
        try {
            const sysRes = await masterPool.request()
                .input('code', sql.Char(3), dbCode)
                .query("SELECT nomcia, ruccia, dircia FROM sysnavacia WHERE codcia LIKE @code + '%'");
            if (sysRes.recordset.length > 0) emisor = sysRes.recordset[0];
        } catch (e) {
            console.warn("[Settings] Error SQL Server Maestro:", e.message);
        }

        // 2. Obtener configuración personalizada desde SQL Server (tbl_pos_settings)
        let webConfig = { custom_name: '', use_custom_name: 0, company_logo_url: '', business_type: 'gym' };
        try {
            const posRes = await pool.request().query("SELECT whatsapp_url, whatsapp_token, company_logo_url, custom_name, business_type FROM tbl_pos_settings WHERE id=1");
            if (posRes.recordset.length > 0) {
                webConfig = {
                    ...webConfig,
                    ...posRes.recordset[0]
                };
            }
        } catch (e) {
            console.warn("[Settings] Tabla tbl_pos_settings no existe aún o error:", e.message);
        }

        // 3. Obtener datos de la Sede
        const sedeCode = session.user.sedeId || '01';
        const sedeRes = await pool.request()
            .input('codpto', sql.Char(6), sedeCode)
            .query(`
                SELECT P.nompto, T.DirTie, T.TelTie 
                FROM tbl01pto P
                LEFT JOIN tbl_tienda T ON P.codtie = T.codtie
                WHERE P.codpto = @codpto
            `);
        
        const sede = sedeRes.recordset[0] || {};

        return NextResponse.json({
            company: {
                name: (webConfig.custom_name) ? webConfig.custom_name : (emisor.nomcia?.trim() || sede.nompto?.trim() || 'Empresa'),
                legalName: emisor.nomcia?.trim() || 'Empresa POS',
                commercialName: (webConfig.custom_name) ? webConfig.custom_name : (emisor.nomcia?.trim() || sede.nompto?.trim() || 'Empresa'),
                ruc: emisor.ruccia?.trim() || '',
                address: sede.DirTie?.trim() || emisor.dircia?.trim() || '',
                phone: sede.TelTie?.trim() || emisor.telcia?.trim() || '',
                email: emisor.email?.trim() || '',
                logo: webConfig.company_logo_url || '',
                businessType: webConfig.business_type || 'gym',
                // Datos para el modal
                rawName: emisor.nomcia?.trim(),
                customName: webConfig.custom_name,
                useCustomName: !!webConfig.custom_name
            },
            pointOfSale: {
                name: sede.nompto?.trim() || 'SUCURSAL PRINCIPAL',
                code: sedeCode
            },
            whatsapp: {
                url: webConfig.whatsapp_url || '',
                token: webConfig.whatsapp_token || ''
            }
        });
    } catch (err) {
        console.error('Error fetching settings:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(request) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    try {
        const { customName, companyLogoUrl, businessType, whatsappUrl, whatsappToken } = await request.json();
        const dbName = session?.user?.company;
        const pool = await getConnection(dbName);

        // Asegurar que la tabla existe
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tbl_pos_settings' AND xtype='U')
            BEGIN
                CREATE TABLE tbl_pos_settings (id INT PRIMARY KEY DEFAULT 1, whatsapp_url VARCHAR(255), whatsapp_token VARCHAR(255), company_logo_url VARCHAR(MAX), custom_name VARCHAR(255), business_type VARCHAR(50), CHECK (id = 1));
                INSERT INTO tbl_pos_settings (id) VALUES (1);
            END
            ELSE 
            BEGIN
                IF NOT EXISTS (SELECT * FROM syscolumns WHERE id = OBJECT_ID('tbl_pos_settings') AND name = 'company_logo_url')
                    ALTER TABLE tbl_pos_settings ADD company_logo_url VARCHAR(MAX);
                IF NOT EXISTS (SELECT * FROM syscolumns WHERE id = OBJECT_ID('tbl_pos_settings') AND name = 'custom_name')
                    ALTER TABLE tbl_pos_settings ADD custom_name VARCHAR(255);
                IF NOT EXISTS (SELECT * FROM syscolumns WHERE id = OBJECT_ID('tbl_pos_settings') AND name = 'business_type')
                    ALTER TABLE tbl_pos_settings ADD business_type VARCHAR(50);
            END
        `);


        await pool.request()
            .input('name', sql.VarChar(255), customName || '')
            .input('logo', sql.VarChar(sql.MAX), companyLogoUrl || '')
            .input('type', sql.VarChar(50), businessType || 'gym')
            .input('waUrl', sql.VarChar(255), whatsappUrl || '')
            .input('waToken', sql.VarChar(255), whatsappToken || '')
            .query(`
                UPDATE tbl_pos_settings 
                SET company_logo_url = CASE WHEN @logo <> '' THEN @logo ELSE company_logo_url END,
                    custom_name = @name,
                    business_type = @type,
                    whatsapp_url = @waUrl,
                    whatsapp_token = @waToken
                WHERE id=1
            `);

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Error saving web settings:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
