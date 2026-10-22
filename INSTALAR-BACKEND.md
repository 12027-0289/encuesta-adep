# Conectar la encuesta con la cuenta de Gmail de ADEP

Con estos pasos, cada vez que alguien responde la encuesta:

1. La respuesta se guarda en una hoja de cálculo de Google.
2. Llega un correo, **enviado desde la cuenta de ADEP**, con **dos PDF**:
   la respuesta de la persona y el **informe general** con gráficos y porcentajes de todas las respuestas.
3. Cada cédula puede responder **una sola vez**, desde cualquier equipo.

Además funciona la página `resultados.html` para ver los resultados en pantalla.

Se hace **una sola vez** (unos 15 minutos), con la cuenta de Gmail de ADEP.

---

## 1. Crear la hoja de cálculo

1. Entre a <https://sheets.google.com> con la cuenta de Gmail de ADEP.
2. Presione **En blanco** para crear una hoja nueva.
3. Arriba a la izquierda, cambie el nombre "Hoja de cálculo sin título" por **Encuesta de Servicio ADEP**.

No escriba nada en la hoja: las columnas se crean solas con la primera respuesta.

## 2. Pegar el código

1. En la hoja, abra el menú **Extensiones → Apps Script**. Se abre otra pestaña.
2. Borre todo lo que aparece escrito en el editor.
3. Abra el archivo `google-apps-script/Code.gs` de este proyecto, copie **todo** su contenido y péguelo en el editor.
4. Presione el ícono de **guardar** (💾).

## 3. Poner la clave y los correos

1. En Apps Script, en la barra de la izquierda, entre a **Configuración del proyecto** (ícono ⚙️).
2. Baje hasta **Propiedades de la secuencia de comandos** y presione **Agregar propiedad de secuencia de comandos**.
3. Agregue estas dos propiedades (escriba los nombres exactamente así, en mayúsculas):

   | Propiedad | Valor |
   |---|---|
   | `CORREOS` | Los correos que reciben los resultados, separados por coma. Ejemplo: `persona1@correo.com, persona2@correo.com` |
   | `CLAVE_RESULTADOS` | Una clave de al menos 10 caracteres para la página de resultados |

4. Presione **Guardar propiedades de la secuencia de comandos**.

Para cambiar los correos más adelante, solo se edita la propiedad `CORREOS`; no hay que cambiar nada más.

## 4. Probar el envío de correo (y dar permisos)

1. Vuelva al **Editor** (ícono `< >` a la izquierda).
2. Arriba, junto al botón **Ejecutar**, elija la función **probarCorreo** y presione **Ejecutar**.
3. Google pedirá **revisar permisos**: elija la cuenta de ADEP.
   Si aparece "Google no ha verificado esta aplicación", presione **Configuración avanzada → Ir a … (no seguro)** y luego **Permitir**.
   Es normal: el código es de ADEP y solo usa esta hoja y el correo de esta cuenta.
4. Revise los correos de la lista: debe llegar "Encuesta ADEP · Prueba de envío".
   (Los dos PDF —la respuesta y el informe general con gráficos— llegan cuando alguien responde la encuesta.)

## 5. Publicar como aplicación web

1. Arriba a la derecha presione **Implementar → Nueva implementación**.
2. Presione el engranaje ⚙️ junto a "Seleccionar tipo" y elija **Aplicación web**.
3. Llene así:
   - **Descripción:** Encuesta ADEP
   - **Ejecutar como:** Yo (la cuenta de ADEP)
   - **Quién tiene acceso:** Cualquier usuario
4. Presione **Implementar** y copie la **URL de la aplicación web** (termina en `/exec`).

> "Cualquier usuario" es necesario para que las personas asociadas puedan enviar la encuesta sin iniciar sesión.
> Nadie puede leer las respuestas sin la clave del paso 3, ni abrir la hoja sin la cuenta de ADEP.

## 6. Conectar la encuesta

En `js/config.js`, pegue la URL entre las comillas de `endpoint`:

```js
endpoint: "https://script.google.com/macros/s/XXXXXXXXXXXX/exec",
```

Guarde, haga commit y súbalo a GitHub (`git push`). Desde ese momento los correos salen desde la cuenta de ADEP
con los dos PDF, y ya no se usa FormSubmit.

## 7. Prueba final

1. Responda la encuesta con una cédula de prueba.
2. Revise la hoja: aparece la pestaña **Respuestas** con una fila.
3. Revise el correo: deben llegar los dos PDF.
4. Intente responder otra vez con la misma cédula: debe decir que ya respondió.
5. Borre la fila de prueba de la hoja antes de compartir la encuesta.

---

## Bueno saber

- **Límite de correos:** una cuenta Gmail gratuita puede enviar a unas **100 direcciones por día**.
  Con 2 correos en la lista, alcanza para unas **50 respuestas diarias**. Si se pasa del límite,
  las respuestas **igual se guardan** en la hoja; solo deja de llegar el correo hasta el día siguiente.
  Para que lleguen todos, los correos pueden salir desde **Microsoft 365** (unos 10 000 por día):
  vea [ENVIAR-CON-MICROSOFT.md](ENVIAR-CON-MICROSOFT.md).
- **Si cambia el código más adelante:** después de pegar la versión nueva, vaya a
  **Implementar → Gestionar implementaciones**, presione el lápiz ✏️, elija **Versión: Nueva versión** e **Implementar**.
  Así la URL sigue siendo la misma.
- **Qué guarda cada fila:** las respuestas, la fecha y hora (la pone Google) y `id_persona`, que es la cédula
  **cifrada**: sirve solo para detectar respuestas repetidas. No se muestra en los resultados; en el PDF individual
  aparece solo un pedazo («Código de persona»), que no permite saber la cédula.
- **Quién debe tener la clave de la cuenta:** la jefatura o administración de ADEP, no una sola persona.
