import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { getConnection } from "@/lib/db";
import sql from "mssql";

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    CredentialsProvider({
      name: "ERP Credentials",
      credentials: {
        code: { label: "Código Empresa", type: "text" },
        username: { label: "Usuario", type: "text" },
        password: { label: "Contraseña", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.code || !credentials?.username || !credentials?.password) {
          throw new Error("Faltan credenciales");
        }

        try {
          // Paso 1: Buscar empresa en confemp01 (igual que psventa.exe LoginService)
          const mainPool = await getConnection('BdNava01');
          const empresaResult = await mainPool.request()
            .input('code', credentials.code)
            .query("SELECT EmpresaId, Codigo, Base, Server, Usuario, Clave FROM confemp01 WHERE Codigo = @code AND Estado = 1");

          if (empresaResult.recordset.length === 0) {
            console.error("[Auth] Código de empresa no encontrado:", credentials.code);
            return null;
          }

          const empresa = empresaResult.recordset[0];
          const dbName = empresa.Base?.trim();
          const dbServer = empresa.Server?.trim();
          const empresaId = empresa.EmpresaId;

          // Paso 2: Conectar a la base de datos de la empresa y validar usuario/contraseña
          // contra tablas Sede + Empresa (igual que psventa.exe SeatService)
          const empresaPool = await getConnection(dbName);
          const seatResult = await empresaPool.request()
            .input('usuario', credentials.username)
            .input('clave', credentials.password)
            .query(`
              SELECT 
                S.SedeId, S.Direccion AS SedeName, S.DetalleDireccion AS SedeAddress,
                E.EmpresaId, E.RazonSocial, E.Ruc, E.Direccion AS EmpresaDireccion
              FROM Sede AS S
              INNER JOIN Empresa AS E ON S.EmpresaId = E.EmpresaId
              WHERE S.Usuario = @usuario AND S.Clave = @clave
            `);

          if (seatResult.recordset.length > 0) {
            const seat = seatResult.recordset[0];
            return {
              id: String(seat.SedeId),
              name: seat.RazonSocial?.trim() || 'Empresa',
              username: credentials.username,
              company: dbName,
              empresaId: seat.EmpresaId,
              sedeId: seat.SedeId,
              sedeName: seat.SedeName?.trim(),
              ruc: seat.Ruc?.trim(),
              address: seat.EmpresaDireccion?.trim(),
            };
          }

          return null;
        } catch (err) {
          console.error("[Auth] Error:", err.message);
          return null;
        }
      }
    })
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account.provider === "google") {
        const allowedEmails = process.env.ALLOWED_EMAILS 
            ? process.env.ALLOWED_EMAILS.split(',').map(e => e.trim().toLowerCase()) 
            : [];
        return allowedEmails.includes(user.email.toLowerCase());
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.company = user.company;
        token.username = user.username;
        token.empresaId = user.empresaId;
        token.sedeId = user.sedeId;
        token.sedeName = user.sedeName;
        token.ruc = user.ruc;
        token.address = user.address;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.company = token.company;
        session.user.username = token.username;
        session.user.empresaId = token.empresaId;
        session.user.sedeId = token.sedeId;
        session.user.sedeName = token.sedeName;
        session.user.ruc = token.ruc;
        session.user.address = token.address;
      }
      return session;
    }
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  }
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
