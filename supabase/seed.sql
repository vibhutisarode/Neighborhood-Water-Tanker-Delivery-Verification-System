insert into public.blocks (name, daily_quota_liters, scheduled_liters, delivery_window_start, delivery_window_end) values
  ('Block A', 2500, 4000, '06:00', '22:00'),
  ('Block B', 3000, 4000, '06:00', '22:00'),
  ('Block C', 2000, 2500, '07:00', '21:00'),
  ('Block D', 4000, 5000, '06:00', '22:00'),
  ('Block E', 3500, 3500, '06:00', '22:00')
on conflict (name) do nothing;

insert into public.tankers (tanker_number, driver_name) values
  ('MH-31-AB-1234', 'Ramesh Kumar'),
  ('KA-05-MN-7712', 'Suresh Patil'),
  ('MH-31-XY-4490', 'Iqbal Shaikh'),
  ('TN-38-KL-0921', 'Mohan Das'),
  ('KA-01-CC-2208', 'Arjun Nair')
on conflict (tanker_number) do nothing;
