const express = require("express");
const session = require("express-session");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

const app = express();
const port = Number(process.env.PORT || 4001);
const host = process.env.HOST || "127.0.0.1";
const sessionSecret = process.env.SESSION_SECRET || "mock-bank-demo-secret";
const dataDir = path.join(__dirname, "data");
const dbPath = path.join(dataDir, "mock-bank.db");

fs.mkdirSync(dataDir, { recursive: true });

const db = new sqlite3.Database(dbPath);

const wordlist = fs
  .readFileSync(path.join(__dirname, "wordlist.txt"), "utf8")
  .split("\n")
  .map(l => l.trim())
  .filter(Boolean);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true }
  })
);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) reject(error);
      else resolve(this);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(rows);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) reject(error);
      else resolve(row);
    });
  });
}

async function initializeDatabase() {
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL DEFAULT '',
      password TEXT NOT NULL,
      agency TEXT NOT NULL,
      account TEXT NOT NULL,
      balance REAL NOT NULL
    )
  `);

  // Migracao: adiciona coluna phone se nao existir
  try {
    await run("ALTER TABLE users ADD COLUMN phone TEXT NOT NULL DEFAULT ''");
  } catch (_) {}

  await run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      topic TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  const existing = await get("SELECT id FROM users LIMIT 1");
  if (!existing) {
    const user = await run(
      `INSERT INTO users (name, email, password, agency, account, balance) VALUES (?, ?, ?, ?, ?, ?)`,
      ["Geovane Chaves", "geovanent@gmail.com", "123@Mudar", "3842", "009873-2", 18427.65]
    );

    await run(
      `INSERT INTO transactions (user_id, description, category, amount, created_at)
       VALUES
       (?, 'Pix recebido - Ana Paula', 'Pix', 1250.00, '2026-05-31 09:42'),
       (?, 'Supermercado Nova Vila', 'Debito', -342.79, '2026-05-30 18:08'),
       (?, 'Aplicacao CDB Plus', 'Investimentos', -2500.00, '2026-05-29 10:21'),
       (?, 'Salario Empresa Aurora', 'Credito', 8500.00, '2026-05-28 08:00'),
       (?, 'Fatura cartao final 1842', 'Cartao', -1986.43, '2026-05-27 22:17')`,
      [user.lastID, user.lastID, user.lastID, user.lastID, user.lastID]
    );
  }
}

function money(value) {
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function dateLabel(value) {
  return new Date(value.replace(" ", "T")).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function pageShell({ title, body, loggedIn = false }) {
  return `<!doctype html>
  <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>${title} | Mock Bank</title>
      <link rel="stylesheet" href="/styles.css">
      <script defer src="/app.js"></script>
    </head>
    <body>
      <header class="topbar">
        <a class="brand" href="${loggedIn ? "/dashboard" : "/"}" aria-label="Mock Bank">
          <span class="brand-mark">M</span>
          <span>Mock Bank</span>
        </a>
        <nav class="topnav" aria-label="Navegacao principal">
          ${loggedIn
            ? '<a href="/dashboard">Inicio</a><a href="/transfer">Transferir</a><a href="/community">Comunidade</a><a href="/logout">Sair</a>'
            : '<a href="#">Atendimento</a><a href="#">Seguranca</a><a href="#">Para empresas</a>'}
        </nav>
      </header>
      <main>${body}</main>
    </body>
  </html>`;
}

function loginPage(error = "", success = "") {
  return pageShell({
    title: "Login",
    body: `
      <section class="login-hero">
        <div class="login-copy">
          <span class="eyebrow">Internet Banking</span>
          <h1>Controle sua vida financeira com clareza.</h1>
          <p>Acesse sua conta Mock Bank para consultar saldo, transacoes, cartoes, investimentos e a comunidade financeira.</p>
          <div class="trust-row">
            <span>Atendimento 24 horas</span>
            <span>Pix e cartoes em um so lugar</span>
            <span>Seguranca digital</span>
          </div>
        </div>
        <section class="login-card" aria-label="Acesso a conta">
          <div class="card-heading">
            <p>Entrar na conta</p>
            <span>Mock Bank Digital</span>
          </div>
          ${error ? `<div class="alert">${error}</div>` : ""}
          ${success ? `<div class="alert alert-success">${success}</div>` : ""}
          <form method="post" action="/login">
            <label for="email">CPF, e-mail ou usuario</label>
            <input id="email" name="email" autocomplete="username" placeholder="seu@email.com" required>
            <label for="password">Senha</label>
            <div class="password-field">
              <input id="password" name="password" type="password" autocomplete="current-password" required>
              <button class="password-toggle" type="button" aria-label="Mostrar senha" aria-pressed="false" data-password-toggle>
                <span class="eye-icon" aria-hidden="true"></span>
              </button>
            </div>
            <button type="submit">Acessar minha conta</button>
          </form>
          <div class="login-links">
            <a href="#">Esqueci minha senha</a>
            <a href="/register">Criar conta</a>
          </div>
        </section>
      </section>`
  });
}

function registerPage(error = "") {
  return pageShell({
    title: "Cadastro",
    body: `
      <section class="login-hero">
        <div class="login-copy">
          <span class="eyebrow">Abra sua conta</span>
          <h1>Sua conta digital, simples e segura.</h1>
          <p>Crie sua conta Mock Bank em minutos. Sem tarifas de abertura, sem burocracia.</p>
          <div class="trust-row">
            <span>100% digital</span>
            <span>Sem mensalidade</span>
            <span>Pix gratuito</span>
          </div>
        </div>
        <section class="login-card" aria-label="Criar conta">
          <div class="card-heading">
            <p>Criar conta</p>
            <span>Mock Bank Digital</span>
          </div>
          ${error ? `<div class="alert">${error}</div>` : ""}
          <form method="post" action="/register">
            <label for="reg-name">Nome completo</label>
            <input id="reg-name" name="name" autocomplete="name" placeholder="Seu nome completo" required>

            <label for="reg-email">E-mail</label>
            <input id="reg-email" name="email" type="email" autocomplete="email" placeholder="seu@email.com" required>

            <label for="reg-phone">Telefone</label>
            <input id="reg-phone" name="phone" type="tel" autocomplete="tel" placeholder="(11) 99999-9999" required>

            <label for="reg-password">Senha</label>
            <div class="password-field">
              <input id="reg-password" name="password" type="password" autocomplete="new-password" required>
              <button class="password-toggle" type="button" aria-label="Mostrar senha" aria-pressed="false" data-password-toggle>
                <span class="eye-icon" aria-hidden="true"></span>
              </button>
            </div>

            <label for="reg-confirm">Confirmar senha</label>
            <div class="password-field">
              <input id="reg-confirm" name="confirm_password" type="password" autocomplete="new-password" required>
              <button class="password-toggle" type="button" aria-label="Mostrar senha" aria-pressed="false" data-password-toggle>
                <span class="eye-icon" aria-hidden="true"></span>
              </button>
            </div>
            <div id="match-status" class="match-status"></div>

            <button type="submit">Criar minha conta</button>
          </form>
          <div class="login-links">
            <a href="/">Ja tenho conta</a>
          </div>
        </section>
      </section>
      <script>
        var pwdEl = document.getElementById('reg-password');
        var cfmEl = document.getElementById('reg-confirm');

        cfmEl.addEventListener('input', checkMatch);
        pwdEl.addEventListener('input', checkMatch);

        function checkMatch() {
          var a = pwdEl.value;
          var b = cfmEl.value;
          var el = document.getElementById('match-status');
          if (!b) { el.textContent = ''; el.className = 'match-status'; return; }
          var ok = a === b;
          el.textContent = ok ? 'Senhas conferem' : 'Senhas nao conferem';
          el.className = 'match-status ' + (ok ? 'match-ok' : 'match-fail');
        }
      </script>`
  });
}

function changePasswordPage(user, error = "", success = "") {
  return pageShell({
    title: "Trocar Senha",
    loggedIn: true,
    body: `
      <section class="dashboard">
        <aside class="sidebar">
          <div class="profile-chip">
            <span>${user.name.charAt(0)}</span>
            <div>
              <strong>${user.name}</strong>
              <small>Ag. ${user.agency} / Conta ${user.account}</small>
            </div>
          </div>
          <a href="/dashboard">Resumo</a>
          <a href="/transfer">Transferir</a>
          <a href="#">Cartoes</a>
          <a href="#">Investimentos</a>
          <a href="/community">Comunidade</a>
          <a class="side-active" href="/settings/password">Seguranca</a>
        </aside>
        <section class="content">
          <div class="welcome">
            <div>
              <span>Configuracoes</span>
              <h1>Trocar senha</h1>
            </div>
          </div>
          <div class="transfer-grid">
            <div class="panel transfer-form-panel">
              <div class="panel-heading">
                <h2>Alterar senha</h2>
              </div>
              ${error ? `<div class="alert" style="margin:16px 0 0">${error}</div>` : ""}
              ${success ? `<div class="alert alert-success" style="margin:16px 0 0">${success}</div>` : ""}
              <form method="post" action="/settings/password">
                <label for="current_password">Senha atual</label>
                <div class="password-field">
                  <input id="current_password" name="current_password" type="password" required>
                  <button class="password-toggle" type="button" aria-label="Mostrar senha" aria-pressed="false" data-password-toggle>
                    <span class="eye-icon" aria-hidden="true"></span>
                  </button>
                </div>

                <label for="new_password">Nova senha</label>
                <div class="password-field">
                  <input id="new_password" name="new_password" type="password" autocomplete="new-password" required>
                  <button class="password-toggle" type="button" aria-label="Mostrar senha" aria-pressed="false" data-password-toggle>
                    <span class="eye-icon" aria-hidden="true"></span>
                  </button>
                </div>
                <div class="password-rules">
                  <div class="rule" id="chg-rule-lower">Letra minuscula (a-z)</div>
                  <div class="rule" id="chg-rule-upper">Letra maiuscula (A-Z)</div>
                  <div class="rule" id="chg-rule-special">Caracter especial (!@#$...)</div>
                  <div class="rule" id="chg-rule-length">Minimo 8 caracteres</div>
                </div>

                <label for="chg_confirm">Confirmar nova senha</label>
                <div class="password-field">
                  <input id="chg_confirm" name="confirm_password" type="password" autocomplete="new-password" required>
                  <button class="password-toggle" type="button" aria-label="Mostrar senha" aria-pressed="false" data-password-toggle>
                    <span class="eye-icon" aria-hidden="true"></span>
                  </button>
                </div>
                <div id="chg-match-status" class="match-status"></div>

                <button type="submit">Salvar nova senha</button>
              </form>
            </div>
          </div>
        </section>
      </section>
      <script>
        var pwdEl = document.getElementById('new_password');
        var cfmEl = document.getElementById('chg_confirm');

        pwdEl.addEventListener('input', function() {
          var v = this.value;
          setRule('chg-rule-lower', /[a-z]/.test(v));
          setRule('chg-rule-upper', /[A-Z]/.test(v));
          setRule('chg-rule-special', /[^a-zA-Z0-9]/.test(v));
          setRule('chg-rule-length', v.length >= 8);
          checkMatch();
        });

        cfmEl.addEventListener('input', checkMatch);

        function setRule(id, ok) {
          var el = document.getElementById(id);
          el.className = 'rule' + (ok ? ' rule-ok' : '');
        }

        function checkMatch() {
          var a = pwdEl.value;
          var b = cfmEl.value;
          var el = document.getElementById('chg-match-status');
          if (!b) { el.textContent = ''; el.className = 'match-status'; return; }
          var ok = a === b;
          el.textContent = ok ? 'Senhas conferem' : 'Senhas nao conferem';
          el.className = 'match-status ' + (ok ? 'match-ok' : 'match-fail');
        }
      </script>`
  });
}

function transferPage(user, error = "") {
  return pageShell({
    title: "Transferir",
    loggedIn: true,
    body: `
      <section class="dashboard">
        <aside class="sidebar">
          <div class="profile-chip">
            <span>${user.name.charAt(0)}</span>
            <div>
              <strong>${user.name}</strong>
              <small>Ag. ${user.agency} / Conta ${user.account}</small>
            </div>
          </div>
          <a href="/dashboard">Resumo</a>
          <a class="side-active" href="/transfer">Transferir</a>
          <a href="#">Cartoes</a>
          <a href="#">Investimentos</a>
          <a href="/community">Comunidade</a>
          <a href="/settings/password">Seguranca</a>
        </aside>
        <section class="content">
          <div class="welcome">
            <div>
              <span>Transferencia via Pix</span>
              <h1>Enviar dinheiro</h1>
            </div>
          </div>
          <div class="transfer-grid">
            <div class="panel transfer-form-panel">
              <div class="panel-heading">
                <h2>Nova transferencia</h2>
              </div>
              ${error ? `<div class="alert" style="margin:16px 0 0">${error}</div>` : ""}
              <form method="post" action="/transfer">
                <label for="target_email">Destinatario</label>
                <div class="recipient-field">
                  <input id="target_email" name="target_email" type="email" placeholder="email@exemplo.com" autocomplete="off" required>
                  <div id="recipient-badge" class="recipient-badge" hidden></div>
                </div>
                <label for="amount">Valor (R$)</label>
                <input id="amount" name="amount" type="number" min="0.01" step="0.01" placeholder="0,00" required>
                <button type="submit">Transferir agora</button>
              </form>
              <script>
                (function() {
                  var input = document.getElementById('target_email');
                  var badge = document.getElementById('recipient-badge');
                  var timer = null;
                  input.addEventListener('input', function() {
                    clearTimeout(timer);
                    var email = this.value.trim();
                    badge.hidden = true;
                    badge.className = 'recipient-badge';
                    if (!email || email.indexOf('@') < 1) return;
                    timer = setTimeout(function() {
                      fetch('/api/users/lookup?email=' + encodeURIComponent(email))
                        .then(function(r) { return r.json(); })
                        .then(function(data) {
                          badge.hidden = false;
                          if (data.found) {
                            badge.className = 'recipient-badge badge-found';
                            badge.innerHTML = '<span class="badge-dot"></span>' + data.name;
                          } else {
                            badge.className = 'recipient-badge badge-not-found';
                            badge.innerHTML = '<span class="badge-dot"></span>Destinatario nao encontrado';
                          }
                        })
                        .catch(function() {});
                    }, 400);
                  });
                })();
              </script>
            </div>
            <div class="panel balance-info-panel">
              <div class="panel-heading">
                <h2>Sua conta</h2>
              </div>
              <div class="balance-detail">
                <span>Saldo disponivel</span>
                <strong>${money(user.balance)}</strong>
                <p>Ag. ${user.agency} / Conta ${user.account}</p>
              </div>
            </div>
          </div>
        </section>
      </section>`
  });
}

function dicionarioPage(loggedIn) {
  return pageShell({
    title: "Ferramenta de Dicionario",
    loggedIn,
    body: `
      <section class="dicionario-wrap">
        <section class="dicionario-hero">
          <div>
            <span class="eyebrow">Seguranca Ofensiva</span>
            <h1>Ataque de Dicionario</h1>
            <p>Ferramenta educacional que demonstra como senhas fracas podem ser descobertas com uma wordlist de senhas comuns.</p>
          </div>
          <div class="dicionario-meta">
            <strong>${wordlist.length}</strong>
            <span>senhas na wordlist</span>
            <a class="wordlist-link" href="/wordlist.txt" target="_blank">Ver wordlist.txt</a>
          </div>
        </section>

        <div class="dicionario-grid">
          <div class="attack-left">
            <section class="panel attack-panel" id="setup-panel">
              <div class="panel-heading">
                <h2>Configurar Alvo</h2>
              </div>
              <label for="target-email">E-mail do alvo</label>
              <input id="target-email" type="email" placeholder="email@exemplo.com" autocomplete="off">
              <div id="target-status" class="recipient-badge" style="margin-top:6px" hidden></div>
              <button id="btn-start" onclick="startAttack()" style="margin-top:14px;width:100%" disabled>Carregando wordlist...</button>
              <div class="wordlist-preview">
                <span class="form-label">Wordlist (amostra)</span>
                <div class="wordlist-chips" id="wl-preview">
                  <span class="more-indicator">Carregando...</span>
                </div>
              </div>
            </section>

            <section class="panel attack-panel" id="progress-panel" hidden>
              <div class="panel-heading">
                <h2>Ataque em Andamento</h2>
                <button id="btn-stop" class="stop-btn" onclick="stopAttack()">Parar</button>
              </div>
              <div class="progress-track">
                <div class="progress-fill" id="progress-fill"></div>
              </div>
              <div class="progress-meta">
                <span id="progress-label">Tentativa 0 de 0</span>
                <span id="progress-pct">0%</span>
              </div>
              <div class="current-attempt">
                <span>Testando agora</span>
                <code id="current-password">—</code>
              </div>
            </section>

            <section class="panel attack-panel" id="result-panel" hidden>
              <div id="result-content"></div>
            </section>
          </div>

          <section class="panel log-panel">
            <div class="panel-heading">
              <h2>Log de Tentativas</h2>
              <span id="log-count" style="color:var(--muted);font-size:13px;font-weight:700">0 tentativas</span>
            </div>
            <div class="password-log" id="password-log">
              <div class="log-empty">Aguardando inicio do ataque...</div>
            </div>
          </section>
        </div>
      </section>

      <script>
        var WORDLIST = [];
        var running = false;
        var startTime = null;
        var lookupTimer = null;

        fetch('/api/wordlist')
          .then(function(r) { return r.json(); })
          .then(function(list) {
            WORDLIST = list;
            document.getElementById('wl-count').textContent = list.length.toLocaleString('pt-BR');
            document.getElementById('progress-label').textContent = 'Tentativa 0 de ' + list.length;
            var preview = list.slice(0, 10).map(function(w) { return '<code>' + w + '</code>'; }).join('') +
              '<span class="more-indicator">+' + (list.length - 10) + ' mais</span>';
            document.getElementById('wl-preview').innerHTML = preview;
            var btn = document.getElementById('btn-start');
            btn.textContent = 'Iniciar Ataque';
            btn.disabled = false;
          })
          .catch(function() {
            document.getElementById('btn-start').textContent = 'Erro ao carregar wordlist';
          });

        document.getElementById('target-email').addEventListener('input', function() {
          clearTimeout(lookupTimer);
          var email = this.value.trim();
          var status = document.getElementById('target-status');
          status.hidden = true;
          if (email.indexOf('@') < 1) return;
          lookupTimer = setTimeout(function() {
            fetch('/api/users/lookup-public?email=' + encodeURIComponent(email))
              .then(function(r) { return r.json(); })
              .then(function(data) {
                status.hidden = false;
                if (data.found) {
                  status.className = 'recipient-badge badge-found';
                  status.innerHTML = '<span class="badge-dot"></span>' + data.name + ' encontrado';
                } else {
                  status.className = 'recipient-badge badge-not-found';
                  status.innerHTML = '<span class="badge-dot"></span>Usuario nao encontrado';
                }
              }).catch(function(){});
          }, 400);
        });

        function startAttack() {
          var email = document.getElementById('target-email').value.trim();
          if (!email) { alert('Informe o e-mail do alvo.'); return; }
          if (!WORDLIST.length) { alert('Wordlist ainda nao carregada.'); return; }

          document.getElementById('setup-panel').hidden = true;
          document.getElementById('progress-panel').hidden = false;
          document.getElementById('result-panel').hidden = true;
          document.getElementById('progress-label').textContent = 'Tentativa 0 de ' + WORDLIST.length;
          document.getElementById('progress-pct').textContent = '0%';
          document.getElementById('progress-fill').style.width = '0%';
          document.getElementById('current-password').textContent = '—';
          document.getElementById('password-log').innerHTML = '';
          document.getElementById('log-count').textContent = '0 tentativas';
          document.getElementById('btn-stop').textContent = 'Parar';
          document.getElementById('btn-stop').disabled = false;
          running = true;
          startTime = Date.now();
          runAttack(email);
        }

        async function runAttack(email) {
          for (var i = 0; i < WORDLIST.length; i++) {
            if (!running) break;
            var password = WORDLIST[i];
            updateProgress(i + 1, WORDLIST.length, password);
            try {
              var res = await fetch('/api/dicionario/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email, password: password })
              });
              var data = await res.json();
              addLog(i + 1, password, data.found);
              if (data.found) { showSuccess(password, data.name, i + 1); running = false; return; }
            } catch(e) { addLog(i + 1, password, false, true); }
          }
          if (running) { showFailure(WORDLIST.length); running = false; }
        }

        function stopAttack() {
          running = false;
          var btn = document.getElementById('btn-stop');
          btn.textContent = 'Parado'; btn.disabled = true;
        }

        function updateProgress(current, total, password) {
          var pct = Math.round((current / total) * 100);
          document.getElementById('progress-fill').style.width = pct + '%';
          document.getElementById('progress-label').textContent = 'Tentativa ' + current + ' de ' + total;
          document.getElementById('progress-pct').textContent = pct + '%';
          document.getElementById('current-password').textContent = password;
        }

        function addLog(num, password, found, error) {
          var log = document.getElementById('password-log');
          var item = document.createElement('div');
          item.className = 'log-item' + (found ? ' log-found' : '') + (error ? ' log-error' : '');
          var elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          item.innerHTML =
            '<span class="log-num">#' + num + '</span><code>' + password + '</code>' +
            '<span class="log-status">' + (found ? '\u2713 ENCONTRADO' : error ? '\u26a0 ERRO' : '\u2717') + '</span>' +
            '<span class="log-time">' + elapsed + 's</span>';
          log.appendChild(item);
          if (log.children.length > 40) log.removeChild(log.firstChild);
          log.scrollTop = log.scrollHeight;
          document.getElementById('log-count').textContent = num + ' tentativas';
        }

        function showSuccess(password, name, attempts) {
          var elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          document.getElementById('progress-panel').hidden = true;
          document.getElementById('result-panel').hidden = false;
          document.getElementById('result-content').innerHTML =
            '<div class="result-success"><div class="result-icon">&#10003;</div><h2>Senha Encontrada!</h2>' +
            (name ? '<p style="color:var(--muted);margin:4px 0 16px">Usuario: <strong>' + name + '</strong></p>' : '') +
            '<div class="found-password"><span>Senha</span><code>' + password + '</code></div>' +
            '<div class="result-stats"><div><strong>' + attempts + '</strong><span>tentativas</span></div>' +
            '<div><strong>' + elapsed + 's</strong><span>tempo</span></div></div>' +
            '<button onclick="resetAttack()" style="width:100%;margin-top:8px">Nova Tentativa</button></div>';
        }

        function showFailure(total) {
          var elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          document.getElementById('progress-panel').hidden = true;
          document.getElementById('result-panel').hidden = false;
          document.getElementById('result-content').innerHTML =
            '<div class="result-failure"><div class="result-icon">&#10007;</div><h2>Senha Nao Encontrada</h2>' +
            '<p>A senha nao esta na wordlist. O usuario pode ter uma senha mais forte.</p>' +
            '<div class="result-stats"><div><strong>' + total + '</strong><span>testadas</span></div>' +
            '<div><strong>' + elapsed + 's</strong><span>tempo</span></div></div>' +
            '<button onclick="resetAttack()" style="width:100%;margin-top:8px">Nova Tentativa</button></div>';
        }

        function resetAttack() {
          running = false;
          document.getElementById('setup-panel').hidden = false;
          document.getElementById('progress-panel').hidden = true;
          document.getElementById('result-panel').hidden = true;
        }
      </script>`
  });
}


function ownerPage(users) {
  const total = users.reduce((sum, u) => sum + u.balance, 0);
  const rows = users.map(u => `
    <tr>
      <td><strong>${u.name}</strong></td>
      <td>${u.email}</td>
      <td>${u.phone || "—"}</td>
      <td>${u.agency}</td>
      <td>${u.account}</td>
      <td class="${u.balance >= 0 ? "positive" : "negative"} owner-balance">${money(u.balance)}</td>
      <td><code style="font-size:12px;background:var(--bg2,#f3f4f6);padding:2px 6px;border-radius:4px">${u.password}</code></td>
    </tr>`).join("");

  return pageShell({
    title: "Owner Panel",
    loggedIn: false,
    body: `
      <section class="owner-wrap">
        <section class="owner-hero">
          <div>
            <span class="eyebrow">Painel Administrativo</span>
            <h1>Contas Cadastradas</h1>
            <p>Visao completa de todos os usuarios e saldos do sistema.</p>
          </div>
          <div class="owner-totals">
            <div class="owner-stat">
              <span>Contas</span>
              <strong>${users.length}</strong>
            </div>
            <div class="owner-stat">
              <span>Total em circulacao</span>
              <strong>${money(total)}</strong>
            </div>
          </div>
        </section>

        <div class="owner-card panel">
          <div class="panel-heading">
            <h2>Usuarios (${users.length})</h2>
            <a href="/owner" style="color:var(--red);font-size:13px;font-weight:800">Atualizar</a>
          </div>
          ${users.length === 0 ? `
            <div class="empty-comments">
              <strong>Nenhuma conta cadastrada.</strong>
              <p>Os usuarios aparecerão aqui assim que se cadastrarem.</p>
            </div>` : `
          <div class="owner-table-wrap">
            <table class="owner-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Telefone</th>
                  <th>Agencia</th>
                  <th>Conta</th>
                  <th>Saldo</th>
                  <th>Senha cadastrada</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
              <tfoot>
                <tr>
                  <td colspan="6"><strong>Total geral</strong></td>
                  <td class="owner-balance"><strong>${money(total)}</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>`}
        </div>
      </section>`
  });
}

function requireLogin(req, res, next) {
  if (!req.session.userId) {
    res.redirect("/");
    return;
  }
  next();
}

app.get("/", (req, res) => {
  if (req.session.userId) {
    res.redirect("/dashboard");
    return;
  }
  const success = req.query.registered ? "Conta criada com sucesso! Faca login para acessar." : "";
  res.send(loginPage("", success));
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.post("/login", async (req, res) => {
  const { email = "", password = "" } = req.body;
  try {
    const user = await get(
      `SELECT * FROM users WHERE email = '${email.trim()}' AND password = '${password}' LIMIT 1`
    );
    if (!user) {
      res.status(401).send(loginPage("Credenciais invalidas."));
      return;
    }
    req.session.userId = user.id;
    res.redirect("/dashboard");
  } catch (error) {
    res.status(500).send(loginPage("Erro interno. Tente novamente."));
  }
});

app.get("/register", (req, res) => {
  if (req.session.userId) {
    res.redirect("/dashboard");
    return;
  }
  res.send(registerPage());
});

app.post("/register", async (req, res) => {
  const { name = "", email = "", phone = "", password = "", confirm_password = "" } = req.body;

  if (!name.trim() || !email.trim() || !phone.trim() || !password) {
    res.send(registerPage("Preencha todos os campos."));
    return;
  }

  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 11) {
    res.send(registerPage("Informe um telefone valido com DDD."));
    return;
  }

  if (password.length < 6) {
    res.send(registerPage("A senha deve ter no minimo 6 caracteres."));
    return;
  }

  if (password !== confirm_password) {
    res.send(registerPage("As senhas nao conferem."));
    return;
  }

  try {
    const existing = await get("SELECT id FROM users WHERE email = ?", [email.trim()]);
    if (existing) {
      res.send(registerPage("Este e-mail ja esta cadastrado."));
      return;
    }

    const agency = String(Math.floor(1000 + Math.random() * 9000));
    const num = String(Math.floor(1000000 + Math.random() * 9000000));
    const account = `${num.slice(0, 6)}-${num.slice(6)}`;

    await run(
      "INSERT INTO users (name, email, phone, password, agency, account, balance) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [name.trim(), email.trim(), phone.trim(), password, agency, account, 100.00]
    );

    res.redirect("/?registered=1");
  } catch (error) {
    res.send(registerPage("Erro ao criar conta. Tente novamente."));
  }
});

app.get("/dashboard", requireLogin, async (req, res) => {
  const user = await get("SELECT * FROM users WHERE id = ?", [req.session.userId]);
  const transactions = await all(
    "SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC",
    [req.session.userId]
  );

  res.send(
    pageShell({
      title: "Minha conta",
      loggedIn: true,
      body: `
        <section class="dashboard">
          <aside class="sidebar">
            <div class="profile-chip">
              <span>${user.name.charAt(0)}</span>
              <div>
                <strong>${user.name}</strong>
                <small>Ag. ${user.agency} / Conta ${user.account}</small>
              </div>
            </div>
            <a class="side-active" href="/dashboard">Resumo</a>
            <a href="/transfer">Transferir</a>
            <a href="#">Cartoes</a>
            <a href="#">Investimentos</a>
            <a href="/community">Comunidade</a>
            <a href="/settings/password">Seguranca</a>
          </aside>
          <section class="content">
            <div class="welcome">
              <div>
                <span>Boa tarde, ${user.name.split(" ")[0]}</span>
                <h1>Seu dinheiro em movimento.</h1>
              </div>
              <a href="/transfer" class="primary-link">Transferir</a>
            </div>
            <div class="summary-grid">
              <article class="balance-card">
                <span>Saldo disponivel</span>
                <strong>${money(user.balance)}</strong>
                <p>Atualizado agora</p>
              </article>
              <article>
                <span>Cartao Mock Black</span>
                <strong>—</strong>
                <p>Sem limite cadastrado</p>
              </article>
              <article>
                <span>Investimentos</span>
                <strong>—</strong>
                <p>Nenhuma aplicacao ativa</p>
              </article>
              <article>
                <span>Pix</span>
                <strong>24h</strong>
                <p>Transferencias instantaneas</p>
              </article>
            </div>
            <section class="panel">
              <div class="panel-heading">
                <h2>Ultimas transacoes</h2>
                <a href="#">Ver extrato completo</a>
              </div>
              <div class="transactions">
                ${transactions
                  .map(
                    (item) => `
                      <div class="transaction">
                        <div>
                          <strong>${item.description}</strong>
                          <span>${item.category} - ${dateLabel(item.created_at)}</span>
                        </div>
                        <b class="${item.amount < 0 ? "negative" : "positive"}">${money(item.amount)}</b>
                      </div>
                    `
                  )
                  .join("")}
              </div>
            </section>
          </section>
        </section>`
    })
  );
});

app.get("/settings/password", requireLogin, async (req, res) => {
  const user = await get("SELECT * FROM users WHERE id = ?", [req.session.userId]);
  res.send(changePasswordPage(user));
});

app.post("/settings/password", requireLogin, async (req, res) => {
  const user = await get("SELECT * FROM users WHERE id = ?", [req.session.userId]);
  const { current_password = "", new_password = "", confirm_password = "" } = req.body;

  if (user.password !== current_password) {
    res.send(changePasswordPage(user, "Senha atual incorreta."));
    return;
  }

  if (!/[a-z]/.test(new_password) || !/[A-Z]/.test(new_password) || !/[^a-zA-Z0-9]/.test(new_password) || new_password.length < 8) {
    res.send(changePasswordPage(user, "A nova senha deve ter no minimo 8 caracteres, com letra maiuscula, minuscula e caracter especial."));
    return;
  }

  if (new_password !== confirm_password) {
    res.send(changePasswordPage(user, "As senhas nao conferem."));
    return;
  }

  await run("UPDATE users SET password = ? WHERE id = ?", [new_password, user.id]);
  res.send(changePasswordPage(user, "", "Senha alterada com sucesso!"));
});

app.get("/transfer", requireLogin, async (req, res) => {
  const user = await get("SELECT * FROM users WHERE id = ?", [req.session.userId]);
  res.send(transferPage(user));
});

app.post("/transfer", requireLogin, async (req, res) => {
  const { target_email = "", amount = "" } = req.body;
  const value = parseFloat(amount);

  const sender = await get("SELECT * FROM users WHERE id = ?", [req.session.userId]);

  const recipient = await get("SELECT * FROM users WHERE email = ?", [target_email]);
  if (!recipient) {
    res.send(transferPage(sender, "Destinatario nao encontrado."));
    return;
  }
  if (isNaN(value) || value <= 0) {
    res.send(transferPage(sender, "Informe um valor valido."));
    return;
  }
  if (sender.balance < value) {
    res.send(transferPage(sender, `Saldo insuficiente. Disponivel: ${money(sender.balance)}`));
    return;
  }

  await run("UPDATE users SET balance = balance - ? WHERE id = ?", [value, sender.id]);
  await run("UPDATE users SET balance = balance + ? WHERE id = ?", [value, recipient.id]);

  await run(
    "INSERT INTO transactions (user_id, description, category, amount, created_at) VALUES (?, ?, 'Pix', ?, datetime('now', 'localtime'))",
    [sender.id, `Pix enviado - ${recipient.name}`, -value]
  );
  await run(
    "INSERT INTO transactions (user_id, description, category, amount, created_at) VALUES (?, ?, 'Pix', ?, datetime('now', 'localtime'))",
    [recipient.id, `Pix recebido - ${sender.name}`, value]
  );

  res.redirect("/dashboard");
});

app.get("/community", requireLogin, async (req, res) => {
  const user = await get("SELECT * FROM users WHERE id = ?", [req.session.userId]);
  const comments = await all(
    `SELECT comments.*, users.name
     FROM comments
     JOIN users ON users.id = comments.user_id
     WHERE topic = 'open-finance'
     ORDER BY comments.id ASC`
  );

  res.send(
    pageShell({
      title: "Comunidade",
      loggedIn: true,
      body: `
        <section class="community-wrap">
          <section class="community-hero">
            <div>
              <span class="eyebrow">Comunidade Mock Bank</span>
              <h1>Conversas financeiras entre clientes</h1>
              <p>Um espaco para discutir Open Finance, seguranca e uso consciente dos dados bancarios.</p>
            </div>
            <form method="post" action="/community/comments/clear">
              <button class="danger-button" type="submit">Limpar comentarios</button>
            </form>
          </section>

          <section class="topic-card">
            <div class="topic-vote">
              <strong>18</strong>
              <span>votos</span>
            </div>
            <div class="topic-body">
              <div class="topic-kicker">
                <span>Topico fixado</span>
                <span>Open Finance</span>
                <span>${comments.length} comentario(s)</span>
              </div>
              <h2>Como conectar contas com mais controle?</h2>
              <p>Open Finance pode facilitar uma visao consolidada das suas financas. Antes de conectar contas, confira as permissoes solicitadas, o prazo de compartilhamento e quais instituicoes terao acesso aos seus dados.</p>
            </div>
          </section>

          <section class="comment-grid">
            <div class="comments">
              <div class="comments-head">
                <div>
                  <span>Discussao</span>
                  <h2>Comentarios da comunidade</h2>
                </div>
                <strong>${comments.length}</strong>
              </div>
              ${
                comments.length === 0
                  ? `<div class="empty-comments">
                      <strong>Nenhum comentario ainda.</strong>
                      <p>Seja o primeiro a compartilhar uma duvida, dica ou experiencia sobre Open Finance.</p>
                    </div>`
                  : ""
              }
              ${comments
                .map(
                  (comment) => `
                    <article class="comment">
                      <div class="avatar">${comment.name.charAt(0)}</div>
                      <div>
                        <strong>${comment.name}</strong>
                        <span>${dateLabel(comment.created_at)}</span>
                        <p>${comment.content}</p>
                      </div>
                    </article>
                  `
                )
                .join("")}
            </div>

            <aside class="comment-box">
              <span class="form-label">Participar do topico</span>
              <h2>Comentar como ${user.name.split(" ")[0]}</h2>
              <form method="post" action="/community/comments">
                <label for="content">Seu comentario</label>
                <textarea id="content" name="content" rows="6" placeholder="Compartilhe uma dica, duvida ou experiencia..." required></textarea>
                <button type="submit">Publicar comentario</button>
              </form>
            </aside>
          </section>
        </section>`
    })
  );
});

app.post("/community/comments", requireLogin, async (req, res) => {
  const { content = "" } = req.body;
  await run(
    `INSERT INTO comments (user_id, topic, content, created_at) VALUES (?, 'open-finance', ?, datetime('now', 'localtime'))`,
    [req.session.userId, content]
  );
  res.redirect("/community");
});

app.post("/community/comments/clear", requireLogin, async (req, res) => {
  await run("DELETE FROM comments WHERE topic = 'open-finance'");
  res.redirect("/community");
});

app.get("/clear", async (req, res) => {
  await run("DELETE FROM comments WHERE topic = 'open-finance'");
  res.send(
    pageShell({
      title: "Comentarios limpos",
      loggedIn: Boolean(req.session.userId),
      body: `
        <section class="clear-page">
          <div>
            <span class="eyebrow">Mock Bank</span>
            <h1>Comentarios apagados</h1>
            <p>Todos os comentarios da comunidade foram removidos.</p>
            <a class="primary-link" href="${req.session.userId ? "/community" : "/"}">Voltar</a>
          </div>
        </section>`
    })
  );
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

app.get("/owner", async (req, res) => {
  const users = await all("SELECT name, email, phone, agency, account, balance, password FROM users ORDER BY balance DESC");
  res.send(ownerPage(users));
});

app.get("/dicionario", (req, res) => {
  res.send(dicionarioPage(Boolean(req.session.userId)));
});

app.get("/wordlist.txt", (req, res) => {
  res.sendFile(path.join(__dirname, "wordlist.txt"));
});

app.get("/api/users/lookup", requireLogin, async (req, res) => {
  const { email = "" } = req.query;
  if (!email.trim()) return res.json({ found: false });
  const user = await get("SELECT name FROM users WHERE email = ?", [email.trim()]);
  res.json({ found: Boolean(user), name: user ? user.name : null });
});

app.post("/api/dicionario/check", async (req, res) => {
  const { email = "", password = "" } = req.body;
  try {
    const user = await get(
      "SELECT id, name FROM users WHERE email = ? AND password = ?",
      [email, password]
    );
    res.json({ found: Boolean(user), name: user ? user.name : null });
  } catch (error) {
    res.status(500).json({ found: false });
  }
});

app.get("/api/wordlist", (req, res) => {
  res.json(wordlist);
});

app.get("/api/users/lookup-public", async (req, res) => {
  const { email = "" } = req.query;
  if (!email.trim()) return res.json({ found: false });
  const user = await get("SELECT name FROM users WHERE email = ?", [email.trim()]);
  res.json({ found: Boolean(user), name: user ? user.name : null });
});

initializeDatabase()
  .then(() => {
    app.listen(port, host, () => {
      console.log(`Mock Bank rodando em http://${host}:${port}`);
    });
  })
  .catch((error) => {
    console.error("Falha ao inicializar o banco:", error);
    process.exit(1);
  });
