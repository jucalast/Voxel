// =====================================================================
// MÓDULO TIME OF DAY SYSTEM
// =====================================================================
// Gerencia as configurações de iluminação para diferentes momentos do dia
// com base em um valor de tempo contínuo (0 a 1439 minutos).
//
// FUNCIONALIDADES:
// - Calcula dinamicamente a cor e intensidade da luz ambiente.
// - Calcula a cor, intensidade e posição da luz principal (sol/lua).
// - Ajusta a cor e densidade do nevoeiro para simular o ciclo dia/noite.
//
// USO:
// 1. Importar: import { TimeSystem } from './timeSystem.js'
// 2. Criar instância: const timeSystem = new TimeSystem()
// 3. Obter config: const config = timeSystem.getLightingConfig(timeInMinutes)
// =====================================================================

export class TimeSystem {
  constructor() {
    // Define os pontos chave do dia em minutos (0 a 1439)
    // 00:00 = 0
    // 06:00 = 360
    // 12:00 = 720
    // 18:00 = 1080
    // 23:59 = 1439
  }

  /**
   * Interpola linearmente entre dois valores.
   * @param {number} a - Valor inicial.
   * @param {number} b - Valor final.
   * @param {number} t - Fator de interpolação (0.0 a 1.0).
   * @returns {number} - Valor interpolado.
   */
  lerp(a, b, t) {
    return a + (b - a) * t;
  }

  /**
   * Interpola linearmente entre duas cores.
   * @param {THREE.Color} color1 - Primeira cor.
   * @param {THREE.Color} color2 - Segunda cor.
   * @param {number} t - Fator de interpolação (0.0 a 1.0).
   * @returns {THREE.Color} - Cor interpolada.
   */
  lerpColor(color1, color2, t) {
    const r = this.lerp(color1.r, color2.r, t);
    const g = this.lerp(color1.g, color2.g, t);
    const b = this.lerp(color1.b, color2.b, t);
    return new THREE.Color(r, g, b);
  }

  /**
   * Obtém a configuração de iluminação para um determinado momento do dia.
   * @param {number} timeInMinutes - O tempo em minutos (0 a 1439).
   * @returns {object} - Objeto de configuração de iluminação.
   */
  getLightingConfig(timeInMinutes) {
    const hour = timeInMinutes / 60; // Converte minutos para horas (0.0 a 23.99)

    let ambientColor, ambientIntensity;
    let mainLightColor, mainLightIntensity, mainLightPosition;
    let fogColor, fogNear, fogFar;

    // Define os estados chave para transição
    const dawnStart = 5;  // 05:00
    const dawnEnd = 7;    // 07:00
    const dayStart = 7;   // 07:00
    const dayEnd = 17;    // 17:00
    const duskStart = 17; // 17:00
    const duskEnd = 19;   // 19:00
    const nightStart = 19; // 19:00
    const nightEnd = 5;   // 05:00 (do dia seguinte)

    // Cores e intensidades base
    const ambientNight = new THREE.Color(0x202040);
    const ambientDay = new THREE.Color(0xffffff);
    const mainLightNight = new THREE.Color(0x8080ff); // Cor da lua
    const mainLightDay = new THREE.Color(0xffffff);   // Cor do sol
    const fogNight = new THREE.Color(0x000010);
    const fogDay = new THREE.Color(0xabcdef);

    // Posições do sol/lua (aproximadas para um ciclo)
    // Y controla a altura (sol a pino, sol no horizonte, sol abaixo do horizonte)
    // X e Z controlam a direção (nascer/pôr)
    // A luz principal se move em um arco.
    const sunMoonArcRadius = 30; // Distância da luz ao centro da cena

    // Função para calcular a posição da luz principal em um arco
    // Angle em radianos, 0 = leste (nascer), PI = oeste (pôr)
    const calculateSunMoonPosition = (angle) => {
      const x = Math.sin(angle) * sunMoonArcRadius;
      const y = Math.cos(angle) * sunMoonArcRadius; // Y é a altura
      const z = Math.cos(angle) * sunMoonArcRadius; // Z é a profundidade
      return { x: x, y: y, z: z };
    };

    // Normaliza o tempo para um ciclo de 0 a 1 para interpolação
    let t;

    if (hour >= dawnStart && hour < dawnEnd) { // Amanhecer (5h-7h)
      t = (hour - dawnStart) / (dawnEnd - dawnStart);
      ambientColor = this.lerpColor(ambientNight, ambientDay, t);
      ambientIntensity = this.lerp(0.3, 0.7, t);
      mainLightColor = this.lerpColor(mainLightNight, mainLightDay, t);
      mainLightIntensity = this.lerp(0.5, 1.5, t);
      mainLightPosition = calculateSunMoonPosition(this.lerp(Math.PI * 1.5, Math.PI * 0.5, t)); // Lua se pondo, sol nascendo
      fogColor = this.lerpColor(fogNight, fogDay, t);
      fogNear = this.lerp(5, 10, t);
      fogFar = this.lerp(50, 100, t);
    } else if (hour >= dayStart && hour < dayEnd) { // Dia (7h-17h)
      t = (hour - dayStart) / (dayEnd - dayStart);
      ambientColor = ambientDay;
      ambientIntensity = 0.7;
      mainLightColor = mainLightDay;
      mainLightIntensity = 1.5;
      mainLightPosition = calculateSunMoonPosition(this.lerp(Math.PI * 0.5, Math.PI * -0.5, t)); // Sol se movendo pelo céu
      fogColor = fogDay;
      fogNear = 10;
      fogFar = 100;
    } else if (hour >= duskStart && hour < duskEnd) { // Entardecer (17h-19h)
      t = (hour - duskStart) / (duskEnd - duskStart);
      ambientColor = this.lerpColor(ambientDay, ambientNight, t);
      ambientIntensity = this.lerp(0.7, 0.3, t);
      mainLightColor = this.lerpColor(mainLightDay, mainLightNight, t);
      mainLightIntensity = this.lerp(1.5, 0.5, t);
      mainLightPosition = calculateSunMoonPosition(this.lerp(Math.PI * -0.5, Math.PI * -1.5, t)); // Sol se pondo, lua nascendo
      fogColor = this.lerpColor(fogDay, fogNight, t);
      fogNear = this.lerp(10, 5, t);
      fogFar = this.lerp(100, 50, t);
    } else { // Noite (19h-5h)
      // Normaliza a noite para interpolação contínua
      let nightHour = hour;
      if (nightHour >= 19) { // 19:00 a 23:59
        t = (nightHour - 19) / (24 - 19 + 5); // Normaliza para 0 a 1 sobre o período noturno
      } else { // 00:00 a 04:59
        t = (nightHour + 5) / (24 - 19 + 5); // Continua a normalização
      }
      
      ambientColor = ambientNight;
      ambientIntensity = 0.3;
      mainLightColor = mainLightNight;
      mainLightIntensity = 0.5;
      mainLightPosition = calculateSunMoonPosition(this.lerp(Math.PI * -1.5, Math.PI * 0.5, t)); // Lua se movendo pelo céu
      fogColor = fogNight;
      fogNear = 5;
      fogFar = 50;
    }

    return {
      ambientLight: { color: ambientColor.getHex(), intensity: ambientIntensity },
      mainLight: { color: mainLightColor.getHex(), intensity: mainLightIntensity, position: mainLightPosition },
      fillLight: { color: 0x8080ff, intensity: 0.3 }, // Mantém fixo ou varia se necessário
      backLight: { color: 0xff8080, intensity: 0.2 }, // Mantém fixo ou varia se necessário
      topLight: { color: 0xffffff, intensity: 0.4 }, // Mantém fixo ou varia se necessário
      pointLight1: { color: 0xffffff, intensity: 0.6, distance: 25 }, // Mantém fixo ou varia se necessário
      
      pointLight2: { color: 0xffffff, intensity: 0.6, distance: 25 }, // Mantém fixo ou varia se necessário
      fog: { color: fogColor.getHex(), near: fogNear, far: fogFar }
    };
  }
}