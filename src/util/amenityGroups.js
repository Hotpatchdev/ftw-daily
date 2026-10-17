// Presentation groups only: preserve existing Sharetribe keys and filter semantics.
const groups = [
  [
    'Space & layout',
    /private.space|shared.space|common.area|lounge|reception|(?:^|-)(?:room|chair)(?:-|$)|ceiling|cove|stage|desk|styling.station|work.station|mirror|bench|table/,
  ],
  ['Access & accessibility', /access|drive.in|floor|lift|loading|ramp/],
  ['Parking & transport', /parking/],
  ['Storage & security', /storage|locker|cupboard|cctv|security|shelve/],
  [
    'Facilities & hygiene',
    /kitchen|refreshment|computer|toilet|washroom|bathroom|clean|bin|handwash|shower|towel|washing|basin|saniti|sterili|waste|glove|apron/,
  ],
  [
    'Comfort & environment',
    /lighting|air.condition|heating|window|soundproof|speaker|music|wifi|electricity/,
  ],
  ['Usage rules', /allowed|host.present/],
];

const categoryGroups = {
  hair_beauty_amenities: [
    [
      'Styling & barbering stations',
      /styling.chair|barber.chair|barber.unit|mirror|stool|ring.light/,
    ],
    ['Washing & treatment', /backwash|washing|basin|massage|treatment|pedicure/],
    ['Sanitation & clinical', /sterili|cleaning|waste|sharps|piercing/],
    [
      'Professional tools & accessories',
      /hair|barber.accessories|styling.accessories|cape|gown|collar|trolley|light|equipment/,
    ],
  ],
  wellness_amenities: [
    ['Therapy & consultation', /couch|armchair|hypnotherapy|desk|patient|talking/],
    ['Bodywork & clinical treatment', /massage|treatment|acupuncture|examination|trolley|yoga/],
    ['Hygiene & clinical logistics', /cleaning|towel|sink|roll|glove|apron|saniti/],
    ['Privacy & ambiance', /changing|lighting|privacy/],
  ],
  fitness_amenities: [
    [
      'Training equipment',
      /equipment|weight|boxing|martial|dance|climbing|cross.training|kettlebell|trx/,
    ],
    ['Studio & floor work', /mirror|mat|yoga|microphone|speaker|music/],
    ['Facilities & hygiene', /changing|shower|pool|water|towel|clean|locker|sauna/],
    ['Safety & professional support', /trainer|first.aid|emergency/],
  ],
  photography_and_film_amenities: [
    ['Studio infrastructure & layout', /cove|stage|ceiling|room|power|dmx/],
    ['Lighting & grip', /light|reflector|polyboard|trolley|stand|lift|ladder/],
    ['Backdrops & surfaces', /backdrop|paper|wall|brick|concrete|wood|rooftop/],
    ['Production & talent support', /mirror|makeup|rail|steamer|projector|rig|kitchen|monitor/],
  ],
  coworking_amenities: [
    ['Focus & collaboration', /meeting|phone|whiteboard|flipchart|desk|chair|privacy/],
    ['Connectivity & equipment', /wifi|internet|printer|scanner|computer|projector|screen/],
    ['Facilities & comfort', /kitchen|coffee|refreshment|clean|lounge|locker/],
  ],
  music_and_arts_amenities: [
    [
      'Audio gear & performance',
      /dj|stage|microphone|mixer|speaker|instrument|piano|drum|amp|audio|cable/,
    ],
    ['Recording & acoustics', /record|soundproof|acoustic|studio/],
    ['Creative tools & infrastructure', /easel|polyboard|rail|ceiling|sink|drying|plinth/],
  ],
  events_amenities: [
    ['Hospitality & licensing', /licen|bar|cater|kitchen|glass|crockery/],
    ['Production & entertainment', /stage|sound|speaker|light|projector|screen|microphone/],
    ['Space & facilities', /seat|chair|table|room|floor|cloak|toilet/],
  ],
  kitchen_amenities: [
    ['Professional cooking equipment', /oven|hob|grill|microwave|fryer|broiler|sous/],
    ['Cold & dry storage', /fridge|freezer|storage|shelv/],
    ['Preparation & smallwares', /counter|trolley|chopping|pot|pan|prep|vacuum/],
    ['Small appliances', /blender|processor|mixer/],
    ['Extraction & utilities', /extractor|power|dishwash|handwash|clean|grease/],
  ],
};

export const groupAmenities = (options, category) => {
  const definitions = categoryGroups[category] || groups;
  const buckets = definitions.map(([label]) => ({ label, options: [] }));
  const other = { label: 'Equipment & other amenities', options: [] };
  const seen = new Set();
  options.forEach(option => {
    const key = option.key || option.value;
    if (seen.has(key)) return;
    seen.add(key);
    const term = `${key} ${option.label}`.toLowerCase().replace(/[ _/]+/g, '-');
    const index = definitions.findIndex(([, pattern]) => pattern.test(term));
    (index < 0 ? other : buckets[index]).options.push(option);
  });
  return buckets.concat(other).filter(group => group.options.length);
};
