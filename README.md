# Bolsillo

**[Abrir la aplicación](https://fundazootic.github.io/bolsillo-personal/)**

Presupuesto personal sencillo en pesos colombianos para un máximo de tres cuentas independientes. El sitio es público; cada persona solo puede ver y modificar sus propios registros.

## Empezar

1. Abre la aplicación y selecciona **Tengo un código: crear cuenta**.
2. Usa uno de los tres códigos privados entregados al propietario y elige usuario y contraseña (mínimo 12 caracteres).
3. Conserva el código en un lugar seguro: también permite recuperar la contraseña. No publiques el código de tu propia cuenta.
4. Registra tu sueldo en **Agregar ingreso**, las obligaciones en **Agregar pago** y tus reservas en **Apartar dinero**.
5. Marca el check cuando hayas pagado. Los cambios se guardan en tu cuenta y se consultan desde otro dispositivo.

**No se necesita tarjeta, suscripción, cuenta de Vercel ni proveedor de correo.**

## Tu presupuesto

- **Saldo actual** = ingresos − pagos realizados.
- **Libre para ti** = ingresos − pagos realizados − pagos pendientes − apartados.
- Los apartados son reservas del presupuesto, no transferencias bancarias.
- El resumen por categorías incluye pagos realizados y pendientes.
- Marca un registro como habitual para copiarlo al mes siguiente. Las copias empiezan pendientes y repetir la copia no duplica los registros.
- Los meses son independientes: ningún saldo se traslada automáticamente. Puedes registrar un saldo inicial como ingreso.
- Descarga un CSV mensual para conservar un respaldo que puedes abrir en Excel.
- La demostración usa datos ficticios en memoria y no escribe en tu cuenta.

## Alojamiento gratuito

GitHub Pages publica `docs/index.html` desde `main`, carpeta `/docs`. Supabase usa su plan Free para base de datos, contraseñas y una función de cuentas. No hay servicios de pago ni cobros configurados por la aplicación. Los planes gratuitos tienen límites y pueden suspender proyectos por inactividad; si ocurre, el propietario debe reactivarlo desde Supabase. No se promete disponibilidad ilimitada.

## Desarrollo y publicación

Requiere Node.js 20.19+ o 22.12+.

```sh
npm ci
npm run dev
npm test
npm run build
node build-pages.mjs
```

Después de editar, sube el código y `docs/index.html` a `main`. GitHub Pages publica esa carpeta; no se requiere contratar un servicio de compilación. `build-pages.mjs` genera un HTML con JavaScript, CSS e icono incorporados.

## Privacidad y acceso

- Supabase Auth protege las contraseñas y emite las sesiones. Los identificadores `usuario@bolsillo.invalid` son internos; no son correos reales ni se envían mensajes.
- PostgreSQL aplica Row Level Security: se requieren una sesión, la propiedad del registro y una membresía autorizada.
- Los códigos se comprueban exclusivamente en el servidor. Solo se almacenan sus hashes SHA-256 en un esquema privado inaccesible desde el navegador.
- La función `bolsillo-account` exige un código privado válido para crear o recuperar una cuenta. Su clave de administración vive únicamente en Supabase.
- `config.js` contiene una clave **publicable**, diseñada para el navegador. No contiene claves secretas.
- Los archivos `ACCESOS-PRIVADOS.txt` y `.test-credentials.json` se excluyen del repositorio. Nunca deben subirse a GitHub.
- Una recuperación cierra las sesiones renovables anteriores; los tokens ya emitidos pueden seguir vigentes hasta su vencimiento.
- La aplicación requiere internet para guardar. Un fallo de guardado se muestra como error. Las ediciones usan versiones para detectar cambios simultáneos desde otro dispositivo.

## Instalación independiente

En un proyecto nuevo de Supabase, ejecuta `schema.sql` y después `access-schema.sql`; despliega `account-function.ts` como `bolsillo-account`. Esta función usa autenticación por código privado y no validación JWT del gateway. Cambia los orígenes CORS permitidos al dominio de tu instalación. Genera los códigos fuera del repositorio y almacena únicamente sus hashes en `private.bolsillo_access`. Configura la URL y clave publicable en `config.js` o mediante las variables de `.env.example`.

## Verificación

Los tests de cálculo cubren montos inválidos, saldos negativos, checks sin doble descuento y copia mensual con fechas de fin de mes. También se verificó el servidor con dos cuentas temporales: registro por invitación, acceso con contraseña, persistencia, aislamiento entre usuarios, bloqueo de escrituras ajenas, conflictos de edición, acceso anónimo denegado y recuperación por código. Las cuentas y datos temporales fueron eliminados después de probarlos.
