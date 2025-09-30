// Script de teste para verificar a API de chuvas
// Execute no console do navegador para testar

async function testRainApi() {
  console.log('🧪 Testando API de chuvas da Prefeitura do Rio...');
  
  try {
    const response = await fetch('https://websempre.rio.rj.gov.br/json/chuvas', {
      method: 'GET',
      mode: 'cors',
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-cache'
    });
    
    console.log('📡 Status da resposta:', response.status, response.statusText);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API funcionando! Dados recebidos:', data);
      console.log(`📊 Total de estações: ${data.objects?.length || 0}`);
      
      // Mostra algumas estações
      if (data.objects && data.objects.length > 0) {
        console.log('🌧️ Primeiras 3 estações:');
        data.objects.slice(0, 3).forEach((station, index) => {
          console.log(`${index + 1}. ${station.name}: h24=${station.data.h24}mm`);
        });
      }
      
      return true;
    } else {
      console.error('❌ Erro na API:', response.status, response.statusText);
      return false;
    }
  } catch (error) {
    console.error('❌ Erro ao acessar API:', error);
    return false;
  }
}

// Executa o teste
testRainApi();
