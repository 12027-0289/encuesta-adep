(function () {
  "use strict";

  var cfg = window.ADEP_CONFIG || { endpoint: "", servicios: [], aspectos: [] };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var form = $("#form");
  var steps = $$(".step", form);
  var current = 0;

  /* ---------- Construir opciones dinámicas ---------- */
  function slug(text) {
    return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  }

  var OTRA = "Otra (no aparece en la lista)";
  var filialSel = $("#filial");
  var filialOtra = $("#filial_otra");
  Object.keys(cfg.filiales || {}).forEach(function (prov) {
    var group = document.createElement("optgroup");
    group.label = prov;
    cfg.filiales[prov].forEach(function (f) {
      var o = document.createElement("option");
      o.value = f + " (" + prov + ")";
      o.textContent = f;
      group.appendChild(o);
    });
    filialSel.appendChild(group);
  });
  var otraOpt = document.createElement("option");
  otraOpt.value = OTRA;
  otraOpt.textContent = OTRA;
  filialSel.appendChild(otraOpt);
  function syncFilial() {
    var otra = filialSel.value === OTRA;
    filialOtra.hidden = !otra;
    if (!otra) filialOtra.value = "";
  }
  filialSel.addEventListener("change", function () {
    syncFilial();
    if (!filialOtra.hidden) filialOtra.focus();
  });

  var servWrap = $("#servicios-options");
  var NINGUNO = cfg.ninguno || "";
  cfg.servicios.concat(NINGUNO ? [NINGUNO] : []).forEach(function (s) {
    var label = document.createElement("label");
    label.className = "opt";
    label.innerHTML = '<input type="checkbox" name="servicios"><span></span>';
    label.querySelector("input").value = s;
    label.querySelector("span").textContent = s;
    servWrap.appendChild(label);
  });

  function buildMatrix(container, prefix, items) {
    var legend = document.createElement("div");
    legend.className = "scale-legend";
    legend.innerHTML = "<span>1 = Muy bajo</span><span>5 = Excelente</span>";
    container.appendChild(legend);
    items.forEach(function (item) {
      var name = prefix + "_" + slug(item);
      var row = document.createElement("div");
      row.className = "m-row";
      row.dataset.name = name;
      row.dataset.label = item;
      var lab = document.createElement("span");
      lab.className = "m-label";
      lab.id = name + "_lbl";
      lab.textContent = item;
      var scale = document.createElement("div");
      scale.className = "scale";
      scale.setAttribute("role", "radiogroup");
      scale.setAttribute("aria-labelledby", lab.id);
      for (var v = 1; v <= 5; v++) {
        var l = document.createElement("label");
        l.dataset.v = v;
        l.innerHTML = '<input type="radio" name="' + name + '" value="' + v + '" aria-label="' + v + '"><span>' + v + "</span>";
        scale.appendChild(l);
      }
      var val = document.createElement("span");
      val.className = "m-val";
      val.setAttribute("aria-live", "polite");
      lab.appendChild(val);
      row.appendChild(lab);
      row.appendChild(scale);
      container.appendChild(row);
    });
  }
  var satMatrix = $("#satisfaccion-matrix");
  var aspMatrix = $("#aspectos-matrix");
  buildMatrix(satMatrix, "sat", cfg.servicios);
  buildMatrix(aspMatrix, "asp", cfg.aspectos);

  // Como en el formulario original, la pregunta 5 pide calificar siempre todos los servicios.
  // "Ninguno" no se puede marcar junto con otros servicios.
  servWrap.addEventListener("change", function (e) {
    if (NINGUNO && e.target.name === "servicios" && e.target.checked) {
      $$('input[name="servicios"]', servWrap).forEach(function (i) {
        if (i !== e.target && (e.target.value === NINGUNO || i.value === NINGUNO)) i.checked = false;
      });
    }
  });

  /* ---------- Progreso ---------- */
  var dots = $("#steps-dots");
  steps.forEach(function (st, i) {
    var li = document.createElement("li");
    li.dataset.n = i + 1;
    li.textContent = st.dataset.title;
    dots.appendChild(li);
  });

  function updateProgress() {
    var pct = Math.round((current / steps.length) * 100);
    $("#progress-bar").style.width = pct + "%";
    $(".barra").setAttribute("aria-valuenow", pct);
    $("#step-percent").textContent = pct + "%";
    $("#step-label").textContent = "Sección " + (current + 1) + " de " + steps.length + " · " + steps[current].dataset.title;
    $$("li", dots).forEach(function (li, i) {
      li.classList.toggle("done", i < current);
      li.classList.toggle("active", i === current);
    });
  }

  function showStep(i, back) {
    steps.forEach(function (s) { s.classList.remove("active", "back"); });
    current = i;
    steps[i].classList.add("active");
    if (back) steps[i].classList.add("back");
    $$(".q", steps[i]).forEach(function (q, k) { q.style.setProperty("--i", k); });
    $("#prev").style.visibility = i === 0 ? "hidden" : "visible";
    $("#next").hidden = i === steps.length - 1;
    $("#submit").hidden = i !== steps.length - 1;
    $("#form-status").textContent = "";
    updateProgress();
    refreshStepReady();
    saveDraft();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------- Validación ---------- */
  function isAnswered(q, marcar) {
    var ok = true;
    var matrix = $(".matrix", q);
    if (matrix) {
      $$(".m-row", matrix).forEach(function (row) {
        if (row.hidden) return;
        var rated = !!$("input:checked", row);
        if (marcar) row.classList.toggle("missing", !rated);
        if (!rated) ok = false;
      });
    } else if ($("select", q)) {
      var sel = $("select", q);
      ok = sel.value !== "" && (sel.value !== OTRA || filialOtra.value.trim() !== "");
    } else if ($(".text", q)) {
      ok = $(".text", q).value.trim() !== "";
    } else {
      ok = !!$("input:checked", q);
    }
    return ok;
  }

  function validateQuestion(q) {
    var ok = isAnswered(q, true);
    q.classList.toggle("invalid", !ok);
    return ok;
  }

  /* ---------- Estado visual: respondida, calificación y sección lista ---------- */
  var NIVELES = ["", "Muy malo", "Malo", "Regular", "Bueno", "Excelente"];
  function refreshQuestion(q) {
    q.classList.toggle("answered", isAnswered(q, false));
  }
  function refreshRow(row) {
    var c = $("input:checked", row);
    row.classList.toggle("rated", !!c);
    row.dataset.v = c ? c.value : "";
    $(".m-val", row).textContent = c ? NIVELES[c.value] : "";
  }
  function refreshStepReady() {
    var listo = $$(".q[data-required]", steps[current]).every(function (q) { return isAnswered(q, false); });
    $("#next").classList.toggle("listo", listo);
    $("#submit").classList.toggle("listo", listo);
  }
  function refreshAll() {
    $$(".m-row", form).forEach(refreshRow);
    $$(".q", form).forEach(refreshQuestion);
    refreshStepReady();
  }

  function validateStep(i) {
    var invalid = $$(".q[data-required]", steps[i]).filter(function (q) { return !validateQuestion(q); });
    if (invalid.length) {
      invalid[0].scrollIntoView({ behavior: "smooth", block: "center" });
      var focusable = $("select, input, textarea", invalid[0]);
      if (focusable) setTimeout(function () { focusable.focus({ preventScroll: true }); }, 400);
      $("#form-status").textContent = "Por favor complete las preguntas marcadas con *.";
      return false;
    }
    return true;
  }

  form.addEventListener("change", function (e) {
    var q = e.target.closest(".q");
    if (e.target.closest(".m-row")) {
      var row = e.target.closest(".m-row");
      row.classList.remove("missing");
      refreshRow(row);
    }
    if (q && q.classList.contains("invalid")) validateQuestion(q);
    $$(".q", steps[current]).forEach(refreshQuestion);
    refreshStepReady();
    saveDraft();
  });
  form.addEventListener("input", function (e) {
    var q = e.target.closest(".q");
    if (q && q.classList.contains("invalid")) validateQuestion(q);
    if (q) refreshQuestion(q);
    refreshStepReady();
    saveDraft();
  });

  var ANIMO = [
    "¡Muy bien! Sigamos con los servicios 💚",
    "¡Excelente! Ya va casi por la mitad",
    "¡Qué bien! Ya pasó la mitad de la encuesta",
    "¡Solo falta una sección! Ya casi termina",
  ];
  $("#next").addEventListener("click", function () {
    if (validateStep(current)) {
      showStep(current + 1);
      aviso(ANIMO[current - 1]);
    }
  });
  $("#prev").addEventListener("click", function () {
    if (current > 0) showStep(current - 1, true);
  });

  /* ---------- Recolección de datos ---------- */
  function collect() {
    var fd = new FormData(form);
    var multi = function (n) { return fd.getAll(n).join(", "); };
    var data = {
      fecha: new Date().toISOString(),
      filial: fd.get("filial") === OTRA ? "Otra: " + (fd.get("filial_otra") || "").trim() : (fd.get("filial") || ""),
      edad: fd.get("edad") || "",
      antiguedad: fd.get("antiguedad") || "",
      servicios_utilizados: multi("servicios"),
    };
    $$(".m-row", satMatrix).forEach(function (row) {
      data["Satisfacción - " + row.dataset.label] = fd.get(row.dataset.name) || "";
    });
    data.temas_revista_ecos = (fd.get("temas_ecos") || "").trim();
    $$(".m-row", aspMatrix).forEach(function (row) {
      data["Aspecto - " + row.dataset.label] = fd.get(row.dataset.name) || "";
    });
    data.mejora_bienestar = fd.get("bienestar") || "";
    data.recomendaria_adep = fd.get("recomendaria") || "";
    data.canales_comunicacion = multi("canales");
    data.redes_sociales = multi("redes");
    data.servicios_a_fortalecer = (fd.get("fortalecer") || "").trim();
    data.nuevos_beneficios = (fd.get("nuevos_beneficios") || "").trim();
    data.recomendaciones = (fd.get("recomendacion") || "").trim();
    return data;
  }

  /* ---------- Borrador local ---------- */
  var DRAFT_KEY = "adep-encuesta-borrador";  // se vuelve única por cédula al comenzar
  function saveDraft() {
    try {
      var state = { step: current, values: {} };
      $$("select, input, textarea", form).forEach(function (el) {
        if (el.type === "radio" || el.type === "checkbox") {
          if (el.checked) (state.values[el.name] = state.values[el.name] || []).push(el.value);
        } else if (el.value) {
          state.values[el.name] = el.value;
        }
      });
      localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
    } catch (e) { /* almacenamiento no disponible */ }
  }
  function loadDraft() {
    try {
      var state = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
      if (!state) return 0;
      $$("select, input, textarea", form).forEach(function (el) {
        var v = state.values[el.name];
        if (v === undefined) return;
        if (el.type === "radio" || el.type === "checkbox") {
          el.checked = v.indexOf(el.value) !== -1;
        } else {
          el.value = v;
        }
      });
      syncFilial();
      return Math.min(state.step || 0, steps.length - 1);
    } catch (e) { return 0; }
  }
  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* nada */ }
  }

  /* ---------- Una respuesta por persona (cédula cifrada) ---------- */
  var idPersona = "";
  var LOCAL_IDS = "adep-cedulas-respondidas";

  function limpiarCedula(v) { return String(v || "").replace(/\D/g, ""); }

  function cifrar(cedula) {
    var bytes = new TextEncoder().encode((cfg.sal || "") + "|" + cedula);
    return crypto.subtle.digest("SHA-256", bytes).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (x) {
        return ("0" + x.toString(16)).slice(-2);
      }).join("");
    });
  }

  function idsLocales() {
    try { return JSON.parse(localStorage.getItem(LOCAL_IDS) || "[]"); } catch (e) { return []; }
  }
  function guardarIdLocal(id) {
    try {
      var ids = idsLocales();
      if (ids.indexOf(id) === -1) ids.push(id);
      localStorage.setItem(LOCAL_IDS, JSON.stringify(ids));
    } catch (e) { /* nada */ }
  }

  // Pregunta al servidor (Google Apps Script) si esa cédula ya respondió.
  function yaRespondio(id) {
    if (idsLocales().indexOf(id) !== -1) return Promise.resolve(true);
    if (!cfg.endpoint) return Promise.resolve(false);
    return fetch(cfg.endpoint + "?verificar=" + encodeURIComponent(id))
      .then(function (r) { return r.json(); })
      .then(function (j) { return !!j.existe; });
  }

  /* ---------- Repaso antes de enviar ---------- */
  function textoDe(q) {
    var t = $(".q-title", q).cloneNode(true);
    $$(".num, .req", t).forEach(function (x) { x.remove(); });
    return t.textContent.trim();
  }
  function respuestaDe(q) {
    var matrix = $(".matrix", q);
    if (matrix) {
      var filas = $$(".m-row", matrix).filter(function (r) { return !r.hidden && $("input:checked", r); });
      if (!filas.length) return "";
      return filas.map(function (r) {
        var v = +$("input:checked", r).value;
        return '<span class="rp-fila">' + escapar(r.dataset.label) + ' <span class="rp-nota" data-v="' + v + '">' + v + " · " + NIVELES[v] + "</span></span>";
      }).join("");
    }
    var sel = $("select", q);
    if (sel) return sel.value === OTRA ? escapar("Otra: " + filialOtra.value.trim()) : escapar(sel.value);
    var txt = $("textarea", q);
    if (txt) return escapar(txt.value.trim());
    return $$("input:checked", q).map(function (i) { return escapar(i.value); }).join(", ");
  }
  function escapar(t) {
    var d = document.createElement("div");
    d.textContent = t;
    return d.innerHTML;
  }

  function mostrarRepaso() {
    var html = steps.map(function (st, i) {
      var preguntas = $$(".q", st).map(function (q) {
        var r = respuestaDe(q);
        return '<div class="rp-q"><p class="rp-preg">' + escapar(textoDe(q)) + "</p>" +
          '<p class="rp-resp' + (r ? "" : " vacia") + '">' + (r || "Sin respuesta") + "</p></div>";
      }).join("");
      return '<article class="rp-sec ' + st.className.replace("step", "").replace("active", "").replace("back", "").trim() + '" style="--i:' + i + '">' +
        '<header><h3><span>' + (i + 1) + "</span> " + escapar(st.dataset.title) + "</h3>" +
        '<button type="button" class="btn btn-sec rp-cambiar" data-paso="' + i + '"><i class="fa-solid fa-pen"></i> Cambiar</button></header>' +
        preguntas + "</article>";
    }).join("");
    $("#review-list").innerHTML = html;
    $("#aviso").classList.remove("ver");
    $("#survey").hidden = true;
    $("#review").hidden = false;
    $("#review-status").textContent = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
    $("#review").focus({ preventScroll: true });
  }
  function volverAEncuesta(paso) {
    $("#review").hidden = true;
    $("#survey").hidden = false;
    showStep(paso, true);
  }
  $("#review-list").addEventListener("click", function (e) {
    var b = e.target.closest(".rp-cambiar");
    if (b) volverAEncuesta(+b.dataset.paso);
  });
  $("#review-back").addEventListener("click", function () { volverAEncuesta(steps.length - 1); });

  /* ---------- Destinos de las respuestas ---------- */
  // Google Sheets (si hay endpoint): guarda la fila y rechaza cédulas repetidas.
  function enviarHoja(data) {
    return fetch(cfg.endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(data),
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (j.duplicado) throw new Error("duplicado");
      if (!j.ok) throw new Error("error");
    });
  }

  // Etiquetas para el correo de respaldo (tabla).
  var ETIQUETAS = [
    ["filial", "1. Filial o núcleo"],
    ["edad", "2. Edad"],
    ["antiguedad", "3. Años en ADEP"],
    ["servicios_utilizados", "4. Servicios utilizados"],
    ["*Satisfacción - ", "5. Satisfacción"],
    ["temas_revista_ecos", "6. Temas para la Revista ECOS"],
    ["*Aspecto - ", "7. Calificación"],
    ["mejora_bienestar", "8. ¿ADEP mejora su bienestar?"],
    ["recomendaria_adep", "9. ¿Recomendaría la ADEP?"],
    ["canales_comunicacion", "10. Canales de comunicación"],
    ["redes_sociales", "11. Redes sociales"],
    ["servicios_a_fortalecer", "12. Servicios a fortalecer"],
    ["nuevos_beneficios", "13. Nuevos beneficios"],
    ["recomendaciones", "14. Recomendaciones"],
  ];
  // Nombre del PDF individual (correo de respaldo por FormSubmit).
  function nombrePDF(data) {
    var filial = String(data.filial || "").replace(/\s*\([^)]+\)$/, "");
    return "Encuesta-ADEP-" + filial.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]+/g, "-") +
      "-" + new Date().toISOString().slice(0, 10) + ".pdf";
  }
  // Informe general: Google entrega solo números de las respuestas anteriores (?resumen=1)
  // y aquí se suma la respuesta nueva. Si algo falla, Google arma un informe sencillo.
  function informeBase64(data) {
    if (!window.ADEP_INFORME) return Promise.resolve(null);
    return fetch(cfg.endpoint + "?resumen=1").then(function (r) { return r.json(); }).then(function (j) {
      var filas = (j && j.filas) || [];
      return window.ADEP_INFORME.crear(filas.concat([data]));
    }).then(blobABase64).catch(function () { return null; });
  }
  function blobABase64(blob) {
    return new Promise(function (ok) {
      var fr = new FileReader();
      fr.onload = function () { ok(String(fr.result).split(",")[1]); };
      fr.onerror = function () { ok(null); };
      fr.readAsDataURL(blob);
    });
  }

  // Datos para el PDF, tomados de las preguntas tal como se ven en pantalla.
  var COLORES_SECCION = ["#008744", "#0d8a7a", "#b8860b", "#c8322e", "#04492a"];
  function infoPDF(data) {
    return {
      fecha: new Date().toLocaleString("es-CR", { dateStyle: "long", timeStyle: "short" }),
      filial: String(data.filial || "").replace(/\s*\(([^)]+)\)$/, " · $1"),
      edad: data.edad,
      antiguedad: data.antiguedad,
      codigo: String(data.id_persona || "").slice(0, 12),
      secciones: steps.map(function (st, i) {
        return {
          titulo: st.dataset.title,
          color: COLORES_SECCION[i],
          preguntas: $$(".q", st).map(function (q) {
            var p = { num: $(".num", q).textContent.trim(), texto: textoDe(q) };
            var matrix = $(".matrix", q);
            if (matrix) {
              p.filas = $$(".m-row", matrix).filter(function (r) { return !r.hidden && $("input:checked", r); })
                .map(function (r) { return { et: r.dataset.label, v: +$("input:checked", r).value }; });
              return p;
            }
            var sel = $("select", q), txt = $("textarea", q);
            if (sel) p.respuesta = sel.value === OTRA ? "Otra: " + filialOtra.value.trim() : sel.value;
            else if (txt) p.respuesta = txt.value.trim();
            else p.respuesta = $$("input:checked", q).map(function (i) { return i.value; }).join(", ");
            return p;
          }),
        };
      }),
    };
  }

  // Correo (FormSubmit.co) con la respuesta completa en un PDF adjunto.
  function enviarCorreo(data, correos) {
    var crear = window.ADEP_PDF ? window.ADEP_PDF.crear(infoPDF(data)) : Promise.reject(new Error("sin PDF"));
    return crear.then(function (pdf) {
      var filial = String(data.filial || "").replace(/\s*\([^)]+\)$/, "");
      var campos = {
        _subject: "Encuesta ADEP · Nueva respuesta · " + filial,
        _template: "box",
        _captcha: "false",
        Mensaje: "Se recibió una nueva respuesta de la Encuesta de Servicio de ADEP (filial " + filial +
          "). La respuesta completa va en el PDF adjunto.",
      };
      if (correos.length > 1) campos._cc = correos.slice(1).join(",");
      var nombre = nombrePDF(data);
      var archivo = new File([pdf], nombre, { type: "application/pdf" });
      // FormSubmit solo acepta adjuntos en el envío de formulario clásico (no por AJAX).
      return enviarFormularioOculto("https://formsubmit.co/" + encodeURIComponent(correos[0]), campos, archivo);
    }, function (err) {
      // Si no se pudo crear el PDF, se envía la tabla para no perder la respuesta.
      console.warn("[ADEP] No se pudo crear el PDF; se envía como tabla.", err);
      return enviarTabla(data, correos);
    });
  }

  // Envía un formulario clásico (con archivo) dentro de un marco oculto, para no salir de la encuesta.
  // No se puede leer la respuesta de FormSubmit (es otro sitio); se da por enviado cuando el marco carga.
  function enviarFormularioOculto(url, campos, archivo) {
    return new Promise(function (resolve, reject) {
      var nombre = "envio-correo-" + Date.now();
      var marco = document.createElement("iframe");
      marco.name = nombre;
      marco.title = "Envío del correo";
      marco.hidden = true;
      document.body.appendChild(marco);

      var form = document.createElement("form");
      form.method = "POST";
      form.action = url;
      form.enctype = "multipart/form-data";
      form.target = nombre;
      form.hidden = true;
      Object.keys(campos).forEach(function (k) {
        var i = document.createElement("input");
        i.type = "hidden";
        i.name = k;
        i.value = campos[k];
        form.appendChild(i);
      });
      var adj = document.createElement("input");
      adj.type = "file";
      adj.name = "attachment";
      var dt = new DataTransfer();
      dt.items.add(archivo);
      adj.files = dt.files;
      form.appendChild(adj);
      document.body.appendChild(form);

      var terminado = false;
      function limpiar() { setTimeout(function () { marco.remove(); form.remove(); }, 3000); }
      var espera = setTimeout(function () {
        if (terminado) return;
        terminado = true;
        limpiar();
        reject(new Error("correo"));
      }, 45000);
      // El marco vacío puede disparar "load" al insertarse: se escucha después de esa vuelta.
      setTimeout(function () {
        marco.addEventListener("load", function () {
          if (terminado) return;
          terminado = true;
          clearTimeout(espera);
          limpiar();
          resolve();
        });
        form.submit();
      }, 0);
    });
  }

  // Respaldo: la respuesta como tabla en el cuerpo del correo.
  function enviarTabla(data, correos) {
    var cuerpo = {
      _subject: "Encuesta ADEP · Nueva respuesta · " + String(data.filial || "").replace(/\s*\([^)]+\)$/, ""),
      _template: "table",
      _captcha: "false",
    };
    if (correos.length > 1) cuerpo._cc = correos.slice(1).join(",");
    cuerpo["Fecha"] = new Date().toLocaleString("es-CR", { dateStyle: "long", timeStyle: "short" });
    ETIQUETAS.forEach(function (e) {
      if (e[0].charAt(0) === "*") {
        var prefijo = e[0].slice(1);
        Object.keys(data).forEach(function (k) {
          if (k.indexOf(prefijo) === 0 && data[k]) {
            cuerpo[e[1] + ": " + k.slice(prefijo.length)] = data[k] + " de 5 (" + NIVELES[data[k]] + ")";
          }
        });
      } else {
        cuerpo[e[1]] = data[e[0]] || "—";
      }
    });
    // Código corto de la persona (de la cédula cifrada): sirve para notar respuestas repetidas.
    cuerpo["Código de persona"] = String(data.id_persona || "").slice(0, 12);
    return fetch("https://formsubmit.co/ajax/" + encodeURIComponent(correos[0]), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(cuerpo),
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (String(j.success) !== "true") {
        console.warn("[ADEP] FormSubmit:", j.message);
        throw new Error("correo");
      }
    });
  }

  // Sin hoja de Google: copia en este navegador (sirve para la vista de demostración de resultados).
  function guardarLocal(data) {
    try {
      var all = JSON.parse(localStorage.getItem("adep-respuestas") || "[]");
      all.push(data);
      localStorage.setItem("adep-respuestas", JSON.stringify(all));
    } catch (err) { /* nada */ }
    return new Promise(function (resolve) { setTimeout(resolve, 300); });
  }

  /* ---------- Envío ---------- */
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    for (var i = 0; i < steps.length; i++) {
      if (!validateStep(i)) { if (i !== current) showStep(i, true); return; }
    }
    mostrarRepaso();
  });

  $("#review-send").addEventListener("click", function () {
    var btn = $("#review-send");
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando…';
    var data = collect();
    data.id_persona = idPersona;

    // Con la hoja de Google conectada, Google guarda la respuesta y el informe general (que envía una vez al día).
    // Sin ella, el correo sale por FormSubmit (solo con el PDF individual) y queda una copia local.
    var correos = (cfg.correos || []).filter(Boolean);
    var send;
    if (cfg.endpoint) {
      send = informeBase64(data).then(function (informe) {
        var envio = Object.assign({}, data);
        if (informe) envio.informe_base64 = informe;
        return enviarHoja(envio);
      });
    } else {
      send = (correos.length ? enviarCorreo(data, correos) : Promise.resolve())
        .then(function () { return guardarLocal(data); });
    }

    send.then(function () {
      guardarIdLocal(idPersona);
      clearDraft();
      $("#review").hidden = true;
      $("#thanks").hidden = false;
      $("#thanks").focus();
      window.scrollTo({ top: 0, behavior: "smooth" });
      prepararFinal();
      setTimeout(confeti, 250);
    }).catch(function (err) {
      $("#review-status").textContent = err && err.message === "duplicado"
        ? "Esta cédula ya respondió la encuesta. Solo se permite una respuesta por persona."
        : "No se pudo enviar. Revise su conexión e intente de nuevo.";
    }).finally(function () {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Confirmar y enviar';
    });
  });

  /* ---------- Portada / reinicio ---------- */
  var cedulaInput = $("#cedula");
  var cedulaError = $("#cedula-error");
  cedulaInput.addEventListener("input", function () {
    var limpio = limpiarCedula(cedulaInput.value);
    if (limpio !== cedulaInput.value) cedulaInput.value = limpio;
    cedulaError.textContent = "";
    cedulaInput.classList.remove("mal");
  });
  cedulaInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") $("#start").click();
  });

  function errorCedula(msg) {
    cedulaError.textContent = msg;
    cedulaInput.classList.add("mal");
    cedulaInput.focus();
  }

  $("#start").addEventListener("click", function () {
    var ced = limpiarCedula(cedulaInput.value);
    if (ced.length < 9 || ced.length > 12) {
      errorCedula("Escriba su cédula completa: 9 números (o de 10 a 12 si es DIMEX), sin guiones.");
      return;
    }
    if (!window.crypto || !crypto.subtle) {
      errorCedula("Abra la encuesta desde su dirección segura (https) para poder continuar.");
      return;
    }
    var btn = $("#start");
    btn.disabled = true;
    cifrar(ced).then(function (id) {
      idPersona = id;
      return yaRespondio(id);
    }).then(function (respondio) {
      if (respondio) {
        errorCedula("Esta cédula ya respondió la encuesta. ¡Gracias por su participación!");
        return;
      }
      DRAFT_KEY = "adep-encuesta-borrador-" + idPersona.slice(0, 16);
      $("#intro").hidden = true;
      $("#survey").hidden = false;
      var paso = loadDraft();
      refreshAll();
      showStep(paso);
    }).catch(function () {
      errorCedula("No se pudo verificar la cédula. Revise su conexión e intente de nuevo.");
    }).finally(function () {
      btn.disabled = false;
    });
  });
  $("#again").addEventListener("click", function () {
    form.reset();
    syncFilial();
    $$(".m-row").forEach(function (r) { r.classList.remove("missing"); r.hidden = false; });
    $$(".q").forEach(function (q) { q.classList.remove("invalid"); });
    refreshAll();
    idPersona = "";
    cedulaInput.value = "";
    $("#thanks").hidden = true;
    $("#review").hidden = true;
    $("#intro").hidden = false;
    window.scrollTo({ top: 0 });
  });

  /* ---------- Dictado por voz en las respuestas abiertas ---------- */
  var Reconocimiento = window.SpeechRecognition || window.webkitSpeechRecognition;
  var dictando = null;

  // El navegador siempre pide permiso para el micrófono (ninguna página puede activarlo sola).
  // Antes de que aparezca esa pregunta, la encuesta explica con letra grande qué tocar,
  // y si el micrófono quedó bloqueado, explica cómo volver a permitirlo.
  var permisoMic = "desconocido"; // "granted" | "denied" | "prompt" | "desconocido"
  var micExplicado = false;
  if (Reconocimiento && navigator.permissions && navigator.permissions.query) {
    navigator.permissions.query({ name: "microphone" }).then(function (s) {
      permisoMic = s.state;
      s.onchange = function () { permisoMic = s.state; };
    }).catch(function () { /* el navegador no lo informa */ });
  }

  function tipoEquipo() {
    var ua = navigator.userAgent || "";
    if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "iphone";
    if (/Android/.test(ua)) return "android";
    return "compu";
  }

  var ayudaMic = $("#ayuda-mic");
  var alContinuarMic = null, focoAntesMic = null;
  function mostrarAyudaMic(tipo, continuar) {
    var equipo = tipoEquipo();
    var pasos;
    if (tipo === "pedir") {
      $("#am-titulo").textContent = "Para dictar, su equipo le pedirá permiso";
      $("#am-texto").innerHTML =
        "<p>Al continuar, aparecerá un mensaje preguntando si permite usar el micrófono. Toque <b>«Permitir»</b>.</p>" +
        '<div class="am-ejemplo" aria-hidden="true"><p><i class="fa-solid fa-microphone"></i> adep-encuesta.web.app quiere usar su micrófono</p>' +
        '<div class="am-op"><span>Bloquear</span><span class="am-permitir">Permitir</span></div></div>' +
        "<p>Solo se usa para escribir lo que usted diga. No se graba su voz.</p>";
      $("#am-si").innerHTML = '<i class="fa-solid fa-microphone"></i> Continuar';
    } else {
      if (equipo === "iphone") {
        pasos = ["Toque el ícono <b>aA</b> (o el de los tres puntos) junto a la dirección de la página, arriba o abajo de la pantalla.",
          "Toque <b>«Configuración del sitio web»</b>.", "En <b>«Micrófono»</b>, elija <b>«Permitir»</b>.",
          "Vuelva a tocar <b>«Dictar con mi voz»</b>."];
      } else if (equipo === "android") {
        pasos = ["Toque el ícono a la <b>izquierda de la dirección</b> de la página (un candado o unas rayitas), arriba de la pantalla.",
          "Toque <b>«Permisos»</b> o <b>«Configuración del sitio»</b>.", "Toque <b>«Micrófono»</b> y elija <b>«Permitir»</b>.",
          "Vuelva a tocar <b>«Dictar con mi voz»</b>."];
      } else {
        pasos = ["Haga clic en el ícono a la <b>izquierda de la dirección</b> de la página (un candado o unas rayitas).",
          "Busque <b>«Micrófono»</b> y elija <b>«Permitir»</b>.", "Si se lo pide, vuelva a cargar la página.",
          "Vuelva a tocar <b>«Dictar con mi voz»</b>."];
      }
      $("#am-titulo").textContent = "El micrófono está bloqueado";
      $("#am-texto").innerHTML = "<p>Para dictar, hay que permitir el micrófono. Siga estos pasos:</p><ol>" +
        pasos.map(function (p) { return "<li>" + p + "</li>"; }).join("") + "</ol>" +
        "<p>Si no puede, no se preocupe: escriba su respuesta o pida ayuda a alguien de confianza. Estas preguntas no son obligatorias.</p>";
      $("#am-si").textContent = "Entendido";
    }
    alContinuarMic = continuar || null;
    focoAntesMic = document.activeElement;
    $("#aviso").classList.remove("ver");
    ayudaMic.hidden = false;
    ayudaMic.scrollTop = 0;
    $("#am-si").focus({ preventScroll: true });
  }
  function cerrarAyudaMic(seguir) {
    ayudaMic.hidden = true;
    var fn = alContinuarMic;
    alContinuarMic = null;
    if (seguir && fn) fn();
    else if (focoAntesMic && focoAntesMic.focus) focoAntesMic.focus();
  }
  if (ayudaMic) {
    $("#am-si").addEventListener("click", function () { cerrarAyudaMic(true); });
    $("#am-no").addEventListener("click", function () { cerrarAyudaMic(false); });
    ayudaMic.addEventListener("keydown", function (e) { if (e.key === "Escape") cerrarAyudaMic(false); });
    ayudaMic.addEventListener("click", function (e) { if (e.target === ayudaMic) cerrarAyudaMic(false); });
  }

  function agregarMicrofono(campo) {
    var boton = document.createElement("button");
    boton.type = "button";
    boton.className = "mic";
    boton.setAttribute("aria-label", "Dictar la respuesta con la voz");
    boton.innerHTML = '<i class="fa-solid fa-microphone"></i><span>Dictar con mi voz</span>';
    campo.insertAdjacentElement("afterend", boton);

    boton.addEventListener("click", function () {
      if (dictando && dictando.campo === campo) { dictando.rec.stop(); return; }
      if (permisoMic === "denied") { mostrarAyudaMic("bloqueado"); return; }
      if (permisoMic !== "granted" && !micExplicado) {
        micExplicado = true;
        mostrarAyudaMic("pedir", empezar);
        return;
      }
      empezar();
    });

    function empezar() {
      if (dictando) dictando.rec.stop();

      var rec = new Reconocimiento();
      rec.lang = "es-CR";
      rec.continuous = true;
      rec.interimResults = true;
      var base = campo.value.trim();
      var final = "";

      rec.onresult = function (ev) {
        var parcial = "";
        for (var k = ev.resultIndex; k < ev.results.length; k++) {
          var t = ev.results[k][0].transcript;
          if (ev.results[k].isFinal) final += t + " "; else parcial += t;
        }
        var dicho = (final + parcial).trim();
        if (dicho) dicho = dicho.charAt(0).toUpperCase() + dicho.slice(1);
        campo.value = (base ? base + " " : "") + dicho;
        campo.dispatchEvent(new Event("input", { bubbles: true }));
      };
      rec.onerror = function (ev) {
        if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
          permisoMic = "denied";
          mostrarAyudaMic("bloqueado");
        } else if (ev.error === "audio-capture") {
          aviso("No se encontró un micrófono en este equipo. Puede escribir su respuesta.");
        } else if (ev.error === "network") {
          aviso("El dictado necesita internet. Revise su conexión o escriba su respuesta.");
        }
      };
      rec.onend = function () {
        boton.classList.remove("grabando");
        boton.querySelector("span").textContent = "Dictar con mi voz";
        if (dictando && dictando.rec === rec) dictando = null;
      };

      dictando = { rec: rec, campo: campo };
      boton.classList.add("grabando");
      boton.querySelector("span").textContent = "Escuchando… toque para terminar";
      campo.focus();
      try { rec.start(); } catch (err) { rec.onend(); }
    }
  }

  if (Reconocimiento) {
    $$("textarea", form).forEach(agregarMicrofono);
  }

  /* ---------- Avisos breves ---------- */
  var avisoTimer;
  function aviso(msg) {
    if (!msg) return;
    var el = $("#aviso");
    el.textContent = msg;
    el.classList.remove("ver");
    void el.offsetWidth;
    el.classList.add("ver");
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(function () { el.classList.remove("ver"); }, 3200);
  }

  /* ---------- Lectura en voz alta de cada pregunta ---------- */
  var voz = window.speechSynthesis;
  var leyendo = null;
  function vozEspanol() {
    var voces = voz.getVoices();
    return voces.find(function (v) { return /^es[-_]CR/i.test(v.lang); }) ||
      voces.find(function (v) { return /^es[-_](419|MX|US|CO)/i.test(v.lang); }) ||
      voces.find(function (v) { return /^es/i.test(v.lang); });
  }
  function textoParaLeer(q) {
    var partes = [textoDe(q)];
    var hint = $(".hint", q);
    if (hint) partes.push(hint.textContent);
    var ops = $$(".opt > span", q).map(function (o) { return o.textContent.trim(); });
    if (ops.length) partes.push("Opciones: " + ops.join(". ") + ".");
    var filas = $$(".m-row", q).filter(function (r) { return !r.hidden; }).map(function (r) { return r.dataset.label; });
    if (filas.length) partes.push("Califique del 1 al 5: " + filas.join(". ") + ".");
    if ($("select", q)) partes.push("Elija su filial o núcleo de la lista.");
    return partes.join(" ");
  }
  function pararLectura() {
    if (voz) voz.cancel();
    if (leyendo) leyendo.classList.remove("hablando");
    leyendo = null;
  }
  if (voz && window.SpeechSynthesisUtterance) {
    $$(".q", form).forEach(function (q) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "leer";
      b.setAttribute("aria-label", "Escuchar la pregunta");
      b.innerHTML = '<i class="fa-solid fa-volume-high"></i><span>Escuchar</span>';
      q.insertBefore(b, q.firstChild);
      b.addEventListener("click", function () {
        var era = leyendo === b;
        pararLectura();
        if (era) return;
        var u = new SpeechSynthesisUtterance(textoParaLeer(q));
        var v = vozEspanol();
        if (v) u.voice = v;
        u.lang = v ? v.lang : "es-CR";
        u.rate = 0.9;
        u.onend = u.onerror = function () { if (leyendo === b) pararLectura(); };
        leyendo = b;
        b.classList.add("hablando");
        voz.speak(u);
      });
    });
    window.addEventListener("pagehide", pararLectura);
  }

  /* ---------- Final: invitación por WhatsApp ---------- */
  function prepararFinal() {
    var enlace = location.href.split("#")[0].split("?")[0];
    var msg = "¡Hola! 👋 Ya respondí la Encuesta de Servicio de la ADEP. Su opinión también es muy importante. " +
      "Puede responderla aquí: " + enlace + " 💚 Orgullosos de ser personas solidarias.";
    $("#invitar-wa").href = "https://wa.me/?text=" + encodeURIComponent(msg);
  }

  /* ---------- Confeti al terminar ---------- */
  function confeti() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var lienzo = $("#confeti");
    var ctx = lienzo.getContext("2d");
    var dpr = window.devicePixelRatio || 1;
    lienzo.width = innerWidth * dpr;
    lienzo.height = innerHeight * dpr;
    ctx.scale(dpr, dpr);
    var colores = ["#008744", "#2bb673", "#e52521", "#d4af37", "#8ff0bd", "#ffffff"];
    var piezas = [];
    for (var n = 0; n < 180; n++) {
      var desdeIzq = n % 2 === 0;
      piezas.push({
        x: desdeIzq ? -10 : innerWidth + 10,
        y: innerHeight * (0.55 + Math.random() * 0.3),
        vx: (desdeIzq ? 1 : -1) * (4 + Math.random() * 7),
        vy: -(9 + Math.random() * 9),
        w: 6 + Math.random() * 7,
        h: 9 + Math.random() * 9,
        r: Math.random() * Math.PI,
        vr: -0.25 + Math.random() * 0.5,
        c: colores[n % colores.length],
        circulo: Math.random() < 0.3,
      });
    }
    var inicio = performance.now();
    (function cuadro(t) {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      piezas.forEach(function (p) {
        p.vy += 0.28;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.strokeStyle = "rgba(4, 73, 42, .15)";
        if (p.circulo) {
          ctx.beginPath(); ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.strokeRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
        ctx.restore();
      });
      if (t - inicio < 5000) requestAnimationFrame(cuadro);
      else ctx.clearRect(0, 0, innerWidth, innerHeight);
    })(inicio);
  }

  /* ---------- Accesibilidad: tamaño de letra y contraste ---------- */
  var root = document.documentElement;
  var nivel = 0;
  try {
    nivel = parseInt(localStorage.getItem("adep-fs"), 10) || 0;
    if (localStorage.getItem("adep-hc") === "1") root.classList.add("hc");
  } catch (e) { /* nada */ }
  function aplicarLetra() {
    root.classList.remove("fs-1", "fs-2");
    if (nivel > 0) root.classList.add("fs-" + nivel);
    try { localStorage.setItem("adep-fs", nivel); } catch (e) { /* nada */ }
  }
  aplicarLetra();
  $("#a11y-menos").addEventListener("click", function () { nivel = Math.max(0, nivel - 1); aplicarLetra(); });
  $("#a11y-mas").addEventListener("click", function () { nivel = Math.min(2, nivel + 1); aplicarLetra(); });
  var hcBtn = $("#a11y-hc");
  hcBtn.setAttribute("aria-pressed", root.classList.contains("hc"));
  hcBtn.addEventListener("click", function () {
    var on = root.classList.toggle("hc");
    hcBtn.setAttribute("aria-pressed", on);
    try { localStorage.setItem("adep-hc", on ? "1" : "0"); } catch (e) { /* nada */ }
  });

  // Altura del encabezado fijo, para que la barra de progreso quede justo debajo
  function medirEncabezado() {
    root.style.setProperty("--head-h", $(".app-header").offsetHeight + "px");
  }
  medirEncabezado();
  window.addEventListener("resize", medirEncabezado);
  $$("#a11y-bar button").forEach(function (b) { b.addEventListener("click", medirEncabezado); });

  $("#year").textContent = new Date().getFullYear();
})();
