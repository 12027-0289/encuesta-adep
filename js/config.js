/*
 * Configuración de la encuesta ADEP.
 * Edite este archivo para cambiar textos, opciones o el destino de las respuestas.
 */
window.ADEP_CONFIG = {
  // URL de la aplicación web de Google Apps Script (ver google-apps-script/Code.gs).
  // Si se deja vacío, las respuestas se guardan solo en este navegador (modo demostración).
  endpoint: "",

  // Pregunta 1: filiales y núcleos agrupados por provincia (según las fichas de adepcr.org).
  // Agregue o quite nombres aquí; la opción "Otra" siempre aparece al final.
  filiales: {
    "San José": [
      "Filial Aserrí",
      "Filial Coronado",
      "Filial Curridabat",
      "Filial Desamparados",
      "Filial Escazú",
      "Filial Goicoechea",
      "Filial Moravia",
      "Filial Pérez Zeledón",
      "Filial San Francisco",
      "Filial Santa Ana",
    ],
    "Alajuela": [
      "Filial Alajuela",
      "Filial Orotina – San Mateo",
      "Filial San Ramón",
      "Núcleo Alfaro Ruiz",
      "Núcleo Poás",
    ],
    "Heredia": [
      "Filial Heredia",
      "Filial San Pablo",
      "Filial San Rafael",
      "Núcleo Belén (Flores)",
    ],
    "Cartago": [
      "Filial Cartago",
      "Núcleo La Suiza (Turrialba)",
    ],
    "Guanacaste": [
      "Filial Cañas",
    ],
    "Puntarenas": [
      "Núcleo Miramar (Montes de Oro)",
    ],
    "Limón": [
      "Núcleo Batán (Matina)",
      "Núcleo Sarapiquí (Pococí)",
    ],
  },

  // Opciones de la pregunta 4 y filas de la pregunta 5.
  servicios: [
    "Revista ECOS",
    "Cursos y talleres",
    "Actividades recreativas y culturales",
    "Excursiones y turismo",
    "Asesoría legal",
    "Asesoría en pensiones",
    "Convenios y descuentos comerciales",
    "Servicios de salud y bienestar",
    "Ayudas solidarias / subsidios",
  ],

  // Filas de la pregunta 7.
  aspectos: [
    "Atención del personal",
    "Calidad de los servicios",
    "Comunicación e información",
    "Tiempo de respuesta",
    "Instalaciones",
    "Defensa de los derechos de las personas pensionadas",
  ],
};
