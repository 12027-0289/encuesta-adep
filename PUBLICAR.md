# Publicar la encuesta en Firebase (dirección adep-encuesta.web.app)

Cada vez que se sube un cambio a `main`, GitHub publica la encuesta en **https://adep-encuesta.web.app**
(y la página de resultados en **https://adep-encuesta.web.app/resultados**).

Se configura **una sola vez**, con la **cuenta de Gmail de ADEP** (no con una cuenta personal).

## 1. Crear el proyecto en Firebase
1. Entre a <https://console.firebase.google.com> con la cuenta de Gmail de ADEP (en una ventana de incógnito si tiene otras cuentas abiertas).
2. **Crear un proyecto** (o «Comenzar con un proyecto de Firebase»).
3. Nombre del proyecto: **adep-encuesta**.
   Debajo del nombre aparece el **ID del proyecto**: debe decir exactamente `adep-encuesta`.
   Si Google le agrega números (por ejemplo `adep-encuesta-1a2b3`), anótelo y avíseme: hay que cambiarlo en `.firebaserc` y en `.github/workflows/publicar.yml`.
4. Cuando pregunte por Google Analytics, puede **desactivarlo**. Presione **Crear proyecto** y luego **Continuar**.

## 2. Activar Hosting
1. En el menú izquierdo: **Compilación** (o «Hosting y sin servidores») → **Hosting** → **Comenzar**.
2. Puede saltar todos los pasos que muestra (Siguiente → Siguiente → Continuar a la consola).

## 3. Crear la llave para GitHub
1. En Firebase: ⚙️ **Configuración del proyecto** → pestaña **Cuentas de servicio**.
2. Botón **Generar nueva clave privada** → **Generar clave**. Se descarga un archivo `.json`.
   ⚠️ Esa llave es secreta: no la suba a GitHub como archivo ni la comparta.

## 4. Darle permiso para publicar
1. Abra <https://console.cloud.google.com/iam-admin/iam?project=adep-encuesta> (con la cuenta de ADEP).
2. Busque la cuenta que empieza con **firebase-adminsdk-** y presione el lápiz ✏️ (Editar).
3. **Agregar otro rol** → escriba **Firebase Hosting** → elija **Administrador de Firebase Hosting** → **Guardar**.

## 5. Guardar la llave en GitHub
1. Abra <https://github.com/12027-0289/encuesta-adep/settings/secrets/actions>.
2. **New repository secret**.
3. Name: `FIREBASE_SERVICE_ACCOUNT`
4. Secret: abra el archivo `.json` del paso 3 con el Bloc de notas, copie **todo** y péguelo.
5. **Add secret**. Después puede borrar el archivo `.json` de su computadora.

## 6. Publicar
1. Abra <https://github.com/12027-0289/encuesta-adep/actions> → **Publicar página** → **Run workflow** → **Run workflow**.
2. En unos 2 minutos la encuesta queda en **https://adep-encuesta.web.app**.

Desde entonces se publica sola con cada cambio en `main`.

## 7. Apagar la dirección de GitHub
Para que no queden dos direcciones: en GitHub → **Settings → Pages** → **Sitio despublicado** (Unpublish site).
