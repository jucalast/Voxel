// =====================================================================
// CORREÇÃO AUTOMÁTICA DE ILUMINAÇÃO
// =====================================================================
// Este script corrige automaticamente problemas de iluminação no editor
// que podem ocorrer quando o DoorWindowSystem remove luzes incorretamente
// =====================================================================

window.fixEditorLighting = function() {
  console.log('🔧 Verificando iluminação do editor...');
  
  // Verificar se há luzes na cena
  let lightCount = 0;
  let editorLights = 0;
  
  window.scene.traverse((child) => {
    if (child.isLight) {
      lightCount++;
      if (child.userData.isEditorLight || (!child.userData.isNaturalLight && !child.userData.isMinimalAmbient)) {
        editorLights++;
      }
    }
  });
  
  console.log(`💡 Luzes encontradas: ${lightCount} total, ${editorLights} do editor`);
  
  if (editorLights < 2) {
    console.log('⚠️ Iluminação insuficiente detectada! Recriando luzes do editor...');
    
    // Remover apenas luzes problemáticas se existirem
    const lightsToRemove = [];
    window.scene.traverse((child) => {
      if (child.isLight && child.userData.isMinimalAmbient) {
        lightsToRemove.push(child);
      }
    });
    
    lightsToRemove.forEach(light => {
      console.log(`🗑️ Removendo luz problemática: ${light.type}`);
      window.scene.remove(light);
    });
    
    // Criar iluminação padrão do editor
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    ambientLight.userData.isEditorLight = true;
    ambientLight.name = 'EditorAmbientLight';
    window.scene.add(ambientLight);
    
    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight1.position.set(10, 10, 5);
    directionalLight1.castShadow = true;
    directionalLight1.userData.isEditorLight = true;
    directionalLight1.name = 'EditorDirectionalLight1';
    window.scene.add(directionalLight1);
    
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight2.position.set(-10, 10, -5);
    directionalLight2.userData.isEditorLight = true;
    directionalLight2.name = 'EditorDirectionalLight2';
    window.scene.add(directionalLight2);
    
    const pointLight = new THREE.PointLight(0xffffff, 0.5, 50);
    pointLight.position.set(0, 15, 0);
    pointLight.userData.isEditorLight = true;
    pointLight.name = 'EditorPointLight';
    window.scene.add(pointLight);
    
    // Configurar renderer para modo editor
    if (window.renderer) {
      window.renderer.toneMappingExposure = 1.2;
      window.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      window.renderer.shadowMap.enabled = true;
      window.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    
    console.log('✅ Iluminação do editor restaurada com sucesso!');
    console.log(`   - Luz ambiente: intensidade 0.6`);
    console.log(`   - Luz direcional 1: intensidade 0.8, posição (10, 10, 5)`);
    console.log(`   - Luz direcional 2: intensidade 0.4, posição (-10, 10, -5)`);
    console.log(`   - Luz pontual: intensidade 0.5, posição (0, 15, 0)`);
    
    return true;
  } else {
    console.log('✅ Iluminação do editor está OK');
    return false;
  }
};

// Executar correção automaticamente após carregamento
setTimeout(() => {
  if (window.scene && window.renderer) {
    console.log('🔍 Verificação automática de iluminação...');
    const wasFixed = window.fixEditorLighting();
    
    if (wasFixed) {
      console.log('');
      console.log('🌟 === PROBLEMA DE ILUMINAÇÃO CORRIGIDO ===');
      console.log('');
      console.log('🔧 O sistema detectou e corrigiu automaticamente');
      console.log('   um problema de iluminação no modo editor.');
      console.log('');
      console.log('💡 Agora o editor deve estar bem iluminado novamente!');
      console.log('');
      console.log('🎮 Para testar o sistema de atmosfera escura:');
      console.log('   1. Entre no Room Mode');
      console.log('   2. Entre no Walk Mode');
      console.log('   3. Observe a diferença dramática na iluminação');
      console.log('');
    }
  }
}, 2000); // Aguardar 2 segundos após carregamento

// Função para debug manual
window.debugLighting = function() {
  console.log('🔍 === DEBUG DE ILUMINAÇÃO ===');
  
  let totalLights = 0;
  const lightsByType = {};
  
  window.scene.traverse((child) => {
    if (child.isLight) {
      totalLights++;
      const type = child.type;
      const userData = child.userData || {};
      
      if (!lightsByType[type]) {
        lightsByType[type] = [];
      }
      
      lightsByType[type].push({
        name: child.name || 'Sem nome',
        intensity: child.intensity,
        isEditorLight: userData.isEditorLight || false,
        isNaturalLight: userData.isNaturalLight || false,
        isMinimalAmbient: userData.isMinimalAmbient || false,
        position: child.position ? `(${child.position.x.toFixed(1)}, ${child.position.y.toFixed(1)}, ${child.position.z.toFixed(1)})` : 'N/A'
      });
    }
  });
  
  console.log(`📊 Total de luzes: ${totalLights}`);
  console.log('');
  
  Object.keys(lightsByType).forEach(type => {
    console.log(`${type}:`);
    lightsByType[type].forEach((light, index) => {
      console.log(`  ${index + 1}. ${light.name} - Intensidade: ${light.intensity}`);
      console.log(`     Posição: ${light.position}`);
      console.log(`     Editor: ${light.isEditorLight}, Natural: ${light.isNaturalLight}, Mínima: ${light.isMinimalAmbient}`);
    });
    console.log('');
  });
  
  // Verificar renderer
  if (window.renderer) {
    console.log('📷 Renderer:');
    console.log(`   Tone Mapping: ${window.renderer.toneMapping}`);
    console.log(`   Exposição: ${window.renderer.toneMappingExposure}`);
    console.log(`   Sombras: ${window.renderer.shadowMap.enabled}`);
  }
};

// Sistema de correção de iluminação carregado