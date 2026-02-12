# 📊 Queridômetro Bot para Discord

Um bot interativo desenvolvido em **Node.js** para realizar dinâmicas de "Queridômetro" em servidores do Discord. Os votos são realizados de forma privada e os resultados são exibidos de maneira anônima.

## ✨ Funcionalidades
- **Votação Anônima**: Cada participante vota nos outros via DM (Mensagem Direta).
- **Interface Interativa**: Uso de botões (ActionRows) para facilitar a votação.
- **Agendamento Automático**: Votações abrem sozinhas diariamente às 12h00 via `node-cron` com marcação `@here`.
- **Relatório de Resultados**: Soma os emojis recebidos por cada usuário sem revelar o autor do voto.

## 🛠️ Tecnologias
- [Node.js](https://nodejs.org/).
- [Discord.js v14](https://discord.js.org/).
- [Node-cron](https://www.npmjs.com/package/node-cron).
- **Hospedagem**: [Discloud](https://discloud.com/).

## ☁️ Configuração Discloud
O projeto já conta com o arquivo `discloud.config` para deploy imediato:
- **RAM**: 100MB.
- **Auto-restart**: Ativado.

## 🚀 Como rodar o projeto
1. Clone o repositório.
2. Instale as dependências com `npm install`.
3. **Configure os IDs**: No arquivo principal, adicione os IDs de usuário do Discord e os nomes correspondentes na lista de `PARTICIPANTES`.
4. Adicione o seu Token do bot no código.
5. Inicie o bot com `node index.js`.
