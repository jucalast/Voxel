// =====================================================================
// MÓDULO: SISTEMA DE CORES AVANÇADO
// =====================================================================

export class ColorSystem {
  constructor(colorPaletteElement) {
    this.colorPalette = colorPaletteElement;
    this.selectedColor = '#7c3aed';
    this.currentHue = 270; // Roxo
    this.currentSaturation = 70;
    this.currentLightness = 60;
    this.currentOpacity = 100;
    
    // Sistema de paleta de memória
    this.colorMemory = this.loadColorMemory();
    this.imageColors = [];
    this.maxMemoryColors = 12;
    this.maxImageColors = 8;
    
    // Cores rápidas predefinidas
    this.quickColors = [
      '#FF4444', '#FF8800', '#FFDD00', '#88FF44', '#44FFFF', '#4488FF', '#8844FF', '#FF44FF',
      '#FF0000', '#FF6600', '#FFAA00', '#66FF00', '#00FFFF', '#0066FF', '#6600FF', '#FF00FF',
      '#CC0000', '#CC4400', '#CC8800', '#44CC00', '#00CCCC', '#0044CC', '#4400CC', '#CC00CC',
      '#880000', '#882200', '#886600', '#228800', '#008888', '#002288', '#220088', '#880088',
      '#FFFFFF', '#DDDDDD', '#BBBBBB', '#999999', '#777777', '#555555', '#333333', '#000000'
    ];
    
    this.isDragging = false;
    this.activeSlider = null;
    
    // Propriedades do eyedropper
    this.isEyedropperActive = false;
    this.eyedropperBtn = null;
    this.tempCanvas = null;
    this.tempCtx = null;
    
    this.init();
  }

  init() {
    this.setupColorCanvas();
    this.createQuickColorButtons();
    this.createColorMemorySection();
    this.createImageColorsSection();
    this.createEyedropperButton();
    this.setupEventListeners();
    this.setupEyedropper();
    this.updateColorDisplay();
    this.setupImageColorExtraction();
  }

  setupColorCanvas() {
    this.canvas = document.getElementById('color-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.drawColorGradient();
  }

  drawColorGradient() {
    const canvas = this.canvas;
    const ctx = this.ctx;
    
    // Desenha gradiente de saturação (horizontal) e luminosidade (vertical)
    for (let x = 0; x < canvas.width; x++) {
      for (let y = 0; y < canvas.height; y++) {
        const saturation = (x / canvas.width) * 100;
        const lightness = 100 - (y / canvas.height) * 100;
        
        const color = this.hslToRgb(this.currentHue, saturation, lightness);
        ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  hslToRgb(h, s, l) {
    h /= 360;
    s /= 100;
    l /= 100;
    
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    
    let r, g, b;
    
    if (s === 0) {
      r = g = b = l;
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    
    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255)
    };
  }

  rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  createQuickColorButtons() {
    this.quickColors.forEach((color, index) => {
      const btn = document.createElement('button');
      btn.className = 'color-btn';
      btn.style.background = color;
      btn.title = `Quick color: ${color}`;
      
      btn.onclick = () => {
        this.setColorFromHex(color);
        this.selectQuickColor(btn);
      };
      
      this.colorPalette.appendChild(btn);
    });
  }

  createEyedropperButton() {
    // Criar botão eyedropper
    this.eyedropperBtn = document.createElement('button');
    this.eyedropperBtn.className = 'color-btn eyedropper-btn';
    this.eyedropperBtn.title = 'Color Picker - Clique para capturar cor da imagem de referência';
    this.eyedropperBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="m2 22 1-1h3l9-9"/>
        <path d="M3 21v-3l9-9"/>
        <path d="m15 6 3.5-3.5a2.12 2.12 0 0 1 3 3L18 9l.5.5-3.5 3.5L13 11l-4 4H6v-3l4-4Z"/>
      </svg>
    `;
    
    // Estilo específico para o eyedropper - integrado ao main-color-display
    this.eyedropperBtn.style.cssText = `
      width: 24px;
      height: 24px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 4px;
      color: rgba(255, 255, 255, 0.6);
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0.7;
      position: absolute;
      top: 8px;
      right: 8px;
    `;

    // Inserir dentro do main-color-display
    const mainColorDisplay = document.getElementById('main-color-display');
    if (mainColorDisplay) {
      // Tornar o main-color-display relativo para posicionamento absoluto do botão
      mainColorDisplay.style.position = 'relative';
      mainColorDisplay.appendChild(this.eyedropperBtn);
    } else {
      console.warn('main-color-display não encontrado, inserindo antes da paleta de cores');
      // Fallback - inserir antes da paleta se main-color-display não existir
      const eyedropperContainer = document.createElement('div');
      eyedropperContainer.style.cssText = `
        margin-bottom: 12px;
        padding-bottom: 12px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        text-align: center;
      `;
      eyedropperContainer.appendChild(this.eyedropperBtn);
      this.colorPalette.parentNode.insertBefore(eyedropperContainer, this.colorPalette);
    }
  }

  setupEventListeners() {
    // Canvas de cor
    this.canvas.addEventListener('mousedown', (e) => this.startColorPicking(e));
    this.canvas.addEventListener('mousemove', (e) => this.updateColorPicking(e));
    this.canvas.addEventListener('mouseup', () => this.stopColorPicking());
    
    // Slider de matiz
    const hueSlider = document.getElementById('hue-slider');
    hueSlider.addEventListener('mousedown', (e) => this.startSliderDrag(e, 'hue'));
    
    // Slider de opacidade
    const opacitySlider = document.getElementById('opacity-slider');
    opacitySlider.addEventListener('mousedown', (e) => this.startSliderDrag(e, 'opacity'));
    
    // Eventos globais
    document.addEventListener('mousemove', (e) => this.handleGlobalMouseMove(e));
    document.addEventListener('mouseup', () => this.stopAllDragging());
  }

  startColorPicking(e) {
    this.isDragging = true;
    this.updateColorFromCanvas(e);
  }

  updateColorPicking(e) {
    if (this.isDragging) {
      this.updateColorFromCanvas(e);
    }
  }

  stopColorPicking() {
    this.isDragging = false;
  }

  updateColorFromCanvas(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(this.canvas.width, (e.clientX - rect.left) * (this.canvas.width / rect.width)));
    const y = Math.max(0, Math.min(this.canvas.height, (e.clientY - rect.top) * (this.canvas.height / rect.height)));
    
    this.currentSaturation = (x / this.canvas.width) * 100;
    this.currentLightness = 100 - (y / this.canvas.height) * 100;
    
    // Atualiza posição do handle
    const handle = document.getElementById('color-picker-handle');
    handle.style.left = `${(x / this.canvas.width) * 100}%`;
    handle.style.top = `${(y / this.canvas.height) * 100}%`;
    
    this.updateColorDisplay();
  }

  startSliderDrag(e, slider) {
    this.activeSlider = slider;
    this.updateSlider(e, slider);
  }

  handleGlobalMouseMove(e) {
    if (this.activeSlider) {
      this.updateSlider(e, this.activeSlider);
    }
  }

  updateSlider(e, slider) {
    const sliderElement = document.getElementById(`${slider}-slider`);
    const handle = document.getElementById(`${slider}-handle`);
    const rect = sliderElement.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    
    handle.style.left = `${percentage}%`;
    
    if (slider === 'hue') {
      this.currentHue = (percentage / 100) * 360;
      this.drawColorGradient();
    } else if (slider === 'opacity') {
      this.currentOpacity = percentage;
    }
    
    this.updateColorDisplay();
  }

  stopAllDragging() {
    this.isDragging = false;
    this.activeSlider = null;
  }

  updateColorDisplay() {
    const color = this.hslToRgb(this.currentHue, this.currentSaturation, this.currentLightness);
    const hex = this.rgbToHex(color.r, color.g, color.b);
    
    this.selectedColor = hex;
    
    // Adicionar cor à memória quando selecionada
    this.addToColorMemory(hex);
    
    // Atualiza display visual
    document.getElementById('current-color').style.background = hex;
    document.getElementById('color-hex').textContent = hex.toUpperCase();
    document.getElementById('opacity-value').textContent = `${Math.round(this.currentOpacity)}%`;
    
    // Atualiza slider de opacidade
    const opacitySlider = document.getElementById('opacity-slider');
    opacitySlider.style.background = `
      linear-gradient(to right, transparent 0%, ${hex} 100%),
      repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 
      50% / 8px 8px`;
    
    // Dispara evento
    this.colorPalette.dispatchEvent(new CustomEvent('colorChanged', {
      detail: { 
        color: hex,
        opacity: this.currentOpacity / 100
      }
    }));
  }

  setColorFromHex(hex) {
    // Converte hex para HSL
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    
    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    
    this.currentHue = h * 360;
    this.currentSaturation = s * 100;
    this.currentLightness = l * 100;
    
    // Atualiza sliders
    document.getElementById('hue-handle').style.left = `${(this.currentHue / 360) * 100}%`;
    
    // Atualiza canvas e handle
    this.drawColorGradient();
    const handle = document.getElementById('color-picker-handle');
    handle.style.left = `${this.currentSaturation}%`;
    handle.style.top = `${100 - this.currentLightness}%`;
    
    this.updateColorDisplay();
  }

  selectQuickColor(buttonElement) {
    // Remove seleção anterior
    document.querySelectorAll('.color-btn').forEach(btn => {
      btn.classList.remove('selected');
    });
    
    // Adiciona seleção atual
    buttonElement.classList.add('selected');
  }

  getSelectedColor() {
    return this.selectedColor;
  }

  setSelectedColor(hexColor) {
    this.selectedColor = hexColor;
    this.setColorFromHex(hexColor);
    console.log('Cor selecionada atualizada para:', hexColor);
  }

  getSelectedColorWithOpacity() {
    const color = this.hslToRgb(this.currentHue, this.currentSaturation, this.currentLightness);
    return `rgba(${color.r}, ${color.g}, ${color.b}, ${this.currentOpacity / 100})`;
  }

  // =====================================================================
  // SISTEMA EYEDROPPER
  // =====================================================================

  setupEyedropper() {
    // Canvas temporário para capturar cores
    this.tempCanvas = document.createElement('canvas');
    this.tempCtx = this.tempCanvas.getContext('2d');

    // Configurar evento do botão (já criado em createEyedropperButton)
    if (this.eyedropperBtn) {
      this.eyedropperBtn.addEventListener('click', () => {
        this.toggleEyedropper();
      });

        // Eyedropper configurado
    } else {
      console.warn('Botão eyedropper não foi criado corretamente');
    }
  }

  toggleEyedropper() {
    if (this.isEyedropperActive) {
      this.disableEyedropper();
    } else {
      this.enableEyedropper();
    }
  }

  enableEyedropper() {
    this.isEyedropperActive = true;
    
    // Adicionar classe active para usar estilos CSS
    this.eyedropperBtn.classList.add('active');

    // Procurar imagem de referência
    this.setupImageClickListener();
    
    console.log('Eyedropper ativado - clique na imagem de referência para capturar cor');
  }

  disableEyedropper() {
    this.isEyedropperActive = false;
    
    // Remover classe active
    this.eyedropperBtn.classList.remove('active');

    // Remover listeners da imagem
    this.removeImageClickListener();
    
    console.log('Eyedropper desativado');
  }

  setupImageClickListener() {
    console.log('Configurando listener para imagem de referência...');
    
    // Aguardar que a imagem apareça ou já esteja presente
    const checkForImage = () => {
      const floatingImage = document.getElementById('floating-reference-image');
      
      if (floatingImage) {
        console.log('Imagem de referência encontrada:', floatingImage);
        console.log('Imagem tem src?', !!floatingImage.src);
        console.log('Imagem está carregada?', floatingImage.complete);
        
        if (floatingImage.src && floatingImage.complete) {
          this.attachImageListener(floatingImage);
        } else if (floatingImage.src) {
          // Esperar a imagem carregar
          floatingImage.onload = () => {
            console.log('Imagem carregada, anexando listener...');
            this.attachImageListener(floatingImage);
          };
        } else {
          console.log('Imagem não tem src ainda, observando mudanças...');
          this.observeImageChanges();
        }
      } else {
        console.log('Imagem não encontrada, observando DOM...');
        this.observeImageChanges();
      }
    };

    checkForImage();
  }

  observeImageChanges() {
    // Se não há imagem, observar mudanças no DOM
    const observer = new MutationObserver(() => {
      const img = document.getElementById('floating-reference-image');
      if (img && img.src) {
        console.log('Imagem detectada via observer, anexando listener...');
        this.attachImageListener(img);
        observer.disconnect();
      }
    });
    
    observer.observe(document.body, { 
      childList: true, 
      subtree: true,
      attributes: true,
      attributeFilter: ['src']
    });

    // Desconectar observer após 10 segundos para evitar vazamentos
    setTimeout(() => {
      observer.disconnect();
      console.log('Observer de imagem desconectado após timeout');
    }, 10000);
  }

  attachImageListener(image) {
    if (!image) return;

    // Aplicar cursor crosshair de forma mais robusta
    image.style.setProperty('cursor', 'crosshair', 'important');
    image.style.pointerEvents = 'auto';
    image.style.userSelect = 'none';
    
    // Adicionar classe CSS para garantir o cursor
    image.classList.add('eyedropper-active');
    
    const pickColor = (event) => {
      event.preventDefault();
      event.stopPropagation();
      
      console.log('Clique detectado na imagem para capturar cor');
      
      const color = this.getColorFromImage(event, image);
      if (color) {
        console.log('Cor capturada:', color);
        this.setSelectedColor(color);
        this.disableEyedropper();
      } else {
        console.error('Falha ao capturar cor da imagem');
      }
    };

    // Guardar referência para poder remover depois
    this.imageClickHandler = pickColor;
    image.addEventListener('click', pickColor, { capture: true });

    // Garantir que o cursor seja aplicado em todos os eventos
    const ensureCursor = () => {
      if (this.isEyedropperActive) {
        image.style.setProperty('cursor', 'crosshair', 'important');
      }
    };
    
    image.addEventListener('mouseenter', ensureCursor);
    image.addEventListener('mouseover', ensureCursor);
    image.addEventListener('mousemove', ensureCursor);
    
    console.log('Listener de cor anexado à imagem com cursor crosshair');

    // Desativar se clicar fora
    const clickOutside = (event) => {
      if (!image.contains(event.target) && event.target !== this.eyedropperBtn) {
        this.disableEyedropper();
        document.removeEventListener('click', clickOutside);
      }
    };
    
    setTimeout(() => {
      document.addEventListener('click', clickOutside);
    }, 100);
  }

  removeImageClickListener() {
    const floatingImage = document.getElementById('floating-reference-image');
    if (floatingImage && this.imageClickHandler) {
      floatingImage.style.removeProperty('cursor');
      floatingImage.style.pointerEvents = '';
      floatingImage.classList.remove('eyedropper-active');
      floatingImage.removeEventListener('click', this.imageClickHandler, { capture: true });
      this.imageClickHandler = null;
      console.log('Cursor crosshair e listener removidos da imagem');
    }
  }

  getColorFromImage(event, img) {
    try {
      console.log('Iniciando captura de cor da imagem...');
      
      const rect = img.getBoundingClientRect();
      const x = Math.round(event.clientX - rect.left);
      const y = Math.round(event.clientY - rect.top);
      
      console.log(`Posição do clique: x=${x}, y=${y}`);
      console.log(`Dimensões da imagem: ${img.offsetWidth}x${img.offsetHeight}`);
      console.log(`Dimensões naturais: ${img.naturalWidth}x${img.naturalHeight}`);
      
      // Verificar se o clique está dentro da imagem
      if (x < 0 || y < 0 || x >= img.offsetWidth || y >= img.offsetHeight) {
        console.warn('Clique fora dos limites da imagem');
        return null;
      }
      
      // Ajustar para as dimensões reais da imagem
      const scaleX = img.naturalWidth / img.offsetWidth;
      const scaleY = img.naturalHeight / img.offsetHeight;
      
      const realX = Math.round(x * scaleX);
      const realY = Math.round(y * scaleY);
      
      console.log(`Posição real na imagem: x=${realX}, y=${realY}`);
      
      this.tempCanvas.width = img.naturalWidth;
      this.tempCanvas.height = img.naturalHeight;
      this.tempCtx.drawImage(img, 0, 0);
      
      const pixelData = this.tempCtx.getImageData(realX, realY, 1, 1).data;
      const hex = '#' + [pixelData[0], pixelData[1], pixelData[2]]
        .map(c => c.toString(16).padStart(2, '0')).join('');
      
      console.log(`RGB capturado: ${pixelData[0]}, ${pixelData[1]}, ${pixelData[2]}`);
      console.log(`Cor em hex: ${hex}`);
      
      return hex;
    } catch (error) {
      console.error('Erro ao capturar cor da imagem:', error);
      return null;
    }
  }

  // Método para verificar se eyedropper está ativo (usado externamente)
  isEyedropperActivated() {
    return this.isEyedropperActive;
  }

  // =====================================================================
  // SISTEMA DE PALETA DE CORES COM MEMÓRIA
  // =====================================================================

  createColorMemorySection() {
    // Container para memória de cores
    const memoryContainer = document.createElement('div');
    memoryContainer.style.cssText = `
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    `;

    // Título da seção
    const memoryTitle = document.createElement('div');
    memoryTitle.textContent = 'Recent Colors';
    memoryTitle.style.cssText = `
      color: rgba(255, 255, 255, 0.7);
      font-size: 11px;
      font-weight: 500;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    `;

    // Container para as cores
    this.memoryColorsContainer = document.createElement('div');
    this.memoryColorsContainer.style.cssText = `
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 4px;
      min-height: 30px;
    `;

    memoryContainer.appendChild(memoryTitle);
    memoryContainer.appendChild(this.memoryColorsContainer);
    
    // Inserir antes da paleta de cores
    this.colorPalette.parentNode.insertBefore(memoryContainer, this.colorPalette);
    
    // Renderizar cores da memória
    this.renderMemoryColors();
  }

  createImageColorsSection() {
    // Container para cores da imagem
    const imageContainer = document.createElement('div');
    imageContainer.style.cssText = `
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    `;

    // Título da seção
    const imageTitle = document.createElement('div');
    imageTitle.textContent = 'Image Colors';
    imageTitle.style.cssText = `
      color: rgba(255, 255, 255, 0.7);
      font-size: 11px;
      font-weight: 500;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    `;

    // Container para as cores
    this.imageColorsContainer = document.createElement('div');
    this.imageColorsContainer.style.cssText = `
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 4px;
      min-height: 30px;
    `;

    // Mensagem quando não há imagem
    this.noImageMessage = document.createElement('div');
    this.noImageMessage.textContent = 'Load an image to extract colors';
    this.noImageMessage.style.cssText = `
      color: rgba(255, 255, 255, 0.4);
      font-size: 10px;
      font-style: italic;
      text-align: center;
      padding: 8px 4px;
      line-height: 1.3;
    `;

    imageContainer.appendChild(imageTitle);
    imageContainer.appendChild(this.imageColorsContainer);
    imageContainer.appendChild(this.noImageMessage);
    
    // Inserir antes da paleta de cores (após memória)
    this.colorPalette.parentNode.insertBefore(imageContainer, this.colorPalette);
  }

  loadColorMemory() {
    try {
      const saved = localStorage.getItem('vertex-color-memory');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.warn('Erro ao carregar memória de cores:', error);
      return [];
    }
  }

  saveColorMemory() {
    try {
      localStorage.setItem('vertex-color-memory', JSON.stringify(this.colorMemory));
    } catch (error) {
      console.warn('Erro ao salvar memória de cores:', error);
    }
  }

  addToColorMemory(color) {
    // Não adicionar se já existe
    if (this.colorMemory.includes(color)) {
      // Mover para o início se já existe
      this.colorMemory = [color, ...this.colorMemory.filter(c => c !== color)];
    } else {
      // Adicionar no início
      this.colorMemory.unshift(color);
    }
    
    // Limitar quantidade
    if (this.colorMemory.length > this.maxMemoryColors) {
      this.colorMemory = this.colorMemory.slice(0, this.maxMemoryColors);
    }
    
    this.saveColorMemory();
    this.renderMemoryColors();
  }

  renderMemoryColors() {
    this.memoryColorsContainer.innerHTML = '';
    
    this.colorMemory.forEach(color => {
      const btn = this.createColorButton(color, 'memory');
      this.memoryColorsContainer.appendChild(btn);
    });
  }

  renderImageColors() {
    this.imageColorsContainer.innerHTML = '';
    
    if (this.imageColors.length === 0) {
      this.noImageMessage.style.display = 'block';
      return;
    }
    
    this.noImageMessage.style.display = 'none';
    
    this.imageColors.forEach(color => {
      const btn = this.createColorButton(color, 'image');
      this.imageColorsContainer.appendChild(btn);
    });
  }

  createColorButton(color, type) {
    const btn = document.createElement('button');
    btn.className = 'color-btn memory-color-btn';
    btn.style.cssText = `
      width: 100%;
      height: 24px;
      background: ${color};
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 3px;
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;
      padding: 0;
    `;
    
    btn.title = `${type === 'memory' ? 'Recent' : 'Image'} color: ${color}`;
    
    // Hover effect
    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'scale(1.05)';
      btn.style.borderColor = 'rgba(255, 255, 255, 0.3)';
      btn.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
      btn.style.zIndex = '10';
    });
    
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'scale(1)';
      btn.style.borderColor = 'rgba(255, 255, 255, 0.1)';
      btn.style.boxShadow = '';
      btn.style.zIndex = '1';
    });
    
    btn.addEventListener('click', () => {
      this.setColorFromHex(color);
      this.selectMemoryColor(btn);
    });
    
    return btn;
  }

  selectMemoryColor(buttonElement) {
    // Remove seleção anterior de cores de memória
    document.querySelectorAll('.memory-color-btn').forEach(btn => {
      btn.classList.remove('selected');
    });
    
    // Adiciona seleção atual
    buttonElement.classList.add('selected');
  }

  setupImageColorExtraction() {
    // Escutar quando uma imagem for carregada
    document.addEventListener('imageLoaded', (event) => {
      console.log('Imagem carregada, extraindo cores...');
      this.extractColorsFromImageSrc(event.detail.src);
    });
    
    // Escutar quando uma imagem for removida
    document.addEventListener('imageRemoved', () => {
      console.log('Imagem removida, limpando cores extraídas...');
      this.imageColors = [];
      this.renderImageColors();
    });
  }

  extractColorsFromImageSrc(imageSrc) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      console.log('Iniciando extração de cores da imagem...');
      const colors = this.extractDominantColors(img);
      this.imageColors = colors;
      this.renderImageColors();
      console.log('Cores extraídas:', colors);
    };
    
    img.onerror = () => {
      console.warn('Erro ao carregar imagem para extração de cores');
    };
    
    img.src = imageSrc;
  }

  extractDominantColors(img) {
    // Criar canvas temporário para análise
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Reduzir tamanho para performance (máximo 100x100)
    const maxSize = 100;
    const ratio = Math.min(maxSize / img.width, maxSize / img.height);
    canvas.width = img.width * ratio;
    canvas.height = img.height * ratio;
    
    // Desenhar imagem reduzida
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    
    // Extrair dados dos pixels
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    
    // Contar frequência de cores (agrupadas)
    const colorCount = {};
    
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const a = pixels[i + 3];
      
      // Ignorar pixels transparentes
      if (a < 128) continue;
      
      // Agrupar cores similares (reduzir precisão)
      const groupedR = Math.floor(r / 32) * 32;
      const groupedG = Math.floor(g / 32) * 32;
      const groupedB = Math.floor(b / 32) * 32;
      
      const colorKey = `${groupedR},${groupedG},${groupedB}`;
      colorCount[colorKey] = (colorCount[colorKey] || 0) + 1;
    }
    
    // Ordenar por frequência e pegar as mais comuns
    const sortedColors = Object.entries(colorCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, this.maxImageColors);
    
    // Converter para hex
    const dominantColors = sortedColors.map(([colorKey]) => {
      const [r, g, b] = colorKey.split(',').map(Number);
      return this.rgbToHex(r, g, b);
    });
    
    // Filtrar cores muito similares e muito escuras/claras
    const filteredColors = this.filterSimilarColors(dominantColors);
    
    return filteredColors.slice(0, this.maxImageColors);
  }

  filterSimilarColors(colors) {
    const filtered = [];
    const minDifference = 30; // Diferença mínima entre cores
    
    for (const color of colors) {
      const rgb = this.hexToRgb(color);
      
      // Filtrar cores muito escuras ou muito claras
      const brightness = (rgb.r + rgb.g + rgb.b) / 3;
      if (brightness < 20 || brightness > 235) continue;
      
      // Verificar se é muito similar a cores já adicionadas
      const isSimilar = filtered.some(existingColor => {
        const existingRgb = this.hexToRgb(existingColor);
        const diff = Math.abs(rgb.r - existingRgb.r) + 
                    Math.abs(rgb.g - existingRgb.g) + 
                    Math.abs(rgb.b - existingRgb.b);
        return diff < minDifference;
      });
      
      if (!isSimilar) {
        filtered.push(color);
      }
    }
    
    return filtered;
  }

  hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
  }

  // Métodos públicos para acesso externo
  getColorMemory() {
    return [...this.colorMemory];
  }

  getImageColors() {
    return [...this.imageColors];
  }

  clearColorMemory() {
    this.colorMemory = [];
    this.saveColorMemory();
    this.renderMemoryColors();
  }
}