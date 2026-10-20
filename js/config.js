/*
 * Configuración de la encuesta ADEP.
 * Edite este archivo para cambiar textos, opciones o el destino de las respuestas.
 */
window.ADEP_CONFIG = {
  // URL de la aplicación web de Google Apps Script (ver google-apps-script/Code.gs).
  // Si se deja vacío, las respuestas se guardan solo en este navegador (modo demostración).
  endpoint: "",

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
