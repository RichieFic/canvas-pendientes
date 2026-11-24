// Configuración OAuth de la extensión (la llena el dueño UNA sola vez).
// Todos los usuarios de la extensión publicada usan estos mismos Client IDs.
// Ver README.md → "Configurar calendarios" para obtenerlos.
// eslint-disable-next-line no-unused-vars
const CPT_CONFIG = {
  // Google Cloud Console → Credenciales → ID de cliente OAuth (tipo "Aplicación web")
  // El Client ID es público (no es un secreto); el "secreto del cliente" NO va aquí.
  GOOGLE_CLIENT_ID: "306104418817-mcit03oukucdg6kgngmdbcopt3hqda5o.apps.googleusercontent.com",
  // Microsoft Entra (Azure) → Registros de aplicaciones → "Id. de aplicación (cliente)"
  MICROSOFT_CLIENT_ID: "",
};
