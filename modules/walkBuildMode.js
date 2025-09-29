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
// - Sistema de colisão básica com paredes e chão
//
// DEPENDÊNCIAS:
// - Three.js (para câmera e raycasting)
// - Sistema de voxels do editor
//
// USO:
// 1. Importar: import { WalkBuildModeSystem } from './modules/walkBuildMode.js'
// 2. Criar instância: const walkSystem = new WalkBuildModeSystem(scene, camera, controls, roomModeSystem)
// 3. Ativar: walkSystem.enterWalkMode()
// 4. Desativar: walkSystem.exitWalkMode()
//
// =====================================================================

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
    this.moveSpeed = 0.32; // Velocidade base mais rápida
    this.sprintSpeed = 0.48; // Velocidade de corrida mais rápida
    this.mouseSensitivity = 0.0025; // Sensibilidade do mouse mais suave
    this.friction = 0.85; // Atrito para desaceleração suave
    this.acceleration = 0.05; // Aceleração mais rápida

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

    // Sistema de seleção e movimentação de objetos
    this.selectedObject = null;
    this.isDraggingObject = false;
    this.dragStartPosition = new THREE.Vector3();
    this.dragOffset = new THREE.Vector3();
    this.objectOutline = null;

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

    console.log('🚶 Entrando no modo caminhada estilo Minecraft');

    this.isActive = true;

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
    document.body.requestPointerLock();

    // Iniciar loop de animação
    this.animate();

    // Notificar mudança de estado
    if (this.onStateChange) {
      this.onStateChange(true);
    }

    console.log('✅ Modo caminhada ativado - Controles estilo Minecraft: WASD mover, Shift correr, Espaço pular, Ctrl agachar, mouse olhar');
    console.log('🎮 Controles do numpad: 8=cima, 2=baixo, 4=esquerda, 6=direita, 5=reset, 7/9/1/3=diagonais');
  }

  preventContextMenu(event) {
    if (this.isActive) {
      event.preventDefault();
    }
  }

  exitWalkMode() {
    if (!this.isActive) return;

    console.log('🚪 Saindo do modo caminhada estilo Minecraft');

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

    // Remover event listeners
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('click', this.onMouseClick);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    document.removeEventListener('contextmenu', this.preventContextMenu);

    // Liberar ponteiro se estiver bloqueado
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }

    // Notificar mudança de estado
    if (this.onStateChange) {
      this.onStateChange(false);
    }

    console.log('✅ Modo caminhada desativado - retornando aos controles normais');
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
      case 'Escape':
        this.exitWalkMode();
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

    // Se estiver arrastando um objeto, mover o objeto
    if (this.isDraggingObject && this.selectedObject) {
      this.moveSelectedObject(movementX, movementY);
      return;
    }

    // Caso contrário, mover a câmera normalmente
    // Aplicar sensibilidade do mouse
    const sensitivity = this.mouseSensitivity;
    this.yaw -= movementX * sensitivity;
    this.pitch -= movementY * sensitivity;

    // Limitar rotação vertical para evitar giros completos (~89 graus)
    const maxVerticalAngle = Math.PI / 2 - 0.01;
    this.pitch = Math.max(-maxVerticalAngle, Math.min(maxVerticalAngle, this.pitch));

    // Aplicar rotações à câmera usando a ordem 'YXZ' que é ideal para FPS
    // Isso evita o "gimbal lock" e garante que o movimento seja sempre previsível
    this.walkCamera.rotation.order = 'YXZ';
    this.walkCamera.rotation.set(this.pitch, this.yaw, 0);
  }

  onMouseClick(event) {
    if (!this.isActive || !this.isPointerLocked) return;

    event.preventDefault();

    // Atualizar raycaster
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.walkCamera);

    // Primeiro verificar se clicou em um objeto da sala
    const roomObjects = this.getRoomObjects();
    const roomIntersects = this.raycaster.intersectObjects(roomObjects, true);

    if (roomIntersects.length > 0 && event.button === 0) {
      // Clique esquerdo em objeto da sala - selecionar
      const intersectedMesh = roomIntersects[0].object;
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
      console.log('🔒 Ponteiro bloqueado - modo caminhada ativo');
    } else {
      console.log('🔓 Ponteiro liberado');
    }
  }

  // Método para ajustar visão para direções cardinais (numpad)
  snapToDirection(horizontalAngle, verticalAngle) {
    // Usar o novo sistema de yaw e pitch
    this.yaw = horizontalAngle;
    this.pitch = verticalAngle;

    // Aplicar rotações à câmera
    this.walkCamera.rotation.set(this.pitch, this.yaw, 0);

    console.log(`📍 Visão ajustada: Yaw=${(this.yaw * 180/Math.PI).toFixed(0)}°, Pitch=${(this.pitch * 180/Math.PI).toFixed(0)}°`);
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
      if (this.roomModeSystem.roomFloor) objects.push(this.roomModeSystem.roomFloor);
      objects.push(...this.roomModeSystem.roomWalls);
    }

    return objects;
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
      console.log(`✅ Voxel colocado em (${gridX}, ${gridY}, ${gridZ}) usando função do editor`);
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
        console.log('🗑️ Voxel removido usando função do editor');
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
    console.log('🎮 Criando botão do modo caminhada...');

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
      console.log('🎮 Botão modo caminhada clicado');
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
    console.log('✅ Botão do modo caminhada criado e adicionado ao container');

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
    
    console.log(`🎯 Objeto selecionado: ${roomObject.name}`);
    console.log('💡 Pressione G para ativar modo de arrastar com o mouse');
  }

  // Desselecionar objeto
  deselectRoomObject() {
    if (this.selectedObject) {
      console.log(`❌ Objeto desselecionado: ${this.selectedObject.name}`);
      this.selectedObject = null;
    }
    
    if (this.isDraggingObject) {
      this.isDraggingObject = false;
      console.log('🛑 Modo de arrastar desativado');
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
      console.log('🖱️ Modo de arrastar ativado - mova o mouse para arrastar o objeto');
      console.log('💡 Pressione G novamente para desativar');
      
      // Salvar posição inicial
      this.dragStartPosition.copy(this.selectedObject.meshGroup.position);
    } else {
      console.log('🛑 Modo de arrastar desativado');
    }
  }

  // Mover objeto selecionado com movimento do mouse
  moveSelectedObject(movementX, movementY) {
    if (!this.selectedObject || !this.selectedObject.meshGroup) return;

    // Converter movimento do mouse em movimento 3D baseado na direção da câmera
    const moveSpeed = 0.01; // Velocidade de movimento
    
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
      console.log(`📍 Movendo ${this.selectedObject.name} para (${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`);
    }
  }
}