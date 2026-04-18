import { useEffect } from 'react';
import { useFlightStore } from '../store';
import ReactPlayer from 'react-player';

const Player: any = ReactPlayer;

export default function BootScreen() {
  const setAppState = useFlightStore(s => s.setAppState);

  useEffect(() => {
    // Transition to menu after 5 seconds
    const timer = setTimeout(() => {
      setAppState('menu');
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="absolute inset-0 bg-[#05070a] flex flex-col items-center justify-center text-white z-50 font-['Helvetica_Neue',Helvetica,Arial,sans-serif]">
      <div className="absolute inset-0 pointer-events-none opacity-30">
         <video 
           src="https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4" 
           autoPlay 
           loop 
           muted 
           playsInline
           className="w-full h-full object-cover"
         />
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,transparent_0%,#05070a_100%)] pointer-events-none"></div>
      
      <div className="z-10 flex flex-col items-center">
        <h1 className="text-[48px] font-[100] tracking-[4px] text-white mb-[15px] uppercase">AEROSIM 2024</h1>
        <p className="text-[12px] text-[#26b3ff] uppercase tracking-[2px] animate-pulse">Initializing Flight Interface...</p>
      </div>
    </div>
  );
}
