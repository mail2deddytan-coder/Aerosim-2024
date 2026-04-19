import { useState } from 'react';
import { useFlightStore, CareerMode } from '../store';
import { Plane, Map as MapIcon, GraduationCap, Video, UploadCloud, Settings, Play, Footprints } from 'lucide-react';
import { aircraftDB } from '../flightModel';

export default function MainMenu() {
  const { setAppState, setLoading, selectedAircraft, setSelectedAircraft, customModelUrl, setCustomModelUrl, careerState, setCareerState, setError } = useFlightStore();
  const [activeTab, setActiveTab] = useState<'free' | 'career' | 'settings'>('free');

  const startFlight = () => {
    setAppState('loading');
    setLoading(10, 'Loading languages...');
    
    // Simulate loading sequence
    setTimeout(() => setLoading(40, 'Loading main game...'), 1000);
    setTimeout(() => setLoading(70, 'Connecting to Cesium servers...'), 2000);
    setTimeout(() => setLoading(90, 'Generating mesh via OpenStreetMap/Bing Maps...'), 3000);
    setTimeout(() => {
      // Simulate random test error 10% of time
      if (Math.random() < 0.1) {
        setError('Connection timed out to terrain servers.');
      } else {
         setAppState('flight');
      }
    }, 4500);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.name.endsWith('.glb') || file.name.endsWith('.gltf')) {
        const url = URL.createObjectURL(file);
        setCustomModelUrl(url);
        setSelectedAircraft('Custom');
      } else {
        alert('Please upload a .glb or .gltf file.');
      }
    }
  };

  const renderAircraftSelection = () => (
    <>
      <label className="block text-[11px] text-[#94a3b8] uppercase tracking-[1px] mb-[10px]">Select Aircraft</label>
      <select 
        className="w-full bg-[rgba(15,25,35,0.8)] border border-white/10 p-[10px] rounded-[4px] mb-[10px] text-[13px] text-white outline-none focus:border-[#26b3ff]"
        value={selectedAircraft}
        onChange={(e) => {
           setSelectedAircraft(e.target.value);
           if (e.target.value !== 'Custom') {
              setCustomModelUrl(null);
           }
        }}
      >
        {Object.keys(aircraftDB).map(ac => (
           <option key={ac} value={ac}>{ac}</option>
        ))}
        {customModelUrl && <option value="Custom">Custom GLB Model</option>}
      </select>
      
      {selectedAircraft !== 'Custom' && !customModelUrl && (
         <div className="text-[11px] text-[#fbbf24] bg-[#fbbf24]/10 p-[8px] rounded border border-[#fbbf24]/20 mb-[20px]">
           <strong>Note:</strong> Currently using the default generic placeholder 3D model. To fly a physically accurate visual model, please import a custom .GLB or .GLTF file below.
         </div>
      )}

      <div className="bg-[#1e293b] p-[20px] rounded-[8px] mb-[20px] border border-[#26b3ff]/50 shadow-[0_0_15px_rgba(38,179,255,0.1)] flex flex-col gap-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#26b3ff] to-transparent"></div>
        <label className="flex items-center justify-center gap-[15px] cursor-pointer bg-[#26b3ff]/10 hover:bg-[#26b3ff]/20 text-[#26b3ff] py-[15px] rounded-[6px] transition border border-[#26b3ff]/30 font-bold tracking-wide">
          <UploadCloud size={20} />
          <span>IMPORT CUSTOM .GLB / .GLTF AIRCRAFT MODEL</span>
          <input type="file" accept=".glb,.gltf" className="hidden" onChange={handleFileUpload} />
        </label>
        <div className="flex border-t border-white/10 pt-4 flex-col gap-2">
          <span className="text-[#94a3b8] text-[12px]">Or link directly to an online model URL (e.g. FlightGear models converted to GLB):</span>
          <input 
            type="text" 
            placeholder="https://example.com/model.glb" 
            className="bg-[rgba(0,0,0,0.5)] border border-white/10 p-[10px] rounded-[4px] text-[13px] text-white outline-none focus:border-[#26b3ff] w-full"
            value={customModelUrl || ''}
            onChange={(e) => {
              const val = e.target.value.trim();
              setCustomModelUrl(val || null);
              if (val) setSelectedAircraft('Custom');
              else setSelectedAircraft('Boeing 737');
            }}
          />
        </div>
      </div>
    </>
  );

  return (
    <div className="absolute inset-0 bg-[#05070a] text-[#ffffff] font-['Helvetica_Neue',Helvetica,Arial,sans-serif] z-40 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,#1e293b_0%,#020617_100%)] -z-10"></div>
      <div className="absolute bottom-[40%] w-full h-[2px] bg-[linear-gradient(90deg,transparent,rgba(38,179,255,0.2),transparent)]"></div>

      <header className="h-[60px] bg-[linear-gradient(to_bottom,rgba(0,0,0,0.8),transparent)] flex items-center px-[40px] justify-between border-b border-white/10">
        <div className="font-black text-[20px] tracking-[2px] flex items-center gap-[10px]">AEROSIM 2024</div>
        <div className="flex gap-[24px] text-[12px] text-[#94a3b8]">
          <div className="flex items-center gap-[6px] bg-[rgba(255,255,255,0.05)] px-[12px] py-[4px] rounded-[4px] border border-white/10">
            <span className="w-[6px] h-[6px] rounded-full bg-[#22c55e] shadow-[0_0_8px_#22c55e]"></span>
            CESIUM DATA: STREAMING
          </div>
          <div className="flex items-center gap-[6px] bg-[rgba(255,255,255,0.05)] px-[12px] py-[4px] rounded-[4px] border border-white/10">
            MAP: OPENSTREETMAP (PRIMARY)
          </div>
        </div>
      </header>

      <nav className="absolute left-[40px] top-[100px] flex flex-col gap-[12px]">
        {['free', 'scenarios', 'career', 'walkaround'].map((tab) => (
          <button 
            key={tab} 
            onClick={() => setActiveTab(tab as any)}
             className={`w-[220px] border-l-[4px] p-[20px] cursor-pointer backdrop-blur-[10px] transition-all text-left ${activeTab === tab ? 'border-[#26b3ff] bg-[rgba(38,179,255,0.1)]' : 'bg-[rgba(15,25,35,0.8)] border-transparent hover:bg-[rgba(38,179,255,0.05)]'}`}
          >
            <h3 className="text-[14px] uppercase tracking-[1px] mb-[4px] text-white">{tab.replace('_', ' ')}</h3>
            <p className="text-[10px] text-[#94a3b8]">Configure {tab} settings</p>
          </button>
        ))}
      </nav>

      <div className="absolute top-[100px] left-[300px] right-[40px] bottom-[100px] grid grid-cols-[2fr_1fr] gap-[20px]">
        <div className="bg-[rgba(255,255,255,0.05)] border border-white/10 relative flex flex-col justify-start p-[30px] overflow-y-auto">
          {activeTab === 'free' && (
            <>
              <div className="text-[48px] font-[100] leading-none mb-6">FREE FLIGHT</div>
              
              {renderAircraftSelection()}

              <label className="block text-[11px] text-[#94a3b8] uppercase tracking-[1px] mb-[10px] flex items-center gap-[6px]"><MapIcon size={14} /> Departure / Arrival</label>
              <div className="grid grid-cols-2 gap-[15px] mb-4">
                 <input type="text" placeholder="ICAO (e.g. KSFO)" className="bg-[rgba(15,25,35,0.8)] border border-white/10 p-[10px] rounded-[4px] text-[13px] text-white outline-none focus:border-[#26b3ff]" defaultValue="KSFO" />
                 <input type="text" placeholder="ICAO (e.g. KJFK)" className="bg-[rgba(15,25,35,0.8)] border border-white/10 p-[10px] rounded-[4px] text-[13px] text-white outline-none focus:border-[#26b3ff]" />
              </div>
             </>
          )}

          {activeTab === 'scenarios' && (
            <>
              <div className="text-[48px] font-[100] leading-none mb-6">EMERGENCIES</div>
              <p className="text-[14px] text-[#94a3b8] mb-[20px]">Test your skills against unpredictable mid-flight failures and security events.</p>
              
              {renderAircraftSelection()}

              <div className="grid grid-cols-2 gap-4 mb-4">
                 {[
                   { id: 'engine_failure', title: 'Engine Flameout', desc: 'Thrust drops to 0 mid-flight.' },
                   { id: 'ailerons_failure', title: 'Aileron Lock', desc: 'Roll control effectiveness reduced by 90%.' },
                   { id: 'hydraulics', title: 'Hydraulic Leak', desc: 'Flight controls stiffen significantly.' },
                   { id: 'hijack', title: 'Squawk 7500 (Hijack)', desc: 'Unlawful interference causes erratic pitch/roll.' },
                 ].map(s => (
                   <button 
                     key={s.id}
                     onClick={() => {
                        useFlightStore.getState().setActiveScenario(s.id);
                        useFlightStore.getState().setSpawnMode('air');
                        startFlight();
                     }}
                     className="bg-[rgba(15,25,35,0.8)] border border-red-500/20 hover:border-red-500 hover:bg-red-500/10 p-[15px] rounded text-left transition"
                   >
                      <h4 className="text-white font-bold mb-1">{s.title}</h4>
                      <p className="text-[11px] text-[#94a3b8]">{s.desc}</p>
                   </button>
                 ))}
              </div>
            </>
          )}

          {activeTab === 'career' && (
            <>
              <div className="text-[48px] font-[100] leading-none mb-6 flex items-center gap-4"><GraduationCap size={40} /> CAREER MODE</div>
              <p className="text-[14px] text-[#94a3b8] mb-[20px]">Progress through official licensing. Pass practical exams to unlock heavier aircraft.</p>
              
              <div className="mb-4">
                 {renderAircraftSelection()}
              </div>

              <div className="flex flex-col gap-[15px] mb-4">
                 {['SPL (Student) - Solo Prep', 'PPL (Private) - Navigation Test', 'CPL (Commercial) - IFR Checkride', 'ATPL (Airline Transport)'].map((level, idx) => {
                   const key = level.split(' ')[0] as CareerMode;
                   const isActive = careerState === key;
                   return (
                     <button 
                       key={key}
                       onClick={() => setCareerState(key)}
                       className={`p-[15px] rounded border text-left flex items-center justify-between transition ${isActive ? 'bg-[rgba(38,179,255,0.1)] border-[#26b3ff]' : 'bg-[rgba(15,25,35,0.8)] border-white/10 hover:bg-[rgba(255,255,255,0.05)]'}`}
                     >
                       <div>
                          <span className="text-[14px] font-medium text-white block">{level} License</span>
                          <span className="text-[11px] text-[#94a3b8]">{idx === 0 ? 'Basic handling and emergencies' : idx === 1 ? 'Cross country & VFR' : 'Heavy jets & Multi-engine'}</span>
                       </div>
                       {isActive && <span className="bg-[#22c55e] text-[#000] text-[10px] px-[8px] py-[2px] rounded uppercase font-bold">Active</span>}
                     </button>
                   )
                 })}
                 <button 
                     onClick={() => {
                        useFlightStore.getState().setActiveScenario('career_exam');
                        useFlightStore.getState().setSpawnMode('runway');
                        startFlight();
                     }}
                     className="mt-4 bg-[#26b3ff] text-black font-black p-[15px] rounded border-none hover:bg-[#1a9fe6] uppercase tracking-[2px] text-center"
                 >
                    START CHECKRIDE EXAM
                 </button>
              </div>
            </>
          )}

          {activeTab === 'walkaround' && (
             <>
              <div className="text-[48px] font-[100] leading-none mb-6 flex items-center gap-4"><Footprints size={40} /> WALKAROUND</div>
              <p className="text-[14px] text-[#94a3b8] mb-[20px]">Explore your aircraft on the ground at the terminal gate. Use the joystick and camera controls to walk around.</p>
              
              {renderAircraftSelection()}

              <button 
                     onClick={() => {
                        useFlightStore.getState().setActiveScenario(null);
                        useFlightStore.getState().setSpawnMode('gate');
                        startFlight();
                     }}
                     className="bg-[#26b3ff] text-black font-black p-[15px] rounded border-none hover:bg-[#1a9fe6] uppercase tracking-[2px] text-center mb-4"
              >
                    ENTER RAMP / GATE
              </button>
             </>
          )}

          {activeTab === 'settings' && (
            <>
              <div className="text-[48px] font-[100] leading-none mb-6 flex items-center gap-4"><Settings size={40} /> SETTINGS</div>
              <div className="space-y-[15px] mb-4">
                <div className="flex items-center justify-between bg-[rgba(15,25,35,0.8)] p-[15px] rounded border border-white/10 text-[13px] text-[#94a3b8]">
                   <span>Real-time Weather & Ray Tracing (Simulated)</span>
                   <input type="checkbox" defaultChecked className="w-[16px] h-[16px] accent-[#26b3ff]" />
                </div>
                <div className="flex items-center justify-between bg-[rgba(15,25,35,0.8)] p-[15px] rounded border border-white/10 text-[13px] text-[#94a3b8]">
                   <span>VR Mode Compatible</span>
                   <input type="checkbox" defaultChecked className="w-[16px] h-[16px] accent-[#26b3ff]" />
                </div>
                <div className="flex items-center justify-between bg-[rgba(15,25,35,0.8)] p-[15px] rounded border border-white/10 text-[13px] text-[#94a3b8]">
                   <span>Map Provider</span>
                   <select className="bg-[rgba(0,0,0,0.5)] border border-white/20 p-[5px] rounded text-white outline-none">
                      <option>OpenStreetMap</option>
                      <option>Bing Maps (Fallback)</option>
                   </select>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="bg-[rgba(15,25,35,0.8)] p-[24px] flex flex-col gap-[20px]">
           <div className="flex flex-col gap-[10px]">
             <h4 className="text-[11px] uppercase text-[#94a3b8] mb-[10px]">Live Activity</h4>
             <div className="flex items-center gap-[15px] pb-[10px] border-b border-white/5">
                <Video className="w-[24px] h-[24px] text-[#26b3ff]" />
                <div>
                  <h4 className="text-[13px] font-bold text-white">Replay System Active</h4>
                  <p className="text-[10px] text-[#94a3b8]">Last 10 mins recorded</p>
                </div>
             </div>
           </div>
           
           <div className="flex flex-col gap-[10px]">
             <h4 className="text-[11px] uppercase text-[#94a3b8] mb-[10px]">Network Status</h4>
             <div className="pb-[10px] border-b border-white/5">
                <span className="text-[13px] text-[#22c55e] font-bold block mb-[5px]">Connected to Cesium Cloud</span>
                <span className="text-[10px] text-[#94a3b8]">Streaming High-Res Photogrammetry</span>
             </div>
           </div>
           
           <div className="flex flex-col gap-[10px]">
             <h4 className="text-[11px] uppercase text-[#94a3b8] mb-[10px]">License Status</h4>
             <div className="flex justify-between text-[13px] py-[10px] border-b border-white/5">
                <span className="text-[#94a3b8]">Current Rank</span>
                <span className="bg-[linear-gradient(45deg,#ffd700,#b8860b)] text-black px-[8px] py-[2px] text-[10px] font-[800] rounded-[2px]">{careerState}</span>
             </div>
             <div className="flex justify-between text-[13px] py-[10px] border-b border-white/5">
                <span className="text-[#94a3b8]">Total Hours</span>
                <span className="text-white">1,248.5</span>
             </div>
           </div>
        </div>
      </div>

      <div className="absolute bottom-[20px] left-[50%] -translate-x-1/2 flex gap-[15px]">
          {activeTab === 'free' && (
            <button onClick={startFlight} className="bg-[#26b3ff] text-[#000] border-none px-[60px] py-[15px] font-[900] text-[18px] uppercase tracking-[2px] cursor-pointer hover:bg-[#1a9fe6] transition">
              READY TO FLY
            </button>
          )}
      </div>
    </div>
  );
}
