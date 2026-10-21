# Conectar la encuesta con Google Sheets

Con estos pasos, cada respuesta de la encuesta llega como una fila nueva a una hoja de cálculo de Google, cada cédula puede responder una sola vez (desde cualquier equipo) y la página `resultados.html` muestra los gráficos.

Se hace **una sola vez** y toma unos 10 minutos. Use una cuenta de Google de ADEP, no una personal.

## 1. Crear la hoja de cálculo

1. Entre a <https://sheets.google.com> con la cuenta de ADEP.
2. Cree una hoja en blanco y póngale de nombre **Encuesta de Servicio ADEP**.
   No hace falta escribir nada; las columnas se crean solas con la primera respuesta.

## 2. Pegar el script

1. En la hoja, abra el menú **Extensiones → Apps Script**.
2. Borre todo lo que aparece en el editor.
3. Copie todo el contenido del archivo `google-apps-script/Code.gs` de este proyecto y péguelo.
4. Presione el ícono de **guardar** (💾).

## 3. Poner la clave de los resultados

La clave protege la página de resultados. No se escribe en el código, sino aquí:

1. En Apps Script, en la barra izquierda, entre a **Configuración del proyecto** (⚙️).
2. Baje hasta **Propiedades de la secuencia de comandos** y presione **Agregar propiedad**.
3. En **Propiedad** escriba exactamente: `CLAVE_RESULTADOS`
4. En **Valor** escriba la clave que usará la Junta Directiva. Use al menos 10 caracteres y no la comparta por redes sociales.
5. Presione **Guardar propiedades de la secuencia de comandos**.

## 4. Publicar el script como aplicación web

1. Arriba a la derecha presione **Implementar → Nueva implementación**.
2. En el engranaje junto a "Seleccionar tipo", elija **Aplicación web**.
3. Llene así:
   - **Descripción:** Encuesta ADEP
   - **Ejecutar como:** Yo (la cuenta de ADEP)
   - **Quién tiene acceso:** Cualquier usuario
4. Presione **Implementar**.
5. Google pedirá **autorizar el acceso**: elija la cuenta de ADEP. Si aparece "Google no ha verificado esta aplicación", presione **Configuración avanzada → Ir a Encuesta ADEP (no seguro)** y luego **Permitir**. Es normal: el script es suyo y solo usa esta hoja.
6. Copie la **URL de la aplicación web**. Termina en `/exec`.

> "Cualquier usuario" es necesario para que las personas asociadas puedan enviar la encuesta sin iniciar sesión en Google. Aun así, nadie puede leer las respuestas sin la clave del paso 3, y nadie puede abrir la hoja sin la cuenta de ADEP.

## 5. Conectar la encuesta

1. Abra `js/config.js` y pegue la URL entre las comillas de `endpoint`:

   ```js
   endpoint: "https://script.google.com/macros/s/XXXXXXXXXXXX/exec",
   ```

2. Revise el valor de `sal`. Si quiere, cámbielo por cualquier otra frase, **pero hágalo antes de que alguien responda** y no lo vuelva a cambiar después.
3. Guarde, haga commit y súbalo a GitHub (`git push`).

## 6. Probar

1. Abra la encuesta publicada y respóndala con una cédula de prueba.
2. Revise la hoja: debe aparecer la pestaña **Respuestas** con una fila.
3. Intente responder otra vez con la misma cédula: debe decir que ya respondió.
4. Abra `resultados.html`, escriba la clave y revise los gráficos.
5. Borre la fila de prueba de la hoja antes de compartir la encuesta.

## Si cambia el script más adelante

Después de pegar una versión nueva de `Code.gs`, vaya a **Implementar → Gestionar implementaciones**, presione el lápiz ✏️, elija **Versión: Nueva versión** y luego **Implementar**. Así la URL sigue siendo la misma.

## Qué guarda cada fila

- Las respuestas de las 14 preguntas.
- La fecha y hora, que pone el servidor de Google.
- `id_persona`: la cédula **cifrada**. Sirve solo para detectar respuestas repetidas; la página de resultados nunca la muestra.
