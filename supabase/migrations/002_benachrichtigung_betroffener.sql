-- ============================================================
--  Benachrichtigungen wissen, um wen es geht
--
--  Anträge und Kontingente eines gelöschten Kontos verschwinden schon durch
--  ON DELETE CASCADE. Meldungen ÜBER die Person hängen dagegen am Empfänger
--  — etwa „Neuer Urlaubsantrag von …" im Postfach des Administrators. Ohne
--  Bezug zur betroffenen Person bleiben sie als Karteileichen zurück.
-- ============================================================

alter table notifications
  add column if not exists subject_id uuid references profiles on delete cascade;

create index if not exists notifications_subject_idx
  on notifications (subject_id);
