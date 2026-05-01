import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { getConnection } from "@/lib/db";
import sql from "mssql";

// Función de "encriptación" Navasoft (suma 105 al código ASCII)
function navasoftEncrypt(password) {
    if (!password) return "";
    return password.split('').map(c => String.fromCharCode(c.charCodeAt(0) + 105)).join('');
}

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
          // Paso 1: Buscar configuración de conexión en BdNava01 (igual que psventa.exe)
          const masterPool = await getConnection('BdNava01');
          const empresaResult = await masterPool.request()
            .input('code', credentials.code)
            .query("SELECT Base FROM confemp01 WHERE Codigo = @code AND Estado = 1");

          if (empresaResult.recordset.length === 0) {
            console.error("[Auth] Código de empresa no encontrado en confemp01:", credentials.code);
            return null;
          }

          const dbName = empresaResult.recordset[0].Base.trim();
          console.log(`[Auth] Conectando a base de datos de empresa: ${dbName}`);
          const empresaPool = await getConnection(dbName);
          
          // Paso 2: Intentar autenticación según el esquema disponible
          
          // 2.1 Esquema ERP (TBL_USUARIO con Clave ofuscada)
          try {
             const encryptedPass = navasoftEncrypt(credentials.password);
             const erpResult = await empresaPool.request()
                .input('usuario', credentials.username)
                .input('clave', encryptedPass)
                .query("SELECT Usuario, Nombres + ' ' + Apellidos as FullName FROM TBL_USUARIO WHERE Usuario = @usuario AND Clave = @clave AND Estado = 1");
             
             if (erpResult.recordset.length > 0) {
                const user = erpResult.recordset[0];
                return {
                  id: user.Usuario,
                  name: user.FullName?.trim() || user.Usuario,
                  username: user.Usuario,
                  company: dbName,
                  schema: 'ERP'
                };
             }
          } catch (e) {
             console.log(`[Auth] Esquema TBL_USUARIO no disponible en ${dbName}`);
          }

          // 2.2 Esquema POS (Sede + Empresa con Clave en plano)
          try {
             const posResult = await empresaPool.request()
                .input('usuario', credentials.username)
                .input('clave', credentials.password)
                .query(`
                  SELECT S.SedeId, S.Direccion AS SedeName, E.RazonSocial, E.Ruc, E.EmpresaId
                  FROM Sede AS S
                  INNER JOIN Empresa AS E ON S.EmpresaId = E.EmpresaId
                  WHERE S.Usuario = @usuario AND S.Clave = @clave
                `);
             
             if (posResult.recordset.length > 0) {
                const seat = posResult.recordset[0];
                return {
                  id: String(seat.SedeId),
                  name: seat.RazonSocial?.trim() || 'Sede POS',
                  username: credentials.username,
                  company: dbName,
                  empresaId: seat.EmpresaId,
                  sedeId: seat.SedeId,
                  sedeName: seat.SedeName?.trim(),
                  ruc: seat.Ruc?.trim(),
                  schema: 'POS'
                };
             }
          } catch (e) {
             console.log(`[Auth] Esquema POS no disponible en ${dbName}`);
          }

          console.warn(`[Auth] Credenciales inválidas para ${credentials.username} en ${dbName}`);
          return null;
        } catch (err) {
          console.error("[Auth] Error Crítico de Autenticación:", err.message);
          return null;
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.company = user.company;
        token.username = user.username;
        token.empresaId = user.empresaId;
        token.sedeId = user.sedeId;
        token.sedeName = user.sedeName;
        token.ruc = user.ruc;
        token.schema = user.schema;
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
        session.user.schema = token.schema;
      }
      return session;
    }
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/auth/signin',
  }
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
