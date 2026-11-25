"""Persistência e autorização de salas e reservas (PostgreSQL)."""
from datetime import date
from contextlib import closing
from flask import Blueprint, request, session, jsonify, current_app
import psycopg2
import sqlite3

bp = Blueprint('schedule', __name__)
FIXED = {'01-01','04-21','05-01','09-07','10-12','11-02','11-15','11-20','12-25'}
# Datas específicas herdadas do front enviado; administração deve revisar anualmente.
BLOCKED = {'2026-03-03','2026-03-04','2026-03-05','2026-04-02','2026-04-03','2026-05-21'}

class Invalid(Exception):
    def __init__(self, msg, status=400):
        super().__init__(msg); self.status = status


def init_schedule(cur, sqlite=False):
    if sqlite:
        cur.execute("""CREATE TABLE IF NOT EXISTS yarooms_rooms (
            id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL,
            capacity INTEGER NOT NULL CHECK(capacity > 0), hours TEXT NOT NULL,
            director_id INTEGER NOT NULL REFERENCES usuarios(id))""")
        cur.execute("""CREATE TABLE IF NOT EXISTS yarooms_bookings (
            id INTEGER PRIMARY KEY AUTOINCREMENT, room_id INTEGER NOT NULL REFERENCES yarooms_rooms(id),
            owner_id INTEGER NOT NULL REFERENCES usuarios(id), day TEXT NOT NULL,
            hours TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '')""")
        cur.execute('CREATE INDEX IF NOT EXISTS yarooms_bookings_room_day ON yarooms_bookings(room_id, day)')
        return
    cur.execute('''CREATE TABLE IF NOT EXISTS yarooms_rooms (
        id SERIAL PRIMARY KEY, type VARCHAR(120) NOT NULL, capacity INTEGER NOT NULL CHECK(capacity > 0),
        hours INTEGER[] NOT NULL, director_id INTEGER NOT NULL REFERENCES usuarios(id))''')
    cur.execute('''CREATE TABLE IF NOT EXISTS yarooms_bookings (
        id SERIAL PRIMARY KEY, room_id INTEGER NOT NULL REFERENCES yarooms_rooms(id),
        owner_id INTEGER NOT NULL REFERENCES usuarios(id), day DATE NOT NULL, hours INTEGER[] NOT NULL,
        notes VARCHAR(500) NOT NULL DEFAULT '')''')
    cur.execute('''CREATE INDEX IF NOT EXISTS yarooms_bookings_room_day ON yarooms_bookings(room_id, day)''')


def db():
    return closing(current_app.config['GET_DB']())


def payload():
    data = request.get_json(silent=True)
    if not isinstance(data, dict): raise Invalid('Envie um objeto JSON válido.')
    return data


def hours_of(data):
    hours = data.get('hours')
    if not isinstance(hours,list) or not hours or any(type(h) is not int or not 7 <= h <= 23 for h in hours):
        raise Invalid('Selecione horários válidos.')
    return sorted(set(hours))


def director():
    if session.get('tipo') != 'Diretor(a)': raise Invalid('Acesso exclusivo da direção.',403)


def teacher():
    if session.get('tipo') == 'Diretor(a)': raise Invalid('Use uma conta de professor para reservar.',403)


@bp.before_request
def auth():
    if 'usuario_id' not in session: return jsonify(ok=False,erro='Não autenticado.'),401


@bp.errorhandler(Invalid)
def invalid(exc): return jsonify(ok=False,erro=str(exc)),exc.status


@bp.errorhandler(sqlite3.Error)
@bp.errorhandler(psycopg2.Error)
def database_error(exc): return jsonify(ok=False,erro='Falha no banco de dados. Procure a administração.'),500


def lock(cur):
    # Serializa operações de escrita para evitar reservas simultâneas conflitantes.
    if current_app.config['DB_TYPE'] == 'sqlite':
        cur.execute('BEGIN IMMEDIATE')
        return
    cur.execute('LOCK TABLE yarooms_rooms, yarooms_bookings IN SHARE ROW EXCLUSIVE MODE')


@bp.get('/api/schedule')
def get_schedule():
    with db() as conn, conn, conn.cursor() as cur:
        cur.execute('SELECT id,type,capacity,hours,director_id FROM yarooms_rooms ORDER BY id')
        rooms = [dict(id=r['id'],type=r['type'],capacity=r['capacity'],hours=r['hours'],manageable=r['director_id']==session['usuario_id']) for r in cur.fetchall()]
        cur.execute('''SELECT b.id,b.room_id,b.day,b.hours,b.notes,b.owner_id,r.type AS room,u.nome
                       FROM yarooms_bookings b JOIN yarooms_rooms r ON r.id=b.room_id
                       JOIN usuarios u ON u.id=b.owner_id ORDER BY b.id''')
        bookings = []
        for b in cur.fetchall():
            mine = b['owner_id'] == session['usuario_id']
            bookings.append(dict(id=b['id'],roomId=b['room_id'],date=b['day'].isoformat(),hours=b['hours'],
                notes=b['notes'],mine=mine,room=b['room'],who=b['notes'] or b['nome'].split()[0],
                color=['','amber','azure','crimson'][b['id']%4]))
    return jsonify(ok=True,rooms=rooms,bookings=bookings)


@bp.post('/api/rooms')
def add_room():
    director(); data=payload(); hours=hours_of(data); name=data.get('type'); capacity=data.get('capacity')
    if not isinstance(name,str) or not name.strip() or len(name)>120 or type(capacity) is not int or not 1<=capacity<=10000:
        raise Invalid('Informe tipo de sala e capacidade válidos.')
    with db() as conn, conn, conn.cursor() as cur:
        lock(cur)
        cur.execute('INSERT INTO yarooms_rooms(type,capacity,hours,director_id) VALUES(%s,%s,%s,%s) RETURNING id',
                    (name.strip(),capacity,hours,session['usuario_id']))
        rid=cur.fetchone()['id']
    return jsonify(ok=True,id=rid),201


@bp.route('/api/rooms/<int:rid>',methods=['PATCH','DELETE'])
def change_room(rid):
    director()
    with db() as conn, conn, conn.cursor() as cur:
        lock(cur); cur.execute('SELECT * FROM yarooms_rooms WHERE id=%s',(rid,)); room=cur.fetchone()
        if not room: raise Invalid('Sala não encontrada.',404)
        if room['director_id'] != session['usuario_id']: raise Invalid('Esta sala pertence a outro diretor.',403)
        if request.method=='DELETE':
            cur.execute('SELECT 1 FROM yarooms_bookings WHERE room_id=%s LIMIT 1',(rid,))
            if cur.fetchone(): raise Invalid('A sala possui reservas e não pode ser removida.',409)
            cur.execute('DELETE FROM yarooms_rooms WHERE id=%s',(rid,))
        else:
            hours=hours_of(payload()); cur.execute('SELECT hours FROM yarooms_bookings WHERE room_id=%s',(rid,))
            if any(not set(b['hours']).issubset(hours) for b in cur.fetchall()): raise Invalid('Há reservas em horários que seriam removidos.',409)
            cur.execute('UPDATE yarooms_rooms SET hours=%s WHERE id=%s',(hours,rid))
    return jsonify(ok=True)


@bp.post('/api/bookings')
def new_booking(): return save_booking(None)


@bp.route('/api/bookings/<int:bid>',methods=['PUT','DELETE'])
def change_booking(bid):
    if request.method=='PUT': return save_booking(bid)
    with db() as conn, conn, conn.cursor() as cur:
        lock(cur); cur.execute('DELETE FROM yarooms_bookings WHERE id=%s AND owner_id=%s RETURNING id',(bid,session['usuario_id']))
        if not cur.fetchone(): raise Invalid('Reserva não encontrada ou sem permissão.',404)
    return jsonify(ok=True)


def save_booking(bid):
    teacher(); data=payload(); hours=hours_of(data); rid=data.get('roomId'); notes=data.get('notes','')
    try: day=date.fromisoformat(data.get('date',''))
    except (ValueError,TypeError): raise Invalid('Data inválida.')
    if day.weekday()==6 or day.strftime('%m-%d') in FIXED or day.isoformat() in BLOCKED: raise Invalid('Dia não letivo.')
    if type(rid) is not int or not isinstance(notes,str) or len(notes)>500: raise Invalid('Sala ou observação inválida.')
    with db() as conn, conn, conn.cursor() as cur:
        lock(cur)
        if bid is not None:
            cur.execute('SELECT id FROM yarooms_bookings WHERE id=%s AND owner_id=%s',(bid,session['usuario_id']))
            if not cur.fetchone(): raise Invalid('Reserva não encontrada ou sem permissão.',404)
        cur.execute('SELECT hours FROM yarooms_rooms WHERE id=%s',(rid,)); room=cur.fetchone()
        if not room or not set(hours).issubset(room['hours']): raise Invalid('Sala ou horários indisponíveis.',409)
        cur.execute('SELECT id,hours FROM yarooms_bookings WHERE room_id=%s AND day=%s',(rid,day))
        if any(b['id']!=bid and set(b['hours']).intersection(hours) for b in cur.fetchall()): raise Invalid('Um ou mais horários já foram reservados.',409)
        if bid is None:
            cur.execute('INSERT INTO yarooms_bookings(room_id,owner_id,day,hours,notes) VALUES(%s,%s,%s,%s,%s) RETURNING id',
                        (rid,session['usuario_id'],day,hours,notes.strip())); bid=cur.fetchone()['id']
        else:
            cur.execute('UPDATE yarooms_bookings SET room_id=%s,day=%s,hours=%s,notes=%s WHERE id=%s',(rid,day,hours,notes.strip(),bid))
    return jsonify(ok=True,id=bid)
