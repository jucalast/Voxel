// =====================================================================
// EDITOR VOXEL 3D - VERSÃO MODULAR
// =====================================================================

// Aguardar que Three.js, OrbitControls e módulos estejam disponíveis
function waitForDependencies() {
  if (typeof THREE === 'undefined' || 
      typeof OrbitControls === 'undefined' ||
      typeof ColorSystem === 'undefined' ||
      typeof ReferenceImageSystem === 'undefined' ||
      typeof MouseInteractionSystem === 'undefined') {
    console.log('Aguardando dependências...');
    setTimeout(waitForDependencies, 100);
    return;
  }
  console.log('Dependências carregadas, inicializando editor...');
  initEditor();
}

function initEditor() {
  // =====================================================================
  // ELEMENTOS DOM
  // =====================================================================
  const canvas = document.getElementById('three-canvas');
  const colorPalette = document.getElementById('colorPalette');
  const exportBtn = document.getElementById('exportBtn');
  const importBtn = document.getElementById('importBtn');
  const clearBtn = document.getElementById('clearBtn');
  const undoBtn = document.getElementById('undoBtn');
  const voxelCount = document.getElementById('voxelCount');
  const testBtn = document.getElementById('testBtn');
  const menuBtn = document.getElementById('menuBtn');
  const leftPanel = document.getElementById('left-panel');
  const iconToolbar = document.getElementById('icon-toolbar');
  
  // Elementos do sistema de ajuda
  const helpButton = document.getElementById('help-button');
  const helpPanel = document.getElementById('help-panel');
  const helpClose = document.getElementById('help-close');

  // Elementos da IA removidos

  // Elementos da imagem de referência
  const referenceUpload = document.getElementById('uploadBtn');
  const referenceFileInput = document.getElementById('fileInput');
  const referenceImage = null; // Não existe mais na sidebar
  const referenceControls = null; // Não existe mais na sidebar  
  const opacityBtn = null; // Não existe mais na sidebar
  const removeRefBtn = null; // Não existe mais na sidebar

  console.log('Elementos DOM carregados');

  // =====================================================================
  // INICIALIZAÇÃO DOS MÓDULOS
  // =====================================================================

  // Sistema de cores
  const colorSystem = new ColorSystem(colorPalette);

  // Sistema de imagem de referência
  const referenceSystem = new ReferenceImageSystem(
    referenceUpload, 
    referenceFileInput, 
    referenceImage, 
    referenceControls, 
    opacityBtn, 
    removeRefBtn
  );

  // Sistema de IA removido

  // =====================================================================
  // CONFIGURAÇÃO DA CENA 3D
  // =====================================================================

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0a);

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
  renderer.toneMapping = THREE.LinearToneMapping;
  renderer.toneMappingExposure = 1.0;

  resizeRenderer();
  window.addEventListener('resize', resizeRenderer);

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
  // ILUMINAÇÃO
  // =====================================================================

  const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(15, 25, 15);
  directionalLight.target.position.set(0, 0, 0);

  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 100;
  directionalLight.shadow.camera.left = -30;
  directionalLight.shadow.camera.right = 30;
  directionalLight.shadow.camera.top = 30;
  directionalLight.shadow.camera.bottom = -30;
  directionalLight.shadow.bias = -0.0001;

  scene.add(directionalLight);
  scene.add(directionalLight.target);

  const fillLight = new THREE.DirectionalLight(0x8080ff, 0.15);
  fillLight.position.set(-10, 15, -10);
  scene.add(fillLight);

  const backLight = new THREE.DirectionalLight(0xff8080, 0.1);
  backLight.position.set(0, 10, -15);
  scene.add(backLight);

  // =====================================================================
  // CONTROLES DE CÂMERA E GRADE
  // =====================================================================

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

  // Grade
  const gridHelper = new THREE.GridHelper(50, 50, 0x333366, 0x1a1a2e);
  gridHelper.position.y = -0.5;
  gridHelper.material.opacity = 0.4;
  gridHelper.material.transparent = true;
  scene.add(gridHelper);
  console.log('Grid adicionado à cena:', gridHelper);
  console.log('Objetos na cena após adicionar grid:', scene.children.length);

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

  function updateVoxelCount() {
    voxelCount.textContent = voxels.length.toString();
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
    
    console.log('Adicionando voxel na grade:', gridX, gridY, gridZ, color);
    
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
    const material = new THREE.MeshStandardMaterial({ 
      color,
      roughness: 0.8,
      metalness: 0.0,
      transparent: false,
      emissive: new THREE.Color(color).multiplyScalar(0.1)
    });
    
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
    if (selectedVoxels.has(mesh)) {
      selectedVoxels.delete(mesh);
      removeSelectionHighlight(mesh);
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
    clearSelection();
    clearAreaSelection();
    
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

  clearBtn.onclick = () => {
    if (confirm('Tem certeza que deseja limpar toda a cena?')) {
      clearScene();
    }
  };

  undoBtn.onclick = undo;

  importBtn.onclick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.html,.json';
    input.onchange = handleFileImport;
    input.click();
  };

  testBtn.onclick = () => {
    console.log('Adicionando cubo de teste...');
    addVoxel(0, 0, 0, colorSystem.getSelectedColor());
  };

  menuBtn.onclick = () => {
    leftPanel.classList.toggle('show');
    
    // Mover barra de ferramentas baseado no estado do painel
    if (leftPanel.classList.contains('show')) {
      // Painel aberto: mover barra para a direita do painel
      iconToolbar.style.left = '345px'; // 55px (nova posição do painel) + 300px (largura) + 20px (espaço para barra maior)
    } else {
      // Painel fechado: voltar barra para posição original
      iconToolbar.style.left = '10px';
    }
  };

  // Sistema de ajuda
  helpButton.onclick = () => {
    helpPanel.classList.toggle('show');
    console.log('📚 Painel de ajuda alternado');
  };

  helpClose.onclick = () => {
    helpPanel.classList.remove('show');
    console.log('📚 Painel de ajuda fechado');
  };

  // Fechar painel de ajuda ao clicar fora
  document.addEventListener('click', (e) => {
    if (helpPanel.classList.contains('show') && 
        !helpPanel.contains(e.target) && 
        !helpButton.contains(e.target)) {
      helpPanel.classList.remove('show');
    }
  });

  // Atalho F1 para abrir ajuda
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F1') {
      e.preventDefault();
      helpPanel.classList.toggle('show');
    }
  });

  // Sistema de ajuda
  helpButton.onclick = () => {
    helpPanel.classList.toggle('show');
    console.log('📚 Painel de ajuda alternado');
  };

  helpClose.onclick = () => {
    helpPanel.classList.remove('show');
    console.log('📚 Painel de ajuda fechado');
  };

  // Fechar painel de ajuda ao clicar fora
  document.addEventListener('click', (e) => {
    if (helpPanel.classList.contains('show') && 
        !helpPanel.contains(e.target) && 
        !helpButton.contains(e.target)) {
      helpPanel.classList.remove('show');
    }
  });

  // Atalho F1 para abrir ajuda
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F1') {
      e.preventDefault();
      helpPanel.classList.toggle('show');
    }
  });

  // Event listeners da IA removidos

  // Funcionalidade de geração automática removida

  console.log('✅ Editor básico inicializado');
  console.log('🎮 Modo manual de edição de voxels ativo');

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
    if (areaResizeHandles && areaResizeHandles.length > 0) {
      objectsToCheck.push(...areaResizeHandles);
      console.log('🔍 Verificando interseção com', areaResizeHandles.length, 'handles');
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
  // SISTEMA DE PREENCHIMENTO EM ÁREA
  // =====================================================================

  function clearFillPreview() {
    fillPreviewVoxels.forEach(preview => {
      scene.remove(preview);
    });
    fillPreviewVoxels = [];
  }

  function clearAreaSelection() {
    isAreaSelected = false;
    selectedArea = null;
    isCreatingArea = false;
    isAreaDragging = false;
    areaCreationStartPos = null;
    clearAreaVisualization();
    clearFillPreview();
    
    // Reabilitar todos os controles quando sair do modo de área
    controls.enabled = true;
    controls.enableRotate = true;
    controls.enablePan = true;
    controls.enableZoom = true;
    
    updateCursor();
  }

  function clearAreaVisualization() {
    // Remove visualização da área selecionada
    const existingAreaBox = scene.getObjectByName('areaSelection');
    if (existingAreaBox) {
      scene.remove(existingAreaBox);
    }
    areaBox = null;
    
    // Limpar handles de redimensionamento
    clearResizeHandles();
  }

  function createFillPreview(start, end, color) {
    clearFillPreview();

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
          const existingVoxel = voxels.find(voxel => 
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
            
            scene.add(previewMesh);
            fillPreviewVoxels.push(previewMesh);
          }
        }
      }
    }
  }

  function fillArea(start, end, color) {
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
          const existingVoxel = voxels.find(voxel => 
            Math.round(voxel.position.x) === x && 
            Math.round(voxel.position.y) === y && 
            Math.round(voxel.position.z) === z
          );

          if (!existingVoxel) {
            addVoxel(x, y, z, color, false);
            addedCount++;
          }
        }
      }
    }

    // Salvar estado uma vez no final
    if (addedCount > 0) {
      saveState();
    }

    // Criar área selecionada para expansão
    selectedArea = {
      minX, maxX, minY, maxY, minZ, maxZ,
      color: color
    };
    isAreaSelected = true;
    showAreaSelection(selectedArea);

    console.log(`Área preenchida: ${addedCount} voxels adicionados`);
  }

  function showAreaSelection(area) {
    clearAreaVisualization();

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

    areaBox = new THREE.Mesh(boxGeometry, boxMaterial);
    areaBox.position.set(centerX, centerY, centerZ);
    areaBox.name = 'areaSelection';
    
    scene.add(areaBox);
    
    // Criar handles visuais para redimensionamento
    createResizeHandles(area);
    
    console.log(`📐 Área: ${width}x${height}x${depth} (${width * height * depth} voxels)`);
  }
  
  function createAreaFromDrag(startPos, endPos) {
    const minX = Math.min(startPos.x, endPos.x);
    const maxX = Math.max(startPos.x, endPos.x);
    const minY = Math.min(startPos.y, endPos.y);
    const maxY = Math.max(startPos.y, endPos.y);
    const minZ = Math.min(startPos.z, endPos.z);
    const maxZ = Math.max(startPos.z, endPos.z);
    
    selectedArea = {
      minX, maxX, minY, maxY, minZ, maxZ,
      color: colorSystem.getSelectedColor()
    };
    
    isAreaSelected = true;
    showAreaSelection(selectedArea);
    
    // Preencher a área imediatamente
    fillAreaWithVoxels(selectedArea);
    
    console.log(`📦 Área criada: ${maxX-minX+1}x${maxY-minY+1}x${maxZ-minZ+1}`);
    console.log('🎮 Use as setas para expandir a área!');
  }
  
  function fillAreaWithVoxels(area) {
    let addedCount = 0;
    
    for (let x = area.minX; x <= area.maxX; x++) {
      for (let y = area.minY; y <= area.maxY; y++) {
        for (let z = area.minZ; z <= area.maxZ; z++) {
          // Verificar se já existe voxel na posição
          const existingVoxel = voxels.find(voxel => 
            Math.round(voxel.position.x) === x && 
            Math.round(voxel.position.y) === y && 
            Math.round(voxel.position.z) === z
          );

          if (!existingVoxel) {
            addVoxel(x, y, z, area.color, false);
            addedCount++;
          }
        }
      }
    }
    
    if (addedCount > 0) {
      saveState();
    }
    
    return addedCount;
  }

  function expandArea(direction) {
    if (!selectedArea) {
      console.log('❌ Nenhuma área selecionada para expandir');
      return;
    }

    const { minX, maxX, minY, maxY, minZ, maxZ, color } = selectedArea;
    let newArea = { ...selectedArea };

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
    selectedArea = newArea;
    showAreaSelection(selectedArea);
    
    // Preencher apenas os novos voxels
    const addedVoxels = fillAreaWithVoxels(selectedArea);
    
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

  // Atalhos de teclado
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'z') {
      e.preventDefault();
      undo();
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      if (selectedVoxels.size > 0) {
        deleteSelectedVoxels();
      } else if (confirm('Limpar toda a cena?')) {
        clearScene();
      }
    }
    
    // Sistema de criação de área com Ctrl
    if (e.key === 'Control') {
      if (!isCtrlPressed) {
        isCtrlPressed = true;
        updateCursor();
        console.log('🎮 Ctrl pressionado - Modo criação de área ativo');
        console.log('📝 Ctrl + Clique + Arrastar para criar áreas');
        console.log('📝 Setas ← → ↑ ↓ = Expandir horizontalmente');
        console.log('📝 W/S = Expandir para cima/baixo');
      }
    }
    
    // Sistema de seleção e movimentação
    if (e.key === 'Shift') {
      if (!isShiftPressed) {
        isShiftPressed = true;
        isInMoveMode = true;
        updateCursor();
        console.log('🎮 Shift pressionado - Modo seleção ativo');
        console.log('📝 Dicas de seleção:');
        console.log('  • Shift + Clique = Seleção individual');
        console.log('  • Shift + Ctrl + Clique = Seleção por cor');
        console.log('  • Shift + Alt + Clique = Seleção conectada');
        console.log('  • Shift + Arrastar = Mover câmera pela grade');
        console.log('  • Setas ← → ↑ ↓ = Mover horizontalmente');
        console.log('  • W/S = Mover para cima/baixo');
      }
    }
    
    // Movimentação com setas e W/S
    if (selectedVoxels.size > 0 && (e.key.startsWith('Arrow') || e.key === 'PageUp' || e.key === 'PageDown' || e.code === 'KeyW' || e.code === 'KeyS')) {
      e.preventDefault();
      moveSelectedVoxels(e.code || e.key);
    }
    // Expansão de área com setas e W/S (se há área selecionada e não há voxels selecionados)
    else if (isAreaSelected && selectedArea && selectedVoxels.size === 0 && (e.key.startsWith('Arrow') || e.key === 'PageUp' || e.key === 'PageDown' || e.code === 'KeyW' || e.code === 'KeyS')) {
      e.preventDefault();
      expandArea(e.code || e.key);
    }
    
    // Atalho para selecionar todos os voxels
    if (e.ctrlKey && e.key === 'a') {
      e.preventDefault();
      selectAllVoxels();
    }
    
    // Atalho para limpar seleção
    if (e.key === 'Escape') {
      e.preventDefault();
      if (selectedVoxels.size > 0) {
        clearSelection();
        updateCursor();
      } else if (isAreaSelected) {
        clearAreaSelection();
        console.log('📦 Área cancelada');
        updateCursor();
      }
    }
  });

  document.addEventListener('keyup', (e) => {
    if (e.key === 'Control') {
      isCtrlPressed = false;
      isInMoveMode = false;
      
      // Limpar previews apenas se não há área ativa
      if (!isAreaSelected) {
        clearFillPreview();
        clearAreaSelection();
      }
      
      updateCursor();
      
      // Reset do sistema
      isDoubleClicking = false;
      isCreatingArea = false;
      isAreaDragging = false;
      
      // Reabilitar todos os controles apenas se não estamos em modo de área
      if (!isAreaSelected) {
        controls.enabled = true;
        controls.enableRotate = true;
        controls.enablePan = true;
        controls.enableZoom = true;
      }
      
      console.log('🎮 Ctrl solto - Modo normal restaurado');
      if (isAreaSelected) {
        console.log('📦 Área ainda ativa - Use setas para expandir ou Escape para cancelar');
      }
    }
    
    if (e.key === 'Shift') {
      isShiftPressed = false;
      isInMoveMode = false;
      
      // Reset do sistema de seleção
      isDoubleClicking = false;
      
      // Reabilitar todos os controles apenas se não há área ativa
      if (!isAreaSelected) {
        controls.enabled = true;
        controls.enableRotate = true;
        controls.enablePan = true;
        controls.enableZoom = true;
      }
      
      updateCursor();
      console.log('🎮 Shift solto - Modo normal restaurado');
    }
  });

  // Função para atualizar cursor baseado no modo
  function updateCursor() {
    if (isCreatingArea || isAreaDragging) {
      canvas.style.cursor = 'copy'; // Cursor para criação de área
    } else if (isInMoveMode && selectedVoxels.size > 0) {
      canvas.style.cursor = 'grab';
    } else if (isDragging && isShiftPressed && controls.mouseButtons.LEFT === THREE.MOUSE.PAN) {
      canvas.style.cursor = 'move'; // Cursor para pan da câmera
    } else if (isCtrlPressed) {
      canvas.style.cursor = 'copy'; // Cursor de cópia para criação de área
    } else if (isShiftPressed) {
      canvas.style.cursor = 'crosshair';
    } else if (isAreaSelected) {
      canvas.style.cursor = 'move'; // Cursor para expandir área
    } else {
      // Cursor normal quando nenhum modificador está ativo
      canvas.style.cursor = "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"34\" height=\"34\" viewBox=\"0 0 34 34\" fill=\"none\"><defs><filter id=\"shadow\" x=\"-50%%\" y=\"-50%%\" width=\"200%%\" height=\"200%%\"><feDropShadow dx=\"2\" dy=\"2\" stdDeviation=\"2\" flood-color=\"rgba(0,0,0,0.8)\"/></filter></defs><path d=\"M6 6 C6 6 6.5 6 7 6.2 L25 16 C25.8 16.4 25.8 16.9 25 17.3 L16 19.5 C15.3 19.7 15 20.1 14.8 20.8 L12.8 28 C12.6 28.7 12 28.7 11.8 28 L6 8.5 C5.7 7.8 5.7 6.3 6 6 Z\" fill=\"black\" stroke=\"white\" stroke-width=\"2.2\" stroke-linejoin=\"round\" stroke-linecap=\"round\" filter=\"url(%23shadow)\"/><path d=\"M8 9 L12 18 L16 20 L23 17.5\" stroke=\"rgba(255,255,255,0.3)\" stroke-width=\"1\" fill=\"none\" stroke-linecap=\"round\"/></svg>') 6 6, auto";
      console.log('🖱️ Cursor voltou ao normal');
    }
  }

  // =====================================================================
  // SISTEMA DE MOVIMENTAÇÃO COM ARRASTAR (MODO VISUAL)
  // =====================================================================
  
  let dragPreviewMeshes = [];
  let isDraggingWithMouse = false;
  
  function startDragPreview(startPos) {
    if (selectedVoxels.size === 0) return;
    
    clearDragPreview();
    isDraggingWithMouse = true;
    
    // Criar preview visual dos voxels sendo arrastados
    selectedVoxels.forEach(voxel => {
      const previewGeometry = new THREE.BoxGeometry(0.95, 0.95, 0.95);
      const previewMaterial = new THREE.MeshBasicMaterial({
        color: voxel.userData.color,
        transparent: true,
        opacity: 0.6,
        wireframe: false
      });
      
      const previewMesh = new THREE.Mesh(previewGeometry, previewMaterial);
      previewMesh.position.copy(voxel.position);
      previewMesh.userData.originalVoxel = voxel;
      previewMesh.userData.isPreview = true;
      
      scene.add(previewMesh);
      dragPreviewMeshes.push(previewMesh);
      
      // Esconder voxel original temporariamente
      voxel.visible = false;
      if (voxel.userData.selectionOutline) {
        voxel.userData.selectionOutline.visible = false;
      }
    });
    
    console.log('🚀 Iniciado preview de arrastar');
  }
  
  function updateDragPreview(currentPos, startPos) {
    if (dragPreviewMeshes.length === 0 || !startPos || !currentPos) return;
    
    // Calcular deslocamento em coordenadas de grade
    const deltaX = Math.round(currentPos.x - startPos.x);
    const deltaY = Math.round(currentPos.y - startPos.y);
    const deltaZ = Math.round(currentPos.z - startPos.z);
    
    // Atualizar posição dos previews
    dragPreviewMeshes.forEach(preview => {
      const originalVoxel = preview.userData.originalVoxel;
      const originalPos = originalVoxel.userData.originalPosition || originalVoxel.position;
      
      preview.position.set(
        originalPos.x + deltaX,
        originalPos.y + deltaY,
        originalPos.z + deltaZ
      );
    });
  }
  
  function finishDrag(finalPos, startPos) {
    if (dragPreviewMeshes.length === 0 || !startPos || !finalPos) {
      cancelDrag();
      return;
    }
    
    // Calcular movimento final
    const deltaX = Math.round(finalPos.x - startPos.x);
    const deltaY = Math.round(finalPos.y - startPos.y);
    const deltaZ = Math.round(finalPos.z - startPos.z);
    
    // Verificar se é um movimento válido
    if (deltaX === 0 && deltaY === 0 && deltaZ === 0) {
      cancelDrag();
      return;
    }
    
    clearDragPreview();
    
    // Executar movimento real
    moveVoxelsBy(deltaX, deltaY, deltaZ);
    
    console.log(`✅ Arrastar finalizado: (${deltaX}, ${deltaY}, ${deltaZ})`);
  }
  
  function cancelDrag() {
    clearDragPreview();
    console.log('❌ Arrastar cancelado');
  }
  
  function clearDragPreview() {
    // Remover previews
    dragPreviewMeshes.forEach(preview => {
      scene.remove(preview);
      
      // Reexibir voxel original
      const originalVoxel = preview.userData.originalVoxel;
      if (originalVoxel) {
        originalVoxel.visible = true;
        if (originalVoxel.userData.selectionOutline) {
          originalVoxel.userData.selectionOutline.visible = true;
        }
      }
    });
    
    dragPreviewMeshes = [];
    isDraggingWithMouse = false;
  }

  // =====================================================================
  // SISTEMA DE PREVIEW DE ÁREA DURANTE CRIAÇÃO
  // =====================================================================
  
  let areaPreviewBox = null;
  
  function createAreaPreview(startPos, endPos) {
    clearAreaPreview();
    
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
    
    areaPreviewBox = new THREE.Mesh(previewGeometry, previewMaterial);
    areaPreviewBox.position.set(centerX, centerY, centerZ);
    areaPreviewBox.name = 'areaPreview';
    
    scene.add(areaPreviewBox);
    
    console.log(`📦 Preview: ${width}x${height}x${depth}`);
  }
  
  function clearAreaPreview() {
    if (areaPreviewBox) {
      scene.remove(areaPreviewBox);
      areaPreviewBox = null;
    }
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
  

  
  function startHandleResize(handle, mouseEvent) {
    if (!selectedArea || !handle.userData.isResizeHandle) {
      console.log('❌ startHandleResize: Condições não atendidas');
      return;
    }
    
    console.log('🔧 INICIANDO REDIMENSIONAMENTO!');
    console.log('Handle:', handle.userData);
    console.log('Área atual:', selectedArea);
    
    isDraggingHandle = true;
    draggedHandle = handle;
    originalAreaBounds = { ...selectedArea };
    
    // Guardar posição inicial do mouse
    const intersect = getIntersection(mouseEvent);
    if (intersect) {
      resizeStartPosition = {
        x: intersect.point.x,
        y: intersect.point.y,
        z: intersect.point.z,
        mouseX: mouseEvent.clientX,
        mouseY: mouseEvent.clientY
      };
      console.log('Posição inicial:', resizeStartPosition);
    }
    
    // Desabilitar TODOS os controles APENAS durante o arrasto do handle
    controls.enabled = false;
    controls.enableRotate = false;
    controls.enablePan = false;
    controls.enableZoom = false;
    
    // Destacar handle sendo arrastado
    handle.material.emissiveIntensity = 0.5;
    handle.scale.set(1.3, 1.3, 1.3);
    handle.material.color.setHex(0xffffff);
    
    // Mudar cursor para indicar redimensionamento
    canvas.style.cursor = handle.userData.handleType === 'corner' ? 'nw-resize' : 'ew-resize';
    
    console.log(`🔧 Redimensionamento iniciado - Tipo: ${handle.userData.handleType}`);
  }
  
  function updateHandleResize(mouseEvent) {
    if (!isDraggingHandle || !draggedHandle || !resizeStartPosition) return;
    
    // Calcular movimento do mouse
    const deltaMouseX = mouseEvent.clientX - resizeStartPosition.mouseX;
    const deltaMouseY = mouseEvent.clientY - resizeStartPosition.mouseY;
    
    // Converter movimento do mouse em movimento 3D com sensibilidade melhorada
    const sensitivity = 0.1; // Aumentar sensibilidade
    const deltaX = deltaMouseX * sensitivity;
    const deltaY = -deltaMouseY * sensitivity; // Inverter Y
    const deltaZ = deltaMouseX * sensitivity * 0.7; // Z um pouco menos sensível
    
    let newArea = { ...originalAreaBounds };
    const directions = draggedHandle.userData.directions;
    
    // Aplicar mudanças baseado nas direções do handle
    directions.forEach(direction => {
      switch (direction) {
        case '+x':
          newArea.maxX = Math.max(originalAreaBounds.minX + 1, Math.round(originalAreaBounds.maxX + deltaX));
          break;
        case '-x':
          newArea.minX = Math.min(originalAreaBounds.maxX - 1, Math.round(originalAreaBounds.minX + deltaX));
          break;
        case '+y':
          newArea.maxY = Math.max(originalAreaBounds.minY + 1, Math.round(originalAreaBounds.maxY + deltaY));
          break;
        case '-y':
          newArea.minY = Math.min(originalAreaBounds.maxY - 1, Math.round(originalAreaBounds.minY + deltaY));
          break;
        case '+z':
          newArea.maxZ = Math.max(originalAreaBounds.minZ + 1, Math.round(originalAreaBounds.maxZ + deltaZ));
          break;
        case '-z':
          newArea.minZ = Math.min(originalAreaBounds.maxZ - 1, Math.round(originalAreaBounds.minZ + deltaZ));
          break;
      }
    });
    
    // Verificar limites mínimos (área deve ter pelo menos 1x1x1)
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
    
    // Atualizar área temporariamente para preview
    selectedArea = newArea;
    showAreaSelection(selectedArea, true); // true = modo preview
    
    // Recriar handles com nova posição
    createResizeHandles(selectedArea);
    
    // Restaurar estado do handle sendo arrastado
    const newDraggedHandle = areaResizeHandles.find(h => 
      h.userData.handleType === draggedHandle.userData.handleType &&
      JSON.stringify(h.userData.directions) === JSON.stringify(draggedHandle.userData.directions)
    );
    
    if (newDraggedHandle) {
      draggedHandle = newDraggedHandle;
      draggedHandle.material.emissiveIntensity = 0.5;
      draggedHandle.scale.set(1.3, 1.3, 1.3);
    }
    
    console.log(`🔄 Redimensionando: ${JSON.stringify(newArea)}`);
  }
  
  function finishHandleResize() {
    if (!isDraggingHandle || !draggedHandle) {
      console.log('❌ finishHandleResize: Não estava redimensionando');
      return;
    }
    
    console.log('✅ FINALIZANDO REDIMENSIONAMENTO');
    console.log('Nova área:', selectedArea);
    
    // Preencher área com voxels se necessário
    const addedVoxels = fillAreaWithVoxels(selectedArea);
    
    // Remover voxels que ficaram fora da nova área
    removeVoxelsOutsideArea(originalAreaBounds, selectedArea);
    
    // Restaurar aparência do handle
    draggedHandle.material.emissiveIntensity = 0.2;
    draggedHandle.scale.set(1, 1, 1);
    draggedHandle.material.color.setHex(draggedHandle.userData.originalColor);
    
    // Restaurar cursor
    canvas.style.cursor = 'default';
    
    // Restaurar TODOS os controles após redimensionamento
    controls.enabled = true;
    controls.enableRotate = true;
    controls.enablePan = true;
    controls.enableZoom = true;
    
    // Reset variáveis
    isDraggingHandle = false;
    draggedHandle = null;
    resizeStartPosition = null;
    originalAreaBounds = null;
    
    // Atualizar visualização final
    showAreaSelection(selectedArea);
    createResizeHandles(selectedArea);
    
    saveState();
    
    console.log(`✅ Redimensionamento concluído! Voxels adicionados: ${addedVoxels}`);
  }

  function handleArrowClick(arrow, isShiftHeld = false) {
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
  
  function removeVoxelsOutsideArea(oldArea, newArea) {
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
  // SISTEMA DE SELEÇÃO E MOVIMENTAÇÃO DE VOXELS
  // =====================================================================
  
  // Variáveis para sistema de seleção e movimentação
  let selectedVoxels = new Set();
  let isDraggingVoxels = false;
  let dragStartPosition = null;
  let voxelPreviewMeshes = [];
  let isInMoveMode = false;
  
  function toggleVoxelSelection(voxel, selectionMode = 'single') {
    switch (selectionMode) {
      case 'single':
        toggleSingleVoxel(voxel);
        break;
      case 'color':
        selectByColor(voxel);
        break;
      case 'connected':
        selectConnected(voxel);
        break;
    }
    
    updateCursor();
    updateSelectionInfo();
  }
  
  function toggleSingleVoxel(voxel) {
    if (selectedVoxels.has(voxel)) {
      selectedVoxels.delete(voxel);
      removeSelectionHighlight(voxel);
      console.log(`➖ Voxel desmarcado. Total: ${selectedVoxels.size}`);
    } else {
      selectedVoxels.add(voxel);
      addSelectionHighlight(voxel);
      console.log(`➕ Voxel selecionado. Total: ${selectedVoxels.size}`);
    }
  }
  
  function selectByColor(clickedVoxel) {
    const targetColor = clickedVoxel.userData.color;
    let addedCount = 0;
    
    // Primeiro, limpar seleção anterior
    clearSelection();
    
    voxels.forEach(voxel => {
      if (voxel.userData.color === targetColor) {
        selectedVoxels.add(voxel);
        addSelectionHighlight(voxel);
        addedCount++;
      }
    });
    
    console.log(`� Selecionados ${addedCount} voxels pela cor ${targetColor}`);
  }
  
  function selectConnected(startVoxel) {
    const connectedVoxels = findConnectedVoxels(startVoxel);
    let addedCount = 0;
    
    // Primeiro, limpar seleção anterior
    clearSelection();
    
    connectedVoxels.forEach(voxel => {
      selectedVoxels.add(voxel);
      addSelectionHighlight(voxel);
      addedCount++;
    });
    
    console.log(`🔗 Selecionados ${addedCount} voxels conectados`);
  }
  
  function findConnectedVoxels(startVoxel) {
    console.log('🔍 Iniciando busca de voxels conectados a partir de:', startVoxel.position);
    const connected = new Set();
    const toCheck = [startVoxel];
    
    while (toCheck.length > 0) {
      const current = toCheck.pop();
      if (connected.has(current)) continue;
      
      connected.add(current);
      console.log('➕ Adicionado voxel conectado na posição:', current.position);
      
      // Procurar voxels adjacentes (6 direções)
      const neighbors = findAdjacentVoxels(current);
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
  
  function findAdjacentVoxels(voxel) {
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
      
      const neighbor = voxels.find(v => 
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
  
  function addSelectionHighlight(voxel) {
    // Criar outline brilhante para voxel selecionado
    const outlineGeometry = new THREE.BoxGeometry(1.1, 1.1, 1.1);
    const outlineMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.3,
      wireframe: true,
      wireframeLinewidth: 2
    });
    
    const outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
    outline.position.copy(voxel.position);
    outline.userData.isSelectionOutline = true;
    outline.userData.parentVoxel = voxel;
    
    scene.add(outline);
    voxel.userData.selectionOutline = outline;
  }
  
  function removeSelectionHighlight(voxel) {
    if (voxel.userData.selectionOutline) {
      scene.remove(voxel.userData.selectionOutline);
      delete voxel.userData.selectionOutline;
    }
  }
  
  function clearSelection() {
    selectedVoxels.forEach(voxel => {
      removeSelectionHighlight(voxel);
    });
    selectedVoxels.clear();
    updateSelectionInfo();
    console.log('🔄 Seleção limpa');
  }
  
  function updateSelectionInfo() {
    if (selectedVoxels.size > 0) {
      console.log(`🎯 ${selectedVoxels.size} voxels selecionados`);
    }
  }
  
  function deleteSelectedVoxels() {
    if (selectedVoxels.size === 0) return;
    
    const toDelete = Array.from(selectedVoxels);
    toDelete.forEach(voxel => {
      removeSelectionHighlight(voxel);
      removeVoxel(voxel);
    });
    selectedVoxels.clear();
    
    console.log(`🗑️ ${toDelete.length} voxels deletados`);
  }
  
  function selectAllVoxels() {
    clearSelection();
    voxels.forEach(voxel => {
      selectedVoxels.add(voxel);
      addSelectionHighlight(voxel);
    });
    updateSelectionInfo();
    console.log(`🎨 Todos os voxels selecionados (${voxels.length})`);
  }
  
  function moveSelectedVoxels(direction) {
    if (selectedVoxels.size === 0) return;
    
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
    
    moveVoxelsBy(deltaX, deltaY, deltaZ);
  }
  
  function moveVoxelsBy(deltaX, deltaY, deltaZ) {
    // Verificar se todas as novas posições estão livres
    const newPositions = [];
    const canMove = Array.from(selectedVoxels).every(voxel => {
      const newPos = {
        x: Math.round(voxel.position.x + deltaX),
        y: Math.round(voxel.position.y + deltaY),
        z: Math.round(voxel.position.z + deltaZ)
      };
      
      // Verificar se não há colisão com voxel não selecionado
      const collision = voxels.find(v => {
        if (selectedVoxels.has(v)) return false; // Ignorar voxels selecionados
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
      
      saveState();
      const direction = deltaX !== 0 ? (deltaX > 0 ? 'direita' : 'esquerda') :
                       deltaY !== 0 ? (deltaY > 0 ? 'cima' : 'baixo') :
                       deltaZ !== 0 ? (deltaZ > 0 ? 'trás' : 'frente') : '';
      console.log(`🔄 ${selectedVoxels.size} voxels movidos para ${direction}`);
    } else {
      console.log('❌ Movimento bloqueado - colisão detectada');
    }
  }

  // Salvar estado inicial
  saveState();

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
      console.log('Renderizando frame', frameCount, '- Objetos na cena:', scene.children.length);
    }
    frameCount++;
    
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  // =====================================================================
  // FUNCIONALIDADE DE EXPORTAÇÃO
  // =====================================================================

  exportBtn.onclick = function () {
    const voxelData = collectSceneData();
    
    // Mostrar opções de exportação
    const exportType = prompt('Escolha o formato de exportação:\\n1 - HTML (visualizador completo)\\n2 - JSON (apenas dados)\\n\\nDigite 1 ou 2:', '1');
    
    if (exportType === '1') {
      // Exportar como HTML
      const html = generateExportHTML(voxelData);
      downloadHTMLFile(html, 'sua-arte-voxel.html');
    } else if (exportType === '2') {
      // Exportar como JSON
      const jsonData = JSON.stringify(voxelData, null, 2);
      downloadJSONFile(jsonData, 'voxel-data.json');
    } else if (exportType !== null) {
      alert('Opção inválida. Use 1 para HTML ou 2 para JSON.');
    }
  };

  function collectSceneData() {
    return voxels.map(voxel => ({
      x: Math.round(voxel.position.x),
      y: Math.round(voxel.position.y), 
      z: Math.round(voxel.position.z),
      color: voxel.userData.color
    }));
  }

  function generateExportHTML(voxelData) {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🎨 Arte Voxel 3D - Criado com Vertex</title>
  <link rel="icon" type="image/png" href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyJpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNiAoV2luZG93cykiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6OUJGMTY3MkY0RUU2MTFFQ0I5OTlBQjVBMTFFNjA4NEMiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6OUJGMTY3MzA0RUU2MTFFQ0I5OTlBQjVBMTFFNjA4NEMiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDo5QkYxNjcyRDRFRTYxMUVDQjk5OUFCNUE0tEU2MDg0QyIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDo5QkYxNjcyRTRFRTYxMUVDQjk5OUFCNUE0tEU2MDg0QyIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PtKh8TcAAAASSURBVHjaYvz//z8DJQAggAADAKJQAv5TIQq5AAAAAElFTkSuQmCC">
  <style>
    body { 
      margin: 0; 
      background: linear-gradient(135deg, #0c0c0c 0%, #1a1a1a 100%);
      overflow: hidden;
      font-family: 'Arial', sans-serif;
    }
    canvas { 
      display: block; 
      width: 100vw; 
      height: 100vh; 
    }
    #info {
      position: absolute;
      top: 20px;
      left: 20px;
      color: #FFD700;
      background: rgba(0,0,0,0.8);
      padding: 15px 20px;
      border-radius: 10px;
      font-size: 14px;
      border: 1px solid rgba(255, 215, 0, 0.3);
      backdrop-filter: blur(10px);
    }
    #controls {
      position: absolute;
      bottom: 20px;
      left: 20px;
      color: #ccc;
      background: rgba(0,0,0,0.7);
      padding: 10px 15px;
      border-radius: 8px;
      font-size: 12px;
    }
    #loading {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: #FFD700;
      font-size: 20px;
      background: rgba(0,0,0,0.9);
      padding: 30px;
      border-radius: 15px;
      text-align: center;
      border: 1px solid rgba(255, 215, 0, 0.3);
    }
    .spinner {
      border: 3px solid rgba(255, 215, 0, 0.3);
      border-radius: 50%;
      border-top: 3px solid #FFD700;
      width: 30px;
      height: 30px;
      animation: spin 1s linear infinite;
      margin: 10px auto;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .error {
      background: rgba(255, 68, 68, 0.1);
      border: 1px solid rgba(255, 68, 68, 0.3);
      color: #ff4444;
    }
  </style>
</head>
<body>
  <div id="loading">
    <div class="spinner"></div>
    🎨 Carregando sua arte voxel...<br>
    <small>Inicializando visualizador 3D</small>
  </div>
  <canvas id="three-canvas" style="display: none;"></canvas>
  <div id="info" style="display: none;">
    <div><strong>🎨 Arte Voxel 3D</strong></div>
    <div>Voxels: <span id="voxel-count">${voxelData.length}</span></div>
    <div style="color: #7c3aed; font-weight: bold;">Criado com ◼ Vertex</div>
  </div>
  <div id="controls" style="display: none;">
    <div><strong>Controles:</strong></div>
    <div>🖱️ Arrastar: Rotacionar</div>
    <div>🔍 Scroll: Zoom</div>
    <div>🖱️ Shift + Arrastar: Mover</div>
  </div>
  
  <script type="importmap">
    {
      "imports": {
        "three": "https://unpkg.com/three@0.155.0/build/three.module.js",
        "three/addons/": "https://unpkg.com/three@0.155.0/examples/jsm/"
      }
    }
  </script>
  
  <script type="module">
    // Dados dos voxels
    const voxelData = ${JSON.stringify(voxelData, null, 4)};
    
    // Função para mostrar erro
    function showError(message) {
      const loading = document.getElementById('loading');
      loading.className = 'error';
      loading.innerHTML = \`
        ❌ Erro ao carregar<br>
        <small>\${message}</small><br><br>
        💡 Dica: Verifique sua conexão com a internet
      \`;
    }
    
    // Função para esconder loading
    function hideLoading() {
      document.getElementById('loading').style.display = 'none';
      document.getElementById('three-canvas').style.display = 'block';
      document.getElementById('info').style.display = 'block';
      document.getElementById('controls').style.display = 'block';
    }
    
    // Inicialização
    async function init() {
      try {
        // Importar Three.js e OrbitControls
        const THREE = await import('three');
        const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
        
        // Simular carregamento para melhor UX
        setTimeout(hideLoading, 800);
        
        // Configurar Three.js
        const canvas = document.getElementById('three-canvas');
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0a0a0a);
        
        // Configurar câmera
        const size = 20;
        const aspect = window.innerWidth / window.innerHeight;
        const camera = new THREE.OrthographicCamera(
          -size * aspect, size * aspect, 
          size, -size, 
          0.1, 1000
        );
        
        // Posicionar câmera
        const angleY = Math.PI / 4;
        const angleX = Math.PI / 6; 
        const distance = 28;
        camera.position.set(
          distance * Math.sin(angleY) * Math.cos(angleX),
          distance * Math.sin(angleX),
          distance * Math.cos(angleY) * Math.cos(angleX)
        );
        camera.lookAt(0, 0, 0);
        
        // Configurar renderer
        const renderer = new THREE.WebGLRenderer({ 
          canvas, 
          antialias: true,
          alpha: true
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // Redimensionamento
        window.addEventListener('resize', () => {
          const newAspect = window.innerWidth / window.innerHeight;
          camera.left = -size * newAspect;
          camera.right = size * newAspect;
          camera.updateProjectionMatrix();
          renderer.setSize(window.innerWidth, window.innerHeight);
        });
        
        // Iluminação
        scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 20, 10);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        scene.add(directionalLight);
        
        // Controles
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.enablePan = true;
        controls.minZoom = 0.3;
        controls.maxZoom = 3;
        
        // Grade
        const gridHelper = new THREE.GridHelper(40, 40, 0x444444, 0x222222);
        gridHelper.position.y = -0.5;
        scene.add(gridHelper);
        
        // Criar voxels
        const voxelGroup = new THREE.Group();
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        
        voxelData.forEach(voxel => {
          const material = new THREE.MeshLambertMaterial({ 
            color: voxel.color,
          });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.set(voxel.x, voxel.y, voxel.z);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          voxelGroup.add(mesh);
        });
        
        scene.add(voxelGroup);
        
        // Loop de animação
        function animate() {
          requestAnimationFrame(animate);
          controls.update();
          renderer.render(scene, camera);
        }
        animate();
        
        console.log('🎨 Arte voxel carregada com sucesso!');
        console.log('Total de voxels:', voxelData.length);
        
      } catch (error) {
        console.error('❌ Erro ao carregar:', error);
        showError(error.message || 'Erro desconhecido');
      }
    }
    
    // Inicializar quando a página carregar
    init();
  </script>
</body>
</html>`;
  }

  function downloadHTMLFile(htmlContent, filename) {
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = filename;
    
    document.body.appendChild(downloadLink);
    downloadLink.click();
    
    setTimeout(() => {
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(url);
    }, 100);
  }

  function downloadJSONFile(jsonContent, filename) {
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = filename;
    
    document.body.appendChild(downloadLink);
    downloadLink.click();
    
    setTimeout(() => {
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(url);
    }, 100);
  }

  // =====================================================================
  // FUNCIONALIDADE DE IMPORTAÇÃO
  // =====================================================================

  function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    console.log('📁 Carregando arquivo:', file.name);

    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const fileContent = e.target.result;
        let voxelData = null;
        
        // Detectar tipo de arquivo
        if (file.name.toLowerCase().endsWith('.json')) {
          // Arquivo JSON direto
          voxelData = JSON.parse(fileContent);
        } else if (file.name.toLowerCase().endsWith('.html')) {
          // Arquivo HTML exportado
          voxelData = extractVoxelDataFromHTML(fileContent);
        } else {
          throw new Error('Tipo de arquivo não suportado. Use arquivos .html ou .json');
        }
        
        if (voxelData && voxelData.length > 0) {
          loadVoxelData(voxelData);
          console.log(`✅ ${voxelData.length} voxels carregados com sucesso!`);
        } else {
          alert('Nenhum dado de voxel encontrado no arquivo.');
        }
      } catch (error) {
        console.error('❌ Erro ao carregar arquivo:', error);
        alert('Erro ao carregar arquivo: ' + error.message);
      }
    };
    
    reader.readAsText(file);
  }

  function extractVoxelDataFromHTML(htmlContent) {
    try {
      // Procurar pelo objeto voxelData no JavaScript do arquivo
      const voxelDataMatch = htmlContent.match(/const voxelData = (\[[\s\S]*?\]);/);
      
      if (voxelDataMatch && voxelDataMatch[1]) {
        // Usar JSON.parse para converter a string em objeto
        const voxelData = JSON.parse(voxelDataMatch[1]);
        console.log('🔍 Dados extraídos:', voxelData.length, 'voxels');
        return voxelData;
      }
      
      throw new Error('Formato de arquivo não reconhecido');
    } catch (error) {
      console.error('Erro ao extrair dados:', error);
      throw error;
    }
  }

  function loadVoxelData(voxelData) {
    // Limpar cena atual
    if (confirm(`Carregar ${voxelData.length} voxels? Isso irá substituir a cena atual.`)) {
      clearScene();
      
      // Adicionar cada voxel
      voxelData.forEach((voxel, index) => {
        // Validar dados do voxel
        if (typeof voxel.x === 'number' && 
            typeof voxel.y === 'number' && 
            typeof voxel.z === 'number' && 
            typeof voxel.color === 'string') {
          
          addVoxel(voxel.x, voxel.y, voxel.z, voxel.color, false);
        } else {
          console.warn(`⚠️ Voxel ${index} com dados inválidos:`, voxel);
        }
      });
      
      // Salvar estado uma vez após carregar tudo
      saveState();
      
      console.log(`✅ Importação concluída: ${voxels.length} voxels na cena`);
    }
  }

  console.log('Editor inicializado com sucesso!');
  console.log('Cena criada com', scene.children.length, 'objetos');
  console.log('Renderer ativo:', !!renderer);
  console.log('Camera posicionada em:', camera.position);

  // =====================================================================
  // SISTEMA DE INTERAÇÃO CLIQUE/ARRASTO MELHORADO PARA TRACKPAD
  // =====================================================================

  let isMouseDown = false;
  let isDragging = false;
  let mouseDownTime = 0;
  let mouseDownPosition = { x: 0, y: 0 };
  let lastTouchTime = 0;
  let touchCount = 0;
  
  const DRAG_THRESHOLD = 8; // Aumentado para trackpad
  const CLICK_TIME_THRESHOLD = 300; // Aumentado para trackpad
  const DOUBLE_CLICK_TIME = 500; // Tempo para double-click
  
  // Sistema de preenchimento em área
  let isCtrlPressed = false;
  let isShiftPressed = false;
  let fillStartPos = null;
  let fillEndPos = null;
  let fillPreviewVoxels = [];
  let selectedArea = null;
  let isAreaSelected = false;
  let isDoubleClicking = false;
  
  // NOVO: Sistema de área expansível
  let isCreatingArea = false;
  let areaCreationStartPos = null;
  let lastClickTime = 0;
  let isAreaDragging = false;
  let areaBox = null;
  
  // Sistema de handles visuais para redimensionamento de área
  let areaResizeHandles = [];
  let areaDimensionLabels = [];
  let isInteractingWithHandle = false;
  let isDraggingHandle = false;
  let draggedHandle = null;
  let resizeStartPosition = null;
  let originalAreaBounds = null;
  

  
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
  
  // NOVO: Sistema de seleção e movimentação de voxels (variáveis já declaradas acima)
  // let selectedVoxels = new Set(); // REMOVIDO - já declarado na linha 644
  // let isDraggingVoxels = false; // REMOVIDO - já declarado na linha 645
  // let dragStartPosition = null; // REMOVIDO - já declarado na linha 646
  // let voxelPreviewMeshes = []; // REMOVIDO - já declarado na linha 647
  // let isInMoveMode = false; // REMOVIDO - já declarado na linha 648
  
  // Detectar se é trackpad/touchpad
  let isTrackpad = false;
  
  // Configurações específicas para trackpad
  controls.panSpeed = 0.8; // Reduzido para trackpad
  controls.rotateSpeed = 0.5; // Reduzido para trackpad
  controls.zoomSpeed = 0.6; // Reduzido para trackpad
  controls.enableDamping = true;
  controls.dampingFactor = 0.15; // Aumentado para suavizar trackpad

  // Habilitar controles de câmera sempre
  controls.enabled = true;
  controls.enableRotate = true; // Sempre habilitado para permitir rotação

  // Adicionar listener para atualizar labels quando a câmera mudar
  controls.addEventListener('change', () => {
    if (typeof updateLabelSizes === 'function') {
      updateLabelSizes();
    }
  });

  // Configurar interação híbrida no canvas
  function setupHybridInteraction() {
    let mouseDownEvent = null;
    
    // Mostrar dica para trackpad
    const trackpadHint = document.getElementById('trackpad-hint');
    let hintTimeout;
    
    function showTrackpadHint() {
      if (isTrackpad && trackpadHint) {
        trackpadHint.classList.add('visible');
        clearTimeout(hintTimeout);
        hintTimeout = setTimeout(() => {
          trackpadHint.classList.remove('visible');
        }, 4000);
      }
    }

    // Detectar trackpad vs mouse tradicional
    canvas.addEventListener('wheel', (e) => {
      // Trackpads geralmente enviam valores menores e mais frequentes
      if (Math.abs(e.deltaY) < 10 && e.deltaMode === 0) {
        isTrackpad = true;
        controls.zoomSpeed = 0.3; // Reduzir para trackpad
        showTrackpadHint();
        canvas.classList.add('trackpad-mode');
      } else {
        controls.zoomSpeed = 1.0; // Normal para mouse
        canvas.classList.remove('trackpad-mode');
      }
    }, { passive: true });

    canvas.addEventListener('mousedown', (event) => {
      // Se eyedropper está ativo, não interferir
      if (colorSystem.isEyedropperActivated()) return;
      
      isMouseDown = true;
      isDragging = false;
      mouseDownTime = Date.now();
      mouseDownPosition.x = event.clientX;
      mouseDownPosition.y = event.clientY;
      mouseDownEvent = event;
      
      // Sistema de SELEÇÃO - Shift + clique (incluindo Ctrl + Shift para seleção por cor)
      if (isShiftPressed) {
        console.log('🎯 SHIFT + CLIQUE DETECTADO - MODO SELEÇÃO!');
        event.preventDefault();
        event.stopPropagation();
        
        isDoubleClicking = true;
        isDragging = false; // Reset para detectar se vai virar arrastar
        
        // NÃO desabilitar controles ainda - vamos esperar para ver se é clique ou arrastar
        
        const intersect = getIntersection(event);
        if (intersect && intersect.object && intersect.object.userData.isVoxel) {
          // Guardar informações para seleção posterior (se for apenas clique)
          mouseDownEvent.intersectedVoxel = intersect.object;
          mouseDownEvent.hasVoxelIntersection = true;
        } else {
          mouseDownEvent.hasVoxelIntersection = false;
        }
        return;
      }
      
      // SISTEMA DE REDIMENSIONAMENTO COM HANDLES - Detectar clique em handle
      if (isAreaSelected && !isShiftPressed && !isCtrlPressed) {
        const intersect = getIntersection(event);
        console.log('🔍 Mousedown - isAreaSelected:', isAreaSelected, 'intersect:', intersect);
        
        if (intersect && intersect.object) {
          console.log('🎯 Objeto detectado no clique:', intersect.object.userData);
          console.log('🎯 É handle?', intersect.object.userData.isResizeHandle);
        }
        
        console.log('📊 Handles disponíveis:', areaResizeHandles.length);
        areaResizeHandles.forEach((handle, index) => {
          console.log(`Handle ${index}:`, handle.userData, 'posição:', handle.position);
        });
        
        if (intersect && intersect.object && intersect.object.userData.isResizeHandle) {
          console.log('🎯 HANDLE CLICADO - INICIANDO REDIMENSIONAMENTO!', intersect.object.userData);
          event.preventDefault();
          event.stopPropagation();
          
          // Iniciar redimensionamento imediatamente
          startHandleResize(intersect.object, event);
          return;
        } else {
          console.log('❌ Nenhum handle detectado no clique');
        }
      }
      
      // SISTEMA DE CRIAÇÃO DE ÁREA - Ctrl + clique + arrastar (apenas Ctrl, sem Shift)
      if (isCtrlPressed && !isShiftPressed) {
        console.log('🎯 CTRL + CLIQUE - INICIANDO CRIAÇÃO DE ÁREA!');
        event.preventDefault();
        event.stopPropagation();
        
        isCreatingArea = true;
        isAreaDragging = true;
        isDoubleClicking = true;
        
        const intersect = getIntersection(event);
        if (intersect) {
          areaCreationStartPos = {
            x: Math.round(intersect.point.x),
            y: Math.round(intersect.point.y),
            z: Math.round(intersect.point.z)
          };
          console.log('📍 Início da área:', areaCreationStartPos);
        }
        
        // Desabilitar completamente os controles
        controls.enabled = false;
        controls.enableRotate = false;
        controls.enablePan = false;
        controls.enableZoom = false;
        
        return;
      }
      
      // Comportamento normal - adicionar/remover voxel
      // Verificar double-click apenas para clique esquerdo
      if (event.button === 0 && Date.now() - lastTouchTime < DOUBLE_CLICK_TIME) {
        handleDoubleClick(event);
        return;
      }
      lastTouchTime = Date.now();
      
      // Para trackpad, desabilitar rotação temporariamente no clique
      if (isTrackpad && event.button === 0) {
        controls.enableRotate = false;
      }
    });

    canvas.addEventListener('mousemove', (event) => {
      if (!isMouseDown || colorSystem.isEyedropperActivated()) return;
      
      // Verificar hover nos handles de redimensionamento (apenas quando não está arrastando)
      if (!isDragging && isAreaSelected && !isDraggingHandle) {
        const intersect = getIntersection(event);
        
        console.log('🔍 Mousemove - isAreaSelected:', isAreaSelected, 'intersect:', intersect);
        
        if (intersect && intersect.object) {
          console.log('🎯 Objeto detectado:', intersect.object.userData);
        }
        
        // Reset de todos os handles para cor original
        areaResizeHandles.forEach(handle => {
          handle.material.color.setHex(handle.userData.originalColor);
          handle.material.opacity = 0.8;
          handle.material.emissiveIntensity = 0.2;
          handle.scale.set(1, 1, 1);
        });
        
        // Destacar handle sob o mouse
        if (intersect && intersect.object && intersect.object.userData.isResizeHandle) {
          console.log('✅ HANDLE DETECTADO NO HOVER!', intersect.object.userData);
          intersect.object.material.color.setHex(0xffffff);
          intersect.object.material.opacity = 1.0;
          intersect.object.material.emissiveIntensity = 0.4;
          intersect.object.scale.set(1.2, 1.2, 1.2);
          canvas.style.cursor = intersect.object.userData.handleType === 'corner' ? 'nw-resize' : 'pointer';
        } else if (!isShiftPressed && !isCtrlPressed) {
          updateCursor();
        }
      }
      
      const deltaX = Math.abs(event.clientX - mouseDownPosition.x);
      const deltaY = Math.abs(event.clientY - mouseDownPosition.y);
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      
      // Threshold adaptativo para trackpad
      const threshold = isTrackpad ? DRAG_THRESHOLD * 1.5 : DRAG_THRESHOLD;
      
      // MODO DE CRIAÇÃO DE ÁREA - Ctrl + clique + arrastar ou Duplo-clique + arrastar
      if (isCreatingArea && isAreaDragging && areaCreationStartPos) {
        const intersect = getIntersection(event);
        if (intersect) {
          const currentPos = {
            x: Math.round(intersect.point.x),
            y: Math.round(intersect.point.y),
            z: Math.round(intersect.point.z)
          };
          
          // Mostrar preview da área sendo criada
          createAreaPreview(areaCreationStartPos, currentPos);
        }
        return;
      }
      
      // MODO DE REDIMENSIONAMENTO COM HANDLES - Arrastar handle para redimensionar
      if (isDraggingHandle && draggedHandle) {
        console.log('🔄 Atualizando redimensionamento...');
        updateHandleResize(event);
        return;
      }
      
      // Modo de seleção com Shift - determinar se é clique ou arrastar
      if (isShiftPressed && isDoubleClicking && !isCreatingArea) {
        if (distance > threshold) {
          // É um arrastar = ativar pan da câmera
          console.log('📹 Shift + Arrastar = Movendo câmera');
          isDragging = true;
          isDoubleClicking = false; // Cancelar modo de seleção
          
          // Ativar pan da câmera
          controls.enabled = true;
          controls.enableRotate = false; // Desativar rotação
          controls.enablePan = true;     // Ativar pan
          controls.enableZoom = true;    // Manter zoom
          
          // Simular clique do botão direito para ativar pan
          const rightClickEvent = new MouseEvent('mousedown', {
            clientX: event.clientX,
            clientY: event.clientY,
            button: 2, // Botão direito
            buttons: 4 // Máscara do botão direito
          });
          
          // Temporariamente mapear botão esquerdo para pan
          controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
          
          return;
        } else {
          // Ainda é um movimento pequeno, manter em modo de seleção
          return;
        }
      }
      
      if (distance > threshold && !isDragging && !isShiftPressed && !isCreatingArea && !isCtrlPressed && !isDraggingHandle) {
        isDragging = true;
        // Sempre permitir rotação quando arrastar (exceto se arrastando handle)
        controls.enableRotate = true;
        controls.enablePan = true;
        
        // Mudar cursor para indicar modo de rotação
        canvas.style.cursor = 'grabbing';
        canvas.classList.add('trackpad-dragging');
      }
    });

    canvas.addEventListener('mouseup', (event) => {
      if (colorSystem.isEyedropperActivated()) return;
      
      // FINALIZAÇÃO DE REDIMENSIONAMENTO COM HANDLES
      if (isDraggingHandle && draggedHandle) {
        finishHandleResize();
        return;
      }
      
      const mouseUpTime = Date.now();
      const timeDiff = mouseUpTime - mouseDownTime;
      
      // Threshold de tempo adaptativo para trackpad
      const timeThreshold = isTrackpad ? CLICK_TIME_THRESHOLD * 1.5 : CLICK_TIME_THRESHOLD;
      
      // FINALIZAÇÃO DE CRIAÇÃO DE ÁREA
      if (isCreatingArea && isAreaDragging && areaCreationStartPos) {
        console.log('🎯 FINALIZANDO CRIAÇÃO DE ÁREA!');
        
        const intersect = getIntersection(event);
        if (intersect) {
          const endPos = {
            x: Math.round(intersect.point.x),
            y: Math.round(intersect.point.y),
            z: Math.round(intersect.point.z)
          };
          
          // Criar a área final
          createAreaFromDrag(areaCreationStartPos, endPos);
        }
        
        // Reset flags
        isCreatingArea = false;
        isAreaDragging = false;
        isDoubleClicking = false;
        areaCreationStartPos = null;
        clearAreaPreview();
        
        // Manter todos os controles habilitados em modo de área
        controls.enabled = true;
        controls.enableRotate = true;
        controls.enablePan = true;
        controls.enableZoom = true;
        
        isMouseDown = false;
        isDragging = false;
        updateCursor(); // Atualizar cursor para modo de área
        return;
      }
      
      // Modo de seleção com Shift
      if (isShiftPressed && isDoubleClicking && !isCreatingArea) {
        // Foi um clique (não arrastar) = fazer seleção
        console.log('👆 Shift + Clique = Seleção de voxel');
        
        if (mouseDownEvent.hasVoxelIntersection && mouseDownEvent.intersectedVoxel) {
          // Debug: verificar teclas pressionadas
          console.log('🔍 Debug teclas:', {
            ctrl: event.ctrlKey,
            shift: event.shiftKey,
            alt: event.altKey,
            isShiftPressed: isShiftPressed,
            isCtrlPressed: isCtrlPressed
          });
          
          // Determinar modo de seleção baseado nas teclas modificadoras
          let selectionMode = 'single';
          if (event.ctrlKey && event.shiftKey) {
            selectionMode = 'color';
            console.log('🎨 Modo seleção por cor ativado (Ctrl+Shift+Clique)');
          } else if (event.altKey && event.shiftKey) {
            selectionMode = 'connected';
            console.log('🔗 Modo seleção conectada ativado (Alt+Shift+Clique)');
          } else if (event.shiftKey) {
            selectionMode = 'single';
            console.log('👆 Modo seleção individual ativado (Shift+Clique)');
          }
          
          console.log('🎯 Modo de seleção determinado:', selectionMode);
          
          // Fazer a seleção
          toggleVoxelSelection(mouseDownEvent.intersectedVoxel, selectionMode);
        } else {
          // Clicou no vazio = limpar seleção
          clearSelection();
        }
        
        isDoubleClicking = false;
        
        // Reabilitar todos os controles
        controls.enabled = true;
        controls.enableRotate = true;
        controls.enablePan = true;
        controls.enableZoom = true;
        
        console.log('✅ Seleção finalizada!');
        
        // Reset
        isMouseDown = false;
        isDragging = false;
        return;
      }
      
      // Se estava em modo pan da câmera com Shift
      if (isShiftPressed && isDragging && controls.mouseButtons.LEFT === THREE.MOUSE.PAN) {
        // Restaurar botão esquerdo para rotação
        controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
        
        // Restaurar todos os controles
        controls.enabled = true;
        controls.enableRotate = true;
        controls.enablePan = true;
        controls.enableZoom = true;
        
        console.log('📹 Pan da câmera finalizado');
        
        // Reset
        isMouseDown = false;
        isDragging = false;
        return;
      }
      
      if (!isDragging && timeDiff < timeThreshold && mouseDownEvent) {
        // Se não estava em modo especial, fazer clique normal
        if (!isShiftPressed && !isCreatingArea && !isDraggingHandle) {
          // Foi um clique rápido normal - adicionar voxel
          mouseSystem.onMouseDown(mouseDownEvent);
        }
      }
      
      // Reset
      isMouseDown = false;
      isDragging = false;
      isDoubleClicking = false;
      
      // Reabilitar todos os controles quando não há modificação especial
      if (!isShiftPressed && !isCtrlPressed) {
        controls.enabled = true;
        controls.enableRotate = true;
        controls.enablePan = true;
        controls.enableZoom = true;
      }
      
      canvas.classList.remove('trackpad-dragging');
      updateCursor(); // Sempre atualizar cursor no final
    });

    // Suporte a touch para dispositivos híbridos
    canvas.addEventListener('touchstart', (event) => {
      event.preventDefault();
      
      if (event.touches.length === 1) {
        // Um dedo - simular clique
        const touch = event.touches[0];
        const mouseEvent = new MouseEvent('mousedown', {
          clientX: touch.clientX,
          clientY: touch.clientY,
          button: 0
        });
        canvas.dispatchEvent(mouseEvent);
      } else if (event.touches.length === 2) {
        // Dois dedos - habilitar controles para gesture
        controls.enabled = true;
        isDragging = true;
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', (event) => {
      event.preventDefault();
      
      if (event.touches.length === 1 && isMouseDown) {
        const touch = event.touches[0];
        const mouseEvent = new MouseEvent('mousemove', {
          clientX: touch.clientX,
          clientY: touch.clientY,
          button: 0
        });
        canvas.dispatchEvent(mouseEvent);
      }
    }, { passive: false });

    canvas.addEventListener('touchend', (event) => {
      event.preventDefault();
      
      if (event.changedTouches.length === 1) {
        const touch = event.changedTouches[0];
        const mouseEvent = new MouseEvent('mouseup', {
          clientX: touch.clientX,
          clientY: touch.clientY,
          button: 0
        });
        canvas.dispatchEvent(mouseEvent);
      }
      
      // Reset após um delay para permitir gesture completion
      setTimeout(() => {
        controls.enabled = true;
        controls.enableRotate = true;
      }, 100);
    }, { passive: false });

    // Melhorar detecção de clique duplo para trackpad
    function handleDoubleClick(event) {
      // Só processar se for clique esquerdo (não direito)
      if (event.button !== 0) return;
      
      const intersect = getIntersection(event);
      if (intersect && intersect.object && intersect.object.userData.isVoxel) {
        // Double-click para remover voxel
        console.log('🖱️ Double-click: removendo voxel');
        removeVoxel(intersect.object);
      }
    }

    // Prevenir menu de contexto e melhorar clique direito
    canvas.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      
      // Clique direito para remover voxel (melhor para trackpad)
      const intersect = getIntersection(event);
      if (intersect && intersect.object && intersect.object.userData.isVoxel) {
        console.log('🖱️ Clique direito: removendo voxel');
        removeVoxel(intersect.object);
      }
    });

    console.log('Sistema híbrido configurado com suporte melhorado para trackpad');
  }

  setupHybridInteraction();

  console.log('Editor inicializado com sucesso!');
  console.log('Cena criada com', scene.children.length, 'objetos');
  console.log('Renderer ativo:', !!renderer);
  console.log('Camera posicionada em:', camera.position);

} // Fim da função initEditor()

// Iniciar quando dependências estiverem prontas
waitForDependencies();