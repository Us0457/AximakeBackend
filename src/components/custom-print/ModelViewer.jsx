import React, { Suspense, useRef, useEffect, useState } from 'react';
    import { Canvas } from '@react-three/fiber';
    import { OrbitControls, Html, useProgress } from '@react-three/drei';
    import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
    import * as THREE from 'three';
    import { Loader2 } from 'lucide-react';

    // Utility to compute volume and bounding box
    function computeModelStats(data) {
      try {
        const loader = new STLLoader();
        const geometry = loader.parse(data);
        // Ensure geometry has the needed attributes
        if (!geometry.attributes || !geometry.attributes.position) {
          throw new Error("Invalid STL geometry: missing position attribute.");
        }
        // Compute bounding box
        geometry.computeBoundingBox();
        const boundingBox = geometry.boundingBox.clone();
        const size = new THREE.Vector3();
        boundingBox.getSize(size);
        // Compute volume
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
        return {
          volume: Math.abs(volume), // in mm^3
          dimensions: { x: size.x, y: size.y, z: size.z }
        };
      } catch (e) {
        console.error("Error computing model stats:", e);
        return null;
      }
    }

    // Accept scaleFactor prop and apply it to the model's scale
    const LoadedModel = ({ data, modelColor, scaleFactor = 1 }) => {
      const geom = new STLLoader().parse(data);
      const meshRef = useRef();

      useEffect(() => {
        if (geom && meshRef.current) {
          geom.computeVertexNormals();
          geom.center();
          const boundingBox = new THREE.Box3().setFromObject(new THREE.Mesh(geom));
          const size = new THREE.Vector3();
          boundingBox.getSize(size);
          let maxDim = Math.max(size.x, size.y, size.z);
          if (maxDim < 1e-5) maxDim = 1;
          const padding = 1.1;
          // Apply extra scale factor for small display
          const scale = (100 / (maxDim * padding)) * scaleFactor;
          meshRef.current.scale.set(scale, scale, scale);
          meshRef.current.position.set(0, 0, 0);
        }
      }, [geom, scaleFactor]);
      
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(modelColor),
        metalness: 0.3,
        roughness: 0.6,
      });

      return (
        <mesh ref={meshRef} geometry={geom} material={material} castShadow receiveShadow />
      );
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

      useEffect(() => {
        setInternalError(null);
        if (modelData) {
          const computed = computeModelStats(modelData);
          setStats(computed);
          if (onStats) onStats(computed);
        } else {
          setStats(null);
          if (onStats) onStats(null);
        }
      }, [modelData, onStats]);

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
              {modelData ? (
                <LoadedModel data={modelData} modelColor={modelColor} scaleFactor={scaleFactor} />
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