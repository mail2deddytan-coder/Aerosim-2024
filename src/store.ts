import { create } from 'zustand';

export type AppState = 'boot' | 'menu' | 'loading' | 'flight' | 'error';
export type CareerMode = 'SPL' | 'PPL' | 'CPL' | 'ATPL';
export type CameraView = 'cockpit' | 'exterior' | 'landing_gear' | 'walk';
export type SpawnMode = 'air' | 'gate' | 'runway';

interface FlightStore {
  appState: AppState;
  loadingProgress: number;
  loadingText: string;
  selectedAircraft: string;
  customModelUrl: string | null;
  cameraView: CameraView;
  modelYawOffset: number;
  modelPitchOffset: number;
  modelRollOffset: number;
  invertY: boolean;
  careerState: CareerMode;
  spawnMode: SpawnMode;
  activeScenario: string | null;
  errorMessage: string | null;
  weatherFog: number;
  turbulenceEnabled: boolean;
  setAppState: (state: AppState) => void;
  setLoading: (progress: number, text: string) => void;
  setSelectedAircraft: (aircraft: string) => void;
  setCustomModelUrl: (url: string | null) => void;
  setCameraView: (view: CameraView) => void;
  setModelYawOffset: (offset: number) => void;
  setModelPitchOffset: (offset: number) => void;
  setModelRollOffset: (offset: number) => void;
  setInvertY: (invert: boolean) => void;
  setCareerState: (state: CareerMode) => void;
  setSpawnMode: (mode: SpawnMode) => void;
  setActiveScenario: (scenario: string | null) => void;
  setWeatherFog: (density: number) => void;
  setTurbulence: (enabled: boolean) => void;
  setError: (msg: string) => void;
}

export const useFlightStore = create<FlightStore>((set) => ({
  appState: 'boot',
  loadingProgress: 0,
  loadingText: '',
  selectedAircraft: 'Boeing 777',
  customModelUrl: 'https://github.com/mail2deddytan-coder/Glb777/releases/download/Lol/boeing_777_aeroflot.glb',
  cameraView: 'exterior',
  modelYawOffset: 0,
  modelPitchOffset: 0,
  modelRollOffset: 0,
  invertY: false,
  careerState: 'SPL',
  spawnMode: 'air',
  activeScenario: null,
  errorMessage: null,
  weatherFog: 0,
  turbulenceEnabled: true,
  setAppState: (state) => set({ appState: state }),
  setLoading: (progress, text) => set({ loadingProgress: progress, loadingText: text }),
  setSelectedAircraft: (aircraft) => set({ selectedAircraft: aircraft }),
  setCustomModelUrl: (url) => set({ customModelUrl: url }),
  setCameraView: (view) => set({ cameraView: view }),
  setModelYawOffset: (offset) => set({ modelYawOffset: offset }),
  setModelPitchOffset: (offset) => set({ modelPitchOffset: offset }),
  setModelRollOffset: (offset) => set({ modelRollOffset: offset }),
  setInvertY: (invert) => set({ invertY: invert }),
  setCareerState: (state) => set({ careerState: state }),
  setSpawnMode: (mode) => set({ spawnMode: mode }),
  setActiveScenario: (scenario) => set({ activeScenario: scenario }),
  setWeatherFog: (density) => set({ weatherFog: density }),
  setTurbulence: (enabled) => set({ turbulenceEnabled: enabled }),
  setError: (msg) => set({ errorMessage: msg, appState: 'error' }),
}));
