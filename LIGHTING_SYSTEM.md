# 💡 Sistema de Lâmpadas e Iluminação Artificial

## 🌟 Visão Geral

O Sistema de Lâmpadas oferece iluminação artificial realista e adaptativa para ambientes 3D, similar ao sistema de portas mas focado em luz artificial em vez de luz natural.

## 🔧 Características Principais

### **Tipos de Lâmpadas**
- **🔥 Lâmpada Quente (2800K)**: Luz alaranjada, atmosfera aconchegante
- **❄️ Lâmpada Fria (6000K)**: Luz azulada, atmosfera produtiva

### **Efeitos Visuais**
- **💡 Modelos 3D**: Poste, base e bulbo realistas
- **✨ Efeitos Atmosféricos**: Cones de luz volumétrica, halos
- **🌫️ Partículas de Poeira**: Sistema de partículas para visualizar raios de luz
- **🎭 Sombras Dinâmicas**: Sombras realistas com qualidade configurável

### **Sistema de Materiais**
- **🎨 Materiais PBR**: Metalness, roughness, emissão
- **🔆 Materiais Emissivos**: Bulbos que brilham realisticamente
- **♻️ Cache de Materiais**: Reutilização para performance

## 🎮 Como Usar

### **No Walk Mode**
1. **Entre no modo walk** (botão de primeira pessoa)
2. **Abra o inventário** (visível automaticamente)
3. **Selecione uma lâmpada**:
   - Slot 3: 🔥💡 Lâmpada Quente (2800K)
   - Slot 4: ❄️💡 Lâmpada Fria (6000K)
4. **Aponte para o chão** e clique para colocar
5. **Lâmpada liga automaticamente** com animação

### **Controles de Teclado**
- **1-9**: Selecionar slots do inventário
- **Clique**: Colocar lâmpada no chão
- **ESC**: Desselecionar item

## 🔧 API de Desenvolvimento

### **Comandos Básicos**
```javascript
// Criar lâmpada
lampControls.create('lamp1', {x: 0, y: 0, z: 0}, 'warm')

// Alternar lâmpada (ligar/desligar)
lampControls.toggle('lamp1')

// Alterar tipo (quente/fria)
lampControls.setType('lamp1', 'cool')

// Ajustar intensidade
lampControls.setIntensity('lamp1', 2.5)

// Remover lâmpada
lampControls.remove('lamp1')

// Listar todas as lâmpadas
lampControls.list()
```

### **Controles de Ambiente**
```javascript
// Ajustar luz ambiente global
lampControls.setGlobalAmbient(0.1)

// Habilitar/desabilitar efeitos atmosféricos
lampControls.enableAtmosphere(true)

// Presets rápidos
lampControls.warmLighting()    // Ambiente quente
lampControls.coolLighting()    // Ambiente frio
lampControls.mixedLighting()   // Ambiente misto
```

### **Comandos de Debug**
```javascript
// Criar lâmpada rapidamente para teste
debugLamps.create(5, 5, 'warm')

// Listar todas as lâmpadas
debugLamps.listAll()

// Remover todas as lâmpadas
debugLamps.removeAll()

// Testar presets automaticamente
debugLamps.testPresets()

// Debug do sistema completo
lampControls.debug()
```

## ⚙️ Configurações Técnicas

### **Luz Quente (2800K)**
- **Cor**: #FFB366 (alaranjada)
- **Intensidade**: 2.5
- **Alcance**: 8 unidades
- **Decaimento**: 2.0
- **Atmosfera**: Tons alaranjados

### **Luz Fria (6000K)**
- **Cor**: #CCE7FF (azulada)
- **Intensidade**: 3.0
- **Alcance**: 10 unidades
- **Decaimento**: 1.8
- **Atmosfera**: Tons azulados

### **Sombras**
- **Resolução**: 1024x1024
- **Campo de visão**: 90°
- **Distância**: 0.1 a 15 unidades
- **Bias**: -0.0001

## 🎨 Sistema de Materiais

### **Poste da Lâmpada**
- **Material**: Metal escuro (#2c2c2c)
- **Metalness**: 0.8
- **Roughness**: 0.3

### **Base**
- **Material**: Concreto (#666666)
- **Metalness**: 0.0
- **Roughness**: 0.9

### **Bulbo Quente**
- **Cor**: #FFE4B5
- **Emissão**: #FFB366
- **Intensidade Emissiva**: 0.4

### **Bulbo Frio**
- **Cor**: #E6F3FF
- **Emissão**: #CCE7FF
- **Intensidade Emissiva**: 0.6

## ✨ Efeitos Atmosféricos

### **Cone de Luz Volumétrica**
- **Geometria**: Cone invertido
- **Material**: Aditivo semi-transparente
- **Animação**: Rotação e pulsação suaves

### **Halo no Chão**
- **Geometria**: Anel
- **Material**: Aditivo com baixa opacidade
- **Animação**: Rotação e escala dinâmicas

### **Partículas de Poeira**
- **Quantidade**: 200 partículas
- **Movimento**: Ascensão com deriva lateral
- **Efeito**: Visualização de raios de luz

## 🚀 Animações

### **Ligação da Lâmpada**
- **Duração**: 800ms
- **Curva**: Ease-out cúbica
- **Efeito**: Crescimento suave da intensidade
- **Flickering**: Piscadas sutis no início

### **Desligamento**
- **Duração**: 300ms
- **Curva**: Linear decrescente
- **Efeito**: Fade-out rápido

### **Efeitos Contínuos**
- **Halo**: Rotação e pulsação
- **Cone**: Rotação e variação de opacidade
- **Partículas**: Movimento ascendente contínuo

## 🔌 Integração com Walk Mode

O sistema está completamente integrado ao walkBuildMode:

1. **Inventário**: Slots 3 e 4 para lâmpadas
2. **Raycast**: Detecção automática do chão
3. **Feedback**: Visual e sonoro na colocação
4. **Performance**: Cache e otimizações automáticas

## 📊 Performance

### **Otimizações Implementadas**
- **Material Caching**: Reutilização de materiais
- **Object Pooling**: Geometrias reutilizáveis
- **LOD System**: Detalhes baseados na distância
- **Culling**: Renderização apenas do visível

### **Limites Recomendados**
- **Máximo de lâmpadas**: 20-30 por cena
- **Sombras simultâneas**: 8-12 luzes
- **Partículas**: 200 por sistema

## 🐛 Troubleshooting

### **Lâmpada não aparece**
```javascript
// Verificar sistema
debugLamps.listAll()

// Verificar posição
lampControls.list()
```

### **Performance baixa**
```javascript
// Desabilitar efeitos atmosféricos
lampControls.enableAtmosphere(false)

// Reduzir luz ambiente
lampControls.setGlobalAmbient(0.05)
```

### **Sombras não funcionam**
- Verificar se WebGL suporta shadow mapping
- Reduzir resolução de sombras se necessário

## 🎯 Exemplos Práticos

### **Iluminação de Escritório**
```javascript
// Lâmpadas frias para produtividade
lampControls.create('desk1', {x: 2, y: 0, z: 2}, 'cool')
lampControls.create('desk2', {x: -2, y: 0, z: 2}, 'cool')
lampControls.setGlobalAmbient(0.15)
```

### **Ambiente Aconchegante**
```javascript
// Lâmpadas quentes para relaxamento
lampControls.create('living1', {x: 0, y: 0, z: 0}, 'warm')
lampControls.create('living2', {x: 4, y: 0, z: 4}, 'warm')
lampControls.setGlobalAmbient(0.05)
```

### **Mix de Iluminação**
```javascript
// Combinação para versatilidade
lampControls.create('main', {x: 0, y: 0, z: 0}, 'cool')   // Principal fria
lampControls.create('accent1', {x: 3, y: 0, z: 3}, 'warm') // Acentos quentes
lampControls.create('accent2', {x: -3, y: 0, z: 3}, 'warm')
```

---

🎉 **Sistema completo e pronto para uso!** Agora você pode criar ambientes com iluminação artificial realista e adaptativa, oferecendo controle total sobre a atmosfera do espaço 3D.