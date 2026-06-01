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

app.use(express.urlencoded({ extended: true }));
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
  await run("DROP TABLE IF EXISTS comments");
  await run("DROP TABLE IF EXISTS transactions");
  await run("DROP TABLE IF EXISTS users");

  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      agency TEXT NOT NULL,
      account TEXT NOT NULL,
      balance REAL NOT NULL
    )
  `);

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

  const user = await run(
    `
      INSERT INTO users (name, email, password, agency, account, balance)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      "Geovane Chaves",
      "geovanent@gmail.com",
      "123@Mudar",
      "3842",
      "009873-2",
      18427.65
    ]
  );

  await run(
    `
      INSERT INTO transactions (user_id, description, category, amount, created_at)
      VALUES
      (?, 'Pix recebido - Ana Paula', 'Pix', 1250.00, '2026-05-31 09:42'),
      (?, 'Supermercado Nova Vila', 'Debito', -342.79, '2026-05-30 18:08'),
      (?, 'Aplicacao CDB Plus', 'Investimentos', -2500.00, '2026-05-29 10:21'),
      (?, 'Salario Empresa Aurora', 'Credito', 8500.00, '2026-05-28 08:00'),
      (?, 'Fatura cartao final 1842', 'Cartao', -1986.43, '2026-05-27 22:17')
    `,
    [user.lastID, user.lastID, user.lastID, user.lastID, user.lastID]
  );
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
          ${loggedIn ? '<a href="/dashboard">Inicio</a><a href="/community">Comunidade</a><a href="/logout">Sair</a>' : '<a href="#">Atendimento</a><a href="#">Seguranca</a><a href="#">Para empresas</a>'}
        </nav>
      </header>
      <main>${body}</main>
    </body>
  </html>`;
}

function loginPage(error = "", debugSql = "") {
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
            <form method="post" action="/login">
            <label for="email">CPF, e-mail ou usuario</label>
            <input id="email" name="email" autocomplete="username" placeholder="geovanent@gmail.com" required>
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
            <a href="#">Cadastrar dispositivo</a>
          </div>
          <div class="demo-note">
            SQL Injection: <code>' OR 1=1 --</code>
          </div>
          ${debugSql ? `<pre class="sql-preview">${debugSql}</pre>` : ""}
        </section>
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
  res.send(loginPage());
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.post("/login", async (req, res) => {
  const { email = "", password = "" } = req.body;

  // Vulnerabilidade intencional para demonstracao: entrada do usuario interpolada diretamente na query.
  const vulnerableSql = `SELECT * FROM users WHERE email = '${email}' AND password = '${password}' LIMIT 1`;

  try {
    const user = await get(vulnerableSql);
    if (!user) {
      res.status(401).send(loginPage("Credenciais invalidas.", vulnerableSql));
      return;
    }

    req.session.userId = user.id;
    res.redirect("/dashboard");
  } catch (error) {
    res.status(500).send(loginPage(`Erro SQL: ${error.message}`, vulnerableSql));
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
            <a href="#">Pix</a>
            <a href="#">Cartoes</a>
            <a href="#">Investimentos</a>
            <a href="/community">Comunidade</a>
          </aside>
          <section class="content">
            <div class="welcome">
              <div>
                <span>Boa tarde, ${user.name.split(" ")[0]}</span>
                <h1>Seu dinheiro em movimento.</h1>
              </div>
              <button>Transferir</button>
            </div>
            <div class="summary-grid">
              <article class="balance-card">
                <span>Saldo disponivel</span>
                <strong>${money(user.balance)}</strong>
                <p>Atualizado agora</p>
              </article>
              <article>
                <span>Cartao Mock Black</span>
                <strong>${money(4312.88)}</strong>
                <p>Limite disponivel</p>
              </article>
              <article>
                <span>Investimentos</span>
                <strong>${money(52740.12)}</strong>
                <p>Rendimento +0,82% no mes</p>
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

app.get("/community", requireLogin, async (req, res) => {
  const user = await get("SELECT * FROM users WHERE id = ?", [req.session.userId]);
  const comments = await all(
    `
      SELECT comments.*, users.name
      FROM comments
      JOIN users ON users.id = comments.user_id
      WHERE topic = 'open-finance'
      ORDER BY comments.id ASC
    `
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
    `
      INSERT INTO comments (user_id, topic, content, created_at)
      VALUES (?, 'open-finance', ?, datetime('now', 'localtime'))
    `,
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

initializeDatabase()
  .then(() => {
    app.listen(port, host, () => {
      console.log(`Mock Bank rodando em http://${host}:${port}`);
      console.log("Demo SQLi: usuario = ' OR 1=1 -- | senha = qualquer valor");
      console.log("Demo XSS: <img src=x onerror=alert('XSS')>");
    });
  })
  .catch((error) => {
    console.error("Falha ao inicializar o banco:", error);
    process.exit(1);
  });
