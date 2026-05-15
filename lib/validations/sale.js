import { z } from 'zod';

export const saleSchema = z.object({
  docType: z.enum(['01', '03', '65'], {
    errorMap: () => ({ message: "Tipo de documento inválido (Debe ser 01, 03 o 65)" })
  }),
  codcli: z.string().min(1, "El código de cliente es obligatorio"),
  nomcli: z.string().min(1, "El nombre del cliente es obligatorio"),
  ruccli: z.string().optional().default(''),
  items: z.array(z.object({
    id: z.string(),
    name: z.string(),
    price: z.number(),
    quantity: z.number().positive("La cantidad debe ser mayor a 0"),
    userCode: z.string().optional().default(''),
    brand: z.string().optional().default(''),
    membershipDays: z.number().optional().default(0)
  })).min(1, "La venta debe tener al menos un producto"),
  payments: z.array(z.object({
    id: z.string(),
    amount: z.number().positive(),
    type: z.number().int(),
    name: z.string().optional()
  })).min(1, "Debe especificar al menos un método de pago"),
  idApeCaj: z.number().int("El ID de apertura de caja es obligatorio"),
  warehouse: z.string().default('01'),
  codven: z.string().default('V0001'),
  exchangeRate: z.number().default(1),
  customStartDate: z.string().optional().nullable()
});
