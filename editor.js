// =====================================================================
// EDITOR VOXEL 3D - VERSÃO MODULAR
// =====================================================================

// Aguardar que Three.js, OrbitControls e módulos estejam disponíveis
function waitForDependencies() {
  if (typeof THREE === 'undefined' || 
      typeof OrbitControls === 'undefined' ||
      typeof ColorSystem === 'undefined' ||
      typeof ReferenceImageSystem === 'undefined' ||
      typeof MouseInteractionSystem === 'undefined' ||
      typeof ExportSystem === 'undefined' ||
      typeof VoxelSelectionSystem === 'undefined' ||
      typeof AreaFillSystem === 'undefined' ||
      typeof UploadHistorySystem === 'undefined' ||
      typeof HelpSystem === 'undefined' ||
      typeof EditorLightingSystem === 'undefined' ||
      typeof HybridInteractionSystem === 'undefined') {
    console.log('Aguardando dependências...');
    setTimeout(waitForDependencies, 100);
    return;
  }
  // Dependências carregadas, inicializando editor...
  initEditor();
}

function initEditor() {
  // =====================================================================
  // ELEMENTOS DOM
  // =====================================================================
  const canvas = document.getElementById('three-canvas');
  const colorPalette = document.getElementById('colorPalette');
  const exportBtn = document.getElementById('exportBtn');
  const clearBtn = document.getElementById('clearBtn');
  const undoBtn = document.getElementById('undoBtn');
  const voxelCount = document.getElementById('voxelCount');
  const testBtn = document.getElementById('testBtn');
  const menuBtn = document.getElementById('menuBtn');
  const tutorialBtn = document.getElementById('tutorialBtn');
  const leftPanel = document.getElementById('left-panel');
  const iconToolbar = document.getElementById('icon-toolbar');

  // Inicializar sistema de upload de arquivos
  const fileUploadSystem = new FileUploadSystem();
  window.fileUploadSystem = fileUploadSystem;

  // Inicializar sistema de histórico de uploads
  const uploadHistorySystem = new UploadHistorySystem(
    document.getElementById('upload-history-sidebar'),
    document.getElementById('uploadHistoryBtn'),
    document.getElementById('uploadHistorySidebarCloseBtn'),
    document.getElementById('uploadHistoryList'),
    document.getElementById('voxelFileInput'),
    document.getElementById('icon-toolbar'),
    fileUploadSystem
  );
  window.uploadHistorySystem = uploadHistorySystem;

  // Inicializar sistema de ajuda
  const helpSystem = new HelpSystem(
    document.getElementById('help-button'),
    document.getElementById('help-panel'),
    document.getElementById('help-close')
  );
  window.helpSystem = helpSystem;

  // Elementos da imagem de referência (agora gerenciados pelo FileUploadSystem)
  const referenceUpload = document.getElementById('uploadBtn');
  const referenceImage = document.getElementById('floating-reference-image');
  const referenceControls = document.getElementById('floating-reference-controls');
  const opacityBtn = document.getElementById('floating-opacity-btn');
  const removeRefBtn = document.getElementById('floating-remove-btn');
  const floatingReferencePanel = document.getElementById('floating-reference');

  // Elemento do botão de modo câmera (REMOVIDO)
  // const cameraModeBtn = document.getElementById('cameraModeBtn');

  // Elementos DOM carregados  // =====================================================================
  // INICIALIZAÇÃO DOS MÓDULOS
  // =====================================================================

  // Sistema de cores
  const colorSystem = new ColorSystem(colorPalette);

  // Sistema de exportação (será inicializado após voxels estarem prontos)
  let exportSystem = null;

  // Definir callbacks para o sistema de upload de arquivos
  fileUploadSystem.setCallbacks({
    onVoxelDataLoaded: (voxelData, filename) => {
      console.log('🎯 onVoxelDataLoaded chamado com:', { voxelDataLength: voxelData?.length, filename });

      if (!voxelData || !Array.isArray(voxelData)) {
        alert(`Erro: Dados de voxel inválidos no arquivo "${filename}".`);
        console.error('❌ Dados de voxel inválidos:', voxelData);
        return;
      }

      if (voxelData.length === 0) {
        alert(`Erro: Nenhum voxel encontrado no arquivo "${filename}".`);
        console.warn('⚠️ Array de voxels vazio');
        return;
      }

      console.log(`📊 Processando ${voxelData.length} voxels do arquivo "${filename}"`);

      // Verificar se há voxels válidos
      const validVoxels = voxelData.filter((voxel, index) => {
        const isValid = typeof voxel.x === 'number' &&
                       typeof voxel.y === 'number' &&
                       typeof voxel.z === 'number' &&
                       typeof voxel.color === 'string';

        if (!isValid) {
          console.warn(`⚠️ Voxel ${index} com dados inválidos:`, voxel);
        }
        return isValid;
      });

      if (validVoxels.length === 0) {
        alert(`Erro: Nenhum voxel válido encontrado no arquivo "${filename}".`);
        console.error('❌ Nenhum voxel válido encontrado');
        return;
      }

      console.log(`✅ ${validVoxels.length} voxels válidos encontrados`);

      // Verificar se estamos no modo sala - APENAS tratar como objeto de sala se já estivermos no modo sala
      const isCurrentlyInRoomMode = roomModeSystem && roomModeSystem.isRoomMode;

      if (isCurrentlyInRoomMode) {
        console.log('🏠 Estamos no room mode - tratando como objeto de sala');
        // Usar o callback de objeto de sala
        roomModeSystem.addRoomObject(validVoxels, filename);
        console.log(`✅ Objeto de sala "${filename}" criado com sucesso!`);
        return;
      }

      // Modo tradicional: adicionar voxels individuais
      // Perguntar confirmação ao usuário
      const shouldLoad = confirm(`Carregar ${validVoxels.length} voxels de "${filename}"? Isso irá substituir a cena atual.`);

      if (!shouldLoad) {
        console.log('❌ Usuário cancelou o carregamento');
        return;
      }

      try {
        // Modo editor: carregar voxels diretamente na cena sem ativar room mode
        console.log('🎨 Carregando voxels no modo editor - mantendo modo atual');

        // Limpar cena atual
        clearScene();
        console.log('🧹 Cena limpa para novo carregamento');

        // Adicionar voxels
        let addedCount = 0;
        validVoxels.forEach((voxel) => {
          try {
            addVoxel(voxel.x, voxel.y, voxel.z, voxel.color, false);
            addedCount++;
          } catch (error) {
            console.error('❌ Erro ao adicionar voxel:', voxel, error);
          }
        });

        // Salvar estado
        saveState();

        console.log(`✅ Carregamento concluído: ${addedCount} voxels adicionados de "${filename}"`);
        console.log(`📈 Total de voxels na cena: ${voxels.length}`);

        // Se estamos no modo sala, atualizar a lista de objetos da sala
        if (roomModeSystem && roomModeSystem.isRoomMode) {
          console.log('🏠 Modo sala ativo - controles de transformação atualizados');
          // Always show transform controls for the selected object or the first object if none selected
          const selectedObj = roomModeSystem.roomObjects.find(obj => obj.selected) || roomModeSystem.roomObjects[0];
          if (selectedObj) {
            roomModeSystem.addTransformControls(selectedObj);
          }
        }

        // Atualizar contador de voxels
        updateVoxelCount();

      } catch (error) {
        console.error('❌ Erro durante o carregamento:', error);
        alert('Erro durante o carregamento: ' + error.message);
      }
    },
    onRoomObjectLoaded: (voxelData, filename) => {
      const currentMode = roomModeSystem && roomModeSystem.isRoomMode ? 'room' : 'editor';
      console.log(`🏠 onRoomObjectLoaded chamado no modo ${currentMode} com:`, { voxelDataLength: voxelData?.length, filename });

      if (!voxelData || !Array.isArray(voxelData)) {
        alert(`Erro: Dados de objeto inválidos no arquivo "${filename}".`);
        console.error('❌ Dados de objeto inválidos:', voxelData);
        return;
      }

      if (voxelData.length === 0) {
        alert(`Erro: Nenhum voxel encontrado no arquivo "${filename}".`);
        console.warn('⚠️ Array de voxels vazio para objeto da sala');
        return;
      }

      console.log(`📦 Carregando objeto da sala "${filename}" com ${voxelData.length} voxels no modo ${currentMode}`);

      try {
        // Verificar se estamos no modo sala - NÃO ativar automaticamente
        if (!roomModeSystem || !roomModeSystem.isRoomMode) {
          console.log('⚠️ Upload de objeto da sala detectado, mas não estamos no room mode');
          console.log('💡 O objeto será adicionado à lista mas não será visível até ativar o room mode');
        }

        // Carregar objeto da sala
        roomModeSystem.addRoomObject(voxelData, filename);
        console.log(`✅ Objeto de sala "${filename}" carregado com sucesso!`);

      } catch (error) {
        console.error('❌ Erro ao carregar objeto da sala:', error);
        alert('Erro ao carregar objeto da sala: ' + error.message);
      }
    },
    onReferenceImageLoaded: (imageDataUrl, filename) => {
      referenceSystem.setImage(imageDataUrl);
      console.log(`✅ Imagem de referência "${filename}" carregada.`);
    },
    onError: (message) => {
      alert('Erro no upload: ' + message);
      console.error('Erro no FileUploadSystem:', message);
    }
  });

  // Sistema de imagem de referência
  const referenceSystem = new ReferenceImageSystem(
    referenceUpload, 
    fileUploadSystem, // fileInput is now managed by FileUploadSystem
    referenceImage, 
    referenceControls, 
    opacityBtn, 
    removeRefBtn
  );

  // Inicializar sistema de histórico de uploads
  uploadHistorySystem.init();

  // Inicializar sistema de ajuda
  helpSystem.init();

  // --- New Voxel Uploader Logic ---
  const roomVoxelFileInput = document.getElementById('voxel-file-input');

  if (roomVoxelFileInput && fileUploadSystem) {
    // Handle file selection via the hidden input
    roomVoxelFileInput.addEventListener('change', (event) => {
        // Determinar o tipo de callback baseado no modo atual
        const isRoomMode = roomModeSystem && roomModeSystem.isRoomMode;
        const callbackType = isRoomMode ? 'roomObject' : 'voxel';
        
        console.log(`📁 Upload via room panel - Modo detectado: ${isRoomMode ? 'SALA' : 'EDITOR'} → Callback: ${callbackType}`);
        
        fileUploadSystem.currentCallbackType = callbackType;
        fileUploadSystem.handleFileChange(event);
    });
  }
  // --- End of New Voxel Uploader Logic ---

  // Sistema de IA removido

  // =====================================================================
  // CONFIGURAÇÃO DA CENA 3D
  // =====================================================================

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0a);

  // Inicializar sistema de iluminação do editor
  const editorLightingSystem = new EditorLightingSystem(scene);
  window.editorLightingSystem = editorLightingSystem;

  // Câmera ortográfica
  const size = 20;
  const aspect = canvas.clientWidth / canvas.clientHeight;
  const camera = new THREE.OrthographicCamera(
    -size * aspect, size * aspect, size, -size, 0.1, 1000
  );

  // Posicionamento isométrico
  const angleY = Math.PI / 4;
  const angleX = Math.PI / 6; 
  const distance = 30;

  camera.position.set(
    distance * Math.sin(angleY) * Math.cos(angleX),
    distance * Math.sin(angleX),
    distance * Math.cos(angleY) * Math.cos(angleX)
  );
  camera.lookAt(0, 0, 0);

  // Renderizador
  const renderer = new THREE.WebGLRenderer({ 
    canvas, 
    antialias: true, 
    powerPreference: "high-performance",
    alpha: true 
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  // Renderer otimizado

  resizeRenderer();
  window.addEventListener('resize', resizeRenderer);

  // Inicializar sistema de iluminação do editor
  editorLightingSystem.init();

  function resizeRenderer() {
    const container = document.getElementById('three-container');
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    renderer.setSize(width, height);
    
    const newAspect = width / height;
    camera.left = -size * newAspect;
    camera.right = size * newAspect;
    camera.updateProjectionMatrix();
  }


  // =====================================================================
  // CONTROLES DE CÂMERA E GRADE
  // =====================================================================

  // Sistema de modos de câmera (REMOVIDO - botão removido)
  // let cameraMode = 'orbit'; // 'orbit' ou 'walk'
  let walkBuildModeSystem;

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.enablePan = true;
  controls.enableRotate = false; // Será habilitado dinamicamente
  controls.minZoom = 0.5;
  controls.maxZoom = 2.5;
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN
  };

  // Função para alternar modo de câmera (REMOVIDA - botão removido)
  /*
  function toggleCameraMode() {
    if (walkBuildModeSystem && walkBuildModeSystem.isActive) {
      walkBuildModeSystem.exitWalkMode();
      cameraMode = 'orbit';
      console.log('🎥 Modo órbita ativado');
      controls.enabled = true;
      updateCursor();
    } else {
      if (!walkBuildModeSystem) {
        const editorApi = {
          addVoxel,
          removeVoxel,
          saveState,
          getSelectedColor: () => colorSystem.getSelectedColor(),
          getVoxels: () => voxels,
          updateVoxelCount
        };
        walkBuildModeSystem = new WalkBuildModeSystem(scene, camera, controls, null, editorApi);
      }
      walkBuildModeSystem.originalCamera = camera;
      walkBuildModeSystem.enterWalkMode();
      cameraMode = 'walk';
      console.log('🚶 Modo caminhada e construção ativado');
    }
  }
  */

  // Grade
  const gridHelper = new THREE.GridHelper(50, 50, 0x333366, 0x1a1a2e);
  gridHelper.position.y = -0.5;
  gridHelper.material.opacity = 0.4;
  gridHelper.material.transparent = true;
  scene.add(gridHelper);
  // Grid configurado na cena

  // Plano invisível para detecção de cliques
  const planeGeometry = new THREE.PlaneGeometry(50, 50);
  const planeMaterial = new THREE.MeshBasicMaterial({ 
    visible: false,
    side: THREE.DoubleSide 
  });
  const groundPlane = new THREE.Mesh(planeGeometry, planeMaterial);
  groundPlane.rotation.x = -Math.PI / 2;
  groundPlane.position.y = -0.5;
  groundPlane.receiveShadow = true;
  scene.add(groundPlane);

  // Partículas atmosféricas
  const particleGeometry = new THREE.BufferGeometry();
  const particleCount = 100;
  const positions = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount * 3; i++) {
    positions[i] = (Math.random() - 0.5) * 100;
  }

  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const particleMaterial = new THREE.PointsMaterial({
    color: 0x666699,
    size: 0.5,
    transparent: true,
    opacity: 0.1
  });

  const particles = new THREE.Points(particleGeometry, particleMaterial);
  scene.add(particles);

  // =====================================================================
  // SISTEMA DE INTERAÇÃO DE MOUSE
  // =====================================================================

  const mouseSystem = new MouseInteractionSystem(canvas, camera, scene, groundPlane);

  // =====================================================================
  // GERENCIAMENTO DE VOXELS
  // =====================================================================

  const voxels = [];
  const history = [];
  let historyIndex = -1;

  // Inicializar sistema de exportação
  try {
    exportSystem = new ExportSystem(voxels);
  } catch (error) {
    console.error('❌ Erro ao inicializar sistema de exportação:', error);
    exportSystem = null;
  }

  // Inicializar sistema de seleção de voxels
  let voxelSelectionSystem = null;
  try {
    voxelSelectionSystem = new VoxelSelectionSystem(scene, voxels, saveState, removeVoxel);
  } catch (error) {
    console.error('❌ Erro ao inicializar sistema de seleção:', error);
  }

  // Inicializar sistema de preenchimento de área
  let areaFillSystem = null;
  try {
    areaFillSystem = new AreaFillSystem(scene, voxels, addVoxel, removeVoxel, saveState, () => colorSystem.getSelectedColor());
  } catch (error) {
    console.error('❌ Erro ao inicializar sistema de área:', error);
  }

  function updateVoxelCount() {
    if (voxelCount) {
      voxelCount.textContent = voxels.length.toString();
    }
  }

  function saveState() {
    const state = voxels.map(v => ({
      x: Math.round(v.position.x),
      y: Math.round(v.position.y),
      z: Math.round(v.position.z),
      color: v.userData.color
    }));
    history.splice(historyIndex + 1);
    history.push(state);
    historyIndex = history.length - 1;
    updateVoxelCount();
  }

  function addVoxel(x, y, z, color, saveHistory = true) {
    // Garante alinhamento perfeito na grade
    const gridX = Math.round(x);
    const gridY = Math.round(y);
    const gridZ = Math.round(z);
    
    // Verifica se já existe voxel na posição
    const existingVoxel = voxels.find(voxel => {
      const pos = voxel.position;
      return Math.round(pos.x) === gridX && 
             Math.round(pos.y) === gridY && 
             Math.round(pos.z) === gridZ;
    });
    
    if (existingVoxel) {
      console.log('Já existe voxel na posição:', gridX, gridY, gridZ);
      return; // Não adiciona se já existe voxel
    }
    
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    
    // Verificar se há sistema de texturas e textura selecionada
    let material;
    if (window.textureSystem && window.textureSystem.getCurrentTexture()) {
      const currentTexture = window.textureSystem.getCurrentTexture();
      
      if (window.textureSystem.textureMode === 'single') {
        // Textura única em todas as faces
        material = window.textureSystem.createTexturedMaterial(currentTexture, {
          roughness: 0.4,
          metalness: 0.1
        });
      } else {
        // Modo por face - usar textura atual em todas as faces por enquanto
        const materials = window.textureSystem.createVoxelMaterials({
          all: currentTexture
        });
        material = materials;
      }
      
      console.log(`🎨 Voxel criado com textura: ${currentTexture}`);
    } else {
      // Material padrão sem textura
      material = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.4,
        metalness: 0.1,
        emissive: new THREE.Color(color).multiplyScalar(0.05),
        emissiveIntensity: 0.1
      });
    }

    // Garantir que o material seja completamente sólido
    if (Array.isArray(material)) {
      // Para materiais múltiplos (texturas por face)
      material.forEach(mat => {
        mat.transparent = false;
        mat.opacity = 1.0;
      });
    } else {
      // Para material único
      material.transparent = false;
      material.opacity = 1.0;
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(gridX, gridY, gridZ); // Usa coordenadas alinhadas
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    mesh.userData.isVoxel = true;
    mesh.userData.color = color;
    mesh.userData.originalPosition = { x: gridX, y: gridY, z: gridZ };
    
    scene.add(mesh);
    voxels.push(mesh);
    mouseSystem.addVoxel(mesh);
    
    if (saveHistory) saveState();
  }

  function removeVoxel(mesh, saveHistory = true) {
    // Desselecionar voxel se estiver selecionado
    if (voxelSelectionSystem && voxelSelectionSystem.getSelectedVoxels().has(mesh)) {
      voxelSelectionSystem.getSelectedVoxels().delete(mesh);
      voxelSelectionSystem.removeSelectionHighlight(mesh);
      console.log('➖ Voxel desselecionado automaticamente ao ser excluído');
    }
    
    scene.remove(mesh);
    const idx = voxels.indexOf(mesh);
    if (idx !== -1) voxels.splice(idx, 1);
    mouseSystem.removeVoxel(mesh);
    if (saveHistory) saveState();
  }

  function clearScene() {
    // Limpar todas as seleções antes de remover voxels
    if (voxelSelectionSystem) voxelSelectionSystem.clearSelection();
    if (areaFillSystem) areaFillSystem.clearAreaSelection();
    
    voxels.forEach(voxel => scene.remove(voxel));
    voxels.length = 0;
    mouseSystem.setVoxels([]);
    saveState();
  }

  function undo() {
    if (historyIndex > 0) {
      historyIndex--;
      const state = history[historyIndex];
      
      voxels.forEach(voxel => scene.remove(voxel));
      voxels.length = 0;
      
      state.forEach(v => addVoxel(v.x, v.y, v.z, v.color, false));
      mouseSystem.setVoxels(voxels);
      updateVoxelCount();
    }
  }

  // Configurar callbacks do sistema de mouse
  mouseSystem.setCallbacks(
    addVoxel,
    removeVoxel,
    () => colorSystem.getSelectedColor()
  );

  // =====================================================================
  // EVENT LISTENERS
  // =====================================================================

  if (clearBtn) {
    clearBtn.onclick = () => {
      if (confirm('Tem certeza que deseja limpar toda a cena?')) {
        clearScene();
      }
    };
  }

  if (undoBtn) {
    undoBtn.onclick = undo;
  }

  if (testBtn) {
    testBtn.onclick = () => {
      console.log('Adicionando cubo de teste...');
      addVoxel(0, 0, 0, colorSystem.getSelectedColor());
    };
  }

  // Event listeners for the new room objects sidebar
  // REMOVED: loadRoomObjectBtn event listener

  // REMOVED: Event listener for voxel upload button (moved to sidebar)

  // REMOVED: roomObjectsSidebarCloseBtn event listener

  

  

  if (menuBtn) {
    menuBtn.onclick = () => {
      // Fechar sidebar de histórico se estiver aberto
      if (uploadHistorySystem.isOpen()) {
        uploadHistorySystem.close();
      }

      // Verificar se estamos no modo sala
      if (roomModeSystem && roomModeSystem.isRoomMode) {
        // No modo sala, mostrar o painel esquerdo (color sidebar)
        leftPanel.classList.toggle('show');
        console.log('🎨 Color sidebar toggled in room mode');
      } else {
        // Modo normal do editor
        leftPanel.classList.toggle('show');
      }

      // Atualizar posição da barra de ferramentas considerando todos os estados
      uploadHistorySystem.updateToolbarPosition();
    };
  }


  // =====================================================================
  // ATALHOS DE TECLADO PRINCIPAIS
  // =====================================================================

  document.addEventListener('keydown', (e) => {
    // Atalho Ctrl+Z para desfazer
    if (e.ctrlKey && e.key === 'z') {
      e.preventDefault();
      undo();
    }
    
    // Atalho Delete/Backspace para deletar seleção ou limpar cena
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      if (voxelSelectionSystem && voxelSelectionSystem.hasSelection()) {
        voxelSelectionSystem.deleteSelectedVoxels();
      } else if (confirm('Limpar toda a cena?')) {
        clearScene();
      }
    }
    
    // Movimentação com setas e W/S para voxels selecionados
    if (voxelSelectionSystem && voxelSelectionSystem.hasSelection() && 
        (e.key.startsWith('Arrow') || e.key === 'PageUp' || e.key === 'PageDown' || e.code === 'KeyW' || e.code === 'KeyS')) {
      e.preventDefault();
      voxelSelectionSystem.moveSelectedVoxels(e.code || e.key);
    }
    // Expansão de área com setas e W/S (se há área selecionada e não há voxels selecionados)
    else if (areaFillSystem && areaFillSystem.hasAreaSelected() && 
             (!voxelSelectionSystem || !voxelSelectionSystem.hasSelection()) && 
             (e.key.startsWith('Arrow') || e.key === 'PageUp' || e.key === 'PageDown' || e.code === 'KeyW' || e.code === 'KeyS')) {
      e.preventDefault();
      areaFillSystem.expandArea(e.code || e.key);
    }
    
    // Atalho para selecionar todos os voxels (Ctrl+A)
    if (e.ctrlKey && e.key === 'a') {
      e.preventDefault();
      if (voxelSelectionSystem) voxelSelectionSystem.selectAllVoxels();
    }
    
    // Atalho para limpar seleção (Escape)
    if (e.key === 'Escape') {
      e.preventDefault();
      if (voxelSelectionSystem && voxelSelectionSystem.hasSelection()) {
        voxelSelectionSystem.clearSelection();
        updateCursor();
      } else if (areaFillSystem && areaFillSystem.hasAreaSelected()) {
        areaFillSystem.clearAreaSelection();
        console.log('📦 Área cancelada');
        updateCursor();
      }
    }
    
    // Atalho para alternar modo sala (R)
    if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      if (roomModeSystem) {
        roomModeSystem.toggleRoomMode();
        console.log('🏠 Modo sala alternado via atalho R');
      } else {
        console.warn('⚠️ Sistema de modo sala não disponível');
      }
    }
    
    // Sistema de criação de área com Ctrl (gerenciado pelo HybridInteractionSystem)
    if (e.key === 'Control') {
      // Estado agora gerenciado pelo HybridInteractionSystem
      console.log('🎮 Ctrl pressionado - Modo criação de área ativo');
      console.log('📝 Ctrl + Clique + Arrastar para criar áreas');
      console.log('📝 Setas ← → ↑ ↓ = Expandir horizontalmente');
      console.log('📝 W/S = Expandir para cima/baixo');
    }
    
    // Sistema de seleção e movimentação (gerenciado pelo HybridInteractionSystem)
    if (e.key === 'Shift') {
      // Estado agora gerenciado pelo HybridInteractionSystem
      console.log('🎮 Shift pressionado - Modo seleção ativo');
      console.log('📝 Dicas de seleção:');
      console.log('  • Shift + Clique = Seleção individual');
      console.log('  • Shift + Ctrl + Clique = Seleção por cor');
      console.log('  • Shift + Alt + Clique = Seleção conectada');
      console.log('  • Shift + Arrastar = Mover câmera pela grade');
      console.log('  • Setas ← → ↑ ↓ = Mover horizontalmente');
      console.log('  • W/S = Mover para cima/baixo');
    }
  });

  document.addEventListener('keyup', (e) => {
    if (e.key === 'Control') {
      // Estado agora gerenciado pelo HybridInteractionSystem
      console.log('🎮 Ctrl solto - Modo normal restaurado');
      if (areaFillSystem && areaFillSystem.hasAreaSelected()) {
        console.log('📦 Área ainda ativa - Use setas para expandir ou Escape para cancelar');
      }
    }
    
    if (e.key === 'Shift') {
      // Estado agora gerenciado pelo HybridInteractionSystem  
      console.log('🎮 Shift solto - Modo normal restaurado');
    }
  });

  // Event listeners da IA removidos

  // Funcionalidade de geração automática removida

  // Editor básico inicializado

  // =====================================================================
  // FUNÇÃO HELPER PARA INTERSEÇÕES
  // =====================================================================

  function getIntersection(event) {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    // Converter coordenadas do mouse
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    // Criar lista de objetos para verificar interseção
    const objectsToCheck = [];
    
    // Adicionar handles de redimensionamento (prioridade alta)
    if (areaFillSystem && areaFillSystem.getResizeHandles().length > 0) {
      objectsToCheck.push(...areaFillSystem.getResizeHandles());
      console.log('🔍 Verificando interseção com', areaFillSystem.getResizeHandles().length, 'handles');
    }
    
    // Adicionar voxels
    objectsToCheck.push(...voxels);
    
    // Verificar interseção com todos os objetos
    const allIntersects = raycaster.intersectObjects(objectsToCheck, false);
    
    if (allIntersects.length > 0) {
      console.log('🎯 Interseções encontradas:', allIntersects.length);
      allIntersects.forEach((intersect, index) => {
        console.log(`Interseção ${index}:`, {
          isVoxel: intersect.object.userData.isVoxel,
          isResizeHandle: intersect.object.userData.isResizeHandle,
          distance: intersect.distance
        });
      });
      
      // Retornar a primeira interseção (mais próxima)
      return allIntersects[0];
    }

    // Se não há interseção com objetos, verificar com o plano do chão
    const planeIntersects = raycaster.intersectObject(groundPlane, true);
    if (planeIntersects.length > 0) {
      return planeIntersects[0];
    }

    return null;
  }

  // =====================================================================
  // SISTEMA DE HANDLES VISUAIS PARA REDIMENSIONAMENTO DE ÁREA
  // =====================================================================
  
  function createResizeHandles(area) {
    console.log('🔧 Criando handles para área:', area);
    clearResizeHandles();
    
    const width = area.maxX - area.minX + 1;
    const height = area.maxY - area.minY + 1;
    const depth = area.maxZ - area.minZ + 1;
    
    const centerX = (area.minX + area.maxX) / 2;
    const centerY = (area.minY + area.maxY) / 2;
    const centerZ = (area.minZ + area.maxZ) / 2;
    
    const handleSize = 0.3;
    const handleOffset = 0.7;
    
    console.log('📐 Dimensões calculadas:', { width, height, depth, centerX, centerY, centerZ });
    
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
    
    console.log('🎯 Criando', cornerHandles.length + faceHandles.length, 'handles');
    
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
      
      console.log(`Handle ${index} criado:`, {
        position: data.pos,
        type: data.type,
        directions: data.directions,
        isResizeHandle: handle.userData.isResizeHandle
      });
      
      scene.add(handle);
      areaResizeHandles.push(handle);
      
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
        
        createDimensionLabel(data.label, labelPos, data.color);
      }
      
      // Criar labels informativos para handles de canto (mostrando dimensões completas)
      if (data.type === 'corner' && index === 0) { // Apenas no primeiro canto para não poluir
        const labelPos = [data.pos[0], data.pos[1] + 1.5, data.pos[2]];
        const dimensionText = `${width}×${height}×${depth}`;
        createDimensionLabel(dimensionText, labelPos, 0xffffff);
      }
    });
    
    console.log('✅ Handles criados! Total:', areaResizeHandles.length, 'objetos na cena:', scene.children.length);
  }
  
  function createDimensionLabel(text, position, color) {
    // Criar canvas com alta resolução
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 512;
    canvas.height = 128;
    
    // Fundo completamente transparente - sem quadrado!
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
    // Escala base otimizada para o novo design
    const baseScale = new THREE.Vector3(3.0, 0.75, 1);
    sprite.scale.copy(baseScale);
    sprite.userData.isDimensionLabel = true;
    sprite.userData.originalScale = baseScale.clone();
    
    scene.add(sprite);
    areaDimensionLabels.push(sprite);
  }
  
  function clearResizeHandles() {
    areaResizeHandles.forEach(handle => scene.remove(handle));
    areaDimensionLabels.forEach(label => scene.remove(label));
    areaResizeHandles = [];
    areaDimensionLabels = [];
  }
  // Funções de handle resize movidas para HybridInteractionSystem
  
  // Implementações locais para compatibilidade (serão chamadas via callbacks)
  let isDraggingHandle = false;
  let draggedHandle = null;
  let resizeStartPosition = null;
  let originalAreaBounds = null;
  
  function startHandleResize(handle, mouseEvent) {
    if (!areaFillSystem || !areaFillSystem.getSelectedArea() || !handle.userData.isResizeHandle) {
      console.log('❌ startHandleResize: Condições não atendidas');
      return;
    }
    
    console.log('🔧 INICIANDO REDIMENSIONAMENTO!');
    isDraggingHandle = true;
    draggedHandle = handle;
    originalAreaBounds = { ...areaFillSystem.getSelectedArea() };
    
    // Guardar posição inicial do mouse
    const intersect = getIntersection(mouseEvent);
    if (intersect) {
      resizeStartPosition = {
        x: intersect.point.x, y: intersect.point.y, z: intersect.point.z,
        mouseX: mouseEvent.clientX, mouseY: mouseEvent.clientY
      };
    }
    
    // Desabilitar controles e destacar handle
    controls.enabled = false;
    controls.enableRotate = false;
    controls.enablePan = false;
    controls.enableZoom = false;
    
    handle.material.emissiveIntensity = 0.5;
    handle.scale.set(1.3, 1.3, 1.3);
    handle.material.color.setHex(0xffffff);
    canvas.style.cursor = handle.userData.handleType === 'corner' ? 'nw-resize' : 'ew-resize';
  }
  
  function updateHandleResize(mouseEvent) {
    if (!isDraggingHandle || !draggedHandle || !resizeStartPosition) return;
    
    const deltaMouseX = mouseEvent.clientX - resizeStartPosition.mouseX;
    const deltaMouseY = mouseEvent.clientY - resizeStartPosition.mouseY;
    const sensitivity = 0.1;
    const deltaX = deltaMouseX * sensitivity;
    const deltaY = -deltaMouseY * sensitivity;
    const deltaZ = deltaMouseX * sensitivity * 0.7;
    
    let newArea = { ...originalAreaBounds };
    const directions = draggedHandle.userData.directions;
    
    directions.forEach(direction => {
      switch (direction) {
        case '+x': newArea.maxX = Math.max(originalAreaBounds.minX + 1, Math.round(originalAreaBounds.maxX + deltaX)); break;
        case '-x': newArea.minX = Math.min(originalAreaBounds.maxX - 1, Math.round(originalAreaBounds.minX + deltaX)); break;
        case '+y': newArea.maxY = Math.max(originalAreaBounds.minY + 1, Math.round(originalAreaBounds.maxY + deltaY)); break;
        case '-y': newArea.minY = Math.min(originalAreaBounds.maxY - 1, Math.round(originalAreaBounds.minY + deltaY)); break;
        case '+z': newArea.maxZ = Math.max(originalAreaBounds.minZ + 1, Math.round(originalAreaBounds.maxZ + deltaZ)); break;
        case '-z': newArea.minZ = Math.min(originalAreaBounds.maxZ - 1, Math.round(originalAreaBounds.minZ + deltaZ)); break;
      }
    });
    
    // Verificar limites mínimos
    if (newArea.minX >= newArea.maxX) {
      if (directions.includes('+x')) newArea.maxX = newArea.minX + 1;
      if (directions.includes('-x')) newArea.minX = newArea.maxX - 1;
    }
    if (newArea.minY >= newArea.maxY) {
      if (directions.includes('+y')) newArea.maxY = newArea.minY + 1;
      if (directions.includes('-y')) newArea.minY = newArea.maxY - 1;
    }
    if (newArea.minZ >= newArea.maxZ) {
      if (directions.includes('+z')) newArea.maxZ = newArea.minZ + 1;
      if (directions.includes('-z')) newArea.minZ = newArea.maxZ - 1;
    }
    
    areaFillSystem.selectedArea = newArea;
    areaFillSystem.showAreaSelection(areaFillSystem.selectedArea, true);
    areaFillSystem.createResizeHandles(areaFillSystem.selectedArea);
    
    // Restaurar handle arrastado
    const newDraggedHandle = areaResizeHandles.find(h => 
      h.userData.handleType === draggedHandle.userData.handleType &&
      JSON.stringify(h.userData.directions) === JSON.stringify(draggedHandle.userData.directions)
    );
    if (newDraggedHandle) {
      draggedHandle = newDraggedHandle;
      draggedHandle.material.emissiveIntensity = 0.5;
      draggedHandle.scale.set(1.3, 1.3, 1.3);
    }
  }
  
  function finishHandleResize() {
    if (!isDraggingHandle || !draggedHandle) return;
    
    const addedVoxels = areaFillSystem.fillAreaWithVoxels(areaFillSystem.selectedArea);
    areaFillSystem.removeVoxelsOutsideArea(originalAreaBounds, areaFillSystem.selectedArea);
    
    draggedHandle.material.emissiveIntensity = 0.2;
    draggedHandle.scale.set(1, 1, 1);
    draggedHandle.material.color.setHex(draggedHandle.userData.originalColor);
    canvas.style.cursor = 'default';
    
    controls.enabled = true;
    controls.enableRotate = true;
    controls.enablePan = true;
    controls.enableZoom = true;
    
    isDraggingHandle = false;
    draggedHandle = null;
    resizeStartPosition = null;
    originalAreaBounds = null;
    
    areaFillSystem.showAreaSelection(areaFillSystem.selectedArea);
    areaFillSystem.createResizeHandles(areaFillSystem.selectedArea);
    saveState();
    console.log(`✅ Redimensionamento concluído! Voxels: ${addedVoxels}`);
  }

  // Função handleArrowClick removida - funcionalidade migrada para areaFillSystem
  function handleArrowClick_DEPRECATED(arrow, isShiftHeld = false) {
    if (!selectedArea || !arrow.userData.isExpansionArrow) return;
    
    const direction = arrow.userData.direction;
    const operation = isShiftHeld ? 'contrair' : 'expandir';
    console.log(`🔧 ${operation} na direção: ${arrow.userData.direction}`);
    
    let newArea = { ...selectedArea };
    
    if (isShiftHeld) {
      // CONTRAIR (Shift + clique)
      switch(direction) {
        case '+X':
          newArea.maxX -= 1;
          break;
        case '-X':
          newArea.minX += 1;
          break;
        case '+Y':
          newArea.maxY -= 1;
          break;
        case '-Y':
          newArea.minY += 1;
          break;
        case '+Z':
          newArea.maxZ -= 1;
          break;
        case '-Z':
          newArea.minZ += 1;
          break;
      }
    } else {
      // EXPANDIR (clique normal)
      switch(direction) {
        case '+X':
          newArea.maxX += 1;
          break;
        case '-X':
          newArea.minX -= 1;
          break;
        case '+Y':
          newArea.maxY += 1;
          break;
        case '-Y':
          newArea.minY -= 1;
          break;
        case '+Z':
          newArea.maxZ += 1;
          break;
        case '-Z':
          newArea.minZ -= 1;
          break;
      }
    }
    
    // Verificar limites mínimos
    if (newArea.minX > newArea.maxX || 
        newArea.minY > newArea.maxY || 
        newArea.minZ > newArea.maxZ) {
      console.log(`❌ Não é possível ${operation} mais nesta direção`);
      return;
    }
    
    // Se contraindo, remover voxels que ficaram fora da nova área
    if (isShiftHeld) {
      removeVoxelsOutsideArea(selectedArea, newArea);
    }
    
    // Atualizar área
    selectedArea = newArea;
    showAreaSelection(selectedArea);
    
    // Preencher novos voxels (apenas se expandindo)
    let addedVoxels = 0;
    if (!isShiftHeld) {
      addedVoxels = fillAreaWithVoxels(selectedArea);
    }
    
    // Recriar handles com novas dimensões
    createResizeHandles(selectedArea);
    
    const directionName = {
      '+X': 'direita',
      '-X': 'esquerda',
      '+Y': 'cima',
      '-Y': 'baixo',
      '+Z': 'trás',
      '-Z': 'frente'
    }[direction];
    
    if (isShiftHeld) {
      console.log(`� Área contraída para ${directionName}`);
    } else {
      console.log(`�📈 Área expandida para ${directionName} (+${addedVoxels} voxels)`);
    }
  }
  
  // Função removeVoxelsOutsideArea removida - funcionalidade migrada para areaFillSystem
  function removeVoxelsOutsideArea_DEPRECATED(oldArea, newArea) {
    const voxelsToRemove = [];
    
    voxels.forEach(voxel => {
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
      removeVoxel(voxel, false);
    });
    
    if (voxelsToRemove.length > 0) {
      saveState();
      console.log(`🗑️ ${voxelsToRemove.length} voxels removidos na contração`);
    }
  }


  // =====================================================================
  // EXPOR FUNÇÕES PARA O SISTEMA DE CAMINHADA
  // =====================================================================

  // Tornar funções essenciais disponíveis globalmente para o sistema de caminhada
  window.addVoxel = addVoxel;
  window.removeVoxel = removeVoxel;
  window.saveState = saveState;
  window.voxels = voxels;
  window.colorSystem = colorSystem;
  window.voxelSelectionSystem = voxelSelectionSystem;
  window.areaFillSystem = areaFillSystem;

    // Funções do editor expostas globalmente  // =====================================================================
  // INICIALIZAÇÃO DO SISTEMA DE MODO SALA AMBIENTE
  // =====================================================================

  // Criar instância do sistema de modo sala
  const roomModeSystem = new window.RoomModeSystem(scene, camera, controls, updateCursor, renderer);
  
  // Expor globalmente para acesso em tutoriais
  window.roomModeSystem = roomModeSystem;

  // Configurar variáveis do editor no sistema de sala
  roomModeSystem.setEditorVars(distance, angleX, angleY, voxels);

  // Inicializar event listeners do sistema de sala
  roomModeSystem.init();

  // Time-of-day slider removido - funcionalidade integrada nos controles do room mode

    // Sistema de Modo Sala Ambiente carregado  // =====================================================================
  // CONEXÃO DA BARRA FLUTUANTE COM O SISTEMA DE CAMINHADA
  // =====================================================================

  // Função para controlar visibilidade da barra flutuante baseada no room mode
  function updateFloatingBarVisibility() {
    const topFloatingBar = document.getElementById('top-floating-bar');
    if (!topFloatingBar) return;

    if (roomModeSystem && roomModeSystem.isRoomMode) {
      // Mostrar barra apenas no room mode
      topFloatingBar.classList.add('show');
      console.log('🎨 Barra flutuante mostrada (room mode ativo)');
    } else {
      // Esconder barra quando não estiver no room mode
      topFloatingBar.classList.remove('show');
      console.log('🎨 Barra flutuante escondida (room mode inativo)');
    }
  }

  // =====================================================================
  // LOOP DE RENDERIZAÇÃO
  // =====================================================================

  let frameCount = 0;
  function animate() {
    requestAnimationFrame(animate);
    
    if (particles) {
      particles.rotation.y += 0.001;
    }
    
    // Log a cada 120 frames (aproximadamente 2 segundos a 60fps)
    if (frameCount % 120 === 0) {
      // Frame renderizado
    }
    frameCount++;
    
    controls.update();
    
    // Atualizar sistemas do roomMode
    if (roomModeSystem && typeof roomModeSystem.update === 'function') {
      roomModeSystem.update();
    }
    
    // Atualizar visibilidade da barra flutuante baseada no room mode
    updateFloatingBarVisibility();
    
    // Usar câmera correta baseada no modo ativo
    let activeCamera = camera; // Câmera padrão (OrbitControls)

    if (walkBuildModeSystem && walkBuildModeSystem.isActive) {
      activeCamera = walkBuildModeSystem.walkCamera;
    } else if (roomModeSystem && roomModeSystem.walkBuildModeSystem && roomModeSystem.walkBuildModeSystem.isActive) {
      activeCamera = roomModeSystem.walkBuildModeSystem.walkCamera;
    }
    
    renderer.render(scene, activeCamera);
  }
  animate();

  // =====================================================================
  // FUNCIONALIDADE DE EXPORTAÇÃO
  // =====================================================================

  if (exportBtn) {
    exportBtn.onclick = function () {
      if (exportSystem) {
        exportSystem.export();
      } else {
        console.error('❌ Sistema de exportação não está disponível');
        alert('Erro: Sistema de exportação não está disponível');
      }
    };
  }



  // =====================================================================
  // SISTEMA DE INTERAÇÃO CLIQUE/ARRASTO MELHORADO PARA TRACKPAD
  // =====================================================================

  
  // Variáveis do sistema de área (gerenciadas pelo HybridInteractionSystem)
  // Sistema de preenchimento em área - estado agora no HybridInteractionSystem

  // =====================================================================
  // FUNÇÃO PARA ATUALIZAR CURSOR
  // =====================================================================

  function updateCursor() {
    // Obter estado atual do sistema de interação híbrida
    const interactionState = window.hybridInteractionSystem ? window.hybridInteractionSystem.getState() : {};
    
    if (interactionState.isCreatingArea || interactionState.isAreaDragging) {
      canvas.style.cursor = 'copy'; // Cursor para criação de área
    } else if (interactionState.isInMoveMode && voxelSelectionSystem && voxelSelectionSystem.hasSelection()) {
      canvas.style.cursor = 'grab';
    } else if (interactionState.isDragging && interactionState.isShiftPressed && controls.mouseButtons.LEFT === THREE.MOUSE.PAN) {
      canvas.style.cursor = 'move'; // Cursor para pan da câmera
    } else if (interactionState.isCtrlPressed) {
      canvas.style.cursor = 'copy'; // Cursor de cópia para criação de área
    } else if (interactionState.isShiftPressed) {
      canvas.style.cursor = 'crosshair';
    } else if (areaFillSystem && areaFillSystem.hasAreaSelected()) {
      canvas.style.cursor = 'move'; // Cursor para expandir área
    } else {
      // Cursor normal quando nenhum modificador está ativo
      canvas.style.cursor = "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"34\" height=\"34\" viewBox=\"0 0 34 34\" fill=\"none\"><defs><filter id=\"shadow\" x=\"-50%%\" y=\"-50%%\" width=\"200%%\" height=\"200%%\"><feDropShadow dx=\"2\" dy=\"2\" stdDeviation=\"2\" flood-color=\"rgba(0,0,0,0.8)\"/></filter></defs><path d=\"M6 6 C6 6 6.5 6 7 6.2 L25 16 C25.8 16.4 25.8 16.9 25 17.3 L16 19.5 C15.3 19.7 15 20.1 14.8 20.8 L12.8 28 C12.6 28.7 12 28.7 11.8 28 L6 8.5 C5.7 7.8 5.7 6.3 6 6 Z\" fill=\"black\" stroke=\"white\" stroke-width=\"2.2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" filter=\"url(%23shadow)\"/><path d=\"M8 9 L12 18 L16 20 L23 17.5\" stroke=\"rgba(255,255,255,0.3)\" stroke-width=\"1\" fill=\"none\" stroke-linecap=\"round\"/></svg>') 6 6, auto";
    }
  }
  
  // Sistema de handles visuais para redimensionamento de área (legado)
  let areaResizeHandles = [];
  let areaDimensionLabels = [];
  
  // Função para ajustar tamanho dos labels baseado no zoom da câmera
  function updateLabelSizes() {
    if (!areaDimensionLabels || areaDimensionLabels.length === 0) return;
    
    // Calcular fator de escala baseado no zoom da câmera
    const distance = camera.position.distanceTo(new THREE.Vector3(0, 0, 0));
    const scaleFactor = Math.max(0.8, Math.min(2.5, distance / 15)); // Entre 0.8x e 2.5x
    
    areaDimensionLabels.forEach(label => {
      if (label.userData.originalScale) {
        label.scale.copy(label.userData.originalScale).multiplyScalar(scaleFactor);
      }
    });
  }

  // Habilitar controles de câmera sempre
  controls.enabled = true;
  controls.enableRotate = true; // Sempre habilitado para permitir rotação

  // Adicionar listener para atualizar labels quando a câmera mudar
  controls.addEventListener('change', () => {
    if (typeof updateLabelSizes === 'function') {
      updateLabelSizes();
    }
  });

  // Inicializar sistema de interação híbrida
  const hybridInteractionSystem = new HybridInteractionSystem(
    canvas, camera, controls, colorSystem, areaFillSystem, voxelSelectionSystem, mouseSystem
  );
  window.hybridInteractionSystem = hybridInteractionSystem;

  // Configurar callbacks do sistema de interação
  hybridInteractionSystem.setCallbacks({
    getIntersection,
    removeVoxel,
    updateCursor,
    startHandleResize,
    updateHandleResize,
    finishHandleResize
  });

  // Inicializar sistema de interação
  hybridInteractionSystem.init();

  // =====================================================================
  // INICIALIZAÇÃO DO SISTEMA DE TUTORIAL
  // =====================================================================
  
  function initTutorialSystem() {
    try {
      // Criar instância do sistema de tutorial
      window.tutorialSystem = new TutorialSystem();
      
      // Registrar o tutorial de arrastar objetos
      window.tutorialSystem.registerTutorial('drag-objects', dragObjectsTutorial);
      
      // Sistema de Tutorial inicializado
      
    } catch (error) {
      console.error('❌ Erro ao inicializar sistema de tutorial:', error);
      alert('Erro ao inicializar sistema de tutorial: ' + error.message);
    }
  }

  function showTutorialMenu() {
    const menu = document.createElement('div');
    menu.className = 'tutorial-menu-modal';

    menu.innerHTML = `
      <div class="tutorial-menu-header">
        <h2 class="tutorial-menu-title">🎓 Tutoriais Disponíveis</h2>
        <p class="tutorial-menu-subtitle">Escolha um tutorial para aprender uma funcionalidade</p>
      </div>
      <div class="tutorial-list">
        <div class="tutorial-item" data-tutorial="drag-objects">
          <div class="tutorial-item-content">
            <div class="tutorial-item-icon">🖱️</div>
            <div class="tutorial-item-info">
              <h3 class="tutorial-item-title">Arrastar Objetos</h3>
              <p class="tutorial-item-description">Aprenda a selecionar e mover objetos no modo caminhar</p>
              <div class="tutorial-item-meta">
                <span class="tutorial-difficulty-badge">INICIANTE</span>
                <span class="tutorial-duration">⏱️ 2-3 min</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="tutorial-menu-footer">
        <button id="close-tutorial-menu" class="tutorial-menu-close-btn">Fechar</button>
      </div>
    `;

    const overlay = document.createElement('div');
    overlay.className = 'tutorial-menu-overlay';

    document.body.appendChild(overlay);
    document.body.appendChild(menu);

    const tutorialItems = menu.querySelectorAll('.tutorial-item');
    tutorialItems.forEach(item => {
      item.addEventListener('click', () => {
        const tutorialId = item.dataset.tutorial;
        if (tutorialId && window.tutorialSystem) {
          closeTutorialMenu();
          window.tutorialSystem.startTutorial(tutorialId);
        }
      });
    });

    const closeBtn = menu.querySelector('#close-tutorial-menu');
    closeBtn.addEventListener('click', closeTutorialMenu);
    overlay.addEventListener('click', closeTutorialMenu);

    function closeTutorialMenu() {
      if (overlay.parentNode) document.body.removeChild(overlay);
      if (menu.parentNode) document.body.removeChild(menu);
    }
  }

  function startTutorial(tutorialId) {
    if (!window.tutorialSystem) {
      console.error('Sistema de tutorial não está inicializado');
      return;
    }

    console.log(`🎓 Iniciando tutorial: ${tutorialId}`);
    window.tutorialSystem.startTutorial(tutorialId);
  }


  // Configurar botão de tutorial
  if (tutorialBtn) {
    tutorialBtn.onclick = () => {
      console.log('🎓 Botão de tutorial clicado');
      if (window.tutorialSystem) {
        showTutorialMenu();
        // Remover efeito de pulso após clicar
        tutorialBtn.classList.remove('has-tutorials');
      } else {
        console.warn('⚠️ Sistema de tutorial não encontrado');
      }
    };
    
    // Adicionar efeito de pulso para indicar tutoriais disponíveis
    tutorialBtn.classList.add('has-tutorials');
    // Efeito de pulso adicionado
  }

  // =====================================================================
  // INICIALIZAÇÃO DO SISTEMA DE TEXTURAS
  // =====================================================================
  
  function initTextureSystem() {
    try {
      // Criar instância do sistema de texturas
      window.textureSystem = new TextureSystem();
      
      // Configurar interface de texturas
      setupTextureInterface();
      
      // Sistema de Texturas inicializado
      
    } catch (error) {
      console.error('❌ Erro ao inicializar sistema de texturas:', error);
    }
  }

  function setupTextureInterface() {
    const textureGrid = document.getElementById('texture-grid');
    const currentTextureName = document.getElementById('current-texture-name');
    const textureModeInputs = document.querySelectorAll('input[name="textureMode"]');
    
    if (!textureGrid) {
      console.warn('⚠️ Grid de texturas não encontrado');
      return;
    }

    // Carregar texturas disponíveis
    const availableTextures = window.textureSystem.getAvailableTextures();
    
    availableTextures.forEach(textureData => {
      const textureItem = document.createElement('div');
      textureItem.className = 'texture-item';
      textureItem.dataset.textureName = textureData.name;
      
      const preview = document.createElement('div');
      preview.className = 'texture-preview';
      
      // Usar canvas como preview se disponível
      if (textureData.preview && textureData.preview.tagName === 'CANVAS') {
        preview.style.backgroundImage = `url(${textureData.preview.toDataURL()})`;
      } else if (textureData.preview) {
        preview.style.backgroundImage = `url(${textureData.preview})`;
      }
      
      const name = document.createElement('div');
      name.className = 'texture-name';
      name.textContent = textureData.displayName;
      
      textureItem.appendChild(preview);
      textureItem.appendChild(name);
      
      // Event listener para seleção
      textureItem.addEventListener('click', () => {
        // Remover seleção anterior
        textureGrid.querySelectorAll('.texture-item').forEach(item => {
          item.classList.remove('selected');
        });
        
        // Selecionar atual
        textureItem.classList.add('selected');
        
        // Definir textura atual
        window.textureSystem.setCurrentTexture(textureData.name);
        currentTextureName.textContent = textureData.displayName;
        
        console.log(`🎨 Textura selecionada: ${textureData.displayName}`);
      });
      
      textureGrid.appendChild(textureItem);
    });

    // Event listeners para modo de textura
    textureModeInputs.forEach(input => {
      input.addEventListener('change', (e) => {
        window.textureSystem.textureMode = e.target.value;
        console.log(`🎨 Modo de textura alterado: ${e.target.value}`);
      });
    });

    // Interface de texturas configurada
  }

  // =====================================================================
  // CORREÇÃO DE TRANSPARÊNCIA
  // =====================================================================
  
  function fixExistingVoxelsTransparency() {
    let fixedCount = 0;
    
    voxels.forEach(voxel => {
      if (voxel && voxel.material) {
        if (Array.isArray(voxel.material)) {
          // Material múltiplo (texturas por face)
          voxel.material.forEach(mat => {
            if (mat.transparent === true || mat.opacity < 1.0) {
              mat.transparent = false;
              mat.opacity = 1.0;
              fixedCount++;
            }
          });
        } else {
          // Material único
          if (voxel.material.transparent === true || voxel.material.opacity < 1.0) {
            voxel.material.transparent = false;
            voxel.material.opacity = 1.0;
            fixedCount++;
          }
        }
      }
    });
    
    if (fixedCount > 0) {
      console.log(`🔧 Corrigida transparência de ${fixedCount} voxels existentes`);
    }
  }

  // Inicializar sistema de tutorial
  initTutorialSystem();

  // =====================================================================
  // INICIALIZAÇÃO DO SISTEMA DE CONFIGURAÇÃO DA SALA
  // =====================================================================
  
  function initRoomConfigSystem() {
    try {
      // Aguardar que o sistema de texturas esteja pronto
      if (!window.textureSystem) {
        console.warn('⚠️ Sistema de texturas não encontrado para configuração da sala');
        return;
      }

      // Criar instância do sistema de configuração da sala
      window.roomConfigSystem = new RoomConfigSystem(scene, window.textureSystem);
      
      // Configurar interface de configuração da sala
      setupRoomConfigInterface();
      
      // Sistema de Configuração da Sala inicializado
      
    } catch (error) {
      console.error('❌ Erro ao inicializar sistema de configuração da sala:', error);
    }
  }

  function setupRoomConfigInterface() {
    // Elementos da interface
    const roomWidthSlider = document.getElementById('room-width');
    const roomHeightSlider = document.getElementById('room-height');
    const roomDepthSlider = document.getElementById('room-depth');
    const roomWidthValue = document.getElementById('room-width-value');
    const roomHeightValue = document.getElementById('room-height-value');
    const roomDepthValue = document.getElementById('room-depth-value');
    
    const floorTextureSelect = document.getElementById('floor-texture');
    const wallsTextureSelect = document.getElementById('walls-texture');
    const ceilingTextureSelect = document.getElementById('ceiling-texture');
    
    const applyConfigBtn = document.getElementById('apply-room-config');
    const resetConfigBtn = document.getElementById('reset-room-config');

    if (!roomWidthSlider || !applyConfigBtn) {
      console.warn('⚠️ Elementos da interface de configuração da sala não encontrados');
      return;
    }

    // Variáveis para rastrear se dimensões foram alteradas pelo usuário
    let dimensionsModified = false;
    let initialDimensions = null;
    
    // Capturar dimensões iniciais
    const captureInitialDimensions = () => {
      if (!initialDimensions) {
        initialDimensions = {
          width: parseInt(roomWidthSlider.value),
          height: parseInt(roomHeightSlider.value),
          depth: parseInt(roomDepthSlider.value)
        };
        console.log('📎 Dimensões iniciais capturadas:', initialDimensions);
      }
    };
    
    // Event listeners para sliders de dimensão
    roomWidthSlider.addEventListener('input', (e) => {
      roomWidthValue.textContent = `${e.target.value}m`;
      captureInitialDimensions();
      dimensionsModified = true;
      console.log('📏 Largura alterada pelo usuário');
    });

    roomHeightSlider.addEventListener('input', (e) => {
      roomHeightValue.textContent = `${e.target.value}m`;
      captureInitialDimensions();
      dimensionsModified = true;
      console.log('📏 Altura alterada pelo usuário');
    });

    roomDepthSlider.addEventListener('input', (e) => {
      roomDepthValue.textContent = `${e.target.value}m`;
      captureInitialDimensions();
      dimensionsModified = true;
      console.log('📏 Profundidade alterada pelo usuário');
    });

    // Event listeners para seleção de texturas
    floorTextureSelect.addEventListener('change', (e) => {
      console.log(`🎨 Textura do chão selecionada: ${e.target.value}`);
    });

    wallsTextureSelect.addEventListener('change', (e) => {
      console.log(`🎨 Textura das paredes selecionada: ${e.target.value}`);
    });

    ceilingTextureSelect.addEventListener('change', (e) => {
      console.log(`🎨 Textura do teto selecionada: ${e.target.value}`);
    });

    // Botão aplicar texturas (apenas texturas, sem alterar dimensões)
    applyConfigBtn.addEventListener('click', () => {
      const texturesConfig = {
        floor: floorTextureSelect.value,
        walls: wallsTextureSelect.value,
        ceiling: ceilingTextureSelect.value
      };

      console.log('� Aplicando apenas texturas (preservando dimensões e portas):', texturesConfig);
      
      // SEMPRE aplicar apenas texturas - nunca redimensionar
      window.roomConfigSystem.applyTexturesOnly(texturesConfig);
      
      // Feedback visual
      applyConfigBtn.textContent = '✅ Aplicado!';
      setTimeout(() => {
        applyConfigBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20,6 9,17 4,12"/>
          </svg>
          Aplicar Texturas
        `;
      }, 2000);
    });

    // Botão resetar configuração
    resetConfigBtn.addEventListener('click', () => {
      // Resetar para valores padrão
      roomWidthSlider.value = 20;
      roomHeightSlider.value = 10;
      roomDepthSlider.value = 20;
      roomWidthValue.textContent = '20m';
      roomHeightValue.textContent = '10m';
      roomDepthValue.textContent = '20m';
      
      floorTextureSelect.value = 'wood_oak';
      wallsTextureSelect.value = 'wallpaper_stripes';
      ceilingTextureSelect.value = 'marble_white';
      
      // Resetar flags de controle
      dimensionsModified = true; // Forçar reconstrução no reset
      initialDimensions = null;

      console.log('🔄 Configuração da sala resetada');
      
      // Feedback visual
      resetConfigBtn.textContent = '✅ Resetado!';
      setTimeout(() => {
        resetConfigBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23,4 23,10 17,10"/>
            <path d="M20.49,15a9,9,0,1,1-2.12-9.36L23,10"/>
          </svg>
          Resetar
        `;
      }, 2000);
    });

    // Interface de configuração da sala configurada
  }

  // Inicializar sistema de texturas
  initTextureSystem();

  // =====================================================================
  // INICIALIZAÇÃO DO SISTEMA DE PORTAS E JANELAS
  // =====================================================================
  
  function initDoorWindowSystem() {
    try {
      // Aguardar que o sistema de configuração da sala esteja pronto
      if (!window.roomConfigSystem) {
        console.warn('⚠️ Sistema de configuração da sala não encontrado para portas e janelas');
        return;
      }

      // Criar instância do sistema de portas e janelas
      window.doorWindowSystem = new DoorWindowSystem(scene, window.roomConfigSystem);
      
      // Configurar interface de portas e janelas
      setupDoorWindowInterface();
      
      // Sistema de Portas e Janelas inicializado
      
    } catch (error) {
      console.error('❌ Erro ao inicializar sistema de portas e janelas:', error);
    }
  }

  function setupDoorWindowInterface() {
    // Elementos da interface de portas
    const doorWallSelect = document.getElementById('door-wall-select');
    const doorIdInput = document.getElementById('door-id');
    const doorPosXSlider = document.getElementById('door-pos-x');
    const doorPosXValue = document.getElementById('door-pos-x-value');
    const createDoorBtn = document.getElementById('create-door-btn');
    const doorsList = document.getElementById('doors-list');

    // Elementos da interface de janelas
    const windowWallSelect = document.getElementById('window-wall-select');
    const windowIdInput = document.getElementById('window-id');
    const windowPosXSlider = document.getElementById('window-pos-x');
    const windowPosXValue = document.getElementById('window-pos-x-value');
    const windowPosYSlider = document.getElementById('window-pos-y');
    const windowPosYValue = document.getElementById('window-pos-y-value');
    const windowCanOpenCheckbox = document.getElementById('window-can-open');
    const createWindowBtn = document.getElementById('create-window-btn');
    const windowsList = document.getElementById('windows-list');

    if (!createDoorBtn || !createWindowBtn) {
      console.warn('⚠️ Elementos da interface de portas e janelas não encontrados');
      return;
    }

    // Event listeners para sliders de posição das portas
    doorPosXSlider.addEventListener('input', (e) => {
      doorPosXValue.textContent = `${parseFloat(e.target.value).toFixed(1)}m`;
    });

    // Event listeners para sliders de posição das janelas
    windowPosXSlider.addEventListener('input', (e) => {
      windowPosXValue.textContent = `${parseFloat(e.target.value).toFixed(1)}m`;
    });

    windowPosYSlider.addEventListener('input', (e) => {
      windowPosYValue.textContent = `${parseFloat(e.target.value).toFixed(1)}m`;
    });

    // Botão criar porta
    createDoorBtn.addEventListener('click', () => {
      const doorId = doorIdInput.value.trim();
      const wallName = doorWallSelect.value;
      const posX = parseFloat(doorPosXSlider.value);

      if (!doorId) {
        alert('Por favor, insira um ID para a porta');
        return;
      }

      // Verificar se ID já existe
      if (window.doorWindowSystem.doors.has(doorId)) {
        alert('Uma porta com este ID já existe');
        return;
      }

      // Criar porta
      const door = window.doorWindowSystem.createDoor(doorId, wallName, { x: posX, y: 0 });
      
      if (door) {
        // Atualizar lista de portas
        updateDoorsList();
        
        // Incrementar ID para próxima porta
        const nextId = doorId.replace(/\d+$/, (match) => parseInt(match) + 1);
        doorIdInput.value = nextId;
        
        console.log(`🚪 Porta '${doorId}' criada com sucesso`);
      }
    });

    // Botão criar janela (funcionalidade desabilitada)
    createWindowBtn.addEventListener('click', () => {
      alert('Funcionalidade de janelas foi removida. Apenas portas estão disponíveis.');
    });

    // Função para atualizar lista de portas
    function updateDoorsList() {
      doorsList.innerHTML = '';
      
      const doors = window.doorWindowSystem.getDoors();
      doors.forEach(door => {
        const doorItem = document.createElement('div');
        doorItem.className = 'door-window-item';
        doorItem.innerHTML = `
          <div class="door-window-item-info">
            <div class="door-window-item-name">🚪 ${door.id}</div>
            <div class="door-window-item-details">${door.wallName} • x: ${door.position.x.toFixed(1)}m</div>
          </div>
          <div class="door-window-item-actions">
            <button class="door-window-item-btn toggle" onclick="toggleDoor('${door.id}')">
              ${door.isOpen ? '🔓' : '🔒'}
            </button>
            <button class="door-window-item-btn remove" onclick="removeDoor('${door.id}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3,6 5,6 21,6"/>
                <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
              </svg>
            </button>
          </div>
        `;
        doorsList.appendChild(doorItem);
      });
    }

    // Função para atualizar lista de janelas
    function updateWindowsList() {
      // Funcionalidade de janelas foi removida - limpar lista
      windowsList.innerHTML = '<div class="door-window-empty">Funcionalidade de janelas removida</div>';
    }

    // Expor funções globalmente para os botões
    window.toggleDoor = (doorId) => {
      window.doorWindowSystem.toggleDoor(doorId);
      updateDoorsList();
    };

    window.toggleWindow = (windowId) => {
      alert('Funcionalidade de janelas foi removida.');
    };

    window.removeDoor = (doorId) => {
      if (confirm(`Tem certeza que deseja remover a porta '${doorId}'?`)) {
        window.doorWindowSystem.removeDoor(doorId);
        updateDoorsList();
      }
    };

    window.removeWindow = (windowId) => {
      alert('Funcionalidade de janelas foi removida.');
    };

    // Interface de portas e janelas configurada
  }

  // Inicializar sistema de configuração da sala
  initRoomConfigSystem();

  // Inicializar sistema de portas e janelas
  initDoorWindowSystem();

  // Corrigir transparência de voxels existentes
  fixExistingVoxelsTransparency();

  // Carregar módulo de correção de iluminação
  loadLightingFixer();
  
  // Carregar sistema de dispersão de luz
  loadLightDispersionSystem();

} // Fim da função initEditor()

// =====================================================================
// CARREGAMENTO DOS MÓDULOS FINAIS
// =====================================================================

// Carregar módulo de correção de iluminação
async function loadLightingFixer() {
  try {
    // Carregando módulo de correção de iluminação
    await import('./modules/lightingFixer.js');
    // Módulo de correção de iluminação carregado
  } catch (error) {
    console.warn('⚠️ Erro ao carregar módulo de correção:', error);
  }
}

// Carregar sistema de dispersão de luz
async function loadLightDispersionSystem() {
  try {
    // Carregando sistema de dispersão de luz
    
    await import('./modules/lightDispersionSystem.js');
    
    // Inicializar após um pequeno delay para garantir que os objetos estejam prontos
    setTimeout(() => {
      if (window.scene && window.renderer && window.camera) {
        console.log('🌟 Inicializando sistema de dispersão de luz...');
        // O sistema se auto-inicializa, mas vamos garantir
        if (typeof initLightDispersionSystem === 'function') {
          initLightDispersionSystem(window.scene, window.renderer, window.camera);
        }
      }
    }, 500);
    
    // Sistema de dispersão de luz carregado
  } catch (error) {
    console.error('❌ Erro ao carregar sistema de dispersão de luz:', error);
  }
}

// Iniciar quando dependências estiverem prontas
waitForDependencies();