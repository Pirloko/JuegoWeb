import { LEGAL_CONTACT_EMAIL, LEGAL_EFFECTIVE_DATE, LEGAL_OPERATOR_NAME } from './legalMeta';

export interface LegalSection {
  title: string;
  paragraphs: string[];
}

export interface LegalDoc {
  slug: 'terminos' | 'privacidad';
  title: string;
  subtitle: string;
  sections: LegalSection[];
}

export const TERMS_OF_USE: LegalDoc = {
  slug: 'terminos',
  title: 'Condiciones de uso',
  subtitle: `Vigentes desde el ${LEGAL_EFFECTIVE_DATE}`,
  sections: [
    {
      title: '1. Quiénes somos y qué es este servicio',
      paragraphs: [
        `${LEGAL_OPERATOR_NAME} es un juego arcade web (mobile-first) de conquista de territorio. Al jugar revelas imágenes y contenidos ocultos. El servicio se ofrece desde Chile y está pensado para uso personal, no comercial.`,
        'Al crear una cuenta, iniciar sesión o usar el juego, aceptas estas Condiciones de uso y nuestra Política de privacidad. Si no estás de acuerdo, no uses el servicio.',
      ],
    },
    {
      title: '2. Solo para mayores de 18 años',
      paragraphs: [
        'Este servicio está destinado exclusivamente a personas de 18 años o más. Contiene o puede contener material visual de carácter adulto, sensual o erótico.',
        'Al continuar declaras, bajo tu responsabilidad, que tienes al menos 18 años y que el acceso a este tipo de contenido es legal en el lugar desde el que te conectas. No permitimos el uso por menores. Si detectamos indicios de uso por menores, podremos suspender o eliminar la cuenta.',
      ],
    },
    {
      title: '3. Cuenta de usuario',
      paragraphs: [
        'Para jugar necesitas una cuenta con email, contraseña y nombre de usuario. Eres responsable de la confidencialidad de tus credenciales y de la actividad realizada con tu cuenta.',
        'Debes proporcionar datos veraces y mantener tu email operativo. Podemos rechazar, suspender o eliminar cuentas que incumplan estas condiciones, abusen del servicio o pongan en riesgo a otros usuarios o a la plataforma.',
      ],
    },
    {
      title: '4. El juego, el contenido y la galería',
      paragraphs: [
        'El progreso, las imágenes reveladas y los logros se asocian a tu cuenta. El contenido (imágenes, GIF, video u otros medios) es material del servicio o licenciado para él; no adquieres derechos de propiedad sobre ese material por jugar o completar niveles.',
        'Queda prohibido extraer, redistribuir, revender, scrapear o publicar fuera de la app el contenido revelado, salvo las funciones explícitas que el producto ofrezca (por ejemplo, visitar un enlace de origen cuando exista).',
      ],
    },
    {
      title: '5. Suscripción y pagos',
      paragraphs: [
        'Una parte de los niveles puede jugarse de forma gratuita. El acceso a niveles de pago requiere una suscripción mensual activa, cobrada a través de Mercado Pago (Chile, montos en CLP) según el precio vigente de la temporada o la oferta publicada en el momento del alta.',
        'La activación, renovación, pausa y cancelación de la suscripción se gestionan principalmente en Mercado Pago. Al cancelar o perder el estado autorizado, pierdes el acceso a los niveles de pago; el progreso y las imágenes ya reveladas se conservan según las reglas del producto.',
        'Los precios, impuestos aplicables y condiciones de cobro de Mercado Pago son los que muestre el flujo de pago al suscribirte. No ofrecemos reembolsos automáticos desde la app; cualquier reclamo de cobro debe gestionarse conforme a las políticas de Mercado Pago y la normativa aplicable.',
      ],
    },
    {
      title: '6. Uso aceptable',
      paragraphs: [
        'Te comprometes a no: (a) intentar vulnerar seguridad, autenticación o sistemas de progreso; (b) usar bots, automatización abusiva o trampas para alterar resultados; (c) acosar, engañar o suplantar a terceros; (d) usar el servicio con fines ilegales; (e) interferir con la experiencia de otros jugadores.',
        'El incumplimiento puede implicar suspensión, cierre de cuenta y, si corresponde, acciones legales.',
      ],
    },
    {
      title: '7. Disponibilidad y cambios',
      paragraphs: [
        'Nos esforzamos por mantener el servicio disponible, pero no garantizamos funcionamiento ininterrumpido ni libre de errores. Pueden existir mantenciones, caídas de terceros (hosting, autenticación, pagos) o cambios de contenido.',
        'Podemos modificar niveles, precios, funciones o estas condiciones. Los cambios relevantes de condiciones se publicarán en esta página con nueva fecha de vigencia. El uso continuado tras la publicación implica aceptación de la versión actualizada, salvo que la ley exija otro mecanismo.',
      ],
    },
    {
      title: '8. Propiedad intelectual',
      paragraphs: [
        `La marca ${LEGAL_OPERATOR_NAME}, el software, el diseño, textos, mecánicas y el contenido audiovisual del servicio están protegidos. No se concede ninguna licencia distinta de la necesaria para usar el juego conforme a estas condiciones.`,
      ],
    },
    {
      title: '9. Limitación de responsabilidad',
      paragraphs: [
        'En la máxima medida permitida por la ley chilena, el servicio se ofrece “tal cual”. No respondemos por daños indirectos, lucro cesante, pérdida de datos o interrupciones derivadas del uso o imposibilidad de uso del juego, salvo dolo o culpa grave cuando la ley no permita limitar esa responsabilidad.',
        'Nada en estas condiciones limita derechos irrenunciables del consumidor conforme a la Ley N° 19.496 u otras normas aplicables.',
      ],
    },
    {
      title: '10. Ley aplicable y contacto',
      paragraphs: [
        'Estas condiciones se rigen por las leyes de la República de Chile. Para controversias, serán competentes los tribunales de Chile, sin perjuicio de derechos imperativos del consumidor.',
        `Consultas sobre estas condiciones: ${LEGAL_CONTACT_EMAIL}.`,
      ],
    },
  ],
};

export const PRIVACY_POLICY: LegalDoc = {
  slug: 'privacidad',
  title: 'Política de privacidad',
  subtitle: `Vigente desde el ${LEGAL_EFFECTIVE_DATE}`,
  sections: [
    {
      title: '1. Responsable del tratamiento',
      paragraphs: [
        `El responsable del tratamiento de tus datos personales en ${LEGAL_OPERATOR_NAME} es el operador del servicio. Para ejercer derechos o consultas de privacidad escribe a ${LEGAL_CONTACT_EMAIL}.`,
        'Esta política describe qué datos tratamos, para qué, con quién los compartimos y cómo puedes ejercer tus derechos conforme a la normativa chilena de protección de datos (en particular la Ley N° 19.628 y normas complementarias aplicables).',
      ],
    },
    {
      title: '2. Datos que tratamos',
      paragraphs: [
        'Datos de cuenta: email, contraseña (almacenada de forma cifrada/hasheada por el proveedor de autenticación), nombre de usuario y metadatos de sesión.',
        'Datos de juego: progreso por nivel, intentos, tiempos, medallas/logros, contenido revelado en galería, y sesiones de juego (inicio, fin, duración y resultado) para métricas del servicio y del panel interno.',
        'Datos de suscripción y pago: estado de la suscripción, montos, fechas de periodo y referencias del proveedor de pago (Mercado Pago). No almacenamos el número completo de tu tarjeta en nuestros servidores; el cobro lo procesa Mercado Pago.',
        'Datos técnicos: información básica del dispositivo/navegador, registros de error y uso necesarios para seguridad, rendimiento y soporte. También usamos almacenamiento local del navegador (por ejemplo, confirmación +18, preferencias de tutorial o PWA).',
      ],
    },
    {
      title: '3. Finalidades',
      paragraphs: [
        'Crear y autenticar tu cuenta; prestar el juego y la galería; gestionar suscripciones; prevenir fraude y abuso; mejorar el producto con métricas agregadas; cumplir obligaciones legales; y contactarte por asuntos del servicio (seguridad, cambios relevantes, soporte).',
        'No vendemos tus datos personales. No usamos tus datos para publicidad de terceros no relacionada con el servicio, salvo que en el futuro te pidamos un consentimiento específico y separado.',
      ],
    },
    {
      title: '4. Bases del tratamiento',
      paragraphs: [
        'Tratamos datos porque son necesarios para ejecutar el contrato de servicio (cuenta, juego, suscripción), por interés legítimo en seguridad y mejora del producto (de forma proporcional), y/o para cumplir obligaciones legales. Cuando la ley exija consentimiento, te lo pediremos de forma clara.',
      ],
    },
    {
      title: '5. Encargados y terceros',
      paragraphs: [
        'Podemos encargar el tratamiento a proveedores que nos ayudan a operar el servicio, bajo instrucciones y con medidas de seguridad adecuadas, por ejemplo: autenticación y base de datos (Supabase), pagos (Mercado Pago), hosting/CDN del frontend, y herramientas de monitoreo si se habilitan.',
        'Estos proveedores pueden tratar datos fuera de Chile. Al usar el servicio, aceptas esas transferencias en la medida necesaria para prestarlo, con las salvaguardas que ofrezca cada proveedor.',
      ],
    },
    {
      title: '6. Conservación',
      paragraphs: [
        'Conservamos los datos mientras tu cuenta esté activa y el tiempo adicional necesario para disputas, auditorías, obligaciones legales o seguridad. Si eliminas tu cuenta o solicitas la baja, borraremos o anonimizaremos los datos personales cuando ya no sean necesarios, salvo retención legal obligatoria.',
      ],
    },
    {
      title: '7. Tus derechos',
      paragraphs: [
        'Puedes solicitar acceso, rectificación, cancelación u oposición respecto de tus datos personales, y pedir información sobre el tratamiento, en los términos de la normativa aplicable. Escríbenos a ' +
          LEGAL_CONTACT_EMAIL +
          ' desde el email asociado a tu cuenta para verificar tu identidad.',
        'También puedes eliminar tu cuenta desde Perfil → Eliminar cuenta. Al hacerlo se borra tu usuario y, en cascada, el progreso, medallas, sesiones y datos de suscripción almacenados en nuestros sistemas. Si tienes un cobro recurrente en Mercado Pago, debes cancelarlo allí para evitar cargos futuros.',
        'También puedes gestionar parte de tu información desde el perfil (por ejemplo, cerrar sesión) y la suscripción desde Mercado Pago.',
      ],
    },
    {
      title: '8. Menores de edad',
      paragraphs: [
        'El servicio es solo +18. No recopilamos a sabiendas datos de menores de 18 años. Si eres padre, madre o tutor y crees que un menor se registró, contáctanos para eliminar la cuenta y los datos asociados.',
      ],
    },
    {
      title: '9. Seguridad',
      paragraphs: [
        'Aplicamos medidas técnicas y organizativas razonables (control de acceso, cifrado en tránsito vía HTTPS, políticas de seguridad en base de datos). Ningún sistema es 100 % seguro; te pedimos elegir una contraseña robusta y no compartirla.',
      ],
    },
    {
      title: '10. Cambios',
      paragraphs: [
        'Podemos actualizar esta política. Publicaremos la versión vigente en esta página con su fecha. Si el cambio es sustancial, podremos avisarte en el servicio o por email cuando sea razonablemente posible.',
      ],
    },
  ],
};

export function getLegalDoc(slug: string): LegalDoc | null {
  if (slug === 'terminos') return TERMS_OF_USE;
  if (slug === 'privacidad') return PRIVACY_POLICY;
  return null;
}
