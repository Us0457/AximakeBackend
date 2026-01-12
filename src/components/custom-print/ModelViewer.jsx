import React, { Suspense, useRef, useEffect, useState, useMemo, useLayoutEffect } from 'react';
    import { Canvas } from '@react-three/fiber';
    import { OrbitControls, Html, useProgress } from '@react-three/drei';
    import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
    import * as THREE from 'three';
    import { Loader2 } from 'lucide-react';

    // We'll memoize parsing and computing stats for a modelData buffer so parsing happens only once per file.
    // This helper is intentionally small; heavy work is done inside useMemo in the component below.

    // Accept scaleFactor prop and apply it to the model's scale
    // LoadedModel expects a pre-parsed geometry object. Geometry parsing and bbox computation
    // should happen only once per modelData (memoized by parent). This component only mounts
    // the mesh and applies a one-time transform in a layout effect.
    const LoadedModel = ({ geomWrapper, modelColor }) => {
      const meshRef = useRef();
      const initialScaleRef = useRef(1);

      // geomWrapper: { geom, size }
      const geom = geomWrapper?.geom || null;
      const size = geomWrapper?.size || new THREE.Vector3(1, 1, 1);

      // Create a single material instance once; we'll update its color imperatively when modelColor changes.
      const material = useMemo(() => new THREE.MeshStandardMaterial({ color: new THREE.Color(modelColor || '#ffffff'), metalness: 0.3, roughness: 0.6 }), []);

      // One-time layout transform: grounding and scaling. Runs only when geometry changes.
      useLayoutEffect(() => {
        if (!geom || !meshRef.current) return;
        try {
          // Use size computed during memoization
          const maxDim = Math.max(size.x || 1, size.y || 1, size.z || 1);
          const padding = 1.1;
          const scale = (100 / (maxDim * padding)) * (initialScaleRef.current || 1);
          meshRef.current.scale.set(scale, scale, scale);
          // Ground the model: move it down by half its Y size so it sits on the grid
          meshRef.current.position.set(0, -(size.y * scale) / 2, 0);
        } catch (e) {
          // don't break rendering for transform errors
          // eslint-disable-next-line no-console
          console.warn('Model transform failed', e);
        }
        // intentionally depend only on geom so UI changes don't re-run this effect
      }, [geom]);

      // Update material color on UI changes without remounting geometry
      useEffect(() => {
        if (meshRef.current && meshRef.current.material && modelColor) {
          try { meshRef.current.material.color.set(modelColor); } catch (e) { /* ignore */ }
        }
      }, [modelColor]);

      if (!geom) return null;
      return <mesh ref={meshRef} geometry={geom} material={material} castShadow receiveShadow />;
    };
    
    const CanvasLoader = () => {
      const { progress } = useProgress();
      return (
        <Html center>
          <div className="flex flex-col items-center text-primary">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="mt-2">{Math.round(progress)}% loaded</p>
          </div>
        </Html>
      );
    };

    // Pass scaleFactor prop from ModelViewer to LoadedModel
    const ModelViewer = ({ modelData, modelColor, onError, onStats, scaleFactor = 1 }) => {
      const [internalError, setInternalError] = useState(null);
      const [stats, setStats] = useState(null);

      // Memoize heavy parsing and stats computation. This ensures parsing happens only once per modelData.
      const geomWrapper = useMemo(() => {
        if (!modelData) return null;
        try {
          const loader = new STLLoader();
          const geometry = loader.parse(modelData);
          if (!geometry || !geometry.attributes || !geometry.attributes.position) throw new Error('Invalid STL geometry');
          geometry.computeVertexNormals();
          geometry.computeBoundingBox();
          const boundingBox = geometry.boundingBox.clone();
          const size = new THREE.Vector3();
          boundingBox.getSize(size);
          // Center geometry so positioning can be applied to the mesh instead of mutating on UI updates
          geometry.center();

          // Compute approximate volume
          let volume = 0;
          const position = geometry.attributes.position;
          const indexArray = geometry.index ? geometry.index.array : null;
          const vertexCount = indexArray ? indexArray.length : position.count;
          for (let i = 0; i < vertexCount; i += 3) {
            const a = indexArray ? indexArray[i] : i;
            const b = indexArray ? indexArray[i + 1] : i + 1;
            const c = indexArray ? indexArray[i + 2] : i + 2;
            const p0 = new THREE.Vector3().fromBufferAttribute(position, a);
            const p1 = new THREE.Vector3().fromBufferAttribute(position, b);
            const p2 = new THREE.Vector3().fromBufferAttribute(position, c);
            volume += p0.dot(p1.clone().cross(p2)) / 6.0;
          }
          return { geom: geometry, size, stats: { volume: Math.abs(volume), dimensions: { x: size.x, y: size.y, z: size.z } } };
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error('STL parse failed', e);
          return null;
        }
      }, [modelData]);

      useEffect(() => {
        setInternalError(null);
        if (geomWrapper && geomWrapper.stats) {
          setStats(geomWrapper.stats);
          if (onStats) onStats(geomWrapper.stats);
        } else {
          setStats(null);
          if (onStats) onStats(null);
        }
      }, [geomWrapper, onStats]);

      if (internalError) {
        return (
          <div className="w-full h-96 rounded-lg border border-destructive bg-destructive/10 flex items-center justify-center p-4">
            <p className="text-destructive-foreground text-center">{internalError}</p>
          </div>
        );
      }
      
      return (
        <div className="w-full h-96 rounded-lg border border-muted bg-gradient-to-br from-muted/30 to-muted/50 shadow-inner relative">
          <Canvas camera={{ position: [100, 100, 150], fov: 45 }}>
            <ambientLight intensity={0.7} />
            <pointLight position={[50, 50, 100]} intensity={0.8} castShadow />
            <pointLight position={[-50, -50, -100]} intensity={0.5} />
            <directionalLight position={[0, 100, 50]} intensity={0.6} castShadow />
            <Suspense fallback={<CanvasLoader />}>
              {modelData && geomWrapper ? (
                <LoadedModel geomWrapper={geomWrapper} modelColor={modelColor} />
              ) : (
                <Html center>
                  <p className="text-muted-foreground">Upload an STL model to view</p>
                </Html>
              )}
            </Suspense>
            <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
          </Canvas>
          {stats && (
            <div className="absolute top-2 left-2 bg-background/90 rounded-lg shadow p-2 text-xs z-10 border border-border">
              <div><span className="font-semibold">Volume:</span> {stats.volume ? stats.volume.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '-'} mm³</div>
              <div><span className="font-semibold">Dimensions:</span> {stats.dimensions ? `${stats.dimensions.x.toFixed(1)} × ${stats.dimensions.y.toFixed(1)} × ${stats.dimensions.z.toFixed(1)} mm` : '-'}</div>
            </div>
          )}
        </div>
      );
    };

    export default ModelViewer;