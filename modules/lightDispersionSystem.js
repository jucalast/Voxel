/**
 * Sistema de Dispersão e Suavização de Luz
 * Melhora o realismo da luz que entra pelas portas
 */

class LightDispersionSystem {
  constructor(scene, renderer, camera) {
    this.scene = scene;
    this.renderer = renderer;
    this.camera = camera;
    this.enabled = false; // Desabilitado para não animar partículas de poeira
    
    // Configurações de dispersão
    this.config = {
      blurRadius: 15,
      blurIterations: 3,
      softEdgeIntensity: 0.8,
      disperseDistance: 2.5,
      lightScattering: 0.6
    };
    
    this.init();
  }
  
  init() {
    console.log('🌟 Sistema de Dispersão de Luz inicializado');
    
    // Limpar qualquer partícula de poeira existente
    this.clearExistingDustParticles();
    
    // Expor controles globalmente
    window.lightDispersionControls = {
      setBlurRadius: (radius) => {
        this.config.blurRadius = Math.max(1, Math.min(30, radius));
        console.log(`🔄 Blur radius: ${this.config.blurRadius}`);
      },
      
      setDispersion: (intensity) => {
        this.config.disperseDistance = Math.max(0.5, Math.min(5, intensity));
        console.log(`💫 Dispersão: ${this.config.disperseDistance}`);
      },
      
      setSoftEdges: (intensity) => {
        this.config.softEdgeIntensity = Math.max(0, Math.min(1, intensity));
        console.log(`🌅 Bordas suaves: ${this.config.softEdgeIntensity}`);
      },
      
      toggle: () => {
        this.enabled = !this.enabled;
        console.log(`🎛️ Dispersão de luz: ${this.enabled ? 'ATIVADA' : 'DESATIVADA'}`);
      },
      
      // Presets
      realistic: () => {
        this.config.blurRadius = 25;
        this.config.disperseDistance = 3.2;
        this.config.softEdgeIntensity = 0.95;
        console.log('✨ Preset REALISTA aplicado - com dispersão no chão melhorada');
      },
      
      dramatic: () => {
        this.config.blurRadius = 8;
        this.config.disperseDistance = 1.5;
        this.config.softEdgeIntensity = 0.6;
        console.log('🎭 Preset DRAMÁTICO aplicado');
      },
      
      soft: () => {
        this.config.blurRadius = 35;
        this.config.disperseDistance = 4.2;
        this.config.softEdgeIntensity = 1.0;
        console.log('🌸 Preset SUAVE aplicado - máxima dispersão no chão');
      },
      
      // Novo preset específico para chão
      floorFocus: () => {
        this.config.blurRadius = 30;
        this.config.disperseDistance = 3.8;
        this.config.softEdgeIntensity = 0.85;
        console.log('🔥 Preset FOCO NO CHÃO aplicado - dispersão otimizada');
      }
    };

    // Debug helpers para inspecionar partículas de poeira via console
    window.particleDebugger = window.particleDebugger || {};

    // Lista todos os Points marcados como partículas de poeira na cena
    window.particleDebugger.listAllDustPoints = () => {
      const out = [];
      this.scene.traverse((o) => {
        if ((o.type === 'Points' || o.isPoints) && o.userData && o.userData.isDustParticles) {
          const geom = o.geometry;
          const count = (geom && geom.attributes && geom.attributes.position) ? geom.attributes.position.count : 0;
          const bbox = geom && geom.attributes && geom.attributes.position ? new THREE.Box3().setFromBufferAttribute(geom.attributes.position) : new THREE.Box3();
          out.push({
            uuid: o.uuid,
            userData: o.userData,
            count,
            bboxMin: bbox.min ? bbox.min.clone() : null,
            bboxMax: bbox.max ? bbox.max.clone() : null,
            material: {
              size: o.material ? o.material.size : undefined,
              opacity: o.material ? o.material.opacity : undefined,
              blending: o.material ? o.material.blending : undefined
            },
            object: o
          });
        }
      });
      console.log('Dust points found:', out.length, out);
      return out;
    };

    // Tenta encontrar o objeto de partículas associado a uma porta específica
    window.particleDebugger.findDoorDust = (doorId) => {
      const key = `doorDust:${doorId}`;
      const fromAtmos = window.atmosphereSystem && window.atmosphereSystem.atmosphericEffects ? window.atmosphereSystem.atmosphericEffects.get(key) : null;
      if (fromAtmos) {
        console.log(`Found door dust in atmosphereEffects for ${doorId}`, fromAtmos);
        return fromAtmos;
      }

      // Fallback: procurar Points próximos à porta (2 unidades)
      if (window.doorWindowSystem) {
        const doors = window.doorWindowSystem.getDoors ? window.doorWindowSystem.getDoors() : [];
        const doorObj = doors.find(d => d.id === doorId) || (window.doorWindowSystem.doors && window.doorWindowSystem.doors.get(doorId));
        if (doorObj) {
          const pos = doorObj.position ? new THREE.Vector3(doorObj.position.x, doorObj.position.y, doorObj.position.z) : (doorObj.group ? doorObj.group.getWorldPosition(new THREE.Vector3()) : null);
          if (pos) {
            let found = null;
            this.scene.traverse(o => {
              if (!found && o.userData && o.userData.isDustParticles) {
                const geom = o.geometry;
                const attr = geom && geom.attributes && geom.attributes.position;
                if (!attr) return;
                const box = new THREE.Box3().setFromBufferAttribute(attr);
                const center = box.getCenter(new THREE.Vector3());
                if (center.distanceTo(pos) <= 2.0) {
                  found = o;
                }
              }
            });
            if (found) {
              console.log(`Found dust Points near door ${doorId}`, found);
              return found;
            }
          }
        }
      }

      console.warn(`No dust Points found for door ${doorId}`);
      return null;
    };

    // Temporariamente destacar as partículas de uma porta (aumenta size/opacity por X ms)
    window.particleDebugger.highlightDoorDust = (doorId, duration = 4000) => {
      const pts = window.particleDebugger.findDoorDust(doorId);
      if (!pts) return false;
      const mat = pts.material || pts.material;
      if (!mat) return false;
      const original = { size: mat.size, opacity: mat.opacity, depthTest: mat.depthTest, blending: mat.blending };
      mat.size = Math.max(0.04, (mat.size || 0.02) * 3);
      mat.opacity = 1.0;
      mat.depthTest = false;
      mat.needsUpdate = true;
      console.log(`Highlighting door dust ${doorId} for ${duration}ms`, original);
      setTimeout(() => {
        mat.size = original.size;
        mat.opacity = original.opacity;
        mat.depthTest = original.depthTest;
        mat.blending = original.blending;
        mat.needsUpdate = true;
        console.log(`Restored material for door dust ${doorId}`);
      }, duration);
      return true;
    };

    // Forçar criação de partículas para uma porta específica (útil para debugging)
    window.particleDebugger.forceCreateDoorDust = (doorId, opts = {}) => {
      if (!window.doorWindowSystem) {
        console.warn('❌ doorWindowSystem não disponível');
        return null;
      }
      const doors = window.doorWindowSystem.getDoors ? window.doorWindowSystem.getDoors() : [];
      const doorObj = doors.find(d => d.id === doorId) || (window.doorWindowSystem.doors && window.doorWindowSystem.doors.get(doorId));
      if (!doorObj) {
        console.warn(`❌ Porta '${doorId}' não encontrada`);
        return null;
      }

      // Compute world position similar to AtmosphereSystem
      let doorPos = null;
      if (doorObj.group && typeof doorObj.group.getWorldPosition === 'function') {
        doorPos = doorObj.group.getWorldPosition(new THREE.Vector3());
      } else if (doorObj.position && typeof doorObj.position.x === 'number') {
        if (typeof doorObj.position.z === 'number') {
          doorPos = new THREE.Vector3(doorObj.position.x, doorObj.position.y, doorObj.position.z);
        } else if (window.doorWindowSystem && typeof window.doorWindowSystem.getWallPosition === 'function' && doorObj.wallName) {
          doorPos = window.doorWindowSystem.getWallPosition(doorObj.wallName, doorObj.position);
        }
      }

      if (!doorPos) {
        const stored = window.doorWindowSystem.doors && window.doorWindowSystem.doors.get(doorId);
        if (stored && stored.group && typeof stored.group.getWorldPosition === 'function') {
          doorPos = stored.group.getWorldPosition(new THREE.Vector3());
        }
      }

      if (!doorPos) {
        console.warn(`❌ Não foi possível calcular posição do feixe para porta ${doorId}`);
        return null;
      }

      // Compute a better light direction if possible from stored door entry
      let lightDir = new THREE.Vector3(0, -0.1, 1).normalize();
      try {
        const stored = window.doorWindowSystem.doors && window.doorWindowSystem.doors.get(doorId);
        if (stored && stored.lightSource) {
          const lg = stored.lightSource;
          const entryLight = (lg.userData && (lg.userData.entryLight || lg.userData.volumetricLight || lg.userData.sunLight));
          if (entryLight) {
            const lp = new THREE.Vector3();
            const tp = new THREE.Vector3();
            if (typeof entryLight.getWorldPosition === 'function') entryLight.getWorldPosition(lp); else lp.copy(entryLight.position || new THREE.Vector3());
            if (entryLight.target && typeof entryLight.target.getWorldPosition === 'function') entryLight.target.getWorldPosition(tp);
            else if (entryLight.target) tp.copy(entryLight.target.position || new THREE.Vector3());
            else tp.copy(lp).add(new THREE.Vector3(0, -0.1, 1));
            const dir = tp.clone().sub(lp);
            if (dir.lengthSq() > 0.000001) lightDir = dir.normalize();
          } else if (stored.wallName && window.doorWindowSystem.getWallNormal) {
            // Use wall normal if available (flip to point into room)
            try {
              const normal = window.doorWindowSystem.getWallNormal(stored.wallName);
              if (normal) lightDir = normal.clone().multiplyScalar(-1).normalize();
            } catch (e) {
              // ignore
            }
          }
        }
      } catch (e) {
        // ignore and use fallback
      }

      // Garantir que o animador global esteja ativo
      if (window.lightingSystem && !window.lightingSystem._dustAnimationStarted && typeof window.lightingSystem.animateDustParticles === 'function') {
        window.lightingSystem.animateDustParticles();
      }

      const particles = window.lightDispersionSystem.createDustParticles(doorPos, lightDir, Object.assign({}, opts, { force: true }));

      // Container for particles + optional debug visuals
      const container = new THREE.Group();

      if (particles) {
        container.add(particles);
      }

      // If requested or if particles failed to generate, create simple debug spheres along the beam
      if (opts.forceDebugVisual || !particles) {
        const debugCount = opts.debugCount || 8;
        const debugSize = typeof opts.debugSphereSize === 'number' ? opts.debugSphereSize : 0.06;
        const debugColor = opts.debugColor || 0xffcc66;
        const sphereGeom = new THREE.SphereGeometry(debugSize, 6, 6);
        const sphereMat = new THREE.MeshBasicMaterial({ color: debugColor });
        const dbgGroup = new THREE.Group();
        for (let i = 0; i < debugCount; i++) {
          const s = new THREE.Mesh(sphereGeom, sphereMat);
          const t = (i / Math.max(1, debugCount - 1)) * (opts.length || 8);
          s.position.copy(doorPos).add(lightDir.clone().multiplyScalar(0.2 + t));
          s.userData = s.userData || {};
          s.userData.isDustDebug = true;
          dbgGroup.add(s);
        }
        container.add(dbgGroup);
      }

      // Add container to scene and register for cleanup
      const sceneRef = (window.lightDispersionSystem && window.lightDispersionSystem.scene) || window.scene;
      if (sceneRef) sceneRef.add(container);

      if (window.atmosphereSystem && window.atmosphereSystem.atmosphericEffects) {
        window.atmosphereSystem.atmosphericEffects.set(`doorDust:${doorId}`, container);
        console.log(`✨ Partículas (ou debug visual) criadas e registradas para porta ${doorId}`);
      } else {
        console.log(`✨ Partículas criadas para porta ${doorId} (atmosphereSystem não disponível para registro)`);
      }

      return container;
    };

    // Auto-test: run a one-time sequence that lists doors, forces dust creation and highlights it
    // This will run automatically unless window.autoCreateDoorDustOnInit === false
    (function scheduleAutoDoorDustTest() {
      if (typeof window.autoCreateDoorDustOnInit !== 'undefined' && window.autoCreateDoorDustOnInit === false) {
        console.log('Auto door-dust test disabled via window.autoCreateDoorDustOnInit = false');
        return;
      }

      // Ensure we only run once
      if (window._lightDispersionAutoTestRan) return;
      window._lightDispersionAutoTestRan = false;

      const tryRun = (attempt = 0) => {
        const maxAttempts = 12;
        const delay = 300; // ms

        if (window._lightDispersionAutoTestRan) return;

        if (!window.doorWindowSystem || typeof window.doorWindowSystem.getDoors !== 'function') {
          if (attempt < maxAttempts) {
            setTimeout(() => tryRun(attempt + 1), delay);
            return;
          }
          console.warn('AutoTest: doorWindowSystem unavailable after retries; aborting auto door-dust test');
          window._lightDispersionAutoTestRan = true;
          return;
        }

        try {
          console.log('AutoTest: listing doors...');
          const doors = window.doorWindowSystem.getDoors();
          console.log('AutoTest: doors:', doors);

          // Prefer a door named 'porta-automatica' if present
          let testId = null;
          if (doors && doors.length > 0) {
            const found = doors.find(d => d.id === 'porta-automatica');
            testId = found ? found.id : doors[0].id;
          }

          if (!testId) {
            console.warn('AutoTest: no doors found to test door dust');
            window._lightDispersionAutoTestRan = true;
            return;
          }

          console.log(`AutoTest: selected door for test: '${testId}'`);

          // Force-create dust for the door (use higher density for visibility)
          console.log(`AutoTest: forcing door dust creation for '${testId}'`);
          const particles = window.particleDebugger.forceCreateDoorDust(testId, { particleCount: 420, size: 0.08, opacity: 0.95, forceDebugVisual: true });

          if (particles) {
            console.log('AutoTest: particles created', particles);
          } else {
            console.warn('AutoTest: failed to create particles for', testId);
          }

          // Inspect created dust
          console.log('AutoTest: listing all dust points after creation...');
          const all = window.particleDebugger.listAllDustPoints();
          console.log('AutoTest: dust points count:', all.length);

          // Highlight the door dust briefly
          console.log(`AutoTest: highlighting door dust for '${testId}'`);
          const highlighted = window.particleDebugger.highlightDoorDust(testId, 4000);
          console.log('AutoTest: highlight invoked:', !!highlighted);

        } catch (e) {
          console.error('AutoTest: unexpected error during auto door-dust test', e);
        } finally {
          window._lightDispersionAutoTestRan = true;
        }
      };

      // Start after short delay to allow other systems to initialize
      setTimeout(() => tryRun(0), 1200);
    })();
  }
  
  /**
   * Limpar partículas de poeira existentes na cena
   */
  clearExistingDustParticles() {
    const particlesToRemove = [];
    
    this.scene.traverse((object) => {
      if (object.userData && object.userData.isDustParticles) {
        particlesToRemove.push(object);
      }
    });
    
    particlesToRemove.forEach(particle => {
      if (particle.parent) {
        particle.parent.remove(particle);
      } else {
        this.scene.remove(particle);
      }
      
      // Limpar geometria e material para liberar memória
      if (particle.geometry) {
        particle.geometry.dispose();
      }
      if (particle.material) {
        particle.material.dispose();
      }
    });
    
    if (particlesToRemove.length > 0) {
      console.log(`🧹 Removidas ${particlesToRemove.length} partículas de poeira existentes`);
    }
  }
  
  /**
   * Aplicar dispersão em tempo real nas luzes da cena
   */
  applyDispersion() {
    if (!this.enabled) return;
    
    this.scene.traverse((object) => {
      if (object.isLight && object.userData.isNaturalLight) {
        this.enhanceLightDispersion(object);
      }
    });
  }
  
  /**
   * Melhorar dispersão de uma luz específica
   */
  enhanceLightDispersion(light) {
    if (light.isSpotLight) {
      // Aplicar penumbra dinâmica baseada na configuração
      light.penumbra = Math.min(0.95, this.config.softEdgeIntensity);
      
      // Ajustar o ângulo do cone para dispersão
      if (light.userData.originalAngle === undefined) {
        light.userData.originalAngle = light.angle;
      }
      
      const disperseFactor = 1 + (this.config.disperseDistance * 0.2);
      light.angle = Math.min(Math.PI / 2, light.userData.originalAngle * disperseFactor);
      
      // Melhorar configuração de sombras
      if (light.castShadow) {
        light.shadow.radius = this.config.blurRadius;
        light.shadow.blurSamples = Math.min(50, this.config.blurRadius * 2);
        
        // Ajustar bias dinamicamente
        light.shadow.bias = -0.0001 * (1 + this.config.softEdgeIntensity * 0.5);
      }
    }
    
    if (light.isPointLight && light.userData.isNaturalLight) {
      // Para point lights, ajustar o decay
      if (light.userData.originalDecay === undefined) {
        light.userData.originalDecay = light.decay;
      }
      
      const softDecay = light.userData.originalDecay * (0.5 + this.config.lightScattering * 0.5);
      light.decay = Math.max(0.5, softDecay);
    }
  }
  
  /**
   * Criar partículas de poeira para visualizar raios de luz
   */
  createDustParticles(doorPosition, lightDirection, options = {}) {
    // Beam-style particles along the light direction, with attributes for animation
    // options: { force: true, particleCount: N, size: float, opacity: float }
    const particleCount = options.particleCount || 300;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const tAttr = new Float32Array(particleCount);
    const angleAttr = new Float32Array(particleCount);
    const radialAttr = new Float32Array(particleCount);

    // (no global check here) - per-beam creation will honor localizedDust below or be forced

    // Guard: only create beam dust if localized dust is enabled — allow override via options.force
    const lightingCfg = window.lightingSystem && window.lightingSystem.config && window.lightingSystem.config.lighting && window.lightingSystem.config.lighting.atmosphere;
    if (!options.force && (!lightingCfg || !lightingCfg.localizedDust)) {
      console.log('⚪ Criação de partículas de poeira de feixe bloqueada por configuração (localizedDust=false)');
      return null;
    }

    const axis = lightDirection.clone().normalize();
    const length = options.length || 8; // comprimento do feixe
    const baseRadius = options.baseRadius || 1.5; // espalhamento máximo

    // Criar base ortonormal u/v
    const up = Math.abs(axis.y) < 0.999 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const u = axis.clone().cross(up).normalize();
    const v = axis.clone().cross(u).normalize();

    // Start a small bit inside the room to avoid clipping on the doorway plane
    const startPos = (doorPosition && axis) ? doorPosition.clone().add(axis.clone().multiplyScalar(0.2)) : doorPosition.clone();

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      const t = Math.random() * length;
      const angle = Math.random() * Math.PI * 2;
      const radialFactor = 0.2 + Math.random() * 0.8;

      const radiusAtT = (t / length) * baseRadius * radialFactor;

      const pos = startPos.clone()
        .add(axis.clone().multiplyScalar(t))
        .add(u.clone().multiplyScalar(Math.cos(angle) * radiusAtT))
        .add(v.clone().multiplyScalar(Math.sin(angle) * radiusAtT));

      positions[i3] = pos.x;
      positions[i3 + 1] = pos.y;
      positions[i3 + 2] = pos.z;

      tAttr[i] = t;
      angleAttr[i] = angle;
      radialAttr[i] = radialFactor;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('t', new THREE.BufferAttribute(tAttr, 1));
    geometry.setAttribute('angle', new THREE.BufferAttribute(angleAttr, 1));
    geometry.setAttribute('radialFactor', new THREE.BufferAttribute(radialAttr, 1));

    const material = new THREE.PointsMaterial({
      color: options.color || 0xFFFFFF,
      size: options.size || 0.06,
      sizeAttenuation: true,
      transparent: true,
      opacity: typeof options.opacity === 'number' ? options.opacity : 0.85,
      vertexColors: false,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    // Draw on top for visibility (can be tuned later)
    material.depthTest = false;

    const particles = new THREE.Points(geometry, material);
  particles.userData = particles.userData || {};
  particles.userData.isDustParticles = true;
  particles.userData.origin = [startPos.x, startPos.y, startPos.z];
  particles.userData.axis = [axis.x, axis.y, axis.z];
  particles.userData.length = length;
  particles.userData.baseRadius = baseRadius;
  particles.userData.speed = options.speed || 0.02;
  particles.userData.dustType = 'beam';
  // Store orthonormal basis to avoid recomputing per frame
  particles.userData.u = [u.x, u.y, u.z];
  particles.userData.v = [v.x, v.y, v.z];
  particles.userData.createdAt = Date.now();

    // Finalize geometry metadata
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    // Prevent frustum culling until size/tuning is finalized
    particles.frustumCulled = false;
    // Ensure animation loop is running
    if (window.lightingSystem && typeof window.lightingSystem.animateDustParticles === 'function' && !window.lightingSystem._dustAnimationStarted) {
      window.lightingSystem.animateDustParticles();
    }
    // Ensure particles rendered on top while tuning
    particles.renderOrder = 9999;

    // Adicionar diretamente à cena para conveniência do chamador
    this.scene.add(particles);
    return particles;
  }
  
  /**
   * Atualizar animação das partículas
   */
  animateParticles() {
    // Desabilitado: não animar partículas de poeira
    return;
    
    this.scene.traverse((object) => {
      if (object.userData.isDustParticles) {
        // Rotação lenta das partículas
        object.rotation.y += 0.001;
        
        // Movimento sutil up/down
        object.position.y += Math.sin(Date.now() * 0.001 + object.id) * 0.0005;
      }
    });
  }
  
  /**
   * Update loop principal
   */
  update() {
    if (!this.enabled) return;
    
    this.applyDispersion();
    this.animateParticles();
  }
}

// Função para inicializar o sistema
function initLightDispersionSystem(scene, renderer, camera) {
  if (window.lightDispersionSystem) {
    console.log('⚠️ Sistema de dispersão já inicializado');
    return window.lightDispersionSystem;
  }
  
  window.lightDispersionSystem = new LightDispersionSystem(scene, renderer, camera);
  
  // Auto-update
  const originalRender = renderer.render;
  renderer.render = function(scene, camera) {
    if (window.lightDispersionSystem) {
      window.lightDispersionSystem.update();
    }
    originalRender.call(this, scene, camera);
  };
  
  console.log('✨ Sistema de Dispersão de Luz ativo');
  console.log('🎛️ Controles disponíveis em: window.lightDispersionControls');
  
  return window.lightDispersionSystem;
}

// Exportar para uso em outros módulos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LightDispersionSystem, initLightDispersionSystem };
}

// Auto-inicializar se THREE.js estiver disponível
if (typeof THREE !== 'undefined' && window.scene && window.renderer && window.camera) {
  setTimeout(() => {
    initLightDispersionSystem(window.scene, window.renderer, window.camera);
  }, 1000);
}