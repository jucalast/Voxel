/**
 * Sistema de Configuração de Sala
 * Permite personalizar dimensões e texturas do ambiente no room mode
 */

export class RoomConfigSystem {
  constructor(scene, textureSystem) {
    this.scene = scene;
    this.textureSystem = textureSystem;
    
    // Configurações padrão - dimensões automáticas
    this.config = {
      dimensions: {
        width: 10,  // 10m de largura
        height: 5,  // 5m de altura
        depth: 10   // 10m de profundidade
      },
      textures: {
        floor: 'concrete',
        walls: 'brick',
        ceiling: 'plaster'
      }
    };
    
    // Elementos da sala
    this.roomElements = {
      floor: null,
      walls: [],
      ceiling: null
    };
    
    // Sistema de Configuração de Sala inicializado
  }

  /**
   * Definir dimensões da sala
   */
  setDimensions(width, height, depth) {
    this.config.dimensions = { width, height, depth };
    // Dimensões definidas
    
    // Recriar sala se já existir
    if (this.roomElements.floor || this.roomElements.walls.length > 0) {
      this.rebuildRoom();
    }
  }

  /**
   * Definir textura de um elemento específico
   */
  setTexture(element, textureName) {
    if (!['floor', 'walls', 'ceiling'].includes(element)) {
      console.warn(`⚠️ Elemento inválido: ${element}`);
      return false;
    }

    if (!this.textureSystem.getTexture(textureName)) {
      console.warn(`⚠️ Textura não encontrada: ${textureName}`);
      return false;
    }

    this.config.textures[element] = textureName;
    console.log(`🎨 Textura do ${element} definida: ${textureName}`);
    
    // Atualizar elemento específico se já existir
    this.updateElementTexture(element);
    return true;
  }

  /**
   * Criar sala completa
   */
  createRoom() {
    // Criando sala personalizada
    
    // Limpar sala existente
    this.clearRoom();
    
    // Criar elementos
    this.createFloor();
    this.createWalls();
    this.createCeiling();
    
    // Criar porta automática após pequeno delay
    setTimeout(() => {
      this.createAutomaticDoor();
    }, 500);
    
    // Sala personalizada criada com sucesso
  }

  /**
   * Criar porta automática na sala
   */
  createAutomaticDoor() {
    // Verificar se o sistema de portas está disponível
    if (window.doorControls && typeof window.doorControls.create === 'function') {
      // Criando porta automática
      
      // Criar porta na parede frontal, centralizada, no chão
      const doorResult = window.doorControls.create('porta-automatica', 'front', { x: 0, y: 0 });
      
      if (doorResult) {
        // Porta criada com sucesso
        
        // Abrir a porta automaticamente após criação
        setTimeout(() => {
          window.doorControls.toggle('porta-automatica');
          // Porta aberta
        }, 1000);
      } else {
        console.warn('⚠️ Falha ao criar porta automática');
      }
    } else {
      console.warn('⚠️ Sistema de portas não disponível para criação automática');
    }
  }

  /**
   * Criar chão
   */
  createFloor() {
    const { width, depth } = this.config.dimensions;
    
    const geometry = new THREE.PlaneGeometry(width, depth);
    const material = this.textureSystem.createTexturedMaterial(
      this.config.textures.floor,
      { 
        side: THREE.FrontSide, // Apenas face superior visível
        roughness: 0.8,
        metalness: 0.1,
        transparent: false,
        opacity: 1.0
      }
    );
    
    // Configurar repetição da textura baseada no tamanho
    if (material.map) {
      material.map.repeat.set(width / 4, depth / 4);
      material.map.wrapS = THREE.RepeatWrapping;
      material.map.wrapT = THREE.RepeatWrapping;
    }
    
    this.roomElements.floor = new THREE.Mesh(geometry, material);
    this.roomElements.floor.rotation.x = -Math.PI / 2;
    this.roomElements.floor.position.y = 0;
    this.roomElements.floor.receiveShadow = true;
    this.roomElements.floor.userData.isRoomElement = true;
    this.roomElements.floor.userData.elementType = 'floor';
    
    this.scene.add(this.roomElements.floor);
    // Chão criado
  }

  /**
   * Criar paredes com espessura para bloquear luz
   */
  createWalls() {
    const { width, height, depth } = this.config.dimensions;
    const wallThickness = 0.2; // Espessura das paredes para bloquear luz
    
    const wallConfigs = [
      // Parede frontal
      {
        height: height,
        position: [0, height / 2, -depth / 2 - wallThickness / 2],
        rotation: [0, 0, 0],
        name: 'front'
      },
      // Parede traseira
      {
        height: height,
        position: [0, height / 2, depth / 2 + wallThickness / 2],
        rotation: [0, 0, 0],
        name: 'back'
      },
      // Parede esquerda
      {
        height: height,
        position: [-width / 2 - wallThickness / 2, height / 2, 0],
        rotation: [0, Math.PI / 2, 0],  // Rotacionar 90° para orientar corretamente
        name: 'left'
      },
      // Parede direita
      {
        height: height,
        position: [width / 2 + wallThickness / 2, height / 2, 0],
        rotation: [0, Math.PI / 2, 0],  // Rotacionar 90° para orientar corretamente
        name: 'right'
      }
    ];

    wallConfigs.forEach(config => {
      // Usar BoxGeometry para criar paredes com espessura real
      let wallWidth, wallDepth;
      
      if (config.name === 'front' || config.name === 'back') {
        // Paredes front/back: largura da sala x espessura da parede
        wallWidth = width;
        wallDepth = wallThickness;
      } else { // left ou right
        // CORREÇÃO: Paredes laterais: profundidade da sala x espessura da parede
        wallWidth = depth;  // A "largura" da parede lateral é a profundidade da sala
        wallDepth = wallThickness;  // A "profundidade" da parede é sempre a espessura
      }
      
      const geometry = new THREE.BoxGeometry(wallWidth, config.height, wallDepth);
      
      // Criar array de materiais para cada face da parede
      const materials = [];
      for (let i = 0; i < 6; i++) {
        const material = this.textureSystem.createTexturedMaterial(
          this.config.textures.walls,
          { 
            roughness: 0.6,
            metalness: 0.05,
            transparent: false,
            opacity: 1.0
          }
        );
        
        // Configurar repetição da textura
        if (material.map) {
          const textureWidth = (config.name === 'front' || config.name === 'back') ? width : depth;
          material.map.repeat.set(textureWidth / 3, config.height / 3);
          material.map.wrapS = THREE.RepeatWrapping;
          material.map.wrapT = THREE.RepeatWrapping;
        }
        
        materials.push(material);
      }
      
      const wall = new THREE.Mesh(geometry, materials);
      wall.position.set(...config.position);
      wall.rotation.set(...config.rotation);
      wall.receiveShadow = true;
      wall.castShadow = true;
      
      // Configurações para bloquear luz efetivamente
      wall.renderOrder = 1;
      wall.userData.isRoomElement = true;
      wall.userData.elementType = 'wall';
      wall.userData.wallName = config.name;
      wall.userData.blocksLight = true; // Marca que esta parede bloqueia luz
      
      this.roomElements.walls.push(wall);
      this.scene.add(wall);
    });
    
    // Paredes criadas
  }

  /**
   * Criar teto com espessura para bloquear luz
   */
  createCeiling() {
    const { width, height, depth } = this.config.dimensions;
    const ceilingThickness = 0.2; // Espessura do teto
    
    const geometry = new THREE.BoxGeometry(width, ceilingThickness, depth);
    
    // Criar array de materiais para cada face do teto
    const materials = [];
    for (let i = 0; i < 6; i++) {
      const material = this.textureSystem.createTexturedMaterial(
        this.config.textures.ceiling,
        { 
          roughness: 0.9,
          metalness: 0.0,
          transparent: false,
          opacity: 1.0
        }
      );
      
      // Configurar repetição da textura
      if (material.map) {
        material.map.repeat.set(width / 4, depth / 4);
        material.map.wrapS = THREE.RepeatWrapping;
        material.map.wrapT = THREE.RepeatWrapping;
      }
      
      materials.push(material);
    }
    
    this.roomElements.ceiling = new THREE.Mesh(geometry, materials);
    this.roomElements.ceiling.position.y = height; // Posicionar no topo da sala
    this.roomElements.ceiling.receiveShadow = true;
    this.roomElements.ceiling.castShadow = true; // Teto também projeta sombra
    
    // Configurações para bloquear luz efetivamente
    this.roomElements.ceiling.renderOrder = 1;
    this.roomElements.ceiling.userData.isRoomElement = true;
    this.roomElements.ceiling.userData.elementType = 'ceiling';
    this.roomElements.ceiling.userData.blocksLight = true; // Marca que o teto bloqueia luz
    
    this.scene.add(this.roomElements.ceiling);
    // Teto criado
  }


  /**
   * Atualizar textura de um elemento específico
   */
  updateElementTexture(elementType) {
    switch (elementType) {
      case 'floor':
        if (this.roomElements.floor) {
          const newMaterial = this.textureSystem.createTexturedMaterial(
            this.config.textures.floor,
            { side: THREE.DoubleSide, roughness: 0.8, metalness: 0.1 }
          );
          if (newMaterial.map) {
            const { width, depth } = this.config.dimensions;
            newMaterial.map.repeat.set(width / 4, depth / 4);
            newMaterial.map.wrapS = THREE.RepeatWrapping;
            newMaterial.map.wrapT = THREE.RepeatWrapping;
          }
          
          // Preservar configurações de iluminação existentes
          if (!newMaterial.userData) newMaterial.userData = {};
          newMaterial.userData.darkModeProcessed = true;
          newMaterial.userData.lightingPreserved = true;
          
          // Garantir que o chão seja visível
          this.roomElements.floor.visible = true;
          this.roomElements.floor.material = newMaterial;
          this.roomElements.floor.material.needsUpdate = true;
        }
        break;
        
      case 'walls':
        this.roomElements.walls.forEach((wall, index) => {
          const newMaterial = this.textureSystem.createTexturedMaterial(
            this.config.textures.walls,
            { side: THREE.DoubleSide, roughness: 0.6, metalness: 0.05 }
          );
          
          if (newMaterial.map) {
            newMaterial.map.repeat.set(3, 3);
            newMaterial.map.wrapS = THREE.RepeatWrapping;
            newMaterial.map.wrapT = THREE.RepeatWrapping;
          }
          
          // Preservar configurações de iluminação existentes
          if (!newMaterial.userData) newMaterial.userData = {};
          newMaterial.userData.darkModeProcessed = true;
          newMaterial.userData.lightingPreserved = true;
          
          // Garantir que a parede seja visível
          wall.visible = true;
          wall.material = newMaterial;
          wall.material.needsUpdate = true;
        });
        // Configurações de iluminação preservadas para as paredes
        break;
        
      case 'ceiling':
        if (this.roomElements.ceiling) {
          console.log('🏠 Atualizando teto');
          
          const newMaterial = this.textureSystem.createTexturedMaterial(
            this.config.textures.ceiling,
            { side: THREE.DoubleSide, roughness: 0.9, metalness: 0.0 }
          );
          if (newMaterial.map) {
            const { width, depth } = this.config.dimensions;
            newMaterial.map.repeat.set(width / 4, depth / 4);
            newMaterial.map.wrapS = THREE.RepeatWrapping;
            newMaterial.map.wrapT = THREE.RepeatWrapping;
          }
          
          // Preservar configurações de iluminação existentes
          if (!newMaterial.userData) newMaterial.userData = {};
          newMaterial.userData.darkModeProcessed = true;
          newMaterial.userData.lightingPreserved = true;
          
          // Garantir que o teto seja visível
          this.roomElements.ceiling.visible = true;
          this.roomElements.ceiling.material = newMaterial;
          this.roomElements.ceiling.material.needsUpdate = true;
          
          console.log('   ✅ Teto atualizado:', {
            visible: this.roomElements.ceiling.visible,
            material: this.roomElements.ceiling.material.type,
            hasTexture: !!this.roomElements.ceiling.material.map
          });
          console.log('💡 Configurações de iluminação preservadas para o teto');
        }
        break;
    }
    
    console.log(`🎨 Textura do ${elementType} atualizada`);
  }

  /**
   * Reconstruir sala completa
   */
  rebuildRoom() {
    console.log('🔄 Reconstruindo sala...');
    this.clearRoom();
    this.createRoom();
  }

  /**
   * Limpar sala
   */
  clearRoom() {
    // Remover chão
    if (this.roomElements.floor) {
      this.scene.remove(this.roomElements.floor);
      this.roomElements.floor = null;
    }
    
    // Remover paredes
    this.roomElements.walls.forEach(wall => {
      this.scene.remove(wall);
    });
    this.roomElements.walls = [];
    
    // Remover teto
    if (this.roomElements.ceiling) {
      this.scene.remove(this.roomElements.ceiling);
      this.roomElements.ceiling = null;
    }
    
    
    // Sala limpa
  }

  /**
   * Obter configuração atual
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Aplicar configuração
   */
  applyConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.rebuildRoom();
    console.log('⚙️ Nova configuração aplicada');
  }

  /**
   * Aplicar apenas texturas sem alterar outras configurações
   * Preserve buracos de portas, dimensões, e outras configurações
   */
  applyTexturesOnly(texturesConfig) {
    console.log('🎨 Aplicando apenas texturas...', texturesConfig);
    
    // Atualizar apenas as texturas na configuração
    Object.keys(texturesConfig).forEach(element => {
      if (['floor', 'walls', 'ceiling'].includes(element)) {
        this.config.textures[element] = texturesConfig[element];
        console.log(`🎨 Textura ${element}: ${texturesConfig[element]}`);
        
        // Atualizar apenas esse elemento específico
        this.updateElementTexture(element);
      }
    });
    
    console.log('✨ Texturas aplicadas sem alterar configurações da sala');
    return true;
  }

  /**
   * Obter estatísticas da sala
   */
  getStats() {
    const { width, height, depth } = this.config.dimensions;
    return {
      dimensions: this.config.dimensions,
      area: width * depth,
      volume: width * height * depth,
      textures: this.config.textures,
      elementsCount: {
        walls: this.roomElements.walls.length,
        hasFloor: !!this.roomElements.floor,
        hasCeiling: !!this.roomElements.ceiling
      }
    };
  }

  /**
   * Destruir sistema
   */
  dispose() {
    this.clearRoom();
    console.log('🗑️ Sistema de Configuração de Sala destruído');
  }
}

// Exportar para uso global
window.RoomConfigSystem = RoomConfigSystem;
