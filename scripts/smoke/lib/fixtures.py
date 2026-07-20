"""Fixtures EFIMEROS: crea sus propios usuarios/votacion y los limpia al final.

No depende de seeds concretos. Cada corrida usa un `tag` unico; todo lo creado
lleva ese tag (emails smoke-<tag>-*@smoke.invalid, ids de votacion/propuesta con
prefijo derivado) para poder limpiarlo con certeza y para etiquetar cualquier
fila de audit_log que se genere (audit_log es append-only: no se borra).

Insertar en auth.users dispara handle_new_user(), que autocrea el profile con
level='registered'. Sobre eso, service_role ajusta level/member_since, y crea
members/positions/user_app_roles segun el rol de cada fixture.
"""
import uuid


class Fixtures:
    def __init__(self, http):
        self.http = http
        self.tag = uuid.uuid4().hex[:12]
        self.users = {}   # nombre -> uuid
        self.vote_id = None
        self.proposal_id = None
        self._created = False

    def _email(self, name):
        return "smoke-%s-%s@smoke.invalid" % (self.tag, name)

    def _new_user(self, name):
        uid = str(uuid.uuid4())
        self.http.sql(
            "insert into auth.users (id,instance_id,aud,role,email,created_at,updated_at) "
            "values ('%s','00000000-0000-0000-0000-000000000000','authenticated',"
            "'authenticated','%s',now(),now())" % (uid, self._email(name))
        )
        self.users[name] = uid
        return uid

    def _add_member(self, uid, status, days_ago):
        started = "now() - interval '%d days'" % days_ago
        canceled = "now()" if status == "canceled" else "null"
        self.http.sql(
            "insert into members (id,user_id,status,payment_method,billing_period,"
            "amount_cents,started_at,canceled_at,created_at,updated_at) values "
            "(gen_random_uuid(),'%s','%s','sepa_debit','monthly',900,%s,%s,now(),now())"
            % (uid, status, started, canceled)
        )

    def setup(self):
        # --- usuarios ---
        self._new_user("registered")                       # level=registered, sin membresia
        self._new_user("other")                            # segundo usuario normal (aislamiento)

        u = self._new_user("member_new")                   # miembro activo recien afiliado
        self._add_member(u, "active", 0)
        self.http.sql("update profiles set member_since=now() where id='%s'" % u)

        u = self._new_user("member_old_unverified")        # antiguo pero SIN verificar identidad
        self._add_member(u, "active", 400)
        self.http.sql("update profiles set member_since=now()-interval '400 days' where id='%s'" % u)

        u = self._new_user("member_old_verified")          # antiguo Y verificado -> elegible manifiesto
        self._add_member(u, "active", 400)
        self.http.sql(
            "update profiles set level='verified', member_since=now()-interval '400 days', "
            "identity_verified_at=now()-interval '300 days' where id='%s'" % u)

        u = self._new_user("member_canceled")              # membresia cancelada
        self._add_member(u, "canceled", 400)

        u = self._new_user("admin")                        # rol de aplicacion admin
        self.http.sql(
            "insert into user_app_roles (user_id,role_id,granted_at) "
            "select '%s', id, now() from app_roles where key='admin'" % u)

        # --- propuesta + votacion de manifiesto ABIERTA (min_membership_days=30) ---
        self.proposal_id = str(uuid.uuid4())
        self.vote_id = str(uuid.uuid4())
        author = self.users["registered"]
        self.http.sql(
            "insert into proposals (id,title,body,department,status,author_id,origin) values "
            "('%s','[SMOKE %s] propuesta efimera','cuerpo de prueba','justicia','voting','%s','citizen')"
            % (self.proposal_id, self.tag, author))
        self.http.sql(
            "insert into votes (id,proposal_id,opens_at,closes_at,quorum,threshold,scope,"
            "created_by,min_membership_days) values "
            "('%s','%s', now()-interval '1 hour', now()+interval '7 days', 1, 0.5, 'manifesto','%s',30)"
            % (self.vote_id, self.proposal_id, author))
        self._created = True
        return self

    def token(self, name):
        from . import jwt as jwtmod
        return jwtmod.mint(self.http.cfg.jwt_secret, self.users[name])

    def teardown(self):
        if not self._created:
            return
        h = self.http
        if self.vote_id:
            h.sql("delete from ballots where vote_id='%s'" % self.vote_id)
            h.sql("delete from votes where id='%s'" % self.vote_id)
        if self.proposal_id:
            h.sql("delete from votes where proposal_id='%s'" % self.proposal_id)
            h.sql("delete from proposals where id='%s'" % self.proposal_id)
        ids = list(self.users.values())
        if ids:
            in_list = ",".join("'%s'" % i for i in ids)
            h.sql("delete from ballots where user_id in (%s)" % in_list)
            h.sql("delete from tax_identities where user_id in (%s)" % in_list)
            h.sql("delete from user_app_roles where user_id in (%s)" % in_list)
            h.sql("delete from positions where user_id in (%s)" % in_list)
            h.sql("delete from members where user_id in (%s)" % in_list)
            # profiles y el resto caen por ON DELETE CASCADE de auth.users
            h.sql("delete from auth.users where id in (%s)" % in_list)
        # barrido de seguridad por si quedo algo con el tag
        h.sql("delete from auth.users where email like 'smoke-%s-%%@smoke.invalid'" % self.tag)
