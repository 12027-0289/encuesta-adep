/*
 * Configuración de la encuesta ADEP.
 * Edite este archivo para cambiar textos, opciones o el destino de las respuestas.
 */
window.ADEP_CONFIG = {
  // URL de la aplicación web de Google Apps Script (ver google-apps-script/Code.gs).
  // Si se deja vacío, las respuestas se guardan solo en este navegador (modo demostración).
  endpoint: "https://script.google.com/macros/s/AKfycbzYgklW4Vy3jI-LWvS7mqh1js6-tWWs-rWgeQd7jfEsI4UDWX-EsU6vTSDDx0TyiFU3/exec",

  // Solo se usa mientras "endpoint" esté vacío: correos que reciben cada respuesta por FormSubmit.co.
  // Cuando se conecta la hoja de Google, los correos se configuran en Google (propiedad CORREOS)
  // y el correo sale desde la cuenta de ADEP con los dos PDF.
  correos: ["abigail.av2006@gmail.com"],

  // Texto que se mezcla con la cédula antes de cifrarla (SHA-256). Cámbielo una sola vez
  // antes de publicar la encuesta y no lo vuelva a cambiar, o no se detectarán repetidos.
  sal: "ADEP-encuesta-servicio-2026",

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

  // Opciones de la pregunta 4 y filas de la pregunta 5 (del formulario oficial).
  // La pregunta 4 agrega al final la opción "Ninguno" (ver "ninguno" abajo).
  servicios: [
    "Subsidios",
    "Préstamo de Equipo Ortopédico",
    "Clínica Dental",
    "Convenios Comerciales",
    "Centro de Recreo",
    "Actividades Sociales y Recreativas",
    "Asesoría y Orientación en Materia de Pensiones",
    "Revista ECOS de ADEP",
  ],
  // Opción de la pregunta 4 que excluye a las demás (la pregunta 5 igual pide calificar todos).
  ninguno: "Ninguno",

  // Filas de la pregunta 7 (del formulario oficial).
  aspectos: [
    "Atención a la persona afiliada",
    "Canales de Comunicación",
    "Organización de Actividades",
    "Infraestructura de Casas Filiales y Núcleos",
    "Gestión Administrativa",
  ],
};
