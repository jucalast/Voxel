/**
 * Sistema de Configuração de Sala
 * Permite personalizar dimensões e texturas do ambiente no room mode
 */

export class RoomConfigSystem {
  constructor(scene, textureSystem) {
    this.scene = scene;
    this.textureSystem = textureSystem;
    
    // Configurações padrão da sala
    this.config = {
      dimensions: {
        width: 20,    // Largura
        height: 10,   // Altura
        depth: 20     // Profundidade
      },
      textures: {
        floor: 'wood_oak',      // Chão
        walls: 'wallpaper_stripes', // Paredes
        ceiling: 'marble_white'  // Teto
      },
    };
    
    // Elementos da sala
    this.roomElements = {
      floor: null,
      walls: [],
      ceiling: null
    };
    
    console.log('🏠 Sistema de Configuração de Sala inicializado');
  }

  /**
   * Definir dimensões da sala
   */
  setDimensions(width, height, depth) {
    this.config.dimensions = { width, height, depth };
    console.log(`📏 Dimensões da sala definidas: ${width}x${height}x${depth}`);
    
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
    console.log('🏗️ Criando sala personalizada...');
    
    // Limpar sala existente
    this.clearRoom();
    
    // Criar elementos
    this.createFloor();
    this.createWalls();
    this.createCeiling();
    
    console.log('✅ Sala personalizada criada com sucesso');
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
    console.log('🟫 Chão criado');
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
        rotation: [0, 0, 0],
        name: 'left'
      },
      // Parede direita
      {
        height: height,
        position: [width / 2 + wallThickness / 2, height / 2, 0],
        rotation: [0, 0, 0],
        name: 'right'
      }
    ];

    wallConfigs.forEach(config => {
      // Usar BoxGeometry para criar paredes com espessura real
      let wallWidth, wallDepth;
      
      if (config.name === 'front' || config.name === 'back') {
        wallWidth = width;
        wallDepth = wallThickness;
      } else { // left ou right
        wallWidth = wallThickness;
        wallDepth = depth;
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
    
    console.log('🧱 Paredes criadas');
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
    console.log('🏠 Teto criado');
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
          this.roomElements.floor.material = newMaterial;
        }
        break;
        
      case 'walls':
        this.roomElements.walls.forEach(wall => {
          const newMaterial = this.textureSystem.createTexturedMaterial(
            this.config.textures.walls,
            { side: THREE.DoubleSide, roughness: 0.6, metalness: 0.05 }
          );
          if (newMaterial.map) {
            newMaterial.map.repeat.set(3, 3);
            newMaterial.map.wrapS = THREE.RepeatWrapping;
            newMaterial.map.wrapT = THREE.RepeatWrapping;
          }
          wall.material = newMaterial;
        });
        break;
        
      case 'ceiling':
        if (this.roomElements.ceiling) {
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
          this.roomElements.ceiling.material = newMaterial;
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
    
    
    console.log('🧹 Sala limpa');
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
