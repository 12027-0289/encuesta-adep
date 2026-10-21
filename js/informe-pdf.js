/*
 * Informe general de resultados en PDF, con gráficos y frases sencillas.
 * Lo arma la encuesta (jsPDF) con los números que entrega Google (?resumen=1) más la respuesta nueva.
 *
 * ADEP_INFORME.crear(filas) -> Promise<Blob>
 *   filas: respuestas con edad, antiguedad, servicios_utilizados, "Satisfacción - …", "Aspecto - …",
 *          mejora_bienestar, recomendaria_adep, canales_comunicacion, redes_sociales,
 *          y provincia (o filial, de donde se saca la provincia). Sin textos libres.
 */
(function () {
  "use strict";

  var cfg = window.ADEP_CONFIG || { servicios: [], aspectos: [], filiales: {} };

  var VERDE = [0, 135, 68], OSCURO = [4, 73, 42], ROJO = [229, 37, 33], ORO = [212, 175, 55];
  var TINTA = [23, 36, 30], SUAVE = [79, 95, 87], LINEA = [219, 230, 223], NIEBLA = [243, 248, 245], PISTA = [226, 236, 230];
  var BLANCO = [255, 255, 255];
  var SECCION = { participacion: [0, 135, 68], servicios: [13, 138, 122], experiencia: [184, 134, 11], comunicacion: [200, 50, 46] };

  // Colores de las donas: siguen el sentido de cada respuesta (de más a menos), no un arcoíris.
  var COLORES = {
    edad: { "55-64 años": [124, 200, 152], "65-74 años": [38, 150, 88], "75 o más": [4, 73, 42] },
    antiguedad: { "Menos de 1 año": [178, 224, 194], "De 1 a 5 años": [110, 190, 140], "De 6 a 10 años": [38, 150, 88], "Más de 10 años": [4, 73, 42] },
    bienestar: { "Mucho": [0, 135, 68], "Algo": [124, 197, 118], "Poco": [230, 162, 60], "Nada": [214, 69, 65] },
    recomienda: { "Sí": [0, 135, 68], "No": [214, 69, 65], "No estoy seguro(a)": [154, 168, 160] },
  };
  var ORDEN = {
    edad: ["55-64 años", "65-74 años", "75 o más"],
    antiguedad: ["Menos de 1 año", "De 1 a 5 años", "De 6 a 10 años", "Más de 10 años"],
    bienestar: ["Mucho", "Algo", "Poco", "Nada"],
    recomienda: ["Sí", "No", "No estoy seguro(a)"],
    canales: ["Central Telefónica", "Correo Electrónico", "WhatsApp"],
    redes: ["Facebook", "Instagram", "YouTube"],
    provincias: Object.keys(cfg.filiales || {}).concat(["Otra"]),
  };
  var NIVEL = ["", "Muy malo", "Malo", "Regular", "Bueno", "Excelente"];

  /* ---------- Cálculos ---------- */
  function lista(v) { return String(v || "").split(",").map(function (x) { return x.trim(); }).filter(Boolean); }
  function provinciaDe(r) {
    if (r.provincia) return r.provincia;
    if (/^Otra:/.test(r.filial || "")) return "Otra";
    var m = /\(([^)]+)\)\s*$/.exec(r.filial || "");
    return m ? m[1] : "Otra";
  }
  function pct(n, t) { return t ? Math.round((n / t) * 100) : 0; }
  function contar(filas, obtener, orden, multiple) {
    var c = {};
    filas.forEach(function (r) {
      var v = obtener(r);
      (multiple ? lista(v) : [String(v || "")]).forEach(function (x) { if (x) c[x] = (c[x] || 0) + 1; });
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
    var notas = [];
    filas.forEach(function (r) {
      Object.keys(r).forEach(function (k) { if (/^(Satisfacción|Aspecto) - /.test(k) && Number(r[k]) >= 1) notas.push(Number(r[k])); });
    });
    var fechas = filas.map(function (r) { return new Date(r.fecha); }).filter(function (d) { return !isNaN(d); }).sort(function (a, b) { return a - b; });
    return {
      N: filas.length,
      desde: fechas[0], hasta: fechas[fechas.length - 1],
      promedio: notas.length ? notas.reduce(function (a, b) { return a + b; }, 0) / notas.length : 0,
      reco: filas.filter(function (r) { return r.recomendaria_adep === "Sí"; }).length,
      mucho: filas.filter(function (r) { return r.mejora_bienestar === "Mucho"; }).length,
      provincias: contar(filas, provinciaDe, ORDEN.provincias),
      edad: contar(filas, function (r) { return r.edad; }, ORDEN.edad),
      antiguedad: contar(filas, function (r) { return r.antiguedad; }, ORDEN.antiguedad),
      servicios: contar(filas, function (r) { return r.servicios_utilizados; }, cfg.servicios, true).sort(function (a, b) { return b.n - a.n; }),
      satisfaccion: promedios(filas, "Satisfacción - ", cfg.servicios || []).sort(function (a, b) { return b.prom - a.prom; }),
      aspectos: promedios(filas, "Aspecto - ", cfg.aspectos || []).sort(function (a, b) { return b.prom - a.prom; }),
      bienestar: contar(filas, function (r) { return r.mejora_bienestar; }, ORDEN.bienestar),
      recomienda: contar(filas, function (r) { return r.recomendaria_adep; }, ORDEN.recomienda),
      canales: contar(filas, function (r) { return r.canales_comunicacion; }, ORDEN.canales, true).sort(function (a, b) { return b.n - a.n; }),
      redes: contar(filas, function (r) { return r.redes_sociales; }, ORDEN.redes, true).sort(function (a, b) { return b.n - a.n; }),
    };
  }

  /* ---------- Frases sencillas ---------- */
  function decimal(n) { return n.toFixed(1).replace(".", ","); }
  function deCada10(n, t) { return t ? Math.round((n / t) * 10) : 0; }
  function mayor(datos) { return datos.slice().sort(function (a, b) { return b.n - a.n; })[0]; }
  function colorNota(p) {
    return p >= 4.5 ? [0, 135, 68] : p >= 3.5 ? [62, 155, 82] : p >= 2.5 ? [201, 154, 30] : p >= 1.5 ? [230, 126, 34] : [214, 69, 65];
  }
  function nivelDe(p) { return NIVEL[Math.min(5, Math.max(1, Math.round(p)))]; }

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

  function crear(filas) {
    var jsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDF) return Promise.reject(new Error("No se cargó la herramienta de PDF."));
    var R = resumen(filas);

    return cargarImagen("assets/logo-adep.png").then(function (logo) {
      var doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
      doc.setProperties({ title: "Informe general · Encuesta de Servicio ADEP", author: "ADEP" });
      var W = 210, H = 297, M = 15, ANCHO = W - M * 2, y = 0;

      function color(c, t) {
        if (t === "texto") doc.setTextColor(c[0], c[1], c[2]);
        else if (t === "linea") doc.setDrawColor(c[0], c[1], c[2]);
        else doc.setFillColor(c[0], c[1], c[2]);
      }
      function fuente(peso, tam, c) { doc.setFont("helvetica", peso); doc.setFontSize(tam); color(c || TINTA, "texto"); }
      function lineas(t, a) { return doc.splitTextToSize(String(t), a); }
      function nuevaPagina() {
        doc.addPage();
        color(OSCURO); doc.rect(0, 0, W, 13, "F");
        color(ROJO); doc.rect(0, 13, W, 1.1, "F");
        fuente("bold", 9.5, BLANCO); doc.text("Informe general · Encuesta de Servicio ADEP", M, 8.5);
        fuente("normal", 9, [200, 240, 215]); doc.text(R.N + (R.N === 1 ? " respuesta" : " respuestas"), W - M, 8.5, { align: "right" });
        y = 22;
      }
      function espacio(h) { if (y + h > H - 20) nuevaPagina(); }

      function tituloSeccion(texto, c, siguiente) {
        espacio(14 + (siguiente || 40));
        color(c); doc.roundedRect(M, y, ANCHO, 10, 2.5, 2.5, "F");
        fuente("bold", 12.5, BLANCO); doc.text(texto, M + 5, y + 6.9);
        y += 14;
      }
      function tarjeta(x, yy, w, h) {
        color(BLANCO); color(LINEA, "linea"); doc.setLineWidth(0.3);
        doc.roundedRect(x, yy, w, h, 3, 3, "FD");
      }
      function frase(texto, x, yy, w, c) {
        fuente("bold", 9.5, c || OSCURO);
        var l = lineas(texto, w);
        doc.text(l, x, yy);
        return l.length;
      }

      // Dona con su leyenda, dentro de una tarjeta.
      function dona(x, yy, w, titulo, datos, colores, conclusion) {
        var h = 62;
        tarjeta(x, yy, w, h);
        fuente("bold", 10.5, TINTA); doc.text(lineas(titulo, w - 8), x + 4, yy + 7);
        var cx = x + 22, cy = yy + 33, r = 15.5, total = datos.reduce(function (a, d) { return a + d.n; }, 0);
        if (!total) {
          fuente("italic", 9, SUAVE); doc.text("Todavía no hay respuestas.", x + 4, yy + 30);
          return h;
        }
        var a0 = -Math.PI / 2;
        datos.forEach(function (d) {
          var a1 = a0 + (d.n / total) * Math.PI * 2;
          color(colores[d.et] || [150, 165, 156]);
          // Sector como un solo polígono: centro -> arco -> centro
          var puntos = [[cx, cy]], pasos = Math.max(2, Math.ceil((a1 - a0) / (Math.PI / 90)));
          for (var k = 0; k <= pasos; k++) {
            var a = a0 + (a1 - a0) * (k / pasos);
            puntos.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
          }
          var tramos = [];
          for (var q = 1; q < puntos.length; q++) tramos.push([puntos[q][0] - puntos[q - 1][0], puntos[q][1] - puntos[q - 1][1]]);
          doc.lines(tramos, cx, cy, [1, 1], "F", true);
          // Separación blanca entre partes
          if (datos.length > 1) {
            color(BLANCO, "linea"); doc.setLineWidth(0.7);
            doc.line(cx, cy, cx + r * Math.cos(a0), cy + r * Math.sin(a0));
          }
          a0 = a1;
        });
        color(BLANCO); doc.circle(cx, cy, r * 0.58, "F");
        var top = mayor(datos);
        fuente("bold", 14, OSCURO); doc.text(pct(top.n, total) + "%", cx, cy + 1.2, { align: "center" });
        fuente("normal", 6.5, SUAVE); doc.text(lineas(top.et, 16).slice(0, 1), cx, cy + 5, { align: "center" });

        // Leyenda
        var lx = x + 43, ly = yy + 18;
        datos.forEach(function (d) {
          color(colores[d.et] || [150, 165, 156]); doc.roundedRect(lx, ly - 3, 3.6, 3.6, 0.8, 0.8, "F");
          fuente("normal", 8.5, TINTA);
          var et = lineas(d.et, x + w - 16 - (lx + 5.5)).slice(0, 2);
          doc.text(et, lx + 5.5, ly);
          fuente("normal", 7, SUAVE); doc.text(d.n + (d.n === 1 ? " persona" : " personas"), lx + 5.5, ly + 3.4 * et.length);
          fuente("bold", 9, TINTA); doc.text(pct(d.n, total) + "%", x + w - 4, ly, { align: "right" });
          ly += 4 + 3.4 * et.length + 1.6;
        });
        // Conclusión en palabras
        color(NIEBLA); doc.roundedRect(x + 3, yy + h - 12.5, w - 6, 9.5, 2, 2, "F");
        fuente("bold", 8.3, OSCURO);
        doc.text(lineas(conclusion, w - 12).slice(0, 2), x + 6, yy + h - 7.2);
        return h;
      }

      // Barras horizontales a todo el ancho. modo "conteo" (personas y %) o "nota" (de 1 a 5).
      function barras(titulo, sub, datos, c, modo, conclusion) {
        var h = dibujarBarras(M, ANCHO, null, titulo, sub, datos, c, modo, conclusion);
        y += h + 4;
      }
      // Dos tarjetas de barras lado a lado (para preguntas con pocas opciones).
      function barrasDoble(a, b) {
        var w = (ANCHO - 5) / 2;
        var h = Math.max(alturaBarras(w, a[2], a[5]), alturaBarras(w, b[2], b[5]));
        espacio(h);
        dibujarBarras(M, w, y, a[0], a[1], a[2], a[3], a[4], a[5], h);
        dibujarBarras(M + w + 5, w, y, b[0], b[1], b[2], b[3], b[4], b[5], h);
        y += h + 4;
      }
      function alturaBarras(w, datos, conclusion) {
        var etW = w > 120 ? 60 : w * 0.42;
        fuente("normal", 9, TINTA);
        return 19 + datos.reduce(function (t, d) { return t + (lineas(d.et, etW - 3).length > 1 ? 10.5 : 7.4); }, 0) +
          (conclusion ? 11 * Math.min(2, lineas(conclusion, w - 12).length) : 0) + (datos.length ? 0 : 6);
      }
      function dibujarBarras(x, w, yFijo, titulo, sub, datos, c, modo, conclusion, hFija) {
        var ancha = w > 120, etW = ancha ? 60 : w * 0.42;
        fuente("normal", 9, TINTA);
        var alturas = datos.map(function (d) { return lineas(d.et, etW - 3).length > 1 ? 10.5 : 7.4; });
        var h = hFija || alturaBarras(w, datos, conclusion);
        if (yFijo === null) espacio(Math.min(h, 75));
        var y0 = yFijo === null ? y : yFijo;
        tarjeta(x, y0, w, h);
        fuente("bold", 10.5, TINTA); doc.text(lineas(titulo, w - 8).slice(0, 1), x + 4, y0 + 7);
        fuente("normal", 8, SUAVE); doc.text(lineas(sub, w - 8).slice(0, 1), x + 4, y0 + 11.5);
        var yy = y0 + 17;
        if (!datos.length) {
          fuente("italic", 9, SUAVE); doc.text("Todavía no hay respuestas.", x + 4, yy + 3);
          return h;
        }
        var bx = x + 4 + etW, bw = ancha ? w - etW - 42 : w - etW - 22;
        var max = modo === "nota" ? 5 : R.N;
        datos.forEach(function (d, i) {
          var valor = modo === "nota" ? d.prom : d.n;
          fuente("normal", 9, TINTA); doc.text(lineas(d.et, etW - 3).slice(0, 2), x + 4, yy + 4);
          color(PISTA); doc.roundedRect(bx, yy, bw, 5, 1.5, 1.5, "F");
          var largo = max ? Math.max(1.5, (valor / max) * bw) : 0;
          color(modo === "nota" ? colorNota(d.prom) : c); doc.roundedRect(bx, yy, largo, 5, 1.5, 1.5, "F");
          if (modo === "nota") {
            fuente("bold", 10, TINTA); doc.text(decimal(d.prom), bx + bw + 4, yy + 4.1);
            fuente("normal", 7.5, colorNota(d.prom)); doc.text(nivelDe(d.prom), bx + bw + 13, yy + 4.1);
          } else {
            fuente("bold", 10, TINTA); doc.text(pct(d.n, R.N) + "%", bx + bw + 4, yy + 4.1);
            if (ancha) { fuente("normal", 7.5, SUAVE); doc.text(d.n + (d.n === 1 ? " persona" : " personas"), bx + bw + 15, yy + 4.1); }
          }
          yy += alturas[i];
        });
        if (conclusion) {
          var cl = lineas(conclusion, w - 12).slice(0, 2);
          color(NIEBLA); doc.roundedRect(x + 3, y0 + h - 3 - (cl.length > 1 ? 13 : 9.5), w - 6, cl.length > 1 ? 12 : 8.5, 2, 2, "F");
          fuente("bold", 8.5, OSCURO); doc.text(cl, x + 6, y0 + h - 3 - (cl.length > 1 ? 7.6 : 4.2));
        }
        return h;
      }

      /* ===== Portada ===== */
      color(OSCURO); doc.rect(0, 0, W, 54, "F");
      color(VERDE); doc.triangle(W * 0.58, 0, W, 0, W, 54, "F");
      color([20, 160, 90]); doc.circle(W - 16, 6, 24, "F");
      color(OSCURO); doc.circle(W - 16, 6, 17.5, "F");
      color(ROJO); doc.rect(0, 54, W, 1.5, "F");
      color(ORO); doc.rect(0, 55.5, W, 0.6, "F");
      if (logo) { color(BLANCO); doc.circle(M + 14, 27, 15.5, "F"); doc.addImage(logo, "PNG", M + 1, 14, 26, 26); }
      var tx = logo ? M + 36 : M;
      fuente("bold", 8, [170, 235, 200]); doc.text("ASOCIACIÓN DE EDUCADORES PENSIONADOS", tx, 19, { charSpace: 0.4 });
      fuente("bold", 21, BLANCO); doc.text("Informe general", tx, 29);
      fuente("normal", 12, [230, 248, 238]); doc.text("Encuesta de Servicio a la Persona Asociada", tx, 36.5);
      fuente("normal", 8.5, [200, 240, 215]);
      doc.text("Actualizado el " + new Date().toLocaleString("es-CR", { dateStyle: "long", timeStyle: "short" }), tx, 44);

      y = 63;
      if (!R.N) {
        fuente("bold", 13, OSCURO); doc.text("Todavía no hay respuestas.", M, y + 6);
        return terminar(doc, R, W, H, M);
      }

      /* ===== Resumen en 4 números ===== */
      fuente("bold", 12, OSCURO); doc.text("Resumen en 4 números", M, y + 4);
      y += 8;
      var kpis = [
        [String(R.N), R.N === 1 ? "persona respondió" : "personas respondieron", "la encuesta", VERDE],
        [decimal(R.promedio), "de 5 es la nota", "promedio (" + nivelDe(R.promedio).toLowerCase() + ")", ORO],
        [deCada10(R.reco, R.N) + " de 10", "recomendarían", "la ADEP", [13, 138, 122]],
        [deCada10(R.mucho, R.N) + " de 10", "dicen que ADEP mejora", "mucho su bienestar", ROJO],
      ];
      var gap = 3.5, kw = (ANCHO - gap * 3) / 4;
      kpis.forEach(function (k, i) {
        var x = M + i * (kw + gap);
        color(NIEBLA); color(LINEA, "linea"); doc.setLineWidth(0.3); doc.roundedRect(x, y, kw, 30, 3, 3, "FD");
        color(k[3]); doc.roundedRect(x, y, kw, 2, 1, 1, "F");
        fuente("bold", 19, OSCURO); doc.text(k[0], x + kw / 2, y + 14, { align: "center" });
        fuente("normal", 8, SUAVE); doc.text(k[1], x + kw / 2, y + 20.5, { align: "center" });
        doc.text(k[2], x + kw / 2, y + 24.5, { align: "center" });
      });
      y += 37;

      /* ===== Lo más destacado ===== */
      var destacados = [];
      if (R.satisfaccion.length) {
        var mejor = R.satisfaccion[0], peor = R.satisfaccion[R.satisfaccion.length - 1];
        destacados.push("Servicio mejor calificado: " + mejor.et + " (" + decimal(mejor.prom) + " de 5).");
        if (R.satisfaccion.length > 1) destacados.push("Servicio con la nota más baja: " + peor.et + " (" + decimal(peor.prom) + " de 5).");
      }
      if (R.aspectos.length) destacados.push("Aspecto mejor valorado de ADEP: " + R.aspectos[0].et + " (" + decimal(R.aspectos[0].prom) + " de 5).");
      if (R.servicios.length) destacados.push("Servicio más usado: " + R.servicios[0].et + " (" + pct(R.servicios[0].n, R.N) + "% de las personas).");
      if (R.canales.length) destacados.push("Canal de comunicación más usado: " + R.canales[0].et + " (" + pct(R.canales[0].n, R.N) + "%).");
      if (R.redes.length) destacados.push("Red social más usada: " + R.redes[0].et + " (" + pct(R.redes[0].n, R.N) + "%).");
      var hDest = 12 + destacados.length * 6.3;
      color([253, 248, 230]); color([238, 222, 160], "linea"); doc.setLineWidth(0.3); doc.roundedRect(M, y, ANCHO, hDest, 3, 3, "FD");
      color(ORO); doc.roundedRect(M, y, 2, hDest, 1, 1, "F");
      fuente("bold", 11, [120, 90, 10]); doc.text("Lo más destacado", M + 6, y + 7);
      destacados.forEach(function (t, i) {
        color(ORO); doc.circle(M + 8, y + 12.2 + i * 6.3, 0.9, "F");
        fuente("normal", 9.5, TINTA); doc.text(t, M + 11, y + 13.2 + i * 6.3);
      });
      y += hDest + 5;
      fuente("italic", 7.8, SUAVE);
      doc.text("Cómo leer este informe: los porcentajes son sobre el total de personas que respondieron. En las calificaciones, 1 es «muy malo» y 5 es «excelente».", M, y, { maxWidth: ANCHO });
      y += 9;

      /* ===== Quiénes respondieron ===== */
      var half = (ANCHO - 5) / 2;
      tituloSeccion("¿Quiénes respondieron?", SECCION.participacion, 66);
      var topEdad = mayor(R.edad), topAnt = mayor(R.antiguedad);
      dona(M, y, half, "Edad", R.edad, COLORES.edad,
        topEdad ? "La mayoría (" + pct(topEdad.n, R.N) + "%) tiene " + topEdad.et.replace("75 o más", "75 años o más") + "." : "");
      dona(M + half + 5, y, half, "Años de pertenecer a la ADEP", R.antiguedad, COLORES.antiguedad,
        topAnt ? "La mayoría (" + pct(topAnt.n, R.N) + "%) lleva " + topAnt.et.toLowerCase() + " en la ADEP." : "");
      y += 67;
      barras("Respuestas por provincia", "Cantidad de personas por provincia", R.provincias, SECCION.participacion, "conteo",
        R.provincias.length ? "La provincia con más respuestas es " + mayor(R.provincias).et + "." : "");

      /* ===== Servicios ===== */
      tituloSeccion("Servicios de ADEP", SECCION.servicios, 30 + R.servicios.length * 7.4);
      barras("Servicios que han utilizado", "Porcentaje de personas que usaron cada servicio (podían marcar varios)", R.servicios, SECCION.servicios, "conteo",
        R.servicios.length ? R.servicios[0].et + " es el servicio que más personas han utilizado." : "");
      barras("¿Qué tan satisfechas están con cada servicio?", "Nota promedio de 1 a 5, de la mejor a la más baja", R.satisfaccion, SECCION.servicios, "nota",
        R.satisfaccion.length ? "La nota más alta la tiene " + R.satisfaccion[0].et + " (" + decimal(R.satisfaccion[0].prom) + ")." : "");

      /* ===== Experiencia ===== */
      tituloSeccion("Experiencia con la ADEP", SECCION.experiencia, 30 + R.aspectos.length * 8.5);
      barras("Calificación de aspectos de ADEP", "Nota promedio de 1 a 5, de la mejor a la más baja", R.aspectos, SECCION.experiencia, "nota",
        R.aspectos.length > 1 ? "Lo mejor valorado: " + R.aspectos[0].et + ". Por mejorar: " + R.aspectos[R.aspectos.length - 1].et + "." : "");
      espacio(66);
      dona(M, y, half, "¿ADEP mejora su bienestar y calidad de vida?", R.bienestar, COLORES.bienestar,
        "Para " + deCada10(R.mucho, R.N) + " de cada 10 personas, ADEP mejora mucho su bienestar.");
      dona(M + half + 5, y, half, "¿Recomendaría la ADEP a otras personas?", R.recomienda, COLORES.recomienda,
        deCada10(R.reco, R.N) + " de cada 10 personas recomendarían la ADEP.");
      y += 67;

      /* ===== Comunicación ===== */
      tituloSeccion("Comunicación", SECCION.comunicacion, 55);
      barrasDoble(
        ["Canales más usados", "Porcentaje de personas (varias opciones)", R.canales, SECCION.comunicacion, "conteo",
          R.canales.length ? "El canal preferido es " + R.canales[0].et + "." : ""],
        ["Redes sociales más usadas", "Porcentaje de personas (varias opciones)", R.redes, SECCION.comunicacion, "conteo",
          R.redes.length ? "La red más usada es " + R.redes[0].et + "." : ""]);

      /* ===== Cierre ===== */
      espacio(22);
      fuente("italic", 8, SUAVE);
      doc.text("Los comentarios escritos de cada persona vienen en el PDF individual de su respuesta.", W / 2, y + 2, { align: "center" });
      y += 7;
      color(OSCURO); doc.roundedRect(M + 25, y, ANCHO - 50, 13, 6.5, 6.5, "F");
      color(ROJO); doc.circle(M + 33, y + 6.5, 1.5, "F"); doc.circle(W - M - 33, y + 6.5, 1.5, "F");
      fuente("bold", 12.5, BLANCO); doc.text("Orgullosos de ser personas solidarias", W / 2, y + 8.4, { align: "center" });

      return terminar(doc, R, W, H, M);
    });
  }

  function terminar(doc, R, W, H, M) {
    var total = doc.getNumberOfPages();
    for (var i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setDrawColor(LINEA[0], LINEA[1], LINEA[2]); doc.setLineWidth(0.3); doc.line(M, H - 13, W - M, H - 13);
      doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.setTextColor(VERDE[0], VERDE[1], VERDE[2]);
      doc.text("COMPRENSIÓN · FRATERNIDAD · COOPERACIÓN", M, H - 8.5, { charSpace: 0.3 });
      doc.setFont("helvetica", "normal"); doc.setTextColor(SUAVE[0], SUAVE[1], SUAVE[2]);
      doc.text("Página " + i + " de " + total, W - M, H - 8.5, { align: "right" });
    }
    return doc.output("blob");
  }

  window.ADEP_INFORME = { resumen: resumen, crear: crear };
})();
