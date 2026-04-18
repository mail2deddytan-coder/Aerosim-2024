// Simplified flight lookup tables and dynamics

export interface AircraftSpecs {
  name: string;
  mass: number; // kg
  wingArea: number; // m^2
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
  [16, 1.4], // stall
  [20, 0.8],
];

const defaultCdMap: [number, number][] = [
  [-5, 0.05],
  [0, 0.03],
  [5, 0.05],
  [10, 0.08],
  [15, 0.15],
  [16, 0.2],
  [20, 0.4],
];

export const aircraftDB: Record<string, AircraftSpecs> = {
  'Boeing 737': { name: 'Boeing 737', mass: 65000, wingArea: 125, thrust: 240000, clMap: defaultAoAMap, cdMap: defaultCdMap },
  'Boeing 777': { name: 'Boeing 777', mass: 240000, wingArea: 427, thrust: 800000, clMap: defaultAoAMap, cdMap: defaultCdMap },
  'A330': { name: 'A330', mass: 230000, wingArea: 361, thrust: 600000, clMap: defaultAoAMap, cdMap: defaultCdMap },
  'A300': { name: 'A300', mass: 170000, wingArea: 260, thrust: 500000, clMap: defaultAoAMap, cdMap: defaultCdMap },
  'A310': { name: 'A310', mass: 150000, wingArea: 219, thrust: 450000, clMap: defaultAoAMap, cdMap: defaultCdMap },
  '717': { name: '717', mass: 50000, wingArea: 92, thrust: 160000, clMap: defaultAoAMap, cdMap: defaultCdMap },
  'MD 11': { name: 'MD 11', mass: 270000, wingArea: 338, thrust: 800000, clMap: defaultAoAMap, cdMap: defaultCdMap },
  'DC 10': { name: 'DC 10', mass: 240000, wingArea: 367, thrust: 700000, clMap: defaultAoAMap, cdMap: defaultCdMap },
  'MD 95': { name: 'MD 95', mass: 50000, wingArea: 92, thrust: 160000, clMap: defaultAoAMap, cdMap: defaultCdMap },
  'Custom': { name: 'Custom', mass: 65000, wingArea: 125, thrust: 240000, clMap: defaultAoAMap, cdMap: defaultCdMap },
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
  const cl = interpolateLUT(specs.clMap, aoa);
  const cd = interpolateLUT(specs.cdMap, aoa);
  
  const q = 0.5 * airDensity * velocitySq;
  const lift = q * specs.wingArea * cl;
  const drag = q * specs.wingArea * cd;
  
  return { lift, drag, cl, cd };
}
