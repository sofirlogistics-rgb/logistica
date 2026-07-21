# ST Logística

Sistema de controle de Solicitações de Transporte (ST) — coletas, entregas e coleta+entrega — com login por usuário, painel administrativo para a Logística, acompanhamento de motoristas e relatórios exportáveis.

Construído como um **PWA de arquivo único** (`index.html`): React, Tailwind e Firebase carregados via CDN, sem etapa de build. Isso foi uma escolha deliberada para este projeto — permite editar e publicar o sistema sem Node.js, bundler ou build step, ao custo de algumas adaptações técnicas explicadas abaixo.

---

## 1. Stack real utilizada (e o porquê das adaptações)

| Peça pedida originalmente | O que foi usado | Motivo |
|---|---|---|
| React + Vite + TypeScript | React 18 (UMD) + Babel Standalone, direto no navegador | Sem build step — o arquivo roda abrindo direto no navegador ou por qualquer servidor estático |
| React Router | Roteador em hash próprio (`window.location.hash`) | React Router não tem build UMD estável para uso sem bundler |
| Framer Motion | Transições/animações CSS + Tailwind | Evita mais uma dependência de build |
| React Hook Form + Zod | Validação nativa (funções simples de `validate()`) | Mesma razão |
| lucide-react | `lucide` (pacote vanilla, mesmos ícones) | Versão sem JSX/build |
| Firebase SDK v9+ (modular) | **Firebase SDK v8 (legado)** | O SDK v9/v10 — mesmo em modo "compat" — usa `import()` dinâmico internamente, o que quebra ao abrir o arquivo direto do disco (`file://`). A v8 é 100% JavaScript clássico e não tem esse problema. |
| Tailwind CLI | Tailwind via CDN (Play CDN) | Mostra um aviso de "não usar em produção" no console — é só um aviso, funciona normalmente, mas se quiser performance de produção real, compile o Tailwind localmente depois. |

Todas as versões de bibliotecas externas estão **fixadas** (não usam `@latest`) depois de um incidente em que uma tag `@latest` mudou de versão maior e quebrou o app em produção sem nenhuma mudança de código nossa. Nunca remova os números de versão do `<script src=...>` no `<head>` do `index.html`.

---

## 2. Estrutura do projeto

```
st-logistica/
├── index.html        ← todo o app (design system, componentes, páginas, lógica)
├── manifest.json      ← metadados do PWA (nome, ícones, cores)
├── sw.js               ← service worker (cache do shell para uso offline básico)
├── icons/              ← ícones do PWA (192px, 512px, apple-touch, favicon)
└── README.md           ← este arquivo
```

Dentro do `index.html`, o código está organizado em seções comentadas (a "arquitetura de pastas" que normalmente ficaria em `components/`, `pages/`, `hooks/` etc. está toda ali dentro, na ordem):

1. Design tokens (cores, tipografia) — Tailwind config
2. Inicialização do Firebase (SDK v8) + camada de compatibilidade
3. Roteador, Autenticação, Toasts
4. Componentes base (Button, Card, Input, Select, Modal, Tabs...)
5. Cadastros (Usuários, Motoristas, Veículos, Setores)
6. Solicitações de Transporte (formulário, numeração automática, anexos)
7. Dashboards (setor/usuário e Logística)
8. Planejamento de Rotas (fila por motorista, drag-and-drop, data)
9. Timeline + Notificações
10. Relatórios (PDF/Excel/CSV)
11. App Root (montagem do React)

---

## 3. Papéis e login

Não existe mais login compartilhado por setor. Existem 3 tipos de conta:

| Papel | Quem cria | Como loga | O que vê |
|---|---|---|---|
| **Logística** | Se autoprovisiona no primeiro acesso (login `logistica`, senha `1234`) | usuário `logistica` | Painel administrativo completo: todas as STs, cadastros, planejamento de rotas, relatórios |
| **Usuário** | Só a Logística cadastra (Cadastros → Usuários) | login pessoal escolhido na hora do cadastro | Suas próprias STs, dashboard pessoal, "Acompanhar Motoristas" |
| **Motorista** | Só a Logística cadastra (Cadastros → Motoristas) | login gerado a partir do nome | Só as STs atribuídas a ele; pode iniciar rota, finalizar ou reagendar |

Senha inicial de qualquer conta nova: `1234`. Cada pessoa pode trocar a própria senha em **Perfil**.

---

## 4. Configuração do Firebase (checklist)

No [Console do Firebase](https://console.firebase.google.com/), projeto do sistema:

- [ ] **Authentication → Sign-in method** → E-mail/senha **habilitado**
- [ ] **Firestore Database** → criado (modo produção)
- [ ] **Storage** → criado (para os anexos das STs)
- [ ] **Firestore → Regras** → publicar as regras da seção 6 abaixo
- [ ] **Storage → Regras** → publicar as regras da seção 6 abaixo
- [ ] **Authentication → Settings → Authorized domains** → adicionar o domínio onde o site vai ficar publicado (ver seção 5 — isso é fácil de esquecer e o login simplesmente não funciona sem isso)

---

## 5. Deploy no GitHub Pages

1. Crie um repositório no GitHub e suba os arquivos deste projeto (`index.html`, `manifest.json`, `sw.js`, pasta `icons/`) na raiz (ou em `/docs`).
2. No repositório: **Settings → Pages → Source** → selecione a branch (`main`) e a pasta (`/root` ou `/docs`, conforme onde os arquivos ficaram).
3. Aguarde alguns minutos — o GitHub mostra a URL pública (algo como `https://seu-usuario.github.io/nome-do-repo/`).
4. **Passo que costuma ser esquecido:** volte no Firebase Console → **Authentication → Settings → Authorized domains** → **Add domain** → cole o domínio do GitHub Pages (ex: `seu-usuario.github.io`). Sem isso, o login falha em produção mesmo com tudo certo no código.
5. Abra a URL publicada — o navegador vai perguntar se quer instalar o app (ícone de instalação na barra de endereço ou opção no menu) — isso confirma que o PWA está funcionando.

Testando localmente antes de publicar: qualquer servidor estático serve. Ex:
```
python3 -m http.server 8000
```
e abra `http://localhost:8000`. Abrir o `index.html` direto por duplo-clique (`file://`) também funciona (foi resolvido durante o desenvolvimento), mas um servidor local é sempre mais próximo do ambiente real.

---

## 6. Regras de segurança

**Firestore** — nível básico (o que o projeto usa hoje: qualquer conta autenticada lê/escreve):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

**Storage** — mesma lógica:
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

Isso é seguro o suficiente para o modelo de uso do sistema (só quem tem uma conta criada pela Logística consegue entrar), mas é "tudo ou nada" entre contas autenticadas. Se no futuro quiser regras mais finas (ex: só a Logística pode cadastrar motoristas/veículos, um usuário não pode editar ST de outro), a versão abaixo é um ponto de partida — **opcional**, não obrigatório para o sistema funcionar:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() { return request.auth != null; }
    function myRole() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
    }
    function isLogistica() { return isSignedIn() && myRole() == 'logistica'; }

    match /users/{uid} {
      allow read: if isSignedIn();
      allow write: if isLogistica() || request.auth.uid == uid;
    }
    match /drivers/{id}  { allow read: if isSignedIn(); allow write: if isLogistica(); }
    match /vehicles/{id} { allow read: if isSignedIn(); allow write: if isLogistica(); }
    match /transport_requests/{id} { allow read, write: if isSignedIn(); }
    match /timeline/{id}       { allow read, write: if isSignedIn(); }
    match /notifications/{id}  { allow read, write: if isSignedIn(); }
    match /settings/{id}       { allow read, write: if isSignedIn(); }
  }
}
```

---

## 7. Coleções do Firestore

| Coleção | Conteúdo |
|---|---|
| `users` | Perfil de cada conta (uid = doc id): papel, nome, setor/telefone, login |
| `drivers` | Cadastro de motoristas (nome, telefone, CNH, veículo padrão, status, última localização) |
| `vehicles` | Cadastro de veículos (modelo, placa, capacidade, status) |
| `transport_requests` | As STs — doc id = número da ST (`ST000001`, `ST000002`...) |
| `timeline` | Histórico de cada ST (nunca é apagado) |
| `notifications` | Notificações por setor ou para a Logística |
| `settings` | Só o documento `st_counter`, usado para gerar a numeração sequencial das STs |

O Storage guarda os anexos das STs em `attachments/{numero_da_st}/...`.

---

## 8. Funcionalidades por área

- **Cadastros**: Usuários, Motoristas (com login automático + localização em tempo real), Veículos, visão consolidada por Setor
- **STs**: criação com numeração automática, múltiplos materiais, upload de fotos e PDF, edição posterior, reprogramação de data com histórico, campos obrigatórios validados
- **Motorista**: fila de STs, abrir rota no Google Maps, iniciar/finalizar, reagendar quando não consegue concluir, compartilhamento de localização enquanto em rota
- **Logística**: dashboard com alertas (urgentes + reagendamentos), planejamento de rotas com drag-and-drop e ordenação por prioridade, gerenciamento completo de qualquer ST (editar, excluir, reatribuir), relatórios com filtros e exportação PDF/Excel/CSV
- **Notificações**: setor é avisado quando a ST é programada ou finalizada; Logística é avisada quando uma ST é criada ou precisa ser reagendada

## 9. Limitações conhecidas

- **Exclusão de usuário/motorista** remove o acesso ao app, mas a conta de autenticação em si fica órfã no Firebase (apagar de verdade exigiria um backend com Admin SDK/Cloud Functions, fora do escopo de um projeto só-frontend).
- **Rastreamento do motorista** é a versão simples: última posição conhecida + link pro Google Maps, sem mapa ao vivo incorporado na tela (isso exigiria a Google Maps JavaScript API, uma chave paga separada da do Firebase).
- **Rastreamento só funciona com o app aberto na tela** — PWAs em navegador têm restrição de geolocalização em segundo plano, principalmente no iPhone.
- Sem servidor próprio: toda a lógica roda no navegador de quem está usando + Firebase. Isso é adequado para o uso interno de uma empresa, mas significa que não há processamento server-side nem jobs agendados.
