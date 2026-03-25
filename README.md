# 📸 Instagram Analytics Scraper ✨

**Instagram Analytics Scraper** é uma dashboard moderna e inteligente projetada para extrair, analisar e gerenciar em massa comentários e respostas de publicações do Instagram. O sistema é assíncrono, super-rápido e foi construído com foco na experiência do usuário utilizando a API de estabilidade do RapidAPI! 🚀

---

## 🌟 Principais Funcionalidades

- **Extração Profunda:** Carregamento paginado ilimitado usando _Infinite Scroll_ e botões de _Carregar Tudo_.
- **Descoberta de Respostas (Replies):** Botão inteligente que permite explorar as *threads* filho debaixo de comentários pai (expandindo com precisão via Media ID e Comment ID da API do Instagram).
- **Filtros Reativos ⚡:** Pesquise imediatamente dentro dos dados _já extraídos_:
  - **🔍 Busca Geral:** Filtre por texto ou pelo `@username`.
  - **🚫 Blacklist:** Remova palavras-chave com uma busca baseada em vírgula.
  - **😵‍💫 Filtro de Emojis:** Esconda imediatamente comentários vazios que não possuem texto além de emojis.
- **Integração Export-Ready 📊:** Exportação automática dos comentários carregados ou filtrados direto para CSV na formatação em UTF-8 com BOM: _Usuário, Comentário, Total de Curtidas, Tipo do Comentário e Link do Perfil._

---

## 🛠 Como Funciona (A Consulta / Under the Hood)

1. **Recepção da URL:** O frontend pede ao usuário um link qualquer de post do Instagram (ou shortcode `DWE-8OqjxNt`).
2. **Transformação do Shortcode:** O backend (`/api/analyze`) captura matematicamente e processa a engenharia reversa do _shortcode base64_ em um `post_id` numérico para que as chamadas às filiais do comentário possam ser processadas.
3. **Fetching Direto com RapidAPI 📡:**
   A rota proxy oculta a própria chave (`RAPIDAPI_KEY`) para garantir a segurança no ambiente do lado do cliente (React) e comunica-se com a *Instagram Scraper Stable API*:
   - Rota Pai: Pede _15 comentários_ via cursor (`pagination_token`) enviando via Query String para o script `get_post_comments.php`.
   - Rota de Respostas: Expande a thread através do `post_id` gerado, batendo em `get_post_child_comments.php`.
4. **Tratamento & Mapping:** O servidor limpa e mapeia a API massiva e retorna para a tabela frontend (UI do Radix/Tailwind) exibindo os likes num crachá badge interativo e renderizando a thumbnail (avatar) de perfil.

---

## 🏁 Como Começar

### Pré-requisitos
- Node.js versão [18+] instalado.
- Chave de assinatura válida do **Instagram Scraper Stable API** via RapidAPI.

### Passo-a-Passo

**1. Clone o pacote de análise**
```bash
git clone https://github.com/SEU_USUARIO/insta-dashboard.git
cd insta-dashboard
```

**2. Instale as dependências**
```bash
npm install
```

**3. Configure suas Environment Variables**
Crie um arquivo chamado `.env.local` na raiz contendo sua chave criptografada da RapidAPI:
```env
RAPIDAPI_KEY=sua_chave_secreta_aqui_da_rapidabi_com
```
*(Você pode consultar o modelo em `.env.example`)*

**4. Execute o servidor de desenvolvimento e brilhe! 🚀**
```bash
npm run dev
```

Abra o seu navegador em [http://localhost:3000](http://localhost:3000) e coloque o link do Instagram na sua nova Dashboard! 🎉 

---

## 📄 Licença

Este painel foi codificado inteiramente e mantido para usos e fins analíticos sob o uso estrito. Sinta-se à vontade para enviar issues ou relatar novas ideias de endpoints de extração.
