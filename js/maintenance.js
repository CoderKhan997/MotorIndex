/* ============================================================
   MotorIndex — Maintenance Schedule Database
   Based on manufacturer-recommended service intervals
   ============================================================ */

const MAINTENANCE_DB = {

  // ── General schedule (applies to all vehicles) ────────────
  general: [
    {
      service:  'Engine Oil & Filter Change',
      interval: '5,000–7,500 mi / 6 months (conv.) · 7,500–10,000 mi / 12 months (synthetic)',
      priority: 'high',
      notes:    'Most critical service. Always consult oil cap or owner manual for viscosity.',
    },
    {
      service:  'Tire Rotation',
      interval: 'Every 5,000–7,500 mi',
      priority: 'high',
      notes:    'Equalizes wear across all four tires. Often included with oil change.',
    },
    {
      service:  'Brake System Inspection',
      interval: 'Every 12,000 mi or annually',
      priority: 'high',
      notes:    'Inspect pads, rotors, calipers, and brake fluid level.',
    },
    {
      service:  'Tire Pressure & Condition',
      interval: 'Monthly',
      priority: 'high',
      notes:    'Check cold pressure against door placard. Inspect for uneven wear or damage.',
    },
    {
      service:  'Engine Air Filter',
      interval: 'Every 15,000–30,000 mi',
      priority: 'medium',
      notes:    'Inspect annually. Replace sooner in dusty conditions.',
    },
    {
      service:  'Cabin Air Filter',
      interval: 'Every 15,000–25,000 mi or annually',
      priority: 'medium',
      notes:    'Affects HVAC efficiency and interior air quality.',
    },
    {
      service:  'Wiper Blades',
      interval: 'Every 6–12 months',
      priority: 'low',
      notes:    'Replace when streaking or skipping. Use winter blades in snow regions.',
    },
    {
      service:  'Battery Test & Terminals',
      interval: 'Every 2–3 years or annually after year 3',
      priority: 'medium',
      notes:    'Most batteries last 3–5 years. Cold weather accelerates wear.',
    },
    {
      service:  'Brake Fluid Flush',
      interval: 'Every 2 years / 30,000 mi',
      priority: 'high',
      notes:    'Brake fluid is hygroscopic — it absorbs moisture and loses effectiveness.',
    },
    {
      service:  'Coolant / Antifreeze Flush',
      interval: 'Every 30,000–50,000 mi or 2–5 years',
      priority: 'medium',
      notes:    'Prevents corrosion and maintains proper operating temperature.',
    },
    {
      service:  'Spark Plugs',
      interval: 'Every 30,000 mi (copper) · 60,000 mi (platinum) · 100,000 mi (iridium)',
      priority: 'medium',
      notes:    'Check owner manual for plug type. Worn plugs reduce fuel efficiency.',
    },
    {
      service:  'Automatic Transmission Service',
      interval: 'Every 30,000–60,000 mi (conventional) · 60,000–100,000 mi (sealed)',
      priority: 'high',
      notes:    'Some manufacturers label transmissions "lifetime" — this is misleading. Service prolongs life.',
    },
    {
      service:  'Power Steering Fluid',
      interval: 'Every 50,000 mi or 3 years (hydraulic PS only)',
      priority: 'low',
      notes:    'Not applicable to electric power steering (EPS) vehicles.',
    },
    {
      service:  'Drive Belts (Serpentine/Accessory)',
      interval: 'Inspect every 30,000 mi · Replace at 60,000–100,000 mi',
      priority: 'high',
      notes:    'Failure can strand you. Look for cracking, fraying, or glazing.',
    },
    {
      service:  'Timing Belt',
      interval: 'Every 60,000–100,000 mi (interference engines — check your manual)',
      priority: 'high',
      notes:    'CRITICAL on interference engines. Failure causes catastrophic engine damage. Many modern cars use a timing chain (no replacement needed).',
    },
    {
      service:  'Differential Fluid (AWD/4WD/RWD)',
      interval: 'Every 30,000–50,000 mi',
      priority: 'medium',
      notes:    'Front and rear differentials. Transfer case fluid for 4WD vehicles.',
    },
    {
      service:  'Fuel Filter',
      interval: 'Every 30,000 mi (external filter) · Some models have lifetime in-tank filters',
      priority: 'medium',
      notes:    'Older vehicles (pre-2000) typically have external, serviceable filters.',
    },
    {
      service:  'Oxygen Sensors',
      interval: 'Every 60,000 mi (1-wire) · 100,000 mi (heated 4-wire)',
      priority: 'medium',
      notes:    'Replace if check engine light illuminates with relevant codes.',
    },
    {
      service:  'Brake Pads & Rotors',
      interval: 'Pads: 25,000–70,000 mi · Rotors: 30,000–70,000 mi (varies by driving style)',
      priority: 'high',
      notes:    'Replace pads before metal-on-metal contact. Inspect rotors for scoring or warping.',
    },
  ],

  // ── Make-specific overrides ───────────────────────────────
  makes: {
    TOYOTA: {
      brand:    'Toyota',
      oilNote:  'Toyota recommends full synthetic 0W-20 every 10,000 mi for most 2010+ models. Older models may use 5W-30 every 5,000 mi.',
      notes:    'Follow Toyota Maintenance Schedule A (normal) or B (severe). Toyota vehicles are known for long service intervals when maintained correctly.',
      overrides: [
        { service: 'Engine Oil & Filter Change', interval: '10,000 mi / 12 months (synthetic)' },
      ],
    },
    HONDA: {
      brand:    'Honda',
      oilNote:  'Honda uses the Maintenance Minder system. Most models call for 0W-20 synthetic. Service A = oil change; Service B = oil change + inspection.',
      notes:    'Follow the Maintenance Minder display in the instrument cluster. Letters (A, B, 1–6) indicate specific services due.',
      overrides: [
        { service: 'Engine Oil & Filter Change', interval: '7,500–10,000 mi (Maintenance Minder)' },
      ],
    },
    BMW: {
      brand:    'BMW',
      oilNote:  'BMW Condition Based Service (CBS) uses 0W-30 or 5W-30 LL-01 certified oil. Intervals up to 15,000 mi under CBS.',
      notes:    'BMW uses Condition Based Service (CBS) monitoring. Service intervals are vehicle-driven, not mileage-only. Always use BMW-approved oil spec LL-01 or LL-04.',
      overrides: [
        { service: 'Engine Oil & Filter Change', interval: '10,000–15,000 mi (CBS monitored)' },
        { service: 'Spark Plugs', interval: 'Every 45,000 mi' },
        { service: 'Coolant / Antifreeze Flush', interval: 'Every 4 years' },
      ],
    },
    'MERCEDES-BENZ': {
      brand:    'Mercedes-Benz',
      oilNote:  'ASSYST Plus oil life monitor. Uses MB-Approved 229.5 or 229.51 spec oil. Service A at ~10,000 mi, Service B at ~20,000 mi.',
      notes:    'Follow ASSYST Plus service indicator. Alternates between Service A and Service B. Mercedes recommends MB-229 specification oils.',
      overrides: [
        { service: 'Engine Oil & Filter Change', interval: 'Service A/B cycle ~10,000 mi (ASSYST Plus)' },
      ],
    },
    FORD: {
      brand:    'Ford',
      oilNote:  'Ford Intelligent Oil Life Monitor. Most models use 5W-20 or 5W-30 synthetic blend. Flex Fuel models may have specific requirements.',
      notes:    'Ford uses the Intelligent Oil Life Monitor. Follow the oil change message in the instrument cluster.',
      overrides: [
        { service: 'Engine Oil & Filter Change', interval: '7,500–10,000 mi (oil life monitor)' },
      ],
    },
    CHEVROLET: {
      brand:    'Chevrolet',
      oilNote:  'GM Oil Life System (OLS) monitors driving conditions. Use dexos1 Gen 2 certified oil (typically 0W-20 or 5W-30).',
      notes:    'Follow the GM Oil Life System percentage indicator. Dexos-approved oil is required on most GM vehicles to maintain warranty.',
      overrides: [
        { service: 'Engine Oil & Filter Change', interval: '7,500–10,000 mi (GM Oil Life System)' },
      ],
    },
    AUDI: {
      brand:    'Audi',
      oilNote:  'Audi uses 5W-30 or 5W-40 VW 502.00/505.00/507.00 spec oil. Oil service every 10,000 mi under Extended Interval service.',
      notes:    'Audi Extended Interval service. Service displays in MMI/instrument cluster. Always use Audi/VW approved oil specification.',
      overrides: [
        { service: 'Engine Oil & Filter Change', interval: '10,000 mi (VW Long-Life 507.00 oil)' },
        { service: 'Spark Plugs', interval: 'Every 40,000 mi' },
      ],
    },
    VOLKSWAGEN: {
      brand:    'Volkswagen',
      oilNote:  'VW Long-Life Service uses 0W-30 or 5W-30 VW 504.00/507.00 spec. Up to 10,000 mi between changes.',
      notes:    'VW uses Long-Life service intervals. Must use VW-spec 504.00/507.00 oil. Follow the Service Due indicator in instrument cluster.',
      overrides: [
        { service: 'Engine Oil & Filter Change', interval: '10,000 mi (VW Long-Life service)' },
      ],
    },
    SUBARU: {
      brand:    'Subaru',
      oilNote:  'Subaru recommends 0W-20 synthetic for most 2011+ models. Horizontally-opposed (Boxer) engines require proper oil viscosity.',
      notes:    'Subaru AWD system requires differential and transfer case fluid checks every 30,000 mi. EyeSight cameras should be recalibrated after windshield work.',
      overrides: [
        { service: 'Engine Oil & Filter Change', interval: '6,000–7,500 mi (synthetic)' },
      ],
    },
    HYUNDAI: {
      brand:    'Hyundai',
      oilNote:  'Most Hyundai models use 0W-20 full synthetic. Maintenance covered under 5-year/60,000 mile plan for new vehicles.',
      notes:    'Hyundai complimentary maintenance covers first 3 years / 36,000 miles for new vehicles.',
      overrides: [
        { service: 'Engine Oil & Filter Change', interval: '7,500–10,000 mi (0W-20 synthetic)' },
      ],
    },
    KIA: {
      brand:    'Kia',
      oilNote:  'Most Kia models use 0W-20 full synthetic. Complimentary maintenance for new vehicles.',
      notes:    'Kia complimentary maintenance covers 3 years / 30,000 miles for new vehicles. Verify drivetrain warranty requirements.',
      overrides: [
        { service: 'Engine Oil & Filter Change', interval: '7,500–10,000 mi (0W-20 synthetic)' },
      ],
    },
    NISSAN: {
      brand:    'Nissan',
      oilNote:  'Nissan recommends 0W-20 synthetic for most modern models. CVT fluid service is critical for vehicles with CVT transmission.',
      notes:    'Nissan CVT (Continuously Variable Transmission) requires NS-3 CVT fluid — do not substitute. Service every 60,000 miles.',
      overrides: [
        { service: 'Engine Oil & Filter Change', interval: '5,000–7,500 mi' },
        { service: 'Automatic Transmission Service', interval: 'Every 60,000 mi (CVT — NS-3 fluid required)' },
      ],
    },
    MAZDA: {
      brand:    'Mazda',
      oilNote:  'Most Mazda SKYACTIV engines use 0W-20 full synthetic. Some diesel models in international markets use specific fluids.',
      notes:    'Mazda SKYACTIV engines are tuned for high compression — follow oil spec exactly. Diesel SKYACTIV-D models have specific service requirements.',
      overrides: [
        { service: 'Engine Oil & Filter Change', interval: '7,500–10,000 mi (0W-20 SKYACTIV)' },
      ],
    },
    TESLA: {
      brand:    'Tesla',
      oilNote:  'Tesla electric vehicles have no engine oil. Drivetrain fluid should be inspected every 25,000 mi (Model S/X).',
      notes:    'Tesla vehicles require no traditional engine maintenance. Brake fluid test every 2 years. Tire rotation is the most frequent service needed.',
      overrides: [
        { service: 'Engine Oil & Filter Change', interval: 'NOT APPLICABLE (electric vehicle)' },
        { service: 'Spark Plugs', interval: 'NOT APPLICABLE (electric vehicle)' },
        { service: 'Timing Belt', interval: 'NOT APPLICABLE (electric vehicle)' },
        { service: 'Fuel Filter', interval: 'NOT APPLICABLE (electric vehicle)' },
        { service: 'Oxygen Sensors', interval: 'NOT APPLICABLE (electric vehicle)' },
        { service: 'Coolant / Antifreeze Flush', interval: 'Every 4 years (thermal management system)' },
        { service: 'Tire Rotation', interval: 'Every 6,250 mi (regenerative braking causes uneven wear)' },
      ],
    },
    PORSCHE: {
      brand:    'Porsche',
      oilNote:  'Porsche uses 0W-40 or 5W-40 Mobil 1 fully synthetic. Service at 20,000 mi for modern models.',
      notes:    'Porsche recommends annual inspections regardless of mileage. PDK transmission fluid every 40,000 mi. PASM, PDCC suspension systems require specialist equipment.',
      overrides: [
        { service: 'Engine Oil & Filter Change', interval: '20,000 mi / annually (Mobil 1 0W-40)' },
        { service: 'Automatic Transmission Service', interval: 'Every 40,000 mi (PDK fluid)' },
      ],
    },
    LEXUS: {
      brand:    'Lexus',
      oilNote:  'Lexus uses Toyota-based service recommendations. Most modern models use 0W-20 synthetic at 10,000 mi intervals.',
      notes:    'Lexus vehicles follow similar service schedules to Toyota. Premium materials may require specific cleaning products. CVT-equipped models need specific ATF.',
      overrides: [
        { service: 'Engine Oil & Filter Change', interval: '10,000 mi / 12 months (0W-20 synthetic)' },
      ],
    },
    ACURA: {
      brand:    'Acura',
      oilNote:  'Acura Maintenance Minder system. Most models use 0W-20 synthetic.',
      notes:    'Follow the Maintenance Minder system (same as Honda). SH-AWD vehicles require rear differential fluid service every 30,000 mi.',
      overrides: [
        { service: 'Engine Oil & Filter Change', interval: '7,500–10,000 mi (Maintenance Minder)' },
      ],
    },
    JEEP: {
      brand:    'Jeep',
      oilNote:  'Most Jeep models use 0W-20 or 5W-20 synthetic. 4x4 models require front and rear axle fluid service.',
      notes:    'Off-road use significantly accelerates service intervals. Check axle fluids after water fording. Jeep recommends more frequent service under "severe" conditions.',
      overrides: [
        { service: 'Engine Oil & Filter Change', interval: '6,000–10,000 mi (oil life monitor)' },
        { service: 'Differential Fluid (AWD/4WD/RWD)', interval: 'Every 30,000 mi or after water fording' },
      ],
    },
    RAM: {
      brand:    'Ram',
      oilNote:  'Ram trucks use 0W-20 or 5W-20. Heavy-duty towing/hauling requires more frequent oil and transmission service.',
      notes:    'Towing/hauling frequently moves Ram into "severe duty" category — halve the service intervals for critical items. Diesel models have additional DEF and fuel filter requirements.',
      overrides: [
        { service: 'Engine Oil & Filter Change', interval: '7,500–10,000 mi (standard) · 5,000–6,000 mi (severe/diesel)' },
      ],
    },
    DODGE: {
      brand:    'Dodge',
      oilNote:  'Most Dodge models use 0W-20 or 5W-20 synthetic. High-performance models (Hellcat, Demon) may require 5W-40.',
      notes:    'High-performance Dodge models may require more frequent oil changes under track or spirited driving conditions.',
      overrides: [],
    },
    CADILLAC: {
      brand:    'Cadillac',
      oilNote:  'GM Dexos1 Gen2 approved oil. Oil life monitor guides intervals.',
      notes:    'Follows GM Dexos requirements. Magnetic Ride Control suspension fluid should be inspected periodically.',
      overrides: [
        { service: 'Engine Oil & Filter Change', interval: '7,500–10,000 mi (GM Oil Life System)' },
      ],
    },
    LINCOLN: {
      brand:    'Lincoln',
      oilNote:  'Ford-based platforms. Most use 5W-20 or 5W-30 synthetic. Intelligent Oil Life Monitor.',
      notes:    'Follow Ford Intelligent Oil Life Monitor. Lincoln Aviator, Nautilus, and Navigator use Ford engine platforms.',
      overrides: [
        { service: 'Engine Oil & Filter Change', interval: '7,500–10,000 mi (oil life monitor)' },
      ],
    },
    VOLVO: {
      brand:    'Volvo',
      oilNote:  'Volvo recommends 0W-20 or 5W-30 full synthetic. Service intervals up to 10,000 mi.',
      notes:    'Volvo uses a fixed service schedule. Climate Pack equipped models need cabin air filter checks more frequently in Scandinavia-style climates.',
      overrides: [
        { service: 'Engine Oil & Filter Change', interval: '10,000 mi / 12 months' },
      ],
    },
    INFINITI: {
      brand:    'Infiniti',
      oilNote:  'Nissan-derived platform. Most use 0W-20 or 5W-30 synthetic.',
      notes:    'Infiniti ATTESA E-TS AWD system requires rear differential and transfer case fluid service. Follow Nissan/Infiniti service intervals.',
      overrides: [],
    },
    GENESIS: {
      brand:    'Genesis',
      oilNote:  'Hyundai platform. Uses 0W-20 full synthetic.',
      notes:    'Genesis vehicles include complimentary scheduled maintenance for 3 years / 36,000 miles at Genesis dealer.',
      overrides: [
        { service: 'Engine Oil & Filter Change', interval: '7,500–10,000 mi (0W-20 synthetic)' },
      ],
    },
  },

  /** Get the maintenance schedule for a specific make */
  getSchedule(make) {
    const makeKey = make.toUpperCase();
    const makeData = this.makes[makeKey] || null;

    // Build effective schedule by applying overrides
    const schedule = this.general.map(item => {
      if (makeData?.overrides) {
        const override = makeData.overrides.find(o => o.service === item.service);
        if (override) {
          return { ...item, interval: override.interval, overridden: true };
        }
      }
      return { ...item };
    });

    return { schedule, makeData };
  },
};

window.MAINTENANCE_DB = MAINTENANCE_DB;
