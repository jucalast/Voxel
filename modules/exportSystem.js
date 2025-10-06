// =====================================================================
// SISTEMA DE EXPORTAÇÃO - MÓDULO INDEPENDENTE
// =====================================================================

class ExportSystem {
  constructor(voxelsArray) {
    this.voxels = voxelsArray;
  }

  /**
   * Coleta os dados da cena atual
   * @returns {Array} Array com dados dos voxels
   */
  collectSceneData() {
    return this.voxels.map(voxel => ({
      x: Math.round(voxel.position.x),
      y: Math.round(voxel.position.y), 
      z: Math.round(voxel.position.z),
      color: voxel.userData.color
    }));
  }

  /**
   * Gera o HTML completo para visualização
   * @param {Array} voxelData - Dados dos voxels
   * @returns {string} HTML completo
   */
  generateExportHTML(voxelData) {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🎨 Arte Voxel 3D - Criado com Vertex</title>
  <link rel="icon" type="image/png" href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyJpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNiAoV2luZG93cykiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6OUJGMTY3MkY0RUU2MTFFQ0I5OTlBQjVBMTFFNjA4NEMiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6OUJGMTY3MzA0RUU2MTFFQ0I5OTlBQjVBMTFFNjA4NEMiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDo5QkYxNjcyRDRFRTYxMUVDQjk5OUFCNUE0dEU2MDg0QyIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDo5QkYxNjcyRTRFRTYxMUVDQjk5OUFCNUE0dEU2MDg0QyIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PtKh8TcAAAASSURBVHjaYvz//z8DJQAggAADAKJQAv5TIQq5AAAAAElFTkSuQmCC">
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

  /**
   * Faz download de arquivo HTML
   * @param {string} htmlContent - Conteúdo HTML
   * @param {string} filename - Nome do arquivo
   */
  downloadHTMLFile(htmlContent, filename) {
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

  /**
   * Faz download de arquivo JSON
   * @param {string} jsonContent - Conteúdo JSON
   * @param {string} filename - Nome do arquivo
   */
  downloadJSONFile(jsonContent, filename) {
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

  /**
   * Função principal de exportação com seleção de formato
   */
  export() {
    const voxelData = this.collectSceneData();
    
    // Mostrar opções de exportação
    const exportType = prompt('Escolha o formato de exportação:\\n1 - HTML (visualizador completo)\\n2 - JSON (apenas dados)\\n\\nDigite 1 ou 2:', '1');
    
    if (exportType === '1') {
      // Exportar como HTML
      const html = this.generateExportHTML(voxelData);
      this.downloadHTMLFile(html, 'sua-arte-voxel.html');
      console.log('📤 Exportação HTML concluída');
    } else if (exportType === '2') {
      // Exportar como JSON
      const jsonData = JSON.stringify(voxelData, null, 2);
      this.downloadJSONFile(jsonData, 'voxel-data.json');
      console.log('📤 Exportação JSON concluída');
    } else if (exportType !== null) {
      alert('Opção inválida. Use 1 para HTML ou 2 para JSON.');
    }
  }
}

// Exportar classe para ES6 modules
export { ExportSystem };

// Expor classe globalmente para compatibilidade
if (typeof window !== 'undefined') {
  window.ExportSystem = ExportSystem;
}