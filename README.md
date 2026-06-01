# Mock Bank Vulnerable Demo

Aplicacao local e intencionalmente vulneravel para demonstracoes de seguranca da informacao.

## Aviso

Este projeto contem falhas de seguranca de proposito:

- SQL Injection no login.
- XSS armazenado na comunidade.

Use somente em ambiente local, para fins educacionais. Nao publique esta aplicacao na internet e nao insira dados reais.

## Como rodar

```bash
npm install
npm run dev
```

Abra:

```text
http://127.0.0.1:3000
```

## Credenciais demo

```text
Usuario: cliente@mockbank.test
Senha: senha123
```

## SQL Injection

Na tela de login, use:

```text
Usuario: ' OR 1=1 --
Senha: qualquer valor
```

## XSS armazenado

Depois do login, acesse **Comunidade** e publique um comentario como:

```html
<img src=x onerror=alert('XSS')>
```

O comentario e salvo no SQLite e renderizado sem sanitizacao para demonstrar a vulnerabilidade.

Use o botao **Limpar comentarios** na propria comunidade para apagar os testes e repetir a demonstracao.

Se um payload XSS impedir o uso da tela, acesse diretamente:

```text
http://127.0.0.1:3000/clear
```

## Observacoes visuais

O visual usa vermelho, branco e cinzas claros para lembrar experiencias modernas de internet banking. O banco ficticio se chama **Mock Bank** e nao utiliza logotipos, nomes oficiais ou ativos de bancos reais.
