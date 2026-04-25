import "./globals.css";

export const metadata = {
  title: "dato.click — Panel de Inteligencia Comercial",
  description: "Sistema de estadísticas y analítica de ventas conectado al ERP Navasof. Consulta en tiempo real vía ZeroTier.",
};

import { Providers } from "@/components/Providers";

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
