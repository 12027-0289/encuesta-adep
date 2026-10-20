/**
 * Recibe las respuestas de la encuesta ADEP y las guarda en una Hoja de cálculo de Google.
 *
 * 1. Cree una Hoja de cálculo nueva en Google Drive.
 * 2. Menú Extensiones > Apps Script, pegue este código y guarde.
 * 3. Implementar > Nueva implementación > Tipo: Aplicación web
 *    - Ejecutar como: Yo
 *    - Quién tiene acceso: Cualquier usuario
 * 4. Copie la URL de la aplicación web y péguela en js/config.js (campo "endpoint").
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Respuestas")
      || SpreadsheetApp.getActiveSpreadsheet().insertSheet("Respuestas");
    var data = JSON.parse(e.postData.contents);
    var keys = Object.keys(data);

    var headers = sheet.getLastRow() > 0
      ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      : [];
    keys.forEach(function (k) {
      if (headers.indexOf(k) === -1) headers.push(k);
    });
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");

    var row = headers.map(function (h) { return data[h] !== undefined ? data[h] : ""; });
    sheet.appendRow(row);

    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
