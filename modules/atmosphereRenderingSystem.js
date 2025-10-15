// =====================================================================
// ATMOSPHERE RENDERING SYSTEM - MÓDULO DE ATMOSFERA E RENDERIZAÇÃO
// =====================================================================

/**
 * Sistema responsável por gerenciar:
 * - Partículas atmosféricas flutuantes
 * - Loop principal de renderização
 * - Configuração e otimização do renderizador
 * - Redimensionamento responsivo da câmera
 * - Controle de qualidade visual e performance
 */
class AtmosphereRenderingSystem {
  constructor() {
    this.particles = null;
    this.frameCount = 0;
    this.animationId = null;
    this.isRunning = false;
    
    // Configurações do sistema
    this.config = {
      particleCount: 0, // Desativado: era 100
      particleSize: 0.5,
      particleOpacity: 0.1,
      particleColor: 0x666699,
      rotationSpeed: 0.001,
      logInterval: 120, // frames (2 segundos a 60fps)
      
      // Configurações de renderizador
      antialias: true,
      powerPreference: "high-performance",
      alpha: true,
      shadowMapType: THREE.PCFSoftShadowMap,
      colorSpace: THREE.SRGBColorSpace,
      toneMapping: THREE.ACESFilmicToneMapping,
      toneMappingExposure: 1.2,
      maxPixelRatio: 2
    };
    
    // Referencias para objetos externos
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.canvas = null;
    
    // Callbacks externos
    this.callbacks = {
      onFrameUpdate: null,
      onCameraChange: null,
      updateFloatingBarVisibility: null,
      updateRoomModeSystem: null,
      getActiveCamera: null
    };
    
    console.log('🌟 AtmosphereRenderingSystem instanciado');
  }

  /**
   * Inicializar o sistema com as dependências necessárias
   */
  init(scene, camera, renderer, controls, canvas) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.controls = controls;
    this.canvas = canvas;
    
    console.log('🌟 Inicializando AtmosphereRenderingSystem...');
    
    // Configurar renderizador
    this.setupRenderer();
    
    // Criar partículas atmosféricas
    this.createAtmosphericParticles();
    
    // Configurar redimensionamento responsivo
    this.setupResponsiveResize();
    
    // Iniciar loop de renderização
    this.startRenderLoop();
    
    console.log('✅ AtmosphereRenderingSystem inicializado com sucesso');
  }

  /**
   * Configurar o renderizador com otimizações
   */
  setupRenderer() {
    if (!this.renderer) {
      console.error('❌ Renderizador não fornecido para AtmosphereRenderingSystem');
      return;
    }

    // Configurações básicas de qualidade
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.config.maxPixelRatio));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = this.config.shadowMapType;
    
    // Configurações de cor e tonalização
    this.renderer.outputColorSpace = this.config.colorSpace;
    this.renderer.toneMapping = this.config.toneMapping;
    this.renderer.toneMappingExposure = this.config.toneMappingExposure;
    
    console.log('🎨 Renderizador configurado com otimizações visuais');
    
    // Configurar tamanho inicial
    this.resizeRenderer();
  }

  /**
   * Criar sistema de partículas atmosféricas
   */
  createAtmosphericParticles() {
    if (!this.scene) {
      console.error('❌ Cena não fornecida para criar partículas atmosféricas');
      return;
    }

    // Criar geometria das partículas
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.config.particleCount * 3);

    // Gerar posições aleatórias em um espaço 3D
    for (let i = 0; i < this.config.particleCount * 3; i++) {
      positions[i] = (Math.random() - 0.5) * 100; // Distribuição entre -50 e +50
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Material das partículas com configuração otimizada
    const particleMaterial = new THREE.PointsMaterial({
      color: this.config.particleColor,
      size: this.config.particleSize,
      transparent: true,
      opacity: this.config.particleOpacity,
      sizeAttenuation: true, // Partículas menores à distância
      vertexColors: false,
      fog: true // Responder ao fog da cena se houver
    });

    // Criar sistema de partículas
    this.particles = new THREE.Points(particleGeometry, particleMaterial);
    this.particles.userData.isAtmosphericParticles = true;
    
    // Adicionar à cena
    this.scene.add(this.particles);
    
    console.log(`✨ Sistema de partículas atmosféricas criado (${this.config.particleCount} partículas)`);
  }

  /**
   * Configurar redimensionamento responsivo
   */
  setupResponsiveResize() {
    if (!this.canvas) {
      console.error('❌ Canvas não fornecido para configurar redimensionamento');
      return;
    }

    // Listener para redimensionamento da janela
    window.addEventListener('resize', () => {
      this.resizeRenderer();
    });
    
    console.log('📐 Sistema de redimensionamento responsivo configurado');
  }

  /**
   * Redimensionar renderizador e câmera
   */
  resizeRenderer() {
    if (!this.renderer || !this.camera || !this.canvas) {
      console.warn('⚠️ Dependências não disponíveis para redimensionamento');
      return;
    }

    // Obter container do canvas
    const container = document.getElementById('three-container');
    if (!container) {
      console.warn('⚠️ Container three-container não encontrado');
      return;
    }

    const width = container.clientWidth;
    const height = container.clientHeight;
    
    // Atualizar tamanho do renderizador
    this.renderer.setSize(width, height);
    
    // Atualizar câmera (assumindo câmera ortográfica)
    if (this.camera.isOrthographicCamera) {
      const size = 20; // Tamanho base da câmera
      const newAspect = width / height;
      
      this.camera.left = -size * newAspect;
      this.camera.right = size * newAspect;
      this.camera.updateProjectionMatrix();
      
      console.log(`📐 Câmera ortográfica redimensionada: ${width}x${height} (aspect: ${newAspect.toFixed(2)})`);
    } else if (this.camera.isPerspectiveCamera) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      
      console.log(`📐 Câmera perspectiva redimensionada: ${width}x${height}`);
    }

    // Callback para notificar redimensionamento
    if (this.callbacks.onCameraChange) {
      this.callbacks.onCameraChange();
    }
  }

  /**
   * Iniciar loop principal de renderização
   */
  startRenderLoop() {
    if (this.isRunning) {
      console.warn('⚠️ Loop de renderização já está em execução');
      return;
    }

    this.isRunning = true;
    console.log('🎬 Iniciando loop principal de renderização');
    
    // Função do loop de animação
    const animate = () => {
      if (!this.isRunning) return;
      
      this.animationId = requestAnimationFrame(animate);
      
      // Atualizar partículas atmosféricas
      this.updateAtmosphericParticles();
      
      // Log periódico de performance (opcional)
      this.logPerformance();
      
      // Atualizar controles de câmera
      if (this.controls && typeof this.controls.update === 'function') {
        this.controls.update();
      }
      
      // Callback para atualizações de sistemas externos
      if (this.callbacks.onFrameUpdate) {
        this.callbacks.onFrameUpdate();
      }
      
      // Atualizar sistema de room mode se disponível
      if (this.callbacks.updateRoomModeSystem) {
        this.callbacks.updateRoomModeSystem();
      }
      
      // Atualizar visibilidade da barra flutuante
      if (this.callbacks.updateFloatingBarVisibility) {
        this.callbacks.updateFloatingBarVisibility();
      }
      
      // Obter câmera ativa (pode ser diferente da câmera padrão)
      let activeCamera = this.camera;
      if (this.callbacks.getActiveCamera) {
        const customCamera = this.callbacks.getActiveCamera();
        if (customCamera) activeCamera = customCamera;
      }
      
      // Renderizar cena
      if (this.renderer && this.scene && activeCamera) {
        this.renderer.render(this.scene, activeCamera);
      }
      
      this.frameCount++;
    };
    
    // Iniciar o loop
    animate();
  }

  /**
   * Parar loop de renderização
   */
  stopRenderLoop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    console.log('⏹️ Loop de renderização parado');
  }

  /**
   * Atualizar animação das partículas atmosféricas
   */
  updateAtmosphericParticles() {
    if (!this.particles) return;
    
    // Rotação suave das partículas
    this.particles.rotation.y += this.config.rotationSpeed;
    
    // Efeito de flutuação sutil (opcional)
    if (this.frameCount % 60 === 0) { // A cada segundo
      const time = Date.now() * 0.0001;
      this.particles.position.y = Math.sin(time) * 0.1;
    }
  }

  /**
   * Log periódico de performance
   */
  logPerformance() {
    // Log a cada intervalo configurado
    if (this.frameCount % this.config.logInterval === 0 && this.frameCount > 0) {
      // Performance logging pode ser habilitado/desabilitado
      // console.log(`🎬 Frame ${this.frameCount} renderizado`);
    }
  }

  /**
   * Configurar callbacks para integração com sistemas externos
   */
  setCallbacks(callbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
    console.log('🔗 Callbacks configurados no AtmosphereRenderingSystem');
  }

  /**
   * Atualizar configurações do sistema
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    // Recriar partículas se necessário
    if (newConfig.particleCount || newConfig.particleColor || newConfig.particleSize || newConfig.particleOpacity) {
      this.recreateAtmosphericParticles();
    }
    
    console.log('⚙️ Configurações do AtmosphereRenderingSystem atualizadas');
  }

  /**
   * Recriar partículas atmosféricas com novas configurações
   */
  recreateAtmosphericParticles() {
    if (this.particles && this.scene) {
      this.scene.remove(this.particles);
      this.particles = null;
    }
    
    this.createAtmosphericParticles();
    console.log('🔄 Partículas atmosféricas recriadas com novas configurações');
  }

  /**
   * Obter informações de performance do sistema
   */
  getPerformanceInfo() {
    return {
      frameCount: this.frameCount,
      isRunning: this.isRunning,
      particleCount: this.config.particleCount,
      rendererId: this.renderer ? this.renderer.id : null,
      canvasSize: this.canvas ? {
        width: this.canvas.width,
        height: this.canvas.height
      } : null
    };
  }

  /**
   * Limpar recursos do sistema
   */
  dispose() {
    console.log('🧹 Limpando AtmosphereRenderingSystem...');
    
    // Parar loop de renderização
    this.stopRenderLoop();
    
    // Remover partículas da cena
    if (this.particles && this.scene) {
      this.scene.remove(this.particles);
      this.particles.geometry.dispose();
      this.particles.material.dispose();
      this.particles = null;
    }
    
    // Remover event listeners
    window.removeEventListener('resize', this.resizeRenderer);
    
    // Limpar referências
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.canvas = null;
    this.callbacks = {};
    
    console.log('✅ AtmosphereRenderingSystem limpo');
  }

  /**
   * Alternar visibilidade das partículas atmosféricas
   */
  toggleAtmosphericParticles(visible = null) {
    if (!this.particles) return;
    
    if (visible === null) {
      this.particles.visible = !this.particles.visible;
    } else {
      this.particles.visible = visible;
    }
    
    const status = this.particles.visible ? 'mostradas' : 'escondidas';
    console.log(`👁️ Partículas atmosféricas ${status}`);
  }

  /**
   * Obter referência das partículas (para uso externo)
   */
  getParticles() {
    return this.particles;
  }

  /**
   * Obter status do sistema
   */
  getStatus() {
    return {
      isInitialized: this.scene !== null,
      isRunning: this.isRunning,
      frameCount: this.frameCount,
      hasParticles: this.particles !== null,
      particleCount: this.config.particleCount
    };
  }
}

// Exportar para uso como módulo ES6
export { AtmosphereRenderingSystem };

// Tornar disponível globalmente
if (typeof window !== 'undefined') {
  window.AtmosphereRenderingSystem = AtmosphereRenderingSystem;
}

console.log('📦 Módulo AtmosphereRenderingSystem carregado');