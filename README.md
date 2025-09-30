# Dados Rio Chuvas

Um mapa interativo que mostra os dados de chuva em tempo real para os bairros do Rio de Janeiro.

## 🚀 Deploy no Netlify

### Opção 1: Deploy via Git (Recomendado)

1. **Faça push do código para o GitHub/GitLab/Bitbucket**
2. **Acesse [netlify.com](https://netlify.com)** e faça login
3. **Clique em "New site from Git"**
4. **Conecte seu repositório**
5. **Configure as variáveis de ambiente:**
   - `VITE_GOOGLE_MAPS_API_KEY`: Sua chave da API do Google Maps
6. **Clique em "Deploy site"**

### Opção 2: Deploy Manual

1. **Execute o build localmente:**
   ```bash
   npm run build
   ```

2. **Acesse [netlify.com](https://netlify.com)** e faça login
3. **Arraste a pasta `dist`** para a área de deploy
4. **Configure as variáveis de ambiente** nas configurações do site

### 🔑 Configuração da API do Google Maps

1. **Acesse [Google Cloud Console](https://console.cloud.google.com/)**
2. **Crie um novo projeto** ou selecione um existente
3. **Ative a API "Maps JavaScript API"**
4. **Crie uma chave de API** em "Credenciais"
5. **Configure as restrições** (recomendado):
   - Restrição de aplicativo: Sites HTTP (referenciadores)
   - Adicione seu domínio do Netlify (ex: `https://seu-site.netlify.app`)

### 📁 Estrutura do Projeto

```
src/
├── components/          # Componentes React
│   ├── GoogleMap.tsx   # Mapa principal
│   ├── RainLegend.tsx  # Legenda de cores
│   └── ...
├── hooks/              # Custom hooks
├── services/           # APIs e serviços
├── types/              # Definições TypeScript
└── utils/              # Utilitários
```

### 🛠️ Scripts Disponíveis

- `npm run dev` - Servidor de desenvolvimento
- `npm run build` - Build para produção
- `npm run preview` - Preview do build
- `npm run lint` - Verificar código

### 🌧️ Funcionalidades

- **Mapa interativo** com Google Maps
- **Dados em tempo real** das estações pluviométricas
- **Cores dinâmicas** baseadas na intensidade da chuva
- **Legenda informativa** com níveis de chuva
- **Responsivo** para mobile e desktop

### 📊 Níveis de Chuva

- 🟢 **Sem chuva**: 0 mm
- 🔵 **Chuva fraca**: 0,2 a 5,0mm/h
- 🟡 **Chuva moderada**: 5,1 a 25,0mm/h
- 🟠 **Chuva forte**: 25,1 a 50,0mm/h
- 🔴 **Chuva muito forte**: Acima de 50,0mm/h

### 🔧 Tecnologias

- **React** + **TypeScript**
- **Vite** (build tool)
- **Google Maps API**
- **Tailwind CSS**
- **Netlify** (deploy)