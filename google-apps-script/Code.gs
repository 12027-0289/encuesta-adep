/**
 * Backend de la Encuesta de Servicio ADEP (Google Apps Script + Google Sheets).
 *
 * Con cada respuesta:
 *   1. La guarda como una fila en la hoja "Respuestas" (y rechaza cédulas repetidas).
 *   2. Arma el INFORME GENERAL en PDF con todas las respuestas guardadas.
 *   3. Envía un correo, desde esta cuenta de Gmail, con dos PDF adjuntos:
 *      la respuesta de la persona y el informe general.
 * Además entrega los datos a resultados.html, solo con la clave correcta.
 *
 * Instalación: vea INSTALAR-BACKEND.md. Datos que NO van en este código
 * (Configuración del proyecto > Propiedades de la secuencia de comandos):
 *   CLAVE_RESULTADOS  clave de la página de resultados
 *   CORREOS           correos que reciben los resultados, separados por coma
 */
var HOJA = "Respuestas";
var COLUMNA_ID = "id_persona";
var MAX_TEXTO = 2000;
var MAX_PDF = 3 * 1024 * 1024; // tamaño máximo del PDF individual (en caracteres base64)

var COLUMNAS = [
  "fecha", "filial", "edad", "antiguedad", "servicios_utilizados", "temas_revista_ecos",
  "mejora_bienestar", "recomendaria_adep", "canales_comunicacion", "redes_sociales",
  "servicios_a_fortalecer", "nuevos_beneficios", "recomendaciones", COLUMNA_ID,
];

/* ======================= Utilidades ======================= */
function hoja_() {
  var libro = SpreadsheetApp.getActiveSpreadsheet();
  return libro.getSheetByName(HOJA) || libro.insertSheet(HOJA);
}
function responder_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function esId_(id) { return typeof id === "string" && /^[0-9a-f]{64}$/.test(id); }
function esCalificacion_(k) { return /^(Satisfacción|Aspecto) - .{1,120}$/.test(k); }
// Evita que un texto que empiece con = + - @ se ejecute como fórmula en la hoja.
function limpiar_(v) {
  var t = String(v === undefined || v === null ? "" : v).slice(0, MAX_TEXTO);
  return /^[=+\-@\t\r]/.test(t) ? "'" + t : t;
}
function encabezados_(sheet) {
  return sheet.getLastRow() > 0 && sheet.getLastColumn() > 0
    ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] : [];
}
function existe_(sheet, id) {
  if (!esId_(id) || sheet.getLastRow() < 2) return false;
  var col = encabezados_(sheet).indexOf(COLUMNA_ID);
  if (col === -1) return false;
  var ids = sheet.getRange(2, col + 1, sheet.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (ids[i][0] === id) return true;
  return false;
}
function propiedad_(k) { return PropertiesService.getScriptProperties().getProperty(k); }
function claveCorrecta_(clave) {
  var guardada = propiedad_("CLAVE_RESULTADOS");
  return !!guardada && typeof clave === "string" && clave === guardada;
}
function correos_() {
  return String(propiedad_("CORREOS") || "").split(",").map(function (c) { return c.trim(); })
    .filter(function (c) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c); });
}
// Todas las filas como objetos (sin id_persona).
function filas_(sheet) {
  if (sheet.getLastRow() < 2) return [];
  var valores = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
  var cab = valores[0];
  return valores.slice(1).map(function (fila) {
    var o = {};
    cab.forEach(function (c, i) {
      if (c === COLUMNA_ID) return;
      var v = fila[i];
      if (v instanceof Date) v = v.toISOString();
      o[c] = typeof v === "string" && v.charAt(0) === "'" ? v.slice(1) : v;
    });
    return o;
  });
}

/* ======================= Entradas ======================= */
// GET ?verificar=<id>  ->  { existe: true | false }
function doGet(e) {
  var id = (e && e.parameter && e.parameter.verificar) || "";
  if (!id) return responder_({ ok: true, servicio: "Encuesta ADEP" });
  return responder_({ existe: existe_(hoja_(), id) });
}

// POST { accion: "resultados", clave } -> { ok, filas }
// POST { ...respuestas, id_persona, pdf_base64, pdf_nombre } -> { ok, correo } | { ok: false, duplicado: true }
function doPost(e) {
  var data;
  try { data = JSON.parse(e.postData.contents); } catch (err) { return responder_({ ok: false, error: "Datos inválidos." }); }
  if (data.accion === "resultados") {
    if (!claveCorrecta_(data.clave)) { Utilities.sleep(1500); return responder_({ ok: false, error: "Clave incorrecta." }); }
    return responder_({ ok: true, filas: filas_(hoja_()) });
  }
  return guardar_(data);
}

function guardar_(data) {
  if (!esId_(data[COLUMNA_ID])) return responder_({ ok: false, error: "Falta la identificación." });
  if (!data.filial || !data.edad) return responder_({ ok: false, error: "Faltan respuestas obligatorias." });

  var sheet = hoja_();
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (existe_(sheet, data[COLUMNA_ID])) return responder_({ ok: false, duplicado: true });
    var fila = {};
    Object.keys(data).forEach(function (k) {
      if (COLUMNAS.indexOf(k) !== -1 && k !== "fecha") fila[k] = limpiar_(data[k]);
      else if (esCalificacion_(k)) fila[k] = /^[1-5]$/.test(String(data[k])) ? Number(data[k]) : "";
    });
    fila.fecha = new Date();
    var cab = encabezados_(sheet), cambio = cab.length === 0;
    COLUMNAS.concat(Object.keys(fila)).forEach(function (k) {
      if (fila[k] !== undefined && cab.indexOf(k) === -1) { cab.push(k); cambio = true; }
    });
    if (cambio) { sheet.getRange(1, 1, 1, cab.length).setValues([cab]).setFontWeight("bold"); sheet.setFrozenRows(1); }
    sheet.appendRow(cab.map(function (c) { return fila[c] !== undefined ? fila[c] : ""; }));
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }

  // El envío del correo no debe hacer fallar la respuesta: ya quedó guardada.
  var correo = false;
  try { correo = enviarCorreo_(data, sheet); } catch (err) { console.error("Correo: " + err); }
  return responder_({ ok: true, correo: correo });
}

/* ======================= Correo con los dos PDF ======================= */
function enviarCorreo_(data, sheet) {
  var para = correos_();
  if (!para.length) { console.warn("No hay correos en la propiedad CORREOS."); return false; }
  if (MailApp.getRemainingDailyQuota() < para.length) { console.warn("Se agotó el límite diario de correos."); return false; }

  var filas = filas_(sheet);
  var R = resumen_(filas);
  var hoy = Utilities.formatDate(new Date(), "America/Costa_Rica", "yyyy-MM-dd");
  var adjuntos = [];

  var b64 = String(data.pdf_base64 || "");
  if (b64 && b64.length < MAX_PDF && b64.indexOf("JVBERi0") === 0) { // "JVBERi0" = "%PDF-" en base64
    var nombre = String(data.pdf_nombre || "Respuesta-Encuesta-ADEP.pdf").replace(/[^A-Za-z0-9._-]/g, "-").slice(0, 80);
    adjuntos.push(Utilities.newBlob(Utilities.base64Decode(b64), "application/pdf", nombre));
  }
  var informe = Utilities.newBlob(htmlInforme_(R), "text/html", "informe.html").getAs("application/pdf")
    .setName("Informe-general-Encuesta-ADEP-" + hoy + ".pdf");
  adjuntos.push(informe);

  var filial = String(data.filial || "").replace(/\s*\([^)]+\)\s*$/, "");
  MailApp.sendEmail({
    to: para.join(","),
    subject: "Encuesta ADEP · Nueva respuesta · " + filial + " · " + R.N + " en total",
    htmlBody: htmlCorreo_(filial, R),
    attachments: adjuntos,
    name: "Encuesta de Servicio ADEP",
  });
  return true;
}

/* ======================= Cálculos del informe ======================= */
var ORDEN = {
  edad: ["55-64 años", "65-74 años", "75 o más"],
  antiguedad: ["Menos de 1 año", "De 1 a 5 años", "De 6 a 10 años", "Más de 10 años"],
  bienestar: ["Mucho", "Algo", "Poco", "Nada"],
  recomienda: ["Sí", "No", "No estoy seguro(a)"],
  canales: ["Central Telefónica", "Correo Electrónico", "WhatsApp"],
  redes: ["Facebook", "Instagram", "YouTube"],
  provincias: ["San José", "Alajuela", "Cartago", "Heredia", "Guanacaste", "Puntarenas", "Limón", "Otra"],
};
var TEXTOS = [
  ["recomendaciones", "Recomendaciones para mejorar"],
  ["servicios_a_fortalecer", "Servicios que deberían fortalecerse"],
  ["nuevos_beneficios", "Nuevos beneficios que les gustaría"],
  ["temas_revista_ecos", "Temas para la Revista ECOS"],
];
function lista_(v) { return String(v || "").split(",").map(function (x) { return x.trim(); }).filter(String); }
function provincia_(f) {
  if (/^Otra:/.test(f || "")) return "Otra";
  var m = /\(([^)]+)\)\s*$/.exec(f || "");
  return m ? m[1] : "Otra";
}
function nombreFilial_(f) { return String(f || "").replace(/\s*\([^)]+\)\s*$/, ""); }
function pct_(n, t) { return t ? Math.round((n / t) * 100) : 0; }
function contar_(filas, obtener, orden, multiple) {
  var c = {};
  filas.forEach(function (r) {
    var v = obtener(r);
    (multiple ? lista_(v) : [String(v || "")]).forEach(function (x) { if (x) c[x] = (c[x] || 0) + 1; });
  });
  var claves = (orden || []).filter(function (k) { return c[k]; });
  Object.keys(c).forEach(function (k) { if (claves.indexOf(k) === -1) claves.push(k); });
  return claves.map(function (k) { return { et: k, n: c[k] }; });
}
function promedios_(filas, prefijo) {
  var items = [];
  filas.forEach(function (r) { Object.keys(r).forEach(function (k) { if (k.indexOf(prefijo) === 0 && items.indexOf(k) === -1) items.push(k); }); });
  return items.map(function (k) {
    var vals = filas.map(function (r) { return Number(r[k]); }).filter(function (v) { return v >= 1 && v <= 5; });
    return { et: k.slice(prefijo.length), prom: vals.length ? vals.reduce(function (a, b) { return a + b; }, 0) / vals.length : 0, n: vals.length };
  }).filter(function (x) { return x.n; });
}
function resumen_(filas) {
  var N = filas.length, notas = [];
  filas.forEach(function (r) { Object.keys(r).forEach(function (k) { if (esCalificacion_(k) && Number(r[k]) >= 1) notas.push(Number(r[k])); }); });
  var fechas = filas.map(function (r) { return new Date(r.fecha); }).filter(function (d) { return !isNaN(d); }).sort(function (a, b) { return a - b; });
  var porFilial = {};
  filas.forEach(function (r) {
    var k = nombreFilial_(r.filial) || "Sin dato";
    var f = porFilial[k] || (porFilial[k] = { et: k, prov: provincia_(r.filial), n: 0, reco: 0, notas: [] });
    f.n++;
    if (r.recomendaria_adep === "Sí") f.reco++;
    Object.keys(r).forEach(function (c) { if (esCalificacion_(c) && Number(r[c]) >= 1) f.notas.push(Number(r[c])); });
  });
  return {
    N: N, desde: fechas[0], hasta: fechas[fechas.length - 1],
    promedio: notas.length ? notas.reduce(function (a, b) { return a + b; }, 0) / notas.length : 0,
    reco: filas.filter(function (r) { return r.recomendaria_adep === "Sí"; }).length,
    mucho: filas.filter(function (r) { return r.mejora_bienestar === "Mucho"; }).length,
    provincias: contar_(filas, function (r) { return provincia_(r.filial); }, ORDEN.provincias),
    edad: contar_(filas, function (r) { return r.edad; }, ORDEN.edad),
    antiguedad: contar_(filas, function (r) { return r.antiguedad; }, ORDEN.antiguedad),
    servicios: contar_(filas, function (r) { return r.servicios_utilizados; }, [], true).sort(function (a, b) { return b.n - a.n; }),
    satisfaccion: promedios_(filas, "Satisfacción - "),
    aspectos: promedios_(filas, "Aspecto - "),
    bienestar: contar_(filas, function (r) { return r.mejora_bienestar; }, ORDEN.bienestar),
    recomienda: contar_(filas, function (r) { return r.recomendaria_adep; }, ORDEN.recomienda),
    canales: contar_(filas, function (r) { return r.canales_comunicacion; }, ORDEN.canales, true),
    redes: contar_(filas, function (r) { return r.redes_sociales; }, ORDEN.redes, true),
    filiales: Object.keys(porFilial).map(function (k) {
      var f = porFilial[k];
      f.prom = f.notas.length ? f.notas.reduce(function (a, b) { return a + b; }, 0) / f.notas.length : 0;
      return f;
    }).sort(function (a, b) { return b.n - a.n || (a.et < b.et ? -1 : 1); }),
    textos: TEXTOS.map(function (t) {
      return {
        titulo: t[1],
        items: filas.filter(function (r) { return String(r[t[0]] || "").trim(); })
          .map(function (r) { return { texto: String(r[t[0]]).trim(), filial: nombreFilial_(r.filial) }; }),
      };
    }),
  };
}

/* ======================= HTML del informe (se convierte a PDF) ======================= */
var C = { verde: "#008744", oscuro: "#04492a", rojo: "#e52521", oro: "#d4af37", tinta: "#17241e", suave: "#4f5f57", linea: "#dbe6df", niebla: "#f3f8f5", pista: "#e3ece6" };
var SECCION = { participacion: "#008744", servicios: "#0d8a7a", experiencia: "#b8860b", comunicacion: "#c8322e", ideas: "#04492a" };

function esc_(t) {
  return String(t === undefined || t === null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function dec_(n) { return n.toFixed(1).replace(".", ","); }
function fecha_(d) { return d ? Utilities.formatDate(d, "America/Costa_Rica", "d/MM/yyyy") : ""; }
function colorNota_(p) { return p >= 4.5 ? "#008744" : p >= 3.5 ? "#3e9b52" : p >= 2.5 ? "#c99a1e" : p >= 1.5 ? "#e67e22" : "#d64541"; }

function seccion_(titulo, color) {
  return '<table width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 10px;"><tr>' +
    '<td style="background:' + color + ';color:#fff;font-size:15px;font-weight:bold;padding:9px 14px;">' + esc_(titulo) + "</td>" +
    '<td width="70" style="background:' + color + ';opacity:.75;"></td></tr></table>';
}
function barra_(porc, color) {
  var p = Math.max(1, Math.min(100, Math.round(porc)));
  return '<table width="100%" cellpadding="0" cellspacing="0"><tr>' +
    '<td width="' + p + '%" style="background:' + color + ';height:11px;font-size:1px;">&nbsp;</td>' +
    (p < 100 ? '<td width="' + (100 - p) + '%" style="background:' + C.pista + ';height:11px;font-size:1px;">&nbsp;</td>' : "") +
    "</tr></table>";
}
function grafico_(titulo, sub, datos, color, R, promedio) {
  var h = '<div style="margin:12px 0 4px;font-size:13px;font-weight:bold;color:' + C.tinta + ';">' + esc_(titulo) + "</div>" +
    '<div style="font-size:10px;color:' + C.suave + ';margin-bottom:6px;">' + esc_(sub) + "</div>";
  if (!datos.length) return h + '<div style="font-size:11px;color:' + C.suave + ';font-style:italic;">Sin respuestas.</div>';
  var max = promedio ? 5 : Math.max.apply(null, datos.map(function (d) { return d.n; }));
  h += '<table width="100%" cellpadding="4" cellspacing="0" style="font-size:11px;">';
  datos.forEach(function (d, i) {
    var valor = promedio ? d.prom : d.n;
    var texto = promedio
      ? "<b>" + dec_(d.prom) + '</b> <span style="color:' + C.suave + ';font-size:9px;">de 5 · ' + d.n + (d.n === 1 ? " voto" : " votos") + "</span>"
      : "<b>" + d.n + '</b> <span style="color:' + C.suave + ';">(' + pct_(d.n, R.N) + "%)</span>";
    h += '<tr style="background:' + (i % 2 ? "#ffffff" : C.niebla) + ';">' +
      '<td width="36%" style="color:' + C.tinta + ';">' + esc_(d.et) + "</td>" +
      '<td width="44%">' + barra_(max ? (valor / max) * 100 : 0, promedio ? colorNota_(d.prom) : color) + "</td>" +
      '<td width="20%" style="color:' + C.tinta + ';">' + texto + "</td></tr>";
  });
  return h + "</table>";
}
function kpi_(titulo, valor, detalle, color) {
  return '<td width="25%" style="padding:4px;"><table width="100%" cellpadding="8" cellspacing="0" style="background:' + C.niebla +
    ";border:1px solid " + C.linea + ";border-top:4px solid " + color + ';"><tr><td>' +
    '<div style="font-size:8.5px;font-weight:bold;color:' + C.suave + ';letter-spacing:.5px;">' + esc_(titulo) + "</div>" +
    '<div style="font-size:24px;font-weight:bold;color:' + C.oscuro + ';margin:4px 0;">' + valor + "</div>" +
    '<div style="font-size:9px;color:' + C.suave + ';">' + esc_(detalle) + "</div></td></tr></table></td>";
}

function htmlInforme_(R) {
  var periodo = R.desde ? "Respuestas del " + fecha_(R.desde) + (fecha_(R.hasta) !== fecha_(R.desde) ? " al " + fecha_(R.hasta) : "") : "";
  var generado = Utilities.formatDate(new Date(), "America/Costa_Rica", "d/MM/yyyy, h:mm a");
  var h = '<html><head><meta charset="utf-8"></head><body style="font-family:Arial,Helvetica,sans-serif;color:' + C.tinta + ';margin:0;">';

  // Encabezado
  h += '<table width="100%" cellpadding="0" cellspacing="0" style="background:' + C.oscuro + ';"><tr>' +
    '<td width="110" style="padding:18px 0 18px 22px;"><img src="data:image/jpeg;base64,' + LOGO_ADEP + '" width="86" height="86" style="border-radius:43px;"></td>' +
    '<td style="padding:18px 22px 18px 6px;color:#ffffff;">' +
    '<div style="font-size:9px;font-weight:bold;letter-spacing:2px;color:#aaebc8;">ASOCIACIÓN DE EDUCADORES PENSIONADOS</div>' +
    '<div style="font-size:24px;font-weight:bold;margin:4px 0;">Informe general de resultados</div>' +
    '<div style="font-size:13px;color:#e6f8ee;">Encuesta de Servicio a la Persona Asociada</div>' +
    '<div style="font-size:10px;color:#c8f0d7;margin-top:6px;">' + esc_(periodo) + " · Generado el " + esc_(generado) + "</div></td></tr></table>" +
    '<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="background:' + C.rojo + ';height:4px;font-size:1px;">&nbsp;</td></tr>' +
    '<tr><td style="background:' + C.oro + ';height:2px;font-size:1px;">&nbsp;</td></tr></table>';

  h += '<div style="padding:14px 22px 10px;">';
  // Cifras principales
  h += '<table width="100%" cellpadding="0" cellspacing="0"><tr>' +
    kpi_("RESPUESTAS", String(R.N), "personas asociadas", C.verde) +
    kpi_("CALIFICACIÓN PROMEDIO", R.N ? dec_(R.promedio) + ' <span style="font-size:12px;color:' + C.suave + ';">de 5</span>' : "—", "servicios y aspectos", C.oro) +
    kpi_("RECOMENDARÍA LA ADEP", R.N ? pct_(R.reco, R.N) + "%" : "—", R.reco + " de " + R.N + " dijeron «Sí»", "#0d8a7a") +
    kpi_("MEJORA MUCHO SU BIENESTAR", R.N ? pct_(R.mucho, R.N) + "%" : "—", R.mucho + " de " + R.N + " dijeron «Mucho»", C.rojo) +
    "</tr></table>";

  h += seccion_("Participación", SECCION.participacion) +
    grafico_("Respuestas por provincia", "Cantidad de personas y porcentaje del total", R.provincias, SECCION.participacion, R) +
    grafico_("Edad", "Pregunta 2", R.edad, SECCION.participacion, R) +
    grafico_("Años de pertenecer a la ADEP", "Pregunta 3", R.antiguedad, SECCION.participacion, R);
  h += seccion_("Servicios", SECCION.servicios) +
    grafico_("Servicios utilizados", "Pregunta 4 · cada persona pudo marcar varios", R.servicios, SECCION.servicios, R) +
    grafico_("Satisfacción con los servicios", "Pregunta 5 · promedio de 1 (muy malo) a 5 (excelente)", R.satisfaccion, SECCION.servicios, R, true);
  h += seccion_("Experiencia con la ADEP", SECCION.experiencia) +
    grafico_("Calificación de aspectos de ADEP", "Pregunta 7 · promedio de 1 (muy malo) a 5 (excelente)", R.aspectos, SECCION.experiencia, R, true) +
    grafico_("¿ADEP mejora su bienestar y calidad de vida?", "Pregunta 8", R.bienestar, SECCION.experiencia, R) +
    grafico_("¿Recomendaría la ADEP a otras personas de la Educación?", "Pregunta 9", R.recomienda, SECCION.experiencia, R);
  h += seccion_("Comunicación", SECCION.comunicacion) +
    grafico_("Canales de comunicación más usados", "Pregunta 10 · varias opciones", R.canales, SECCION.comunicacion, R) +
    grafico_("Redes sociales más usadas", "Pregunta 11 · varias opciones", R.redes, SECCION.comunicacion, R);

  // Tabla por filial
  h += seccion_("Resultados por filial o núcleo", SECCION.participacion) +
    '<table width="100%" cellpadding="5" cellspacing="0" style="font-size:11px;">' +
    '<tr style="background:' + C.oscuro + ';color:#ffffff;font-weight:bold;"><td width="46%">Filial o núcleo</td><td width="16%">Respuestas</td><td width="20%">Calificación</td><td width="18%">Recomendaría</td></tr>';
  R.filiales.forEach(function (f, i) {
    h += '<tr style="background:' + (i % 2 ? "#ffffff" : C.niebla) + ';"><td>' + esc_(f.et) + ' <span style="color:' + C.suave + ';font-size:9px;">· ' + esc_(f.prov) + "</span></td>" +
      "<td>" + f.n + "</td>" +
      '<td><span style="color:' + (f.prom ? colorNota_(f.prom) : C.suave) + ';">&#9679;</span> ' + (f.prom ? dec_(f.prom) + " de 5" : "—") + "</td>" +
      "<td>" + pct_(f.reco, f.n) + "%</td></tr>";
  });
  h += "</table>";

  // Comentarios
  h += seccion_("Comentarios de las personas asociadas", SECCION.ideas);
  R.textos.forEach(function (t) {
    h += '<div style="margin:12px 0 6px;font-size:13px;font-weight:bold;">' + esc_(t.titulo) +
      ' <span style="font-size:10px;font-weight:normal;color:' + C.suave + ';">' + t.items.length + (t.items.length === 1 ? " comentario" : " comentarios") + "</span></div>";
    if (!t.items.length) { h += '<div style="font-size:11px;color:' + C.suave + ';font-style:italic;">Sin comentarios.</div>'; return; }
    t.items.forEach(function (it) {
      h += '<table width="100%" cellpadding="6" cellspacing="0" style="margin-bottom:5px;"><tr>' +
        '<td width="3" style="background:' + SECCION.ideas + ';padding:0;font-size:1px;">&nbsp;</td>' +
        '<td style="background:#e9f0ec;font-size:11px;">«' + esc_(it.texto) + '»<div style="font-size:9px;color:' + C.suave + ';margin-top:3px;">' + esc_(it.filial) + "</div></td></tr></table>";
    });
  });

  // Cierre
  h += '<table width="70%" align="center" cellpadding="10" cellspacing="0" style="margin-top:24px;background:' + C.oscuro + ';"><tr>' +
    '<td align="center" style="color:#ffffff;font-size:15px;font-weight:bold;"><span style="color:' + C.rojo + ';">&#9679;</span>&nbsp; Orgullosos de ser personas solidarias &nbsp;<span style="color:' + C.rojo + ';">&#9679;</span></td></tr></table>' +
    '<div style="text-align:center;margin-top:14px;font-size:9px;font-weight:bold;letter-spacing:2px;color:' + C.verde + ';">COMPRENSIÓN · FRATERNIDAD · COOPERACIÓN</div>';
  return h + "</div></body></html>";
}

function htmlCorreo_(filial, R) {
  return '<div style="font-family:Arial,Helvetica,sans-serif;color:#17241e;max-width:560px;">' +
    '<div style="background:#04492a;color:#ffffff;padding:18px 22px;border-radius:12px 12px 0 0;border-bottom:4px solid #e52521;">' +
    '<div style="font-size:11px;letter-spacing:2px;color:#aaebc8;font-weight:bold;">ENCUESTA DE SERVICIO · ADEP</div>' +
    '<div style="font-size:20px;font-weight:bold;margin-top:4px;">Nueva respuesta recibida</div></div>' +
    '<div style="border:1px solid #dbe6df;border-top:0;padding:18px 22px;border-radius:0 0 12px 12px;">' +
    "<p>Se recibió una nueva respuesta de la filial <b>" + esc_(filial) + "</b>.</p>" +
    "<p>Van <b>" + R.N + "</b> respuestas en total. Calificación promedio: <b>" + dec_(R.promedio) + " de 5</b>. " +
    "Recomendaría la ADEP: <b>" + pct_(R.reco, R.N) + "%</b>.</p>" +
    "<p>Adjuntos:</p><ul><li>La respuesta de la persona (PDF).</li><li>El informe general actualizado con gráficos y porcentajes (PDF).</li></ul>" +
    '<p style="color:#008744;font-weight:bold;">Orgullosos de ser personas solidarias</p></div></div>';
}

/* Prueba manual: en el editor elija "probarCorreo" y presione Ejecutar. Envía el informe actual a CORREOS. */
function probarCorreo() {
  var sheet = hoja_();
  var R = resumen_(filas_(sheet));
  var informe = Utilities.newBlob(htmlInforme_(R), "text/html", "informe.html").getAs("application/pdf").setName("Informe-de-prueba.pdf");
  MailApp.sendEmail({ to: correos_().join(","), subject: "Encuesta ADEP · Prueba del informe", htmlBody: htmlCorreo_("(prueba)", R), attachments: [informe], name: "Encuesta de Servicio ADEP" });
}

/* Logo de ADEP para el informe (imagen pequeña en base64). */
var LOGO_ADEP = "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";
