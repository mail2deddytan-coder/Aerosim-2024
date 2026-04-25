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

function getAirfoilCoefficients(alphaRad: number, symmetrical: boolean = false): { cl: number, cd: number, cm: number } {
  const alphaDeg = alphaRad * (180 / Math.PI);
  const absAlphaDeg = Math.abs(alphaDeg);
  
  const cdMin = symmetrical ? 0.010 : 0.015;
  const a0 = symmetrical ? 2 * Math.PI : 6.0; // Lift curve slope approx 2*pi
  
  // NATIVE CAMBER
  const zeroLiftAlphaRad = symmetrical ? 0 : -2.5 * (Math.PI / 180);
  
  // Attached flow region
  const clAttached = a0 * (alphaRad - zeroLiftAlphaRad);
  // Profile drag
  const cdAttached = cdMin + 0.005 * Math.pow(alphaDeg / 10, 2); 
  // Pitch moment (NACA profile baseline)
  const cmAttached = symmetrical ? 0 : -0.06 - 0.01 * (alphaDeg / 10);

  // Separated flow region (Post-stall Flat Plate)
  const sign = Math.sign(alphaRad);
  const clFlatPlate = 1.1 * sign * Math.pow(Math.sin(alphaRad), 2) * Math.cos(alphaRad) + 0.5 * Math.sin(2 * alphaRad);
  const cdFlatPlate = 1.2 * (1 - Math.cos(2 * alphaRad));
  const cmFlatPlate = symmetrical ? 0 : -0.2 * sign;

  // Real stall modeling (Stall onset and sharp drop)
  const stallAngleDeg = symmetrical ? 12.0 : 15.0;
  let stallMultiplier = 1.0;
  if (!symmetrical && absAlphaDeg > stallAngleDeg && absAlphaDeg < stallAngleDeg + 5) {
      // Lift drops sharply right after stall
      stallMultiplier = Math.max(0.4, 1.0 - (absAlphaDeg - stallAngleDeg) * 0.15);
  }

  // Sigmoid blend attached vs separated
  const blendSharpness = 0.8;
  const stallMargin = absAlphaDeg - stallAngleDeg;
  const separatedWeight = 1.0 / (1.0 + Math.exp(-blendSharpness * stallMargin));
  
  const cl = (clAttached * stallMultiplier) * (1 - separatedWeight) + clFlatPlate * separatedWeight;
  const cd = cdAttached * (1 - separatedWeight) + cdFlatPlate * separatedWeight;
  const cm = cmAttached * (1 - separatedWeight) + cmFlatPlate * separatedWeight;
  
  return { cl, cd, cm };
}

export function calculateForces(velocity: number, aoaRad: number, slipRad: number, rates: {p: number, q: number, r: number}, controls: {pitch: number, roll: number, yaw: number}, specs: AircraftSpecs, airDensity: number = 1.225, altitudeAGL: number = 1000) {
  // X-Plane 12+ / FlightGear Style Core: Blade Element Theory across all aerodynamic surfaces
  const span = specs.wingSpan;
  const meanChord = specs.wingArea / span;
  const velocitySq = Math.max(0.1, velocity * velocity);
  const baseVelocity = Math.sqrt(velocitySq);
  
  // Ground Effect Modifications
  // K_ge scales induced drag down, Lift cushion scales lift up
  const h_over_b = Math.max(0.01, altitudeAGL / span);
  const K_ge = (16 * Math.pow(h_over_b, 2)) / (1 + 16 * Math.pow(h_over_b, 2));
  const h_over_c = Math.max(0.1, altitudeAGL / meanChord);
  const liftCushion = altitudeAGL < span ? 1 + 0.15 / (h_over_c) : 1.0;

  // Induced Flow (Downwash) Angle
  const AR = (span * span) / specs.wingArea;
  const e = specs.oswaldEfficiency;
  // Reduce induced angle due to ground effect
  const inducedAngleFactor = (2 / (AR * e)) / (1 + 2 / (AR * e)) * K_ge;
  const alpha_i = aoaRad * inducedAngleFactor;
  const alpha_eff = aoaRad - alpha_i;

  let stallRatio = baseVelocity < 15.0 ? baseVelocity / 15.0 : 1.0;
  const { cl: clZerospeed, cd: cdZerospeed, cm: cmZerospeed } = getAirfoilCoefficients(0);

  // Geometric assumptions for Empennage (Tail) based on typical airliner ratios
  const htArea = specs.wingArea * 0.2;
  const htArm = span * 0.45; 
  const vtArea = specs.wingArea * 0.15;
  const vtArm = span * 0.45;

  // 1. MAIN WING BET Evaluation
  const evaluateWingElement = (y: number): [number, number, number, number, number] => {
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
    let { cl, cd, cm } = getAirfoilCoefficients(localElementAoA);
    
    // Ground effect lift increase
    cl *= liftCushion;

    if (stallRatio < 1.0) {
       cl = cl * stallRatio + clZerospeed * (1 - stallRatio);
       cd = cd * stallRatio + cdZerospeed * (1 - stallRatio);
       cm = cm * stallRatio + cmZerospeed * (1 - stallRatio);
    }

    const localQ = 0.5 * airDensity * velocitySq;
    const dL_2D = localQ * chord * cl;
    const dD_2D = localQ * chord * cd;
    const dM_2D = localQ * (chord * chord) * cm;
    
    // 3D vector shift for exact induced drag
    const dL_3D = dL_2D * Math.cos(alpha_i) - dD_2D * Math.sin(alpha_i);
    const dD_3D = dL_2D * Math.sin(alpha_i) + dD_2D * Math.cos(alpha_i);

    // Roll Moment (Right wing UP -> negative roll)
    const dRoll = dL_3D * y;
    // Adverse Yaw (Right wing drag -> nose right -> positive yaw)
    const dYaw = dD_3D * y; 

    return [dL_3D, dD_3D, dRoll, dYaw, dM_2D];
  };

  const adaptiveSimpsons = (
    a: number, b: number, eps: number, maxD: number, d: number, 
    fa: [number, number, number, number, number], fm: [number, number, number, number, number], fb: [number, number, number, number, number]
  ): [number, number, number, number, number] => {
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
      (step / 6) * (wA[3] + 4 * wM[3] + wB[3]),
      (step / 6) * (wA[4] + 4 * wM[4] + wB[4])
    ];

    const S = calc(fa, fm, fb, h);
    const Sleft = calc(fa, fm1, fm, h/2);
    const Sright = calc(fm, fm2, fb, h/2);
    const S2: [number,number,number,number,number] = [Sleft[0]+Sright[0], Sleft[1]+Sright[1], Sleft[2]+Sright[2], Sleft[3]+Sright[3], Sleft[4]+Sright[4]];

    if (d >= maxD || Math.abs(S2[0]-S[0]) <= 15*eps) {
       return [S2[0]+(S2[0]-S[0])/15, S2[1]+(S2[1]-S[1])/15, S2[2]+(S2[2]-S[2])/15, S2[3]+(S2[3]-S[3])/15, S2[4]+(S2[4]-S[4])/15];
    }
    const LRes = adaptiveSimpsons(a, m, eps/2, maxD, d+1, fa, fm1, fm);
    const RRes = adaptiveSimpsons(m, b, eps/2, maxD, d+1, fm, fm2, fb);
    return [LRes[0]+RRes[0], LRes[1]+RRes[1], LRes[2]+RRes[2], LRes[3]+RRes[3], LRes[4]+RRes[4]];
  };

  const wingRes = adaptiveSimpsons(-span/2, span/2, 1.0, 8, 0, evaluateWingElement(-span/2), evaluateWingElement(0), evaluateWingElement(span/2));

  // FLAPS: Provide baseline lift boost (deploy dynamically ideally, but statically 1.35x here)
  const flapsLiftMultiplier = 1.35;
  let totalLift = wingRes[0] * flapsLiftMultiplier;
  let totalDrag = wingRes[1] * (flapsLiftMultiplier * 1.5); 
  let rollMoment = -wingRes[2]; 
  let yawMoment = wingRes[3];
  
  // Center of Gravity offset (to create natural pitch stability dCm/dalpha)
  // Distance from aerodynamic center to CG. Positive means CG is ahead (stable)
  const cgOffset = meanChord * 0.1; 
  let wingPitchMoment = wingRes[4] - (totalLift * cgOffset); // Base airfoil Cm - torque from lift behind CG (nose down)

  // 2. HORIZONTAL STABILIZER
  // Downwash hits horizontal tail, modified by ground effect
  const downwashModifier = 1.0 - 0.5 * (1.0 - K_ge); // Downwash reduces near ground
  const tailAoA = aoaRad - (alpha_i * 2.0 * downwashModifier); 
  const tailDownVel = rates.q * htArm; 
  const pitchDampAoA = Math.atan2(tailDownVel, baseVelocity);
  
  // Control surface speed-based effectiveness (Hydraulic pressure + slipstream)
  // At very low speeds, controls are less effective. At high speeds, they stiffen.
  const dynamicPressureScale = Math.min(1.0, Math.max(0.1, velocitySq / 3000));
  const elevatorAoA = controls.pitch * 20 * (Math.PI / 180) * dynamicPressureScale; 
  
  // Built-in tail incidence angle to naturally counteract the nose-down moment from the wing/CG
  const htIncidence = -2.0 * (Math.PI / 180); 

  let localHtAoA = tailAoA + pitchDampAoA + elevatorAoA + htIncidence;
  let htCoefs = getAirfoilCoefficients(localHtAoA, true); 
  const htQ = 0.5 * airDensity * velocitySq;
  totalLift += htQ * htArea * htCoefs.cl;
  totalDrag += htQ * htArea * htCoefs.cd;
  
  // Add tail pitch moment to total pitch moment
  let pitchMoment = wingPitchMoment - (htQ * htArea * htCoefs.cl) * htArm;

  // 3. VERTICAL STABILIZER & RUDDER
  const tailSideVel = rates.r * vtArm; 
  const yawDampAoA = Math.atan2(tailSideVel, baseVelocity);
  const rudderAoA = -controls.yaw * 25 * (Math.PI / 180) * dynamicPressureScale; 
  
  let localVtAoA = slipRad + yawDampAoA + rudderAoA;
  let vtCoefs = getAirfoilCoefficients(localVtAoA, true); 
  const vtSideForce = htQ * vtArea * vtCoefs.cl; 
  totalDrag += htQ * vtArea * htCoefs.cd;
  
  const sideForce = vtSideForce; 
  yawMoment += -vtSideForce * vtArm;

  return { lift: totalLift, drag: totalDrag, sideForce, rollMoment, pitchMoment, yawMoment };
}
