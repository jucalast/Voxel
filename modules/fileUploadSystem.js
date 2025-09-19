export class FileUploadSystem {
    constructor() {
        this.fileInput = document.createElement('input');
        this.fileInput.type = 'file';
        this.fileInput.style.display = 'none'; // Keep it hidden
        document.body.appendChild(this.fileInput); // Append to body once

        this.callbacks = {
            onVoxelDataLoaded: () => {},
            onRoomObjectLoaded: () => {},
            onReferenceImageLoaded: () => {},
            onError: (message) => console.error(message)
        };

        this.fileInput.addEventListener('change', this.handleFileChange.bind(this));

        

        
    }

    setCallbacks(newCallbacks) {
        this.callbacks = { ...this.callbacks, ...newCallbacks };
    }

    setupEventListeners() {
        if (this.attachmentsBtn) {
            this.attachmentsBtn.addEventListener('click', () => this.toggleAttachmentsSidebar());
        }
        if (this.attachmentsSidebarCloseBtn) {
            this.attachmentsSidebarCloseBtn.addEventListener('click', () => this.hideAttachmentsSidebar());
        }
        if (this.attachmentBtn && this.attachmentInput) {
            this.attachmentBtn.addEventListener('click', () => {
                this.attachmentInput.click(); // Trigger the file input click
            });
            this.attachmentInput.addEventListener('change', (event) => {
                const file = event.target.files[0];
                if (file) {
                    this.loadAttachment(file);
                }
                event.target.value = ''; // Clear the input to allow re-uploading the same file
            });
        }
    }

    toggleAttachmentsSidebar() {
        if (this.attachmentsSidebar) {
            this.attachmentsSidebar.classList.toggle('show');
        }
    }

    hideAttachmentsSidebar() {
        if (this.attachmentsSidebar) {
            this.attachmentsSidebar.classList.remove('show');
        }
    }

    openDialog(accept, callbackType) {
        this.fileInput.accept = accept;
        this.currentCallbackType = callbackType; // Store which callback to use
        this.fileInput.click();
    }

    async handleFileChange(event) {
        const file = event.target.files[0];
        if (!file) {
            console.log('❌ Nenhum arquivo selecionado');
            return;
        }

        console.log('📁 Arquivo selecionado:', {
            name: file.name,
            size: file.size,
            type: file.type,
            callbackType: this.currentCallbackType
        });

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const content = e.target.result;
                console.log('📖 Arquivo lido com sucesso, tamanho:', content.length);

                let data = null;

                if (file.name.toLowerCase().endsWith('.json')) {
                    console.log('📄 Processando arquivo JSON...');
                    data = JSON.parse(content);
                    console.log('✅ JSON parseado com sucesso:', { length: data?.length, type: Array.isArray(data) ? 'array' : typeof data });
                } else if (file.name.toLowerCase().endsWith('.html')) {
                    console.log('🌐 Processando arquivo HTML...');
                    data = this.extractVoxelDataFromHTML(content);
                    console.log('✅ Dados extraídos do HTML:', { length: data?.length });
                } else if (file.type.startsWith('image/')) {
                    console.log('🖼️ Processando imagem...');
                    data = content; // For images, the content is the data URL
                    console.log('✅ Imagem processada como Data URL');
                } else {
                    throw new Error(`Tipo de arquivo não suportado: ${file.type || 'desconhecido'}`);
                }

                // Call the appropriate callback
                if (data) {
                    console.log('🔄 Chamando callback apropriado:', this.currentCallbackType);
                    switch (this.currentCallbackType) {
                        case 'voxel':
                            console.log('🎯 Chamando onVoxelDataLoaded...');
                            this.callbacks.onVoxelDataLoaded(data, file.name);
                            break;
                        case 'roomObject':
                            console.log('🏠 Chamando onRoomObjectLoaded...');
                            this.callbacks.onRoomObjectLoaded(data, file.name);
                            break;
                        case 'referenceImage':
                            console.log('🖼️ Chamando onReferenceImageLoaded...');
                            this.callbacks.onReferenceImageLoaded(data, file.name);
                            break;
                        default:
                            const errorMsg = `Nenhum tipo de callback especificado para o arquivo: ${this.currentCallbackType}`;
                            console.error('❌', errorMsg);
                            this.callbacks.onError(errorMsg);
                    }
                } else {
                    const errorMsg = 'Nenhum dado válido encontrado no arquivo.';
                    console.error('❌', errorMsg);
                    this.callbacks.onError(errorMsg);
                }

            } catch (error) {
                console.error('❌ Erro ao processar arquivo:', error);
                this.callbacks.onError('Erro ao processar arquivo: ' + error.message);
            }
        };

        reader.onerror = (error) => {
            console.error('❌ Erro ao ler arquivo:', error);
            this.callbacks.onError('Erro ao ler arquivo: ' + error.message);
        };

        if (file.type.startsWith('image/')) {
            console.log('📖 Lendo arquivo como Data URL...');
            reader.readAsDataURL(file); // Read image as Data URL
        } else {
            console.log('📖 Lendo arquivo como texto...');
            reader.readAsText(file); // Read text files
        }

        // Clear the file input value to allow re-uploading the same file
        event.target.value = '';
        console.log('🧹 Input de arquivo limpo');
    }

    // New method to handle attachment loading
    

    extractVoxelDataFromHTML(htmlContent) {
        console.log('🔍 Procurando dados de voxel no HTML...');

        // Procurar por diferentes padrões possíveis
        const patterns = [
            /const voxelData = (\[[\s\S]*?\]);/,
            /voxelData\s*=\s*(\[[\s\S]*?\]);/,
            /"voxelData"\s*:\s*(\[[\s\S]*?\])/,
            /voxelData\s*:\s*(\[[\s\S]*?\])/,
            /window\.voxelData\s*=\s*(\[[\s\S]*?\]);/
        ];

        for (let i = 0; i < patterns.length; i++) {
            const pattern = patterns[i];
            const match = htmlContent.match(pattern);

            if (match && match[1]) {
                console.log(`✅ Padrão ${i + 1} encontrado, tentando parsear JSON...`);

                try {
                    const voxelData = JSON.parse(match[1]);
                    console.log('✅ JSON parseado com sucesso:', { length: voxelData?.length });

                    if (Array.isArray(voxelData) && voxelData.length > 0) {
                        return voxelData;
                    } else {
                        console.warn('⚠️ Dados parseados não são um array válido ou estão vazios');
                    }
                } catch (parseError) {
                    console.warn(`⚠️ Erro ao parsear JSON com padrão ${i + 1}:`, parseError.message);
                    continue; // Tentar próximo padrão
                }
            }
        }

        // Se nenhum padrão funcionou, tentar uma abordagem mais simples
        console.log('🔄 Tentando abordagem alternativa...');

        // Procurar por qualquer array que contenha objetos com x, y, z
        const arrayMatch = htmlContent.match(/\[[\s\S]*?\{[\s\S]*?"x"[\s\S]*?\}[\s\S]*?\]/);
        if (arrayMatch) {
            try {
                const potentialData = JSON.parse(arrayMatch[0]);
                if (Array.isArray(potentialData) && potentialData.length > 0) {
                    // Verificar se tem a estrutura esperada
                    const hasValidStructure = potentialData.some(item =>
                        typeof item === 'object' &&
                        'x' in item && 'y' in item && 'z' in item
                    );

                    if (hasValidStructure) {
                        console.log('✅ Dados encontrados com abordagem alternativa');
                        return potentialData;
                    }
                }
            } catch (error) {
                console.warn('⚠️ Abordagem alternativa falhou:', error.message);
            }
        }

        // Se ainda não encontrou, mostrar uma prévia do conteúdo para debug
        const preview = htmlContent.substring(0, 500) + (htmlContent.length > 500 ? '...' : '');
        console.error('❌ Prévia do conteúdo HTML:', preview);

        throw new Error('Formato de arquivo HTML não reconhecido ou dados de voxel não encontrados. Verifique se o arquivo foi exportado corretamente do voxel editor.');
    }

    // Method to display attachments in the sidebar
    displayAttachment(name) {
        if (!this.currentAttachmentsList) return;

        const attachmentDiv = document.createElement('div');
        attachmentDiv.className = 'room-object-card'; // Reusing existing style
        attachmentDiv.innerHTML = `
            <div class="card-header">
                <h5>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                        <path fill-rule="evenodd" d="M10 2a.75.75 0 01.75.75v.51a4.52 4.52 0 012.14.996l.45-.45a.75.75 0 111.06 1.06l-.45.45c.36.47.65.99.86 1.55h.51a.75.75 0 110 1.5h-.51a4.52 4.52 0 01-.86 1.55l.45.45a.75.75 0 11-1.06 1.06l-.45-.45a4.52 4.52 0 01-2.14.996v.51a.75.75 0 11-1.5 0v-.51a4.52 4.52 0 01-2.14-.996l-.45.45a.75.75 0 11-1.06-1.06l.45-.45a4.52 4.52 0 01-.86-1.55h-.51a.75.75 0 010-1.5h.51c.21-.56.5-1.08.86-1.55l-.45-.45a.75.75 0 011.06-1.06l.45.45c.6-.43 1.32-.77 2.14-.996V2.75A.75.75 0 0110 2zM8.5 10a1.5 1.5 0 103 0 1.5 1.5 0 00-3 0z" />
                    </svg>
                    <span>${name}</span>
                </h5>
                <button class="remove-attachment-btn" data-attachment-name="${name}">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.58.22-2.365.468a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.576l.84-10.518.149.022a.75.75 0 10.23-1.482A41.03 41.03 0 0014 4.193v-.443A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clip-rule="evenodd" />
                    </svg>
                    <span>Remover</span>
                </button>
            </div>
        `;
        this.currentAttachmentsList.appendChild(attachmentDiv);

        // Add event listener for remove button
        attachmentDiv.querySelector('.remove-attachment-btn').addEventListener('click', () => {
            this.removeAttachment(name, attachmentDiv);
        });
    }

    removeAttachment(name, element) {
        // Here you would add logic to actually remove the attachment from memory or scene if it was a 3D object
        // For now, just remove from display
        if (element && element.parentNode) {
            element.parentNode.removeChild(element);
            console.log(`Attachment "${name}" removed.`);
        }
    }
}