-- Default de cronómetro en niveles existentes: 120 s si aún no tienen timeLimitSec.

update public.levels
set config = jsonb_set(config, '{timeLimitSec}', '120'::jsonb, true)
where (config ->> 'timeLimitSec') is null;
