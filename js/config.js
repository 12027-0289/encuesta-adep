/*
 * Configuración de la encuesta ADEP.
 * Edite este archivo para cambiar textos, opciones o el destino de las respuestas.
 */
window.ADEP_CONFIG = {
  // URL de la aplicación web de Google Apps Script (ver google-apps-script/Code.gs).
  // Si se deja vacío, las respuestas se guardan solo en este navegador (modo demostración).
  endpoint: "",

  // Pregunta 1: filiales y núcleos agrupados por provincia
  // (según la integración de juntas directivas de filiales y núcleos 2023-2026).
  // Agregue o quite nombres aquí; la opción "Otra" siempre aparece al final.
  filiales: {
    "San José": [
      "Aserrí",
      "Coronado",
      "Curridabat",
      "Desamparados",
      "Escazú",
      "Goicoechea",
      "Hatillo",
      "La Uruca",
      "Los Santos",
      "Montes de Oca",
      "Mora",
      "Moravia",
      "Pavas",
      "Pérez Zeledón",
      "Puriscal",
      "San Francisco de Dos Ríos",
      "San José",
      "Santa Ana",
      "Tibás",
      "Zapote",
    ],
    "Alajuela": [
      "Alajuela",
      "Alfaro Ruiz – Zarcero",
      "Atenas",
      "Grecia",
      "Naranjo",
      "Orotina – San Mateo",
      "Palmares",
      "Poás",
      "San Carlos",
      "San Ramón",
      "Upala",
      "Valverde Vega – Sarchí",
    ],
    "Cartago": [
      "Cartago",
      "La Suiza",
      "La Unión",
      "Paraíso",
      "Tejar del Guarco",
      "Turrialba",
    ],
    "Heredia": [
      "Barva",
      "Flores",
      "Heredia",
      "San Antonio de Belén",
      "San Isidro de Heredia",
      "San Pablo de Heredia",
      "San Rafael de Heredia",
      "Santa Bárbara de Heredia",
      "Santo Domingo de Heredia",
      "Sarapiquí",
    ],
    "Guanacaste": [
      "Bagaces",
      "Cañas",
      "Carrillo",
      "Juntas de Abangares",
      "La Cruz",
      "Liberia",
      "Nandayure",
      "Nicoya",
      "Santa Bárbara (Guanacaste)",
      "Santa Cruz",
      "Sardinal – Carrillo",
      "Tilarán",
    ],
    "Puntarenas": [
      "Buenos Aires",
      "Cóbano – Paquera",
      "El Roble",
      "Esparza",
      "Jicaral",
      "Montes de Oro – Miramar",
      "Osa (Palmar Norte – Sur)",
      "Puntarenas",
      "Quepos",
      "San Vito",
      "Sur Sur",
    ],
    "Limón": [
      "Batán",
      "Limón",
      "Pococí",
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
