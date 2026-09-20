/**
 * De unas coordenadas al nombre del sitio: el topónimo más cercano a un punto.
 *
 * Deepfire no da nombres — un incendio real llega como un cluster_id y un centroide, y
 * eso es lo que se enseñaba en pantalla y lo que leía el modelo. Un caso de ejercicio sí
 * trae topónimo escrito, así que la simulación decía "Incendio en Collserola" y el feed
 * real decía "41.6892, 2.4896", para el mismo tipo de cosa.
 *
 * Esto NO es un geocodificador inverso: no hay ninguna llamada de red detrás. Es una
 * tabla de las capitales municipales de la zona y el vecino más cercano. Es la decisión
 * conservadora a propósito — sin cuota, sin latencia dentro del ciclo de sondeo, sin
 * atribución que cumplir y sin un proveedor que pueda caerse justo durante la demo. Un
 * nombre de municipio es además toda la precisión que un parte necesita: nadie despacha
 * recursos a un número de calle.
 *
 * LO QUE DEVUELVE ES DERIVADO, NO MEDIDO: el centroide de un incendio a cuatro
 * kilómetros de un pueblo no está EN ese pueblo. Con la separación real entre capitales
 * de aquí (mediana 3,2 km, máxima 7,4 km) el error típico es de un par de kilómetros.
 *
 * Aun así devuelve el nombre PELADO, sin "near" delante. Es una decisión de producto: el
 * nombre es el título de la tarjeta del incidente y la etiqueta de una fila, y en esos
 * dos sitios "near Sant Celoni" se lee como un error de maquetación, no como una
 * precisión. La salvedad no se pierde, cambia de sitio — el prompt del modelo sí sigue
 * enterándose de que es el municipio más cercano al centroide y no la ubicación
 * confirmada (ver situationBriefing.ts), que es donde de verdad importaba.
 *
 * ORIGEN DE LA TABLA (generada una vez, no se consulta nada en ejecución):
 *   - nombres: el padrón de municipios de IDESCAT
 *     https://api.idescat.cat/emex/v1/nodes.json?tipus=mun  (947 municipios de Catalunya)
 *   - coordenadas: el volcado abierto de GeoNames para España (CC BY 4.0)
 *     https://download.geonames.org/export/dump/ES.zip
 * Se cruzan por nombre normalizado (sin acentos, con el artículo desinvertido: IDESCAT
 * escribe "Ametlla del Vallès, l'") y se recortan al bbox del feed más un margen, para
 * que un incendio en el borde siga encontrando nombre. Salen 227 municipios: los 164 de
 * la RMB más los vecinos que el rectángulo pilla de paso.
 *
 * Dos filtros, y los dos existen porque sin ellos un HOMÓNIMO envenena la tabla — le da
 * a un municipio las coordenadas de otro sitio que se llama igual, y entonces un
 * incendio sale nombrado a 100 km de donde está:
 *   - Del lado de GeoNames solo entran NÚCLEOS de municipio (PPL, PPLA…, PPLC) de
 *     Catalunya (admin1=56). Sin esto se cuelan los barrios (PPLX): el barrio Canyelles
 *     de Barcelona le robaba las coordenadas al municipio Canyelles del Garraf.
 *   - El cruce exige que coincidan el nombre Y LA PROVINCIA (código INE de IDESCAT
 *     contra admin2 de GeoNames). Sin esto, la Floresta —municipio de les Garrigues, en
 *     Lleida— se quedaba con las del barrio homónimo de Collserola, y un incendio en el
 *     Tibidabo salía "near la Floresta".
 *
 * La comprobación que hay que repetir al regenerar: ningún par de municipios a menos de
 * 1 km (salvo Santa Fe del Penedès y la Granada, que de verdad están a 600 m).
 *
 * Para regenerarla, vuelve a cruzar esas dos fuentes — no la edites a mano.
 */

/** [nombre, lat, lng] — tupla y no objeto: son 231 filas y así se leen como una tabla. */
const MUNICIPALITIES: readonly (readonly [string, number, number])[] = [
  ["Abrera", 41.51682, 1.901],
  ["Aguilar de Segarra", 41.74822, 1.62919],
  ["Aiguafreda", 41.76807, 2.25051],
  ["Alella", 41.49379, 2.29451],
  ["Arbúcies", 41.81667, 2.51667],
  ["Arenys de Mar", 41.5819, 2.54936],
  ["Arenys de Munt", 41.61424, 2.53972],
  ["Argentona", 41.55336, 2.40114],
  ["Artés", 41.798, 1.95428],
  ["Avinyonet del Penedès", 41.35, 1.78333],
  ["Avinyó", 41.86367, 1.97095],
  ["Badalona", 41.45004, 2.24741],
  ["Balsareny", 41.86311, 1.87356],
  ["Banyeres del Penedès", 41.28333, 1.58333],
  ["Barberà del Vallès", 41.5159, 2.12457],
  ["Barcelona", 41.38879, 2.15899],
  ["Begues", 41.33333, 1.93333],
  ["Bellvei", 41.23333, 1.58333],
  ["Breda", 41.74833, 2.55964],
  ["Cabrera de Mar", 41.51667, 2.4],
  ["Cabrils", 41.5276, 2.36996],
  ["Calaf", 41.73289, 1.51375],
  ["Calafell", 41.19997, 1.5683],
  ["Calders", 41.7889, 1.98672],
  ["Caldes d'Estrac", 41.56667, 2.53333],
  ["Caldes de Montbui", 41.63333, 2.16667],
  ["Callús", 41.78146, 1.78401],
  ["Campins", 41.71667, 2.46667],
  ["Canet de Mar", 41.59054, 2.58116],
  ["Canovelles", 41.61667, 2.28333],
  ["Canyelles", 41.28333, 1.73333],
  ["Capellades", 41.53005, 1.68651],
  ["Cardedeu", 41.63976, 2.35739],
  ["Carme", 41.53198, 1.62074],
  ["Castellar del Vallès", 41.61667, 2.08333],
  ["Castellbell i el Vilar", 41.63395, 1.86394],
  ["Castellbisbal", 41.47534, 1.98174],
  ["Castellcir", 41.76074, 2.16128],
  ["Castelldefels", 41.27794, 1.97033],
  ["Castellfollit del Boix", 41.66667, 1.7],
  ["Castellnou de Bages", 41.83444, 1.83721],
  ["Castellolí", 41.59829, 1.70057],
  ["Castellterçol", 41.75, 2.11667],
  ["Castellví de Rosanes", 41.45, 1.9],
  ["Centelles", 41.79746, 2.21902],
  ["Cerdanyola del Vallès", 41.49109, 2.14079],
  ["Cervelló", 41.39587, 1.95917],
  ["Collbató", 41.57009, 1.82712],
  ["Collsuspina", 41.8258, 2.17546],
  ["Copons", 41.63662, 1.51809],
  ["Corbera de Llobregat", 41.41702, 1.9197],
  ["Cornellà de Llobregat", 41.35, 2.08333],
  ["Cubelles", 41.20772, 1.67267],
  ["Cunit", 41.19829, 1.63645],
  ["Cànoves i Samalús", 41.68333, 2.35],
  ["Dosrius", 41.58333, 2.41667],
  ["Esparreguera", 41.53809, 1.87025],
  ["Espinelves", 41.86667, 2.41667],
  ["Esplugues de Llobregat", 41.37732, 2.08809],
  ["Fogars de Montclús", 41.73333, 2.45],
  ["Fonollosa", 41.76303, 1.66867],
  ["Font-rubí", 41.4343, 1.59096],
  ["Gallifa", 41.69243, 2.11346],
  ["Gavà", 41.30605, 2.00123],
  ["Gelida", 41.43333, 1.86667],
  ["Granera", 41.72741, 2.05924],
  ["Granollers", 41.60797, 2.28773],
  ["Gualba", 41.73333, 2.5],
  ["Hostalric", 41.75, 2.63333],
  ["Igualada", 41.58098, 1.6172],
  ["Jorba", 41.60193, 1.5475],
  ["Llinars del Vallès", 41.63333, 2.4],
  ["Lliçà d'Amunt", 41.61667, 2.23333],
  ["Lliçà de Vall", 41.59054, 2.24121],
  ["Llorenç del Penedès", 41.28333, 1.55],
  ["Malla", 41.89461, 2.2437],
  ["Manresa", 41.72815, 1.82399],
  ["Martorell", 41.47402, 1.93062],
  ["Martorelles", 41.53333, 2.23333],
  ["Masquefa", 41.50353, 1.81136],
  ["Matadepera", 41.59886, 2.02648],
  ["Mataró", 41.54211, 2.4445],
  ["Mediona", 41.47798, 1.61222],
  ["Moià", 41.81112, 2.09839],
  ["Molins de Rei", 41.41667, 2.01667],
  ["Mollet del Vallès", 41.54026, 2.21306],
  ["Monistrol de Calders", 41.76043, 2.01685],
  ["Monistrol de Montserrat", 41.61667, 1.85],
  ["Montcada i Reixac", 41.48333, 2.18333],
  ["Montgat", 41.46859, 2.28001],
  ["Montmeló", 41.55002, 2.2419],
  ["Montornès del Vallès", 41.54206, 2.26748],
  ["Montseny", 41.75726, 2.39944],
  ["Muntanyola", 41.88333, 2.18333],
  ["Mura", 41.69943, 1.97612],
  ["Navarcles", 41.75171, 1.90357],
  ["Navàs", 41.89998, 1.87763],
  ["Olesa de Bonesvalls", 41.35435, 1.84907],
  ["Olesa de Montserrat", 41.54372, 1.89407],
  ["Olivella", 41.31667, 1.81667],
  ["Orpí", 41.5187, 1.57536],
  ["Palau-solità i Plegamans", 41.58569, 2.17709],
  ["Pallejà", 41.42394, 1.99505],
  ["Parets del Vallès", 41.57481, 2.23306],
  ["Piera", 41.52232, 1.75076],
  ["Polinyà", 41.55, 2.15],
  ["Pontons", 41.41313, 1.51458],
  ["Premià de Dalt", 41.5, 2.35],
  ["Premià de Mar", 41.49206, 2.36524],
  ["Puigdàlber", 41.4, 1.7],
  ["Rajadell", 41.72802, 1.70621],
  ["Rellinars", 41.63333, 1.91667],
  ["Riells i Viabrea", 41.78333, 2.51667],
  ["Ripollet", 41.49686, 2.15739],
  ["Rubí", 41.49226, 2.03305],
  ["Sabadell", 41.54329, 2.10942],
  ["Sallent", 41.82602, 1.8955],
  ["Sant Adrià de Besòs", 41.43073, 2.21855],
  ["Sant Andreu de Llavaneres", 41.56667, 2.48333],
  ["Sant Andreu de la Barca", 41.44659, 1.97187],
  ["Sant Antoni de Vilamajor", 41.66667, 2.4],
  ["Sant Boi de Llobregat", 41.34357, 2.03659],
  ["Sant Cebrià de Vallalta", 41.61667, 2.6],
  ["Sant Celoni", 41.68921, 2.48965],
  ["Sant Climent de Llobregat", 41.33333, 2.0],
  ["Sant Cugat Sesgarrigues", 41.36667, 1.75],
  ["Sant Cugat del Vallès", 41.47063, 2.08611],
  ["Sant Esteve Sesrovires", 41.49341, 1.8833],
  ["Sant Esteve de Palautordera", 41.7062, 2.43153],
  ["Sant Feliu de Buixalleu", 41.78333, 2.58333],
  ["Sant Feliu de Codines", 41.7, 2.16667],
  ["Sant Feliu de Llobregat", 41.38333, 2.05],
  ["Sant Fost de Campsentelles", 41.51667, 2.23333],
  ["Sant Fruitós de Bages", 41.75, 1.86667],
  ["Sant Hilari Sacalm", 41.88333, 2.51667],
  ["Sant Iscle de Vallalta", 41.61667, 2.56667],
  ["Sant Jaume dels Domenys", 41.3, 1.56667],
  ["Sant Joan Despí", 41.36718, 2.0574],
  ["Sant Joan de Vilatorrada", 41.74549, 1.80476],
  ["Sant Just Desvern", 41.38389, 2.06758],
  ["Sant Llorenç Savall", 41.67968, 2.05766],
  ["Sant Llorenç d'Hortons", 41.46667, 1.83333],
  ["Sant Martí Sarroca", 41.38576, 1.61121],
  ["Sant Martí Sesgueioles", 41.68333, 1.5],
  ["Sant Martí de Centelles", 41.76617, 2.20566],
  ["Sant Martí de Tous", 41.55, 1.51667],
  ["Sant Mateu de Bages", 41.8, 1.73333],
  ["Sant Pere Sallavinera", 41.73333, 1.58333],
  ["Sant Pere de Ribes", 41.26045, 1.77391],
  ["Sant Pere de Riudebitlles", 41.45, 1.7],
  ["Sant Pere de Vilamajor", 41.68333, 2.38333],
  ["Sant Pol de Mar", 41.60177, 2.61741],
  ["Sant Quintí de Mediona", 41.46235, 1.66391],
  ["Sant Quirze Safaja", 41.73333, 2.15],
  ["Sant Quirze del Vallès", 41.53333, 2.08333],
  ["Sant Sadurní d'Anoia", 41.42555, 1.78519],
  ["Sant Sadurní d'Osormort", 41.9, 2.38333],
  ["Sant Salvador de Guardiola", 41.68333, 1.76667],
  ["Sant Vicenç de Castellet", 41.66667, 1.86667],
  ["Sant Vicenç de Montalt", 41.57853, 2.50879],
  ["Sant Vicenç dels Horts", 41.39317, 2.00689],
  ["Santa Coloma de Cervelló", 41.36736, 2.01426],
  ["Santa Coloma de Gramenet", 41.45152, 2.2081],
  ["Santa Eugènia de Berga", 41.9, 2.28333],
  ["Santa Eulàlia de Ronçana", 41.65, 2.23333],
  ["Santa Fe del Penedès", 41.38333, 1.71667],
  ["Santa Margarida de Montbui", 41.55, 1.61667],
  ["Santa Maria d'Oló", 41.86667, 2.03333],
  ["Santa Maria de Martorelles", 41.51667, 2.25],
  ["Santa Maria de Palautordera", 41.69417, 2.44566],
  ["Santa Oliva", 41.25357, 1.55086],
  ["Santa Perpètua de Mogoda", 41.53333, 2.18333],
  ["Santa Susanna", 41.73333, 2.4],
  ["Santpedor", 41.78309, 1.84673],
  ["Sentmenat", 41.60862, 2.13532],
  ["Seva", 41.83831, 2.28007],
  ["Sitges", 41.23506, 1.81193],
  ["Subirats", 41.4, 1.83333],
  ["Súria", 41.83333, 1.75],
  ["Tagamanent", 41.73747, 2.2672],
  ["Talamanca", 41.7374, 1.97791],
  ["Taradell", 41.87495, 2.28662],
  ["Teià", 41.49804, 2.32206],
  ["Terrassa", 41.56667, 2.01667],
  ["Tiana", 41.48201, 2.26702],
  ["Tona", 41.84789, 2.22808],
  ["Torrelles de Foix", 41.38333, 1.56667],
  ["Torrelles de Llobregat", 41.35, 1.98333],
  ["Ullastrell", 41.52643, 1.95537],
  ["Vacarisses", 41.6, 1.91667],
  ["Vallbona d'Anoia", 41.51667, 1.71667],
  ["Vallgorguina", 41.64822, 2.50996],
  ["Vallirana", 41.38676, 1.93205],
  ["Vallromanes", 41.53333, 2.3],
  ["Viladecans", 41.31405, 2.01427],
  ["Viladecavalls", 41.55, 1.95],
  ["Viladrau", 41.84746, 2.39019],
  ["Vilafranca del Penedès", 41.34618, 1.69713],
  ["Vilalba Sasserra", 41.65, 2.45],
  ["Vilanova del Camí", 41.57165, 1.63751],
  ["Vilanova del Vallès", 41.55336, 2.28583],
  ["Vilanova i la Geltrú", 41.22392, 1.72511],
  ["Vilassar de Dalt", 41.51667, 2.36667],
  ["Vilassar de Mar", 41.50507, 2.39227],
  ["Vilobí del Penedès", 41.38333, 1.65],
  ["el Bruc", 41.58333, 1.78333],
  ["el Brull", 41.81657, 2.30531],
  ["el Masnou", 41.47978, 2.3188],
  ["el Papiol", 41.43333, 2.01667],
  ["el Pla del Penedès", 41.41667, 1.71667],
  ["el Prat de Llobregat", 41.32784, 2.09472],
  ["el Vendrell", 41.21667, 1.53333],
  ["els Hostalets de Pierola", 41.53423, 1.76951],
  ["els Prats de Rei", 41.70592, 1.54319],
  ["l'Ametlla del Vallès", 41.66667, 2.26667],
  ["l'Estany", 41.86924, 2.11223],
  ["l'Hospitalet de Llobregat", 41.35967, 2.10028],
  ["la Garriga", 41.68333, 2.28333],
  ["la Granada", 41.37816, 1.71902],
  ["la Llacuna", 41.47145, 1.53241],
  ["la Llagosta", 41.51435, 2.19297],
  ["la Pobla de Claramunt", 41.55423, 1.67712],
  ["la Roca del Vallès", 41.58333, 2.33333],
  ["les Cabanyes", 41.36667, 1.7],
  ["les Franqueses del Vallès", 41.61929, 2.29829],
  ["Òdena", 41.6, 1.65],
  ["Òrrius", 41.55, 2.35],
];

/**
 * Más allá de esto no se nombra nada. Dentro del área cubierta el vecino más cercano
 * cae siempre muy por debajo, así que este tope solo salta fuera de ella — mar adentro,
 * o pasado el borde del bbox — y ahí es mejor no decir nada que señalar un pueblo que
 * está a media hora en coche.
 */
const MAX_DISTANCE_KM = 15;

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/**
 * El topónimo más cercano a un punto — o null si no hay ninguno lo bastante cerca.
 *
 * Un barrido lineal sobre 227 filas por incendio y por ciclo: no hace falta índice
 * espacial para eso, y un árbol aquí sería más código que mantener a cambio de nada.
 */
export function nearestPlace(lat: number, lng: number): string | null {
  let bestName: string | null = null;
  let bestKm = Number.POSITIVE_INFINITY;

  for (const [name, mLat, mLng] of MUNICIPALITIES) {
    const km = haversineKm(lat, lng, mLat, mLng);
    if (km < bestKm) {
      bestKm = km;
      bestName = name;
    }
  }

  return bestName !== null && bestKm <= MAX_DISTANCE_KM ? bestName : null;
}
