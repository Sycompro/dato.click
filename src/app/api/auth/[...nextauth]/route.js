import NextAuth from "next-auth";
export const dynamic = 'force-dynamic';
import GoogleProvider from "next-auth/providers/google";

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: "select_account",
          access_type: "offline",
          response_type: "code"
        }
      }
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      const allowedEmails = process.env.ALLOWED_EMAILS 
          ? process.env.ALLOWED_EMAILS.split(',').map(e => e.trim().toLowerCase()) 
          : [];
          
      if (allowedEmails.includes(user.email.toLowerCase())) {
        return true;
      } else {
        console.log("ACCESO DENEGADO - Intento de Login de:", user.email);
        return false; // Automatically rejects the login and throws error
      }
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
