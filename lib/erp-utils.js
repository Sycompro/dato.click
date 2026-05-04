import sql from 'mssql';

/**
 * Utilidades centralizadas para integración con Navasoft ERP
 */

export const ERP_CONFIG = {
    TAX_RATE: 1.18,
    DEFAULT_WAREHOUSE: '01',
    DEFAULT_SEDE: '01'
};

/**
 * Resuelve el almacén (codalm) asignado a una sede (codpto)
 */
export async function getWarehouseForSede(pool, sedeId) {
    // Limpiar el sedeId para comparaciones
    const cleanSedeId = (sedeId || '').toString().trim();
    if (!cleanSedeId) return ERP_CONFIG.DEFAULT_WAREHOUSE;
    
    try {
        // Estrategia 1: Búsqueda exacta y con trim en la tabla de puntos de venta
        const ptoRes = await pool.request()
            .input('codpto', sql.VarChar(10), cleanSedeId)
            .query("SELECT TOP 1 codtie FROM tbl01pto WHERE LTRIM(RTRIM(codpto)) = @codpto OR codpto = @codpto");
        
        let codtie = '';
        if (ptoRes.recordset.length > 0) {
            codtie = ptoRes.recordset[0].codtie.trim();
        } else {
            // Estrategia 2: Si no hay match de punto de venta, intentar usar el ID directamente como tienda
            codtie = cleanSedeId.padStart(3, '0');
        }

        // Estrategia 3: Buscar el almacén asignado a esa tienda
        const almRes = await pool.request()
            .input('codtie', sql.Char(3), codtie)
            .query("SELECT TOP 1 codalm FROM tbl01Alm WHERE LTRIM(RTRIM(codtie)) = LTRIM(RTRIM(@codtie))");
        
        if (almRes.recordset.length > 0) {
            return almRes.recordset[0].codalm.trim();
        }

        // Estrategia 4: Fallback final usando los últimos 2 dígitos del ID limpio
        // Esto es común en Navasoft (Tienda 003 -> Almacén 03)
        const digits = cleanSedeId.match(/\d+/);
        if (digits) {
            return digits[0].padStart(2, '0').slice(-2);
        }
    } catch (error) {
        console.error('[ERP Utils] Error resolving warehouse:', error);
    }
    return ERP_CONFIG.DEFAULT_WAREHOUSE;
}

/**
 * Retorna el nombre de la tabla de stock para un almacén dado
 */
export function getStockTableName(warehouse) {
    // Forzamos siempre la tabla maestra prd0101 según la lógica que funcionaba
    return `prd0101`;
}

/**
 * Retorna el nombre de la columna de stock en prd0101 para un almacén dado
 */
export function getStockColumnName(warehouse) {
    const formatted = (warehouse || ERP_CONFIG.DEFAULT_WAREHOUSE).padStart(2, '0');
    return `stk${formatted}`;
}

/**
 * Calcula el desglose de IGV para un monto total
 */
export function calculateTaxBreakdown(total, isTaxed = true) {
    if (!isTaxed) {
        return {
            total: Number(total),
            subtotal: Number(total),
            tax: 0
        };
    }
    const subtotal = total / ERP_CONFIG.TAX_RATE;
    return {
        total: Number(total),
        subtotal: Number(subtotal),
        tax: Number(total - subtotal)
    };
}
