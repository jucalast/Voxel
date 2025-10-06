// =====================================================================
// SISTEMA DE SELEÇÃO E MOVIMENTAÇÃO DE VOXELS - MÓDULO INDEPENDENTE
// =====================================================================

class VoxelSelectionSystem {
  constructor(scene, voxelsArray, saveStateCallback, removeVoxelCallback) {
    this.scene = scene;
    this.voxels = voxelsArray;
    this.saveState = saveStateCallback;
    this.removeVoxel = removeVoxelCallback;
    
    // Variáveis de seleção
    this.selectedVoxels = new Set();
    this.isDraggingVoxels = false;
    this.dragStartPosition = null;
    this.voxelPreviewMeshes = [];
    this.isInMoveMode = false;
  }

  /**
   * Alternar seleção de voxel com diferentes modos
   * @param {THREE.Mesh} voxel - Voxel a ser selecionado
   * @param {string} selectionMode - Modo: 'single', 'color', 'connected'
   */
  toggleVoxelSelection(voxel, selectionMode = 'single') {
    switch (selectionMode) {
      case 'single':
        this.toggleSingleVoxel(voxel);
        break;
      case 'color':
        this.selectByColor(voxel);
        break;
      case 'connected':
        this.selectConnected(voxel);
        break;
    }
    
    this.updateSelectionInfo();
  }

  /**
   * Alternar seleção de um único voxel
   * @param {THREE.Mesh} voxel - Voxel a ser alternado
   */
  toggleSingleVoxel(voxel) {
    if (this.selectedVoxels.has(voxel)) {
      this.selectedVoxels.delete(voxel);
      this.removeSelectionHighlight(voxel);
      console.log(`➖ Voxel desselecionado. Total: ${this.selectedVoxels.size}`);
    } else {
      this.selectedVoxels.add(voxel);
      this.addSelectionHighlight(voxel);
      console.log(`➕ Voxel selecionado. Total: ${this.selectedVoxels.size}`);
    }
  }

  /**
   * Selecionar todos os voxels da mesma cor
   * @param {THREE.Mesh} clickedVoxel - Voxel de referência
   */
  selectByColor(clickedVoxel) {
    const targetColor = clickedVoxel.userData.color;
    let addedCount = 0;
    
    // Primeiro, limpar seleção anterior
    this.clearSelection();
    
    this.voxels.forEach(voxel => {
      if (voxel.userData.color === targetColor) {
        this.selectedVoxels.add(voxel);
        this.addSelectionHighlight(voxel);
        addedCount++;
      }
    });
    
    console.log(`🎨 Selecionados ${addedCount} voxels pela cor ${targetColor}`);
  }

  /**
   * Selecionar todos os voxels conectados
   * @param {THREE.Mesh} startVoxel - Voxel inicial
   */
  selectConnected(startVoxel) {
    const connectedVoxels = this.findConnectedVoxels(startVoxel);
    let addedCount = 0;
    
    // Primeiro, limpar seleção anterior
    this.clearSelection();
    
    connectedVoxels.forEach(voxel => {
      this.selectedVoxels.add(voxel);
      this.addSelectionHighlight(voxel);
      addedCount++;
    });
    
    console.log(`🔗 Selecionados ${addedCount} voxels conectados`);
  }

  /**
   * Encontrar todos os voxels conectados ao voxel inicial
   * @param {THREE.Mesh} startVoxel - Voxel inicial
   * @returns {Array} Array de voxels conectados
   */
  findConnectedVoxels(startVoxel) {
    console.log('🔍 Iniciando busca de voxels conectados a partir de:', startVoxel.position);
    const connected = new Set();
    const toCheck = [startVoxel];
    
    while (toCheck.length > 0) {
      const current = toCheck.pop();
      if (connected.has(current)) continue;
      
      connected.add(current);
      console.log('➕ Adicionado voxel conectado na posição:', current.position);
      
      // Procurar voxels adjacentes (6 direções)
      const neighbors = this.findAdjacentVoxels(current);
      console.log(`🔍 Encontrados ${neighbors.length} vizinhos adjacentes`);
      neighbors.forEach(neighbor => {
        if (!connected.has(neighbor)) {
          toCheck.push(neighbor);
        }
      });
    }
    
    console.log(`✅ Total de voxels conectados encontrados: ${connected.size}`);
    return Array.from(connected);
  }

  /**
   * Encontrar voxels adjacentes (6 direções)
   * @param {THREE.Mesh} voxel - Voxel central
   * @returns {Array} Array de voxels adjacentes
   */
  findAdjacentVoxels(voxel) {
    const adjacent = [];
    const pos = voxel.position;
    
    // 6 direções adjacentes
    const directions = [
      { x: 1, y: 0, z: 0 },
      { x: -1, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
      { x: 0, y: -1, z: 0 },
      { x: 0, y: 0, z: 1 },
      { x: 0, y: 0, z: -1 }
    ];
    
    directions.forEach(dir => {
      const checkPos = {
        x: Math.round(pos.x + dir.x),
        y: Math.round(pos.y + dir.y),
        z: Math.round(pos.z + dir.z)
      };
      
      const neighbor = this.voxels.find(v => 
        Math.round(v.position.x) === checkPos.x &&
        Math.round(v.position.y) === checkPos.y &&
        Math.round(v.position.z) === checkPos.z
      );
      
      if (neighbor) {
        adjacent.push(neighbor);
      }
    });
    
    return adjacent;
  }

  /**
   * Adicionar destaque visual ao voxel selecionado
   * @param {THREE.Mesh} voxel - Voxel a ser destacado
   */
  addSelectionHighlight(voxel) {
    // Criar outline brilhante e otimizado para voxel selecionado
    const outlineGeometry = new THREE.BoxGeometry(1.15, 1.15, 1.15);
    const outlineMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.8,
      wireframe: true,
      wireframeLinewidth: 3
    });

    const outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
    outline.position.copy(voxel.position);
    outline.userData.isSelectionOutline = true;
    outline.userData.parentVoxel = voxel;

    this.scene.add(outline);
    voxel.userData.selectionOutline = outline;

    console.log('✨ Gizmo de seleção otimizado criado');
  }

  /**
   * Remover destaque visual do voxel
   * @param {THREE.Mesh} voxel - Voxel a ter o destaque removido
   */
  removeSelectionHighlight(voxel) {
    if (voxel.userData.selectionOutline) {
      this.scene.remove(voxel.userData.selectionOutline);
      delete voxel.userData.selectionOutline;
    }
  }

  /**
   * Limpar toda a seleção
   */
  clearSelection() {
    this.selectedVoxels.forEach(voxel => {
      this.removeSelectionHighlight(voxel);
    });
    this.selectedVoxels.clear();
    this.updateSelectionInfo();
    console.log('🔄 Seleção limpa');
  }

  /**
   * Atualizar informações da seleção
   */
  updateSelectionInfo() {
    if (this.selectedVoxels.size > 0) {
      console.log(`🎯 ${this.selectedVoxels.size} voxels selecionados`);
    }
  }

  /**
   * Deletar todos os voxels selecionados
   */
  deleteSelectedVoxels() {
    if (this.selectedVoxels.size === 0) return;
    
    const toDelete = Array.from(this.selectedVoxels);
    toDelete.forEach(voxel => {
      this.removeSelectionHighlight(voxel);
      this.removeVoxel(voxel);
    });
    this.selectedVoxels.clear();
    
    console.log(`🗑️ ${toDelete.length} voxels deletados`);
  }

  /**
   * Selecionar todos os voxels
   */
  selectAllVoxels() {
    this.clearSelection();
    this.voxels.forEach(voxel => {
      this.selectedVoxels.add(voxel);
      this.addSelectionHighlight(voxel);
    });
    this.updateSelectionInfo();
    console.log(`🎨 Todos os voxels selecionados (${this.voxels.length})`);
  }

  /**
   * Mover voxels selecionados na direção especificada
   * @param {string} direction - Direção do movimento
   */
  moveSelectedVoxels(direction) {
    if (this.selectedVoxels.size === 0) return;
    
    let deltaX = 0, deltaY = 0, deltaZ = 0;
    
    switch(direction) {
      case 'ArrowUp':
        deltaZ = -1; // Para frente
        break;
      case 'ArrowDown':
        deltaZ = 1; // Para trás
        break;
      case 'ArrowRight':
        deltaX = 1; // Para direita
        break;
      case 'ArrowLeft':
        deltaX = -1; // Para esquerda
        break;
      case 'KeyW': // W para cima
        deltaY = 1;
        break;
      case 'KeyS': // S para baixo
        deltaY = -1;
        break;
      case 'PageUp': // Manter compatibilidade
        deltaY = 1; // Para cima
        break;
      case 'PageDown': // Manter compatibilidade
        deltaY = -1; // Para baixo
        break;
    }
    
    this.moveVoxelsBy(deltaX, deltaY, deltaZ);
  }

  /**
   * Mover voxels por um delta específico
   * @param {number} deltaX - Movimento em X
   * @param {number} deltaY - Movimento em Y
   * @param {number} deltaZ - Movimento em Z
   */
  moveVoxelsBy(deltaX, deltaY, deltaZ) {
    // Verificar se todas as novas posições estão livres
    const newPositions = [];
    const canMove = Array.from(this.selectedVoxels).every(voxel => {
      const newPos = {
        x: Math.round(voxel.position.x + deltaX),
        y: Math.round(voxel.position.y + deltaY),
        z: Math.round(voxel.position.z + deltaZ)
      };
      
      // Verificar se não há colisão com voxel não selecionado
      const collision = this.voxels.find(v => {
        if (this.selectedVoxels.has(v)) return false; // Ignorar voxels selecionados
        return Math.round(v.position.x) === newPos.x && 
               Math.round(v.position.y) === newPos.y && 
               Math.round(v.position.z) === newPos.z;
      });
      
      newPositions.push({ voxel, newPos });
      return !collision;
    });
    
    if (canMove) {
      // Mover todos os voxels
      newPositions.forEach(({ voxel, newPos }) => {
        voxel.position.set(newPos.x, newPos.y, newPos.z);
        voxel.userData.originalPosition = newPos;
        
        // Mover outline de seleção também
        if (voxel.userData.selectionOutline) {
          voxel.userData.selectionOutline.position.copy(voxel.position);
        }
      });
      
      this.saveState();
      const direction = deltaX !== 0 ? (deltaX > 0 ? 'direita' : 'esquerda') :
                       deltaY !== 0 ? (deltaY > 0 ? 'cima' : 'baixo') :
                       deltaZ !== 0 ? (deltaZ > 0 ? 'trás' : 'frente') : '';
      console.log(`🔄 ${this.selectedVoxels.size} voxels movidos para ${direction}`);
    } else {
      console.log('❌ Movimento bloqueado - colisão detectada');
    }
  }

  /**
   * Obter voxels atualmente selecionados
   * @returns {Set} Conjunto de voxels selecionados
   */
  getSelectedVoxels() {
    return this.selectedVoxels;
  }

  /**
   * Verificar se há voxels selecionados
   * @returns {boolean} True se há voxels selecionados
   */
  hasSelection() {
    return this.selectedVoxels.size > 0;
  }
}

// Exportar classe para ES6 modules
export { VoxelSelectionSystem };

// Expor classe globalmente para compatibilidade
if (typeof window !== 'undefined') {
  window.VoxelSelectionSystem = VoxelSelectionSystem;
}