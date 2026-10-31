/**
 * TypeScript contracts and mathematical parser for rocket thrust curves (.eng)
 * and 6-DOF / 1-DOF numerical flight trajectory states.
 */

export interface MotorThrustPoint {
  timeSec: number;
  thrustNewtons: number;
}

export interface MotorThrustCurve {
  motorName: string;
  diameterMm: number;
  lengthMm: number;
  delays: string[];
  propellantMassKg: number;
  totalMassKg: number;
  manufacturer: string;
  points: MotorThrustPoint[];
  totalImpulseNs: number;
  burnTimeSec: number;
  peakThrustN: number;
  avgThrustN: number;
}

export interface RocketAeroConfig {
  dryMassKg: number; // Empty airframe + avionics + ballast
  crossSectionAreaM2: number; // Reference frontal cross section (pi * r^2)
  dragCoefficient: number; // Subsonic zero-lift drag coefficient Cd (~0.45 - 0.65)
  parachuteCd: number; // Parachute drag coefficient (~1.5)
  parachuteAreaM2: number; // Canopy area
}

export type FlightPhase = 'ignition' | 'boost' | 'coast' | 'apogee' | 'drogue_descent' | 'main_descent' | 'landed';

export interface TrajectoryState {
  timeSec: number;
  altitudeMeters: number;
  velocityMps: number;
  accelerationMps2: number;
  instantaneousMassKg: number;
  phase: FlightPhase;
}

export interface FlightSimulationSummary {
  apogeeMeters: number;
  apogeeTimeSec: number;
  burnoutAltitudeMeters: number;
  burnoutVelocityMps: number;
  maxAccelerationMps2: number;
  touchdownVelocityMps: number;
  totalFlightTimeSec: number;
  trajectory: TrajectoryState[];
}

/**
 * Standard atmospheric density calculation via barometric formula (ISA standard atmosphere).
 */
export function getAirDensityKgM3(altitudeMeters: number): number {
  const RHO_0 = 1.225; // Sea level standard density (kg/m^3)
  const SCALE_HEIGHT = 8500.0; // Isothermal scale height (m)
  const h = Math.max(0, altitudeMeters);
  return RHO_0 * Math.exp(-h / SCALE_HEIGHT);
}

/**
 * Parses standard RASP / OpenRocket .eng motor thrust curve definitions.
 */
export function parseEngFile(content: string): MotorThrustCurve {
  const lines = content.split('\n');
  let headerFound = false;
  let motorName = 'UNKNOWN';
  let diameterMm = 29.0;
  let lengthMm = 124.0;
  let delays: string[] = [];
  let propellantMassKg = 0.03;
  let totalMassKg = 0.08;
  let manufacturer = 'Aerotech';

  const points: MotorThrustPoint[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith(';')) {
      continue;
    }

    if (!headerFound) {
      const parts = line.split(/\s+/);
      if (parts.length >= 7) {
        motorName = parts[0];
        diameterMm = parseFloat(parts[1]) || 29.0;
        lengthMm = parseFloat(parts[2]) || 124.0;
        delays = parts[3].split('-');
        propellantMassKg = parseFloat(parts[4]) || 0.03;
        totalMassKg = parseFloat(parts[5]) || 0.08;
        manufacturer = parts[6] || 'Custom';
        headerFound = true;
        continue;
      }
    }

    const dataParts = line.split(/\s+/);
    if (dataParts.length >= 2) {
      const t = parseFloat(dataParts[0]);
      const thrust = parseFloat(dataParts[1]);
      if (!isNaN(t) && !isNaN(thrust)) {
        points.push({ timeSec: t, thrustNewtons: Math.max(0, thrust) });
      }
    }
  }

  // Calculate impulse via trapezoidal numerical integration
  let totalImpulse = 0.0;
  let peakThrust = 0.0;
  for (let i = 0; i < points.length; i++) {
    if (points[i].thrustNewtons > peakThrust) {
      peakThrust = points[i].thrustNewtons;
    }
    if (i > 0) {
      const dt = points[i].timeSec - points[i - 1].timeSec;
      const avgT = (points[i].thrustNewtons + points[i - 1].thrustNewtons) / 2.0;
      totalImpulse += avgT * dt;
    }
  }

  const burnTime = points.length > 0 ? points[points.length - 1].timeSec : 0.0;
  const avgThrust = burnTime > 0 ? totalImpulse / burnTime : 0.0;

  return {
    motorName,
    diameterMm,
    lengthMm,
    delays,
    propellantMassKg,
    totalMassKg,
    manufacturer,
    points,
    totalImpulseNs: Math.round(totalImpulse * 100) / 100,
    burnTimeSec: Math.round(burnTime * 1000) / 1000,
    peakThrustN: Math.round(peakThrust * 10) / 10,
    avgThrustN: Math.round(avgThrust * 10) / 10
  };
}
