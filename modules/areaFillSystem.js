// =====================================================================
// SISTEMA DE PREENCHIMENTO DE ÁREA - MÓDULO INDEPENDENTE
// =====================================================================

class AreaFillSystem {
  constructor(scene, voxelsArray, addVoxelCallback, removeVoxelCallback, saveStateCallback, colorSystemCallback) {
    this.scene = scene;
    this.voxels = voxelsArray;
    this.addVoxel = addVoxelCallback;
    this.removeVoxel = removeVoxelCallback;
    this.saveState = saveStateCallback;
    this.getSelectedColor = colorSystemCallback;
    
    // Variáveis do sistema de área
    this.fillPreviewVoxels = [];
    this.selectedArea = null;
    this.isAreaSelected = false;
    this.areaBox = null;
    this.areaPreviewBox = null;
    this.areaResizeHandles = [];
    this.areaDimensionLabels = [];
  }

  /**
   * Limpar preview de preenchimento
   */
  clearFillPreview() {
    this.fillPreviewVoxels.forEach(preview => {
      this.scene.remove(preview);
    });
    this.fillPreviewVoxels = [];
  }

  /**
   * Limpar seleção de área completamente
   */
  clearAreaSelection() {
    this.clearAreaVisualization();
    this.clearFillPreview();
    this.isAreaSelected = false;
  }

  /**
   * Limpar visualização da área
   */
  clearAreaVisualization() {
    // Remove visualização da área selecionada
    const existingAreaBox = this.scene.getObjectByName('areaSelection');
    if (existingAreaBox) {
      this.scene.remove(existingAreaBox);
    }
    this.areaBox = null;
    
    // Limpar handles de redimensionamento
    this.clearResizeHandles();
  }

  /**
   * Criar preview visual durante seleção de área
   * @param {Object} start - Posição inicial
   * @param {Object} end - Posição final
   * @param {string} color - Cor dos voxels
   */
  createFillPreview(start, end, color) {
    this.clearFillPreview();

    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);
    const minZ = Math.min(start.z, end.z);
    const maxZ = Math.max(start.z, end.z);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          // Verificar se já existe voxel na posição
          const existingVoxel = this.voxels.find(voxel => 
            Math.round(voxel.position.x) === x && 
            Math.round(voxel.position.y) === y && 
            Math.round(voxel.position.z) === z
          );

          if (!existingVoxel) {
            // Criar preview visual
            const previewGeometry = new THREE.BoxGeometry(0.9, 0.9, 0.9);
            const previewMaterial = new THREE.MeshBasicMaterial({ 
              color: color,
              transparent: true,
              opacity: 0.5,
              wireframe: true
            });
            
            const previewMesh = new THREE.Mesh(previewGeometry, previewMaterial);
            previewMesh.position.set(x, y, z);
            previewMesh.userData.isPreview = true;
            
            this.scene.add(previewMesh);
            this.fillPreviewVoxels.push(previewMesh);
          }
        }
      }
    }
  }

  /**
   * Preencher área com voxels
   * @param {Object} start - Posição inicial
   * @param {Object} end - Posição final
   * @param {string} color - Cor dos voxels
   */
  fillArea(start, end, color) {
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);
    const minZ = Math.min(start.z, end.z);
    const maxZ = Math.max(start.z, end.z);

    let addedCount = 0;

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          // Verificar se já existe voxel na posição
          const existingVoxel = this.voxels.find(voxel => 
            Math.round(voxel.position.x) === x && 
            Math.round(voxel.position.y) === y && 
            Math.round(voxel.position.z) === z
          );

          if (!existingVoxel) {
            this.addVoxel(x, y, z, color, false);
            addedCount++;
          }
        }
      }
    }

    // Salvar estado uma vez no final
    if (addedCount > 0) {
      this.saveState();
    }

    // Criar área selecionada para expansão
    this.selectedArea = {
      minX, maxX, minY, maxY, minZ, maxZ,
      color: color
    };
    this.isAreaSelected = true;
    this.showAreaSelection(this.selectedArea);

    console.log(`Área preenchida: ${addedCount} voxels adicionados`);
  }

  /**
   * Mostrar visualização da área selecionada
   * @param {Object} area - Dados da área
   */
  showAreaSelection(area) {
    this.clearAreaVisualization();

    const width = area.maxX - area.minX + 1;
    const height = area.maxY - area.minY + 1;
    const depth = area.maxZ - area.minZ + 1;

    const centerX = (area.minX + area.maxX) / 2;
    const centerY = (area.minY + area.maxY) / 2;
    const centerZ = (area.minZ + area.maxZ) / 2;

    // Criar wireframe da área selecionada
    const boxGeometry = new THREE.BoxGeometry(width, height, depth);
    const boxMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      wireframe: true,
      transparent: true,
      opacity: 0.8
    });

    this.areaBox = new THREE.Mesh(boxGeometry, boxMaterial);
    this.areaBox.position.set(centerX, centerY, centerZ);
    this.areaBox.name = 'areaSelection';
    
    this.scene.add(this.areaBox);
    
    // Criar handles visuais para redimensionamento
    this.createResizeHandles(area);
  }

  /**
   * Criar área a partir de arrastar
   * @param {Object} startPos - Posição inicial
   * @param {Object} endPos - Posição final
   */
  createAreaFromDrag(startPos, endPos) {
    const minX = Math.min(startPos.x, endPos.x);
    const maxX = Math.max(startPos.x, endPos.x);
    const minY = Math.min(startPos.y, endPos.y);
    const maxY = Math.max(startPos.y, endPos.y);
    const minZ = Math.min(startPos.z, endPos.z);
    const maxZ = Math.max(startPos.z, endPos.z);
    
    this.selectedArea = {
      minX, maxX, minY, maxY, minZ, maxZ,
      color: this.getSelectedColor()
    };
    
    this.isAreaSelected = true;
    this.showAreaSelection(this.selectedArea);
    
    // Preencher a área imediatamente
    this.fillAreaWithVoxels(this.selectedArea);
    
    console.log(`📦 Área criada: ${maxX-minX+1}x${maxY-minY+1}x${maxZ-minZ+1}`);
    console.log('🎮 Use as setas para expandir a área!');
  }

  /**
   * Preencher área existente com voxels
   * @param {Object} area - Dados da área
   * @returns {number} Número de voxels adicionados
   */
  fillAreaWithVoxels(area) {
    let addedCount = 0;
    
    for (let x = area.minX; x <= area.maxX; x++) {
      for (let y = area.minY; y <= area.maxY; y++) {
        for (let z = area.minZ; z <= area.maxZ; z++) {
          // Verificar se já existe voxel na posição
          const existingVoxel = this.voxels.find(voxel => 
            Math.round(voxel.position.x) === x && 
            Math.round(voxel.position.y) === y && 
            Math.round(voxel.position.z) === z
          );

          if (!existingVoxel) {
            this.addVoxel(x, y, z, area.color, false);
            addedCount++;
          }
        }
      }
    }
    
    if (addedCount > 0) {
      this.saveState();
    }
    
    return addedCount;
  }

  /**
   * Expandir área em uma direção
   * @param {string} direction - Direção da expansão
   */
  expandArea(direction) {
    if (!this.selectedArea) {
      console.log('❌ Nenhuma área selecionada para expandir');
      return;
    }

    const { minX, maxX, minY, maxY, minZ, maxZ, color } = this.selectedArea;
    let newArea = { ...this.selectedArea };

    switch(direction) {
      case 'ArrowUp': // Para frente (Z-)
        newArea.minZ -= 1;
        break;
      case 'ArrowDown': // Para trás (Z+)
        newArea.maxZ += 1;
        break;
      case 'ArrowRight': // Para direita (X+)
        newArea.maxX += 1;
        break;
      case 'ArrowLeft': // Para esquerda (X-)
        newArea.minX -= 1;
        break;
      case 'KeyW': // W para cima (Y+)
        newArea.maxY += 1;
        break;
      case 'KeyS': // S para baixo (Y-)
        newArea.minY -= 1;
        break;
      case 'PageUp': // Manter compatibilidade
        newArea.maxY += 1;
        break;
      case 'PageDown': // Manter compatibilidade
        newArea.minY -= 1;
        break;
      default:
        return;
    }

    // Verificar limites mínimos
    if (newArea.minX > newArea.maxX || 
        newArea.minY > newArea.maxY || 
        newArea.minZ > newArea.maxZ) {
      console.log('❌ Não é possível expandir mais nesta direção');
      return;
    }

    // Atualizar área
    this.selectedArea = newArea;
    this.showAreaSelection(this.selectedArea);
    
    // Preencher apenas os novos voxels
    const addedVoxels = this.fillAreaWithVoxels(this.selectedArea);
    
    const directionName = {
      'ArrowUp': 'frente',
      'ArrowDown': 'trás', 
      'ArrowRight': 'direita',
      'ArrowLeft': 'esquerda',
      'KeyW': 'cima',
      'KeyS': 'baixo',
      'PageUp': 'cima',
      'PageDown': 'baixo'
    }[direction];
    
    console.log(`📈 Área expandida para ${directionName} (+${addedVoxels} voxels)`);
  }

  /**
   * Criar preview de área durante criação
   * @param {Object} startPos - Posição inicial
   * @param {Object} endPos - Posição final
   */
  createAreaPreview(startPos, endPos) {
    this.clearAreaPreview();
    
    const minX = Math.min(startPos.x, endPos.x);
    const maxX = Math.max(startPos.x, endPos.x);
    const minY = Math.min(startPos.y, endPos.y);
    const maxY = Math.max(startPos.y, endPos.y);
    const minZ = Math.min(startPos.z, endPos.z);
    const maxZ = Math.max(startPos.z, endPos.z);
    
    const width = maxX - minX + 1;
    const height = maxY - minY + 1;
    const depth = maxZ - minZ + 1;
    
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerZ = (minZ + maxZ) / 2;
    
    // Criar preview wireframe
    const previewGeometry = new THREE.BoxGeometry(width, height, depth);
    const previewMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00, // Amarelo para preview
      wireframe: true,
      transparent: true,
      opacity: 0.6
    });
    
    this.areaPreviewBox = new THREE.Mesh(previewGeometry, previewMaterial);
    this.areaPreviewBox.position.set(centerX, centerY, centerZ);
    this.areaPreviewBox.name = 'areaPreview';
    
    this.scene.add(this.areaPreviewBox);
  }

  /**
   * Limpar preview de área
   */
  clearAreaPreview() {
    if (this.areaPreviewBox) {
      this.scene.remove(this.areaPreviewBox);
      this.areaPreviewBox = null;
    }
  }

  /**
   * Criar handles visuais para redimensionamento
   * @param {Object} area - Dados da área
   */
  createResizeHandles(area) {
    this.clearResizeHandles();
    
    const width = area.maxX - area.minX + 1;
    const height = area.maxY - area.minY + 1;
    const depth = area.maxZ - area.minZ + 1;
    
    const centerX = (area.minX + area.maxX) / 2;
    const centerY = (area.minY + area.maxY) / 2;
    const centerZ = (area.minZ + area.maxZ) / 2;
    
    const handleSize = 0.3;
    const handleOffset = 0.7;
    
    // Criar handles nos 8 cantos (redimensionamento livre)
    const cornerHandles = [
      { pos: [area.minX - handleOffset, area.minY - handleOffset, area.minZ - handleOffset], type: 'corner', axes: ['x', 'y', 'z'], directions: ['-x', '-y', '-z'], color: 0xffffff },
      { pos: [area.maxX + handleOffset, area.minY - handleOffset, area.minZ - handleOffset], type: 'corner', axes: ['x', 'y', 'z'], directions: ['+x', '-y', '-z'], color: 0xffffff },
      { pos: [area.minX - handleOffset, area.maxY + handleOffset, area.minZ - handleOffset], type: 'corner', axes: ['x', 'y', 'z'], directions: ['-x', '+y', '-z'], color: 0xffffff },
      { pos: [area.maxX + handleOffset, area.maxY + handleOffset, area.minZ - handleOffset], type: 'corner', axes: ['x', 'y', 'z'], directions: ['+x', '+y', '-z'], color: 0xffffff },
      { pos: [area.minX - handleOffset, area.minY - handleOffset, area.maxZ + handleOffset], type: 'corner', axes: ['x', 'y', 'z'], directions: ['-x', '-y', '+z'], color: 0xffffff },
      { pos: [area.maxX + handleOffset, area.minY - handleOffset, area.maxZ + handleOffset], type: 'corner', axes: ['x', 'y', 'z'], directions: ['+x', '-y', '+z'], color: 0xffffff },
      { pos: [area.minX - handleOffset, area.maxY + handleOffset, area.maxZ + handleOffset], type: 'corner', axes: ['x', 'y', 'z'], directions: ['-x', '+y', '+z'], color: 0xffffff },
      { pos: [area.maxX + handleOffset, area.maxY + handleOffset, area.maxZ + handleOffset], type: 'corner', axes: ['x', 'y', 'z'], directions: ['+x', '+y', '+z'], color: 0xffffff }
    ];
    
    // Criar handles no centro das faces (redimensionamento em uma direção)
    const faceHandles = [
      { pos: [area.maxX + handleOffset, centerY, centerZ], type: 'face', axes: ['x'], directions: ['+x'], color: 0xff4444, label: `${width}` },
      { pos: [area.minX - handleOffset, centerY, centerZ], type: 'face', axes: ['x'], directions: ['-x'], color: 0xff4444, label: `${width}` },
      { pos: [centerX, area.maxY + handleOffset, centerZ], type: 'face', axes: ['y'], directions: ['+y'], color: 0x44ff44, label: `${height}` },
      { pos: [centerX, area.minY - handleOffset, centerZ], type: 'face', axes: ['y'], directions: ['-y'], color: 0x44ff44, label: `${height}` },
      { pos: [centerX, centerY, area.maxZ + handleOffset], type: 'face', axes: ['z'], directions: ['+z'], color: 0x4444ff, label: `${depth}` },
      { pos: [centerX, centerY, area.minZ - handleOffset], type: 'face', axes: ['z'], directions: ['-z'], color: 0x4444ff, label: `${depth}` }
    ];
    
    // Criar todos os handles
    [...cornerHandles, ...faceHandles].forEach((data, index) => {
      const handleGeometry = new THREE.BoxGeometry(handleSize, handleSize, handleSize);
      const handleMaterial = new THREE.MeshLambertMaterial({ 
        color: data.color,
        transparent: true,
        opacity: 0.8,
        emissive: data.color,
        emissiveIntensity: 0.2
      });
      
      const handle = new THREE.Mesh(handleGeometry, handleMaterial);
      handle.position.set(...data.pos);
      handle.userData.isResizeHandle = true;
      handle.userData.handleType = data.type;
      handle.userData.axes = data.axes;
      handle.userData.directions = data.directions;
      handle.userData.originalColor = data.color;
      
      this.scene.add(handle);
      this.areaResizeHandles.push(handle);
      
      // Criar labels para handles de face
      if (data.type === 'face' && data.label) {
        const labelPos = [...data.pos];
        // Ajustar posição do label para ficar mais afastado
        if (data.directions[0] === '+x') labelPos[0] += 1.0;
        if (data.directions[0] === '-x') labelPos[0] -= 1.0;
        if (data.directions[0] === '+y') labelPos[1] += 1.0;
        if (data.directions[0] === '-y') labelPos[1] -= 1.0;
        if (data.directions[0] === '+z') labelPos[2] += 1.0;
        if (data.directions[0] === '-z') labelPos[2] -= 1.0;
        
        this.createDimensionLabel(data.label, labelPos, data.color);
      }
      
      // Criar labels informativos para handles de canto (mostrando dimensões completas)
      if (data.type === 'corner' && index === 0) { // Apenas no primeiro canto para não poluir
        const labelPos = [data.pos[0], data.pos[1] + 1.5, data.pos[2]];
        const dimensionText = `${width}×${height}×${depth}`;
        this.createDimensionLabel(dimensionText, labelPos, 0xffffff);
      }
    });
  }

  /**
   * Criar label de dimensão
   * @param {string} text - Texto do label
   * @param {Array} position - Posição [x, y, z]
   * @param {number} color - Cor do label
   */
  createDimensionLabel(text, position, color) {
    // Criar canvas com alta resolução
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 512;
    canvas.height = 128;
    
    // Fundo completamente transparente
    context.clearRect(0, 0, canvas.width, canvas.height);
    
    // Configurar fonte moderna e elegante
    context.font = 'bold 64px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    // Criar efeito de brilho/glow sutil
    context.shadowColor = 'rgba(255, 255, 255, 0.8)';
    context.shadowBlur = 8;
    context.shadowOffsetX = 0;
    context.shadowOffsetY = 0;
    
    // Texto principal branco com brilho
    context.fillStyle = '#ffffff';
    context.fillText(text, canvas.width / 2, canvas.height / 2);
    
    // Adicionar stroke fino para definição
    context.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    context.lineWidth = 2;
    context.strokeText(text, canvas.width / 2, canvas.height / 2);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    const spriteMaterial = new THREE.SpriteMaterial({ 
      map: texture,
      transparent: true,
      alphaTest: 0.01
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    
    sprite.position.set(...position);
    const baseScale = new THREE.Vector3(3.0, 0.75, 1);
    sprite.scale.copy(baseScale);
    sprite.userData.isDimensionLabel = true;
    sprite.userData.originalScale = baseScale.clone();
    
    this.scene.add(sprite);
    this.areaDimensionLabels.push(sprite);
  }

  /**
   * Limpar handles de redimensionamento
   */
  clearResizeHandles() {
    this.areaResizeHandles.forEach(handle => this.scene.remove(handle));
    this.areaDimensionLabels.forEach(label => this.scene.remove(label));
    this.areaResizeHandles = [];
    this.areaDimensionLabels = [];
  }

  /**
   * Remover voxels fora da nova área (para contração)
   * @param {Object} oldArea - Área antiga
   * @param {Object} newArea - Nova área
   */
  removeVoxelsOutsideArea(oldArea, newArea) {
    const voxelsToRemove = [];
    
    this.voxels.forEach(voxel => {
      const x = Math.round(voxel.position.x);
      const y = Math.round(voxel.position.y);
      const z = Math.round(voxel.position.z);
      
      // Verificar se o voxel estava na área antiga mas não está na nova
      const wasInOldArea = (x >= oldArea.minX && x <= oldArea.maxX &&
                           y >= oldArea.minY && y <= oldArea.maxY &&
                           z >= oldArea.minZ && z <= oldArea.maxZ);
                           
      const isInNewArea = (x >= newArea.minX && x <= newArea.maxX &&
                          y >= newArea.minY && y <= newArea.maxY &&
                          z >= newArea.minZ && z <= newArea.maxZ);
      
      if (wasInOldArea && !isInNewArea) {
        voxelsToRemove.push(voxel);
      }
    });
    
    // Remover voxels fora da nova área
    voxelsToRemove.forEach(voxel => {
      this.removeVoxel(voxel, false);
    });
    
    if (voxelsToRemove.length > 0) {
      this.saveState();
      console.log(`🗑️ ${voxelsToRemove.length} voxels removidos na contração`);
    }
  }

  /**
   * Verificar se há uma área selecionada
   * @returns {boolean} True se há área selecionada
   */
  hasAreaSelected() {
    return this.isAreaSelected && this.selectedArea !== null;
  }

  /**
   * Obter área atualmente selecionada
   * @returns {Object|null} Dados da área ou null
   */
  getSelectedArea() {
    return this.selectedArea;
  }

  /**
   * Obter handles de redimensionamento
   * @returns {Array} Array de handles
   */
  getResizeHandles() {
    return this.areaResizeHandles;
  }
}

// Exportar classe para ES6 modules
export { AreaFillSystem };

// Expor classe globalmente para compatibilidade
if (typeof window !== 'undefined') {
  window.AreaFillSystem = AreaFillSystem;
}