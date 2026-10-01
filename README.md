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
- **Libre para ti** = ingresos − pagos realizados − apartados. Marcar un pago descuenta su valor; desmarcarlo devuelve ese valor al saldo. Los pendientes se muestran por separado y todavía no se descuentan.
- Los apartados son reservas del presupuesto, no transferencias bancarias.
- El resumen por categorías incluye pagos realizados y pendientes.
- Marca **Pago fijo mensual** al agregar o editar un pago. Aparece automáticamente, pendiente, al abrir cualquier mes posterior. Conserva el día de vencimiento (o el último día si el mes es más corto) y no se duplica al actualizar. Desmarca la casilla o elimina el registro para detener futuras copias. Editar el valor cambia las próximas copias; los meses ya creados se conservan.
- Los ingresos y apartados habituales se copian con **Copiar ingresos y apartados**.
- Los meses son independientes: ningún saldo se traslada automáticamente. Puedes registrar un saldo inicial como ingreso.
- Descarga un CSV mensual para conservar un respaldo que puedes abrir en Excel.
- La demostración usa datos ficticios en memoria y no escribe en tu cuenta.

## Deudas y abonos

En **Agregar deuda**, registra el total adeudado y, opcionalmente, el abono mensual previsto. Cada deuda conserva su saldo al cambiar de mes. **Registrar abono** guarda el valor, la fecha y una nota; el historial permite corregirlos. Verás cuánto has abonado, cuánto falta y una estimación del plazo con pagos constantes, sin intereses ni cargos nuevos.

Solo los abonos realizados descuentan dinero del mes de su fecha. El saldo de la deuda y el plan mensual no se reservan automáticamente. Los campos de dinero muestran separadores de miles: `1300000` se convierte en `1.300.000`.

## Tarjetas

En **Mis tarjetas**, el saldo inicial más las compras y cargos menos los abonos muestra cuánto debes. **Registrar compra** guarda el total, fecha y descripción; también admite intereses o cuota de manejo. Las compras no descuentan efectivo: solo los abonos afectan el dinero libre. Registra cada compra una sola vez, sin repetir lo incluido en el saldo inicial. Cada abono puede tener un valor distinto; el abono de referencia es opcional y únicamente estima el plazo. El historial permite corregir compras y abonos.

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

En un proyecto nuevo de Supabase, ejecuta `schema.sql`, `access-schema.sql` `debts-schema.sql`, `recurring-schema.sql` `cards-schema.sql` y `periods-schema.sql`; despliega `account-function.ts` como `bolsillo-account`. Esta función usa autenticación por código privado y no validación JWT del gateway. Cambia los orígenes CORS permitidos al dominio de tu instalación. Genera los códigos fuera del repositorio y almacena únicamente sus hashes en `private.bolsillo_access`. Configura la URL y clave publicable en `config.js` o mediante las variables de `.env.example`.

## Verificación

Los tests de cálculo cubren montos inválidos, saldos negativos, checks sin doble descuento y copia mensual con fechas de fin de mes. También se verificó el servidor con dos cuentas temporales: registro por invitación, acceso con contraseña, persistencia, aislamiento entre usuarios, bloqueo de escrituras ajenas, conflictos de edición, acceso anónimo denegado y recuperación por código. Las cuentas y datos temporales fueron eliminados después de probarlos.


## Corte y flujo de dinero

Configura el inicio en **Configurar mi corte**. Con inicio el 25, octubre comprende del 25 de septiembre al 24 de octubre. Cada cuenta guarda su propio corte. Los días 29–31 se ajustan al último día de meses cortos. La fecha del registro determina el período; abonos y compras usan su fecha real.

Cambiar el corte reclasifica registros con fecha y pagos pendientes con vencimiento conocido. Los antiguos sin fecha conservan su mes y muestran un aviso para revisarlos. Si dos copias de un pago fijo quedarían en el mismo período, se solicita revisar sus fechas.

**Así va tu dinero** muestra ingresos, pagos realizados, flujo neto, saldo después de pendientes y apartados, vencidos, comparación con el período anterior y compras frente a abonos. La referencia diaria usa solo lo registrado: no predice gastos futuros ni incluye intereses no registrados.
