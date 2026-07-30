-- Permite que el nutricionista escriba un objetivo personalizado cuando
-- ninguno de los valores predefinidos encaja, en vez de forzar el enum.
alter table clientes drop constraint clientes_goal_check;
