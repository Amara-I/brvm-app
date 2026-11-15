-- Anti-doublon des notifications : au plus un événement par (utilisateur, clé
-- d'information). La clé vit dans payload->>'dedupeKey' (posée par
-- lib/notifications/emit.ts) : pas de nouvelle colonne, les anciens événements
-- (sans clé) ne sont pas concernés. Le code fonctionne sans cet index (contrôle
-- applicatif) ; l'index ferme la course cron / bouton / page.
-- Index partiel sur expression : non représentable dans schema.prisma.
CREATE UNIQUE INDEX IF NOT EXISTS "notification_events_user_dedupe_key_uniq"
  ON "notification_events" ("user_id", (("payload" ->> 'dedupeKey')))
  WHERE ("payload" ? 'dedupeKey');
