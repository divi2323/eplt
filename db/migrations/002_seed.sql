BEGIN;

INSERT INTO leagues (league_id, league_name)
VALUES ('L-001', 'All Active Leagues')
ON CONFLICT DO NOTHING;

INSERT INTO people (person_id, first_name, last_name, email)
VALUES
('P-001','Ryan','McBride','ryan@example.com'),
('P-002','Amanda','(Runner)','amanda@example.com')
ON CONFLICT DO NOTHING;

INSERT INTO events (event_id, league_id, event_name, event_date, venue_name)
VALUES ('E-001','L-001','Demo Event', CURRENT_DATE, 'Demo Venue')
ON CONFLICT DO NOTHING;

INSERT INTO entries (entry_id, event_id, person_id, buyins, points, cash_out)
VALUES
('EN-001','E-001','P-001',1,50,0),
('EN-002','E-001','P-002',1,0,0)
ON CONFLICT DO NOTHING;

COMMIT;
