/* AIA-HERO-V1-EXPORT 2026-08-22
   Cresta AI Agent page — hero (industry switcher + chat/call demo + scroll morph).
   Upload to: https://website-assets.cresta.com/ai-agent/hero/aia-hero.js
   Cache-Control: public, max-age=31536000, immutable — bump the filename (aia-hero.v2.js) on changes.

   Scroll-morph rewrite vs. the source design: the rounded-card -> full-bleed grow now animates
   ONLY transform + opacity (translateX/scale on .aia-stage, an exact inverse scale on .aia-track
   so the content inside never distorts). This is the fix Nathan's AA tickets (MAR-188/213/218)
   landed after tracing the AA hero's Safari coil-whine/jank to width/left/gap/border-radius being
   written every scroll frame. border-radius here is a two-state CSS-transitioned toggle instead of
   a continuous write — see README "Morph physics" for the exact trade-off (radius scales slightly
   with the transform instead of unwinding to a perfect square at full bleed).

   The industry-icon background is a pre-rendered gradient loop, one 1080x1080 mp4 per industry
   (see OrbVideo inside initHero) — the source design mounted a live React + esm.sh Paper Shaders
   MeshGradient, a runtime dependency this export cannot ship; the hand-rolled canvas repaint of
   it has in turn given way to ~2.5MB clips that cost zero per-frame raster, with a poster still
   standing in from first paint until the loop is in.

   Every animated panel (chat streaming, call timer, industry-swap ghost, the call/chat clip-morph)
   computes its visual state from elapsed wall-clock time each tick rather than a chain of
   setTimeouts, so nothing can desync if a tab is backgrounded mid-animation. */
(function () {
  'use strict';

  var ASSET_BASE = 'https://website-assets.cresta.com/ai-agent/hero/';
  /* WEBFLOW: replace ASSET_BASE above with the real uploaded prefix. Everything under it —
     persona-videos/*.{mp4,jpg} (18 clips + 18 posters) and gradient-videos/*.{mp4,jpg} —
     needs uploading first. Full list in README.md. */

  /* ---------------- i18n ----------------
     One file serves every locale. LOCALE resolves from the ?aia-lang= review hook, else
     <html lang> (Webflow sets lang="es" server-side on /es), else English. Only display
     strings are translated: card.industry / card.title / persona.who stay English because
     they double as routing slugs (agent auth via verticalKey, gradient video URLs, the
     ?industry= deep link). Renderers read the translated variant first and fall back to
     the English original, so the en path renders byte-identical to the pre-i18n build. */
  var SUPPORTED_LOCALES = ['es'];
  var LOCALE = (function () {
    var q = null;
    try { q = new URLSearchParams(location.search).get('aia-lang'); } catch (e) {}
    var l = String(q || document.documentElement.lang || 'en').toLowerCase().split('-')[0];
    return SUPPORTED_LOCALES.indexOf(l) >= 0 ? l : 'en';
  })();
  var I18N = {
    en: {
      ui: {
        stageAriaLabel: 'AI Agent by industry',
        stageHeader: 'Try an AI Agent by selecting voice or chat',
        tryAsking: 'Try asking',
        about: 'About',
        learnMore: 'Learn more',
        pickYourCharacter: 'Pick your<br>character',
        chatPlaceholder: 'Ask the agent anything',
        callLabel: 'Call AI Agent',
        chatLabel: 'Chat with AI Agent',
        ariaCloseChat: 'Close chat',
        ariaSend: 'Send message',
        ariaCall: 'Call',
        ariaConnecting: 'Connecting, tap to cancel',
        ariaEndCall: 'End call',
        ariaChat: 'Chat',
        ariaPersonas: 'Customer',
        liveNotice: 'Sorry - the live agent isn\'t available right now. Please try again in a moment.',
        agentNamePattern: '{title} Agent',
        renewsPattern: 'Renews {monthYear}',
        shellEyebrow: 'AI Agent',
        shellTitle: 'AI Agents that customers love and businesses trust',
        shellLead: 'Cresta AI Agent powers always-on, personalized experiences that connect every interaction into a seamless customer journey. Resolve customer needs faster and drive efficient growth with AI that delivers consistent, controlled performance at scale.',
        shellCta: 'Book a Demo'
      }
    },
    es: {
      ui: {
        stageAriaLabel: 'Agente de IA por sector',
        stageHeader: 'Escuche y vea un Agente de IA en acción',
        tryAsking: 'Pruebe a preguntar',
        about: 'Acerca de',
        learnMore: 'Más información',
        pickYourCharacter: 'Elija su<br>personaje',
        chatPlaceholder: 'Pregúntele lo que quiera al agente',
        callLabel: 'Llamar al Agente de IA',
        chatLabel: 'Chatear con el Agente',
        ariaCloseChat: 'Cerrar chat',
        ariaSend: 'Enviar mensaje',
        ariaCall: 'Llamar',
        ariaConnecting: 'Conectando, toque para cancelar',
        ariaEndCall: 'Finalizar llamada',
        ariaChat: 'Chat',
        ariaPersonas: 'Cliente',
        liveNotice: 'Lo sentimos: el agente en directo no está disponible ahora mismo. Inténtelo de nuevo en unos instantes.',
        agentNamePattern: 'Agente de {title}',
        renewsPattern: 'Se renueva en {monthYear}',
        shellEyebrow: 'AI Agent',
        shellTitle: 'Agentes de IA que los clientes adoran y en los que las empresas confían',
        shellLead: 'Cresta AI Agent impulsa experiencias personalizadas y siempre activas que conectan cada interacción en un recorrido de cliente fluido. Resuelva las necesidades de sus clientes más rápido e impulse un crecimiento eficiente con una IA que ofrece un rendimiento uniforme y controlado a escala.',
        shellCta: 'Solicitar una demo'
      },
      months: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
      fieldKeys: {
        'Rate type': 'Tipo de tarifa',
        'Room type': 'Tipo de habitación',
        'Dates': 'Fechas',
        'Confirmation': 'Confirmación',
        'Booked via': 'Canal de reserva',
        'DOB': 'Fecha de nacimiento',
        'Last 4 SSN': 'Últimos 4 del SSN',
        'Provider name': 'Proveedor',
        'Claim info': 'Información de la reclamación',
        'Plan': 'Plan',
        'Insurer': 'Aseguradora',
        'Phone': 'Teléfono',
        'Member ID': 'ID de miembro',
        'Accounts': 'Cuentas',
        'Phone number': 'Número de teléfono',
        'CC last 4': 'Últimos 4 de la tarjeta',
        'Quote type': 'Tipo de cotización',
        'Status': 'Estado',
        'Address': 'Dirección',
        'Zip code': 'Código postal',
        'Missing info': 'Información pendiente',
        'Vehicle': 'Vehículo',
        'Appointment': 'Cita',
        'Contract status': 'Estado del contrato',
        'Quote': 'Cotización',
        'Account': 'Cuenta'
      },
      fieldVals: {
        'Flexible rate': 'Tarifa flexible',
        'Family': 'Familiar',
        'Website': 'Sitio web',
        'Third party': 'Terceros',
        'February 6, 1997': '6 de febrero de 1997',
        'August 30, 1970': '30 de agosto de 1970',
        'January 18, 1982': '18 de enero de 1982',
        'March 14, 2000': '14 de marzo de 2000',
        'June 3, 1986': '3 de junio de 1986',
        'September 22, 1961': '22 de septiembre de 1961',
        'March 15, 1985': '15 de marzo de 1985',
        'July 22, 1978': '22 de julio de 1978',
        'May 9, 1990': '9 de mayo de 1990',
        'Dental PPO': 'PPO dental',
        'Checking, Savings, Auto loan': 'Corriente, Ahorros, Préstamo de coche',
        'Quote in progress': 'Cotización en curso',
        'Home': 'Hogar',
        'Auto': 'Coche',
        'Bundle': 'Paquete',
        'Active': 'Activo',
        'Roof age, Prior claims': 'Antigüedad del tejado, Reclamaciones previas',
        'Platinum member': 'Miembro Platinum',
        'Non-member': 'No miembro',
        'Current customer': 'Cliente actual'
      },
      cards: {
        'Hospitality': {
          industry: 'Hostelería',
          body: 'Los huéspedes amplían estancias, cambian fechas y resuelven dudas de fidelización.',
          personas: {
            'Sarah Chen': {
              scenario: 'Una miembro Platinum que quiere ampliar su estancia.',
              phrases: ['“¿Puedo añadir una noche a mi reserva?”', '“¿Cuál es la política de cancelación si cambian mis planes?”', '“¿Qué ventajas Platinum se aplican a mi estancia?”']
            },
            'James Grant': {
              scenario: 'Un huésped que necesita cambiar sus fechas.',
              phrases: ['“¿Puede ayudarme a posponer mi reserva una semana?”', '“¿Hay una nueva tarifa para estas fechas?”', '“¿Qué otros servicios y paquetes hay disponibles?”']
            },
            'Mike Torres': {
              scenario: 'Un huésped con una reserva de terceros que intenta hacer cambios.',
              phrases: ['“¿A qué hora es el check-in? ¿Hay aparcamiento en el hotel?”', '“¿Se admiten mascotas?”', '“Reservé a través de un tercero: ¿puede ayudarme a cambiar la fecha de check-in?”']
            }
          }
        },
        'Healthcare': {
          industry: 'Sanidad',
          body: 'Los miembros consultan reclamaciones, autorizaciones previas y recetas.',
          personas: {
            'Lee Johnson': {
              scenario: 'Un miembro PPO que espera la revisión de una reclamación.',
              phrases: ['“¿Cuál es el estado de mi reclamación de Mountain View Radiology?”', '“¿Está lista mi receta de Humalog para recogerla?”', '“¿Necesito autorización previa para renovar mi receta?”']
            },
            'Randy Michael': {
              scenario: 'Un miembro que espera la autorización previa para Nurtec, un medicamento para la migraña.',
              phrases: ['“¿Cuál es el estado de mi receta de Nurtec? ¿Cuándo estará lista mi autorización previa para Nurtec?”', '“¿Cuánto me falta para alcanzar mi máximo de gasto de bolsillo? ¿Qué pasa cuando lo alcanzo?”', '“¿Cuál es el estado de la reclamación de mi visita a urgencias?”']
            },
            'Julia Warren': {
              scenario: 'Una miembro que disputa una reclamación denegada y espera una autorización previa.',
              phrases: ['“¿Por qué se denegó mi reclamación?”', '“¿Qué puedo hacer con mi reclamación denegada?”', '“¿Cuándo se aprobará la autorización previa de mi inhalador Symbicort?”']
            }
          }
        },
        'Retail Health': {
          industry: 'Salud minorista',
          body: 'Los pacientes reservan visitas, consultan su cobertura y planifican los costes de tratamiento.',
          personas: {
            'Sarah Smith': {
              scenario: 'Una paciente nueva que programa su primera limpieza con un dentista de la red.',
              phrases: ['“Me gustaría reservar mi limpieza semestral. ¿Puede ayudarme?”', '“Acabo de mudarme aquí y aún no tengo mi tarjeta del seguro… ¿puedo reservar una cita igualmente?”', '“¿Está cubierto el blanqueamiento dental o lo pagaría de mi bolsillo?”']
            },
            'Marcus Okafor': {
              scenario: 'Un paciente habitual que llama por sensibilidad al frío para saber si es grave.',
              phrases: ['“Tengo sensibilidad al frío en la parte superior izquierda. ¿Es una urgencia?”', '“¿Cuánto pagaría realmente por una revisión fuera de la red?”', '“¿Y si es algo grave, como una endodoncia? ¿Cuánto pagaría de mi bolsillo?”']
            },
            'Priya Nair': {
              scenario: 'Una paciente nueva que valora un implante dental tras la jubilación de su dentista de siempre.',
              phrases: ['“Me extrajeron una muela hace 18 meses. ¿Sigo siendo buena candidata para un implante y cuánto dura el proceso?”', '“¿Cubre mi plan Medicare Advantage alguna parte de un implante dental?”', '“¿Ofrecen planes de pago u opciones de financiación?”']
            }
          }
        },
        'Financial Services': {
          industry: 'Servicios financieros',
          body: 'Los clientes disputan cargos, aumentan límites y desbloquean tarjetas.',
          personas: {
            'Alice Anderson': {
              scenario: 'Una clienta actual con varias cuentas que acaba de señalar un cargo desconocido.',
              phrases: ['“Me interesa una nueva tarjeta de crédito. ¿Qué opciones tienen?”', '“¿Cuánto hay en mi cuenta de ahorros?”', '“¿Cuáles son mis movimientos recientes?”']
            },
            'Bob Baker': {
              scenario: 'Un cliente con cuenta corriente y tarjeta de crédito que revisa sus movimientos recientes.',
              phrases: ['“¿Cuáles son mis movimientos más recientes?”', '“¿Cuál es el saldo de mi extracto?”', '“Me gustaría abrir una nueva cuenta de ahorros, ¿qué tipos de interés ofrecen actualmente?”']
            },
            'Carol Carter': {
              scenario: 'Una clienta con la tarjeta de crédito en mora.',
              phrases: ['“Creo que tengo un pago atrasado, ¿puede ayudarme?”', '“¿Qué funciones tiene CrestaPay?”', '“He perdido mi tarjeta, ¿qué tengo que hacer?”']
            }
          }
        },
        'Insurance': {
          industry: 'Seguros',
          body: 'Los asegurados presentan reclamaciones, añaden conductores y cotizan nuevas coberturas.',
          personas: {
            'Alex Carter': {
              scenario: 'Un propietario que termina una cotización empezada online.',
              phrases: ['“Empecé una cotización online pero me atascué. ¿Puede ayudarme a terminarla?”', '“¿Qué opciones de cobertura recomiendan para alguien de mi zona?”', '“¿Qué descuentos puedo obtener al añadir mi coche a la póliza?”']
            },
            'Jamie Rivera': {
              scenario: 'Un conductor de California que solicita una cotización de seguro de coche premium.',
              phrases: ['“¿Qué incluye la cobertura de coche premium?”', '“¿Qué opciones de deducible tengo?”', '“¿Cómo afecta una reclamación a mi prima si no tengo la culpa?”']
            },
            'Morgan Lee': {
              scenario: 'Un propietario de Oregón que combina pólizas de hogar y coche.',
              phrases: ['“¿Cuánto ahorro al combinar pólizas en comparación con pólizas separadas?”', '“¿Cubre la póliza estándar de hogar los daños por agua de una tubería rota?”', '“¿Cómo traslado mis pólizas actuales a Cresta Line Insurance?”']
            }
          }
        },
        'Home Services': {
          industry: 'Servicios del hogar',
          body: 'Los clientes cambian citas de servicio, pagan saldos y gestionan sus contratos.',
          personas: {
            'John Smith': {
              scenario: 'Un propietario cuyo contrato se renueva el mes que viene.',
              phrases: ['“¿Puede ayudarme a reprogramar mi próxima cita?”', '“¿Cuándo es el próximo cargo programado a mi cuenta?”', '“¿Puede ayudarme a pagar mi saldo?”']
            },
            'Michael Brown': {
              scenario: 'Un cliente con pagos atrasados que quiere hacer un pago parcial.',
              phrases: ['“¿Cuál es mi saldo actual?”', '“Esta factura fue más alta de lo normal, ¿puede explicármelo?”', '“Me gustaría pagar $100 de mi factura, ¿puedo hacerlo con la tarjeta registrada?”']
            },
            'Sarah Johnston': {
              scenario: 'Una clienta con pagos atrasados que quiere reprogramar una cita.',
              phrases: ['“¿Corro riesgo de corte por mi saldo atrasado?”', '“¿Puede ayudarme a reprogramar mi próxima cita?”', '“¿Puede ayudarme a pagar mi saldo?”']
            }
          }
        }
      }
    }
  };
  function t(k) { var T = I18N[LOCALE]; return (T && T.ui && T.ui[k]) || I18N.en.ui[k]; }
  function localeHref(path) {
    if (!path || LOCALE === 'en') return path;
    if (path === '/') return '/' + LOCALE;
    return '/' + LOCALE + (path.charAt(0) === '/' ? path : '/' + path);
  }
  function renewsStr(monthYear) { return t('renewsPattern').replace('{monthYear}', monthYear); }

  var OUT_MS = 470, BACK_MS = 430, SHUFFLE_MS = 6000;
  var SPHERE = 44, CIRCLE = 188, ORB_SCALE_CHAT = SPHERE / CIRCLE;

  var ICONS = {
    bed: '<path d="M5 9a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path><path d="M22 17v-3h-20"></path><path d="M2 8v9"></path><path d="M12 14h10v-2a3 3 0 0 0 -3 -3h-7v5"></path>',
    scope: '<path d="M6 4h-1a2 2 0 0 0 -2 2v3.5a5.5 5.5 0 0 0 11 0v-3.5a2 2 0 0 0 -2 -2h-1"></path><path d="M8 15a6 6 0 1 0 12 0v-3"></path><path d="M11 3v2"></path><path d="M6 3v2"></path><path d="M18 10a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path>',
    pill: '<path d="M9 4a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v1a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -1"></path><path d="M10 6v.98c0 .877 -.634 1.626 -1.5 1.77c-.866 .144 -1.5 .893 -1.5 1.77v8.48a2 2 0 0 0 2 2h6a2 2 0 0 0 2 -2v-8.48c0 -.877 -.634 -1.626 -1.5 -1.77a1.795 1.795 0 0 1 -1.5 -1.77v-.98"></path><path d="M7 12h10"></path><path d="M7 18h10"></path><path d="M11 15h2"></path>',
    coin: '<path d="M3 8a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3l0 -8"></path><path d="M3 10l18 0"></path><path d="M7 15l.01 0"></path><path d="M11 15l2 0"></path>',
    heart: '<path d="M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2"></path><path d="M9 5a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2"></path><path d="M9 12h6"></path><path d="M9 16h6"></path>',
    bolt: '<path d="M3 12h1m8 -9v1m8 8h1m-15.4 -6.4l.7 .7m12.1 -.7l-.7 .7"></path><path d="M9 16a5 5 0 1 1 6 0a3.5 3.5 0 0 0 -1 3a2 2 0 0 1 -4 0a3.5 3.5 0 0 0 -1 -3"></path><path d="M9.7 17l4.6 0"></path>'
  };

  function v(name) { return { vid: ASSET_BASE + 'persona-videos/' + name + '.mp4', photo: null }; }
  function A(p) { return p ? ASSET_BASE + p : null; }

  // Hotels persona dates must match the live agent's RFB (hotel_hackathon/data.py),
  // which computes check-in = today(America/Los_Angeles) + daysOut and check-out =
  // check-in + nights at call time (Sarah/James 14/4, Mike 10/3). Anchor the calendar
  // to the same LA reference date so the card never disagrees with the agent (AID-2443).
  var HOTEL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var MONTHS = (I18N[LOCALE] && I18N[LOCALE].months) || HOTEL_MONTHS;
  function laToday(now) {
    var parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(now);
    var by = {};
    parts.forEach(function (p) { if (p.type !== 'literal') by[p.type] = p.value; });
    return new Date(Date.UTC(Number(by.year), Number(by.month) - 1, Number(by.day)));
  }
  function laPlus(now, n) {
    var d = new Date(laToday(now).getTime());
    d.setUTCDate(d.getUTCDate() + n);
    return d;
  }
  function fmtDay(d) {
    if (LOCALE === 'es') return d.getUTCDate() + ' de ' + MONTHS[d.getUTCMonth()] + ' de ' + d.getUTCFullYear();
    return MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate() + ', ' + d.getUTCFullYear();
  }
  function fmtStay(a, b) {
    if (a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth()) {
      if (LOCALE === 'es') return a.getUTCDate() + '\u2013' + b.getUTCDate() + ' de ' + MONTHS[a.getUTCMonth()] + ' de ' + a.getUTCFullYear();
      return MONTHS[a.getUTCMonth()] + ' ' + a.getUTCDate() + '\u2013' + b.getUTCDate() + ', ' + a.getUTCFullYear();
    }
    if (LOCALE === 'es') return a.getUTCDate() + ' de ' + MONTHS[a.getUTCMonth()] + ' \u2013 ' + b.getUTCDate() + ' de ' + MONTHS[b.getUTCMonth()] + ' de ' + b.getUTCFullYear();
    return fmtDay(a) + ' \u2013 ' + fmtDay(b);
  }
  var _heroNow = new Date();
  var _sarahIn = laPlus(_heroNow, 14), _sarahOut = laPlus(_heroNow, 18);
  var _jamesIn = laPlus(_heroNow, 14), _jamesOut = laPlus(_heroNow, 18);
  var _mikeIn = laPlus(_heroNow, 10), _mikeOut = laPlus(_heroNow, 13);

  // Utilities (Pure Lake Home Services) dates follow the live agent's RFB
  // (electric_utility/mock_data.py), which generates John Smith's appointment at
  // call time as the next Monday in America/Phoenix, strictly future (today is
  // Monday -> the following Monday); his contract renewal shows the next calendar
  // month so the card never reads stale. Ported from website-verticals-UI
  // app/lib/appointment-date.ts (AID-2495). Phoenix has no DST (UTC-7 year-round):
  // calendar parts are read via Intl and the arithmetic runs on a UTC Date, so the
  // strings hold regardless of the host browser's timezone.
  var UTIL_WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  function phoenixParts(now) {
    var parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Phoenix', weekday: 'short', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(now);
    var by = {};
    parts.forEach(function (p) { if (p.type !== 'literal') by[p.type] = p.value; });
    return { weekday: UTIL_WEEKDAYS.indexOf(by.weekday), year: Number(by.year), month: Number(by.month), day: Number(by.day) };
  }
  function nextMondayPhoenix(now) {
    var p = phoenixParts(now);
    var add = p.weekday === 1 ? 7 : (8 - p.weekday) % 7;
    var d = new Date(Date.UTC(p.year, p.month - 1, p.day));
    d.setUTCDate(d.getUTCDate() + add);
    return fmtDay(d);
  }
  function nextMonthPhoenix(now) {
    var p = phoenixParts(now);
    var m = p.month === 12 ? 0 : p.month, y = p.month === 12 ? p.year + 1 : p.year;
    return LOCALE === 'es' ? MONTHS[m] + ' de ' + y : MONTHS[m] + ' ' + y;
  }
  var _johnAppt = nextMondayPhoenix(_heroNow);
  var _johnRenews = nextMonthPhoenix(_heroNow);

  var CARDS = [
    { title: 'Windward Hotels', industry: 'Hospitality', href: '/travel-hospitality', icon: 'bed', body: 'Guests extend stays, move dates, and resolve loyalty questions.',
      colors: ['#F97A34', '#FFC85C', '#3E9C58'], distortion: 0.42, swirl: 0.26,
      personas: [
        { who: 'Sarah Chen', vid: ASSET_BASE + 'persona-videos/hotels-sarah-chen.mp4', tag: 'Platinum member',
          scenario: 'A Platinum member looking to extend her stay.',
          fields: [['Rate type', 'Flexible rate'], ['Room type', 'Family'], ['Dates', fmtStay(_sarahIn, _sarahOut)], ['Confirmation', '91047283']],
          phrases: ['\u201CCan I add a night to my reservation?\u201D', '\u201CWhat\u2019s the cancellation policy if my plans change?\u201D', '\u201CWhat Platinum perks apply to my stay?\u201D']
          },
        { who: 'James Grant', vid: ASSET_BASE + 'persona-videos/hotels-james-grant.mp4', tag: 'Non-member',
          scenario: 'A guest who needs to move his dates.',
          fields: [['Booked via', 'Website'], ['Dates', fmtStay(_jamesIn, _jamesOut)], ['Confirmation', '84729531']],
          phrases: ['\u201CCan you help me push my reservation out by a week?\u201D', '\u201CIs there a new rate for these dates?\u201D', '\u201CWhat other services and packages are available?\u201D']
          },
        { who: 'Mike Torres', vid: ASSET_BASE + 'persona-videos/hotels-mike-torres.mp4', tag: 'Non-member',
          scenario: 'A guest with a third-party booking trying to make changes.',
          fields: [['Booked via', 'Third party'], ['Dates', fmtStay(_mikeIn, _mikeOut)], ['Confirmation', '67301924']],
          phrases: ['\u201CWhat time is check-in? Is there parking on site?\u201D', '\u201CDo you allow pets?\u201D', '\u201CI booked through a third party \u2013 can you help me change my check-in date?\u201D']
          }
      ] },
    { title: 'Ocean Health Plan', industry: 'Healthcare', href: '/healthcare', icon: 'scope', body: 'Members track claims, prior authorizations, and prescriptions.',
      colors: ['#7B4BE6', '#F79BC8', '#7FC3F5'], distortion: 0.5, swirl: 0.2,
      personas: [
        { who: 'Lee Johnson', vid: ASSET_BASE + 'persona-videos/healthcare-lee-johnson.mp4', id: ['Member ID', '474718-4546'],
          scenario: 'A PPO member waiting for a claim to be reviewed.',
          fields: [['DOB', 'February 6, 1997'], ['Last 4 SSN', '7086'], ['Provider name', 'Mountain View Radiology'], ['Claim info', '5037-7710-02004']],
          phrases: ['\u201CWhat\u2019s the status of my claim from Mountain View Radiology?\u201D', '\u201CIs my Humalog prescription ready to pick up?\u201D', '\u201CDo I need prior authorization to refill my prescription?\u201D']
          },
        { who: 'Randy Michael', vid: ASSET_BASE + 'persona-videos/healthcare-randy-michael.mp4', id: ['Member ID', '125916-9803'],
          scenario: 'A member awaiting prior authorization for Nurtec migraine medication.',
          fields: [['DOB', 'August 30, 1970'], ['Last 4 SSN', '2428'], ['Provider name', 'QuickCare Urgent Clinic'], ['Claim info', '5041-0020-03002']],
          phrases: ['\u201CWhat\u2019s the status of my Nurtec prescription? When will my prior authorization for Nurtec be ready?\u201D', '\u201CHow close am I to my out-of-pocket maximum? What happens after I reach the maximum?\u201D', '\u201CWhat\u2019s the claim status for my urgent care visit?\u201D']
          },
        { who: 'Julia Warren', vid: ASSET_BASE + 'persona-videos/healthcare-julia-warren.mp4', id: ['Member ID', '410155-8518'],
          scenario: 'A member disputing a denied claim and awaiting prior authorization.',
          fields: [['DOB', 'January 18, 1982'], ['Last 4 SSN', '3841'], ['Provider name', 'Advanced Diagnostic Center'], ['Claim info', '5035-5510-01002']],
          phrases: ['\u201CWhy was my claim denied?\u201D', '\u201CWhat can I do about my denied claim?\u201D', '\u201CWhen will the prior authorization for my Symbicort inhaler be approved?\u201D']
          }
      ] },
    { title: 'Saltwater Dental', industry: 'Retail Health', href: '/healthcare', icon: 'pill', body: 'Patients book visits, ask about coverage, and plan treatment costs.',
      colors: ['#2059E3', '#7BD3F2', '#F0E7D6'], distortion: 0.46, swirl: 0.14,
      personas: [
        { who: 'Sarah Smith', vid: ASSET_BASE + 'persona-videos/retail-health-sarah-smith.mp4',
          scenario: 'A new patient scheduling her first cleaning at an in-network dentist.',
          fields: [['Plan', 'Dental PPO'], ['Insurer', 'BlueCare Dental'], ['DOB', 'March 14, 2000'], ['Phone', '415-823-9047']],
          phrases: ['\u201CI\u2019d like to book my 6-month cleaning. Can you help?\u201D', '\u201CI just moved here and don\u2019t have my insurance card yet\u2026can I still book an appointment?\u201D', '\u201CIs teeth whitening covered, or would it be out of pocket?\u201D']
          },
        { who: 'Marcus Okafor', vid: ASSET_BASE + 'persona-videos/retail-health-marcus-okafor.mp4',
          scenario: 'A returning patient calling about cold sensitivity to find out if it\u2019s serious.',
          fields: [['Plan', 'Dental PPO'], ['Insurer', 'Aetna PPO'], ['DOB', 'June 3, 1986'], ['Phone', '510-674-2918']],
          phrases: ['\u201CI have cold sensitivity on my upper left side. Is that an emergency?\u201D', '\u201CWhat would I actually pay for an out-of-network exam?\u201D', '\u201CWhat if it\u2019s something serious, like a root canal? How much would I pay out of pocket?\u201D']
          },
        { who: 'Priya Nair', vid: ASSET_BASE + 'persona-videos/retail-health-priya-nair.mp4',
          scenario: 'A new patient exploring a dental implant after her longtime dentist retired.',
          fields: [['Plan', 'Medicare Advantage'], ['Insurer', 'Medicare Advantage'], ['DOB', 'September 22, 1961'], ['Phone', '650-391-7284']],
          phrases: ['\u201CI had a molar extracted 18 months ago. Am I still a good candidate for an implant, and how long does the process take?\u201D', '\u201CDoes my Medicare Advantage plan cover any part of a dental implant?\u201D', '\u201CDo you offer payment plans or financing options?\u201D']
          }
      ] },
    { title: 'Marlin Financial', industry: 'Financial Services', href: '/financial-services', icon: 'coin', body: 'Customers dispute charges, raise limits, and unlock cards.',
      colors: ['#12A594', '#A8E85C', '#7FD8E8'], distortion: 0.54, swirl: 0.24,
      personas: [
        { who: 'Alice Anderson', vid: ASSET_BASE + 'persona-videos/fintech-alice-anderson.mp4', tag: 'Current customer',
          scenario: 'A current customer managing multiple accounts who just flagged an unfamiliar charge.',
          fields: [['Accounts', 'Checking, Savings, Auto loan'], ['DOB', 'March 15, 1985'], ['Phone', '(555) 666-7771'], ['Last 4 SSN', '6249']],
          phrases: ['\u201CI\u2019m interested in a new credit card. What options do you have?\u201D', '\u201CHow much is in my savings account?\u201D', '\u201CWhat are my recent transactions?\u201D']
          },
        { who: 'Bob Baker', vid: ASSET_BASE + 'persona-videos/fintech-bob-baker.mp4',
          scenario: 'A checking and credit card customer reviewing recent activity.',
          fields: [['DOB', 'July 22, 1978'], ['Phone number', '555-777-8881'], ['Last 4 SSN', '2222'], ['CC last 4', '8841']],
          phrases: ['\u201CWhat are my most recent transactions?\u201D', '\u201CWhat is my statement balance?\u201D', '\u201CI\u2019d like to open a new savings account, what are the current rates on offer?\u201D']
          },
        { who: 'Carol Carter', vid: ASSET_BASE + 'persona-videos/fintech-carol-carter.mp4',
          scenario: 'A past-due credit card customer.',
          fields: [['DOB', 'May 9, 1990'], ['Phone number', '555-888-9991'], ['Last 4 SSN', '3333']],
          phrases: ['\u201CI think I am past due, can you help?\u201D', '\u201CWhat features does CrestaPay have?\u201D', '\u201CI have lost my card, what do I need to do?\u201D']
          }
      ] },
    { title: 'Tidal Insurance', industry: 'Insurance', href: '/insurance', icon: 'heart', body: 'Policyholders file claims, add drivers, and quote new coverage.',
      colors: ['#2E8B57', '#93D46A', '#EDF4D6'], distortion: 0.48, swirl: 0.18,
      personas: [
        { who: 'Alex Carter', vid: ASSET_BASE + 'persona-videos/insurance-alex-carter.mp4', id: ['Quote', '48291375'],
          scenario: 'A homeowner finishing up a quote started online.',
          fields: [['Quote type', 'Home'], ['Status', 'Quote in progress'], ['Address', '1458 Maplewood Dr, Sacramento, CA'], ['Zip code', '95814'], ['Missing info', 'Roof age, Prior claims']],
          phrases: ['\u201CI started a quote online but got stuck. Can you help me finish it?\u201D', '\u201CWhat coverage options do you recommend for someone in my area?\u201D', '\u201CWhat discounts can I get by adding my car to my policy?\u201D']
          },
        { who: 'Jamie Rivera', vid: ASSET_BASE + 'persona-videos/insurance-jamie-rivera.mp4', id: ['Quote', '739-20561'],
          scenario: 'A California driver getting a premium auto insurance quote.',
          fields: [['Quote type', 'Auto'], ['Status', 'Quote in progress'], ['Vehicle', '2022 Honda Civic'], ['Zip code', '95112']],
          phrases: ['\u201CWhat\u2019s included in the premium auto coverage?\u201D', '\u201CWhat deductible options do I have?\u201D', '\u201CHow does a claim affect my premium if I\u2019m not at fault?\u201D']
          },
        { who: 'Morgan Lee', vid: ASSET_BASE + 'persona-videos/insurance-morgan-lee.mp4', id: ['Quote', '55013842'],
          scenario: 'An Oregon homeowner bundling home and auto policies.',
          fields: [['Quote type', 'Bundle'], ['Status', 'Quote in progress'], ['Vehicle', '2020 Subaru Outback'], ['Address', '789 Cedar Lane, Portland, OR'], ['Zip code', '97201']],
          phrases: ['\u201CHow much am I saving by bundling compared to separate policies?\u201D', '\u201CDoes the standard home policy cover water damage from a burst pipe?\u201D', '\u201CHow do I switch my existing policies over to Cresta Line Insurance?\u201D']
          }
      ] },
    { title: 'Pure Lake Home Services', industry: 'Home Services', href: '/', icon: 'bolt', body: 'Customers move service appointments, pay balances, and manage their contracts.',
      colors: ['#3D2BB3', '#7C6BF5', '#F2D06B'], distortion: 0.44, swirl: 0.22,
      personas: [
        { who: 'John Smith', vid: ASSET_BASE + 'persona-videos/utility-john-smith.mp4', id: ['Account', '5204819376'],
          scenario: 'A homeowner whose contract is renewing next month.',
          fields: [['Phone', '(555) 100-1001'], ['Last 4 SSN', '7429'], ['Address', '4812 Crestwood Dr, Phoenix, AZ'], ['Appointment', _johnAppt], ['Contract status', renewsStr(_johnRenews)]],
          phrases: ['\u201CCan you help me reschedule my upcoming appointment?\u201D', '\u201CWhen is the next scheduled charge to my account?\u201D', '\u201CCan you help me pay my balance?\u201D']
          },
        { who: 'Michael Brown', vid: ASSET_BASE + 'persona-videos/utility-michael-brown.mp4', id: ['Account', '4567890123'],
          scenario: 'An overdue customer looking to make a partial payment.',
          fields: [['Phone', '(555) 100-4004'], ['Last 4 SSN', '9012'], ['Address', '321 Elm St, Scottsdale, AZ 85250'], ['Contract status', 'Active']],
          phrases: ['\u201CWhat is my current balance?\u201D', '\u201CThis bill was higher than normal, can you explain that?\u201D', '\u201CI\u2019d like to pay $100 of my bill, can I do that with the card on file?\u201D']
          },
        { who: 'Sarah Johnston', vid: ASSET_BASE + 'persona-videos/utility-sarah-johnston.mp4', id: ['Account', '2345678901'],
          scenario: 'An overdue customer looking to reschedule an appointment.',
          fields: [['Phone', '(555) 100-2002'], ['Last 4 SSN', '5678'], ['Address', '456 Oak Ave, Tucson, AZ 85701']],
          phrases: ['\u201CAm I at risk of disconnection due to my overdue balance?\u201D', '\u201CCan you help me reschedule my upcoming appointment?\u201D', '\u201CCan you help me pay my balance?\u201D']
          }
      ] }
  ];

  /* Decorate cards with display-locale fields for LOCALE. Identity fields (industry, title,
     who) stay English: they double as routing slugs for agent auth (verticalKey), gradient
     video URLs (gradSrc/gradVidSrc) and the ?industry= deep link. Every renderer reads the
     *Label variant first and falls back to the English original, so the en path is
     byte-identical to the pre-i18n build and this is a no-op there. */
  function applyLocale() {
    if (LOCALE === 'en') return;
    var T = I18N[LOCALE];
    if (!T || !T.cards) return;
    CARDS.forEach(function (c) {
      var ct = T.cards[c.industry];
      if (!ct) return;
      c.industryLabel = ct.industry || c.industry;
      c.bodyLabel = ct.body || c.body;
      (c.personas || []).forEach(function (p) {
        var pt = ct.personas && ct.personas[p.who];
        if (!pt) return;
        p.scenarioLabel = pt.scenario || p.scenario;
        p.phrasesLabel = pt.phrases || p.phrases;
        if (p.tag) p.tagLabel = (T.fieldVals && T.fieldVals[p.tag]) || p.tag;
        if (p.id) p.idLabel = [(T.fieldKeys && T.fieldKeys[p.id[0]]) || p.id[0], p.id[1]];
        p.fieldsLabel = (p.fields || []).map(function (f) {
          return [(T.fieldKeys && T.fieldKeys[f[0]]) || f[0], (T.fieldVals && T.fieldVals[f[1]]) || f[1]];
        });
      });
    });
  }
  applyLocale();

  /* ---------------- live Cresta agents (chat + voice) ----------------
     Chat is headless (@cresta/ai-agent-client off the widget CDN bundle) and runs in
     THIS document: no df-messenger, so no shadow-DOM fight and switching vertical
     mid-session is free.

     Voice is one hidden same-origin iframe per vertical. df-messenger is a singleton
     per document — co-resident copies race over grecaptcha/auth/the body portal and
     only the first vertical ever connects. Ported from cresta-ccw-2026-kiosk
     (src/voice.jsx + public/widget.html), which ships all six this way. srcdoc rather
     than a hosted widget.html keeps the Webflow embed a single paste: a srcdoc frame
     still inherits this origin, so the hero can call into it synchronously inside the
     user's tap, which is what getUserMedia needs. */
  var CRESTA_CDN = 'https://va-widget.us-west-2-prod.cresta.ai/ai-agent-widget/index.js';
  var CRESTA_ENV = {
    customerId: 'cresta',
    profileId: 'ai-agent-marketing',
    authEndpoint: 'https://auth.us-west-2-prod.cresta.com',
    serviceEndpoint: 'https://api-ai-agent-marketing.cresta.com'
  };
  /* Keyed by card.industry slugified. reCAPTCHA site keys
     are public client-side keys; auth client IDs are provisioned per agent in Director
     (ai-agent-marketing). Each one only authenticates on domains allow-listed under that
     agent's Chat Settings, so a new serving domain needs adding there for all twelve.
     chatAgentId is the per-vertical chat-optimised VA (AID-2524) — chat sessions
     start against it so bubbles get written formatting; agentId stays the voice VA the
     iframe path serves. Unlike the sandbox-2 world, each vertical has SEPARATE auth
     clients + usecases per channel: voice signs in with voiceAuthClientId + usecase
     'voice', headless chat with chatAuthClientId + chatUsecase 'chat'. Client IDs +
     key pairs harvested from each agent's Director Chat Settings (2026-09-22). */
  var CRESTA_AGENTS = {
    hospitality: {
      agentId: 'gh-customers-cresta-website-verticals-hotels-voice-prod-250fd8ef09f0c9554a62aaa60649daf174213cad17a7afef0ee89e61cc7051b7',
      chatAgentId: 'gh-customers-cresta-website-verticals-hotels-chat-prod-250fd8ef09f0c9554a62aaa60649daf174213cad17a7afef0ee89e61cc7051b7',
      usecase: 'voice',
      chatUsecase: 'chat',
      voiceAuthClientId: 'ai-agent-hero-prod',
      chatAuthClientId: 'ai-agent-hero-prod',
      recaptchaSiteKey: '6LdXitQtAAAAALLBji56bbHjAT15vX1XN0lyii_1',  // gitleaks:allow
      recaptchaCheckboxSiteKey: '6LeijtQtAAAAAGfqdtyx2ru8XcVYmKYYDfQjO2c1',  // gitleaks:allow
      chatRecaptchaSiteKey: '6LdXitQtAAAAALLBji56bbHjAT15vX1XN0lyii_1',  // gitleaks:allow
      chatRecaptchaCheckboxSiteKey: '6LeijtQtAAAAAGfqdtyx2ru8XcVYmKYYDfQjO2c1'  // gitleaks:allow
    },
    healthcare: {
      agentId: 'gh-customers-cresta-website-verticals-healthcare-payer-voice-prod-250fd8ef09f0c9554a62aaa60649daf174213cad17a7afef0ee89e61cc7051b7',
      chatAgentId: 'gh-customers-cresta-website-verticals-healthcare-payer-chat-prod-250fd8ef09f0c9554a62aaa60649daf174213cad17a7afef0ee89e61cc7051b7',
      usecase: 'voice',
      chatUsecase: 'chat',
      voiceAuthClientId: 'ai-agent-hero-prod',
      chatAuthClientId: 'ai-agent-hero-prod',
      recaptchaSiteKey: '6LdXitQtAAAAALLBji56bbHjAT15vX1XN0lyii_1',  // gitleaks:allow
      recaptchaCheckboxSiteKey: '6LeijtQtAAAAAGfqdtyx2ru8XcVYmKYYDfQjO2c1',  // gitleaks:allow
      chatRecaptchaSiteKey: '6LdXitQtAAAAALLBji56bbHjAT15vX1XN0lyii_1',  // gitleaks:allow
      chatRecaptchaCheckboxSiteKey: '6LeijtQtAAAAAGfqdtyx2ru8XcVYmKYYDfQjO2c1'  // gitleaks:allow
    },
    'retail-health': {
      agentId: 'gh-customers-cresta-website-verticals-retail-health-voice-prod-250fd8ef09f0c9554a62aaa60649daf174213cad17a7afef0ee89e61cc7051b7',
      chatAgentId: 'gh-customers-cresta-website-verticals-retail-health-chat-prod-250fd8ef09f0c9554a62aaa60649daf174213cad17a7afef0ee89e61cc7051b7',
      usecase: 'voice',
      chatUsecase: 'chat',
      voiceAuthClientId: 'ai-agent-hero-prod',
      chatAuthClientId: 'ai-agent-hero-prod',
      recaptchaSiteKey: '6LdXitQtAAAAALLBji56bbHjAT15vX1XN0lyii_1',  // gitleaks:allow
      recaptchaCheckboxSiteKey: '6LeijtQtAAAAAGfqdtyx2ru8XcVYmKYYDfQjO2c1',  // gitleaks:allow
      chatRecaptchaSiteKey: '6LdXitQtAAAAALLBji56bbHjAT15vX1XN0lyii_1',  // gitleaks:allow
      chatRecaptchaCheckboxSiteKey: '6LeijtQtAAAAAGfqdtyx2ru8XcVYmKYYDfQjO2c1'  // gitleaks:allow
    },
    'financial-services': {
      agentId: 'gh-customers-cresta-website-verticals-fintech-voice-prod-250fd8ef09f0c9554a62aaa60649daf174213cad17a7afef0ee89e61cc7051b7',
      chatAgentId: 'gh-customers-cresta-website-verticals-fintech-chat-prod-250fd8ef09f0c9554a62aaa60649daf174213cad17a7afef0ee89e61cc7051b7',
      usecase: 'voice',
      chatUsecase: 'chat',
      voiceAuthClientId: 'ai-agent-hero-prod',
      chatAuthClientId: 'ai-agent-hero-prod',
      recaptchaSiteKey: '6LdXitQtAAAAALLBji56bbHjAT15vX1XN0lyii_1',  // gitleaks:allow
      recaptchaCheckboxSiteKey: '6LeijtQtAAAAAGfqdtyx2ru8XcVYmKYYDfQjO2c1',  // gitleaks:allow
      chatRecaptchaSiteKey: '6LdXitQtAAAAALLBji56bbHjAT15vX1XN0lyii_1',  // gitleaks:allow
      chatRecaptchaCheckboxSiteKey: '6LeijtQtAAAAAGfqdtyx2ru8XcVYmKYYDfQjO2c1'  // gitleaks:allow
    },
    insurance: {
      agentId: 'gh-customers-cresta-website-verticals-pc-insurance-voice-prod-250fd8ef09f0c9554a62aaa60649daf174213cad17a7afef0ee89e61cc7051b7',
      chatAgentId: 'gh-customers-cresta-website-verticals-pc-insurance-chat-prod-250fd8ef09f0c9554a62aaa60649daf174213cad17a7afef0ee89e61cc7051b7',
      usecase: 'voice',
      chatUsecase: 'chat',
      voiceAuthClientId: 'ai-agent-hero-prod',
      chatAuthClientId: 'ai-agent-hero-prod',
      recaptchaSiteKey: '6LdXitQtAAAAALLBji56bbHjAT15vX1XN0lyii_1',  // gitleaks:allow
      recaptchaCheckboxSiteKey: '6LeijtQtAAAAAGfqdtyx2ru8XcVYmKYYDfQjO2c1',  // gitleaks:allow
      chatRecaptchaSiteKey: '6LdXitQtAAAAALLBji56bbHjAT15vX1XN0lyii_1',  // gitleaks:allow
      chatRecaptchaCheckboxSiteKey: '6LeijtQtAAAAAGfqdtyx2ru8XcVYmKYYDfQjO2c1'  // gitleaks:allow
    },
    'home-services': {
      agentId: 'gh-customers-cresta-website-verticals-utilities-voice-prod-250fd8ef09f0c9554a62aaa60649daf174213cad17a7afef0ee89e61cc7051b7',
      chatAgentId: 'gh-customers-cresta-website-verticals-utilities-chat-prod-250fd8ef09f0c9554a62aaa60649daf174213cad17a7afef0ee89e61cc7051b7',
      usecase: 'voice',
      chatUsecase: 'chat',
      voiceAuthClientId: 'ai-agent-hero-prod',
      chatAuthClientId: 'ai-agent-hero-prod',
      recaptchaSiteKey: '6LdXitQtAAAAALLBji56bbHjAT15vX1XN0lyii_1',  // gitleaks:allow
      recaptchaCheckboxSiteKey: '6LeijtQtAAAAAGfqdtyx2ru8XcVYmKYYDfQjO2c1',  // gitleaks:allow
      chatRecaptchaSiteKey: '6LdXitQtAAAAALLBji56bbHjAT15vX1XN0lyii_1',  // gitleaks:allow
      chatRecaptchaCheckboxSiteKey: '6LeijtQtAAAAAGfqdtyx2ru8XcVYmKYYDfQjO2c1'  // gitleaks:allow
    }
  };
  var CONNECT_TIMEOUT_MS = 20000;   // give up on the UI if livekit never opens
  var MAX_VOICE_FRAMES = 3;         // mounted widget iframes kept alive at once
  var RECAPTCHA_HOST_ID = 'cresta-recaptcha-container';

  function verticalKey(c) { return String((c && c.industry) || '').toLowerCase().replace(/\s+/g, '-'); }
  function agentFor(c) { return CRESTA_AGENTS[verticalKey(c)] || null; }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'aia-' + Date.now().toString(16) + '-' + Math.random().toString(16).slice(2);
  }
  /* The interactive verifier renders into an element found BY ID, so one has to exist
     and be visible — a checkbox nobody can click is the same as no fallback.
     Returns the ELEMENT, not the id string: SDK.Interactive executes against the SDK
     iframe's realm, so an id string is looked up in the frame's document (never finds
     it) and Firebase throws "Container element not found". A same-origin element ref
     works across realms. */
  function recaptchaHost() {
    var el = document.getElementById(RECAPTCHA_HOST_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = RECAPTCHA_HOST_ID;
      el.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:99999';
      document.body.appendChild(el);
    }
    return el;
  }
  /* The widget bundle runs `const cresta = new CrestaAiAgentApp` in its own module scope and
     exports only window.crestaChatWidget (a UI api) — the headless constructors the hero
     needs (CrestaAiAgentApp, the recaptcha verifiers) never reach window. Evaluating the
     bundle in THIS document would execute it a second time after the site-footer script tag,
     and the widget re-mounts on every execution without tearing down the first host: two
     Signal buttons, deterministically. So load the bundle in a throwaway same-origin srcdoc
     iframe instead — the widget mounts in there (hidden), and the frame posts the
     constructors back. The iframe also sidesteps Osano, which rewrites external <script src>
     on cresta.com to type="osano/blocked" (loads 200, never executes) but does not reach
     into srcdoc frames. */
  var SDK = null;
  var _sdkP = null;
  /* grecaptcha must run in the PARENT document, not the SDK iframe: a token minted inside
     a srcdoc frame (location "about:srcdoc") is rejected server-side with
     "invalid recaptcha token". So load enterprise.js here ourselves and hand a reference
     into the iframe - the verifier's loadEnterprise sees globalThis.grecaptcha present in
     the frame and reuses it, so the token is minted in THIS document's context.
     Two constraints shape HOW it is loaded (both verified empirically against prod
     grecaptcha):
     1. execute(siteKey) only works for keys that were the SINGLE render param of an api.js
        execution. A comma list never registers, and grecaptcha.enterprise.render() widgets
        are invisible to execute-by-sitekey. Re-running api.js with a new single key DOES
        register it - but only via a real script tag: fetch+eval loses the render param
        (currentScript is null inside eval), so the eval'd load registers nothing.
     2. Plain script tags get rewritten to type="osano/blocked" on cresta.com when Osano
        is active, but fetch+eval still works there.
     Resolution: load once with render=explicit (works for both script tag and fetch+eval,
     since no named key registration is needed), then render one invisible widget per agent
     sitekey via grecaptcha.enterprise.render(), and inject a PROXY into the iframe whose
     execute(siteKey) is rewritten to execute(widgetId) for that key. One load, all six
     agents covered, tokens minted in this document. */
  var GR_URL = 'https://www.google.com/recaptcha/enterprise.js?render=explicit';
  var _grP = null;
  var _grKeyMap = null;
  function loadParentGrecaptcha() {
    if (window.grecaptcha && window.grecaptcha.enterprise && window.grecaptcha.enterprise.execute) return Promise.resolve(true);
    if (_grP) return _grP;
    _grP = new Promise(function (res) {
      var done = false;
      var fin = function (v) { if (!done) { done = true; res(v); } };
      var s = document.createElement('script');
      s.src = GR_URL;
      s.async = true;
      s.onload = function () { fin(true); };
      s.onerror = function () { fin(false); };
      document.head.appendChild(s);
      // Osano can rewrite the tag so its onload never fires - fall back to fetch+eval
      setTimeout(function () { fin(false); }, 6000);
    }).then(function (ok) {
      if (ok) return true;
      return fetch(GR_URL, { credentials: 'omit' })
        .then(function (r) { if (!r.ok) throw new Error('grecaptcha ' + r.status); return r.text(); })
        .then(function (src) { (0, eval)(src); return true; });
    }).then(function (ok) { return new Promise(function (res) {
      // enterprise.execute is patched onto the object asynchronously after script eval
      (function tick(n) {
        if ((window.grecaptcha && window.grecaptcha.enterprise && window.grecaptcha.enterprise.execute) || n <= 0) res(ok);
        else setTimeout(function () { tick(n - 1); }, 100);
      })(50);
    }); })
      .catch(function () { _grP = null; return false; });
    return _grP;
  }
  /* One invisible widget per agent sitekey; maps siteKey -> widgetId so the injected
     proxy can translate the verifier's execute(siteKey) into execute(widgetId). */
  function renderGrWidgets() {
    var ge = window.grecaptcha.enterprise;
    _grKeyMap = _grKeyMap || {};
    var holder = document.createElement('div');
    holder.style.cssText = 'position:fixed;left:-10000px;top:0;width:0;height:0;overflow:hidden';
    document.body.appendChild(holder);
    /* Both channels, not just voice: chat signs in with chatRecaptchaSiteKey, and an
       unregistered key makes the proxy fall through to the raw sitekey, which api.js
       rejects ("Invalid site key") - the chat path then dies before start(). */
    Object.keys(CRESTA_AGENTS).forEach(function (k) {
      var ag = CRESTA_AGENTS[k];
      [ag.recaptchaSiteKey, ag.chatRecaptchaSiteKey].forEach(function (sk) {
        if (!sk || _grKeyMap[sk]) return;
        try {
          var el = document.createElement('div');
          holder.appendChild(el);
          /* Widget-scope execute ignores the action passed to execute() - it must be set
             at render or the token comes back without one and the backend rejects it. */
          var wid = ge.render(el, { sitekey: sk, size: 'invisible', action: 'LOGIN' });
          if (typeof wid === 'number') _grKeyMap[sk] = wid;
        } catch (e) { console.warn('[aia-hero] grecaptcha widget render failed', e); }
      });
    });
    return _grKeyMap;
  }
  function ensureParentGr() {
    if (_grKeyMap) return Promise.resolve(_grKeyMap);
    return loadParentGrecaptcha().then(function (ok) {
      if (!ok) return null;
      try { return renderGrWidgets(); } catch (e) { console.warn('[aia-hero] grecaptcha widget render failed', e); return null; }
    });
  }
  function loadCrestaSdk() {
    if (SDK) return Promise.resolve(true);
    if (_sdkP) return _sdkP;
    var sdkFrame = null;   // declared here: the .then below runs outside the executor's scope
    /* The SDK frame's bundle auto-mounts with the widget's default config and loads its
       OWN api.js, which would mint tokens in the frame realm - rejected server-side
       ("invalid recaptcha token"). So: load parent grecaptcha FIRST, then set a PROXY on
       the frame's window BEFORE the bundle executes (and again once it posts) - the
       verifier's loadEnterprise then sees grecaptcha already present and skips its own
       load. Proxy, not direct ref: execute(siteKey) only resolves for keys registered by
       an api.js render param. The prototype passthrough keeps every other grecaptcha
       method working (ready, render for the interactive checkbox fallback); only execute
       is rewritten to the matching invisible widget so the token is minted in THIS
       document's context. */
    _sdkP = ensureParentGr().then(function (keyMap) {
      var grProxy = null;
      try {
        if (keyMap && window.grecaptcha && window.grecaptcha.enterprise) {
          var gRoot = window.grecaptcha;
          var ge = gRoot.enterprise;
          /* The proxy must SHADOW the whole grecaptcha shape, not just extend the
             enterprise object: the bundle's load-skip check reads grecaptcha.enterprise,
             so a proxy prototyped off enterprise alone reports enterprise=undefined and
             the frame loads its own api.js (frame-realm tokens -> server 403). The
             enterprise sub-object gets its own rewritten execute; everything else falls
             through to the parent's real object. */
          var proxGe = Object.create(ge);
          proxGe.execute = function (k, o) {
            /* widgetId 0 is falsy - `||` here silently fell through to the sitekey,
               which api.js rejects ("Invalid site key"). Compare against undefined. */
            var mapped = keyMap[k] !== undefined ? keyMap[k] : k;
            return ge.execute(mapped, o);
          };
          grProxy = Object.create(gRoot);
          grProxy.enterprise = proxGe;
          grProxy.ready = function (cb) { return gRoot.ready(cb); };
        }
      } catch (e) { console.warn('[aia-hero] grecaptcha proxy build failed', e); }
      return new Promise(function (res) {
      var f = sdkFrame = document.createElement('iframe');
      var done = false;
      var injectProxy = function () {
        try {
          if (grProxy && f.contentWindow) f.contentWindow.grecaptcha = grProxy;
          f.contentDocument.querySelectorAll('script[src*="recaptcha"]').forEach(function (s) { s.remove(); });
        } catch (e) { console.warn('[aia-hero] grecaptcha injection failed', e); }
      };
      var finish = function (ok) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        window.removeEventListener('message', onMsg);
        /* On success the iframe must STAY in the DOM for the life of the page: every
           exported class (CrestaAiAgentApp, the recaptcha verifiers) still executes against
           the iframe's global realm — remove the frame and its realm is torn down, and the
           first createClient dies on `n instanceof DOMException` inside storageAvailable.
           Only a failed load is removed (its classes are unusable anyway). */
        if (!ok) f.remove();
        res(ok);
      };
      var onMsg = function (ev) {
        if (ev.source !== f.contentWindow) return;
        var d = ev.data || {};
        if (d.__aiaSdk === 1) {
          /* The bundle may have executed before the pre-injection or mounted its own
             api.js after it - re-inject so the verifier sees the parent proxy. */
          injectProxy();
          /* The constructors themselves cannot cross postMessage (classes are not
             structured-cloneable) — but same-origin window access passes them by
             reference, same as the voice frames' __crestaWidget. */
          var sdk = f.contentWindow.__aiaSdk;
          if (sdk && sdk.App && sdk.Score) {
            SDK = sdk;
            finish(true);
          } else {
            finish(false);
          }
        } else if (d.__aiaSdk === 0) {
          finish(false);
        }
      };
      var timer = setTimeout(function () { finish(false); }, 25000);
      window.addEventListener('message', onMsg);
      f.setAttribute('aria-hidden', 'true');
      f.title = 'Cresta headless chat SDK';
      f.style.cssText = 'position:fixed;left:-10000px;top:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none';
      document.body.appendChild(f);
      /* Load the bundle into the frame's INITIAL about:blank document - never navigate
         the frame. srcdoc was tried first: setting window.grecaptcha on the pre-srcdoc
         window is discarded when the srcdoc document swaps in, so the bundle booted with
         no grecaptcha, loaded its own api.js and minted frame-realm tokens the backend
         rejects ("invalid recaptcha token"). A dynamically inserted iframe gets a
         same-origin initial document synchronously, so the proxy is in place BEFORE the
         bundle executes and the realm is never torn down. */
      (function boot() {
        if (done) return;
        var fd = f.contentDocument;
        if (!fd || !fd.head) { setTimeout(boot, 10); return; }
        try {
          if (grProxy) f.contentWindow.grecaptcha = grProxy;
          var sc = fd.createElement('script');
          sc.src = CRESTA_CDN;
          /* Export on the bundle's own load event - dynamic inline scripts run at
             insertion time and would race ahead of the bundle. */
          sc.onload = function () {
            try {
              f.contentWindow.eval('try{window.__aiaSdk={App:CrestaAiAgentApp,Score:ScoreBasedRecaptchaVerifier,Interactive:(typeof InteractiveRecaptchaVerifier<"u"?InteractiveRecaptchaVerifier:null)};parent.postMessage({__aiaSdk:1},"*")}catch(e){parent.postMessage({__aiaSdk:0},"*")}');
            } catch (e) { console.warn('[aia-hero] SDK exporter failed', e); finish(false); }
          };
          sc.onerror = function () { console.warn('[aia-hero] SDK CDN failed'); finish(false); };
          fd.head.appendChild(sc);
        } catch (e) { console.warn('[aia-hero] SDK frame boot failed', e); finish(false); }
      })();
      });
    }).then(function (ok) {
      if (!ok) { _sdkP = null; return ok; }   // a failed load must not poison the next attempt
      return ok;
    });
    return _sdkP;
  }

  /* Runs INSIDE the isolated iframe — stringified into its srcdoc, so it must be
     self-contained and can only reach the hero through window.frameElement. */
  function aiaVoiceWidget() {
    var host = window.frameElement;
    var cfg = host && host.__aiaCfg;
    var V = (host && host.getAttribute('data-vertical')) || '?';
    var TAG = '[aia-voice:' + V + ']';
    function bridge() { return (host && host.__aiaBridge) || null; }
    function tell(name, a) { var br = bridge(); if (br && br[name]) br[name](V, a); }
    if (!cfg) { console.warn(TAG, 'no config'); return; }

    // Force shadow roots open: the call button lives in a body portal the widget owns,
    // not inside <df-messenger>, and it is closed by default.
    var origAttach = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (init) {
      var o = {}; for (var k in init) o[k] = init[k];
      o.mode = 'open';
      return origAttach.call(this, o);
    };

    var s = document.createElement('script');
    s.src = 'https://va-widget.us-west-2-prod.cresta.ai/ai-agent-widget/index.js';
    s.onerror = function () { console.warn(TAG, 'CDN failed'); tell('onFailed', 'cdn'); };
    document.head.appendChild(s);

    var el = document.createElement('df-messenger');
    var attrs = {
      'crestagpt-customer': 'cresta',
      'crestagpt-profile': 'ai-agent-marketing',
      'crestagpt-usecase': cfg.usecase,
      'crestagpt-agent': cfg.agentId,
      'crestagpt-api': 'https://api-ai-agent-marketing.cresta.com',
      'crestagpt-auth-endpoint': 'https://auth.us-west-2-prod.cresta.com',
      'auth-client-id': cfg.voiceAuthClientId,
      'recaptcha-site-key': cfg.recaptchaSiteKey,
      'recaptcha-checkbox-site-key': cfg.recaptchaCheckboxSiteKey,
      'call-only': 'true',
      'cresta-voice-agent': cfg.agentId,
      'use-livekit': 'true',
      // ai-agent-marketing agents are registered in the us-west-2-prod dbregistry —
      // the same cluster the live Signal embed on cresta.com uses.
      'k8s-cluster': 'us-west-2-prod',
      'correlation-id': (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'c-' + Date.now()
    };
    Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    el.style.cssText = 'position:fixed;left:0;top:0;';   // the whole frame is hidden by the hero
    document.body.appendChild(el);

    function findButtonIn(root) {
      if (root instanceof Element && root.shadowRoot) {
        var f = findButtonIn(root.shadowRoot);
        if (f) return f;
      }
      var direct = root.querySelector('button') || root.querySelector('[role="button"]');
      if (direct) return direct;
      var all = Array.prototype.slice.call(root.querySelectorAll('*'));
      for (var i = 0; i < all.length; i++) {
        if (all[i].shadowRoot) { var g = findButtonIn(all[i].shadowRoot); if (g) return g; }
      }
      return null;
    }

    var armed = false, btn = null, pendingStart = false;
    var activeBtn = null, callActive = false, stopTurns = null, cleanupActiveCall = null;

    // Defined immediately so a start() that races ahead of arming is queued, not dropped.
    window.__crestaWidget = {
      start: function () {
        if (callActive) return;
        if (armed) fire(); else pendingStart = true;
      },
      end: function () { pendingStart = false; hangup(); }
    };

    function claim(node) {
      if (armed) return true;
      if (!node || node === el || !(node instanceof HTMLElement)) return false;
      var b = findButtonIn(node);
      if (!b) return false;
      btn = b; armed = true;
      obs.disconnect(); clearInterval(poll);
      console.log(TAG, 'armed');
      tell('onArmed');
      if (pendingStart) { pendingStart = false; fire(); }
      return true;
    }
    var obs = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var added = muts[i].addedNodes;
        for (var j = 0; j < added.length; j++) if (claim(added[j])) return;
      }
    });
    obs.observe(document.body, { childList: true });
    var poll = setInterval(function () {
      var kids = Array.prototype.slice.call(document.body.children);
      for (var i = 0; i < kids.length; i++) if (claim(kids[i])) return;
    }, 120);

    function fire() {
      if (!btn) { pendingStart = true; return; }
      if (callActive) return;
      callActive = true;
      activeBtn = btn;

      // Runs synchronously inside the hero's tap, so the gesture still covers this.
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ audio: true })
          .then(function (st) { st.getTracks().forEach(function (t) { t.stop(); }); })
          .catch(function (e) {
            /* Report it rather than sitting on the 20s connect timeout — without a mic the call
               cannot happen, and a silent 20s of "connecting" reads as a dead button. A pending
               permission prompt does not land here; only an actual rejection does.
               file:// always rejects: a srcdoc frame gets an opaque origin, and allow="microphone"
               cannot delegate a permission to an opaque origin, so the mic is refused with no
               prompt. Serve the page over http(s) instead. */
            var denied = e && e.name === 'NotAllowedError';
            var fp = document.featurePolicy;
            if (denied && fp && !fp.allowsFeature('microphone')) {
              console.warn(TAG, 'microphone refused by permissions policy — the host page is almost certainly on file://. Serve it over http(s).');
            }
            cleanup();
            tell('onFailed', denied ? 'mic-denied' : 'mic-error');
          });
      }

      var OrigWS = window.WebSocket;
      var opened = false;
      var cleanup = function () {
        window.WebSocket = OrigWS;
        if (stopTurns) { stopTurns(); stopTurns = null; }
        if (cleanupActiveCall === cleanup) cleanupActiveCall = null;
        callActive = false;
        activeBtn = null;
      };
      cleanupActiveCall = cleanup;

      class CallWS extends OrigWS {
        constructor(url, protocols) {
          super(url, protocols);
          if (!/livekit/i.test(String(url))) return;
          this.addEventListener('open', function () {
            if (opened) return;
            opened = true;
            window.WebSocket = OrigWS;
            // Hold the hero on "connecting": the connect tone is playing and there is no
            // agent audio yet. startTurns() flips it live the instant the agent's stream
            // is tapped, a beat before the first word.
            stopTurns = startTurns();
          });
          this.addEventListener('close', function () { cleanup(); tell('onEnded'); });
          this.addEventListener('error', function () { cleanup(); tell('onFailed', 'dropped'); });
        }
      }
      window.WebSocket = CallWS;
      try { btn.click(); }
      catch (e) { cleanup(); console.warn(TAG, 'click threw', e); tell('onFailed', 'connect'); }
    }

    function hangup() {
      var b = activeBtn;
      callActive = false;
      activeBtn = null;
      // The watchdog's silent restart is armed right AFTER its own hangup() call, so this
      // runs before that timer exists on the truncation path itself; a hangup from
      // anywhere later (user end, hero vertical switch) must cancel it or the frame
      // dials a call nobody asked for - the MAR-292 orphan.
      if (restartTimer) { clearTimeout(restartTimer); restartTimer = 0; }
      try { if (b) b.click(); } catch (e) {}
      try { if (cleanupActiveCall) cleanupActiveCall(); } catch (e) {}
    }

    // Frame-wide total of greeting restarts (loop breaker): a persistently dead agent
    // stops auto-restarting after 3 so the visitor is left with a manual state instead
    // of an endless reconnect loop. Scoped to the frame, so a frame re-mount resets it.
    var greetingRestarts = 0;
    var restartTimer = 0;

    /* Turn detection runs here, where the agent audio lives. The agent's own output
       stream is tapped rather than the mic, so the hero's orb tracks the agent cleanly. */
    function startTurns() {
      var AGENT_ON = 0.045, VISITOR_ON = 0.085, GAP = 550, LIVE_FALLBACK = 10000;
      // A complete greeting runs 5-6s. A first agent speech burst that ends under 4.5s
      // followed by 4s of visitor silence means the TTS stream died mid-greeting (the
      // platform aborts at a chunk boundary with no WS event) - restart the call once.
      var GREETING_MIN_SPEAK_MS = 4500, GREETING_TRUNCATED_CHECK_MS = 4000;
      var alive = true, agentAn = null, agentBuf = null, micAn = null, micBuf = null, micStream = null;
      var searchAt = 0, state = 'speaking', lastVoice = performance.now(), lastSwitch = 0;
      var wentLive = false, startedAt = performance.now();
      var firstAgentSpeechAt = 0, lastAgentAudioAt = 0, visitorSpoke = false;
      // Per-call budget (AID-2515): a silent restart begins a fresh call and this
      // closure, so back-to-back truncations (platform TTS abort struck twice in a
      // row on 2026-09-20 - "Hi, thanks" then a second mid-sentence cut) each get
      // one recovery instead of the second landing on a budget the first spent.
      var callRestarts = 0;

      var goLive = function () {
        if (wentLive) return;
        wentLive = true;
        state = 'speaking';
        lastVoice = performance.now();
        tell('onConnected');
      };

      var Ctx = window.AudioContext || window.webkitAudioContext;
      var ctx = new Ctx();
      if (ctx.resume) ctx.resume().catch(function () {});

      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
          if (!alive) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
          micStream = stream;
          var an = ctx.createAnalyser();
          an.fftSize = 1024; an.smoothingTimeConstant = 0.8;
          ctx.createMediaStreamSource(stream).connect(an);
          micAn = an; micBuf = new Uint8Array(an.fftSize);
        }).catch(function () {});
      }

      var rms = function (an, buf) {
        an.getByteTimeDomainData(buf);
        var s = 0;
        for (var i = 0; i < buf.length; i++) { var v = (buf[i] - 128) / 128; s += v * v; }
        return Math.min(1, Math.sqrt(s / buf.length) * 3.4);
      };
      var collect = function (root, out) {
        Array.prototype.push.apply(out, root.querySelectorAll('audio, video'));
        Array.prototype.forEach.call(root.querySelectorAll('*'), function (n) { if (n.shadowRoot) collect(n.shadowRoot, out); });
      };
      var findAgentStream = function () {
        var els = []; collect(document, els);
        for (var i = 0; i < els.length; i++) {
          var so = els[i].srcObject;
          if (so && typeof so.getAudioTracks === 'function' && so.getAudioTracks().some(function (t) { return t.readyState === 'live'; })) return so;
        }
        return null;
      };

      var tick = function () {
        if (!alive) return;
        if (!agentAn) {
          var tn = performance.now();
          if (tn - searchAt > 200) {
            searchAt = tn;
            var stream = findAgentStream();
            if (stream) {
              try {
                var an = ctx.createAnalyser();
                an.fftSize = 1024; an.smoothingTimeConstant = 0.8;
                ctx.createMediaStreamSource(stream).connect(an);
                agentAn = an; agentBuf = new Uint8Array(an.fftSize);
                goLive();
              } catch (e) {}
            }
          }
        }
        // If the agent stream never taps, go live anyway so the hero doesn't hang on
        // "connecting" and trip its own connect timeout.
        if (!wentLive && performance.now() - startedAt > LIVE_FALLBACK) goLive();
        if (!wentLive) return;

        var agentLvl = (agentAn && agentBuf) ? rms(agentAn, agentBuf) : 0;
        var micLvl = (micAn && micBuf) ? rms(micAn, micBuf) : 0;
        var desired = agentLvl > AGENT_ON ? 'speaking' : (micLvl > VISITOR_ON ? 'listening' : null);
        var t = performance.now();
        if (agentLvl > AGENT_ON) {
          if (!firstAgentSpeechAt) firstAgentSpeechAt = t;
          lastAgentAudioAt = t;
        }
        if (micLvl > VISITOR_ON) visitorSpoke = true;
        if (firstAgentSpeechAt && !visitorSpoke && callRestarts < 1 && greetingRestarts < 3 &&
            t - lastAgentAudioAt >= GREETING_TRUNCATED_CHECK_MS &&
            lastAgentAudioAt - firstAgentSpeechAt < GREETING_MIN_SPEAK_MS) {
          callRestarts++; greetingRestarts++;
          console.warn(TAG, 'greeting truncated after ' +
            Math.round(lastAgentAudioAt - firstAgentSpeechAt) + 'ms of agent audio - silent restart');
          tell('onTruncated');
          hangup();
          restartTimer = setTimeout(function () { restartTimer = 0; window.__crestaWidget.start(); }, 400);
          return;
        }
        if (desired) {
          lastVoice = t;
          if (desired !== state && t - lastSwitch > 200) { state = desired; lastSwitch = t; tell('onState', state); }
        } else if (state !== 'thinking' && t - lastVoice > GAP) {
          state = 'thinking'; lastSwitch = t; tell('onState', 'thinking');
        }
        tell('onLevel', state === 'speaking' ? Math.max(0.12, agentLvl) : (state === 'listening' ? micLvl : 0));
      };

      var id = setInterval(tick, 120);
      return function () {
        alive = false;
        clearInterval(id);
        if (micStream) micStream.getTracks().forEach(function (t) { t.stop(); });
        if (ctx.close) ctx.close().catch(function () {});
      };
    }
  }

  function widgetDoc() {
    return '<!doctype html><html><head><meta charset="utf-8">' +
      '<style>html,body{margin:0;padding:0;background:transparent}</style></head><body>' +
      '<scr' + 'ipt>(' + String(aiaVoiceWidget) + ')();</scr' + 'ipt></body></html>';
  }

  /* One hidden iframe per vertical, mounted on demand. handlers get (key, ...) and are
     only called for the vertical whose call is actually in flight. */
  function createVoice(handlers) {
    var frames = {}, activeId = null, connectTimer = 0;
    function clearConnect() { if (connectTimer) { clearTimeout(connectTimer); connectTimer = 0; } }
    function bridgeFor(key) {
      return {
        onArmed: function () {
          var f = frames[key];
          if (!f) return;
          f.armed = true;
          if (!f.pendingStart) return;
          f.pendingStart = false;
          var w = f.iframe.contentWindow;
          if (w && w.__crestaWidget) w.__crestaWidget.start();
        },
        onConnected: function () { if (key !== activeId) return; clearConnect(); handlers.onConnected(key); },
        onState: function (id, state) { if (key !== activeId) return; handlers.onState(key, state); },
        onLevel: function (id, level) { if (key !== activeId) return; handlers.onLevel(key, level); },
        onTruncated: function () { if (key !== activeId) return; if (handlers.onTruncated) handlers.onTruncated(key); },
        onEnded: function () { if (key !== activeId) return; clearConnect(); activeId = null; handlers.onEnded(key); },
        onFailed: function (id, reason) { if (key !== activeId) return; clearConnect(); activeId = null; handlers.onFailed(key, reason); }
      };
    }
    /* Each frame carries its own copy of a 3MB bundle, so idle ones are dropped rather than
       left mounted for the whole visit. The active call and the newest two are never evicted;
       a re-mount costs one reload, which the pendingStart queue already covers. */
    function evict() {
      var keys = Object.keys(frames).filter(function (k) { return k !== activeId; });
      while (keys.length > MAX_VOICE_FRAMES - 1) {
        var k = keys.shift();
        frames[k].iframe.__aiaBridge = null;
        frames[k].iframe.remove();
        delete frames[k];
      }
    }
    function ensure(key) {
      var ag = CRESTA_AGENTS[key];
      if (!ag) return null;
      if (frames[key]) return frames[key];
      evict();
      var f = document.createElement('iframe');
      f.setAttribute('data-aia-voice', key);
      f.setAttribute('data-vertical', key);
      f.setAttribute('aria-hidden', 'true');
      f.title = 'Cresta voice agent (' + key + ')';
      f.allow = 'microphone';
      // Off screen rather than display:none — display:none suspends the widget's media.
      f.style.cssText = 'position:fixed;left:-10000px;top:0;width:420px;height:680px;border:0;opacity:0;pointer-events:none';
      f.__aiaCfg = ag;
      f.__aiaBridge = bridgeFor(key);
      frames[key] = { iframe: f, armed: false, pendingStart: false };
      document.body.appendChild(f);
      f.srcdoc = widgetDoc();
      return frames[key];
    }
    function start(key) {
      var rec = ensure(key);
      if (!rec) return false;
      activeId = key;
      clearConnect();
      connectTimer = setTimeout(function () {
        if (activeId !== key) return;
        /* The frame may still be waiting on its 3MB bundle. The queued start can sit in
           either place depending on srcdoc parse timing: the outer record (start() ran
           before __crestaWidget existed) or the iframe closure (it existed, armed=false).
           Drain both - end() is a no-op click on a never-fired frame - or a late claim()
           dials a call the hero already gave up on. */
        var rec = frames[key];
        if (rec) rec.pendingStart = false;
        var w = rec && rec.iframe.contentWindow;
        if (w && w.__crestaWidget) { try { w.__crestaWidget.end(); } catch (e) {} }
        activeId = null;
        handlers.onFailed(key, 'timeout');
      }, CONNECT_TIMEOUT_MS);
      var w = rec.iframe.contentWindow;
      // Armed already: this fires inside the caller's tap, which getUserMedia needs.
      if (w && w.__crestaWidget) { rec.pendingStart = false; w.__crestaWidget.start(); }
      else rec.pendingStart = true;
      return true;
    }
    function end() {
      clearConnect();
      /* Every frame, not just frames[activeId]. By the time the hero wants everything
         down, activeId may already be null (onEnded fired when the widget's WS closed)
         while a watchdog restart timer is still armed in that frame, or a cold frame is
         sitting on an armed pendingStart. end() on an idle frame is a no-op click -
         hangup() only clicks the button it captured mid-call - but it drains the
         straggler pendingStart and cancels the restart timer. */
      Object.keys(frames).forEach(function (k) {
        frames[k].pendingStart = false;
        var w = frames[k].iframe.contentWindow;
        if (w && w.__crestaWidget) { try { w.__crestaWidget.end(); } catch (e) {} }
      });
      activeId = null;
    }
    function destroy() {
      end();
      Object.keys(frames).forEach(function (k) {
        frames[k].iframe.__aiaBridge = null;
        frames[k].iframe.remove();
        delete frames[k];
      });
    }
    return { ensure: ensure, start: start, end: end, destroy: destroy };
  }

  /* Headless chat. One signed-in client per vertical, cached, so switching back is
     instant; one session at a time, since the hero only shows one thread. */
  function createChat(handlers) {
    var clients = {}, session = null, unsub = null;
    function signIn(client, ag) {
      var v = new SDK.Score(ag.chatRecaptchaSiteKey);
      var clear = function (ver) { try { if (ver && ver.clear) ver.clear(); } catch (e) {} };
      return v.render()
        .then(function () { return client.auth.signInAnonymously({ crestaResources: client.crestaResources, recaptchaVerifier: v }); })
        .then(function (r) { clear(v); return r; })
        .catch(function (e) {
          // "recaptcha high risk" on the score-based verifier is routine, not a failure:
          // the visible checkbox recovers it every time. Anything else is real.
          var msg = (e && e.message) || '';
          clear(v);
          if (msg.indexOf('recaptcha high risk') < 0 || !(SDK && SDK.Interactive)) throw e;
          var iv = new SDK.Interactive(ag.chatRecaptchaCheckboxSiteKey, recaptchaHost());
          return iv.render()
            .then(function () { return client.auth.signInAnonymously({ crestaResources: client.crestaResources, recaptchaVerifier: iv }); })
            .then(function (r) { clear(iv); return r; });
        });
    }
    function ensureClient(key) {
      var ag = CRESTA_AGENTS[key];
      if (!ag) return Promise.reject(new Error('no agent for ' + key));
      if (clients[key]) return clients[key];
      clients[key] = loadCrestaSdk().then(function (ok) {
        var App = SDK && SDK.App;
        if (!ok || !App || !SDK.Score) throw new Error('cresta sdk unavailable');
        var client = new App().createClient({
          customerId: CRESTA_ENV.customerId,
          profileId: CRESTA_ENV.profileId,
          clientId: ag.chatAuthClientId,
          useCaseId: ag.chatUsecase,
          authEndpoint: CRESTA_ENV.authEndpoint,
          serviceEndpoint: CRESTA_ENV.serviceEndpoint
        }, 'aia-hero-' + key);
        if (client.errorManager) client.errorManager.onError(function (err) { console.warn('[aia-chat]', key, err && err.code, err && err.message); });
        return signIn(client, ag).then(function () { return client; });
      }).catch(function (e) {
        clients[key] = null;    // a failed sign-in must not poison the next attempt
        throw e;
      });
      return clients[key];
    }
    function close() {
      try { if (typeof unsub === 'function') unsub(); } catch (e) {}
      unsub = null;
      try { if (session) session.end(); } catch (e) {}
      session = null;
    }
    /* onMessage has to come AFTER start() — subscribing first throws "Session has not been
       started yet". The welcome still arrives: it streams once the socket is up, not on start. */
    function open(key) {
      return ensureClient(key).then(function (client) {
        close();
        var s = client.aiAgent(uuid());
        session = s;
        return s.start({ agentId: CRESTA_AGENTS[key].chatAgentId || CRESTA_AGENTS[key].agentId }).then(function () {
          if (session !== s) return;   // superseded while starting
          unsub = s.onMessage(function (ev) {
            if (session !== s) return;
            var t = String((ev && ev.type) || '').toLowerCase();
            if (t === 'message') {
              var m = ev.message || {};
              handlers.onStream((m.textSoFar != null ? m.textSoFar : (m.text || '')) || '', m.completed !== false);
            } else if (t === 'typing') handlers.onTyping();
            else if (t === 'terminate' || t === 'error') handlers.onDone();
          });
        });
      });
    }
    function send(text) {
      if (!session) return Promise.reject(new Error('no session'));
      return session.sendMessage({ type: 'text', id: uuid(), values: [{ speakerRole: 'VISITOR', text: text }] });
    }
    return {
      open: open, send: send, close: close,
      warm: function (key) { if (key && !clients[key]) ensureClient(key).catch(function (e) {}); },
      ready: function () { return !!session; },
      destroy: function () { close(); clients = {}; }
    };
  }

  /* one capability read decides how much the hero spends: 0 = static gradient, never animated
     (save-data, 2g, reduced motion, 2-core/2GB devices), 1 = 1x pixels and a ~15fps drift,
     2 = full treatment. Mirrors the source's perfTier() gating of the shader hero. */
  var _tier = null;
  function perfTier() {
    if (_tier != null) return _tier;
    var n = navigator, c = n.connection || {}, et = c.effectiveType || '';
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var mem = n.deviceMemory || 8, cpu = n.hardwareConcurrency || 8;
    if (c.saveData || et === '2g' || et === 'slow-2g' || reduce || mem <= 2 || cpu <= 2) _tier = 0;
    else if (et === '3g' || mem <= 4 || cpu <= 4) _tier = 1;
    else _tier = 2;
    return _tier;
  }

  /* ---------------- utils ---------------- */
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(e) { return e * e * (3 - 2 * e); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (m) {
      return m === '&' ? '&amp;' : m === '<' ? '&lt;' : m === '>' ? '&gt;' : '&quot;';
    });
  }
  function initials(n) { return String(n || '').trim().split(/\s+/).map(function (w) { return w[0] || ''; }).join('').slice(0, 2).toUpperCase(); }
  function clockFmt(sec) { var m = Math.floor(sec / 60), s = sec % 60; return (m < 10 ? '0' + m : '' + m) + ':' + (s < 10 ? '0' + s : '' + s); }
  function posterFor(src) { return src && /\.mp4$/i.test(src) ? src.replace(/\.mp4$/i, '.jpg') : ''; }
  /* the pre-rendered gradient loops: gradient-videos/<industry-slug>.{mp4,jpg} — slugs come from
     the CARDS industry names, so "Retail Health" resolves to retail-health */
  function gradSrc(c, ext) { var s = String(c && c.industry || '').toLowerCase().replace(/[^a-z0-9]+/g, '-'); return ASSET_BASE + 'gradient-videos/' + s + '.' + ext; }
  /* Perf 2026-09-08 (headed 120Hz trace: 5 simultaneously playing mp4s locked the whole page to
     30fps at open rest - orb 1080x1080 + 3 chips at 800x542 each + heroVideo, ~2.9M px/frame of
     decode+composite at DPR2). Two source-side cuts, zero visual change:
       - orb loops re-encoded to 720x720 (gradient content - softness imperceptible): 1.17M -> 0.52M px
       - chip faces get 96px variants (displayed 36px!): 3x434K -> 3x6K px
     Persona clips stay 800x542 - card B shows them at ~384 CSS px, right-sized for Retina. */
  function gradVidSrc(c) { var s = String(c && c.industry || '').toLowerCase().replace(/[^a-z0-9]+/g, '-'); return ASSET_BASE + 'gradient-videos-720/' + s + '.mp4'; }
  function chipVidFor(vid) { return vid ? vid.replace('persona-videos/', 'persona-videos/chips/') : vid; }
  function bezier(x1, y1, x2, y2) {
    return function (t) {
      var lo = 0, hi = 1, u = t;
      for (var i = 0; i < 20; i++) {
        u = (lo + hi) / 2;
        var vv = 1 - u, x = 3 * vv * vv * u * x1 + 3 * vv * u * u * x2 + u * u * u;
        if (x < t) lo = u; else hi = u;
      }
      var vv2 = 1 - u;
      return 3 * vv2 * vv2 * u * y1 + 3 * vv2 * u * u * y2 + u * u * u;
    };
  }
  var EASE_MORPH = bezier(0.6, 0.04, 0.28, 1);

  /* simple {{ a.b }} / {{ $index }} substitution inside a <template> — no expressions,
     mirrors the dc-runtime hole syntax so the data model above ports unchanged */
  function renderTemplateItem(tpl, item, index) {
    var html = tpl.innerHTML.replace(/\{\{\s*([\w.$]+)\s*\}\}/g, function (_, path) {
      if (path === '$index') return index;
      var val = path.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, item);
      return val == null ? '' : esc(val);
    });
    var wrap = document.createElement('div');
    wrap.innerHTML = html;
    return wrap.firstElementChild;
  }
  function renderList(container, items, onItem) {
    var tpl = container.querySelector('template');
    if (!tpl) return;
    Array.prototype.slice.call(container.children).forEach(function (n) { if (n !== tpl) n.remove(); });
    items.forEach(function (item, i) {
      var node = renderTemplateItem(tpl, item, i);
      if (onItem) onItem(node, item, i);
      container.appendChild(node);
    });
  }

  /* ---------------- controller ---------------- */
  /* The stage markup lives here, not in the Webflow Embed. The Embed keeps only the SEO shell
     (h1, lead, CTA) plus a <div data-aia-hero-mount>; everything below is injected over that
     mount before the ref sweep in initHero. Markup changes then ship by re-uploading this file,
     with no Webflow publish - and a publish flushes every pending Designer change site-wide. */
  var STAGE_HTML = [
    '  <div data-aia-hero-ref="pin" class="aia-pin">',
    '    <div data-aia-hero-ref="sticky" class="aia-sticky">',
    '      <section data-screen-label="Hero stage" data-aia-hero-ref="stage" aria-label="' + t('stageAriaLabel') + '" class="aia-stage" data-open="0">',
    '        <div class="aia-stage-bg"></div>',
    '        <div data-aia-hero-ref="track" class="aia-track">',
    '          <div data-aia-hero-ref="row" class="aia-row">',
    '',
    '            <div data-aia-hero-ref="navRailCol" class="aia-nav-rail-col">',
    '              <div class="aia-nav-rail">',
    '                <div class="aia-nav-list" style="position:relative">',
    '                  <div data-aia-hero-ref="navPill" class="aia-nav-pill"></div>',
    '                  <div data-aia-hero-ref="navList" data-aia-hero-for="verticals" data-aia-hero-as="v" style="display:contents">',
    '                    <template><button type="button" class="aia-nav-item"><span>{{ title }}</span></button></template>',
    '                  </div>',
    '                </div>',
    '              </div>',
    '',
    '              <div data-aia-hero-ref="dropdown" class="aia-dropdown" data-open="0">',
    '                <button type="button" data-aia-hero-click="toggleDropdown" aria-expanded="false" class="aia-dropdown-btn">',
    '                  <span data-aia-hero-ref="dropdownLabel"></span>',
    '                  <svg data-aia-hero-ref="dropdownChevron" width="13" height="8" viewBox="0 0 11 7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M1 1.4L5.5 5.6L10 1.4"></path></svg>',
    '                </button>',
    '                <div data-aia-hero-ref="dropdownList" data-aia-hero-for="verticals" data-aia-hero-as="v" class="aia-dropdown-list">',
    '                  <template><button type="button" class="aia-dropdown-item">{{ title }}</button></template>',
    '                </div>',
    '              </div>',
    '            </div>',
    '',
    '            <div data-aia-hero-ref="pair" class="aia-pair">',
    '              <div data-aia-hero-ref="cardA" class="aia-card-a">',
    '                <div data-aia-hero-ref="mediaSlot" class="aia-media-slot">',
    '                  <div data-aia-hero-ref="mediaFade" class="aia-media-fade"></div>',
    '                  <div data-aia-hero-ref="orbHolder" class="aia-orb-holder">',
    '                    <div data-aia-hero-ref="orbClip" class="aia-orb-clip">',
    '                      <video data-aia-hero-ref="orbVideo" class="aia-orb-video" muted loop playsinline preload="none" aria-hidden="true"></video>',
    '                      <div data-aia-hero-ref="ico_bed" class="aia-icon-badge" data-show="0"><svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path><path d="M22 17v-3h-20"></path><path d="M2 8v9"></path><path d="M12 14h10v-2a3 3 0 0 0 -3 -3h-7v5"></path></svg></div>',
    '                      <div data-aia-hero-ref="ico_scope" class="aia-icon-badge" data-show="0"><svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h-1a2 2 0 0 0 -2 2v3.5a5.5 5.5 0 0 0 11 0v-3.5a2 2 0 0 0 -2 -2h-1"></path><path d="M8 15a6 6 0 1 0 12 0v-3"></path><path d="M11 3v2"></path><path d="M6 3v2"></path><path d="M18 10a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"></path></svg></div>',
    '                      <div data-aia-hero-ref="ico_pill" class="aia-icon-badge" data-show="0"><svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v1a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -1"></path><path d="M10 6v.98c0 .877 -.634 1.626 -1.5 1.77c-.866 .144 -1.5 .893 -1.5 1.77v8.48a2 2 0 0 0 2 2h6a2 2 0 0 0 2 -2v-8.48c0 -.877 -.634 -1.626 -1.5 -1.77a1.795 1.795 0 0 1 -1.5 -1.77v-.98"></path><path d="M7 12h10"></path><path d="M7 18h10"></path><path d="M11 15h2"></path></svg></div>',
    '                      <div data-aia-hero-ref="ico_coin" class="aia-icon-badge" data-show="0"><svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3l0 -8"></path><path d="M3 10l18 0"></path><path d="M7 15l.01 0"></path><path d="M11 15l2 0"></path></svg></div>',
    '                      <div data-aia-hero-ref="ico_heart" class="aia-icon-badge" data-show="0"><svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2"></path><path d="M9 5a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2"></path><path d="M9 12h6"></path><path d="M9 16h6"></path></svg></div>',
    '                      <div data-aia-hero-ref="ico_bolt" class="aia-icon-badge" data-show="0"><svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h1m8 -9v1m8 8h1m-15.4 -6.4l.7 .7m12.1 -.7l-.7 .7"></path><path d="M9 16a5 5 0 1 1 6 0a3.5 3.5 0 0 0 -1 3a2 2 0 0 1 -4 0a3.5 3.5 0 0 0 -1 -3"></path><path d="M9.7 17l4.6 0"></path></svg></div>',
    '                      <div class="aia-orb-sheen"></div>',
    '                    </div>',
    '                  </div>',
    '                  <div data-aia-hero-ref="agentName" class="aia-agent-name"></div>',
    '                  <button type="button" data-aia-hero-click="closeChat" aria-label="' + t('ariaCloseChat') + '" data-aia-hero-ref="threadCloseBtn" class="aia-thread-close" data-chat-open="0">',
    '                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M6.4 6.4l11.2 11.2M17.6 6.4L6.4 17.6"></path></svg>',
    '                  </button>',
    '                </div>',
    '',
    '                <div data-aia-hero-ref="cardTitle" class="aia-card-title"></div>',
    '                <p data-aia-hero-ref="cardBody" class="aia-card-body"></p>',
    '',
    '                <div data-aia-hero-ref="tryAskingA" style="align-self:stretch;margin-top:12px">',
    '                  <div class="aia-try-asking-label">' + t('tryAsking') + '</div>',
    '                  <div data-aia-hero-ref="phrasesA" data-aia-hero-for="phrases" data-aia-hero-as="p" class="aia-try-asking-list">',
    '                    <template><div class="aia-phrase">{{ t }}</div></template>',
    '                  </div>',
    '                </div>',
    '',
    '                <div data-aia-hero-ref="thread" class="aia-thread" style="display:none">',
    '                  <div class="aia-thread-inner">',
    '                    <div data-aia-hero-for="messages" data-aia-hero-as="m" style="display:contents">',
    '                      <template><div class="aia-msg-row"><div class="aia-msg">{{ t }}</div></div></template>',
    '                    </div>',
    '                    <div data-aia-hero-ref="typing" class="aia-typing" style="display:none"><span></span><span></span><span></span></div>',
    '                  </div>',
    '                </div>',
    '',
    '                <div class="aia-controls">',
    '                  <div data-aia-hero-ref="inputPill" class="aia-input-pill" data-open="0">',
    '                    <input data-aia-hero-ref="chatInput" type="text" placeholder="' + t('chatPlaceholder') + '" class="aia-input">',
    '                    <button type="button" data-aia-hero-click="sendMsg" aria-label="' + t('ariaSend') + '" data-aia-hero-ref="sendBtn" class="aia-send-btn" data-active="0">',
    '                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"></path><path d="M5 12l7-7 7 7"></path></svg>',
    '                    </button>',
    '                  </div>',
    '                  <div class="aia-controls-right">',
    '                    <div class="aia-controls-left">',
    '                      <button type="button" data-aia-hero-click="toggleCall" data-aia-hero-ref="callBtn" aria-label="' + t('ariaCall') + '" class="aia-round-btn aia-round-btn--call" data-incall="0">',
    '                        <span data-aia-hero-ref="callTime" class="aia-call-time">00:00</span>',
    '                        <span class="aia-phone-ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="#FFFFFF" stroke-width="0.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"></path></svg></span>',
    '                        <span class="aia-pill-label aia-pill-label--call">' + t('callLabel') + '</span>',
    '                      </button>',
    '                      <button type="button" data-aia-hero-click="toggleChat" data-aia-hero-ref="chatBtn" aria-label="' + t('ariaChat') + '" class="aia-round-btn aia-round-btn--chat">',
    '                        <span class="aia-chat-ico-swap">',
    '                          <span data-part="chat"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"></path></svg></span>',
    '                          <span data-part="x" style="opacity:0"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M6.4 6.4l11.2 11.2M17.6 6.4L6.4 17.6"></path></svg></span>',
    '                        </span>',
    '                        <span class="aia-pill-label aia-pill-label--chat">' + t('chatLabel') + '</span>',
    '                      </button>',
    '                    </div>',
    '                    <a href="#" target="_blank" rel="noreferrer" data-aia-hero-ref="arrowBtn" aria-label="' + t('learnMore') + '" class="aia-arrow-out" data-hover="0">',
    '                      <span class="aia-arrow-out-label">' + t('learnMore') + '</span>',
    '                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"><path d="M6.917 12H4.75"></path><path d="M19.1491 12H10.7461"></path><path d="M13.6992 5.98047L19.7492 12.0005L13.6992 18.0205"></path></svg>',
    '                    </a>',
    '                  </div>',
    '                </div>',
    '              </div>',
    '',
    '              <div data-aia-hero-ref="cardBWrap" class="aia-card-b-wrap">',
    '                <div data-aia-hero-ref="cardB" class="aia-card-b" data-state="idle">',
    '                  <div data-aia-hero-ref="bContent" class="aia-b-content">',
    '                    <div data-aia-hero-ref="bPlainHead" class="aia-b-head">',
    '                      <div data-aia-hero-ref="bAvatar" class="aia-b-avatar"></div>',
    '                      <div style="min-width:0">',
    '                        <div data-aia-hero-ref="bWho" class="aia-b-who"></div>',
    '                        <div class="aia-b-sub"><span data-aia-hero-ref="bSubKey" class="aia-b-sub-key"></span><span data-aia-hero-ref="bSubVal" class="aia-b-sub-val"></span></div>',
    '                      </div>',
    '                    </div>',
    '',
    '                    <div data-aia-hero-ref="bMedia" class="aia-b-media"></div>',
    '                    <div data-aia-hero-ref="bNameFloat" class="aia-b-name-float">',
    '                      <div data-aia-hero-ref="bWhoFloat" class="aia-b-who"></div>',
    '                      <div data-aia-hero-ref="bSubFloat" class="aia-b-name-sub"></div>',
    '                    </div>',
    '',
    '                    <div data-aia-hero-ref="bBody" class="aia-b-body">',
    '                      <div class="aia-b-about-label">' + t('about') + '</div>',
    '                      <p data-aia-hero-ref="bScenario" class="aia-b-about-body"></p>',
    '                      <div data-aia-hero-ref="bFields" data-aia-hero-for="fields" data-aia-hero-as="f" class="aia-field-grid">',
    '                        <template><div><div class="aia-field-k">{{ k }}</div><div class="aia-field-v">{{ v }}</div></div></template>',
    '                      </div>',
    '                    </div>',
    '',
    '                    <div data-aia-hero-ref="bTryAskingWrap" class="aia-b-tryasking">',
    '                      <div class="aia-b-rule"></div>',
    '                      <div class="aia-try-asking-label" style="margin-top:14px">' + t('tryAsking') + '</div>',
    '                      <div data-aia-hero-ref="bPhrases" data-aia-hero-for="phrases" data-aia-hero-as="p" class="aia-try-asking-list">',
    '                        <template><div class="aia-phrase" style="color:#FFFFFF">{{ t }}</div></template>',
    '                      </div>',
    '                    </div>',
    '                  </div>',
    '',
    '                  <div data-aia-hero-ref="bVid" class="aia-b-vid">',
    '                    <video data-aia-hero-ref="heroVideo" muted loop playsinline preload="none" disablepictureinpicture disableremoteplayback aria-hidden="true"></video>',
    '                    <div data-aia-hero-ref="bMediaScrim" class="aia-b-media-scrim"></div>',
    '                  </div>',
    '                </div>',
    '',
    '                <div data-aia-hero-ref="personaChips" role="tablist" aria-label="' + t('ariaPersonas') + '" class="aia-persona-chips">',
    '                  <template><button type="button" role="tab" class="aia-persona-chip"><span class="aia-persona-face"></span><span class="aia-persona-chip-label">{{ first }}</span></button></template>',
    '                </div>',
    '',
    '                <div data-aia-hero-ref="pickHint" class="aia-pick-hint" style="display:none" aria-hidden="true">',
    '                  <div class="aia-pick-hint-text">' + t('pickYourCharacter') + '</div>',
    '                  <svg width="100" height="86" viewBox="0 0 100 86" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M84 4C90 34 74 62 22 76"></path><path d="M22 76L42.5 80.4"></path><path d="M22 76L37.6 62"></path></svg>',
    '                </div>',
    '              </div>',
    '',
    '              <div data-aia-hero-ref="liveRegion" class="aia-sr-only" role="status" aria-live="polite" aria-atomic="true"></div>',
    '',
    '              <div data-aia-hero-ref="ghost" class="aia-ghost" aria-hidden="true">',
    '                <div data-aia-hero-ref="ghostMedia" class="aia-ghost-media"></div>',
    '                <div data-aia-hero-ref="ghostTitle" class="aia-ghost-title"></div>',
    '                <p data-aia-hero-ref="ghostBody" class="aia-ghost-body"></p>',
    '                <div class="aia-ghost-controls">',
    '                  <div class="aia-ghost-controls-left">',
    '                    <span class="aia-round-btn aia-round-btn--call"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="#FFFFFF" stroke-width="0.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"></path></svg><span class="aia-pill-label aia-pill-label--call">' + t('callLabel') + '</span></span>',
    '                    <span class="aia-round-btn"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"></path></svg></span>',
    '                  </div>',
    '                  <span class="aia-arrow-out"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"><path d="M6.917 12H4.75"></path><path d="M19.1491 12H10.7461"></path><path d="M13.6992 5.98047L19.7492 12.0005L13.6992 18.0205"></path></svg></span>',
    '                </div>',
    '              </div>',
    '            </div>',
    '',
    '          </div>',
    '        </div>',
    '      </section>',
    '    </div>',
    '  </div>'
  ].join('\n');

  function initHero(root) {
    /* Swap the mount for the stage. Guarded on the stage rather than the mount so a page that
       still carries the full markup inline keeps working untouched, and so a re-init over a
       hero that is already mounted does not stack a second stage. */
    var mount = root.querySelector('[data-aia-hero-mount]');
    if (mount && !root.querySelector('[data-aia-hero-ref="stage"]')) {
      mount.outerHTML = STAGE_HTML;
      /* MAR-301: label the interactive demo block. Injected (not in the embed HTML) so it
         ships via CDN re-upload without a whole-site Webflow publish. Lives inside the
        pinned stage, top center, so it stays put while the stage is on screen. */
      if (!root.querySelector('[data-aia-stage-header]')) {
        var stageEl = root.querySelector('[data-aia-hero-ref="stage"]');
        var stageHdr = document.createElement('h2');
        stageHdr.className = 'aia-stage-header';
        stageHdr.setAttribute('data-aia-stage-header', '');
        stageHdr.setAttribute('data-aia-hero-ref', 'stageHeader');
        stageHdr.textContent = t('stageHeader');
        stageEl.insertBefore(stageHdr, stageEl.firstChild);
      }
    }

    /* CSS has no access to the ?aia-lang= override; per-locale pill widths key off this attr. */
    root.setAttribute('data-aia-locale', LOCALE);

    /* /es (and future locales): rewrite the SEO shell in place. The shell markup lives in the
       Webflow Embed and custom code is not localizable there, so the JS carries the localized
       shell strings. Tradeoff accepted: crawlers see the English shell, as they already do for
       everything the stage injects. The CTA's first child is the text node; the arrow SVG spans
       after it stay untouched. */
    if (LOCALE !== 'en') {
      var shE = root.querySelector('.aia-hero-eyebrow'); if (shE) shE.textContent = t('shellEyebrow');
      var shT = root.querySelector('.aia-hero-title'); if (shT) shT.textContent = t('shellTitle');
      var shL = root.querySelector('.aia-hero-lead'); if (shL) shL.textContent = t('shellLead');
      var shC = root.querySelector('.aia-hero-cta');
      if (shC && shC.childNodes.length && shC.childNodes[0].nodeType === 3) shC.childNodes[0].nodeValue = t('shellCta');
    }

    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var qs = new URLSearchParams(location.search);
    var seedIndustry = qs.get('industry');
    var seedIdx = Math.floor(Math.random() * CARDS.length);
    var pinned = false;
    if (seedIndustry) {
      var norm = function (s) { return String(s || '').toLowerCase().replace(/[^a-z]/g, ''); };
      var k = CARDS.findIndex(function (c) { return norm(c.industry) === norm(seedIndustry) || norm(c.title) === norm(seedIndustry); });
      if (k >= 0) { seedIdx = k; pinned = true; }
    }

    var st = {
      selected: seedIdx, scen: seedIdx, ghost: null, ghostAt: 0,
      pIdx: Math.floor(Math.random() * (CARDS[seedIdx].personas.length || 1)),
      mode: 'wide', navOpen: false,
      call: false, callStartedAt: 0, callState: 'idle', callTurn: '', level: 0,
      chatOpen: false, messages: [],
      typingLive: false, streaming: false,
      draft: '', arrowHover: false, pickHintDone: false,
      clipFrom: 0, clipTo: 0, clipAt: 0, clipDur: 0, clipP: 0,
      pillY: 0, pillH: 0, stick: 0, chip: 0, ghostPh: 0, nextPIdx: null
    };

    // starts false so the first render defers every clip: the IntersectionObserver reports on
    // its first frame, so an in-view hero loses nothing, and one that is scrolled past costs zero
    var ref = {}, heroSeen = false;
    root.querySelectorAll('[data-aia-hero-ref]').forEach(function (el) { ref[el.getAttribute('data-aia-hero-ref')] = el; });

    /* ---------------- gradient orb: pre-rendered industry loop, poster-first ----------------
       Replaces the canvas OrbEngine. The animated gradient ships as one 1080x1080 mp4 per
       industry under gradient-videos/<slug>.{mp4,jpg}. The poster attribute is the instant still
       the card wears from first paint; the mp4 is fetched only once the hero is on screen, the
       tab visible and the device above the media budget tier (save-data / 2g / reduced-motion /
       low-core keep the poster — which is the same gradient, frame zero). Same lifecycle contract
       as the engine it replaces: start/stop ride the IntersectionObserver and visibility flips,
       setCard swaps the loop under the cover of the swap ghost, and setEnergy keeps the orb
       breathing with the live voice — a scale pulse driven by the same asymmetric attack/release
       envelope the canvas blobs had (attack tau 120ms, release tau 600ms), so the 120ms RMS
       steps from the voice feed read as breathing, not strobing. */
    function OrbVideo(el) {
      var NOOP = { setCard: function () {}, setEnergy: function () {}, setReduced: function () {}, start: function () {}, stop: function () {}, resize: function () {}, paintOnce: function () {} };
      if (!el) return NOOP;
      var clip = el.parentElement || null;
      var tier = perfTier(), reduced = false, live = false, cur = null;
      var want = null, queued = false;
      var energy = 1, energySm = 1, eRaf = 0, lastE = 0;
      function kick() {
        if (!cur) return;
        var src = gradVidSrc(cur);
        // already showing it, already fetching it, or parked on its poster by policy: stand down
        if (want === src && (el.getAttribute('src') || queued)) return;
        want = src;
        el.removeAttribute('src');
        el.poster = gradSrc(cur, 'jpg');
        el.load();
        // a deferred kick leaves want set with no src and nothing queued, so a later start()
        // (hero scrolled into view, tab visible again) gets past the guard above and retries
        if (reduced || !tier || !mediaAllowed()) return;
        queued = true;
        enqueueMedia(function () {
          queued = false;
          if (destroyed || want !== src || !mediaAllowed()) return;
          el.src = src;
          el.muted = true; el.loop = true; el.playsInline = true;
          el.disablePictureInPicture = true; el.disableRemotePlayback = true;
          el.load();
          if (live) { var p = el.play(); if (p && p.catch) p.catch(function () {}); }
        });
      }
      function eStep() {
        if (destroyed) { eRaf = 0; el.style.transform = ''; return; }
        var now = performance.now();
        var dt = lastE ? Math.min(200, now - lastE) : 33;
        lastE = now;
        var k = 1 - Math.exp(-dt / (energy > energySm ? 120 : 600));
        energySm += (energy - energySm) * k;
        var lv = Math.max(0, Math.min(2, (energySm - 1) * 2));
        el.style.transform = lv > 0.02 ? 'scale(' + (1 + lv * 0.055).toFixed(4) + ')' : '';
        if (Math.abs(energy - energySm) > 0.004) eRaf = requestAnimationFrame(eStep);
        else { eRaf = 0; energySm = energy; if (energy <= 1) el.style.transform = ''; }
      }
      return {
        setCard: function (c) {
          cur = c || null;
          if (!cur) return;
          // the same CSS wash the swap ghost wears, under the poster: the clip reads as the
          // industry's gradient from first paint, before the 25KB still has even fetched
          if (clip) clip.style.background = 'radial-gradient(120% 120% at 30% 25%,' + cur.colors[2] + ',' + cur.colors[1] + ' 46%,' + cur.colors[0] + ')';
          kick();
        },
        setEnergy: function (e) {
          energy = e || 1;
          if (!eRaf) { lastE = 0; eRaf = requestAnimationFrame(eStep); }
        },
        setReduced: function (r) {
          reduced = r;
          if (r) {
            if (eRaf) { cancelAnimationFrame(eRaf); eRaf = 0; }
            energy = 1; energySm = 1; el.style.transform = '';
            if (!el.paused) el.pause();
            if (el.getAttribute('src')) { el.removeAttribute('src'); el.load(); }
          } else kick();
        },
        // tier 0 never plays: the poster — that industry's gradient, frame zero — is the hero
        start: function () {
          live = true;
          kick();
          if (el.getAttribute('src') && el.paused) { var p = el.play(); if (p && p.catch) p.catch(function () {}); }
        },
        stop: function () { live = false; if (!el.paused) el.pause(); },
        resize: function () {},
        paintOnce: function () {}
      };
    }

    var orb = OrbVideo(ref.orbVideo);
    orb.setReduced(reduceMotion);

    function card() { return CARDS[st.selected]; }
    function scenCard() { return CARDS[st.scen == null ? st.selected : st.scen]; }
    function persona() {
      var list = scenCard().personas;
      return list[Math.min(st.pIdx || 0, list.length - 1)];
    }

    /* The switcher's faces are live in the source — every persona clip runs as a 36px loop, which
       is the rail's whole charm. Reproduced here, but only where it is affordable: tier 2 devices
       only, and the loops pause whenever the rail is faded out, the hero is off screen or the tab
       is hidden (the source left them running). Below tier 2 the poster still frame stands in. */
    var chipVideosOn = perfTier() > 1 && !reduceMotion, chipsPlaying = false, destroyed = false;
    function kickChipVideo(el, src) {
      if (!el || el.dataset.kick === (src || '')) return;
      if (!el.dataset.guard) {
        el.dataset.guard = '1';
        el.addEventListener('error', function () { el.style.display = 'none'; });
      }
      if (!src) { el.dataset.kick = ''; el.removeAttribute('src'); el.removeAttribute('data-want'); return; }
      el.poster = posterFor(src);
      // the face's own still is already the chip's background — the loop can wait for the rail
      el.setAttribute('data-want', src);
      if (!mediaAllowed() || !chipsPlaying) return;
      enqueueMedia(function () { if (mediaAllowed() && el.getAttribute('data-want') === src) startVideo(el, src); });
    }
    function syncChipPlayback() {
      if (destroyed || !chipVideosOn || !ref.personaChips) return;
      var railUp = st.mode === 'stack' || (lastE == null ? 1 : lastE) > 0.5;
      var want = railUp && heroSeen && !document.hidden;
      if (want === chipsPlaying) return;
      chipsPlaying = want;
      Array.prototype.forEach.call(ref.personaChips.querySelectorAll('video'), function (v) {
        if (!want) { if (!v.paused) v.pause(); return; }
        var pend = v.getAttribute('data-want');
        if (pend && !v.getAttribute('src')) {
          if (mediaAllowed()) enqueueMedia(function () { if (mediaAllowed() && !v.getAttribute('src')) startVideo(v, pend); });
          return;
        }
        var p = v.play(); if (p && p.catch) p.catch(function () {});
      });
    }

    /* ---- video src management: set poster immediately, lazy-load the clip itself ---- */
    /* If a clip (or the whole ASSET_BASE) 404s, the persona box must still read as part of the
       design: fall back to the industry's own gradient and keep the name plate legible, rather
       than leaving a black rectangle in the middle of the hero. */
    /* Nothing media-heavy loads for a hero nobody is looking at. The clips are the page's
       biggest asset by far, so the poster still (a few KB) carries the design until the hero is
       genuinely in view; the clip is fetched only then, and the chip loops only once the rail is
       actually up. Deferred kicks leave data-want set and no data-kick, so the next allowed
       moment retries them. */
    function mediaAllowed() { return heroSeen && !document.hidden && !destroyed; }
    function startVideo(el, src) {
      el.dataset.kick = src;
      el.removeAttribute('data-want');
      el.src = src; el.muted = true; el.loop = true; el.playsInline = true;
      el.disablePictureInPicture = true; el.disableRemotePlayback = true;
      el.load();
      var p = el.play(); if (p && p.catch) p.catch(function () {});
      // every path that starts the hero clip owns its reveal, deferred ones included
      if (el === ref.heroVideo) {
        clearTimeout(el._revealT);
        if (el.readyState >= 2) el.style.opacity = '1';
        else el._revealT = setTimeout(function () { el.style.opacity = '1'; }, 1200);
      }
    }
    /* Every character's first appearance used to show its loading sequence — placeholder, then
       the poster popping in, then the clip fading over it. The stills are a few KB, so they are
       fetched for the whole visible industry as soon as the hero is on screen; the clips follow
       a beat later, off the critical path. Both are keyed so nothing is fetched twice. */
    /* Phase 2 used to fire a burst of work into the exact frame the new card settles on: the chip
       rail rebuilds, three <video> elements get created and load()ed, the height tween starts, an
       enter animation force-reflows — and the warm pool's 420ms timer landed inside the ghost's
       430ms tuck, adding four more creations mid-animation. Everything that is not the visible
       hero clip now goes through one queue that starts at most one element per idle slot, so the
       transition owns its frames. */
    var warmed = {}, warmPool = [], mediaQ = [], mediaT = 0, mediaBusy = false;
    var idleRun = window.requestIdleCallback
      ? function (fn) { return window.requestIdleCallback(fn, { timeout: 1200 }); }
      : function (fn) { return setTimeout(fn, 120); };
    var idleCancel = window.cancelIdleCallback || clearTimeout;
    function enqueueMedia(fn) { mediaQ.push(fn); pumpMedia(); }
    function enqueueMediaFirst(fn) { mediaQ.unshift(fn); pumpMedia(); }
    function pumpMedia() {
      if (mediaBusy || !mediaQ.length) return;
      mediaBusy = true;
      mediaT = idleRun(function () {
        mediaBusy = false;
        if (destroyed) { mediaQ.length = 0; return; }
        var fn = mediaQ.shift();
        if (fn) { try { fn(); } catch (e) {} }
        if (mediaQ.length) setTimeout(pumpMedia, 180);
      });
    }
    function warmIndustry() {
      if (!mediaAllowed()) return;
      var list = (scenCard().personas || []).filter(function (p) { return p && p.vid; });
      list.forEach(function (p) {
        var poster = posterFor(p.vid), k = 'i|' + poster;
        if (warmed[k]) return;
        warmed[k] = 1;
        var im = new Image();
        im.decoding = 'async';
        im.src = poster;
      });
      list.forEach(function (p) {
        var k = 'v|' + p.vid;
        if (warmed[k]) return;
        warmed[k] = 1;
        enqueueMedia(function () {
          if (!mediaAllowed()) return;
          var v = document.createElement('video');
          v.muted = true; v.playsInline = true; v.preload = 'auto';
          v.disablePictureInPicture = true; v.disableRemotePlayback = true;
          v.setAttribute('aria-hidden', 'true');
          v.style.cssText = 'position:absolute;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
          v.src = p.vid;
          (ref.track || root).appendChild(v);
          v.load();
          warmPool.push(v);
          while (warmPool.length > 8) { var old = warmPool.shift(); old.removeAttribute('src'); old.load(); old.remove(); }
        });
      });
      // every industry's stills, lowest priority — B10b (aia-perf): deferred to first
      // interaction (morph-open / industry switch). Only the pinned card is visible at boot,
      // and the cross-industry posters measure ~494KB (~14 @ ~35KB — not the few KB this pass
      // was written for), so they leave the pre-scroll critical path until the user engages.
      // engageStills() re-runs warmIndustry and this pass queues them at idle priority; the
      // active card's stills + mp4s above still warm at boot, so the visible card's first-
      // switch UX is untouched.
      if (!stillsEngaged) return;
      CARDS.forEach(function (c) {
        (c.personas || []).forEach(function (p) {
          if (!p || !p.vid) return;
          var poster = posterFor(p.vid), k = 'i|' + poster;
          if (warmed[k]) return;
          warmed[k] = 1;
          enqueueMedia(function () { var im = new Image(); im.decoding = 'async'; im.src = poster; });
        });
      });
    }
    /* B10b: non-active-industry stills warm only after the user engages with the hero — the
       scroll morph opening (engagement > 0.92, either mode branch) or an explicit industry
       pick. Cheap on the hot path: a boolean check after the first fire. */
    var stillsEngaged = false;
    function engageStills() {
      if (stillsEngaged) return;
      stillsEngaged = true;
      warmIndustry();
    }
    function flushMedia() {
      if (!mediaAllowed()) return;
      var p = persona();
      if (p && p.vid) kickVideo(ref.heroVideo, p.vid);
      warmIndustry();
      if (!chipVideosOn || !ref.personaChips || !chipsPlaying) return;
      Array.prototype.forEach.call(ref.personaChips.querySelectorAll('video'), function (v) {
        var want = v.getAttribute('data-want');
        if (want && !v.getAttribute('src')) enqueueMedia(function () { if (mediaAllowed() && !v.getAttribute('src')) startVideo(v, want); });
      });
    }
    function heroVidPlayback(play) {
      var el = ref.heroVideo;
      if (!el || !el.getAttribute('src') || (destroyed && play)) return;
      if (play) { if (el.paused) { var p = el.play(); if (p && p.catch) p.catch(function () {}); } }
      else if (!el.paused) el.pause();
    }
    function vidFallback() {
      var box = ref.bVid, el = ref.heroVideo;
      if (!box) return;
      var c = scenCard();
      box.style.background = 'radial-gradient(120% 120% at 30% 25%,' + c.colors[2] + ',' + c.colors[1] + ' 46%,' + c.colors[0] + ')';
      if (el) el.style.opacity = '0';
    }
    function kickVideo(el, src) {
      if (!el) return;
      if (el.dataset.kick === (src || '')) return;
      if (el.getAttribute('data-want') === src) return;   // already queued for this exact clip
      if (!el.dataset.guard) {
        el.dataset.guard = '1';
        el.addEventListener('error', vidFallback);
        var reveal = function () { el.style.opacity = '1'; };
        el.addEventListener('loadeddata', reveal);
        el.addEventListener('canplay', reveal);
        el._reveal = reveal;
      }
      if (!src) { el.removeAttribute('src'); el.poster = ''; vidFallback(); return; }
      /* A <video> keeps painting the previous clip's last frame until the new one has data, so a
         persona switch showed the OUTGOING face for as long as the fetch took. The incoming
         persona's own still goes on the box behind, the video is hidden until it has real frames,
         then fades in over its own poster — the wrong face is never on screen. */
      var poster = posterFor(src);
      if (ref.bVid) {
        ref.bVid.style.backgroundImage = 'url("' + poster + '")';
        ref.bVid.style.backgroundSize = 'cover';
        ref.bVid.style.backgroundPosition = '50% 12%';
      }
      el.poster = poster;
      el.setAttribute('data-want', src);
      // the still holds the design until the hero is on screen; no clip bytes before that
      if (!mediaAllowed()) { el.style.opacity = '0'; return; }
      // hidden only until it has real frames — never left hidden if the events don't arrive
      el.style.opacity = el.readyState >= 2 ? '1' : '0';
      clearTimeout(el._revealT);
      el._revealT = setTimeout(function () { el.style.opacity = '1'; }, 1400);
      /* first in the queue, but still off this frame: a cold clip's load() lands right on the
         transition's opening frame otherwise, and the poster already covers the gap */
      enqueueMediaFirst(function () {
        if (mediaAllowed() && el.getAttribute('data-want') === src) startVideo(el, src);
      });
    }

    /* ---------------- scroll morph: transform + opacity only ---------------- */
    var geo = { restW: 0, restOff: 0, restH: 0, openH: 0, pinW: 0, docTop: 0, vh: 0 };
    /* Call this AFTER lockCardHeights(), never before. restH is the track's height with the cards
       at their locked size; read before the lock it gets their natural size and lands ~49px short,
       which then drives the closed stage's scale and the pin's length. Boot used to measure first,
       so whether the hero got the right rest height came down to whether fonts.ready beat the
       first lock — the closed stage rendered at one of two sizes at random across reloads.
       openH is re-derived from what the content needs rather than carried forward, so calling this
       again after growStageIfNeeded() has grown the stage cannot shrink it back under the cards. */
    function measureGeo() {
      var pin = ref.pin, stage = ref.stage, track = ref.track;
      if (!pin || !stage) return;
      var host = pin.parentElement;
      var hr = host.getBoundingClientRect(), cs = getComputedStyle(host);
      var l = hr.left + parseFloat(cs.paddingLeft), r = hr.right - parseFloat(cs.paddingRight);
      geo.restW = Math.max(0, r - l);
      geo.restOff = l - pin.getBoundingClientRect().left;
      var trackH = track ? track.offsetHeight : stage.offsetHeight;
      /* The folded stage renders at exactly restH tall while the inverse-scaled track keeps the
         cards at open-state visual size, so a restH equal to the track's own height clips the
         bottom card flush against the stage edge (overflow:hidden) - the card sat flush with the
         dark edge in both rest states. Solve restH so the folded stage clears the card bottom
         plus a gap: restH = (openH-trackH)/2 + (trackH-padB)*openH/restH + gap, a quadratic in
         restH. Only the pin modes fold; stack mode renders the track unscaled. */
      if (st.mode !== 'stack') {
        var vh0 = window.innerHeight || 800;
        geo.openH = Math.max(trackH, track ? track.scrollHeight : 0, vh0);
        var padB = track ? (parseFloat(getComputedStyle(track).paddingBottom) || 0) : 0;
        var gap = Math.round(vh0 * 0.005);
        var A = gap + Math.max(0, geo.openH - trackH) / 2;
        var C = Math.max(1, trackH - padB) * geo.openH;
        /* Calibrated against live staging (2026-08-28): the card's rendered bottom sits ~60px
           below trackH - padB (lower siblings/margins inside the track), so the solved restH
           overshoots the visible gap by a further ~66px at vh 1030. Trim the solve by 0.06*vh. */
        geo.restH = Math.max(trackH, Math.round((A + Math.sqrt(A * A + 4 * C)) / 2) - Math.round(vh0 * 0.06));
      } else {
        geo.restH = trackH;
      }
      geo.openH = Math.max(geo.restH, track ? track.scrollHeight : 0, window.innerHeight || 800);
      /* cache the per-frame reads scrollNow used to make: pin.clientWidth + pin's doc position
         (getBoundingClientRect). scrollNow also WRITES sticky/pin heights every morph frame, so
         those reads forced a full sync layout per frame - fine idle, frame-killer under load. */
      geo.pinW = pin.clientWidth;
      geo.docTop = pin.getBoundingClientRect().top + (window.scrollY || window.pageYOffset || 0);
      geo.vh = window.innerHeight || 800;
      lastE = null;  // new geometry: scrollNow's ee early-out would otherwise hold the old scale
      if (st.mode === 'stack') { stage.style.height = 'auto'; } else { stage.style.height = geo.openH + 'px'; }
    }

    /* card A/B heights grow with content (call/chat/try-asking) via withHeightTween — the fixed
       stage height computed once by measureGeo() never re-syncs to that on its own, and clips
       the bottom of a taller card under the stage's overflow:hidden. Grow (never shrink, to
       avoid jitter while a card is mid-tween) whenever the content needs more room than the
       stage currently reserves. */
    function growStageIfNeeded() {
      var stage = ref.stage, track = ref.track;
      if (!stage || !track || st.mode === 'stack') return;
      var need = track.scrollHeight;
      if (need > geo.openH) {
        geo.openH = need;
        stage.style.height = geo.openH + 'px';
        lastE = null; // force scrollNow to re-apply scale against the new openH
        onScroll();
      }
    }

    var lastE = null, lastSE = null, scrollQ = 0, unpinned = false;
    function onScroll() { if (!scrollQ) scrollQ = requestAnimationFrame(scrollNow); }

    /* reduced motion renders the END of the morph, it does not skip the morph's layout: with the
       scroll handler simply never bound, the stage stayed at its folded rest transform and the
       scenario card stayed tucked behind the white one — invisible for the whole visit. */
    function applyOpen() {
      var stage = ref.stage, track = ref.track, sticky = ref.sticky, pin = ref.pin;
      if (!stage) return;
      lastE = 1;
      stage.style.transform = 'none';
      if (track) track.style.transform = 'none';
      if (st.mode === 'stack') {
        stage.style.width = ''; stage.style.marginLeft = ''; stage.style.borderRadius = '';
        stage.style.height = 'auto';
        if (pin) pin.style.height = 'auto';
        if (sticky) sticky.style.height = 'auto';
      } else {
        stage.style.height = geo.openH + 'px';
        if (sticky) sticky.style.height = geo.openH + 'px';
        if (pin) pin.style.height = geo.openH + 'px';
      }
      stage.setAttribute('data-open', '1');
      setStageHeaderTop(1);
      setMorphing(false);
      slidePair(1);
      fadeChipsAndHint(1);
    }

    /* The stage header used to sit on a data-open flip at 0.92 engagement with a .3s CSS
       transition - a wall-clock tween layered over the scroll-driven zoom, so the text slid
       late and snapped back on fast scrolls. Drive it from the same eased engagement as the
       morph instead: position stays a pure function of scrollY, perfectly synced, no timer.
       Clamps mirror the CSS rest values; JS owns the in-between. */
    var hdrVW = 0, hdrH = 0, hdrNavEl = null, hdrGone = false;
    function measureStageHeader() {
      hdrVW = (document.documentElement && document.documentElement.clientWidth) || window.innerWidth || 1280;
      if (ref.stageHeader) hdrH = ref.stageHeader.offsetHeight;
    }
    function stageHeaderTops() {
      var cl = function (lo, f, hi) { return Math.max(lo, Math.min(hi, hdrVW * f)); };
      /* folded anchors to the card top edge (track padding-top clamp(30px,7vw,108px))
         minus header height + 12px gap - the old cl(84,.09,116) landed mid-card-edge at
         desktop widths and Nathan's screenshot had the text straddling the card. open sits
         ~30px above the measured nav->card gap center (Nathan: higher, but not hugging the
         nav at the ~63px his CSS-only trial computed - CSS top is inert, JS owns it), then
         nudged +16px back down ("down slightly further") to land on gap center at 1440-1512,
         then +8px more ("just a little bit further down"). */
      return { folded: Math.max(12, cl(30, .07, 108) - hdrH - 12), open: cl(104, .08, 144) };
    }
    function setStageHeaderTop(ee) {
      if (!ref.stageHeader || !ref.stage) return;
      var e = Math.max(0, Math.min(1, ee));
      if (st.mode !== 'wide' && ref.dropdown && ref.pair) {
        /* compact/stack show the industry dropdown where wide shows the nav rail, and any
           fixed top lands inside the pill or the cards (Nathan's screenshots: text striking
           through the pill). Center in the LIVE pill->cards gap every frame instead - captured
           anchors drifted when card-height locks re-centered the row after measureGeo ran.
           Positions are visual px; the header top is stage-local (pre-scale), so divide out
           the current scale (1 in stack, which is untransformed). */
        var sr = ref.stage.getBoundingClientRect();
        var gapTop = ref.dropdown.getBoundingClientRect().bottom - sr.top;
        var gapBot = ref.pair.getBoundingClientRect().top - sr.top;
        var sy = st.mode === 'stack' ? 1 : lerp(geo.restH / Math.max(1, geo.openH), 1, e);
        var hVis = (hdrH || 29) * sy;
        var slack = gapBot - gapTop - hVis;
        var c = gapTop + Math.max(0, slack) / 2;
        var topVis = slack >= 16 ? Math.min(Math.max(c, gapTop + 8), gapBot - 8 - hVis) : Math.max(c, gapTop + 3);
        ref.stageHeader.style.top = (topVis / Math.max(0.01, sy)).toFixed(1) + 'px';
        return;
      }
      var t = stageHeaderTops();
      var top = lerp(t.folded, t.open, e);
      /* The wide clamps are VW-only, but the pair's visual top collapses to the track padding
         - or rises under the folded inverse zoom - when the stage has no vertical slack
         (short vh makes openH = track height; a tall seeded card grows openH while restH
         stays). Fit the header into the LIVE nav->cards window instead: never cross the
         cards, never slide under the fixed nav, and when the window is shorter than the
         header (very short viewports) fade it out rather than straddle either edge.
         All math in visual px from this frame's rects; shifting style.top by d moves the
         header d*sy visual px regardless of the stage's transform origin. Hysteresis on the
         hide threshold so a scroll position hovering at the boundary cannot flicker. */
      if (ref.pair) {
        var syW = Math.max(0.01, lerp(geo.restH / Math.max(1, geo.openH), 1, e));
        var curTop = parseFloat(ref.stageHeader.style.top);
        var hrNow = ref.stageHeader.getBoundingClientRect();
        var prNow = ref.pair.getBoundingClientRect();
        if (!hdrNavEl) hdrNavEl = document.querySelector('.w-nav') || document.querySelector('header') || document.querySelector('nav');
        var navBot = 0;
        if (hdrNavEl) { var nrNow = hdrNavEl.getBoundingClientRect(); if (nrNow.height > 0 && nrNow.bottom > 0) navBot = nrNow.bottom; }
        var winTop = navBot + 2, winBot = prNow.top - 6, need = hrNow.height;
        /* hide only when the window truly cannot fit the header; re-show needs 8px of
           extra room so a scroll position parked at the boundary cannot flicker. The
           position clamp runs either way so style.top stays continuous across the flip. */
        hdrGone = hdrGone ? (winBot - winTop < need + 8) : (winBot - winTop < need);
        ref.stageHeader.style.opacity = hdrGone ? '0' : '';
        var wantTopVis = isNaN(curTop) ? hrNow.top : hrNow.top + (top - curTop) * syW;
        var hi = winBot - need;
        if (hi < winTop) { var mid = (winTop + hi) / 2; winTop = mid; hi = mid; }
        top += (Math.min(Math.max(wantTopVis, winTop), hi) - wantTopVis) / syW;
        if (top < 12) top = 12;
      }
      ref.stageHeader.style.top = top.toFixed(1) + 'px';
    }

    /* 120Hz profiling (headed, DPR2, gesture scroll): card-b's backdrop-filter:blur(24px)
       re-blurs the full card region every morph frame (p95 frame 99.6ms -> 16.8ms without it,
       >33ms hitches 25 -> 6) and the orb mp4 adds the remaining spikes (combined p95 9.4ms,
       >33ms -> 2). Suspend both while the morph is moving, restore when it settles - the
       frosted look is unreadable mid-motion anyway. Blur off via the .aia-morphing class;
       orb paused at the element level so OrbVideo's live flag and IO/visibility policy stay
       authoritative for everything else. (Gating ALL stage videos was tried and reverted:
       pause()x5 at gesture start + resume()x5 at settle cost more frames than the decode
       they saved - cold-load >16.7 went 15-19 -> 27-28.) */
    var morphing = false, orbWasPlaying = false, morphOffTimer = 0;
    function setMorphing(on) {
      if (on) {
        if (morphOffTimer) { clearTimeout(morphOffTimer); morphOffTimer = 0; }
        if (morphing) return;
        morphing = true;
        if (ref.stage) ref.stage.classList.add('aia-morphing');
        var ov = ref.orbVideo;
        if (ov) { orbWasPlaying = !ov.paused; if (orbWasPlaying) ov.pause(); }
        return;
      }
      /* restoring blur + orb costs a re-raster/video-resume spike - land it in stillness,
         250ms after the last morph frame, where a stalled frame is invisible */
      if (!morphing || morphOffTimer) return;
      morphOffTimer = setTimeout(function () {
        morphOffTimer = 0;
        morphing = false;
        if (ref.stage) ref.stage.classList.remove('aia-morphing');
        var ov = ref.orbVideo;
        if (ov && orbWasPlaying && heroSeen && !document.hidden) {
          var p = ov.play();
          if (p && p.catch) p.catch(function () {});
        }
        orbWasPlaying = false;
      }, 250);
    }

    function scrollNow() {
      scrollQ = 0;
      var pin = ref.pin, stage = ref.stage, sticky = ref.sticky, track = ref.track;
      if (!pin || !stage) return;
      if (reduceMotion) { applyOpen(); return; }
      var pinW = geo.pinW || pin.clientWidth;

      if (st.mode === 'stack') {
        if (pendingOpen) runPendingOpen();
        if (!unpinned) {
          unpinned = true; lastE = null; lastSE = null;
          stage.style.transform = 'none';
          if (track) track.style.transform = 'none';
          stage.style.height = 'auto';
          pin.style.height = 'auto';
          if (sticky) sticky.style.height = 'auto';
          slidePair(1);
        }
        /* Stacked, the hero is a normal block with no pin, so it can afford the source's own
           width/margin/radius write (one section, two cards, no sticky) — a transform+inverse
           -scale morph would need the track wider than the visible stage and clip the cards. */
        var vhs = window.innerHeight || 800;
        var r = stage.getBoundingClientRect();
        var overlap = Math.min(r.bottom, vhs) - Math.max(r.top, 0);
        var frac = overlap / Math.max(1, Math.min(r.height, vhs));
        var ses = smooth(clamp01((frac - 0.5) / 0.4));
        if (lastSE == null || Math.abs(lastSE - ses) > 0.002) {
          lastSE = ses;
          stage.style.width = lerp(geo.restW || pinW, pinW, ses).toFixed(1) + 'px';
          stage.style.marginLeft = (geo.restOff * (1 - ses)).toFixed(1) + 'px';
          stage.style.borderRadius = (22 * (1 - ses)).toFixed(2) + 'px';
          stage.setAttribute('data-open', ses > 0.92 ? '1' : '0');
          if (ses > 0.92) engageStills();
          setStageHeaderTop(ses);
          setMorphing(ses > 0.001 && ses < 0.999);
        }
        return;
      }
      if (unpinned) {
        unpinned = false; lastE = null; lastSE = null;
        stage.style.width = ''; stage.style.marginLeft = ''; stage.style.borderRadius = '';
        stage.style.height = geo.openH + 'px';
      }

      var vh = geo.vh || window.innerHeight || 800;
      var y = window.scrollY || window.pageYOffset || 0;
      var docTop = geo.docTop || (pin.getBoundingClientRect().top + y);
      var enter = clamp01(y / Math.max(1, docTop));
      var scrollLen = Math.round(vh * 0.7);
      var inner = clamp01((y - docTop) / scrollLen);
      var exit = clamp01((inner - 0.45) / 0.55);
      var e = Math.min(enter, 1 - exit);
      var ee = smooth(e);
      if (pendingOpen && ee > 0.995) runPendingOpen();
      if (ee === lastE) return;
      lastE = ee;

      var restW = geo.restW || pinW, restH = geo.restH || stage.offsetHeight, openH = geo.openH || (window.innerHeight || 800);
      var sx = lerp(restW / Math.max(1, pinW), 1, ee);
      var sy = lerp(restH / Math.max(1, openH), 1, ee);
      var tx = lerp(geo.restOff, 0, ee);
      stage.style.transform = 'translate3d(' + tx.toFixed(1) + 'px,0,0) scale(' + sx.toFixed(4) + ',' + sy.toFixed(4) + ')';
      if (track) track.style.transform = 'scale(' + (1 / sx).toFixed(4) + ',' + (1 / sy).toFixed(4) + ')';
      /* the pinned length has to cover the fold-back too: at a fixed 120vh the sticky released
         while the stage was still shrinking, so the tail of the morph played un-pinned and the
         whole stage slid up mid-animation */
      var visH = restH + Math.max(0, vh - restH) * ee;
      if (sticky) sticky.style.height = visH.toFixed(1) + 'px';
      pin.style.height = (visH + scrollLen).toFixed(1) + 'px';
      stage.setAttribute('data-open', ee > 0.92 ? '1' : '0');
      if (ee > 0.92) engageStills();
      setStageHeaderTop(ee);
      setMorphing(ee > 0.001 && ee < 0.999);
      fadeChipsAndHint(ee);
      slidePair(ee);
    }

    function fadeChipsAndHint(ee) {
      if (ref.personaChips && st.mode !== 'stack') {
        var co = Math.max(0, Math.min(1, (ee - 0.5) / 0.5));
        ref.personaChips.style.opacity = co.toFixed(3);
        ref.personaChips.style.pointerEvents = ee > 0.6 ? 'auto' : 'none';
        // an invisible rail must not be tabbable — opacity alone leaves the buttons focusable
        ref.personaChips.style.visibility = co > 0.02 ? 'visible' : 'hidden';
        syncChipPlayback();
      }
      if (ref.pickHint) {
        var show = hintOn && !hintFading && !st.pickHintDone;
        ref.pickHint.style.opacity = show ? Math.max(0, Math.min(1, (ee - 0.82) / 0.18)).toFixed(3) : '0';
      }
    }

    /* the scenario card rests tucked behind the white card and slides out to the right as the
       stage opens; the pair's negative right margin keeps the row optically centred on what is
       actually visible, and the nav rail rides in close beside the white card while it's tucked.
       Distances come from measureShift's cached geometry — no layout reads on the scroll path. */
    var NAV_GAP_TUCKED = 40;
    function slidePair(ee) {
      var pair = ref.pair, b = ref.cardBWrap, nav = ref.navRailCol;
      if (!pair || !b) return;
      var d = st.mode === 'stack' ? 0 : (geo.pairD || 0);
      if (d <= 0) {
        b.style.transform = 'none';
        pair.style.marginRight = '0px';
        if (nav) nav.style.transform = 'none';
        return;
      }
      var hidden = d * (1 - ee);
      b.style.transform = 'translateX(' + (-hidden).toFixed(1) + 'px)';
      pair.style.marginRight = (-hidden).toFixed(1) + 'px';
      if (nav) {
        var close = st.mode === 'wide' ? Math.max(0, (geo.navGap || 0) - NAV_GAP_TUCKED) * (1 - ee) : 0;
        nav.style.transform = close > 0.5 ? 'translateX(' + close.toFixed(1) + 'px)' : 'none';
      }
    }

    /* horizontal geometry of the pinned stage, solved once per (mode, pin width): how far the row
       slides left to optically centre the card pair, whether the "pick your character" annotation
       has room beside it, and the tuck distance slidePair animates. Never depends on which persona
       is showing, or auto-advance would shuffle the layout under the reader. */
    var HINT_W = 176, HINT_GAP = 64, HINT_MIN_GAP = 8, NAV_EDGE = 40, CHIP_ROOM = 74;
    var geoKey = null, geoTries = 0, geoT = 0;
    function measureShift(force) {
      var row = ref.row, tr = ref.track, pin = ref.pin, nav = ref.navRailCol, pair = ref.pair;
      if (!row || !pin || !pair) return;
      var mode = st.mode, pinW = pin.clientWidth, key = mode + ':' + pinW;
      if (!force && geoKey === key) return;
      geo.pairD = (mode !== 'stack' && ref.cardBWrap && ref.cardA) ? Math.max(0, ref.cardBWrap.offsetLeft - ref.cardA.offsetLeft) : 0;
      if (mode === 'stack') {
        row.style.transform = 'none'; row.style.justifyContent = 'center';
        geo.navGap = 0; geoKey = key; setHintRoom(false);
        return;
      }
      var pairW = pair.offsetWidth;
      if (pairW < 700) {  // measured before the cards have their real width — retry, never cache
        row.style.transform = 'none'; geoKey = null; setHintRoom(false);
        if (++geoTries < 30) { clearTimeout(geoT); geoT = setTimeout(function () { requestAnimationFrame(function () { measureShift(true); }); }, 60); }
        return;
      }
      geoKey = key;
      var padX = tr ? (parseFloat(getComputedStyle(tr).paddingLeft) || 0) : 0;
      var stageOpen = Math.min(1600, pinW);
      var trackL = Math.max(0, (pinW - stageOpen) / 2) + padX;
      var avail = Math.max(0, stageOpen - padX * 2);
      var navW = (mode === 'wide' && nav) ? nav.offsetWidth : 0;
      var gap = (mode === 'wide' && nav) ? Math.max(0, pair.offsetLeft - (nav.offsetLeft + navW)) : 0;
      geo.navGap = gap;
      var slack = (avail - navW - gap - pairW) / 2;
      if (slack < CHIP_ROOM) {
        // nothing to give: start the row at the left edge so the chip rail can never be clipped
        row.style.justifyContent = 'flex-start';
        row.style.transform = 'none';
        setHintRoom(false);
        fadeChipsAndHint(lastE == null ? 1 : lastE);
        return;
      }
      row.style.justifyContent = 'center';
      var ideal = (navW + gap) / 2;
      var shift = Math.max(0, Math.min(ideal, trackL + slack - NAV_EDGE));
      row.style.transform = shift > 0.5 ? 'translateX(-' + shift.toFixed(1) + 'px)' : 'none';
      /* The annotation is absolutely positioned off the pair's right edge (left:100% + 64px margin
         + 176px wide), so the only honest test is the measured gap from that edge to the stage
         edge. The arithmetic this replaced summed slack/shift/trackL and came out under the
         threshold at widths with obvious room — the hint simply never rendered. */
      /* Measured from untransformed geometry on purpose: measureShift runs while the stage is
         still in its folded rest transform, so reading live rects here answers for the WRONG
         state. Open state, the room to the right of the pair is its share of the free space,
         plus the left shift, plus the track padding the annotation is allowed to sit in.
         The annotation then ADAPTS to that room rather than vanishing: demanding its full
         64px offset meant it only ever appeared above ~1420px, which is why it read as simply
         broken at ordinary desktop widths. */
      fitHint(slack + shift + trackL);
      fadeChipsAndHint(lastE == null ? 1 : lastE);
    }

    var hintOn = false, hintRoom = false;
    /* measureShift decides whether the annotation has room, but it runs AFTER the render that
       reads the flag (init order: render -> measureShift), and nothing re-rendered afterwards —
       so the hint was computed as visible and then never actually shown. Flipping the flag now
       triggers the render that acts on it. */
    function setHintRoom(v) {
      if (hintRoom === v) return;
      hintRoom = v;
      if (ref.pickHint) render();
    }
    function fitHint(avail) {
      var w = (ref.pickHint && ref.pickHint.offsetWidth) || HINT_W;
      if (ref.pickHint && avail >= w + HINT_MIN_GAP) {
        ref.pickHint.style.marginLeft = Math.max(HINT_MIN_GAP, Math.min(HINT_GAP, avail - w - 6)).toFixed(0) + 'px';
      }
      setHintRoom(avail >= w + HINT_MIN_GAP);
    }
    function modeFor(w) { return w >= 1400 ? 'wide' : w >= 1024 ? 'compact' : 'stack'; }
    function syncMode() {
      var m = modeFor(ref.pin ? ref.pin.clientWidth : window.innerWidth);
      if (m !== st.mode) {
        st.mode = m; root.setAttribute('data-aia-hero-mode', m); st.navOpen = false;
        if (ref.personaChips && m === 'stack') { ref.personaChips.style.opacity = ''; ref.personaChips.style.pointerEvents = ''; }
        render();
        measureShift(true);
      }
    }

    function handleResize() {
      syncMode();
      measureShift(true);
      measureStageHeader();
      lockCardHeights(false);
      measureGeo();
      onScroll();
      measurePill();
      growStageIfNeeded();
    }

    /* ---------------- pill highlight (wide nav) ---------------- */
    function measurePill() {
      if (!ref.navList || st.mode !== 'wide') return;
      var btn = ref.navList.querySelectorAll('.aia-nav-item')[st.selected];
      if (!btn) return;
      st.pillY = btn.offsetTop; st.pillH = btn.offsetHeight; st.pillOn = 1;
      if (ref.navPill) {
        ref.navPill.style.opacity = '1';
        ref.navPill.style.height = st.pillH + 'px';
        ref.navPill.style.transform = 'translateY(' + st.pillY + 'px)';
      }
    }

    /* The card shuffle only has room to play once the stage is open — the outgoing card slides
       across the gap the scenario card leaves behind, and that gap is zero while folded. A click
       from the folded state scroll-tweens the hero open first, then runs the swap on that beat.
       rAF rather than native smooth scroll, so the swap starts on a known beat. */
    var pendingOpen = null, scrollRaf = 0;
    function targetOpenY() {
      var pin = ref.pin;
      if (!pin) return null;
      return Math.round(pin.getBoundingClientRect().top + (window.scrollY || window.pageYOffset || 0));
    }
    function runPendingOpen() { var fn = pendingOpen; if (!fn) return; pendingOpen = null; fn(); }
    function scrollTween(top, ms, done) {
      cancelAnimationFrame(scrollRaf);
      var start = window.scrollY || window.pageYOffset || 0, dist = top - start;
      if (Math.abs(dist) < 2) { done(); return; }
      var t0 = performance.now();
      var step = function () {
        var p = Math.min(1, (performance.now() - t0) / ms);
        var k = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        window.scrollTo(0, Math.round(start + dist * k));
        if (p < 1) scrollRaf = requestAnimationFrame(step); else done();
      };
      scrollRaf = requestAnimationFrame(step);
    }
    // a reader who scrolls or swipes mid-tween wins: abandon the tween, run the swap anyway
    function abandonTween() {
      if (!pendingOpen) return;
      cancelAnimationFrame(scrollRaf);
      runPendingOpen();
    }
    function whenOpen(fn) {
      if (st.mode === 'stack' || (lastE == null ? 1 : lastE) > 0.995) { fn(); return; }
      var top = targetOpenY();
      if (top == null) { fn(); return; }
      pendingOpen = fn;
      scrollTween(top, 460, runPendingOpen);
    }

    /* ---------------- industry swap (ghost transition, time-based) ---------------- */
    function pickIndustry(i) {
      engageStills();   // B10b: an explicit industry interaction arms the cross-industry stills warm
      if (i === st.selected) {
        // re-selecting the current industry is an exit-to-menu: tear the call/chat down like a
        // cross-industry swap would, or the LiveKit call keeps running with no way to end it
        // and the next "start call" toggle just hangs the current one up instead of dialling
        if (st.call) endCall(true);
        if (st.chatOpen) closeChat();
        return;
      }
      var prev = st.selected;
      voice.end(); chat.close();
      st.call = false; st.callState = 'idle'; st.level = 0;
      st.chatOpen = false; st.messages = [];
      st.streaming = false; st.typingLive = false;
      st.selected = i;
      /* The new industry's persona index has to wait for phase 2. pIdx indexes whichever list is
         currently rendered, so applying it now re-pointed it at the OLD industry's personas and
         flashed a different face in card B — which is still uncovered for the ghost's whole
         470ms travel. A re-entrant pick keeps st.scen where it is so card B never jumps mid-swap. */
      var inFlight = st.ghost != null && st.ghostPh === 1;
      st.nextPIdx = Math.floor(Math.random() * (CARDS[i].personas.length || 1));
      // phase 1: the outgoing card is a ghost copy sliding right; the orb + persona card stay on
      // the OLD industry (st.scen) underneath it until the ghost clears at OUT_MS (phase 2)
      st.ghost = prev; st.ghostAt = performance.now(); st.ghostPh = 1;
      if (!inFlight) st.scen = prev;
      populateGhost(CARDS[prev]);
      ghostOut();
      /* Belt and braces on the handover. The phase machine used to assume the ticker observed
         every phase, so a dropped frame that jumped it straight from 1 to 0 skipped phase 2 —
         the ONLY place st.scen advances — and left the hero permanently split: card A on the new
         industry, the orb and persona card on the old one, with no way back. Now the phases are
         idempotent, phase 0 applies phase 2 first, and timers back up the rAF path (rAF stops
         dead in a background tab; timers fire on return). */
      clearTimeout(swapT1); clearTimeout(swapT2);
      swapT1 = setTimeout(swapPhase2, OUT_MS + 16);
      swapT2 = setTimeout(swapPhase0, OUT_MS + BACK_MS + 16);
      withHeightTween(render);
      replayAnim(ref.cardTitle, 'aia-fade-up', '.5s');
      replayAnim(ref.cardBody, 'aia-fade-up', '.5s');
      tickAnimations();
    }
    /* outgoing card slides right over the scenario card, revealing the new card underneath,
       then tucks back in behind it */
    function ghostOut() {
      var g = ref.ghost, a = ref.cardA, b = ref.cardBWrap;
      if (!g || !a || !b) return;
      if (reduceMotion) { g.style.display = 'none'; g.style.opacity = '0'; return; }
      var d = Math.max(0, b.offsetLeft - a.offsetLeft);
      var D = d * (lastE == null ? 1 : lastE);
      g.style.display = 'flex';
      g.style.transition = 'none';
      g.style.zIndex = '5';
      g.style.transform = 'translateX(0px) scale(1)';
      void g.offsetWidth;
      if (D < 40) { g.style.opacity = '0'; return; }
      g.style.opacity = '1';
      g.style.transition = 'transform ' + OUT_MS + 'ms cubic-bezier(.5,.02,.16,1)';
      g.style.transform = 'translateX(' + D.toFixed(1) + 'px) scale(1)';
    }
    function ghostBack() {
      var g = ref.ghost;
      if (!g) return;
      g.style.zIndex = '2';
      g.style.transition = 'transform ' + BACK_MS + 'ms cubic-bezier(.32,.72,.24,1), opacity ' + BACK_MS + 'ms cubic-bezier(.4,0,.7,1)';
      g.style.transform = 'translateX(0px) scale(0.965)';
      g.style.opacity = '0';
    }
    var swapT1 = 0, swapT2 = 0;
    function swapPhase2() {
      if (st.ghost == null || st.ghostPh >= 2) return;
      st.ghostPh = 2;
      ghostBack();
      if (st.nextPIdx != null) { st.pIdx = st.nextPIdx; st.nextPIdx = null; }
      st.scen = st.selected; st.stick++; st.chip++;
      withHeightTween(render);
      replayAnim(ref.bContent, 'aia-fade-up', '.5s');
      warmIndustry();
    }
    function swapPhase0() {
      if (st.ghost == null) return;
      swapPhase2();               // a 1 -> 0 jump still owes the industry handover
      st.ghost = null; st.ghostPh = 0;
      if (ref.ghost) { ref.ghost.style.transition = 'none'; ref.ghost.style.display = 'none'; }
      render();
    }
    function populateGhost(gc) {
      if (ref.ghost && ref.cardA) ref.ghost.style.height = ref.cardA.offsetHeight + 'px';
      if (ref.ghostTitle) ref.ghostTitle.textContent = gc.title;
      if (ref.ghostBody) ref.ghostBody.textContent = gc.bodyLabel || gc.body;
      if (ref.ghostMedia) {
        /* The copy has to be pixel-identical to card A or it jumps the moment it appears. The
           badge is positioned against the 440x300 .aia-orb-clip, which overflows its 384x262
           holder by 28px/19px — parenting it straight to the media block (as this did) put the
           icon 33px right and 19px high of where card A has it, a visible static jump on every
           swap. Same holder/clip nesting here, gradient on the clip. */
        ref.ghostMedia.innerHTML = '';
        var holder = document.createElement('div');
        holder.className = 'aia-orb-holder';
        var clip = document.createElement('div');
        clip.className = 'aia-orb-clip';
        clip.style.background = 'radial-gradient(120% 120% at 30% 25%,' + gc.colors[2] + ',' + gc.colors[1] + ' 46%,' + gc.colors[0] + ')';
        // the outgoing industry's gradient, frame zero: the same loop the orb was wearing, as a
        // still — the ghost lives under half a second, so a poster beats cloning the element
        var gp = document.createElement('img');
        gp.src = gradSrc(gc, 'jpg');
        gp.alt = '';
        gp.setAttribute('aria-hidden', 'true');
        gp.className = 'aia-orb-video';
        clip.appendChild(gp);
        var ico = document.createElement('div');
        ico.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round">' + ICONS[gc.icon] + '</svg>';
        ico.className = 'aia-icon-badge';
        ico.style.color = '#FFFFFF';
        clip.appendChild(ico);
        holder.appendChild(clip);
        ref.ghostMedia.style.background = '';
        ref.ghostMedia.appendChild(holder);
      }
    }
    function ghostPhase(now) {
      if (st.ghost == null) return 0;
      var e = now - st.ghostAt;
      if (e < OUT_MS) return 1;
      if (e < OUT_MS + BACK_MS) return 2;
      return 0;
    }

    /* ---------------- persona pick ---------------- */
    var hintFading = false, hintT = 0;
    function pickPersona(k) {
      if (st.ghostPh === 1) return; // the rail showing is about to be replaced by phase 2
      if ((st.pIdx || 0) === k) {
        // same guard as pickIndustry: re-picking the current persona mid-call is an
        // exit-to-menu, so hang up instead of silently keeping the call alive
        if (st.call) endCall(true);
        if (st.chatOpen) closeChat();
        return;
      }
      // the nudge has done its job the moment a character is picked by hand — fade it out first,
      // then unmount, so it never blinks away
      if (!st.pickHintDone && !hintFading) {
        hintFading = true;
        if (ref.pickHint) ref.pickHint.style.opacity = '0';
        clearTimeout(hintT);
        hintT = setTimeout(function () { st.pickHintDone = true; hintFading = false; render(); }, 460);
      }
      // all 3 personas of a card share one agent and the agent never knew which card was up
      // (the card is the visitor's cheat-sheet, not agent context), so a persona switch keeps
      // whatever call or chat is live running under the new card. Continuity is the demo: a
      // canned flow resets on card switch, a live agent does not. warmVoice/warmChat are
      // no-ops while a session is live — same vertical, same agent.
      st.pIdx = k;
      st.stick++;
      warmVoice(); warmChat();   // picking a character by hand is real intent - worth the preload

      withHeightTween(render);
      replayAnim(ref.bContent, 'aia-fade-up', '.5s');
    }

    /* ---------------- live agents ----------------
       Read the vertical off st.scen, not st.selected: scenCard() lags the selection by up to
       OUT_MS during an industry swap, and the visible persona card is what the user is calling. */
    function liveKey() {
      var k = verticalKey(scenCard());
      return CRESTA_AGENTS[k] ? k : null;
    }
    function warmVoice() { var k = liveKey(); if (k) voice.ensure(k); }
    function warmChat() { var k = liveKey(); if (k) chat.warm(k); }
    function callEnergy() {
      // floor of 1.35 so the orb reacts the instant a call starts, before any audio arrives;
      // span widened 0.65 -> 1.15 so typical speech (RMS ~0.3-0.6) lands mid-band, not at the floor
      return st.call ? 1.35 + Math.min(1, Math.max(0, st.level || 0)) * 1.15 : 1;
    }
    var voice = createVoice({
      onConnected: function () {
        st.callState = 'live';
        st.callStartedAt = performance.now();   // timer leads the greeting instead of the tap
        render(); tickAnimations();
      },
      onState: function (key, state) { st.callTurn = state; },
      onLevel: function (key, level) { st.level = level || 0; },
      onTruncated: function (key) { console.warn('[aia-hero] voice greeting truncated, silent restart in flight', key); },
      onEnded: function () { if (st.call) endCall(false); },
      onFailed: function (key, reason) {
        console.warn('[aia-hero] voice failed', key, reason);
        if (st.call) endCall(false);
      }
    });
    var chat = createChat({
      onStream: function (text, done) { pushStream(text, done); },
      onTyping: function () { st.typingLive = true; render(); tickAnimations(); },
      onDone: function () { st.typingLive = false; st.streaming = false; render(); }
    });

    /* ---------------- call ---------------- */
    function endCall(hangup) {
      if (hangup) voice.end();
      st.call = false; st.callState = 'idle'; st.level = 0; st.callTurn = '';
      withHeightTween(render); tickAnimations();
    }
    function toggleCall() {
      if (st.call) { endCall(true); return; }
      st.chatOpen = false;
      st.call = true; st.callStartedAt = performance.now(); st.level = 0;
      var k = liveKey();
      // start() has to run inside this tap - getUserMedia refuses outside a user gesture
      st.callState = (k && voice.start(k)) ? 'connecting' : 'live';
      withHeightTween(render); tickAnimations();
    }

    /* ---------------- chat ----------------
       Live agents only. When the live path fails (recaptcha, network, domain) the thread shows
       a neutral notice instead of a scripted conversation - there is no offline demo script. */
    function liveNotice() {
      st.typingLive = false; st.streaming = false;
      st.messages = st.messages.concat([{ from: 'agent', t: t('liveNotice') }]);
      withHeightTween(render); tickAnimations();
    }
    function openChat() {
      voice.end();
      st.call = false; st.callState = 'idle'; st.level = 0;
      st.chatOpen = true; st.messages = []; st.draft = '';
      st.streaming = false; st.typingLive = false;
      if (ref.chatInput) ref.chatInput.value = '';
      if (ref.sendBtn) ref.sendBtn.setAttribute('data-active', '0');
      var k = liveKey();
      if (k) {
        st.typingLive = true;   // the agent's own welcome message is the first thing to arrive
        chat.open(k).catch(function (e) {
          console.warn('[aia-hero] live chat unavailable', e);
          liveNotice();
        });
      } else liveNotice();
      withHeightTween(render); tickAnimations();
      setTimeout(function () { if (ref.chatInput) ref.chatInput.focus({ preventScroll: true }); }, 520);
    }
    function closeChat() {
      chat.close();
      st.chatOpen = false; st.draft = '';
      st.streaming = false; st.typingLive = false;
      if (ref.chatInput) ref.chatInput.value = '';
      if (ref.sendBtn) ref.sendBtn.setAttribute('data-active', '0');
      withHeightTween(render);
    }
    /* Each event carries the whole reply so far, so the last live bubble is rewritten rather
       than appended to. It stays flagged live until completed, and st.streaming keeps the
       ticker alive - without it the rAF loop halts and the thread freezes half-rendered. */
    /* voice-first VA prompts emit SSML (<break> etc.) which the platform persists raw on chat
       messages - Director's transcript swallows the tags at render, so they never surface in
       Closed Convos. Strip at ingestion so bubbles and the screen-reader live region stay clean,
       including a half-arrived tag mid-stream (textSoFar is cumulative). */
    var SSML_TAG = /<\/?(?:break|emphasis|phoneme|say-as|prosody|sub|speak|lang|mark)\b[^>]*\/?>/gi;
    var SSML_PARTIAL = /[ \t]*<\/?(?:break|emphasis|phoneme|say-as|prosody|sub|speak|lang|mark)\b[^>]*$/gi;
    function cleanAgentText(s) {
      return String(s).replace(SSML_TAG, '').replace(SSML_PARTIAL, '').replace(/[ \t]{2,}/g, ' ');
    }
    function pushStream(text, done) {
      text = cleanAgentText(text);
      var last = st.messages[st.messages.length - 1];
      if (last && last.from === 'agent' && last.live) last.t = text;
      else { st.messages.push({ from: 'agent', t: text, live: true }); last = st.messages[st.messages.length - 1]; }
      if (done) last.live = false;
      st.typingLive = false;
      st.streaming = !done;
      withHeightTween(render); tickAnimations();
    }
    function sendMsg() {
      var el = ref.chatInput; var t = ((el && el.value) || '').trim();
      if (!t) return;
      el.value = ''; st.draft = '';
      if (ref.sendBtn) ref.sendBtn.setAttribute('data-active', '0');
      st.messages = st.messages.concat([{ from: 'user', t: t }]);
      if (chat.ready()) {
        st.typingLive = true;
        chat.send(t).catch(function (e) {
          console.warn('[aia-hero] send failed', e);
          liveNotice();
        });
      } else liveNotice();
      render(); tickAnimations();
    }
    /* ---------------- clip tween (call/chat circle-morph on the orb) ---------------- */
    /* call/chat morph the 440x300 orb bed to a 188px circle by clip-path inset; chat then scales
       that circle down to the 44px header sphere (CSS, keyed off [data-chat-open]) */
    function applyClip(p) {
      var el = ref.orbClip;
      if (!el) return;
      el.style.clipPath = 'inset(' + (56 * p).toFixed(2) + 'px ' + (126 * p).toFixed(2) + 'px round ' + (12 + 82 * p).toFixed(2) + 'px)';
    }
    function tweenClipTo(to) {
      if (st.clipTo === to) return;
      st.clipFrom = st.clipP; st.clipTo = to; st.clipAt = performance.now();
      st.clipDur = 620 * Math.abs(to - st.clipFrom);
      tickAnimations();
    }

    /* ---------------- shuffle auto-advance ---------------- */
    var shuffleT = null, shuffleDead = pinned || reduceMotion;
    function shuffleOn() { if (shuffleDead || shuffleT) return; shuffleT = setInterval(shuffleStep, SHUFFLE_MS); }
    function shuffleOff() { clearInterval(shuffleT); shuffleT = null; }
    function shuffleStep() {
      if (shuffleDead || document.hidden || st.call || st.chatOpen || st.ghost != null) return;
      if (st.mode !== 'stack' && (lastE == null ? 1 : lastE) < 0.995) return; // no room to play folded
      /* a shuffle mid-morph is a clip anim + list rebuild + typing burst inside the DPR2-scaled
         stage - the single biggest residual >33ms hitch source in profiling. Defer to stillness. */
      if (morphing) return;
      pickIndustry((st.selected + 1) % CARDS.length);
    }
    function stopShuffle() { shuffleDead = true; shuffleOff(); }

    /* ---------------- single rAF ticker drives every time-based (computeAt-style) panel ---------------- */
    var tickRaf = 0;
    function needsTick(now) {
      return st.ghost != null || st.call || st.streaming || st.typingLive ||
        st.clipFrom !== st.clipTo;
    }
    function tickAnimations() {
      if (tickRaf) return;
      var step = function () {
        var now = performance.now();
        if (st.ghost != null) {
          var gph = ghostPhase(now);
          if (gph === 2 && st.ghostPh !== 2) swapPhase2();
          else if (gph === 0) swapPhase0();
        }
        if (st.clipFrom !== st.clipTo) {
          var k = st.clipDur ? clamp01((now - st.clipAt) / st.clipDur) : 1;
          st.clipP = k >= 1 ? st.clipTo : lerp(st.clipFrom, st.clipTo, EASE_MORPH(k));
          applyClip(st.clipP);
          if (k >= 1) st.clipFrom = st.clipTo;
        }
        renderDynamic(now);
        pinThread();
        if (needsTick(now)) { tickRaf = requestAnimationFrame(step); } else { tickRaf = 0; render(); }
      };
      tickRaf = requestAnimationFrame(step);
    }

    function pinThread() {
      var th = ref.thread;
      if (!th || !st.chatOpen) return;
      if (th.scrollTop > 0 && th.scrollHeight - th.scrollTop - th.clientHeight > 260) return;
      th.scrollTop = th.scrollHeight;
    }

    /* forces a CSS animation to replay on elements that are updated in place (textContent),
       rather than recreated — recreated elements (renderList output) replay naturally */
    function replayAnim(el, name, dur) {
      if (!el) return;
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = name + ' ' + dur + ' cubic-bezier(.22,.72,.16,1) both';
    }

    /* card A/B are content-sized (auto height) — CSS can't transition to/from "auto", so any
       state change that alters their content (industry/persona/call/chat) measures the height
       before mutating the DOM and tweens from the old pixel height to the new one */
    /* The pair reads as one object: both cards always carry the SAME height, and that height is
       a constant per state (card padding + media block + body top margin) plus the tallest
       persona body — measured once offscreen at the card's content width, across every persona.
       Measuring the live cards instead looks obvious but is wrong twice over: it runs while the
       media morph is still transitioning (a card would keep its call height after hanging up),
       and it would resize the pair on every persona switch. */
    var probeCache = null, fitT = 0;
    function measureProbe() {
      // the probes have to be the widths the real blocks render at, or their wraps (and so their
      // heights) are wrong — read those off the live cards rather than hard-coding the 404 card's
      var bw = (ref.bBody && ref.bBody.offsetWidth) || 348;
      var pw = (ref.tryAskingA && ref.tryAskingA.offsetWidth) || 352;
      if (probeCache && probeCache.bw === bw && probeCache.pw === pw && probeCache.lc === LOCALE) return probeCache;
      var host = ref.track || root;
      var mk = function (w, html) {
        var el = document.createElement('div');
        el.setAttribute('aria-hidden', 'true');
        el.style.cssText = 'position:absolute;left:-99999px;top:0;width:' + w + 'px;visibility:hidden;pointer-events:none';
        el.innerHTML = html;
        host.appendChild(el);
        var max = 0;
        Array.prototype.forEach.call(el.querySelectorAll('[data-probe-row]'), function (r) { max = Math.max(max, r.offsetHeight); });
        el.remove();
        return max;
      };
      var bodyHtml = '', phraseHtml = '';
      CARDS.forEach(function (c) {
        (c.personas || []).forEach(function (p) {
          bodyHtml += '<div data-probe-row><div class="aia-b-about-label">' + t('about') + '</div>' +
            '<p class="aia-b-about-body">' + esc(p.scenarioLabel || p.scenario) + '</p><div class="aia-field-grid">' +
            ((p.fieldsLabel || p.fields) || []).map(function (f) {
              return '<div><div class="aia-field-k">' + esc(f[0]) + '</div><div class="aia-field-v">' + esc(f[1]) + '</div></div>';
            }).join('') + '</div></div>';
          phraseHtml += '<div data-probe-row><div class="aia-try-asking-label">' + t('tryAsking') + '</div>' +
            '<div class="aia-try-asking-list">' +
            ((p.phrasesLabel || p.phrases) || []).map(function (t) { return '<div class="aia-phrase">' + esc(t) + '</div>'; }).join('') +
            '</div></div>';
        });
      });
      probeCache = { bw: bw, pw: pw, lc: LOCALE, body: mk(bw, bodyHtml), phrases: mk(pw, phraseHtml) };
      return probeCache;
    }
    /* One height for every persona, in every state, derived the way the source derives it: a
       structural constant (card padding + media block + title + label/gaps + controls row) plus
       the tallest measured content of the block that actually varies. 320/367 is the space above
       and below the persona body; 406 is the same sum for the in-call "Try asking" list, whose
       longest set overruns the source's own 535 floor by 71px — the pair grew twice (constant,
       then safety net) until the prediction included it. The constants are per-locale: Spanish
       copy runs 15-25% longer, so es may need taller pads — retune in the preview harness
       (visible snap-grow from the fitT safety net below is the under-provision signal). */
    var CARD_H = {
      en: { floor: 480, callFloor: 535, bodyPad: 320, callBodyPad: 367, callPhrasesPad: 406 },
      es: { floor: 480, callFloor: 535, bodyPad: 320, callBodyPad: 367, callPhrasesPad: 406 }
    };
    function cardTargetH() {
      var H = CARD_H[LOCALE] || CARD_H.en;
      if (st.chatOpen) {
        /* Card B's persona panel can't scroll, so a long "Try asking" set must grow the pair
           rather than clip at the chat floor (card A's thread flexes with min-height:0, so it
           never overflows). The read needs transitions frozen and height auto: scrollHeight at
           the outgoing fixed height reports max(content, old height), and .aia-b-body's
           margin-top is still tweening 18->34px the moment chat opens. */
        var b = ref.cardB;
        if (!b) return 480;
        var bBody = ref.bBody;
        b.style.transition = 'none';
        if (bBody) bBody.style.transition = 'none';
        var prevH = b.style.height;
        b.style.height = 'auto';
        var need = Math.ceil(b.offsetHeight);  // offsetHeight, not scrollHeight: scrollHeight
        b.style.height = prevH;                // double-counts the padding once content overflows
        if (bBody) bBody.style.transition = '';
        return Math.max(H.floor, need);
      }
      var m = measureProbe();
      if (st.call) return Math.max(H.callFloor, Math.ceil(H.callBodyPad + m.body), Math.ceil(H.callPhrasesPad + m.phrases));
      return Math.max(H.floor, Math.ceil(H.bodyPad + m.body));
    }
    function lockCardHeights(animate) {
      var els = [ref.cardA, ref.cardB].filter(Boolean);
      if (!els.length) return;
      if (st.mode === 'stack') {
        // stacked, the cards are full width and sit one above the other: content-sized is right
        els.forEach(function (el) { el.style.height = ''; el.style.transition = ''; });
        return;
      }
      var target = cardTargetH();
      els.forEach(function (el) {
        el.style.transition = animate ? 'height .5s cubic-bezier(.6,.04,.28,1)' : 'none';
        el.style.height = target + 'px';
      });
      growStageIfNeeded();
      /* Safety net for copy that outgrows the constants: once the state morphs have settled
         (so the read is honest, not mid-transition) check what the content actually needs and
         grow the pair to fit rather than clipping it. One persona's in-call "Try asking" set is
         long enough to cut into the call/chat buttons without this, and the strings are authored
         data — the next edit could do it again. Runs in chat too: the thread scrolls, but card
         B's persona panel does not, and cardTargetH's own chat read can still drift if copy
         changes. */
      clearTimeout(fitT);
      // must land clear of BOTH the .5s height tween and the .62s media morph: fired at 660ms it
      // caught the tail of the morph and grew the pair to a transient need (565 -> 590)
      fitT = setTimeout(function () {
        if (destroyed || st.mode === 'stack') return;
        var need = 0;
        els.forEach(function (el) { need = Math.max(need, el.scrollHeight); });
        if (need <= target + 1) return;
        els.forEach(function (el) {
          el.style.transition = 'height .34s cubic-bezier(.6,.04,.28,1)';
          el.style.height = need + 'px';
        });
        growStageIfNeeded();
      }, 820);
    }
    function withHeightTween(fn) {
      var els = [ref.cardA, ref.cardB].filter(Boolean);
      var froms = els.map(function (el) { return el.offsetHeight; });
      fn();
      if (st.mode === 'stack') { lockCardHeights(false); growStageIfNeeded(); return; }
      els.forEach(function (el, i) { el.style.transition = 'none'; el.style.height = froms[i] + 'px'; });
      requestAnimationFrame(function () { lockCardHeights(true); });
    }

    /* ---------------- render: static structure on state change, cheap text/attr patch on tick ---------------- */
    /* rows are appended once and then patched — rebuilding them per frame (as the first pass did)
       restarts the bubble-in animation on every tick, so a streaming line never finishes fading in */
    function renderMessages(now) {
      var host = ref.thread && ref.thread.querySelector('[data-aia-hero-for="messages"]');
      if (!host) return;
      var tpl = host.querySelector('template');
      if (!tpl) return;
      var rows = Array.prototype.slice.call(host.children).filter(function (n) { return n !== tpl; });
      while (rows.length > st.messages.length) rows.pop().remove();
      st.messages.forEach(function (m, i) {
        var row = rows[i];
        if (!row) { row = renderTemplateItem(tpl, { t: '' }, i); host.appendChild(row); rows[i] = row; }
        var rc = 'aia-msg-row aia-msg-row--' + (m.from === 'user' ? 'user' : 'agent');
        if (row.className !== rc) row.className = rc;
        var bubble = row.querySelector('.aia-msg') || row.firstElementChild;
        if (!bubble) return;
        var bc = 'aia-msg aia-msg--' + (m.from === 'user' ? 'user' : 'agent');
        if (bubble.className !== bc) bubble.className = bc;
        var text = m.t;
        if (bubble.textContent !== text) bubble.textContent = text;
        // a streaming bubble can't live in a live region (it would announce every character), so
        // completed agent replies are mirrored once into an offscreen polite region
        // m.live means tokens are still arriving: text is always "complete" for a live bubble,
        // so without this it would announce the first token and never correct itself
        if (m.from === 'agent' && !m._said && !m.live && m.t && text.length === m.t.length) {
          m._said = true;
          if (ref.liveRegion) ref.liveRegion.textContent = m.t;
        }
      });
    }

    /* rebuilds a list only when its key changes, otherwise patches the existing nodes: a rebuilt
       node replays its CSS enter animation, which should happen on an industry change and never
       on an unrelated re-render */
    function syncList(container, items, key, onItem) {
      if (!container) return;
      var tpl = container.querySelector('template');
      if (container.getAttribute('data-key') !== key) {
        container.setAttribute('data-key', key);
        renderList(container, items, onItem);
        return;
      }
      if (!onItem) return;
      Array.prototype.slice.call(container.children).forEach(function (n) {
        if (n === tpl) return;
        var i = Array.prototype.indexOf.call(container.children, n) - (tpl ? 1 : 0);
        if (items[i]) onItem(n, items[i], i);
      });
    }

    function renderDynamic(now) {
      // '--:--' rather than a word while connecting: the slot is a fixed tabular-nums clock and
      // any longer label reflows the pill mid-animation
      if (ref.callTime) {
        ref.callTime.textContent = !st.call ? clockFmt(0)
          : (st.callState === 'connecting' ? '--:--' : clockFmt(Math.floor((now - st.callStartedAt) / 1000)));
      }
      if (st.call) orb.setEnergy(callEnergy());
      renderMessages(now);
      if (ref.typing) ref.typing.style.display = st.typingLive ? 'flex' : 'none';
    }

    function render() {
      var now = performance.now();
      var c = card(), sc = scenCard(), p = persona();
      var inCall = st.call, chatOpen = st.chatOpen, idle = !inCall && !chatOpen, heroVoice = inCall && !chatOpen;

      root.setAttribute('data-aia-hero-mode', st.mode);

      var industries = CARDS.map(function (x, k) { return { title: x.industryLabel || x.industry, k: k }; });
      syncList(ref.navList, industries, 'nav', function (node, item, k) {
        node.className = 'aia-nav-item';
        node.setAttribute('aria-current', k === st.selected ? 'true' : 'false');
        node.setAttribute('data-aia-hero-click', 'pickIndustry');
        node.setAttribute('data-aia-hero-index', k);
      });
      syncList(ref.dropdownList, industries, 'drop', function (node, item, k) {
        node.className = 'aia-dropdown-item';
        node.setAttribute('aria-current', k === st.selected ? 'true' : 'false');
        node.setAttribute('data-aia-hero-click', 'pickIndustryClose');
        node.setAttribute('data-aia-hero-index', k);
      });
      if (ref.dropdownLabel) ref.dropdownLabel.textContent = c.industryLabel || c.industry;
      if (ref.dropdown) {
        ref.dropdown.setAttribute('data-open', st.navOpen ? '1' : '0');
        var dbtn = ref.dropdown.querySelector('.aia-dropdown-btn');
        if (dbtn) dbtn.setAttribute('aria-expanded', st.navOpen ? 'true' : 'false');
      }
      if (ref.dropdownChevron) ref.dropdownChevron.style.transform = 'rotate(' + (st.navOpen ? 180 : 0) + 'deg)';

      /* Card A belongs to the SELECTED industry from the moment of the click, not to st.scen.
         The ghost is a full copy of the outgoing card (its own gradient and icon) and sits exactly
         on top of card A at t=0, so switching the real card underneath is invisible — by the time
         the ghost has slid clear, card A already carries its own gradient. Driving the orb off
         st.scen instead (as this port did) meant the revealed card wore the OUTGOING gradient for
         the whole slide and then snapped when phase 2 landed. st.scen still owns card B. */
      orb.setCard(c);
      Object.keys(ICONS).forEach(function (name) {
        var el = ref['ico_' + name];
        if (!el) return;
        el.style.animationDelay = (st.stick || st.chip) ? '0s' : '.5s';
        el.setAttribute('data-show', (c.icon === name && !chatOpen) ? '1' : '0');
      });

      if (ref.agentName) { ref.agentName.textContent = t('agentNamePattern').replace('{title}', c.title); ref.agentName.setAttribute('data-chat-open', chatOpen ? '1' : '0'); }
      if (ref.mediaFade) ref.mediaFade.setAttribute('data-chat-open', chatOpen ? '1' : '0');
      if (ref.mediaSlot) ref.mediaSlot.setAttribute('data-chat-open', chatOpen ? '1' : '0');
      if (ref.orbHolder) ref.orbHolder.setAttribute('data-chat-open', chatOpen ? '1' : '0');
      if (ref.threadCloseBtn) ref.threadCloseBtn.setAttribute('data-chat-open', chatOpen ? '1' : '0');
      if (ref.orbClip) ref.orbClip.setAttribute('data-chat-open', chatOpen ? '1' : '0');
      tweenClipTo(inCall || chatOpen ? 1 : 0);

      if (ref.cardTitle) { ref.cardTitle.textContent = heroVoice ? t('agentNamePattern').replace('{title}', c.title) : c.title; ref.cardTitle.style.display = chatOpen ? 'none' : ''; ref.cardTitle.setAttribute('data-voice', heroVoice ? '1' : '0'); }
      if (ref.cardBody) ref.cardBody.style.display = idle ? '' : 'none';
      if (ref.cardBody) ref.cardBody.textContent = c.bodyLabel || c.body;
      if (ref.tryAskingA) ref.tryAskingA.style.display = heroVoice ? '' : 'none';
      renderList(ref.phrasesA, ((p.phrasesLabel || p.phrases) || []).map(function (t) { return { t: t }; }));

      if (ref.thread) ref.thread.style.display = chatOpen ? '' : 'none';
      if (ref.controlsRow) {} // always visible

      if (ref.inputPill) ref.inputPill.setAttribute('data-open', chatOpen ? '1' : '0');
      if (ref.sendBtn) ref.sendBtn.setAttribute('data-active', (st.draft || '').trim() ? '1' : '0');
      if (ref.callBtn) { ref.callBtn.setAttribute('data-incall', inCall ? '1' : '0'); ref.callBtn.setAttribute('data-callstate', st.callState || 'idle'); ref.callBtn.style.opacity = chatOpen ? '0' : '1'; ref.callBtn.style.pointerEvents = chatOpen ? 'none' : 'auto'; ref.callBtn.setAttribute('aria-label', !inCall ? t('ariaCall') : (st.callState === 'connecting' ? t('ariaConnecting') : t('ariaEndCall'))); }
      if (ref.callTime) ref.callTime.style.display = inCall ? '' : 'none';
      if (ref.chatBtn) { ref.chatBtn.style.opacity = (inCall || chatOpen) ? '0' : '1'; ref.chatBtn.style.pointerEvents = (inCall || chatOpen) ? 'none' : 'auto'; ref.chatBtn.setAttribute('aria-label', chatOpen ? t('ariaCloseChat') : t('ariaChat'));
        ref.chatBtn.setAttribute('data-chat-open', chatOpen ? '1' : '0');
        var chatIco = ref.chatBtn.querySelector('[data-part="chat"]'), xIco = ref.chatBtn.querySelector('[data-part="x"]');
        if (chatIco) chatIco.style.opacity = chatOpen ? '0' : '1'; if (xIco) xIco.style.opacity = chatOpen ? '1' : '0';
      }
      if (ref.arrowBtn) {
        ref.arrowBtn.href = localeHref(c.href);
        ref.arrowBtn.style.opacity = (inCall || chatOpen) ? '0' : '1';
        ref.arrowBtn.style.pointerEvents = (inCall || chatOpen) ? 'none' : 'auto';
        ref.arrowBtn.setAttribute('data-hover', st.arrowHover ? '1' : '0');
      }

      /* card B */
      var who = p.who;
      var tagL = p.tagLabel || p.tag;
      var idKeyL = p.idLabel ? p.idLabel[0] : (p.id ? p.id[0] : '');
      var sub = tagL || (p.id ? idKeyL + ' ' + p.id[1] : '');
      if (ref.bWho) ref.bWho.textContent = who;
      if (ref.bAvatar) { ref.bAvatar.textContent = p.photo ? '' : initials(who); ref.bAvatar.style.backgroundImage = p.photo ? 'url("' + p.photo + '")' : 'none'; }
      if (ref.bSubKey) ref.bSubKey.textContent = p.id ? idKeyL + ':' : '';
      if (ref.bSubVal) ref.bSubVal.textContent = p.id ? p.id[1] : (tagL || '');
      if (ref.bPlainHead) ref.bPlainHead.classList.toggle('aia-b-head-has-sub', !!(p.tag || p.id));
      if (ref.bScenario) ref.bScenario.textContent = p.scenarioLabel || p.scenario;
      renderList(ref.bFields, ((p.fieldsLabel || p.fields) || []).map(function (f) { return { k: f[0], v: f[1] }; }));
      renderList(ref.bPhrases, ((p.phrasesLabel || p.phrases) || []).map(function (t) { return { t: t }; }));
      if (ref.bWhoFloat) ref.bWhoFloat.textContent = who;
      if (ref.bSubFloat) ref.bSubFloat.textContent = sub;
      // one persistent video morphs between three geometries — full-bleed bed (idle), centred
      // 188px circle (call, mirroring the orb), 42px header avatar (chat) — all CSS-transitioned
      // off this one attribute, which also swaps card B's head/name/try-asking layout
      if (ref.cardB) {
        ref.cardB.setAttribute('data-state', chatOpen ? 'chat' : (inCall ? 'call' : 'idle'));
      }

      kickVideo(ref.heroVideo, p.vid);

      var cw = (ref.cardA && ref.cardA.offsetWidth) || 404;
      if (ref.callBtn) ref.callBtn.style.transform = 'translateX(' + (chatOpen ? -104 : (inCall ? 110 : 0)) + 'px)';
      if (ref.chatBtn) ref.chatBtn.style.transform = 'translateX(' + (chatOpen ? -104 : 0) + 'px)';
      if (ref.arrowBtn) ref.arrowBtn.style.transform = 'translateX(' + (chatOpen ? 104 : 0) + 'px)';
      if (ref.inputPill) ref.inputPill.style.right = chatOpen ? '0px' : Math.max(0, cw - 116) + 'px';

      var spl = sc.personas, multi = spl.length > 1;
      if (ref.personaChips) {
        ref.personaChips.style.display = multi ? 'flex' : 'none';
        // the chips re-deal (staggered pop) when the industry changes; on a persona pick they only
        // move the ring, so patch selection in place rather than rebuilding the rail
        syncList(ref.personaChips, spl.map(function (pp, k) { return { first: (pp.who || '').split(' ')[0], k: k }; }),
          st.scen + '|' + spl.length + '|' + st.mode + '|' + st.chip,
          function (node, item, k) {
            node.className = 'aia-persona-chip';
            node.setAttribute('aria-selected', k === (st.pIdx || 0) ? 'true' : 'false');
            node.setAttribute('data-aia-hero-click', 'pickPersona');
            node.setAttribute('data-aia-hero-index', k);
            if (spl[k]) node.setAttribute('aria-label', spl[k].who);
            node.style.animationDelay = (0.06 + k * 0.075).toFixed(3) + 's';
            var face = node.querySelector('.aia-persona-face');
            var pp2 = spl[k];
            if (!face || !pp2) return;
            face.style.backgroundImage = 'url("' + (pp2.photo || posterFor(pp2.vid)) + '")';
            if (chipVideosOn && pp2.vid) {
              var fv = face.querySelector('video');
              if (!fv) {
                fv = document.createElement('video');
                fv.muted = true; fv.loop = true; fv.playsInline = true;
                fv.disablePictureInPicture = true; fv.disableRemotePlayback = true;
                fv.setAttribute('muted', ''); fv.setAttribute('playsinline', ''); fv.setAttribute('aria-hidden', 'true');
                fv.setAttribute('disablepictureinpicture', ''); fv.setAttribute('disableremoteplayback', '');
                face.appendChild(fv);
              }
              kickChipVideo(fv, chipVidFor(pp2.vid));
            }
          });
        chipsPlaying = false;
        syncChipPlayback();
      }
      hintOn = multi && st.mode !== 'stack' && hintRoom && !inCall && !chatOpen && !st.pickHintDone;
      if (ref.pickHint) ref.pickHint.style.display = hintOn ? '' : 'none';

      measurePill();
      onScroll();
      renderDynamic(now);
    }

    /* ---------------- event delegation ---------------- */
    var handlers = {
      pickIndustry: function (el) { var i = Number(el.getAttribute('data-aia-hero-index')); whenOpen(function () { pickIndustry(i); }); },
      pickIndustryClose: function (el) { var i = Number(el.getAttribute('data-aia-hero-index')); st.navOpen = false; render(); whenOpen(function () { pickIndustry(i); }); },
      pickPersona: function (el) { pickPersona(Number(el.getAttribute('data-aia-hero-index'))); },
      toggleDropdown: function () { st.navOpen = !st.navOpen; render(); },
      toggleCall: function () { toggleCall(); },
      toggleChat: function () { if (st.chatOpen) closeChat(); else openChat(); },
      sendMsg: function () { sendMsg(); },
      closeChat: function () { closeChat(); }
    };
    root.addEventListener('click', function (e) {
      var el = e.target.closest('[data-aia-hero-click]');
      if (!el) return;
      stopShuffle();
      var fn = handlers[el.getAttribute('data-aia-hero-click')];
      if (fn) fn(el, e);
    });
    root.addEventListener('pointerdown', function (e) { if (e.target.closest('button, a, input, [role="button"]')) stopShuffle(); });
    window.addEventListener('wheel', abandonTween, { passive: true });
    window.addEventListener('touchstart', abandonTween, { passive: true });
    root.addEventListener('keydown', stopShuffle);
    // on window, not root: Escape has to work even when focus sits on body after a click
    // elsewhere on the page - on root it only fired with focus inside the hero
    window.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (st.navOpen) { st.navOpen = false; render(); }
      else if (st.call) { endCall(true); }
      else if (st.chatOpen) { closeChat(); }
    });
    if (ref.chatInput) {
      ref.chatInput.addEventListener('input', function (e) { st.draft = e.target.value; if (ref.sendBtn) ref.sendBtn.setAttribute('data-active', st.draft.trim() ? '1' : '0'); });
      ref.chatInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); sendMsg(); } });
    }
    if (ref.arrowBtn) {
      ref.arrowBtn.addEventListener('mouseenter', function () { st.arrowHover = true; ref.arrowBtn.setAttribute('data-hover', '1'); });
      ref.arrowBtn.addEventListener('mouseleave', function () { st.arrowHover = false; ref.arrowBtn.setAttribute('data-hover', '0'); });
    }
    function onDocDown(e) { if (st.navOpen && ref.dropdown && !ref.dropdown.contains(e.target)) { st.navOpen = false; render(); } }
    document.addEventListener('mousedown', onDocDown);

    /* ---------------- lifecycle ---------------- */
    // off screen the hero costs nothing: paint loop, auto-advance, the persona clip and the chip
    // loops all stop, and a hidden tab returning to a page scrolled past the hero resumes none
    var io = window.IntersectionObserver ? new IntersectionObserver(function (es) {
      var r = es[0].intersectionRatio;
      heroSeen = r > 0;
      if (r > 0) { orb.start(); heroVidPlayback(true); } else { orb.stop(); heroVidPlayback(false); }
      if (r > 0.4) shuffleOn(); else shuffleOff();
      syncChipPlayback();
      flushMedia();
    }, { threshold: [0, 0.4] }) : null;
    if (io && ref.stage) io.observe(ref.stage);
    else { heroSeen = true; orb.start(); flushMedia(); }   // no IO: never withhold the media

    function onVis() {
      if (document.hidden) { shuffleOff(); orb.stop(); heroVidPlayback(false); }
      else if (heroSeen) { shuffleOn(); orb.start(); heroVidPlayback(true); }
      syncChipPlayback();
      flushMedia();
    }
    /* document.fonts.ready has no cancel path — a destroy() that races a pending font load (the
       double-embed case this file is built to survive) would let the dead instance's callback
       fire late and clobber the live instance's render on the same shared DOM. */
    function onFonts() { if (destroyed) return; probeCache = null; handleResize(); }
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('resize', handleResize);
    if (!reduceMotion) window.addEventListener('scroll', onScroll, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(onFonts);

    syncMode();
    measureStageHeader();
    orb.resize();
    applyClip(0);
    render();
    measureShift(true);
    lockCardHeights(false);
    measureGeo();
    onScroll();
    var bootT = setTimeout(onFonts, 350);

    /* The voice widget is a 3MB bundle, so it is not loaded until someone looks like they mean
       to call. Hover/focus buys the iframe a second or two to arm; a tap that beats arming is
       queued by the manager, so the worst case is a slower first connect, never a dropped call. */
    if (ref.callBtn) {
      ref.callBtn.addEventListener('pointerenter', warmVoice);
      ref.callBtn.addEventListener('focus', warmVoice);
    }
    if (ref.chatBtn) {
      ref.chatBtn.addEventListener('pointerenter', warmChat);
      ref.chatBtn.addEventListener('focus', warmChat);
    }
    /* The chat SDK + anonymous sign-in are the bulk of first-open latency. Fetch the bundle
       during idle so the first click only pays the session start, and pre-sign on hover so
       the reCAPTCHA roundtrip is already done when the panel opens. */
    idleRun(function () { loadCrestaSdk(); });

    /* The embed is fetched and eval'd, and a Webflow page can be pasted twice or swapped by a
       page-transition script — either way a second init would stack a second rAF loop, a second
       auto-advance and a duplicate set of window listeners on the same DOM. boot() calls this
       first, so re-initialising is always clean. */
    return {
      st: st, voice: voice, chat: chat, orb: orb,   // console handle: root.__aiaHero
      destroy: function () {
        voice.destroy(); chat.destroy();
        if (ref.callBtn) {
          ref.callBtn.removeEventListener('pointerenter', warmVoice);
          ref.callBtn.removeEventListener('focus', warmVoice);
        }
        if (ref.chatBtn) {
          ref.chatBtn.removeEventListener('pointerenter', warmChat);
          ref.chatBtn.removeEventListener('focus', warmChat);
        }
        clearTimeout(bootT); clearTimeout(fitT); clearTimeout(hintT); clearTimeout(geoT); clearTimeout(swapT1); clearTimeout(swapT2); clearTimeout(morphOffTimer);
        mediaQ.length = 0; if (mediaT) idleCancel(mediaT);
        warmPool.forEach(function (v) { v.removeAttribute('src'); v.load(); v.remove(); });
        warmPool.length = 0;
        if (tickRaf) cancelAnimationFrame(tickRaf);
        if (scrollQ) cancelAnimationFrame(scrollQ);
        if (scrollRaf) cancelAnimationFrame(scrollRaf);
        pendingOpen = null;
        shuffleOff(); shuffleDead = true;
        orb.stop();
        heroVidPlayback(false);
        destroyed = true;
        chipsPlaying = false;
        if (ref.personaChips) Array.prototype.forEach.call(ref.personaChips.querySelectorAll('video'), function (v) { if (!v.paused) v.pause(); });
        if (io) io.disconnect();
        document.removeEventListener('visibilitychange', onVis);
        document.removeEventListener('mousedown', onDocDown);
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('wheel', abandonTween);
        window.removeEventListener('touchstart', abandonTween);
      }
    };
  }

  function boot() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-aia-hero-root]'), function (root) {
      if (root.__aiaHero && root.__aiaHero.destroy) root.__aiaHero.destroy();
      root.__aiaHero = initHero(root) || null;
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

/* MAR-306: "One platform, compounding value" (cxp) section stabilizer.
   Hovering a tile swaps the copy column to text of a different length (and hides the CTA
   on 2 of 5 tiles), so the column height swings ~140px. Where the copy is the grid's tall
   item (dg scales to 422px below 1180px, copy grows past it) the diagram re-centers on
   every hover and the frame + blue trace visibly jump. On mobile (<=720px, display:contents
   layout) the 1->2-line title swap pushes the diagram instead. Fix: measure every variant
   offscreen at the current width, pin the column (desktop) or title+body (mobile) to the
   tallest variant, and keep the CTA slot reserved via CSS visibility. Pure layout freeze -
   the crossfade animation and all interactions are untouched. */
(function () {
  function initCxp(sec) {
    if (sec.hasAttribute('data-cxp-stab')) return;
    sec.setAttribute('data-cxp-stab', '1');
    var copy = sec.querySelector('.cxp-copy');
    if (!copy) return;
    var eb = copy.querySelector('.cxp-eyebrow'),
        ti = copy.querySelector('.cxp-title'),
        bo = copy.querySelector('.cxp-body');
    if (!eb || !ti || !bo) return;
    var def = [eb.textContent, ti.textContent, bo.textContent];
    var variants = [def];
    Array.prototype.forEach.call(sec.querySelectorAll('.cxp-tile'), function (t) {
      variants.push([t.getAttribute('data-eyebrow') || def[0],
                     t.getAttribute('data-title') || def[1],
                     t.getAttribute('data-body') || def[2]]);
    });
    function measure() {
      var mobile = window.innerWidth <= 720;
      var clone = copy.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      clone.style.cssText += ';position:absolute;left:-9999px;top:0;visibility:hidden;pointer-events:none;height:auto;min-height:0;display:flex;flex-direction:column';
      clone.style.width = copy.getBoundingClientRect().width + 'px';
      (copy.parentElement || sec).appendChild(clone);
      var ce = clone.querySelector('.cxp-eyebrow'),
          ct = clone.querySelector('.cxp-title'),
          cb = clone.querySelector('.cxp-body');
      var maxAll = 0, maxT = 0, maxB = 0;
      variants.forEach(function (v) {
        ce.textContent = v[0]; ct.textContent = v[1]; cb.textContent = v[2];
        maxAll = Math.max(maxAll, clone.offsetHeight);
        maxT = Math.max(maxT, ct.offsetHeight);
        maxB = Math.max(maxB, cb.offsetHeight);
      });
      clone.parentElement.removeChild(clone);
      if (mobile) {
        copy.style.minHeight = '';
        ti.style.minHeight = maxT + 'px';
        bo.style.minHeight = maxB + 'px';
      } else {
        ti.style.minHeight = '';
        bo.style.minHeight = '';
        copy.style.minHeight = maxAll + 'px';
      }
    }
    var t;
    function schedule() { clearTimeout(t); t = setTimeout(measure, 200); }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    else if (document.readyState === 'complete') measure();
    else window.addEventListener('load', measure);
    window.addEventListener('resize', schedule, { passive: true });
  }
  function bootCxp() {
    Array.prototype.forEach.call(document.querySelectorAll('.cxp'), initCxp);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootCxp);
  else bootCxp();
})();