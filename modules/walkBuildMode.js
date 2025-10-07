// =====================================================================
// MÓDULO WALK BUILD MODE SYSTEM
// =====================================================================
// Sistema de caminhada e construção estilo Minecraft para o modo sala
//
// FUNCIONALIDADES:
// - Câmera em primeira pessoa com altura de 2 voxels
// - Controles WASD para movimento
// - Mouse para olhar ao redor
// - Clique esquerdo: colocar voxel
// - Clique direito: remover voxel

// Capturar erros de Pointer Lock globalmente
document.addEventListener('pointerlockerror', (event) => {
  console.warn('⚠️ Erro no Pointer Lock capturado globalmente:', event);
});

document.addEventListener('pointerlockchange', (event) => {
  if (!document.pointerLockElement) {
    // Usuário saiu do pointer lock - não é necessário logar como erro
    console.log('🖱️ Pointer Lock desativado pelo usuário');
  }
});
// - Sistema de colisão básica com paredes e chão
// - Atmosfera realista com iluminação dinâmica
//
// DEPENDÊNCIAS:
// - Three.js (para câmera e raycasting)
// - Sistema de voxels do editor
// - AtmosphereSystem (para atmosfera realista)
//
// USO:
// 1. Importar: import { WalkBuildModeSystem } from './modules/walkBuildMode.js'
// 2. Criar instância: const walkSystem = new WalkBuildModeSystem(scene, camera, controls, roomModeSystem)
// 3. Ativar: walkSystem.enterWalkMode()
// 4. Desativar: walkSystem.exitWalkMode()
//
// =====================================================================

import { AtmosphereSystem } from './atmosphereSystem.js';

export class WalkBuildModeSystem {
  constructor(scene, camera, controls, roomModeSystem, editorFunctions = {}, onStateChange = null) {
    this.scene = scene;
    this.originalCamera = camera;
    this.controls = controls;
    this.roomModeSystem = roomModeSystem;
    this.onStateChange = onStateChange; // Callback para notificar mudanças de estado

    // Funções do editor para integração completa
    this.editorFunctions = {
      addVoxel: editorFunctions.addVoxel || this.fallbackAddVoxel.bind(this),
      removeVoxel: editorFunctions.removeVoxel || this.fallbackRemoveVoxel.bind(this),
      saveState: editorFunctions.saveState || (() => {}),
      getSelectedColor: editorFunctions.getSelectedColor || (() => 0xff0000),
      getVoxels: editorFunctions.getVoxels || (() => []),
      updateVoxelCount: editorFunctions.updateVoxelCount || (() => {})
    };

    // Câmera de caminhada (perspectiva)
    this.walkCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
    this.walkCamera.position.set(0, 2, 0); // Altura de 2 voxels
    this.walkCamera.lookAt(0, 2, -1);

    // Câmera de caminhada (perspectiva)
    this.walkCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
    this.walkCamera.position.set(0, 2, 0); // Altura de 2 voxels
    this.walkCamera.lookAt(0, 2, -1);

    // Estado do sistema
    this.isActive = false;
    this.isPointerLocked = false;

    // Controles de movimento estilo Minecraft
    this.moveSpeed = 0.8; // Velocidade base aumentada
    this.sprintSpeed = 1.2; // Velocidade de corrida aumentada
    this.mouseSensitivity = 0.0025; // Sensibilidade do mouse mais suave
    this.friction = 0.85; // Atrito para desaceleração suave
    this.acceleration = 0.08; // Aceleração aumentada para movimento mais responsivo

    // Estados de movimento
    this.keys = {
      w: false,
      a: false,
      s: false,
      d: false,
      shift: false,
      space: false,
      ctrl: false
    };

    // Vetores de movimento estilo Minecraft
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.targetVelocity = new THREE.Vector3(0, 0, 0);
    this.direction = new THREE.Vector3(0, 0, 0);

    // Estados de física
    this.isOnGround = true;
    this.jumpForce = 0.15;
    this.gravity = 0.008;
    this.verticalVelocity = 0;

    // Sistema de colisão melhorado
    this.playerRadius = 0.3; // Raio do jogador para colisão
    this.playerHeight = 1.8; // Altura do jogador

    // Estados de rotação para controle preciso
    this.yaw = 0; // Rotação horizontal (esquerda/direita)
    this.pitch = 0; // Rotação vertical (cima/baixo)

    // Sistema de raycasting para construção
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    
    // Sistema de duplo clique para portas
    this.lastClickTime = 0;
    this.lastClickedDoor = null;
    this.doubleClickDelay = 300; // 300ms para detectar duplo clique
    
    // Sistema de duas etapas para ESC
    this.cursorReleased = false; // Controla se cursor foi liberado mas ainda em walk mode
    
    // Sistema de duplo clique inicializado

    // Sistema de seleção e movimentação de objetos
    this.selectedObject = null;
    this.isDraggingObject = false;
    this.dragStartPosition = new THREE.Vector3();
    this.dragOffset = new THREE.Vector3();
    this.objectOutline = null;

    // Sistema de drag and drop de portas
    this.selectedDoor = null;
    this.isDraggingDoor = false;
    this.doorDragMode = null; // 'move', 'resize', 'transfer'
    this.doorOutlineMesh = null;
    this.doorPreviewMesh = null;
    this.dragStartMousePos = { x: 0, y: 0 };
    this.dragCurrentMousePos = { x: 0, y: 0 };
    this.doorOriginalPosition = { x: 0, y: 0 };
    this.doorOriginalConfig = null;

    // Sistema de atmosfera realista
    this.atmosphereSystem = null;

    // Sistema de iluminação artificial
    this.lightingSystem = null;

    // Elementos DOM
    this.crosshair = null;

    // === SISTEMA DE CACHE INTELIGENTE AVANÇADO ===
    this.performanceCache = {
      buildableObjects: null,
      doorMeshes: null,
      roomObjects: null,
      lastUpdate: 0,
      sceneVersion: 0,
      isValid: false,
      framesSinceUpdate: 0,
      lastDoorCount: 0,
      doorCountCheckInterval: null
    };
    
    // Debounce para atualizações de UI (otimizado)
    this.debouncedUIUpdate = this.debounce(this.refreshWalkModePanel.bind(this), 150);
    
    // Spatial hash para detecção rápida de portas
    this.doorSpatialHash = new Map();
    
    // Object pooling para vetores temporários
    this.vectorPool = {
      vectors: [],
      getVector: () => {
        return this.vectorPool.vectors.pop() || new THREE.Vector3();
      },
      returnVector: (v) => {
        v.set(0, 0, 0);
        if (this.vectorPool.vectors.length < 10) {
          this.vectorPool.vectors.push(v);
        }
      }
    };
    
    // RAF otimizado
    this.frameId = null;
    this.lastFrameTime = 0;
    this.targetFPS = 60;
    this.frameInterval = 1000 / this.targetFPS;

    // Bind methods
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseClick = this.onMouseClick.bind(this);
    this.onPointerLockChange = this.onPointerLockChange.bind(this);
    this.animate = this.animate.bind(this);

    this.init();
  }

  /**
   * Debounce elegante para evitar atualizações excessivas
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  init() {
    // Criar mira (crosshair)
    this.createCrosshair();

    // Configurar event listeners
    this.setupEventListeners();

    // Inicializar sistema de atmosfera
    this.initAtmosphereSystem();
    
    // Expor controles de velocidade globalmente
    window.walkSpeedControls = {
      setMoveSpeed: (speed) => this.setMoveSpeed(speed),
      setSprintSpeed: (speed) => this.setSprintSpeed(speed),
      setAcceleration: (acceleration) => this.setAcceleration(acceleration),
      setMouseSensitivity: (sensitivity) => this.setMouseSensitivity(sensitivity),
      getSpeeds: () => this.getSpeeds(),
      
      // Presets rápidos
      slow: () => { this.setMoveSpeed(0.4); this.setSprintSpeed(0.6); },
      normal: () => { this.setMoveSpeed(0.8); this.setSprintSpeed(1.2); },
      fast: () => { this.setMoveSpeed(1.5); this.setSprintSpeed(2.2); },
      veryfast: () => { this.setMoveSpeed(2.5); this.setSprintSpeed(4.0); }
    };
    
    // Expor controle de cursor para o botão de olho
    window.reactivateWalkControls = () => this.reactivatePointerLock();
    
    // Expor método para testar duplo clique (debug)
    window.testDoubleClick = (doorId) => {
      console.log('🧪 Testando duplo clique na porta:', doorId);
      this.processDoorClick(doorId);
      setTimeout(() => this.processDoorClick(doorId), 150);
    };
    
    // Expor métodos de debug para portas
    window.debugDoors = {
      listAll: () => {
        console.log('🚪 === DEBUG: TODAS AS PORTAS ===');
        
        if (window.doorControls) {
          const doors = window.doorControls.list();
          console.log('📋 Via doorControls:', doors);
        }
        
        if (window.doorWindowSystem?.doors) {
          console.log('🏠 Via doorWindowSystem:', Array.from(window.doorWindowSystem.doors.keys()));
        }
        
        // Portas na cena
        const sceneDoorsIds = [];
        this.scene.traverse((child) => {
          if (child.userData && child.userData.doorId) {
            sceneDoorsIds.push(child.userData.doorId);
          }
        });
        console.log('🎭 IDs na cena:', [...new Set(sceneDoorsIds)]);
      },
      
      select: (doorId) => {
        console.log(`🎯 Forçando seleção da porta: ${doorId}`);
        this.selectDoorForEditing(doorId);
      },
      
      testOutline: (doorId) => {
        console.log(`🔮 Testando outline para porta: ${doorId}`);
        this.createDoorOutline(doorId);
      },
      
      forceRefresh: () => {
        console.log('🚪🔄 Forçando atualização do cache de portas...');
        this.checkForNewDoors();
        this.refreshDoorCache();
      },
      
      getCache: () => {
        return {
          doorCount: this.performanceCache.lastDoorCount,
          spatialHashSize: this.doorSpatialHash?.size || 0,
          cacheValid: this.performanceCache.isValid,
          lastUpdate: new Date(this.performanceCache.lastUpdate).toLocaleTimeString()
        };
      }
    };
    
    // Sistema de limpeza inteligente com throttling
    this.cleanupInterval = setInterval(() => {
      if (this.isActive) {
        // Throttling baseado na performance
        const now = Date.now();
        if (!this._lastCleanup || now - this._lastCleanup > 45000) {
          this.cleanupResources();
          this._lastCleanup = now;
        }
        
        // Monitor de texturas menos frequente
        if (!this._lastTextureCheck || now - this._lastTextureCheck > 15000) {
          this.monitorTextureUsage();
          this._lastTextureCheck = now;
        }
        
        // NOVO: Detectar mudanças no número de portas
        this.checkForNewDoors();
      }
    }, 15000); // Check a cada 15 segundos, mas ação menos frequente
    
    // Monitor mais frequente apenas para detecção de portas
    this.doorCheckInterval = setInterval(() => {
      if (this.isActive) {
        this.checkForNewDoors();
      }
    }, 2000); // Check de portas a cada 2 segundos
    
    // Expor controles de performance globalmente
    window.walkPerformance = {
      cleanup: () => this.cleanupResources(),
      getCache: () => this.performanceCache,
      getTextureInfo: () => this.getTextureInfo(),
      optimizeMaterials: () => this.optimizeAllMaterials()
    };
    
    // Expor sistema de seleção para debug
    window.walkSystem = this;
    
    // Expor comandos de debug para lâmpadas
    window.debugLamps = {
      create: (x, z, type = 'warm') => {
        if (this.lightingSystem) {
          const lampId = `debug_lamp_${Date.now()}`;
          return this.lightingSystem.createLamp(lampId, { x, y: 0, z }, type);
        } else {
          console.error('❌ Sistema de iluminação não carregado');
        }
      },
      
      listAll: () => {
        if (window.lampControls) {
          return window.lampControls.list();
        } else {
          console.error('❌ lampControls não disponível');
        }
      },
      
      removeAll: () => {
        if (window.lampControls) {
          const lamps = window.lampControls.list();
          lamps.forEach(lamp => window.lampControls.remove(lamp.id));
          console.log(`🗑️ Removidas ${lamps.length} lâmpadas`);
        }
      },
      
      testPresets: () => {
        if (window.lampControls) {
          console.log('🔥 Testando preset quente...');
          window.lampControls.warmLighting();
          
          setTimeout(() => {
            console.log('❄️ Testando preset frio...');
            window.lampControls.coolLighting();
          }, 3000);
          
          setTimeout(() => {
            console.log('🌈 Testando preset misto...');
            window.lampControls.mixedLighting();
          }, 6000);
        }
      }
    };
  }

  /**
   * Inicializar sistema de atmosfera realista
   */
  initAtmosphereSystem() {
    try {
      // Obter sistema de portas/janelas se disponível
      const doorWindowSystem = window.doorWindowSystem || null;
      
      this.atmosphereSystem = new AtmosphereSystem(
        this.scene,
        this.walkCamera,
        doorWindowSystem,
        this // Passar referência para o walkBuildSystem
      );
      
      // Sistema de atmosfera inicializado
    } catch (error) {
      console.warn('⚠️ Erro ao inicializar sistema de atmosfera:', error);
    }
    
    // Inicializar sistema de iluminação artificial
    try {
      // Importar dinamicamente o sistema de iluminação
      import('./lightingSystem.js').then(({ LightingSystem }) => {
        this.lightingSystem = new LightingSystem(this.scene, this.roomModeSystem);
        console.log('💡 Sistema de iluminação artificial integrado ao walk mode');
      }).catch(error => {
        console.warn('⚠️ Erro ao carregar sistema de iluminação:', error);
      });
    } catch (error) {
      console.warn('⚠️ Erro ao inicializar sistema de iluminação:', error);
    }
  }

  createCrosshair() {
    // Criar elemento HTML para a mira
    this.crosshair = document.createElement('div');
    this.crosshair.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 20px;
      height: 20px;
      pointer-events: none;
      z-index: 1000;
      display: none;
    `;

    // Criar as linhas da mira
    const horizontal = document.createElement('div');
    horizontal.style.cssText = `
      position: absolute;
      top: 50%;
      left: 0;
      width: 100%;
      height: 2px;
      background: rgba(255, 255, 255, 0.8);
      transform: translateY(-50%);
    `;

    const vertical = document.createElement('div');
    vertical.style.cssText = `
      position: absolute;
      left: 50%;
      top: 0;
      width: 2px;
      height: 100%;
      background: rgba(255, 255, 255, 0.8);
      transform: translateX(-50%);
    `;

    this.crosshair.appendChild(horizontal);
    this.crosshair.appendChild(vertical);
    document.body.appendChild(this.crosshair);
  }

  setupEventListeners() {
    // Event listeners serão configurados quando o modo for ativado
  }

  enterWalkMode() {
    if (this.isActive) return;


    this.isActive = true;
    this.cursorReleased = false; // Resetar estado do cursor

    // Resetar estados de movimento
    this.velocity.set(0, 0, 0);
    this.targetVelocity.set(0, 0, 0);
    this.verticalVelocity = 0;
    this.isOnGround = true;

    // Resetar rotações
    this.yaw = 0;
    this.pitch = 0;
    this.walkCamera.rotation.set(0, 0, 0);

    // Resetar estados das teclas
    Object.keys(this.keys).forEach(key => {
      this.keys[key] = false;
    });

    // Substituir câmera
    this.scene.remove(this.originalCamera);
    this.scene.add(this.walkCamera);

    // Posicionar câmera na sala com altura correta
    this.walkCamera.position.set(0, 2.0, 0);
    this.walkCamera.rotation.set(0, 0, 0);

    // Desabilitar controles orbit
    this.controls.enabled = false;

    // Mostrar mira
    this.crosshair.style.display = 'block';

    // Configurar event listeners
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('click', this.onMouseClick);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);

    // Prevenir contexto menu durante o modo caminhada
    document.addEventListener('contextmenu', this.preventContextMenu);

    // Bloquear ponteiro
    try {
      const lockPromise = document.body.requestPointerLock();
      if (lockPromise && lockPromise.catch) {
        lockPromise.catch(error => {
          console.warn('⚠️ Pointer Lock rejeitado pelo usuário:', error);
        });
      }
    } catch (error) {
      console.warn('⚠️ Erro ao ativar Pointer Lock:', error);
    }

    // Ativar sistema de atmosfera para ambiente realista
    if (this.atmosphereSystem) {
      this.atmosphereSystem.activate();
    }

    // Iniciar loop de animação
    this.animate();

    // Notificar mudança de estado
    if (this.onStateChange) {
      this.onStateChange(true);
    }

    // Inicializar inventário se ainda não foi inicializado
    if (!this.inventoryElement) {
      this.initInventorySystem();
    }

    // Mostrar inventário
    this.showInventory();

    // Mostrar lista de portas existentes
    this.showExistingDoors();

    // Garantir detecção de todas as portas ao entrar no modo
    this.performanceCache.lastDoorCount = 0; // Reset para forçar detecção
    this.checkForNewDoors(); // Detectar portas imediatamente
    
    // Corrigir materiais das portas para garantir que não fiquem transparentes (UMA VEZ)
    this.fixDoorMaterialsOnce();

  }

  preventContextMenu(event) {
    if (this.isActive) {
      event.preventDefault();
    }
  }

  exitWalkMode() {
    if (!this.isActive) return;


    this.isActive = false;

    // Resetar estados de movimento
    this.velocity.set(0, 0, 0);
    this.targetVelocity.set(0, 0, 0);
    this.verticalVelocity = 0;
    this.isOnGround = true;

    // Resetar rotações
    this.yaw = 0;
    this.pitch = 0;

    // Resetar estados das teclas
    Object.keys(this.keys).forEach(key => {
      this.keys[key] = false;
    });

    // Restaurar câmera original
    this.scene.remove(this.walkCamera);
    this.scene.add(this.originalCamera);

    // Reabilitar controles orbit
    this.controls.enabled = true;

    // Esconder mira
    this.crosshair.style.display = 'none';
    
    // GARANTIR opacidade das portas ao sair do modo walk (UMA VEZ)
    this.ensureDoorOpacityOnce();

    // Cleanup completo ao sair
    this.performCompleteCleanup();
    
    // Parar todos os intervals
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    if (this.doorCheckInterval) {
      clearInterval(this.doorCheckInterval);
      this.doorCheckInterval = null;
    }
    
    // Cancelar animation frame
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }

    // Esconder inventário
    this.hideInventory();

    // Esconder lista de portas
    this.hideExistingDoors();

    // Remover event listeners
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('click', this.onMouseClick);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    document.removeEventListener('contextmenu', this.preventContextMenu);

    // Desativar sistema de atmosfera
    if (this.atmosphereSystem) {
      this.atmosphereSystem.deactivate();
    }

    // Liberar ponteiro se estiver bloqueado
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }

    // Notificar mudança de estado
    if (this.onStateChange) {
      this.onStateChange(false);
    }

  }

  /**
   * Liberar cursor sem sair do walk mode
   */
  releasePointerLock() {
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    this.cursorReleased = true;
  }

  /**
   * Reativar controle do cursor (chamado pelo botão de olho)
   */
  reactivatePointerLock() {
    if (this.isActive && !this.isPointerLocked) {
      document.body.requestPointerLock();
      this.cursorReleased = false;
    }
  }

  /**
   * Liberar cursor sem sair do walk mode
   */
  releasePointerLock() {
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    this.cursorReleased = true;
  }

  /**
   * Reativar controle do cursor (chamado pelo botão de olho)
   */
  reactivatePointerLock() {
    if (this.isActive && !this.isPointerLocked) {
      document.body.requestPointerLock();
      this.cursorReleased = false;
    }
  }

  onKeyDown(event) {
    if (!this.isActive) return;

    // Tecla G para ativar/desativar modo de arrastar objeto
    if (event.code === 'KeyG' && this.selectedObject) {
      this.toggleObjectDragging();
      event.preventDefault();
      return;
    }

    switch(event.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.w = true;
        event.preventDefault();
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.a = true;
        event.preventDefault();
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keys.s = true;
        event.preventDefault();
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keys.d = true;
        event.preventDefault();
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.keys.shift = true;
        event.preventDefault();
        break;
      case 'Space':
        this.keys.space = true;
        event.preventDefault();
        break;
      case 'ControlLeft':
      case 'ControlRight':
        this.keys.ctrl = true;
        event.preventDefault();
        break;
      // Controles do numpad para rotação precisa (direções cardinais)
      case 'Numpad8': // Cima
        this.snapToDirection(0, -Math.PI/2);
        event.preventDefault();
        break;
      case 'Numpad2': // Baixo
        this.snapToDirection(0, Math.PI/2);
        event.preventDefault();
        break;
      case 'Numpad4': // Esquerda
        this.snapToDirection(-Math.PI/2, 0);
        event.preventDefault();
        break;
      case 'Numpad6': // Direita
        this.snapToDirection(Math.PI/2, 0);
        event.preventDefault();
        break;
      case 'Numpad7': // Diagonal superior esquerda
        this.snapToDirection(-Math.PI/4, -Math.PI/2);
        event.preventDefault();
        break;
      case 'Numpad9': // Diagonal superior direita
        this.snapToDirection(Math.PI/4, -Math.PI/2);
        event.preventDefault();
        break;
      case 'Numpad1': // Diagonal inferior esquerda
        this.snapToDirection(-Math.PI/4, Math.PI/2);
        event.preventDefault();
        break;
      case 'Numpad3': // Diagonal inferior direita
        this.snapToDirection(Math.PI/4, Math.PI/2);
        event.preventDefault();
        break;
      case 'Numpad5': // Centro (reset visão)
        this.snapToDirection(0, 0);
        event.preventDefault();
        break;
      case 'KeyL': // L para listar portas (debug)
        this.debugListDoors();
        event.preventDefault();
        break;
      case 'Escape':
        // Se tem porta selecionada, desselecionar primeiro
        if (this.selectedDoor) {
          this.deselectDoor();
        } else if (this.isPointerLocked) {
          // Primeira vez ESC: liberar cursor mas manter walk mode
          this.releasePointerLock();
        } else {
          // Segunda vez ESC (cursor já liberado): sair do walk mode
          this.exitWalkMode();
        }
        break;
    }
  }

  onKeyUp(event) {
    if (!this.isActive) return;

    switch(event.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.w = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.a = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keys.s = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keys.d = false;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.keys.shift = false;
        break;
      case 'Space':
        this.keys.space = false;
        break;
      case 'ControlLeft':
      case 'ControlRight':
        this.keys.ctrl = false;
        break;
    }
  }

  onMouseMove(event) {
    if (!this.isActive || !this.isPointerLocked) return;

    const movementX = event.movementX || 0;
    const movementY = event.movementY || 0;

    // Atualizar posição atual do mouse para drag de portas
    this.dragCurrentMousePos.x += movementX;
    this.dragCurrentMousePos.y += movementY;

    // SEMPRE mover a câmera normalmente (não bloquear durante drag)
    // Aplicar sensibilidade do mouse
    const sensitivity = this.mouseSensitivity;
    this.yaw -= movementX * sensitivity;
    this.pitch -= movementY * sensitivity;

    // Limitar rotação vertical para evitar giros completos (~89 graus)
    const maxVerticalAngle = Math.PI / 2 - 0.01;
    this.pitch = Math.max(-maxVerticalAngle, Math.min(maxVerticalAngle, this.pitch));

    // Aplicar rotações à câmera usando a ordem 'YXZ' que é ideal para FPS
    this.walkCamera.rotation.order = 'YXZ';
    this.walkCamera.rotation.set(this.pitch, this.yaw, 0);

    // Se estiver arrastando uma porta, TAMBÉM processar drag (sem bloquear câmera)
    if (this.isDraggingDoor && this.selectedDoor) {
      this.updateDoorDrag(movementX, movementY);
    }

    // Se estiver arrastando um objeto, mover o objeto (mantém comportamento original)
    if (this.isDraggingObject && this.selectedObject) {
      this.moveSelectedObject(movementX, movementY);
    }
  }

  onMouseClick(event) {
    if (!this.isActive || !this.isPointerLocked) return;

    event.preventDefault();

    // Early returns para drag modes
    if (this.isDraggingDoor) {
      if (event.button === 0) {
        this.confirmDoorDrag();
      } else if (event.button === 2) {
        this.cancelDoorDrag();
      }
      return;
    }

    // Só processar cliques esquerdos para otimização
    if (event.button !== 0) return;

    // Cache do raycast para evitar recalculos
    if (!this._raycastCache || Date.now() - this._raycastCache.timestamp > 50) {
      this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.walkCamera);
      
      // Otimização: buscar primeiro em objetos mais prováveis (portas)
      let allObjects = [];
      
      // Priorizar objetos de porta (mais comum)
      if (this.doorSpatialHash && this.doorSpatialHash.size > 0) {
        for (const doorData of this.doorSpatialHash.values()) {
          if (doorData.meshes) {
            allObjects.push(...doorData.meshes.slice(0, 3)); // Limitar meshes por porta
          }
        }
      }
      
      // Adicionar room objects apenas se necessário
      const roomObjects = this.getRoomObjects();
      allObjects.push(...roomObjects.slice(0, 10)); // Limitar room objects
      
      // Adicionar buildable objects com cache
      const buildableObjects = this.getBuildableObjects();
      allObjects.push(...buildableObjects);
      
      // Cache do raycast
      const allIntersects = this.raycaster.intersectObjects(allObjects, true);
      this._raycastCache = {
        intersects: allIntersects,
        timestamp: Date.now()
      };
    }

    const allIntersects = this._raycastCache.intersects;

    if (allIntersects.length > 0) {
      const intersectedMesh = allIntersects[0].object;
      
      // Verificação otimizada de porta usando userData primeiro
      if (intersectedMesh.userData?.doorId || intersectedMesh.userData?.isDoor) {
        if (this.detectDoorClick(intersectedMesh)) {
          return;
        }
      }
      
      // Room object check otimizado
      const roomObject = this.findRoomObjectByMeshOptimized(intersectedMesh);
      if (roomObject) {
        this.selectRoomObject(roomObject);
        return;
      }

      // Construção de voxels
      const intersect = allIntersects[0];
      const point = intersect.point;
      const face = intersect.face;

      if (this.selectedObject) {
        this.deselectRoomObject();
      }
      this.placeVoxel(point, face);
    } else {
      // Clique no vazio
      if (this.selectedObject) {
        this.deselectRoomObject();
      }
    }
  }

  onPointerLockChange() {
    this.isPointerLocked = (document.pointerLockElement === document.body);
    if (this.isPointerLocked) {
    } else {
    }
  }

  // Método para ajustar visão para direções cardinais (numpad)
  snapToDirection(horizontalAngle, verticalAngle) {
    // Usar o novo sistema de yaw e pitch
    this.yaw = horizontalAngle;
    this.pitch = verticalAngle;

    // Aplicar rotações à câmera
    this.walkCamera.rotation.set(this.pitch, this.yaw, 0);

  }

  getBuildableObjects() {
    // Cache ultra-inteligente com frame counting
    const cacheAge = Date.now() - this.performanceCache.lastUpdate;
    const framesSinceUpdate = this.performanceCache.framesSinceUpdate;
    
    if (this.performanceCache.isValid && 
        this.performanceCache.buildableObjects && 
        (cacheAge < 120000 || framesSinceUpdate < 300)) { // 2 min ou 300 frames
      return this.performanceCache.buildableObjects;
    }

    // Lazy loading progressivo para evitar hitches
    const objects = [];
    let objectCount = 0;
    const MAX_OBJECTS_PER_FRAME = 50; // Limitar objetos processados por frame

    // Adicionar voxels do editor (prioritário)
    try {
      const editorVoxels = this.editorFunctions.getVoxels();
      if (editorVoxels && editorVoxels.length > 0) {
        // Limitar para evitar hitches
        const limitedVoxels = editorVoxels.slice(0, MAX_OBJECTS_PER_FRAME);
        objects.push(...limitedVoxels);
        objectCount += limitedVoxels.length;
      }
    } catch (error) {
      console.warn('Erro ao obter voxels do editor:', error);
    }

    // Room objects com cache separado
    if (!this.performanceCache.roomObjects && this.roomModeSystem?.roomObjects) {
      const roomObjects = [];
      const maxRoomObjects = Math.min(this.roomModeSystem.roomObjects.length, 5);
      
      for (let i = 0; i < maxRoomObjects && objectCount < MAX_OBJECTS_PER_FRAME; i++) {
        const obj = this.roomModeSystem.roomObjects[i];
        if (obj?.meshGroup) {
          obj.meshGroup.traverse((child) => {
            if (child.isMesh && objectCount < MAX_OBJECTS_PER_FRAME) {
              roomObjects.push(child);
              objectCount++;
            }
          });
        }
      }
      this.performanceCache.roomObjects = roomObjects;
    }
    
    if (this.performanceCache.roomObjects) {
      objects.push(...this.performanceCache.roomObjects);
    }

    // Geometria da sala (sempre necessária)
    if (this.roomModeSystem) {
      if (this.roomModeSystem.roomFloor) {
        objects.push(this.roomModeSystem.roomFloor);
      }
      if (this.roomModeSystem.roomWalls) {
        objects.push(...this.roomModeSystem.roomWalls.slice(0, 10)); // Limitar paredes
      }
    }

    // Portas otimizadas
    const { doorObjects, spatialHash } = this.getOptimizedDoorObjects();
    objects.push(...doorObjects.slice(0, 20)); // Limitar portas para performance
    
    this.doorSpatialHash = spatialHash;

    // Cache com metadados de performance
    this.performanceCache.buildableObjects = objects;
    this.performanceCache.doorMeshes = doorObjects;
    this.performanceCache.isValid = true;
    this.performanceCache.lastUpdate = Date.now();
    this.performanceCache.framesSinceUpdate = 0;
    this.performanceCache.objectCount = objects.length;

    // Log apenas se mudança significativa
    if (Math.abs(objectCount - (this.performanceCache.lastObjectCount || 0)) > 5) {
      console.log(`📦 Cache atualizado: ${objects.length} objetos buildable`);
      this.performanceCache.lastObjectCount = objectCount;
    }

    return objects;
  }

  /**
   * MÉTODO OTIMIZADO: Buscar portas com spatial hash para detecção rápida
   */
  getOptimizedDoorObjects() {
    // Verificar se há mudanças nas portas primeiro
    const currentDoorCount = this.getCurrentDoorCount();
    const cacheAge = Date.now() - this.performanceCache.lastUpdate;
    const doorCountChanged = currentDoorCount !== this.performanceCache.lastDoorCount;
    
    // Usar cache apenas se não houve mudanças E o cache não é muito antigo
    if (this.performanceCache.doorMeshes && 
        this.doorSpatialHash && 
        this.doorSpatialHash.size > 0 && 
        !doorCountChanged &&
        cacheAge < 30000) { // Cache válido por 30 segundos
      return { 
        doorObjects: this.performanceCache.doorMeshes, 
        spatialHash: this.doorSpatialHash 
      };
    }
    
    // Se houve mudança, log da atualização
    if (doorCountChanged) {
      console.log(`🚪🔄 Reconstruindo cache: mudança de ${this.performanceCache.lastDoorCount} para ${currentDoorCount} portas`);
    }

    const doorObjects = [];
    const spatialHash = new Map();
    
    // Verificar se o sistema de portas existe
    if (!window.doorWindowSystem || !window.doorWindowSystem.doors) {
      return { doorObjects, spatialHash };
    }
    
    // Iterar por todas as portas no sistema
    window.doorWindowSystem.doors.forEach((doorData, doorId) => {
      const doorMeshes = [];
      
      // Processar grupo da porta de forma mais eficiente
      if (doorData.group) {
        doorData.group.traverse((child) => {
          if (child.isMesh) {
            // Marcar o mesh com o ID da porta para facilitar detecção
            child.userData.doorId = doorId;
            child.userData.isDoor = true;
            doorObjects.push(child);
            doorMeshes.push(child);
          }
        });
      }
      
      // Processar folha da porta
      if (doorData.leaf && doorData.leaf.isMesh) {
        doorData.leaf.userData.doorId = doorId;
        doorData.leaf.userData.isDoor = true;
        doorObjects.push(doorData.leaf);
        doorMeshes.push(doorData.leaf);
      }
      
      // Processar batente
      if (doorData.frame) {
        doorData.frame.traverse((child) => {
          if (child.isMesh) {
            child.userData.doorId = doorId;
            child.userData.isDoor = true;
            doorObjects.push(child);
            doorMeshes.push(child);
          }
        });
      }
      
      // Criar entrada no spatial hash para busca O(1)
      if (doorMeshes.length > 0) {
        spatialHash.set(doorId, {
          meshes: doorMeshes,
          position: doorData.group ? doorData.group.position.clone() : new THREE.Vector3(),
          bounds: this.calculateDoorBounds(doorMeshes)
        });
      }
    });
    
    // Log apenas quando há mudança significativa
    if (doorObjects.length > 0) {
      console.log(`🚪 Cache de portas atualizado: ${doorObjects.length} meshes, ${spatialHash.size} portas`);
    }
    
    // Atualizar contador de portas
    this.performanceCache.lastDoorCount = spatialHash.size;
    
    return { doorObjects, spatialHash };
  }
  
  /**
   * Contar portas atuais em todos os sistemas
   */
  getCurrentDoorCount() {
    let count = 0;
    const doorIds = new Set();
    
    // Contar via doorControls
    if (window.doorControls) {
      try {
        const doors = window.doorControls.list();
        doors.forEach(door => doorIds.add(door.id));
      } catch (error) {
        // Silencioso - pode falhar durante inicialização
      }
    }
    
    // Contar via doorWindowSystem
    if (window.doorWindowSystem?.doors) {
      window.doorWindowSystem.doors.forEach((_, id) => doorIds.add(id));
    }
    
    return doorIds.size;
  }

  /**
   * Calcular bounds de uma porta para spatial hash
   */
  calculateDoorBounds(meshes) {
    if (!meshes || meshes.length === 0) return null;
    
    const box = new THREE.Box3();
    meshes.forEach(mesh => {
      const meshBox = new THREE.Box3().setFromObject(mesh);
      box.union(meshBox);
    });
    
    return {
      min: box.min.clone(),
      max: box.max.clone(),
      center: box.getCenter(new THREE.Vector3()),
      size: box.getSize(new THREE.Vector3())
    };
  }

  /**
   * Invalidar cache quando a cena muda (método menos agressivo)
   */
  invalidateCache() {
    // Só invalidar se o cache for muito antigo (mais de 10 segundos)
    const cacheAge = Date.now() - this.performanceCache.lastUpdate;
    if (cacheAge > 10000) {
      this.performanceCache.isValid = false;
      this.performanceCache.buildableObjects = null;
      this.performanceCache.doorMeshes = null;
      this.performanceCache.sceneVersion++;
      console.log('🔄 Cache invalidado (idade:', cacheAge, 'ms)');
    }
  }

  // Método fallback para encontrar todos os meshes de portas na cena (OBSOLETO - mantido para compatibilidade)
  getAllDoorMeshes() {
    // Usar cache se disponível
    if (this.performanceCache.doorMeshes) {
      return this.performanceCache.doorMeshes;
    }
    
    const doorMeshes = [];
    
    // Percorrer toda a cena procurando objetos com userData relacionado a portas
    this.scene.traverse((child) => {
      if (child.isMesh) {
        // Verificar se o objeto tem userData indicando que é uma porta
        if (child.userData && (child.userData.isDoor || child.userData.doorId)) {
          doorMeshes.push(child);
        }
        
        // Verificar se o nome contém "porta" ou "door"
        if (child.name && (child.name.toLowerCase().includes('porta') || child.name.toLowerCase().includes('door'))) {
          doorMeshes.push(child);
        }
      }
    });
    
    return doorMeshes;
  }

  placeVoxel(point, face) {
    if (!face) return;

    // Calcular posição baseada na face clicada
    const position = point.clone();
    const normal = face.normal.clone();

    // Mover ligeiramente na direção da normal para posicionar o novo voxel
    position.add(normal.multiplyScalar(0.5));

    // Arredondar para coordenadas de grade
    const gridX = Math.round(position.x);
    const gridY = Math.round(position.y);
    const gridZ = Math.round(position.z);

    // Obter cor selecionada usando a função do editor
    const color = this.editorFunctions.getSelectedColor();

    // Usar a função addVoxel() do editor para manter consistência
    try {
      this.editorFunctions.addVoxel(gridX, gridY, gridZ, color, true);
    } catch (error) {
      console.warn('Erro ao usar addVoxel do editor, usando método fallback:', error);
      this.fallbackAddVoxel(gridX, gridY, gridZ, color, true);
    }
  }

  removeVoxel(object) {
    // Verificar se é um voxel que pode ser removido
    if (object.userData && object.userData.isVoxel) {
      // Usar a função removeVoxel() do editor para manter consistência
      try {
        this.editorFunctions.removeVoxel(object, true);
      } catch (error) {
        console.warn('Erro ao usar removeVoxel do editor, usando método fallback:', error);
        this.fallbackRemoveVoxel(object, true);
      }
    }
  }

  checkVoxelAt(x, y, z) {
    // Este método agora é obsoleto - o editor já verifica colisões
    console.warn('checkVoxelAt() está obsoleto - usando verificação do editor');
    return null;
  }

  createVoxel(x, y, z, color) {
    // Este método agora é obsoleto - usando addVoxel() do editor
    console.warn('createVoxel() está obsoleto - usando addVoxel() do editor');
    return null;
  }

  getSelectedColor() {
    // Este método agora é obsoleto - usando getSelectedColor() do editor
    console.warn('getSelectedColor() está obsoleto - usando função do editor');
    return this.editorFunctions.getSelectedColor();
  }

  updateMovement(deltaTime = 16.67) {
    if (!this.isActive) return;

    // Usar object pooling para vetores temporários
    const tempDirection = this.vectorPool.getVector();
    const tempMovement = this.vectorPool.getVector();
    const newPosition = this.vectorPool.getVector();

    try {
      // 1. Determinar a direção do input (otimizado)
      tempDirection.set(
        Number(this.keys.d) - Number(this.keys.a),
        0,
        Number(this.keys.s) - Number(this.keys.w)
      );
      
      // Só normalizar se há movimento (economiza cálculos)
      const hasMovement = tempDirection.lengthSq() > 0;
      if (hasMovement) {
        tempDirection.normalize();
      }

      // 2. Determinar a velocidade atual
      const currentSpeed = this.keys.shift ? this.sprintSpeed : this.moveSpeed;

      // 3. Calcular movimento usando cache de sin/cos (otimização)
      if (!this._cachedYaw || Math.abs(this._cachedYaw - this.yaw) > 0.01) {
        this._cachedYaw = this.yaw;
        this._cosYaw = Math.cos(this.yaw);
        this._sinYaw = Math.sin(this.yaw);
      }
      
      const moveX = hasMovement ? (tempDirection.x * this._cosYaw + tempDirection.z * this._sinYaw) : 0;
      const moveZ = hasMovement ? (tempDirection.z * this._cosYaw - tempDirection.x * this._sinYaw) : 0;
      
      this.targetVelocity.x = moveX * currentSpeed;
      this.targetVelocity.z = moveZ * currentSpeed;

      // 4. Interpolar velocidade (frame rate independent)
      const deltaFactor = Math.min(deltaTime / 16.67, 2); // Cap para evitar grandes saltos
      const accel = this.acceleration * deltaFactor;
      
      this.velocity.x += (this.targetVelocity.x - this.velocity.x) * accel;
      this.velocity.z += (this.targetVelocity.z - this.velocity.z) * accel;

      // 5. Aplicar atrito
      const frictionFactor = Math.pow(this.friction, deltaFactor);
      this.velocity.x *= frictionFactor;
      this.velocity.z *= frictionFactor;

      // 6. Movimento vertical otimizado
      if (this.keys.space && this.isOnGround) {
        this.verticalVelocity = this.jumpForce;
        this.isOnGround = false;
      }
      if (!this.isOnGround) {
        this.verticalVelocity -= this.gravity * deltaFactor;
      }

      // 7. Construir movimento final usando pooled vector
      tempMovement.set(
        this.velocity.x,
        this.verticalVelocity,
        this.velocity.z
      );

      // 8. Atualizar posição
      newPosition.copy(this.walkCamera.position).add(tempMovement);
      this.walkCamera.position.copy(newPosition);

      // 9. Verificação de chão otimizada
      if (this.walkCamera.position.y < 2.0) {
        this.walkCamera.position.y = 2.0;
        this.isOnGround = true;
        this.verticalVelocity = 0;
      }
      
    } finally {
      // Devolver vetores ao pool
      this.vectorPool.returnVector(tempDirection);
      this.vectorPool.returnVector(tempMovement);
      this.vectorPool.returnVector(newPosition);
    }
  }

  checkCollision(newPosition) {
    const result = {
      collided: false,
      blockX: false,
      blockY: false,
      blockZ: false,
      onGround: false
    };

    // Obter todos os objetos colidíveis
    const collidableObjects = this.getCollidableObjects();

    // Verificar colisão com voxels e geometria da sala
    for (const object of collidableObjects) {
      if (this.checkObjectCollision(newPosition, object)) {
        result.collided = true;

        // Determinar qual direção foi bloqueada
        const currentPos = this.walkCamera.position;
        const dx = Math.abs(newPosition.x - currentPos.x);
        const dy = Math.abs(newPosition.y - currentPos.y);
        const dz = Math.abs(newPosition.z - currentPos.z);

        // Bloquear a direção com maior diferença
        if (dx > dy && dx > dz) {
          result.blockX = true;
        } else if (dy > dz) {
          result.blockY = true;
          if (newPosition.y < currentPos.y) {
            result.onGround = true;
          }
        } else {
          result.blockZ = true;
        }
      }
    }

    return result;
  }

  checkObjectCollision(position, object) {
    if (!object.geometry) return false;

    // Calcular bounding box do objeto
    const box = new THREE.Box3().setFromObject(object);
    const objectCenter = box.getCenter(new THREE.Vector3());
    const objectSize = box.getSize(new THREE.Vector3());

    // Verificar se o jogador está dentro da bounding box expandida pelo raio do jogador
    const playerMin = new THREE.Vector3(
      position.x - this.playerRadius,
      position.y - this.playerHeight/2,
      position.z - this.playerRadius
    );
    const playerMax = new THREE.Vector3(
      position.x + this.playerRadius,
      position.y + this.playerHeight/2,
      position.z + this.playerRadius
    );

    const objectMin = new THREE.Vector3(
      objectCenter.x - objectSize.x/2,
      objectCenter.y - objectSize.y/2,
      objectCenter.z - objectSize.z/2
    );
    const objectMax = new THREE.Vector3(
      objectCenter.x + objectSize.x/2,
      objectCenter.y + objectSize.y/2,
      objectCenter.z + objectSize.z/2
    );

    // Verificar sobreposição das bounding boxes
    return (
      playerMin.x < objectMax.x && playerMax.x > objectMin.x &&
      playerMin.y < objectMax.y && playerMax.y > objectMin.y &&
      playerMin.z < objectMax.z && playerMax.z > objectMin.z
    );
  }

  getCollidableObjects() {
    const objects = [];

    // Adicionar voxels do editor
    try {
      const editorVoxels = this.editorFunctions.getVoxels();
      objects.push(...editorVoxels);
    } catch (error) {
      console.warn('Erro ao obter voxels para colisão:', error);
    }

    // Adicionar geometria da sala
    if (this.roomModeSystem) {
      if (this.roomModeSystem.roomFloor) objects.push(this.roomModeSystem.roomFloor);
      objects.push(...this.roomModeSystem.roomWalls);
    }

    return objects;
  }

  animate(currentTime = performance.now()) {
    if (!this.isActive) {
      if (this.frameId) {
        cancelAnimationFrame(this.frameId);
        this.frameId = null;
      }
      return;
    }

    // Frame skipping inteligente para manter performance
    const deltaTime = currentTime - this.lastFrameTime;
    
    if (deltaTime >= this.frameInterval) {
      // Atualizar movimento e física apenas quando necessário
      this.updateMovement(deltaTime);
      
      // Atualizar cache frames counter
      this.performanceCache.framesSinceUpdate++;
      
      this.lastFrameTime = currentTime;
    }

    // Continuar animação no próximo frame
    this.frameId = requestAnimationFrame(this.animate);
  }

  // Método público para atualização no loop de renderização principal
  update() {
    // Este método é chamado pelo loop principal de renderização
    // O movimento já é atualizado no animate(), então aqui podemos
    // fazer outras atualizações se necessário
    if (this.isActive) {
      this.updateBuildPreview();
    }
  }

  // Métodos fallback para quando as funções do editor não são fornecidas
  fallbackAddVoxel(x, y, z, color, saveHistory = true) {
    console.warn('Usando método fallback para addVoxel - integração incompleta');
    this.createVoxel(x, y, z, color);
    return null;
  }

  fallbackRemoveVoxel(mesh, saveHistory = true) {
    console.warn('Usando método fallback para removeVoxel - integração incompleta');
    this.scene.remove(mesh);
    return true;
  }

  // Método para criar botão de toggle no painel da sala
  createToggleButton(container) {

    // Criar botão de caminhada
    this.walkModeBtn = document.createElement('button');
    this.walkModeBtn.id = 'walkModeBtn';
    this.walkModeBtn.className = 'room-control-btn';
    this.walkModeBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" clip-rule="evenodd" />
      </svg>
      <span>Modo Caminhada</span>
    `;

    // Adicionar event listener
    this.walkModeBtn.addEventListener('click', () => {
      if (this.isActive) {
        this.exitWalkMode();
        this.walkModeBtn.classList.remove('active');
        this.walkModeBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" clip-rule="evenodd" />
          </svg>
          <span>Modo Caminhada</span>
        `;
      } else {
        this.enterWalkMode();
        this.walkModeBtn.classList.add('active');
        this.walkModeBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
          </svg>
          <span>Saindo da Caminhada...</span>
        `;
      }
    });

    // Adicionar ao container
    container.appendChild(this.walkModeBtn);

    return this.walkModeBtn;
  }

  // Método para atualizar preview de construção
  updateBuildPreview() {
    // Implementar preview visual para construção (opcional)
    // Por enquanto, apenas placeholder
  }

  // =====================================================================
  // SISTEMA DE SELEÇÃO E MOVIMENTAÇÃO DE OBJETOS
  // =====================================================================

  // Obter objetos da sala para raycasting
  getRoomObjects() {
    const objects = [];
    if (this.roomModeSystem && this.roomModeSystem.roomObjects) {
      this.roomModeSystem.roomObjects.forEach(obj => {
        if (obj.meshGroup && obj.meshGroup.visible) {
          obj.meshGroup.traverse((child) => {
            if (child.isMesh) {
              objects.push(child);
            }
          });
        }
      });
    }
    return objects;
  }

  // Encontrar objeto da sala pelo mesh clicado (otimizado)
  findRoomObjectByMeshOptimized(mesh) {
    if (!this.roomModeSystem?.roomObjects) return null;
    
    // Cache de mapeamento mesh -> roomObject
    if (!this._meshToRoomObjectCache) {
      this._meshToRoomObjectCache = new Map();
      this._cacheRoomObjectMeshes();
    }
    
    return this._meshToRoomObjectCache.get(mesh) || null;
  }

  // Cache mesh mapping para room objects
  _cacheRoomObjectMeshes() {
    if (!this.roomModeSystem?.roomObjects) return;
    
    this._meshToRoomObjectCache.clear();
    
    for (const roomObject of this.roomModeSystem.roomObjects) {
      if (roomObject.meshGroup) {
        roomObject.meshGroup.traverse((child) => {
          if (child.isMesh) {
            this._meshToRoomObjectCache.set(child, roomObject);
          }
        });
      }
    }
  }

  // Método legacy mantido para compatibilidade
  findRoomObjectByMesh(mesh) {
    return this.findRoomObjectByMeshOptimized(mesh);
  }

  // Selecionar objeto da sala
  selectRoomObject(roomObject) {
    // Desselecionar objeto anterior
    if (this.selectedObject) {
      this.deselectRoomObject();
    }

    this.selectedObject = roomObject;
    this.createObjectOutline(roomObject);
    
  }

  // Desselecionar objeto
  deselectRoomObject() {
    if (this.selectedObject) {
      this.selectedObject = null;
    }
    
    if (this.isDraggingObject) {
      this.isDraggingObject = false;
    }

    this.removeObjectOutline();
  }

  // Criar outline visual para objeto selecionado
  createObjectOutline(roomObject) {
    this.removeObjectOutline();

    if (!roomObject.meshGroup) return;

    // Criar outline usando BoxHelper
    this.objectOutline = new THREE.BoxHelper(roomObject.meshGroup, 0x00ff00);
    this.objectOutline.material.linewidth = 3;
    this.scene.add(this.objectOutline);
  }

  // Remover outline visual
  removeObjectOutline() {
    if (this.objectOutline) {
      this.scene.remove(this.objectOutline);
      this.objectOutline = null;
    }
  }

  // Alternar modo de arrastar objeto
  toggleObjectDragging() {
    if (!this.selectedObject) return;

    this.isDraggingObject = !this.isDraggingObject;
    
    if (this.isDraggingObject) {
      
      // Salvar posição inicial
      this.dragStartPosition.copy(this.selectedObject.meshGroup.position);
    } else {
    }
  }

  // Mover objeto selecionado com movimento do mouse
  moveSelectedObject(movementX, movementY) {
    if (!this.selectedObject || !this.selectedObject.meshGroup) return;

    // Converter movimento do mouse em movimento 3D baseado na direção da câmera
    const moveSpeed = 0.05; // Velocidade de movimento de objetos aumentada
    
    // Calcular direções baseadas na rotação da câmera
    const forward = new THREE.Vector3(0, 0, -1);
    const right = new THREE.Vector3(1, 0, 0);
    
    // Aplicar rotação da câmera às direções
    forward.applyQuaternion(this.walkCamera.quaternion);
    right.applyQuaternion(this.walkCamera.quaternion);
    
    // Projetar no plano horizontal (Y = 0)
    forward.y = 0;
    right.y = 0;
    forward.normalize();
    right.normalize();

    // Calcular movimento baseado no mouse
    const moveVector = new THREE.Vector3();
    moveVector.addScaledVector(right, movementX * moveSpeed);
    moveVector.addScaledVector(forward, -movementY * moveSpeed);

    // Aplicar movimento ao objeto
    this.selectedObject.meshGroup.position.add(moveVector);

    // Atualizar outline se existir
    if (this.objectOutline) {
      this.objectOutline.update();
    }

    // Log de debug (apenas ocasionalmente para não spam)
    if (Math.random() < 0.01) {
      const pos = this.selectedObject.meshGroup.position;
    }
  }

  // ===== SISTEMA DE INVENTÁRIO E CONSTRUÇÃO =====

  initInventorySystem() {
    this.inventoryElement = document.getElementById('minecraft-inventory');
    this.crosshairElement = document.getElementById('construction-crosshair');
    this.selectedSlot = null;
    this.selectedItem = null;
    this.constructionMode = false;

    // Bind dos event listeners do inventário
    this.setupInventoryEvents();

  }

  setupInventoryEvents() {
    const slots = document.querySelectorAll('.hotbar-slot');
    
    slots.forEach((slot, index) => {
      slot.addEventListener('click', () => this.selectInventorySlot(index));
    });

    // Event listeners para teclado (números 1-9 para selecionar slots)
    document.addEventListener('keydown', (event) => {
      if (!this.isActive) return;

      const keyNum = parseInt(event.key);
      if (keyNum >= 1 && keyNum <= 9) {
        this.selectInventorySlot(keyNum - 1);
      }
    });

    // Event listener para clique de construção
    document.addEventListener('click', (event) => {
      if (!this.isActive || !this.constructionMode) return;
      this.handleConstructionClick(event);
    });

    // Event listeners para edição de portas no modo walk
    document.addEventListener('keydown', (event) => {
      if (!this.isActive) return;
      this.handleDoorEditingKeys(event);
    });
  }

  selectInventorySlot(slotIndex) {
    const slots = document.querySelectorAll('.hotbar-slot');
    
    // Remover seleção anterior
    slots.forEach(slot => slot.classList.remove('selected'));
    
    // Se slotIndex for null, desselecionar tudo
    if (slotIndex === null || slotIndex < 0 || slotIndex >= slots.length) {
      this.selectedSlot = null;
      this.selectedItem = null;
      this.disableConstructionMode();
      this.updateSelectedItemInfo();
      return;
    }
    
    // Selecionar novo slot
    const selectedSlot = slots[slotIndex];
    if (selectedSlot) {
      selectedSlot.classList.add('selected');
      this.selectedSlot = slotIndex;
      
      // Determinar item selecionado baseado no slot
      const itemIcon = selectedSlot.querySelector('.item-icon');
      const itemName = selectedSlot.querySelector('.item-name');
      
      if (itemIcon && itemName) {
        this.selectedItem = {
          type: this.getItemTypeFromSlot(slotIndex),
          name: itemName.textContent,
          icon: itemIcon.textContent
        };
      } else {
        // Slot sem item - usar defaults baseados no índice
        this.selectedItem = {
          type: this.getItemTypeFromSlot(slotIndex),
          name: this.getDefaultItemName(slotIndex),
          icon: this.getDefaultItemIcon(slotIndex)
        };
      }

      this.updateSelectedItemInfo();
      this.enableConstructionMode();

    } else {
      this.selectedSlot = null;
      this.selectedItem = null;
      this.disableConstructionMode();
    }
  }

  getItemTypeFromSlot(slotIndex) {
    const itemTypes = {
      0: 'window',
      1: 'door',
      2: 'lamp_warm',
      3: 'lamp_cool'
    };
    return itemTypes[slotIndex] || null;
  }

  getDefaultItemName(slotIndex) {
    const itemNames = {
      0: 'Janela',
      1: 'Porta',
      2: 'Lâmpada Quente',
      3: 'Lâmpada Fria'
    };
    return itemNames[slotIndex] || 'Item Desconhecido';
  }

  getDefaultItemIcon(slotIndex) {
    const itemIcons = {
      0: '🪟',
      1: '🚪',
      2: '🔥💡',
      3: '❄️💡'
    };
    return itemIcons[slotIndex] || '❓';
  }

  updateSelectedItemInfo() {
    const nameElement = document.getElementById('selected-item-name');
    const descElement = document.getElementById('selected-item-description');

    if (this.selectedItem) {
      nameElement.textContent = this.selectedItem.name;
      
      const descriptions = {
        'window': 'Clique em uma parede para colocar uma janela',
        'door': 'Clique em uma parede para colocar uma porta',
        'lamp_warm': 'Clique no chão para colocar uma lâmpada quente (2800K)',
        'lamp_cool': 'Clique no chão para colocar uma lâmpada fria (6000K)',
        'light': 'Clique para adicionar uma fonte de luz'
      };
      
      descElement.textContent = descriptions[this.selectedItem.type] || 'Item selecionado';
    } else {
      nameElement.textContent = 'Nenhum item selecionado';
      descElement.textContent = 'Selecione um item no inventário';
    }
  }

  enableConstructionMode() {
    this.constructionMode = true;
    this.crosshairElement.style.display = 'block';
    document.body.style.cursor = 'crosshair';
  }

  disableConstructionMode() {
    this.constructionMode = false;
    this.crosshairElement.style.display = 'none';
    document.body.style.cursor = 'default';
  }

  handleConstructionClick(event) {
    // Verificar se estamos em modo walk ativo
    if (!this.isActive || !this.walkCamera) {
      console.warn('⚠️ Tentativa de construção fora do modo walk ativo');
      return;
    }

    // Prevenir que o clique interfira com o PointerLock
    event.preventDefault();
    event.stopPropagation();

    if (!this.selectedItem) {
      console.warn('⚠️ Nenhum item selecionado para construção');
      return;
    }

    console.log(`🔨 Construindo item: ${this.selectedItem ? this.selectedItem.type : 'null'}`);

    // Verificar se ainda há item selecionado
    if (!this.selectedItem || !this.selectedItem.type) {
      console.warn('⚠️ Nenhum item selecionado para construção');
      return;
    }

    // Diferentes tipos de raycast baseados no item
    if (this.selectedItem.type.startsWith('lamp_')) {
      // Lâmpadas modernas são instaladas onde o jogador está apontando
      const targetPosition = this.getLampTargetPosition();
      if (targetPosition) {
        this.placeLampAtPosition(targetPosition);
      } else {
        console.warn('⚠️ Aponte para um local válido para instalar a lâmpada');
      }
    } else {
      // Janelas e portas são colocadas em paredes
      const wallIntersection = this.performWallRaycast();
      if (wallIntersection) {
        this.placeItemAtIntersection(wallIntersection);
      } else {
        console.warn('⚠️ Aponte para uma parede para colocar este item');
      }
    }
  }

  performWallRaycast() {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(0, 0); // Centro da tela (crosshair)
    
    // Verificar se a câmera walk está disponível
    if (!this.walkCamera) {
      console.error('❌ Câmera walk não está disponível para raycast');
      return null;
    }
    
    // Configurar raycaster a partir da câmera walk
    raycaster.setFromCamera(mouse, this.walkCamera);
    
    // CORREÇÃO: Buscar paredes do room system com verificação robusta
    const walls = [];
    
    // Tentar múltiplas fontes de paredes
    if (window.roomConfigSystem?.roomElements?.walls) {
      walls.push(...window.roomConfigSystem.roomElements.walls);
    }
    
    // Fallback: buscar diretamente no roomModeSystem
    if (walls.length === 0 && this.roomModeSystem?.roomWalls) {
      walls.push(...this.roomModeSystem.roomWalls);
    }
    
    // Fallback: buscar na cena por objetos com userData.wallName
    if (walls.length === 0) {
      this.scene.traverse((child) => {
        if (child.isMesh && child.userData.wallName) {
          walls.push(child);
        }
      });
    }

    if (walls.length === 0) {
      console.warn('⚠️ Nenhuma parede encontrada para raycast em todas as fontes');
      return null;
    }


    // Realizar raycast
    const intersections = raycaster.intersectObjects(walls, false);
    
    if (intersections.length > 0) {
      const intersection = intersections[0];
      const wallName = intersection.object.userData.wallName;
      
      
      // Validar se a parede tem wallName
      if (!wallName) {
        console.warn('⚠️ Parede atingida não tem wallName definido');
        return null;
      }
      
      return intersection;
    }

    return null;
  }

  /**
   * Raycast para detectar o chão
   */
  performFloorRaycast() {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(0, 0); // Centro da tela (crosshair)
    
    // Verificar se a câmera walk está disponível
    if (!this.walkCamera) {
      console.error('❌ Câmera walk não está disponível para raycast');
      return null;
    }
    
    // Configurar raycaster a partir da câmera walk
    raycaster.setFromCamera(mouse, this.walkCamera);
    
    // Buscar chão da sala
    const floorObjects = [];
    
    // Tentar múltiplas fontes de chão
    if (window.roomConfigSystem?.roomElements?.floor) {
      floorObjects.push(window.roomConfigSystem.roomElements.floor);
    }
    
    // Fallback: buscar diretamente no roomModeSystem
    if (floorObjects.length === 0 && this.roomModeSystem?.roomFloor) {
      floorObjects.push(this.roomModeSystem.roomFloor);
    }
    
    // Fallback: buscar na cena por objetos com userData.isFloor
    if (floorObjects.length === 0) {
      this.scene.traverse((child) => {
        if (child.isMesh && (child.userData.isFloor || child.name?.toLowerCase().includes('floor'))) {
          floorObjects.push(child);
        }
      });
    }

    if (floorObjects.length === 0) {
      console.warn('⚠️ Nenhum chão encontrado para raycast');
      return null;
    }

    console.log(`🎯 Raycast no chão: ${floorObjects.length} objetos de chão`);

    // Realizar raycast
    const intersections = raycaster.intersectObjects(floorObjects, false);
    
    if (intersections.length > 0) {
      const intersection = intersections[0];
      console.log(`✅ Chão atingido na posição:`, intersection.point);
      return intersection;
    }

    return null;
  }

  /**
   * Colocar lâmpada na posição
   */
  placeLampAtPosition(position) {
    if (!this.lightingSystem) {
      console.error('❌ Sistema de iluminação não disponível');
      return;
    }

    // Gerar ID único para a lâmpada
    const lampId = `lamp_${Date.now()}`;
    
    // Determinar tipo da lâmpada baseado na seleção
    const lampType = this.selectedItem.type === 'lamp_warm' ? 'warm' : 'cool';
    
    console.log(`💡 Colocando lâmpada '${lampId}' do tipo '${lampType}' apontando para:`, position);
    
    // Detectar superfície onde o jogador está apontando (parede ou teto)
    let surfaceData = this.detectLampSurfaceAtPosition(position);
    
    // Se não detectou superfície, usar fallback inteligente
    if (!surfaceData) {
      console.log('🔧 Não detectou superfície, usando fallback inteligente');
      
      // Tentar colocar no teto acima da posição apontada
      const ceilingPosition = {
        x: position.x,
        y: Math.max(position.y + 1.0, 2.5), // Pelo menos 2.5m de altura
        z: position.z
      };
      
      surfaceData = {
        surface: 'ceiling',
        position: ceilingPosition,
        normal: new THREE.Vector3(0, -1, 0),
        object: null
      };
      
      console.log('🏠 Usando posição de teto como fallback:', ceilingPosition);
    }
    
    console.log('🔍 Superfície detectada:', surfaceData.surface, 'na posição:', surfaceData.position);
    
    // Calcular posição grudada na superfície
    const lampPosition = this.calculateSurfaceLampPosition(surfaceData);
    
    console.log('📍 Posição final da lâmpada (grudada na superfície):', lampPosition);
    
    // Criar lâmpada grudada na superfície com sistema de rebatimento
    const lampGroup = this.lightingSystem.createLamp(lampId, lampPosition, lampType, surfaceData.surface);

    if (lampGroup) {
      console.log(`✅ Lâmpada '${lampId}' instalada na ${surfaceData.surface === 'ceiling' ? 'teto' : 'parede'}`);
      
      // Feedback visual
      const typeText = lampType === 'warm' ? 'quente (2700K)' : 'fria (6000K)';
      const surfaceText = surfaceData.surface === 'ceiling' ? 'teto' : 'parede';
      console.log(`💡✨ Lâmpada LED ${typeText} instalada na ${surfaceText} com rebatimento`);
      
      // Desselecionar item do inventário após colocação bem-sucedida
      if (this.selectedSlot !== null) {
        this.selectInventorySlot(null);
      }
    } else {
      console.error(`❌ Falha ao instalar lâmpada na superfície`);
    }
  }

  /**
   * Detectar superfície adequada para instalação de lâmpada
   */
  /**
   * Detectar superfície (parede ou teto) onde o jogador está apontando
   */
  detectLampSurfaceAtPosition(targetPosition) {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), this.walkCamera);
    raycaster.far = 15.0; // Alcance maior
    
    // Obter todos os objetos possíveis para raycast
    const allObjects = [];
    
    // Adicionar objetos da sala
    try {
      const roomObjects = this.getRoomObjects();
      if (roomObjects && roomObjects.length > 0) {
        allObjects.push(...roomObjects);
      }
    } catch (e) {
      console.log('⚠️ Não foi possível obter objetos da sala:', e.message);
    }
    
    // Adicionar todos os objetos da cena como fallback
    this.scene.traverse((child) => {
      if (child.isMesh && child.geometry && child.material) {
        // Ignorar lâmpadas existentes
        if (!child.userData.isLamp && !child.userData.lampId) {
          allObjects.push(child);
        }
      }
    });
    
    console.log(`🔍 Raycast detectou ${allObjects.length} objetos para teste`);
    
    const intersects = raycaster.intersectObjects(allObjects, false);
    console.log(`🔍 Encontradas ${intersects.length} intersecções`);
    
    for (let i = 0; i < intersects.length; i++) {
      const intersection = intersects[i];
      
      console.log(`🔍 Testando intersecção ${i}:`, intersection.object.type, intersection.point);
      
      // Verificar se tem face normal
      if (intersection.face && intersection.face.normal) {
        const normal = intersection.face.normal.clone();
        normal.transformDirection(intersection.object.matrixWorld);
        
        console.log(`🔍 Normal detectada:`, normal);
        
        // Relaxar critérios de detecção
        if (normal.y < -0.5) {
          // Normal apontando para baixo = teto (relaxado de -0.7 para -0.5)
          console.log('✅ Teto detectado!');
          return {
            surface: 'ceiling',
            position: intersection.point,
            normal: normal,
            object: intersection.object
          };
        } else if (Math.abs(normal.y) < 0.6) {
          // Normal mais horizontal = parede (relaxado de 0.4 para 0.6)
          console.log('✅ Parede detectada!');
          return {
            surface: 'wall',
            position: intersection.point,
            normal: normal,
            object: intersection.object
          };
        }
        
        console.log(`⚠️ Normal não é parede nem teto: y=${normal.y}`);
      } else {
        console.log('⚠️ Intersecção sem face normal');
      }
    }
    
    console.log('❌ Nenhuma superfície válida detectada');
    return null;
  }

  /**
   * Calcular posição da lâmpada grudada na superfície
   */
  calculateSurfaceLampPosition(surfaceData) {
    const { surface, position, normal } = surfaceData;
    const offset = 0.1; // Distância da superfície
    
    if (surface === 'ceiling') {
      // Grudar no teto, ligeiramente abaixo
      return {
        x: position.x,
        y: position.y - offset,
        z: position.z
      };
    } else if (surface === 'wall') {
      // Grudar na parede, ligeiramente à frente
      return {
        x: position.x + normal.x * offset,
        y: position.y,
        z: position.z + normal.z * offset
      };
    }
    
    // Fallback
    return position;
  }

  /**
   * Obter posição onde o jogador está apontando para colocar lâmpada
   */
  getLampTargetPosition() {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), this.walkCamera);
    raycaster.far = 8.0; // Alcance máximo para colocar lâmpada
    
    // Obter todos os objetos da sala para raycast
    const roomObjects = this.getRoomObjects();
    const intersects = raycaster.intersectObjects(roomObjects, true);
    
    if (intersects.length > 0) {
      // Usar a primeira intersecção válida
      const intersection = intersects[0];
      console.log('🎥 Posição apontada detectada:', intersection.point);
      console.log('🎥 Objeto detectado:', intersection.object.type || intersection.object.constructor.name);
      return intersection.point;
    }
    
    // Fallback: usar posição à frente do jogador
    const playerPosition = this.walkCamera.position.clone();
    const direction = new THREE.Vector3();
    this.walkCamera.getWorldDirection(direction);
    
    const targetPosition = playerPosition.clone().add(direction.multiplyScalar(3.0));
    console.log('🎥 Usando posição fallback à frente:', targetPosition);
    console.log('🔍 Objetos encontrados para raycast:', roomObjects.length);
    console.log('🔍 Posição da câmera:', playerPosition);
    console.log('🔍 Direção da câmera:', direction);
    return targetPosition;
  }

  detectLampInstallationSurface(position) {
    if (!this.lightingSystem) {
      // Fallback para posição padrão no teto
      return {
        surface: 'ceiling',
        position: { x: position.x, y: 2.8, z: position.z },
        normal: new THREE.Vector3(0, -1, 0)
      };
    }
    
    // Tentar detectar teto primeiro (olhando para cima)
    const upDirection = new THREE.Vector3(0, 1, 0);
    const ceilingData = this.lightingSystem.detectInstallationSurface(position, upDirection);
    
    if (ceilingData && ceilingData.surface === 'ceiling') {
      console.log('✅ Teto detectado para instalação da lâmpada');
      return ceilingData;
    }
    
    // Se não há teto, tentar paredes (olhando nas direções cardinais)
    const directions = [
      new THREE.Vector3(1, 0, 0),   // Direita
      new THREE.Vector3(-1, 0, 0),  // Esquerda
      new THREE.Vector3(0, 0, 1),   // Frente
      new THREE.Vector3(0, 0, -1)   // Trás
    ];
    
    for (const direction of directions) {
      const wallData = this.lightingSystem.detectInstallationSurface(position, direction);
      if (wallData && wallData.surface === 'wall') {
        console.log('✅ Parede detectada para instalação da lâmpada');
        return wallData;
      }
    }
    
    // Fallback para posição padrão no teto se nada foi detectado
    console.log('⚠️ Usando posição padrão no teto (altura 2.8)');
    return {
      surface: 'ceiling',
      position: { x: position.x, y: 2.8, z: position.z },
      normal: new THREE.Vector3(0, -1, 0)
    };
  }

  placeItemAtIntersection(intersection) {
    const worldPoint = intersection.point;
    const wallObject = intersection.object;
    const wallName = wallObject.userData.wallName;

    if (!wallName) {
      console.error('❌ Parede não tem wallName definido');
      return;
    }

    // Converter ponto mundial para coordenadas locais da parede
    const localCoords = this.worldPointToWallCoords(worldPoint, wallName);

    // Executar colocação baseada no tipo de item
    switch (this.selectedItem.type) {
      case 'window':
        this.placeWindow(wallName, localCoords);
        break;
      case 'door':
        this.placeDoor(wallName, localCoords);
        break;
      case 'lamp_warm':
      case 'lamp_cool':
        // Lâmpadas são tratadas em placeLampAtPosition
        console.warn('⚠️ Lâmpadas devem ser colocadas no chão, não na parede');
        break;
      case 'light':
        this.placeLight(worldPoint);
        break;
    }
  }

  worldPointToWallCoords(worldPoint, wallName) {
    // SIMPLIFICAÇÃO: Usar coordenadas diretas do mundo, como no sistema de portas
    let x, y;

    // Converter coordenadas mundiais para coordenadas locais da parede
    switch (wallName) {
      case 'front':
        x = worldPoint.x; 
        y = worldPoint.y;
        break;
      case 'back':
        x = -worldPoint.x; // Inverter para parede traseira
        y = worldPoint.y;
        break;
      case 'left':
        x = -worldPoint.z; // Z vira X (invertido)
        y = worldPoint.y;
        break;
      case 'right':
        x = worldPoint.z; // Z vira X
        y = worldPoint.y;
        break;
      default:
        x = 0;
        y = worldPoint.y;
    }

    // OTIMIZAÇÃO: Para janelas, usar altura realista (1.0m a 2.5m do chão)
    // Mas permitir que o usuário clique onde quiser na parede
    const minWindowHeight = 1.0;  // 1.0m acima do chão
    const maxWindowHeight = 2.5;  // 2.5m acima do chão
    
    // Se o Y calculado for muito baixo (menos que 1m do chão), ajustar para altura mínima
    if (y < minWindowHeight) {
      y = minWindowHeight;
    } else if (y > maxWindowHeight) {
      y = maxWindowHeight;
    }


    return { x, y };
  }

  placeWindow(wallName, coords) {
    if (!window.doorWindowSystem) {
      console.error('❌ Sistema de portas e janelas não disponível');
      return;
    }

    // Gerar ID único para a janela
    const windowId = `janela_${wallName}_${Date.now()}`;
    
    
    // CORREÇÃO: Criar janela usando mesma lógica das portas
    const windowGroup = window.doorWindowSystem.createWindow(
      windowId, 
      wallName, 
      coords, // Usar coordenadas diretamente
      { 
        canOpen: true,
        width: 1.2,
        height: 1.0
      }
    );

    if (windowGroup) {
      
      // Feedback visual para o usuário
      
      // Desselecionar item do inventário após colocação bem-sucedida
      if (this.selectedSlot !== null) {
        this.selectInventorySlot(null);
      }
    } else {
      console.error(`❌ Falha ao criar janela na parede ${wallName}`);
      console.error(`   Verifique se há espaço suficiente na parede`);
    }
  }

  placeDoor(wallName, coords) {
    if (!window.doorWindowSystem) {
      console.error('❌ Sistema de portas e janelas não disponível');
      return;
    }


    // Ajustar coordenadas para porta (sempre no chão)
    const doorCoords = { x: coords.x, y: 0 };
    
    // Gerar ID único para a porta
    const doorId = `porta_${Date.now()}`;
    
    
    // Criar porta usando o sistema existente
    const doorGroup = window.doorWindowSystem.createDoor(
      doorId,
      wallName, 
      doorCoords
    );

    if (doorGroup) {
      
      // Verificar se a porta foi registrada no sistema
      const doorData = window.doorWindowSystem.doors.get(doorId);
      if (doorData) {
      } else {
      }
    } else {
      console.error(`❌ Falha ao colocar porta na parede ${wallName}`);
    }
  }

  placeLight(worldPoint) {
    // TODO: Implementar sistema de luzes personalizadas
  }

  // ===== SISTEMA DE EDIÇÃO DE PORTAS NO WALK MODE =====

  handleDoorEditingKeys(event) {
    if (!this.isActive) return;

    // Durante drag, permitir cancelamento com Esc
    if (this.isDraggingDoor) {
      if (event.code === 'Escape') {
        event.preventDefault();
        this.cancelDoorDrag();
        return;
      }
      // Durante drag, bloquear outras teclas
      return;
    }

    // Teclas para edição de portas:
    // E = Redimensionar porta selecionada (Edit size)
    // M = Mover porta selecionada  
    // T = Transferir porta para outra parede
    // Delete/Backspace = Remover porta selecionada
    
    switch(event.code) {
      case 'KeyE':
        if (this.selectedDoor) {
          event.preventDefault();
          this.startDoorResizing();
        }
        break;
      case 'KeyM':
        if (this.selectedDoor) {
          event.preventDefault();
          this.startDoorMoving();
        }
        break;
      case 'KeyT':
        if (this.selectedDoor) {
          event.preventDefault();
          this.startDoorTransfer();
        }
        break;
      case 'Delete':
      case 'Backspace':
        if (this.selectedDoor) {
          event.preventDefault();
          this.deleteDoor();
        }
        break;
    }
  }

  selectDoorForEditing(doorId) {
    console.log(`🎯 Selecionando porta para edição: ${doorId}`);
    
    // Desselecionar porta anterior se houver
    this.deselectDoor();
    
    // Verificar se a porta existe
    if (!this.doorExists(doorId)) {
      console.error(`❌ Porta '${doorId}' não encontrada`);
      return;
    }
    
    // Selecionar nova porta
    this.selectedDoor = doorId;
    
    // Criar outline com verificação de sucesso
    const outlineCreated = this.createDoorOutline(doorId);
    if (!outlineCreated) {
      console.warn(`⚠️ Falha ao criar outline para porta '${doorId}'`);
      // Tentar método alternativo
      this.createAlternativeDoorHighlight(doorId);
    }
    
    this.showDoorEditingUI();
    
    console.log(`✅ Porta '${doorId}' selecionada com sucesso`);
  }

  deselectDoor() {
    if (this.selectedDoor) {
      console.log(`🚫 Desselecionando porta: ${this.selectedDoor}`);
    }
    
    // Cancelar drag se estiver ativo
    if (this.isDraggingDoor) {
      this.cancelDoorDrag();
    }
    
    // Remover outline
    this.removeDoorOutline();
    
    this.selectedDoor = null;
    this.hideDoorEditingUI();
  }

  startDoorResizing() {
    if (!this.selectedDoor) {
      console.warn('⚠️ Nenhuma porta selecionada');
      return;
    }

    this.doorDragMode = 'resize';
    this.isDraggingDoor = true;
    this.storeDoorOriginalData();
    this.createDoorPreview('resize');
    this.showDragInstructions('resize');
  }

  startDoorMoving() {
    if (!this.selectedDoor) {
      console.warn('⚠️ Nenhuma porta selecionada');
      return;
    }

    this.doorDragMode = 'move';
    this.isDraggingDoor = true;
    this.storeDoorOriginalData();
    this.createDoorPreview('move');
    this.showDragInstructions('move');
  }

  startDoorTransfer() {
    if (!this.selectedDoor) {
      console.warn('⚠️ Nenhuma porta selecionada');
      return;
    }

    this.doorDragMode = 'transfer';
    this.isDraggingDoor = true;
    this.storeDoorOriginalData();
    this.createDoorPreview('transfer');
    this.showDragInstructions('transfer');
  }

  deleteDoor() {
    if (!this.selectedDoor || !window.doorControls) {
      console.warn('⚠️ Nenhuma porta selecionada ou sistema não disponível');
      return;
    }

    const confirm = window.confirm(`Tem certeza que deseja remover a porta '${this.selectedDoor}'?`);
    
    if (confirm) {
      
      const success = window.doorControls.remove(this.selectedDoor);
      
      if (success) {
        this.refreshDoorsPanel(); // Atualizar painel
        this.deselectDoor();
      } else {
        console.error(`❌ Falha ao remover porta '${this.selectedDoor}'`);
      }
    }
  }

  showDoorEditingUI() {
    
    
    // Usar o painel existente room-doors-panel
    const doorsPanel = document.getElementById('room-doors-panel');
    if (!doorsPanel) {
      console.error('❌ Painel room-doors-panel não encontrado');
      return;
    }
    
      
     
    
    // Adicionar seção de edição do walk mode ao painel existente
    this.setupWalkModeInDoorsPanel();
    
    // NÃO abrir automaticamente - deixar para o usuário abrir via botão
    // doorsPanel.style.display = 'block';
    
    // Focar na seção de edição se o painel estiver visível
    const editSection = document.getElementById('walk-mode-edit-section');
    if (editSection && doorsPanel.style.display !== 'none') {
      editSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  hideDoorEditingUI() {
    // A UI de edição agora está integrada no painel principal
    // Apenas fechar o painel se não houver porta selecionada
    if (!this.selectedDoor) {
      this.hideExistingDoors();
    } else {
      // Atualizar para remover seção de edição mas manter lista
      this.refreshWalkModePanel();
    }
    
    // Para compatibilidade, também remover UI antiga se existir
    const oldEditingUI = document.getElementById('door-editing-ui');
    if (oldEditingUI) {
      oldEditingUI.remove();
    }
  }

  // Detectar clique em porta para seleção (OTIMIZADO)
  detectDoorClick(intersectedMesh) {
    if (!window.doorControls) {
      console.error('❌ doorControls não disponível');
      return false;
    }

    let foundDoorId = null;

    // MÉTODO 1: Verificação direta via userData (mais rápida)
    if (intersectedMesh.userData && intersectedMesh.userData.doorId) {
      foundDoorId = intersectedMesh.userData.doorId;
      console.log(`🎯 Porta encontrada via userData.doorId: ${foundDoorId}`);
    }
    // MÉTODO 2: Verificar userData.id também
    else if (intersectedMesh.userData && intersectedMesh.userData.id) {
      // Verificar se é uma porta válida
      const doors = window.doorControls ? window.doorControls.list() : [];
      if (doors.some(door => door.id === intersectedMesh.userData.id)) {
        foundDoorId = intersectedMesh.userData.id;
        console.log(`🎯 Porta encontrada via userData.id: ${foundDoorId}`);
      }
    }
    // MÉTODO 3: Busca via spatial hash (se userData falhar)
    else if (this.doorSpatialHash && this.doorSpatialHash.size > 0) {
      for (const [doorId, doorData] of this.doorSpatialHash) {
        if (doorData.meshes && doorData.meshes.includes(intersectedMesh)) {
          foundDoorId = doorId;
          break;
        }
      }
    }
    // MÉTODO 4: Busca por hierarquia de objetos (último recurso)
    else {
      let currentObject = intersectedMesh;
      let depth = 0;
      while (currentObject.parent && depth < 3) {
        currentObject = currentObject.parent;
        depth++;
        if (currentObject.userData && currentObject.userData.doorId) {
          foundDoorId = currentObject.userData.doorId;
          break;
        }
      }
    }

    if (foundDoorId) {
      return this.processDoorClick(foundDoorId);
    }

    // Se não encontrou porta, pode ser que o cache esteja desatualizado
    console.log('🚪❓ Porta não detectada - verificando se há portas novas...');
    this.checkForNewDoors();
    
    // Tentar uma segunda vez com cache atualizado
    if (intersectedMesh.userData && (intersectedMesh.userData.doorId || intersectedMesh.userData.isDoor)) {
      foundDoorId = intersectedMesh.userData.doorId || intersectedMesh.userData.id;
      if (foundDoorId && this.doorExists(foundDoorId)) {
        console.log(`🚪🔄 Porta encontrada após atualização de cache: ${foundDoorId}`);
        return this.processDoorClick(foundDoorId);
      }
    }

    return false;
  }

  /**
   * Processar clique na porta (duplo clique vs seleção)
   */
  processDoorClick(doorId) {
    const currentTime = Date.now();
    const timeSinceLastClick = currentTime - this.lastClickTime;
    const isSameDoor = this.lastClickedDoor === doorId;
    const isDoubleClick = timeSinceLastClick < this.doubleClickDelay && isSameDoor;
    
    // Log apenas para duplos cliques para reduzir spam
    if (isDoubleClick) {
      console.log(`🚪🚪 DUPLO CLIQUE detectado em ${doorId}`);
    }
    
    if (isDoubleClick) {
      // Duplo clique - abrir/fechar porta
      console.log(`🚪🚪 DUPLO CLIQUE detectado - abrindo/fechando porta ${doorId}`);
      this.toggleDoor(doorId);
      this.lastClickTime = 0;
      this.lastClickedDoor = null;
    } else {
      // Clique simples - selecionar para edição
      console.log(`🚪 Clique simples - selecionando porta ${doorId}`);
      
      // Verificar se a porta existe antes de tentar selecionar
      if (this.doorExists(doorId)) {
        this.selectDoorForEditing(doorId);
        this.lastClickTime = currentTime;
        this.lastClickedDoor = doorId;
      } else {
        console.error(`❌ Porta '${doorId}' não existe - não é possível selecionar`);
      }
    }
    return true;
  }

  /**
   * Verificar se ponto está dentro dos bounds
   */
  isPointInBounds(point, bounds, tolerance = 0.5) {
    return point.x >= bounds.min.x - tolerance &&
           point.x <= bounds.max.x + tolerance &&
           point.y >= bounds.min.y - tolerance &&
           point.y <= bounds.max.y + tolerance &&
           point.z >= bounds.min.z - tolerance &&
           point.z <= bounds.max.z + tolerance;
  }

  /**
   * Método fallback para detecção de porta (compatibilidade)
   */
  detectDoorClickFallback(intersectedMesh) {
    const doors = window.doorControls.list();
    
    for (const door of doors) {
      let doorFound = false;
      
      // Verificar se o mesh é filho de um grupo com doorId
      let currentObject = intersectedMesh;
      let depth = 0;
      while (currentObject.parent && depth < 5) { // Reduzir profundidade
        currentObject = currentObject.parent;
        depth++;
        if (currentObject.userData && 
            (currentObject.userData.doorId === door.id || currentObject.userData.id === door.id)) {
          doorFound = true;
          break;
        }
      }
      
      if (doorFound) {
        return this.processDoorClick(door.id);
      }
    }
    
    return false;
  }

  getDoorWorldPosition(door) {
    // Converter posição da porta para coordenadas mundiais
    if (!door || !this.roomModeSystem) return null;
    
    const { width, height, depth } = this.roomModeSystem.config?.dimensions || { width: 10, height: 3, depth: 10 };
    const pos = new THREE.Vector3();
    
    switch (door.wallName) {
      case 'front':
        pos.set(door.position.x, door.position.y, -depth / 2);
        break;
      case 'back':
        pos.set(door.position.x, door.position.y, depth / 2);
        break;
      case 'left':
        pos.set(-width / 2, door.position.y, door.position.x);
        break;
      case 'right':
        pos.set(width / 2, door.position.y, door.position.x);
        break;
    }
    
    return pos;
  }

  showInventory() {
    if (this.inventoryElement) {
      this.inventoryElement.style.display = 'block';
    }
  }

  hideInventory() {
    if (this.inventoryElement) {
      this.inventoryElement.style.display = 'none';
    }
    this.disableConstructionMode();
  }

  // ===== SISTEMA DE VISUALIZAÇÃO DE PORTAS EXISTENTES =====

  showExistingDoors() {
    if (!window.doorControls) {
      console.warn('⚠️ Sistema de portas não disponível');
      return;
    }

    // Usar o painel existente room-doors-panel
    const doorsPanel = document.getElementById('room-doors-panel');
    if (!doorsPanel) {s
      console.error('❌ Painel room-doors-panel não encontrado');
      return;
    }
    
    // Adicionar seção de edição do walk mode ao painel existente
    this.setupWalkModeInDoorsPanel();
    
    // NÃO abrir automaticamente - deixar para o usuário abrir via botão
    // doorsPanel.style.display = 'block';
    
    // Expor referência do walk system globalmente
    window.walkSystem = this;
  }

  /**
   * Configurar seção de walk mode no painel de portas existente
   */
  setupWalkModeInDoorsPanel() {
    const doorsPanel = document.getElementById('room-doors-panel');
    const panelContent = doorsPanel.querySelector('.panel-content');
    
    // Remover seção anterior se existir
    const existingWalkSection = document.getElementById('walk-mode-doors-section');
    if (existingWalkSection) {
      existingWalkSection.remove();
    }
    
    // Criar seção para o walk mode
    const walkSection = document.createElement('div');
    walkSection.id = 'walk-mode-doors-section';
    walkSection.innerHTML = this.createWalkModeSectionHTML();
    
    // Adicionar no final do conteúdo do painel
    panelContent.appendChild(walkSection);
    
    // Atualizar lista de portas
    this.updateWalkModeDoorsInPanel();
  }

  /**
   * Criar HTML da seção de walk mode
   */
  createWalkModeSectionHTML() {
    const doors = window.doorControls ? window.doorControls.list() : [];
    const selectedDoorInfo = this.getSelectedDoorInfo();
    
    return `
      <!-- Divisor entre room mode e walk mode -->
      <hr style="margin: 24px 0; border: none; border-top: 2px solid rgba(124, 58, 237, 0.3); position: relative;">
      
      <!-- Cabeçalho da seção walk mode -->
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="background: rgba(124, 58, 237, 0.1); padding: 12px; border-radius: 10px; border: 1px solid rgba(124, 58, 237, 0.3);">
          <div style="display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600; color: var(--accent-primary); font-size: 14px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 2L19 14L13 10L9 14L1 12V2Z"/>
              <path d="M13 10L21 2"/>
            </svg>
            MODO WALK - GESTÃO DE PORTAS
          </div>
          <div style="font-size: 11px; color: #ccc; margin-top: 4px;">
            Edição avançada de portas durante a exploração
          </div>
        </div>
      </div>
      
      <!-- Seção de edição da porta selecionada -->
      ${this.selectedDoor ? `
      <div id="walk-mode-edit-section" style="margin-bottom: 20px;">
        <h4 style="color: var(--text-primary); font-size: 13px; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          Editando Porta Selecionada
        </h4>
        
        <!-- Info da porta selecionada -->
        <div class="creator-row" style="background: rgba(124, 58, 237, 0.15); border-color: rgba(124, 58, 237, 0.4);">
          <div style="flex: 1;">
            <div style="font-weight: 600; color: #fff; margin-bottom: 4px;">📍 ${selectedDoorInfo ? selectedDoorInfo.id : this.selectedDoor}</div>
            <div style="font-size: 12px; color: #ccc;">
              ${selectedDoorInfo ? `
                ${selectedDoorInfo.wallName} | (${selectedDoorInfo.position.x.toFixed(1)}, ${selectedDoorInfo.position.y.toFixed(1)}) | 
                ${selectedDoorInfo.config.width}×${selectedDoorInfo.config.height}m | 
                ${selectedDoorInfo.isOpen ? '🔓 Aberta' : '🔒 Fechada'}
              ` : 'Carregando informações...'}
            </div>
          </div>
        </div>
        
        <!-- Controles de edição -->
        <div class="creator-row">
          <button class="door-window-btn secondary" onclick="window.walkSystem?.startDoorResize()" title="Tecla: E">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14.5 4.5L19.5 9.5M9.5 14.5L4.5 19.5"/>
              <path d="M14.5 19.5L19.5 14.5M4.5 4.5L9.5 9.5"/>
            </svg>
            Redimensionar
          </button>
          <button class="door-window-btn secondary" onclick="window.walkSystem?.startDoorMove()" title="Tecla: M">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2L16 6H13V14H16L12 18L8 14H11V6H8L12 2Z"/>
            </svg>
            Mover
          </button>
        </div>
        
        <div class="creator-row">
          <button class="door-window-btn secondary" onclick="window.walkSystem?.startDoorTransfer()" title="Tecla: T">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15V19A2 2 0 0 1 19 21H5A2 2 0 0 1 3 19V5A2 2 0 0 1 5 3H9"/>
              <path d="M16 3H21V8"/>
              <path d="M14 5L21 3"/>
            </svg>
            Transferir Parede
          </button>
          <button class="door-window-btn danger" onclick="window.walkSystem?.deleteDoor()" title="Tecla: Delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3,6 5,6 21,6"/>
              <path d="M19 6V20A2 2 0 0 1 17 22H7A2 2 0 0 1 5 20V6"/>
            </svg>
            Remover
          </button>
        </div>
        
        <!-- Controle de estado -->
        <div class="creator-row">
          <button class="door-window-btn primary" onclick="window.doorControls?.toggle('${this.selectedDoor}'); window.walkSystem?.refreshWalkModePanel();" style="flex: 1;">
            ${selectedDoorInfo && selectedDoorInfo.isOpen ? 
              `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7A5 5 0 0 1 17 7V11"/>
              </svg>
              Fechar Porta` :
              `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7A5 5 0 0 1 17 7V11"/>
              </svg>
              Abrir Porta`
            }
          </button>
          <button class="door-window-btn secondary" onclick="window.walkSystem?.deselectDoor()" title="Tecla: Esc">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            Desselecionar
          </button>
        </div>
      </div>
      ` : ''}
      
      <!-- Lista de portas com funcionalidades do walk mode -->
      <h4 style="color: var(--text-primary); font-size: 13px; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14,2 14,8 20,8"/>
        </svg>
        Portas Existentes (${doors.length})
      </h4>
      
      <div class="door-window-list" id="walk-mode-doors-list">
        <!-- Lista será preenchida por updateWalkModeDoorsInPanel() -->
      </div>
      
      <!-- Dicas do walk mode -->
      <div style="margin-top: 16px; padding: 12px; background: rgba(42, 42, 42, 0.5); border-radius: 8px; border-left: 3px solid var(--accent-gold);">
        <div style="font-size: 12px; color: #ccc; line-height: 1.4;">
          <strong style="color: var(--accent-gold);">💡 Controles do Walk Mode:</strong><br>
          • Clique em uma porta para selecioná-la<br>
          • <strong>E</strong> - Redimensionar | <strong>M</strong> - Mover | <strong>T</strong> - Transferir | <strong>Del</strong> - Remover<br>
          • <strong>Esc</strong> - Desselecionar | Botões rápidos para abrir/fechar
        </div>
      </div>
    `;
  }

  /**
   * Atualizar lista de portas na seção walk mode
   */
  updateWalkModeDoorsInPanel() {
    const doorsList = document.getElementById('walk-mode-doors-list');
    if (!doorsList) return;
    
    const doors = window.doorControls ? window.doorControls.list() : [];
    
    if (doors.length === 0) {
      doorsList.innerHTML = `
        <div style="text-align: center; padding: 24px; color: #888;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom: 8px; opacity: 0.5;">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
          </svg>
          <div style="font-size: 14px; margin-bottom: 4px;">Nenhuma porta encontrada</div>
          <div style="font-size: 12px;">Crie portas usando a seção acima</div>
        </div>
      `;
    } else {
      doorsList.innerHTML = doors.map(door => this.createWalkModeDoorItem(door)).join('');
    }
  }

  /**
   * Criar item de porta para a lista do walk mode
   */
  createWalkModeDoorItem(door) {
    const isSelected = this.selectedDoor === door.id;
    
    return `
      <div class="door-window-item ${isSelected ? 'selected' : ''}" 
           onclick="window.walkSystem?.selectDoorForEditing('${door.id}')" 
           style="${isSelected ? 'background: rgba(124, 58, 237, 0.2); border-color: rgba(124, 58, 237, 0.5); box-shadow: 0 0 0 1px rgba(124, 58, 237, 0.3);' : ''}">
        <div class="door-window-item-info">
          <div class="door-window-item-name">🚪 ${door.id}</div>
          <div class="door-window-item-details">
            ${door.wallName} | Pos: (${door.position.x.toFixed(1)}, ${door.position.y.toFixed(1)})<br>
            Tamanho: ${door.config.width}×${door.config.height}m | ${door.isOpen ? '🔓 Aberta' : '🔒 Fechada'}
            ${isSelected ? '<div style="color: var(--accent-primary); font-weight: 600; margin-top: 2px;">✅ Selecionada para edição</div>' : ''}
          </div>
        </div>
        <div class="door-window-item-actions">
          <button class="door-window-item-btn toggle" 
                  onclick="event.stopPropagation(); window.doorControls?.toggle('${door.id}'); window.walkSystem?.refreshWalkModePanel();" 
                  title="Abrir/Fechar">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7A5 5 0 0 1 17 7V11"/>
            </svg>
          </button>
          <button class="door-window-item-btn remove" 
                  onclick="event.stopPropagation(); window.walkSystem?.selectDoorForEditing('${door.id}'); window.walkSystem?.deleteDoor();" 
                  title="Remover">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3,6 5,6 21,6"/>
              <path d="M19 6V20A2 2 0 0 1 17 22H7A2 2 0 0 1 5 20V6"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Atualizar painel walk mode completo
   */
  refreshWalkModePanel() {
    const walkSection = document.getElementById('walk-mode-doors-section');
    if (walkSection) {
      this.setupWalkModeInDoorsPanel();
    }
  }

  updateDoorsPanel(panel) {
    if (!window.doorControls) return;

    const doors = window.doorControls.list();
    
    let content = `
      <div style="font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #444; padding-bottom: 5px;">
        🚪 Portas Existentes (${doors.length})
      </div>
    `;

    if (doors.length === 0) {
      content += `
        <div style="color: #888; font-style: italic; text-align: center; padding: 20px;">
          Nenhuma porta encontrada<br>
          <small>Use o inventário para criar portas</small>
        </div>
      `;
    } else {
      doors.forEach(door => {
        const isSelected = this.selectedDoor === door.id;
        const selectedStyle = isSelected ? 'background: rgba(0, 255, 0, 0.2); border: 1px solid #0f0;' : '';
        
        content += `
          <div style="margin: 8px 0; padding: 8px; border-radius: 4px; cursor: pointer; ${selectedStyle}" 
               onclick="window.walkSystem.selectDoorForEditing('${door.id}')">
            <div style="font-weight: bold;">🚪 ${door.id}</div>
            <div style="font-size: 12px; color: #ccc;">
              Parede: ${door.wallName} | Pos: (${door.position.x.toFixed(1)}, ${door.position.y.toFixed(1)})<br>
              Tamanho: ${door.config.width}×${door.config.height}m | ${door.isOpen ? '🔓 Aberta' : '🔒 Fechada'}
            </div>
            ${isSelected ? '<div style="font-size: 11px; color: #0f0; margin-top: 3px;">✅ Selecionada para edição</div>' : ''}
          </div>
        `;
      });

      content += `
        <hr style="margin: 10px 0; border: 1px solid #444;">
        <div style="font-size: 11px; color: #aaa;">
          💡 <strong>Dica:</strong> Clique em uma porta para selecioná-la<br>
          Ou use E, M, T, Delete para editar a porta selecionada
        </div>
      `;
    }

    panel.innerHTML = content;

    // Expor referência do walk system globalmente para os cliques
    window.walkSystem = this;
  }
  
  createDoorListItem(door) {
    const isSelected = this.selectedDoor === door.id;
    const selectedClass = isSelected ? 'door-window-item selected' : 'door-window-item';
    
    return `
      <div class="${selectedClass}" onclick="window.walkSystem.selectDoorForEditing('${door.id}')" 
           style="${isSelected ? 'background: rgba(124, 58, 237, 0.2); border-color: rgba(124, 58, 237, 0.5);' : ''}">
        <div class="door-window-item-info">
          <div class="door-window-item-name">🚪 ${door.id}</div>
          <div class="door-window-item-details">
            ${door.wallName} | Pos: (${door.position.x.toFixed(1)}, ${door.position.y.toFixed(1)})<br>
            Tamanho: ${door.config.width}×${door.config.height}m | ${door.isOpen ? '🔓 Aberta' : '🔒 Fechada'}
            ${isSelected ? '<div style="color: var(--accent-primary); font-weight: 600; margin-top: 2px;">✅ Selecionada para edição</div>' : ''}
          </div>
        </div>
        <div class="door-window-item-actions">
          <button class="door-window-item-btn toggle" onclick="event.stopPropagation(); window.doorControls?.toggle('${door.id}'); window.walkSystem.refreshDoorsPanel();" title="Abrir/Fechar">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              ${door.isOpen ? 
                '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7A5 5 0 0 1 17 7V11"/>' :
                '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7A5 5 0 0 1 17 7V11"/>'
              }
            </svg>
          </button>
          <button class="door-window-item-btn remove" onclick="event.stopPropagation(); window.walkSystem.selectDoorForEditing('${door.id}'); window.walkSystem.deleteDoor();" title="Remover">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3,6 5,6 21,6"/>
              <path d="M19 6V20A2 2 0 0 1 17 22H7A2 2 0 0 1 5 20V6"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }
  
  getSelectedDoorInfo() {
    if (!this.selectedDoor || !window.doorControls) return null;
    
    const doors = window.doorControls.list();
    return doors.find(door => door.id === this.selectedDoor) || {
      id: this.selectedDoor,
      wallName: 'desconhecida',
      position: { x: 0, y: 0 },
      config: { width: 0.9, height: 2.1 },
      isOpen: false
    };
  }
  
  refreshDoorInfo() {
    // Atualizar a UI de edição se estiver visível
    const editingUI = document.getElementById('door-editing-ui');
    if (editingUI && this.selectedDoor) {
      this.showDoorEditingUI(); // Recriar com informações atualizadas
    }
    
    // Atualizar a lista de portas se estiver visível
    this.refreshDoorsPanel();
  }
  
  /**
   * Configurar seção de walk mode no painel de portas existente
   */
  setupWalkModeInDoorsPanel() {
    const doorsPanel = document.getElementById('room-doors-panel');
    const panelContent = doorsPanel.querySelector('.panel-content');
    
    // Remover seção anterior se existir
    const existingWalkSection = document.getElementById('walk-mode-doors-section');
    if (existingWalkSection) {
      existingWalkSection.remove();
    }
    
    // Criar seção para o walk mode
    const walkSection = document.createElement('div');
    walkSection.id = 'walk-mode-doors-section';
    walkSection.innerHTML = this.createWalkModeSectionHTML();
    
    // Adicionar no final do conteúdo do painel
    panelContent.appendChild(walkSection);
    
    // Atualizar lista de portas
    this.updateWalkModeDoorsInPanel();
  }
  
  /**
   * Criar HTML da seção de walk mode
   */
  createWalkModeSectionHTML() {
    const doors = window.doorControls ? window.doorControls.list() : [];
    const selectedDoorInfo = this.getSelectedDoorInfo();
    
    return `
      <!-- Divisor entre room mode e walk mode -->
      <hr style="margin: 24px 0; border: none; border-top: 2px solid rgba(124, 58, 237, 0.3); position: relative;">
      
      <!-- Cabeçalho da seção walk mode -->
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="background: rgba(124, 58, 237, 0.1); padding: 12px; border-radius: 10px; border: 1px solid rgba(124, 58, 237, 0.3);">
          <div style="display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600; color: var(--accent-primary); font-size: 14px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 2L19 14L13 10L9 14L1 12V2Z"/>
              <path d="M13 10L21 2"/>
            </svg>
            MODO WALK - GESTÃO DE PORTAS
          </div>
          <div style="font-size: 11px; color: #ccc; margin-top: 4px;">
            Edição avançada de portas durante a exploração
          </div>
        </div>
      </div>
      
      <!-- Seção de edição da porta selecionada -->
      ${this.selectedDoor ? `
      <div id="walk-mode-edit-section" style="margin-bottom: 20px;">
        <h4 style="color: var(--text-primary); font-size: 13px; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          Editando Porta Selecionada
        </h4>
        
        <!-- Info da porta selecionada -->
        <div class="creator-row" style="background: rgba(124, 58, 237, 0.15); border-color: rgba(124, 58, 237, 0.4);">
          <div style="flex: 1;">
            <div style="font-weight: 600; color: #fff; margin-bottom: 4px;">📍 ${selectedDoorInfo ? selectedDoorInfo.id : this.selectedDoor}</div>
            <div style="font-size: 12px; color: #ccc;">
              ${selectedDoorInfo ? `
                ${selectedDoorInfo.wallName} | (${selectedDoorInfo.position.x.toFixed(1)}, ${selectedDoorInfo.position.y.toFixed(1)}) | 
                ${selectedDoorInfo.config.width}×${selectedDoorInfo.config.height}m | 
                ${selectedDoorInfo.isOpen ? '🔓 Aberta' : '🔒 Fechada'}
              ` : 'Carregando informações...'}
            </div>
          </div>
        </div>
        
        <!-- Controles de edição -->
        <div class="creator-row">
          <button class="door-window-btn secondary" onclick="window.walkSystem?.startDoorResize()" title="Tecla: E">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14.5 4.5L19.5 9.5M9.5 14.5L4.5 19.5"/>
              <path d="M14.5 19.5L19.5 14.5M4.5 4.5L9.5 9.5"/>
            </svg>
            Redimensionar
          </button>
          <button class="door-window-btn secondary" onclick="window.walkSystem?.startDoorMove()" title="Tecla: M">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2L16 6H13V14H16L12 18L8 14H11V6H8L12 2Z"/>
            </svg>
            Mover
          </button>
        </div>
        
        <div class="creator-row">
          <button class="door-window-btn secondary" onclick="window.walkSystem?.startDoorTransfer()" title="Tecla: T">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15V19A2 2 0 0 1 19 21H5A2 2 0 0 1 3 19V5A2 2 0 0 1 5 3H9"/>
              <path d="M16 3H21V8"/>
              <path d="M14 5L21 3"/>
            </svg>
            Transferir Parede
          </button>
          <button class="door-window-btn danger" onclick="window.walkSystem?.deleteDoor()" title="Tecla: Delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3,6 5,6 21,6"/>
              <path d="M19 6V20A2 2 0 0 1 17 22H7A2 2 0 0 1 5 20V6"/>
            </svg>
            Remover
          </button>
        </div>
        
        <!-- Controle de estado -->
        <div class="creator-row">
          <button class="door-window-btn primary" onclick="window.doorControls?.toggle('${this.selectedDoor}'); window.walkSystem?.refreshWalkModePanel();" style="flex: 1;">
            ${selectedDoorInfo && selectedDoorInfo.isOpen ? 
              `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7A5 5 0 0 1 17 7V11"/>
              </svg>
              Fechar Porta` :
              `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7A5 5 0 0 1 17 7V11"/>
              </svg>
              Abrir Porta`
            }
          </button>
          <button class="door-window-btn secondary" onclick="window.walkSystem?.deselectDoor()" title="Tecla: Esc">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            Desselecionar
          </button>
        </div>
      </div>
      ` : ''}
      
      <!-- Lista de portas com funcionalidades do walk mode -->
      <h4 style="color: var(--text-primary); font-size: 13px; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14,2 14,8 20,8"/>
        </svg>
        Portas Existentes (${doors.length})
      </h4>
      
      <div class="door-window-list" id="walk-mode-doors-list">
        <!-- Lista será preenchida por updateWalkModeDoorsInPanel() -->
      </div>
      
      <!-- Dicas do walk mode -->
      <div style="margin-top: 16px; padding: 12px; background: rgba(42, 42, 42, 0.5); border-radius: 8px; border-left: 3px solid var(--accent-gold);">
        <div style="font-size: 12px; color: #ccc; line-height: 1.4;">
          <strong style="color: var(--accent-gold);">💡 Controles do Walk Mode:</strong><br>
          • Clique em uma porta para selecioná-la<br>
          • <strong>E</strong> - Redimensionar | <strong>M</strong> - Mover | <strong>T</strong> - Transferir | <strong>Del</strong> - Remover<br>
          • <strong>Esc</strong> - Desselecionar | Botões rápidos para abrir/fechar
        </div>
      </div>
    `;
  }
  
  /**
   * Atualizar lista de portas na seção walk mode
   */
  updateWalkModeDoorsInPanel() {
    const doorsList = document.getElementById('walk-mode-doors-list');
    if (!doorsList) return;
    
    const doors = window.doorControls ? window.doorControls.list() : [];
    
    if (doors.length === 0) {
      doorsList.innerHTML = `
        <div style="text-align: center; padding: 24px; color: #888;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom: 8px; opacity: 0.5;">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
          </svg>
          <div style="font-size: 14px; margin-bottom: 4px;">Nenhuma porta encontrada</div>
          <div style="font-size: 12px;">Crie portas usando a seção acima</div>
        </div>
      `;
    } else {
      doorsList.innerHTML = doors.map(door => this.createWalkModeDoorItem(door)).join('');
    }
  }
  
  /**
   * Criar item de porta para a lista do walk mode
   */
  createWalkModeDoorItem(door) {
    const isSelected = this.selectedDoor === door.id;
    
    return `
      <div class="door-window-item ${isSelected ? 'selected' : ''}" 
           onclick="window.walkSystem?.selectDoorForEditing('${door.id}')" 
           style="${isSelected ? 'background: rgba(124, 58, 237, 0.2); border-color: rgba(124, 58, 237, 0.5); box-shadow: 0 0 0 1px rgba(124, 58, 237, 0.3);' : ''}">
        <div class="door-window-item-info">
          <div class="door-window-item-name">🚪 ${door.id}</div>
          <div class="door-window-item-details">
            ${door.wallName} | Pos: (${door.position.x.toFixed(1)}, ${door.position.y.toFixed(1)})<br>
            Tamanho: ${door.config.width}×${door.config.height}m | ${door.isOpen ? '🔓 Aberta' : '🔒 Fechada'}
            ${isSelected ? '<div style="color: var(--accent-primary); font-weight: 600; margin-top: 2px;">✅ Selecionada para edição</div>' : ''}
          </div>
        </div>
        <div class="door-window-item-actions">
          <button class="door-window-item-btn toggle" 
                  onclick="event.stopPropagation(); window.doorControls?.toggle('${door.id}'); window.walkSystem?.refreshWalkModePanel();" 
                  title="Abrir/Fechar">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7A5 5 0 0 1 17 7V11"/>
            </svg>
          </button>
          <button class="door-window-item-btn remove" 
                  onclick="event.stopPropagation(); window.walkSystem?.selectDoorForEditing('${door.id}'); window.walkSystem?.deleteDoor();" 
                  title="Remover">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3,6 5,6 21,6"/>
              <path d="M19 6V20A2 2 0 0 1 17 22H7A2 2 0 0 1 5 20V6"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }
  
  /**
   * Atualizar painel walk mode completo
   */
  refreshWalkModePanel() {
    const walkSection = document.getElementById('walk-mode-doors-section');
    if (walkSection) {
      this.setupWalkModeInDoorsPanel();
    }
  }
  
  // Métodos placeholder para as ações de edição
  startDoorResize() {
    // Implementar lógica de redimensionamento
  }
  
  startDoorMove() {
    // Implementar lógica de movimentação
  }
  
  startDoorTransfer() {
    // Implementar lógica de transferência
  }

  hideExistingDoors() {
    // Fechar painel principal
    const doorsPanel = document.getElementById('room-doors-panel');
    if (doorsPanel) {
      doorsPanel.style.display = 'none';
    }
    
    // Para compatibilidade, também fechar painel antigo se existir
    const oldPanel = document.getElementById('existing-doors-panel');
    if (oldPanel) {
      oldPanel.style.display = 'none';
    }
  }

  // Atualizar painel de portas quando houver mudanças
  refreshDoorsPanel() {
    // Atualizar o painel principal de portas se estiver visível
    const doorsPanel = document.getElementById('room-doors-panel');
    if (doorsPanel && doorsPanel.style.display !== 'none') {
      this.refreshWalkModePanel();
    }
    
    // Para compatibilidade, também atualizar se existir painel antigo
    const oldPanel = document.getElementById('existing-doors-panel');
    if (oldPanel && oldPanel.style.display !== 'none') {
      this.showExistingDoors();
    }
  }

  // ===== SISTEMA VISUAL DE DRAG AND DROP DE PORTAS =====

  storeDoorOriginalData() {
    if (!this.selectedDoor || !window.doorControls) return;

    const doors = window.doorControls.list();
    const door = doors.find(d => d.id === this.selectedDoor);
    
    if (door) {
      this.doorOriginalPosition = { ...door.position };
      this.doorOriginalConfig = { ...door.config };
      this.dragStartMousePos = { ...this.dragCurrentMousePos };
    }
  }

  createDoorOutline(doorId) {
    console.log(`🔮 Criando outline para porta: ${doorId}`);
    
    this.removeDoorOutline();

    // Verificar múltiplas fontes para encontrar a porta
    let doorData = null;
    
    // Método 1: doorWindowSystem
    if (window.doorWindowSystem?.doors?.has(doorId)) {
      doorData = window.doorWindowSystem.doors.get(doorId);
      console.log(`📍 Porta encontrada via doorWindowSystem:`, doorData);
    }
    // Método 2: doorControls.list()
    else if (window.doorControls) {
      const doors = window.doorControls.list();
      const foundDoor = doors.find(d => d.id === doorId);
      if (foundDoor) {
        console.log(`📍 Porta encontrada via doorControls:`, foundDoor);
        // Tentar encontrar o objeto 3D da porta
        doorData = this.findDoorObjectInScene(doorId);
      }
    }
    
    if (!doorData || !doorData.group) {
      console.warn(`⚠️ Dados da porta '${doorId}' não encontrados ou grupo ausente`);
      return false;
    }

    try {
      // Criar outline roxo ao redor da porta
      this.doorOutlineMesh = new THREE.BoxHelper(doorData.group, 0x00FF00); // Verde brilhante para maior visibilidade
      this.doorOutlineMesh.material.linewidth = 6; // Linha mais espessa
      this.doorOutlineMesh.material.transparent = true;
      this.doorOutlineMesh.material.opacity = 1.0; // Opacidade total
      this.doorOutlineMesh.userData.isDoorOutline = true;
      this.scene.add(this.doorOutlineMesh);
      
      console.log(`✅ Outline criado com sucesso para porta '${doorId}'`);
      return true;
      
    } catch (error) {
      console.error(`❌ Erro ao criar outline:`, error);
      return false;
    }
  }

  /**
   * Detectar mudanças no número de portas e invalidar cache se necessário
   */
  checkForNewDoors() {
    let currentDoorCount = 0;
    const doorIds = new Set();
    
    // Contar portas via doorControls
    if (window.doorControls) {
      try {
        const doors = window.doorControls.list();
        currentDoorCount += doors.length;
        doors.forEach(door => doorIds.add(door.id));
      } catch (error) {
        console.warn('Erro ao acessar doorControls:', error);
      }
    }
    
    // Contar portas via doorWindowSystem
    if (window.doorWindowSystem?.doors) {
      const systemDoors = Array.from(window.doorWindowSystem.doors.keys());
      systemDoors.forEach(id => doorIds.add(id));
      currentDoorCount = Math.max(currentDoorCount, doorIds.size);
    }
    
    // Verificar se o número mudou
    if (currentDoorCount !== this.performanceCache.lastDoorCount) {
      const difference = currentDoorCount - this.performanceCache.lastDoorCount;
      console.log(`🚪🔄 Mudança detectada: ${difference > 0 ? '+' : ''}${difference} portas (total: ${currentDoorCount})`);
      
      // Invalidar cache quando há mudança
      this.invalidateCacheForNewDoors();
      this.performanceCache.lastDoorCount = currentDoorCount;
      
      // Atualizar spatial hash se há novas portas
      if (difference > 0) {
        console.log('🚪✨ Atualizando cache para incluir novas portas...');
        this.refreshDoorCache();
      }
    }
  }
  
  /**
   * Invalidar cache especificamente para mudanças de portas
   */
  invalidateCacheForNewDoors() {
    this.performanceCache.doorMeshes = null;
    this.performanceCache.buildableObjects = null;
    this.performanceCache.isValid = false;
    
    // Limpar spatial hash para forçar reconstrução
    if (this.doorSpatialHash) {
      this.doorSpatialHash.clear();
    }
    
    // Limpar cache de raycast
    this._raycastCache = null;
    
    // Limpar cache de mesh mapping
    if (this._meshToRoomObjectCache) {
      this._meshToRoomObjectCache.clear();
    }
    
    console.log('🔄 Cache invalidado devido a mudanças nas portas');
  }
  
  /**
   * Atualizar cache de portas forçadamente
   */
  refreshDoorCache() {
    // Forçar atualização do cache de portas
    const { doorObjects, spatialHash } = this.getOptimizedDoorObjects();
    this.doorSpatialHash = spatialHash;
    this.performanceCache.doorMeshes = doorObjects;
    
    // Log das novas portas encontradas
    const doorIds = Array.from(spatialHash.keys());
    console.log(`🚪📋 Cache de portas atualizado: [${doorIds.join(', ')}]`);
    
    return doorObjects;
  }

  /**
   * Verificar se porta existe em qualquer sistema
   */
  doorExists(doorId) {
    // Verificar no doorWindowSystem
    if (window.doorWindowSystem?.doors?.has(doorId)) {
      return true;
    }
    
    // Verificar no doorControls
    if (window.doorControls) {
      const doors = window.doorControls.list();
      return doors.some(door => door.id === doorId);
    }
    
    return false;
  }

  /**
   * Encontrar objeto da porta na cena
   */
  findDoorObjectInScene(doorId) {
    let foundGroup = null;
    
    this.scene.traverse((child) => {
      if (child.userData && child.userData.doorId === doorId) {
        // Encontrar o grupo pai da porta
        let current = child;
        while (current.parent && current.parent !== this.scene) {
          current = current.parent;
          if (current.userData && current.userData.doorId === doorId) {
            foundGroup = current;
            break;
          }
        }
        if (!foundGroup) foundGroup = child;
      }
    });
    
    return foundGroup ? { group: foundGroup } : null;
  }

  /**
   * Método alternativo de highlight usando material
   */
  createAlternativeDoorHighlight(doorId) {
    console.log(`🌈 Tentando highlight alternativo para porta '${doorId}'`);
    
    // Encontrar meshes da porta na cena
    const doorMeshes = [];
    this.scene.traverse((child) => {
      if (child.isMesh && child.userData && child.userData.doorId === doorId) {
        doorMeshes.push(child);
      }
    });
    
    if (doorMeshes.length > 0) {
      // Aplicar highlight por material
      doorMeshes.forEach(mesh => {
        if (mesh.material) {
          // Guardar material original
          if (!mesh.userData.originalMaterial) {
            mesh.userData.originalMaterial = mesh.material;
          }
          
          // Criar material de highlight
          const highlightMaterial = mesh.material.clone();
          highlightMaterial.emissive.setHex(0x004400); // Verde escuro emissivo
          highlightMaterial.emissiveIntensity = 0.3;
          mesh.material = highlightMaterial;
          
          // Marcar para remoção posterior
          mesh.userData.hasHighlight = true;
        }
      });
      
      console.log(`✅ Highlight alternativo aplicado em ${doorMeshes.length} meshes`);
      return true;
    }
    
    return false;
  }

  removeDoorOutline() {
    // Remover outline BoxHelper
    if (this.doorOutlineMesh) {
      this.scene.remove(this.doorOutlineMesh);
      this.doorOutlineMesh = null;
    }
    
    // Remover highlight alternativo
    this.removeAlternativeHighlight();
  }

  /**
   * Remover highlight alternativo dos materiais
   */
  removeAlternativeHighlight() {
    this.scene.traverse((child) => {
      if (child.isMesh && child.userData.hasHighlight) {
        if (child.userData.originalMaterial) {
          child.material = child.userData.originalMaterial;
          delete child.userData.originalMaterial;
        }
        delete child.userData.hasHighlight;
      }
    });
  }

  createDoorPreview(mode) {
    this.removeDoorPreview();

    if (!this.selectedDoor || !window.doorWindowSystem?.doors?.has(this.selectedDoor)) return;

    const doorData = window.doorWindowSystem.doors.get(this.selectedDoor);
    if (!doorData.group) return;

    // Criar preview semi-transparente da porta
    this.doorPreviewMesh = doorData.group.clone();
    
    // Tornar preview semi-transparente e com cor diferente
    this.doorPreviewMesh.traverse((child) => {
      if (child.isMesh && child.material) {
        const material = child.material.clone();
        material.transparent = true;
        material.opacity = 0.5;
        material.color.setHex(0x00FFFF); // Cor ciano para preview
        child.material = material;
      }
    });

    this.scene.add(this.doorPreviewMesh);
  }

  removeDoorPreview() {
    if (this.doorPreviewMesh) {
      this.scene.remove(this.doorPreviewMesh);
      this.doorPreviewMesh = null;
    }
  }

  updateDoorDrag(movementX, movementY) {
    if (!this.isDraggingDoor || !this.selectedDoor) return;

    switch (this.doorDragMode) {
      case 'move':
        this.updateDoorMovePreview(movementX, movementY);
        break;
      case 'resize':
        this.updateDoorResizePreview(movementX, movementY);
        break;
      case 'transfer':
        this.updateDoorTransferPreview(movementX, movementY);
        break;
    }
  }

  updateDoorMovePreview(movementX, movementY) {
    if (!this.doorPreviewMesh) return;

    // Usar raycast para encontrar posição baseada no centro da tela
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.walkCamera);
    
    // Buscar QUALQUER parede (não apenas a atual)
    const walls = [];
    if (window.roomConfigSystem?.roomElements?.walls) {
      walls.push(...window.roomConfigSystem.roomElements.walls);
    }

    const intersections = this.raycaster.intersectObjects(walls, false);
    
    if (intersections.length > 0) {
      const intersection = intersections[0];
      const wallName = intersection.object.userData.wallName;
      
      if (wallName) {
        // Converter ponto mundial para coordenadas locais da parede
        const localCoords = this.worldPointToWallCoords(intersection.point, wallName);
        const newWorldPos = this.getWorldPositionFromDoorCoords(wallName, { x: localCoords.x, y: 0 });
        
        if (newWorldPos) {
          // Atualizar posição do preview
          this.doorPreviewMesh.position.copy(newWorldPos);
          
          // Ajustar rotação baseada na parede de destino
          this.doorPreviewMesh.rotation.y = this.getWallRotation(wallName);
          
          // Feedback visual da parede atual
          const doors = window.doorControls.list();
          const door = doors.find(d => d.id === this.selectedDoor);
          
          if (door && wallName !== door.wallName) {
            // Mudar cor do preview para indicar mudança de parede
            this.doorPreviewMesh.traverse((child) => {
              if (child.isMesh && child.material) {
                child.material.color.setHex(0xFFFF00); // Amarelo = mudança de parede
              }
            });
          } else {
            // Cor normal para mesma parede
            this.doorPreviewMesh.traverse((child) => {
              if (child.isMesh && child.material) {
                child.material.color.setHex(0x00FFFF); // Ciano = mesma parede
              }
            });
          }
        }
      }
    }
  }

  updateDoorResizePreview(movementX, movementY) {
    if (!this.doorPreviewMesh) return;

    // Calcular novo tamanho baseado no movimento do mouse
    const resizeSpeed = 0.001;
    const newWidth = Math.max(0.5, this.doorOriginalConfig.width + movementX * resizeSpeed * (this.dragCurrentMousePos.x - this.dragStartMousePos.x));
    const newHeight = Math.max(1.0, this.doorOriginalConfig.height - movementY * resizeSpeed * (this.dragCurrentMousePos.y - this.dragStartMousePos.y));

    // Atualizar escala do preview
    const scaleX = newWidth / this.doorOriginalConfig.width;
    const scaleY = newHeight / this.doorOriginalConfig.height;
    
    this.doorPreviewMesh.scale.set(scaleX, scaleY, 1);
  }

  updateDoorTransferPreview(movementX, movementY) {
    // Usar raycast para detectar parede alvo
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.walkCamera);
    
    const walls = [];
    if (window.roomConfigSystem?.roomElements?.walls) {
      walls.push(...window.roomConfigSystem.roomElements.walls);
    }

    const intersections = this.raycaster.intersectObjects(walls, false);
    
    if (intersections.length > 0 && this.doorPreviewMesh) {
      const intersection = intersections[0];
      const wallName = intersection.object.userData.wallName;
      
      if (wallName) {
        // Posicionar preview na nova parede
        const localCoords = this.worldPointToWallCoords(intersection.point, wallName);
        const worldPos = this.getWorldPositionFromDoorCoords(wallName, { x: localCoords.x, y: 0 });
        
        if (worldPos) {
          this.doorPreviewMesh.position.copy(worldPos);
          
          // Ajustar rotação baseada na parede
          this.doorPreviewMesh.rotation.y = this.getWallRotation(wallName);
        }
      }
    }
  }

  getWorldPositionFromDoorCoords(wallName, coords) {
    if (!this.roomModeSystem?.config?.dimensions) return null;

    const { width, height, depth } = this.roomModeSystem.config.dimensions;
    const pos = new THREE.Vector3();
    
    switch (wallName) {
      case 'front':
        pos.set(coords.x, coords.y + height/2, -depth / 2);
        break;
      case 'back':
        pos.set(coords.x, coords.y + height/2, depth / 2);
        break;
      case 'left':
        pos.set(-width / 2, coords.y + height/2, coords.x);
        break;
      case 'right':
        pos.set(width / 2, coords.y + height/2, coords.x);
        break;
    }
    
    return pos;
  }

  getWallRotation(wallName) {
    switch (wallName) {
      case 'front': return 0;
      case 'back': return Math.PI;
      case 'left': return Math.PI / 2;
      case 'right': return -Math.PI / 2;
      default: return 0;
    }
  }

  confirmDoorDrag() {
    if (!this.isDraggingDoor || !this.selectedDoor) return;


    switch (this.doorDragMode) {
      case 'move':
        this.confirmDoorMove();
        break;
      case 'resize':
        this.confirmDoorResize();
        break;
      case 'transfer':
        this.confirmDoorTransfer();
        break;
    }

    this.finishDoorDrag();
  }

  confirmDoorMove() {
    if (!this.doorPreviewMesh) return;

    // Usar raycast para encontrar posição final onde o usuário está apontando
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.walkCamera);
    
    const walls = [];
    if (window.roomConfigSystem?.roomElements?.walls) {
      walls.push(...window.roomConfigSystem.roomElements.walls);
    }

    const intersections = this.raycaster.intersectObjects(walls, false);
    
    if (intersections.length > 0) {
      const intersection = intersections[0];
      const targetWallName = intersection.object.userData.wallName;
      
      const doors = window.doorControls.list();
      const door = doors.find(d => d.id === this.selectedDoor);
      
      if (door && targetWallName) {
        const localCoords = this.worldPointToWallCoords(intersection.point, targetWallName);
        let success = false;
        
        if (targetWallName === door.wallName) {
          // Mesma parede: usar move
          success = window.doorControls.move(this.selectedDoor, { x: localCoords.x, y: door.position.y });
        } else {
          // Parede diferente: usar transfer
          success = window.doorControls.transfer(this.selectedDoor, targetWallName, { x: localCoords.x, y: 0 });
        }
        
        if (success) {
          this.refreshDoorsPanel();
        } else {
          console.error('❌ Falha ao reposicionar porta - posição inválida ou sem espaço');
        }
      }
    } else {
      console.warn('⚠️ Aponte para uma parede válida para posicionar a porta');
    }
  }

  confirmDoorResize() {
    const doors = window.doorControls.list();
    const door = doors.find(d => d.id === this.selectedDoor);
    if (!door || !this.doorPreviewMesh) return;

    // Calcular novos tamanhos baseados na escala do preview
    const newWidth = this.doorOriginalConfig.width * this.doorPreviewMesh.scale.x;
    const newHeight = this.doorOriginalConfig.height * this.doorPreviewMesh.scale.y;

    const success = window.doorControls.resize(this.selectedDoor, { 
      width: Math.max(0.5, newWidth), 
      height: Math.max(1.0, newHeight) 
    });
    
    if (success) {
      this.refreshDoorsPanel();
    } else {
      console.error('❌ Falha ao redimensionar porta');
    }
  }

  confirmDoorTransfer() {
    // Detectar parede alvo via raycast
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.walkCamera);
    
    const walls = [];
    if (window.roomConfigSystem?.roomElements?.walls) {
      walls.push(...window.roomConfigSystem.roomElements.walls);
    }

    const intersections = this.raycaster.intersectObjects(walls, false);
    
    if (intersections.length > 0) {
      const wallName = intersections[0].object.userData.wallName;
      const localCoords = this.worldPointToWallCoords(intersections[0].point, wallName);
      
      if (wallName && wallName !== this.doorOriginalWallName) {
        const success = window.doorControls.transfer(this.selectedDoor, wallName, { x: localCoords.x, y: 0 });
        
        if (success) {
          this.refreshDoorsPanel();
        } else {
          console.error('❌ Falha ao transferir porta');
        }
      }
    }
  }

  cancelDoorDrag() {
    this.finishDoorDrag();
  }

  finishDoorDrag() {
    this.isDraggingDoor = false;
    this.doorDragMode = null;
    this.removeDoorPreview();
    this.hideDragInstructions();
    
    // Recriar outline normal
    if (this.selectedDoor) {
      this.createDoorOutline(this.selectedDoor);
    }
  }

  showDragInstructions(mode) {
    const instructions = {
      'move': '🚚 MODO MOVIMENTAÇÃO UNIVERSAL: Aponte para QUALQUER parede para colocar a porta\\n🎨 Ciano=mesma parede | 🟡 Amarelo=parede diferente\\nVocê pode mover a câmera normalmente',
      'resize': '🔧 MODO REDIMENSIONAMENTO: Mova mouse horizontal=largura, vertical=altura\\nVocê pode mover a câmera normalmente', 
      'transfer': '🔄 MODO TRANSFERÊNCIA: Aponte para uma parede diferente para transferir\\nVocê pode mover a câmera normalmente'
    };

    this.showTemporaryMessage(instructions[mode] + '\\n\\n✅ Clique Esquerdo = Confirmar | ❌ Clique Direito = Cancelar | 🚪 Esc = Sair');
  }

  hideDragInstructions() {
    this.hideTemporaryMessage();
  }

  showTemporaryMessage(text) {
    let msgDiv = document.getElementById('temp-door-message');
    
    if (!msgDiv) {
      msgDiv = document.createElement('div');
      msgDiv.id = 'temp-door-message';
      msgDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 20px;
        border-radius: 10px;
        font-family: Arial, sans-serif;
        font-size: 16px;
        text-align: center;
        z-index: 10000;
        max-width: 400px;
        line-height: 1.4;
      `;
      document.body.appendChild(msgDiv);
    }
    
    msgDiv.textContent = text;
    msgDiv.style.display = 'block';
  }

  hideTemporaryMessage() {
    const msgDiv = document.getElementById('temp-door-message');
    if (msgDiv) {
      msgDiv.style.display = 'none';
    }
  }

  // Método para debug - listar todas as portas e suas posições
  debugListDoors() {
    
    // Verificar sistema doorWindowSystem
    if (window.doorWindowSystem) {
      
      window.doorWindowSystem.doors.forEach((doorData, doorId) => {
        
        if (doorData.group) {
          let meshCount = 0;
          doorData.group.traverse((child) => {
            if (child.isMesh) {
              meshCount++;
              const worldPos = new THREE.Vector3();
              child.getWorldPosition(worldPos);
            }
          });
        }
      });
    } else {
    }
    
    // Verificar doorControls
    if (window.doorControls) {
      const doors = window.doorControls.list();
    } else {
    }
    
    // Testar getDoorObjectsFromSystem
    const systemDoors = this.getDoorObjectsFromSystem();
    
    // Listar objetos de porta na cena (fallback)
    const sceneDoors = this.getAllDoorMeshes();
    
    // Testar getBuildableObjects
    const buildableObjects = this.getBuildableObjects();
    
  }

  /**
   * Corrigir materiais das portas de forma otimizada (UMA VEZ)
   */
  fixDoorMaterialsOnce() {
    let portasCorrigidas = 0;
    
    // Usar cache otimizado em vez de traverse
    if (this.performanceCache.doorMeshes) {
      this.performanceCache.doorMeshes.forEach(mesh => {
        this.forceOpaqueMaterialOptimized(mesh, `Porta em cache`);
        portasCorrigidas++;
      });
    } else {
      // Fallback: método direto via sistema de portas
      if (window.doorWindowSystem && window.doorWindowSystem.doors) {
        for (const [id, door] of window.doorWindowSystem.doors) {
          [door.leaf, door.frame, door.group].forEach(component => {
            if (component) {
              component.traverse((child) => {
                if (child.isMesh) {
                  this.forceOpaqueMaterialOptimized(child, `Componente da porta ${id}`);
                  portasCorrigidas++;
                }
              });
            }
          });
        }
      }
    }
  }

  /**
   * Garantir opacidade uma vez (sem loop contínuo)
   */
  ensureDoorOpacityOnce() {
    if (window.doorWindowSystem && window.doorWindowSystem.doors) {
      for (const [id, door] of window.doorWindowSystem.doors) {
        [door.leaf, door.frame, door.group].forEach(component => {
          if (component) {
            component.traverse((child) => {
              if (child.isMesh && child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach(material => {
                  if (material) {
                    material.transparent = false;
                    material.opacity = 1.0;
                    material.needsUpdate = true;
                  }
                });
              }
            });
          }
        });
      }
    }
  }
  
  /**
   * Forçar material completamente opaco (método otimizado)
   */
  forceOpaqueMaterialOptimized(object, description) {
    if (!object || !object.material) return;
    
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    
    materials.forEach((material, index) => {
      if (material) {
        // Otimizar para reduzir shader recompilations
        if (material.transparent || material.opacity < 1.0) {
          material.transparent = false;
          material.opacity = 1.0;
          material.alphaTest = 0;
          material.alphaMap = null;
          
          // Reutilizar materiais quando possível para reduzir texturas
          if (material.map && material.map.image) {
            // Limitar número de texturas únicas
            material.map.generateMipmaps = false;
            material.map.minFilter = THREE.LinearFilter;
          }
          
          material.needsUpdate = true;
        }
      }
    });
  }

  /**
   * Método legacy mantido para compatibilidade
   */
  forceOpaqueMaterial(object, description) {
    return this.forceOpaqueMaterialOptimized(object, description);
  }
  
  /**
   * Força bruta - garantir que TODAS as portas sejam opacas
   */
  forceAllDoorOpacity() {
    
    let corrigidos = 0;
    
    // Método específico para portas do sistema
    if (window.doorWindowSystem && window.doorWindowSystem.doors) {
      for (const [id, door] of window.doorWindowSystem.doors) {
        [door.leaf, door.frame, door.group].forEach(component => {
          if (component) {
            component.traverse((child) => {
              if (child.isMesh && child.material) {
                this.forceOpaqueMaterial(child, `Componente da porta ${id}`);
                corrigidos++;
              }
            });
          }
        });
      }
    }
    
    // Varredura geral na cena
    this.scene.traverse((object) => {
      if (object.isMesh && object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        
        materials.forEach((material, index) => {
          if (material && (material.transparent || material.opacity < 1.0)) {
            // Se qualquer objeto ainda estiver transparente, corrigir IMEDIATAMENTE
            material.transparent = false;
            material.opacity = 1.0;
            material.alphaTest = 0;
            material.needsUpdate = true;
            material.version++;
            corrigidos++;
          }
        });
      }
    });
    
  }
  
  /**
   * Verificação pontual de opacidade (apenas quando necessário)
   */
  checkOpacityIfNeeded() {
    // Só verificar se há indicação de problema
    if (!this.performanceCache.isValid) {
      this.ensureDoorOpacityOnce();
    }
  }

  /**
   * Limpar recursos desnecessários (otimizado)
   */
  cleanupResources() {
    const now = Date.now();
    
    // Limpar cache baseado em idade E uso
    const cacheAge = now - this.performanceCache.lastUpdate;
    const framesSinceUpdate = this.performanceCache.framesSinceUpdate || 0;
    
    if (cacheAge > 180000 || framesSinceUpdate > 1000) { // 3 min OU 1000 frames
      const oldObjectCount = this.performanceCache.objectCount || 0;
      
      this.performanceCache.isValid = false;
      this.performanceCache.buildableObjects = null;
      this.performanceCache.doorMeshes = null;
      this.performanceCache.roomObjects = null;
      
      if (this.doorSpatialHash) {
        this.doorSpatialHash.clear();
      }
      
      // Limpar cache de raycast
      this._raycastCache = null;
      
      if (oldObjectCount > 0) {
        console.log(`🧹 Cache limpo: ${oldObjectCount} objetos, idade: ${Math.round(cacheAge/1000)}s`);
      }
    }
    
    // Monitor inteligente de texturas
    if (window.renderer?.info) {
      const info = window.renderer.info;
      const textureCount = info.memory.textures;
      const geometryCount = info.memory.geometries;
      
      if (textureCount > 14) {
        console.warn(`⚠️ CRÍTICO: ${textureCount}/16 texturas - Otimizando...`);
        this.optimizeAllMaterials();
      }
      
      // Stats periódicos (menos spam)
      if (Math.random() < 0.05) { // 5% chance
        console.log(`📊 WebGL: ${textureCount}T, ${geometryCount}G, ${info.render.calls}C`);
      }
    }
    
    // Limpar vector pool se muito grande
    if (this.vectorPool.vectors.length > 15) {
      this.vectorPool.vectors.length = 10;
    }
  }
  
  /**
   * Abrir/fechar porta (integração com doorWindowSystem) - OTIMIZADO
   */
  toggleDoor(doorId) {
    if (!window.doorControls) {
      console.error('❌ Sistema doorControls não disponível');
      return false;
    }
    
    try {
      const success = window.doorControls.toggle(doorId);
      
      if (success) {
        // Log apenas em caso de sucesso significativo
        if (Math.random() < 0.1) { // Log 10% das vezes
          console.log(`✅ Porta ${doorId} alterada com sucesso`);
        }
        
        // Usar debounced update para evitar lag
        if (this.debouncedUIUpdate) {
          this.debouncedUIUpdate();
        }
        
        return true;
      } else {
        console.error(`❌ Falha ao alterar estado da porta '${doorId}'`);
        return false;
      }
    } catch (error) {
      console.error('❌ Erro ao executar toggle:', error);
      return false;
    }
  }


  
  /**
   * Configurar velocidade de movimento
   */
  setMoveSpeed(speed) {
    this.moveSpeed = Math.max(0.1, Math.min(speed, 5.0)); // Limitar entre 0.1 e 5.0
  }
  
  /**
   * Configurar velocidade de corrida
   */
  setSprintSpeed(speed) {
    this.sprintSpeed = Math.max(0.1, Math.min(speed, 8.0)); // Limitar entre 0.1 e 8.0
  }
  
  /**
   * Obter velocidades atuais
   */
  getSpeeds() {
    return {
      moveSpeed: this.moveSpeed,
      sprintSpeed: this.sprintSpeed,
      mouseSensitivity: this.mouseSensitivity,
      acceleration: this.acceleration
    };
  }
  
  /**
   * Configurar aceleração
   */
  setAcceleration(acceleration) {
    this.acceleration = Math.max(0.01, Math.min(acceleration, 0.2)); // Limitar entre 0.01 e 0.2
  }
  
  /**
   * Configurar sensibilidade do mouse
   */
  setMouseSensitivity(sensitivity) {
    this.mouseSensitivity = Math.max(0.0005, Math.min(sensitivity, 0.01)); // Limitar entre 0.0005 e 0.01
  }

  /**
   * Cleanup completo para saída do walk mode
   */
  performCompleteCleanup() {
    // Limpar todos os caches
    this.performanceCache.isValid = false;
    this.performanceCache.buildableObjects = null;
    this.performanceCache.doorMeshes = null;
    this.performanceCache.roomObjects = null;
    
    // Limpar spatial hash
    if (this.doorSpatialHash) {
      this.doorSpatialHash.clear();
    }
    
    // Limpar caches de raycast e mesh mapping
    this._raycastCache = null;
    if (this._meshToRoomObjectCache) {
      this._meshToRoomObjectCache.clear();
    }
    
    // Devolver todos os vetores ao pool
    this.vectorPool.vectors.length = 0;
    
    // Reset de variáveis de cache
    this._cachedYaw = null;
    this._cosYaw = null;
    this._sinYaw = null;
    
    // Cleanup final de recursos
    this.cleanupResources();
    
    console.log('🧹 Cleanup completo do walk mode realizado');
  }

  /**
   * Monitorar uso de texturas para prevenir shader errors
   */
  monitorTextureUsage() {
    if (window.renderer && window.renderer.info) {
      const info = window.renderer.info;
      const textureCount = info.memory.textures;
      const geometryCount = info.memory.geometries;
      
      if (textureCount > 14) {
        console.warn(`⚠️ CRÍTICO: Uso alto de texturas ${textureCount}/16 - Limpando...`);
        this.optimizeAllMaterials();
      } else if (textureCount > 12) {
        console.warn(`⚠️ Uso moderado de texturas: ${textureCount}/16`);
      }
      
      // Log periódico para debug
      if (Math.random() < 0.1) {
        console.log(`📊 Recursos WebGL: ${textureCount} texturas, ${geometryCount} geometrias`);
      }
    }
  }

  /**
   * Obter informações de uso de texturas
   */
  getTextureInfo() {
    if (window.renderer && window.renderer.info) {
      return {
        textures: window.renderer.info.memory.textures,
        geometries: window.renderer.info.memory.geometries,
        programs: window.renderer.info.programs?.length || 0,
        calls: window.renderer.info.render.calls,
        triangles: window.renderer.info.render.triangles
      };
    }
    return null;
  }

  /**
   * Otimizar todos os materiais para reduzir uso de texturas
   */
  optimizeAllMaterials() {
    let materialsOptimized = 0;
    const materialCache = new Map();
    
    this.scene.traverse((object) => {
      if (object.isMesh && object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        
        materials.forEach((material) => {
          if (material && !material._optimized) {
            // Reutilizar materiais similares
            const materialKey = this.getMaterialKey(material);
            if (materialCache.has(materialKey)) {
              object.material = materialCache.get(materialKey);
            } else {
              this.optimizeMaterial(material);
              material._optimized = true;
              materialCache.set(materialKey, material);
              materialsOptimized++;
            }
          }
        });
      }
    });
    
    console.log(`🔧 Otimizados ${materialsOptimized} materiais, ${materialCache.size} únicos`);
  }

  /**
   * Gerar chave única para material
   */
  getMaterialKey(material) {
    return `${material.type}_${material.color?.getHex() || 0}_${material.transparent}_${material.opacity}`;
  }

  /**
   * Otimizar material individual
   */
  optimizeMaterial(material) {
    if (!material) return;
    
    // Reduzir qualidade de texturas se necessário
    if (material.map) {
      material.map.generateMipmaps = false;
      material.map.minFilter = THREE.LinearFilter;
      material.map.magFilter = THREE.LinearFilter;
    }
    
    // Simplificar propriedades desnecessárias
    if (material.normalMap && material.normalMap.image) {
      // Manter normal maps apenas para objetos importantes
      if (!material.userData?.important) {
        material.normalMap = null;
      }
    }
    
    // Otimizar transparência
    if (material.transparent && material.opacity >= 0.99) {
      material.transparent = false;
      material.opacity = 1.0;
    }
  }
}
