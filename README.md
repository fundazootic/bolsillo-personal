# Bolsillo

Una aplicación personal en español para registrar ingresos, organizar pagos mensuales, marcar lo pagado y saber cuánto dinero queda libre. Valores en pesos colombianos (COP).

## Uso

Entra con el enlace que recibes en tu correo. Registra el sueldo en **Agregar ingreso**, tus obligaciones en **Agregar pago** y el dinero que quieres reservar en **Apartar dinero**. Usa el check cuando hayas pagado. Los cambios se guardan en tu cuenta y se consultan al cambiar de dispositivo o actualizar la página.

- **Saldo actual** = ingresos − pagos realizados.
- **Libre para ti** = ingresos − pagos realizados − pagos pendientes − apartados.
- Los apartados son reservas del presupuesto; no representan una transferencia bancaria.
- Marca un registro como habitual para copiarlo al mes siguiente. Cada copia empieza pendiente. Repetir la copia no duplica los registros.
- Los meses son independientes: ningún saldo se traslada automáticamente. Puedes registrar un saldo inicial como ingreso.
- Descarga un CSV del mes para conservar un respaldo legible en Excel.
- La demostración contiene datos ficticios en memoria y no escribe en tu cuenta.

## Desarrollo

Requiere Node.js 20.19+ o 22.12+.

```sh
npm ci
npm run dev
npm test
npm run build
```

Vite genera `dist/`. Importa este repositorio en Vercel como proyecto Vite, con `npm run build` y directorio de salida `dist`.

## Datos y autenticación

Supabase almacena los registros en PostgreSQL con Row Level Security. Cada fila pertenece al usuario autenticado; no hay acceso anónimo. `config.js` contiene únicamente la URL y la clave **publicable**. Nunca debe contener una clave secreta o `service_role`.

Para una instalación independiente, ejecuta `schema.sql` en un proyecto nuevo de Supabase y configura `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. En Authentication → URL Configuration configura el dominio publicado como Site URL y URL de redirección. El servicio de correo incluido de Supabase puede limitar destinatarios a integrantes de la organización; para otros correos, configura SMTP propio.

La sesión de acceso se mantiene en el navegador. Los registros financieros se consultan en el servidor. La aplicación requiere conexión para guardar y no presenta un cambio fallido como guardado. Las ediciones usan una versión del registro para detectar cambios simultáneos desde otro dispositivo.

## Verificación

`npm test` comprueba cálculos, montos inválidos, saldos negativos y copia mensual con fechas de fin de mes. `npm run build` verifica la compilación.
