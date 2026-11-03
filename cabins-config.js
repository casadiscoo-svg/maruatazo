/* ============================================================
   MARUATAZO XII — CONFIGURACIÓN DE CABAÑAS (único archivo a editar)
   Este archivo se publica con el sitio: los cambios llegan a todos
   los visitantes al hacer deploy. No hay inventario en tiempo real.
   ============================================================ */
window.MARUATAZO_CABINS = {

  /* WhatsApp del organizador — solo dígitos, con código de país (52 = México). */
  whatsapp: '525541946406',
  eventName: 'Maruatazo XII',

  /* FECHAS CONFIRMADAS: viernes 13 a lunes 16 de noviembre de 2026 (4 días, 3 noches).
     No hay horarios confirmados de llegada, salida ni de programación: no se inventan aquí. */
  event: {
    dates: 'viernes 13 a lunes 16 de noviembre de 2026',
    datesShort: '13–16 NOVIEMBRE 2026',
    short: '13–16 de noviembre de 2026',
    year: 2026
  },

  /* Imagen del mapa. Los marcadores usan coordenadas NORMALIZADAS (0 a 1)
     relativas a esta imagen: x = 0 borde izquierdo, 1 borde derecho;
     y = 0 borde superior, 1 borde inferior. */
  map: {
    /* Versión web ligera (JPEG q84, mismas dimensiones 1672×941, así las coordenadas 0–1 no cambian). El original sin tocar es assets/Tropical Bay Coastal Map.png. */
    image: 'assets/Tropical-Bay-Coastal-Map-web.jpg',
    width: 1672,
    height: 941,
    alt: 'Vista aérea ilustrada de la bahía y la costa de Maruata, Michoacán'
  },

  /* PRECIOS OFICIALES 2026 — MXN por persona. Cada precio cubre 3 noches de hospedaje
     y acceso al evento los 3 días. NO se menciona desayuno ni baño privado (sin confirmar). */
  package: {
    nights: 3,
    includes: ['3 noches de hospedaje', 'Acceso al evento los 3 días']
  },
  recommendation: 'Recomendamos armar tu grupito para compartir cabaña.',
  defaultMaxGuests: 12, // tope de personas en el selector cuando la opción no tiene capacidad definida

  /* Tipos de alojamiento. `status` es opcional (por defecto 'unconfirmed').
     kind: 'camping' (sin ubicación en el mapa) o 'cabin'. */
  accommodations: [
    { key: 'camping',   kind: 'camping', name: 'Camping',                      pricePerPerson: 2000 },
    { key: 'shared',    kind: 'cabin',   name: 'Cabaña con baño compartido',   pricePerPerson: 2800 },
    { key: 'cabin-6',   kind: 'cabin',   name: 'Cabaña para 6 personas',       capacity: 6,        pricePerPerson: 3200 },
    { key: 'cabin-4-5', kind: 'cabin',   name: 'Cabaña para 4 o 5 personas',   capacities: [4, 5], pricePerPerson: 3400 }
  ],

  /* Estados: 'available' | 'pending' | 'occupied' | 'unconfirmed' (por defecto). */

  /* CABAÑAS REALES — vacío hasta que el organizador entregue datos verificados.
     No hay cabañas ni ubicaciones inventadas. Para agregar una, copia este registro:

     {
       id: '04',                 // identificador real de la cabaña
       name: 'Cabaña 04',        // opcional; por defecto "Cabaña <id>"
       type: 'cabin-4-5',        // clave de `accommodations` (define el precio)
       capacity: 4,              // personas de esta cabaña
       status: 'available',      // available | pending | occupied | unconfirmed
       x: 0.52, y: 0.40,         // posición normalizada; déjalas en null si no está ubicada
       photo: 'assets/cabana-04.jpg', // opcional
       note: ''                  // opcional
     }

     Para colocar cabañas visualmente: abre mapa2d.html?editar=1 (ver README.txt) y exporta; después
     `node tools/apply-cabins.js maruatazo-cabins-export.json` (vista previa) y `--write` para publicarlo aquí. */
  /* CABINS:BEGIN — este bloque lo reescribe tools/apply-cabins.js; también puedes editarlo a mano */
  cabins: [],
  /* CABINS:END */

  /* Mientras `cabins` esté vacío, el mapa lista los tipos de `accommodations`
     como consulta general (sin ubicación, estado "por confirmar"). Las categorías siempre se listan; si agregas
     cabañas reales, aparecen después de las categorías. */
};
