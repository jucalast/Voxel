// =====================================================================
// SISTEMA DE HISTÓRICO DE UPLOADS - MÓDULO INDEPENDENTE
// =====================================================================

class UploadHistorySystem {
  constructor(
    sidebarElement,
    buttonElement,
    closeElement,
    contentElement,
    leftPanelElement,
    iconToolbarElement,
    fileUploadSystem,
    roomModeSystem,
    clearSceneCallback,
    addVoxelCallback,
    saveStateCallback,
    updateVoxelCountCallback
  ) {
    // Elementos DOM
    this.uploadHistorySidebar = sidebarElement;
    this.uploadHistoryBtn = buttonElement;
    this.uploadHistoryClose = closeElement;
    this.uploadHistoryContent = contentElement;
    this.leftPanel = leftPanelElement;
    this.iconToolbar = iconToolbarElement;
    
    // Sistemas dependentes
    this.fileUploadSystem = fileUploadSystem;
    this.roomModeSystem = roomModeSystem;
    
    // Callbacks
    this.clearScene = clearSceneCallback;
    this.addVoxel = addVoxelCallback;
    this.saveState = saveStateCallback;
    this.updateVoxelCount = updateVoxelCountCallback;
    
    // Array para armazenar histórico de uploads
    this.uploadHistory = [];
    
    this.init();
  }

  /**
   * Inicializar event listeners e configurar sistema
   */
  init() {
    this.setupEventListeners();
    this.setupFileUploadCallbacks();
    this.setupFileInput();
    this.setupClickOutside();
    
    // Expor função globalmente para uso pelo roomMode.js
    window.updateToolbarPosition = this.updateToolbarPosition.bind(this);
  }

  /**
   * Configurar event listeners principais
   */
  setupEventListeners() {
    if (this.uploadHistoryBtn) {
      this.uploadHistoryBtn.addEventListener('click', () => {
        // Fechar color sidebar se estiver aberto
        if (this.leftPanel && this.leftPanel.classList.contains('show')) {
          this.leftPanel.classList.remove('show');
        }

        // Toggle do sidebar de histórico
        if (this.uploadHistorySidebar.classList.contains('show')) {
          this.closeUploadHistorySidebar();
        } else {
          this.openUploadHistorySidebar();
        }

        // Atualizar posição da barra de ferramentas considerando todos os estados
        this.updateToolbarPosition();
      });
    }

    if (this.uploadHistoryClose) {
      this.uploadHistoryClose.addEventListener('click', () => {
        this.closeUploadHistorySidebar();
      });
    }
  }

  /**
   * Configurar input de arquivo no sidebar
   */
  setupFileInput() {
    const voxelFileInput = document.getElementById('voxelFileInput');
    if (voxelFileInput) {
      voxelFileInput.addEventListener('change', (event) => {
        const files = event.target.files;
        if (files && files.length > 0) {
          console.log('📁 Arquivos selecionados via sidebar:', files.length);
          
          // Processar múltiplos arquivos se selecionados
          Array.from(files).forEach(file => {
            if (this.fileUploadSystem) {
              // Determinar o tipo de callback baseado no modo atual
              const isRoomMode = this.roomModeSystem && this.roomModeSystem.isRoomMode;
              const callbackType = isRoomMode ? 'roomObject' : 'voxel';
              
              console.log(`📁 Processando arquivo no modo ${isRoomMode ? 'sala' : 'editor'}: ${callbackType}`);
              
              // Simular o comportamento do handleFileChange
              this.fileUploadSystem.currentCallbackType = callbackType;
              const fakeEvent = { target: { files: [file] } };
              this.fileUploadSystem.handleFileChange(fakeEvent);
            }
          });
          
          // Limpar o input para permitir seleção do mesmo arquivo novamente
          event.target.value = '';
        }
      });
    }
  }

  /**
   * Configurar clique fora para fechar sidebar
   */
  setupClickOutside() {
    document.addEventListener('click', (e) => {
      if (this.uploadHistorySidebar && this.uploadHistorySidebar.classList.contains('show') &&
          !this.uploadHistorySidebar.contains(e.target) &&
          !this.uploadHistoryBtn.contains(e.target)) {
        this.closeUploadHistorySidebar();
      }
    });
  }

  /**
   * Configurar callbacks do sistema de upload
   */
  setupFileUploadCallbacks() {
    if (!this.fileUploadSystem) return;

    const originalOnVoxelDataLoaded = this.fileUploadSystem.callbacks.onVoxelDataLoaded;
    const originalOnRoomObjectLoaded = this.fileUploadSystem.callbacks.onRoomObjectLoaded;
    
    this.fileUploadSystem.setCallbacks({
      ...this.fileUploadSystem.callbacks,
      onVoxelDataLoaded: (voxelData, filename) => {
        // Chamar callback original
        originalOnVoxelDataLoaded(voxelData, filename);

        // Adicionar ao histórico APENAS se estivermos no modo editor
        const isCurrentlyInRoomMode = this.roomModeSystem && this.roomModeSystem.isRoomMode;
        if (!isCurrentlyInRoomMode) {
          console.log('📝 Adicionando ao histórico do EDITOR');
          this.addToUploadHistory(voxelData, filename, 'voxel');
        } else {
          console.log('🏠 Upload no room mode - não adicionando ao histórico do editor');
        }
      },
      onRoomObjectLoaded: (voxelData, filename) => {
        // Chamar callback original
        originalOnRoomObjectLoaded(voxelData, filename);

        // NÃO adicionar objetos de sala ao histórico do editor
        // O room mode tem seu próprio sistema de histórico
        console.log('🏠 Objeto de sala carregado - gerenciado pelo roomMode.js');
      }
    });
  }

  /**
   * Abrir sidebar de histórico
   */
  openUploadHistorySidebar() {
    if (this.uploadHistorySidebar) {
      this.uploadHistorySidebar.classList.add('show');
      console.log('📂 Sidebar de histórico de uploads aberto');
    }
  }

  /**
   * Fechar sidebar de histórico
   */
  closeUploadHistorySidebar() {
    if (this.uploadHistorySidebar) {
      this.uploadHistorySidebar.classList.remove('show');
      console.log('📂 Sidebar de histórico de uploads fechado');

      // Atualizar posição da barra de ferramentas considerando todos os estados
      this.updateToolbarPosition();
    }
  }

  /**
   * Atualizar posição da barra de ferramentas
   */
  updateToolbarPosition() {
    if (!this.iconToolbar) return;
    
    // Prioridade: Sidebar > Left Panel > Posição padrão
    if (this.uploadHistorySidebar && this.uploadHistorySidebar.classList.contains('show')) {
      // Sidebar aberto: mover barra para a direita do sidebar
      this.iconToolbar.style.left = '365px';
    } else if (this.leftPanel && this.leftPanel.classList.contains('show')) {
      // Painel esquerdo aberto: mover barra para a direita do painel
      this.iconToolbar.style.left = '345px';
    } else {
      // Posição padrão
      this.iconToolbar.style.left = '10px';
    }
  }

  /**
   * Adicionar arquivo ao histórico
   * @param {Array} voxelData - Dados dos voxels
   * @param {string} filename - Nome do arquivo
   * @param {string} type - Tipo do arquivo (voxel/roomObject)
   */
  addToUploadHistory(voxelData, filename, type = 'voxel') {
    const uploadItem = {
      id: Date.now(),
      filename: filename,
      type: type,
      voxelCount: voxelData.length,
      timestamp: new Date(),
      data: voxelData
    };

    this.uploadHistory.unshift(uploadItem); // Adicionar no início

    // Limitar histórico a 20 itens
    if (this.uploadHistory.length > 20) {
      this.uploadHistory = this.uploadHistory.slice(0, 20);
    }

    this.updateUploadHistoryDisplay();
    console.log(`📝 Arquivo "${filename}" adicionado ao histórico (${voxelData.length} voxels)`);
  }

  /**
   * Renderizar lista de histórico
   * @param {HTMLElement} element - Elemento onde renderizar
   * @param {Array} history - Array do histórico
   */
  renderHistoryList(element, history) {
    if (!element) return;

    if (history.length === 0) {
      element.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
          </svg>
          <p>Nenhum arquivo carregado ainda</p>
          <small>Use o botão "Carregar" para começar</small>
        </div>
      `;
      return;
    }

    element.innerHTML = history.map(item => `
      <div class="object-card" data-id="${item.id}">
        <div class="object-card-info">
          <div class="object-card-header">
            <div class="object-card-name">${item.filename}</div>
            <span class="mode-badge editor-mode">EDITOR</span>
          </div>
          <div class="object-card-meta">
            ${item.voxelCount} voxels • ${item.timestamp.toLocaleTimeString()}
          </div>
        </div>
        <div class="object-card-actions">
          <button class="object-card-btn reload" data-id="${item.id}" title="Recarregar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"/>
              <polyline points="1 20 1 14 7 14"/>
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
            </svg>
          </button>
          <button class="object-card-btn delete" data-id="${item.id}" title="Remover">
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

    // Adicionar event listeners para os botões
    element.querySelectorAll('.reload').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(e.currentTarget.dataset.id);
        this.reloadFromHistory(id);
      });
    });

    element.querySelectorAll('.delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(e.currentTarget.dataset.id);
        this.removeFromHistory(id);
      });
    });
  }

  /**
   * Atualizar exibição do histórico
   */
  updateUploadHistoryDisplay() {
    // Apenas atualizar o histórico do editor, não interferir com o room mode
    const uploadHistoryListElement = document.getElementById('uploadHistoryList');
    if (uploadHistoryListElement) {
      this.renderHistoryList(uploadHistoryListElement, this.uploadHistory);
    }
    
    // O roomUploadHistoryList é gerenciado pelo roomMode.js
    // Removido para evitar conflitos
  }

  /**
   * Recarregar arquivo do histórico
   * @param {number} id - ID do item no histórico
   */
  reloadFromHistory(id) {
    const item = this.uploadHistory.find(item => item.id === id);
    if (!item) return;

    console.log(`🔄 Recarregando "${item.filename}" do histórico (tipo: ${item.type})`);

    // Perguntar confirmação
    const shouldLoad = confirm(`Recarregar "${item.filename}" (${item.voxelCount} voxels)? Isso irá substituir a cena atual.`);

    if (!shouldLoad) return;

    try {
      // Limpar cena atual
      this.clearScene();

      if (item.type === 'roomObject') {
        // Se for um objeto de sala, usar o callback apropriado
        if (this.roomModeSystem && !this.roomModeSystem.isRoomMode) {
          this.roomModeSystem.enterRoomMode();
        }
        this.roomModeSystem.addRoomObject(item.data, item.filename);
        console.log(`✅ Objeto de sala "${item.filename}" recarregado com sucesso`);
      } else {
        // Para voxels normais, adicionar individualmente
        item.data.forEach(voxel => {
          this.addVoxel(voxel.x, voxel.y, voxel.z, voxel.color, false);
        });
        console.log(`✅ Arquivo "${item.filename}" recarregado com sucesso`);
      }

      // Salvar estado
      this.saveState();
      this.updateVoxelCount();

      // Fechar sidebar
      this.closeUploadHistorySidebar();

    } catch (error) {
      console.error('❌ Erro ao recarregar arquivo:', error);
      alert('Erro ao recarregar arquivo: ' + error.message);
    }
  }

  /**
   * Remover arquivo do histórico
   * @param {number} id - ID do item no histórico
   */
  removeFromHistory(id) {
    const index = this.uploadHistory.findIndex(item => item.id === id);
    if (index === -1) return;

    const item = this.uploadHistory[index];
    const shouldDelete = confirm(`Remover "${item.filename}" do histórico?`);

    if (!shouldDelete) return;

    this.uploadHistory.splice(index, 1);
    this.updateUploadHistoryDisplay();

    console.log(`🗑️ Arquivo "${item.filename}" removido do histórico`);
  }

  /**
   * Obter histórico atual
   * @returns {Array} Array do histórico
   */
  getHistory() {
    return this.uploadHistory;
  }

  /**
   * Verificar se sidebar está aberto
   * @returns {boolean} True se estiver aberto
   */
  isSidebarOpen() {
    return this.uploadHistorySidebar && this.uploadHistorySidebar.classList.contains('show');
  }
}

// Exportar classe para ES6 modules
export { UploadHistorySystem };

// Expor classe globalmente para compatibilidade
if (typeof window !== 'undefined') {
  window.UploadHistorySystem = UploadHistorySystem;
}