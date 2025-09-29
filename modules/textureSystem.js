/**
 * Sistema de Texturas para Voxels
 * Permite aplicar texturas em faces individuais dos voxels para criar ambientes realistas
 */

export class TextureSystem {
  constructor() {
    this.textureLibrary = new Map();
    this.materialCache = new Map();
    this.loader = new THREE.TextureLoader();
    this.currentTexture = null;
    this.textureMode = 'single'; // 'single' ou 'per-face'
    
    console.log('🎨 Sistema de Texturas inicializado');
    this.initDefaultTextures();
  }

  /**
   * Inicializar texturas padrão usando padrões procedurais
   */
  initDefaultTextures() {
    // Criar texturas procedurais para não depender de arquivos externos
    this.createProceduralTextures();
  }

  /**
   * Criar texturas procedurais usando canvas
   */
  createProceduralTextures() {
    // Papel de parede listrado
    this.createStripedWallpaper('wallpaper_stripes', '#f0f0f0', '#e0e0e0', 32);
    
    // Madeira
    this.createWoodTexture('wood_oak', '#8B4513', '#A0522D');
    
    // Tijolo
    this.createBrickTexture('brick_red', '#8B4513', '#654321');
    
    // Metal
    this.createMetalTexture('metal_steel', '#C0C0C0', '#A0A0A0');
    
    // Mármore
    this.createMarbleTexture('marble_white', '#F8F8FF', '#E6E6FA');
    
    // Grama
    this.createGrassTexture('grass_green', '#228B22', '#32CD32');
    
    console.log(`🎨 ${this.textureLibrary.size} texturas procedurais criadas`);
  }

  /**
   * Criar textura de papel de parede listrado
   */
  createStripedWallpaper(name, color1, color2, stripeWidth = 32) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Criar listras verticais
    for (let x = 0; x < canvas.width; x += stripeWidth * 2) {
      ctx.fillStyle = color1;
      ctx.fillRect(x, 0, stripeWidth, canvas.height);
      ctx.fillStyle = color2;
      ctx.fillRect(x + stripeWidth, 0, stripeWidth, canvas.height);
    }

    this.addCanvasTexture(name, canvas, 'Papel de Parede Listrado');
  }

  /**
   * Criar textura de madeira
   */
  createWoodTexture(name, baseColor, grainColor) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Base
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Veios da madeira
    ctx.strokeStyle = grainColor;
    ctx.lineWidth = 2;
    
    for (let i = 0; i < 20; i++) {
      ctx.beginPath();
      const y = (i / 20) * canvas.height;
      ctx.moveTo(0, y);
      
      // Criar curva ondulada
      for (let x = 0; x < canvas.width; x += 10) {
        const waveY = y + Math.sin(x * 0.02) * 5;
        ctx.lineTo(x, waveY);
      }
      ctx.stroke();
    }

    this.addCanvasTexture(name, canvas, 'Madeira Carvalho');
  }

  /**
   * Criar textura de tijolo
   */
  createBrickTexture(name, brickColor, mortarColor) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Base (argamassa)
    ctx.fillStyle = mortarColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Tijolos
    ctx.fillStyle = brickColor;
    const brickWidth = 60;
    const brickHeight = 30;
    const mortarWidth = 4;

    for (let y = 0; y < canvas.height; y += brickHeight + mortarWidth) {
      const offset = (Math.floor(y / (brickHeight + mortarWidth)) % 2) * (brickWidth / 2);
      
      for (let x = -brickWidth; x < canvas.width + brickWidth; x += brickWidth + mortarWidth) {
        ctx.fillRect(x + offset, y, brickWidth, brickHeight);
      }
    }

    this.addCanvasTexture(name, canvas, 'Tijolo Vermelho');
  }

  /**
   * Criar textura de metal
   */
  createMetalTexture(name, baseColor, shadowColor) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Gradiente metálico
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, baseColor);
    gradient.addColorStop(0.5, shadowColor);
    gradient.addColorStop(1, baseColor);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Adicionar ruído para efeito metálico
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 20;
      data[i] = Math.max(0, Math.min(255, data[i] + noise));     // R
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise)); // G
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise)); // B
    }

    ctx.putImageData(imageData, 0, 0);
    this.addCanvasTexture(name, canvas, 'Metal Aço');
  }

  /**
   * Criar textura de mármore
   */
  createMarbleTexture(name, baseColor, veinColor) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Base
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Veios do mármore
    ctx.strokeStyle = veinColor;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;

    for (let i = 0; i < 15; i++) {
      ctx.beginPath();
      const startX = Math.random() * canvas.width;
      const startY = Math.random() * canvas.height;
      
      ctx.moveTo(startX, startY);
      
      let x = startX;
      let y = startY;
      
      for (let j = 0; j < 50; j++) {
        x += (Math.random() - 0.5) * 20;
        y += (Math.random() - 0.5) * 20;
        ctx.lineTo(x, y);
      }
      
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
    this.addCanvasTexture(name, canvas, 'Mármore Branco');
  }

  /**
   * Criar textura de grama
   */
  createGrassTexture(name, grassColor, lightGrassColor) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Base
    ctx.fillStyle = grassColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Fios de grama
    ctx.strokeStyle = lightGrassColor;
    ctx.lineWidth = 1;

    for (let i = 0; i < 1000; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const length = Math.random() * 10 + 5;
      
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (Math.random() - 0.5) * 4, y - length);
      ctx.stroke();
    }

    this.addCanvasTexture(name, canvas, 'Grama Verde');
  }

  /**
   * Adicionar textura do canvas à biblioteca
   */
  addCanvasTexture(name, canvas, displayName) {
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.NearestFilter;
    
    this.textureLibrary.set(name, {
      texture: texture,
      displayName: displayName,
      canvas: canvas
    });
  }

  /**
   * Carregar textura de URL
   */
  loadTexture(name, url, displayName) {
    return new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (texture) => {
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.NearestFilter;
          
          this.textureLibrary.set(name, {
            texture: texture,
            displayName: displayName || name,
            url: url
          });
          
          console.log(`🎨 Textura carregada: ${displayName || name}`);
          resolve(texture);
        },
        undefined,
        (error) => {
          console.error(`❌ Erro ao carregar textura ${name}:`, error);
          reject(error);
        }
      );
    });
  }

  /**
   * Obter textura da biblioteca
   */
  getTexture(name) {
    const textureData = this.textureLibrary.get(name);
    return textureData ? textureData.texture : null;
  }

  /**
   * Obter todas as texturas disponíveis
   */
  getAvailableTextures() {
    const textures = [];
    for (const [name, data] of this.textureLibrary) {
      textures.push({
        name: name,
        displayName: data.displayName,
        preview: data.canvas || data.url
      });
    }
    return textures;
  }

  /**
   * Criar material com textura
   */
  createTexturedMaterial(textureName, options = {}) {
    const cacheKey = `${textureName}_${JSON.stringify(options)}`;
    
    if (this.materialCache.has(cacheKey)) {
      return this.materialCache.get(cacheKey);
    }

    const texture = this.getTexture(textureName);
    if (!texture) {
      console.warn(`⚠️ Textura não encontrada: ${textureName}`);
      return new THREE.MeshLambertMaterial({ color: 0x888888 });
    }

    const material = new THREE.MeshLambertMaterial({
      map: texture,
      transparent: options.transparent || false,
      opacity: options.opacity || 1.0,
      ...options
    });

    this.materialCache.set(cacheKey, material);
    return material;
  }

  /**
   * Criar array de materiais para voxel (6 faces)
   */
  createVoxelMaterials(textureConfig) {
    const materials = [];
    
    // Ordem das faces: right, left, top, bottom, front, back
    const faceNames = ['right', 'left', 'top', 'bottom', 'front', 'back'];
    
    for (const faceName of faceNames) {
      const textureName = textureConfig[faceName] || textureConfig.all || 'default';
      materials.push(this.createTexturedMaterial(textureName));
    }
    
    return materials;
  }

  /**
   * Definir textura atual para novos voxels
   */
  setCurrentTexture(textureName) {
    if (this.textureLibrary.has(textureName)) {
      this.currentTexture = textureName;
      console.log(`🎨 Textura atual definida: ${textureName}`);
      return true;
    }
    console.warn(`⚠️ Textura não encontrada: ${textureName}`);
    return false;
  }

  /**
   * Obter textura atual
   */
  getCurrentTexture() {
    return this.currentTexture;
  }

  /**
   * Limpar cache de materiais
   */
  clearCache() {
    this.materialCache.clear();
    console.log('🧹 Cache de materiais limpo');
  }

  /**
   * Obter estatísticas do sistema
   */
  getStats() {
    return {
      texturesLoaded: this.textureLibrary.size,
      materialsCached: this.materialCache.size,
      currentTexture: this.currentTexture
    };
  }
}

// Exportar para uso global
window.TextureSystem = TextureSystem;
