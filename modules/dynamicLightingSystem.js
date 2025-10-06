// =====================================================================
// MÓDULO DYNAMIC LIGHTING SYSTEM
// =====================================================================
// Sistema complementar de iluminação dinâmica que funciona junto com 
// o AtmosphereSystem para criar efeitos de visibilidade baseados na
// proximidade das fontes de luz
//
// FUNCIONALIDADES:
// - Ajuste automático da intensidade dos materiais baseado na distância da luz
// - Sistema de "reveal" gradual de objetos conforme se aproxima da luz
// - Efeito de brilho sutil em objetos próximos à luz
// - Integração perfeita com o sistema de atmosfera existente
//
// =====================================================================

export class DynamicLightingSystem {
  constructor(scene, atmosphereSystem, doorWindowSystem) {
    this.scene = scene;
    this.atmosphereSystem = atmosphereSystem;
    this.doorWindowSystem = doorWindowSystem;

    // Configurações do sistema
    this.config = {
      // Distâncias de efeito realistas baseadas na visão humana
      proximityDistance: 8,      // Distância onde há luz suficiente para ver bem
      maxEffectDistance: 20,     // Distância máxima onde ainda há alguma luz
      
      // Sistema de visibilidade realista
      visibility: {
        // Níveis de luz para visibilidade
        fullVisibilityLight: 0.8,    // Luz necessária para 100% de visibilidade
        partialVisibilityLight: 0.4, // Luz mínima para ver parcialmente
        minVisibilityLight: 0.1,     // Luz mínima para ver contornos
        
        // Opacidades baseadas na luz disponível
        fullVisibilityOpacity: 1.0,     // Opacidade total com luz suficiente
        partialVisibilityOpacity: 0.6,  // Opacidade parcial com pouca luz
        minVisibilityOpacity: 0.15,     // Opacidade mínima (só contornos)
        invisibleOpacity: 0.0,          // Completamente invisível sem luz
        
        // Distâncias de visibilidade baseadas na luz
        maxViewDistance: 15,        // Distância máxima para ver com luz total
        partialViewDistance: 8,     // Distância para ver com pouca luz
        minViewDistance: 3,         // Distância mínima para ver contornos
      },
      
      // Suavidade das transições (muito suave para realismo)
      transitionSpeed: 0.02,     // Transição muito lenta para simular adaptação dos olhos
      
      // Cores de efeito
      proximityColor: 0xFFFAE6,  // Cor do efeito de proximidade (quente)
      distantColor: 0x000000,    // Cor quando distante (frio/escuro)
      
      // Atualização
      updateInterval: 33,        // 30fps para suavidade
      
      // Filtros de objetos
      affectVoxels: true,        // Afetar voxels do editor
      affectRoomObjects: true,   // Afetar objetos da sala
      affectWalls: false         // Não afetar paredes (elas já tem iluminação própria)
    };

    // Estado do sistema
    this.isActive = false;
    this.trackedObjects = new Map(); // Objetos sendo rastreados
    this.lastUpdate = 0;
    this.updateLoopId = null;
    
    // Cache para performance
    this.lightSources = [];
    this.cameraPosition = new THREE.Vector3();

  }

  /**
   * Ativar sistema
   */
  activate() {
    if (this.isActive) return;


    this.isActive = true;

    // Coletar objetos para rastreamento
    this.collectTrackedObjects();

    // Coletar fontes de luz
    this.collectLightSources();

    // Iniciar loop de atualização
    this.startUpdateLoop();

  }

  /**
   * Desativar sistema
   */
  deactivate() {
    if (!this.isActive) return;


    this.isActive = false;

    // Parar loop de atualização
    this.stopUpdateLoop();

    // Restaurar objetos ao estado original
    this.restoreAllObjects();

  }

  /**
   * Coletar objetos para rastreamento
   */
  collectTrackedObjects() {
    this.trackedObjects.clear();

    this.scene.traverse((child) => {
      if (this.shouldTrackObject(child)) {
        this.addObjectToTracking(child);
      }
    });

  }

  /**
   * Verificar se um objeto deve ser rastreado
   */
  shouldTrackObject(object) {
    if (!object.isMesh || !object.visible || !object.material) {
      return false;
    }

    // Ignorar luzes e efeitos atmosféricos
    if (object.userData.isLight || object.userData.isAtmosphericEffect) {
      return false;
    }

    // Filtrar por tipo de objeto
    const isVoxel = object.userData.isVoxel || object.parent?.userData?.isVoxel;
    const isRoomObject = object.parent?.userData?.isRoomObject || 
                        this.isPartOfRoomObject(object);
    const isWall = object.userData.isWall || 
                   object.userData.wallName || 
                   object.name?.includes('wall');

    // Aplicar filtros de configuração
    if (isVoxel && !this.config.affectVoxels) return false;
    if (isRoomObject && !this.config.affectRoomObjects) return false;
    if (isWall && !this.config.affectWalls) return false;

    return true;
  }

  /**
   * Verificar se objeto faz parte de um objeto da sala
   */
  isPartOfRoomObject(object) {
    let parent = object.parent;
    while (parent) {
      if (parent.userData?.isRoomObject || parent.userData?.roomObjectId) {
        return true;
      }
      parent = parent.parent;
    }
    return false;
  }

  /**
   * Adicionar objeto ao rastreamento
   */
  addObjectToTracking(object) {
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    
    // Backup do estado original
    const originalState = {
      materials: materials.map(material => ({
        emissive: material.emissive ? material.emissive.clone() : new THREE.Color(0x000000),
        emissiveIntensity: material.emissiveIntensity || 0,
        color: material.color ? material.color.clone() : new THREE.Color(0xffffff)
      })),
      currentLightLevel: 0,    // 0 = sem luz, 1 = luz total
      targetLightLevel: 0,     // Nível de luz alvo
      currentVisibility: 0,    // 0 = invisível, 1 = totalmente visível
      targetVisibility: 0,     // Visibilidade alvo
      distanceFromCamera: 0    // Distância atual da câmera
    };

    this.trackedObjects.set(object, originalState);
  }

  /**
   * Coletar fontes de luz ativas
   */
  collectLightSources() {
    this.lightSources = [];

    // Coletar luzes naturais do sistema de portas/janelas
    if (this.doorWindowSystem && this.doorWindowSystem.lightSources) {
      this.doorWindowSystem.lightSources.forEach((lightGroup) => {
        // Adicionar apenas luzes que estão ativas (intensidade > 0)
        if (lightGroup.userData.sunLight && lightGroup.userData.sunLight.intensity > 0) {
          this.lightSources.push(lightGroup.userData.sunLight);
        }
        if (lightGroup.userData.entryLight && lightGroup.userData.entryLight.intensity > 0) {
          this.lightSources.push(lightGroup.userData.entryLight);
        }
        if (lightGroup.userData.doorAmbient && lightGroup.userData.doorAmbient.intensity > 0) {
          this.lightSources.push(lightGroup.userData.doorAmbient);
        }
        if (lightGroup.userData.windowAmbient && lightGroup.userData.windowAmbient.intensity > 0) {
          this.lightSources.push(lightGroup.userData.windowAmbient);
        }
      });
    }

    // Coletar outras luzes naturais da cena
    this.scene.traverse((child) => {
      if (child.isLight && 
          child.userData.isNaturalLight && 
          child.intensity > 0 &&
          !this.lightSources.includes(child)) {
        this.lightSources.push(child);
      }
    });

  }

  /**
   * Iniciar loop de atualização
   */
  startUpdateLoop() {
    if (this.updateLoopId) return;

    const update = () => {
      if (!this.isActive) return;

      const now = performance.now();
      if (now - this.lastUpdate >= this.config.updateInterval) {
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
    // Atualizar posição da câmera
    this.updateCameraPosition();

    // Re-coletar fontes de luz (caso tenham mudado)
    if (Math.random() < 0.05) { // 5% de chance por frame para performance
      this.collectLightSources();
    }

    // Atualizar proximidade de cada objeto
    this.updateObjectProximities();

    // Aplicar efeitos de iluminação dinâmica
    this.applyDynamicLighting();
  }

  /**
   * Atualizar posição atual da câmera
   */
  updateCameraPosition() {
    if (this.atmosphereSystem && this.atmosphereSystem.getCameraPosition) {
      const pos = this.atmosphereSystem.getCameraPosition();
      if (pos) {
        this.cameraPosition.copy(pos);
      }
    }
  }

  /**
   * Atualizar níveis de luz e visibilidade de todos os objetos
   */
  updateObjectProximities() {
    this.trackedObjects.forEach((data, object) => {
      if (!object.visible || !object.parent) return;

      // Calcular distância da câmera
      data.distanceFromCamera = object.position.distanceTo(this.cameraPosition);

      // Calcular nível de luz disponível no local do objeto
      let lightLevel = this.calculateAvailableLightLevel(object.position);
      
      // Calcular visibilidade baseada na luz disponível e distância da câmera
      let visibility = this.calculateRealisticVisibility(lightLevel, data.distanceFromCamera);

      // Aplicar suavização para transições naturais (como adaptação dos olhos)
      data.targetLightLevel = lightLevel;
      data.targetVisibility = visibility;

      data.currentLightLevel = THREE.MathUtils.lerp(
        data.currentLightLevel,
        data.targetLightLevel,
        this.config.transitionSpeed
      );

      data.currentVisibility = THREE.MathUtils.lerp(
        data.currentVisibility,
        data.targetVisibility,
        this.config.transitionSpeed
      );
    });
  }

  /**
   * Calcular o nível de luz disponível em uma posição
   */
  calculateAvailableLightLevel(position) {
    let totalLight = 0;
    
    this.lightSources.forEach(light => {
      const distance = position.distanceTo(light.position);
      
      // Calcular contribuição desta luz baseada na física real
      let contribution = this.calculateLightContribution(distance, light);
      
      // Ajustar pela intensidade da luz
      const normalizedIntensity = Math.min(light.intensity / 8.0, 1.0);
      contribution *= normalizedIntensity;
      
      totalLight += contribution;
    });

    // Limitar o nível total de luz
    return Math.min(totalLight, 1.0);
  }

  /**
   * Calcular contribuição individual de uma fonte de luz
   */
  calculateLightContribution(distance, light) {
    // Lei do inverso do quadrado da distância (física real)
    if (distance <= 1) {
      return 1.0; // Luz máxima muito próximo
    }

    // Aplicar falloff baseado no tipo de luz
    let maxRange;
    switch (light.type) {
      case 'DirectionalLight':
        maxRange = this.config.maxEffectDistance * 1.5; // Luz direcional vai mais longe
        break;
      case 'SpotLight':
        maxRange = light.distance || this.config.maxEffectDistance;
        break;
      case 'PointLight':
        maxRange = light.distance || this.config.proximityDistance;
        break;
      default:
        maxRange = this.config.maxEffectDistance;
    }

    if (distance >= maxRange) {
      return 0.0;
    }

    // Falloff realista baseado na física
    const falloff = 1.0 / (1.0 + 0.5 * distance + 0.1 * distance * distance);
    return Math.max(falloff, 0);
  }

  /**
   * Calcular visibilidade realista baseada na luz e distância
   */
  calculateRealisticVisibility(lightLevel, cameraDistance) {
    const vis = this.config.visibility;
    
    // Primeiro: calcular visibilidade baseada na luz disponível
    let lightVisibility;
    
    if (lightLevel >= vis.fullVisibilityLight) {
      lightVisibility = vis.fullVisibilityOpacity; // Luz suficiente - vê perfeitamente
    } else if (lightLevel >= vis.partialVisibilityLight) {
      // Interpolação entre visibilidade parcial e total
      const factor = (lightLevel - vis.partialVisibilityLight) / 
                    (vis.fullVisibilityLight - vis.partialVisibilityLight);
      lightVisibility = THREE.MathUtils.lerp(vis.partialVisibilityOpacity, vis.fullVisibilityOpacity, factor);
    } else if (lightLevel >= vis.minVisibilityLight) {
      // Interpolação entre contornos e visibilidade parcial
      const factor = (lightLevel - vis.minVisibilityLight) / 
                    (vis.partialVisibilityLight - vis.minVisibilityLight);
      lightVisibility = THREE.MathUtils.lerp(vis.minVisibilityOpacity, vis.partialVisibilityOpacity, factor);
    } else {
      lightVisibility = vis.invisibleOpacity; // Sem luz suficiente - invisível
    }

    // Segundo: ajustar baseado na distância da câmera
    let distanceVisibility = 1.0;
    
    if (cameraDistance > vis.minViewDistance) {
      if (cameraDistance >= vis.maxViewDistance) {
        distanceVisibility = 0.2; // Muito longe - quase invisível mesmo com luz
      } else if (cameraDistance >= vis.partialViewDistance) {
        // Entre distância parcial e máxima
        const factor = (cameraDistance - vis.partialViewDistance) / 
                      (vis.maxViewDistance - vis.partialViewDistance);
        distanceVisibility = THREE.MathUtils.lerp(1.0, 0.2, factor);
      }
    }

    // Combinar visibilidade da luz com visibilidade da distância
    // A luz é o fator mais importante, mas a distância também afeta
    const finalVisibility = lightVisibility * distanceVisibility;
    
    // Boost para objetos muito iluminados (podem ser vistos de longe)
    if (lightLevel > 0.7) {
      const lightBoost = (lightLevel - 0.7) / 0.3; // 0 a 1
      return Math.min(finalVisibility + lightBoost * 0.3, 1.0);
    }
    
    return finalVisibility;
  }

  /**
   * Aplicar efeitos de visibilidade realista
   */
  applyDynamicLighting() {
    this.trackedObjects.forEach((data, object) => {
      if (!object.visible || !object.parent) return;

      const materials = Array.isArray(object.material) ? object.material : [object.material];
      const lightLevel = data.currentLightLevel;
      const visibility = data.currentVisibility;

      materials.forEach((material, index) => {
        const original = data.materials[index];
        if (!material || !original) return;

        // ===== SISTEMA DE VISIBILIDADE REALISTA =====
        
        // 1. Opacidade baseada na visibilidade calculada
        material.opacity = visibility;
        material.transparent = visibility < 1.0;
        
        // 2. Cor baseada na quantidade de luz (simula adaptação dos olhos)
        if (material.color) {
          const targetColor = original.color.clone();
          
          if (lightLevel > 0.1) {
            // Com luz suficiente - cores normais ou levemente realçadas
            const colorBoost = Math.min(lightLevel * 1.2, 1.5);
            targetColor.multiplyScalar(colorBoost);
            
            // Tom quente sutil com muita luz
            if (lightLevel > 0.6) {
              const warmTint = new THREE.Color(0xFFFAE6);
              targetColor.lerp(warmTint, (lightLevel - 0.6) * 0.15);
            }
          } else {
            // Pouca luz - cores dessaturadas e escuras
            targetColor.multiplyScalar(0.3 + lightLevel * 0.7);
            
            // Tom azulado no escuro (como visão noturna)
            const darkTint = new THREE.Color(0x202040);
            targetColor.lerp(darkTint, (0.1 - lightLevel) * 2.0);
          }
          
          material.color.copy(original.color);
          material.color.lerp(targetColor, 0.8);
        }

        // 3. Emissão baseada na iluminação disponível
        if (material.emissive) {
          if (lightLevel > 0.3) {
            // Objetos bem iluminados ganham leve brilho próprio
            const emissiveIntensity = (lightLevel - 0.3) * 0.2;
            const emissiveColor = original.color ? original.color.clone() : new THREE.Color(0xffffff);
            emissiveColor.multiplyScalar(emissiveIntensity);
            
            material.emissive.copy(original.emissive);
            material.emissive.lerp(emissiveColor, lightLevel);
            material.emissiveIntensity = original.emissiveIntensity + emissiveIntensity;
          } else {
            // Sem luz suficiente - sem emissão
            material.emissive.copy(original.emissive);
            material.emissiveIntensity = original.emissiveIntensity;
          }
        }

        // 4. Roughness baseada na iluminação (objetos iluminados parecem menos rugosos)
        if (material.roughness !== undefined) {
          const basRoughness = 0.8;
          const lightSmooth = lightLevel > 0.4 ? (lightLevel - 0.4) * 0.3 : 0;
          const targetRoughness = basRoughness - lightSmooth;
          
          material.roughness = THREE.MathUtils.lerp(
            material.roughness || basRoughness,
            targetRoughness,
            this.config.transitionSpeed * 3
          );
        }
      });
    });
  }

  /**
   * Restaurar todos os objetos ao estado original
   */
  restoreAllObjects() {
    let restoredCount = 0;

    this.trackedObjects.forEach((data, object) => {
      if (!object.material) return;

      const materials = Array.isArray(object.material) ? object.material : [object.material];
      
      materials.forEach((material, index) => {
        const original = data.materials[index];
        if (!material || !original) return;

        // Restaurar estado original completo
        if (material.emissive && original.emissive) {
          material.emissive.copy(original.emissive);
        }
        if (original.emissiveIntensity !== undefined) {
          material.emissiveIntensity = original.emissiveIntensity;
        }
        if (material.color && original.color) {
          material.color.copy(original.color);
        }
        
        // Restaurar opacidade e transparência originais
        material.opacity = original.opacity || 1.0;
        material.transparent = original.opacity < 1.0;
        
        // Restaurar roughness original se foi modificado
        if (material.roughness !== undefined) {
          material.roughness = 0.8; // Valor padrão
        }
      });

      restoredCount++;
    });

    this.trackedObjects.clear();
  }

  /**
   * Atualizar fontes de luz (chamado quando portas/janelas abrem/fecham)
   */
  refreshLightSources() {
    this.collectLightSources();
  }

  /**
   * Configurações em tempo real para visibilidade realista
   */
  setVisibilityDistance(maxView, partialView, minView) {
    this.config.visibility.maxViewDistance = Math.max(1, maxView || 15);
    this.config.visibility.partialViewDistance = Math.max(1, partialView || 8);
    this.config.visibility.minViewDistance = Math.max(1, minView || 3);
  }

  setLightSensitivity(full, partial, min) {
    this.config.visibility.fullVisibilityLight = Math.max(0.1, Math.min(full || 0.8, 1.0));
    this.config.visibility.partialVisibilityLight = Math.max(0.05, Math.min(partial || 0.4, 1.0));
    this.config.visibility.minVisibilityLight = Math.max(0.01, Math.min(min || 0.1, 1.0));
  }

  setTransitionSpeed(speed) {
    this.config.transitionSpeed = Math.max(0.001, Math.min(speed || 0.02, 0.2));
  }

  /**
   * Debug e informações do sistema de visibilidade
   */
  getDebugInfo() {
    // Calcular estatísticas dos objetos
    let visibleObjects = 0;
    let partiallyVisible = 0;
    let invisible = 0;
    let avgLightLevel = 0;
    
    this.trackedObjects.forEach((data) => {
      if (data.currentVisibility > 0.8) {
        visibleObjects++;
      } else if (data.currentVisibility > 0.2) {
        partiallyVisible++;
      } else {
        invisible++;
      }
      avgLightLevel += data.currentLightLevel;
    });

    if (this.trackedObjects.size > 0) {
      avgLightLevel /= this.trackedObjects.size;
    }

    return {
      isActive: this.isActive,
      trackedObjects: this.trackedObjects.size,
      lightSources: this.lightSources.length,
      visibility: {
        fullyVisible: visibleObjects,
        partiallyVisible: partiallyVisible,
        invisible: invisible,
        avgLightLevel: avgLightLevel.toFixed(3)
      },
      cameraPosition: this.cameraPosition.clone(),
      config: { ...this.config }
    };
  }

  /**
   * Destruir sistema
   */
  dispose() {
    this.deactivate();
    this.trackedObjects.clear();
    this.lightSources = [];
    
  }
}

// Exposição global para debug
window.DynamicLightingSystem = DynamicLightingSystem;
