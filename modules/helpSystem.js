// =====================================================================
// SISTEMA DE AJUDA - HELP SYSTEM
// =====================================================================

/**
 * Sistema responsável por gerenciar o painel de ajuda flutuante
 * Inclui abertura/fechamento, atalhos de teclado e interações
 */
export class HelpSystem {
  constructor(helpButton, helpPanel, helpClose) {
    // Elementos DOM
    this.helpButton = helpButton;
    this.helpPanel = helpPanel;
    this.helpClose = helpClose;
    
    // Estado
    this.isOpen = false;
    
    // Bind methods
    this.handleToggle = this.handleToggle.bind(this);
    this.handleClose = this.handleClose.bind(this);
    this.handleClickOutside = this.handleClickOutside.bind(this);
    this.handleKeydown = this.handleKeydown.bind(this);
    
    console.log('📚 HelpSystem inicializado');
  }

  /**
   * Inicializa o sistema de ajuda
   */
  init() {
    this.setupEventListeners();
    console.log('📚 Sistema de ajuda inicializado');
  }

  /**
   * Configura todos os event listeners
   */
  setupEventListeners() {
    // Event listener do botão de ajuda
    if (this.helpButton) {
      this.helpButton.addEventListener('click', this.handleToggle);
      console.log('📚 Event listener do botão de ajuda configurado');
    }

    // Event listener do botão fechar
    if (this.helpClose) {
      this.helpClose.addEventListener('click', this.handleClose);
      console.log('📚 Event listener do botão fechar configurado');
    }

    // Event listener para clique fora do painel
    document.addEventListener('click', this.handleClickOutside);

    // Event listener para atalho F1
    document.addEventListener('keydown', this.handleKeydown);

    console.log('📚 Todos os event listeners do sistema de ajuda configurados');
  }

  /**
   * Remove todos os event listeners
   */
  removeEventListeners() {
    if (this.helpButton) {
      this.helpButton.removeEventListener('click', this.handleToggle);
    }
    
    if (this.helpClose) {
      this.helpClose.removeEventListener('click', this.handleClose);
    }
    
    document.removeEventListener('click', this.handleClickOutside);
    document.removeEventListener('keydown', this.handleKeydown);
    
    console.log('📚 Event listeners do sistema de ajuda removidos');
  }

  /**
   * Alterna a visibilidade do painel de ajuda
   */
  toggle() {
    if (!this.helpPanel) return;

    this.isOpen = !this.isOpen;
    
    if (this.isOpen) {
      this.open();
    } else {
      this.close();
    }
  }

  /**
   * Abre o painel de ajuda
   */
  open() {
    if (!this.helpPanel) return;

    this.helpPanel.classList.add('show');
    this.isOpen = true;
    console.log('📚 Painel de ajuda aberto');
  }

  /**
   * Fecha o painel de ajuda
   */
  close() {
    if (!this.helpPanel) return;

    this.helpPanel.classList.remove('show');
    this.isOpen = false;
    console.log('📚 Painel de ajuda fechado');
  }

  /**
   * Verifica se o painel está aberto
   * @returns {boolean}
   */
  isHelpOpen() {
    return this.isOpen;
  }

  // =====================================================================
  // EVENT HANDLERS
  // =====================================================================

  /**
   * Handler para toggle do painel
   * @param {Event} event 
   */
  handleToggle(event) {
    event.preventDefault();
    event.stopPropagation();
    this.toggle();
  }

  /**
   * Handler para fechar o painel
   * @param {Event} event 
   */
  handleClose(event) {
    event.preventDefault();
    event.stopPropagation();
    this.close();
  }

  /**
   * Handler para clique fora do painel
   * @param {Event} event 
   */
  handleClickOutside(event) {
    // Só fechar se o painel estiver aberto
    if (!this.isOpen || !this.helpPanel) return;

    // Verificar se o clique foi fora do painel e não no botão de ajuda
    const clickedOutsidePanel = !this.helpPanel.contains(event.target);
    const clickedOnButton = this.helpButton && this.helpButton.contains(event.target);

    if (clickedOutsidePanel && !clickedOnButton) {
      this.close();
    }
  }

  /**
   * Handler para atalhos de teclado
   * @param {KeyboardEvent} event 
   */
  handleKeydown(event) {
    // Atalho F1 para abrir/fechar ajuda
    if (event.key === 'F1') {
      event.preventDefault();
      this.toggle();
    }

    // Atalho Escape para fechar ajuda (se estiver aberta)
    if (event.key === 'Escape' && this.isOpen) {
      event.preventDefault();
      this.close();
    }
  }

  // =====================================================================
  // MÉTODOS DE UTILIDADE
  // =====================================================================

  /**
   * Atualiza a posição do painel de ajuda
   * Útil para responsividade
   */
  updatePosition() {
    if (!this.helpPanel) return;

    // Verificar se o painel está dentro da viewport
    const rect = this.helpPanel.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let adjustmentsMade = false;

    // Ajustar horizontalmente se necessário
    if (rect.right > viewportWidth) {
      this.helpPanel.style.right = '20px';
      this.helpPanel.style.left = 'auto';
      adjustmentsMade = true;
    }

    // Ajustar verticalmente se necessário  
    if (rect.bottom > viewportHeight) {
      this.helpPanel.style.maxHeight = `${viewportHeight - 100}px`;
      adjustmentsMade = true;
    }

    if (adjustmentsMade) {
      console.log('📚 Posição do painel de ajuda ajustada');
    }
  }

  /**
   * Adiciona um novo shortcut ao painel de ajuda dinamicamente
   * @param {string} sectionTitle - Título da seção
   * @param {string} shortcut - Tecla/combinação do shortcut
   * @param {string} description - Descrição do que faz
   */
  addShortcut(sectionTitle, shortcut, description) {
    if (!this.helpPanel) return;

    // Encontrar ou criar a seção
    let section = this.findOrCreateSection(sectionTitle);
    
    // Criar item de ajuda
    const helpItem = document.createElement('div');
    helpItem.className = 'help-item';
    helpItem.innerHTML = `
      <div class="shortcut">${shortcut}</div>
      <div class="description">${description}</div>
    `;

    section.appendChild(helpItem);
    console.log(`📚 Shortcut adicionado: ${shortcut} - ${description}`);
  }

  /**
   * Remove um shortcut do painel de ajuda
   * @param {string} shortcut - Tecla/combinação do shortcut a remover
   */
  removeShortcut(shortcut) {
    if (!this.helpPanel) return;

    const helpItems = this.helpPanel.querySelectorAll('.help-item');
    helpItems.forEach(item => {
      const shortcutElement = item.querySelector('.shortcut');
      if (shortcutElement && shortcutElement.textContent.trim() === shortcut) {
        item.remove();
        console.log(`📚 Shortcut removido: ${shortcut}`);
      }
    });
  }

  /**
   * Encontra uma seção existente ou cria uma nova
   * @param {string} title - Título da seção
   * @returns {HTMLElement}
   */
  findOrCreateSection(title) {
    const helpContent = this.helpPanel.querySelector('.help-content');
    if (!helpContent) return null;

    // Procurar seção existente
    const sections = helpContent.querySelectorAll('.help-section h3');
    for (const sectionTitle of sections) {
      if (sectionTitle.textContent.includes(title)) {
        return sectionTitle.parentElement;
      }
    }

    // Criar nova seção se não existir
    const newSection = document.createElement('div');
    newSection.className = 'help-section';
    newSection.innerHTML = `
      <h3>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"/>
        </svg>
        ${title}
      </h3>
    `;

    helpContent.appendChild(newSection);
    return newSection;
  }

  /**
   * Limpa todos os shortcuts de uma seção
   * @param {string} sectionTitle - Título da seção a limpar
   */
  clearSection(sectionTitle) {
    const section = this.findOrCreateSection(sectionTitle);
    if (!section) return;

    const helpItems = section.querySelectorAll('.help-item');
    helpItems.forEach(item => item.remove());
    
    console.log(`📚 Seção "${sectionTitle}" limpa`);
  }

  /**
   * Atualiza o conteúdo de um shortcut existente
   * @param {string} shortcut - Tecla/combinação do shortcut
   * @param {string} newDescription - Nova descrição
   */
  updateShortcut(shortcut, newDescription) {
    if (!this.helpPanel) return;

    const helpItems = this.helpPanel.querySelectorAll('.help-item');
    helpItems.forEach(item => {
      const shortcutElement = item.querySelector('.shortcut');
      const descriptionElement = item.querySelector('.description');
      
      if (shortcutElement && shortcutElement.textContent.trim() === shortcut) {
        if (descriptionElement) {
          descriptionElement.textContent = newDescription;
          console.log(`📚 Shortcut atualizado: ${shortcut} - ${newDescription}`);
        }
      }
    });
  }

  // =====================================================================
  // MÉTODOS DE ANÁLISE E DEBUG
  // =====================================================================

  /**
   * Retorna estatísticas do sistema de ajuda
   * @returns {object}
   */
  getStats() {
    if (!this.helpPanel) return { error: 'Panel not available' };

    const sections = this.helpPanel.querySelectorAll('.help-section');
    const totalItems = this.helpPanel.querySelectorAll('.help-item');
    
    const sectionStats = Array.from(sections).map(section => {
      const title = section.querySelector('h3')?.textContent?.trim() || 'Unknown';
      const items = section.querySelectorAll('.help-item').length;
      return { title, items };
    });

    return {
      isOpen: this.isOpen,
      totalSections: sections.length,
      totalItems: totalItems.length,
      sections: sectionStats,
      hasEventListeners: !!(this.helpButton && this.helpClose)
    };
  }

  /**
   * Lista todos os shortcuts disponíveis
   * @returns {Array}
   */
  getAllShortcuts() {
    if (!this.helpPanel) return [];

    const shortcuts = [];
    const helpItems = this.helpPanel.querySelectorAll('.help-item');
    
    helpItems.forEach(item => {
      const shortcut = item.querySelector('.shortcut')?.textContent?.trim();
      const description = item.querySelector('.description')?.textContent?.trim();
      const section = item.closest('.help-section')?.querySelector('h3')?.textContent?.trim();
      
      if (shortcut && description) {
        shortcuts.push({ shortcut, description, section });
      }
    });

    return shortcuts;
  }

  /**
   * Método de cleanup para remover o sistema
   */
  destroy() {
    this.removeEventListeners();
    this.close();
    
    // Limpar referências
    this.helpButton = null;
    this.helpPanel = null;
    this.helpClose = null;
    
    console.log('📚 HelpSystem destruído');
  }
}