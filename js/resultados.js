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
  // Preguntas tal como aparecen en la encuesta, para armar el PDF de cada respuesta.
  var SECCIONES = [
    { titulo: "Sobre usted", color: "#008744", preguntas: [
      ["1", "Filial o Núcleo al que pertenece", "filial"],
      ["2", "Edad", "edad"],
      ["3", "Años de pertenecer a la ADEP", "antiguedad"]] },
    { titulo: "Servicios", color: "#0d8a7a", preguntas: [
      ["4", "¿Cuáles de los siguientes servicios ha utilizado?", "servicios_utilizados"],
      ["5", "Nivel de satisfacción de los servicios de ADEP", "Satisfacción - "],
      ["6", "¿Qué otros temas le gustaría encontrar como parte del contenido de la Revista ECOS de ADEP?", "temas_revista_ecos"]] },
    { titulo: "Su experiencia", color: "#b8860b", preguntas: [
      ["7", "¿Cómo califica los siguientes aspectos de ADEP?", "Aspecto - "],
      ["8", "¿Considera que ADEP mejora su bienestar y calidad de vida?", "mejora_bienestar"],
      ["9", "¿Recomendaría usted a la ADEP a otras personas trabajadoras de la Educación?", "recomendaria_adep"]] },
    { titulo: "Comunicación", color: "#c8322e", preguntas: [
      ["10", "¿Cuáles de los siguientes canales de comunicación de la ADEP utiliza usted con mayor frecuencia?", "canales_comunicacion"],
      ["11", "¿Cuáles de las siguientes redes sociales utiliza usted con mayor frecuencia?", "redes_sociales"]] },
    { titulo: "Sus ideas", color: "#04492a", preguntas: [
      ["12", "¿Qué servicios considera que debieran fortalecerse en ADEP?", "servicios_a_fortalecer"],
      ["13", "¿Qué nuevos beneficios le gustaría que ADEP ofreciera para atender sus necesidades?", "nuevos_beneficios"],
      ["14", "¿Qué recomendación nos brindaría para mejorar nuestros servicios?", "recomendaciones"]] },
  ];
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
  function fechaLarga(v) {
    var d = new Date(v);
    return isNaN(d) ? "" : d.toLocaleString("es-CR", { dateStyle: "long", timeStyle: "short" });
  }
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

    if (!N) { $("#graficos").innerHTML = ""; dibujarComentarios(); dibujarIndividuales(); return; }

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
    dibujarIndividuales();
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

  /* ---------- Respuestas individuales (PDF) ---------- */
  // Las más recientes primero; el número es el orden de llegada.
  function dibujarIndividuales() {
    var q = $("#buscar-ind").value.trim().toLowerCase();
    var items = vistas.map(function (r) { return { r: r, n: todas.indexOf(r) + 1 }; })
      .filter(function (x) { return !q || nombreFilial(x.r.filial).toLowerCase().indexOf(q) !== -1; })
      .reverse();
    $("#lista-ind").innerHTML = items.length ? items.map(function (x) {
      var r = x.r;
      return '<li><span class="i-n">#' + x.n + '</span><div class="i-datos"><strong>' + escapar(nombreFilial(r.filial)) + "</strong>" +
        "<span>" + escapar([fechaLarga(r.fecha), r.edad].filter(Boolean).join(" · ")) + "</span></div>" +
        '<button type="button" class="btn btn-sec" data-n="' + x.n + '"><i class="fa-solid fa-download"></i> Descargar PDF</button></li>';
    }).join("") : '<li><p class="g-nada">No hay respuestas' + (q ? " con esa búsqueda" : "") + ".</p></li>";
  }
  $("#buscar-ind").addEventListener("input", dibujarIndividuales);

  function infoPDF(r) {
    return {
      fecha: fechaLarga(r.fecha),
      filial: String(r.filial || "").replace(/\s*\(([^)]+)\)$/, " · $1"),
      edad: r.edad,
      antiguedad: r.antiguedad,
      secciones: SECCIONES.map(function (s) {
        return {
          titulo: s.titulo,
          color: s.color,
          preguntas: s.preguntas.map(function (p) {
            var o = { num: p[0], texto: p[1] };
            if (/ - $/.test(p[2])) {
              var items = p[2] === "Satisfacción - " ? cfg.servicios : cfg.aspectos;
              o.filas = items.filter(function (it) { return Number(r[p[2] + it]) >= 1; })
                .map(function (it) { return { et: it, v: Number(r[p[2] + it]) }; });
            } else {
              o.respuesta = String(r[p[2]] == null ? "" : r[p[2]]).trim();
            }
            return o;
          }),
        };
      }),
    };
  }
  function nombreArchivo(base, extra) {
    return base + (extra ? "-" + String(extra).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, "-") : "") +
      "-" + new Date().toISOString().slice(0, 10) + ".pdf";
  }
  function descargar(blob, nombre) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }
  // Mientras se arma el PDF, el botón muestra que está trabajando.
  function conEspera(btn, crear) {
    var antes = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Preparando…';
    return crear().catch(function (err) {
      console.error(err);
      alert("No se pudo crear el PDF. Revise su conexión e intente de nuevo.");
    }).finally(function () { btn.disabled = false; btn.innerHTML = antes; });
  }

  $("#lista-ind").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-n]");
    if (!b || !window.ADEP_PDF) return;
    var r = todas[+b.dataset.n - 1];
    conEspera(b, function () {
      return window.ADEP_PDF.crear(infoPDF(r)).then(function (blob) {
        descargar(blob, nombreArchivo("Respuesta-" + b.dataset.n, nombreFilial(r.filial)));
      });
    });
  });

  // Informe general con gráficos (el mismo que llega por correo), con los filtros aplicados.
  $("#informe").addEventListener("click", function () {
    var b = $("#informe");
    if (!window.ADEP_INFORME) return;
    if (!vistas.length) { alert("No hay respuestas con estos filtros."); return; }
    var filtro = [$("#f-provincia").value, $("#f-filial").value, $("#f-edad").value].filter(Boolean).join(" ");
    conEspera(b, function () {
      return window.ADEP_INFORME.crear(vistas).then(function (blob) {
        descargar(blob, nombreArchivo("Informe-general-Encuesta-ADEP", filtro));
      });
    });
  });

  /* ---------- Buscar por cédula ---------- */
  // La cédula se cifra igual que en la encuesta (sal + "|" + cédula, SHA-256) y solo se envía cifrada.
  function cifrar(cedula) {
    var bytes = new TextEncoder().encode((cfg.sal || "") + "|" + cedula);
    return crypto.subtle.digest("SHA-256", bytes).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (x) { return ("0" + x.toString(16)).slice(-2); }).join("");
    });
  }
  function claveSesion() {
    try { return sessionStorage.getItem(CLAVE_SESION) || ""; } catch (e) { return ""; }
  }
  function pedir(accion, id) {
    return fetch(cfg.endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ accion: accion, clave: claveSesion(), id: id }),
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j.ok) throw new Error(j.error || "No se pudo completar.");
      return j;
    });
  }
  var encontrada = null; // { id, n, fila }
  function mostrarCedula(html) { $("#resultado-cedula").innerHTML = html; }

  $("#form-buscar").addEventListener("submit", function (e) {
    e.preventDefault();
    var ced = String($("#buscar-cedula").value || "").replace(/\D/g, "");
    encontrada = null;
    if (ced.length < 9 || ced.length > 12) { mostrarCedula('<div class="rc no"><p>Escriba la cédula completa: 9 números (o de 10 a 12 si es DIMEX), sin guiones.</p></div>'); return; }
    if (demo) { mostrarCedula('<div class="rc no"><p>La búsqueda funciona cuando la encuesta está conectada a la hoja de Google.</p></div>'); return; }
    var btn = $("#btn-buscar");
    btn.disabled = true;
    mostrarCedula('<div class="rc no"><p>Buscando…</p></div>');
    cifrar(ced).then(function (id) {
      return pedir("buscar", id).then(function (j) {
        if (!j.encontrada) { mostrarCedula('<div class="rc no"><p class="rc-tit">No hay ninguna respuesta con esa cédula.</p></div>'); return; }
        encontrada = { id: id, n: j.n, fila: j.fila };
        var r = j.fila;
        mostrarCedula('<div class="rc"><p class="rc-tit">Respuesta #' + j.n + " · " + escapar(nombreFilial(r.filial)) + "</p>" +
          '<p class="rc-meta">' + escapar([fechaLarga(r.fecha), r.edad, r.antiguedad].filter(Boolean).join(" · ")) + "</p>" +
          '<div class="rc-acciones"><button type="button" class="btn btn-sec" id="rc-pdf"><i class="fa-solid fa-download"></i> Descargar PDF</button>' +
          '<button type="button" class="btn btn-sec btn-borrar" id="rc-borrar"><i class="fa-solid fa-trash"></i> Borrar esta respuesta</button></div>' +
          '<div id="rc-confirmar"></div></div>');
      });
    }).catch(function (err) {
      mostrarCedula('<div class="rc no"><p>' + escapar(err.message === "Failed to fetch" ? "No hay conexión con la hoja de Google. Intente de nuevo." : err.message) + "</p></div>");
    }).finally(function () { btn.disabled = false; });
  });

  $("#resultado-cedula").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b || !encontrada) return;
    if (b.id === "rc-pdf" && window.ADEP_PDF) {
      conEspera(b, function () {
        return window.ADEP_PDF.crear(infoPDF(encontrada.fila)).then(function (blob) {
          descargar(blob, nombreArchivo("Respuesta-" + encontrada.n, nombreFilial(encontrada.fila.filial)));
        });
      });
    } else if (b.id === "rc-borrar") {
      $("#rc-confirmar").innerHTML = '<div class="confirmar"><p>¿Seguro que quiere borrar esta respuesta? No se puede deshacer. ' +
        "Descargue antes el PDF si necesita una copia.</p><div class=\"rc-acciones\">" +
        '<button type="button" class="btn btn-sec btn-borrar" id="rc-si">Sí, borrar</button>' +
        '<button type="button" class="btn btn-sec" id="rc-no">Cancelar</button></div></div>';
    } else if (b.id === "rc-no") {
      $("#rc-confirmar").innerHTML = "";
    } else if (b.id === "rc-si") {
      conEspera(b, function () {
        return pedir("borrar", encontrada.id).then(function (j) {
          encontrada = null;
          $("#buscar-cedula").value = "";
          mostrarCedula(j.borrada
            ? '<div class="rc ok-borrada"><p class="rc-tit">Respuesta borrada.</p><p class="rc-meta">Ya no aparece en la hoja ni en los resultados. El informe del correo diario se actualiza con la próxima respuesta.</p></div>'
            : '<div class="rc no"><p>Esa respuesta ya no estaba en la hoja.</p></div>');
          $("#actualizar").click();
        });
      });
    }
  });

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
