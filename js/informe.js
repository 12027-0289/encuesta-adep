(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var MARCA = /ADEP-ENCUESTA-DATOS:([A-Za-z0-9+/=]+)/;

  var archivos = {};   // nombre+tamaño -> { nombre, estado, datos }

  function escapar(t) {
    var d = document.createElement("div");
    d.textContent = t == null ? "" : String(t);
    return d.innerHTML;
  }

  // Lee las respuestas guardadas dentro de un PDF de la encuesta.
  function leerPDF(file) {
    return file.arrayBuffer().then(function (buf) {
      var bytes = new Uint8Array(buf), texto = "";
      for (var i = 0; i < bytes.length; i += 65536) {
        texto += String.fromCharCode.apply(null, bytes.subarray(i, i + 65536));
      }
      var m = MARCA.exec(texto);
      if (!m) return null;
      var bin = atob(m[1]), u8 = new Uint8Array(bin.length);
      for (var j = 0; j < bin.length; j++) u8[j] = bin.charCodeAt(j);
      return JSON.parse(new TextDecoder().decode(u8));
    }).catch(function () { return null; });
  }

  function agregar(lista) {
    var pdfs = Array.prototype.filter.call(lista, function (f) { return /\.pdf$/i.test(f.name) || f.type === "application/pdf"; });
    if (!pdfs.length) { $("#inf-status").textContent = "Elija archivos PDF de la encuesta."; return; }
    $("#zona").classList.add("leyendo");
    Promise.all(pdfs.map(function (f) {
      var clave = f.name + "|" + f.size;
      if (archivos[clave]) return null;
      return leerPDF(f).then(function (datos) {
        archivos[clave] = { nombre: f.name, datos: datos };
      });
    })).then(function () {
      $("#zona").classList.remove("leyendo");
      mostrar();
    });
  }

  // Una respuesta por persona: si el mismo código aparece varias veces, queda la más reciente.
  function calcular() {
    var porPersona = {}, sinDatos = [], conDatos = 0;
    Object.keys(archivos).forEach(function (k) {
      var a = archivos[k];
      if (!a.datos) { sinDatos.push(a.nombre); a.estado = "sin"; return; }
      conDatos++;
      var id = a.datos.id_persona || ("archivo:" + k);
      var previo = porPersona[id];
      if (!previo || new Date(a.datos.fecha) > new Date(previo.datos.fecha)) porPersona[id] = a;
    });
    Object.keys(archivos).forEach(function (k) {
      var a = archivos[k];
      if (!a.datos) return;
      var id = a.datos.id_persona || ("archivo:" + k);
      a.estado = porPersona[id] === a ? "ok" : "repetida";
    });
    var filas = Object.keys(porPersona).map(function (id) { return porPersona[id].datos; });
    return { filas: filas, sinDatos: sinDatos, repetidas: conDatos - filas.length };
  }

  function mostrar() {
    var C = calcular();
    var total = Object.keys(archivos).length;
    $("#panel").hidden = total === 0;
    $("#inf-status").textContent = "";
    if (!total) return;

    var partes = ['<p class="est-principal"><i class="fa-solid fa-circle-check"></i> <strong>' + C.filas.length +
      "</strong> " + (C.filas.length === 1 ? "respuesta lista" : "respuestas listas") + " para el informe</p><ul>"];
    partes.push("<li>" + total + (total === 1 ? " archivo revisado" : " archivos revisados") + "</li>");
    if (C.repetidas) partes.push('<li class="aviso-rep">' + C.repetidas + (C.repetidas === 1 ? " respuesta repetida" : " respuestas repetidas") +
      " de la misma persona (se usa solo la más reciente)</li>");
    if (C.sinDatos.length) partes.push('<li class="aviso-sin">' + C.sinDatos.length +
      (C.sinDatos.length === 1 ? " archivo no es de la encuesta o es" : " archivos no son de la encuesta o son") + " de una versión anterior</li>");
    partes.push("</ul>");
    $("#estado").innerHTML = partes.join("");

    var R = window.ADEP_INFORME.resumen(C.filas);
    var pct = function (n) { return R.N ? Math.round((n / R.N) * 100) + "<small>%</small>" : "—"; };
    $("#kpis").innerHTML =
      kpi("fa-users", "Respuestas", String(R.N), "Personas asociadas") +
      kpi("fa-star", "Calificación promedio", R.N ? R.promedio.toFixed(1).replace(".", ",") + " <small>de 5</small>" : "—", "Servicios y aspectos") +
      kpi("fa-thumbs-up", "Recomendaría la ADEP", pct(R.reco), R.reco + " de " + R.N + " dijeron «Sí»") +
      kpi("fa-heart", "Mejora mucho su bienestar", pct(R.mucho), R.mucho + " de " + R.N + " dijeron «Mucho»");

    $("#lista-archivos").innerHTML = Object.keys(archivos).sort().map(function (k) {
      var a = archivos[k];
      var etq = a.estado === "ok" ? ['ok', "Incluida"] : a.estado === "repetida" ? ['rep', "Repetida"] : ['sin', "Sin datos"];
      return '<li><span class="etq ' + etq[0] + '">' + etq[1] + "</span> " + escapar(a.nombre) +
        (a.datos ? ' <small>· ' + escapar(window.ADEP_INFORME.nombreFilial(a.datos.filial)) + "</small>" : "") + "</li>";
    }).join("");
    $("#descargar").disabled = C.filas.length === 0;
  }

  function kpi(icono, titulo, numero, detalle) {
    return '<div class="kpi"><p class="kpi-tit"><i class="fa-solid ' + icono + '"></i> ' + escapar(titulo) + "</p>" +
      '<p class="kpi-num">' + numero + '</p><p class="kpi-det">' + escapar(detalle) + "</p></div>";
  }

  /* ---------- Eventos ---------- */
  var zona = $("#zona");
  $("#archivos").addEventListener("change", function (e) { agregar(e.target.files); e.target.value = ""; });
  ["dragenter", "dragover"].forEach(function (t) {
    zona.addEventListener(t, function (e) { e.preventDefault(); zona.classList.add("encima"); });
  });
  ["dragleave", "drop"].forEach(function (t) {
    zona.addEventListener(t, function (e) { e.preventDefault(); zona.classList.remove("encima"); });
  });
  zona.addEventListener("drop", function (e) { agregar(e.dataTransfer.files); });
  // Evita que el navegador abra el PDF si se suelta fuera del recuadro.
  window.addEventListener("dragover", function (e) { e.preventDefault(); });
  window.addEventListener("drop", function (e) { e.preventDefault(); });

  $("#limpiar").addEventListener("click", function () { archivos = {}; mostrar(); });

  $("#descargar").addEventListener("click", function () {
    var C = calcular();
    var btn = $("#descargar");
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Preparando informe…';
    var nota = C.repetidas === 1 ? "Se descartó 1 respuesta repetida de la misma persona; se usó la más reciente."
      : C.repetidas ? "Se descartaron " + C.repetidas + " respuestas repetidas de la misma persona; se usó la más reciente de cada una." : "";
    window.ADEP_INFORME.crear(C.filas, { nota: nota }).then(function (blob) {
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "Informe-general-Encuesta-ADEP-" + new Date().toISOString().slice(0, 10) + ".pdf";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
      $("#inf-status").textContent = "";
    }).catch(function (err) {
      $("#inf-status").textContent = "No se pudo crear el informe: " + err.message + " Revise su conexión a internet.";
    }).finally(function () {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Descargar informe PDF';
    });
  });

  $("#year").textContent = new Date().getFullYear();
})();
