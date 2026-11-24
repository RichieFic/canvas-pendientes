# Canvas Pendientes Tec

Extensión de Chrome/Edge para Canvas (Experiencia21 del Tec y cualquier `*.instructure.com`).

## Funciones

- **Panel de pendientes**: botón flotante con todas tus entregas, agrupadas en Atrasadas, Hoy, Mañana, Esta semana y Después, con un contador de las urgentes.
- **Pantalla principal**: un resumen arriba de tus cursos con los **últimos anuncios** (los no leídos llevan un punto) y tus **próximas entregas**.
- **Calendario**: conecta **Google Calendar** u **Outlook / Microsoft 365**. La extensión crea un calendario llamado **“Canvas Pendientes”** con un evento por entrega, que termina a la hora límite, y con los recordatorios que elijas. Cuando entregas algo, su evento se borra solo.
- **Apariencia**: colores de fondo, texto, enlaces, tarjetas y barra lateral, además del tamaño y tipo de letra. Incluye temas listos (**Contraste**, que viene activado por defecto, Tec, Oscuro, Sepia y Bosque), vista previa en vivo, colores propios para la gráfica y un botón para volver a los colores originales del tema elegido.

Todo se configura desde la página de opciones: clic en el ícono de la extensión, o en ⚙ dentro del panel.

## Instalar (desarrollo)

1. Abre `chrome://extensions` y activa el **Modo de desarrollador**.
2. Haz clic en **Cargar descomprimida** y elige esta carpeta.
3. Abre Canvas.

## Configurar calendarios (una sola vez, la hace quien publica)

Los usuarios solo presionan **Conectar**. Para que eso funcione, quien publica la extensión registra la app con Google y con Microsoft y pega los dos Client IDs en [`config.js`](config.js).

### 0. ID fijo de la extensión

Las Redirect URIs dependen del ID de la extensión: `https://<ID>.chromiumapp.org/google` y `https://<ID>.chromiumapp.org/microsoft`.

1. Sube un **borrador** a la [Chrome Web Store](https://chrome.google.com/webstore/devconsole) para obtener el ID definitivo.
2. En el panel de desarrollador, en *Paquete → Ver clave pública*, copia la clave y pégala en `manifest.json` como `"key": "..."`. Así, la versión descomprimida tiene el mismo ID mientras desarrollas.
3. En **Opciones → Avanzado** se muestran el ID y las Redirect URIs exactas que hay que registrar.

### 1. Google Calendar

1. En [Google Cloud Console](https://console.cloud.google.com/), crea un proyecto y habilita **Google Calendar API**.
2. Ve a **Pantalla de consentimiento de OAuth** y elige tipo **Externo**. Agrega los scopes `.../auth/calendar.app.created` y `email`.
3. Ve a **Credenciales → Crear ID de cliente OAuth**, con tipo **Aplicación web**:
   - URI de redireccionamiento autorizado: `https://<ID>.chromiumapp.org/google`
4. Copia el **Client ID** en `GOOGLE_CLIENT_ID` de `config.js`.

> ⚠️ El scope de Calendar es *sensible*. Mientras la app esté en modo **Prueba**, solo pueden conectarse hasta 100 usuarios que agregues como testers. Para cualquier usuario hay que **publicar la app y pasar la verificación de Google**, que pide una política de privacidad y un video de demostración.

La extensión solo pide `calendar.app.created`: puede crear su propio calendario y modificar únicamente ese, no el resto de tus calendarios.

### 2. Outlook / Microsoft 365

1. En [Microsoft Entra → Registros de aplicaciones](https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade), crea un **Nuevo registro**:
   - Tipos de cuenta: **Cuentas de cualquier directorio organizativo y cuentas personales de Microsoft**.
   - URI de redirección, plataforma **Web**: `https://<ID>.chromiumapp.org/microsoft`
2. En **Autenticación**, activa **Tokens de acceso (flujos implícitos)**.
3. En **Permisos de API**, agrega estos permisos delegados de Microsoft Graph: `Calendars.ReadWrite` y `User.Read`.
4. Copia el **Id. de aplicación (cliente)** en `MICROSOFT_CLIENT_ID` de `config.js`.

> ⚠️ Algunas organizaciones (por ejemplo, cuentas `@tec.mx`) bloquean que los usuarios den permiso a apps externas. En ese caso, un administrador de TI debe aprobar la app, o el usuario puede conectar una cuenta personal de Outlook.

## Cómo funciona la sincronización

- La extensión lee tus entregas con tu sesión de Canvas, sin tokens de Canvas.
- Sincroniza al abrir Canvas, cada hora mientras el navegador esté abierto (si sigues con sesión iniciada en Canvas) y cuando presionas **Sincronizar ahora**.
- Recordatorios: Google admite hasta 5 por evento; Outlook solo admite 1, así que se usa el más anticipado.
- Los tokens se guardan solo en tu navegador (`chrome.storage.local`). Cada hora se renuevan sin pedirte nada; si la sesión expira, verás **Reconectar**.

## Limitaciones

- El tema cubre las pantallas principales de Canvas. Algunas vistas nuevas con estilos propios pueden conservar sus colores originales, sobre todo en modo oscuro.
- Si te desconectas, los eventos ya creados se quedan en tu calendario. Para quitarlos, borra el calendario “Canvas Pendientes”.

## Archivos

| Archivo | Qué hace |
|---|---|
| `manifest.json` | Declaración de la extensión (MV3) |
| `config.js` | Client IDs de OAuth |
| `settings.js` | Ajustes por defecto, temas y validación |
| `canvas-api.js` | Lectura de datos de Canvas y formato |
| `theme.js` | Aplica el tema personalizado a Canvas |
| `content.js` | Botón y panel de pendientes |
| `dashboard.js` | Resumen en la pantalla principal |
| `background.js` | OAuth y sincronización con los calendarios |
| `options.html/.css/.js` | Página de configuración |
