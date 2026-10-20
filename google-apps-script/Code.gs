/**
 * Recibe las respuestas de la encuesta ADEP y las guarda en una Hoja de cálculo de Google.
 * Rechaza una segunda respuesta de la misma persona (columna "id_persona": cédula cifrada).
 *
 * 1. Cree una Hoja de cálculo nueva en Google Drive.
 * 2. Menú Extensiones > Apps Script, pegue este código y guarde.
 * 3. Implementar > Nueva implementación > Tipo: Aplicación web
 *    - Ejecutar como: Yo
 *    - Quién tiene acceso: Cualquier usuario
 * 4. Copie la URL de la aplicación web y péguela en js/config.js (campo "endpoint").
 *    Si luego cambia este código: Implementar > Gestionar implementaciones > Editar > Nueva versión.
 */
var HOJA = "Respuestas";
var COLUMNA_ID = "id_persona";

function hoja_() {
  var libro = SpreadsheetApp.getActiveSpreadsheet();
  return libro.getSheetByName(HOJA) || libro.insertSheet(HOJA);
}

function responder_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function existe_(sheet, id) {
  if (!id || sheet.getLastRow() < 2) return false;
  var encabezados = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var col = encabezados.indexOf(COLUMNA_ID);
  if (col === -1) return false;
  var ids = sheet.getRange(2, col + 1, sheet.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0] === id) return true;
  }
  return false;
}

// GET ?verificar=<id>  ->  { existe: true | false }
function doGet(e) {
  var id = (e && e.parameter && e.parameter.verificar) || "";
  return responder_({ existe: existe_(hoja_(), id) });
}

// POST con las respuestas  ->  { ok: true } o { ok: false, duplicado: true }
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheet = hoja_();
    var data = JSON.parse(e.postData.contents);

    if (!data[COLUMNA_ID]) return responder_({ ok: false, error: "Falta la identificación." });
    if (existe_(sheet, data[COLUMNA_ID])) return responder_({ ok: false, duplicado: true });

    var headers = sheet.getLastRow() > 0
      ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      : [];
    Object.keys(data).forEach(function (k) {
      if (headers.indexOf(k) === -1) headers.push(k);
    });
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");

    var row = headers.map(function (h) { return data[h] !== undefined ? data[h] : ""; });
    sheet.appendRow(row);
    return responder_({ ok: true });
  } finally {
    lock.releaseLock();
  }
}
