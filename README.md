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
assets/                    Logo oficial y favicon
google-apps-script/Code.gs Script para recibir respuestas en Google Sheets
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

## Recibir las respuestas (Google Sheets)

Sin configuración, la encuesta funciona en **modo demostración**: las respuestas solo se guardan en el navegador.
Para recibirlas en una hoja de cálculo, siga las instrucciones de `google-apps-script/Code.gs` y pegue la URL resultante en `js/config.js`:

```js
endpoint: "https://script.google.com/macros/s/XXXXXXXX/exec",
```

## Personalizar

- **Colores:** variables `--adep-*` (verde oscuro, verde, verde claro, rojo y blanco) al inicio de `css/styles.css`.
- **Servicios (preguntas 4 y 5) y aspectos (pregunta 7):** listas en `js/config.js`.
- **Logo:** `assets/logo-adep.png` (logo oficial, recortado en círculo) y `assets/favicon.png`.

## Publicar en GitHub Pages

En el repositorio: **Settings → Pages → Source: Deploy from a branch → `main` / root**.
