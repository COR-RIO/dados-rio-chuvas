# Configuração do Google Maps

## Como obter a chave da API do Google Maps

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/)
2. Crie um novo projeto ou selecione um existente
3. Ative as seguintes APIs:
   - Maps JavaScript API
   - Geocoding API (opcional, para funcionalidades futuras)
4. Vá para "Credenciais" e crie uma nova chave de API
5. Configure as restrições de segurança (recomendado):
   - Restrição de aplicativo: HTTP referrers
   - Adicione: `localhost:*` e seu domínio de produção

## Configuração no projeto

1. Crie um arquivo `.env.local` na raiz do projeto
2. Adicione sua chave da API:

```env
VITE_GOOGLE_MAPS_API_KEY=sua_chave_aqui
```

3. Reinicie o servidor de desenvolvimento:

```bash
npm run dev
```

## Funcionalidades implementadas

- ✅ Mapa interativo do Rio de Janeiro
- ✅ Overlay dos bairros com cores baseadas na intensidade de chuva
- ✅ Marcadores das estações meteorológicas
- ✅ Tooltips informativos
- ✅ Estilos customizados do mapa
- ✅ Integração com dados em tempo real

## Estrutura do componente

- `GoogleMap.tsx`: Componente principal
- Usa `@googlemaps/react-wrapper` para carregamento
- Integra com dados dos bairros e estações meteorológicas
- Estilos customizados para melhor visualização

## Notas importantes

- A chave da API é necessária para o funcionamento
- O mapa carrega automaticamente os dados dos bairros
- As cores são atualizadas em tempo real baseadas nos dados de chuva
- Tooltips mostram informações detalhadas ao clicar
