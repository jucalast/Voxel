/**
 * Sistema Modular de Portas
 * Permite criar portas funcionais que abrem/fecham e controlam entrada de luz
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
      lighting: {
        ambientDarkness: 0.0,  // SEM luz ambiente (escuridão total)
        sunIntensity: 8.0,     // Sol MUITO intenso para contraste dramático extremo
        fillIntensity: 4.0,    // Luz de preenchimento muito intensa
        volumetricIntensity: 2.0, // Luz volumétrica intensa (raios de sol visíveis)
        shadowQuality: 4096,   // Sombras de altíssima qualidade
        lightDecay: 3.0,       // Decaimento natural da luz mais dramático
        spotAngle: Math.PI / 2.5, // Ângulo mais focado para spot lights
        spotPenumbra: 0.3,     // Penumbra suave nas bordas
        maxDistance: 25        // Distância máxima da luz
      }
    };
    
    // Elementos criados
    this.doors = new Map();
    this.lightSources = new Map(); // Luzes que entram pelas aberturas
    
    // Estado das animações
    this.animations = new Map();

    // Estado do ambiente escuro
    this.isDarkEnvironmentActive = false;
    
    // NÃO configurar ambiente escuro no construtor - apenas quando necessário
    // this.setupDarkEnvironment(); // Removido - será chamado apenas no walk mode
    
    // Integrar com sistema floating-bar para controle de luz
    this.integrateWithFloatingBar();
    
    // Expor controle de luz globalmente para debug
    window.doorWindowLighting = {
      updateTime: (time) => this.updateLightDirection(time, this.currentDirection),
      updateDirection: (direction) => this.updateLightDirection(this.currentTime, direction),
      getCurrentIntensity: () => this.getCurrentSunIntensity(),
      forceUpdate: () => this.updateLightDirection(this.currentTime, this.currentDirection)
    };

    // Expor controles de porta globalmente para testes
    window.doorControls = {
      // Criar porta
      create: (id, wallName, position, config) => this.createDoor(id, wallName, position, config),
      
      // Controles básicos
      toggle: (id) => this.toggleDoor(id),
      remove: (id) => this.removeDoor(id),
      list: () => this.getDoors(),
      
      // Novas funcionalidades
      resize: (id, config) => this.resizeDoor(id, config),
      move: (id, position) => this.moveDoor(id, position),
      transfer: (id, wallName, position) => this.transferDoor(id, wallName, position),
      validate: (wallName, position, config, excludeId) => this.validateDoorOperation(wallName, position, config, excludeId),
      
      // Utilitários de correção
      fixRotations: () => this.fixDoorRotations(),
      
      // Métodos de teste
      test: () => this.runDoorTests(),
      
      // NOVO: Teste rápido de múltiplas portas
      testMultiple: () => this.testMultipleDoorsQuick(),
      
      // Teste específico de múltiplas portas + movimentação
      testFull: () => this.testMultipleDoorsAndMovement(),
      
      // Teste de transferência entre paredes
      testTransfer: () => this.testDoorTransfer()
    };
    
    // Sistema de Portas inicializado
    // Controles de debug disponíveis
  }

  /**
   * Ativar ambiente escuro (chamado apenas no walk mode)
   */
  activateDarkEnvironment() {
    if (this.isDarkEnvironmentActive) {
      return;
    }
    
    this.isDarkEnvironmentActive = true;
    this.setupDarkEnvironment();
  }

  /**
   * Desativar ambiente escuro (restaurar iluminação normal)
   */
  deactivateDarkEnvironment() {
    if (!this.isDarkEnvironmentActive) {
      return;
    }
    
    this.isDarkEnvironmentActive = false;
    this.restoreNormalLighting();
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
      
      // Melhorar qualidade das sombras para dispersão realista
      renderer.shadowMap.needsUpdate = true;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.3; // Exposição muito baixa
    }
    
  }

  /**
   * Restaurar iluminação normal (para modo editor)
   */
  restoreNormalLighting() {
    // Remover luz ambiente mínima se existir
    this.removeMinimalAmbientLight();

    // Restaurar renderer para configurações normais
    if (this.scene.userData.renderer) {
      const renderer = this.scene.userData.renderer;
      renderer.toneMappingExposure = 1.2; // Restaurar exposição normal
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
    }

    // Recriar iluminação básica do editor se necessário
    this.recreateEditorLighting();

  }

  /**
   * Recriar iluminação básica do editor
   */
  recreateEditorLighting() {
    // Verificar se há luzes na cena
    let hasLights = false;
    this.scene.traverse((child) => {
      if (child.isLight && !child.userData.isNaturalLight) {
        hasLights = true;
      }
    });

    if (!hasLights) {
      
      // Luz ambiente
      const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
      ambientLight.userData.isEditorLight = true;
      this.scene.add(ambientLight);

      // Luz direcional principal
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(10, 10, 5);
      directionalLight.castShadow = true;
      directionalLight.userData.isEditorLight = true;
      this.scene.add(directionalLight);

    }
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
    
    // Materiais configurados para ambiente escuro
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
    
    // Sistema de controle de luz natural criado
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

    // Controles adicionados ao floating-bar
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
      
    });

    // Event listeners configurados
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
    
    // Luz natural atualizada
    
    // Atualizar iluminação de todas as portas abertas com novo fator de dispersão
    this.doors.forEach((door, doorId) => {
      if (door.isOpen) {
        this.updateDoorLighting(doorId, true);
      }
    });
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
      const baseIntensity = this.config.lighting.sunIntensity;
      
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
    
    // Intensidade solar calculada
    return intensity;
  }

  /**
   * Calcular fator de dispersão baseado no horário
   * Retorna um multiplicador para luzes de dispersão (0.02 a noite, 1.0 ao meio-dia)
   */
  getDispersionFactor() {
    const time = this.currentTime !== undefined ? this.currentTime : 12;
    
    // Durante o dia (6h-18h): dispersão reduzida
    if (time >= 6 && time <= 18) {
      // Curva suave: máximo ao meio-dia (12h), diminui nas bordas
      const dayProgress = (time - 6) / 12; // 0 a 1
      const dayIntensity = Math.sin(dayProgress * Math.PI); // Curva senoidal
      return Math.max(0.15, dayIntensity * 0.6); // Mínimo 0.15, máximo 0.6 durante o dia
    }
    
    // Durante a noite (18h-6h): dispersão mínima
    const nightFactor = 0.02; // Apenas 2% da dispersão à noite
    
    // Transições suaves no crepúsculo
    if (time > 18 && time <= 20) {
      // Pôr do sol: transição de 0.15 para 0.02
      const sunsetProgress = (time - 18) / 2; // 0 a 1
      return 0.15 * (1 - sunsetProgress) + nightFactor * sunsetProgress;
    }
    if (time >= 4 && time < 6) {
      // Nascer do sol: transição de 0.02 para 0.15
      const sunriseProgress = (time - 4) / 2; // 0 a 1
      return nightFactor * (1 - sunriseProgress) + 0.15 * sunriseProgress;
    }
    
    // Noite completa
    return nightFactor;
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

    // Criando abertura na parede
    
    // Criar abertura na parede (no chão) - sistema já suporta múltiplas aberturas
    const opening = this.createWallOpening(wall, wallName, doorConfig.width, doorConfig.height, doorPosition);
    
    if (!opening) {
      console.error(`❌ Falha ao criar abertura na parede ${wallName}`);
      return null;
    }
    
    
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
    
    return doorGroup;
  }



  /**
   * Abrir/fechar porta com animação
   */
  toggleDoor(doorId) {
    const door = this.doors.get(doorId);
    if (!door) {
      console.error(`❌ Porta '${doorId}' não encontrada`);
      return false; // Retornar falso em caso de erro
    }

    try {
      // CORREÇÃO: Calcular ângulo de abertura baseado na rotação inicial da parede
      let openAngle = door.config.openAngle;
      
      // CORREÇÃO FINAL: Porta deve sempre fechar para DENTRO do buraco/abertura
      switch(door.wallName) {
        case 'front':
          // Front: CORRIGIDO NOVAMENTE - fechar para dentro da sala (ângulo positivo)
          break;
        case 'back':
          // Back: PERFEITO - mantém como está (ângulo positivo)
          break;
        case 'left':
          openAngle = -openAngle; // Left: PERFEITO - mantém como está (ângulo negativo)
          break;
        case 'right':
          openAngle = -openAngle; // Right: CORRIGIDO NOVAMENTE - fechar para dentro da sala (ângulo negativo)
          break;
      }

      const currentRotation = door.leaf.rotation.y;
      const baseRotation = this.getBaseRotation(door.wallName);
      const targetAngle = door.isOpen ? baseRotation : baseRotation + openAngle;
      
      door.isOpen = !door.isOpen;
      
      // Animar abertura/fechamento
      this.animateRotation(door.leaf, targetAngle, door.config.animationSpeed, 'y');
      
      // Atualizar iluminação se necessário
      this.updateDoorLighting(doorId, door.isOpen);
      
      // Porta alternada com sucesso
      
      return true; // Retornar verdadeiro em caso de sucesso
      
    } catch (error) {
      console.error(`❌ Erro ao alternar porta '${doorId}':`, error);
      return false; // Retornar falso em caso de erro
    }
  }

  // Função auxiliar para obter rotação base de cada parede
  getBaseRotation(wallName) {
    switch(wallName) {
      case 'front': return 0; // CORRIGIDO NOVAMENTE: consistente com createDoorLeaf
      case 'back': return 0; // PERFEITO: mantém como está
      case 'left': return -Math.PI / 2; // PERFEITO: mantém como está
      case 'right': return -Math.PI / 2; // CORRIGIDO NOVAMENTE: consistente com createDoorLeaf
      default: return 0;
    }
  }



  /**
   * Encontrar parede pelo nome
   */
  findWall(wallName) {
    if (!this.roomConfigSystem || !this.roomConfigSystem.roomElements) {
      console.error(`❌ RoomConfigSystem ou roomElements não disponível!`);
      return null;
    }
    
    const wall = this.roomConfigSystem.roomElements.walls.find(
      wall => wall.userData.wallName === wallName
    );
    
    if (!wall) {
      console.error(`❌ Parede '${wallName}' não encontrada! Paredes disponíveis:`, 
        this.roomConfigSystem.roomElements.walls.map(w => w.userData.wallName));
    } else {
      // Parede encontrada
    }
    
    return wall;
  }

  /**
   * Criar abertura real na parede
   */
  createWallOpening(wall, wallName, width, height, position) {
    if (!wall) {
      console.error(`❌ ERRO: Parede ${wallName} não encontrada para criar abertura!`);
      return null;
    }
    
    
    // Obter dimensões da parede original (manter geometria intacta)
    const wallGeometry = wall.geometry;
    let wallWidth, wallHeight, wallDepth;
    
    // CORREÇÃO CRÍTICA: Para paredes laterais, SEMPRE usar dimensões da sala (não da geometria)
    // A geometria existente pode ter dimensões incorretas (0.2m de largura)
    const forceSalaConfig = (wallName === 'left' || wallName === 'right');
    
    if (!forceSalaConfig && wallGeometry && wallGeometry.parameters && 
        wallGeometry.parameters.width && 
        wallGeometry.parameters.height && 
        wallGeometry.parameters.depth) {
      wallWidth = wallGeometry.parameters.width;
      wallHeight = wallGeometry.parameters.height;
      wallDepth = wallGeometry.parameters.depth;
      // Usando dimensões da geometria
    } else {
      // FALLBACK ROBUSTO: Usar dimensões do sistema de configuração da sala
      const dimensions = this.roomConfigSystem?.config?.dimensions;
      if (!dimensions) {
        console.error(`❌ Não foi possível obter dimensões da sala para ${wallName}`);
        return null;
      }
      
      const { width, height, depth } = dimensions;
      
      if (wallName === 'front' || wallName === 'back') {
        wallWidth = width;
        wallHeight = height;
        wallDepth = 0.2; // Espessura padrão da parede
      } else {
        // CORREÇÃO CRÍTICA: Para paredes laterais, a "largura" é na verdade a profundidade da sala
        wallWidth = depth; // A parede lateral tem a profundidade da sala como largura
        wallHeight = height;
        wallDepth = 0.2; // Espessura padrão da parede
      }
      
    }
    
    
    // Verificação final das dimensões calculadas
    if (wallName === 'left' || wallName === 'right') {
    }
    
      // VALIDAÇÃO UNIFICADA: Verificar se abertura cabe na parede (agora com dimensões corretas)
      let canFitOpening = true;
      
      
      canFitOpening = width <= wallWidth - 0.2 && height <= wallHeight - 0.2;
      
      if (wallName === 'left' || wallName === 'right') {
        
        if (!canFitOpening) {
          console.error(`❌ ERRO: Parede lateral ${wallName} tem apenas ${wallWidth}m de largura`);
          console.error(`   - Para uma abertura de ${width}m, precisaria de pelo menos ${width + 0.2}m`);
          console.error(`   - Verifique se as dimensões da sala estão corretas`);
        }
      } else {
      }    if (!canFitOpening) {
      console.error(`❌ Abertura ${width}x${height}m não cabe na parede ${wallName}`);
      return null;
    }
    
    // Verificar se as dimensões são válidas
    if (!wallWidth || !wallHeight || !wallDepth) {
      console.error(`❌ Dimensões inválidas da parede ${wallName}:`, {wallWidth, wallHeight, wallDepth});
      return null;
    }
    
    // NOVO: Coletar TODAS as aberturas existentes nesta parede para manter múltiplas portas
    const allOpenings = this.getAllOpeningsInWall(wallName);
    
    // Adicionar a nova abertura à lista
    const newOpening = {
      width: width,
      height: height,
      position: position,
      type: 'door' // Pode ser 'door' ou 'window'
    };
    allOpenings.push(newOpening);
    
    allOpenings.forEach((opening, index) => {
    });
    
    // Criar nova geometria da parede com TODAS as aberturas
    const newWallGeometry = this.createWallWithMultipleOpenings(
      wallWidth, wallHeight, wallDepth, 
      allOpenings, wallName
    );
    
    if (!newWallGeometry) {
      console.error(`❌ Falha ao criar geometria com múltiplas aberturas para ${wallName}`);
      return null;
    }
    
    // PROTEÇÃO: Salvar posição e rotação originais da parede
    const originalPosition = wall.position.clone();
    const originalRotation = wall.rotation.clone();
    const originalScale = wall.scale.clone();
    
    
    // Substituir geometria da parede
    const oldGeometry = wall.geometry;
    wall.geometry = newWallGeometry;
    oldGeometry.dispose();
    
    // RESTAURAR posição, rotação e escala originais
    wall.position.copy(originalPosition);
    wall.rotation.copy(originalRotation);
    wall.scale.copy(originalScale);
    
    
    // CORREÇÃO CRÍTICA: Garantir que o material permite visualizar buracos
    if (wall.material) {
      wall.material.side = THREE.DoubleSide; // Renderizar ambos os lados
      wall.material.transparent = false; // Não transparente
      wall.material.alphaTest = 0; // Sem teste alpha
    }
    
    // Forçar atualização do objeto SEM alterar transformações
    wall.geometry.computeBoundingBox();
    wall.geometry.computeBoundingSphere();
    wall.updateMatrixWorld(true);
    
    // NOVO: Marcar que esta parede tem múltiplas aberturas
    wall.userData.hasOpening = true;
    wall.userData.hasMultipleOpenings = allOpenings.length > 1;
    wall.userData.openings = allOpenings; // Array com todas as aberturas
    
    
    return wall;
  }

  /**
   * Obter todas as aberturas existentes numa parede
   */
  getAllOpeningsInWall(wallName) {
    const existingOpenings = [];
    
    // Procurar todas as portas nesta parede
    for (const [doorId, door] of this.doors) {
      if (door.wallName === wallName) {
        existingOpenings.push({
          width: door.config.width,
          height: door.config.height,
          position: door.position,
          type: 'door',
          doorId: doorId
        });
      }
    }
    
    return existingOpenings;
  }
  
  /**
   * Recriar parede com todas as aberturas existentes
   */
  recreateWallWithAllOpenings(wall, wallName, allOpenings) {
    if (!wall) {
      console.error(`❌ Parede ${wallName} não encontrada para recriar`);
      return null;
    }
    
    
    // Obter dimensões da parede
    const { width, height, depth } = this.roomConfigSystem.config.dimensions;
    let wallWidth, wallHeight, wallDepth;
    
    if (wallName === 'front' || wallName === 'back') {
      wallWidth = width;
      wallHeight = height;
      wallDepth = 0.2;
    } else {
      wallWidth = depth;
      wallHeight = height;
      wallDepth = 0.2;
    }
    
    // PROTEÇÃO: Salvar transformações originais
    const originalPosition = wall.position.clone();
    const originalRotation = wall.rotation.clone();
    const originalScale = wall.scale.clone();
    
    let newGeometry;
    
    if (allOpenings.length === 0) {
      // Nenhuma abertura - criar parede sólida
      newGeometry = new THREE.BoxGeometry(wallWidth, wallHeight, wallDepth);
    } else {
      // Uma ou mais aberturas - usar método de múltiplas aberturas
      newGeometry = this.createWallWithMultipleOpenings(
        wallWidth, wallHeight, wallDepth, 
        allOpenings, wallName
      );
    }
    
    if (!newGeometry) {
      console.error(`❌ Falha ao criar nova geometria para parede ${wallName}`);
      return null;
    }
    
    // Substituir geometria
    const oldGeometry = wall.geometry;
    wall.geometry = newGeometry;
    oldGeometry.dispose();
    
    // RESTAURAR transformações originais
    wall.position.copy(originalPosition);
    wall.rotation.copy(originalRotation);
    wall.scale.copy(originalScale);
    
    // Atualizar metadados
    wall.userData.hasOpening = allOpenings.length > 0;
    wall.userData.hasMultipleOpenings = allOpenings.length > 1;
    wall.userData.openings = allOpenings;
    
    // Configurar material
    if (wall.material) {
      wall.material.side = THREE.DoubleSide;
      wall.material.transparent = false;
      wall.material.alphaTest = 0;
    }
    
    wall.updateMatrixWorld(true);
    
    return wall;
  }
  
  /**
   * Criar geometria de parede com múltiplas aberturas usando Shape e Path
   */
  createWallWithMultipleOpenings(wallWidth, wallHeight, wallDepth, openings, wallName) {
    try {
      // Validar parâmetros
      if (!wallWidth || !wallHeight || !wallDepth) {
        console.error('❌ Dimensões da parede inválidas:', {wallWidth, wallHeight, wallDepth});
        return null;
      }
      
      if (!openings || openings.length === 0) {
        console.error('❌ Nenhuma abertura fornecida para criar');
        return null;
      }
      

      // CORREÇÃO DEFINITIVA: Usar sempre wallWidth e wallHeight diretamente
      // O sistema de configuração já fornece as dimensões corretas para cada parede
      const shapeWidth = wallWidth;
      const shapeHeight = wallHeight;
      

      // Criar shape da parede completa com dimensões corretas
      const wallShape = new THREE.Shape();
      wallShape.moveTo(-wallWidth / 2, -wallHeight / 2);
      wallShape.lineTo(wallWidth / 2, -wallHeight / 2);
      wallShape.lineTo(wallWidth / 2, wallHeight / 2);
      wallShape.lineTo(-wallWidth / 2, wallHeight / 2);
      wallShape.lineTo(-wallWidth / 2, -wallHeight / 2);
      
      // NOVO: Criar buracos para TODAS as aberturas
      const holes = [];
      
      openings.forEach((opening, idx) => {
      });
      
      for (let i = 0; i < openings.length; i++) {
        const opening = openings[i];
        const openingHole = new THREE.Path();
        
        
        // Sistema de coordenadas unificado para buraco e porta
        let openingX;
        
        if (wallName === 'front' || wallName === 'back') {
          // Paredes front/back: position.x é coordenada X direta
          openingX = opening.position.x;
        } else {
          // Para paredes laterais, inverter sinal para alinhamento
          openingX = -opening.position.x;
        }
        
        if (wallName === 'left' || wallName === 'right') {
        }
        
        // Para portas (y = 0), posicionar abertura a partir do chão
        // Para aberturas (y > 0), usar posição especificada
        let openingBottom, openingTop;
        
        
        if (opening.position.y === 0) {
          // Porta: abertura começa no chão (-wallHeight/2) e vai até a altura da porta
          openingBottom = -wallHeight / 2;
          openingTop = -wallHeight / 2 + opening.height;
        } else {
          // Abertura: posição Y já representa o centro da abertura
          openingBottom = opening.position.y - opening.height / 2;
          openingTop = opening.position.y + opening.height / 2;
          
          // Converter para altura da base para melhor compreensão no log
          const baseHeight = opening.position.y - opening.height / 2;
        }
        
        // Calcular limites horizontais da abertura
        const left = openingX - opening.width / 2;
        const right = openingX + opening.width / 2;
        
        
        // Garantir que a abertura não ultrapasse os limites da parede
        const clampedLeft = Math.max(left, -wallWidth / 2 + 0.1);
        const clampedRight = Math.min(right, wallWidth / 2 - 0.1);
        const clampedBottom = Math.max(openingBottom, -wallHeight / 2 + 0.1);
        const clampedTop = Math.min(openingTop, wallHeight / 2 - 0.1);
        
        
        // Validação específica para esta abertura
        const minWidth = 0.1; // Largura mínima de 10cm
        const minHeight = 0.1; // Altura mínima de 10cm
        const actualWidth = clampedRight - clampedLeft;
        const actualHeight = clampedTop - clampedBottom;
        
        
        // Verificar se as dimensões são válidas
        if (actualWidth < minWidth || actualHeight < minHeight) {
          console.error(`❌ Abertura ${i + 1} muito pequena para criar buraco:`);
          console.error(`   - Largura real: ${actualWidth.toFixed(2)}m (mínimo: ${minWidth}m)`);
          console.error(`   - Altura real: ${actualHeight.toFixed(2)}m (mínimo: ${minHeight}m)`);
          console.error(`   - PULANDO esta abertura`);
          continue;
        }
        
        // Criar buraco corretamente para todos os tipos de parede
        if (wallName === 'left' || wallName === 'right') {
          
          // Para paredes laterais, usar os limites calculados normalmente
          openingHole.moveTo(clampedLeft, clampedBottom);
          openingHole.lineTo(clampedLeft, clampedTop);
          openingHole.lineTo(clampedRight, clampedTop);
          openingHole.lineTo(clampedRight, clampedBottom);
          openingHole.lineTo(clampedLeft, clampedBottom);
          
        } else {
          // Validação e criação normal para paredes front/back
          if (actualWidth < minWidth || actualHeight < minHeight) {
            console.error(`❌ Abertura ${i + 1} inválida: dimensões muito pequenas ou fora dos limites`);
            console.error(`   - Largura real: ${actualWidth.toFixed(2)}m (mínimo: ${minWidth}m)`);
            console.error(`   - Altura real: ${actualHeight.toFixed(2)}m (mínimo: ${minHeight}m)`);
            continue; // Pular esta abertura inválida, mas continuar com as outras
          }
          
          // Criar o buraco retangular normal
          openingHole.moveTo(clampedLeft, clampedBottom);
          openingHole.lineTo(clampedLeft, clampedTop);
          openingHole.lineTo(clampedRight, clampedTop);
          openingHole.lineTo(clampedRight, clampedBottom);
          openingHole.lineTo(clampedLeft, clampedBottom);
        }
        
        // Verificar se o buraco foi criado corretamente
        const holePoints = openingHole.getPoints();
        if (holePoints && holePoints.length > 0) {
          // Adicionar este buraco ao array de holes
          holes.push(openingHole);
        } else {
          console.error(`❌ Falha ao criar buraco ${i + 1} - sem pontos válidos`);
        }
      }
      
      // Adicionar TODOS os buracos ao shape da parede
      
      if (holes.length === 0) {
        console.error(`❌ ERRO CRÍTICO: Nenhum buraco válido foi criado!`);
        console.error(`   - Tentativas de abertura: ${openings.length}`);
        console.error(`   - Buracos válidos: ${holes.length}`);
        return null;
      }
      
      wallShape.holes = holes;
      
      // Verificar se os buracos foram adicionados corretamente
      if (wallShape.holes.length !== holes.length) {
        console.error(`❌ ERRO: Esperado ${holes.length} buracos, mas shape tem ${wallShape.holes.length}`);
      }
      
      holes.forEach((hole, index) => {
        const points = hole.getPoints();
        if (points.length < 3) {
          console.error(`     ⚠️ Buraco ${index + 1} tem poucos pontos (${points.length})`);
        }
      });
      
      // Criar geometria extrudada with espessura correta
      const extrudeSettings = {
        depth: wallDepth, // Usar wallDepth correto (sempre 0.2)
        bevelEnabled: false,
        bevelSize: 0,
        bevelThickness: 0
      };
      
      const geometry = new THREE.ExtrudeGeometry(wallShape, extrudeSettings);
      
      // Centralizar geometria na espessura SEM rotacionar
      geometry.translate(0, 0, -wallDepth / 2);
      
      
      // Verificar se a geometria foi criada corretamente
      if (!geometry || !geometry.attributes || !geometry.attributes.position) {
        console.error(`❌ ERRO: Falha ao criar geometria ExtrudeGeometry`);
        return null;
      }
      
      openings.forEach((opening, index) => {
      });
      
      // DEBUG: Verificar detalhes da geometria
      
      // Garantir que bounding box e sphere estão atualizados
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      
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
      color: 0x8B4513 // Cor madeira (Lambert não suporta roughness)
    });
    
    // Batente superior
    const topFrame = new THREE.Mesh(
      new THREE.BoxGeometry(config.width + config.frameWidth * 2, config.frameWidth, config.frameWidth),
      frameMaterial
    );
    topFrame.position.y = config.height + config.frameWidth / 2; // No topo da porta
    
    // Batentes laterais (altura só até o topo da porta, não incluindo o batente superior)
    const leftFrame = new THREE.Mesh(
      new THREE.BoxGeometry(config.frameWidth, config.height, config.frameWidth),
      frameMaterial
    );
    leftFrame.position.x = -config.width / 2 - config.frameWidth / 2;
    leftFrame.position.y = config.height / 2; // Do chão até o topo da porta
    
    const rightFrame = new THREE.Mesh(
      new THREE.BoxGeometry(config.frameWidth, config.height, config.frameWidth),
      frameMaterial
    );
    rightFrame.position.x = config.width / 2 + config.frameWidth / 2;
    rightFrame.position.y = config.height / 2; // Do chão até o topo da porta
    
    frameGroup.add(topFrame, leftFrame, rightFrame);
    
    // Posicionar na abertura da parede (no chão)
    const wallPosition = this.getWallPosition(wallName, position);
    wallPosition.y = 0; // Posicionar no chão para que os batentes comecem do chão
    
    // CORREÇÃO DEFINITIVA: Criar batente específico para paredes laterais SEM rotacionar grupo
    if (wallName === 'left' || wallName === 'right') {
      
      // LIMPAR geometrias existentes e criar novas já orientadas
      frameGroup.clear();
      
      // Para paredes laterais, criar geometrias já na orientação Z (sem rotação do grupo)
      // Batente superior (horizontal na direção Z)
      const topFrame = new THREE.Mesh(
        new THREE.BoxGeometry(config.frameWidth, config.frameWidth, config.width + config.frameWidth * 2),
        frameMaterial
      );
      topFrame.position.z = 0; // Centralizado no Z
      topFrame.position.y = config.height + config.frameWidth / 2; // No topo da porta
      
      // Batentes laterais (verticais na direção Z) - altura só até o topo da porta
      const leftFrame = new THREE.Mesh(
        new THREE.BoxGeometry(config.frameWidth, config.height, config.frameWidth),
        frameMaterial
      );
      leftFrame.position.z = -config.width / 2 - config.frameWidth / 2;
      leftFrame.position.y = config.height / 2; // Do chão até o topo da porta (não mais alto)
      
      const rightFrame = new THREE.Mesh(
        new THREE.BoxGeometry(config.frameWidth, config.height, config.frameWidth),
        frameMaterial
      );
      rightFrame.position.z = config.width / 2 + config.frameWidth / 2;
      rightFrame.position.y = config.height / 2; // Do chão até o topo da porta (não mais alto)
      
      frameGroup.add(topFrame, leftFrame, rightFrame);
      
      // NÃO ROTACIONAR O GRUPO - geometrias já estão orientadas corretamente
    }
    
    // CORREÇÃO: Ajustar posição para encaixar na espessura da parede
    if (wallName === 'front' || wallName === 'back') {
      wallPosition.z += (wallName === 'front' ? 0.05 : -0.05); // Pequeno ajuste para encaixe
    } else {
      // Para paredes laterais, mover o batente para dentro da espessura da parede
      wallPosition.x += (wallName === 'left' ? 0.1 : -0.1); // Centrar na espessura
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
      color: 0x654321, // Cor madeira escura (Lambert não suporta roughness)
      transparent: false, // Garantir que não seja transparente
      opacity: 1.0, // Opacidade total
      alphaTest: 0 // Sem teste de transparência
    });
    
    const doorLeaf = new THREE.Mesh(doorGeometry, doorMaterial);
    doorLeaf.castShadow = true;
    doorLeaf.receiveShadow = true;
    
    // CORREÇÃO DEFINITIVA: Usar geometria unificada e rotacionar conforme a parede
    
    // SEMPRE usar a mesma geometria (pivot no X) para todas as paredes
    doorGeometry.translate(config.width / 2, 0, 0);
    
    // Aplicar rotação específica para cada parede - TODAS viradas para dentro da sala
    switch(wallName) {
      case 'front':
        doorLeaf.rotation.y = 0; // 0° CORRIGIDO NOVAMENTE: virada para dentro da sala
        break;
      case 'back':
        doorLeaf.rotation.y = 0; // 0° PERFEITO: mantém como está
        break;
      case 'left':
        doorLeaf.rotation.y = -Math.PI / 2; // -90° PERFEITO: mantém como está
        break;
      case 'right':
        doorLeaf.rotation.y = -Math.PI / 2; // -90° CORRIGIDO NOVAMENTE: virada para dentro da sala
        break;
    }
    
    
    // Posicionar exatamente na abertura da parede (no chão)
    const wallPosition = this.getWallPosition(wallName, position);
    wallPosition.y = config.height / 2; // Centro da porta (a folha fica no centro da altura)
    
    // POSICIONAMENTO UNIFICADO: Ajustar para encaixar na espessura da parede
    switch(wallName) {
      case 'front':
        wallPosition.z += 0.05;
        break;
      case 'back':
        wallPosition.z -= 0.05;
        break;
      case 'left':
        wallPosition.x += 0.1; // Mesmo ajuste do batente
        break;
      case 'right':
        wallPosition.x -= 0.1; // Mesmo ajuste do batente
        break;
    }
    
    // Ajustar posição para encaixar perfeitamente na abertura
    doorLeaf.position.copy(wallPosition);
    
    // CORREÇÃO: Ajustar pivot baseado na orientação da parede para alinhar com batente
    if (wallName === 'front' || wallName === 'back') {
      // Paredes front/back: pivot no X (normal)
      doorLeaf.position.x -= config.width / 2;
    } else {
      // Paredes left/right: pivot no Z para alinhar com batente rotacionado
      doorLeaf.position.z -= config.width / 2;
    }
    
    // CORREÇÃO: Garantir que o material permaneça sempre opaco
    doorLeaf.material.transparent = false;
    doorLeaf.material.opacity = 1.0;
    doorLeaf.material.alphaTest = 0;
    doorLeaf.material.needsUpdate = true;
    
    
    return doorLeaf;
  }











  /**
   * Criar sistema de iluminação natural para porta
   */
  createDoorLight(wallName, position, config) {
    const lightGroup = new THREE.Group();
    const wallPosition = this.getWallPosition(wallName, position);
    const lightOffset = this.getWallNormal(wallName);
    
    // 1. LUZ SOLAR EXTERNA INTENSA - Para quando a porta estiver aberta
    const sunLight = new THREE.DirectionalLight(0xFFFAE6, this.config.lighting.sunIntensity);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = this.config.lighting.shadowQuality;
    sunLight.shadow.mapSize.height = this.config.lighting.shadowQuality;
    sunLight.shadow.camera.near = 0.1;
    sunLight.shadow.camera.far = 100;
    sunLight.shadow.bias = -0.0001; // Menos bias para sombras mais definidas
    sunLight.shadow.normalBias = 0.02;
    
    // Posicionar sol externo à porta
    const sunOffset = lightOffset.clone().multiplyScalar(15);
    sunOffset.y += 8; // Sol mais alto para melhor ângulo
    sunLight.position.copy(wallPosition).add(sunOffset);
    sunLight.target.position.copy(wallPosition);
    
    // Área de sombra para porta - mais ampla
    const shadowSize = Math.max(config.width, config.height) * 8;
    sunLight.shadow.camera.left = -shadowSize;
    sunLight.shadow.camera.right = shadowSize;
    sunLight.shadow.camera.top = shadowSize;
    sunLight.shadow.camera.bottom = -shadowSize;
    
    // 2. LUZ DE ENTRADA FOCADA - Luz dramática entrando pela porta
    const entryLight = new THREE.SpotLight(
      0xFFFBE6, 
      this.config.lighting.fillIntensity, 
      this.config.lighting.maxDistance, 
      this.config.lighting.spotAngle * 1.3, // Cone mais aberto
      0.8, // Penumbra muito maior para dispersão suave
      1.5  // Decay menor para luz mais distribuída
    );
    entryLight.castShadow = true;
    entryLight.shadow.mapSize.width = 4096; // Maior resolução para sombras mais suaves
    entryLight.shadow.mapSize.height = 4096;
    entryLight.shadow.bias = -0.0001;
    entryLight.shadow.radius = 25; // Sombras muito mais suaves
    entryLight.shadow.blurSamples = 25; // Mais amostras para suavização
    
    entryLight.position.copy(wallPosition);
    const entryOffset = lightOffset.clone().multiplyScalar(0.2); // Mais próximo da abertura
    entryLight.position.add(entryOffset);
    entryLight.target.position.copy(wallPosition).add(lightOffset.clone().multiplyScalar(-8)); // Focar para dentro
    
    // 3. LUZ VOLUMÉTRICA - Raios de luz visíveis
    const volumetricLight = new THREE.SpotLight(
      0xFFF8E1, 
      this.config.lighting.volumetricIntensity, 
      20, // Alcance maior
      Math.PI / 2.5, // Cone mais amplo
      0.9, // Penumbra quase total para dispersão máxima
      1.2  // Decay suave
    );
    volumetricLight.position.copy(wallPosition).add(lightOffset.clone().multiplyScalar(1));
    volumetricLight.target.position.copy(wallPosition).add(lightOffset.clone().multiplyScalar(-6));
    
    // 4. LUZ AMBIENTE DA PORTA - Iluminação local muito suave
    const doorAmbient = new THREE.PointLight(0xFFF5DC, 0.1, 15, 3.5);
    doorAmbient.position.copy(wallPosition);
    doorAmbient.position.add(lightOffset.clone().multiplyScalar(-1.5));
    
    // 5. LUZES DE DISPERSÃO - Simular espalhamento da luz (densidade reduzida)
    const disperseLight1 = new THREE.PointLight(0xFFFAF0, 0.02, 12, 7.0);
    disperseLight1.position.copy(wallPosition);
    disperseLight1.position.add(lightOffset.clone().multiplyScalar(-2.5));
    disperseLight1.position.x += (Math.random() - 0.5) * 4;
    disperseLight1.position.z += (Math.random() - 0.5) * 4;
    
    const disperseLight2 = new THREE.PointLight(0xFFFAF0, 0.015, 10, 8.0);
    disperseLight2.position.copy(wallPosition);
    disperseLight2.position.add(lightOffset.clone().multiplyScalar(-3));
    disperseLight2.position.x += (Math.random() - 0.5) * 5;
    disperseLight2.position.z += (Math.random() - 0.5) * 5;
    
    // 6. LUZES DE DISPERSÃO NO CHÃO - Simular luz espalhada no piso
    const floorDisperse1 = new THREE.SpotLight(
      0xFFF8DC, // Tom cálido
      1.5,       // Intensidade reduzida para menor densidade
      18,        // Alcance ainda maior
      Math.PI / 1.2, // Cone muito mais aberto para dispersão máxima
      0.95,      // Penumbra quase total como nas paredes
      0.8        // Decay maior para menor densidade
    );
    // Configurar sombras suaves como nas paredes
    floorDisperse1.castShadow = true;
    floorDisperse1.shadow.mapSize.width = 4096;
    floorDisperse1.shadow.mapSize.height = 4096;
    floorDisperse1.shadow.bias = -0.0001;
    floorDisperse1.shadow.radius = 30; // Sombras muito suaves
    floorDisperse1.shadow.blurSamples = 25;
    
    floorDisperse1.position.copy(wallPosition);
    floorDisperse1.position.add(lightOffset.clone().multiplyScalar(-0.5));
    floorDisperse1.position.y = 3.2; // Ainda mais alto para dispersão máxima
    floorDisperse1.target.position.copy(wallPosition);
    floorDisperse1.target.position.add(lightOffset.clone().multiplyScalar(-5));
    floorDisperse1.target.position.y = 0; // Apontar para o chão
    floorDisperse1.target.position.x += (Math.random() - 0.5) * 3; // Adicionar variação como nas paredes
    floorDisperse1.target.position.z += (Math.random() - 0.5) * 3;
    
    const floorDisperse2 = new THREE.SpotLight(
      0xFFFAF0, // Tom mais neutro
      1.2,       // Intensidade muito reduzida
      16,        // Alcance ainda maior
      Math.PI / 1.1, // Cone quase 180° para dispersão extrema
      0.98,      // Penumbra quase total
      0.7        // Decay maior para menor densidade
    );
    // Configurar sombras suaves
    floorDisperse2.castShadow = true;
    floorDisperse2.shadow.mapSize.width = 4096;
    floorDisperse2.shadow.mapSize.height = 4096;
    floorDisperse2.shadow.bias = -0.0001;
    floorDisperse2.shadow.radius = 35; // Sombras ainda mais suaves
    floorDisperse2.shadow.blurSamples = 30;
    
    floorDisperse2.position.copy(wallPosition);
    floorDisperse2.position.add(lightOffset.clone().multiplyScalar(-1.5));
    floorDisperse2.position.y = 2.8;
    floorDisperse2.position.x += (Math.random() - 0.5) * 3; // Mais variação
    floorDisperse2.position.z += (Math.random() - 0.5) * 3; // Variação em Z também
    floorDisperse2.target.position.copy(wallPosition);
    floorDisperse2.target.position.add(lightOffset.clone().multiplyScalar(-7));
    floorDisperse2.target.position.y = 0;
    floorDisperse2.target.position.x += (Math.random() - 0.5) * 6; // Mais espalhamento
    floorDisperse2.target.position.z += (Math.random() - 0.5) * 6;
    
    // Luzes PointLight do chão removidas para evitar "bolas" de luz
    
    // Marcar luzes como naturais
    [sunLight, entryLight, volumetricLight, doorAmbient, disperseLight1, disperseLight2, 
     floorDisperse1, floorDisperse2].forEach(light => {
      light.userData.isNaturalLight = true;
      light.userData.doorId = `door_${wallName}_${position.x}_${position.y}`;
    });
    
    // Inicialmente desligadas (porta fechada)
    sunLight.intensity = 0;
    entryLight.intensity = 0;
    volumetricLight.intensity = 0;
    doorAmbient.intensity = 0;
    disperseLight1.intensity = 0;
    disperseLight2.intensity = 0;
    floorDisperse1.intensity = 0;
    floorDisperse2.intensity = 0;
    
    // Adicionar luzes ao grupo
    lightGroup.add(sunLight);
    lightGroup.add(sunLight.target);
    lightGroup.add(entryLight);
    lightGroup.add(entryLight.target);
    lightGroup.add(volumetricLight);
    lightGroup.add(volumetricLight.target);
    lightGroup.add(doorAmbient);
    lightGroup.add(disperseLight1);
    lightGroup.add(disperseLight2);
    lightGroup.add(floorDisperse1);
    lightGroup.add(floorDisperse1.target);
    lightGroup.add(floorDisperse2);
    lightGroup.add(floorDisperse2.target);
    // PointLights do chão removidas
    
    // Metadados
    lightGroup.userData.sunLight = sunLight;
    lightGroup.userData.entryLight = entryLight;
    lightGroup.userData.volumetricLight = volumetricLight;
    lightGroup.userData.doorAmbient = doorAmbient;
    lightGroup.userData.disperseLight1 = disperseLight1;
    lightGroup.userData.disperseLight2 = disperseLight2;
    lightGroup.userData.floorDisperse1 = floorDisperse1;
    lightGroup.userData.floorDisperse2 = floorDisperse2;
    // PointLights do chão removidas dos metadados
    lightGroup.userData.wallName = wallName;
    lightGroup.userData.position = position;
    lightGroup.userData.isDoorLight = true;
    lightGroup.userData.isNaturalLight = true;
    
    this.scene.add(lightGroup);
    this.lightSources.set(`door_${wallName}_${position.x}_${position.y}`, lightGroup);
    
    
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
    const volumetricLight = lightGroup.userData.volumetricLight;
    const doorAmbient = lightGroup.userData.doorAmbient;
    const disperseLight1 = lightGroup.userData.disperseLight1;
    const disperseLight2 = lightGroup.userData.disperseLight2;
    const floorDisperse1 = lightGroup.userData.floorDisperse1;
    const floorDisperse2 = lightGroup.userData.floorDisperse2;
    // PointLights do chão removidas
    
    if (isOpen) {
      // PORTA ABERTA: Luz natural DRAMÁTICA controlada pelo floating-bar
      let currentIntensity = this.getCurrentSunIntensity();
      
      // Garantir intensidade mínima ALTA para contraste dramático
      if (currentIntensity < 0.4) {
        currentIntensity = 0.9; // Intensidade alta para contraste extremo
      }
      
      // Calcular fator de dispersão baseado no horário
      const dispersionFactor = this.getDispersionFactor();
      
      // Aplicar intensidades MUITO ALTAS para contraste extremo
      sunLight.intensity = this.config.lighting.sunIntensity * currentIntensity * 1.2; // Multiplicador extra
      entryLight.intensity = this.config.lighting.fillIntensity * currentIntensity * 1.0;
      volumetricLight.intensity = this.config.lighting.volumetricIntensity * currentIntensity * 0.8;
      doorAmbient.intensity = 0.05 * currentIntensity * dispersionFactor; // Densidade muito reduzida
      
      // Luzes de dispersão para bordas suaves (baseadas no horário)
      if (disperseLight1) disperseLight1.intensity = 0.05 * currentIntensity * dispersionFactor;
      if (disperseLight2) disperseLight2.intensity = 0.03 * currentIntensity * dispersionFactor;
      
      // Luzes de dispersão no chão para efeito realista (densidade reduzida)
      const floorDispersionFactor = dispersionFactor * 0.5; // Chão muito mais sutil
      if (floorDisperse1) floorDisperse1.intensity = 0.8 * currentIntensity * floorDispersionFactor;
      if (floorDisperse2) floorDisperse2.intensity = 0.6 * currentIntensity * floorDispersionFactor;
      
      // Porta aberta - iluminação ativada
      
      // Luzes do chão configuradas
      
      // Forçar atualização do renderer para contraste EXTREMO
      this.updateRendererForDarkness(true);
      
    } else {
      // PORTA FECHADA: ESCURIDÃO TOTAL (porta bloqueia completamente)
      sunLight.intensity = 0;
      entryLight.intensity = 0;
      volumetricLight.intensity = 0;
      doorAmbient.intensity = 0;
      
      // Desligar luzes de dispersão
      if (disperseLight1) disperseLight1.intensity = 0;
      if (disperseLight2) disperseLight2.intensity = 0;
      
      // Desligar luzes do chão (apenas SpotLights)
      if (floorDisperse1) floorDisperse1.intensity = 0;
      if (floorDisperse2) floorDisperse2.intensity = 0;
      
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
   * Atualizar renderer para escuridão total
   */
  updateRendererForDarkness(hasOpenOpening) {
    // Verificar se há alguma abertura aberta (apenas portas)
    const hasOpenDoor = Array.from(this.doors.values()).some(door => door.isOpen);
    const hasAnyOpening = hasOpenOpening || hasOpenDoor;
    
    if (this.scene.userData.renderer) {
      const renderer = this.scene.userData.renderer;
      
      if (hasAnyOpening) {
        // Com abertura: CONTRASTE EXTREMAMENTE DRAMÁTICO
        renderer.toneMappingExposure = 1.2; // MUITO aumentado para contraste extremo
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping; // Melhor tone mapping
      } else {
        // Sem abertura: ESCURIDÃO ABSOLUTA
        renderer.toneMappingExposure = 0.01; // EXTREMAMENTE baixo para escuridão quase total
        renderer.shadowMap.type = THREE.BasicShadowMap;
        renderer.toneMapping = THREE.LinearToneMapping;
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
   * Garantir luz ambiente mínima quando há aberturas (MUITO SUTIL)
   */
  ensureMinimalAmbientLight() {
    if (!this.minimalAmbient) {
      this.minimalAmbient = new THREE.AmbientLight(0x101020, 0.005); // EXTREMAMENTE fraca para contraste
      this.minimalAmbient.userData.isMinimalAmbient = true;
      this.scene.add(this.minimalAmbient);
    }
  }

  /**
   * Remover luz ambiente mínima para ESCURIDÃO ABSOLUTA
   */
  removeMinimalAmbientLight() {
    if (this.minimalAmbient) {
      this.scene.remove(this.minimalAmbient);
      this.minimalAmbient = null;
    }
  }



  /**
   * Validar se uma operação de porta é possível
   */
  validateDoorOperation(wallName, position, config, excludeDoorId = null) {
    const validation = {
      valid: true,
      errors: [],
      warnings: []
    };

    // Verificar se a parede existe
    const wall = this.findWall(wallName);
    if (!wall) {
      validation.valid = false;
      validation.errors.push(`Parede '${wallName}' não encontrada`);
      return validation;
    }

    // Obter dimensões da parede com correção para paredes laterais
    const { width, height, depth } = this.roomConfigSystem.config.dimensions;
    let wallWidth, wallHeight;
    
    if (wallName === 'front' || wallName === 'back') {
      wallWidth = width;   // Largura da sala
      wallHeight = height; // Altura da sala
    } else {
      // CORREÇÃO: Para paredes laterais, a "largura" é a profundidade da sala
      wallWidth = depth;   // Profundidade da sala (dimensão da parede lateral)
      wallHeight = height; // Altura da sala
    }
    

    // Validar dimensões da porta
    if (config.width > wallWidth - 0.4) {
      validation.valid = false;
      validation.errors.push(`Largura da porta (${config.width}m) muito grande para parede (${wallWidth}m disponível)`);
    }

    if (config.height > wallHeight - 0.4) {
      validation.valid = false;
      validation.errors.push(`Altura da porta (${config.height}m) muito grande para parede (${wallHeight}m disponível)`);
    }

    // Validar posição dentro dos limites da parede
    const halfWidth = config.width / 2;
    const maxX = (wallWidth / 2) - halfWidth - 0.1; // Margem de 10cm
    const minX = -(wallWidth / 2) + halfWidth + 0.1;

    if (position.x > maxX || position.x < minX) {
      validation.valid = false;
      validation.errors.push(`Posição X (${position.x}) fora dos limites válidos (${minX.toFixed(2)} a ${maxX.toFixed(2)})`);
    }

    // Verificar sobreposição com outras portas na mesma parede
    for (const [id, door] of this.doors) {
      if (id === excludeDoorId || door.wallName !== wallName) continue;

      const otherLeft = door.position.x - door.config.width / 2;
      const otherRight = door.position.x + door.config.width / 2;
      const newLeft = position.x - config.width / 2;
      const newRight = position.x + config.width / 2;

      // Verificar sobreposição horizontal
      if (!(newRight < otherLeft || newLeft > otherRight)) {
        validation.valid = false;
        validation.errors.push(`Sobreposição com porta existente '${id}' na mesma parede`);
      }
    }

    // Avisos para posições próximas às bordas
    if (Math.abs(position.x) > maxX * 0.8) {
      validation.warnings.push('Porta muito próxima à borda da parede');
    }

    return validation;
  }

  /**
   * Redimensionar uma porta existente
   */
  resizeDoor(doorId, newConfig = {}) {
    const door = this.doors.get(doorId);
    if (!door) {
      console.error(`❌ Porta '${doorId}' não encontrada para redimensionar`);
      return false;
    }

    // Fazer backup do estado atual
    const backup = {
      config: { ...door.config },
      isOpen: door.isOpen,
      position: { ...door.position },
      wallName: door.wallName
    };

    // Mesclar nova configuração com a atual
    const updatedConfig = { ...door.config, ...newConfig };


    // Validar nova configuração
    const validation = this.validateDoorOperation(
      door.wallName, 
      door.position, 
      updatedConfig, 
      doorId
    );

    if (!validation.valid) {
      console.error('❌ Redimensionamento inválido:', validation.errors.join(', '));
      return false;
    }

    // Mostrar avisos se houver
    if (validation.warnings.length > 0) {
      console.warn('⚠️ Avisos:', validation.warnings.join(', '));
    }

    try {
      // Remover elementos visuais atuais (mas manter referências)
      this.scene.remove(door.group);
      this.scene.remove(door.lightSource);

      // Atualizar configuração
      door.config = updatedConfig;

      // Recriar abertura na parede com novas dimensões
      const wall = this.findWall(door.wallName);
      const newOpening = this.createWallOpening(
        wall, 
        door.wallName, 
        updatedConfig.width, 
        updatedConfig.height, 
        door.position
      );

      if (!newOpening) {
        throw new Error('Falha ao recriar abertura na parede');
      }

      // Recriar batente com novas dimensões
      const newFrame = this.createDoorFrame(door.wallName, door.position, updatedConfig);
      
      // Recriar folha com novas dimensões
      const newLeaf = this.createDoorLeaf(door.wallName, door.position, updatedConfig);
      
      // Recriar grupo da porta
      const newGroup = new THREE.Group();
      newGroup.add(newFrame);
      newGroup.add(newLeaf);
      newGroup.userData.isDoor = true;
      newGroup.userData.doorId = doorId;
      newGroup.userData.isOpen = backup.isOpen;
      newGroup.userData.wallName = door.wallName;
      
      this.scene.add(newGroup);

      // Recriar sistema de iluminação
      const newLightSource = this.createDoorLight(door.wallName, door.position, updatedConfig);

      // Atualizar referências
      door.group = newGroup;
      door.leaf = newLeaf;
      door.frame = newFrame;
      door.opening = newOpening;
      door.lightSource = newLightSource;

      // Restaurar estado aberto/fechado se necessário
      if (backup.isOpen) {
        door.isOpen = false; // Resetar para poder alternar
        this.toggleDoor(doorId); // Abrir novamente
      }

      return true;

    } catch (error) {
      console.error('❌ Erro durante redimensionamento:', error);
      
      // Tentar restaurar estado anterior
      try {
        door.config = backup.config;
        // Aqui poderia implementar rollback completo se necessário
      } catch (rollbackError) {
        console.error('❌ Erro no rollback:', rollbackError);
      }
      
      return false;
    }
  }

  /**
   * Mover uma porta para nova posição na mesma parede
   */
  moveDoor(doorId, newPosition) {
    const door = this.doors.get(doorId);
    if (!door) {
      console.error(`❌ Porta '${doorId}' não encontrada para mover`);
      return false;
    }

    // Fazer backup do estado atual
    const backup = {
      position: { ...door.position },
      isOpen: door.isOpen
    };


    // Validar nova posição
    const validation = this.validateDoorOperation(
      door.wallName, 
      newPosition, 
      door.config, 
      doorId
    );

    if (!validation.valid) {
      console.error('❌ Movimentação inválida:', validation.errors.join(', '));
      return false;
    }

    // Mostrar avisos se houver
    if (validation.warnings.length > 0) {
      console.warn('⚠️ Avisos:', validation.warnings.join(', '));
    }

    try {
      // Remover elementos visuais atuais
      this.scene.remove(door.group);
      this.scene.remove(door.lightSource);

      // CORREÇÃO: Atualizar posição ANTES de recriar a parede
      door.position = { ...newPosition };

      // NOVO: Recriar parede com TODAS as aberturas (incluindo a porta movida)
      const wall = this.findWall(door.wallName);
      const allOpenings = this.getAllOpeningsInWall(door.wallName);
      
      allOpenings.forEach((opening, index) => {
      });
      
      const newOpening = this.recreateWallWithAllOpenings(wall, door.wallName, allOpenings);

      if (!newOpening) {
        throw new Error('Falha ao recriar parede com nova posição');
      }

      // Recriar batente na nova posição
      const newFrame = this.createDoorFrame(door.wallName, newPosition, door.config);
      
      // Recriar folha na nova posição
      const newLeaf = this.createDoorLeaf(door.wallName, newPosition, door.config);
      
      // Recriar grupo da porta
      const newGroup = new THREE.Group();
      newGroup.add(newFrame);
      newGroup.add(newLeaf);
      newGroup.userData.isDoor = true;
      newGroup.userData.doorId = doorId;
      newGroup.userData.isOpen = backup.isOpen;
      newGroup.userData.wallName = door.wallName;
      
      this.scene.add(newGroup);

      // Recriar sistema de iluminação na nova posição
      const newLightSource = this.createDoorLight(door.wallName, newPosition, door.config);

      // Atualizar referências
      door.group = newGroup;
      door.leaf = newLeaf;
      door.frame = newFrame;
      door.opening = newOpening;
      door.lightSource = newLightSource;
      
      // CORREÇÃO: Garantir que a folha tenha a rotação base correta da parede atual
      const baseRotation = this.getBaseRotation(door.wallName);
      newLeaf.rotation.y = baseRotation;
      door.isOpen = false; // Resetar estado para fechado
      

      // Restaurar estado aberto/fechado se necessário
      if (backup.isOpen) {
        this.toggleDoor(doorId); // Abrir novamente com a rotação correta
      }

      return true;

    } catch (error) {
      console.error('❌ Erro durante movimentação:', error);
      
      // Tentar restaurar posição anterior
      try {
        door.position = backup.position;
      } catch (rollbackError) {
        console.error('❌ Erro no rollback:', rollbackError);
      }
      
      return false;
    }
  }

  /**
   * Transferir uma porta para uma parede diferente
   */
  transferDoor(doorId, newWallName, newPosition) {
    const door = this.doors.get(doorId);
    if (!door) {
      console.error(`❌ Porta '${doorId}' não encontrada para transferir`);
      return false;
    }

    // Fazer backup completo do estado atual
    const backup = {
      wallName: door.wallName,
      position: { ...door.position },
      isOpen: door.isOpen,
      config: { ...door.config }
    };


    // Verificar se a nova parede existe
    const newWall = this.findWall(newWallName);
    if (!newWall) {
      console.error(`❌ Parede de destino '${newWallName}' não encontrada`);
      return false;
    }

    // Validar nova posição na nova parede
    const validation = this.validateDoorOperation(
      newWallName, 
      newPosition, 
      door.config, 
      doorId
    );

    if (!validation.valid) {
      console.error('❌ Transferência inválida:', validation.errors.join(', '));
      return false;
    }

    // Mostrar avisos se houver
    if (validation.warnings.length > 0) {
      console.warn('⚠️ Avisos:', validation.warnings.join(', '));
    }

    try {
      // Remover elementos visuais atuais
      this.scene.remove(door.group);
      this.scene.remove(door.lightSource);

      // NOVO SISTEMA: Recriar parede original SEM esta porta
      const oldWall = this.findWall(door.wallName);
      const remainingOpeningsOld = this.getAllOpeningsInWall(door.wallName).filter(opening => 
        opening.doorId !== doorId
      );
      
      this.recreateWallWithAllOpenings(oldWall, door.wallName, remainingOpeningsOld);

      // Atualizar dados da porta ANTES de obter aberturas da nova parede
      const oldWallName = door.wallName;
      door.wallName = newWallName;
      door.position = { ...newPosition };
      

      // NOVO SISTEMA: Recriar nova parede COM todas as aberturas (incluindo a transferida)
      const allOpeningsNew = this.getAllOpeningsInWall(newWallName);
      
      allOpeningsNew.forEach((opening, index) => {
      });
      
      const newOpening = this.recreateWallWithAllOpenings(newWall, newWallName, allOpeningsNew);

      if (!newOpening) {
        throw new Error(`Falha ao recriar parede de destino '${newWallName}' com todas as aberturas`);
      }

      // Criar batente na nova parede
      const newFrame = this.createDoorFrame(newWallName, newPosition, door.config);
      
      // Criar folha na nova parede (com rotação correta)
      const newLeaf = this.createDoorLeaf(newWallName, newPosition, door.config);
      
      
      // Criar grupo da porta
      const newGroup = new THREE.Group();
      newGroup.add(newFrame);
      newGroup.add(newLeaf);
      newGroup.userData.isDoor = true;
      newGroup.userData.doorId = doorId;
      newGroup.userData.isOpen = backup.isOpen;
      newGroup.userData.wallName = newWallName;
      
      this.scene.add(newGroup);

      // Criar sistema de iluminação para a nova parede
      const newLightSource = this.createDoorLight(newWallName, newPosition, door.config);

      // Atualizar todas as referências
      door.group = newGroup;
      door.leaf = newLeaf;
      door.frame = newFrame;
      door.opening = newOpening;
      door.lightSource = newLightSource;

      // CORREÇÃO: Garantir que a folha tenha a rotação base correta da nova parede
      const baseRotation = this.getBaseRotation(newWallName);
      newLeaf.rotation.y = baseRotation;
      door.isOpen = false; // Resetar estado para fechado
      

      // Restaurar estado aberto/fechado se necessário
      if (backup.isOpen) {
        this.toggleDoor(doorId); // Abrir novamente com a rotação correta
      }

      return true;

    } catch (error) {
      console.error('❌ Erro durante transferência:', error);
      
      // Tentar restaurar estado anterior
      try {
        door.wallName = backup.wallName;
        door.position = backup.position;
        door.config = backup.config;
      } catch (rollbackError) {
        console.error('❌ Erro no rollback:', rollbackError);
      }
      
      return false;
    }
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
   * Remover porta
   */
  removeDoor(doorId) {
    const door = this.doors.get(doorId);
    if (!door) return;
    
    
    // Remover elementos visuais da porta
    this.scene.remove(door.group);
    if (door.lightSource) {
      this.scene.remove(door.lightSource);
    }
    
    // Remover porta do sistema ANTES de recriar a parede
    this.doors.delete(doorId);
    
    // NOVO SISTEMA: Recriar parede com aberturas restantes
    const wall = this.findWall(door.wallName);
    const remainingOpenings = this.getAllOpeningsInWall(door.wallName);
    
    
    this.recreateWallWithAllOpenings(wall, door.wallName, remainingOpenings);
    
  }



  /**
   * Restaurar parede original removendo abertura
   */
  restoreWallOpening(wallName, excludeDoorId = null) {
    const wall = this.findWall(wallName);
    if (!wall || !wall.userData.hasOpening) {
      return;
    }
    
    // Verificar se ainda há outras aberturas nesta parede (excluindo a porta sendo transferida)
    const hasOtherOpenings = this.hasOtherOpeningsInWall(wallName, excludeDoorId);
    
    if (!hasOtherOpenings) {
      
      // PROTEÇÃO: Salvar estado atual da parede antes de restaurar
      const originalPosition = wall.position.clone();
      const originalRotation = wall.rotation.clone();
      const originalScale = wall.scale.clone();
      
      
      // Restaurar geometria original da parede com dimensões CORRETAS
      const { width, height, depth } = this.roomConfigSystem.config.dimensions;
      
      let wallWidth, wallHeight, wallDepth;
      if (wallName === 'front' || wallName === 'back') {
        wallWidth = width;
        wallHeight = height;
        wallDepth = 0.2;
      } else {
        // CORREÇÃO CRÍTICA: Para paredes laterais, usar dimensões corretas
        wallWidth = depth;  // Largura da parede lateral é a profundidade da sala
        wallHeight = height;
        wallDepth = 0.2;    // Espessura sempre 0.2
      }
      
      
      // Criar geometria original sem buracos
      const originalGeometry = new THREE.BoxGeometry(wallWidth, wallHeight, wallDepth);
      
      // Substituir geometria atual
      const oldGeometry = wall.geometry;
      wall.geometry = originalGeometry;
      oldGeometry.dispose();
      
      // RESTAURAR estado original da parede (posição, rotação, escala)
      wall.position.copy(originalPosition);
      wall.rotation.copy(originalRotation);
      wall.scale.copy(originalScale);
      
      
      // Limpar metadados
      wall.userData.hasOpening = false;
      wall.userData.hasMultipleOpenings = false;
      delete wall.userData.openingData;
      delete wall.userData.openings;
      
      // Forçar atualização correta
      wall.updateMatrixWorld(true);
      
    } else {
      
      // NOVO: Recriar parede com apenas as aberturas restantes (excluindo a que está sendo removida)
      const remainingOpenings = this.getAllOpeningsInWall(wallName).filter(opening => 
        !opening.doorId || opening.doorId !== excludeDoorId
      );
      
      if (remainingOpenings.length > 0) {
        remainingOpenings.forEach((opening, index) => {
        });
        
        // Obter dimensões da parede
        const { width, height, depth } = this.roomConfigSystem.config.dimensions;
        let wallWidth, wallHeight, wallDepth;
        
        if (wallName === 'front' || wallName === 'back') {
          wallWidth = width;
          wallHeight = height;
          wallDepth = 0.2;
        } else {
          wallWidth = depth;
          wallHeight = height;
          wallDepth = 0.2;
        }
        
        // Criar nova geometria com aberturas restantes
        const newGeometry = this.createWallWithMultipleOpenings(
          wallWidth, wallHeight, wallDepth, 
          remainingOpenings, wallName
        );
        
        if (newGeometry) {
          // PROTEÇÃO: Salvar estado antes de substituir
          const originalPosition = wall.position.clone();
          const originalRotation = wall.rotation.clone();
          const originalScale = wall.scale.clone();
          
          // Substituir geometria
          const oldGeometry = wall.geometry;
          wall.geometry = newGeometry;
          oldGeometry.dispose();
          
          // Restaurar transformações
          wall.position.copy(originalPosition);
          wall.rotation.copy(originalRotation);
          wall.scale.copy(originalScale);
          
          // Atualizar metadados
          wall.userData.hasOpening = true;
          wall.userData.hasMultipleOpenings = remainingOpenings.length > 1;
          wall.userData.openings = remainingOpenings;
          
          wall.updateMatrixWorld(true);
          
        } else {
          console.error(`❌ Falha ao recriar geometria da parede ${wallName} com aberturas restantes`);
        }
      }
    }
  }

  /**
   * Verificar se parede tem outras aberturas (atualizado para múltiplas aberturas)
   */
  hasOtherOpeningsInWall(wallName, excludeDoorId = null) {
    let otherOpeningsCount = 0;
    const otherDoors = [];
    
    // Verificar portas (excluindo a porta especificada)
    for (const [doorId, door] of this.doors) {
      if (door.wallName === wallName && doorId !== excludeDoorId) {
        otherOpeningsCount++;
        otherDoors.push(doorId);
      }
    }
    
    if (otherOpeningsCount > 0) {
      return true;
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
    
    // Limpar fontes de luz
    this.lightSources.clear();
    
  }

  /**
   * Executar testes das novas funcionalidades
   */
  runDoorTests() {
    
    try {
      // Teste 1: Criar porta de teste
      const testResult1 = this.createDoor('teste', 'front', { x: 0, y: 0 });
      if (testResult1) {
      } else {
        return;
      }

      // Teste 2: Redimensionar porta
      const testResult2 = this.resizeDoor('teste', { width: 1.2, height: 2.5 });

      // Teste 3: Mover porta na mesma parede
      const testResult3 = this.moveDoor('teste', { x: 1.5, y: 0 });

      // Teste 4: Transferir para outra parede
      const testResult4 = this.transferDoor('teste', 'back', { x: -1, y: 0 });

      // Teste 5: Validação (deve falhar)
      const validation = this.validateDoorOperation('front', { x: 0, y: 0 }, { width: 15, height: 5 });

      // Limpar teste
      this.removeDoor('teste');
      
      
    } catch (error) {
      console.error('❌ Erro durante os testes:', error);
    }
  }

  /**
   * Verificar e corrigir rotações incorretas das portas
   */
  fixDoorRotations() {
    
    let correctedDoors = 0;
    
    for (const [doorId, door] of this.doors) {
      const expectedRotation = this.getBaseRotation(door.wallName);
      const currentRotation = door.leaf.rotation.y;
      
      // Normalizar ângulos para comparação (0 a 2π)
      const normalizedExpected = ((expectedRotation % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
      const normalizedCurrent = ((currentRotation % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
      
      // Verificar se a diferença é significativa (mais que 0.1 radiano)
      const difference = Math.abs(normalizedExpected - normalizedCurrent);
      const adjustedDifference = Math.min(difference, Math.abs(difference - 2 * Math.PI));
      
      if (adjustedDifference > 0.1 && !door.isOpen) {
        
        door.leaf.rotation.y = expectedRotation;
        correctedDoors++;
      }
    }
    
    return correctedDoors;
  }

  /**
   * Teste rápido de múltiplas portas na mesma parede
   */
  testMultipleDoorsQuick() {
    
    try {
      // Limpar portas existentes
      this.clear();
      
      const door1 = this.createDoor('teste1', 'front', { x: -1, y: 0 });
      
      if (!door1) {
        console.error('❌ Falha ao criar primeira porta');
        return false;
      }
      
      const door2 = this.createDoor('teste2', 'front', { x: 1, y: 0 });
      
      if (!door2) {
        console.error('❌ Falha ao criar segunda porta');
        return false;
      }
      
      const doors = this.getDoors();
      doors.forEach(door => {
      });
      
      // Verificar se a parede tem múltiplas aberturas
      const frontWall = this.findWall('front');
      if (frontWall && frontWall.userData.openings) {
        
        // Verificar se os buracos foram criados na geometria
        if (frontWall.geometry && frontWall.geometry.type === 'ExtrudeGeometry') {
        }
        
        if (frontWall.userData.openings.length === 2) {
          
          // Teste adicional: mover uma das portas
          const moveResult = this.moveDoor('teste1', { x: -2, y: 0 });
          
          if (moveResult) {
            const updatedWall = this.findWall('front');
          } else {
            console.error('❌ Falha na movimentação');
          }
          
          return true;
        } else {
          console.error(`❌ Esperado 2 aberturas, encontrado ${frontWall.userData.openings.length}`);
          return false;
        }
      } else {
        console.error('❌ Parede front não tem dados de aberturas');
        return false;
      }
      
    } catch (error) {
      console.error('❌ Erro durante teste rápido:', error);
      return false;
    }
  }

  /**
   * Teste completo de múltiplas portas e movimentação
   */
  testMultipleDoorsAndMovement() {
    
    try {
      // Limpar
      this.clear();
      
      // 1. Criar primeira porta
      this.createDoor('porta1', 'front', { x: -1.5, y: 0 });
      
      // 2. Criar segunda porta na mesma parede
      this.createDoor('porta2', 'front', { x: 1.5, y: 0 });
      
      // 3. Verificar estado
      const wall1 = this.findWall('front');
      
      // 4. Criar terceira porta
      this.createDoor('porta3', 'front', { x: 0, y: 0 });
      
      // 5. Verificar novamente
      const wall2 = this.findWall('front');
      
      // 6. Mover uma porta
      const moveResult = this.moveDoor('porta2', { x: 2.5, y: 0 });
      
      // 7. Verificar após movimentação
      const wall3 = this.findWall('front');
      
      // 8. Verificar posições das portas
      this.getDoors().forEach(door => {
      });
      
      // 9. Resultado
      const finalOpenings = wall3.userData.openings?.length || 0;
      if (finalOpenings === 3 && moveResult) {
        return true;
      } else {
        return false;
      }
      
    } catch (error) {
      console.error('❌ Erro durante teste completo:', error);
      return false;
    }
  }

  /**
   * Teste de transferência entre paredes
   */
  testDoorTransfer() {
    
    try {
      // Limpar
      this.clear();
      
      // 1. Criar múltiplas portas em diferentes paredes
      this.createDoor('front1', 'front', { x: -1, y: 0 });
      this.createDoor('front2', 'front', { x: 1, y: 0 });
      this.createDoor('back1', 'back', { x: 0, y: 0 });
      
      // 2. Verificar estado inicial
      ['front', 'back', 'left', 'right'].forEach(wallName => {
        const wall = this.findWall(wallName);
        const openings = wall?.userData?.openings?.length || 0;
      });
      
      // 3. Transferir porta da parede front para back
      const transferResult1 = this.transferDoor('front2', 'back', { x: -1.5, y: 0 });
      
      // 4. Verificar após primeira transferência
      ['front', 'back', 'left', 'right'].forEach(wallName => {
        const wall = this.findWall(wallName);
        const openings = wall?.userData?.openings?.length || 0;
      });
      
      // 5. Transferir porta para parede lateral
      const transferResult2 = this.transferDoor('back1', 'left', { x: 0, y: 0 });
      
      // 6. Verificar após segunda transferência
      ['front', 'back', 'left', 'right'].forEach(wallName => {
        const wall = this.findWall(wallName);
        const openings = wall?.userData?.openings?.length || 0;
      });
      
      // 7. Verificar posições finais das portas
      this.getDoors().forEach(door => {
      });
      
      // 8. Validar resultado
      const frontWall = this.findWall('front');
      const backWall = this.findWall('back');
      const leftWall = this.findWall('left');
      
      const frontOpenings = frontWall?.userData?.openings?.length || 0;
      const backOpenings = backWall?.userData?.openings?.length || 0;
      const leftOpenings = leftWall?.userData?.openings?.length || 0;
      
      const expectedResult = (
        frontOpenings === 1 &&  // front1 permaneceu
        backOpenings === 1 &&   // front2 foi transferida
        leftOpenings === 1 &&   // back1 foi transferida
        transferResult1 && transferResult2
      );
      
      if (expectedResult) {
        return true;
      } else {
        return false;
      }
      
    } catch (error) {
      console.error('❌ Erro durante teste de transferência:', error);
      return false;
    }
  }

  /**
   * Destruir sistema
   */
  dispose() {
    this.clear();
  }
}

// Exportar para uso global
window.DoorWindowSystem = DoorWindowSystem;
