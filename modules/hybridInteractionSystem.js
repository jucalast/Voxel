// =====================================================================
// SISTEMA DE INTERAÇÃO HÍBRIDA - HYBRID INTERACTION SYSTEM
// =====================================================================

/**
 * Sistema responsável por gerenciar todas as interações de entrada do usuário
 * Suporta mouse, trackpad, touch e múltiplos modos de interação complexos
 */
export class HybridInteractionSystem {
  constructor(canvas, camera, controls, colorSystem, areaFillSystem, voxelSelectionSystem, mouseSystem) {
    // Referências principais
    this.canvas = canvas;
    this.camera = camera;
    this.controls = controls;
    this.colorSystem = colorSystem;
    this.areaFillSystem = areaFillSystem;
    this.voxelSelectionSystem = voxelSelectionSystem;
    this.mouseSystem = mouseSystem;
    
    // Callbacks que serão definidas externamente
    this.callbacks = {
      getIntersection: null,
      removeVoxel: null,
      updateCursor: null,
      startHandleResize: null,
      updateHandleResize: null,
      finishHandleResize: null
    };
    
    // Estados de interação
    this.state = {
      isMouseDown: false,
      isDragging: false,
      mouseDownTime: 0,
      mouseDownPosition: { x: 0, y: 0 },
      lastTouchTime: 0,
      touchCount: 0,
      isCtrlPressed: false,
      isShiftPressed: false,
      isInMoveMode: false,
      isDoubleClicking: false,
      isCreatingArea: false,
      isAreaDragging: false,
      areaCreationStartPos: null,
      isDraggingHandle: false,
      draggedHandle: null,
      isTrackpad: false
    };
    
    // Constantes configuráveis
    this.config = {
      DRAG_THRESHOLD: 8,
      CLICK_TIME_THRESHOLD: 300,
      DOUBLE_CLICK_TIME: 500,
      TRACKPAD_HINT_DELAY: 2000,
      TRACKPAD_HINT_DURATION: 4000
    };
    
    // Elementos UI
    this.trackpadHint = document.getElementById('trackpad-hint');
    this.hintTimeout = null;
    this.mouseDownEvent = null;
    
    console.log('🎮 HybridInteractionSystem inicializado');
  }

  /**
   * Inicializa o sistema de interação híbrida
   */
  init() {
    this.setupHybridInteraction();
    console.log('🎮 Sistema de interação híbrida inicializado');
  }

  /**
   * Define os callbacks necessários para o funcionamento
   * @param {object} callbacks - Objeto com as funções callback
   */
  setCallbacks(callbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
    console.log('🎮 Callbacks do sistema de interação configurados');
  }

  /**
   * Configura toda a interação híbrida
   */
  setupHybridInteraction() {
    // Configurar controles iniciais
    this.setupInitialControls();
    
    // Configurar detecção de trackpad
    this.setupTrackpadDetection();
    
    // Configurar event listeners principais
    this.setupMainEventListeners();
    
    // Configurar suporte touch
    this.setupTouchSupport();
    
    // Configurar menu de contexto
    this.setupContextMenu();
    
    // Mostrar dica inicial para trackpad
    this.showInitialTrackpadHint();
    
    console.log('🎮 Interação híbrida configurada');
  }

  /**
   * Configura controles iniciais otimizados
   */
  setupInitialControls() {
    // Configurações específicas para trackpad
    this.controls.panSpeed = 0.8;
    this.controls.rotateSpeed = 0.5;
    this.controls.zoomSpeed = 0.6;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.15;

    // Habilitar controles de câmera sempre
    this.controls.enabled = true;
    this.controls.enableRotate = true;
    
    console.log('🎮 Controles iniciais configurados');
  }

  /**
   * Configura detecção automática de trackpad
   */
  setupTrackpadDetection() {
    this.canvas.addEventListener('wheel', (e) => {
      // Trackpads geralmente enviam valores menores e mais frequentes
      if (Math.abs(e.deltaY) < 10 && e.deltaMode === 0) {
        this.state.isTrackpad = true;
        this.controls.zoomSpeed = 0.3; // Reduzir para trackpad
        this.showTrackpadHint();
        this.canvas.classList.add('trackpad-mode');
      } else {
        this.controls.zoomSpeed = 1.0; // Normal para mouse
        this.canvas.classList.remove('trackpad-mode');
      }
    }, { passive: true });
  }

  /**
   * Configura os event listeners principais
   */
  setupMainEventListeners() {
    // Listeners de teclado para modificadores
    this.setupKeyboardListeners();
    
    // Listeners de mouse
    this.setupMouseListeners();
    
    console.log('🎮 Event listeners principais configurados');
  }

  /**
   * Configura listeners de teclado para teclas modificadoras
   */
  setupKeyboardListeners() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Control') {
        if (!this.state.isCtrlPressed) {
          this.state.isCtrlPressed = true;
          this.callbacks.updateCursor?.();
          console.log('🎮 Ctrl pressionado - Modo criação de área ativo');
        }
      }
      
      if (e.key === 'Shift') {
        if (!this.state.isShiftPressed) {
          this.state.isShiftPressed = true;
          this.state.isInMoveMode = true;
          this.callbacks.updateCursor?.();
          console.log('🎮 Shift pressionado - Modo seleção ativo');
        }
      }
    });

    document.addEventListener('keyup', (e) => {
      if (e.key === 'Control') {
        this.state.isCtrlPressed = false;
        this.state.isInMoveMode = false;
        this.handleCtrlRelease();
      }
      
      if (e.key === 'Shift') {
        this.state.isShiftPressed = false;
        this.state.isInMoveMode = false;
        this.handleShiftRelease();
      }
    });
  }

  /**
   * Configura listeners de mouse
   */
  setupMouseListeners() {
    this.canvas.addEventListener('mousedown', (event) => this.handleMouseDown(event));
    this.canvas.addEventListener('mousemove', (event) => this.handleMouseMove(event));
    this.canvas.addEventListener('mouseup', (event) => this.handleMouseUp(event));
  }

  /**
   * Manipula evento mousedown
   * @param {MouseEvent} event 
   */
  handleMouseDown(event) {
    // Se eyedropper está ativo, não interferir
    if (this.colorSystem.isEyedropperActivated()) return;
    
    this.state.isMouseDown = true;
    this.state.isDragging = false;
    this.state.mouseDownTime = Date.now();
    this.state.mouseDownPosition.x = event.clientX;
    this.state.mouseDownPosition.y = event.clientY;
    this.mouseDownEvent = event;
    
    // Sistema de SELEÇÃO - Shift + clique
    if (this.state.isShiftPressed) {
      return this.handleSelectionMode(event);
    }
    
    // Sistema de REDIMENSIONAMENTO - Detectar clique em handle
    if (this.areaFillSystem?.hasAreaSelected() && !this.state.isShiftPressed && !this.state.isCtrlPressed) {
      return this.handleResizeHandleClick(event);
    }
    
    // Sistema de CRIAÇÃO DE ÁREA - Ctrl + clique + arrastar
    if (this.state.isCtrlPressed && !this.state.isShiftPressed) {
      return this.handleAreaCreationStart(event);
    }
    
    // Comportamento normal - verificar double-click
    if (event.button === 0 && Date.now() - this.state.lastTouchTime < this.config.DOUBLE_CLICK_TIME) {
      this.handleDoubleClick(event);
      return;
    }
    
    this.state.lastTouchTime = Date.now();
    
    // Para trackpad, desabilitar rotação temporariamente no clique
    if (this.state.isTrackpad && event.button === 0) {
      this.controls.enableRotate = false;
    }
  }

  /**
   * Manipula evento mousemove
   * @param {MouseEvent} event 
   */
  handleMouseMove(event) {
    if (!this.state.isMouseDown || this.colorSystem.isEyedropperActivated()) return;
    
    // Verificar hover nos handles de redimensionamento
    this.handleResizeHandleHover(event);
    
    const deltaX = Math.abs(event.clientX - this.state.mouseDownPosition.x);
    const deltaY = Math.abs(event.clientY - this.state.mouseDownPosition.y);
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    // Threshold adaptativo para trackpad
    const threshold = this.state.isTrackpad ? this.config.DRAG_THRESHOLD * 1.5 : this.config.DRAG_THRESHOLD;
    
    // MODO DE CRIAÇÃO DE ÁREA
    if (this.state.isCreatingArea && this.state.isAreaDragging && this.state.areaCreationStartPos) {
      return this.handleAreaCreationMove(event);
    }
    
    // MODO DE REDIMENSIONAMENTO COM HANDLES
    if (this.state.isDraggingHandle && this.state.draggedHandle) {
      return this.callbacks.updateHandleResize?.(event);
    }
    
    // Modo de seleção com Shift - determinar se é clique ou arrastar
    if (this.state.isShiftPressed && this.state.isDoubleClicking && !this.state.isCreatingArea) {
      return this.handleSelectionDrag(event, distance, threshold);
    }
    
    // Arrastar normal para rotação
    if (distance > threshold && !this.state.isDragging && !this.state.isShiftPressed && 
        !this.state.isCreatingArea && !this.state.isCtrlPressed && !this.state.isDraggingHandle) {
      this.handleNormalDrag();
    }
  }

  /**
   * Manipula evento mouseup
   * @param {MouseEvent} event 
   */
  handleMouseUp(event) {
    if (this.colorSystem.isEyedropperActivated()) return;
    
    // FINALIZAÇÃO DE REDIMENSIONAMENTO COM HANDLES
    if (this.state.isDraggingHandle && this.state.draggedHandle) {
      this.callbacks.finishHandleResize?.();
      return;
    }
    
    const mouseUpTime = Date.now();
    const timeDiff = mouseUpTime - this.state.mouseDownTime;
    const timeThreshold = this.state.isTrackpad ? this.config.CLICK_TIME_THRESHOLD * 1.5 : this.config.CLICK_TIME_THRESHOLD;
    
    // FINALIZAÇÃO DE CRIAÇÃO DE ÁREA
    if (this.state.isCreatingArea && this.state.isAreaDragging && this.state.areaCreationStartPos) {
      return this.handleAreaCreationFinish(event);
    }
    
    // Modo de seleção com Shift
    if (this.state.isShiftPressed && this.state.isDoubleClicking && !this.state.isCreatingArea) {
      return this.handleSelectionFinish(event);
    }
    
    // Se estava em modo pan da câmera com Shift
    if (this.state.isShiftPressed && this.state.isDragging && this.controls.mouseButtons.LEFT === THREE.MOUSE.PAN) {
      return this.handleCameraPanFinish();
    }
    
    // Clique normal - adicionar voxel
    if (!this.state.isDragging && timeDiff < timeThreshold && this.mouseDownEvent) {
      this.handleNormalClick();
    }
    
    // Reset geral
    this.resetInteractionState();
  }

  // =====================================================================
  // HANDLERS ESPECÍFICOS PARA CADA MODO
  // =====================================================================

  /**
   * Manipula modo de seleção (Shift + clique)
   * @param {MouseEvent} event 
   */
  handleSelectionMode(event) {
    console.log('🎯 SHIFT + CLIQUE DETECTADO - MODO SELEÇÃO!');
    event.preventDefault();
    event.stopPropagation();
    
    this.state.isDoubleClicking = true;
    this.state.isDragging = false;
    
    const intersect = this.callbacks.getIntersection?.(event);
    if (intersect && intersect.object && intersect.object.userData.isVoxel) {
      this.mouseDownEvent.intersectedVoxel = intersect.object;
      this.mouseDownEvent.hasVoxelIntersection = true;
    } else {
      this.mouseDownEvent.hasVoxelIntersection = false;
    }
  }

  /**
   * Manipula clique em handle de redimensionamento
   * @param {MouseEvent} event 
   */
  handleResizeHandleClick(event) {
    const intersect = this.callbacks.getIntersection?.(event);
    
    if (intersect && intersect.object && intersect.object.userData.isResizeHandle) {
      console.log('🎯 HANDLE CLICADO - INICIANDO REDIMENSIONAMENTO!');
      event.preventDefault();
      event.stopPropagation();
      
      this.callbacks.startHandleResize?.(intersect.object, event);
      return true;
    }
    return false;
  }

  /**
   * Manipula início de criação de área (Ctrl + clique)
   * @param {MouseEvent} event 
   */
  handleAreaCreationStart(event) {
    console.log('🎯 CTRL + CLIQUE - INICIANDO CRIAÇÃO DE ÁREA!');
    event.preventDefault();
    event.stopPropagation();
    
    this.state.isCreatingArea = true;
    this.state.isAreaDragging = true;
    this.state.isDoubleClicking = true;
    
    const intersect = this.callbacks.getIntersection?.(event);
    if (intersect) {
      this.state.areaCreationStartPos = {
        x: Math.round(intersect.point.x),
        y: Math.round(intersect.point.y),
        z: Math.round(intersect.point.z)
      };
    }
    
    // Desabilitar controles durante criação
    this.controls.enabled = false;
    this.controls.enableRotate = false;
    this.controls.enablePan = false;
    this.controls.enableZoom = false;
  }

  /**
   * Manipula movimento durante criação de área
   * @param {MouseEvent} event 
   */
  handleAreaCreationMove(event) {
    const intersect = this.callbacks.getIntersection?.(event);
    if (intersect) {
      const currentPos = {
        x: Math.round(intersect.point.x),
        y: Math.round(intersect.point.y),
        z: Math.round(intersect.point.z)
      };
      
      this.areaFillSystem?.createAreaPreview?.(this.state.areaCreationStartPos, currentPos);
    }
  }

  /**
   * Manipula finalização de criação de área
   * @param {MouseEvent} event 
   */
  handleAreaCreationFinish(event) {
    console.log('🎯 FINALIZANDO CRIAÇÃO DE ÁREA!');
    
    const intersect = this.callbacks.getIntersection?.(event);
    if (intersect) {
      const endPos = {
        x: Math.round(intersect.point.x),
        y: Math.round(intersect.point.y),
        z: Math.round(intersect.point.z)
      };
      
      this.areaFillSystem?.createAreaFromDrag?.(this.state.areaCreationStartPos, endPos);
    }
    
    // Reset flags de área
    this.state.isCreatingArea = false;
    this.state.isAreaDragging = false;
    this.state.areaCreationStartPos = null;
    this.areaFillSystem?.clearAreaPreview?.();
    
    // Reabilitar controles
    this.controls.enabled = true;
    this.controls.enableRotate = true;
    this.controls.enablePan = true;
    this.controls.enableZoom = true;
  }

  /**
   * Manipula arrastar durante seleção
   * @param {MouseEvent} event 
   * @param {number} distance 
   * @param {number} threshold 
   */
  handleSelectionDrag(event, distance, threshold) {
    if (distance > threshold) {
      // É um arrastar = ativar pan da câmera
      console.log('📹 Shift + Arrastar = Movendo câmera');
      this.state.isDragging = true;
      this.state.isDoubleClicking = false;
      
      // Ativar pan da câmera
      this.controls.enabled = true;
      this.controls.enableRotate = false;
      this.controls.enablePan = true;
      this.controls.enableZoom = true;
      
      // Mapear botão esquerdo para pan
      this.controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
    }
  }

  /**
   * Manipula finalização de seleção
   * @param {MouseEvent} event 
   */
  handleSelectionFinish(event) {
    console.log('👆 Shift + Clique = Seleção de voxel');
    
    if (this.mouseDownEvent.hasVoxelIntersection && this.mouseDownEvent.intersectedVoxel) {
      // Determinar modo de seleção
      let selectionMode = 'single';
      if (event.ctrlKey && event.shiftKey) {
        selectionMode = 'color';
      } else if (event.altKey && event.shiftKey) {
        selectionMode = 'connected';
      }
      
      // Fazer a seleção
      this.voxelSelectionSystem?.toggleVoxelSelection?.(this.mouseDownEvent.intersectedVoxel, selectionMode);
    } else {
      // Clicou no vazio = limpar seleção
      this.voxelSelectionSystem?.clearSelection?.();
    }
    
    this.state.isDoubleClicking = false;
    this.enableAllControls();
  }

  /**
   * Manipula finalização de pan da câmera
   */
  handleCameraPanFinish() {
    // Restaurar botão esquerdo para rotação
    this.controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    this.enableAllControls();
    console.log('📹 Pan da câmera finalizado');
  }

  /**
   * Manipula clique normal para adicionar voxel
   */
  handleNormalClick() {
    if (!this.state.isShiftPressed && !this.state.isCreatingArea && !this.state.isDraggingHandle) {
      this.mouseSystem.onMouseDown(this.mouseDownEvent);
    }
  }

  /**
   * Manipula arrastar normal para rotação
   */
  handleNormalDrag() {
    this.state.isDragging = true;
    this.controls.enableRotate = true;
    this.controls.enablePan = true;
    
    this.canvas.style.cursor = 'grabbing';
    this.canvas.classList.add('trackpad-dragging');
  }

  /**
   * Manipula hover sobre handles de redimensionamento
   * @param {MouseEvent} event 
   */
  handleResizeHandleHover(event) {
    if (!this.state.isDragging && this.areaFillSystem?.hasAreaSelected() && !this.state.isDraggingHandle) {
      const intersect = this.callbacks.getIntersection?.(event);
      
      // Reset de todos os handles para cor original
      this.areaFillSystem.getResizeHandles()?.forEach(handle => {
        handle.material.color.setHex(handle.userData.originalColor);
        handle.material.opacity = 0.8;
        handle.material.emissiveIntensity = 0.2;
        handle.scale.set(1, 1, 1);
      });
      
      // Destacar handle sob o mouse
      if (intersect && intersect.object && intersect.object.userData.isResizeHandle) {
        intersect.object.material.color.setHex(0xffffff);
        intersect.object.material.opacity = 1.0;
        intersect.object.material.emissiveIntensity = 0.4;
        intersect.object.scale.set(1.2, 1.2, 1.2);
        this.canvas.style.cursor = intersect.object.userData.handleType === 'corner' ? 'nw-resize' : 'pointer';
      } else if (!this.state.isShiftPressed && !this.state.isCtrlPressed) {
        this.callbacks.updateCursor?.();
      }
    }
  }

  /**
   * Manipula double-click para remoção de voxel
   * @param {MouseEvent} event 
   */
  handleDoubleClick(event) {
    if (event.button !== 0) return;
    
    const intersect = this.callbacks.getIntersection?.(event);
    if (intersect && intersect.object && intersect.object.userData.isVoxel) {
      console.log('🖱️ Double-click: removendo voxel');
      this.callbacks.removeVoxel?.(intersect.object);
    }
  }

  // =====================================================================
  // HANDLERS DE TECLAS MODIFICADORAS
  // =====================================================================

  /**
   * Manipula liberação da tecla Ctrl
   */
  handleCtrlRelease() {
    // Limpar previews apenas se não há área ativa
    if (this.areaFillSystem && !this.areaFillSystem.hasAreaSelected() && this.areaFillSystem.clearAreaPreview) {
      this.areaFillSystem.clearAreaPreview();
    }
    
    this.callbacks.updateCursor?.();
    
    // Reset do sistema
    this.state.isDoubleClicking = false;
    this.state.isCreatingArea = false;
    this.state.isAreaDragging = false;
    
    // Reabilitar controles apenas se não estamos em modo de área
    if (!this.areaFillSystem || !this.areaFillSystem.hasAreaSelected()) {
      this.enableAllControls();
    }
    
    console.log('🎮 Ctrl solto - Modo normal restaurado');
  }

  /**
   * Manipula liberação da tecla Shift
   */
  handleShiftRelease() {
    // Reset do sistema de seleção
    this.state.isDoubleClicking = false;
    
    // Reabilitar controles apenas se não há área ativa
    if (!this.areaFillSystem || !this.areaFillSystem.hasAreaSelected()) {
      this.enableAllControls();
    }
    
    this.callbacks.updateCursor?.();
    console.log('🎮 Shift solto - Modo normal restaurado');
  }

  // =====================================================================
  // SUPORTE TOUCH E TRACKPAD
  // =====================================================================

  /**
   * Configura suporte touch para dispositivos híbridos
   */
  setupTouchSupport() {
    this.canvas.addEventListener('touchstart', (event) => {
      event.preventDefault();
      
      if (event.touches.length === 1) {
        // Um dedo - simular clique
        const touch = event.touches[0];
        const mouseEvent = new MouseEvent('mousedown', {
          clientX: touch.clientX,
          clientY: touch.clientY,
          button: 0
        });
        this.canvas.dispatchEvent(mouseEvent);
      } else if (event.touches.length === 2) {
        // Dois dedos - habilitar controles para gesture
        this.controls.enabled = true;
        this.state.isDragging = true;
      }
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (event) => {
      event.preventDefault();
      
      if (event.touches.length === 1 && this.state.isMouseDown) {
        const touch = event.touches[0];
        const mouseEvent = new MouseEvent('mousemove', {
          clientX: touch.clientX,
          clientY: touch.clientY,
          button: 0
        });
        this.canvas.dispatchEvent(mouseEvent);
      }
    }, { passive: false });

    this.canvas.addEventListener('touchend', (event) => {
      event.preventDefault();
      
      if (event.changedTouches.length === 1) {
        const touch = event.changedTouches[0];
        const mouseEvent = new MouseEvent('mouseup', {
          clientX: touch.clientX,
          clientY: touch.clientY,
          button: 0
        });
        this.canvas.dispatchEvent(mouseEvent);
      }
      
      // Reset após um delay
      setTimeout(() => {
        this.controls.enabled = true;
        this.controls.enableRotate = true;
      }, 100);
    }, { passive: false });
  }

  /**
   * Configura menu de contexto (clique direito)
   */
  setupContextMenu() {
    this.canvas.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      
      // Clique direito para remover voxel
      const intersect = this.callbacks.getIntersection?.(event);
      if (intersect && intersect.object && intersect.object.userData.isVoxel) {
        console.log('🖱️ Clique direito: removendo voxel');
        this.callbacks.removeVoxel?.(intersect.object);
      }
    });
  }

  // =====================================================================
  // SISTEMA DE DICAS PARA TRACKPAD
  // =====================================================================

  /**
   * Mostra dica inicial para trackpad
   */
  showInitialTrackpadHint() {
    setTimeout(() => {
      this.showTrackpadHint();
    }, this.config.TRACKPAD_HINT_DELAY);
  }

  /**
   * Mostra dica contextual para trackpad
   */
  showTrackpadHint() {
    if (this.trackpadHint) {
      this.trackpadHint.classList.add('visible');
      clearTimeout(this.hintTimeout);
      this.hintTimeout = setTimeout(() => {
        this.trackpadHint.classList.remove('visible');
      }, this.config.TRACKPAD_HINT_DURATION);
    }
  }

  // =====================================================================
  // MÉTODOS DE UTILIDADE
  // =====================================================================

  /**
   * Habilita todos os controles da câmera
   */
  enableAllControls() {
    this.controls.enabled = true;
    this.controls.enableRotate = true;
    this.controls.enablePan = true;
    this.controls.enableZoom = true;
  }

  /**
   * Reset do estado de interação
   */
  resetInteractionState() {
    this.state.isMouseDown = false;
    this.state.isDragging = false;
    this.state.isDoubleClicking = false;
    
    // Reabilitar controles quando não há modificação especial
    if (!this.state.isShiftPressed && !this.state.isCtrlPressed) {
      this.enableAllControls();
    }
    
    this.canvas.classList.remove('trackpad-dragging');
    this.callbacks.updateCursor?.();
  }

  /**
   * Retorna o estado atual do sistema
   * @returns {object}
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Atualiza configurações do sistema
   * @param {object} newConfig 
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.log('🎮 Configuração do sistema de interação atualizada');
  }

  /**
   * Retorna estatísticas do sistema
   * @returns {object}
   */
  getStats() {
    return {
      isTrackpadDetected: this.state.isTrackpad,
      activeModifiers: {
        ctrl: this.state.isCtrlPressed,
        shift: this.state.isShiftPressed
      },
      currentMode: this.getCurrentMode(),
      eventsAttached: true
    };
  }

  /**
   * Determina o modo atual de interação
   * @returns {string}
   */
  getCurrentMode() {
    if (this.state.isCreatingArea) return 'area_creation';
    if (this.state.isDraggingHandle) return 'handle_resize';
    if (this.state.isShiftPressed && this.state.isDoubleClicking) return 'selection';
    if (this.state.isDragging) return 'camera_control';
    if (this.state.isCtrlPressed) return 'area_mode';
    if (this.state.isShiftPressed) return 'selection_mode';
    return 'normal';
  }

  /**
   * Remove todos os event listeners e limpa o sistema
   */
  destroy() {
    // Remover listeners específicos seria complexo
    // Por isso mantemos referências mínimas e limpamos estado
    this.resetInteractionState();
    
    // Limpar referências
    this.canvas = null;
    this.camera = null;
    this.controls = null;
    this.callbacks = null;
    
    console.log('🎮 HybridInteractionSystem destruído');
  }
}