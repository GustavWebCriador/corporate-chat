# Corporate Chat — Frontend

Interface web do Corporate Chat desenvolvida
com React, JavaScript e Vite.

## Pré-requisitos

- Node.js compatível com Vite
- npm
- Backend Corporate Chat configurado

## Instalação

cd frontend
npm ci

## Configuração

Copie .env.example para .env.local.

Configure VITE_BACKEND_URL com o endereço
do backend.

## Desenvolvimento

npm run dev

## Validação

npm run lint
npm test
npm run build

## Integração

A interface utiliza a API REST do backend,
sob o prefixo /api/v1.

A comunicação em tempo real será realizada
por Socket.IO, conforme a documentação
do projeto.