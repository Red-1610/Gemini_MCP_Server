import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#f7f9fc');

    const camera = new THREE.PerspectiveCamera(
      42,
      container.clientWidth / container.clientHeight,
      0.1,
      100,
    );
    camera.position.set(0, 0, 7);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight('#ffffff', '#cbd5e1', 2.8));

    const keyLight = new THREE.DirectionalLight('#ffffff', 4);
    keyLight.position.set(3, 4, 5);
    scene.add(keyLight);

    const blueLight = new THREE.PointLight('#93c5fd', 16, 10);
    blueLight.position.set(-3, 1, 3);
    scene.add(blueLight);

    const roseLight = new THREE.PointLight('#fbcfe8', 12, 9);
    roseLight.position.set(3, -2, 2);
    scene.add(roseLight);

    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: '#ffffff',
      metalness: 0.02,
      roughness: 0.08,
      transmission: 0.72,
      thickness: 0.5,
      ior: 1.45,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      transparent: true,
      opacity: 0.82,
    });

    const windowGroup = new THREE.Group();
    scene.add(windowGroup);

    const windowPanel = new THREE.Mesh(
      new THREE.BoxGeometry(4.6, 2.8, 0.16),
      glassMaterial,
    );
    windowGroup.add(windowPanel);

    const frame = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(4.62, 2.82, 0.18)),
      new THREE.LineBasicMaterial({
        color: '#cbd5e1',
        transparent: true,
        opacity: 0.9,
      }),
    );
    windowGroup.add(frame);

    const accentMaterial = new THREE.MeshPhysicalMaterial({
      color: '#bfdbfe',
      emissive: '#60a5fa',
      emissiveIntensity: 0.25,
      metalness: 0.05,
      roughness: 0.15,
      transmission: 0.35,
      transparent: true,
      opacity: 0.8,
    });

    const accents = [
      { position: [-1.7, 0.86, 0.16], scale: [0.38, 0.06, 0.03] },
      { position: [-1.7, 0.62, 0.16], scale: [0.78, 0.035, 0.03] },
      { position: [-1.7, 0.45, 0.16], scale: [0.58, 0.035, 0.03] },
      { position: [1.35, -0.8, 0.16], scale: [0.5, 0.08, 0.03] },
    ];

    accents.forEach(({ position, scale }) => {
      const accent = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        accentMaterial,
      );
      accent.position.set(position[0], position[1], position[2]);
      accent.scale.set(scale[0], scale[1], scale[2]);
      windowGroup.add(accent);
    });

    const orb = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.38, 3),
      new THREE.MeshPhysicalMaterial({
        color: '#dbeafe',
        emissive: '#60a5fa',
        emissiveIntensity: 0.35,
        metalness: 0.05,
        roughness: 0.08,
        transmission: 0.8,
        thickness: 0.7,
        transparent: true,
        opacity: 0.8,
      }),
    );
    orb.position.set(1.45, 0.65, 0.25);
    windowGroup.add(orb);

    const pointer = new THREE.Vector2();
    const targetRotation = new THREE.Vector2();

    const handlePointerMove = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      targetRotation.x = pointer.y * 0.08;
      targetRotation.y = pointer.x * 0.12;
    };

    const handleResize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    };

    container.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('resize', handleResize);

    let animationFrame = 0;
    const startTime = performance.now();

    const animate = (time: number) => {
      const elapsed = (time - startTime) / 1000;

      windowGroup.rotation.x +=
        (0.04 + targetRotation.x - windowGroup.rotation.x) * 0.035;
      windowGroup.rotation.y +=
        (-0.42 + targetRotation.y - windowGroup.rotation.y) * 0.035;
      windowGroup.position.y = Math.sin(elapsed * 0.8) * 0.04;

      orb.rotation.x = elapsed * 0.35;
      orb.rotation.y = elapsed * 0.5;
      orb.scale.setScalar(1 + Math.sin(elapsed * 1.8) * 0.04);

      blueLight.position.y = Math.sin(elapsed * 0.7) * 2;
      roseLight.position.y = Math.cos(elapsed * 0.6) * 2;

      camera.position.x += (pointer.x * 0.12 - camera.position.x) * 0.02;
      camera.position.y += (pointer.y * 0.08 - camera.position.y) * 0.02;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrame);
      container.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('resize', handleResize);
      windowPanel.geometry.dispose();
      frame.geometry.dispose();
      (frame.material as THREE.Material).dispose();
      glassMaterial.dispose();
      accentMaterial.dispose();
      orb.geometry.dispose();
      (orb.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <main
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background:
          'linear-gradient(135deg, #ffffff 0%, #f8fafc 45%, #e0f2fe 100%)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          display: 'grid',
          placeItems: 'center',
          pointerEvents: 'none',
          padding: '0 24px',
          textAlign: 'center',
        }}
      >
        <div>
          <p
            style={{
              margin: '0 0 12px',
              color: '#2563eb',
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '0.28em',
              textTransform: 'uppercase',
            }}
          >
            Agentic Orchestrator
          </p>
          <h1
            style={{
              margin: 0,
              color: '#0f172a',
              fontSize: 'clamp(2.2rem, 6vw, 5.4rem)',
              fontWeight: 800,
              letterSpacing: '-0.06em',
              textShadow: '0 8px 30px rgba(148, 163, 184, 0.35)',
            }}
          >
            Welcome to GeminiMCP
          </h1>
          <p
            style={{
              margin: '18px 0 0',
              color: '#475569',
              fontSize: 'clamp(0.9rem, 1.8vw, 1.1rem)',
            }}
          >
            Intelligent operations through Gemini and Model Context Protocol.
          </p>
        </div>
      </div>
    </main>
  );
}
