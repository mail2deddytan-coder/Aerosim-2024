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
  careerState: CareerMode;
  spawnMode: SpawnMode;
  activeScenario: string | null;
  errorMessage: string | null;
  setAppState: (state: AppState) => void;
  setLoading: (progress: number, text: string) => void;
  setSelectedAircraft: (aircraft: string) => void;
  setCustomModelUrl: (url: string | null) => void;
  setCameraView: (view: CameraView) => void;
  setCareerState: (state: CareerMode) => void;
  setSpawnMode: (mode: SpawnMode) => void;
  setActiveScenario: (scenario: string | null) => void;
  setError: (msg: string) => void;
}

export const useFlightStore = create<FlightStore>((set) => ({
  appState: 'boot',
  loadingProgress: 0,
  loadingText: '',
  selectedAircraft: 'Boeing 737',
  customModelUrl: null,
  cameraView: 'exterior',
  careerState: 'SPL',
  spawnMode: 'air',
  activeScenario: null,
  errorMessage: null,
  setAppState: (state) => set({ appState: state }),
  setLoading: (progress, text) => set({ loadingProgress: progress, loadingText: text }),
  setSelectedAircraft: (aircraft) => set({ selectedAircraft: aircraft }),
  setCustomModelUrl: (url) => set({ customModelUrl: url }),
  setCameraView: (view) => set({ cameraView: view }),
  setCareerState: (state) => set({ careerState: state }),
  setSpawnMode: (mode) => set({ spawnMode: mode }),
  setActiveScenario: (scenario) => set({ activeScenario: scenario }),
  setError: (msg) => set({ errorMessage: msg, appState: 'error' }),
}));
