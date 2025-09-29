// =====================================================================
// TUTORIAL: ARRASTAR OBJETOS NO MODO CAMINHAR
// =====================================================================
// Tutorial interativo para ensinar como selecionar e mover objetos
// no modo caminhar usando o mouse
//
// DEPENDÊNCIAS:
// - TutorialSystem
// - RoomModeSystem
// - WalkBuildModeSystem
//
// =====================================================================

export const dragObjectsTutorial = {
  id: 'drag-objects',
  title: 'Arrastar Objetos no Modo Caminhar',
  description: 'Aprenda a selecionar e mover objetos usando o mouse no modo caminhar',
  category: 'room-mode',
  difficulty: 'beginner',
  estimatedTime: '2-3 minutos',
  
  steps: [
    {
      title: 'Bem-vindo ao Tutorial de Arrastar Objetos!',
      description: 'Neste tutorial, você aprenderá como selecionar e mover objetos da sala usando o mouse no modo caminhar. É uma funcionalidade muito útil para organizar sua sala virtual.',
      highlight: null,
      action: () => {
        console.log('🎓 Iniciando tutorial de arrastar objetos');
      }
    },

    {
      title: 'Primeiro, vamos para o Modo Sala',
      description: 'Para usar esta funcionalidade, precisamos estar no Room Mode (Modo Sala). Clique no botão "Room Mode" se ainda não estiver ativo.',
      highlight: {
        selector: '#roomModeBtn',
        options: { color: '#fbbf24' }
      },
      validate: () => {
        // Verificar se está no room mode
        const isValid = window.roomModeSystem && window.roomModeSystem.isRoomMode;
        console.log('🔍 Validação Room Mode:', {
          roomModeSystem: !!window.roomModeSystem,
          isRoomMode: window.roomModeSystem?.isRoomMode,
          isValid
        });
        return isValid;
      },
      hint: 'Clique no botão "Room Mode" para ativar o modo sala.'
    },

    {
      title: 'Certifique-se de ter objetos na sala',
      description: 'Para este tutorial, você precisa ter pelo menos um objeto carregado na sala. Se não tiver nenhum, carregue um arquivo usando o botão de upload no painel da sala.',
      highlight: {
        selector: '#roomVoxelFileInput',
        options: { color: '#ffa500' }
      },
      validate: () => {
        // Verificar se há objetos na sala
        return window.roomModeSystem && 
               window.roomModeSystem.roomObjects && 
               window.roomModeSystem.roomObjects.length > 0;
      },
      hint: 'Carregue um arquivo .json ou .html para ter objetos na sala.',
      action: () => {
        // Mostrar painel da sala se não estiver visível
        const roomPanel = document.getElementById('roomPanel');
        if (roomPanel && roomPanel.style.display !== 'flex') {
          roomPanel.style.display = 'flex';
        }
      }
    },

    {
      title: 'Ative o Modo Caminhar',
      description: 'Agora precisamos ativar o modo caminhar para poder interagir com os objetos. Clique no botão "Modo Caminhada" no painel da sala.',
      highlight: {
        selector: '#walkModeBtn',
        options: { color: '#fbbf24' }
      },
      validate: () => {
        // Verificar se o modo caminhar está ativo
        const isValid = window.roomModeSystem && 
               window.roomModeSystem.walkBuildModeSystem && 
               window.roomModeSystem.walkBuildModeSystem.isActive;
        
        console.log('🔍 Validação Walk Mode:', {
          roomModeSystem: !!window.roomModeSystem,
          walkBuildModeSystem: !!window.roomModeSystem?.walkBuildModeSystem,
          isActive: window.roomModeSystem?.walkBuildModeSystem?.isActive,
          isValid
        });
        
        return isValid;
      },
      hint: 'Clique no botão "Modo Caminhada" para ativar os controles de primeira pessoa.'
    },

    {
      title: 'Selecione um objeto clicando nele',
      description: 'Agora você está no modo caminhar! Use as teclas WASD para se mover e o mouse para olhar ao redor. Clique com o botão esquerdo em qualquer objeto da sala para selecioná-lo. Você verá um contorno verde ao redor do objeto selecionado.',
      highlight: null,
      validate: () => {
        // Verificar se há um objeto selecionado
        const isValid = window.roomModeSystem && 
               window.roomModeSystem.walkBuildModeSystem && 
               window.roomModeSystem.walkBuildModeSystem.selectedObject;
        
        console.log('🔍 Validação Objeto Selecionado:', {
          roomModeSystem: !!window.roomModeSystem,
          walkBuildModeSystem: !!window.roomModeSystem?.walkBuildModeSystem,
          selectedObject: !!window.roomModeSystem?.walkBuildModeSystem?.selectedObject,
          isValid
        });
        
        return isValid;
      },
      hint: 'Mova-se com WASD e clique em um objeto para selecioná-lo. Você verá um contorno verde.',
      action: () => {
        // Adicionar dica visual no console
        console.log('💡 Use WASD para se mover e mouse para olhar. Clique em um objeto!');
      }
    },

    {
      title: 'Ative o modo de arrastar com a tecla G',
      description: 'Perfeito! Agora que você selecionou um objeto (vê o contorno verde?), pressione a tecla G para ativar o modo de arrastar. Isso permitirá que você mova o objeto com o mouse.',
      highlight: null,
      validate: () => {
        // Verificar se o modo de arrastar está ativo
        const walkSystem = window.roomModeSystem?.walkBuildModeSystem;
        const isDragging = walkSystem?.isDraggingObject || walkSystem?.isDragging || walkSystem?.dragMode;
        
        // Verificar múltiplas propriedades possíveis
        const isValid = window.roomModeSystem && walkSystem && isDragging;
        
        console.log('🔍 Validação Modo Arrastar:', {
          roomModeSystem: !!window.roomModeSystem,
          walkBuildModeSystem: !!walkSystem,
          isDraggingObject: walkSystem?.isDraggingObject,
          isDragging: walkSystem?.isDragging,
          dragMode: walkSystem?.dragMode,
          isValid
        });
        
        return isValid;
      },
      hint: 'Pressione a tecla G para ativar o modo de arrastar o objeto selecionado.',
      action: () => {
        // Mostrar instrução no console
        console.log('🎮 Pressione G para ativar o modo de arrastar!');
        
        // Adicionar listener temporário para a tecla G
        const handleKeyPress = (event) => {
          if (event.code === 'KeyG') {
            console.log('✅ Tecla G pressionada! Verificando modo de arrastar...');
            
            // Aguardar um pouco para o sistema processar
            setTimeout(() => {
              const walkSystem = window.roomModeSystem?.walkBuildModeSystem;
              const isDragging = walkSystem?.isDraggingObject || walkSystem?.isDragging || walkSystem?.dragMode;
              console.log('🔍 Estado após pressionar G:', {
                isDraggingObject: walkSystem?.isDraggingObject,
                isDragging: walkSystem?.isDragging,
                dragMode: walkSystem?.dragMode,
                finalState: isDragging
              });
              
              // Se o tutorial system estiver ativo, forçar uma verificação
              if (window.tutorialSystem && window.tutorialSystem.isTutorialActive()) {
                console.log('🔄 Forçando verificação do tutorial...');
              }
            }, 100);
            
            document.removeEventListener('keydown', handleKeyPress);
          }
        };
        document.addEventListener('keydown', handleKeyPress);
      }
    },

    {
      title: 'Mova o objeto com o mouse',
      description: 'Excelente! O modo de arrastar está ativo. Agora mova o mouse para arrastar o objeto. O movimento horizontal do mouse move o objeto para os lados, e o movimento vertical move o objeto para frente e para trás, baseado na direção que você está olhando.',
      highlight: null,
      validate: () => {
        // Esta validação é mais complexa - vamos apenas aguardar alguns segundos
        return new Promise((resolve) => {
          let moved = false;
          const checkMovement = () => {
            if (window.roomModeSystem && 
                window.roomModeSystem.walkBuildModeSystem && 
                window.roomModeSystem.walkBuildModeSystem.selectedObject) {
              
              const obj = window.roomModeSystem.walkBuildModeSystem.selectedObject;
              const initialPos = obj.meshGroup.position.clone();
              
              setTimeout(() => {
                const currentPos = obj.meshGroup.position;
                const distance = initialPos.distanceTo(currentPos);
                if (distance > 0.1) { // Se moveu pelo menos 0.1 unidades
                  moved = true;
                  resolve(true);
                }
              }, 2000);
            }
          };
          
          checkMovement();
          
          // Timeout de segurança
          setTimeout(() => {
            if (!moved) resolve(true); // Permitir continuar mesmo sem movimento
          }, 10000);
        });
      },
      hint: 'Mova o mouse para arrastar o objeto. Movimento horizontal = lados, movimento vertical = frente/trás.',
      action: () => {
        console.log('🖱️ Mova o mouse para arrastar o objeto! Experimente diferentes direções.');
      }
    },

    {
      title: 'Desative o modo de arrastar',
      description: 'Ótimo trabalho! Você moveu o objeto com sucesso. Agora pressione G novamente para desativar o modo de arrastar. Isso permitirá que você volte a controlar a câmera normalmente.',
      highlight: null,
      validate: () => {
        // Verificar se o modo de arrastar foi desativado
        const isValid = window.roomModeSystem && 
               window.roomModeSystem.walkBuildModeSystem && 
               !window.roomModeSystem.walkBuildModeSystem.isDraggingObject;
        
        console.log('🔍 Validação Desativar Arrastar:', {
          roomModeSystem: !!window.roomModeSystem,
          walkBuildModeSystem: !!window.roomModeSystem?.walkBuildModeSystem,
          isDraggingObject: window.roomModeSystem?.walkBuildModeSystem?.isDraggingObject,
          isValid
        });
        
        return isValid;
      },
      hint: 'Pressione G novamente para desativar o modo de arrastar.',
      action: () => {
        console.log('🎮 Pressione G novamente para voltar ao controle normal da câmera.');
      }
    },

    {
      title: 'Parabéns! Você dominou o arrastar objetos!',
      description: 'Você completou o tutorial com sucesso! Agora você sabe como:\n\n• Selecionar objetos clicando neles\n• Ativar o modo de arrastar com G\n• Mover objetos com o mouse\n• Desativar o modo de arrastar\n\nEsta funcionalidade é perfeita para organizar sua sala virtual de forma intuitiva!',
      highlight: null,
      action: () => {
        console.log('🎉 Tutorial de arrastar objetos completado com sucesso!');
        
        // Desselecionar objeto se ainda estiver selecionado
        if (window.roomModeSystem && 
            window.roomModeSystem.walkBuildSystem && 
            window.roomModeSystem.walkBuildSystem.selectedObject) {
          window.roomModeSystem.walkBuildSystem.deselectRoomObject();
        }
      }
    }
  ],

  // Configurações específicas do tutorial
  settings: {
    allowSkip: true,
    showProgress: true,
    autoStart: false,
    resetOnStart: false
  },

  // Pré-requisitos para iniciar o tutorial
  prerequisites: {
    check: () => {
      // Verificar se os sistemas necessários estão disponíveis
      return window.roomModeSystem && 
             window.roomModeSystem.walkBuildModeSystem;
    },
    message: 'Este tutorial requer que o sistema de Room Mode esteja carregado.'
  },

  // Limpeza após o tutorial
  cleanup: () => {
    console.log('🧹 Limpando tutorial de arrastar objetos...');
    
    // Garantir que não há objetos selecionados
    if (window.roomModeSystem && 
        window.roomModeSystem.walkBuildModeSystem && 
        window.roomModeSystem.walkBuildModeSystem.selectedObject) {
      window.roomModeSystem.walkBuildModeSystem.deselectRoomObject();
    }
    
    // Sair do modo caminhar se estiver ativo
    if (window.roomModeSystem && 
        window.roomModeSystem.walkBuildModeSystem && 
        window.roomModeSystem.walkBuildModeSystem.isActive) {
      // Opcional: sair do modo caminhar
      // window.roomModeSystem.walkBuildModeSystem.exitWalkMode();
    }
  }
};
