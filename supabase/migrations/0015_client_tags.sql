-- Etiquetas de cliente, para segmentación y difusión de mensajes.
alter table clientes add column tags text[] not null default '{}';

create index idx_clientes_tags on clientes using gin (tags);
