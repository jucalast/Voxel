// =====================================================================
// MÓDULO TUTORIAL SYSTEM
// =====================================================================
// Sistema modular de tutoriais interativos para o editor de voxels
//
// FUNCIONALIDADES:
// - Sistema modular para diferentes tutoriais
// - Highlights visuais em elementos da interface
// - Controles de navegação (próximo, anterior, pular)
// - Detecção automática de ações do usuário
// - Persistência de progresso
//
// DEPENDÊNCIAS:
// - Sistema de overlay para highlights
// - LocalStorage para persistência
//
// USO:
// 1. Importar: import { TutorialSystem } from './modules/tutorialSystem.js'
// 2. Criar instância: const tutorial = new TutorialSystem()
// 3. Registrar tutorial: tutorial.registerTutorial('drag-objects', dragObjectsTutorial)
// 4. Iniciar: tutorial.startTutorial('drag-objects')
//
// =====================================================================

export class TutorialSystem {
  constructor() {
    this.tutorials = new Map();
    this.currentTutorial = null;
    this.currentStep = 0;
    this.isActive = false;
    
    // Elementos DOM
    this.overlay = null;
    this.tutorialPanel = null;
    this.highlightBox = null;
    
    // Configurações
    this.settings = {
      showOnFirstTime: true,
      persistProgress: true,
      animationDuration: 300,
      highlightColor: '#fbbf24',
      overlayOpacity: 0.8
    };

    this.init();
  }

  init() {
    this.createOverlay();
    this.createTutorialPanel();
    this.loadProgress();
    
    // Sistema de Tutorial inicializado
  }

  // =====================================================================
  // CRIAÇÃO DE ELEMENTOS DOM
  // =====================================================================

  createOverlay() {
    this.overlay = document.createElement('div');
    this.overlay.id = 'tutorial-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: transparent;
      z-index: 9999;
      display: none;
      pointer-events: none;
    `;
    document.body.appendChild(this.overlay);
  }

  createTutorialPanel() {
    this.tutorialPanel = document.createElement('div');
    this.tutorialPanel.id = 'tutorial-panel';

    this.tutorialPanel.innerHTML = `
      <div class="tutorial-header">
        <h2 id="tutorial-title">
          🎓 Tutorial
        </h2>
        <div id="tutorial-progress">
          <div id="tutorial-progress-bar"></div>
        </div>
      </div>
      
      <div class="tutorial-content">
        <div id="tutorial-step-indicator">
          Passo 1 de 5
        </div>
        <h3 id="tutorial-step-title">
          Título do Passo
        </h3>
        <p id="tutorial-step-description">
          Descrição do passo atual...
        </p>
        <div id="tutorial-step-hint">
          💡 <strong>Dica:</strong> <span id="tutorial-hint-text"></span>
        </div>
      </div>
      
      <div class="tutorial-controls">
        <button id="tutorial-skip">
          Pular Tutorial
        </button>
        <div>
          <button id="tutorial-prev" disabled>
            ← Anterior
          </button>
          <button id="tutorial-next">
            Próximo →
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(this.tutorialPanel);
    this.setupPanelEvents();
  }

  setupPanelEvents() {
    const skipBtn = this.tutorialPanel.querySelector('#tutorial-skip');
    const prevBtn = this.tutorialPanel.querySelector('#tutorial-prev');
    const nextBtn = this.tutorialPanel.querySelector('#tutorial-next');

    skipBtn.addEventListener('click', () => this.skipTutorial());
    prevBtn.addEventListener('click', () => this.previousStep());
    nextBtn.addEventListener('click', () => this.nextStep());
  }

  // =====================================================================
  // FEEDBACK VISUAL
  // =====================================================================

  showStepCompletedFeedback() {
    // Criar notificação de sucesso
    const notification = document.createElement('div');
    notification.className = 'tutorial-success-notification';
    notification.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20,6 9,17 4,12"></polyline>
      </svg>
      Passo completado!
    `;

    document.body.appendChild(notification);

    // Remover após 2 segundos
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 2000);

    console.log('✅ Feedback de passo completado mostrado');
  }

  // =====================================================================
  // SISTEMA DE HIGHLIGHTS
  // =====================================================================

  highlightElement(selector, options = {}) {
    this.removeHighlight();

    const element = document.querySelector(selector);
    if (!element) {
      console.warn(`Elemento não encontrado para highlight: ${selector}`);
      return;
    }

    const rect = element.getBoundingClientRect();
    
    this.highlightBox = document.createElement('div');
    this.highlightBox.className = 'tutorial-highlight-box';
    
    // Posicionar o highlight box
    this.highlightBox.style.top = `${rect.top - 4}px`;
    this.highlightBox.style.left = `${rect.left - 4}px`;
    this.highlightBox.style.width = `${rect.width + 8}px`;
    this.highlightBox.style.height = `${rect.height + 8}px`;

    // Aplicar cor customizada se fornecida
    if (options.color && options.color !== this.settings.highlightColor) {
      this.highlightBox.style.borderColor = options.color;
      this.highlightBox.style.boxShadow = `0 0 20px ${options.color}40, inset 0 0 20px ${options.color}10`;
    }

    document.body.appendChild(this.highlightBox);

    // Posicionar painel próximo ao elemento destacado
    if (options.positionPanel !== false) {
      this.positionPanelNearElement(rect);
    }
  }

  removeHighlight() {
    if (this.highlightBox) {
      this.highlightBox.remove();
      this.highlightBox = null;
    }
  }

  positionPanelNearElement(rect) {
    const panel = this.tutorialPanel;
    const panelRect = panel.getBoundingClientRect();
    
    let top, left;

    // Tentar posicionar à direita do elemento
    if (rect.right + panelRect.width + 20 < window.innerWidth) {
      left = rect.right + 20;
      top = rect.top;
    }
    // Senão, posicionar à esquerda
    else if (rect.left - panelRect.width - 20 > 0) {
      left = rect.left - panelRect.width - 20;
      top = rect.top;
    }
    // Senão, posicionar abaixo
    else if (rect.bottom + panelRect.height + 20 < window.innerHeight) {
      left = Math.max(20, rect.left - panelRect.width / 2 + rect.width / 2);
      top = rect.bottom + 20;
    }
    // Senão, posicionar acima
    else {
      left = Math.max(20, rect.left - panelRect.width / 2 + rect.width / 2);
      top = rect.top - panelRect.height - 20;
    }

    // Garantir que não saia da tela
    left = Math.max(20, Math.min(left, window.innerWidth - panelRect.width - 20));
    top = Math.max(20, Math.min(top, window.innerHeight - panelRect.height - 20));

    panel.style.top = `${top}px`;
    panel.style.left = `${left}px`;
    panel.style.transform = 'none';
  }

  // =====================================================================
  // GERENCIAMENTO DE TUTORIAIS
  // =====================================================================

  registerTutorial(id, tutorialData) {
    this.tutorials.set(id, tutorialData);
    // Tutorial registrado
  }

  startTutorial(id) {
    const tutorial = this.tutorials.get(id);
    if (!tutorial) {
      console.error(`Tutorial não encontrado: ${id}`);
      return;
    }

    // Verificar pré-requisitos
    if (tutorial.prerequisites && !tutorial.prerequisites.check()) {
      alert(tutorial.prerequisites.message || 'Pré-requisitos não atendidos');
      return;
    }

    this.currentTutorial = tutorial;
    this.isActive = true;

    // Detectar progresso atual e começar do passo apropriado
    this.currentStep = this.detectCurrentProgress(tutorial);
    
    console.log(`🎓 Iniciando tutorial: ${tutorial.title} no passo ${this.currentStep + 1}`);

    // Executar limpeza se existir
    if (tutorial.cleanup) {
      tutorial.cleanup();
    }

    // Garantir que todos os elementos DOM existam
    if (!this.overlay) this.createOverlay();
    if (!this.tutorialPanel) this.createTutorialPanel();
    
    this.showOverlay();
    this.showPanel();
    this.updateStep();
  }

  nextStep() {
    if (!this.currentTutorial) return;

    // Verificar se o passo atual tem validação
    const currentStepData = this.currentTutorial.steps[this.currentStep];
    
    // Executar validação se existir
    if (currentStepData.validate) {
      const isValid = currentStepData.validate();
      console.log(`🔍 Validação do passo ${this.currentStep + 1}:`, isValid);
      
      if (!isValid) {
        this.showHint(currentStepData.hint || 'Complete a ação antes de continuar.');
        return;
      }
    }

    this.currentStep++;
    
    if (this.currentStep >= this.currentTutorial.steps.length) {
      this.completeTutorial();
    } else {
      this.updateStep();
    }
  }

  previousStep() {
    if (!this.currentTutorial || this.currentStep <= 0) return;
    
    this.currentStep--;
    this.updateStep();
  }

  detectCurrentProgress(tutorial) {
    console.log('🔍 Detectando progresso atual do tutorial...');
    
    // Para o tutorial de arrastar objetos, usar lógica específica
    if (tutorial.id === 'drag-objects') {
      return this.detectDragObjectsProgress(tutorial);
    }
    
    // Lógica genérica para outros tutoriais
    for (let i = tutorial.steps.length - 1; i >= 0; i--) {
      const step = tutorial.steps[i];
      
      if (step.validate) {
        const isValid = step.validate();
        console.log(`  Passo ${i + 1}: ${step.title} - ${isValid ? '✅ Completo' : '❌ Incompleto'}`);
        
        if (isValid) {
          const nextStep = i + 1;
          console.log(`🎯 Progresso detectado: começando do passo ${nextStep + 1}`);
          return nextStep < tutorial.steps.length ? nextStep : tutorial.steps.length - 1;
        }
      } else {
        console.log(`  Passo ${i + 1}: ${step.title} - ⚪ Sem validação`);
      }
    }
    
    console.log('🎯 Nenhum progresso detectado: começando do passo 1');
    return 0;
  }

  detectDragObjectsProgress(tutorial) {
    console.log('🎯 Detectando progresso específico do tutorial de arrastar objetos...');
    
    // Verificar estados específicos do tutorial de arrastar
    const roomModeActive = window.roomModeSystem && window.roomModeSystem.isRoomMode;
    const hasRoomObjects = window.roomModeSystem && window.roomModeSystem.roomObjects && window.roomModeSystem.roomObjects.length > 0;
    const walkModeActive = window.roomModeSystem && window.roomModeSystem.walkBuildModeSystem && window.roomModeSystem.walkBuildModeSystem.isActive;
    const hasSelectedObject = window.roomModeSystem && window.roomModeSystem.walkBuildModeSystem && window.roomModeSystem.walkBuildModeSystem.selectedObject;
    const isDragging = window.roomModeSystem && window.roomModeSystem.walkBuildModeSystem && window.roomModeSystem.walkBuildModeSystem.isDraggingObject;
    
    console.log('📊 Estado atual:', {
      roomModeActive,
      hasRoomObjects,
      walkModeActive,
      hasSelectedObject,
      isDragging
    });
    
    // Lógica de detecção baseada no estado atual
    if (isDragging) {
      console.log('🎯 Usuário já está arrastando → Passo 7 (Mover objeto)');
      return 6; // Passo 7 (índice 6)
    }
    
    if (hasSelectedObject) {
      console.log('🎯 Usuário tem objeto selecionado → Passo 6 (Ativar arrastar)');
      return 5; // Passo 6 (índice 5)
    }
    
    if (walkModeActive) {
      console.log('🎯 Usuário está no walk mode → Passo 5 (Selecionar objeto)');
      return 4; // Passo 5 (índice 4)
    }
    
    if (roomModeActive && hasRoomObjects) {
      console.log('🎯 Usuário tem room mode + objetos → Passo 4 (Ativar walk mode)');
      return 3; // Passo 4 (índice 3)
    }
    
    if (hasRoomObjects) {
      console.log('🎯 Usuário tem objetos mas não room mode → Passo 2 (Ativar room mode)');
      return 1; // Passo 2 (índice 1)
    }
    
    if (roomModeActive) {
      console.log('🎯 Usuário tem room mode mas sem objetos → Passo 3 (Carregar objetos)');
      return 2; // Passo 3 (índice 2)
    }
    
    console.log('🎯 Usuário iniciante → Começar do passo 1');
    return 0; // Passo 1 (índice 0)
  }

  updateStep() {
    if (!this.currentTutorial) return;

    // Verificar se o painel existe, se não, criar
    if (!this.tutorialPanel || !document.body.contains(this.tutorialPanel)) {
      console.log('⚠️ Painel de tutorial não encontrado, recriando...');
      this.createTutorialPanel();
      this.showPanel();
    }

    const tutorial = this.currentTutorial;
    const step = tutorial.steps[this.currentStep];
    
    // Atualizar conteúdo do painel com verificações de segurança
    const titleElement = document.getElementById('tutorial-title');
    const indicatorElement = document.getElementById('tutorial-step-indicator');
    const stepTitleElement = document.getElementById('tutorial-step-title');
    const stepDescElement = document.getElementById('tutorial-step-description');
    
    if (titleElement) {
      titleElement.textContent = tutorial.title;
    } else {
      console.warn('⚠️ Elemento tutorial-title não encontrado');
    }
    
    if (indicatorElement) {
      indicatorElement.textContent = `Passo ${this.currentStep + 1} de ${tutorial.steps.length}`;
    } else {
      console.warn('⚠️ Elemento tutorial-step-indicator não encontrado');
    }
    
    if (stepTitleElement) {
      stepTitleElement.textContent = step.title;
    } else {
      console.warn('⚠️ Elemento tutorial-step-title não encontrado');
    }
    
    if (stepDescElement) {
      stepDescElement.textContent = step.description;
    } else {
      console.warn('⚠️ Elemento tutorial-step-description não encontrado');
    }

    // Atualizar botões de navegação com verificações de segurança
    const prevBtn = document.getElementById('tutorial-prev-btn');
    const nextBtn = document.getElementById('tutorial-next-btn');
    
    if (prevBtn) {
      prevBtn.disabled = this.currentStep === 0;
    }
    
    if (nextBtn) {
      // Verificar se é o último passo
      if (this.currentStep >= tutorial.steps.length - 1) {
        nextBtn.textContent = 'Finalizar ✓';
        nextBtn.style.background = '#22c55e';
      } else {
        nextBtn.textContent = 'Próximo →';
        nextBtn.style.background = '#00ff00';
      }
    }

    // Executar ação do passo se existir
    if (step.action) {
      step.action();
    }

    // Esconder hint se estava sendo mostrado
    this.hideHint();

    // Aplicar highlight se especificado
    if (step.highlight) {
      this.highlightElement(step.highlight.selector, step.highlight.options);
    } else {
      this.removeHighlight();
      // Centralizar painel se não há highlight
      this.tutorialPanel.style.top = '50%';
      this.tutorialPanel.style.left = '50%';
      this.tutorialPanel.style.transform = 'translate(-50%, -50%)';
    }

    // Iniciar monitoramento automático se o passo tem validação
    this.startAutoProgressMonitoring();

    this.saveProgress();
  }

  showHint(text) {
    const hintElement = document.getElementById('tutorial-step-hint');
    const hintText = document.getElementById('tutorial-hint-text');
    
    if (hintText) hintText.textContent = text;
    if (hintElement) {
      hintElement.style.display = 'block';
      hintElement.style.animation = 'tutorialFadeIn 0.3s ease';
    }
  }

  hideHint() {
    const hintElement = document.getElementById('tutorial-step-hint');
    if (hintElement) {
      hintElement.style.display = 'none';
    }
  }

  startAutoProgressMonitoring() {
    // Parar monitoramento anterior se existir
    this.stopAutoProgressMonitoring();
    
    if (!this.currentTutorial) return;
    
    const step = this.currentTutorial.steps[this.currentStep];
    
    // Só monitorar se o passo tem validação
    if (!step.validate) return;
    
    console.log(`🔄 Iniciando monitoramento automático do passo ${this.currentStep + 1}`);
    
    // Verificar imediatamente se já está válido
    if (step.validate()) {
      console.log(`⚡ Passo ${this.currentStep + 1} já está completo, avançando...`);
      setTimeout(() => this.autoAdvanceStep(), 1000); // Delay de 1s para o usuário ver
      return;
    }
    
    // Monitorar mudanças a cada 300ms para ser mais responsivo
    this.autoProgressInterval = setInterval(() => {
      if (!this.currentTutorial || !this.isActive) {
        this.stopAutoProgressMonitoring();
        return;
      }
      
      const currentStep = this.currentTutorial.steps[this.currentStep];
      if (currentStep && currentStep.validate && currentStep.validate()) {
        console.log(`✅ Passo ${this.currentStep + 1} completado automaticamente!`);
        this.stopAutoProgressMonitoring();
        
        // Mostrar feedback visual de sucesso
        this.showStepCompletedFeedback();
        
        // Avançar após um breve delay
        setTimeout(() => this.autoAdvanceStep(), 1200);
      }
    }, 300);

    // Adicionar listener global para teclas que podem afetar o tutorial
    this.addGlobalKeyListener();
  }

  stopAutoProgressMonitoring() {
    if (this.autoProgressInterval) {
      clearInterval(this.autoProgressInterval);
      this.autoProgressInterval = null;
      console.log('🛑 Monitoramento automático parado');
    }
    
    // Remover listener de teclas
    this.removeGlobalKeyListener();
  }

  addGlobalKeyListener() {
    // Remover listener anterior se existir
    this.removeGlobalKeyListener();
    
    this.globalKeyHandler = (event) => {
      if (!this.isActive || !this.currentTutorial) return;
      
      // Teclas que podem afetar o tutorial
      const relevantKeys = ['KeyG', 'KeyW', 'KeyA', 'KeyS', 'KeyD'];
      
      if (relevantKeys.includes(event.code)) {
        console.log(`⌨️ Tecla relevante pressionada: ${event.code}`);
        
        // Aguardar um pouco e verificar novamente
        setTimeout(() => {
          const currentStep = this.currentTutorial.steps[this.currentStep];
          if (currentStep && currentStep.validate && currentStep.validate()) {
            console.log(`🚀 Validação passou após tecla ${event.code}!`);
            this.stopAutoProgressMonitoring();
            this.showStepCompletedFeedback();
            setTimeout(() => this.autoAdvanceStep(), 800);
          }
        }, 150);
      }
    };
    
    document.addEventListener('keydown', this.globalKeyHandler);
  }

  removeGlobalKeyListener() {
    if (this.globalKeyHandler) {
      document.removeEventListener('keydown', this.globalKeyHandler);
      this.globalKeyHandler = null;
    }
  }

  autoAdvanceStep() {
    if (!this.currentTutorial) return;
    
    this.currentStep++;
    
    if (this.currentStep >= this.currentTutorial.steps.length) {
      this.completeTutorial();
    } else {
      console.log(`🎯 Avançando automaticamente para o passo ${this.currentStep + 1}`);
      this.updateStep();
    }
  }

  showStepCompletedFeedback() {
    // Criar feedback visual temporário
    const feedback = document.createElement('div');
    feedback.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #22c55e, #16a34a);
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-weight: 600;
      z-index: 10001;
      box-shadow: 0 4px 12px rgba(34, 197, 94, 0.4);
      animation: slideInRight 0.3s ease;
    `;
    feedback.textContent = '✅ Passo completado!';
    
    // Adicionar animação CSS se não existir
    if (!document.querySelector('#tutorial-feedback-styles')) {
      const style = document.createElement('style');
      style.id = 'tutorial-feedback-styles';
      style.textContent = `
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOutRight {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(feedback);
    
    // Remover após 2 segundos
    setTimeout(() => {
      feedback.style.animation = 'slideOutRight 0.3s ease';
      setTimeout(() => feedback.remove(), 300);
    }, 2000);
  }


  completeTutorial() {
    if (!this.currentTutorial) return;

    console.log(`✅ Tutorial completado: ${this.currentTutorial.title}`);
    
    // Marcar como completado
    this.markCompleted(this.currentTutorial.id);
    
    // Mostrar mensagem de conclusão
    this.showCompletionMessage();
    
    setTimeout(() => {
      this.closeTutorial();
    }, 3000);
  }

  showCompletionMessage() {
    const panel = this.tutorialPanel;
    panel.innerHTML = `
      <div class="tutorial-completion-modal">
        <div class="tutorial-completion-icon">🎉</div>
        <h2 class="tutorial-completion-title">Parabéns!</h2>
        <p class="tutorial-completion-message">
          Você completou o tutorial: <strong>${this.currentTutorial.title}</strong>
        </p>
        <div class="tutorial-completion-success">
          <p>✓ Agora você sabe como usar esta funcionalidade!</p>
        </div>
        <p class="tutorial-completion-footer">
          Esta janela se fechará automaticamente em alguns segundos...
        </p>
      </div>
    `;

    // Parar monitoramento automático
    this.stopAutoProgressMonitoring();

    // Fechar automaticamente após 3 segundos
    setTimeout(() => {
      this.stopTutorial();
    }, 3000);
  }

  stopTutorial() {
    if (!this.isActive) return;

    this.isActive = false;
    this.currentTutorial = null;
    this.currentStep = 0;

    // Parar monitoramento automático
    this.stopAutoProgressMonitoring();

    this.hideOverlay();
    this.hidePanel();
    this.removeHighlight();

    console.log('🎓 Tutorial interrompido');
  }

  // =====================================================================
  // CONTROLE DE VISIBILIDADE
  // =====================================================================
  showOverlay() {
    this.overlay.style.display = 'block';
    this.overlay.style.animation = 'tutorialFadeIn 0.3s ease';
  }

  hideOverlay() {
    this.overlay.style.display = 'none';
  }

  showPanel() {
    this.tutorialPanel.style.display = 'block';
    this.tutorialPanel.style.animation = 'tutorialFadeIn 0.3s ease';
  }

  hidePanel() {
    this.tutorialPanel.style.display = 'none';
  }

  // =====================================================================
  // PERSISTÊNCIA DE PROGRESSO
  // =====================================================================

  saveProgress() {
    if (!this.settings.persistProgress) return;
    
    const progress = {
      currentTutorial: this.currentTutorial?.id,
      currentStep: this.currentStep,
      completedTutorials: this.getCompletedTutorials()
    };
    
    localStorage.setItem('voxel-editor-tutorial-progress', JSON.stringify(progress));
  }

  loadProgress() {
    if (!this.settings.persistProgress) return;
    
    try {
      const saved = localStorage.getItem('voxel-editor-tutorial-progress');
      if (saved) {
        const progress = JSON.parse(saved);
        this.completedTutorials = new Set(progress.completedTutorials || []);
      }
    } catch (error) {
      console.warn('Erro ao carregar progresso do tutorial:', error);
    }
  }

  markCompleted(tutorialId) {
    if (!this.completedTutorials) {
      this.completedTutorials = new Set();
    }
    this.completedTutorials.add(tutorialId);
    this.saveProgress();
  }

  isCompleted(tutorialId) {
    return this.completedTutorials && this.completedTutorials.has(tutorialId);
  }

  getCompletedTutorials() {
    return this.completedTutorials ? Array.from(this.completedTutorials) : [];
  }

  // =====================================================================
  // MÉTODOS UTILITÁRIOS
  // =====================================================================

  waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (element) {
          observer.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Elemento não encontrado: ${selector}`));
      }, timeout);
    });
  }

  waitForCondition(condition, timeout = 5000) {
    return new Promise((resolve, reject) => {
      if (condition()) {
        resolve();
        return;
      }

      const interval = setInterval(() => {
        if (condition()) {
          clearInterval(interval);
          resolve();
        }
      }, 100);

      setTimeout(() => {
        clearInterval(interval);
        reject(new Error('Condição não foi atendida no tempo limite'));
      }, timeout);
    });
  }

  // Método público para verificar se tutorial está ativo
  isTutorialActive() {
    return this.isActive;
  }

  // Método para obter lista de tutoriais disponíveis
  getAvailableTutorials() {
    return Array.from(this.tutorials.keys());
  }
}
