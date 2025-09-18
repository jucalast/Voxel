// =====================================================================
// MÓDULO ROOM MODE SYSTEM
// =====================================================================
//
// Este módulo implementa o sistema de "Modo Sala Ambiente" para o editor voxel.
// Permite carregar objetos voxel exportados e posicioná-los em um ambiente 3D.
//
// FUNCIONALIDADES:
// - Carregamento de arquivos .html e .json exportados do editor
// - Posicionamento e transformação de objetos (posição, rotação, escala)
// - Interface visual para gerenciar objetos na sala
// - Geometria da sala (chão e paredes)
// - Sistema de gizmos para manipulação visual
// - Salvamento e carregamento de configurações da sala
//
// USO:
// 1. Importar o módulo: import { RoomModeSystem } from './modules/roomMode.js'
// 2. Criar instância: const roomSystem = new RoomModeSystem(scene, camera, controls, updateCursor)
// 3. Configurar variáveis: roomSystem.setEditorVars(distance, angleX, angleY)
// 4. O sistema inicializa automaticamente os event listeners
//
// DEPENDÊNCIAS:
// - Three.js (para renderização 3D)
// - Elementos DOM específicos (roomModeBtn, room-panel, etc.)
//
// ARQUITETURA:
// - Classe principal: RoomModeSystem
// - Classe auxiliar: RoomObject (para gerenciar objetos individuais)
// - Métodos principais: toggleRoomMode(), loadRoomObject(), saveRoom()
//
// =====================================================================

// =====================================================================
// SISTEMA DE MODO SALA AMBIENTE
// =====================================================================

export class RoomModeSystem {
  constructor(scene, camera, controls, updateCursor, renderer = null) {
    this.scene = scene;
    this.camera = camera;
    this.controls = controls;
    this.updateCursor = updateCursor;
    this.renderer = renderer;

    this.isRoomMode = false;
    this.roomObjects = [];
    this.selectedRoomObject = null;
    this.transformGizmo = null;
    this.roomFloor = null;
    this.roomWalls = [];

    // Propriedades para movimento
    this.isWalkingMode = false;
    this.moveSpeed = 0.15; // Velocidade mais realista para caminhar
    this.mouseSensitivity = 0.002;
    this.keys = {};
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.PI_2 = Math.PI / 2;
    this.minPolarAngle = 0;
    this.maxPolarAngle = Math.PI;
    this.walkModeBtn = null;

    // Elementos DOM do modo sala
    this.roomModeBtn = document.getElementById('roomModeBtn');
    this.roomPanel = document.getElementById('room-panel');
    this.roomLoadInput = document.getElementById('roomLoadInput');
    this.roomLoadBtn = document.getElementById('roomLoadBtn');
    this.roomObjectsList = document.getElementById('roomObjectsList');
    this.roomBackBtn = document.getElementById('roomBackBtn');
    this.roomSaveBtn = document.getElementById('roomSaveBtn');
    this.roomClearBtn = document.getElementById('roomClearBtn');
    this.roomWalkBtn = document.getElementById('roomWalkBtn');
    console.log('🚶 Botão caminhar encontrado:', !!this.roomWalkBtn);

    // Referências para elementos do editor
    this.leftPanel = document.getElementById('left-panel');

    // Variáveis do editor (serão passadas quando inicializar)
    this.distance = null;
    this.angleX = null;
    this.angleY = null;

    this.init();
  }

  init() {
    // Event listeners para o modo sala
    this.roomModeBtn.addEventListener('click', () => this.toggleRoomMode());
    this.roomBackBtn.addEventListener('click', () => this.toggleRoomMode());
    this.roomWalkBtn.addEventListener('click', () => {
      this.toggleWalkingMode();
    });
    this.roomLoadBtn.addEventListener('click', () => this.roomLoadInput.click());
    this.roomLoadInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        this.loadRoomObject(file);
      }
    });
    this.roomClearBtn.addEventListener('click', () => {
      if (confirm('Remover todos os objetos da sala?')) {
        this.clearRoomObjects();
      }
    });

    this.roomSaveBtn.addEventListener('click', () => this.saveRoom());

    // Inicializar controles de movimento
    this.initMovementControls();
  }

  // Inicializar controles de movimento
  initMovementControls() {
    // Event listeners para teclado
    document.addEventListener('keydown', (e) => this.onKeyDown(e));
    document.addEventListener('keyup', (e) => this.onKeyUp(e));

    // Event listeners para mouse
    document.addEventListener('mousedown', (e) => this.onMouseDown(e));
    document.addEventListener('mouseup', (e) => this.onMouseUp(e));
    document.addEventListener('mousemove', (e) => this.onMouseMove(e));

    // Prevenir contexto menu do botão direito
    document.addEventListener('contextmenu', (e) => {
      if (this.isWalkingMode) {
        e.preventDefault();
      }
    });

    // Pointer lock para mouse look
    document.addEventListener('pointerlockchange', () => this.onPointerLockChange());
    document.addEventListener('pointerlockerror', () => this.onPointerLockError());
  }

  // Métodos de controle de movimento
  onKeyDown(event) {
    if (!this.isWalkingMode) return;

    this.keys[event.code] = true;

    // ESC para sair do modo caminhar
    if (event.code === 'Escape') {
      this.exitWalkingMode();
      event.preventDefault();
      return;
    }

    // Prevenir comportamento padrão para teclas de movimento
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft'].includes(event.code)) {
      event.preventDefault();
    }
  }

  onKeyUp(event) {
    this.keys[event.code] = false;
  }

  onMouseDown(event) {
    if (!this.isRoomMode) return;

    // Botão direito do mouse para ativar/desativar modo caminhar
    if (event.button === 2) {
      event.preventDefault();
      this.toggleWalkingMode();
    }
  }

  onMouseUp(event) {
    // Implementação futura se necessário
  }

  onMouseMove(event) {
    if (!this.isWalkingMode) return;

    // Usar movimento relativo do mouse para rotação (sem pointer lock)
    const movementX = event.movementX || 0;
    const movementY = event.movementY || 0;

    // Aplicar sensibilidade do mouse
    const deltaX = movementX * this.mouseSensitivity;
    const deltaY = movementY * this.mouseSensitivity;

    this.euler.setFromQuaternion(this.camera.quaternion);

    // Atualizar rotação horizontal (yaw)
    this.euler.y -= deltaX;

    // Atualizar rotação vertical (pitch) com limites
    this.euler.x -= deltaY;
    this.euler.x = Math.max(-this.PI_2 + 0.1, Math.min(this.PI_2 - 0.1, this.euler.x));

    this.camera.quaternion.setFromEuler(this.euler);
  }

  onPointerLockChange() {
    const wasLocked = this.isPointerLocked();

    if (wasLocked && !this.isWalkingMode) {
      // Pointer lock foi ativado, entrar no modo caminhar
      this.isWalkingMode = true;
      this.updateWalkingModeUI();
      console.log('🚶 Modo caminhar ativado via pointer lock');
    } else if (!wasLocked && this.isWalkingMode) {
      // Pointer lock foi desativado, sair do modo caminhar
      this.isWalkingMode = false;
      this.updateWalkingModeUI();
      console.log('🚶 Modo caminhar desativado via pointer lock');
    }
  }

  onPointerLockError() {
    console.warn('Erro ao ativar pointer lock para modo caminhar');
    this.isWalkingMode = false;
    this.updateWalkingModeUI();
  }

  isPointerLocked() {
    return document.pointerLockElement === document.body ||
           (this.renderer && document.pointerLockElement === this.renderer.domElement);
  }

  toggleWalkingMode() {
    if (this.isWalkingMode) {
      this.exitWalkingMode();
    } else {
      this.enterWalkingMode();
    }
  }

  enterWalkingMode() {
    if (!this.isRoomMode) {
      console.warn('❌ Não é possível ativar modo caminhar fora do modo sala');
      return;
    }

    // Salvar posição atual dos controles
    this.savedControlsPosition = {
      x: this.controls.target.x,
      y: this.controls.target.y,
      z: this.controls.target.z
    };

    // Salvar posição e rotação da câmera
    this.savedCameraPosition = this.camera.position.clone();
    this.savedCameraQuaternion = this.camera.quaternion.clone();

    // Salvar FOV atual da câmera
    this.savedCameraFov = this.camera.fov;

    // Desabilitar controles orbitais
    this.controls.enabled = false;

    // Posicionar câmera dentro da sala com altura de 2 blocos
    this.camera.position.set(0, 2, 0); // Centro da sala, altura de 2 blocos
    this.camera.lookAt(0, 2, -5); // Olhando para frente (parede frontal)

    // Ajustar FOV para visão em primeira pessoa mais imersiva
    this.camera.fov = 75;
    this.camera.updateProjectionMatrix();

    // Resetar rotação do mouse
    this.euler.set(0, 0, 0, 'YXZ');

    // Modo caminhar ativado
    this.isWalkingMode = true;
    this.updateWalkingModeUI();

    // Focar no canvas para capturar eventos de teclado
    if (this.renderer && this.renderer.domElement) {
      this.renderer.domElement.focus();
    }
  }

  exitWalkingMode() {
    // Liberar pointer lock
    if (this.isPointerLocked()) {
      document.exitPointerLock();
    }

    // Reabilitar controles orbitais
    this.controls.enabled = true;

    // Restaurar posição dos controles se necessário
    if (this.savedControlsPosition) {
      this.controls.target.copy(this.savedControlsPosition);
    }

    // Restaurar posição e rotação da câmera
    if (this.savedCameraPosition) {
      this.camera.position.copy(this.savedCameraPosition);
    }
    if (this.savedCameraQuaternion) {
      this.camera.quaternion.copy(this.savedCameraQuaternion);
    }

    // Restaurar FOV da câmera
    if (this.savedCameraFov) {
      this.camera.fov = this.savedCameraFov;
      this.camera.updateProjectionMatrix();
    }

    this.isWalkingMode = false;
    this.updateWalkingModeUI();
  }

  updateWalkingModeUI() {
    // Atualizar cursor
    if (this.isWalkingMode) {
      document.body.style.cursor = 'none'; // Esconder cursor padrão
      this.showWalkingCursor();
    } else {
      document.body.style.cursor = '';
      this.hideWalkingCursor();
    }

    // Atualizar indicador visual
    this.updateWalkingIndicator();
  }

  showWalkingCursor() {
    let cursor = document.getElementById('walking-cursor');
    if (!cursor) {
      cursor = document.createElement('div');
      cursor.id = 'walking-cursor';
      cursor.style.cssText = `
        position: fixed;
        width: 20px;
        height: 20px;
        background: radial-gradient(circle, rgba(16, 185, 129, 0.8) 0%, rgba(16, 185, 129, 0.4) 50%, transparent 70%);
        border: 2px solid #10b981;
        border-radius: 50%;
        pointer-events: none;
        z-index: 9999;
        transform: translate(-50%, -50%);
        transition: all 0.1s ease-out;
        box-shadow: 0 0 10px rgba(16, 185, 129, 0.3);
      `;
      document.body.appendChild(cursor);
    }

    // Atualizar posição do cursor customizado
    const updateCursorPosition = (e) => {
      if (this.isWalkingMode && cursor) {
        cursor.style.left = e.clientX + 'px';
        cursor.style.top = e.clientY + 'px';
      }
    };

    document.addEventListener('mousemove', updateCursorPosition);
    this.cursorUpdateHandler = updateCursorPosition;

    cursor.style.display = 'block';
  }

  hideWalkingCursor() {
    const cursor = document.getElementById('walking-cursor');
    if (cursor) {
      cursor.style.display = 'none';
    }

    if (this.cursorUpdateHandler) {
      document.removeEventListener('mousemove', this.cursorUpdateHandler);
      this.cursorUpdateHandler = null;
    }
  }

  updateWalkingIndicator() {
    // Implementar indicador visual do modo caminhar
    let indicator = document.getElementById('walking-mode-indicator');

    if (this.isWalkingMode) {
      if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'walking-mode-indicator';
        indicator.innerHTML = `
          <div style="
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, rgba(26, 26, 26, 0.95), rgba(42, 42, 42, 0.95));
            backdrop-filter: blur(15px);
            border: 2px solid rgba(124, 58, 237, 0.6);
            border-radius: 16px;
            padding: 16px 24px;
            color: #ffffff;
            font-size: 14px;
            font-weight: 500;
            z-index: 1000;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1);
            text-align: center;
            animation: fadeInUp 0.3s ease-out;
            max-width: 400px;
          ">
            <div style="margin-bottom: 12px; display: flex; align-items: center; justify-content: center; gap: 8px;">
              <div style="width: 8px; height: 8px; background: #10b981; border-radius: 50%; animation: pulse 2s infinite;"></div>
              <span style="font-size: 16px; font-weight: 600; color: #10b981;">🚶 Modo Caminhar Ativo</span>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
              <div style="background: rgba(255, 255, 255, 0.05); padding: 8px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1);">
                <div style="font-size: 11px; color: #fbbf24; margin-bottom: 4px;">MOVIMENTO</div>
                <div style="font-size: 10px; color: #d1d5db;">WASD ou ↑↓←→</div>
              </div>
              <div style="background: rgba(255, 255, 255, 0.05); padding: 8px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1);">
                <div style="font-size: 11px; color: #06b6d4; margin-bottom: 4px;">VISÃO</div>
                <div style="font-size: 10px; color: #d1d5db;">Mouse para olhar</div>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 12px;">
              <div style="background: rgba(255, 255, 255, 0.05); padding: 6px; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.1);">
                <div style="font-size: 9px; color: #10b981;">SUBIR</div>
                <div style="font-size: 10px; color: #d1d5db; font-weight: 600;">ESPAÇO</div>
              </div>
              <div style="background: rgba(255, 255, 255, 0.05); padding: 6px; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.1);">
                <div style="font-size: 9px; color: #ef4444;">DESCER</div>
                <div style="font-size: 10px; color: #d1d5db; font-weight: 600;">SHIFT</div>
              </div>
              <div style="background: rgba(255, 255, 255, 0.05); padding: 6px; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.1);">
                <div style="font-size: 9px; color: #f59e0b;">SAIR</div>
                <div style="font-size: 10px; color: #d1d5db; font-weight: 600;">ESC</div>
              </div>
            </div>

            <div style="font-size: 11px; opacity: 0.7; border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 8px;">
              Altura: 2 blocos • Colisão ativa • Dentro da sala
            </div>
          </div>

          <style>
            @keyframes fadeInUp {
              from {
                opacity: 0;
                transform: translateX(-50%) translateY(-10px);
              }
              to {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
              }
            }

            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.5; }
            }
          </style>
        `;
        document.body.appendChild(indicator);
      }
      // Garantir que o indicador esteja visível
      if (indicator) {
        indicator.style.display = 'block';
      }
    } else {
      if (indicator) {
        indicator.style.display = 'none';
      }
    }
  }

  updateMovement() {
    if (!this.isWalkingMode) return;

    const direction = new THREE.Vector3();
    const right = new THREE.Vector3();
    const forward = new THREE.Vector3();

    // Obter direções baseadas na rotação da câmera
    this.camera.getWorldDirection(forward);
    forward.y = 0; // Manter movimento no plano horizontal
    forward.normalize();

    right.crossVectors(forward, this.camera.up).normalize();

    // Calcular movimento baseado nas teclas pressionadas
    if (this.keys['KeyW'] || this.keys['ArrowUp']) {
      direction.add(forward);
    }
    if (this.keys['KeyS'] || this.keys['ArrowDown']) {
      direction.sub(forward);
    }
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) {
      direction.sub(right);
    }
    if (this.keys['KeyD'] || this.keys['ArrowRight']) {
      direction.add(right);
    }

    // Movimento vertical
    if (this.keys['Space']) {
      direction.y += 1;
    }
    if (this.keys['ShiftLeft']) {
      direction.y -= 1;
    }

    // Aplicar movimento se houver direção
    if (direction.length() > 0) {
      direction.normalize();
      direction.multiplyScalar(this.moveSpeed);

      // Verificar colisões antes de mover
      const newPosition = this.camera.position.clone().add(direction);
      if (this.checkCollision(newPosition)) {
        this.camera.position.copy(newPosition);
      }
    }
  }

  checkCollision(position) {
    // Limites da sala (considerando paredes de 0.2 de espessura)
    const roomSize = 9.8; // 10 - 0.2 (parede tem 0.2 de espessura)
    const wallThickness = 0.2;

    // Altura do jogador (de 1.8 a 2.2 unidades)
    const playerHeight = 2.0;
    const playerBottom = position.y - 0.9; // Base do jogador
    const playerTop = position.y + 0.1; // Topo do jogador

    // Verificar colisão com paredes (considerando altura)
    if (Math.abs(position.x) > roomSize ||
        Math.abs(position.z) > roomSize) {
      return false; // Colisão detectada com parede
    }

    // Verificar se o jogador está no chão (não pode passar através do chão)
    if (playerBottom < 0) {
      return false; // Colisão com o chão
    }

    // Verificar se o jogador está no teto (não pode passar através do teto)
    if (playerTop > 10) {
      return false; // Colisão com o teto
    }

    // Verificar colisão com objetos (considerando altura do jogador)
    for (const obj of this.roomObjects) {
      const objBox = new THREE.Box3().setFromObject(obj.meshGroup);

      // Criar bounding box do jogador considerando sua altura
      const playerBox = new THREE.Box3(
        new THREE.Vector3(position.x - 0.4, playerBottom, position.z - 0.4),
        new THREE.Vector3(position.x + 0.4, playerTop, position.z + 0.4)
      );

      if (objBox.intersectsBox(playerBox)) {
        return false; // Colisão com objeto
      }
    }

    return true; // Sem colisão
  }

  // Configurar variáveis do editor
  setEditorVars(distance, angleX, angleY) {
    this.distance = distance;
    this.angleX = angleX;
    this.angleY = angleY;
  }

  // Classe para objetos da sala
  RoomObject = class {
    constructor(id, name, voxelData, meshGroup) {
      this.id = id;
      this.name = name;
      this.voxelData = voxelData;
      this.meshGroup = meshGroup;
      this.position = { x: 0, y: 0, z: 0 };
      this.rotation = { x: 0, y: 0, z: 0 };
      this.scale = { x: 1, y: 1, z: 1 };
      this.selected = false;
    }

    updateTransform() {
      this.meshGroup.position.set(this.position.x, this.position.y, this.position.z);
      this.meshGroup.rotation.set(
        this.rotation.x * Math.PI / 180,
        this.rotation.y * Math.PI / 180,
        this.rotation.z * Math.PI / 180
      );
      this.meshGroup.scale.set(this.scale.x, this.scale.y, this.scale.z);
    }

    setSelected(selected) {
      this.selected = selected;
      if (selected) {
        this.showGizmo();
      } else {
        this.hideGizmo();
      }
    }

    showGizmo() {
      if (!this.transformGizmo) {
        this.transformGizmo = this.createTransformGizmo();
        this.scene.add(this.transformGizmo);
      }
      this.transformGizmo.position.copy(this.meshGroup.position);
      this.transformGizmo.visible = true;
    }

    hideGizmo() {
      if (this.transformGizmo) {
        this.transformGizmo.visible = false;
      }
    }

    // Criar gizmo de transformação com melhor visibilidade
    createTransformGizmo() {
      const gizmo = new THREE.Group();

      // Eixos X, Y, Z com materiais mais visíveis
      const xAxis = this.createAxis(0xff6666, new THREE.Vector3(1, 0, 0), 0.08, 2.5);
      const yAxis = this.createAxis(0x66ff66, new THREE.Vector3(0, 1, 0), 0.08, 2.5);
      const zAxis = this.createAxis(0x6666ff, new THREE.Vector3(0, 0, 1), 0.08, 2.5);

      gizmo.add(xAxis, yAxis, zAxis);
      gizmo.visible = false;

      return gizmo;
    }

    createAxis(color, direction, radius = 0.08, length = 2.5) {
      const axis = new THREE.Group();

      // Linha do eixo com material emissivo
      const geometry = new THREE.CylinderGeometry(radius, radius, length);
      const material = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 0.3,
        transparent: false
      });
      const line = new THREE.Mesh(geometry, material);
      line.position.copy(direction).multiplyScalar(length / 2);
      line.lookAt(direction);
      axis.add(line);

      // Ponta da seta maior e mais visível
      const coneGeometry = new THREE.ConeGeometry(radius * 1.5, 0.4);
      const coneMaterial = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 0.5
      });
      const cone = new THREE.Mesh(coneGeometry, coneMaterial);
      cone.position.copy(direction).multiplyScalar(length + 0.2);
      cone.lookAt(direction);
      axis.add(cone);

      return axis;
    }
  }

  // Alternar entre modos
  // Alternar entre modos
  toggleRoomMode() {
    this.isRoomMode = !this.isRoomMode;
    console.log('🎭 Toggle room mode. Novo estado:', this.isRoomMode);

    if (this.isRoomMode) {
      this.enterRoomMode();
    } else {
      this.exitRoomMode();
    }
  }

  enterRoomMode() {
    console.log('🎭 Entrando no modo Sala Ambiente');

    // Configurar renderer para melhor qualidade de sombras
    if (this.renderer) {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.shadowMap.autoUpdate = true;
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.2; // Exposição ligeiramente aumentada
    }

    // Esconder elementos do editor
    this.leftPanel.style.display = 'none';

    // Mostrar elementos da sala
    this.roomPanel.style.display = 'flex';
    document.body.classList.add('room-mode');

    // Criar geometria da sala
    this.createRoomGeometry();

    // Configurar câmera para visão de sala
    this.camera.position.set(20, 15, 20);
    this.camera.lookAt(0, 0, 0);
    this.controls.update();

    // Atualizar cursor
    this.updateCursor();
  }

  exitRoomMode() {
    console.log('🎭 Saindo do modo Sala Ambiente');

    // Mostrar elementos do editor
    this.leftPanel.style.display = 'flex';

    // Esconder elementos da sala
    this.roomPanel.style.display = 'none';
    document.body.classList.remove('room-mode');

    // Remover geometria da sala
    this.removeRoomGeometry();

    // Limpar objetos da sala
    this.clearRoomObjects();

    // Resetar câmera
    this.camera.position.set(
      this.distance * Math.sin(this.angleY) * Math.cos(this.angleX),
      this.distance * Math.sin(this.angleX),
      this.distance * Math.cos(this.angleY) * Math.cos(this.angleX)
    );
    this.camera.lookAt(0, 0, 0);
    this.controls.update();

    // Atualizar cursor
    this.updateCursor();
  }

  createRoomGeometry() {
    // Chão com material melhorado para visibilidade
    const floorGeometry = new THREE.BoxGeometry(20, 0.2, 20);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0xcccccc, // Mais claro para melhor visibilidade
      roughness: 0.8,
      metalness: 0.0,
      transparent: false
    });
    this.roomFloor = new THREE.Mesh(floorGeometry, floorMaterial);
    this.roomFloor.position.y = -0.1;
    this.roomFloor.receiveShadow = true;
    this.scene.add(this.roomFloor);

    // Paredes com material melhorado
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0xdddddd, // Mais claro para melhor contraste
      roughness: 0.9,
      metalness: 0.0,
      side: THREE.BackSide
    });

    // Parede frontal
    const frontWall = new THREE.Mesh(new THREE.BoxGeometry(20, 10, 0.2), wallMaterial);
    frontWall.position.set(0, 5, -10);
    this.scene.add(frontWall);
    this.roomWalls.push(frontWall);

    // Parede traseira
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(20, 10, 0.2), wallMaterial);
    backWall.position.set(0, 5, 10);
    this.scene.add(backWall);
    this.roomWalls.push(backWall);

    // Parede esquerda
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 10, 20), wallMaterial);
    leftWall.position.set(-10, 5, 0);
    this.scene.add(leftWall);
    this.roomWalls.push(leftWall);

    // Parede direita
    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 10, 20), wallMaterial);
    rightWall.position.set(10, 5, 0);
    this.scene.add(rightWall);
    this.roomWalls.push(rightWall);

    // Adicionar iluminação otimizada para o modo sala
    this.setupRoomLighting();
  }

  removeRoomGeometry() {
    if (this.roomFloor) {
      this.scene.remove(this.roomFloor);
      this.roomFloor = null;
    }

    this.roomWalls.forEach(wall => this.scene.remove(wall));
    this.roomWalls = [];

    if (this.transformGizmo) {
      this.scene.remove(this.transformGizmo);
      this.transformGizmo = null;
    }

    // Remover todas as luzes do modo sala
    this.removeRoomLighting();
  }

  setupRoomLighting() {
    console.log('💡 Configurando iluminação otimizada para o modo sala');

    // Luz ambiente mais forte para melhor visibilidade
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    ambientLight.name = 'roomAmbientLight';
    this.scene.add(ambientLight);

    // Luz direcional principal (mais forte)
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
    mainLight.position.set(15, 25, 15);
    mainLight.target.position.set(0, 0, 0);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 50;
    mainLight.shadow.camera.left = -20;
    mainLight.shadow.camera.right = 20;
    mainLight.shadow.camera.top = 20;
    mainLight.shadow.camera.bottom = -20;
    mainLight.shadow.bias = -0.0001;
    mainLight.name = 'roomMainLight';
    this.scene.add(mainLight);
    this.scene.add(mainLight.target);

    // Luz de preenchimento para reduzir sombras fortes
    const fillLight = new THREE.DirectionalLight(0x8080ff, 0.4);
    fillLight.position.set(-10, 15, -10);
    fillLight.name = 'roomFillLight';
    this.scene.add(fillLight);

    // Luz traseira para melhor iluminação geral
    const backLight = new THREE.DirectionalLight(0xff8080, 0.3);
    backLight.position.set(0, 10, -15);
    backLight.name = 'roomBackLight';
    this.scene.add(backLight);

    // Luz superior para iluminação uniforme
    const topLight = new THREE.DirectionalLight(0xffffff, 0.5);
    topLight.position.set(0, 20, 0);
    topLight.target.position.set(0, 0, 0);
    topLight.name = 'roomTopLight';
    this.scene.add(topLight);
    this.scene.add(topLight.target);

    // Luzes pontuais para iluminação local
    const pointLight1 = new THREE.PointLight(0xffffff, 0.8, 30);
    pointLight1.position.set(8, 8, 8);
    pointLight1.name = 'roomPointLight1';
    this.scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xffffff, 0.8, 30);
    pointLight2.position.set(-8, 8, -8);
    pointLight2.name = 'roomPointLight2';
    this.scene.add(pointLight2);

    console.log('✅ Iluminação do modo sala configurada com 7 luzes');
  }

  removeRoomLighting() {
    console.log('🕯️ Removendo iluminação do modo sala');

    // Lista de nomes das luzes do modo sala
    const roomLightNames = [
      'roomAmbientLight',
      'roomMainLight',
      'roomFillLight',
      'roomBackLight',
      'roomTopLight',
      'roomPointLight1',
      'roomPointLight2'
    ];

    // Remover luzes específicas do modo sala
    roomLightNames.forEach(lightName => {
      const light = this.scene.getObjectByName(lightName);
      if (light) {
        this.scene.remove(light);
        // Remover também o target se for uma luz direcional
        if (light.target && light.target.parent === this.scene) {
          this.scene.remove(light.target);
        }
      }
    });

    console.log('✅ Iluminação do modo sala removida');
  }

  // Carregar objeto voxel
  loadRoomObject(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const fileContent = e.target.result;
        let voxelData = null;

        if (file.name.toLowerCase().endsWith('.json')) {
          voxelData = JSON.parse(fileContent);
        } else if (file.name.toLowerCase().endsWith('.html')) {
          voxelData = this.extractVoxelDataFromHTML(fileContent);
        } else {
          alert('Formato não suportado. Use arquivos .html ou .json');
          return;
        }

        if (voxelData && voxelData.length > 0) {
          this.addRoomObject(voxelData, file.name);
        } else {
          alert('Nenhum dado de voxel encontrado no arquivo.');
        }
      } catch (error) {
        console.error('Erro ao carregar arquivo:', error);
        alert('Erro ao carregar arquivo: ' + error.message);
      }
    };
    reader.readAsText(file);
  }

  extractVoxelDataFromHTML(htmlContent) {
    const voxelDataMatch = htmlContent.match(/const voxelData = (\[[\s\S]*?\]);/);
    if (voxelDataMatch && voxelDataMatch[1]) {
      return JSON.parse(voxelDataMatch[1]);
    }
    throw new Error('Dados de voxel não encontrados no arquivo HTML.');
  }

  addRoomObject(voxelData, name = 'Objeto') {
    const meshGroup = new THREE.Group();
    const materialCache = {};

    voxelData.forEach(voxel => {
      const color = voxel.color;
      let material = materialCache[color];
      if (!material) {
        // Material otimizado para melhor visibilidade no modo sala
        material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(color),
          roughness: 0.4, // Menos rugosidade para melhor reflexão
          metalness: 0.1, // Pouco metal para melhor cor
          transparent: false,
          emissive: new THREE.Color(color).multiplyScalar(0.05), // Emissividade sutil para brilho
          emissiveIntensity: 0.05
        });
        materialCache[color] = material;
      }

      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(voxel.x, voxel.y, voxel.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      meshGroup.add(mesh);
    });

    // Centralizar o objeto
    const bbox = new THREE.Box3().setFromObject(meshGroup);
    const center = bbox.getCenter(new THREE.Vector3());
    meshGroup.position.sub(center);

    // Posicionar acima do chão
    meshGroup.position.y = 0.5;

    this.scene.add(meshGroup);

    const roomObject = new this.RoomObject(
      Date.now(),
      name.split('/').pop().split('\\').pop().replace(/\.(html|json)$/i, ''),
      voxelData,
      meshGroup
    );

    this.roomObjects.push(roomObject);
    this.updateRoomObjectsList();

    console.log(`✅ Objeto "${roomObject.name}" adicionado à sala (${voxelData.length} voxels) com materiais otimizados`);
  }

  updateRoomObjectsList() {
    this.roomObjectsList.innerHTML = '';

    if (this.roomObjects.length === 0) {
      return; // A mensagem "Nenhum objeto carregado" será mostrada via CSS ::before
    }

    this.roomObjects.forEach(obj => {
      const objDiv = document.createElement('div');
      objDiv.className = 'room-object-card';
      objDiv.dataset.objectId = obj.id; // Adicionar dataset para identificação
      objDiv.innerHTML = `
        <div class="card-header">
          <h5>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
               <path d="M10 2a.75.75 0 01.75.75v.51a4.52 4.52 0 012.14.996l.45-.45a.75.75 0 111.06 1.06l-.45.45c.36.47.65.99.86 1.55h.51a.75.75 0 110 1.5h-.51a4.52 4.52 0 01-.86 1.55l.45.45a.75.75 0 11-1.06 1.06l-.45-.45a4.52 4.52 0 01-2.14.996v.51a.75.75 0 11-1.5 0v-.51a4.52 4.52 0 01-2.14-.996l-.45.45a.75.75 0 11-1.06-1.06l.45-.45a4.52 4.52 0 01-.86-1.55h-.51a.75.75 0 010-1.5h.51c.21-.56.5-1.08.86-1.55l-.45-.45a.75.75 0 011.06-1.06l.45.45c.6-.43 1.32-.77 2.14-.996V2.75A.75.75 0 0110 2zM8.5 10a1.5 1.5 0 103 0 1.5 1.5 0 00-3 0z" />
            </svg>
            <span>${obj.name}</span>
          </h5>
          <svg class="card-toggle-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M14.77 12.79a.75.75 0 01-1.06-.02L10 8.832l-3.71 3.938a.75.75 0 11-1.08-1.04l4.25-4.5a.75.75 0 011.08 0l4.25 4.5a.75.75 0 01-.02 1.06z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="card-body">
          <div class="transform-section">
            <div class="transform-header">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v2.5h-2.5a.75.75 0 000 1.5h2.5v2.5a.75.75 0 001.5 0v-2.5h2.5a.75.75 0 000-1.5h-2.5v-2.5z" clip-rule="evenodd" />
              </svg>
              <span>Posição</span>
            </div>
            <div class="new-transform-inputs">
              <div class="new-transform-slider-group">
                <span class="input-group-label" style="color: #ef4444;">X</span>
                <input type="range" class="new-transform-slider" data-transform="position" data-axis="x" min="-20" max="20" step="0.1" value="${obj.position.x.toFixed(1)}">
                <span class="slider-value-new">${obj.position.x.toFixed(1)}</span>
              </div>
              <div class="new-transform-slider-group">
                <span class="input-group-label" style="color: #10b981;">Y</span>
                <input type="range" class="new-transform-slider" data-transform="position" data-axis="y" min="-20" max="20" step="0.1" value="${obj.position.y.toFixed(1)}">
                <span class="slider-value-new">${obj.position.y.toFixed(1)}</span>
              </div>
              <div class="new-transform-slider-group">
                <span class="input-group-label" style="color: #06b6d4;">Z</span>
                <input type="range" class="new-transform-slider" data-transform="position" data-axis="z" min="-20" max="20" step="0.1" value="${obj.position.z.toFixed(1)}">
                <span class="slider-value-new">${obj.position.z.toFixed(1)}</span>
              </div>
            </div>
          </div>
          <div class="transform-section">
            <div class="transform-header">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M4.5 2A2.5 2.5 0 002 4.5v3A2.5 2.5 0 004.5 10h.615l.788 5.5H6a1 1 0 001 1h6a1 1 0 001-1h-.693l.788-5.5H15.5A2.5 2.5 0 0018 7.5v-3A2.5 2.5 0 0015.5 2h-11zM6.25 14.5a1.25 1.25 0 11-2.5 0 1.25 1.25 0 012.5 0zm7.5 0a1.25 1.25 0 11-2.5 0 1.25 1.25 0 012.5 0z" clip-rule="evenodd" />
              </svg>
              <span>Rotação</span>
            </div>
            <div class="new-transform-inputs">
              <div class="new-transform-slider-group">
                <span class="input-group-label" style="color: #ef4444;">X</span>
                <input type="range" class="new-transform-slider" data-transform="rotation" data-axis="x" min="0" max="360" step="1" value="${THREE.MathUtils.radToDeg(obj.rotation.x).toFixed(0)}">
                <span class="slider-value-new">${THREE.MathUtils.radToDeg(obj.rotation.x).toFixed(0)}°</span>
              </div>
              <div class="new-transform-slider-group">
                <span class="input-group-label" style="color: #10b981;">Y</span>
                <input type="range" class="new-transform-slider" data-transform="rotation" data-axis="y" min="0" max="360" step="1" value="${THREE.MathUtils.radToDeg(obj.rotation.y).toFixed(0)}">
                <span class="slider-value-new">${THREE.MathUtils.radToDeg(obj.rotation.y).toFixed(0)}°</span>
              </div>
              <div class="new-transform-slider-group">
                <span class="input-group-label" style="color: #06b6d4;">Z</span>
                <input type="range" class="new-transform-slider" data-transform="rotation" data-axis="z" min="0" max="360" step="1" value="${THREE.MathUtils.radToDeg(obj.rotation.z).toFixed(0)}">
                <span class="slider-value-new">${THREE.MathUtils.radToDeg(obj.rotation.z).toFixed(0)}°</span>
              </div>
            </div>
          </div>
          <div class="transform-section">
            <div class="transform-header">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
              </svg>
              <span>Escala</span>
            </div>
            <div class="scale-slider-container">
              <input type="range" class="scale-slider" data-obj-id="${obj.id}" min="0.1" max="5" step="0.1" value="${obj.scale.x.toFixed(1)}">
              <span class="scale-value">${obj.scale.x.toFixed(1)}x</span>
            </div>
          </div>
          <div class="transform-section">
            <div class="transform-header">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clip-rule="evenodd" />
              </svg>
              <span>Material</span>
            </div>
            <div class="material-controls">
              <div class="material-slider-group">
                <label class="material-label">Textura</label>
                <div class="slider-container">
                  <input type="range" class="material-slider" data-obj-id="${obj.id}" data-property="roughness" min="0" max="1" step="0.01" value="${this.getMaterialProperty(obj, 'roughness', 0.4)}">
                  <span class="slider-value">${this.getMaterialProperty(obj, 'roughness', 0.4).toFixed(2)}</span>
                </div>
              </div>
              <div class="material-slider-group">
                <label class="material-label">Metálico</label>
                <div class="slider-container">
                  <input type="range" class="material-slider" data-obj-id="${obj.id}" data-property="metalness" min="0" max="1" step="0.01" value="${this.getMaterialProperty(obj, 'metalness', 0.1)}">
                  <span class="slider-value">${this.getMaterialProperty(obj, 'metalness', 0.1).toFixed(2)}</span>
                </div>
              </div>
              <div class="material-slider-group">
                <label class="material-label">Brilho</label>
                <div class="slider-container">
                  <input type="range" class="material-slider" data-obj-id="${obj.id}" data-property="emissiveIntensity" min="0" max="1" step="0.01" value="${this.getMaterialProperty(obj, 'emissiveIntensity', 0.05)}">
                  <span class="slider-value">${this.getMaterialProperty(obj, 'emissiveIntensity', 0.05).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="card-footer">
          <button class="remove-object-btn-new" data-obj-id="${obj.id}">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.58.22-2.365.468a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.576l.84-10.518.149.022a.75.75 0 10.23-1.482A41.03 41.03 0 0014 4.193v-.443A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clip-rule="evenodd" />
            </svg>
            <span>Remover</span>
          </button>
        </div>
      `;
      this.roomObjectsList.appendChild(objDiv);
    });

    // Adicionar event listeners para sliders de transformação
    this.roomObjectsList.querySelectorAll('.new-transform-slider').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const objId = parseInt(e.target.closest('.room-object-card').dataset.objectId || e.target.dataset.objId);
        const transform = e.target.dataset.transform;
        const axis = e.target.dataset.axis;
        const value = parseFloat(e.target.value);
        const valueDisplay = e.target.parentElement.querySelector('.slider-value-new');

        const obj = this.roomObjects.find(o => o.id === objId);
        if (obj) {
          if (transform === 'position') {
            obj.position[axis] = value;
            valueDisplay.textContent = value.toFixed(1);
          } else if (transform === 'rotation') {
            obj.rotation[axis] = THREE.MathUtils.degToRad(value);
            valueDisplay.textContent = `${value.toFixed(0)}°`;
          }
          obj.updateTransform();

          if (obj.selected && this.transformGizmo) {
            this.transformGizmo.position.copy(obj.meshGroup.position);
          }
        }
      });
    });

    // Event listener para sliders de escala
    this.roomObjectsList.querySelectorAll('.scale-slider').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const objId = parseInt(e.target.dataset.objId);
        const value = parseFloat(e.target.value);
        const valueDisplay = e.target.parentElement.querySelector('.scale-value');

        const obj = this.roomObjects.find(o => o.id === objId);
        if (obj) {
          obj.scale.x = value;
          obj.scale.y = value;
          obj.scale.z = value;
          obj.updateTransform();
          valueDisplay.textContent = `${value.toFixed(1)}x`;
        }
      });
    });

    // Event listener para sliders de material
    this.roomObjectsList.querySelectorAll('.material-slider').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const objId = parseInt(e.target.dataset.objId);
        const property = e.target.dataset.property;
        const value = parseFloat(e.target.value);
        const valueDisplay = e.target.parentElement.querySelector('.slider-value');

        const obj = this.roomObjects.find(o => o.id === objId);
        if (obj) {
          // Atualizar todas as meshes do objeto
          obj.meshGroup.traverse((child) => {
            if (child.isMesh && child.material) {
              if (property === 'roughness') {
                child.material.roughness = value;
                valueDisplay.textContent = value.toFixed(2);
              } else if (property === 'metalness') {
                child.material.metalness = value;
                valueDisplay.textContent = value.toFixed(2);
              } else if (property === 'emissiveIntensity') {
                child.material.emissiveIntensity = value;
                valueDisplay.textContent = value.toFixed(2);
              }
            }
          });
        }
      });
    });

    // Toggle para expandir/colapsar cards
    this.roomObjectsList.querySelectorAll('.card-header').forEach(header => {
      header.addEventListener('click', (e) => {
        if (!e.target.closest('.remove-object-btn-new')) {
          const card = header.parentElement;
          const body = card.querySelector('.card-body');
          const toggleIcon = header.querySelector('.card-toggle-icon');

          body.classList.toggle('collapsed');
          toggleIcon.style.transform = body.classList.contains('collapsed') ? 'rotate(180deg)' : 'rotate(0deg)';
        }
      });
    });

    this.roomObjectsList.querySelectorAll('.remove-object-btn-new').forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const objId = parseInt(e.target.closest('.remove-object-btn-new').dataset.objId);

        // Confirmação visual melhorada
        const obj = this.roomObjects.find(o => o.id === objId);
        if (confirm(`Tem certeza que deseja remover "${obj ? obj.name : 'este objeto'}"?`)) {
          this.removeRoomObject(objId);
        }
      });
    });
  }

  removeRoomObject(objId) {
    const index = this.roomObjects.findIndex(o => o.id === objId);
    if (index !== -1) {
      const obj = this.roomObjects[index];
      this.scene.remove(obj.meshGroup);

      if (obj.selected && this.transformGizmo) {
        this.transformGizmo.visible = false;
      }

      this.roomObjects.splice(index, 1);
      this.updateRoomObjectsList();
    }
  }

  clearRoomObjects() {
    this.roomObjects.forEach(obj => {
      this.scene.remove(obj.meshGroup);
    });
    this.roomObjects = [];

    if (this.transformGizmo) {
      this.transformGizmo.visible = false;
    }

    this.updateRoomObjectsList();
  }

  saveRoom() {
    const roomData = this.roomObjects.map(obj => ({
      name: obj.name,
      voxelData: obj.voxelData,
      position: obj.position,
      rotation: obj.rotation,
      scale: obj.scale
    }));

    const dataStr = JSON.stringify(roomData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'sala-voxel.json';
    link.click();

    URL.revokeObjectURL(url);
  }

  // Método auxiliar para obter propriedades de material
  getMaterialProperty(obj, property, defaultValue) {
    let value = defaultValue;

    obj.meshGroup.traverse((child) => {
      if (child.isMesh && child.material && child.material[property] !== undefined) {
        value = child.material[property];
        return; // Retorna o primeiro valor encontrado
      }
    });

    return value;
  }
}