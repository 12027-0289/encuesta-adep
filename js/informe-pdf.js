/*
 * Informe general de resultados en PDF (todas las respuestas juntas).
 * Usa jsPDF (cargado desde cdnjs) y la configuración de js/config.js.
 *
 * ADEP_INFORME.resumen(filas)       -> cálculos (totales, porcentajes y promedios)
 * ADEP_INFORME.crear(filas, extra)  -> Promise<Blob>   extra = { nota }
 */
(function () {
  "use strict";

  var cfg = window.ADEP_CONFIG || { servicios: [], aspectos: [], filiales: {} };

  var VERDE = [0, 135, 68], VERDE_OSC = [4, 73, 42], ROJO = [229, 37, 33], ORO = [212, 175, 55];
  var TINTA = [23, 36, 30], SUAVE = [79, 95, 87], LINEA = [219, 230, 223], NIEBLA = [243, 248, 245], PISTA = [232, 240, 235];
  var SECCION = { participacion: [0, 135, 68], servicios: [13, 138, 122], experiencia: [184, 134, 11], comunicacion: [200, 50, 46], ideas: [4, 73, 42] };

  var ORDEN = {
    edad: ["55-64 años", "65-74 años", "75 o más"],
    antiguedad: ["Menos de 1 año", "De 1 a 5 años", "De 6 a 10 años", "Más de 10 años"],
    bienestar: ["Mucho", "Algo", "Poco", "Nada"],
    recomienda: ["Sí", "No", "No estoy seguro(a)"],
    canales: ["Central Telefónica", "Correo Electrónico", "WhatsApp"],
    redes: ["Facebook", "Instagram", "YouTube"],
  };
  var TEXTOS = [
    ["recomendaciones", "Recomendaciones para mejorar"],
    ["servicios_a_fortalecer", "Servicios que deberían fortalecerse"],
    ["nuevos_beneficios", "Nuevos beneficios que les gustaría"],
    ["temas_revista_ecos", "Temas para la Revista ECOS"],
  ];

  /* ---------- Cálculos ---------- */
  function lista(v) { return String(v || "").split(",").map(function (x) { return x.trim(); }).filter(Boolean); }
  function provinciaDe(f) {
    if (/^Otra:/.test(f || "")) return "Otra";
    var m = /\(([^)]+)\)\s*$/.exec(f || "");
    return m ? m[1] : "Otra";
  }
  function nombreFilial(f) { return String(f || "").replace(/\s*\([^)]+\)\s*$/, "").replace(/^Otra:\s*/, "Otra: "); }
  function pct(n, t) { return t ? Math.round((n / t) * 100) : 0; }

  function contar(filas, obtener, orden, multiple) {
    var c = {};
    filas.forEach(function (r) {
      var v = obtener(r);
      (multiple ? lista(v) : [v]).forEach(function (x) { if (x) c[x] = (c[x] || 0) + 1; });
    });
    var claves = (orden || []).filter(function (k) { return c[k]; });
    Object.keys(c).forEach(function (k) { if (claves.indexOf(k) === -1) claves.push(k); });
    return claves.map(function (k) { return { et: k, n: c[k] }; });
  }
  function promedios(filas, prefijo, items) {
    return items.map(function (item) {
      var vals = filas.map(function (r) { return Number(r[prefijo + item]); }).filter(function (v) { return v >= 1 && v <= 5; });
      return { et: item, prom: vals.length ? vals.reduce(function (a, b) { return a + b; }, 0) / vals.length : 0, n: vals.length };
    }).filter(function (x) { return x.n; });
  }

  function resumen(filas) {
    var N = filas.length;
    var notas = [];
    filas.forEach(function (r) {
      Object.keys(r).forEach(function (k) {
        if (/^(Satisfacción|Aspecto) - /.test(k) && Number(r[k]) >= 1) notas.push(Number(r[k]));
      });
    });
    var fechas = filas.map(function (r) { return new Date(r.fecha); }).filter(function (d) { return !isNaN(d); }).sort(function (a, b) { return a - b; });
    var reco = filas.filter(function (r) { return r.recomendaria_adep === "Sí"; }).length;
    var mucho = filas.filter(function (r) { return r.mejora_bienestar === "Mucho"; }).length;

    var porFilial = {};
    filas.forEach(function (r) {
      var k = nombreFilial(r.filial) || "Sin dato";
      var f = porFilial[k] || (porFilial[k] = { et: k, prov: provinciaDe(r.filial), n: 0, reco: 0, notas: [] });
      f.n++;
      if (r.recomendaria_adep === "Sí") f.reco++;
      Object.keys(r).forEach(function (c) { if (/^(Satisfacción|Aspecto) - /.test(c) && Number(r[c]) >= 1) f.notas.push(Number(r[c])); });
    });

    return {
      N: N,
      desde: fechas[0], hasta: fechas[fechas.length - 1],
      promedio: notas.length ? notas.reduce(function (a, b) { return a + b; }, 0) / notas.length : 0,
      reco: reco, mucho: mucho,
      provincias: contar(filas, function (r) { return provinciaDe(r.filial); }, Object.keys(cfg.filiales || {}).concat(["Otra"])),
      edad: contar(filas, function (r) { return r.edad; }, ORDEN.edad),
      antiguedad: contar(filas, function (r) { return r.antiguedad; }, ORDEN.antiguedad),
      servicios: contar(filas, function (r) { return r.servicios_utilizados; }, cfg.servicios, true).sort(function (a, b) { return b.n - a.n; }),
      satisfaccion: promedios(filas, "Satisfacción - ", cfg.servicios || []),
      aspectos: promedios(filas, "Aspecto - ", cfg.aspectos || []),
      bienestar: contar(filas, function (r) { return r.mejora_bienestar; }, ORDEN.bienestar),
      recomienda: contar(filas, function (r) { return r.recomendaria_adep; }, ORDEN.recomienda),
      canales: contar(filas, function (r) { return r.canales_comunicacion; }, ORDEN.canales, true),
      redes: contar(filas, function (r) { return r.redes_sociales; }, ORDEN.redes, true),
      filiales: Object.keys(porFilial).map(function (k) {
        var f = porFilial[k];
        f.prom = f.notas.length ? f.notas.reduce(function (a, b) { return a + b; }, 0) / f.notas.length : 0;
        return f;
      }).sort(function (a, b) { return b.n - a.n || a.et.localeCompare(b.et, "es"); }),
      textos: TEXTOS.map(function (t) {
        return {
          titulo: t[1],
          items: filas.filter(function (r) { return String(r[t[0]] || "").trim(); })
            .map(function (r) { return { texto: String(r[t[0]]).trim(), filial: nombreFilial(r.filial) }; }),
        };
      }),
    };
  }

  /* ---------- PDF ---------- */
  function cargarImagen(src) {
    return fetch(src).then(function (r) { return r.blob(); }).then(function (b) {
      return new Promise(function (ok) {
        var fr = new FileReader();
        fr.onload = function () { ok(fr.result); };
        fr.onerror = function () { ok(null); };
        fr.readAsDataURL(b);
      });
    }).catch(function () { return null; });
  }
  function mezclar(c, b) { return c.map(function (x) { return Math.round(x + (255 - x) * b); }); }
  function decimal(n) { return n.toFixed(1).replace(".", ","); }
  function fechaLarga(d) { return d ? d.toLocaleDateString("es-CR", { day: "numeric", month: "long", year: "numeric" }) : ""; }

  function crear(filas, extra) {
    extra = extra || {};
    var jsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDF) return Promise.reject(new Error("No se cargó la herramienta de PDF."));
    var R = resumen(filas);

    return cargarImagen("assets/logo-adep.png").then(function (logo) {
      var doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
      doc.setProperties({ title: "Informe general · Encuesta de Servicio ADEP", author: "ADEP" });
      var W = 210, H = 297, M = 16, ANCHO = W - M * 2, y = 0;

      function color(c, t) {
        if (t === "texto") doc.setTextColor(c[0], c[1], c[2]);
        else if (t === "linea") doc.setDrawColor(c[0], c[1], c[2]);
        else doc.setFillColor(c[0], c[1], c[2]);
      }
      function fuente(peso, tam, c) { doc.setFont("helvetica", peso); doc.setFontSize(tam); color(c || TINTA, "texto"); }
      function lineas(t, a) { return doc.splitTextToSize(String(t), a); }
      function alto(n, tam) { return n * tam * 0.3528 * 1.35; }
      function nuevaPagina() {
        doc.addPage();
        color(VERDE_OSC); doc.rect(0, 0, W, 14, "F");
        color(ROJO); doc.rect(0, 14, W, 1.2, "F");
        fuente("bold", 10, [255, 255, 255]); doc.text("Informe general · Encuesta de Servicio ADEP", M, 9);
        fuente("normal", 9, [200, 240, 215]); doc.text(R.N + " respuestas", W - M, 9, { align: "right" });
        y = 24;
      }
      function espacio(h) { if (y + h > H - 22) nuevaPagina(); }

      function tituloSeccion(texto, c) {
        espacio(28);
        color(c); doc.roundedRect(M, y, ANCHO, 11, 2.5, 2.5, "F");
        color(mezclar(c, 0.2)); doc.roundedRect(M + ANCHO - 30, y, 30, 11, 2.5, 2.5, "F");
        color(c); doc.triangle(M + ANCHO - 30, y, M + ANCHO - 18, y, M + ANCHO - 30, y + 11, "F");
        fuente("bold", 12.5, [255, 255, 255]); doc.text(texto, M + 5, y + 7.4);
        y += 16;
      }

      // Gráfico de barras horizontales. modo "conteo" (n y %) o "promedio" (de 1 a 5)
      function grafico(titulo, sub, datos, c, modo) {
        var hFila = 7.2;
        espacio(14 + Math.min(datos.length, 3) * hFila);
        fuente("bold", 11, TINTA); doc.text(titulo, M, y + 3);
        fuente("normal", 8.5, SUAVE); doc.text(sub, M, y + 7.5);
        y += 11;
        if (!datos.length) { fuente("italic", 9.5, SUAVE); doc.text("Sin respuestas.", M + 2, y + 3); y += 9; return; }
        var etW = 62, barX = M + etW + 2, barW = 78, max = modo === "promedio" ? 5 : Math.max.apply(null, datos.map(function (d) { return d.n; }));
        datos.forEach(function (d, i) {
          fuente("normal", 9, TINTA);
          var el = lineas(d.et, etW - 2);
          var h = Math.max(hFila, alto(el.length, 9) + 2.4);
          espacio(h + 1);
          if (i % 2 === 0) { color(NIEBLA); doc.roundedRect(M - 1, y - 0.6, ANCHO + 2, h, 1.5, 1.5, "F"); }
          fuente("normal", 9, TINTA); doc.text(el, M + 1, y + 4.2);
          var valor = modo === "promedio" ? d.prom : d.n;
          var cy = y + h / 2 - 2;
          color(PISTA); doc.roundedRect(barX, cy, barW, 3.6, 1.2, 1.2, "F");
          var largo = max ? Math.max(1.2, (valor / max) * barW) : 0;
          color(modo === "promedio" ? colorNota(d.prom) : c); doc.roundedRect(barX, cy, largo, 3.6, 1.2, 1.2, "F");
          if (modo === "promedio") {
            fuente("bold", 9.5, TINTA); doc.text(decimal(d.prom), barX + barW + 4, y + 4.4);
            fuente("normal", 7.5, SUAVE); doc.text("de 5 · " + d.n + (d.n === 1 ? " voto" : " votos"), barX + barW + 11, y + 4.4);
          } else {
            fuente("bold", 9.5, TINTA); doc.text(String(d.n), barX + barW + 4, y + 4.4);
            fuente("normal", 8.5, SUAVE); doc.text("(" + pct(d.n, R.N) + "%)", barX + barW + 4 + doc.getTextWidth(String(d.n)) + 2.5, y + 4.4);
          }
          y += h + 0.6;
        });
        y += 6;
      }
      function colorNota(p) { return p >= 4.5 ? [0, 135, 68] : p >= 3.5 ? [62, 155, 82] : p >= 2.5 ? [201, 154, 30] : p >= 1.5 ? [230, 126, 34] : [214, 69, 65]; }

      /* Portada */
      color(VERDE_OSC); doc.rect(0, 0, W, 60, "F");
      color(VERDE); doc.triangle(W * 0.55, 0, W, 0, W, 60, "F");
      color([20, 160, 90]); doc.circle(W - 18, 8, 26, "F");
      color(VERDE_OSC); doc.circle(W - 18, 8, 19, "F");
      color(ROJO); doc.rect(0, 60, W, 1.6, "F");
      color(ORO); doc.rect(0, 61.6, W, 0.6, "F");
      if (logo) { color([255, 255, 255]); doc.circle(M + 15, 30, 16.5, "F"); doc.addImage(logo, "PNG", M + 1, 16, 28, 28); }
      var tx = logo ? M + 38 : M;
      fuente("bold", 8.5, [170, 235, 200]); doc.text("ASOCIACIÓN DE EDUCADORES PENSIONADOS", tx, 21, { charSpace: 0.4 });
      fuente("bold", 21, [255, 255, 255]); doc.text("Informe general de resultados", tx, 31);
      fuente("normal", 12, [230, 248, 238]); doc.text("Encuesta de Servicio a la Persona Asociada", tx, 38.5);
      fuente("normal", 9, [200, 240, 215]);
      var periodo = R.desde ? "Respuestas del " + fechaLarga(R.desde) + (R.hasta && fechaLarga(R.hasta) !== fechaLarga(R.desde) ? " al " + fechaLarga(R.hasta) : "") : "";
      doc.text(periodo, tx, 46);
      doc.text("Generado el " + new Date().toLocaleString("es-CR", { dateStyle: "long", timeStyle: "short" }), tx, 51.5);

      /* Cifras principales */
      y = 70;
      var kpis = [
        ["RESPUESTAS", String(R.N), "personas asociadas"],
        ["CALIFICACIÓN PROMEDIO", R.N ? decimal(R.promedio) : "—", "de 5 en servicios y aspectos"],
        ["RECOMENDARÍA LA ADEP", R.N ? pct(R.reco, R.N) + "%" : "—", R.reco + " de " + R.N + " dijeron «Sí»"],
        ["MEJORA MUCHO SU BIENESTAR", R.N ? pct(R.mucho, R.N) + "%" : "—", R.mucho + " de " + R.N + " dijeron «Mucho»"],
      ];
      var gap = 3.5, kw = (ANCHO - gap * 3) / 4;
      kpis.forEach(function (k, i) {
        var x = M + i * (kw + gap);
        color(NIEBLA); color(LINEA, "linea"); doc.setLineWidth(0.3); doc.roundedRect(x, y, kw, 27, 3, 3, "FD");
        color(i === 0 ? VERDE : i === 1 ? ORO : i === 2 ? [13, 138, 122] : ROJO); doc.roundedRect(x, y, kw, 1.6, 0.8, 0.8, "F");
        fuente("bold", 6.5, SUAVE); doc.text(lineas(k[0], kw - 6), x + 3.5, y + 7);
        fuente("bold", 19, VERDE_OSC); doc.text(k[1], x + 3.5, y + 18.5);
        fuente("normal", 7, SUAVE); doc.text(lineas(k[2], kw - 6).slice(0, 1), x + 3.5, y + 23.5);
      });
      y += 34;
      if (extra.nota) {
        fuente("italic", 8.5, SUAVE);
        var nl = lineas(extra.nota, ANCHO);
        doc.text(nl, M, y); y += alto(nl.length, 8.5) + 4;
      }

      /* Secciones */
      tituloSeccion("Participación", SECCION.participacion);
      grafico("Respuestas por provincia", "Cantidad de personas y porcentaje del total", R.provincias, SECCION.participacion);
      grafico("Edad", "Pregunta 2", R.edad, SECCION.participacion);
      grafico("Años de pertenecer a la ADEP", "Pregunta 3", R.antiguedad, SECCION.participacion);

      tituloSeccion("Servicios", SECCION.servicios);
      grafico("Servicios utilizados", "Pregunta 4 · cada persona pudo marcar varios", R.servicios, SECCION.servicios);
      grafico("Satisfacción con los servicios", "Pregunta 5 · promedio de 1 (muy malo) a 5 (excelente)", R.satisfaccion, SECCION.servicios, "promedio");

      tituloSeccion("Experiencia con la ADEP", SECCION.experiencia);
      grafico("Calificación de aspectos de ADEP", "Pregunta 7 · promedio de 1 (muy malo) a 5 (excelente)", R.aspectos, SECCION.experiencia, "promedio");
      grafico("¿ADEP mejora su bienestar y calidad de vida?", "Pregunta 8", R.bienestar, SECCION.experiencia);
      grafico("¿Recomendaría la ADEP a otras personas de la Educación?", "Pregunta 9", R.recomienda, SECCION.experiencia);

      tituloSeccion("Comunicación", SECCION.comunicacion);
      grafico("Canales de comunicación más usados", "Pregunta 10 · varias opciones", R.canales, SECCION.comunicacion);
      grafico("Redes sociales más usadas", "Pregunta 11 · varias opciones", R.redes, SECCION.comunicacion);

      /* Tabla por filial */
      tituloSeccion("Resultados por filial o núcleo", SECCION.participacion);
      var cols = [M, M + 92, M + 120, M + 150];
      function cabecera() {
        color(VERDE_OSC); doc.roundedRect(M, y, ANCHO, 8, 1.5, 1.5, "F");
        fuente("bold", 8, [255, 255, 255]);
        doc.text("Filial o núcleo", cols[0] + 3, y + 5.3);
        doc.text("Respuestas", cols[1] + 3, y + 5.3);
        doc.text("Calificación", cols[2] + 3, y + 5.3);
        doc.text("Recomendaría", cols[3] + 3, y + 5.3);
        y += 9;
      }
      espacio(20); cabecera();
      R.filiales.forEach(function (f, i) {
        if (y + 7 > H - 22) { nuevaPagina(); cabecera(); }
        if (i % 2 === 0) { color(NIEBLA); doc.rect(M, y - 0.5, ANCHO, 7, "F"); }
        fuente("normal", 9, TINTA); doc.text(lineas(f.et + " · " + f.prov, 86)[0], cols[0] + 3, y + 4.4);
        doc.text(String(f.n), cols[1] + 3, y + 4.4);
        if (f.prom) { color(colorNota(f.prom)); doc.circle(cols[2] + 4.5, y + 3, 1.6, "F"); }
        doc.text(f.prom ? decimal(f.prom) + " de 5" : "—", cols[2] + 8, y + 4.4);
        doc.text(pct(f.reco, f.n) + "%", cols[3] + 3, y + 4.4);
        y += 7;
      });
      y += 8;

      /* Comentarios */
      tituloSeccion("Comentarios de las personas asociadas", SECCION.ideas);
      R.textos.forEach(function (t) {
        espacio(18);
        fuente("bold", 11, TINTA); doc.text(t.titulo, M, y + 3);
        var anchoTitulo = doc.getTextWidth(t.titulo);
        fuente("normal", 8.5, SUAVE); doc.text(t.items.length + (t.items.length === 1 ? " comentario" : " comentarios"), M + anchoTitulo + 3, y + 3);
        y += 7;
        if (!t.items.length) { fuente("italic", 9.5, SUAVE); doc.text("Sin comentarios.", M + 2, y + 2); y += 8; return; }
        t.items.forEach(function (it) {
          fuente("normal", 9.5, TINTA);
          var tl = lineas("«" + it.texto + "»", ANCHO - 12);
          var h = alto(tl.length, 9.5) + 6.5;
          espacio(h + 2);
          color(mezclar(SECCION.ideas, 0.92)); doc.roundedRect(M + 2, y - 1, ANCHO - 2, h, 2, 2, "F");
          color(SECCION.ideas); doc.rect(M + 2, y - 1, 1, h, "F");
          fuente("normal", 9.5, TINTA); doc.text(tl, M + 6, y + 3.2);
          fuente("normal", 7.5, SUAVE); doc.text(it.filial, M + 6, y + h - 2.6);
          y += h + 2.5;
        });
        y += 5;
      });

      /* Cierre */
      espacio(24);
      color(VERDE_OSC); doc.roundedRect(M + 25, y, ANCHO - 50, 14, 7, 7, "F");
      color(ROJO); doc.circle(M + 33, y + 7, 1.6, "F"); doc.circle(W - M - 33, y + 7, 1.6, "F");
      fuente("bold", 13, [255, 255, 255]); doc.text("Orgullosos de ser personas solidarias", W / 2, y + 9, { align: "center" });

      /* Pie */
      var total = doc.getNumberOfPages();
      for (var i = 1; i <= total; i++) {
        doc.setPage(i);
        color(LINEA, "linea"); doc.setLineWidth(0.3); doc.line(M, H - 15, W - M, H - 15);
        fuente("bold", 7.5, VERDE); doc.text("COMPRENSIÓN · FRATERNIDAD · COOPERACIÓN", M, H - 10, { charSpace: 0.3 });
        fuente("normal", 7.5, SUAVE); doc.text("Página " + i + " de " + total, W - M, H - 10, { align: "right" });
        fuente("normal", 6.5, [150, 165, 156]); doc.text("Informe general · Encuesta de Servicio ADEP · " + R.N + " respuestas", M, H - 6);
      }
      return doc.output("blob");
    });
  }

  window.ADEP_INFORME = { resumen: resumen, crear: crear, provinciaDe: provinciaDe, nombreFilial: nombreFilial };
})();
