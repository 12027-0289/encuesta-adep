# Enviar los correos de la encuesta desde Microsoft 365

Con esto, los correos con los dos PDF salen desde una cuenta de Microsoft 365 de ADEP
en vez del Gmail. El límite pasa de unos **100** a unos **10 000 destinatarios por día**,
así que llegan los PDF de todas las respuestas.

La encuesta, la hoja de Google y la página de resultados **no cambian**.
Si Microsoft fallara algún día, el correo sale automáticamente por Gmail, como antes.

Hay dos partes:

- **Parte A:** la hace quien administra Microsoft 365 en ADEP, una sola vez (unos 15 minutos).
- **Parte B:** la hace quien maneja la cuenta de Gmail de ADEP (unos 5 minutos).

---

## Parte A · Para la persona administradora de Microsoft 365

Se necesita una cuenta con rol de **Administrador global** (o Administrador de aplicaciones
más alguien que pueda dar el consentimiento de administrador).

### A1. Elegir el buzón que envía

Decida desde qué correo saldrán los resultados, por ejemplo `encuesta@adep.cr`.
Puede ser un buzón con licencia o un **buzón compartido** (no necesita licencia).

### A2. Registrar la aplicación

1. Entre a <https://entra.microsoft.com>.
2. Vaya a **Aplicaciones → Registros de aplicaciones → Nuevo registro**.
3. Llene así:
   - **Nombre:** Encuesta ADEP
   - **Tipos de cuenta compatibles:** Solo las cuentas de este directorio organizativo
   - **URI de redirección:** déjelo vacío
4. Presione **Registrar**.
5. En la página **Información general**, copie estos dos datos:
   - **Id. de aplicación (cliente)**
   - **Id. de directorio (inquilino)**

### A3. Dar permiso para enviar correo

1. En la aplicación, entre a **Permisos de API → Agregar un permiso → Microsoft Graph**.
2. Elija **Permisos de aplicación** (no "delegados").
3. Busque y marque **Mail.Send**, y presione **Agregar permisos**.
4. Presione **Conceder consentimiento de administrador para …** y confirme.
   La columna "Estado" debe quedar en verde.

### A4. Crear el secreto

1. Entre a **Certificados y secretos → Secretos de cliente → Nuevo secreto de cliente**.
2. **Descripción:** Encuesta ADEP. **Expira:** 24 meses.
3. Presione **Agregar** y copie de inmediato la columna **Valor**
   (no el "Id. de secreto"). Después ya no se puede volver a ver.
4. Anote en el calendario la fecha de vencimiento: ese día hay que crear un secreto nuevo
   y cambiarlo en la Parte B (propiedad `MS_SECRET`).

### A5. Recomendado: que solo pueda enviar desde ese buzón

Por defecto, el permiso **Mail.Send** deja a la aplicación enviar desde **cualquier** buzón de ADEP.
Para limitarlo al buzón del paso A1, en **Exchange Online PowerShell**:

```powershell
Connect-ExchangeOnline

# Datos de "Aplicaciones empresariales → Encuesta ADEP" en Entra:
#   AppId    = Id. de aplicación
#   ObjectId = Id. de objeto de la aplicación empresarial (no el del registro)
New-ServicePrincipal -AppId <AppId> -ObjectId <ObjectId> -DisplayName "Encuesta ADEP"

New-ManagementScope -Name "Solo buzon encuesta" `
  -RecipientRestrictionFilter "PrimarySmtpAddress -eq 'encuesta@adep.cr'"

New-ManagementRoleAssignment -App <AppId> -Role "Application Mail.Send" `
  -CustomResourceScope "Solo buzon encuesta"
```

Luego, en Entra, quite el permiso **Mail.Send** del paso A3
(**Permisos de API → … → Quitar el permiso**). Si se deja, sigue valiendo para todos los buzones.

Para comprobar (debe decir `True` para el buzón de la encuesta y `False` para cualquier otro):

```powershell
Test-ServicePrincipalAuthorization -Identity <AppId> -Resource encuesta@adep.cr
Test-ServicePrincipalAuthorization -Identity <AppId> -Resource otra.persona@adep.cr
```

### A6. Entregar los datos

Entregue a quien hará la Parte B estos 4 datos, **en persona o por un medio privado**
(no por WhatsApp ni en un correo reenviable):

| Dato | Ejemplo |
|---|---|
| Id. de directorio (inquilino) | `1a2b3c4d-…` |
| Id. de aplicación (cliente) | `5e6f7a8b-…` |
| Valor del secreto | `Abc8Q~…` |
| Correo que envía | `encuesta@adep.cr` |

---

## Parte B · En la cuenta de Gmail de ADEP

### B1. Pegar el código nuevo

1. Abra la hoja **Encuesta de Servicio ADEP → Extensiones → Apps Script**.
2. Borre todo el código, pegue el contenido nuevo de `google-apps-script/Code.gs` y guarde (💾).

### B2. Agregar los datos de Microsoft

En **Configuración del proyecto ⚙️ → Propiedades de la secuencia de comandos → Editar**,
agregue estas 4 propiedades (nombres exactamente así, en mayúsculas):

| Propiedad | Valor |
|---|---|
| `MS_TENANT` | Id. de directorio (inquilino) |
| `MS_CLIENT_ID` | Id. de aplicación (cliente) |
| `MS_SECRET` | Valor del secreto |
| `MS_REMITENTE` | Correo que envía, por ejemplo `encuesta@adep.cr` |

Deje `CORREOS` y `CLAVE_RESULTADOS` como están. Presione **Guardar propiedades**.

### B3. Probar

1. Vuelva al **Editor** (`< >`), elija la función **probarCorreo** y presione **Ejecutar**.
2. Google pedirá **permisos nuevos** (para conectarse con Microsoft): elija la cuenta de ADEP y presione **Permitir**.
3. Abajo, en el **Registro de ejecución**, debe decir:
   `Listo: la prueba salió por Microsoft 365 desde encuesta@adep.cr`
4. Revise que a los correos de `CORREOS` llegue "Encuesta ADEP · Prueba de envío", **enviado desde el correo de Microsoft**.

Si sale un error en rojo, vea la tabla de abajo.

### B4. Actualizar la implementación (¡importante!)

Sin este paso, la encuesta sigue usando el código viejo.

1. **Implementar → Gestionar implementaciones**.
2. Presione el lápiz ✏️, en **Versión** elija **Nueva versión** y presione **Implementar**.

La dirección (`…/exec`) sigue siendo la misma; no hay que cambiar nada en la encuesta ni en GitHub.

### B5. Prueba final

Responda la encuesta con una cédula de prueba y revise que llegue el correo con los dos PDF
desde el correo de Microsoft. Después borre la pestaña **Respuestas** de la hoja.

---

## Si algo falla

| Mensaje | Qué significa | Qué hacer |
|---|---|---|
| `No se pudo entrar a Microsoft (400)` o `(401)` y menciona `AADSTS7000215` | El secreto está mal copiado o venció | Copie otra vez el **Valor** (no el Id.) o cree un secreto nuevo (A4) |
| `No se pudo entrar a Microsoft (400)` y menciona `AADSTS700016` o `AADSTS90002` | El Id. de aplicación o de directorio está mal | Revise `MS_CLIENT_ID` y `MS_TENANT` |
| `Microsoft no envió el correo (403)` | Falta el permiso o el consentimiento | Revise A3 (o A5 si se limitó el buzón) |
| `Microsoft no envió el correo (404)` | El correo de `MS_REMITENTE` no existe en Microsoft 365 | Revise que esté bien escrito |
| `Listo: la prueba salió por Gmail` | Falta alguna de las 4 propiedades | Revise los nombres en B2 |

## Volver a Gmail

Basta con borrar la propiedad `MS_SECRET` (o las cuatro `MS_…`). El correo vuelve a salir desde Gmail
sin cambiar nada más.
