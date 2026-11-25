# YaRooms + YaRoomy (Groq)

Projeto Flask/PostgreSQL integrado ao novo front-end. Preserve o banco e o `.env` da instalação anterior. Faça backup antes de atualizar. As novas tabelas `yarooms_rooms` e `yarooms_bookings` são criadas por `init_db`, sem apagar `usuarios`. Dados que existiam apenas na memória do navegador não podem ser migrados automaticamente.

## Configuração

1. Crie uma chave em https://console.groq.com/keys. Verifique modelos em https://console.groq.com/docs/models.
2. Copie `.env.example` para `.env` **somente se não existir**. Preencha os dados PostgreSQL existentes, SECRET_KEY (aleatória e privada), GROQ_API_KEY e GROQ_MODEL. O padrão é `openai/gpt-oss-20b`; a disponibilidade depende da conta. Não envie a chave ao navegador nem ao Git.
3. `python3 -m venv .venv` e `.venv/bin/pip install -r requirements.txt`.
4. `.venv/bin/gunicorn --workers 2 --bind 127.0.0.1:5000 wsgi:application` (ajuste a porta à instalação; se houver serviço systemd, reinicie o serviço existente em vez de iniciar outro).
5. Abra `http://localhost:5000/` se o navegador estiver na máquina e a porta estiver acessível, ou a URL do Apache, por exemplo `http://sidroniads.local/yarooms/`. A barra final é necessária. O ProxyPass deve remover o prefixo `/yarooms/` e encaminhar todas as rotas ao Flask.

Exemplo de configuração Apache dentro do VirtualHost existente (não duplique regras; ajuste porta):

```apache
RedirectMatch 302 ^/yarooms$ /yarooms/
ProxyPass /yarooms/ http://127.0.0.1:5000/
ProxyPassReverse /yarooms/ http://127.0.0.1:5000/
ProxyPassReverseCookiePath / /yarooms/
```

Verifique `sudo apache2ctl configtest` antes de `sudo systemctl reload apache2`.

## Como funciona

`static/script-1.js` conecta login, cadastro, logout, salas e reservas à API. `static/script-2.js` envia perguntas livres para `POST /api/chat`; atalhos e contingência usam ajuda local. `chatbot.py` contém o prompt e chama Groq via HTTPS. A chave fica no servidor. O histórico recente é enviado à Groq; não digite dados pessoais, senhas ou chaves no chat. A IA não consulta o banco nem executa ações. `schedule.py` valida permissões, horários e conflitos no PostgreSQL. Atualize a página para refletir alterações feitas por outros usuários.

Teste rápido no servidor:

```sh
curl -s http://127.0.0.1:5000/api/chat -H 'Content-Type: application/json' -d '{"message":"Como faço uma reserva?"}'
```

Resposta esperada: JSON com `ok: true` e `reply`. Se a Groq não estiver disponível, o site usa ajuda local. O limite do chat é 10/min e 100/dia por IP por processo; em produção com múltiplos workers, configure armazenamento compartilhado e política de IP adequada ao proxy. Atrás do Apache, sem configuração de IP confiável, os acessos podem compartilhar o mesmo limite.

Cadastro público de diretor bloqueado por padrão; contas existentes continuam funcionando. Para criar uma conta de diretor nova, habilite `ALLOW_DIRECTOR_REGISTRATION=true` somente em ambiente restrito, faça cadastro e desabilite novamente. Não exponha essa opção publicamente. Recuperação de senha não implementada no backend original: requer SMTP e tokens de uso único; o front informa indisponibilidade. Datas letivas específicas de 2026 foram preservadas do arquivo recebido e devem ser revisadas pela escola. Testes de sintaxe realizados; integração real depende de PostgreSQL, dependências, credenciais, API e configuração Apache.
