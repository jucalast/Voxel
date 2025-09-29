// =====================================================================
// MÓDULO ROOM MODE SYSTEM
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
// 1. Importar: import { RoomModeSystem } from './modules/roomMode.js'
// 2. Criar instância: const roomSystem = new RoomModeSystem(scene, camera, controls, roomModeSystem)
// 3. Ativar: roomSystem.enterWalkMode()
// 4. Desativar: roomSystem.exitWalkMode()
//
// =====================================================================

// =====================================================================
// SISTEMA DE MODO SALA AMBIENTE
// =====================================================================

import { WalkBuildModeSystem } from './walkBuildMode.js';
import { TimeSystem } from './timeSystem.js';

export class RoomModeSystem {
  constructor(scene, camera, controls, updateCursor, renderer = null) {
    this.scene = scene;
    this.camera = camera;
    this.controls = controls;
    this.updateCursor = updateCursor;
    this.renderer = renderer;

    this.timeSystem = new TimeSystem();

    this.isRoomMode = false;
    this.roomObjects = [];
    this.selectedRoomObject = null;
    this.transformGizmo = null;
    this.roomFloor = null;
    this.roomWalls = [];

    // Sistema de caminhada e construção
    this.walkBuildModeSystem = null;

    // Elementos DOM do modo sala
    this.roomModeBtn = document.getElementById('roomModeBtn');
    this.roomPanel = document.getElementById('room-panel');

    // Inicializar sistema de caminhada e construção
    this.initWalkBuildSystem();
    
    this.roomSaveBtn = document.getElementById('roomSaveBtn');
    this.roomClearBtn = document.getElementById('roomClearBtn');

    // Referências para elementos do editor
    this.leftPanel = document.getElementById('left-panel');
    this.iconToolbar = document.getElementById('icon-toolbar');

    // Elementos da barra superior
    this.topBar = document.getElementById('top-bar');
    this.enterWalkModeBtn = document.getElementById('enter-walk-mode-btn');

    // Variáveis do editor (serão passadas quando inicializar)
    this.distance = null;
    this.angleX = null;
    this.angleY = null;

    // Sistema de caminhada e construção
    this.walkBuildModeSystem = null;

    this.initWalkBuildSystem();
  }

  initWalkBuildSystem() {
    // Criar instância do sistema de caminhada e construção
    if (typeof WalkBuildModeSystem !== 'undefined') {
      // Passar as funções do editor para o sistema de caminhada
      const editorFunctions = {
        addVoxel: (x, y, z, color, saveHistory = true) => {
          // Chamar a função addVoxel do editor através do window
          if (window.addVoxel) {
            return window.addVoxel(x, y, z, color, saveHistory);
          }
          console.warn('⚠️ addVoxel não encontrado no escopo global');
        },
        removeVoxel: (mesh, saveHistory = true) => {
          // Chamar a função removeVoxel do editor através do window
          if (window.removeVoxel) {
            return window.removeVoxel(mesh, saveHistory);
          }
          console.warn('⚠️ removeVoxel não encontrado no escopo global');
        },
        saveState: () => {
          // Chamar a função saveState do editor através do window
          if (window.saveState) {
            return window.saveState();
          }
          console.warn('⚠️ saveState não encontrado no escopo global');
        },
        getSelectedColor: () => {
          // Chamar a função getSelectedColor através do sistema de cores
          if (window.colorSystem && window.colorSystem.getSelectedColor) {
            return window.colorSystem.getSelectedColor();
          }
          console.warn('⚠️ getSelectedColor não encontrado');
          return '#ff0000'; // Cor padrão
        },
        getVoxels: () => {
          // Retornar o array de voxels do editor
          if (window.voxels) {
            return window.voxels;
          }
          console.warn('⚠️ Array de voxels não encontrado no escopo global');
          return [];
        }
      };

      this.walkBuildModeSystem = new WalkBuildModeSystem(
        this.scene,
        this.camera,
        this.controls,
        this,
        editorFunctions,
        (isActive) => {
          // Callback para atualizar o estado do botão quando walk mode muda
          this.updateWalkModeButtonState();
        }
      );
      console.log('✅ Sistema de caminhada e construção inicializado com funções do editor');
    } else {
      console.warn('⚠️ WalkBuildModeSystem não encontrado. Sistema de caminhada não estará disponível.');
    }
  }

  init() {
    // Event listeners para o modo sala
    this.roomModeBtn.addEventListener('click', () => this.toggleRoomMode());
    this.roomSaveBtn.addEventListener('click', () => this.saveRoom());
    this.roomClearBtn.addEventListener('click', () => {
      if (confirm('Remover todos os objetos da sala?')) {
        this.clearRoomObjects();
      }
    });

    // Event listeners para o upload de objetos da sala
    const roomObjectFileInput = document.getElementById('roomObjectFileInput');

    if (roomObjectFileInput) {
      roomObjectFileInput.addEventListener('change', (event) => {
        const files = event.target.files;
        if (files && files.length > 0) {
          console.log('📁 Arquivos selecionados via room input:', files.length);

          // Processar múltiplos arquivos se selecionados
          Array.from(files).forEach(file => {
            if (window.fileUploadSystem) {
              // Determinar o tipo de callback baseado no modo atual
              const isRoomMode = this.isRoomMode;
              const callbackType = isRoomMode ? 'roomObject' : 'voxel';

              console.log(`📁 Processando arquivo no modo ${isRoomMode ? 'sala' : 'editor'}: ${callbackType}`);

              // Simular o comportamento do handleFileChange
              window.fileUploadSystem.currentCallbackType = callbackType;
              const fakeEvent = { target: { files: [file] } };
              window.fileUploadSystem.handleFileChange(fakeEvent);
            } else {
              console.error('fileUploadSystem not available globally.');
            }
          });

          // Limpar o input para permitir seleção do mesmo arquivo novamente
          event.target.value = '';
        }
      });
    }

    if (this.enterWalkModeBtn) {
      this.enterWalkModeBtn.addEventListener('click', () => {
        if (this.walkBuildModeSystem) {
          if (this.walkBuildModeSystem.isActive) {
            this.walkBuildModeSystem.exitWalkMode();
            this.updateWalkModeButtonState();
          } else {
            this.walkBuildModeSystem.enterWalkMode();
            this.updateWalkModeButtonState();
          }
        }
      });
    }

    // Inicializar estado do botão
    this.updateWalkModeButtonState();
  }

  // Configurar variáveis do editor
  setEditorVars(distance, angleX, angleY, voxels = null) {
    this.distance = distance;
    this.angleX = angleX;
    this.angleY = angleY;
    this.voxels = voxels;
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

    // Fechar o painel de cores e mostrar a barra superior
    if (this.leftPanel.classList.contains('show')) {
      this.leftPanel.classList.remove('show');
    }
    // Atualizar posição do toolbar usando função centralizada
    if (window.updateToolbarPosition) {
      window.updateToolbarPosition();
    }
    if (this.topBar) {
      this.topBar.style.display = 'flex';
    }

    // Mostrar elementos da sala
    this.roomPanel.style.display = 'flex';
    document.body.classList.add('room-mode');

    // Criar geometria da sala usando o novo sistema de configuração
    if (window.roomConfigSystem) {
      console.log('🏗️ Usando sistema de configuração personalizada da sala');
      window.roomConfigSystem.createRoom();
      
      // Inicializar sistema de portas e janelas se disponível
      if (window.doorWindowSystem) {
        console.log('🚪 Sistema de portas e janelas disponível no room mode');
      }
    } else {
      console.log('🏗️ Usando geometria padrão da sala');
      this.createRoomGeometry();
    }

    // Configurar iluminação inicial (Manhã)
    this.updateLighting('Manhã');

    // Restaurar objetos da sala na cena (caso tenham sido removidos)
    this.restoreRoomObjectsToScene();

    // Esconder voxels do editor no room mode
    this.hideEditorVoxels();

    // Configurar câmera para visão de sala
    this.camera.position.set(20, 15, 20);
    this.camera.lookAt(0, 0, 0);
    this.controls.update();

    // Atualizar cursor
    this.updateCursor();
  }

  exitRoomMode() {
    console.log('🎭 Saindo do modo Sala Ambiente');

    // Restaurar configurações do renderer para o modo editor
    if (this.renderer) {
      this.renderer.shadowMap.enabled = false;
      this.renderer.shadowMap.autoUpdate = false;
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.NoToneMapping;
      this.renderer.toneMappingExposure = 1.0;
    }

    // Restaurar painel de cores e esconder a barra superior (se walk mode não estiver ativo)
    this.leftPanel.classList.add('show');
    // Atualizar posição do toolbar usando função centralizada
    if (window.updateToolbarPosition) {
      window.updateToolbarPosition();
    }
    // Manter a barra visível por padrão
    if (this.topBar) {
      this.topBar.style.display = 'flex';
    }

    // Esconder elementos da sala
    this.roomPanel.style.display = 'none';
    document.body.classList.remove('room-mode');

    // Remover geometria da sala usando o novo sistema ou método tradicional
    if (window.roomConfigSystem) {
      console.log('🧹 Limpando sala personalizada');
      window.roomConfigSystem.clearRoom();
      
      // Limpar portas e janelas se disponível
      if (window.doorWindowSystem) {
        console.log('🚪 Limpando portas e janelas');
        window.doorWindowSystem.clear();
      }
    } else {
      console.log('🧹 Removendo geometria padrão da sala');
      this.removeRoomGeometry();
    }
    
    // Esconder objetos da sala no modo editor (não remover da cena)
    this.hideRoomObjectsFromScene();

    // Mostrar voxels do editor no modo editor
    this.showEditorVoxels();

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
    // this.setupRoomLighting(); // Removido pois updateLighting é chamado em enterRoomMode
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

  setupRoomLighting(lightingConfig) {
    console.log('💡 Configurando iluminação para o modo sala:', lightingConfig);

    // Remover luzes existentes antes de adicionar novas
    this.removeRoomLighting();

    // Luz ambiente
    const ambientLight = new THREE.AmbientLight(lightingConfig.ambientLight.color, lightingConfig.ambientLight.intensity);
    ambientLight.name = 'roomAmbientLight';
    this.scene.add(ambientLight);

    // Luz direcional principal (sol/lua)
    let mainLight = this.scene.getObjectByName('roomMainLight');
    if (!mainLight) {
      mainLight = new THREE.DirectionalLight(lightingConfig.mainLight.color, lightingConfig.mainLight.intensity);
      mainLight.name = 'roomMainLight';
      mainLight.castShadow = true;
      mainLight.shadow.mapSize.width = 2048;
      mainLight.shadow.mapSize.height = 2048;
      mainLight.shadow.camera.near = 0.1; // Closer near plane for better precision
      mainLight.shadow.camera.far = 100; // Further far plane to cover more of the room
      // Adjust frustum to cover the room more effectively
      const roomSize = 20; // Assuming room is 20x10x20 (width, height, depth)
      const shadowCameraSize = roomSize * 1.5; // Slightly larger than room to avoid clipping
      mainLight.shadow.camera.left = -shadowCameraSize;
      mainLight.shadow.camera.right = shadowCameraSize;
      mainLight.shadow.camera.top = shadowCameraSize;
      mainLight.shadow.camera.bottom = -shadowCameraSize;
      mainLight.shadow.bias = -0.0001;
      mainLight.shadow.normalBias = 0.05; // Add normal bias to reduce shadow acne
      this.scene.add(mainLight);
      mainLight.target = new THREE.Object3D(); // Create a target if it doesn't exist
      this.scene.add(mainLight.target);
    } else {
      mainLight.color.setHex(lightingConfig.mainLight.color);
      mainLight.intensity = lightingConfig.mainLight.intensity;
    }
    mainLight.position.set(lightingConfig.mainLight.position.x, lightingConfig.mainLight.position.y, lightingConfig.mainLight.position.z);
    mainLight.target.position.set(0, 0, 0); // Always look at the center

    // Adicionar efeito de God Rays (raios crepusculares)
    let volumetricLight = this.scene.getObjectByName('roomVolumetricLight');
    if (!volumetricLight) {
      const coneGeometry = new THREE.ConeGeometry(2, 30, 32); // Raio, altura, segmentos
      coneGeometry.translate(0, 15, 0); // Mover para que a base esteja na origem
      const coneMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.05, // Opacidade inicial baixa
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
      });
      volumetricLight = new THREE.Mesh(coneGeometry, coneMaterial);
      volumetricLight.name = 'roomVolumetricLight';
      this.scene.add(volumetricLight);
    }

    // Posicionar e orientar o cone com a luz principal
    volumetricLight.position.copy(mainLight.position);
    volumetricLight.lookAt(mainLight.target.position);
    volumetricLight.rotateX(Math.PI / 2); // Ajustar orientação do cone

    // Ajustar opacidade e cor com base na intensidade da luz principal
    const lightIntensityFactor = lightingConfig.mainLight.intensity / 1.5; // Max intensity is 1.5
    volumetricLight.material.opacity = 0.02 + (lightIntensityFactor * 0.08); // Mais visível com luz forte
    volumetricLight.material.color.setHex(lightingConfig.mainLight.color);

    // Tornar visível apenas durante o dia e com intensidade suficiente
    volumetricLight.visible = lightingConfig.mainLight.intensity > 0.5;

    // Luz de preenchimento
    let fillLight = this.scene.getObjectByName('roomFillLight');
    if (!fillLight) {
      fillLight = new THREE.DirectionalLight(lightingConfig.fillLight.color, lightingConfig.fillLight.intensity);
      fillLight.name = 'roomFillLight';
      this.scene.add(fillLight);
    } else {
      fillLight.color.setHex(lightingConfig.fillLight.color);
      fillLight.intensity = lightingConfig.fillLight.intensity;
    }
    fillLight.position.set(-10, 15, -10);

    // Luz traseira
    let backLight = this.scene.getObjectByName('roomBackLight');
    if (!backLight) {
      backLight = new THREE.DirectionalLight(lightingConfig.backLight.color, lightingConfig.backLight.intensity);
      backLight.name = 'roomBackLight';
      this.scene.add(backLight);
    } else {
      backLight.color.setHex(lightingConfig.backLight.color);
      backLight.intensity = lightingConfig.backLight.intensity;
    }
    backLight.position.set(0, 10, -15);

    // Luz superior
    let topLight = this.scene.getObjectByName('roomTopLight');
    if (!topLight) {
      topLight = new THREE.DirectionalLight(lightingConfig.topLight.color, lightingConfig.topLight.intensity);
      topLight.name = 'roomTopLight';
      this.scene.add(topLight);
      topLight.target = new THREE.Object3D(); // Create a target if it doesn't exist
      this.scene.add(topLight.target);
    } else {
      topLight.color.setHex(lightingConfig.topLight.color);
      topLight.intensity = lightingConfig.topLight.intensity;
    }
    topLight.position.set(0, 20, 0);
    topLight.target.position.set(0, 0, 0);

    // Luzes pontuais
    let pointLight1 = this.scene.getObjectByName('roomPointLight1');
    if (!pointLight1) {
      pointLight1 = new THREE.PointLight(lightingConfig.pointLight1.color, lightingConfig.pointLight1.intensity, lightingConfig.pointLight1.distance);
      pointLight1.name = 'roomPointLight1';
      this.scene.add(pointLight1);
    } else {
      pointLight1.color.setHex(lightingConfig.pointLight1.color);
      pointLight1.intensity = lightingConfig.pointLight1.intensity;
      pointLight1.distance = lightingConfig.pointLight1.distance;
    }
    pointLight1.position.set(8, 8, 8);

    let pointLight2 = this.scene.getObjectByName('roomPointLight2');
    if (!pointLight2) {
      pointLight2 = new THREE.PointLight(lightingConfig.pointLight2.color, lightingConfig.pointLight2.intensity, lightingConfig.pointLight2.distance);
      pointLight2.name = 'roomPointLight2';
      this.scene.add(pointLight2);
    } else {
      pointLight2.color.setHex(lightingConfig.pointLight2.color);
      pointLight2.intensity = lightingConfig.pointLight2.intensity;
      pointLight2.distance = lightingConfig.pointLight2.distance;
    }
    pointLight2.position.set(-8, 8, -8);

    // Configurar nevoeiro
    this.scene.fog = new THREE.Fog(lightingConfig.fog.color, lightingConfig.fog.near, lightingConfig.fog.far);

    console.log('✅ Iluminação do modo sala configurada com sucesso.');
  }

  removeRoomLighting() {
    console.log('🕯️ Removendo iluminação do modo sala');

    // Lista de nomes das luzes e efeitos do modo sala
    const roomLightNames = [
      'roomAmbientLight',
      'roomMainLight',
      'roomFillLight',
      'roomBackLight',
      'roomTopLight',
      'roomPointLight1',
      'roomPointLight2',
      'roomVolumetricLight' // Adicionar o efeito volumétrico
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
    // Remover nevoeiro
    this.scene.fog = null;

    console.log('✅ Iluminação do modo sala removida');
  }

  updateLighting(timeOfDay) {
    const lightingConfig = this.timeSystem.getLightingConfig(timeOfDay);
    this.setupRoomLighting(lightingConfig);
  }

  // Carregar objeto voxel
  loadRoomObject(file) {
    console.log('Attempting to load file:', file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const fileContent = e.target.result;
        let voxelData = null;

        if (file.name.toLowerCase().endsWith('.json')) {
          voxelData = JSON.parse(fileContent);
          console.log('Loaded JSON voxelData:', voxelData);
        } else if (file.name.toLowerCase().endsWith('.html')) {
          voxelData = this.extractVoxelDataFromHTML(fileContent);
          console.log('Extracted HTML voxelData:', voxelData);
        } else {
          alert('Formato não suportado. Use arquivos .html ou .json');
          return;
        }

        if (voxelData && voxelData.length > 0) {
          this.addRoomObject(voxelData, file.name);
        } else {
          alert('Nenhum dado de voxel encontrado no arquivo.');
          console.warn('No voxel data found in file:', file.name);
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

  // Update the UI list
  this.updateRoomObjectsList();

  // Mostrar room panel apenas se já estivermos no room mode
  if (this.isRoomMode && this.roomPanel && this.roomPanel.style.display !== 'flex') {
    this.roomPanel.style.display = 'flex';
    console.log('🎭 Room panel mostrado (já em room mode)');
  }

  // Não ativar automaticamente o room mode - deixar o usuário decidir
  // O usuário deve ativar manualmente o room mode quando desejar

  console.log(`✅ Objeto "${roomObject.name}" adicionado à sala (${voxelData.length} voxels) com materiais otimizados`);
  }

  updateRoomObjectsList() {
    const listElement = document.getElementById('roomUploadHistoryList');
    if (!listElement) return;

    if (this.roomObjects.length === 0) {
      listElement.innerHTML = `
        <div class="upload-history-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
          </svg>
          <p>Nenhum objeto na sala</p>
          <small>Carregue um objeto para começar</small>
        </div>
      `;
      return;
    }

    listElement.innerHTML = this.roomObjects.map(obj => `
      <div class="object-card" data-id="${obj.id}">
        <div class="object-card-info">
          <div class="object-card-header">
            <div class="object-card-name">${obj.name}</div>
            <span class="mode-badge room-mode">ROOM</span>
          </div>
          <div class="object-card-meta">
            ${obj.voxelData.length} voxels
          </div>
        </div>
        <div class="object-card-actions">
          <button class="object-card-btn transform-btn" data-obj-id="${obj.id}" title="Transformar">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          </button>
          <button class="object-card-btn reload" data-id="${obj.id}" title="Recarregar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
            </svg>
          </button>
          <button class="object-card-btn delete" data-id="${obj.id}" title="Remover">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              <line x1="10" y1="11" x2="10" y2="17"/>
              <line x1="14" y1="11" x2="14" y2="17"/>
            </svg>
          </button>
        </div>
      </div>
    `).join('');

    // Add event listeners with specific context to avoid conflicts with editor.js
    listElement.querySelectorAll('.object-card .transform-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const objId = parseInt(e.currentTarget.dataset.objId);
        const obj = this.roomObjects.find(o => o.id === objId);
        if (obj) {
          this.addTransformControls(obj);
        }
      });
    });

    listElement.querySelectorAll('.object-card .delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const objId = parseInt(e.currentTarget.dataset.id);
        const obj = this.roomObjects.find(o => o.id === objId);
        if (obj && confirm(`Tem certeza que deseja remover "${obj.name}"?`)) {
          this.removeRoomObject(objId);
        }
      });
    });

    // Add event listeners for reload buttons with specific context
    listElement.querySelectorAll('.object-card .reload').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const objId = parseInt(e.currentTarget.dataset.id);
        const obj = this.roomObjects.find(o => o.id === objId);
        if (obj) {
          console.log(`🔄 Recarregar objeto: ${obj.name}`);
          // TODO: Implementar funcionalidade de reload
        }
      });
    });
  }

  // Select a room object
  selectRoomObject(objId) {
    // Deselect all objects
    this.roomObjects.forEach(obj => {
      obj.selected = false;
      obj.hideGizmo();
    });

    // Select the target object
    const targetObj = this.roomObjects.find(obj => obj.id === objId);
    if (targetObj) {
      targetObj.selected = true;
      targetObj.showGizmo();
      // Note: addTransformControls is now only called via the Transform button
    }

    // Update the UI
    this.updateRoomObjectsList();
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

      // Update the UI list
      this.updateRoomObjectsList();

      // Clear transform controls when object is removed
      const transformControls = document.getElementById('transformControls');
      if (transformControls) {
        transformControls.innerHTML = '';
      }
      
      // If the removed object was selected and there are still objects, just select the first one (no auto-transform)
      if (obj.selected && this.roomObjects.length > 0) {
        this.roomObjects[0].selected = true;
      }
    }
  }

  clearRoomObjects() {
    this.roomObjects.forEach(obj => {
      this.scene.remove(obj.meshGroup);
    });
    this.roomObjects = [];

    // Update the UI list
    this.updateRoomObjectsList();

    if (this.transformGizmo) {
      this.transformGizmo.visible = false;
    }

    // Limpar controles de transformação
    const transformControls = document.getElementById('transformControls');
    if (transformControls) {
      transformControls.innerHTML = '';
    }
  }

  // Função para esconder objetos da sala no modo editor
  hideRoomObjectsFromScene() {
    console.log(`🙈 Escondendo ${this.roomObjects.length} objetos da sala no modo editor`);
    this.roomObjects.forEach(obj => {
      if (obj.meshGroup && obj.meshGroup.parent === this.scene) {
        obj.meshGroup.visible = false;
        console.log(`  - Objeto "${obj.name}" escondido`);
      }
    });
  }

  // Função para restaurar objetos da sala na cena
  restoreRoomObjectsToScene() {
    console.log(`👁️ Restaurando ${this.roomObjects.length} objetos da sala no room mode`);
    this.roomObjects.forEach(obj => {
      if (obj.meshGroup) {
        // Garantir que o objeto está na cena
        if (obj.meshGroup.parent !== this.scene) {
          this.scene.add(obj.meshGroup);
          console.log(`  + Objeto "${obj.name}" adicionado à cena`);
        }
        // Tornar visível
        obj.meshGroup.visible = true;
        console.log(`  - Objeto "${obj.name}" restaurado e visível`);
      }
    });
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

  // Método para adicionar controles de transformação no room-content
  addTransformControls(obj) {
    const transformControls = document.getElementById('transformControls');
    if (!transformControls) return;

    // Limpar controles anteriores
    transformControls.innerHTML = '';

    // Criar container dos controles
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'transform-controls-card';
    controlsContainer.innerHTML = `
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
              <input type="range" class="new-transform-slider" data-transform="position" data-axis="x" data-obj-id="${obj.id}" min="-20" max="20" step="0.1" value="${obj.position.x.toFixed(1)}">
              <span class="slider-value-new">${obj.position.x.toFixed(1)}</span>
            </div>
            <div class="new-transform-slider-group">
              <span class="input-group-label" style="color: #10b981;">Y</span>
              <input type="range" class="new-transform-slider" data-transform="position" data-axis="y" data-obj-id="${obj.id}" min="-20" max="20" step="0.1" value="${obj.position.y.toFixed(1)}">
              <span class="slider-value-new">${obj.position.y.toFixed(1)}</span>
            </div>
            <div class="new-transform-slider-group">
              <span class="input-group-label" style="color: #06b6d4;">Z</span>
              <input type="range" class="new-transform-slider" data-transform="position" data-axis="z" data-obj-id="${obj.id}" min="-20" max="20" step="0.1" value="${obj.position.z.toFixed(1)}">
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
              <input type="range" class="new-transform-slider" data-transform="rotation" data-axis="x" data-obj-id="${obj.id}" min="0" max="360" step="1" value="${THREE.MathUtils.radToDeg(obj.rotation.x).toFixed(0)}">
              <span class="slider-value-new">${THREE.MathUtils.radToDeg(obj.rotation.x).toFixed(0)}°</span>
            </div>
            <div class="new-transform-slider-group">
              <span class="input-group-label" style="color: #10b981;">Y</span>
              <input type="range" class="new-transform-slider" data-transform="rotation" data-axis="y" data-obj-id="${obj.id}" min="0" max="360" step="1" value="${THREE.MathUtils.radToDeg(obj.rotation.y).toFixed(0)}">
              <span class="slider-value-new">${THREE.MathUtils.radToDeg(obj.rotation.y).toFixed(0)}°</span>
            </div>
            <div class="new-transform-slider-group">
              <span class="input-group-label" style="color: #06b6d4;">Z</span>
              <input type="range" class="new-transform-slider" data-transform="rotation" data-axis="z" data-obj-id="${obj.id}" min="0" max="360" step="1" value="${THREE.MathUtils.radToDeg(obj.rotation.z).toFixed(0)}">
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

    transformControls.appendChild(controlsContainer);

    // Adicionar event listeners para os novos controles
    this.addTransformControlListeners(controlsContainer, obj);
  }

  // Método para adicionar event listeners aos controles de transformação
  addTransformControlListeners(container, obj) {
    // Event listeners para sliders de transformação
    container.querySelectorAll('.new-transform-slider').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const transform = e.target.dataset.transform;
        const axis = e.target.dataset.axis;
        const value = parseFloat(e.target.value);
        const valueDisplay = e.target.parentElement.querySelector('.slider-value-new');

        if (transform === 'position') {
          obj.position[axis] = value;
          if (valueDisplay) valueDisplay.textContent = value.toFixed(1);
        } else if (transform === 'rotation') {
          obj.rotation[axis] = THREE.MathUtils.degToRad(value);
          if (valueDisplay) valueDisplay.textContent = `${value.toFixed(0)}°`;
        }
        obj.updateTransform();

        if (obj.selected && this.transformGizmo) {
          this.transformGizmo.position.copy(obj.meshGroup.position);
        }
      });
    });

    // Event listener para sliders de escala
    container.querySelectorAll('.scale-slider').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        const valueDisplay = e.target.parentElement.querySelector('.scale-value');

        obj.scale.x = value;
        obj.scale.y = value;
        obj.scale.z = value;
        obj.updateTransform();
        if (valueDisplay) valueDisplay.textContent = `${value.toFixed(1)}x`;
      });
    });

    // Event listener para sliders de material
    container.querySelectorAll('.material-slider').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const property = e.target.dataset.property;
        const value = parseFloat(e.target.value);
        const valueDisplay = e.target.parentElement.querySelector('.slider-value');

        // Atualizar todas as meshes do objeto
        obj.meshGroup.traverse((child) => {
          if (child.isMesh && child.material) {
            if (property === 'roughness') {
              child.material.roughness = value;
              if (valueDisplay) valueDisplay.textContent = value.toFixed(2);
            } else if (property === 'metalness') {
              child.material.metalness = value;
              if (valueDisplay) valueDisplay.textContent = value.toFixed(2);
            } else if (property === 'emissiveIntensity') {
              child.material.emissiveIntensity = value;
              if (valueDisplay) valueDisplay.textContent = value.toFixed(2);
            }
          }
        });
      });
    });

    // Toggle para expandir/colapsar card
    const header = container.querySelector('.card-header');
    const body = container.querySelector('.card-body');
    const toggleIcon = container.querySelector('.card-toggle-icon');

    header.addEventListener('click', (e) => {
      if (!e.target.closest('.remove-object-btn-new')) {
        body.classList.toggle('collapsed');
        toggleIcon.style.transform = body.classList.contains('collapsed') ? 'rotate(0deg)' : 'rotate(180deg)';
      }
    });

    // Event listener para remover objeto
    container.querySelector('.remove-object-btn-new').addEventListener('click', (e) => {
      e.stopPropagation();
      const objId = parseInt(e.target.closest('.remove-object-btn-new').dataset.objId);

      if (confirm(`Tem certeza que deseja remover "${obj ? obj.name : 'este objeto'}"?`)) {
        this.removeRoomObject(objId);
        // Limpar controles quando objeto for removido
        document.getElementById('transformControls').innerHTML = '';
      }
    });
  }

  // Método para atualizar sistemas (chamado no loop de renderização)
  update() {
    if (this.walkBuildModeSystem) {
      this.walkBuildModeSystem.update();
    }
  }

  // Método auxiliar para obter propriedades de material
  getMaterialProperty(obj, property, defaultValue) {
    if (!obj || !obj.meshGroup) return defaultValue;

    let firstMaterial = null;
    obj.meshGroup.traverse((child) => {
      if (child.isMesh && child.material && !firstMaterial) {
        firstMaterial = child.material;
      }
    });

    if (firstMaterial && firstMaterial[property] !== undefined) {
      return firstMaterial[property];
    }

    return defaultValue;
  }

  // Método para atualizar o estado visual do botão do modo caminhar
  updateWalkModeButtonState() {
    if (!this.enterWalkModeBtn) return;

    const isWalkModeActive = this.walkBuildModeSystem && this.walkBuildModeSystem.isActive;

    if (isWalkModeActive) {
      // Modo caminhar ativo - mostrar botão para sair
      this.enterWalkModeBtn.classList.add('active');
      this.enterWalkModeBtn.removeAttribute('data-tooltip');

      // Mostrar barra se walk mode estiver ativo (independente do room mode)
      if (this.topBar) {
        this.topBar.style.display = 'flex';
      }
    } else {
      // Modo caminhar inativo - mostrar botão para entrar
      this.enterWalkModeBtn.classList.remove('active');
      this.enterWalkModeBtn.setAttribute('data-tooltip', 'Entrar no Modo Caminhar');

      // Mostrar barra por padrão quando walk mode estiver inativo
      if (this.topBar) {
        this.topBar.style.display = 'flex';
      }
    }
  }

  hideEditorVoxels() {
    if (!this.voxels || this.voxels.length === 0) {
      console.log('📝 Nenhum voxel do editor para esconder');
      return;
    }

    console.log(`🙈 Escondendo ${this.voxels.length} voxels do editor no room mode`);
    this.voxels.forEach(voxel => {
      if (voxel && voxel.visible !== undefined) {
        voxel.visible = false;
      }
    });
  }

  showEditorVoxels() {
    if (!this.voxels || this.voxels.length === 0) {
      console.log('📝 Nenhum voxel do editor para mostrar');
      return;
    }

    console.log(`👁️ Mostrando ${this.voxels.length} voxels do editor no modo editor`);
    this.voxels.forEach(voxel => {
      if (voxel && voxel.visible !== undefined) {
        voxel.visible = true;
      }
    });
  }

}