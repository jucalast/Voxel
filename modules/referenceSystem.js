// =====================================================================
// MÓDULO: SISTEMA DE UPLOAD DE IMAGEM DE REFERÊNCIA FLUTUANTE
// =====================================================================

export class ReferenceImageSystem {
  constructor(uploadElement, fileUploadSystem, imageElement, controlsElement, opacityBtn, removeBtn) {
    this.uploadElement = uploadElement;
    this.fileUploadSystem = fileUploadSystem; // Store the fileUploadSystem instance
    this.imageElement = imageElement;
    this.controlsElement = controlsElement;
    this.opacityBtn = opacityBtn;
    this.removeBtn = removeBtn;
    this.opacity = 1.0;
    
    // Elementos da imagem flutuante
    this.floatingContainer = document.getElementById('floating-reference');
    this.floatingImage = document.getElementById('floating-reference-image');
    this.floatingOpacityBtn = document.getElementById('floating-opacity-btn');
    this.floatingRemoveBtn = document.getElementById('floating-remove-btn');
    this.floatingHeader = document.getElementById('floating-reference-header');
    this.resizeHandle = document.getElementById('resize-handle');
    
    // Debug: verificar se elementos flutuantes existem
    console.log('Elementos de referência encontrados:', {
      uploadElement: !!this.uploadElement,
      fileUploadSystem: !!this.fileUploadSystem,
      container: !!this.floatingContainer,
      image: !!this.floatingImage,
      opacityBtn: !!this.floatingOpacityBtn,
      removeBtn: !!this.floatingRemoveBtn,
      header: !!this.floatingHeader,
      resizeHandle: !!this.resizeHandle
    });
    
    if (!this.fileUploadSystem) {
      console.warn('fileUploadSystem is null, upload functionality may not work.');
    }
    
    // Estados de interação
    this.isDragging = false;
    this.isResizing = false;
    this.dragOffset = { x: 0, y: 0 };
    this.startSize = { width: 0, height: 0 };
    this.startPos = { x: 0, y: 0 };
    
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.setupFloatingImageInteractions();
  }

  setupEventListeners() {
    // Click no div para abrir seletor de arquivo
    if (this.uploadElement) {
      this.uploadElement.addEventListener('click', () => {
        console.log('Botão de upload clicado, abrindo seletor de arquivo...');
        if (this.fileUploadSystem) {
          this.fileUploadSystem.openDialog('image/*', 'referenceImage');
        } else {
          console.warn('fileUploadSystem not available for opening dialog.');
        }
      });
    } else {
      console.warn('Upload element (uploadBtn) não encontrado.');
    }

    // Funcionalidade de drag & drop moderna (apenas se uploadElement existir)
    if (this.uploadElement) {
      this.uploadElement.addEventListener('dragover', (event) => {
        event.preventDefault();
        this.uploadElement.classList.add('drag-over');
      });

      this.uploadElement.addEventListener('dragleave', (event) => {
        event.preventDefault();
        this.uploadElement.classList.remove('drag-over');
      });

      this.uploadElement.addEventListener('drop', (event) => {
        event.preventDefault();
        this.uploadElement.classList.remove('drag-over');
        this.uploadElement.style.background = '#2a2a2a';
        
        const files = event.dataTransfer.files;
        if (files.length > 0 && files[0].type.startsWith('image/')) {
          // Use fileUploadSystem to handle the dropped file
          if (this.fileUploadSystem) {
            this.fileUploadSystem.handleFileChange({ target: { files: [files[0]] } });
          } else {
            console.warn('fileUploadSystem not available for handling dropped file.');
          }
        }
      });
    }

    // Controle de opacidade (apenas se existir)
    if (this.opacityBtn) {
      this.opacityBtn.addEventListener('click', () => {
        this.changeOpacity();
      });
    }

    // Remover imagem (apenas se existir)
    if (this.removeBtn) {
      this.removeBtn.addEventListener('click', () => {
        this.removeImage();
      });
    }
  }

  setupFloatingImageInteractions() {
    // Controles da imagem flutuante (verificar se existem)
    if (this.floatingOpacityBtn) {
      this.floatingOpacityBtn.addEventListener('click', () => {
        this.changeOpacity();
      });
    }

    if (this.floatingRemoveBtn) {
      this.floatingRemoveBtn.addEventListener('click', () => {
        this.removeImage();
      });
    }

    // Arrastar imagem flutuante
    if (this.floatingHeader) {
      this.floatingHeader.addEventListener('mousedown', (e) => {
        this.startDragging(e);
      });
    }

    // Redimensionar imagem flutuante
    if (this.resizeHandle) {
      this.resizeHandle.addEventListener('mousedown', (e) => {
        this.startResizing(e);
      });
    }

    // Eventos globais
    document.addEventListener('mousemove', (e) => {
      if (this.isDragging) this.drag(e);
      if (this.isResizing) this.resize(e);
    });

    document.addEventListener('mouseup', () => {
      this.stopDragging();
      this.stopResizing();
    });

    // Prevenir seleção de texto durante drag
    this.floatingContainer.addEventListener('selectstart', (e) => {
      if (this.isDragging || this.isResizing) e.preventDefault();
    });
  }

  startDragging(e) {
    this.isDragging = true;
    this.floatingContainer.classList.add('dragging');
    
    const rect = this.floatingContainer.getBoundingClientRect();
    this.dragOffset.x = e.clientX - rect.left;
    this.dragOffset.y = e.clientY - rect.top;
    
    e.preventDefault();
  }

  drag(e) {
    if (!this.isDragging) return;
    
    const container = document.getElementById('three-container');
    const containerRect = container.getBoundingClientRect();
    
    let newX = e.clientX - containerRect.left - this.dragOffset.x;
    let newY = e.clientY - containerRect.top - this.dragOffset.y;
    
    // Limitar dentro do container
    const maxX = container.clientWidth - this.floatingContainer.offsetWidth;
    const maxY = container.clientHeight - this.floatingContainer.offsetHeight;
    
    newX = Math.max(0, Math.min(maxX, newX));
    newY = Math.max(0, Math.min(maxY, newY));
    
    this.floatingContainer.style.left = newX + 'px';
    this.floatingContainer.style.top = newY + 'px';
    this.floatingContainer.style.right = 'auto';
  }

  stopDragging() {
    this.isDragging = false;
    this.floatingContainer.classList.remove('dragging');
  }

  startResizing(e) {
    this.isResizing = true;
    this.floatingContainer.classList.add('resizing');
    
    this.startSize.width = this.floatingContainer.offsetWidth;
    this.startPos.x = e.clientX;
    this.startPos.y = e.clientY;
    
    e.preventDefault();
    e.stopPropagation();
  }

  resize(e) {
    if (!this.isResizing) return;
    
    const deltaX = e.clientX - this.startPos.x;
    
    // Calcular novo tamanho
    const newWidth = Math.max(150, this.startSize.width + deltaX);
    
    // Limitar tamanho máximo
    const maxWidth = window.innerWidth * 0.8;
    const finalWidth = Math.min(newWidth, maxWidth);
    
    this.floatingContainer.style.width = finalWidth + 'px';
  }

  stopResizing() {
    this.isResizing = false;
    this.floatingContainer.classList.remove('resizing');
  }

  

  changeOpacity() {
    this.opacity -= 0.25;
    if (this.opacity < 0.25) this.opacity = 1.0;
    
    // Atualizar ambas as imagens (apenas se existirem)
    if (this.imageElement) {
      this.imageElement.style.opacity = this.opacity;
    }
    if (this.floatingImage) {
      this.floatingImage.style.opacity = this.opacity;
    }
    
    // Atualizar textos dos botões (apenas se existirem)
    const opacityText = `Opacity: ${Math.round(this.opacity * 100)}%`;
    if (this.opacityBtn) {
      this.opacityBtn.textContent = opacityText;
    }
    if (this.floatingOpacityBtn) {
      this.floatingOpacityBtn.title = opacityText;
    }
  }

  removeImage() {
    // Esconder imagem na sidebar (apenas se existir)
    if (this.imageElement) {
      this.imageElement.style.display = 'none';
    }
    if (this.controlsElement) {
      this.controlsElement.classList.remove('active');
    }
    
    // Esconder imagem flutuante (apenas se existir)
    if (this.floatingContainer) {
      this.floatingContainer.style.display = 'none';
    }
    
    // Resetar valores (apenas se existirem)
    
    this.opacity = 1.0;
    
    // Resetar textos dos botões (apenas se existirem)
    if (this.opacityBtn) {
      this.opacityBtn.textContent = 'Opacity: 100%';
    }
    if (this.floatingOpacityBtn) {
      this.floatingOpacityBtn.title = 'Change Opacity';
    }
    
    // Não alterar o uploadBtn que já tem o ícone SVG correto
    // if (this.uploadElement) {
    //   this.uploadElement.innerHTML = '';
    // }
    
    console.log('Imagem de referência removida');
    
    // Dispara evento customizado para limpeza de cores
    document.dispatchEvent(new CustomEvent('imageRemoved'));
    
    // Mantém compatibilidade com outros sistemas (apenas se existir)
    if (this.uploadElement) {
      this.uploadElement.dispatchEvent(new CustomEvent('imageRemoved'));
    }
  }

  getOpacity() {
    return this.opacity;
  }

  setOpacity(value) {
    this.opacity = Math.max(0.25, Math.min(1.0, value));
    if (this.imageElement) {
      this.imageElement.style.opacity = this.opacity;
    }
    if (this.opacityBtn) {
      this.opacityBtn.textContent = `Opacity: ${Math.round(this.opacity * 100)}%`;
    }
  }

  setImage(imageDataUrl) {
    // Set image in sidebar
    if (this.imageElement) {
      this.imageElement.src = imageDataUrl;
      this.imageElement.style.display = 'block';
    }
    
    // Set image in floating reference
    if (this.floatingImage) {
      this.floatingImage.src = imageDataUrl;
      this.floatingImage.style.display = 'block';
    }
    
    // Show controls if they exist
    if (this.controlsElement) {
      this.controlsElement.classList.add('active');
    }
    
    // Show floating container if it exists
    if (this.floatingContainer) {
      this.floatingContainer.style.display = 'block';
    }
    
    // Reset opacity to full
    this.opacity = 1.0;
    this.changeOpacity();
    
    console.log('✅ Imagem de referência definida com sucesso');
  }
}