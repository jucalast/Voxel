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

    // Elementos DOM
    this.crosshair = null;

    // Bind methods
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseClick = this.onMouseClick.bind(this);
    this.onPointerLockChange = this.onPointerLockChange.bind(this);
    this.animate = this.animate.bind(this);

    this.init();
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

    // Corrigir materiais das portas para garantir que não fiquem transparentes
    this.fixDoorMaterials();
    
    // CORREÇÃO ADICIONAL: Forçar opacidade após um breve delay
    setTimeout(() => {
      this.forceAllDoorOpacity();
    }, 500);
    
    // Iniciar monitoramento contínuo de opacidade
    this.startOpacityMonitoring();

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
    
    // GARANTIR opacidade das portas ao sair do modo walk
    this.forceAllDoorOpacity();
    
    // Parar monitoramento de opacidade
    this.stopOpacityMonitoring();

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

    // Se estiver em modo drag de porta, confirmar ação
    if (this.isDraggingDoor && event.button === 0) {
      this.confirmDoorDrag();
      return;
    }

    // Se clique direito durante drag, cancelar
    if (this.isDraggingDoor && event.button === 2) {
      this.cancelDoorDrag();
      return;
    }


    // Só processar cliques esquerdos para portas
    if (event.button !== 0) return;

    // Atualizar raycaster
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.walkCamera);

    // Primeiro verificar se clicou em uma porta (para edição)
    const allObjects = [...this.getRoomObjects(), ...this.getBuildableObjects()];
    
    const allIntersects = this.raycaster.intersectObjects(allObjects, true);

    if (allIntersects.length > 0) {
      const intersectedMesh = allIntersects[0].object;
      
      // Verificar se clicou em uma porta
      if (this.detectDoorClick(intersectedMesh)) {
        return; // Porta foi processada no detectDoorClick
      }
      
      // Verificar se clicou em um objeto da sala
      const roomObject = this.findRoomObjectByMesh(intersectedMesh);
      if (roomObject) {
        this.selectRoomObject(roomObject);
        return;
      }
    }

    // Se não clicou em objeto da sala, verificar construção de voxels
    const buildableObjects = this.getBuildableObjects();
    const buildIntersects = this.raycaster.intersectObjects(buildableObjects, false);

    if (buildIntersects.length > 0) {
      const intersect = buildIntersects[0];
      const point = intersect.point;
      const face = intersect.face;
      const object = intersect.object;

      if (event.button === 0) { // Clique esquerdo - construir
        // Desselecionar objeto se estava selecionado
        if (this.selectedObject) {
          this.deselectRoomObject();
        }
        this.placeVoxel(point, face);
      } else if (event.button === 2) { // Clique direito - remover
        this.removeVoxel(object);
      }
    } else if (event.button === 0) {
      // Clique no vazio - desselecionar objeto
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
    // Retornar todos os voxels do editor e geometrias da sala
    const objects = [];

    // Adicionar todos os voxels do editor usando a função getVoxels()
    try {
      const editorVoxels = this.editorFunctions.getVoxels();
      objects.push(...editorVoxels);
    } catch (error) {
      console.warn('Erro ao obter voxels do editor:', error);
      // Fallback: adicionar voxels da sala
      if (this.roomModeSystem && this.roomModeSystem.roomObjects) {
        this.roomModeSystem.roomObjects.forEach(obj => {
          obj.meshGroup.traverse((child) => {
            if (child.isMesh) {
              objects.push(child);
            }
          });
        });
      }
    }

    // Adicionar geometria da sala (chão e paredes)
    if (this.roomModeSystem) {
      if (this.roomModeSystem.roomFloor) {
        objects.push(this.roomModeSystem.roomFloor);
      }
      if (this.roomModeSystem.roomWalls) {
        objects.push(...this.roomModeSystem.roomWalls);
      }
    }

    // CORREÇÃO CRÍTICA: Buscar portas do sistema doorWindowSystem
    const doorObjects = this.getDoorObjectsFromSystem();
    objects.push(...doorObjects);

    // Também buscar portas perdidas na cena (fallback)
    const sceneDoors = this.getAllDoorMeshes();
    const newDoors = sceneDoors.filter(door => !doorObjects.includes(door));
    objects.push(...newDoors);

    return objects;
  }

  // MÉTODO PRINCIPAL: Buscar portas diretamente do sistema doorWindowSystem
  getDoorObjectsFromSystem() {
    const doorObjects = [];
    
    // Verificar se o sistema de portas existe
    if (!window.doorWindowSystem || !window.doorWindowSystem.doors) {
      return doorObjects;
    }
    
    
    // Iterar por todas as portas no sistema
    window.doorWindowSystem.doors.forEach((doorData, doorId) => {
      
      // Adicionar todos os elementos da porta (grupo, folha, batente)
      if (doorData.group) {
        // Percorrer todos os meshes do grupo da porta
        doorData.group.traverse((child) => {
          if (child.isMesh) {
            // Marcar o mesh com o ID da porta para facilitar detecção
            child.userData.doorId = doorId;
            child.userData.isDoor = true;
            doorObjects.push(child);
          }
        });
      }
      
      // Também adicionar folha e batente separadamente (se existirem)
      if (doorData.leaf && doorData.leaf.isMesh) {
        doorData.leaf.userData.doorId = doorId;
        doorData.leaf.userData.isDoor = true;
        if (!doorObjects.includes(doorData.leaf)) {
          doorObjects.push(doorData.leaf);
        }
      }
      
      if (doorData.frame) {
        doorData.frame.traverse((child) => {
          if (child.isMesh) {
            child.userData.doorId = doorId;
            child.userData.isDoor = true;
            if (!doorObjects.includes(child)) {
              doorObjects.push(child);
            }
          }
        });
      }
    });
    
    return doorObjects;
  }

  // Método fallback para encontrar todos os meshes de portas na cena
  getAllDoorMeshes() {
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

  updateMovement() {
    if (!this.isActive) return;

    // =====================================================================
    // LÓGICA DE MOVIMENTO CORRIGIDA
    // =====================================================================

    // 1. Determinar a direção do input (local para a câmera)
    this.direction.z = Number(this.keys.s) - Number(this.keys.w);
    this.direction.x = Number(this.keys.d) - Number(this.keys.a);
    this.direction.normalize(); // Previne movimento diagonal mais rápido

    // 2. Determinar a velocidade atual
    const currentSpeed = this.keys.shift ? this.sprintSpeed : this.moveSpeed;

    // 3. Calcular a velocidade alvo nos eixos X e Z
    // A mágica acontece aqui: aplicamos a rotação da câmera (yaw) à direção do input
    // para obter o vetor de movimento no espaço do MUNDO.
    const moveX = this.direction.x * Math.cos(this.yaw) + this.direction.z * Math.sin(this.yaw);
    const moveZ = this.direction.z * Math.cos(this.yaw) - this.direction.x * Math.sin(this.yaw);
    
    this.targetVelocity.x = moveX * currentSpeed;
    this.targetVelocity.z = moveZ * currentSpeed;

    // 4. Interpolar suavemente a velocidade atual para a velocidade alvo (aceleração)
    this.velocity.x += (this.targetVelocity.x - this.velocity.x) * this.acceleration;
    this.velocity.z += (this.targetVelocity.z - this.velocity.z) * this.acceleration;

    // 5. Aplicar atrito para desacelerar suavemente
    this.velocity.x *= this.friction;
    this.velocity.z *= this.friction;

    // 6. Lidar com movimento vertical (pulo e gravidade)
    if (this.keys.space && this.isOnGround) {
      this.verticalVelocity = this.jumpForce;
      this.isOnGround = false;
    }
    if (!this.isOnGround) {
      this.verticalVelocity -= this.gravity;
    }

    // 7. Construir o vetor de movimento final
    const finalMovement = new THREE.Vector3(
      this.velocity.x,
      this.verticalVelocity,
      this.velocity.z
    );

    // 8. Verificar colisão e atualizar a posição
    // (A lógica de colisão foi simplificada para clareza, pode ser expandida)
    const newPosition = this.walkCamera.position.clone().add(finalMovement);
    
    // Por enquanto, vamos aplicar o movimento diretamente para testar a direção
    this.walkCamera.position.copy(newPosition);

    // Uma verificação de chão simples para pular
    if (this.walkCamera.position.y < 2.0) {
        this.walkCamera.position.y = 2.0;
        this.isOnGround = true;
        this.verticalVelocity = 0;
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

  animate() {
    if (!this.isActive) return;

    // Atualizar movimento e física
    this.updateMovement();

    // Continuar animação no próximo frame
    requestAnimationFrame(this.animate);
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

  // Encontrar objeto da sala pelo mesh clicado
  findRoomObjectByMesh(mesh) {
    if (!this.roomModeSystem || !this.roomModeSystem.roomObjects) return null;
    
    for (const roomObject of this.roomModeSystem.roomObjects) {
      if (roomObject.meshGroup) {
        let found = false;
        roomObject.meshGroup.traverse((child) => {
          if (child === mesh) {
            found = true;
          }
        });
        if (found) return roomObject;
      }
    }
    return null;
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
      2: 'light'
    };
    return itemTypes[slotIndex] || null;
  }

  getDefaultItemName(slotIndex) {
    const itemNames = {
      0: 'Janela',
      1: 'Porta',
      2: 'Luz'
    };
    return itemNames[slotIndex] || 'Item Desconhecido';
  }

  getDefaultItemIcon(slotIndex) {
    const itemIcons = {
      0: '🪟',
      1: '🚪',
      2: '💡'
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


    // Fazer raycast para encontrar onde o usuário clicou
    const intersection = this.performWallRaycast();
    
    if (intersection) {
      this.placeItemAtIntersection(intersection);
    } else {
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
    // Desselecionar porta anterior se houver
    this.deselectDoor();
    
    // Selecionar nova porta
    this.selectedDoor = doorId;
    this.createDoorOutline(doorId);
    this.showDoorEditingUI();
  }

  deselectDoor() {
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

  // Detectar clique em porta para seleção
  detectDoorClick(intersectedMesh) {
    
    if (!window.doorControls) {
      console.error('❌ doorControls não disponível');
      return false;
    }

    const doors = window.doorControls.list();
    
    for (const door of doors) {
      
      let doorFound = false;
      let foundDoorId = null;
      
      // MÉTODO 1: Verificar userData.doorId no mesh
      if (intersectedMesh.userData && intersectedMesh.userData.doorId === door.id) {
        doorFound = true;
        foundDoorId = door.id;
      }
      
      // MÉTODO 2: Verificar userData.id no mesh
      if (!doorFound && intersectedMesh.userData && intersectedMesh.userData.id === door.id) {
        doorFound = true;
        foundDoorId = door.id;
      }
      
      // MÉTODO 3: Verificar se o mesh é filho de um grupo com doorId
      if (!doorFound) {
        let currentObject = intersectedMesh;
        let depth = 0;
        while (currentObject.parent && depth < 10) { // Limite de profundidade
          currentObject = currentObject.parent;
          depth++;
          if (currentObject.userData) {
            if (currentObject.userData.doorId === door.id || currentObject.userData.id === door.id) {
              doorFound = true;
              foundDoorId = door.id;
              break;
            }
          }
        }
      }
      
      // MÉTODO 4: Verificar por nome do mesh
      if (!doorFound && intersectedMesh.name && intersectedMesh.name.includes(door.id)) {
        doorFound = true;
        foundDoorId = door.id;
      }
      
      // Se encontrou a porta, verificar se é duplo clique
      if (doorFound) {
        const currentTime = Date.now();
        const timeSinceLastClick = currentTime - this.lastClickTime;
        const isSameDoor = this.lastClickedDoor === foundDoorId;
        const isDoubleClick = timeSinceLastClick < this.doubleClickDelay && isSameDoor;
        
        
        if (isDoubleClick) {
          // Duplo clique - abrir/fechar porta
          this.toggleDoor(foundDoorId);
          // Reset completo para evitar problemas
          this.lastClickTime = 0;
          this.lastClickedDoor = null;
        } else {
          // Clique simples - selecionar para edição
          this.selectDoorForEditing(foundDoorId);
          // Armazenar dados para próximo clique
          this.lastClickTime = currentTime;
          this.lastClickedDoor = foundDoorId;
        }
        return true;
      }
      
      // MÉTODO 3: Buscar por posição próxima (mais tolerante)
      const meshWorldPos = new THREE.Vector3();
      intersectedMesh.getWorldPosition(meshWorldPos);
      const doorPos = this.getDoorWorldPosition(door);
      
      if (doorPos) {
        const distance = meshWorldPos.distanceTo(doorPos);
        
        if (distance < 2.0) { // Aumentar tolerância
          this.selectDoorForEditing(door.id);
          return true;
        }
      }
      
      // MÉTODO 4: Verificar por nome do mesh (se contém o ID da porta)
      if (intersectedMesh.name && intersectedMesh.name.includes(door.id)) {
        this.selectDoorForEditing(door.id);
        return true;
      }
    }
    
    
    // FALLBACK: Tentar detectar qualquer porta próxima baseado apenas na posição
    const meshWorldPos = new THREE.Vector3();
    intersectedMesh.getWorldPosition(meshWorldPos);
    
    for (const door of doors) {
      const doorPos = this.getDoorWorldPosition(door);
      if (doorPos) {
        const distance = meshWorldPos.distanceTo(doorPos);
        
        if (distance < 3.0) { // Tolerância ainda maior
          
          const currentTime = Date.now();
          const timeSinceLastClick = currentTime - this.lastClickTime;
          const isSameDoor = this.lastClickedDoor === door.id;
          const isDoubleClick = timeSinceLastClick < this.doubleClickDelay && isSameDoor;
          
          if (isDoubleClick) {
            this.toggleDoor(door.id);
            this.lastClickTime = 0;
            this.lastClickedDoor = null;
          } else {
            this.selectDoorForEditing(door.id);
            this.lastClickTime = currentTime;
            this.lastClickedDoor = door.id;
          }
          return true;
        }
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
    this.removeDoorOutline();

    if (!window.doorWindowSystem?.doors?.has(doorId)) return;

    const doorData = window.doorWindowSystem.doors.get(doorId);
    if (!doorData.group) return;

    // Criar outline roxo ao redor da porta
    this.doorOutlineMesh = new THREE.BoxHelper(doorData.group, 0x8A2BE2); // Cor roxa
    this.doorOutlineMesh.material.linewidth = 4;
    this.doorOutlineMesh.material.transparent = true;
    this.doorOutlineMesh.material.opacity = 0.8;
    this.scene.add(this.doorOutlineMesh);

  }

  removeDoorOutline() {
    if (this.doorOutlineMesh) {
      this.scene.remove(this.doorOutlineMesh);
      this.doorOutlineMesh = null;
    }
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
   * Corrigir materiais das portas para garantir que não fiquem transparentes
   */
  fixDoorMaterials() {
    
    let portasCorrigidas = 0;
    
    // Método 1: Verificar portas do sistema doorWindowSystem
    if (window.doorWindowSystem && window.doorWindowSystem.doors) {
      for (const [id, door] of window.doorWindowSystem.doors) {
        if (door.leaf) {
          this.forceOpaqueMaterial(door.leaf, `Folha da porta '${id}'`);
          portasCorrigidas++;
        }
        
        if (door.frame) {
          door.frame.traverse((child) => {
            if (child.isMesh) {
              this.forceOpaqueMaterial(child, `Batente da porta '${id}'`);
            }
          });
        }
        
        if (door.group) {
          door.group.traverse((child) => {
            if (child.isMesh) {
              this.forceOpaqueMaterial(child, `Grupo da porta '${id}'`);
            }
          });
        }
      }
    }
    
    // Método 2: Busca AGRESSIVA na cena inteira
    this.scene.traverse((object) => {
      if (object.isMesh && object.material) {
        // Verificar se é porta por userData
        if (object.userData && (object.userData.isDoor || object.userData.doorId)) {
          this.forceOpaqueMaterial(object, `Porta na cena: ${object.userData.doorId || 'sem ID'}`);
          portasCorrigidas++;
        }
        
        // Verificar se parece ser uma porta (cor marrom típica de madeira)
        if (object.material.color && object.material.color.getHex() === 0x654321) {
          this.forceOpaqueMaterial(object, 'Material cor de madeira (possível porta)');
          portasCorrigidas++;
        }
      }
    });
    
    
    // Executar novamente após um delay para garantir
    setTimeout(() => {
      this.forceAllDoorOpacity();
    }, 1000);
  }
  
  /**
   * Forçar material completamente opaco
   */
  forceOpaqueMaterial(object, description) {
    if (!object || !object.material) return;
    
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    
    materials.forEach((material, index) => {
      if (material) {
        const wasTransparent = material.transparent || material.opacity < 1.0;
        
        // FORÇA BRUTA - garantir opacidade total
        material.transparent = false;
        material.opacity = 1.0;
        material.alphaTest = 0;
        material.alphaMap = null;
        material.side = THREE.DoubleSide;
        material.needsUpdate = true;
        
        // Forçar render do material
        material.version++;
        
        if (wasTransparent) {
        }
      }
    });
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
   * Monitoramento contínuo da opacidade das portas
   */
  startOpacityMonitoring() {
    if (this.opacityMonitor) {
      clearInterval(this.opacityMonitor);
    }
    
    this.opacityMonitor = setInterval(() => {
      if (this.isActive) {
        this.quickOpacityCheck();
      }
    }, 2000); // Verificar a cada 2 segundos
  }
  
  /**
   * Parar monitoramento de opacidade
   */
  stopOpacityMonitoring() {
    if (this.opacityMonitor) {
      clearInterval(this.opacityMonitor);
      this.opacityMonitor = null;
    }
  }
  
  /**
   * Verificação rápida de opacidade
   */
  quickOpacityCheck() {
    if (window.doorWindowSystem && window.doorWindowSystem.doors) {
      for (const [id, door] of window.doorWindowSystem.doors) {
        [door.leaf, door.frame, door.group].forEach(component => {
          if (component) {
            component.traverse((child) => {
              if (child.isMesh && child.material) {
                const materials = Array.isArray(child.material) ? child.material : [child.material];
                materials.forEach(material => {
                  if (material && (material.transparent || material.opacity < 1.0)) {
                    this.forceOpaqueMaterial(child, `Porta ${id} (monitoramento)`);
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
   * Abrir/fechar porta (integração com doorWindowSystem)
   */
  toggleDoor(doorId) {
    if (!window.doorControls) {
      console.error('❌ Sistema doorControls não disponível');
      return;
    }
    
    
    try {
      const doorsBefore = window.doorControls.list();
      const targetDoor = doorsBefore.find(d => d.id === doorId);
      
      if (!targetDoor) {
        console.error(`❌ Porta '${doorId}' não encontrada na lista`);
        return;
      }
      
      
      const success = window.doorControls.toggle(doorId);
      
      if (success) {
        const doorsAfter = window.doorControls.list();
        const updatedDoor = doorsAfter.find(d => d.id === doorId);
        
        // Atualizar painel se estiver visível
        if (typeof this.refreshWalkModePanel === 'function') {
          this.refreshWalkModePanel();
        } else {
          console.warn('⚠️ refreshWalkModePanel não encontrado, usando refreshDoorsPanel');
          this.refreshDoorsPanel();
        }
      } else {
        console.error(`❌ Falha ao alterar estado da porta '${doorId}'`);
      }
    } catch (error) {
      console.error('❌ Erro ao executar toggle:', error);
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
}
