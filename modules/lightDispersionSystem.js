/**
 * Sistema de Dispersão e Suavização de Luz
 * Melhora o realismo da luz que entra pelas portas
 */

class LightDispersionSystem {
  constructor(scene, renderer, camera) {
    this.scene = scene;
    this.renderer = renderer;
    this.camera = camera;
    this.enabled = true;
    
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
  createDustParticles(doorPosition, lightDirection) {
    const particleCount = 200;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const opacities = new Float32Array(particleCount);
    
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      
      // Distribuir partículas ao longo do raio de luz
      const distance = Math.random() * 8;
      const spread = Math.random() * 3 - 1.5;
      
      positions[i3] = doorPosition.x + (lightDirection.x * distance) + spread;
      positions[i3 + 1] = doorPosition.y + Math.random() * 2.5;
      positions[i3 + 2] = doorPosition.z + (lightDirection.z * distance) + spread;
      
      // Opacidade baseada na distância da luz
      opacities[i] = Math.random() * 0.3 * (1 - distance / 8);
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('opacity', new THREE.BufferAttribute(opacities, 1));
    
    const material = new THREE.PointsMaterial({
      color: 0xFFFFFF,
      size: 0.02,
      transparent: true,
      opacity: 0.6,
      vertexColors: false,
      blending: THREE.AdditiveBlending
    });
    
    const particles = new THREE.Points(geometry, material);
    particles.userData.isDustParticles = true;
    
    return particles;
  }
  
  /**
   * Atualizar animação das partículas
   */
  animateParticles() {
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