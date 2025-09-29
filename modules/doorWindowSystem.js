/**
 * Sistema Modular de Portas e Janelas
 * Permite criar portas e janelas funcionais que abrem/fecham e controlam entrada de luz
 */

export class DoorWindowSystem {
  constructor(scene, roomConfigSystem) {
    this.scene = scene;
    this.roomConfigSystem = roomConfigSystem;
    
    // Configurações padrão
    this.config = {
      door: {
        width: 0.9,      // Largura padrão da porta
        height: 2.1,     // Altura padrão da porta
        thickness: 0.05, // Espessura da porta
        frameWidth: 0.1, // Largura do batente
        openAngle: Math.PI / 2, // Ângulo de abertura (90°)
        animationSpeed: 1000 // Velocidade da animação (ms)
      },
      window: {
        width: 1.2,      // Largura padrão da janela
        height: 1.0,     // Altura padrão da janela
        thickness: 0.05, // Espessura do vidro
        frameWidth: 0.08, // Largura do caixilho
        openAngle: Math.PI / 4, // Ângulo de abertura (45°)
        animationSpeed: 800, // Velocidade da animação (ms)
        lightTransmission: 0.7 // Transmissão de luz através do vidro
      },
      lighting: {
        ambientDarkness: 0.0,  // SEM luz ambiente (escuridão total)
        sunIntensity: 3.0,     // Sol muito intenso para contraste dramático
        fillIntensity: 1.5,    // Luz de preenchimento intensa
        volumetricIntensity: 0.8, // Luz volumétrica (raios de sol)
        shadowQuality: 4096,   // Sombras de altíssima qualidade
        lightDecay: 2.0        // Decaimento natural da luz
      }
    };
    
    // Elementos criados
    this.doors = new Map();
    this.windows = new Map();
    this.lightSources = new Map(); // Luzes que entram pelas aberturas
    
    // Estado das animações
    this.animations = new Map();
    
    // Configurar ambiente escuro inicial
    this.setupDarkEnvironment();
    
    // Integrar com sistema floating-bar para controle de luz
    this.integrateWithFloatingBar();
    
    // Expor controle de luz globalmente para debug
    window.doorWindowLighting = {
      updateTime: (time) => this.updateLightDirection(time, this.currentDirection),
      updateDirection: (direction) => this.updateLightDirection(this.currentTime, direction),
      getCurrentIntensity: () => this.getCurrentSunIntensity(),
      forceUpdate: () => this.updateLightDirection(this.currentTime, this.currentDirection)
    };
    
    console.log('🚪 Sistema de Portas e Janelas inicializado com ambiente escuro');
    console.log('🎛️ Controles de debug disponíveis em window.doorWindowLighting');
  }

  /**
   * Configurar ambiente completamente escuro - remover TODA luz artificial
   */
  setupDarkEnvironment() {
    // Remover TODAS as luzes existentes da cena
    const lightsToRemove = [];
    this.scene.traverse((child) => {
      if (child.isLight && !child.userData.isNaturalLight) {
        lightsToRemove.push(child);
      }
    });
    
    // Remover todas as luzes artificiais
    lightsToRemove.forEach(light => {
      console.log(`🗑️ Removendo luz artificial: ${light.type}`);
      if (light.parent) {
        light.parent.remove(light);
      } else {
        this.scene.remove(light);
      }
    });
    
    // Remover luzes do floating-bar se existirem
    this.removeFloatingBarLights();
    
    // Configurar materiais para não emitirem luz
    this.setupDarkMaterials();
    
    // Configurar renderer para escuridão total
    if (this.scene.userData.renderer) {
      const renderer = this.scene.userData.renderer;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.shadowMap.autoUpdate = true;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.3; // Exposição muito baixa
      console.log('🌑 Renderer configurado para escuridão total');
    }
    
    console.log('🖤 Ambiente completamente escuro configurado - apenas luz natural das aberturas');
  }

  /**
   * Remover luzes do sistema floating-bar
   */
  removeFloatingBarLights() {
    // Procurar e remover luzes do room mode
    const roomLights = [];
    this.scene.traverse((child) => {
      if (child.userData && (
        child.userData.isRoomLight || 
        child.name && child.name.includes('room') ||
        child.name && child.name.includes('Light')
      )) {
        roomLights.push(child);
      }
    });
    
    roomLights.forEach(light => {
      console.log(`🗑️ Removendo luz do room mode: ${light.name || light.type}`);
      if (light.parent) {
        light.parent.remove(light);
      } else {
        this.scene.remove(light);
      }
    });
  }

  /**
   * Configurar materiais para ambiente escuro
   */
  setupDarkMaterials() {
    this.scene.traverse((child) => {
      if (child.isMesh && child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        
        materials.forEach(material => {
          if (material.emissive) {
            // Remover qualquer emissão de luz dos materiais
            material.emissive.setHex(0x000000);
            material.emissiveIntensity = 0;
          }
          
          // Tornar materiais mais responsivos à luz
          if (material.roughness !== undefined) {
            material.roughness = Math.max(material.roughness, 0.7);
          }
        });
      }
    });
    
    console.log('🎨 Materiais configurados para ambiente escuro');
  }

  /**
   * Integrar com sistema floating-bar para controle de direção da luz
   */
  integrateWithFloatingBar() {
    // Configurar valores padrão para funcionar independentemente
    this.currentTime = 12; // Meio-dia
    this.currentDirection = 180; // Sul (luz vindo do sul)
    
    // Criar controles de luz no floating-bar existente
    this.createLightingControls();
    
    console.log('🌅 Sistema de controle de luz natural criado');
    console.log(`   ☀️ Horário inicial: ${this.currentTime}h`);
    console.log(`   🧭 Direção inicial: ${this.currentDirection}° (Sul)`);
  }

  /**
   * Criar controles de iluminação no floating-bar
   */
  createLightingControls() {
    const topBar = document.getElementById('top-bar');
    if (!topBar) {
      console.warn('⚠️ Top bar não encontrado para adicionar controles de luz');
      return;
    }

    // Controle de horário (mesmo estilo do time-of-day-slider)
    const timeContainer = document.createElement('div');
    timeContainer.id = 'natural-light-time-container';
    timeContainer.style.cssText = `
      display: flex;
      align-items: center;
      gap: 10px;
      margin-left: 16px;
      width: 200px;
    `;

    const timeSlider = document.createElement('input');
    timeSlider.type = 'range';
    timeSlider.id = 'natural-light-time';
    timeSlider.min = '0';
    timeSlider.max = '24';
    timeSlider.step = '0.5';
    timeSlider.value = '12';
    timeSlider.className = 'natural-light-slider';

    const timeValue = document.createElement('span');
    timeValue.id = 'natural-light-time-display';
    timeValue.textContent = '12:00';
    timeValue.className = 'natural-light-display';

    // Controle de direção (mesmo estilo do time-of-day-slider)
    const directionContainer = document.createElement('div');
    directionContainer.id = 'natural-light-direction-container';
    directionContainer.style.cssText = `
      display: flex;
      align-items: center;
      gap: 10px;
      margin-left: 16px;
      width: 200px;
    `;

    const directionSlider = document.createElement('input');
    directionSlider.type = 'range';
    directionSlider.id = 'natural-light-direction';
    directionSlider.min = '0';
    directionSlider.max = '360';
    directionSlider.step = '15';
    directionSlider.value = '180';
    directionSlider.className = 'natural-light-slider';

    const directionValue = document.createElement('span');
    directionValue.id = 'natural-light-direction-display';
    directionValue.textContent = 'Sul';
    directionValue.className = 'natural-light-display';

    // Montar estrutura
    timeContainer.appendChild(timeSlider);
    timeContainer.appendChild(timeValue);

    directionContainer.appendChild(directionSlider);
    directionContainer.appendChild(directionValue);

    // Adicionar ao top bar
    topBar.appendChild(timeContainer);
    topBar.appendChild(directionContainer);

    // Configurar event listeners
    this.setupLightingEventListeners(timeSlider, directionSlider, timeValue, directionValue);

    console.log('🎛️ Controles de luz natural adicionados ao floating-bar');
  }

  /**
   * Configurar event listeners para os controles de iluminação
   */
  setupLightingEventListeners(timeSlider, directionSlider, timeValue, directionValue) {
    // Event listener para horário
    timeSlider.addEventListener('input', (e) => {
      const time = parseFloat(e.target.value);
      this.currentTime = time;
      
      // Atualizar display do horário
      const hours = Math.floor(time);
      const minutes = Math.floor((time - hours) * 60);
      timeValue.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      
      // Atualizar iluminação
      this.updateLightDirection(time, this.currentDirection);
      
      console.log(`🕐 Horário alterado para: ${time.toFixed(1)}h`);
    });

    // Event listener para direção
    directionSlider.addEventListener('input', (e) => {
      const direction = parseFloat(e.target.value);
      this.currentDirection = direction;
      
      // Atualizar display da direção
      const directionNames = {
        0: 'Norte', 45: 'NE', 90: 'Leste', 135: 'SE',
        180: 'Sul', 225: 'SO', 270: 'Oeste', 315: 'NO'
      };
      
      const closestDirection = Object.keys(directionNames).reduce((prev, curr) => 
        Math.abs(curr - direction) < Math.abs(prev - direction) ? curr : prev
      );
      
      directionValue.textContent = directionNames[closestDirection] || `${direction}°`;
      
      // Atualizar iluminação
      this.updateLightDirection(this.currentTime, direction);
      
      console.log(`🧭 Direção alterada para: ${direction}° (${directionValue.textContent})`);
    });

    console.log('🎛️ Event listeners configurados para controles de luz natural');
  }

  /**
   * Sincronizar com iluminação atual do floating-bar
   */
  syncWithCurrentLighting() {
    if (this.externalLightingSystem) {
      // Obter configurações atuais do sistema externo
      const currentTime = this.externalLightingSystem.currentTime || 12; // Meio-dia padrão
      const currentDirection = this.externalLightingSystem.currentDirection || 0; // Norte padrão
      
      this.updateLightDirection(currentTime, currentDirection);
      console.log(`🔄 Sincronizado com iluminação externa: tempo=${currentTime}, direção=${currentDirection}`);
    }
  }

  /**
   * Atualizar direção da luz natural baseada no horário e direção
   */
  updateLightDirection(timeValue, directionValue) {
    // Calcular posição do sol baseada no horário (0-24h)
    const time = timeValue !== null ? timeValue : (this.currentTime || 12);
    const direction = directionValue !== null ? directionValue : (this.currentDirection || 0);
    
    // Armazenar valores atuais
    this.currentTime = time;
    this.currentDirection = direction;
    
    // Calcular ângulo do sol baseado no horário
    const sunAngle = ((time - 6) / 12) * Math.PI; // 6h = nascer, 18h = pôr do sol
    const sunHeight = Math.sin(sunAngle) * 8; // Altura máxima de 8 metros
    const sunIntensity = Math.max(0, Math.sin(sunAngle)); // Intensidade baseada na altura
    
    // Calcular direção baseada no controle de direção (0-360°)
    const directionRadians = (direction * Math.PI) / 180;
    
    // Atualizar todas as luzes naturais
    this.lightSources.forEach((lightGroup, key) => {
      if (lightGroup.userData.isNaturalLight) {
        this.updateNaturalLightPosition(lightGroup, sunHeight, directionRadians, sunIntensity);
      }
    });
    
    console.log(`☀️ Luz natural atualizada: tempo=${time.toFixed(1)}h, direção=${direction.toFixed(0)}°, intensidade=${sunIntensity.toFixed(2)}`);
  }

  /**
   * Atualizar posição e intensidade de uma luz natural
   */
  updateNaturalLightPosition(lightGroup, sunHeight, directionRadians, sunIntensity) {
    const sunLight = lightGroup.userData.sunLight;
    const volumetricLight = lightGroup.userData.volumetricLight;
    const fillLight = lightGroup.userData.fillLight;
    
    if (sunLight) {
      // Calcular nova posição do sol
      const distance = 15; // Distância do sol
      const sunX = Math.sin(directionRadians) * distance;
      const sunZ = Math.cos(directionRadians) * distance;
      const sunY = Math.max(sunHeight, 2); // Altura mínima de 2m
      
      // Atualizar posição da luz solar
      const wallPosition = this.getWallPositionFromLight(lightGroup);
      sunLight.position.set(
        wallPosition.x + sunX,
        wallPosition.y + sunY,
        wallPosition.z + sunZ
      );
      
      // Atualizar intensidade baseada no horário
      const baseIntensity = lightGroup.userData.isWindowLight ? 
        this.config.lighting.sunIntensity : 
        this.config.lighting.sunIntensity * 0.8;
      
      sunLight.intensity = baseIntensity * sunIntensity;
      
      // Atualizar outras luzes proporcionalmente
      if (volumetricLight) {
        volumetricLight.intensity = this.config.lighting.volumetricIntensity * sunIntensity;
      }
      if (fillLight) {
        fillLight.intensity = this.config.lighting.fillIntensity * sunIntensity;
      }
    }
  }

  /**
   * Obter posição da parede a partir do grupo de luz
   */
  getWallPositionFromLight(lightGroup) {
    const wallName = lightGroup.userData.wallName;
    const position = lightGroup.userData.position;
    return this.getWallPosition(wallName, position);
  }

  /**
   * Obter intensidade atual do sol baseada no horário
   */
  getCurrentSunIntensity() {
    const time = this.currentTime !== undefined ? this.currentTime : 12; // Meio-dia padrão
    
    // Calcular ângulo do sol (6h = nascer, 18h = pôr do sol)
    const sunAngle = ((time - 6) / 12) * Math.PI;
    let intensity = Math.max(0, Math.sin(sunAngle));
    
    // Garantir intensidade mínima durante o dia (6h-18h)
    if (time >= 6 && time <= 18 && intensity < 0.3) {
      intensity = 0.3; // Intensidade mínima durante o dia
    }
    
    // Se for noite (antes das 6h ou depois das 18h), intensidade muito baixa mas não zero
    if (time < 6 || time > 18) {
      intensity = 0.1; // Luz da lua/crepúsculo
    }
    
    console.log(`🌅 Intensidade solar calculada: ${intensity.toFixed(2)} (horário: ${time.toFixed(1)}h)`);
    return intensity;
  }

  /**
   * Criar uma porta em uma parede específica
   */
  createDoor(id, wallName, position = { x: 0, y: 0 }, config = {}) {
    const doorConfig = { ...this.config.door, ...config };
    const wall = this.findWall(wallName);
    
    if (!wall) {
      console.error(`❌ Parede '${wallName}' não encontrada`);
      return null;
    }

    // Ajustar posição da porta para ficar no chão (y = 0 na base)
    const doorPosition = { 
      x: position.x, 
      y: 0 // Porta sempre no chão
    };

    // Criar abertura na parede (no chão)
    const opening = this.createWallOpening(wall, wallName, doorConfig.width, doorConfig.height, doorPosition);
    
    // Criar batente da porta
    const frame = this.createDoorFrame(wallName, doorPosition, doorConfig);
    
    // Criar folha da porta
    const doorLeaf = this.createDoorLeaf(wallName, doorPosition, doorConfig);
    
    // Criar grupo da porta
    const doorGroup = new THREE.Group();
    doorGroup.add(frame);
    doorGroup.add(doorLeaf);
    doorGroup.userData.isDoor = true;
    doorGroup.userData.doorId = id;
    doorGroup.userData.isOpen = false;
    doorGroup.userData.wallName = wallName;
    
    // Adicionar à cena
    this.scene.add(doorGroup);
    
    // Criar fonte de luz natural da porta (quando aberta)
    const lightSource = this.createDoorLight(wallName, doorPosition, doorConfig);
    
    // Armazenar referência
    this.doors.set(id, {
      group: doorGroup,
      leaf: doorLeaf,
      frame: frame,
      opening: opening,
      lightSource: lightSource,
      config: doorConfig,
      wallName: wallName,
      position: doorPosition, // Usar posição ajustada
      isOpen: false
    });
    
    console.log(`🚪 Porta '${id}' criada na parede '${wallName}' no chão`);
    return doorGroup;
  }

  /**
   * Criar uma janela em uma parede específica
   */
  createWindow(id, wallName, position = { x: 0, y: 1.2 }, config = {}) {
    const windowConfig = { ...this.config.window, ...config };
    const wall = this.findWall(wallName);
    
    if (!wall) {
      console.error(`❌ Parede '${wallName}' não encontrada`);
      return null;
    }

    // Ajustar posição da janela para ficar sempre acima do primeiro bloco (1m do chão)
    const windowPosition = { 
      x: position.x, 
      y: Math.max(position.y, 1.0 + windowConfig.height / 2) // Mínimo 1m do chão + metade da altura
    };

    // Criar abertura na parede para janela
    console.log(`🪟 Criando abertura para janela '${id}' na parede '${wallName}'`);
    console.log(`   Dimensões: ${windowConfig.width}x${windowConfig.height}m`);
    console.log(`   Posição: x=${windowPosition.x}, y=${windowPosition.y}`);
    const opening = this.createWallOpening(wall, wallName, windowConfig.width, windowConfig.height, windowPosition);
    
    if (!opening) {
      console.error(`❌ Falha ao criar abertura para janela '${id}'`);
      return null;
    }
    
    // Criar caixilho da janela
    const frame = this.createWindowFrame(wallName, windowPosition, windowConfig);
    
    // Criar vidro da janela
    const glass = this.createWindowGlass(wallName, windowPosition, windowConfig);
    
    // Criar folhas da janela (se for do tipo que abre)
    const windowLeaves = this.createWindowLeaves(wallName, windowPosition, windowConfig);
    
    // Criar grupo da janela
    const windowGroup = new THREE.Group();
    windowGroup.add(frame);
    windowGroup.add(glass);
    if (windowLeaves) windowGroup.add(windowLeaves);
    windowGroup.userData.isWindow = true;
    windowGroup.userData.windowId = id;
    windowGroup.userData.isOpen = false;
    windowGroup.userData.wallName = wallName;
    
    // Adicionar à cena
    this.scene.add(windowGroup);
    
    // Criar fonte de luz natural da janela
    const lightSource = this.createWindowLight(wallName, windowPosition, windowConfig);
    
    // Armazenar referência
    this.windows.set(id, {
      group: windowGroup,
      glass: glass,
      leaves: windowLeaves,
      frame: frame,
      opening: opening,
      lightSource: lightSource,
      config: windowConfig,
      wallName: wallName,
      position: windowPosition, // Usar posição ajustada
      isOpen: false
    });
    
    console.log(`🪟 Janela '${id}' criada na parede '${wallName}' acima do primeiro bloco (${windowPosition.y.toFixed(1)}m)`);
    return windowGroup;
  }

  /**
   * Abrir/fechar porta com animação
   */
  toggleDoor(doorId) {
    const door = this.doors.get(doorId);
    if (!door) {
      console.error(`❌ Porta '${doorId}' não encontrada`);
      return;
    }

    const targetAngle = door.isOpen ? 0 : door.config.openAngle;
    door.isOpen = !door.isOpen;
    
    // Animar abertura/fechamento
    this.animateRotation(door.leaf, targetAngle, door.config.animationSpeed, 'y');
    
    // Atualizar iluminação se necessário
    this.updateDoorLighting(doorId, door.isOpen);
    
    console.log(`🚪 Porta '${doorId}' ${door.isOpen ? 'aberta' : 'fechada'}`);
  }

  /**
   * Abrir/fechar janela com animação
   */
  toggleWindow(windowId) {
    const window = this.windows.get(windowId);
    if (!window) {
      console.error(`❌ Janela '${windowId}' não encontrada`);
      return;
    }

    const targetAngle = window.isOpen ? 0 : window.config.openAngle;
    window.isOpen = !window.isOpen;
    
    // Animar abertura/fechamento das folhas
    if (window.leaves) {
      this.animateRotation(window.leaves, targetAngle, window.config.animationSpeed, 'y');
    }
    
    // Atualizar iluminação
    this.updateWindowLighting(windowId, window.isOpen);
    
    console.log(`🪟 Janela '${windowId}' ${window.isOpen ? 'aberta' : 'fechada'}`);
  }

  /**
   * Encontrar parede pelo nome
   */
  findWall(wallName) {
    if (!this.roomConfigSystem || !this.roomConfigSystem.roomElements) {
      return null;
    }
    
    return this.roomConfigSystem.roomElements.walls.find(
      wall => wall.userData.wallName === wallName
    );
  }

  /**
   * Criar abertura real na parede
   */
  createWallOpening(wall, wallName, width, height, position) {
    if (!wall) return null;
    
    // Verificar se a parede tem parâmetros de geometria
    if (!wall.geometry || !wall.geometry.parameters) {
      console.error(`❌ Geometria da parede ${wallName} não tem parâmetros válidos`);
      return null;
    }
    
    // Obter dimensões da parede original
    const wallGeometry = wall.geometry;
    const wallWidth = wallGeometry.parameters.width;
    const wallHeight = wallGeometry.parameters.height;
    const wallDepth = wallGeometry.parameters.depth;
    
    console.log(`📐 Dimensões da parede ${wallName}: ${wallWidth}x${wallHeight}x${wallDepth}`);
    
    // Verificar se as dimensões são válidas
    if (!wallWidth || !wallHeight || !wallDepth) {
      console.error(`❌ Dimensões inválidas da parede ${wallName}`);
      return null;
    }
    
    // Criar nova geometria da parede com abertura usando CSG
    const newWallGeometry = this.createWallWithOpening(
      wallWidth, wallHeight, wallDepth, 
      width, height, position, wallName
    );
    
    if (!newWallGeometry) {
      console.error(`❌ Falha ao criar geometria com abertura para ${wallName}`);
      return null;
    }
    
    // Substituir geometria da parede
    const oldGeometry = wall.geometry;
    wall.geometry = newWallGeometry;
    oldGeometry.dispose();
    
    // Marcar que esta parede tem abertura
    wall.userData.hasOpening = true;
    wall.userData.openingData = { width, height, position, wallName };
    
    console.log(`🕳️ Abertura criada na parede ${wallName}: ${width}x${height}m`);
    return wall;
  }

  /**
   * Criar geometria de parede com abertura usando Shape e Path
   */
  createWallWithOpening(wallWidth, wallHeight, wallDepth, openingWidth, openingHeight, position, wallName) {
    try {
      // Validar parâmetros
      if (!wallWidth || !wallHeight || !wallDepth || !openingWidth || !openingHeight) {
        console.error('❌ Parâmetros inválidos para criar abertura');
        return null;
      }

      // Criar shape da parede completa
      const wallShape = new THREE.Shape();
      wallShape.moveTo(-wallWidth / 2, -wallHeight / 2);
      wallShape.lineTo(wallWidth / 2, -wallHeight / 2);
      wallShape.lineTo(wallWidth / 2, wallHeight / 2);
      wallShape.lineTo(-wallWidth / 2, wallHeight / 2);
      wallShape.lineTo(-wallWidth / 2, -wallHeight / 2);
      
      // Criar hole (buraco) para a abertura
      const openingHole = new THREE.Path();
      const openingX = position.x;
      
      // Para portas (y = 0), posicionar abertura a partir do chão
      // Para janelas (y > 0), usar posição especificada
      let openingBottom, openingTop;
      
      if (position.y === 0) {
        // Porta: abertura começa no chão (-wallHeight/2) e vai até a altura da porta
        openingBottom = -wallHeight / 2;
        openingTop = -wallHeight / 2 + openingHeight;
      } else {
        // Janela: usar posição Y especificada
        openingBottom = position.y - openingHeight / 2;
        openingTop = position.y + openingHeight / 2;
      }
      
      // Calcular limites horizontais da abertura
      const left = openingX - openingWidth / 2;
      const right = openingX + openingWidth / 2;
      
      // Garantir que a abertura não ultrapasse os limites da parede
      const clampedLeft = Math.max(left, -wallWidth / 2 + 0.1);
      const clampedRight = Math.min(right, wallWidth / 2 - 0.1);
      const clampedBottom = Math.max(openingBottom, -wallHeight / 2 + 0.1);
      const clampedTop = Math.min(openingTop, wallHeight / 2 - 0.1);
      
      // Verificar se a abertura é válida
      if (clampedRight <= clampedLeft || clampedTop <= clampedBottom) {
        console.error('❌ Abertura inválida: dimensões muito pequenas ou fora dos limites');
        return null;
      }
      
      // Criar o buraco retangular (sentido anti-horário para hole)
      openingHole.moveTo(clampedLeft, clampedBottom);
      openingHole.lineTo(clampedLeft, clampedTop);
      openingHole.lineTo(clampedRight, clampedTop);
      openingHole.lineTo(clampedRight, clampedBottom);
      openingHole.lineTo(clampedLeft, clampedBottom);
      
      // Adicionar o buraco ao shape da parede
      wallShape.holes.push(openingHole);
      
      // Criar geometria extrudada
      const extrudeSettings = {
        depth: wallDepth,
        bevelEnabled: false,
        bevelSize: 0,
        bevelThickness: 0
      };
      
      const geometry = new THREE.ExtrudeGeometry(wallShape, extrudeSettings);
      
      // Centralizar geometria
      geometry.translate(0, 0, -wallDepth / 2);
      
      console.log(`✅ Geometria com abertura criada: ${openingWidth}x${openingHeight}m, Y: ${position.y === 0 ? 'chão' : position.y + 'm'}`);
      
      return geometry;
      
    } catch (error) {
      console.error('❌ Erro ao criar geometria com abertura:', error);
      return null;
    }
  }

  /**
   * Criar batente da porta
   */
  createDoorFrame(wallName, position, config) {
    const frameGroup = new THREE.Group();
    
    // Material do batente
    const frameMaterial = new THREE.MeshLambertMaterial({
      color: 0x8B4513, // Cor madeira
      roughness: 0.8
    });
    
    // Batente superior
    const topFrame = new THREE.Mesh(
      new THREE.BoxGeometry(config.width + config.frameWidth * 2, config.frameWidth, config.frameWidth),
      frameMaterial
    );
    topFrame.position.y = config.height / 2 + config.frameWidth / 2;
    
    // Batentes laterais
    const leftFrame = new THREE.Mesh(
      new THREE.BoxGeometry(config.frameWidth, config.height, config.frameWidth),
      frameMaterial
    );
    leftFrame.position.x = -config.width / 2 - config.frameWidth / 2;
    leftFrame.position.y = config.height / 2; // Centralizar na altura da porta
    
    const rightFrame = new THREE.Mesh(
      new THREE.BoxGeometry(config.frameWidth, config.height, config.frameWidth),
      frameMaterial
    );
    rightFrame.position.x = config.width / 2 + config.frameWidth / 2;
    rightFrame.position.y = config.height / 2; // Centralizar na altura da porta
    
    frameGroup.add(topFrame, leftFrame, rightFrame);
    
    // Posicionar na abertura da parede (no chão)
    const wallPosition = this.getWallPosition(wallName, position);
    wallPosition.y = config.height / 2; // Posicionar com base no chão
    
    // Ajustar posição Z para encaixar perfeitamente na espessura da parede
    if (wallName === 'front' || wallName === 'back') {
      wallPosition.z += (wallName === 'front' ? 0.05 : -0.05); // Pequeno ajuste para encaixe
    } else {
      wallPosition.x += (wallName === 'left' ? 0.05 : -0.05); // Pequeno ajuste para encaixe
    }
    
    frameGroup.position.copy(wallPosition);
    
    return frameGroup;
  }

  /**
   * Criar folha da porta
   */
  createDoorLeaf(wallName, position, config) {
    const doorGeometry = new THREE.BoxGeometry(config.width, config.height, config.thickness);
    const doorMaterial = new THREE.MeshLambertMaterial({
      color: 0x654321, // Cor madeira escura
      roughness: 0.6
    });
    
    const doorLeaf = new THREE.Mesh(doorGeometry, doorMaterial);
    doorLeaf.castShadow = true;
    doorLeaf.receiveShadow = true;
    
    // Ajustar geometria para pivot na lateral esquerda
    doorGeometry.translate(config.width / 2, 0, 0);
    
    // Posicionar exatamente na abertura da parede (no chão)
    const wallPosition = this.getWallPosition(wallName, position);
    wallPosition.y = config.height / 2; // Posicionar com base no chão
    
    // Ajustar posição Z para encaixar perfeitamente na espessura da parede
    if (wallName === 'front' || wallName === 'back') {
      wallPosition.z += (wallName === 'front' ? 0.05 : -0.05); // Pequeno ajuste para encaixe
    } else {
      wallPosition.x += (wallName === 'left' ? 0.05 : -0.05); // Pequeno ajuste para encaixe
    }
    
    // Ajustar posição para encaixar perfeitamente na abertura
    doorLeaf.position.copy(wallPosition);
    doorLeaf.position.x -= config.width / 2; // Pivot na lateral esquerda
    
    return doorLeaf;
  }

  /**
   * Criar caixilho da janela
   */
  createWindowFrame(wallName, position, config) {
    const frameGroup = new THREE.Group();
    
    // Material do caixilho
    const frameMaterial = new THREE.MeshLambertMaterial({
      color: 0xFFFFFF, // Branco
      roughness: 0.4
    });
    
    // Caixilho superior
    const topFrame = new THREE.Mesh(
      new THREE.BoxGeometry(config.width + config.frameWidth * 2, config.frameWidth, config.frameWidth),
      frameMaterial
    );
    topFrame.position.y = config.height / 2 + config.frameWidth / 2;
    
    // Caixilho inferior
    const bottomFrame = new THREE.Mesh(
      new THREE.BoxGeometry(config.width + config.frameWidth * 2, config.frameWidth, config.frameWidth),
      frameMaterial
    );
    bottomFrame.position.y = -config.height / 2 - config.frameWidth / 2;
    
    // Caixilhos laterais
    const leftFrame = new THREE.Mesh(
      new THREE.BoxGeometry(config.frameWidth, config.height, config.frameWidth),
      frameMaterial
    );
    leftFrame.position.x = -config.width / 2 - config.frameWidth / 2;
    
    const rightFrame = new THREE.Mesh(
      new THREE.BoxGeometry(config.frameWidth, config.height, config.frameWidth),
      frameMaterial
    );
    rightFrame.position.x = config.width / 2 + config.frameWidth / 2;
    
    frameGroup.add(topFrame, bottomFrame, leftFrame, rightFrame);
    
    // Posicionar na parede
    const wallPosition = this.getWallPosition(wallName, position);
    frameGroup.position.copy(wallPosition);
    
    return frameGroup;
  }

  /**
   * Criar vidro da janela
   */
  createWindowGlass(wallName, position, config) {
    const glassGeometry = new THREE.PlaneGeometry(config.width, config.height);
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x87CEEB, // Azul claro
      transparent: true,
      opacity: 0.3,
      roughness: 0.0,
      metalness: 0.0,
      transmission: config.lightTransmission,
      side: THREE.DoubleSide
    });
    
    const glass = new THREE.Mesh(glassGeometry, glassMaterial);
    glass.receiveShadow = true;
    
    // Posicionar na parede
    const wallPosition = this.getWallPosition(wallName, position);
    glass.position.copy(wallPosition);
    
    return glass;
  }

  /**
   * Criar folhas da janela (se for do tipo que abre)
   */
  createWindowLeaves(wallName, position, config) {
    if (!config.canOpen) return null;
    
    const leavesGroup = new THREE.Group();
    
    // Material das folhas
    const leafMaterial = new THREE.MeshLambertMaterial({
      color: 0xFFFFFF,
      roughness: 0.4
    });
    
    // Folha esquerda
    const leftLeaf = new THREE.Mesh(
      new THREE.BoxGeometry(config.width / 2, config.height, config.thickness),
      leafMaterial
    );
    leftLeaf.position.x = -config.width / 4;
    
    // Folha direita
    const rightLeaf = new THREE.Mesh(
      new THREE.BoxGeometry(config.width / 2, config.height, config.thickness),
      leafMaterial
    );
    rightLeaf.position.x = config.width / 4;
    
    leavesGroup.add(leftLeaf, rightLeaf);
    
    // Posicionar na parede
    const wallPosition = this.getWallPosition(wallName, position);
    leavesGroup.position.copy(wallPosition);
    
    return leavesGroup;
  }

  /**
   * Criar sistema de iluminação natural avançado para janela
   */
  createWindowLight(wallName, position, config) {
    const lightGroup = new THREE.Group();
    const wallPosition = this.getWallPosition(wallName, position);
    const lightOffset = this.getWallNormal(wallName);
    
    // 1. LUZ SOLAR PRINCIPAL - Muito intensa para escuridão total
    const sunLight = new THREE.DirectionalLight(0xFFF4E6, this.config.lighting.sunIntensity);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = this.config.lighting.shadowQuality;
    sunLight.shadow.mapSize.height = this.config.lighting.shadowQuality;
    sunLight.shadow.camera.near = 0.1;
    sunLight.shadow.camera.far = 100;
    sunLight.shadow.bias = -0.0003;
    sunLight.shadow.normalBias = 0.02;
    
    // Posicionar sol muito distante e alto
    const sunOffset = lightOffset.clone().multiplyScalar(15);
    sunOffset.y += 8; // Sol bem alto para sombras dramáticas
    sunLight.position.copy(wallPosition).add(sunOffset);
    sunLight.target.position.copy(wallPosition);
    
    // Área de sombra muito ampla
    const shadowSize = Math.max(config.width, config.height) * 8;
    sunLight.shadow.camera.left = -shadowSize;
    sunLight.shadow.camera.right = shadowSize;
    sunLight.shadow.camera.top = shadowSize;
    sunLight.shadow.camera.bottom = -shadowSize;
    
    // 2. LUZ VOLUMÉTRICA - Simula raios de sol visíveis
    const volumetricLight = new THREE.SpotLight(0xFFFFAA, this.config.lighting.volumetricIntensity, 25, Math.PI / 4, 0.1, this.config.lighting.lightDecay);
    volumetricLight.castShadow = true;
    volumetricLight.shadow.mapSize.width = 2048;
    volumetricLight.shadow.mapSize.height = 2048;
    volumetricLight.shadow.bias = -0.0002;
    
    // Posicionar na abertura da janela
    volumetricLight.position.copy(wallPosition);
    const volumetricOffset = lightOffset.clone().multiplyScalar(-0.05);
    volumetricLight.position.add(volumetricOffset);
    
    // Direcionar para dentro da sala com ângulo natural
    const roomTarget = new THREE.Vector3(0, -1, 0);
    volumetricLight.target.position.copy(wallPosition).add(roomTarget);
    
    // 3. LUZ DE PREENCHIMENTO - Ilumina áreas não diretamente expostas
    const fillLight = new THREE.SpotLight(0xE6F3FF, this.config.lighting.fillIntensity, 30, Math.PI / 2.5, 0.3, 1.8);
    fillLight.castShadow = true;
    fillLight.shadow.mapSize.width = 1024;
    fillLight.shadow.mapSize.height = 1024;
    
    fillLight.position.copy(wallPosition);
    const fillOffset = lightOffset.clone().multiplyScalar(-0.2);
    fillLight.position.add(fillOffset);
    fillLight.target.position.set(0, -2, 0); // Ilumina o chão
    
    // 4. LUZ DE BOUNCE - Simula luz refletida das superfícies
    const bounceLight = new THREE.PointLight(0xFFF8E1, 0.4, 15, 1.5);
    bounceLight.position.copy(wallPosition);
    bounceLight.position.add(lightOffset.clone().multiplyScalar(-1)); // Dentro da sala
    bounceLight.position.y -= 0.5; // Mais baixo para simular reflexão do chão
    
    // 5. LUZ AMBIENTE LOCAL - Apenas ao redor da janela
    const localAmbient = new THREE.PointLight(0xF0F8FF, 0.2, 8, 2.0);
    localAmbient.position.copy(wallPosition);
    localAmbient.position.add(lightOffset.clone().multiplyScalar(-0.5));
    
    // Marcar todas as luzes como naturais
    [sunLight, volumetricLight, fillLight, bounceLight, localAmbient].forEach(light => {
      light.userData.isNaturalLight = true;
      light.userData.windowId = `window_${wallName}_${position.x}_${position.y}`;
    });
    
    // Inicialmente desligadas (janela fechada - sem luz)
    const transmission = config.lightTransmission;
    sunLight.intensity = 0; // Janela fechada = sem luz
    volumetricLight.intensity = 0;
    fillLight.intensity = 0;
    bounceLight.intensity = 0;
    localAmbient.intensity = 0;
    
    // Adicionar todas as luzes ao grupo
    lightGroup.add(sunLight);
    lightGroup.add(sunLight.target);
    lightGroup.add(volumetricLight);
    lightGroup.add(volumetricLight.target);
    lightGroup.add(fillLight);
    lightGroup.add(fillLight.target);
    lightGroup.add(bounceLight);
    lightGroup.add(localAmbient);
    
    // Metadados do grupo
    lightGroup.userData.sunLight = sunLight;
    lightGroup.userData.volumetricLight = volumetricLight;
    lightGroup.userData.fillLight = fillLight;
    lightGroup.userData.bounceLight = bounceLight;
    lightGroup.userData.localAmbient = localAmbient;
    lightGroup.userData.wallName = wallName;
    lightGroup.userData.position = position;
    lightGroup.userData.isWindowLight = true;
    lightGroup.userData.isNaturalLight = true;
    
    this.scene.add(lightGroup);
    this.lightSources.set(`window_${wallName}_${position.x}_${position.y}`, lightGroup);
    
    console.log(`☀️ Sistema de iluminação natural avançado criado para ${wallName}`);
    console.log(`   - Sol: ${sunLight.intensity.toFixed(2)}, Volumétrica: ${volumetricLight.intensity.toFixed(2)}`);
    console.log(`   - Preenchimento: ${fillLight.intensity.toFixed(2)}, Bounce: ${bounceLight.intensity.toFixed(2)}`);
    
    return lightGroup;
  }

  /**
   * Criar sistema de iluminação natural para porta
   */
  createDoorLight(wallName, position, config) {
    const lightGroup = new THREE.Group();
    const wallPosition = this.getWallPosition(wallName, position);
    const lightOffset = this.getWallNormal(wallName);
    
    // 1. LUZ SOLAR EXTERNA - Para quando a porta estiver aberta
    const sunLight = new THREE.DirectionalLight(0xFFF4E6, this.config.lighting.sunIntensity * 0.8);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = this.config.lighting.shadowQuality;
    sunLight.shadow.mapSize.height = this.config.lighting.shadowQuality;
    sunLight.shadow.camera.near = 0.1;
    sunLight.shadow.camera.far = 100;
    sunLight.shadow.bias = -0.0003;
    
    // Posicionar sol externo à porta
    const sunOffset = lightOffset.clone().multiplyScalar(12);
    sunOffset.y += 6; // Sol alto
    sunLight.position.copy(wallPosition).add(sunOffset);
    sunLight.target.position.copy(wallPosition);
    
    // Área de sombra para porta
    const shadowSize = Math.max(config.width, config.height) * 6;
    sunLight.shadow.camera.left = -shadowSize;
    sunLight.shadow.camera.right = shadowSize;
    sunLight.shadow.camera.top = shadowSize;
    sunLight.shadow.camera.bottom = -shadowSize;
    
    // 2. LUZ DE ENTRADA - Simula luz entrando pela porta aberta
    const entryLight = new THREE.SpotLight(0xFFFFE0, this.config.lighting.fillIntensity * 0.8, 18, Math.PI / 3, 0.2, 1.5);
    entryLight.castShadow = true;
    entryLight.shadow.mapSize.width = 2048;
    entryLight.shadow.mapSize.height = 2048;
    
    entryLight.position.copy(wallPosition);
    const entryOffset = lightOffset.clone().multiplyScalar(-0.1);
    entryLight.position.add(entryOffset);
    entryLight.target.position.set(0, -1, 0); // Direcionar para dentro da sala
    
    // 3. LUZ AMBIENTE DA PORTA - Iluminação local suave
    const doorAmbient = new THREE.PointLight(0xF5F5DC, 0.3, 12, 1.8);
    doorAmbient.position.copy(wallPosition);
    doorAmbient.position.add(lightOffset.clone().multiplyScalar(-0.8));
    
    // Marcar luzes como naturais
    [sunLight, entryLight, doorAmbient].forEach(light => {
      light.userData.isNaturalLight = true;
      light.userData.doorId = `door_${wallName}_${position.x}_${position.y}`;
    });
    
    // Inicialmente desligadas (porta fechada)
    sunLight.intensity = 0;
    entryLight.intensity = 0;
    doorAmbient.intensity = 0;
    
    // Adicionar luzes ao grupo
    lightGroup.add(sunLight);
    lightGroup.add(sunLight.target);
    lightGroup.add(entryLight);
    lightGroup.add(entryLight.target);
    lightGroup.add(doorAmbient);
    
    // Metadados
    lightGroup.userData.sunLight = sunLight;
    lightGroup.userData.entryLight = entryLight;
    lightGroup.userData.doorAmbient = doorAmbient;
    lightGroup.userData.wallName = wallName;
    lightGroup.userData.position = position;
    lightGroup.userData.isDoorLight = true;
    lightGroup.userData.isNaturalLight = true;
    
    this.scene.add(lightGroup);
    this.lightSources.set(`door_${wallName}_${position.x}_${position.y}`, lightGroup);
    
    console.log(`🚪 Sistema de luz natural da porta criado para ${wallName} (inicialmente desligado)`);
    
    return lightGroup;
  }

  /**
   * Obter posição na parede baseada no nome da parede e posição relativa
   */
  getWallPosition(wallName, position) {
    const { width, height, depth } = this.roomConfigSystem.config.dimensions;
    const wallThickness = 0.2;
    
    const pos = new THREE.Vector3();
    
    switch (wallName) {
      case 'front':
        pos.set(position.x, position.y, -depth / 2 - wallThickness / 2);
        break;
      case 'back':
        pos.set(position.x, position.y, depth / 2 + wallThickness / 2);
        break;
      case 'left':
        pos.set(-width / 2 - wallThickness / 2, position.y, position.x);
        break;
      case 'right':
        pos.set(width / 2 + wallThickness / 2, position.y, position.x);
        break;
    }
    
    return pos;
  }

  /**
   * Obter normal da parede (direção para fora)
   */
  getWallNormal(wallName) {
    const normal = new THREE.Vector3();
    
    switch (wallName) {
      case 'front':
        normal.set(0, 0, -1);
        break;
      case 'back':
        normal.set(0, 0, 1);
        break;
      case 'left':
        normal.set(-1, 0, 0);
        break;
      case 'right':
        normal.set(1, 0, 0);
        break;
    }
    
    return normal;
  }

  /**
   * Animar rotação de um objeto
   */
  animateRotation(object, targetAngle, duration, axis = 'y') {
    const startAngle = object.rotation[axis];
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing suave
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      object.rotation[axis] = startAngle + (targetAngle - startAngle) * easeProgress;
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    animate();
  }

  /**
   * Atualizar iluminação natural da porta
   */
  updateDoorLighting(doorId, isOpen) {
    const door = this.doors.get(doorId);
    if (!door || !door.lightSource) return;
    
    const lightGroup = door.lightSource;
    const sunLight = lightGroup.userData.sunLight;
    const entryLight = lightGroup.userData.entryLight;
    const doorAmbient = lightGroup.userData.doorAmbient;
    
    if (isOpen) {
      // PORTA ABERTA: Luz natural controlada pelo floating-bar
      let currentIntensity = this.getCurrentSunIntensity();
      
      // Garantir intensidade mínima para porta aberta
      if (currentIntensity < 0.3) {
        currentIntensity = 0.8; // Intensidade boa para visualização
        console.log(`⚡ Intensidade ajustada para visualização: ${currentIntensity.toFixed(2)}`);
      }
      
      // Aplicar intensidades mais altas para garantir iluminação visível
      sunLight.intensity = this.config.lighting.sunIntensity * currentIntensity;
      entryLight.intensity = this.config.lighting.fillIntensity * currentIntensity;
      doorAmbient.intensity = 0.6 * currentIntensity; // Aumentado para melhor visibilidade
      
      console.log(`🚪 PORTA '${doorId}' ABERTA - Luz natural entrando!`);
      console.log(`   ☀️ Intensidade aplicada: ${currentIntensity.toFixed(2)}`);
      console.log(`   ☀️ Sol: ${sunLight.intensity.toFixed(2)} | 💡 Entrada: ${entryLight.intensity.toFixed(2)} | 🌙 Ambiente: ${doorAmbient.intensity.toFixed(2)}`);
      
      // Sempre aplicar direção da luz
      this.updateLightDirection(this.currentTime, this.currentDirection);
      
      // Forçar atualização do renderer para melhor visibilidade
      this.updateRendererForDarkness(true);
      
    } else {
      // PORTA FECHADA: Sem luz (porta bloqueia completamente)
      sunLight.intensity = 0;
      entryLight.intensity = 0;
      doorAmbient.intensity = 0;
      
      console.log(`🚪 Porta '${doorId}' FECHADA - Luz bloqueada completamente`);
    }
    
    // Atualizar renderer baseado no estado geral de iluminação
    this.updateRendererForDarkness(isOpen);
    
    // Forçar atualização da direção da luz se a porta estiver aberta
    if (isOpen) {
      setTimeout(() => {
        this.updateLightDirection(this.currentTime, this.currentDirection);
      }, 100);
    }
  }

  /**
   * Atualizar iluminação natural avançada da janela
   */
  updateWindowLighting(windowId, isOpen) {
    const window = this.windows.get(windowId);
    if (!window || !window.lightSource) return;
    
    const lightGroup = window.lightSource;
    const sunLight = lightGroup.userData.sunLight;
    const volumetricLight = lightGroup.userData.volumetricLight;
    const fillLight = lightGroup.userData.fillLight;
    const bounceLight = lightGroup.userData.bounceLight;
    const localAmbient = lightGroup.userData.localAmbient;
    const transmission = window.config.lightTransmission;
    
    if (isOpen) {
      // JANELA ABERTA: Luz natural controlada pelo floating-bar
      const currentIntensity = this.getCurrentSunIntensity();
      
      sunLight.intensity = this.config.lighting.sunIntensity * currentIntensity;
      volumetricLight.intensity = this.config.lighting.volumetricIntensity * currentIntensity;
      fillLight.intensity = this.config.lighting.fillIntensity * currentIntensity;
      bounceLight.intensity = 0.6 * currentIntensity;
      localAmbient.intensity = 0.3 * currentIntensity;
      
      // Vidro completamente transparente
      if (window.glass && window.glass.material) {
        window.glass.material.opacity = 0.02;
        window.glass.material.transmission = 0.98;
      }
      
      console.log(`🌞 JANELA '${windowId}' ABERTA - Luz natural controlada pelo floating-bar!`);
      console.log(`   ☀️ Intensidade baseada no horário: ${currentIntensity.toFixed(2)}`);
      
      // Aplicar direção atual da luz
      this.updateLightDirection(this.currentTime, this.currentDirection);
      
    } else {
      // JANELA FECHADA: SEM luz (como porta fechada)
      sunLight.intensity = 0;
      volumetricLight.intensity = 0;
      fillLight.intensity = 0;
      bounceLight.intensity = 0;
      localAmbient.intensity = 0;
      
      // Vidro opaco
      if (window.glass && window.glass.material) {
        window.glass.material.opacity = 0.6;
        window.glass.material.transmission = 0.1;
      }
      
      console.log(`🌑 Janela '${windowId}' FECHADA - Sem luz (bloqueada completamente)`);
    }
    
    console.log(`   ☀️ Sol: ${sunLight.intensity.toFixed(2)} | 🌟 Volumétrica: ${volumetricLight.intensity.toFixed(2)}`);
    console.log(`   💡 Preenchimento: ${fillLight.intensity.toFixed(2)} | 🔄 Bounce: ${bounceLight.intensity.toFixed(2)}`);
    console.log(`   🌙 Ambiente local: ${localAmbient.intensity.toFixed(2)}`);
    
    // Atualizar qualidade das sombras para máximo contraste
    this.updateShadowContrast(isOpen);
    
    // Forçar atualização do renderer para escuridão total
    this.updateRendererForDarkness(isOpen);
  }

  /**
   * Atualizar renderer para escuridão total
   */
  updateRendererForDarkness(hasOpenOpening) {
    // Verificar se há alguma abertura aberta (porta ou janela)
    const hasOpenDoor = Array.from(this.doors.values()).some(door => door.isOpen);
    const hasOpenWindow = Array.from(this.windows.values()).some(window => window.isOpen);
    const hasAnyOpening = hasOpenOpening || hasOpenDoor || hasOpenWindow;
    
    if (this.scene.userData.renderer) {
      const renderer = this.scene.userData.renderer;
      
      if (hasAnyOpening) {
        // Com abertura: contraste dramático
        renderer.toneMappingExposure = 0.6; // Aumentado para melhor visibilidade
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        console.log(`🌞 Renderer: modo iluminado (exposição ${renderer.toneMappingExposure})`);
      } else {
        // Sem abertura: escuridão total
        renderer.toneMappingExposure = 0.05; // Muito baixo para escuridão total
        renderer.shadowMap.type = THREE.BasicShadowMap;
        console.log(`🌑 Renderer: modo escuro (exposição ${renderer.toneMappingExposure})`);
      }
    }
    
    // Atualizar também a luz ambiente se necessário
    if (hasAnyOpening) {
      // Adicionar uma luz ambiente muito fraca apenas para não ficar 100% preto
      this.ensureMinimalAmbientLight();
    } else {
      // Remover luz ambiente para escuridão total
      this.removeMinimalAmbientLight();
    }
  }

  /**
   * Garantir luz ambiente mínima quando há aberturas
   */
  ensureMinimalAmbientLight() {
    if (!this.minimalAmbient) {
      this.minimalAmbient = new THREE.AmbientLight(0x404040, 0.02); // Muito fraca
      this.minimalAmbient.userData.isMinimalAmbient = true;
      this.scene.add(this.minimalAmbient);
      console.log(`💡 Luz ambiente mínima adicionada (${this.minimalAmbient.intensity})`);
    }
  }

  /**
   * Remover luz ambiente mínima para escuridão total
   */
  removeMinimalAmbientLight() {
    if (this.minimalAmbient) {
      this.scene.remove(this.minimalAmbient);
      this.minimalAmbient = null;
      console.log(`🌑 Luz ambiente mínima removida - escuridão total`);
    }
  }

  /**
   * Atualizar contraste das sombras baseado no estado das aberturas
   */
  updateShadowContrast(hasOpenWindow) {
    // Ajustar bias das sombras para maior contraste em ambiente escuro
    this.lightSources.forEach(lightGroup => {
      if (lightGroup.userData.isWindowLight) {
        const sunLight = lightGroup.userData.sunLight;
        const fillLight = lightGroup.userData.fillLight;
        
        if (hasOpenWindow) {
          // Sombras mais definidas com janela aberta
          sunLight.shadow.bias = -0.0002;
          if (fillLight.shadow) fillLight.shadow.bias = -0.0001;
        } else {
          // Sombras mais suaves com janela fechada
          sunLight.shadow.bias = -0.0001;
          if (fillLight.shadow) fillLight.shadow.bias = -0.00005;
        }
      }
    });
  }

  /**
   * Obter todas as portas
   */
  getDoors() {
    return Array.from(this.doors.entries()).map(([id, door]) => ({
      id,
      wallName: door.wallName,
      position: door.position,
      isOpen: door.isOpen,
      config: door.config
    }));
  }

  /**
   * Obter todas as janelas
   */
  getWindows() {
    return Array.from(this.windows.entries()).map(([id, window]) => ({
      id,
      wallName: window.wallName,
      position: window.position,
      isOpen: window.isOpen,
      config: window.config
    }));
  }

  /**
   * Remover porta
   */
  removeDoor(doorId) {
    const door = this.doors.get(doorId);
    if (!door) return;
    
    // Remover elementos da porta
    this.scene.remove(door.group);
    
    // Restaurar parede original
    this.restoreWallOpening(door.wallName);
    
    this.doors.delete(doorId);
    
    console.log(`🗑️ Porta '${doorId}' removida e parede restaurada`);
  }

  /**
   * Remover janela
   */
  removeWindow(windowId) {
    const window = this.windows.get(windowId);
    if (!window) return;
    
    // Remover elementos da janela
    this.scene.remove(window.group);
    
    // Remover sistema de luz
    if (window.lightSource) {
      this.scene.remove(window.lightSource);
      this.lightSources.delete(`window_${window.wallName}_${window.position.x}_${window.position.y}`);
    }
    
    // Restaurar parede original
    this.restoreWallOpening(window.wallName);
    
    this.windows.delete(windowId);
    
    console.log(`🗑️ Janela '${windowId}' removida e parede restaurada`);
  }

  /**
   * Restaurar parede original removendo abertura
   */
  restoreWallOpening(wallName) {
    const wall = this.findWall(wallName);
    if (!wall || !wall.userData.hasOpening) return;
    
    // Verificar se ainda há outras aberturas nesta parede
    const hasOtherOpenings = this.hasOtherOpeningsInWall(wallName);
    
    if (!hasOtherOpenings) {
      // Restaurar geometria original da parede
      const { width, height, depth } = this.roomConfigSystem.config.dimensions;
      
      let wallWidth, wallHeight, wallDepth;
      if (wallName === 'front' || wallName === 'back') {
        wallWidth = width;
        wallHeight = height;
        wallDepth = 0.2;
      } else {
        wallWidth = 0.2;
        wallHeight = height;
        wallDepth = depth;
      }
      
      // Criar geometria original
      const originalGeometry = new THREE.BoxGeometry(wallWidth, wallHeight, wallDepth);
      
      // Substituir geometria
      wall.geometry.dispose();
      wall.geometry = originalGeometry;
      
      // Limpar metadados
      wall.userData.hasOpening = false;
      delete wall.userData.openingData;
      
      console.log(`🔧 Parede ${wallName} restaurada para estado original`);
    } else {
      console.log(`⚠️ Parede ${wallName} ainda tem outras aberturas, mantendo estado atual`);
    }
  }

  /**
   * Verificar se parede tem outras aberturas
   */
  hasOtherOpeningsInWall(wallName) {
    // Verificar portas
    for (const door of this.doors.values()) {
      if (door.wallName === wallName) return true;
    }
    
    // Verificar janelas
    for (const window of this.windows.values()) {
      if (window.wallName === wallName) return true;
    }
    
    return false;
  }

  /**
   * Limpar todos os elementos
   */
  clear() {
    // Remover todas as portas
    for (const doorId of this.doors.keys()) {
      this.removeDoor(doorId);
    }
    
    // Remover todas as janelas
    for (const windowId of this.windows.keys()) {
      this.removeWindow(windowId);
    }
    
    // Limpar fontes de luz
    this.lightSources.clear();
    
    console.log('🧹 Sistema de Portas e Janelas limpo');
  }

  /**
   * Destruir sistema
   */
  dispose() {
    this.clear();
    console.log('🗑️ Sistema de Portas e Janelas destruído');
  }
}

// Exportar para uso global
window.DoorWindowSystem = DoorWindowSystem;
