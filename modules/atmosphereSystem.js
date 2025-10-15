// =====================================================================
// MÓDULO ATMOSPHERE SYSTEM
// =====================================================================
// Sistema avançado de ambientação e iluminação para o modo walk/room
// Cria uma atmosfera realista com gradiente de luz baseado em distância
// e visibilidade dinâmica dos objetos
//
// FUNCIONALIDADES:
// - Ambiente escuro realista por padrão
// - Gradiente de iluminação baseado na distância da fonte de luz
// - Efeito de falloff natural e suave
// - Visibilidade dinâmica de objetos baseada na proximidade da luz
// - Integração com sistema de portas/janelas existente
// - Fog volumétrico para maior realismo
//
// DEPENDÊNCIAS:
// - Three.js
// - DoorWindowSystem (para integração com luzes existentes)
// - WalkBuildModeSystem (para posição da câmera)
//
// =====================================================================

import { DynamicLightingSystem } from './dynamicLightingSystem.js';

export class AtmosphereSystem {
  constructor(scene, camera, doorWindowSystem = null, walkBuildSystem = null) {
    this.scene = scene;
    this.camera = camera;
    this.doorWindowSystem = doorWindowSystem;
    this.walkBuildSystem = walkBuildSystem;

    // Configurações de atmosfera
    this.config = {
      // Configurações de escuridão base
      ambience: {
        darkness: 0.02,        // Escuridão quase total (0.0 = preto total, 1.0 = luz total)
        baseAmbient: 0x1a1a25, // Cor ambiente um pouco mais clara
        baseIntensity: 0.15,   // Intensidade aumentada para iluminar melhor o chão
        shadowDarkness: 0.95   // Escuridão das sombras (0.0 = sem sombra, 1.0 = sombra total)
      },

      // Sistema de gradiente de luz
      lightGradient: {
        enabled: true,
        maxDistance: 25,       // Distância máxima onde a luz ainda tem efeito (aumentado)
        minDistance: 2,        // Distância mínima para máxima intensidade
        falloffPower: 3.0,     // Potência do falloff (mais dramático)
        baseMultiplier: 0.8,   // Multiplicador base da intensidade (reduzido)
        maxMultiplier: 12.0    // Multiplicador máximo quando muito próximo (muito aumentado)
      },

      // Visibilidade dinâmica de objetos
      dynamicVisibility: {
        enabled: true,
        fadeDistance: 18,      // Distância onde objetos começam a desaparecer (aumentado)
        invisibleDistance: 30, // Distância onde objetos ficam invisíveis (aumentado)
        fadeSmooth: 0.05,      // Suavidade da transição (mais suave)
        minOpacity: 0.05,      // Opacidade mínima (não completamente invisível)
        maxOpacity: 1.0        // Opacidade máxima
      },

      // Fog volumétrico
      volumetricFog: {
        enabled: true,
        color: 0x000308,       // Cor do fog (ainda mais escuro)
        near: 3,               // Início do fog
        far: 35,               // Fim do fog (mais distante)
        density: 0.06,         // Densidade do fog (reduzida para ver melhor o gradiente)
        heightFalloff: true    // Fog mais denso em baixo
      },

      // Efeitos de luz atmosférica
      lightEffects: {
        godrays: true,         // Raios de luz (god rays)
        lightShafts: true,     // Feixes de luz
        volumetricLighting: true, // Luz volumétrica
        particleDust: false    // Partículas de poeira (opcional)
      }
    };

    // Estado do sistema
    this.isActive = false;
    this.lightSources = [];
    this.trackedObjects = new Map(); // Objetos sendo rastreados para visibilidade
    this.atmosphericEffects = new Map();
    this.originalMaterials = new Map(); // Backup dos materiais originais
    
    // Elementos da atmosfera
    this.baseAmbientLight = null;
    this.floorHemisphereLight = null;
    this.volumetricFog = null;
    this.lightShafts = [];

    // Sistema de iluminação dinâmica
    this.dynamicLightingSystem = null;

    // Performance
    this.lastUpdate = 0;
    this.updateInterval = 16; // 60fps
    this.lastSceneObjectCount = 0; // Otimização para evitar recoleta desnecessária
    
    // Sistema de Atmosfera inicializado
  }

  /**
   * Ativar sistema de atmosfera
   */
  activate() {
    if (this.isActive) return;

    
    this.isActive = true;

    // 1. Configurar escuridão base
    this.setupDarkEnvironment();

    // 2. Configurar fog volumétrico
    this.setupVolumetricFog();

    // 3. Configurar gradiente de luz
    this.setupLightGradient();

    // 4. Configurar visibilidade dinâmica
    this.setupDynamicVisibility();

    // 5. Integrar com sistema de portas/janelas existente
    this.integrateWithDoorWindowSystem();

    // 6. Iniciar sistema de iluminação dinâmica
    this.initializeDynamicLighting();

    // 7. Iniciar loop de atualização
    this.startUpdateLoop();

  }

  /**
   * Desativar sistema de atmosfera
   */
  deactivate() {
    if (!this.isActive) return;


    this.isActive = false;

    // Restaurar ambiente normal
    this.restoreNormalEnvironment();

    // Desativar sistema de iluminação dinâmica
    if (this.dynamicLightingSystem) {
      this.dynamicLightingSystem.deactivate();
    }

    // Parar loop de atualização
    this.stopUpdateLoop();

  }

  /**
   * Configurar ambiente escuro base
   */
  setupDarkEnvironment() {
    // Ativar ambiente escuro no sistema de portas/janelas se disponível
    if (this.doorWindowSystem && this.doorWindowSystem.activateDarkEnvironment) {
      this.doorWindowSystem.activateDarkEnvironment();
    } else {
      // Fallback: remover luzes artificiais diretamente
      this.removeArtificialLights();
    }

    // Configurar luz ambiente mínima
    this.createBaseAmbientLight();

    // Configurar materiais para responder melhor à escuridão
    this.setupDarkMaterials();

    // Configurar renderer para contraste dramático
    this.setupDarkRenderer();

        // Configurar fog volumétrico para profundidade
  }

  /**
   * Remover luzes artificiais, mantendo apenas naturais
   */
  removeArtificialLights() {
    const lightsToRemove = [];
    
    this.scene.traverse((child) => {
      if (child.isLight && !child.userData.isNaturalLight && !child.userData.isMinimalAmbient) {
        lightsToRemove.push(child);
      }
    });

    lightsToRemove.forEach(light => {

      if (light.parent) {
        light.parent.remove(light);
      } else {
        this.scene.remove(light);
      }
    });

  }

  /**
   * Criar luz ambiente mínima
   */
  createBaseAmbientLight() {
    if (this.baseAmbientLight) {
      this.scene.remove(this.baseAmbientLight);
    }
    if (this.floorHemisphereLight) {
      this.scene.remove(this.floorHemisphereLight);
    }

    // Luz ambiente geral
    this.baseAmbientLight = new THREE.AmbientLight(
      this.config.ambience.baseAmbient,
      this.config.ambience.baseIntensity
    );
    this.baseAmbientLight.userData.isAtmosphericLight = true;
    this.baseAmbientLight.userData.isMinimalAmbient = true;
    this.scene.add(this.baseAmbientLight);

    // Luz hemisférica para iluminar melhor o chão
    this.floorHemisphereLight = new THREE.HemisphereLight(
      0x404040, // Cor do céu (cinza escuro)
      0x2a2a2a, // Cor do chão (cinza mais escuro)
      0.3       // Intensidade moderada
    );
    this.floorHemisphereLight.userData.isAtmosphericLight = true;
    this.floorHemisphereLight.userData.isFloorAmbient = true;
    this.scene.add(this.floorHemisphereLight);

  }

  /**
   * Configurar materiais para ambiente escuro
   */
  setupDarkMaterials() {
    let materialCount = 0;

    this.scene.traverse((child) => {
      if (child.isMesh && child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        
        materials.forEach(material => {
          // Pular se já processado nesta sessão ou se deve ser preservado
          if (material.userData && (material.userData.darkModeProcessed || material.userData.lightingPreserved)) {
            return;
          }
          
          // Backup do material original
          if (!this.originalMaterials.has(material.uuid)) {
            this.originalMaterials.set(material.uuid, {
              emissive: material.emissive ? material.emissive.clone() : null,
              emissiveIntensity: material.emissiveIntensity || 0,
              roughness: material.roughness,
              metalness: material.metalness
            });
          }

          // Configurar material para ambiente escuro
          if (material.emissive) {
            material.emissive.setHex(0x000000); // Sem emissão
            material.emissiveIntensity = 0;
          }

          // Tornar materiais mais responsivos à luz
          if (material.roughness !== undefined) {
            material.roughness = Math.max(material.roughness, 0.6);
          }
          if (material.metalness !== undefined) {
            material.metalness = Math.min(material.metalness, 0.2);
          }

          // Marcar como processado para evitar reprocessamento
          if (!material.userData) material.userData = {};
          material.userData.darkModeProcessed = true;

          materialCount++;
        });
      }
    });

    // Materiais configurados para ambiente escuro
  }

  /**
   * Configurar renderer para contraste dramático
   */
  setupDarkRenderer() {
    const renderer = this.getRenderer();
    if (!renderer) return;

    // Backup configurações originais
    if (!this.originalRendererSettings) {
      this.originalRendererSettings = {
        toneMappingExposure: renderer.toneMappingExposure,
        shadowMap: {
          enabled: renderer.shadowMap.enabled,
          type: renderer.shadowMap.type
        }
      };
    }

    // Configurar para ambiente escuro
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.2; // Exposição baixa para contraste dramático

  }

  /**
   * Configurar fog volumétrico
   */
  setupVolumetricFog() {
    if (!this.config.volumetricFog.enabled) return;

    // Fog exponential para maior realismo
    this.volumetricFog = new THREE.FogExp2(
      this.config.volumetricFog.color,
      this.config.volumetricFog.density
    );

    this.scene.fog = this.volumetricFog;

  }

  /**
   * Configurar gradiente de luz dinâmico
   */
  setupLightGradient() {
    if (!this.config.lightGradient.enabled) return;

    // Coletar todas as fontes de luz naturais
    this.collectLightSources();

        // Configurar visibilidade dinâmica
  }

  /**
   * Coletar fontes de luz naturais do sistema (sem duplicação)
   */
  collectLightSources() {
    this.lightSources = [];
    
    // Usar apenas o sistema de portas/janelas se disponível (mais eficiente)
    if (this.doorWindowSystem && this.doorWindowSystem.lightSources) {
      this.doorWindowSystem.lightSources.forEach((lightGroup) => {
        // Coletar luzes de portas e janelas (sistema unificado)
        if (lightGroup.userData.sunLight) {
          this.lightSources.push(lightGroup.userData.sunLight);
        }
        if (lightGroup.userData.windowLight) {
          this.lightSources.push(lightGroup.userData.windowLight);
        }
        // Manter compatibilidade com sistema antigo
        if (lightGroup.userData.entryLight) {
          this.lightSources.push(lightGroup.userData.entryLight);
        }
      });
    } else {
      // Fallback: traverse apenas se não houver sistema de portas/janelas
      this.scene.traverse((child) => {
        if (child.isLight && child.userData.isNaturalLight) {
          this.lightSources.push(child);
        }
      });
    }

  }

  /**
   * Configurar visibilidade dinâmica
   */
  setupDynamicVisibility() {
    if (!this.config.dynamicVisibility.enabled) return;

    // Coletar todos os objetos que devem ter visibilidade dinâmica
    this.collectTrackedObjects();

  }

  /**
   * Coletar objetos para rastreamento de visibilidade (otimizado)
   */
  collectTrackedObjects() {
    // Se já coletamos objetos e o tamanho não mudou muito, não recoletar
    const currentSceneObjects = this.countSceneObjects();
    if (this.trackedObjects.size > 0 && 
        Math.abs(currentSceneObjects - this.lastSceneObjectCount) < 3) {
      return;
    }
    
    this.trackedObjects.clear();
    let objectCount = 0;

    this.scene.traverse((child) => {
      // Filtrar apenas objetos relevantes e evitar duplicatas
      if (child.isMesh && 
          !child.userData.isLight && 
          !child.userData.isAtmosphericEffect &&
          !child.userData.isWindow &&
          !child.userData.isDoor &&
          !child.userData.excludeFromAtmosphere &&
          !child.userData.isRotatedComponent && // Excluir componentes rotacionados das paredes laterais
          child.visible &&
          child.parent &&
          child.geometry) { // Garantir que tem geometria válida
        
        // Backup da opacidade original
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        const originalOpacities = materials.map(mat => mat.opacity !== undefined ? mat.opacity : 1.0);
        
        this.trackedObjects.set(child, {
          originalOpacities: originalOpacities,
          currentOpacity: 1.0,
          distance: 0
        });
        objectCount++;
      }
    });
    
    this.lastSceneObjectCount = currentSceneObjects;
  }

  /**
   * Contar objetos na cena de forma eficiente
   */
  countSceneObjects() {
    let count = 0;
    this.scene.traverse(() => count++);
    return count;
  }

  /**
   * Inicializar sistema de iluminação dinâmica
   */
  initializeDynamicLighting() {
    try {
      this.dynamicLightingSystem = new DynamicLightingSystem(
        this.scene,
        this,
        this.doorWindowSystem
      );
      
      this.dynamicLightingSystem.activate();
    } catch (error) {
      console.warn('⚠️ Erro ao inicializar sistema de iluminação dinâmica:', error);
    }
  }

  /**
   * Integrar com sistema de portas/janelas existente
   */
  integrateWithDoorWindowSystem() {
    if (!this.doorWindowSystem) return;

    // Sobrescrever atualização de iluminação das portas para incluir gradiente
    const originalUpdateDoorLighting = this.doorWindowSystem.updateDoorLighting.bind(this.doorWindowSystem);
    this.doorWindowSystem.updateDoorLighting = (doorId, isOpen) => {
      originalUpdateDoorLighting(doorId, isOpen);
      
      if (isOpen) {
        console.log(`🚪 Porta ${doorId} aberta — solicitando criação automática de partículas localizadas`);
        this.collectLightSources(); // Re-coletar fontes de luz
        this.enhanceLightSource(doorId, 'door');
        
        // Atualizar sistema de iluminação dinâmica
        if (this.dynamicLightingSystem) {
          this.dynamicLightingSystem.refreshLightSources();
        }
      } else {
        // Porta fechada: remover partículas locais relacionadas a esta porta
        const key = `doorDust:${doorId}`;
        const existing = this.atmosphericEffects.get(key);
        if (existing) {
          if (existing.parent) existing.parent.remove(existing);
          else this.scene.remove(existing);

          // Dispose any child geometries/materials if this is a Group
          if (existing && typeof existing.traverse === 'function') {
            existing.traverse((child) => {
              try {
                if (child.geometry && typeof child.geometry.dispose === 'function') child.geometry.dispose();
                if (child.material) {
                  if (Array.isArray(child.material)) {
                    child.material.forEach(m => { if (m && typeof m.dispose === 'function') m.dispose(); });
                  } else if (child.material && typeof child.material.dispose === 'function') {
                    child.material.dispose();
                  }
                }
              } catch (e) {
                // ignore disposal errors but log occasionally
                if (Math.random() < 0.01) console.warn('⚠️ Erro ao tentar disposar child:', e);
              }
            });
          } else {
            if (existing.geometry && typeof existing.geometry.dispose === 'function') existing.geometry.dispose();
            if (existing.material && typeof existing.material.dispose === 'function') existing.material.dispose();
          }

          this.atmosphericEffects.delete(key);
          console.log(`🧹 Partículas locais removidas para porta ${doorId}`);
        }
      }
    };

    // MONKEYPATCH toggleDoor to ensure dust creation occurs reliably when doors open
    try {
      const originalToggleDoor = this.doorWindowSystem.toggleDoor.bind(this.doorWindowSystem);
      this.doorWindowSystem.toggleDoor = (doorId) => {
        const result = originalToggleDoor(doorId);
        try {
          // If door is now open, try to create dust shortly after (allow light updates to settle)
          const doorEntry = this.doorWindowSystem.doors && this.doorWindowSystem.doors.get(doorId);
          const isOpen = doorEntry ? !!doorEntry.isOpen : false;
          if (isOpen) {
            console.log(`🔁 toggleDoor wrapper: detected open for ${doorId}, scheduling dust creation`);

            // Remove any existing dust for this door first
            const key = `doorDust:${doorId}`;
            const existing = this.atmosphericEffects.get(key);
            if (existing) {
              if (existing.parent) existing.parent.remove(existing); else this.scene.remove(existing);
              // Dispose children
              if (existing && typeof existing.traverse === 'function') {
                existing.traverse((child) => {
                  if (child.geometry && typeof child.geometry.dispose === 'function') child.geometry.dispose();
                  if (child.material) {
                    if (Array.isArray(child.material)) child.material.forEach(m=>m.dispose && m.dispose());
                    else if (child.material.dispose) child.material.dispose();
                  }
                });
              }
              this.atmosphericEffects.delete(key);
            }

            setTimeout(() => {
              try {
                if (window.particleDebugger && typeof window.particleDebugger.forceCreateDoorDust === 'function') {
                  window.particleDebugger.forceCreateDoorDust(doorId, { forceDebugVisual: true, debugCount: 10, debugSphereSize: 0.14 });
                } else if (window.lightDispersionSystem && typeof window.lightDispersionSystem.createDustParticles === 'function') {
                  const doorPos = doorEntry && doorEntry.group ? doorEntry.group.getWorldPosition(new THREE.Vector3()) : (doorEntry && doorEntry.position ? new THREE.Vector3(doorEntry.position.x, doorEntry.position.y, doorEntry.position.z) : null);
                  if (doorPos) {
                    const created = window.lightDispersionSystem.createDustParticles(doorPos, new THREE.Vector3(0, -0.1, 1).normalize(), { force: true, particleCount: 420, size: 0.08, opacity: 0.95 });
                    if (created) {
                      const group = new THREE.Group();
                      group.add(created);
                      this.scene.add(group);
                      this.atmosphericEffects.set(key, group);
                    }
                  }
                }
              } catch (e) {
                console.warn('⚠️ Erro no wrapper de toggleDoor ao criar poeira:', e);
              }
            }, 60);
          }
        } catch (e) {
          console.warn('⚠️ Erro no wrapper de toggleDoor:', e);
        }
        return result;
      };
    } catch (e) {
      console.warn('⚠️ Não foi possível monkeypatch toggleDoor:', e);
    }

    // Sobrescrever atualização de iluminação das janelas
    const originalUpdateWindowLighting = this.doorWindowSystem.updateWindowLighting.bind(this.doorWindowSystem);
    this.doorWindowSystem.updateWindowLighting = (windowId, isOpen) => {
      originalUpdateWindowLighting(windowId, isOpen);
      
      if (isOpen) {
        this.collectLightSources(); // Re-coletar fontes de luz
        this.enhanceLightSource(windowId, 'window');
        
        // Atualizar sistema de iluminação dinâmica
        if (this.dynamicLightingSystem) {
          this.dynamicLightingSystem.refreshLightSources();
        }
      }
    };

  }

  /**
   * Melhorar fonte de luz específica
   */
  enhanceLightSource(id, type) {
    // Criar efeitos atmosféricos para a fonte de luz
    this.createLightShafts(id, type);
    this.createVolumetricLighting(id, type);
    
    // Criar partículas localizadas se for porta e se o sistema de dispersão estiver disponível
    if (type === 'door' && this.doorWindowSystem && typeof window !== 'undefined') {
      try {
        const doors = this.doorWindowSystem.getDoors ? this.doorWindowSystem.getDoors() : [];
        const doorObj = doors.find(d => d.id === id) || this.doorWindowSystem.doors.get(id);
        if (doorObj) {
          let doorPos = null;

          // Preferir obter posição real via group (contém world transform)
          if (doorObj.group && typeof doorObj.group.getWorldPosition === 'function') {
            doorPos = doorObj.group.getWorldPosition(new THREE.Vector3());
          } else if (doorObj.position && typeof doorObj.position.x === 'number' && typeof doorObj.position.y === 'number') {
            // If a z coordinate is present, use it; otherwise try to resolve via doorWindowSystem helper
            if (typeof doorObj.position.z === 'number') {
              doorPos = new THREE.Vector3(doorObj.position.x, doorObj.position.y, doorObj.position.z);
            } else if (this.doorWindowSystem && typeof this.doorWindowSystem.getWallPosition === 'function' && doorObj.wallName) {
              // Compute world position from wallName + relative position
              doorPos = this.doorWindowSystem.getWallPosition(doorObj.wallName, doorObj.position);
            } else {
              // Fallback: if the stored Map has a richer object, use it
              const stored = this.doorWindowSystem && this.doorWindowSystem.doors ? this.doorWindowSystem.doors.get(id) : null;
              if (stored && stored.group && typeof stored.group.getWorldPosition === 'function') {
                doorPos = stored.group.getWorldPosition(new THREE.Vector3());
              }
            }
          }

          // Final fallback: try to compute from stored door entry
          if (!doorPos && this.doorWindowSystem && this.doorWindowSystem.doors) {
            const stored = this.doorWindowSystem.doors.get(id);
            if (stored && stored.group && typeof stored.group.getWorldPosition === 'function') {
              doorPos = stored.group.getWorldPosition(new THREE.Vector3());
            }
          }

          const lightDir = new THREE.Vector3(0, -0.1, 1).normalize();

          if (!doorPos) {
            console.warn(`⚠️ Não foi possível calcular posição da porta ${id} para criar partículas de poeira`);
          } else {
            // Verificar configuração global/local antes de tentar criar partículas
            const lightingCfg = window.lightingSystem && window.lightingSystem.config && window.lightingSystem.config.lighting && window.lightingSystem.config.lighting.atmosphere;
            if (!lightingCfg || !lightingCfg.localizedDust) {
              console.log(`⚪ Não serão criadas partículas localizadas para porta ${id} — desativadas pela configuração (localizedDust=false)`);
            } else if (window.lightDispersionSystem && typeof window.lightDispersionSystem.createDustParticles === 'function') {
              try {
                console.log(`🧭 Solicitando criação de partículas locais (forçado) para porta ${id} em`, doorPos);
                // Prefer using particleDebugger.forceCreateDoorDust if available so we always get a container
                let container = null;
                if (window.particleDebugger && typeof window.particleDebugger.forceCreateDoorDust === 'function') {
                  container = window.particleDebugger.forceCreateDoorDust(id, { particleCount: 400, size: 0.07, opacity: 0.95, forceDebugVisual: true });
                } else {
                  const particles = window.lightDispersionSystem.createDustParticles(doorPos, lightDir, { force: true, particleCount: 400, size: 0.07, opacity: 0.95 });
                  if (particles) {
                    container = new THREE.Group();
                    container.add(particles);
                    this.scene.add(container);
                  }
                }

                if (container) {
                  this.atmosphericEffects.set(`doorDust:${id}`, container);
                  console.log(`✨ Partículas ou debug visual criados para porta ${id}`);
                } else {
                  console.warn(`⚠️ Falha ao criar partículas para porta ${id}`);
                }
              } catch (e) {
                console.warn('⚠️ Erro ao invocar createDustParticles/forceCreateDoorDust:', e);
              }
            }
          }
        }
      } catch (e) {
        console.warn('⚠️ Falha ao criar partículas locais para porta:', e);
      }
    }
  }

  /**
   * Criar feixes de luz (light shafts)
   */
  createLightShafts(id, type) {
    if (!this.config.lightEffects.lightShafts) return;

    // Implementação de light shafts será adicionada se necessário
  }

  /**
   * Criar iluminação volumétrica
   */
  createVolumetricLighting(id, type) {
    if (!this.config.lightEffects.volumetricLighting) return;

    // Implementação de iluminação volumétrica será adicionada se necessário
  }

  /**
   * Iniciar loop de atualização
   */
  startUpdateLoop() {
    if (this.updateLoopId) return;

    const update = () => {
      if (!this.isActive) return;

      const now = performance.now();
      if (now - this.lastUpdate >= this.updateInterval) {
        this.update();
        this.lastUpdate = now;
      }

      this.updateLoopId = requestAnimationFrame(update);
    };

    update();
  }

  /**
   * Parar loop de atualização
   */
  stopUpdateLoop() {
    if (this.updateLoopId) {
      cancelAnimationFrame(this.updateLoopId);
      this.updateLoopId = null;
    }
  }

  /**
   * Atualização principal do sistema
   */
  update() {
    if (!this.isActive) return;

    // Atualizar gradiente de luz
    this.updateLightGradient();

    // Atualizar visibilidade dinâmica
    this.updateDynamicVisibility();

    // Atualizar efeitos atmosféricos
    this.updateAtmosphericEffects();
  }

  /**
   * Atualizar gradiente de luz baseado na posição da câmera
   */
  updateLightGradient() {
    if (!this.config.lightGradient.enabled || this.lightSources.length === 0) return;

    const cameraPosition = this.getCameraPosition();
    if (!cameraPosition) return;

    // Encontrar a fonte de luz mais próxima
    let closestDistance = Infinity;
    let closestLight = null;

    this.lightSources.forEach(light => {
      if (light.intensity > 0) {
        const distance = cameraPosition.distanceTo(light.position);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestLight = light;
        }
      }
    });

    if (closestLight) {
      this.applyLightGradient(cameraPosition, closestLight, closestDistance);
    }
  }

  /**
   * Aplicar gradiente de luz baseado na distância
   */
  applyLightGradient(cameraPosition, light, distance) {
    const config = this.config.lightGradient;
    
    // Calcular fator de intensidade baseado na distância
    let intensityFactor = 1.0;
    
    if (distance > config.minDistance) {
      const normalizedDistance = Math.min(
        (distance - config.minDistance) / (config.maxDistance - config.minDistance),
        1.0
      );
      
      // Aplicar curva de falloff
      intensityFactor = Math.pow(1.0 - normalizedDistance, config.falloffPower);
    }

    // Aplicar multiplicador baseado na proximidade
    const proximityMultiplier = config.baseMultiplier + 
      (config.maxMultiplier - config.baseMultiplier) * (1.0 - intensityFactor);

    // Atualizar luz ambiente baseada na proximidade
    if (this.baseAmbientLight) {
      const targetIntensity = this.config.ambience.baseIntensity * proximityMultiplier;
      this.baseAmbientLight.intensity = THREE.MathUtils.lerp(
        this.baseAmbientLight.intensity,
        targetIntensity,
        0.05 // Suavidade da transição
      );
    }

    // Debug (ocasional)
    if (Math.random() < 0.001) {
    }
  }

  /**
   * Atualizar visibilidade dinâmica dos objetos
   */
  updateDynamicVisibility() {
    if (!this.config.dynamicVisibility.enabled || this.trackedObjects.size === 0) return;

    const cameraPosition = this.getCameraPosition();
    if (!cameraPosition) return;

    this.trackedObjects.forEach((data, object) => {
      if (!object.visible || !object.parent) return;

      // Calcular distância da câmera ao objeto
      const distance = cameraPosition.distanceTo(object.position);
      data.distance = distance;

      // Calcular opacidade baseada na distância
      const config = this.config.dynamicVisibility;
      let opacity = config.maxOpacity;

      if (distance > config.fadeDistance) {
        const fadeRange = config.invisibleDistance - config.fadeDistance;
        const fadeProgress = (distance - config.fadeDistance) / fadeRange;
        opacity = THREE.MathUtils.lerp(config.maxOpacity, config.minOpacity, fadeProgress);
      }

      // Aplicar opacidade suavemente
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material, index) => {
        if (material.transparent !== undefined) {
          material.transparent = opacity < 1.0;
          const targetOpacity = data.originalOpacities[index] * opacity;
          material.opacity = THREE.MathUtils.lerp(material.opacity, targetOpacity, config.fadeSmooth);
        }
      });

      data.currentOpacity = opacity;
    });
  }

  /**
   * Atualizar efeitos atmosféricos
   */
  updateAtmosphericEffects() {
    // Atualizar fog baseado na iluminação atual
    this.updateVolumetricFog();
  }

  /**
   * Atualizar fog volumétrico baseado na iluminação
   */
  updateVolumetricFog() {
    if (!this.volumetricFog) return;

    // Ajustar densidade do fog baseado na quantidade de luz disponível
    const lightIntensity = this.calculateCurrentLightIntensity();
    const targetDensity = this.config.volumetricFog.density * (1.0 - lightIntensity * 0.3);
    
    this.volumetricFog.density = THREE.MathUtils.lerp(
      this.volumetricFog.density,
      targetDensity,
      0.02
    );
  }

  /**
   * Calcular intensidade de luz atual
   */
  calculateCurrentLightIntensity() {
    let totalIntensity = 0;
    let activeLight = 0;

    this.lightSources.forEach(light => {
      if (light.intensity > 0) {
        totalIntensity += light.intensity;
        activeLight++;
      }
    });

    return activeLight > 0 ? totalIntensity / activeLight : 0;
  }

  /**
   * Obter posição da câmera (walk mode ou câmera normal)
   */
  getCameraPosition() {
    if (this.walkBuildSystem && this.walkBuildSystem.isActive && this.walkBuildSystem.walkCamera) {
      return this.walkBuildSystem.walkCamera.position;
    }
    return this.camera.position;
  }

  /**
   * Obter renderer da cena
   */
  getRenderer() {
    // Tentar várias formas de obter o renderer
    if (this.scene.userData.renderer) {
      return this.scene.userData.renderer;
    }
    if (window.renderer) {
      return window.renderer;
    }
    if (window.scene && window.scene.userData.renderer) {
      return window.scene.userData.renderer;
    }
    return null;
  }

  /**
   * Restaurar ambiente normal
   */
  restoreNormalEnvironment() {
    // Desativar ambiente escuro no sistema de portas/janelas se disponível
    if (this.doorWindowSystem && this.doorWindowSystem.deactivateDarkEnvironment) {
      this.doorWindowSystem.deactivateDarkEnvironment();
    }

    // Restaurar materiais originais
    this.restoreOriginalMaterials();

    // Restaurar configurações do renderer
    this.restoreRendererSettings();

    // Remover fog
    this.scene.fog = null;

    // Remover luz ambiente atmosférica
    if (this.baseAmbientLight) {
      this.scene.remove(this.baseAmbientLight);
      this.baseAmbientLight = null;
    }

    // Limpar efeitos atmosféricos
    this.clearAtmosphericEffects();

  }

  /**
   * Restaurar materiais originais
   */
  restoreOriginalMaterials() {
    let restoredCount = 0;

    this.scene.traverse((child) => {
      if (child.isMesh && child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        
        materials.forEach(material => {
          const original = this.originalMaterials.get(material.uuid);
          if (original) {
            if (material.emissive && original.emissive) {
              material.emissive.copy(original.emissive);
            }
            if (original.emissiveIntensity !== undefined) {
              material.emissiveIntensity = original.emissiveIntensity;
            }
            if (original.roughness !== undefined) {
              material.roughness = original.roughness;
            }
            if (original.metalness !== undefined) {
              material.metalness = original.metalness;
            }
            
            // Limpar flag de processamento
            if (material.userData && material.userData.darkModeProcessed) {
              delete material.userData.darkModeProcessed;
            }
            
            restoredCount++;
          }
        });
      }
    });

    this.originalMaterials.clear();
  }

  /**
   * Restaurar configurações do renderer
   */
  restoreRendererSettings() {
    const renderer = this.getRenderer();
    if (!renderer || !this.originalRendererSettings) return;

    renderer.toneMappingExposure = this.originalRendererSettings.toneMappingExposure;
    renderer.shadowMap.enabled = this.originalRendererSettings.shadowMap.enabled;
    renderer.shadowMap.type = this.originalRendererSettings.shadowMap.type;

    this.originalRendererSettings = null;
  }

  /**
   * Limpar efeitos atmosféricos
   */
  clearAtmosphericEffects() {
    this.atmosphericEffects.forEach((effect, key) => {
      if (effect.parent) {
        effect.parent.remove(effect);
      } else {
        this.scene.remove(effect);
      }
    });
    
    this.atmosphericEffects.clear();
    this.lightShafts = [];
  }

  /**
   * Configurações em tempo real
   */
  setDarkness(level) {
    this.config.ambience.darkness = THREE.MathUtils.clamp(level, 0, 1);
    this.config.ambience.baseIntensity = 0.05 * (1 - level);
    
    if (this.baseAmbientLight) {
      this.baseAmbientLight.intensity = this.config.ambience.baseIntensity;
    }
    
  }

  setFogDensity(density) {
    this.config.volumetricFog.density = THREE.MathUtils.clamp(density, 0, 0.2);
    
    if (this.volumetricFog) {
      this.volumetricFog.density = this.config.volumetricFog.density;
    }
    
  }

  /**
   * Debug e informações
   */
  getDebugInfo() {
    return {
      isActive: this.isActive,
      lightSources: this.lightSources.length,
      trackedObjects: this.trackedObjects.size,
      currentLightIntensity: this.calculateCurrentLightIntensity(),
      cameraPosition: this.getCameraPosition(),
      baseAmbientIntensity: this.baseAmbientLight ? this.baseAmbientLight.intensity : 0
    };
  }

  /**
   * Destruir sistema
   */
  dispose() {
    this.deactivate();
    
    if (this.dynamicLightingSystem) {
      this.dynamicLightingSystem.dispose();
      this.dynamicLightingSystem = null;
    }
    
    this.originalMaterials.clear();
    this.trackedObjects.clear();
    this.lightSources = [];
    
  }
}

// Exposição global para debug
window.AtmosphereSystem = AtmosphereSystem;
