import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getConnection } from '../../../lib/db';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";

const ALL_DBS = ['BdNava01','BdNava02','BdNava04','BdNava05'];

// Colores e iconos predefinidos para asignar a las bases de datos en orden
const STYLES = {
    'BdNava01': { color: '#ec4899', bg: '#fce8f3', icon: 'Store' },
    'BdNava02': { color: '#10b981', bg: '#e6f7f0', icon: 'Warehouse' },
    'BdNava04': { color: '#6366f1', bg: '#f0ecff', icon: 'Briefcase' },
    'BdNava05': { color: '#f59e0b', bg: '#fef6e7', icon: 'Award' },
};

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ success: false, error: 'Acceso Denegado' }, { status: 401 });

    try {
        const companies = [];
        for (let i = 0; i < ALL_DBS.length; i++) {
            const dbId = ALL_DBS[i];
            const pool = await getConnection(dbId);
            
            let name = dbId;
            let ruc = '';
            
            try {
                // Buscamos el nombre real de la empresa en la tabla emisor de Navasof
                const emisor = await pool.request().query(
                    `SELECT TOP 1 RTRIM(nomcia) as nomcia, RTRIM(ruccia) as ruccia FROM tbl_enavasoft_emisor`
                );
                if (emisor.recordset.length > 0) {
                    name = emisor.recordset[0].nomcia || dbId;
                    ruc = emisor.recordset[0].ruccia || '';
                }
            } catch (e) {
                console.error(`Error al leer emisor de ${dbId}:`, e.message);
            }
            
            // Si el nombre sigue siendo el default, es porque la tabla no existe o está vacía
            // Pero como la instrucción es mostrar solo lo real, mostramos el nombre que venga del ERP
            const style = STYLES[dbId] || STYLES['BdNava01'];
            companies.push({
                id: dbId,
                name: name,
                ruc: ruc,
                color: style.color,
                bg: style.bg,
                iconStr: style.icon
            });
        }
        
        return NextResponse.json({ success: true, data: companies });
    } catch (error) {
        console.error("Companies API Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
