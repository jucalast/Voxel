/**
 * Sistema Modular de Lâmpadas e Iluminação Artificial
 * Cria lâmpadas interativas com luz quente/fria e iluminação realista adaptativa
 */

export class LightingSystem {
  constructor(scene, roomConfigSystem) {
    this.scene = scene;
    this.roomConfigSystem = roomConfigSystem;
    
    // Configurações de lâmpadas modernas
    this.config = {
      lamp: {
        // Spot LED moderno para teto
        spot: {
          housingRadius: 0.08,    // Carcaça compacta
          housingDepth: 0.06,     // Profundidade mínima
          lensRadius: 0.04,       // Lente pequena
          lensDepth: 0.02         // Profundidade da lente
        },
        // Track light para parede
        track: {
          width: 0.12,           // Largura do track
          height: 0.04,          // Altura do track
          depth: 0.08,           // Profundidade
          spotRadius: 0.03,      // Spot pequeno
          spotLength: 0.06       // Comprimento do spot
        }
      },
      lighting: {
        // Luz Quente LED (2700K-3000K) - Focada com rebatimento
        warm: {
          color: 0xe6cab2,           // Cor bege rosada suave como solicitado
          intensity: 12.0,           // Intensidade aumentada para melhor iluminação
          temperature: 2700,         // Kelvin LED
          distance: 12,              // Alcance focado - panorama menor
          decay: 2.2,                // Decaimento mais acentuado para foco
          angle: Math.PI / 2.5,      // Ângulo de 72° para foco
          penumbra: 0.7,             // Penumbra mais suave
          shadowIntensity: 0.6,      // Sombras mais suaves
          atmosphereColor: 0xe6cab2, // Cor atmosfera bege rosada
          emissiveIntensity: 0.8,    // LED brilhante
          bounceIntensity: 0.4,      // Intensidade do rebatimento aumentada
          bounceDistance: 8          // Distância do rebatimento
        },
        // Luz Fria LED (5000K-6500K) - Focada com rebatimento
        cool: {
          color: 0xf9f7f4,           // Cor branco creme suave como solicitado
          intensity: 15.0,           // Intensidade aumentada para melhor iluminação
          temperature: 6000,         // Kelvin LED frio
          distance: 15,              // Alcance focado - panorama menor
          decay: 2.2,                // Decaimento mais acentuado para foco
          angle: Math.PI / 2.5,      // Ângulo de 72° para foco
          penumbra: 0.6,             // Penumbra mais suave
          shadowIntensity: 0.7,      // Sombras mais suaves
          atmosphereColor: 0xf9f7f4, // Cor atmosfera branco creme
          emissiveIntensity: 1.0,    // LED máximo brilho
          bounceIntensity: 0.45,     // Intensidade do rebatimento aumentada
          bounceDistance: 10         // Distância do rebatimento
        },
        // Configurações de sombras suaves e realistas
        shadow: {
          mapSize: 2048,           // Maior resolução para sombras mais suaves
          camera: {
            near: 0.1,
            far: 30
          },
          bias: -0.001,            // Bias ajustado para menos artifacts
          normalBias: 0.02,        // Normal bias para sombras mais suaves
          radius: 8,               // Raio de suavização PCF
          blurSamples: 25          // Samples para suavização
        },
        // Configurações de luz indireta e ambiente
        indirect: {
          bounceIntensity: 0.4,    // Força da luz indireta
          ambientMultiplier: 0.15, // Multiplicador da luz ambiente
          reflectionStrength: 0.3,  // Força dos reflexos
          diffuseSpread: 1.2       // Espalhar da luz difusa
        },
        // Efeitos atmosféricos
        atmosphere: {
          volumetricEnabled: true,
          dustParticles: true,
          lightCones: true,
          dynamicShadows: true
        }
      }
    };
    
    // Estado do sistema
    this.lamps = new Map(); // ID -> lamp data
    this.lightSources = new Map(); // ID -> light objects
    this.atmosphereEffects = new Map(); // ID -> atmosphere effects
    this.animations = new Map(); // ID -> animation data
    
    // Material cache para performance
    this.materialCache = new Map();
    
    // Expor controles globalmente
    window.lampControls = {
      create: (id, position, type = 'warm') => this.createLamp(id, position, type),
      remove: (id) => this.removeLamp(id),
      toggle: (id) => this.toggleLamp(id),
      setType: (id, type) => this.setLampType(id, type),
      setIntensity: (id, intensity) => this.setLampIntensity(id, intensity),
      list: () => this.getLamps(),
      
      // Controles de ambiente
      setGlobalAmbient: (intensity) => this.setGlobalAmbient(intensity),
      enableAtmosphere: (enabled) => this.enableAtmosphereEffects(enabled),
      
      // Presets rápidos
      warmLighting: () => this.applyWarmPreset(),
      coolLighting: () => this.applyCoolPreset(),
      mixedLighting: () => this.applyMixedPreset(),
      
      // Debug
      debug: () => this.debugLightingSystem()
    };
    
    // Inicializar sistema
    this.init();
    
    console.log('💡✨ Sistema de Iluminação Artificial inicializado');
  }

  init() {
    // Configurar ambiente base para luzes artificiais
    this.setupArtificialLightingEnvironment();
    
    // Configurar materiais base
    this.setupLampMaterials();
    
    // Configurar sistema de partículas atmosféricas
    this.setupAtmosphereParticles();
    
    // Melhorar materiais realistas após configuração base
    this.enhanceMaterialRealism();
    
    // Sistema inicializado
    console.log('💡 Sistema de lâmpadas pronto para uso');
  }

  /**
   * Configurar ambiente para iluminação artificial
   */
  setupArtificialLightingEnvironment() {
    // Reduzir luz ambiente para destacar luzes artificiais
    this.scene.traverse((child) => {
      if (child.isLight && child.type === 'AmbientLight') {
        child.intensity = Math.min(child.intensity, 0.15); // Muito baixa
      }
    });
    
    // Configurar fog para atmosfera
    this.scene.fog = new THREE.Fog(0x1a1a2e, 0.1, 20);
    
    console.log('🌆 Ambiente configurado para iluminação artificial');
  }

  /**
   * Configurar materiais das lâmpadas modernas
   */
  setupLampMaterials() {
    // Material da carcaça (alumínio moderno)
    this.materialCache.set('housing', new THREE.MeshStandardMaterial({
      color: 0xE8E8E8,
      metalness: 0.9,
      roughness: 0.1,
      envMapIntensity: 1.0
    }));
    
    // Material do track (metal escovado)
    this.materialCache.set('housing', new THREE.MeshStandardMaterial({
      color: 0xf5f5f5,          // Branco quase fosco
      metalness: 0.2,           // Menos metálico
      roughness: 0.6,           // Mais fosco
      envMapIntensity: 0.3      // Reflexos mínimos
    }));
    
    // Material interno preto fosco mais realista
    this.materialCache.set('inner', new THREE.MeshStandardMaterial({
      color: 0x0a0a0a,          // Preto mais profundo
      metalness: 0.0,           // Nada metálico
      roughness: 1.0,           // Totalmente fosco
      envMapIntensity: 0.0      // Sem reflexos
    }));
    
    // LED quente moderno - bege rosado suave
    this.materialCache.set('led_warm', new THREE.MeshStandardMaterial({
      color: 0xe6cab2,
      emissive: 0xe6cab2,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.9,
      metalness: 0.0,
      roughness: 0.05
    }));
    
    // LED frio moderno - branco creme suave
    this.materialCache.set('led_cool', new THREE.MeshStandardMaterial({
      color: 0xf9f7f4,
      emissive: 0xf9f7f4,
      emissiveIntensity: 1.0,
      transparent: true,
      opacity: 0.9,
      metalness: 0.0,
      roughness: 0.05
    }));
    
    console.log('🎨 Materiais das lâmpadas modernas configurados');
  }

  /**
   * Criar sistema de partículas atmosféricas
   */
  setupAtmosphereParticles() {
    // Partículas de poeira para efeito volumétrico
    const particleCount = 200;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      // Posições aleatórias no ambiente
      positions[i3] = (Math.random() - 0.5) * 20;
      positions[i3 + 1] = Math.random() * 4;
      positions[i3 + 2] = (Math.random() - 0.5) * 20;
      
      // Cores sutis
      colors[i3] = 0.8 + Math.random() * 0.2;
      colors[i3 + 1] = 0.8 + Math.random() * 0.2;
      colors[i3 + 2] = 0.8 + Math.random() * 0.2;
    }
    
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    const particleMaterial = new THREE.PointsMaterial({
      size: 0.02,
      transparent: true,
      opacity: 0.3,
      vertexColors: true,
      blending: THREE.AdditiveBlending
    });
    
    this.dustParticles = new THREE.Points(particleGeometry, particleMaterial);
    this.scene.add(this.dustParticles);
    
    // Animação das partículas
    this.animateDustParticles();
    
    console.log('✨ Sistema de partículas atmosféricas criado');
  }

  /**
   * Criar lâmpada moderna grudada em superfícies (paredes/teto)
   */
  createLamp(id, position, type = 'warm', surface = 'ceiling') {
    console.log(`💡 Criando lâmpada '${id}' do tipo '${type}' na ${surface}`, position);
    
    // Verificar se já existe
    if (this.lamps.has(id)) {
      console.warn(`⚠️ Lâmpada '${id}' já existe`);
      return null;
    }
    
    // Criar grupo principal
    const lampGroup = new THREE.Group();
    lampGroup.userData.lampId = id;
    lampGroup.userData.isLamp = true;
    lampGroup.userData.surface = surface;
    
    // Criar lâmpada adequada para a superfície
    const { ledMesh, lightPosition, lightDirection } = this.createSurfaceSpot(id, type, surface);
    
    // Adicionar componentes ao grupo
    lampGroup.add(ledMesh);
    
    // Posicionar grupo
    lampGroup.position.set(position.x, position.y, position.z);
    
    // Orientar grupo baseado na superfície
    if (surface === 'wall') {
      // Rotacionar para parecer grudada na parede
      lampGroup.rotation.x = Math.PI / 6; // Inclinação para baixo
    }
    
    // Configuração da luz
    const lightConfig = this.config.lighting[type];
    
    // Luz principal focada com atenuação por distância
    const mainLight = new THREE.SpotLight(
      lightConfig.color,
      lightConfig.intensity,
      lightConfig.distance,
      lightConfig.angle,
      lightConfig.penumbra,
      lightConfig.decay
    );
    
    // Posicionar luz e direcionamento baseado na superfície
    mainLight.position.copy(lightPosition);
    
    // Direção baseada na superfície
    const targetDirection = surface === 'ceiling' 
      ? new THREE.Vector3(0, -1, 0)  // Teto aponta para baixo
      : new THREE.Vector3(0, -0.7, -0.7); // Parede aponta para baixo e para frente
      
    mainLight.target.position.copy(lightPosition).add(targetDirection.multiplyScalar(3));
    
    // Configurar sombras suaves
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = this.config.lighting.shadow.mapSize;
    mainLight.shadow.mapSize.height = this.config.lighting.shadow.mapSize;
    mainLight.shadow.camera.near = this.config.lighting.shadow.camera.near;
    mainLight.shadow.camera.far = lightConfig.distance;
    mainLight.shadow.bias = this.config.lighting.shadow.bias;
    
    // Criar luzes de rebatimento nas paredes
    const bounceLights = this.createWallBounceLights(lightPosition, lightConfig);
    
    // Adicionar todas as luzes ao grupo
    lampGroup.add(mainLight);
    lampGroup.add(mainLight.target);
    bounceLights.forEach(bounceLight => {
      lampGroup.add(bounceLight.light);
      lampGroup.add(bounceLight.target);
    });
    
    // Adicionar à cena
    this.scene.add(lampGroup);
    
    // Registrar lâmpada
    const lampData = {
      id: id,
      group: lampGroup,
      mainLight: mainLight,
      bounceLights: bounceLights,
      led: ledMesh,
      type: type,
      surface: surface,
      position: lampGroup.position.clone(),
      isOn: true,
      config: { ...lightConfig }
    };
    
    this.lamps.set(id, lampData);
    this.lightSources.set(id, mainLight);
    
    // Animar ligação da lâmpada
    this.animateLampTurnOn(id);
    
    console.log(`✅ Lâmpada '${id}' criada na ${surface} com rebatimento`);
    return lampGroup;
  }

  /**
   * Criar luzes de rebatimento nas paredes para iluminação indireta
   */
  createWallBounceLights(position, lightConfig) {
    const bounceLights = [];
    
    // Direções para as 4 paredes principais
    const bounceDirections = [
      { x: 1, y: 0, z: 0, name: 'direita' },   // Parede direita
      { x: -1, y: 0, z: 0, name: 'esquerda' }, // Parede esquerda
      { x: 0, y: 0, z: 1, name: 'frente' },    // Parede frontal
      { x: 0, y: 0, z: -1, name: 'tras' }      // Parede traseira
    ];
    
    bounceDirections.forEach((dir, index) => {
      // Luz de rebatimento mais sutil
      const bounceLight = new THREE.SpotLight(
        lightConfig.color,
        lightConfig.bounceIntensity || 0.3, // Intensidade do rebatimento
        lightConfig.bounceDistance || 8,     // Distância menor para rebatimento
        Math.PI / 4,                         // Ângulo de 45°
        0.8,                                 // Penumbra bem suave
        2.5                                  // Decay maior para efeito sutil
      );
      
      // Posicionar luz de rebatimento
      bounceLight.position.copy(position);
      
      // Target para a parede
      const target = new THREE.Object3D();
      target.position.set(
        position.x + dir.x * (lightConfig.bounceDistance || 8) * 0.6,
        position.y - 0.5, // Ligeiramente para baixo
        position.z + dir.z * (lightConfig.bounceDistance || 8) * 0.6
      );
      
      bounceLight.target = target;
      
      // Sem sombras para luzes de rebatimento
      bounceLight.castShadow = false;
      
      bounceLights.push({
        light: bounceLight,
        target: target,
        direction: dir
      });
    });
    
    return bounceLights;
  }

  /**
   * Criar sistema de iluminação indireta para simular bounce lighting (método original mantido)
   */
  createIndirectLighting(position, lightConfig) {
    const indirectLights = [];
    const indirectConfig = this.config.lighting.indirect;
    
    // Criar 4 luzes direcionais suaves para simular luz rebatida das paredes
    const directions = [
      { x: 1, y: -0.3, z: 0 },   // Parede direita
      { x: -1, y: -0.3, z: 0 },  // Parede esquerda  
      { x: 0, y: -0.3, z: 1 },   // Parede frontal
      { x: 0, y: -0.3, z: -1 }   // Parede traseira
    ];
    
    directions.forEach((dir, index) => {
      const indirectLight = new THREE.SpotLight(
        lightConfig.color,
        lightConfig.intensity * indirectConfig.bounceIntensity * 0.25, // 25% por direção
        lightConfig.distance * 0.8,
        Math.PI / 3, // Ângulo médio
        0.8, // Penumbra bem suave
        2.0  // Decay maior para efeito mais sutil
      );
      
      indirectLight.position.copy(position);
      indirectLight.target.position.set(
        position.x + dir.x * 3,
        position.y + dir.y * 2,
        position.z + dir.z * 3
      );
      
      // Sem sombras para luzes indiretas
      indirectLight.castShadow = false;
      
      indirectLights.push({
        light: indirectLight,
        target: indirectLight.target,
        direction: dir
      });
    });
    
    return indirectLights;
  }

  /**
   * Melhorar iluminação ambiente global
   */
  enhanceAmbientLighting(lightConfig) {
    // Adicionar luz ambiente sutil se não existir
    if (!this.globalAmbient) {
      this.globalAmbient = new THREE.AmbientLight(
        lightConfig.color,
        lightConfig.intensity * this.config.lighting.indirect.ambientMultiplier
      );
      this.scene.add(this.globalAmbient);
    } else {
      // Aumentar ligeiramente a luz ambiente existente
      this.globalAmbient.intensity += lightConfig.intensity * 0.05;
    }
    
    // Adicionar luz hemisférica para simular luz do céu
    if (!this.hemisphereLight) {
      this.hemisphereLight = new THREE.HemisphereLight(
        lightConfig.color, // Cor do céu
        new THREE.Color(0x404040), // Cor do chão
        lightConfig.intensity * 0.2
      );
      this.scene.add(this.hemisphereLight);
    }
  }

  /**
   * Configurar renderer para melhor qualidade de sombras
   */
  configureRealisticShadows(renderer) {
    if (!renderer) return;
    
    // Habilitar sombras PCF suaves
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Sombras suaves
    
    // Melhorar qualidade geral
    renderer.physicallyCorrectLights = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    
    // Habilitar anti-aliasing se disponível
    if (renderer.capabilities.isWebGL2) {
      renderer.antialias = true;
    }
  }

  /**
   * Aplicar materiais realistas melhorados
   */
  enhanceMaterialRealism() {
    // Melhorar material do housing com propriedades mais realistas
    this.materialCache.set('housing', new THREE.MeshStandardMaterial({
      color: 0xf8f8f8,          // Branco ligeiramente off-white
      metalness: 0.1,           // Levemente metálico
      roughness: 0.4,           // Rugosidade média
      envMapIntensity: 0.6      // Reflexos sutis
    }));
    
    // Material LED com emissão mais realista
    ['warm', 'cool'].forEach(type => {
      const lightConfig = this.config.lighting[type];
      this.materialCache.set(`led_${type}`, new THREE.MeshStandardMaterial({
        color: lightConfig.color,
        emissive: new THREE.Color(lightConfig.color).multiplyScalar(0.4),
        emissiveIntensity: lightConfig.emissiveIntensity,
        metalness: 0.0,
        roughness: 0.8,
        transparent: true,
        opacity: 0.9
      }));
    });
    
    console.log('🎨 Materiais PBR realísticos aplicados');
  }

  /**
   * Criar spot LED que se adapta à superfície (teto ou parede)
   */
  createSurfaceSpot(id, type, surface) {
    const spotConfig = this.config.lamp.spot;
    
    if (surface === 'wall') {
      // Usar track light para paredes
      return this.createWallTrack(id, type);
    } else {
      // Usar spot para teto (padrão)
      return this.createCeilingSpot(id, type);
    }
  }

  /**
   * Criar spot LED universal para qualquer posição
   */
  createUniversalSpot(id, type) {
    const spotConfig = this.config.lamp.spot;
    
    // Carcaça principal (menor e mais moderna)
    const housingGeometry = new THREE.CylinderGeometry(
      spotConfig.housingRadius * 0.8, 
      spotConfig.housingRadius * 0.8, 
      spotConfig.housingDepth * 0.6, 
      16
    );
    const housingMesh = new THREE.Mesh(housingGeometry, this.materialCache.get('housing'));
    housingMesh.castShadow = true;
    housingMesh.userData.lampId = id;
    
    // Parte interna (preto fosco)
    const innerGeometry = new THREE.CylinderGeometry(
      spotConfig.housingRadius * 0.6, 
      spotConfig.housingRadius * 0.6, 
      spotConfig.housingDepth * 0.4, 
      16
    );
    const innerMesh = new THREE.Mesh(innerGeometry, this.materialCache.get('inner'));
    
    // LED (pequeno e brilhante)
    const ledGeometry = new THREE.SphereGeometry(spotConfig.lensRadius * 0.8, 12, 8);
    const ledMaterial = this.materialCache.get(`led_${type}`);
    const ledMesh = new THREE.Mesh(ledGeometry, ledMaterial);
    
    // Grupo do spot universal
    const spotGroup = new THREE.Group();
    spotGroup.add(housingMesh);
    spotGroup.add(innerMesh);
    spotGroup.add(ledMesh);
    
    // Posição da luz (centro do LED)
    const lightPosition = new THREE.Vector3(0, 0, 0);
    const lightDirection = new THREE.Vector3(0, -1, 0); // Padrão para baixo
    
    return { ledMesh: spotGroup, lightPosition, lightDirection };
  }

  /**
   * Criar spot LED para teto
   */
  createCeilingSpot(id, type) {
    const spotConfig = this.config.lamp.spot;
    
    // Carcaça principal (cilindro)
    const housingGeometry = new THREE.CylinderGeometry(
      spotConfig.housingRadius, 
      spotConfig.housingRadius, 
      spotConfig.housingDepth, 
      16
    );
    const housingMesh = new THREE.Mesh(housingGeometry, this.materialCache.get('housing'));
    housingMesh.position.y = -spotConfig.housingDepth / 2;
    housingMesh.castShadow = true;
    housingMesh.userData.lampId = id;
    
    // Parte interna (preto fosco)
    const innerGeometry = new THREE.CylinderGeometry(
      spotConfig.housingRadius * 0.8, 
      spotConfig.housingRadius * 0.8, 
      spotConfig.housingDepth * 0.9, 
      16
    );
    const innerMesh = new THREE.Mesh(innerGeometry, this.materialCache.get('inner'));
    innerMesh.position.y = -spotConfig.housingDepth / 2;
    
    // LED (pequeno e brilhante)
    const ledGeometry = new THREE.CylinderGeometry(
      spotConfig.lensRadius, 
      spotConfig.lensRadius, 
      spotConfig.lensDepth, 
      12
    );
    const ledMaterial = this.materialCache.get(`led_${type}`);
    const ledMesh = new THREE.Mesh(ledGeometry, ledMaterial);
    ledMesh.position.y = -spotConfig.housingDepth + spotConfig.lensDepth / 2;
    
    // Grupo do spot
    const spotGroup = new THREE.Group();
    spotGroup.add(housingMesh);
    spotGroup.add(innerMesh);
    spotGroup.add(ledMesh);
    
    // Posição e direção da luz
    const lightPosition = new THREE.Vector3(0, -spotConfig.housingDepth / 2, 0);
    const lightDirection = new THREE.Vector3(0, -1, 0); // Para baixo
    
    return { ledMesh: spotGroup, lightPosition, lightDirection };
  }

  /**
   * Criar track light para parede
   */
  createWallTrack(id, type) {
    const trackConfig = this.config.lamp.track;
    
    // Track principal (retangular)
    const trackGeometry = new THREE.BoxGeometry(
      trackConfig.width, 
      trackConfig.height, 
      trackConfig.depth
    );
    const trackMesh = new THREE.Mesh(trackGeometry, this.materialCache.get('track'));
    trackMesh.castShadow = true;
    trackMesh.userData.lampId = id;
    
    // Spot ajustável
    const spotGeometry = new THREE.CylinderGeometry(
      trackConfig.spotRadius, 
      trackConfig.spotRadius, 
      trackConfig.spotLength, 
      12
    );
    const spotMesh = new THREE.Mesh(spotGeometry, this.materialCache.get('housing'));
    spotMesh.position.set(0, 0, trackConfig.depth / 2 + trackConfig.spotLength / 2);
    spotMesh.rotation.x = -Math.PI / 6; // Ângulo de 30° para baixo
    
    // LED do spot
    const ledGeometry = new THREE.CircleGeometry(trackConfig.spotRadius * 0.7, 12);
    const ledMaterial = this.materialCache.get(`led_${type}`);
    const ledMesh = new THREE.Mesh(ledGeometry, ledMaterial);
    ledMesh.position.z = trackConfig.spotLength / 2 - 0.005;
    
    spotMesh.add(ledMesh);
    
    // Grupo do track
    const trackGroup = new THREE.Group();
    trackGroup.add(trackMesh);
    trackGroup.add(spotMesh);
    
    // Posição e direção da luz (inclinada para baixo)
    const lightPosition = new THREE.Vector3(0, 0, trackConfig.depth / 2 + trackConfig.spotLength / 2);
    const lightDirection = new THREE.Vector3(0, -0.8, -0.6).normalize(); // Direção inclinada
    
    return { ledMesh: trackGroup, lightPosition, lightDirection };
  }

  /**
   * Criar efeitos atmosféricos modernos
   */
  createModernAtmosphereEffects(lampId, lampGroup, type, surface) {
    const lightConfig = this.config.lighting[type];
    const effects = {};
    
    // Cone de luz mais focado e moderno
    const coneGeometry = new THREE.ConeGeometry(1.5, 3, 8, 1, true);
    const coneMaterial = new THREE.MeshBasicMaterial({
      color: lightConfig.atmosphereColor,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    
    effects.lightCone = new THREE.Mesh(coneGeometry, coneMaterial);
    
    // Halo menor e mais sutil
    const haloGeometry = new THREE.RingGeometry(0.3, 1.5, 16);
    const haloMaterial = new THREE.MeshBasicMaterial({
      color: lightConfig.atmosphereColor,
      transparent: true,
      opacity: 0.03,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    
    effects.halo = new THREE.Mesh(haloGeometry, haloMaterial);
    
    // Posicionamento baseado na superfície
    if (surface === 'ceiling') {
      // Cone apontando para baixo
      effects.lightCone.position.set(0, -0.5, 0);
      effects.lightCone.rotation.x = 0; // Cone para baixo
      
      // Halo no chão
      effects.halo.position.set(0, -2.8, 0);
      effects.halo.rotation.x = -Math.PI / 2;
    } else if (surface === 'wall') {
      // Cone inclinado da parede
      effects.lightCone.position.set(0, -0.3, 1.5);
      effects.lightCone.rotation.x = Math.PI / 6; // Inclinado para baixo
      
      // Halo no chão à frente
      effects.halo.position.set(0, -2.8, 2);
      effects.halo.rotation.x = -Math.PI / 2;
    }
    
    // Adicionar ao grupo da lâmpada (posição relativa)
    lampGroup.add(effects.lightCone);
    lampGroup.add(effects.halo);
    
    // Animar efeitos modernos
    this.animateModernAtmosphereEffects(lampId, effects);
    
    return effects;
  }

  /**
   * Animar efeitos atmosféricos modernos
   */
  animateModernAtmosphereEffects(lampId, effects) {
    const animate = () => {
      if (!this.lamps.has(lampId)) return;
      
      const time = Date.now() * 0.0008; // Movimento mais lento e sutil
      
      // Rotação muito suave do halo
      if (effects.halo) {
        effects.halo.rotation.z = time * 0.05;
        
        // Pulsação muito sutil
        const pulse = 1 + Math.sin(time * 1.5) * 0.05;
        effects.halo.scale.setScalar(pulse);
      }
      
      // Movimento quase imperceptível do cone
      if (effects.lightCone) {
        effects.lightCone.rotation.y = time * 0.02;
        
        // Variação mínima na opacidade
        const opacity = 0.06 + Math.sin(time * 0.8) * 0.02;
        effects.lightCone.material.opacity = opacity;
      }
      
      requestAnimationFrame(animate);
    };
    
    animate();
  }

  /**
   * Animar efeitos atmosféricos
   */
  animateAtmosphereEffects(lampId, effects) {
    const animate = () => {
      if (!this.lamps.has(lampId)) return;
      
      const time = Date.now() * 0.001;
      
      // Rotação suave do halo
      if (effects.halo) {
        effects.halo.rotation.z = time * 0.1;
        
        // Pulsação suave
        const pulse = 1 + Math.sin(time * 2) * 0.1;
        effects.halo.scale.setScalar(pulse);
      }
      
      // Movimento sutil do cone de luz
      if (effects.lightCone) {
        effects.lightCone.rotation.y = time * 0.05;
        
        // Variação na opacidade
        const opacity = 0.08 + Math.sin(time * 1.5) * 0.03;
        effects.lightCone.material.opacity = opacity;
      }
      
      requestAnimationFrame(animate);
    };
    
    animate();
  }

  /**
   * Detectar superfície para instalação da lâmpada (teto ou parede)
   */
  detectInstallationSurface(position, direction) {
    const raycaster = new THREE.Raycaster(position, direction);
    raycaster.far = 5.0; // Aumentar distância para detectar superfícies
    
    // Buscar superfícies próximas
    const intersects = raycaster.intersectObjects(this.scene.children, true);
    
    // Verificar se há interseções
    if (!intersects || intersects.length === 0) {
      return null;
    }
    
    for (let intersect of intersects) {
      // Verificar se o intersect é válido e tem face
      if (!intersect || !intersect.face || !intersect.face.normal) {
        continue;
      }
      
      const normal = intersect.face.normal.clone();
      normal.transformDirection(intersect.object.matrixWorld);
      
      // Verificar se é teto (normal apontando para baixo)
      if (normal.y < -0.7) {
        return {
          surface: 'ceiling',
          position: intersect.point,
          normal: normal
        };
      }
      
      // Verificar se é parede (normal horizontal)
      if (Math.abs(normal.y) < 0.4) {
        return {
          surface: 'wall',
          position: intersect.point,
          normal: normal
        };
      }
    }
    
    return null;
  }

  /**
   * Calcular posição ideal para lâmpada baseada na superfície
   */
  calculateOptimalLampPosition(surfaceData, type) {
    // Validar dados da superfície
    if (!surfaceData || !surfaceData.position) {
      console.warn('⚠️ Dados da superfície inválidos, usando posição padrão');
      return { x: 0, y: 2.8, z: 0 };
    }
    
    const { surface, position, normal } = surfaceData;
    const config = this.config.lamp[type] || this.config.lamp.spot;
    
    if (surface === 'ceiling') {
      // Posição ligeiramente abaixo do teto
      const offset = config.offsetFromSurface || 0.15;
      return {
        x: position.x,
        y: position.y - offset,
        z: position.z
      };
    } else if (surface === 'wall') {
      // Posição ligeiramente à frente da parede
      const offset = config.offsetFromSurface || 0.15;
      const safeNormal = normal || new THREE.Vector3(0, 0, 1);
      return {
        x: position.x + safeNormal.x * offset,
        y: position.y,
        z: position.z + safeNormal.z * offset
      };
    }
    
    // Fallback para posição original
    return {
      x: position.x || 0,
      y: position.y || 2.8,
      z: position.z || 0
    };
  }

  /**
   * Animar ligação da lâmpada
   */
  animateLampTurnOn(lampId) {
    const lampData = this.lamps.get(lampId);
    if (!lampData) return;
    
    // Começar com intensidade zero
    if (lampData.mainLight) {
      lampData.mainLight.intensity = 0;
    }
    if (lampData.light) {
      lampData.light.intensity = 0;
    }
    
    // Verificar se LED existe antes de animar (para lâmpadas modernas)
    if (lampData.led && lampData.led.material) {
      lampData.led.material.emissiveIntensity = 0;
    }
    
    // Zerar luzes de rebatimento
    if (lampData.bounceLights) {
      lampData.bounceLights.forEach(bounceLight => {
        if (bounceLight.light) {
          bounceLight.light.intensity = 0;
        }
      });
    }
    
    // Animar crescimento da intensidade
    const startTime = Date.now();
    const duration = 800; // 800ms para ligar
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Curva de animação suave
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      // Aplicar à luz principal focada
      if (lampData.mainLight) {
        lampData.mainLight.intensity = lampData.config.intensity * easeProgress;
      }
      
      // Aplicar às luzes de rebatimento
      if (lampData.bounceLights) {
        lampData.bounceLights.forEach(bounceLight => {
          if (bounceLight.light) {
            const bounceIntensity = lampData.config.bounceIntensity || 0.3;
            bounceLight.light.intensity = bounceIntensity * easeProgress;
          }
        });
      }
      
      // Compatibilidade com sistema antigo
      if (lampData.spotLight) {
        lampData.spotLight.intensity = (lampData.config.intensity * 0.3) * easeProgress;
      }
      
      // Manter compatibilidade com lâmpadas antigas
      if (lampData.light && !lampData.mainLight) {
        lampData.light.intensity = (lampData.config.intensity * 0.7) * easeProgress;
      }
      
      // Aplicar ao LED se existir (pode ser grupo ou mesh único)
      if (lampData.led) {
        if (lampData.led.material) {
          // LED é um mesh único
          lampData.led.material.emissiveIntensity = lampData.config.emissiveIntensity * easeProgress;
        } else if (lampData.led.children) {
          // LED é um grupo - procurar mesh com material LED
          lampData.led.traverse((child) => {
            if (child.isMesh && child.material && child.material.emissive) {
              child.material.emissiveIntensity = lampData.config.emissiveIntensity * easeProgress;
            }
          });
        }
      }
      
      // Pequeno flickering no início
      if (progress < 0.3 && Math.random() < 0.1) {
        if (lampData.mainLight) {
          lampData.mainLight.intensity *= 0.7;
        }
        if (lampData.bounceLights) {
          lampData.bounceLights.forEach(bounceLight => {
            if (bounceLight.light) {
              bounceLight.light.intensity *= 0.7;
            }
          });
        }
        if (lampData.spotLight) {
          lampData.spotLight.intensity *= 0.7;
        }
        // Compatibilidade com lâmpadas antigas
        if (lampData.light && !lampData.mainLight) {
          lampData.light.intensity *= 0.7;
        }
        // Flickering do LED
        if (lampData.led) {
          if (lampData.led.material) {
            lampData.led.material.emissiveIntensity *= 0.7;
          } else if (lampData.led.children) {
            lampData.led.traverse((child) => {
              if (child.isMesh && child.material && child.material.emissive) {
                child.material.emissiveIntensity *= 0.7;
              }
            });
          }
        }
      }
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        console.log(`💡✨ Lâmpada '${lampId}' totalmente ligada`);
      }
    };
    
    animate();
  }

  /**
   * Alternar lâmpada (ligar/desligar)
   */
  toggleLamp(lampId) {
    const lampData = this.lamps.get(lampId);
    if (!lampData) {
      console.error(`❌ Lâmpada '${lampId}' não encontrada`);
      return false;
    }
    
    lampData.isOn = !lampData.isOn;
    
    if (lampData.isOn) {
      this.animateLampTurnOn(lampId);
      console.log(`💡🔛 Lâmpada '${lampId}' ligada`);
    } else {
      this.animateLampTurnOff(lampId);
      console.log(`💡🔲 Lâmpada '${lampId}' desligada`);
    }
    
    return true;
  }

  /**
   * Animar desligamento da lâmpada
   */
  animateLampTurnOff(lampId) {
    const lampData = this.lamps.get(lampId);
    if (!lampData) return;
    
    const startIntensity = lampData.mainLight ? lampData.mainLight.intensity : (lampData.light ? lampData.light.intensity : 0);
    let startEmissive = 0;
    
    // Armazenar intensidades iniciais das luzes de rebatimento
    if (lampData.bounceLights) {
      lampData.bounceLights.forEach(bounceLight => {
        if (bounceLight.light) {
          bounceLight.startIntensity = bounceLight.light.intensity;
        }
      });
    }
    
    // Verificar se LED existe e obter intensidade inicial
    if (lampData.led) {
      if (lampData.led.material) {
        startEmissive = lampData.led.material.emissiveIntensity;
      } else if (lampData.led.children) {
        // Procurar primeiro LED no grupo
        lampData.led.traverse((child) => {
          if (child.isMesh && child.material && child.material.emissive && startEmissive === 0) {
            startEmissive = child.material.emissiveIntensity;
          }
        });
      }
    }
    
    const startTime = Date.now();
    const duration = 300; // 300ms para desligar
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Curva de desligamento
      const fadeProgress = 1 - progress;
      
      // Desligar luz principal
      if (lampData.mainLight) {
        lampData.mainLight.intensity = startIntensity * fadeProgress;
      }
      
      // Desligar luzes de rebatimento
      if (lampData.bounceLights) {
        lampData.bounceLights.forEach(bounceLight => {
          if (bounceLight.light && bounceLight.startIntensity !== undefined) {
            bounceLight.light.intensity = bounceLight.startIntensity * fadeProgress;
          }
        });
      }
      
      // Desligar luz spot
      if (lampData.spotLight) {
        lampData.spotLight.intensity = (startIntensity * 0.3) * fadeProgress;
      }
      
      // Compatibilidade com lâmpadas antigas
      if (lampData.light && !lampData.mainLight) {
        lampData.light.intensity = startIntensity * fadeProgress;
      }
      
      // Desligar LED
      if (lampData.led) {
        if (lampData.led.material) {
          lampData.led.material.emissiveIntensity = startEmissive * fadeProgress;
        } else if (lampData.led.children) {
          lampData.led.traverse((child) => {
            if (child.isMesh && child.material && child.material.emissive) {
              child.material.emissiveIntensity = startEmissive * fadeProgress;
            }
          });
        }
      }
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    animate();
  }

  /**
   * Alterar tipo da lâmpada (quente/fria)
   */
  setLampType(lampId, type) {
    const lampData = this.lamps.get(lampId);
    if (!lampData) {
      console.error(`❌ Lâmpada '${lampId}' não encontrada`);
      return false;
    }
    
    if (!this.config.lighting[type]) {
      console.error(`❌ Tipo de luz '${type}' inválido`);
      return false;
    }
    
    console.log(`💡🔄 Alterando lâmpada '${lampId}' para tipo '${type}'`);
    
    // Atualizar configuração
    const newConfig = this.config.lighting[type];
    lampData.type = type;
    lampData.config = { ...newConfig };
    
    // Atualizar material do LED se existir
    if (lampData.led && lampData.led.material) {
      lampData.led.material = this.materialCache.get(`led_${type}`);
    }
    
    // Atualizar luz
    lampData.light.color.setHex(newConfig.color);
    lampData.light.intensity = lampData.isOn ? newConfig.intensity : 0;
    lampData.light.distance = newConfig.distance;
    lampData.light.decay = newConfig.decay;
    
    // Atualizar efeitos atmosféricos
    this.updateAtmosphereEffects(lampId, type);
    
    console.log(`✅ Lâmpada '${lampId}' alterada para '${type}'`);
    return true;
  }

  /**
   * Atualizar efeitos atmosféricos
   */
  updateAtmosphereEffects(lampId, type) {
    const effects = this.atmosphereEffects.get(lampId);
    const lightConfig = this.config.lighting[type];
    
    if (effects && lightConfig) {
      // Atualizar cores dos efeitos
      if (effects.lightCone) {
        effects.lightCone.material.color.setHex(lightConfig.atmosphereColor);
      }
      if (effects.halo) {
        effects.halo.material.color.setHex(lightConfig.atmosphereColor);
      }
    }
  }

  /**
   * Definir intensidade da lâmpada
   */
  setLampIntensity(lampId, intensity) {
    const lampData = this.lamps.get(lampId);
    if (!lampData) {
      console.error(`❌ Lâmpada '${lampId}' não encontrada`);
      return false;
    }
    
    intensity = Math.max(0, Math.min(intensity, 5)); // Limitar entre 0 e 5
    
    lampData.config.intensity = intensity;
    if (lampData.isOn) {
      lampData.light.intensity = intensity;
    }
    
    console.log(`💡🔆 Intensidade da lâmpada '${lampId}' ajustada para ${intensity}`);
    return true;
  }

  /**
   * Remover lâmpada
   */
  removeLamp(lampId) {
    const lampData = this.lamps.get(lampId);
    if (!lampData) {
      console.error(`❌ Lâmpada '${lampId}' não encontrada`);
      return false;
    }
    
    console.log(`💡🗑️ Removendo lâmpada '${lampId}'`);
    
    // Remover da cena
    this.scene.remove(lampData.group);
    
    // Remover efeitos atmosféricos
    const effects = this.atmosphereEffects.get(lampId);
    if (effects) {
      if (effects.lightCone) this.scene.remove(effects.lightCone);
      if (effects.halo) this.scene.remove(effects.halo);
    }
    
    // Limpar registros
    this.lamps.delete(lampId);
    this.lightSources.delete(lampId);
    this.atmosphereEffects.delete(lampId);
    
    console.log(`✅ Lâmpada '${lampId}' removida com sucesso`);
    return true;
  }

  /**
   * Listar todas as lâmpadas
   */
  getLamps() {
    const lamps = [];
    for (const [id, lampData] of this.lamps) {
      lamps.push({
        id: id,
        type: lampData.type,
        isOn: lampData.isOn,
        position: lampData.position,
        intensity: lampData.config.intensity
      });
    }
    return lamps;
  }

  /**
   * Animar partículas de poeira
   */
  animateDustParticles() {
    if (!this.dustParticles) return;
    
    const animate = () => {
      const time = Date.now() * 0.0005;
      const positions = this.dustParticles.geometry.attributes.position;
      
      for (let i = 0; i < positions.count; i++) {
        const i3 = i * 3;
        
        // Movimento sutil das partículas
        positions.array[i3 + 1] += 0.01; // Movimento ascendente
        
        // Reset quando muito alto
        if (positions.array[i3 + 1] > 5) {
          positions.array[i3 + 1] = 0;
        }
        
        // Movimento lateral sutil
        positions.array[i3] += Math.sin(time + i) * 0.002;
        positions.array[i3 + 2] += Math.cos(time + i) * 0.002;
      }
      
      positions.needsUpdate = true;
      requestAnimationFrame(animate);
    };
    
    animate();
  }

  /**
   * Configurar ambiente global
   */
  setGlobalAmbient(intensity) {
    this.scene.traverse((child) => {
      if (child.isLight && child.type === 'AmbientLight') {
        child.intensity = intensity;
      }
    });
    
    console.log(`🌍 Luz ambiente global ajustada para ${intensity}`);
  }

  /**
   * Habilitar/desabilitar efeitos atmosféricos
   */
  enableAtmosphereEffects(enabled) {
    for (const effects of this.atmosphereEffects.values()) {
      if (effects.lightCone) effects.lightCone.visible = enabled;
      if (effects.halo) effects.halo.visible = enabled;
    }
    
    if (this.dustParticles) {
      this.dustParticles.visible = enabled;
    }
    
    console.log(`✨ Efeitos atmosféricos ${enabled ? 'habilitados' : 'desabilitados'}`);
  }

  /**
   * Presets de iluminação
   */
  warmLighting() {
    console.log('🔥 Aplicando preset de iluminação quente');
    this.setGlobalAmbient(0.05);
    // Adicionar lógica para converter lâmpadas existentes
  }

  coolLighting() {
    console.log('❄️ Aplicando preset de iluminação fria');
    this.setGlobalAmbient(0.1);
    // Adicionar lógica para converter lâmpadas existentes
  }

  mixedLighting() {
    console.log('🌈 Aplicando preset de iluminação mista');
    this.setGlobalAmbient(0.08);
    // Adicionar lógica para mix de lâmpadas
  }

  /**
   * Debug do sistema de iluminação
   */
  debugLightingSystem() {
    console.log('💡🔍 === DEBUG SISTEMA DE ILUMINAÇÃO ===');
    console.log('Lâmpadas:', this.getLamps());
    console.log('Fontes de luz:', this.lightSources.size);
    console.log('Efeitos atmosféricos:', this.atmosphereEffects.size);
    console.log('Cache de materiais:', this.materialCache.size);
    
    // Stats de performance
    let totalLights = 0;
    this.scene.traverse((child) => {
      if (child.isLight) totalLights++;
    });
    
    console.log('Total de luzes na cena:', totalLights);
  }
}