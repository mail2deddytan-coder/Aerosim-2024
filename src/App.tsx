/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useFlightStore } from './store';
import BootScreen from './components/BootScreen';
import MainMenu from './components/MainMenu';
import LoadingScreen from './components/LoadingScreen';
import FlightSimulator from './components/FlightSimulator';
import ErrorScreen from './components/ErrorScreen';

export default function App() {
  const appState = useFlightStore(s => s.appState);

  return (
    <div className="w-screen h-screen overflow-hidden font-sans select-none">
      {appState === 'boot' && <BootScreen />}
      {appState === 'menu' && <MainMenu />}
      {appState === 'loading' && <LoadingScreen />}
      {appState === 'flight' && <FlightSimulator />}
      {appState === 'error' && <ErrorScreen />}
    </div>
  );
}
