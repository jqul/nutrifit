-- La fibra pasa a ser un objetivo de macro más (junto a kcal/proteína/carbos/
-- grasas), no solo un dato "ampliado" oculto por alimento — a petición
-- explícita de un nutricionista: es lo bastante importante (subirla en
-- general, bajarla temporalmente en ciertos contextos clínicos) como para
-- verse igual de destacada que el resto de macros.
alter table diet_plans add column fiber_g numeric not null default 0;
