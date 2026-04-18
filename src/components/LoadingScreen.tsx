import { useFlightStore } from '../store';
import ReactPlayer from 'react-player';

const Player: any = ReactPlayer;

export default function LoadingScreen() {
  const loadingProgress = useFlightStore(s => s.loadingProgress);
  const loadingText = useFlightStore(s => s.loadingText);

  return (
    <div className="absolute inset-0 bg-[#05070a] flex flex-col justify-end p-[40px] text-white z-50 font-['Helvetica_Neue',Helvetica,Arial,sans-serif]">
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

      <div className="z-10 w-full max-w-4xl mx-auto flex flex-col gap-[10px]">
        <div className="flex justify-between items-end">
          <div className="text-[12px] text-[#26b3ff] uppercase tracking-[2px]">{loadingText || 'INITIALIZING SYSTEMS...'}</div>
          <div className="text-[10px] text-[#94a3b8] font-['Courier_New',Courier,monospace]">{loadingProgress}%</div>
        </div>
        <div className="w-full bg-[rgba(255,255,255,0.05)] h-[2px] overflow-hidden">
          <div 
            className="bg-[#26b3ff] h-full transition-all duration-300 shadow-[0_0_10px_#26b3ff]"
            style={{ width: `${loadingProgress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
