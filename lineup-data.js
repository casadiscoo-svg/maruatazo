/* ==========================================================================
   MARUATAZO XII — LINE UP · timetable DATA (content only)
   Layout/styling live in cinema.css; rendering lives in cinema.js (renderLineup).
   To publish the real programme, fill `acts` below and set status:'confirmed'. Nothing else needs to change.

   act = {
     name:  'Nombre del artista',   // required
     day:   'vie',                  // one of days[].id  (unknown/empty -> grouped under "Por confirmar")
     start: '21:00',                // 24 h "HH:MM" (optional)
     end:   '22:30',                // optional
     stage: 'principal',            // optional: one of stages[].id
     order: 1                       // optional display order inside the day (otherwise by start time, then list order)
   }
   Until `acts` has entries the page keeps showing the provisional placeholders, clearly marked "por confirmar".
   ========================================================================== */
window.MARUATAZO_LINEUP = {
  status: 'unconfirmed',                    // 'unconfirmed' | 'confirmed'  (confirmed hides the "por confirmar" notice)
  notice: 'PROVISIONAL · Los nombres de abajo son marcadores de posición, no artistas confirmados.',
  days: [                                   // event dates are confirmed: viernes 13 a lunes 16 de noviembre de 2026
    { id: 'vie', label: 'Viernes 13', date: '2026-11-13' },
    { id: 'sab', label: 'Sábado 14',  date: '2026-11-14' },
    { id: 'dom', label: 'Domingo 15', date: '2026-11-15' },
    { id: 'lun', label: 'Lunes 16',   date: '2026-11-16' }
  ],
  stages: [],                               // e.g. { id: 'principal', label: 'Escenario principal' }
  acts: []                                  // <- tomorrow's real timetable goes here
};
