# Encuesta de Servicio — ADEP

Sitio web de la **Encuesta de servicio a la persona asociada** de la Asociación de Educadores Pensionados (ADEP).
Es un sitio estático (HTML, CSS y JavaScript, sin dependencias) listo para abrir en Visual Studio Code y publicar en GitHub Pages.

## Características

- Portada llamativa y formulario por secciones (5 pasos) con barra de progreso.
- Las 14 preguntas de la encuesta, con validación de las obligatorias.
- Calificaciones 1–5 con colores; en la pregunta 5 solo aparecen los servicios marcados en la pregunta 4.
- Pensado para personas adultas mayores: letra grande, botones amplios y control **A− / A+** para el tamaño del texto.
- Guarda el avance automáticamente en el navegador (si se cierra la página, se puede continuar).
- Adaptado a celular, tableta y computadora.

## Estructura

```
index.html                 Página principal
css/styles.css             Estilos y paleta de colores (variables en :root)
js/config.js               Servicios, aspectos a calificar y URL de envío
js/app.js                  Lógica del formulario
js/pdf.js                  PDF de cada respuesta (se adjunta al correo)
js/informe-pdf.js          PDF del informe general con gráficos (se adjunta al correo)
resultados.html            Resultados para la Junta Directiva (con clave)
js/resultados.js           Gráficos, filtros, comentarios y descarga a Excel
css/resultados.css         Estilos de la página de resultados
assets/                    Logo oficial y favicon
google-apps-script/Code.gs Backend: guarda respuestas en Google Sheets y entrega resultados
```

## Abrir en Visual Studio Code

1. `git clone <url-del-repositorio>` y abra la carpeta en VS Code.
2. Instale la extensión recomendada **Live Server**.
3. Clic derecho en `index.html` → **Open with Live Server**.

## Una respuesta por persona

Al comenzar se pide la cédula. En el navegador se cifra con SHA-256 junto con el texto `sal`
de `js/config.js`, y solo ese código cifrado (`id_persona`) se envía. El script de Google
rechaza una segunda respuesta con el mismo código. Cambie `sal` una sola vez antes de publicar.

## Dictado por voz

Las preguntas abiertas tienen un botón **Dictar con mi voz** (Chrome, Edge y Safari).
Necesita que la página se abra por `https` (GitHub Pages) o desde Live Server.

## Recibir las respuestas por correo

Cada respuesta se envía a los correos de `correos` en `js/config.js` con un **PDF adjunto**
(encabezado de ADEP, las 5 secciones con sus colores y las calificaciones dibujadas), usando el
servicio gratuito [FormSubmit.co](https://formsubmit.co) (no requiere cuenta). El PDF se arma en el
navegador con jsPDF (`js/pdf.js`). Si no se pudiera crear, la respuesta se envía como tabla en el correo.

```js
correos: ["primer-correo@ejemplo.com", "segundo-correo@ejemplo.com"],
```

- El **primer** correo es el destinatario principal; los demás reciben **copia**.
- **Activación (una sola vez):** con la primera respuesta, FormSubmit envía al primer correo un mensaje
  «Confirm your email». Hay que abrirlo y presionar **Activate Form**. Esa primera respuesta no se reenvía;
  desde la siguiente, todas llegan.
- La línea «Código de persona» es un pedazo de la cédula cifrada: si dos correos tienen el mismo código,
  es la misma persona respondiendo otra vez.
- Sin la hoja de Google, el bloqueo de «una vez por persona» solo funciona en el mismo equipo,
  y la página de resultados no tiene de dónde leer los datos.

## Recibir las respuestas (Google Sheets + Gmail de ADEP)

Al conectar la cuenta de Gmail de ADEP (guía: **[INSTALAR-BACKEND.md](INSTALAR-BACKEND.md)**), cada respuesta
se guarda en una hoja de Google, y **todos los días a las 4:00 p. m.** llega un correo **desde esa cuenta** con el
**informe general** en PDF (gráficos y porcentajes de todas las respuestas), solo si hubo respuestas nuevas.
Los correos que lo reciben se configuran en Google (propiedad `CORREOS`). El PDF de cada respuesta se descarga
en la página de resultados. Mientras `endpoint` esté vacío, se usa FormSubmit (un correo con el PDF individual).
Opcional: enviar desde Microsoft 365, vea **[ENVIAR-CON-MICROSOFT.md](ENVIAR-CON-MICROSOFT.md)**.

## Página de resultados

`resultados.html` muestra los resultados para la Junta Directiva: cifras principales, gráficos por pregunta,
filtros por provincia, filial y edad, los comentarios con buscador, la descarga a Excel,
el PDF de cada respuesta y el informe general en PDF.
Pide la clave que se configura en Google (`CLAVE_RESULTADOS`). No hay ningún enlace a esta página
desde la encuesta; compártala solo con quien deba verla.

## Personalizar

- **Colores:** variables `--adep-*` (verde oscuro, verde, verde claro, rojo y blanco) al inicio de `css/styles.css`.
- **Servicios (preguntas 4 y 5) y aspectos (pregunta 7):** listas en `js/config.js`.
- **Logo:** `assets/logo-adep.png` (logo oficial, recortado en círculo) y `assets/favicon.png`.

## Dónde está publicada

- Encuesta: **https://adep-encuesta.web.app**
- Resultados (solo organizadores, con clave): **https://adep-encuesta.web.app/resultados**

Cada cambio que se sube a `main` se publica solo en Firebase Hosting (proyecto `adep-encuesta`, de la
cuenta de Gmail de ADEP). Vea **[PUBLICAR.md](PUBLICAR.md)**.
