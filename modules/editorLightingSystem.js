// =====================================================================
// SISTEMA DE ILUMINAÇÃO DO EDITOR - EDITOR LIGHTING SYSTEM
// =====================================================================

/**
 * Sistema responsável por criar e gerenciar a iluminação básica otimizada do editor
 * Inclui luz ambiente, direcional, preenchimento, traseira, superior e pontuais
 */
export class EditorLightingSystem {
  constructor(scene) {
    // Referência da cena Three.js
    this.scene = scene;
    
    // Armazenar referências das luzes criadas
    this.lights = {
      ambient: null,
      directional: null,
      fill: null,
      back: null,
      top: null,
      pointLights: []
    };
    
    // Configurações padrão otimizadas
    this.config = {
      ambient: {
        color: 0xffffff,
        intensity: 0.5
      },
      directional: {
        color: 0xffffff,
        intensity: 1.0,
        position: { x: 15, y: 25, z: 15 },
        target: { x: 0, y: 0, z: 0 },
        castShadow: true,
        shadow: {
          mapSize: { width: 2048, height: 2048 },
          camera: {
            near: 0.5,
            far: 100,
            left: -30,
            right: 30,
            top: 30,
            bottom: -30
          },
          bias: -0.0001,
          radius: 8
        }
      },
      fill: {
        color: 0x8080ff,
        intensity: 0.3,
        position: { x: -10, y: 15, z: -10 }
      },
      back: {
        color: 0xff8080,
        intensity: 0.2,
        position: { x: 0, y: 10, z: -15 }
      },
      top: {
        color: 0xffffff,
        intensity: 0.4,
        position: { x: 0, y: 20, z: 0 },
        target: { x: 0, y: 0, z: 0 }
      },
      pointLights: [
        {
          color: 0xffffff,
          intensity: 0.6,
          distance: 25,
          position: { x: 8, y: 8, z: 8 }
        },
        {
          color: 0xffffff,
          intensity: 0.6,
          distance: 25,
          position: { x: -8, y: 8, z: -8 }
        }
      ]
    };
    
    console.log('💡 EditorLightingSystem inicializado');
  }

  /**
   * Inicializa todo o sistema de iluminação do editor
   */
  init() {
    this.createAllLights();
    console.log('💡 Sistema de iluminação do editor inicializado');
  }

  /**
   * Cria todas as luzes do sistema
   */
  createAllLights() {
    this.createAmbientLight();
    this.createDirectionalLight();
    this.createFillLight();
    this.createBackLight();
    this.createTopLight();
    this.createPointLights();
    
    console.log('💡 Todas as luzes do editor criadas');
  }

  /**
   * Cria a luz ambiente principal
   */
  createAmbientLight() {
    if (this.lights.ambient) {
      this.scene.remove(this.lights.ambient);
    }

    const ambientLight = new THREE.AmbientLight(
      this.config.ambient.color,
      this.config.ambient.intensity
    );
    
    ambientLight.name = 'EditorAmbientLight';
    ambientLight.userData.isEditorLight = true;
    
    this.scene.add(ambientLight);
    this.lights.ambient = ambientLight;
    
    console.log('💡 Luz ambiente criada');
  }

  /**
   * Cria a luz direcional principal com sombras
   */
  createDirectionalLight() {
    if (this.lights.directional) {
      this.scene.remove(this.lights.directional);
      if (this.lights.directional.target) {
        this.scene.remove(this.lights.directional.target);
      }
    }

    const directionalLight = new THREE.DirectionalLight(
      this.config.directional.color,
      this.config.directional.intensity
    );
    
    // Posicionamento
    directionalLight.position.set(
      this.config.directional.position.x,
      this.config.directional.position.y,
      this.config.directional.position.z
    );
    
    // Target
    directionalLight.target.position.set(
      this.config.directional.target.x,
      this.config.directional.target.y,
      this.config.directional.target.z
    );
    
    // Configuração de sombras
    if (this.config.directional.castShadow) {
      directionalLight.castShadow = true;
      
      // Configurar mapa de sombras
      const shadow = this.config.directional.shadow;
      directionalLight.shadow.mapSize.width = shadow.mapSize.width;
      directionalLight.shadow.mapSize.height = shadow.mapSize.height;
      
      // Configurar câmera de sombra
      directionalLight.shadow.camera.near = shadow.camera.near;
      directionalLight.shadow.camera.far = shadow.camera.far;
      directionalLight.shadow.camera.left = shadow.camera.left;
      directionalLight.shadow.camera.right = shadow.camera.right;
      directionalLight.shadow.camera.top = shadow.camera.top;
      directionalLight.shadow.camera.bottom = shadow.camera.bottom;
      
      // Configurações de qualidade
      directionalLight.shadow.bias = shadow.bias;
      directionalLight.shadow.radius = shadow.radius;
    }
    
    directionalLight.name = 'EditorDirectionalLight';
    directionalLight.userData.isEditorLight = true;
    
    this.scene.add(directionalLight);
    this.scene.add(directionalLight.target);
    this.lights.directional = directionalLight;
    
    console.log('💡 Luz direcional principal criada com sombras');
  }

  /**
   * Cria a luz de preenchimento para reduzir sombras fortes
   */
  createFillLight() {
    if (this.lights.fill) {
      this.scene.remove(this.lights.fill);
    }

    const fillLight = new THREE.DirectionalLight(
      this.config.fill.color,
      this.config.fill.intensity
    );
    
    fillLight.position.set(
      this.config.fill.position.x,
      this.config.fill.position.y,
      this.config.fill.position.z
    );
    
    fillLight.name = 'EditorFillLight';
    fillLight.userData.isEditorLight = true;
    
    this.scene.add(fillLight);
    this.lights.fill = fillLight;
    
    console.log('💡 Luz de preenchimento criada');
  }

  /**
   * Cria a luz traseira para melhor iluminação geral
   */
  createBackLight() {
    if (this.lights.back) {
      this.scene.remove(this.lights.back);
    }

    const backLight = new THREE.DirectionalLight(
      this.config.back.color,
      this.config.back.intensity
    );
    
    backLight.position.set(
      this.config.back.position.x,
      this.config.back.position.y,
      this.config.back.position.z
    );
    
    backLight.name = 'EditorBackLight';
    backLight.userData.isEditorLight = true;
    
    this.scene.add(backLight);
    this.lights.back = backLight;
    
    console.log('💡 Luz traseira criada');
  }

  /**
   * Cria a luz superior para iluminação uniforme
   */
  createTopLight() {
    if (this.lights.top) {
      this.scene.remove(this.lights.top);
      if (this.lights.top.target) {
        this.scene.remove(this.lights.top.target);
      }
    }

    const topLight = new THREE.DirectionalLight(
      this.config.top.color,
      this.config.top.intensity
    );
    
    topLight.position.set(
      this.config.top.position.x,
      this.config.top.position.y,
      this.config.top.position.z
    );
    
    topLight.target.position.set(
      this.config.top.target.x,
      this.config.top.target.y,
      this.config.top.target.z
    );
    
    topLight.name = 'EditorTopLight';
    topLight.userData.isEditorLight = true;
    
    this.scene.add(topLight);
    this.scene.add(topLight.target);
    this.lights.top = topLight;
    
    console.log('💡 Luz superior criada');
  }

  /**
   * Cria as luzes pontuais para iluminação local adicional
   */
  createPointLights() {
    // Remover luzes pontuais existentes
    this.lights.pointLights.forEach(light => {
      if (light) this.scene.remove(light);
    });
    this.lights.pointLights = [];

    // Criar novas luzes pontuais
    this.config.pointLights.forEach((config, index) => {
      const pointLight = new THREE.PointLight(
        config.color,
        config.intensity,
        config.distance
      );
      
      pointLight.position.set(
        config.position.x,
        config.position.y,
        config.position.z
      );
      
      pointLight.name = `EditorPointLight${index + 1}`;
      pointLight.userData.isEditorLight = true;
      
      this.scene.add(pointLight);
      this.lights.pointLights.push(pointLight);
    });
    
    console.log(`💡 ${this.config.pointLights.length} luzes pontuais criadas`);
  }

  // =====================================================================
  // MÉTODOS DE CONTROLE E CONFIGURAÇÃO
  // =====================================================================

  /**
   * Atualiza a intensidade da luz ambiente
   * @param {number} intensity - Nova intensidade (0.0 a 1.0)
   */
  setAmbientIntensity(intensity) {
    if (this.lights.ambient) {
      this.lights.ambient.intensity = intensity;
      this.config.ambient.intensity = intensity;
      console.log(`💡 Intensidade da luz ambiente: ${intensity}`);
    }
  }

  /**
   * Atualiza a intensidade da luz direcional principal
   * @param {number} intensity - Nova intensidade
   */
  setDirectionalIntensity(intensity) {
    if (this.lights.directional) {
      this.lights.directional.intensity = intensity;
      this.config.directional.intensity = intensity;
      console.log(`💡 Intensidade da luz direcional: ${intensity}`);
    }
  }

  /**
   * Atualiza a posição da luz direcional principal
   * @param {number} x - Posição X
   * @param {number} y - Posição Y
   * @param {number} z - Posição Z
   */
  setDirectionalPosition(x, y, z) {
    if (this.lights.directional) {
      this.lights.directional.position.set(x, y, z);
      this.config.directional.position = { x, y, z };
      console.log(`💡 Posição da luz direcional: (${x}, ${y}, ${z})`);
    }
  }

  /**
   * Liga ou desliga as sombras da luz direcional
   * @param {boolean} enabled - Se as sombras devem estar ativas
   */
  setShadowsEnabled(enabled) {
    if (this.lights.directional) {
      this.lights.directional.castShadow = enabled;
      this.config.directional.castShadow = enabled;
      console.log(`💡 Sombras ${enabled ? 'ativadas' : 'desativadas'}`);
    }
  }

  /**
   * Atualiza a qualidade das sombras
   * @param {number} mapSize - Tamanho do mapa de sombras (512, 1024, 2048, 4096)
   */
  setShadowQuality(mapSize) {
    if (this.lights.directional && this.lights.directional.castShadow) {
      this.lights.directional.shadow.mapSize.width = mapSize;
      this.lights.directional.shadow.mapSize.height = mapSize;
      this.config.directional.shadow.mapSize.width = mapSize;
      this.config.directional.shadow.mapSize.height = mapSize;
      console.log(`💡 Qualidade das sombras: ${mapSize}x${mapSize}`);
    }
  }

  /**
   * Define uma configuração personalizada para uma luz específica
   * @param {string} lightType - Tipo da luz ('ambient', 'directional', 'fill', 'back', 'top')
   * @param {object} config - Nova configuração
   */
  setLightConfig(lightType, config) {
    if (this.config[lightType]) {
      this.config[lightType] = { ...this.config[lightType], ...config };
      
      // Recriar a luz específica
      switch (lightType) {
        case 'ambient':
          this.createAmbientLight();
          break;
        case 'directional':
          this.createDirectionalLight();
          break;
        case 'fill':
          this.createFillLight();
          break;
        case 'back':
          this.createBackLight();
          break;
        case 'top':
          this.createTopLight();
          break;
      }
      
      console.log(`💡 Configuração da luz ${lightType} atualizada`);
    }
  }

  /**
   * Aplica um preset de iluminação
   * @param {string} preset - Nome do preset ('default', 'bright', 'soft', 'dramatic')
   */
  applyPreset(preset) {
    const presets = {
      default: {
        ambient: { intensity: 0.5 },
        directional: { intensity: 1.0 },
        fill: { intensity: 0.3 },
        back: { intensity: 0.2 },
        top: { intensity: 0.4 }
      },
      bright: {
        ambient: { intensity: 0.7 },
        directional: { intensity: 1.2 },
        fill: { intensity: 0.4 },
        back: { intensity: 0.3 },
        top: { intensity: 0.5 }
      },
      soft: {
        ambient: { intensity: 0.6 },
        directional: { intensity: 0.8 },
        fill: { intensity: 0.5 },
        back: { intensity: 0.4 },
        top: { intensity: 0.3 }
      },
      dramatic: {
        ambient: { intensity: 0.2 },
        directional: { intensity: 1.5 },
        fill: { intensity: 0.1 },
        back: { intensity: 0.1 },
        top: { intensity: 0.2 }
      }
    };

    const presetConfig = presets[preset];
    if (presetConfig) {
      Object.keys(presetConfig).forEach(lightType => {
        this.setLightConfig(lightType, presetConfig[lightType]);
      });
      console.log(`💡 Preset "${preset}" aplicado`);
    } else {
      console.warn(`💡 Preset "${preset}" não encontrado`);
    }
  }

  // =====================================================================
  // MÉTODOS DE ANÁLISE E UTILIDADE
  // =====================================================================

  /**
   * Remove todas as luzes do editor da cena
   */
  removeAllLights() {
    // Remover luz ambiente
    if (this.lights.ambient) {
      this.scene.remove(this.lights.ambient);
      this.lights.ambient = null;
    }

    // Remover luz direcional e target
    if (this.lights.directional) {
      this.scene.remove(this.lights.directional);
      if (this.lights.directional.target) {
        this.scene.remove(this.lights.directional.target);
      }
      this.lights.directional = null;
    }

    // Remover luz de preenchimento
    if (this.lights.fill) {
      this.scene.remove(this.lights.fill);
      this.lights.fill = null;
    }

    // Remover luz traseira
    if (this.lights.back) {
      this.scene.remove(this.lights.back);
      this.lights.back = null;
    }

    // Remover luz superior e target
    if (this.lights.top) {
      this.scene.remove(this.lights.top);
      if (this.lights.top.target) {
        this.scene.remove(this.lights.top.target);
      }
      this.lights.top = null;
    }

    // Remover luzes pontuais
    this.lights.pointLights.forEach(light => {
      if (light) this.scene.remove(light);
    });
    this.lights.pointLights = [];

    console.log('💡 Todas as luzes do editor removidas');
  }

  /**
   * Retorna estatísticas do sistema de iluminação
   * @returns {object}
   */
  getStats() {
    const activeLights = [];
    
    if (this.lights.ambient) activeLights.push('ambient');
    if (this.lights.directional) activeLights.push('directional');
    if (this.lights.fill) activeLights.push('fill');
    if (this.lights.back) activeLights.push('back');
    if (this.lights.top) activeLights.push('top');
    activeLights.push(`${this.lights.pointLights.length} point lights`);

    return {
      totalLights: activeLights.length + this.lights.pointLights.length - 1, // -1 porque contamos point lights separadamente
      activeLights,
      shadowsEnabled: this.lights.directional?.castShadow || false,
      shadowMapSize: this.config.directional.shadow.mapSize.width,
      currentPreset: this.detectCurrentPreset()
    };
  }

  /**
   * Detecta qual preset está sendo usado atualmente
   * @returns {string}
   */
  detectCurrentPreset() {
    const current = {
      ambient: this.lights.ambient?.intensity || 0,
      directional: this.lights.directional?.intensity || 0
    };

    // Verificar se corresponde a algum preset conhecido
    if (Math.abs(current.ambient - 0.5) < 0.1 && Math.abs(current.directional - 1.0) < 0.1) {
      return 'default';
    } else if (current.ambient > 0.6 && current.directional > 1.1) {
      return 'bright';
    } else if (current.ambient > 0.5 && current.directional < 0.9) {
      return 'soft';
    } else if (current.ambient < 0.3 && current.directional > 1.3) {
      return 'dramatic';
    }
    
    return 'custom';
  }

  /**
   * Lista todas as luzes na cena (incluindo não-editor)
   * @returns {Array}
   */
  getAllSceneLights() {
    const allLights = [];
    
    this.scene.traverse((child) => {
      if (child.isLight) {
        allLights.push({
          name: child.name || 'Unnamed Light',
          type: child.type,
          intensity: child.intensity,
          isEditorLight: child.userData.isEditorLight || false,
          castShadow: child.castShadow || false
        });
      }
    });

    return allLights;
  }

  /**
   * Método de cleanup para remover o sistema
   */
  destroy() {
    this.removeAllLights();
    
    // Limpar referências
    this.scene = null;
    this.lights = null;
    this.config = null;
    
    console.log('💡 EditorLightingSystem destruído');
  }
}