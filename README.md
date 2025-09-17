# Editor Voxel 3D

Um editor interativo para criar arte voxel 3D no navegador usando Three.js.

## Funcionalidades

### Interface de Criação
- **Visualização 3D** com câmera ortográfica isométrica
- **Paleta de cores expandida** com 18 cores diferentes
- **Controles de câmera** para rotacionar, mover e dar zoom
- **Indicador visual** (ghost cube) mostra onde o próximo voxel será colocado

### Interação
- **Clique esquerdo**: Adiciona um voxel na posição indicada
- **Clique direito**: Remove o voxel clicado
- **Mouse hover**: Mostra prévia da posição do próximo voxel

### Ferramentas
- **Contador de voxels** em tempo real
- **Botão Limpar Cena** para remover todos os voxels
- **Botão Desfazer** para voltar ao estado anterior
- **Botão Exportar** para gerar arquivo HTML autocontido

### Atalhos de Teclado
- `Ctrl + Z`: Desfazer última ação
- `Delete` ou `Backspace`: Limpar toda a cena (com confirmação)

## Como Usar

1. **Abrir a aplicação**: Abra o arquivo `index.html` em um navegador moderno
2. **Selecionar cor**: Clique em uma cor na paleta
3. **Adicionar voxels**: Clique na grade ou em faces de voxels existentes
4. **Remover voxels**: Clique direito em um voxel para removê-lo
5. **Navegar**: Arraste para rotacionar, scroll para zoom
6. **Exportar**: Clique em "Exportar para HTML" para baixar sua criação

## Exportação

O botão "Exportar para HTML" gera um arquivo autocontido que:
- Contém todos os dados dos voxels (posição e cor)
- Inclui o código Three.js necessário
- Pode ser aberto em qualquer navegador
- Permite visualização e navegação da arte criada

## Tecnologias Utilizadas

- **HTML5 Canvas** para renderização
- **Three.js** para gráficos 3D
- **JavaScript ES6+** para lógica
- **CSS3** para interface

## Estrutura dos Arquivos

- `index.html` - Interface principal com canvas e controles
- `editor.js` - Lógica do editor voxel e exportação
- `README.md` - Esta documentação

## Requisitos do Sistema

- Navegador moderno com suporte a WebGL
- JavaScript habilitado
- Conexão com internet (para carregar Three.js via CDN)

## Exemplo de Uso

1. Selecione a cor vermelha na paleta
2. Clique na grade para adicionar o primeiro voxel
3. Clique nas faces do voxel para adicionar voxels adjacentes
4. Mude para outras cores e continue construindo
5. Use os controles de câmera para ver todos os ângulos
6. Exporte sua criação quando estiver satisfeito

Divirta-se criando arte voxel 3D!