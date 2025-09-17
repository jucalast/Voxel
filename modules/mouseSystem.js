// =====================================================================
// MÓDULO: SISTEMA DE INTERAÇÃO DE MOUSE E RAYCASTING
// =====================================================================

export class MouseInteractionSystem {
  constructor(canvas, camera, scene, groundPlane) {
    this.canvas = canvas;
    this.camera = camera;
    this.scene = scene;
    this.groundPlane = groundPlane;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.voxels = [];
    this.ghostCube = null;
    this.onVoxelAdd = null;
    this.onVoxelRemove = null;
    this.getSelectedColor = null;
    
    this.createGhostCube();
    this.init();
  }

  init() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Event listeners serão gerenciados externamente para interação híbrida
    this.canvas.addEventListener('pointermove', (event) => this.onPointerMove(event));
    this.canvas.addEventListener('pointerleave', (event) => this.onPointerLeave(event));
  }

  createGhostCube() {
    const ghostGeometry = new THREE.BoxGeometry(1.02, 1.02, 1.02);
    
    // Apenas wireframe, sem parte sólida
    const wireframeGeometry = new THREE.EdgesGeometry(ghostGeometry);
    const wireframeMaterial = new THREE.LineBasicMaterial({ 
      color: 0xffffff, // Branco
      transparent: true,
      opacity: 0.9,
      linewidth: 2
    });
    
    this.ghostCube = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
    this.ghostCube.visible = false;
    this.scene.add(this.ghostCube);
    
    // Referência para facilitar mudança de cor se necessário
    this.ghostCube.wireframeMaterial = wireframeMaterial;
  }

  onPointerMove(event) {
    // Converte coordenadas do mouse
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    // Configura o raycaster
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Verifica interseções com voxels primeiro
    const intersects = this.raycaster.intersectObjects(this.voxels, false);
    
    if (intersects.length > 0) {
      // Quando hover sobre voxel existente, calcula posição adjacente
      const intersect = intersects[0];
      const face = intersect.face;
      const normal = face.normal.clone();
      
      // Aplica rotação do objeto para obter normal mundial
      normal.transformDirection(intersect.object.matrixWorld);
      
      // Calcula posição adjacente baseada na normal da face
      const currentPos = intersect.object.position.clone();
      const newPos = currentPos.clone().add(normal);
      
      // Alinha na grade
      this.ghostCube.position.set(
        Math.round(newPos.x),
        Math.round(newPos.y),
        Math.round(newPos.z)
      );
      
      // Verifica se já existe voxel na posição
      const hasVoxelAt = this.voxels.some(voxel => {
        const vPos = voxel.position;
        return Math.round(vPos.x) === Math.round(newPos.x) &&
               Math.round(vPos.y) === Math.round(newPos.y) &&
               Math.round(vPos.z) === Math.round(newPos.z);
      });
      
      // Mostra ghost cube apenas se não houver voxel na posição
      this.ghostCube.visible = !hasVoxelAt;
      
      // Mantém sempre branco - apenas mostra/esconde
      this.ghostCube.wireframeMaterial.color.setHex(0xffffff);
      
    } else {
      // Verifica interseção com o plano quando não há voxel
      const gridIntersects = this.raycaster.intersectObject(this.groundPlane, true);
      if (gridIntersects.length > 0) {
        const point = gridIntersects[0].point;
        
        // Alinha na grade (Y sempre 0 para o plano base)
        const gridX = Math.round(point.x);
        const gridZ = Math.round(point.z);
        
        this.ghostCube.position.set(gridX, 0, gridZ);
        
        // Verifica se já existe voxel na posição
        const hasVoxelAt = this.voxels.some(voxel => {
          const vPos = voxel.position;
          return Math.round(vPos.x) === gridX &&
                 Math.round(vPos.y) === 0 &&
                 Math.round(vPos.z) === gridZ;
        });
        
        this.ghostCube.visible = !hasVoxelAt;
        
        // Mantém sempre branco - apenas mostra/esconde
        this.ghostCube.wireframeMaterial.color.setHex(0xffffff);
      } else {
        this.ghostCube.visible = false;
      }
    }
  }

  onPointerDown(event) {
    this.onMouseDown(event);
  }

  onMouseDown(event) {
    event.preventDefault();
    
    // Converte coordenadas do mouse
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const intersects = this.raycaster.intersectObjects(this.voxels, false);
    
    if (event.button === 2) { 
      // Botão direito: remover voxel
      if (intersects.length > 0 && this.onVoxelRemove) {
        this.onVoxelRemove(intersects[0].object);
      }
    } else { 
      // Botão esquerdo: adicionar voxel
      if (intersects.length > 0) {
        // Adiciona voxel adjacente ao que foi clicado
        const intersect = intersects[0];
        const face = intersect.face;
        const normal = face.normal.clone();
        
        // Aplica rotação do objeto para obter normal mundial
        normal.transformDirection(intersect.object.matrixWorld);
        
        // Calcula posição adjacente baseada na normal da face
        const currentPos = intersect.object.position.clone();
        const newPos = currentPos.clone().add(normal);
        
        // Alinha na grade
        const gridX = Math.round(newPos.x);
        const gridY = Math.round(newPos.y);
        const gridZ = Math.round(newPos.z);
        
        // Verifica se já existe voxel na posição
        const hasVoxelAt = this.voxels.some(voxel => {
          const vPos = voxel.position;
          return Math.round(vPos.x) === gridX &&
                 Math.round(vPos.y) === gridY &&
                 Math.round(vPos.z) === gridZ;
        });
        
        // Só adiciona se não houver voxel na posição
        if (!hasVoxelAt && this.onVoxelAdd && this.getSelectedColor) {
          this.onVoxelAdd(gridX, gridY, gridZ, this.getSelectedColor());
        }
        
      } else {
        // Adiciona novo voxel na grade base
        const gridIntersects = this.raycaster.intersectObject(this.groundPlane, true);
        if (gridIntersects.length > 0) {
          const point = gridIntersects[0].point;
          
          // Alinha na grade
          const gridX = Math.round(point.x);
          const gridY = 0; // Sempre no nível base para o plano
          const gridZ = Math.round(point.z);
          
          // Verifica se já existe voxel na posição
          const hasVoxelAt = this.voxels.some(voxel => {
            const vPos = voxel.position;
            return Math.round(vPos.x) === gridX &&
                   Math.round(vPos.y) === gridY &&
                   Math.round(vPos.z) === gridZ;
          });
          
          // Só adiciona se não houver voxel na posição
          if (!hasVoxelAt && this.onVoxelAdd && this.getSelectedColor) {
            this.onVoxelAdd(gridX, gridY, gridZ, this.getSelectedColor());
          }
        }
      }
    }
  }

  onPointerLeave(event) {
    this.ghostCube.visible = false;
  }

  addVoxel(mesh) {
    this.voxels.push(mesh);
  }

  removeVoxel(mesh) {
    const index = this.voxels.indexOf(mesh);
    if (index !== -1) {
      this.voxels.splice(index, 1);
    }
  }

  setVoxels(voxelsArray) {
    this.voxels = voxelsArray;
  }

  setCallbacks(onVoxelAdd, onVoxelRemove, getSelectedColor) {
    this.onVoxelAdd = onVoxelAdd;
    this.onVoxelRemove = onVoxelRemove;
    this.getSelectedColor = getSelectedColor;
  }

  getGhostCube() {
    return this.ghostCube;
  }
}