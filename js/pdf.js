/*
 * PDF de una respuesta de la encuesta (se adjunta al correo).
 * Usa jsPDF (cargado desde cdnjs en index.html).
 *
 * ADEP_PDF.crear(info) -> Promise<Blob>
 *   info = {
 *     fecha, filial, edad, antiguedad, codigo,
 *     secciones: [{ titulo, color, preguntas: [{ num, texto, respuesta } | { num, texto, filas: [{ et, v }] }] }]
 *   }
 */
(function () {
  "use strict";

  var VERDE = [0, 135, 68], VERDE_OSC = [4, 73, 42], ROJO = [229, 37, 33], ORO = [212, 175, 55];
  var TINTA = [23, 36, 30], SUAVE = [79, 95, 87], LINEA = [219, 230, 223], NIEBLA = [243, 248, 245];
  var NIVEL = { 1: [214, 69, 65], 2: [230, 126, 34], 3: [201, 154, 30], 4: [62, 155, 82], 5: [0, 135, 68] };
  var NOMBRE_NIVEL = ["", "Muy malo", "Malo", "Regular", "Bueno", "Excelente"];

  var W = 210, H = 297, M = 16; // A4 en milímetros
  var ANCHO = W - M * 2;

  function hexARgb(h) {
    h = h.replace("#", "");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function mezclar(c, blanco) {
    return c.map(function (x) { return Math.round(x + (255 - x) * blanco); });
  }

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

  function crear(info) {
    var jsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDF) return Promise.reject(new Error("No se cargó la herramienta de PDF."));

    return cargarImagen("assets/logo-adep.png").then(function (logo) {
      var doc = new jsPDF({ unit: "mm", format: "a4" });
      doc.setProperties({ title: "Encuesta de Servicio ADEP", author: "ADEP", subject: "Respuesta de una persona asociada" });
      var y = 0;

      function color(c, tipo) {
        if (tipo === "texto") doc.setTextColor(c[0], c[1], c[2]);
        else if (tipo === "linea") doc.setDrawColor(c[0], c[1], c[2]);
        else doc.setFillColor(c[0], c[1], c[2]);
      }
      function fuente(peso, tam, c) {
        doc.setFont("helvetica", peso);
        doc.setFontSize(tam);
        color(c || TINTA, "texto");
      }
      function lineas(texto, ancho) { return doc.splitTextToSize(String(texto), ancho); }
      function alto(n, tam) { return n * tam * 0.3528 * 1.35; }

      function nuevaPagina() {
        doc.addPage();
        // Encabezado corto en las páginas siguientes
        color(VERDE_OSC); doc.rect(0, 0, W, 14, "F");
        color(ROJO); doc.rect(0, 14, W, 1.2, "F");
        fuente("bold", 10, [255, 255, 255]);
        doc.text("Encuesta de Servicio · ADEP", M, 9);
        fuente("normal", 9, [200, 240, 215]);
        doc.text(info.filial || "", W - M, 9, { align: "right" });
        y = 24;
      }
      function espacio(h) { if (y + h > H - 22) nuevaPagina(); }

      /* ---------- Portada ---------- */
      color(VERDE_OSC); doc.rect(0, 0, W, 56, "F");
      color(VERDE); doc.triangle(W * 0.55, 0, W, 0, W, 56, "F");
      color([20, 160, 90]); doc.circle(W - 18, 8, 26, "F");
      color(VERDE_OSC); doc.circle(W - 18, 8, 19, "F");
      color(ROJO); doc.rect(0, 56, W, 1.6, "F");
      color(ORO); doc.rect(0, 57.6, W, 0.6, "F");

      if (logo) {
        color([255, 255, 255]); doc.circle(M + 15, 28, 16.5, "F");
        doc.addImage(logo, "PNG", M + 1, 14, 28, 28);
      }
      var tx = logo ? M + 38 : M;
      fuente("bold", 8.5, [170, 235, 200]);
      doc.text("ASOCIACIÓN DE EDUCADORES PENSIONADOS", tx, 21, { charSpace: 0.4 });
      fuente("bold", 21, [255, 255, 255]);
      doc.text("Encuesta de Servicio", tx, 31);
      fuente("normal", 12, [230, 248, 238]);
      doc.text("Respuesta de una persona asociada", tx, 38.5);
      fuente("normal", 9, [200, 240, 215]);
      doc.text(info.fecha || "", tx, 46);

      // Tarjetas de datos principales
      y = 66;
      var datos = [
        ["Filial o núcleo", info.filial || "—"],
        ["Edad", info.edad || "—"],
        ["Años en ADEP", info.antiguedad || "—"],
      ];
      var gap = 4, cw = (ANCHO - gap * 2) / 3;
      datos.forEach(function (d, i) {
        var x = M + i * (cw + gap);
        color(NIEBLA); color(LINEA, "linea"); doc.setLineWidth(0.3);
        doc.roundedRect(x, y, cw, 20, 3, 3, "FD");
        color(VERDE); doc.roundedRect(x, y, 1.6, 20, 0.8, 0.8, "F");
        fuente("bold", 7.5, SUAVE);
        doc.text(d[0].toUpperCase(), x + 5, y + 7, { charSpace: 0.3 });
        fuente("bold", 11, VERDE_OSC);
        doc.text(lineas(d[1], cw - 8).slice(0, 2), x + 5, y + 13.5);
      });
      y += 28;

      /* ---------- Secciones ---------- */
      info.secciones.forEach(function (sec, si) {
        var c = hexARgb(sec.color || "#008744");
        espacio(30);
        color(c); doc.roundedRect(M, y, ANCHO, 11, 2.5, 2.5, "F");
        color(mezclar(c, 0.2)); doc.roundedRect(M + ANCHO - 30, y, 30, 11, 2.5, 2.5, "F");
        color(c); doc.triangle(M + ANCHO - 30, y, M + ANCHO - 18, y, M + ANCHO - 30, y + 11, "F");
        color([255, 255, 255]); doc.circle(M + 6.5, y + 5.5, 3.6, "F");
        fuente("bold", 9.5, c);
        doc.text(String(si + 1), M + 6.5, y + 6.9, { align: "center" });
        fuente("bold", 12.5, [255, 255, 255]);
        doc.text(sec.titulo, M + 13, y + 7.4);
        y += 16;

        sec.preguntas.forEach(function (p) {
          var tl = lineas(p.texto, ANCHO - 14);
          var hPreg = alto(tl.length, 10.5);
          if (p.filas) {
            espacio(hPreg + 12 + Math.min(p.filas.length, 2) * 8);
          } else {
            var rl = lineas(p.respuesta || "Sin respuesta", ANCHO - 18);
            espacio(hPreg + alto(Math.min(rl.length, 3), 10.5) + 10);
          }

          // Número y pregunta
          color(mezclar(c, 0.85)); doc.circle(M + 4, y + 2.6, 4, "F");
          fuente("bold", 8.5, c);
          doc.text(String(p.num), M + 4, y + 3.9, { align: "center" });
          fuente("bold", 10.5, TINTA);
          doc.text(tl, M + 11, y + 3.8);
          y += hPreg + 2.5;

          if (p.filas) {
            if (!p.filas.length) {
              fuente("italic", 10, SUAVE); doc.text("Sin respuesta", M + 11, y + 3); y += 8;
            }
            p.filas.forEach(function (f, fi) {
              var el = lineas(f.et, 82);
              var hFila = Math.max(8.5, alto(el.length, 9.5) + 3);
              espacio(hFila + 2);
              if (fi % 2 === 0) { color(NIEBLA); doc.roundedRect(M + 9, y - 1, ANCHO - 9, hFila, 2, 2, "F"); }
              fuente("normal", 9.5, TINTA);
              doc.text(el, M + 12, y + 4.2);
              var cx0 = M + 102;
              for (var v = 1; v <= 5; v++) {
                var cx = cx0 + (v - 1) * 8.2, cy = y + hFila / 2 - 1;
                if (v === f.v) {
                  color(NIVEL[v]); doc.circle(cx, cy, 3.3, "F");
                  fuente("bold", 8.5, [255, 255, 255]);
                } else {
                  color([255, 255, 255]); color([205, 219, 210], "linea"); doc.setLineWidth(0.35);
                  doc.circle(cx, cy, 3, "FD");
                  fuente("normal", 8, [150, 165, 156]);
                }
                doc.text(String(v), cx, cy + 1.1, { align: "center" });
              }
              if (f.v) {
                var etq = NOMBRE_NIVEL[f.v];
                fuente("bold", 8.5, [255, 255, 255]);
                var wEtq = doc.getTextWidth(etq) + 6;
                color(NIVEL[f.v]); doc.roundedRect(W - M - wEtq, y + hFila / 2 - 4, wEtq, 6, 3, 3, "F");
                doc.text(etq, W - M - wEtq / 2, y + hFila / 2, { align: "center" });
              }
              y += hFila + 1;
            });
            y += 4;
          } else {
            var vacia = !p.respuesta;
            var rlin = lineas(vacia ? "Sin respuesta" : p.respuesta, ANCHO - 18);
            var hResp = alto(rlin.length, 10.5) + 4;
            if (y + hResp > H - 22) nuevaPagina();
            color(vacia ? [250, 250, 250] : mezclar(c, 0.92));
            doc.roundedRect(M + 9, y - 1, ANCHO - 9, hResp, 2, 2, "F");
            color(c); doc.rect(M + 9, y - 1, 1, hResp, "F");
            fuente(vacia ? "italic" : "normal", 10.5, vacia ? SUAVE : TINTA);
            doc.text(rlin, M + 13, y + 4);
            y += hResp + 5;
          }
        });
        y += 3;
      });

      /* ---------- Cierre ---------- */
      espacio(26);
      y += 2;
      color(VERDE_OSC); doc.roundedRect(M + 25, y, ANCHO - 50, 14, 7, 7, "F");
      color(ROJO); doc.circle(M + 33, y + 7, 1.6, "F"); doc.circle(W - M - 33, y + 7, 1.6, "F");
      fuente("bold", 13, [255, 255, 255]);
      doc.text("Orgullosos de ser personas solidarias", W / 2, y + 9, { align: "center" });

      /* ---------- Pie en todas las páginas ---------- */
      var total = doc.getNumberOfPages();
      for (var i = 1; i <= total; i++) {
        doc.setPage(i);
        color(LINEA, "linea"); doc.setLineWidth(0.3); doc.line(M, H - 15, W - M, H - 15);
        fuente("bold", 7.5, VERDE);
        doc.text("COMPRENSIÓN · FRATERNIDAD · COOPERACIÓN", M, H - 10, { charSpace: 0.3 });
        fuente("normal", 7.5, SUAVE);
        doc.text("Página " + i + " de " + total, W - M, H - 10, { align: "right" });
        fuente("normal", 6.5, [150, 165, 156]);
        doc.text("Código de persona: " + (info.codigo || "—") + "  ·  Encuesta de Servicio ADEP", M, H - 6);
      }

      return doc.output("blob");
    });
  }

  window.ADEP_PDF = { crear: crear };
})();
