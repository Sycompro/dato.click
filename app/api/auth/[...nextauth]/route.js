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
      id: "credentials",
      name: "ERP Credentials",
      credentials: {
        code: { label: "Código Empresa", type: "text" },
        username: { label: "Usuario", type: "text" },
        password: { label: "Contraseña", type: "password" }
      },
      async authorize(credentials) {
        console.log("[Auth] Inicio de autorización para:", credentials?.username, "Empresa:", credentials?.code);
        console.log("[Auth] NEXTAUTH_SECRET configurado:", !!process.env.NEXTAUTH_SECRET);
        if (!credentials?.code || !credentials?.username || !credentials?.password) {
          console.error("[Auth] Faltan credenciales en el objeto recibido");
          throw new Error("Faltan credenciales");
        }

        try {
          // 1. INTENTO OFICIAL: GIMBRA_SERVER (Esquema POS Centralizado)
          let dbName = null;
          try {
              console.log(`[Auth] Intentando esquema oficial POS en GIMBRA_SERVER para: ${credentials.username}`);
              const gimbraPool = await getConnection('GIMBRA_SERVER');
              
              // El código de empresa (01, 05, etc) suele coincidir con EmpresaId
              const empresaId = parseInt(credentials.code);
              
              const posResult = await gimbraPool.request()
                .input('empresaId', empresaId)
                .input('usuario', credentials.username)
                .input('clave', credentials.password)
                .query(`
                  SELECT S.SedeId, S.Descripcion AS SedeName, E.RazonSocial, E.Ruc, E.EmpresaId, E.NameBdMovil
                  FROM Sede AS S
                  INNER JOIN Empresa AS E ON S.EmpresaId = E.EmpresaId
                  WHERE (E.EmpresaId = @empresaId OR E.Codigo = @code) 
                  AND S.Descripcion = @usuario 
                  AND S.Password = @clave
                `.replace('@code', `'${credentials.code}'`)); // Fallback a código string si falla el int

              if (posResult.recordset.length > 0) {
                const seat = posResult.recordset[0];
                const targetDb = seat.NameBdMovil?.trim() || `BdNava${credentials.code.trim().padStart(2, '0')}`;
                
                console.log(`[Auth] ¡ÉXITO POS! Sede ${seat.SedeName} autenticada en GIMBRA_SERVER`);
                return {
                  id: String(seat.SedeId),
                  name: seat.RazonSocial?.trim() || seat.SedeName,
                  username: credentials.username,
                  company: targetDb,
                  empresaId: seat.EmpresaId,
                  sedeId: seat.SedeId,
                  sedeName: seat.SedeName?.trim(),
                  ruc: seat.Ruc?.trim(),
                  schema: 'POS_OFFICIAL'
                };
              }
          } catch (e) {
              console.error("[Auth] Error en esquema oficial GIMBRA_SERVER:", e.message);
          }

          // 2. Determinar base de datos para otros esquemas (ERP / Otros POS)
          try {
              const masterPool = await getConnection('BdNava01');
              const empresaResult = await masterPool.request()
                .input('code', credentials.code)
                .query("SELECT Base FROM confemp01 WHERE Codigo = @code AND Estado = 1");

              if (empresaResult.recordset.length > 0) {
                dbName = empresaResult.recordset[0].Base.trim();
                console.log(`[Auth] Base de datos encontrada en confemp01: ${dbName}`);
              } else {
                console.warn(`[Auth] No se encontró la empresa con código [${credentials.code}] en confemp01`);
              }
          } catch (e) {
              console.warn("[Auth] Error consultando confemp01:", e.message);
          }

          if (!dbName) {
            const cleanCode = credentials.code.trim().padStart(2, '0');
            dbName = `BdNava${cleanCode}`;
          }

          console.log(`[Auth] Validando en ${dbName} para usuario: ${credentials.username}`);
          const empresaPool = await getConnection(dbName);
          
          // 2. Autenticación POS Terminal (fcu0000) - Usuarios de Sedes como mall, balta, jaen
          try {
             console.log(`[Auth] Intentando esquema POS Terminal (fcu0000) en ${dbName} para: ${credentials.username}`);
             
             const expectedCodes = credentials.password.split('').map(c => c.charCodeAt(0) + 105);
             const asciiConditions = expectedCodes.map((code, i) => `UNICODE(SUBSTRING(clausu, ${i + 1}, 1)) = ${code}`).join(' AND ');

             const posQuery = `
                SELECT codusu, nomacc, nomusu 
                FROM fcu0000 
                WHERE LTRIM(RTRIM(nomacc)) = @usuario 
                AND (${asciiConditions}) 
                AND LEN(RTRIM(clausu)) = ${expectedCodes.length}
                AND estado = 1
             `;

             const posResult = await empresaPool.request()
                .input('usuario', credentials.username)
                .query(posQuery);
             
             if (posResult.recordset.length > 0) {
                const user = posResult.recordset[0];
                console.log(`[Auth] ¡ÉXITO POS TERMINAL! Usuario ${user.nomacc} autenticado en ${dbName}`);
                return {
                  id: user.codusu?.trim() || user.nomacc?.trim(),
                  name: user.nomusu?.trim() || user.nomacc?.trim(),
                  username: user.nomacc?.trim(),
                  company: dbName,
                  schema: 'POS_TERMINAL'
                };
             }
          } catch (e) {
             console.warn("[Auth] Error en esquema POS Terminal (fcu0000):", e.message);
          }

          // 3. Autenticación ERP (TBL_USUARIO) - Usuarios administrativos
          try {
             const expectedCodes = credentials.password.split('').map(c => c.charCodeAt(0) + 105);
             const asciiConditions = expectedCodes.map((code, i) => `UNICODE(SUBSTRING(Clave, ${i + 1}, 1)) = ${code}`).join(' AND ');

             const erpQuery = `
                SELECT Usuario, Nombres + ' ' + Apellidos as FullName 
                FROM TBL_USUARIO 
                WHERE Usuario = @usuario 
                AND (${asciiConditions}) 
                AND LEN(RTRIM(Clave)) = ${expectedCodes.length}
                AND Estado = 1
             `;

             console.log(`[Auth] Intentando esquema ERP (TBL_USUARIO) en ${dbName} para: ${credentials.username}`);
             const erpResult = await empresaPool.request()
                .input('usuario', credentials.username)
                .query(erpQuery);
             
             if (erpResult.recordset.length > 0) {
                const user = erpResult.recordset[0];
                console.log(`[Auth] ¡ÉXITO ERP! Usuario ${user.Usuario} autenticado en ${dbName}`);
                return {
                  id: user.Usuario?.trim(),
                  name: user.FullName?.trim() || user.Usuario?.trim(),
                  username: user.Usuario?.trim(),
                  company: dbName,
                  schema: 'ERP'
                };
             }
          } catch (e) {
             console.error("[Auth] Error en esquema ERP:", e.message);
          }

          // 3. Fallback: Esquema POS (Sede en plano)
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
          } catch (e) {}

          console.log(`[Auth] No se encontró el usuario ${credentials.username} en ningún esquema.`);
          return null;
        } catch (err) {
          console.error("[Auth] Error Crítico durante authorize:", err.message);
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
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  pages: { signIn: '/auth/signin' }
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
