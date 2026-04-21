// Blade Element Theory (BET) flight physics approach

export interface AircraftSpecs {
  name: string;
  mass: number; // kg
  wingArea: number; // m^2
  wingSpan: number; // m
  thrust: number; // Max thrust in Newtons
  oswaldEfficiency: number; // e
}

export const aircraftDB: Record<string, AircraftSpecs> = {
  'Boeing 737': { name: 'Boeing 737', mass: 65000, wingArea: 125, wingSpan: 34.3, thrust: 240000, oswaldEfficiency: 0.82 },
  'Boeing 777': { name: 'Boeing 777', mass: 240000, wingArea: 427, wingSpan: 60.9, thrust: 800000, oswaldEfficiency: 0.85 },
  'A330': { name: 'A330', mass: 230000, wingArea: 361, wingSpan: 60.3, thrust: 600000, oswaldEfficiency: 0.85 },
  'A300': { name: 'A300', mass: 170000, wingArea: 260, wingSpan: 44.8, thrust: 500000, oswaldEfficiency: 0.84 },
  'A310': { name: 'A310', mass: 150000, wingArea: 219, wingSpan: 43.9, thrust: 450000, oswaldEfficiency: 0.84 },
  '717': { name: '717', mass: 50000, wingArea: 92, wingSpan: 28.4, thrust: 160000, oswaldEfficiency: 0.80 },
  'MD 11': { name: 'MD 11', mass: 270000, wingArea: 338, wingSpan: 51.7, thrust: 800000, oswaldEfficiency: 0.85 },
  'DC 10': { name: 'DC 10', mass: 240000, wingArea: 367, wingSpan: 50.4, thrust: 700000, oswaldEfficiency: 0.85 },
  'MD 95': { name: 'MD 95', mass: 50000, wingArea: 92, wingSpan: 28.4, thrust: 160000, oswaldEfficiency: 0.80 },
  'Custom': { name: 'Custom', mass: 65000, wingArea: 125, wingSpan: 34.3, thrust: 240000, oswaldEfficiency: 0.82 },
};

function getAirfoilCoefficients(alphaRad: number, symmetrical: boolean = false): { cl: number, cd: number } {
  const alphaDeg = alphaRad * (180 / Math.PI);
  const absAlphaDeg = Math.abs(alphaDeg);
  
  const cdMin = 0.015;
  const a0 = 2 * Math.PI; // Lift curve slope
  
  // NATIVE CAMBER: Commercial jets have cambered wings! They produce lift at 0 degrees Angle of Attack
  // A symmetrical airfoil (like a tail) produces 0 lift at 0 Angle of Attack.
  const zeroLiftAlphaRad = symmetrical ? 0 : -2.5 * (Math.PI / 180);
  
  // Attached flow region (Linear Lift, Quadratic Profile Drag)
  const clAttached = a0 * (alphaRad - zeroLiftAlphaRad);
  // Profile parasitic drag 
  const cdAttached = cdMin + 0.005 * Math.pow(alphaDeg / 10, 2); 

  // Separated flow region (Deep Stall Plate approximation)
  const clFlatPlate = 1.1 * Math.sin(2 * alphaRad);
  const cdFlatPlate = 1.2 * (1 - Math.cos(2 * alphaRad));

  // Sigmoid blend based on critical stall angle margin
  const stallAngleDeg = symmetrical ? 12.0 : 15.0; // Symmetrical airfoils usually stall sooner
  const blendSharpness = 0.8;
  const stallMargin = absAlphaDeg - stallAngleDeg;
  
  // 0 = completely attached, 1 = completely separated
  const separatedWeight = 1.0 / (1.0 + Math.exp(-blendSharpness * stallMargin));
  
  const cl = clAttached * (1 - separatedWeight) + clFlatPlate * separatedWeight;
  const cd = cdAttached * (1 - separatedWeight) + cdFlatPlate * separatedWeight;
  
  return { cl, cd };
}

export function calculateForces(velocity: number, aoaRad: number, slipRad: number, rates: {p: number, q: number, r: number}, controls: {pitch: number, roll: number, yaw: number}, specs: AircraftSpecs, airDensity: number = 1.225) {
  // X-Plane 12 Physics Engine Core: Blade Element Theory across all aerodynamic surfaces
  // Evaluates Wing, Horizontal Tail, and Vertical Tail independently with induced downwash and propwash coupling.
  
  const span = specs.wingSpan;
  const velocitySq = Math.max(0.1, velocity * velocity);
  const baseVelocity = Math.sqrt(velocitySq);
  
  // Induced Flow (Downwash) Angle
  const AR = (span * span) / specs.wingArea;
  const e = specs.oswaldEfficiency;
  const inducedAngleFactor = (2 / (AR * e)) / (1 + 2 / (AR * e));
  const alpha_i = aoaRad * inducedAngleFactor;
  const alpha_eff = aoaRad - alpha_i;

  let stallRatio = baseVelocity < 15.0 ? baseVelocity / 15.0 : 1.0;
  const { cl: clZerospeed, cd: cdZerospeed } = getAirfoilCoefficients(0);

  // Geometric assumptions for Empennage (Tail) based on typical airliner ratios
  const htArea = specs.wingArea * 0.2;
  const htArm = span * 0.45; 
  const vtArea = specs.wingArea * 0.15;
  const vtArm = span * 0.45;

  // 1. MAIN WING BET Evaluation
  const evaluateWingElement = (y: number): [number, number, number, number] => {
    const normalizedY = (2 * y) / span;
    const chord = (4 * specs.wingArea) / (Math.PI * span) * Math.sqrt(Math.max(0, 1 - normalizedY * normalizedY));
    
    // Aerodynamic damping (Roll Rate 'p' spins the wing)
    const localDownVel = rates.p * y; 
    const dampAoA = Math.atan2(localDownVel, baseVelocity);
    
    // Aileron deflection on outer wing
    let aileronAoA = 0;
    if (Math.abs(normalizedY) > 0.6) {
        const aileronDefl = controls.roll * 15 * (Math.PI / 180);
        aileronAoA = y > 0 ? -aileronDefl : aileronDefl;
    }

    let localElementAoA = alpha_eff + dampAoA + aileronAoA;
    let { cl, cd } = getAirfoilCoefficients(localElementAoA);
    
    if (stallRatio < 1.0) {
       cl = cl * stallRatio + clZerospeed * (1 - stallRatio);
       cd = cd * stallRatio + cdZerospeed * (1 - stallRatio);
    }

    const localQ = 0.5 * airDensity * velocitySq;
    const dL_2D = localQ * chord * cl;
    const dD_2D = localQ * chord * cd;
    
    // 3D vector shift for exact induced drag
    const dL_3D = dL_2D * Math.cos(alpha_i) - dD_2D * Math.sin(alpha_i);
    const dD_3D = dL_2D * Math.sin(alpha_i) + dD_2D * Math.cos(alpha_i);

    // Roll Moment (Right wing UP -> negative roll)
    const dRoll = dL_3D * y;
    // Adverse Yaw (Right wing drag -> nose right -> positive yaw)
    const dYaw = dD_3D * y; 

    return [dL_3D, dD_3D, dRoll, dYaw];
  };

  const adaptiveSimpsons = (
    a: number, b: number, eps: number, maxD: number, d: number, 
    fa: [number, number, number, number], fm: [number, number, number, number], fb: [number, number, number, number]
  ): [number, number, number, number] => {
    const m = (a + b) / 2;
    const h = b - a;
    
    const m1 = (a + m) / 2;
    const m2 = (m + b) / 2;
    const fm1 = evaluateWingElement(m1);
    const fm2 = evaluateWingElement(m2);

    const calc = (wA: any, wM: any, wB: any, step: number) => [
      (step / 6) * (wA[0] + 4 * wM[0] + wB[0]),
      (step / 6) * (wA[1] + 4 * wM[1] + wB[1]),
      (step / 6) * (wA[2] + 4 * wM[2] + wB[2]),
      (step / 6) * (wA[3] + 4 * wM[3] + wB[3])
    ];

    const S = calc(fa, fm, fb, h);
    const Sleft = calc(fa, fm1, fm, h/2);
    const Sright = calc(fm, fm2, fb, h/2);
    const S2: [number,number,number,number] = [Sleft[0]+Sright[0], Sleft[1]+Sright[1], Sleft[2]+Sright[2], Sleft[3]+Sright[3]];

    if (d >= maxD || Math.abs(S2[0]-S[0]) <= 15*eps) {
       return [S2[0]+(S2[0]-S[0])/15, S2[1]+(S2[1]-S[1])/15, S2[2]+(S2[2]-S[2])/15, S2[3]+(S2[3]-S[3])/15];
    }
    const LRes = adaptiveSimpsons(a, m, eps/2, maxD, d+1, fa, fm1, fm);
    const RRes = adaptiveSimpsons(m, b, eps/2, maxD, d+1, fm, fm2, fb);
    return [LRes[0]+RRes[0], LRes[1]+RRes[1], LRes[2]+RRes[2], LRes[3]+RRes[3]];
  };

  const wingRes = adaptiveSimpsons(-span/2, span/2, 1.0, 8, 0, evaluateWingElement(-span/2), evaluateWingElement(0), evaluateWingElement(span/2));

  let totalLift = wingRes[0];
  let totalDrag = wingRes[1];
  let rollMoment = -wingRes[2]; 
  let yawMoment = wingRes[3];

  // 2. HORIZONTAL STABILIZER
  // Downwash hits horizontal tail, pitch rate creates dampening
  const tailAoA = aoaRad - alpha_i * 2.0; 
  const tailDownVel = rates.q * htArm; // Upward pitch rate means tail goes DOWN (-Z relative) => upward relative wind => positive AoA
  const pitchDampAoA = Math.atan2(tailDownVel, baseVelocity);
  const elevatorAoA = controls.pitch * 20 * (Math.PI / 180); 
  
  // NATIVE INCIDENCE ANGLE: Set to 0 to prevent uncontrollable pitching up. The aerodynamic stability will naturally push nose down at high AoA.
  const htIncidence = 0;

  let localHtAoA = tailAoA + pitchDampAoA + elevatorAoA + htIncidence;
  let htCoefs = getAirfoilCoefficients(localHtAoA, true); // true = tail uses symmetrical airfoil (zero camber)
  const htQ = 0.5 * airDensity * velocitySq;
  totalLift += htQ * htArea * htCoefs.cl;
  totalDrag += htQ * htArea * htCoefs.cd;
  let pitchMoment = -(htQ * htArea * htCoefs.cl) * htArm;

  // 3. VERTICAL STABILIZER & RUDDER
  const tailSideVel = rates.r * vtArm; // Rightward yaw rate means tail goes LEFT (-Y) => rightward relative wind => positive localVtAoA
  const yawDampAoA = Math.atan2(tailSideVel, baseVelocity);
  const rudderAoA = -controls.yaw * 25 * (Math.PI / 180); 
  
  let localVtAoA = slipRad + yawDampAoA + rudderAoA;
  let vtCoefs = getAirfoilCoefficients(localVtAoA, true); // true = symmetrical airfoil
  const vtSideForce = htQ * vtArea * vtCoefs.cl; 
  totalDrag += htQ * vtArea * htCoefs.cd;
  
  const sideForce = vtSideForce; 
  yawMoment += -vtSideForce * vtArm;

  return { lift: totalLift, drag: totalDrag, sideForce, rollMoment, pitchMoment, yawMoment };
}
