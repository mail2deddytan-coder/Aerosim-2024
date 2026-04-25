import { useEffect, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { useFlightStore } from '../store';
import { Joystick } from 'react-joystick-component';
import { Camera, RefreshCw, Footprints, Clock, Volume2, ShieldAlert, Users } from 'lucide-react';
import { aircraftDB, calculateForces } from '../flightModel';
import { initAudio, updateAudio, stopAudio, playWarning } from '../audioSystem';
import io, { Socket } from 'socket.io-client';

export default function FlightSimulator() {
  const viewerRef = useRef<HTMLDivElement>(null);
  const { setAppState, selectedAircraft, customModelUrl, cameraView, setCameraView, spawnMode, activeScenario, weatherFog, turbulenceEnabled, modelYawOffset, setModelYawOffset, modelPitchOffset, setModelPitchOffset, modelRollOffset, setModelRollOffset, invertY } = useFlightStore();
  const [throttle, setThrottle] = useState(0);
  const [speedKnots, setSpeedKnots] = useState(0);
  const [altitude, setAltitude] = useState(0);
  const [fpm, setFpm] = useState(0);
  const [hasAnimations, setHasAnimations] = useState(false);
  const [animationsEnabled, setAnimationsEnabled] = useState(false);
  const [timeOfDay, setTimeOfDay] = useState(12); // Noon
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [atcMessage, setAtcMessage] = useState<string | null>(null);
  const [apEnabled, setApEnabled] = useState(false);
  const [showModelAdjust, setShowModelAdjust] = useState(false);

  const apEnabledRef = useRef(false);
  const apState = useRef({ targetAlt: 5000, targetSpd: 250, targetHdg: 0 });
  const socketRef = useRef<Socket | null>(null);
  const otherPlayersEntities = useRef<{ [id: string]: Cesium.Entity }>({});
  const lastStateEmit = useRef(0);
  
  const handleAudioInit = () => {
    if (!audioEnabled) {
      initAudio();
      setAudioEnabled(true);
    }
  };

  const simState = useRef({
    pitch: 0,
    roll: 0,
    yaw: 0,
    velocity: spawnMode === 'air' ? 250 : 0, 
    position: spawnMode === 'air' 
       ? Cesium.Cartesian3.fromDegrees(-122.365, 37.614, 5000)
       : (spawnMode === 'gate' ? Cesium.Cartesian3.fromDegrees(-122.381, 37.618, 5) : Cesium.Cartesian3.fromDegrees(-122.365, 37.614, 5)),
    heading: spawnMode === 'runway' ? 280 * (Math.PI/180) : 0,
    pitchAngle: spawnMode === 'air' ? 0.05 : 0, // Approx 3 degrees pitch up at start so it doesn't sink wildly 
    rollAngle: 0,
    pitchRate: 0,
    rollRate: 0,
    yawRate: 0,
    vSpeed: 0,
  });

  const humanState = useRef({
    position: Cesium.Cartesian3.fromDegrees(-122.3813, 37.6181, 5), 
    heading: 0,
    velocity: 0, 
  });

  const groundVehiclesState = useRef([
    {
      id: 1,
      position: Cesium.Cartesian3.fromDegrees(-122.3812, 37.6186, 0),
      heading: 0,
      center: { lon: -122.3812, lat: 37.6186 },
      radius: 0.0005,
      speed: 0.2, // angular speed
      angle: 0
    },
    {
      id: 2,
      position: Cesium.Cartesian3.fromDegrees(-122.3815, 37.6180, 0),
      heading: 0,
      center: { lon: -122.3815, lat: 37.6180 },
      radius: 0.0007,
      speed: -0.15,
      angle: Math.PI
    }
  ]);

  const aiTrafficState = useRef({
    position: Cesium.Cartesian3.fromDegrees(-122.40, 37.65, 5000), 
    heading: Math.PI, 
    velocity: 200,
  });

  const gpwsState = useRef({
    lastHeight: spawnMode === 'air' ? 5000 : 0,
    called2500: false,
    called1000: false,
    called500: false,
    called400: false,
    called300: false,
    called200: false,
    called100: false,
    called50: false,
    called40: false,
    called30: false,
    called20: false,
    called10: false,
    hasApproachedRunway: false,
    sinkRateTriggered: 0,
  });

  const controlsRef = useRef({
    pitchInput: 0,
    rollInput: 0,
    yawInput: 0
  });

  const fbwState = useRef({
    smoothedPitchInput: 0,
    smoothedRollInput: 0,
    smoothedYawInput: 0
  });

  const aircraftEntity = useRef<Cesium.Entity | null>(null);

  const throttleRef = useRef(throttle);
  const cameraViewRef = useRef(cameraView);
  const animationsEnabledRef = useRef(animationsEnabled);
  const timeOfDayRef = useRef(timeOfDay);
  const warningFlagRef = useRef<string | null>(null);

  const camControls = useRef({
    orbitAlpha: 0,
    orbitBeta: 0.2,
    radius: 60,
    panPan: 0,
    panTilt: 0,
  });

  useEffect(() => { throttleRef.current = throttle; }, [throttle]);
  useEffect(() => { animationsEnabledRef.current = animationsEnabled; }, [animationsEnabled]);
  useEffect(() => { timeOfDayRef.current = timeOfDay; }, [timeOfDay]);
  useEffect(() => { apEnabledRef.current = apEnabled; }, [apEnabled]);
  const weatherFogRef = useRef(weatherFog);
  useEffect(() => { weatherFogRef.current = weatherFog; }, [weatherFog]);
  const turbulenceEnabledRef = useRef(turbulenceEnabled);
  useEffect(() => { turbulenceEnabledRef.current = turbulenceEnabled; }, [turbulenceEnabled]);
  const modelYawOffsetRef = useRef(modelYawOffset);
  useEffect(() => { modelYawOffsetRef.current = modelYawOffset; }, [modelYawOffset]);
  const modelPitchOffsetRef = useRef(modelPitchOffset);
  useEffect(() => { modelPitchOffsetRef.current = modelPitchOffset; }, [modelPitchOffset]);
  const modelRollOffsetRef = useRef(modelRollOffset);
  useEffect(() => { modelRollOffsetRef.current = modelRollOffset; }, [modelRollOffset]);
  useEffect(() => { 
    cameraViewRef.current = cameraView;
    if (cameraView === 'exterior') {
      camControls.current.radius = 60;
      camControls.current.orbitAlpha = 0;
      camControls.current.orbitBeta = 0.2;
    } else if (cameraView === 'walk') {
      camControls.current.radius = 4; // Much closer to the human
      camControls.current.orbitAlpha = 0;
      camControls.current.orbitBeta = 0.2;
    } else {
      camControls.current.panPan = 0;
      camControls.current.panTilt = 0;
    }
  }, [cameraView]);

  useEffect(() => {
    // Override camera if we're in Walkaround Mode at boot point
    if (spawnMode === 'gate') {
       setCameraView('walk');
    } else if (cameraView === 'walk') {
       // Revert back from walk if we came from Walkaround
       setCameraView('exterior');
    }
  }, [spawnMode]);

  useEffect(() => {
    if (!viewerRef.current) return;

    let viewer: Cesium.Viewer | null = null;
    let isMounted = true;

    const init = async () => {
      viewer = new Cesium.Viewer(viewerRef.current!, {
        vrButton: true,
        baseLayerPicker: false,
        animation: false,
        timeline: false,
        fullscreenButton: true,
        navigationHelpButton: false,
        infoBox: false,
        selectionIndicator: false,
      });

      // Enable Fog & Lighting for Day/Night cycle
      viewer.scene.globe.enableLighting = true;
      viewer.scene.globe.depthTestAgainstTerrain = true;
      viewer.scene.fog.enabled = true;
      viewer.scene.fog.density = 0.0005; // Noticeable fog
      viewer.scene.fog.screenSpaceErrorFactor = 2.0;

      try {
        viewer.terrainProvider = await Cesium.createWorldTerrainAsync();
      } catch (e) {
        console.warn('Failed to load world terrain async:', e);
      }

      if (!isMounted || !viewer) return;

      try {
         viewer.imageryLayers.removeAll();
         try {
             const arcGisImagery = await Cesium.ArcGisMapServerImageryProvider.fromUrl(
                 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer'
             );
             viewer.imageryLayers.addImageryProvider(arcGisImagery);
         } catch (e) {
             console.warn('ArcGIS Imagery failed:', e);
         }

         // Add 3D buildings for realism
         const buildingsTileset = await Cesium.createOsmBuildingsAsync();
         viewer.scene.primitives.add(buildingsTileset);
      } catch (e) {
         console.warn('Failed to load imagery or buildings:', e);
      }

      try {
         // Add Volumetric Clouds
         const clouds = new Cesium.CloudCollection({
             noiseDetail: 16.0
         });
         viewer.scene.primitives.add(clouds);

         // Scatter clouds across a massive area around the Bay Area
         for (let i = 0; i < 300; i++) {
             const lon = -122.38 + (Math.random() - 0.5) * 5; // Wide area
             const lat = 37.62 + (Math.random() - 0.5) * 5;
             const height = 1500 + Math.random() * 2000; // 1.5km to 3.5km high
             
             clouds.add({
                 position: Cesium.Cartesian3.fromDegrees(lon, lat, height),
                 scale: new Cesium.Cartesian2(Math.random() * 2000 + 1500, Math.random() * 1000 + 500),
                 maximumSize: new Cesium.Cartesian3(Math.random() * 3000 + 2000, Math.random() * 3000 + 2000, Math.random() * 1000 + 500),
                 slice: Math.random()
             });
         }
      } catch (e) {
         console.warn('Failed to add volumetric clouds:', e);
      }

      const specs = aircraftDB[selectedAircraft] || aircraftDB['Boeing 737'];

      // Always rely on the built-in box graphic as a fallback or primary if no valid model URL exists
      const modelConfig = customModelUrl ? {
          uri: customModelUrl,
          minimumPixelSize: 128,
          maximumScale: 20000,
          runAnimations: new Cesium.CallbackProperty(() => animationsEnabledRef.current, false) as unknown as boolean,
      } : undefined;

      try {
        aircraftEntity.current = viewer.entities.add({
          name: selectedAircraft,
          // @ts-ignore
          position: new Cesium.CallbackProperty(() => simState.current.position, false),
          orientation: new Cesium.CallbackProperty(() => {
            const { heading, pitchAngle, rollAngle } = simState.current;
            const hpr = new Cesium.HeadingPitchRoll(
                heading + modelYawOffsetRef.current, 
                pitchAngle + modelPitchOffsetRef.current, 
                rollAngle + modelRollOffsetRef.current
            );
            return Cesium.Transforms.headingPitchRollQuaternion(simState.current.position, hpr);
          }, false),
          model: modelConfig
        });
      } catch (e) {
         console.error('Failed to add aircraft entity:', e);
      }

      // SOCKET_IO SETUP
      socketRef.current = io({ 
          transports: ['websocket'],
          reconnection: true,
          reconnectionAttempts: 5,
          timeout: 10000
      });
      
      socketRef.current.on("players_update", (playersList: [string, any][]) => {
          if (!viewer) return;
          const currentIds = new Set(playersList.map(p => p[0]));
          
          playersList.forEach(([id, state]) => {
              if (id === socketRef.current?.id) return; // Skip self
              
              const pos = Cesium.Cartesian3.fromDegrees(state.lon, state.lat, state.alt);
              const hpr = new Cesium.HeadingPitchRoll(state.heading, state.pitch, state.roll);
              const ori = Cesium.Transforms.headingPitchRollQuaternion(pos, hpr);

              if (otherPlayersEntities.current[id]) {
                  const entity = otherPlayersEntities.current[id];
                  entity.position = pos as any;
                  entity.orientation = ori as any;
              } else {
                  // Add new player
                  otherPlayersEntities.current[id] = viewer.entities.add({
                      id: `player_${id}`,
                      name: `Player ${id.substring(0, 4)}`,
                      position: pos,
                      orientation: ori,
                      model: modelConfig || undefined,
                      box: !modelConfig ? { dimensions: new Cesium.Cartesian3(20, 20, 5), material: Cesium.Color.BLUE } : undefined,
                      label: {
                          text: `Player ${id.substring(0, 4)}\n${state.aircraft}`,
                          font: '14pt monospace',
                          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                          pixelOffset: new Cesium.Cartesian2(0, -50),
                          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0.0, 5000.0)
                      }
                  });
              }
          });

          // Cleanup disconnected
          Object.keys(otherPlayersEntities.current).forEach(id => {
              if (!currentIds.has(id)) {
                  viewer!.entities.remove(otherPlayersEntities.current[id]);
                  delete otherPlayersEntities.current[id];
              }
          });
      });
      
      socketRef.current.on("player_disconnected", (id: string) => {
          if (otherPlayersEntities.current[id] && viewer) {
              viewer.entities.remove(otherPlayersEntities.current[id]);
              delete otherPlayersEntities.current[id];
          }
      });

      try {
         // Spawn AI Traffic
         viewer.entities.add({
            name: "AI Traffic",
            // @ts-ignore
            position: new Cesium.CallbackProperty(() => aiTrafficState.current.position, false),
            orientation: new Cesium.CallbackProperty(() => {
               const hpr = new Cesium.HeadingPitchRoll(aiTrafficState.current.heading, 0, 0);
               return Cesium.Transforms.headingPitchRollQuaternion(aiTrafficState.current.position, hpr);
            }, false),
            box: {
               dimensions: new Cesium.Cartesian3(10.0, 10.0, 3.0),
               material: Cesium.Color.YELLOW.withAlpha(0.8),
            }
         });
      } catch (e) {
         console.warn('Failed to spawn AI traffic:', e);
      }

      try {
         if (spawnMode === 'gate') {
            viewer.entities.add({
               name: 'Human Avatar',
               // @ts-ignore
               position: new Cesium.CallbackProperty(() => humanState.current.position, false),
               orientation: new Cesium.CallbackProperty(() => {
                  const hpr = new Cesium.HeadingPitchRoll(humanState.current.heading, 0, 0);
                  return Cesium.Transforms.headingPitchRollQuaternion(humanState.current.position, hpr);
               }, false),
               cylinder: {
                  length: 1.8,
                  topRadius: 0.3,
                  bottomRadius: 0.3,
                  material: Cesium.Color.WHITE
               }
            });

            // Add moving ground vehicles
            groundVehiclesState.current.forEach((vehicle, index) => {
                viewer?.entities.add({
                   name: `Ground Vehicle ${index + 1}`,
                   // @ts-ignore
                   position: new Cesium.CallbackProperty(() => groundVehiclesState.current[index].position, false),
                   orientation: new Cesium.CallbackProperty(() => {
                      const hpr = new Cesium.HeadingPitchRoll(groundVehiclesState.current[index].heading, 0, 0);
                      return Cesium.Transforms.headingPitchRollQuaternion(groundVehiclesState.current[index].position, hpr);
                   }, false),
                   box: {
                      dimensions: new Cesium.Cartesian3(4.0, 2.0, 2.0),
                      material: Cesium.Color.ORANGE
                   }
                });
            });

            // Add a row of street lights along the ramp
            for (let i = 0; i < 5; i++) {
                // Add post for street light
                viewer.entities.add({
                   name: `Light Post ${i + 1}`,
                   position: Cesium.Cartesian3.fromDegrees(-122.3811 + (i * 0.0003), 37.6180, 2.5),
                   cylinder: {
                      length: 5.0,
                      topRadius: 0.1,
                   bottomRadius: 0.1,
                   material: Cesium.Color.fromCssColorString('#444444'),
                   heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND
                }
             });
             
             // Glowing bulb
             viewer.entities.add({
                name: `Street Light ${i + 1}`,
                position: Cesium.Cartesian3.fromDegrees(-122.3811 + (i * 0.0003), 37.6180, 5),
                point: {
                   pixelSize: 8,
                   color: Cesium.Color.fromCssColorString('#fffbb3'),
                   outlineColor: Cesium.Color.fromCssColorString('rgba(255,251,179,0.5)'),
                   outlineWidth: 4,
                   heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
                   disableDepthTestDistance: Number.POSITIVE_INFINITY
                }
             });
         }
      }
      } catch (e) {
         console.warn('Failed to load gate entities:', e);
      }

      // --- Animation Checker ---
      // We wait for the primitive to be generated and ready to check if the GLTF contains animations
      const checkAnimations = () => {
         if (!viewer || viewer.isDestroyed() || !aircraftEntity.current) return;
         const prims = viewer.scene.primitives;
         let found = false;
         for (let i = 0; i < prims.length; i++) {
            const p = prims.get(i) as any;
            if (p.id === aircraftEntity.current && p.ready) {
                found = true;
                const animCount = p.activeAnimations ? (p.activeAnimations.length || (p._animations && p._animations.length)) : (p.gltf?.animations?.length);
                if (animCount > 0) {
                    setHasAnimations(true);
                }
                viewer.scene.postUpdate.removeEventListener(checkAnimations);
                break;
            }
         }
      };
      viewer.scene.postUpdate.addEventListener(checkAnimations);

      // --- Custom Camera Event Handlers ---
      let isDragging = false;
      let lastTouch = { x: 0, y: 0 };
      let initialPinchDistance: number | null = null;
      const canvas = viewer.scene.canvas;

      const onMouseDown = () => { isDragging = true; };
      const onMouseUp = () => { isDragging = false; };
      const onMouseMove = (e: MouseEvent) => {
         if (!isDragging) return;
         const cv = cameraViewRef.current;
         if (cv === 'cockpit' || cv === 'landing_gear') {
            camControls.current.panPan -= e.movementX * 0.005;
            camControls.current.panTilt -= e.movementY * 0.005;
            camControls.current.panTilt = Math.max(-Math.PI/2, Math.min(Math.PI/2, camControls.current.panTilt));
         } else {
            camControls.current.orbitAlpha -= e.movementX * 0.01;
            camControls.current.orbitBeta += e.movementY * 0.01;
            
            const minBeta = cv === 'walk' ? -0.1 : -Math.PI / 2.5;
            camControls.current.orbitBeta = Math.max(minBeta, Math.min(Math.PI/2.5, camControls.current.orbitBeta));
         }
      };
      
      const onWheel = (e: WheelEvent) => {
         const cv = cameraViewRef.current;
         if (cv === 'exterior' || cv === 'walk') {
             camControls.current.radius += e.deltaY * 0.05;
             if (camControls.current.radius < 1.5) camControls.current.radius = 1.5;
             if (camControls.current.radius > 500) camControls.current.radius = 500;
         }
      };

      const onTouchStart = (e: TouchEvent) => {
          if (e.touches.length === 1) {
             isDragging = true;
             lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          }
      };
      const onTouchEnd = () => { 
          isDragging = false; 
          initialPinchDistance = null;
      };
      const onTouchMove = (e: TouchEvent) => {
          if (e.touches.length === 2) {
              const dx = e.touches[0].clientX - e.touches[1].clientX;
              const dy = e.touches[0].clientY - e.touches[1].clientY;
              const dist = Math.sqrt(dx*dx + dy*dy);
              if (initialPinchDistance) {
                  const delta = initialPinchDistance - dist;
                  const cv = cameraViewRef.current;
                  if (cv === 'exterior' || cv === 'walk') {
                       camControls.current.radius += delta * 0.2;
                       if (camControls.current.radius < 1.5) camControls.current.radius = 1.5;
                       if (camControls.current.radius > 500) camControls.current.radius = 500;
                  }
              }
              initialPinchDistance = dist;
              isDragging = false;
              return;
          }
          if (!isDragging) return;
          const touch = e.touches[0];
          const dx = touch.clientX - lastTouch.x;
          const dy = touch.clientY - lastTouch.y;
          lastTouch = { x: touch.clientX, y: touch.clientY };
          
          const cv = cameraViewRef.current;
          if (cv === 'cockpit' || cv === 'landing_gear') {
            camControls.current.panPan -= dx * 0.005;
            camControls.current.panTilt -= dy * 0.005;
            camControls.current.panTilt = Math.max(-Math.PI/2, Math.min(Math.PI/2, camControls.current.panTilt));
         } else {
            camControls.current.orbitAlpha -= dx * 0.01;
            camControls.current.orbitBeta += dy * 0.01;
            
            // Limit orbit beta to prevent going too far underground
            let minBeta = -Math.PI / 2.5; 
            if (cv === 'walk') {
               minBeta = -0.05; // Prevent camera from going low enough to clip terrain near human feet
            }
            camControls.current.orbitBeta = Math.max(minBeta, Math.min(Math.PI/2.5, camControls.current.orbitBeta));
         }
      };

      const onKeyDown = (e: KeyboardEvent) => {
          if (e.key === 'q' || e.key === 'Q') controlsRef.current.yawInput = -1;
          if (e.key === 'e' || e.key === 'E') controlsRef.current.yawInput = 1;
      };
      
      const onKeyUp = (e: KeyboardEvent) => {
          if (['q', 'Q', 'e', 'E'].includes(e.key)) controlsRef.current.yawInput = 0;
      };

      viewer.scene.screenSpaceCameraController.enableInputs = false;

      canvas.addEventListener('mousedown', onMouseDown);
      window.addEventListener('mouseup', onMouseUp);
      window.addEventListener('mousemove', onMouseMove);
      canvas.addEventListener('wheel', onWheel, { passive: true });
      canvas.addEventListener('touchstart', onTouchStart, { passive: true });
      window.addEventListener('touchend', onTouchEnd);
      window.addEventListener('touchmove', onTouchMove, { passive: true });
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);

      let lastTime = performance.now();

      const onTick = () => {
        if (!viewer || viewer.isDestroyed()) return;

        // Apply Weather Settings
        const targetFog = 0.0001 + (weatherFogRef.current * 0.0049); // Base to Heavy Fog
        viewer.scene.fog.density += (targetFog - viewer.scene.fog.density) * 0.1;

        const now = performance.now();
        const dt = Math.min((now - lastTime) / 1000, 0.1); // Cap dt to 0.1s to prevent physics explosions
        lastTime = now;

        const state = simState.current;
        const ctrl = controlsRef.current;
        const spawn = useFlightStore.getState().spawnMode;
        const scenario = useFlightStore.getState().activeScenario;

        // If at the gate, we're doing a walkaround. No flying.
        if (spawn === 'gate') {
           state.velocity = 0;
           const carto = Cesium.Cartographic.fromCartesian(state.position);
           
           // Pin airplane to ground
           if (viewer.scene.globe.getHeight(carto) !== undefined) {
              carto.height = viewer.scene.globe.getHeight(carto)! + 2; // Add 2m so wheels are above ground
           }
           state.position = Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, carto.height);
           
           setAltitude(Math.round(carto.height * 3.28084));
           setSpeedKnots(0);
           updateAudio(0, 0);

           const tzOffsetHours = (carto.longitude * (180 / Math.PI)) / 15;
           const utcTime = timeOfDayRef.current - tzOffsetHours;
           const baseDate = Cesium.JulianDate.fromDate(new Date('2024-01-01T00:00:00Z'));
           viewer.clock.currentTime = Cesium.JulianDate.addHours(baseDate, utcTime, new Cesium.JulianDate());

           // Human movement logic
           // To get camera-relative movement, we check where the camera is facing.
           const camYaw = camControls.current.orbitAlpha;
           const fwdX = Math.cos(camYaw);
           const fwdY = -Math.sin(camYaw);
           const rightX = fwdY; // 90 deg rotation
           const rightY = -fwdX;

           const moveX = fwdX * ctrl.pitchInput + rightX * ctrl.rollInput;
           const moveY = fwdY * ctrl.pitchInput + rightY * ctrl.rollInput;

           const magnitude = Math.sqrt(moveX*moveX + moveY*moveY);
           const hState = humanState.current;

           if (magnitude > 0.05) {
              hState.heading = Math.atan2(-moveY, moveX); // Rotate visual avatar to face movement dir
              hState.velocity = magnitude * 5; // 5 m/s walking speed
           } else {
              hState.velocity = 0;
           }

           const moveDist = hState.velocity * dt;
           const hDirection = new Cesium.Cartesian3(moveX / magnitude || 0, moveY / magnitude || 0, 0);
           Cesium.Cartesian3.multiplyByScalar(hDirection, moveDist, hDirection);

           const hCarto = Cesium.Cartographic.fromCartesian(hState.position);
           hCarto.longitude += (hDirection.x / 6378137) / Math.cos(hCarto.latitude);
           hCarto.latitude += hDirection.y / 6378137;
           // Pin human to ground
           const height = viewer.scene.globe.getHeight(hCarto);
           if (height !== undefined) {
              hCarto.height = height + 0.1; // Character's pivot is at their feet usually, slight bump to clear Z-fighting
           } else {
              hCarto.height = 5;
           }

           hState.position = Cesium.Cartesian3.fromRadians(hCarto.longitude, hCarto.latitude, hCarto.height);
           
           // --- Ground Vehicles Logic ---
           groundVehiclesState.current.forEach(vehicle => {
               vehicle.angle += vehicle.speed * dt;
               const lon = vehicle.center.lon + vehicle.radius * Math.cos(vehicle.angle);
               const lat = vehicle.center.lat + vehicle.radius * Math.sin(vehicle.angle);
               // Calculate heading
               vehicle.heading = vehicle.speed > 0 ? vehicle.angle + Math.PI / 2 : vehicle.angle - Math.PI / 2;
               
               const c3 = Cesium.Cartesian3.fromDegrees(lon, lat, 0);
               const cartoV = Cesium.Cartographic.fromCartesian(c3);
               const groundHeight = viewer?.scene.globe.getHeight(cartoV);
               cartoV.height = groundHeight !== undefined ? groundHeight : 5;
               vehicle.position = Cesium.Cartesian3.fromRadians(cartoV.longitude, cartoV.latitude, cartoV.height);
           });

           // Camera follows human, not airplane
           updateCamera(viewer, hState.position, new Cesium.HeadingPitchRoll(hState.heading, 0, 0));
           return;
        }

        // --- Emergency Modifiers & Fly-By-Wire ---
        const fbw = fbwState.current;
        const fbwSmoothing = 5.0 * dt; // FBW input damping speed
        
        fbw.smoothedPitchInput += (ctrl.pitchInput - fbw.smoothedPitchInput) * fbwSmoothing;
        fbw.smoothedRollInput += (ctrl.rollInput - fbw.smoothedRollInput) * fbwSmoothing;
        fbw.smoothedYawInput += (ctrl.yawInput - fbw.smoothedYawInput) * fbwSmoothing;
        
        let currentThrust = throttleRef.current * specs.thrust;
        let effPitch = fbw.smoothedPitchInput;
        let effRoll = fbw.smoothedRollInput;
        
        const carto = Cesium.Cartographic.fromCartesian(state.position);
        const groundHeight = viewer.scene.globe.getHeight(carto) ?? 0;
        const altitudeAGL = Math.max(0.1, carto.height - groundHeight);
        const isTouchingGround = altitudeAGL <= 6;

        // --- Autopilot & Autothrottle ---
        if (apEnabledRef.current && !isTouchingGround) {
            // Autothrottle
            const currentKnots = state.velocity * 1.94384;
            const spdError = apState.current.targetSpd - currentKnots;
            // Calculate a synthetic throttle position
            let apThrottle = throttleRef.current + (spdError * 0.01 * dt);
            apThrottle = Math.max(0, Math.min(1, apThrottle));
            throttleRef.current = apThrottle; 
            currentThrust = apThrottle * specs.thrust;

            // Pitch AP (Altitude Hold)
            const currentAlt = carto.height * 3.28084;
            const altError = apState.current.targetAlt - currentAlt;
            const targetPitch = Math.max(-0.25, Math.min(0.25, altError * 0.0005));
            effPitch = (targetPitch - state.pitchAngle) * 2.0; 

            // Roll AP (Heading Hold)
            const hdgError = apState.current.targetHdg - state.heading;
            const nHdgError = Math.atan2(Math.sin(hdgError), Math.cos(hdgError));
            const targetRoll = Math.max(-0.5, Math.min(0.5, nHdgError * 1.0));
            effRoll = (targetRoll - state.rollAngle) * 2.0;
        }

        let warning = null;
        let alarmVolume = 0;

        if (scenario === 'engine_failure') {
            const cartoCheck = Cesium.Cartographic.fromCartesian(state.position);
            if (cartoCheck.height * 3.28084 > 6000) { 
               currentThrust = 0;
               warning = '⚠️ MASTER CAUTION: ENGINE FLAMEOUT';
               alarmVolume = 1;
            }
        } else if (scenario === 'ailerons_failure') {
            effRoll *= 0.1; 
            warning = '⚠️ FLIGHT CONTROLS: AILERON LOCK';
        } else if (scenario === 'hydraulics') {
            effPitch *= 0.3;
            effRoll *= 0.3;
            warning = '⚠️ HYD SYS: LOSS OF PRESSURE';
        } else if (scenario === 'hijack') {
            if (Math.random() < 0.02) effRoll += (Math.random() - 0.5) * 1.5;
            if (Math.random() < 0.01) effPitch += (Math.random() - 0.5) * 1;
            warning = '🚨 SQUAWK 7500: UNLAWFUL INTERFERENCE';
        } else if (scenario === 'career_exam') {
            warning = '✅ CHECKRIDE EXAM: FOLLOW ATC INSTRUCTIONS';
        }

        if (warningFlagRef.current !== warning) {
           warningFlagRef.current = warning;
           setWarningMessage(warning);
        }

        // Add wind gradient
        const windBaseSpeed = 5.0; // 5 m/s at surface
        const windSpeed = windBaseSpeed * Math.log(Math.max(1, altitudeAGL / 0.1));
        // Add minimal headwind for realism or offset velocity
        // (Skipping full ground-track vector math for simplicity, just a slight effective velocity modifier)
        
        // Wrap angles
        if (state.rollAngle > Math.PI) state.rollAngle -= 2 * Math.PI;
        if (state.rollAngle < -Math.PI) state.rollAngle += 2 * Math.PI;
        if (state.pitchAngle > Math.PI) state.pitchAngle -= 2 * Math.PI;
        if (state.pitchAngle < -Math.PI) state.pitchAngle += 2 * Math.PI;
        if (state.heading > Math.PI) state.heading -= 2 * Math.PI;
        if (state.heading < -Math.PI) state.heading += 2 * Math.PI;
        
        const velocitySq = state.velocity * state.velocity;
        
        // --- X-PLANE 12 STYLE AERODYNAMICS ---
        // True Flight Path Angle (gamma)
        const currentVspeed = (state as any).vSpeed || 0;
        const flightPathAngle = Math.atan2(currentVspeed, Math.max(0.1, state.velocity));
        
        // Aerodynamic Angle of Attack
        let dynAoA = state.pitchAngle - flightPathAngle; 
        
        if (ctrl.yawInput === 0 && Math.abs(fbw.smoothedYawInput) > 0.001) {
            fbw.smoothedYawInput -= fbw.smoothedYawInput * 2.0 * dt; 
        }

        let dynSlip = -fbw.smoothedYawInput * 0.1; 

        // Evaluate Aerodynamics with full BET + Ground Effect + Stability
        const forces = calculateForces(
            state.velocity, dynAoA, dynSlip,
            { p: state.rollRate || 0, q: state.pitchRate || 0, r: state.yawRate || 0 },
            { pitch: effPitch, roll: effRoll, yaw: fbw.smoothedYawInput },
            specs,
            1.225, // Basic air density (could be scaled with altitude)
            altitudeAGL
        );

        // Rotational inertia
        const Ixx = specs.mass * Math.pow(specs.wingSpan / 4, 2);
        const Iyy = specs.mass * Math.pow(specs.wingSpan / 4, 2);
        const Izz = specs.mass * Math.pow(specs.wingSpan / 3, 2);

        // "Every Air Molecule" Volumetric Turbulence Simulator
        let airMassForcePitch = 0, airMassForceRoll = 0, airMassForceYaw = 0;
        
        if (turbulenceEnabledRef.current) {
            const simTime = Date.now() / 1000;
            const turbulentMagnitude = Math.max(0, (state.velocity - 50) / 100); // More airspeed = more collision with air mass
            airMassForcePitch = (Math.sin(simTime * 3.1) * Math.cos(simTime * 1.7) * 0.05) * turbulentMagnitude;
            airMassForceRoll = (Math.sin(simTime * 2.5 + 4) * Math.cos(simTime * 1.1) * 0.1) * turbulentMagnitude;
            airMassForceYaw = (Math.cos(simTime * 1.9 + 2) * 0.02) * turbulentMagnitude;
        }
        
        forces.pitchMoment += airMassForcePitch * Iyy;
        forces.rollMoment += airMassForceRoll * Ixx;
        forces.yawMoment += airMassForceYaw * Izz;

        let rollAccel = forces.rollMoment / Ixx;
        let pitchAccel = forces.pitchMoment / Iyy;
        const yawAccel = forces.yawMoment / Izz;
        
        // ARCADE FLIGHT ASSIST: Auto-Level when controls let go
        if (!apEnabledRef.current && Math.abs(ctrl.pitchInput) < 0.01 && Math.abs(fbw.smoothedPitchInput) < 0.01) {
            // Force pitch towards 0
            const pitchError = 0 - state.pitchAngle;
            // High spring force to force center, and strong dampening to prevent overshoot
            pitchAccel += (pitchError * 15.0 - (state.pitchRate || 0) * 8.0);
        }
        if (!apEnabledRef.current && Math.abs(ctrl.rollInput) < 0.01 && Math.abs(fbw.smoothedRollInput) < 0.01) {
            const rollError = 0 - state.rollAngle;
            rollAccel += (rollError * 8.0 - (state.rollRate || 0) * 5.0);
        }
        
        // Ground & Flight physics lock
        if (isTouchingGround) {
             state.yawRate = fbw.smoothedYawInput * 0.5;
             state.rollRate = 0; 
             
             // Allow pitch rate on rotation, but prevent pitch from dropping below ground level
             state.pitchRate = Math.max(-2, Math.min(2, (state.pitchRate || 0) + pitchAccel * dt));
             if (state.pitchAngle < 0) {
                 state.pitchAngle = 0;
                 if (state.pitchRate < 0) state.pitchRate = 0;
             }
             // Auto-settle pitch if not trying to take off and velocity is low
             if (Math.abs(ctrl.pitchInput) < 0.1 && state.velocity < 50) {
                 state.pitchRate -= state.pitchAngle * 5.0 * dt;
             }
             
             if (state.rollAngle > 0.05 || state.rollAngle < -0.05) state.rollAngle *= 0.8;
             
             // Ground braking / friction
             if (state.velocity > 0 && currentThrust < 10000) state.velocity -= 2 * dt; 
             if (currentVspeed < 0) (state as any).vSpeed = 0; 
             
             if (apEnabledRef.current) setApEnabled(false);
             state.heading += state.yawRate * dt;
        } else {
             state.rollRate = Math.max(-3, Math.min(3, (state.rollRate || 0) + rollAccel * dt));
             state.pitchRate = Math.max(-2, Math.min(2, (state.pitchRate || 0) + pitchAccel * dt));
             state.yawRate = Math.max(-1.5, Math.min(1.5, (state.yawRate || 0) + yawAccel * dt));
             
             // Coordinated turn centripetal force mapping (Banked Lift vector driving heading change)
             const turnRateFromBank = (9.81 / Math.max(state.velocity, 15)) * Math.tan(Math.max(-1.3, Math.min(1.3, state.rollAngle)));
             state.heading += (turnRateFromBank + (state.yawRate || 0)) * dt;
        }
        
        state.rollAngle += (state.rollRate || 0) * dt;
        state.pitchAngle += (state.pitchRate || 0) * dt;
        
        // --- TRANSLATIONAL PHYSICS (LINEAR MOVEMENT) ---
        const thrustAccel = currentThrust / specs.mass;
        const dragDecel = forces.drag / specs.mass;
        
        // Forward accel is thrust - drag - gravity component
        let accel = thrustAccel - dragDecel - 9.81 * Math.sin(flightPathAngle);
        state.velocity += accel * dt;
        if (state.velocity < 1 && spawn !== 'gate') state.velocity = 1;

        // Vertical accel is Lift component - Gravity + Thrust component
        let verticalLift = forces.lift * Math.cos(state.rollAngle);
        let vertAccel = (verticalLift / specs.mass) - 9.81 + (thrustAccel * Math.sin(state.pitchAngle));
        
        if (isTouchingGround && vertAccel < 0) {
            (state as any).vSpeed = 0;
        } else {
            (state as any).vSpeed = currentVspeed + vertAccel * dt;
        }

        // Distance & World Position Updating (Horizontal Translation)
        const hzSpeed = state.velocity * Math.cos(flightPathAngle);
        const hzDist = hzSpeed * dt;

        const direction = new Cesium.Cartesian3(
           Math.cos(state.heading),
           -Math.sin(state.heading),
           0
        );
        Cesium.Cartesian3.normalize(direction, direction);
        Cesium.Cartesian3.multiplyByScalar(direction, hzDist, direction);

        carto.longitude += (direction.x / 6378137) / Math.cos(carto.latitude);
        carto.latitude += direction.y / 6378137;
        carto.height += Math.max(-500, Math.min(500, (state as any).vSpeed)) * dt;
        
        // Ensure plane doesn't tunnel through ground
        const minHeight = groundHeight + 4; // roughly gear height
        if (carto.height < minHeight) {
            carto.height = minHeight;
            // Level pitch so we don't nose-dive continuously through ground
            if (state.pitchAngle < -0.1) state.pitchAngle *= 0.5;
            // Roll auto-level slightly when on ground
            state.rollAngle *= 0.95;
            // Apply heavy ground friction if we aren't producing lifting speed
            if (state.velocity > 0) state.velocity -= 2 * dt; 
            if (state.velocity < 0) state.velocity = 0;
            // Turn off AP on touchdown
            if (apEnabledRef.current) setApEnabled(false);
        }

        // Ground physics lock
        if (spawn === 'runway' && carto.height <= groundHeight + 6 && accel < 0 && state.velocity < 1) {
             accel = 0; state.velocity = 0;
        }

        state.position = Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, carto.height);

        // Update Time of Day (Local to the aircraft's longitude)
        const baseDate = Cesium.JulianDate.fromDate(new Date('2024-01-01T00:00:00Z'));
        const lonDegrees = carto.longitude * (180 / Math.PI);
        const tzOffsetHours = lonDegrees / 15; 
        const utcTimeOfDay = timeOfDayRef.current - tzOffsetHours;
        viewer.clock.currentTime = Cesium.JulianDate.addHours(baseDate, utcTimeOfDay, new Cesium.JulianDate());

        const spd = Math.round(state.velocity * 1.94384);
        setSpeedKnots(spd);
        setAltitude(Math.round(carto.height * 3.28084));

        // Multiplayer Socket Emission (20 Hz)
        if (socketRef.current && socketRef.current.connected) {
            const now = Date.now();
            if (now - lastStateEmit.current > 50) {
                const c = Cesium.Cartographic.fromCartesian(state.position);
                socketRef.current.emit('update_state', {
                    lon: Cesium.Math.toDegrees(c.longitude),
                    lat: Cesium.Math.toDegrees(c.latitude),
                    alt: c.height,
                    pitch: state.pitchAngle,
                    roll: state.rollAngle,
                    heading: state.heading,
                    aircraft: selectedAircraft
                });
                lastStateEmit.current = now;
            }
        }

        // --- AI Traffic Logic & TCAS ---
        const ai = aiTrafficState.current;
        const aiDist = ai.velocity * dt;
        const aiDir = new Cesium.Cartesian3(
            Math.cos(ai.heading),
            -Math.sin(ai.heading),
            0
        );
        Cesium.Cartesian3.normalize(aiDir, aiDir);
        Cesium.Cartesian3.multiplyByScalar(aiDir, aiDist, aiDir);
        
        const aiCarto = Cesium.Cartographic.fromCartesian(ai.position);
        aiCarto.longitude += (aiDir.x / 6378137) / Math.cos(aiCarto.latitude);
        aiCarto.latitude += aiDir.y / 6378137;
        ai.position = Cesium.Cartesian3.fromRadians(aiCarto.longitude, aiCarto.latitude, aiCarto.height);
        
        // TCAS calculations
        const distanceToTraffic = Cesium.Cartesian3.distance(state.position, ai.position);
        const altDiff = Math.abs(carto.height - aiCarto.height) * 3.28084;
        
        if (distanceToTraffic < 4000 && altDiff < 2000) {
            playWarning("Traffic. Traffic.");
        }
        if (distanceToTraffic < 1500 && altDiff < 1000) {
            const myAlt = carto.height;
            const aiAlt = aiCarto.height;
            if (myAlt < aiAlt) {
                 playWarning("Descend. Descend.", true);
            } else {
                 playWarning("Climb. Climb.", true);
            }
        }

        // --- GPWS & RAAS Logic ---
        const aglMeters = carto.height - (viewer.scene.globe.getHeight(carto) || 0);
        const aglFeet = aglMeters * 3.28084;
        const vspeedMetersPerSec = (carto.height - gpwsState.current.lastHeight) / dt;
        const vspeedFpm = vspeedMetersPerSec * 196.85;
        gpwsState.current.lastHeight = carto.height;
        
        setFpm(Math.round(vspeedFpm));

        const gpws = gpwsState.current;
        
        // RAAS - Approaching runway (Dummy check for SFO runway 28R vicinity)
        if (!gpws.hasApproachedRunway && aglFeet < 1500 && aglFeet > 500 && vspeedFpm < -500) {
             const sfoDist = Cesium.Cartesian3.distance(state.position, Cesium.Cartesian3.fromDegrees(-122.38, 37.62, 0));
             if (sfoDist < 10000) {
                 playWarning("Approaching Runway Two Eight Right");
                 gpws.hasApproachedRunway = true;
             }
        }

        if (state.velocity > 30) {
            // Sink Rate
            if (aglFeet < 2500 && vspeedFpm < -2000) {
                 const now = performance.now();
                 if (now - gpws.sinkRateTriggered > 3000) {
                     playWarning("Sink Rate.");
                     gpws.sinkRateTriggered = now;
                 }
            }
            if (aglFeet < 1000 && vspeedFpm < -3500) {
                 playWarning("Pull Up! Pull Up!", true);
            }

            // Terrain Warning
            if (aglFeet < 500 && vspeedFpm < -500 && !animationsEnabledRef.current) { // Assuming animations = gear
                 playWarning("Too Low, Gear.");
            } else if (aglFeet < 300 && spd > 200) {
                 playWarning("Too Low, Terrain.");
            }

            // Radio Altimeter Callouts
            if (vspeedFpm < -200) { // Only call out when descending
                if (aglFeet <= 2500 && !gpws.called2500) { playWarning("Twenty Five Hundred"); gpws.called2500 = true; }
                if (aglFeet <= 1000 && !gpws.called1000) { playWarning("One Thousand"); gpws.called1000 = true; }
                if (aglFeet <= 500 && !gpws.called500) { playWarning("Five Hundred"); gpws.called500 = true; }
                if (aglFeet <= 400 && !gpws.called400) { playWarning("Four Hundred"); gpws.called400 = true; }
                if (aglFeet <= 300 && !gpws.called300) { playWarning("Three Hundred"); gpws.called300 = true; }
                if (aglFeet <= 200 && !gpws.called200) { playWarning("Two Hundred"); gpws.called200 = true; }
                if (aglFeet <= 100 && !gpws.called100) { playWarning("One Hundred"); gpws.called100 = true; }
                if (aglFeet <= 50 && !gpws.called50) { playWarning("Fifty"); gpws.called50 = true; }
                if (aglFeet <= 40 && !gpws.called40) { playWarning("Forty"); gpws.called40 = true; }
                if (aglFeet <= 30 && !gpws.called30) { playWarning("Thirty"); gpws.called30 = true; }
                if (aglFeet <= 20 && !gpws.called20) { playWarning("Twenty. Retard. Retard."); gpws.called20 = true; }
                if (aglFeet <= 10 && !gpws.called10) { playWarning("Ten"); gpws.called10 = true; }
            }
        }
        
        // Reset callouts if we climb back up
        if (aglFeet > 2600) gpws.called2500 = false;
        if (aglFeet > 1100) gpws.called1000 = false;
        if (aglFeet > 600) gpws.called500 = false;
        if (aglFeet > 500) gpws.called400 = false;
        if (aglFeet > 400) gpws.called300 = false;
        if (aglFeet > 300) gpws.called200 = false;
        if (aglFeet > 200) gpws.called100 = false;
        if (aglFeet > 150) {
            gpws.called50 = false; gpws.called40 = false; gpws.called30 = false; gpws.called20 = false; gpws.called10 = false;
        }
        if (aglFeet > 3000) gpws.hasApproachedRunway = false;

        // --- ATC Logic ---
        if (now % 20000 < 100) { // Random ATC chatter roughly every 20s
             const messages = [
                 "Flight 402, maintain current heading and altitude.",
                 "Caution, wake turbulence reported from heavy ahead.",
                 "Contact NorCal Approach on 120.5, good day.",
                 "Traffic 2 o'clock, 5 miles, Boeing 737.",
                 "Altimeter 29.92, wind is calm."
             ];
             setAtcMessage(`ATC: ${messages[Math.floor(Math.random() * messages.length)]}`);
             setTimeout(() => setAtcMessage(null), 5000);
        }

        updateAudio(throttleRef.current, spd);

        updateCamera(viewer, state.position, new Cesium.HeadingPitchRoll(state.heading, state.pitchAngle, state.rollAngle));
      };

      const updateCamera = (v: Cesium.Viewer, pos: Cesium.Cartesian3, hpr: Cesium.HeadingPitchRoll) => {
         const cv = cameraViewRef.current;
         const { orbitAlpha, orbitBeta, radius, panPan, panTilt } = camControls.current;
         
         // In 'walk' view, orient the transform locally to ENU, NOT character heading.
         const effHpr = cv === 'walk' ? new Cesium.HeadingPitchRoll(0, 0, 0) : hpr;
         const transform = Cesium.Transforms.headingPitchRollToFixedFrame(pos, effHpr);
         
         if (cv === 'exterior' || cv === 'walk') {
            // Cesium's HeadingPitchRoll fixed frame maps +X as Forward, +Y as Left, +Z as Up.
            // To position the camera BEHIND the plane, X should be negative.
            const x = -radius * Math.cos(orbitBeta) * Math.cos(orbitAlpha);
            const y = radius * Math.cos(orbitBeta) * Math.sin(orbitAlpha);
            const z = radius * Math.sin(orbitBeta);
            let offset = new Cesium.Cartesian3(x, y, z);
            
            if (cv === 'walk') {
               // Lift the focal point up so we don't look at the human's feet
               const zOffset = new Cesium.Cartesian3(0, 0, 1.5);
               const centerTransform = Cesium.Matrix4.multiplyByTranslation(transform, zOffset, new Cesium.Matrix4());
               
               const camPos = Cesium.Matrix4.multiplyByPoint(centerTransform, offset, new Cesium.Cartesian3());
               // Camera ground clip fix
               const camCarto = Cesium.Cartographic.fromCartesian(camPos);
               const ground = v.scene.globe.getHeight(camCarto) ?? 0;
               if (camCarto.height < ground + 0.5) camCarto.height = ground + 0.5;
               
               v.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
               v.camera.setView({
                   destination: Cesium.Cartesian3.fromRadians(camCarto.longitude, camCarto.latitude, camCarto.height),
                   orientation: {
                     direction: Cesium.Cartesian3.normalize(Cesium.Cartesian3.subtract(Cesium.Matrix4.getTranslation(centerTransform, new Cesium.Cartesian3()), Cesium.Cartesian3.fromRadians(camCarto.longitude, camCarto.latitude, camCarto.height), new Cesium.Cartesian3()), new Cesium.Cartesian3()),
                     up: Cesium.Cartesian3.normalize(camPos, new Cesium.Cartesian3())
                   }
               });

            } else {
               const camPos = Cesium.Matrix4.multiplyByPoint(transform, offset, new Cesium.Cartesian3());
               const camCarto = Cesium.Cartographic.fromCartesian(camPos);
               const ground = v.scene.globe.getHeight(camCarto) ?? 0;
               if (camCarto.height < ground + 2) camCarto.height = ground + 2;
               
               v.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
               v.camera.setView({
                   destination: Cesium.Cartesian3.fromRadians(camCarto.longitude, camCarto.latitude, camCarto.height),
                   orientation: {
                      direction: Cesium.Cartesian3.normalize(Cesium.Cartesian3.subtract(pos, Cesium.Cartesian3.fromRadians(camCarto.longitude, camCarto.latitude, camCarto.height), new Cesium.Cartesian3()), new Cesium.Cartesian3()),
                      up: Cesium.Cartesian3.normalize(camPos, new Cesium.Cartesian3())
                   }
               });
            }
         } else {
            let baseOffset;
            if (cv === 'cockpit') baseOffset = new Cesium.Cartesian3(10, 0, 2); // 10m forward, 0m left, 2m up
            else baseOffset = new Cesium.Cartesian3(2, 0, -3); // Gear: 2m forward, under belly

            const camPos = Cesium.Matrix4.multiplyByPoint(transform, baseOffset, new Cesium.Cartesian3());
            v.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
            v.camera.setView({
              destination: camPos,
              orientation: {
                heading: hpr.heading + panPan,
                pitch: hpr.pitch + panTilt,
                roll: cv === 'cockpit' ? hpr.roll : 0
              }
            });
         }
      };

      viewer.clock.onTick.addEventListener(onTick);
      
      return () => {
        if (viewer && !viewer.isDestroyed()) {
          viewer.clock.onTick.removeEventListener(onTick);
        }
        canvas.removeEventListener('mousedown', onMouseDown);
        window.removeEventListener('mouseup', onMouseUp);
        window.removeEventListener('mousemove', onMouseMove);
        canvas.removeEventListener('wheel', onWheel);
        canvas.removeEventListener('touchstart', onTouchStart);
        window.removeEventListener('touchend', onTouchEnd);
        window.removeEventListener('touchmove', onTouchMove);
      };
    };

    let cleanup = () => {};
    init().then(cleanupFn => {
      if (cleanupFn) cleanup = cleanupFn;
    }).catch(e => {
        console.error("FATAL CESIUM INIT ERROR:", e);
    });

    return () => {
      isMounted = false;
      stopAudio(); // Clean up audio Engine when user quits Flight!
      cleanup();
      if (viewer && !viewer.isDestroyed()) {
         viewer.destroy();
      }
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [selectedAircraft, customModelUrl]); // Notice dependencies removed: throttle and cameraView

  const handleJoystickMove = (e: any) => {
    handleAudioInit(); // Init Sound API
    // Increase sensitivity by dividing by a smaller number (e.g., 20 instead of 50)
    // Positive e.y means pushed UP on screen. We want this to mean Nose DOWN.
    // Nose DOWN corresponds to negative effPitch. So we negate e.y natively.
    controlsRef.current.pitchInput = -((e.y || 0) / 20) * (useFlightStore.getState().invertY ? -1 : 1); 
    controlsRef.current.rollInput = (e.x || 0) / 20;
  };

  const handleJoystickStop = () => {
    controlsRef.current.pitchInput = 0;
    controlsRef.current.rollInput = 0;
  };

  const cycleView = () => {
    const views: ("cockpit" | "exterior" | "landing_gear" | "walk")[] = ['cockpit', 'exterior', 'landing_gear', 'walk'];
    let idx = views.indexOf(cameraView as any);
    idx = (idx + 1) % views.length;
    setCameraView(idx === 3 ? 'exterior' : views[idx] as any);
    if (idx === 3) {
      setTimeout(() => setCameraView('walk' as any), 10); // Hack to trigger walk
    }
  };

  return (
    <div 
      className="absolute inset-0 bg-[#05070a] font-['Helvetica_Neue',Helvetica,Arial,sans-serif] text-white select-none [-webkit-touch-callout:none]"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div ref={viewerRef} className="w-full h-full" onClick={handleAudioInit} />
      
      {/* Viewport Overlay for Cameras */}
      <div className="absolute top-[20px] right-[20px] flex flex-col gap-[10px] pointer-events-auto">
        {spawnMode !== 'gate' && (['cockpit', 'exterior', 'landing_gear', 'walk'] as const).map(view => (
          <button 
             key={view}
             onClick={() => setCameraView(view)}
             className={`bg-[rgba(0,0,0,0.5)] border border-white/20 text-white px-[12px] py-[8px] text-[11px] cursor-pointer text-right uppercase transition ${cameraView === view ? 'bg-[#26b3ff] border-[#26b3ff]' : 'hover:bg-white/10'}`}
          >
            {view.replace('_', ' ')} View
          </button>
        ))}

        {hasAnimations && (
           <button 
               onClick={() => setAnimationsEnabled(!animationsEnabled)}
               className="mt-4 bg-[rgba(38,179,255,0.2)] border border-[#26b3ff] text-[#26b3ff] px-[12px] py-[8px] text-[11px] font-bold cursor-pointer text-right uppercase shadow-[0_0_10px_rgba(38,179,255,0.3)] transition hover:bg-[rgba(38,179,255,0.3)]"
           >
              {animationsEnabled ? 'STOP ANIM / RAIS. GEAR' : 'PLAY ANIM / DEPL. GEAR'}
           </button>
        )}

        {spawnMode !== 'gate' && (
           <button 
               onClick={() => {
                   if (!apEnabled) {
                       apState.current.targetAlt = altitude;
                       apState.current.targetSpd = speedKnots;
                       apState.current.targetHdg = simState.current.heading;
                   }
                   setApEnabled(!apEnabled);
               }}
               className={`mt-4 border px-[12px] py-[8px] text-[11px] font-bold cursor-pointer text-right uppercase transition ${apEnabled ? 'bg-green-500/30 border-green-500 text-green-500' : 'bg-white/10 border-white/20 text-white/50 hover:bg-white/20'}`}
           >
              {apEnabled ? 'AUTOPILOT ENGAGED' : 'ENGAGE AUTOPILOT'}
           </button>
        )}
      </div>

      <div className="absolute top-[20px] left-[20px] flex flex-col gap-4 pointer-events-auto z-50">
        <button 
          className="bg-[rgba(0,0,0,0.5)] border border-white/20 text-white px-[12px] py-[8px] text-[11px] cursor-pointer hover:bg-white/10 transition flex items-center justify-center gap-2 block w-full text-left"
          onClick={() => { stopAudio(); setAppState('menu'); }}
        >
          &#8592; QUIT TO MENU
        </button>
        
        {customModelUrl && (
           <div className="flex flex-col gap-2">
               <button 
                 className={`bg-[rgba(0,0,0,0.5)] border ${showModelAdjust ? 'border-[#26b3ff] text-[#26b3ff]' : 'border-white/20 text-white'} px-[12px] py-[8px] text-[11px] cursor-pointer hover:bg-white/10 transition w-full text-left uppercase`}
                 onClick={() => setShowModelAdjust(!showModelAdjust)}
               >
                 Fix Model Orientation
               </button>
               {showModelAdjust && (
                 <div className="bg-[rgba(0,0,0,0.8)] border border-white/20 p-3 flex flex-col gap-3 w-[250px] backdrop-blur text-white">
                    <span className="text-[10px] text-[#94a3b8] uppercase tracking-[1px] font-bold">Model Adjustments</span>
                    <div>
                        <label className="text-[10px] text-[#94a3b8] block mb-1">Yaw (Left/Right)</label>
                        <input type="range" min="-180" max="180" step="1" value={modelYawOffset * (180/Math.PI)} onChange={(e) => setModelYawOffset(parseFloat(e.target.value) * (Math.PI/180))} className="w-full accent-[#26b3ff]" />
                        <div className="text-right text-[10px]">{Math.round(modelYawOffset * (180/Math.PI))}°</div>
                    </div>
                    <div>
                        <label className="text-[10px] text-[#94a3b8] block mb-1">Pitch (Up/Down)</label>
                        <input type="range" min="-180" max="180" step="1" value={modelPitchOffset * (180/Math.PI)} onChange={(e) => setModelPitchOffset(parseFloat(e.target.value) * (Math.PI/180))} className="w-full accent-[#26b3ff]" />
                        <div className="text-right text-[10px]">{Math.round(modelPitchOffset * (180/Math.PI))}°</div>
                    </div>
                    <div>
                        <label className="text-[10px] text-[#94a3b8] block mb-1">Roll (Tilt)</label>
                        <input type="range" min="-180" max="180" step="1" value={modelRollOffset * (180/Math.PI)} onChange={(e) => setModelRollOffset(parseFloat(e.target.value) * (Math.PI/180))} className="w-full accent-[#26b3ff]" />
                        <div className="text-right text-[10px]">{Math.round(modelRollOffset * (180/Math.PI))}°</div>
                    </div>
                 </div>
               )}
           </div>
        )}
      </div>

      {/* Environment Controls Overlay */}
      <div className="absolute bottom-[20px] left-[180px] bg-[rgba(0,0,0,0.5)] border border-white/20 p-[15px] pointer-events-auto backdrop-blur rounded flex flex-col gap-[10px] w-[200px]">
         <div className="flex items-center gap-[10px] text-[10px] text-[#26b3ff] font-bold tracking-[1px] uppercase">
            <Clock size={12} /> Time of Day ({Math.floor(timeOfDay).toString().padStart(2, '0')}:00)
         </div>
         <input 
            type="range" min="0" max="23.99" step="0.1" 
            value={timeOfDay} 
            onChange={(e) => setTimeOfDay(parseFloat(e.target.value))} 
            className="w-full accent-[#26b3ff]" 
         />
      </div>

      <div className="absolute bottom-[20px] right-[20px] pointer-events-none text-[10px] text-[#94a3b8] flex flex-col items-end gap-1">
          {audioEnabled ? (
             <span className="flex items-center gap-2 text-[#22c55e]"><Volume2 size={12} /> AUD ENGINE ONLINE</span>
          ) : (
             <span className="flex items-center gap-2 text-[#ef4444]"><ShieldAlert size={12} /> AUD ENGINE STBY (MOVE STICK/CLICK MAP)</span>
          )}
      </div>

      {/* Telemetry Display */}
      {spawnMode !== 'gate' && (
        <div className="absolute top-[20px] left-1/2 -translate-x-1/2 flex flex-col items-center gap-[10px] pointer-events-none z-50">
            <div className="bg-[rgba(0,0,0,0.4)] border border-white/10 flex items-center px-[30px] h-[80px] gap-[40px] backdrop-blur">
              <div className="flex flex-col">
                <span className="text-[10px] text-[#94a3b8] uppercase">Altitude</span>
                <span className="font-['Courier_New',Courier,monospace] text-[24px] text-[#26b3ff]">{altitude}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-[#94a3b8] uppercase">Airspeed</span>
                <span className="font-['Courier_New',Courier,monospace] text-[24px] text-[#26b3ff]">{speedKnots}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-[#94a3b8] uppercase">Fuel LBS</span>
                <span className="font-['Courier_New',Courier,monospace] text-[24px] text-[#26b3ff]">42,500</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-[#94a3b8] uppercase">VSPEED (FPM)</span>
                <span className="font-['Courier_New',Courier,monospace] text-[24px] text-[#26b3ff]">{fpm > 0 ? `+${fpm}` : fpm}</span>
              </div>
            </div>
            {warningMessage && (
              <div className={`px-[20px] py-[10px] font-bold text-[14px] uppercase tracking-[2px] animate-pulse ${warningMessage.includes('✅') ? 'bg-[#22c55e]/20 border border-[#22c55e] text-[#22c55e]' : 'bg-red-500/20 border border-red-500 text-red-500'}`}>
                  {warningMessage}
              </div>
            )}
            {atcMessage && (
              <div className="px-[20px] py-[10px] font-bold text-[14px] uppercase tracking-[2px] bg-[#26b3ff]/20 border border-[#26b3ff] text-[#26b3ff]">
                  {atcMessage}
              </div>
            )}
        </div>
      )}

      {/* Mobile Controls / HUD */}
      <div className="absolute inset-x-0 bottom-[40px] flex justify-between px-[40px] pointer-events-none">
         
         <div className="pointer-events-auto flex items-center gap-[20px]">
           {spawnMode !== 'gate' ? (
             <>
                <div className="flex flex-col gap-6 items-center">
                    <div className="flex gap-4 items-center">
                        <input 
                          type="range" 
                          className="h-[120px] w-[8px] !appearance-slider-vertical pointer-events-auto" 
                          style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
                          min="0" max="1" step="0.01" 
                          value={throttle}
                          onChange={(e) => setThrottle(parseFloat(e.target.value))}
                        />
                        <div className="text-[#26b3ff] text-[12px] uppercase font-bold tracking-[2px]">
                           THRUST<br/>{Math.round(throttle * 100)}%
                        </div>
                    </div>
                </div>
             </>
           ) : (
               <div className="text-[#26b3ff] flex flex-col gap-1 text-[12px] uppercase font-bold tracking-[2px] bg-black/50 p-4 rounded border border-white/10">
                   <span>🕹️ JOYSTICK UP/DOWN → Main Pitch</span>
                   <span>🕹️ JOYSTICK LEFT/RIGHT → Main Roll</span>
                   <span>⌨️ 'Q' / 'E' KEYS → Ground Steering Rudder</span>
                   <span>🖱️ CLICK & DRAG → View Camera</span>
                </div>
           )}
         </div>

         <div className="pointer-events-auto relative flex items-center justify-end gap-6 w-[400px]">
            {spawnMode !== 'gate' && (
               <div className="flex gap-4 pr-10">
                  <button 
                     onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); controlsRef.current.yawInput = -1; }} 
                     onPointerUp={(e) => { e.currentTarget.releasePointerCapture(e.pointerId); controlsRef.current.yawInput = 0; }} 
                     onPointerOut={() => { controlsRef.current.yawInput = 0; }}
                     onPointerCancel={() => { controlsRef.current.yawInput = 0; }}
                     className="w-[60px] h-[60px] bg-black/50 rounded-full border border-white/20 text-[#26b3ff] text-[10px] font-bold tracking-widest uppercase active:bg-[#26b3ff] active:text-white select-none"
                  >L<br/>RUD</button>
                  <button 
                     onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); controlsRef.current.yawInput = 1; }} 
                     onPointerUp={(e) => { e.currentTarget.releasePointerCapture(e.pointerId); controlsRef.current.yawInput = 0; }} 
                     onPointerOut={() => { controlsRef.current.yawInput = 0; }}
                     onPointerCancel={() => { controlsRef.current.yawInput = 0; }}
                     className="w-[60px] h-[60px] bg-black/50 rounded-full border border-white/20 text-[#26b3ff] text-[10px] font-bold tracking-widest uppercase active:bg-[#26b3ff] active:text-white select-none"
                  >R<br/>RUD</button>
               </div>
            )}
            <div className="relative">
               <div className="absolute inset-0 border-2 border-[#26b3ff]/30 rounded-full bg-[radial-gradient(circle,rgba(38,179,255,0.1),transparent)] pointer-events-none shadow-[inset_0_0_15px_rgba(38,179,255,0.2)]"></div>
               <Joystick 
                 size={120} 
                 baseColor="transparent" 
                 stickColor="#26b3ff" 
                 move={handleJoystickMove} 
                 stop={handleJoystickStop} 
               />
            </div>
         </div>
      </div>
    </div>
  );
}
