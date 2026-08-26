# Mis Tickets

Aplicación web instalable para organizar compras, tickets, números de serie y garantías.

## Funciones

- Inventario de objetos y tickets.
- Fotografía o PDF del justificante.
- Escáner EAN, UPC y QR cuando el navegador es compatible.
- Almacenamiento privado mediante IndexedDB.
- Exportación e importación de copias completas.
- Copia opcional en la cuenta personal de Google Drive.
- Funcionamiento sin conexión después de la primera carga.
- Instalación desde el navegador como aplicación.

## Privacidad

Cada navegador crea su propia base de datos local. Si el usuario conecta Drive, la aplicación solicita el alcance limitado `drive.file`: solo puede trabajar con los archivos que ella misma crea. No se incluye ningún secreto de cliente en el repositorio.

## Google Drive

Cada usuario conecta su propia cuenta y la aplicación crea `Mis Tickets`, con subcarpetas por año y tienda. Las compras continúan guardándose localmente aunque Drive no esté disponible.

El ID de cliente OAuth público está autorizado para `https://jloptes-cmyk.github.io`. Quien publique un fork bajo otro dominio debe crear su propio cliente OAuth web, autorizar su origen y sustituir `GOOGLE_CLIENT_ID` en `app.js`. Nunca se debe publicar el secreto de cliente.

## Publicación

El flujo de GitHub Actions incluido publica automáticamente la rama `main` en GitHub Pages.
