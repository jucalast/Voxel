# Sistema de Iluminação Moderno

## Visão Geral
Sistema completo de lâmpadas LED modernas para instalação em teto e parede, com design contemporâneo e efeitos atmosféricos realistas.

## Características das Lâmpadas Modernas

### Design LED Contemporâneo
- **Spots de Teto**: Lâmpadas embutidas compactas (8cm diâmetro)
- **Track Lights**: Trilhos de parede com múltiplos spots
- **Materiais PBR**: Alumínio escovado com LED emissor
- **Instalação**: Detecção automática de teto/parede

### Tipos de Temperatura
- **Lâmpada Quente (2800K)**: Luz amarelada relaxante
- **Lâmpada Fria (6000K)**: Luz branca para trabalho

### Configurações LED
```javascript
spot: {
  housingRadius: 0.08,    // Housing compacto
  housingDepth: 0.12,     // Profundidade mínima
  lensRadius: 0.03,       // LED pequeno
  offsetFromSurface: 0.15 // Distância da superfície
},

track: {
  width: 0.12,           // Largura do trilho
  height: 0.05,          // Altura do perfil
  depth: 0.08,           // Profundidade
  spotCount: 3           // Número de spots
}
```

### Parâmetros de Iluminação
```javascript
warm: {
  color: 0xffa500,        // Laranja quente
  intensity: 4.5,         // Intensidade LED
  temperature: 2800,      // Kelvin
  angle: Math.PI / 3,     // 60° abertura
  penumbra: 0.3          // Suavidade das bordas
},

cool: {
  color: 0xffffff,        // Branco puro
  intensity: 5.0,         // Mais intensa
  temperature: 6000,      // Kelvin
  angle: Math.PI / 4,     // 45° abertura
  penumbra: 0.2          // Bordas mais definidas
}
```

## Sistema de Detecção de Superfície

### Algoritmo de Instalação
1. **Prioridade Teto**: Raycast para cima detecta superfície horizontal
2. **Fallback Parede**: Raycast direções cardinais se não há teto
3. **Validação Normal**: Verifica ângulos da superfície
4. **Posicionamento**: Calcula offset ideal da superfície

### Detecção de Teto
```javascript
// Normal apontando para baixo (Y < -0.8)
if (normal.y < -0.8) {
  return { surface: 'ceiling', position, normal };
}
```

### Detecção de Parede
```javascript
// Normal horizontal (|Y| < 0.3)
if (Math.abs(normal.y) < 0.3) {
  return { surface: 'wall', position, normal };
}
```

## Efeitos Atmosféricos Modernos

### Cone de Luz Focado
- Geometria cônica sutil (1.5m raio, 3m altura)
- Opacidade baixa (0.08) para realismo
- Rotação quase imperceptível

### Halo Minimalista
- Anel menor (0.3-1.5m raio)
- Opacidade mínima (0.03)
- Pulsação sutil (±5% escala)

### Animações
```javascript
// Movimento muito sutil
const time = Date.now() * 0.0008;
effects.halo.rotation.z = time * 0.05;
effects.lightCone.rotation.y = time * 0.02;

// Variação mínima na opacidade
const opacity = 0.06 + Math.sin(time * 0.8) * 0.02;
```

## Integração com WalkBuildMode

### Detecção Automática
- Usa posição do jogador como centro de busca
- Prioriza teto sobre paredes
- Testa múltiplas direções para paredes

### Feedback Visual
```javascript
const typeText = lampType === 'warm' ? 'quente (2800K)' : 'fria (6000K)';
const surfaceText = surface === 'ceiling' ? 'teto' : 'parede';
console.log(`💡✨ Lâmpada LED ${typeText} instalada no ${surfaceText}`);
```

### Comandos de Debug
- `debugLamps()`: Lista todas as lâmpadas
- `walkPerformance()`: Status de performance
- `debugCache()`: Estado do cache

## Materiais PBR Realistas

### Housing de Alumínio
```javascript
housing: new THREE.MeshStandardMaterial({
  color: 0xc0c0c0,      // Prata
  metalness: 0.8,       // Altamente metálico
  roughness: 0.3,       // Levemente áspero
  envMapIntensity: 1.2   // Reflexos intensos
})
```

### LED Emissor
```javascript
led_warm: new THREE.MeshStandardMaterial({
  color: 0xffa500,      // Laranja
  emissive: 0x664400,   // Auto-luminoso
  emissiveIntensity: 0.3 // Brilho sutil
})
```

### Parte Interna
```javascript
inner: new THREE.MeshStandardMaterial({
  color: 0x1a1a1a,      // Preto fosco
  roughness: 0.9,       // Muito áspero
  metalness: 0.1        // Minimamente metálico
})
```

## Uso no Projeto

### Instalação Automática
1. Selecione lâmpada quente ou fria no inventário
2. Entre no walk mode
3. Clique esquerdo em qualquer lugar
4. Sistema detecta automaticamente teto/parede
5. Lâmpada é instalada na superfície adequada

### Vantagens do Sistema Moderno
- **Realismo**: Design contemporâneo de LED
- **Automação**: Detecção inteligente de superfície
- **Performance**: Geometrias otimizadas
- **Flexibilidade**: Suporta teto e parede
- **Atmosfera**: Efeitos sutis e realistas

## Arquivos Modificados
- `modules/lightingSystem.js`: Sistema principal
- `modules/walkBuildMode.js`: Integração com walk mode
- `index.html`: Interface do inventário
- `styles.css`: Estilos dos ícones das lâmpadas