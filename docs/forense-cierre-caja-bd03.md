# Ingeniería Forense: Sistema de Cierre de Caja Navasoft (BD03)

Este documento detalla los hallazgos técnicos extraídos del análisis de la base de datos `BdNava03` y el comportamiento del ERP Navasoft para la implementación del Cierre de Caja en el POS Web.

## 1. Mapeo de Datos Financieros (Cálculos)
Se ha confirmado que Navasoft utiliza una nomenclatura no estándar para los campos de monto en la tabla `mst01fac`:
- **`tota`**: Monto NETO (Base Imponible sin impuestos).
- **`toti`**: Monto del IGV.
- **`totn`**: Monto TOTAL (Lo que el cliente paga físicamente).
- **Fórmula de Cuadre**: `tota + toti = totn`.

## 2. Configuración de Medios de Pago (Específico BD03)
A diferencia de otras empresas, la `BdNava03` utiliza los siguientes códigos maestros:

### Formas de Pago (`codfdp`)
- **01**: EFECTIVO
- **03**: TARJETA
- **04**: BANCO (Transferencias)

### Clasificación de Billeteras y Tarjetas (`codtar`)
Cuando el `codfdp` es `03` o `04`, se debe especificar el origen en `codtar`:
- **01**: YAPE
- **02**: PLIN
- **03**: TARJETA (Crédito/Débito)
- **04**: TRANSFERENCIA

## 3. Lógica del Reporte de Ventas (Z)
Para replicar el ticket de cierre del ERP, se deben seguir estas agrupaciones:

### Liquidación de Venta
- **Efectivo en Caja**: Sumatoria de `totn` donde `codfdp = 01` menos los egresos de `dtl_restpos_egrcaja`.
- **Venta Electrónica**: Sumatoria desglosada por `codtar` (Yape, Plin, Tarjeta).

### Venta por Líneas/Grupos
La agrupación de productos se realiza mediante el campo `codfam` de la tabla `prd0101`, vinculado con `tbl01fam`. 
Categorías detectadas en BD03:
1. SERVICIOS
2. PRODUCTOS
3. NUTRICIONISTA
4. ENTRENADOR
5. SICÓLOGO
6. TERAPIAS

## 4. Proceso Técnico de Cierre
El cierre de caja no requiere la creación de un documento físico de venta (tipo 65) de forma obligatoria, sino que se basa en el cambio de estado de la sesión:
- **Tabla**: `dtl_restpos_apecaj`
- **Acción**: Actualizar `estado = 1`, `feccie = [FECHA ACTUAL]` y `hora = [HORA ACTUAL]`.
- **Bloqueo**: Una vez que el `estado` es 1, el POS no debe permitir más inserciones en `mst01fac` con ese `idapecaj`.

## 5. Hallazgos Críticos (Detectados en el Análisis)
Se detectó que el POS Web actualmente tiene una discrepancia en la inserción de ventas para la BD03:
- Las ventas mixtas o con tarjeta están dejando el campo `codfdp` vacío (`  `).
- Los códigos de tarjeta (`codtar`) están usando valores de la BD01 (ej. 04, 06) que no existen o son incorrectos en la BD03.
- *Nota: Se requiere actualizar `app/api/sales/finalize/route.js` con los códigos de la sección 2 de este documento.*

---
**Estado de la Investigación**: COMPLETADA
**Fecha**: 04 de Mayo, 2026
