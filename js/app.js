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
  cfg.servicios.forEach(function (s) {
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

  // En la pregunta 5 solo se califican los servicios marcados en la pregunta 4.
  function syncSatisfaction() {
    var used = $$('input[name="servicios"]:checked').map(function (i) { return i.value; });
    var rows = $$(".m-row", satMatrix);
    rows.forEach(function (row) {
      var show = used.length === 0 || used.indexOf(row.dataset.label) !== -1;
      row.hidden = !show;
      if (!show) $$("input", row).forEach(function (i) { i.checked = false; });
    });
  }
  servWrap.addEventListener("change", syncSatisfaction);

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

  $("#next").addEventListener("click", function () {
    if (validateStep(current)) showStep(current + 1);
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
  var DRAFT_KEY = "adep-encuesta-borrador";
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
      syncSatisfaction();
      syncFilial();
      return Math.min(state.step || 0, steps.length - 1);
    } catch (e) { return 0; }
  }
  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* nada */ }
  }

  /* ---------- Envío ---------- */
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    for (var i = 0; i < steps.length; i++) {
      if (!validateStep(i)) { if (i !== current) showStep(i, true); return; }
    }
    var btn = $("#submit");
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando…';
    var data = collect();

    var send = cfg.endpoint
      ? fetch(cfg.endpoint, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(data),
        })
      : new Promise(function (resolve) {
          try {
            var all = JSON.parse(localStorage.getItem("adep-respuestas") || "[]");
            all.push(data);
            localStorage.setItem("adep-respuestas", JSON.stringify(all));
          } catch (err) { /* nada */ }
          console.info("[ADEP] Modo demostración: respuesta guardada localmente", data);
          setTimeout(resolve, 700);
        });

    send.then(function () {
      clearDraft();
      $("#survey").hidden = true;
      $("#thanks").hidden = false;
      $("#thanks").focus();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }).catch(function () {
      $("#form-status").textContent = "No se pudo enviar. Revise su conexión e intente de nuevo.";
    }).finally(function () {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Enviar encuesta';
    });
  });

  /* ---------- Portada / reinicio ---------- */
  $("#start").addEventListener("click", function () {
    $("#intro").hidden = true;
    $("#survey").hidden = false;
    var paso = loadDraft();
    refreshAll();
    showStep(paso);
  });
  $("#again").addEventListener("click", function () {
    form.reset();
    syncFilial();
    $$(".m-row").forEach(function (r) { r.classList.remove("missing"); r.hidden = false; });
    $$(".q").forEach(function (q) { q.classList.remove("invalid"); });
    refreshAll();
    $("#thanks").hidden = true;
    $("#intro").hidden = false;
    window.scrollTo({ top: 0 });
  });

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
