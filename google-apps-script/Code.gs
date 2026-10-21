/**
 * Backend de la Encuesta de Servicio ADEP (Google Apps Script + Google Sheets).
 *
 * - Guarda cada respuesta como una fila en la hoja "Respuestas".
 * - Rechaza una segunda respuesta de la misma persona (columna "id_persona": cédula cifrada).
 * - Entrega los resultados a la página resultados.html, solo con la clave correcta.
 *
 * Instalación: vea el archivo INSTALAR-BACKEND.md del proyecto.
 * La clave de resultados NO va en este código: se guarda en
 * Configuración del proyecto > Propiedades de la secuencia de comandos > CLAVE_RESULTADOS.
 */
var HOJA = "Respuestas";
var COLUMNA_ID = "id_persona";
var MAX_TEXTO = 2000;

// Columnas permitidas, en el orden en que aparecen en la hoja.
// Las de calificación ("Satisfacción - ..." y "Aspecto - ...") se aceptan aparte.
var COLUMNAS = [
  "fecha", "filial", "edad", "antiguedad", "servicios_utilizados", "temas_revista_ecos",
  "mejora_bienestar", "recomendaria_adep", "canales_comunicacion", "redes_sociales",
  "servicios_a_fortalecer", "nuevos_beneficios", "recomendaciones", COLUMNA_ID,
];

function hoja_() {
  var libro = SpreadsheetApp.getActiveSpreadsheet();
  return libro.getSheetByName(HOJA) || libro.insertSheet(HOJA);
}

function responder_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function esId_(id) {
  return typeof id === "string" && /^[0-9a-f]{64}$/.test(id);
}

function esCalificacion_(k) {
  return /^(Satisfacción|Aspecto) - .{1,120}$/.test(k);
}

// Evita que un texto que empiece con = + - @ se ejecute como fórmula en la hoja.
function limpiar_(v) {
  var t = String(v === undefined || v === null ? "" : v).slice(0, MAX_TEXTO);
  return /^[=+\-@\t\r]/.test(t) ? "'" + t : t;
}

function encabezados_(sheet) {
  return sheet.getLastRow() > 0 && sheet.getLastColumn() > 0
    ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    : [];
}

function existe_(sheet, id) {
  if (!esId_(id) || sheet.getLastRow() < 2) return false;
  var col = encabezados_(sheet).indexOf(COLUMNA_ID);
  if (col === -1) return false;
  var ids = sheet.getRange(2, col + 1, sheet.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0] === id) return true;
  }
  return false;
}

function claveCorrecta_(clave) {
  var guardada = PropertiesService.getScriptProperties().getProperty("CLAVE_RESULTADOS");
  return !!guardada && typeof clave === "string" && clave === guardada;
}

// GET ?verificar=<id>  ->  { existe: true | false }
function doGet(e) {
  var id = (e && e.parameter && e.parameter.verificar) || "";
  if (!id) return responder_({ ok: true, servicio: "Encuesta ADEP" });
  return responder_({ existe: existe_(hoja_(), id) });
}

// POST:
//   { accion: "resultados", clave }  ->  { ok, filas: [...] }  (sin id_persona)
//   { ...respuestas, id_persona }    ->  { ok: true } | { ok: false, duplicado: true } | { ok: false, error }
function doPost(e) {
  var data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return responder_({ ok: false, error: "Datos inválidos." });
  }

  if (data.accion === "resultados") return resultados_(data.clave);
  return guardar_(data);
}

function resultados_(clave) {
  if (!claveCorrecta_(clave)) {
    Utilities.sleep(1500); // frena a quien intente adivinar la clave
    return responder_({ ok: false, error: "Clave incorrecta." });
  }
  var sheet = hoja_();
  if (sheet.getLastRow() < 2) return responder_({ ok: true, filas: [] });
  var valores = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
  var cab = valores[0];
  var filas = valores.slice(1).map(function (fila) {
    var o = {};
    cab.forEach(function (c, i) {
      if (c === COLUMNA_ID) return;
      var v = fila[i];
      if (v instanceof Date) v = v.toISOString();
      o[c] = typeof v === "string" && v.charAt(0) === "'" ? v.slice(1) : v;
    });
    return o;
  });
  return responder_({ ok: true, filas: filas });
}

function guardar_(data) {
  if (!esId_(data[COLUMNA_ID])) return responder_({ ok: false, error: "Falta la identificación." });
  if (!data.filial || !data.edad) return responder_({ ok: false, error: "Faltan respuestas obligatorias." });

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sheet = hoja_();
    if (existe_(sheet, data[COLUMNA_ID])) return responder_({ ok: false, duplicado: true });

    var fila = {};
    Object.keys(data).forEach(function (k) {
      if (k === "fecha" || k === "accion") return;
      if (COLUMNAS.indexOf(k) !== -1) fila[k] = limpiar_(data[k]);
      else if (esCalificacion_(k)) fila[k] = /^[1-5]$/.test(String(data[k])) ? Number(data[k]) : "";
    });
    fila.fecha = new Date();

    var cab = encabezados_(sheet);
    var cambio = cab.length === 0;
    COLUMNAS.concat(Object.keys(fila)).forEach(function (k) {
      if (fila[k] !== undefined && cab.indexOf(k) === -1) { cab.push(k); cambio = true; }
    });
    if (cambio) {
      sheet.getRange(1, 1, 1, cab.length).setValues([cab]).setFontWeight("bold");
      sheet.setFrozenRows(1);
    }
    sheet.appendRow(cab.map(function (c) { return fila[c] !== undefined ? fila[c] : ""; }));
    return responder_({ ok: true });
  } finally {
    lock.releaseLock();
  }
}
