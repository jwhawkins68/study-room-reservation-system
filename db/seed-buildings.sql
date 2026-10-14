-- More sample rooms: 18 rooms across 7 campus buildings (fictional rooms for the prototype).
-- Run after schema.sql. Safe to run more than once: rows that already exist are skipped.
-- Matches the rooms in web/src/lib/mock.js (ids 6-23).

insert into rooms (name, building, floor, capacity, description) values
  ('Collab Room B',       'Student Center',           '2', 6,  'Group room between classes'),
  ('Project Room 110',    'New Engineering Building', '1', 6,  'Team room with a wall-to-wall whiteboard'),
  ('Project Room 112',    'New Engineering Building', '1', 4,  'Small team room'),
  ('Project Room 215',    'New Engineering Building', '2', 8,  'Room with a display for design reviews'),
  ('Study Room 220',      'New Engineering Building', '2', 2,  'Quiet room for pairs'),
  ('Study Room 104',      'Collins Engineering',      '1', 4,  'Quiet room off the main hallway'),
  ('Study Room 106',      'Collins Engineering',      '1', 6,  'Group room with a large table'),
  ('Conference Room 301', 'Collins Engineering',      '3', 12, 'Large room for team meetings and practice talks'),
  ('Study Room 120',      'Harrington Science',       '1', 4,  'Room for lab report write-ups'),
  ('Study Room 122',      'Harrington Science',       '1', 6,  'Group room for exam review'),
  ('Study Room 230',      'Harrington Science',       '2', 2,  'Small quiet room'),
  ('Studio Room 140',     'Architecture',             '1', 8,  'Large tables for laying out drawings and models'),
  ('Review Room 250',     'Architecture',             '2', 10, 'Room with a display for project critiques'),
  ('Study Lounge A',      'University College',       '1', 6,  'Lounge for late-night group study'),
  ('Study Lounge B',      'University College',       '2', 4,  'Smaller, quieter lounge'),
  ('Study Room 1A',       'University Village',       '1', 4,  'Quiet room near the front desk'),
  ('Study Room 1B',       'University Village',       '1', 6,  'Group room with a whiteboard wall'),
  ('Media Room',          'University Village',       '1', 8,  'Room with a big screen for group presentations')
on conflict (building, name) do nothing;

-- Matched on building + room name, since room names repeat across buildings
insert into room_amenities (room_id, amenity_id)
select r.id, a.id
from (values
  ('Student Center',           'Collab Room B',       'Accessible'),
  ('Student Center',           'Collab Room B',       'Power outlets'),
  ('Student Center',           'Collab Room B',       'Whiteboard'),
  ('New Engineering Building', 'Project Room 110',    'Power outlets'),
  ('New Engineering Building', 'Project Room 110',    'Whiteboard'),
  ('New Engineering Building', 'Project Room 112',    'Power outlets'),
  ('New Engineering Building', 'Project Room 112',    'Whiteboard'),
  ('New Engineering Building', 'Project Room 215',    'TV / HDMI'),
  ('New Engineering Building', 'Project Room 215',    'Webcam'),
  ('New Engineering Building', 'Project Room 215',    'Whiteboard'),
  ('New Engineering Building', 'Study Room 220',      'Power outlets'),
  ('Collins Engineering',      'Study Room 104',      'Accessible'),
  ('Collins Engineering',      'Study Room 104',      'Power outlets'),
  ('Collins Engineering',      'Study Room 106',      'Power outlets'),
  ('Collins Engineering',      'Study Room 106',      'Whiteboard'),
  ('Collins Engineering',      'Conference Room 301', 'Accessible'),
  ('Collins Engineering',      'Conference Room 301', 'TV / HDMI'),
  ('Collins Engineering',      'Conference Room 301', 'Webcam'),
  ('Collins Engineering',      'Conference Room 301', 'Whiteboard'),
  ('Harrington Science',       'Study Room 120',      'Power outlets'),
  ('Harrington Science',       'Study Room 120',      'Whiteboard'),
  ('Harrington Science',       'Study Room 122',      'TV / HDMI'),
  ('Harrington Science',       'Study Room 122',      'Whiteboard'),
  ('Harrington Science',       'Study Room 230',      'Power outlets'),
  ('Architecture',             'Studio Room 140',     'Accessible'),
  ('Architecture',             'Studio Room 140',     'Power outlets'),
  ('Architecture',             'Studio Room 140',     'Whiteboard'),
  ('Architecture',             'Review Room 250',     'TV / HDMI'),
  ('Architecture',             'Review Room 250',     'Webcam'),
  ('Architecture',             'Review Room 250',     'Whiteboard'),
  ('University College',       'Study Lounge A',      'Accessible'),
  ('University College',       'Study Lounge A',      'Power outlets'),
  ('University College',       'Study Lounge A',      'Whiteboard'),
  ('University College',       'Study Lounge B',      'Power outlets'),
  ('University Village',       'Study Room 1A',       'Power outlets'),
  ('University Village',       'Study Room 1B',       'Power outlets'),
  ('University Village',       'Study Room 1B',       'Whiteboard'),
  ('University Village',       'Media Room',          'Accessible'),
  ('University Village',       'Media Room',          'TV / HDMI'),
  ('University Village',       'Media Room',          'Webcam')
) as v(building, room, amenity)
join rooms r on r.building = v.building and r.name = v.room
join amenities a on a.name = v.amenity
on conflict do nothing;
