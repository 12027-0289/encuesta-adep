(function () {
  "use strict";

  var cfg = window.ADEP_CONFIG || { endpoint: "", servicios: [], aspectos: [], filiales: {} };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var demo = !cfg.endpoint;
  var CLAVE_SESION = "adep-resultados-clave";

  var todas = [];      // todas las respuestas recibidas
  var vistas = [];     // las que pasan los filtros
  var tabActiva = "recomendaciones";

  var ORDEN = {
    edad: ["55-64 años", "65-74 años", "75 o más"],
    antiguedad: ["Menos de 1 año", "De 1 a 5 años", "De 6 a 10 años", "Más de 10 años"],
    bienestar: ["Mucho", "Algo", "Poco", "Nada"],
    recomienda: ["Sí", "No", "No estoy seguro(a)"],
    canales: ["Central Telefónica", "Correo Electrónico", "WhatsApp"],
    redes: ["Facebook", "Instagram", "YouTube"],
    provincias: Object.keys(cfg.filiales || {}).concat(["Otra"]),
  };
  var TEXTOS = [
    { campo: "recomendaciones", titulo: "Recomendaciones" },
    { campo: "servicios_a_fortalecer", titulo: "Servicios a fortalecer" },
    { campo: "nuevos_beneficios", titulo: "Nuevos beneficios" },
    { campo: "temas_revista_ecos", titulo: "Temas para la Revista ECOS" },
  ];

  /* ---------- Utilidades ---------- */
  function escapar(t) {
    var d = document.createElement("div");
    d.textContent = t == null ? "" : String(t);
    return d.innerHTML;
  }
  function lista(v) {
    return String(v || "").split(",").map(function (x) { return x.trim(); }).filter(Boolean);
  }
  function provinciaDe(filial) {
    var m = /\(([^)]+)\)\s*$/.exec(filial || "");
    if (/^Otra:/.test(filial || "")) return "Otra";
    return m ? m[1] : "Otra";
  }
  function nombreFilial(filial) {
    return String(filial || "").replace(/\s*\([^)]+\)\s*$/, "");
  }
  function pct(n, total) { return total ? Math.round((n / total) * 100) : 0; }
  function fechaCorta(v) {
    var d = new Date(v);
    return isNaN(d) ? "" : d.toLocaleDateString("es-CR", { day: "numeric", month: "short", year: "numeric" });
  }

  /* ---------- Cargar datos ---------- */
  function cargar(clave) {
    if (demo) {
      var locales = [];
      try { locales = JSON.parse(localStorage.getItem("adep-respuestas") || "[]"); } catch (e) { /* nada */ }
      return Promise.resolve(locales.map(function (r) {
        var o = Object.assign({}, r);
        delete o.id_persona;
        return o;
      }));
    }
    return fetch(cfg.endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ accion: "resultados", clave: clave }),
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j.ok) throw new Error(j.error || "No se pudieron cargar los resultados.");
      return j.filas || [];
    });
  }

  function entrar(clave) {
    var btn = $("#entrar");
    btn.disabled = true;
    $("#clave-error").textContent = "";
    cargar(clave).then(function (filas) {
      try { sessionStorage.setItem(CLAVE_SESION, clave || ""); } catch (e) { /* nada */ }
      todas = filas;
      $("#ingreso").hidden = true;
      $("#tablero").hidden = false;
      $("#salir").hidden = demo;
      llenarFiltros();
      dibujar();
      $("#res-actualizado").textContent = (demo ? "Modo demostración · " : "") +
        "Actualizado: " + new Date().toLocaleString("es-CR", { dateStyle: "long", timeStyle: "short" });
    }).catch(function (err) {
      $("#clave-error").textContent = err.message === "Failed to fetch"
        ? "No hay conexión con la hoja de Google. Revise su internet e intente de nuevo."
        : err.message;
      try { sessionStorage.removeItem(CLAVE_SESION); } catch (e) { /* nada */ }
    }).finally(function () { btn.disabled = false; });
  }

  $("#form-clave").addEventListener("submit", function (e) {
    e.preventDefault();
    var clave = $("#clave").value.trim();
    if (!demo && !clave) { $("#clave-error").textContent = "Escriba la clave."; return; }
    entrar(clave);
  });
  $("#salir").addEventListener("click", function () {
    try { sessionStorage.removeItem(CLAVE_SESION); } catch (e) { /* nada */ }
    location.reload();
  });
  $("#actualizar").addEventListener("click", function () {
    var t = $("#tablero");
    t.classList.add("cargando");
    var clave = "";
    try { clave = sessionStorage.getItem(CLAVE_SESION) || ""; } catch (e) { /* nada */ }
    cargar(clave).then(function (filas) {
      todas = filas;
      llenarFiltros();
      dibujar();
      $("#res-actualizado").textContent = (demo ? "Modo demostración · " : "") +
        "Actualizado: " + new Date().toLocaleString("es-CR", { dateStyle: "long", timeStyle: "short" });
    }).catch(function (err) { alert(err.message); })
      .finally(function () { t.classList.remove("cargando"); });
  });

  /* ---------- Filtros ---------- */
  function opciones(sel, valores) {
    var actual = sel.value;
    sel.innerHTML = '<option value="">Todas</option>' + valores.map(function (v) {
      return '<option value="' + escapar(v) + '">' + escapar(v) + "</option>";
    }).join("");
    sel.value = valores.indexOf(actual) !== -1 ? actual : "";
  }
  function llenarFiltros() {
    var provs = ORDEN.provincias.filter(function (p) { return todas.some(function (r) { return provinciaDe(r.filial) === p; }); });
    opciones($("#f-provincia"), provs);
    filtrarFiliales();
    opciones($("#f-edad"), ORDEN.edad);
  }
  function filtrarFiliales() {
    var prov = $("#f-provincia").value;
    var nombres = {};
    todas.forEach(function (r) {
      if (!prov || provinciaDe(r.filial) === prov) nombres[nombreFilial(r.filial)] = true;
    });
    opciones($("#f-filial"), Object.keys(nombres).sort(function (a, b) { return a.localeCompare(b, "es"); }));
  }
  $("#f-provincia").addEventListener("change", function () { filtrarFiliales(); dibujar(); });
  $("#f-filial").addEventListener("change", dibujar);
  $("#f-edad").addEventListener("change", dibujar);

  function aplicarFiltros() {
    var prov = $("#f-provincia").value, fil = $("#f-filial").value, edad = $("#f-edad").value;
    return todas.filter(function (r) {
      return (!prov || provinciaDe(r.filial) === prov) &&
        (!fil || nombreFilial(r.filial) === fil) &&
        (!edad || r.edad === edad);
    });
  }

  /* ---------- Cálculos ---------- */
  function contar(filas, campo, orden, multiple) {
    var c = {};
    filas.forEach(function (r) {
      (multiple ? lista(r[campo]) : [r[campo]]).forEach(function (v) {
        if (v === "" || v == null) return;
        c[v] = (c[v] || 0) + 1;
      });
    });
    var claves = (orden || []).filter(function (k) { return c[k]; });
    Object.keys(c).forEach(function (k) { if (claves.indexOf(k) === -1) claves.push(k); });
    return claves.map(function (k) { return { et: k, n: c[k] }; });
  }
  function promedios(filas, prefijo, items) {
    return items.map(function (item) {
      var vals = filas.map(function (r) { return Number(r[prefijo + item]); }).filter(function (v) { return v >= 1 && v <= 5; });
      var suma = vals.reduce(function (a, b) { return a + b; }, 0);
      return { et: item, prom: vals.length ? suma / vals.length : 0, n: vals.length };
    }).filter(function (x) { return x.n; });
  }

  /* ---------- Dibujo ---------- */
  function grafico(titulo, sub, datos, total, opts) {
    opts = opts || {};
    var html = '<article class="grafico' + (opts.ancho ? " ancho" : "") + '"><h3>' + escapar(titulo) + "</h3>" +
      '<p class="g-sub">' + escapar(sub) + "</p>";
    if (!datos.length) return html + '<p class="g-nada">Sin respuestas todavía.</p></article>';
    var max = opts.escala || Math.max.apply(null, datos.map(function (d) { return opts.promedio ? d.prom : d.n; }));
    html += '<div class="barras">' + datos.map(function (d, i) {
      var valor = opts.promedio ? d.prom : d.n;
      var ancho = max ? (valor / max) * 100 : 0;
      var texto = opts.promedio
        ? d.prom.toFixed(1).replace(".", ",") + " <small>de 5 · " + d.n + (d.n === 1 ? " calificación" : " calificaciones") + "</small>"
        : d.n + " <small>(" + pct(d.n, total) + "%)</small>";
      var ayuda = opts.promedio
        ? d.et + ": promedio " + d.prom.toFixed(2) + " de 5, con " + d.n + " calificaciones"
        : d.et + ": " + d.n + " de " + total + " (" + pct(d.n, total) + "%)";
      return '<div class="barra-fila" title="' + escapar(ayuda) + '">' +
        '<span class="b-et">' + escapar(d.et) + "</span>" +
        '<span class="b-pista"><span class="b-relleno" style="width:' + ancho.toFixed(1) + "%;animation-delay:" + (i * 0.05) + 's"></span></span>' +
        '<span class="b-val">' + texto + "</span></div>";
    }).join("") + "</div></article>";
    return html;
  }

  function kpi(icono, titulo, numero, detalle) {
    return '<div class="kpi"><p class="kpi-tit"><i class="fa-solid ' + icono + '"></i> ' + escapar(titulo) + "</p>" +
      '<p class="kpi-num">' + numero + "</p>" + '<p class="kpi-det">' + escapar(detalle) + "</p></div>";
  }

  function dibujar() {
    vistas = aplicarFiltros();
    var N = vistas.length;
    $("#vacio").hidden = N > 0;

    // Cifras principales
    var reco = vistas.filter(function (r) { return r.recomendaria_adep === "Sí"; }).length;
    var mucho = vistas.filter(function (r) { return r.mejora_bienestar === "Mucho"; }).length;
    var todasNotas = [];
    vistas.forEach(function (r) {
      Object.keys(r).forEach(function (k) {
        if (/^(Satisfacción|Aspecto) - /.test(k) && Number(r[k]) >= 1) todasNotas.push(Number(r[k]));
      });
    });
    var promGeneral = todasNotas.length ? todasNotas.reduce(function (a, b) { return a + b; }, 0) / todasNotas.length : 0;
    $("#kpis").innerHTML =
      kpi("fa-users", "Respuestas", String(N), N === todas.length ? "Total recibidas" : "De " + todas.length + " en total") +
      kpi("fa-star", "Calificación promedio", N ? promGeneral.toFixed(1).replace(".", ",") + " <small>de 5</small>" : "—", "Servicios y aspectos de ADEP") +
      kpi("fa-thumbs-up", "Recomendaría la ADEP", N ? pct(reco, N) + "<small>%</small>" : "—", reco + " de " + N + " respondieron «Sí»") +
      kpi("fa-heart", "ADEP mejora mucho su bienestar", N ? pct(mucho, N) + "<small>%</small>" : "—", mucho + " de " + N + " respondieron «Mucho»");

    if (!N) { $("#graficos").innerHTML = ""; dibujarComentarios(); return; }

    var porProv = contar(vistas.map(function (r) { return { p: provinciaDe(r.filial) }; }), "p", ORDEN.provincias);
    var porFilial = contar(vistas.map(function (r) { return { f: nombreFilial(r.filial) }; }), "f").sort(function (a, b) { return b.n - a.n || a.et.localeCompare(b.et, "es"); });

    $("#graficos").innerHTML =
      grafico("Satisfacción con los servicios", "Promedio de 1 a 5 (pregunta 5)", promedios(vistas, "Satisfacción - ", cfg.servicios), N, { promedio: true, escala: 5, ancho: true }) +
      grafico("Calificación de aspectos de ADEP", "Promedio de 1 a 5 (pregunta 7)", promedios(vistas, "Aspecto - ", cfg.aspectos), N, { promedio: true, escala: 5, ancho: true }) +
      grafico("Servicios utilizados", "Cantidad de personas (pregunta 4)", contar(vistas, "servicios_utilizados", cfg.servicios, true).sort(function (a, b) { return b.n - a.n; }), N) +
      grafico("Respuestas por provincia", "Cantidad de personas", porProv, N) +
      grafico("Respuestas por filial o núcleo", "Cantidad de personas (pregunta 1)", porFilial, N, { ancho: porFilial.length > 8 }) +
      grafico("Edad", "Pregunta 2", contar(vistas, "edad", ORDEN.edad), N) +
      grafico("Años de pertenecer a la ADEP", "Pregunta 3", contar(vistas, "antiguedad", ORDEN.antiguedad), N) +
      grafico("¿ADEP mejora su bienestar?", "Pregunta 8", contar(vistas, "mejora_bienestar", ORDEN.bienestar), N) +
      grafico("¿Recomendaría la ADEP?", "Pregunta 9", contar(vistas, "recomendaria_adep", ORDEN.recomienda), N) +
      grafico("Canales de comunicación", "Pregunta 10 · varias opciones", contar(vistas, "canales_comunicacion", ORDEN.canales, true), N) +
      grafico("Redes sociales", "Pregunta 11 · varias opciones", contar(vistas, "redes_sociales", ORDEN.redes, true), N);

    dibujarComentarios();
  }

  /* ---------- Comentarios ---------- */
  function dibujarComentarios() {
    $("#tabs").innerHTML = TEXTOS.map(function (t) {
      var n = vistas.filter(function (r) { return String(r[t.campo] || "").trim(); }).length;
      return '<button type="button" class="tab" role="tab" data-campo="' + t.campo + '" aria-selected="' + (t.campo === tabActiva) + '">' +
        escapar(t.titulo) + '<span class="n">' + n + "</span></button>";
    }).join("");
    var q = $("#buscar").value.trim().toLowerCase();
    var items = vistas.filter(function (r) {
      var t = String(r[tabActiva] || "").trim();
      return t && (!q || t.toLowerCase().indexOf(q) !== -1);
    });
    $("#lista-com").innerHTML = items.length ? items.map(function (r) {
      var t = escapar(String(r[tabActiva]).trim());
      if (q) t = t.replace(new RegExp("(" + escapar(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi"), "<mark>$1</mark>");
      return "<li><p>" + t + '</p><p class="c-meta">' + escapar(nombreFilial(r.filial)) + " · " + escapar(r.edad || "") +
        (r.fecha ? " · " + fechaCorta(r.fecha) : "") + "</p></li>";
    }).join("") : '<li><p class="g-nada">No hay comentarios' + (q ? " con esa búsqueda" : "") + ".</p></li>";
  }
  $("#tabs").addEventListener("click", function (e) {
    var b = e.target.closest(".tab");
    if (!b) return;
    tabActiva = b.dataset.campo;
    dibujarComentarios();
  });
  $("#buscar").addEventListener("input", dibujarComentarios);

  /* ---------- Excel ---------- */
  $("#excel").addEventListener("click", function () {
    var cols = [];
    vistas.forEach(function (r) { Object.keys(r).forEach(function (k) { if (cols.indexOf(k) === -1) cols.push(k); }); });
    var filas = vistas.map(function (r) {
      var o = {};
      cols.forEach(function (c) { o[c] = c === "fecha" && r[c] ? new Date(r[c]) : r[c]; });
      return o;
    });
    var hoy = new Date().toISOString().slice(0, 10);
    if (!window.XLSX) { descargarCSV(cols, "encuesta-adep-" + hoy + ".csv"); return; }
    var libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(filas, { header: cols }), "Respuestas");
    XLSX.writeFile(libro, "encuesta-adep-" + hoy + ".xlsx");
  });

  // Respaldo si no carga la herramienta de Excel: CSV con punto y coma (como lo abre Excel en español).
  function descargarCSV(cols, nombre) {
    var celda = function (v) {
      var t = v == null ? "" : String(v);
      if (/^[=+\-@]/.test(t)) t = "'" + t;
      return /[";\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
    };
    var texto = [cols.map(celda).join(";")].concat(vistas.map(function (r) {
      return cols.map(function (c) { return celda(c === "fecha" && r[c] ? new Date(r[c]).toLocaleString("es-CR") : r[c]); }).join(";");
    })).join("\r\n");
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + texto], { type: "text/csv;charset=utf-8" }));
    a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  /* ---------- Inicio ---------- */
  $("#year").textContent = new Date().getFullYear();
  if (demo) {
    $("#aviso-demo").hidden = false;
    $("#clave").hidden = true;
  }
  var guardada = null;
  try { guardada = sessionStorage.getItem(CLAVE_SESION); } catch (e) { /* nada */ }
  if (guardada !== null && (guardada || demo)) entrar(guardada);
})();
