"""
YaRooms — backend Flask
Migrado de PHP/PDO + sessões para Python/Flask + psycopg2.

Rotas da API (espelham os antigos arquivos PHP):
  POST /api/login      → autentica e cria sessão
  POST /api/logout     → destrói a sessão
  GET  /api/me         → devolve usuário logado (restaura sessão no F5)
  POST /api/registrar  → cria novo usuário

O front (index.html + yaruims.css + yaruims.js) é servido como estático.
"""

import os
import re
import psycopg2
import psycopg2.extras
from functools import wraps
from flask import (
    Flask, request, jsonify, session,
    send_from_directory, abort
)
from werkzeug.security import generate_password_hash, check_password_hash

# ──────────────────────────────────────────────
# Configuração
# ──────────────────────────────────────────────
app = Flask(__name__, static_folder="static")

app.secret_key = os.environ.get("SECRET_KEY", "troque-em-producao")

DB_CONFIG = {
    "host":     os.environ.get("DB_HOST", "localhost"),
    "port":     int(os.environ.get("DB_PORT", 5432)),
    "dbname":   os.environ.get("DB_NAME", "sistema"),
    "user":     os.environ.get("DB_USER", "sistema_user"),
    "password": os.environ.get("DB_PASS", "troque_esta_senha"),
}

TIPOS_VALIDOS = {"Professor(a)", "Coordenador(a)", "Diretor(a)", "Outros"}


# ──────────────────────────────────────────────
# Banco de dados
# ──────────────────────────────────────────────
def get_db():
    """Abre uma conexão nova a cada requisição (simples e seguro para poucos usuários)."""
    conn = psycopg2.connect(**DB_CONFIG, cursor_factory=psycopg2.extras.RealDictCursor)
    return conn


def init_db():
    """Cria/migra a tabela de usuários na inicialização do servidor."""
    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS usuarios (
                    id    SERIAL PRIMARY KEY,
                    nome  VARCHAR(120) NOT NULL,
                    email VARCHAR(150),
                    senha VARCHAR(255) NOT NULL,
                    tipo  VARCHAR(30)  NOT NULL
                )
            """)
            # Migrações suaves (idempotentes)
            cur.execute("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email VARCHAR(150)")
            cur.execute("ALTER TABLE usuarios ALTER COLUMN nome TYPE VARCHAR(120)")
            cur.execute("ALTER TABLE usuarios ALTER COLUMN tipo TYPE VARCHAR(30)")
            cur.execute("ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_nome_key")
            cur.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS usuarios_email_unique
                ON usuarios (lower(email))
            """)
        conn.commit()


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────
def ok(extra: dict = None):
    payload = {"ok": True}
    if extra:
        payload.update(extra)
    return jsonify(payload)


def erro(mensagem: str, status: int = 400):
    return jsonify({"ok": False, "erro": mensagem}), status


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if "usuario_id" not in session:
            return erro("Não autenticado.", 401)
        return f(*args, **kwargs)
    return decorated


# ──────────────────────────────────────────────
# Servir o front-end
# ──────────────────────────────────────────────
@app.route("/")
def index():
    return send_from_directory("static", "index.html")


@app.route("/<path:filename>")
def static_files(filename):
    response = send_from_directory("static", filename)
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

# ──────────────────────────────────────────────
# API — autenticação
# ──────────────────────────────────────────────
@app.route("/api/login", methods=["POST"])
def api_login():
    dados = request.get_json(silent=True) or {}
    email = dados.get("email", "").strip().lower()
    senha = dados.get("senha", "")

    if not email or not senha:
        return erro("Informe e-mail e senha.")

    with get_db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM usuarios WHERE lower(email) = %s",
                (email,)
            )
            usuario = cur.fetchone()

    if not usuario or not check_password_hash(usuario["senha"], senha):
        return erro("E-mail ou senha inválidos.", 401)

    session.clear()
    session["usuario_id"] = usuario["id"]
    session["nome"]       = usuario["nome"]
    session["email"]      = usuario["email"]
    session["tipo"]       = usuario["tipo"]

    return ok({"usuario": {
        "nome":  usuario["nome"],
        "email": usuario["email"],
        "tipo":  usuario["tipo"],
    }})


@app.route("/api/logout", methods=["POST"])
def api_logout():
    session.clear()
    return ok()


@app.route("/api/me", methods=["GET"])
def api_me():
    if "usuario_id" not in session:
        return ok({"usuario": None})

    return ok({"usuario": {
        "nome":  session["nome"],
        "email": session["email"],
        "tipo":  session["tipo"],
    }})


@app.route("/api/registrar", methods=["POST"])
def api_registrar():
    dados = request.get_json(silent=True) or {}
    nome  = dados.get("nome",  "").strip()
    email = dados.get("email", "").strip().lower()
    tipo  = dados.get("tipo",  "").strip()
    senha = dados.get("senha", "")

    if not nome or not email or not senha:
        return erro("Preencha nome, e-mail e senha.")

    if not re.match(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        return erro("E-mail inválido.")

    if len(senha) < 6:
        return erro("A senha precisa ter no mínimo 6 caracteres.")

    if tipo not in TIPOS_VALIDOS:
        return erro("Tipo de usuário inválido.")

    senha_hash = generate_password_hash(senha)

    try:
        with get_db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO usuarios (nome, email, senha, tipo) VALUES (%s, %s, %s, %s)",
                    (nome, email, senha_hash, tipo)
                )
            conn.commit()
    except psycopg2.errors.UniqueViolation:
        return erro("Este e-mail já está cadastrado.", 409)

    return ok({"mensagem": "Usuário cadastrado com sucesso."})


# ──────────────────────────────────────────────
# Inicialização
# ──────────────────────────────────────────────
if __name__ == "__main__":
    init_db()
    app.run(debug=True, host="0.0.0.0", port=5000)
