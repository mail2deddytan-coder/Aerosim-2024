import { useFlightStore } from '../store';
import { WifiOff, RotateCcw } from 'lucide-react';

export default function ErrorScreen() {
  const errorMessage = useFlightStore(s => s.errorMessage);
  const setAppState = useFlightStore(s => s.setAppState);

  return (
    <div className="absolute inset-0 bg-[#05070a] flex flex-col items-center justify-center text-white z-50 p-8 text-center font-['Helvetica_Neue',Helvetica,Arial,sans-serif]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,#1e293b_0%,#020617_100%)] -z-10"></div>
      
      <div className="bg-[#ef4444] px-[16px] py-[8px] text-[14px] rounded-full mb-[40px] uppercase font-bold tracking-[1px] flex items-center gap-[10px]">
         <WifiOff size={18} />
         ERROR 1-400: Connection unstable. Retrying...
      </div>

      <h1 className="text-[32px] font-[100] mb-[15px] uppercase tracking-[2px]">{errorMessage || 'Connection to streaming server failed.'}</h1>
      <p className="text-[14px] text-[#94a3b8] mb-[40px] max-w-lg leading-relaxed">
        Attempting to connect again... Please note that Aerosim 2024 requires a constant internet connection to stream high-resolution mesh and dynamic weather data.
      </p>

      <button 
        onClick={() => setAppState('boot')}
        className="bg-[#26b3ff] text-[#000] border-none px-[40px] py-[12px] font-[900] text-[14px] uppercase tracking-[2px] cursor-pointer hover:bg-[#1a9fe6] transition flex items-center gap-[10px]"
      >
        <RotateCcw size={16} /> Retry Connection
      </button>
    </div>
  );
}
