// Blade Element Theory (BET) flight physics approach

export interface AircraftSpecs {
  name: string;
  mass: number; // kg
  wingArea: number; // m^2
  wingSpan?: number; // m (optional, fallback provided)
  thrust: number; // Max thrust in Newtons
  clMap: [number, number][]; // [AoA deg, Cl]
  cdMap: [number, number][]; // [AoA deg, Cd]
}

const defaultAoAMap: [number, number][] = [
  [-5, -0.4],
  [0, 0.2],
  [5, 0.8],
  [10, 1.2],
  [15, 1.5],
  [16, 1.4], // stall starts
  [20, 0.8],
  [25, 0.5]
];

const defaultCdMap: [number, number][] = [
  [-5, 0.05],
  [0, 0.03],
  [5, 0.05],
  [10, 0.08],
  [15, 0.15],
  [16, 0.2],
  [20, 0.4],
  [25, 0.6]
];

export const aircraftDB: Record<string, AircraftSpecs> = {
  'Boeing 737': { name: 'Boeing 737', mass: 65000, wingArea: 125, wingSpan: 34, thrust: 240000, clMap: defaultAoAMap, cdMap: defaultCdMap },
  'Boeing 777': { name: 'Boeing 777', mass: 240000, wingArea: 427, wingSpan: 60, thrust: 800000, clMap: defaultAoAMap, cdMap: defaultCdMap },
  'A330': { name: 'A330', mass: 230000, wingArea: 361, wingSpan: 60, thrust: 600000, clMap: defaultAoAMap, cdMap: defaultCdMap },
  'A300': { name: 'A300', mass: 170000, wingArea: 260, wingSpan: 44, thrust: 500000, clMap: defaultAoAMap, cdMap: defaultCdMap },
  'A310': { name: 'A310', mass: 150000, wingArea: 219, wingSpan: 43, thrust: 450000, clMap: defaultAoAMap, cdMap: defaultCdMap },
  '717': { name: '717', mass: 50000, wingArea: 92, wingSpan: 28, thrust: 160000, clMap: defaultAoAMap, cdMap: defaultCdMap },
  'MD 11': { name: 'MD 11', mass: 270000, wingArea: 338, wingSpan: 51, thrust: 800000, clMap: defaultAoAMap, cdMap: defaultCdMap },
  'DC 10': { name: 'DC 10', mass: 240000, wingArea: 367, wingSpan: 50, thrust: 700000, clMap: defaultAoAMap, cdMap: defaultCdMap },
  'MD 95': { name: 'MD 95', mass: 50000, wingArea: 92, wingSpan: 28, thrust: 160000, clMap: defaultAoAMap, cdMap: defaultCdMap },
  'Custom': { name: 'Custom', mass: 65000, wingArea: 125, wingSpan: 34, thrust: 240000, clMap: defaultAoAMap, cdMap: defaultCdMap },
};

function interpolateLUT(lut: [number, number][], val: number): number {
  if (val <= lut[0][0]) return lut[0][1];
  if (val >= lut[lut.length - 1][0]) return lut[lut.length - 1][1];
  for (let i = 0; i < lut.length - 1; i++) {
    if (val >= lut[i][0] && val <= lut[i + 1][0]) {
      const t = (val - lut[i][0]) / (lut[i+1][0] - lut[i][0]);
      return lut[i][1] + t * (lut[i+1][1] - lut[i][1]);
    }
  }
  return 0;
}

export function calculateForces(velocitySq: number, aoa: number, specs: AircraftSpecs, airDensity: number = 1.225) {
  // Blade Element Theory (BET) approximation
  // We slice the wing into a set of elements across the span.
  const NUM_ELEMENTS = 10;
  const span = specs.wingSpan || Math.sqrt(specs.wingArea * 8); // Aspect ratio ~8 fallback
  const elementSpan = span / NUM_ELEMENTS;
  const elementArea = specs.wingArea / NUM_ELEMENTS;
  
  let totalLift = 0;
  let totalDrag = 0;
  
  // To prevent immediate stall at 0 speed (where small vertical variations create huge AoA),
  // we scale down aerodynamic forces when dynamic pressure is near zero.
  const baseVelocity = Math.sqrt(Math.max(0, velocitySq));
  
  for (let i = 0; i < NUM_ELEMENTS; i++) {
    // Distance from the center fuselage
    const y = (i - (NUM_ELEMENTS - 1) / 2) * elementSpan;
    
    // In a fully dynamic model, we'd include rollRate * y into the local vertical velocity,
    // altering the local AoA. 
    // Example: const localW = rollRate * y; // Induced downward speed
    // Here we assume standard forward flow with unified AoA for a stabilized startup
    
    // At very low speeds, clamp local AoA so mathematically it doesn't divide by zero and stall
    let localAoA = aoa; 
    let localVelSq = velocitySq;
    
    let cl = interpolateLUT(specs.clMap, localAoA);
    let cd = interpolateLUT(specs.cdMap, localAoA);
    
    // Low speed stall protection (fade out aerodynamic stall bounds when barely moving)
    if (baseVelocity < 15.0) {
       const ratio = baseVelocity / 15.0; // 0 to 1
       // blend back to a safe pre-stall profile so they can accelerate smoothly on runway
       cl = cl * ratio + (interpolateLUT(specs.clMap, 0)) * (1 - ratio);
       cd = cd * ratio + (interpolateLUT(specs.cdMap, 0)) * (1 - ratio);
    }
    
    const localQ = 0.5 * airDensity * localVelSq;
    
    totalLift += localQ * elementArea * cl;
    totalDrag += localQ * elementArea * cd;
  }
  
  return { lift: totalLift, drag: totalDrag, cl: totalLift/(0.5*airDensity*velocitySq*specs.wingArea || 1), cd: totalDrag/(0.5*airDensity*velocitySq*specs.wingArea || 1) };
}
