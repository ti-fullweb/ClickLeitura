-- supabase/seed.sql

-- Limpar dados existentes (opcional, mas útil para testes repetidos)
-- TRUNCATE TABLE leituras, roteiro_residencias, roteiros, residencias, ruas, bairros, cidades, leituristas, tipos_ocorrencia RESTART IDENTITY CASCADE;

-- 1. Leituristas
INSERT INTO leituristas (id, nome, matricula) VALUES
('8f9b7c6e-5d4a-4b3c-8a1f-9e0d2c1b3a0e', 'João Silva', 'L12345');

-- 2. Endereços
INSERT INTO cidades (id, nome, uf) VALUES
(1, 'Exemplópolis', 'EX') ON CONFLICT DO NOTHING;

INSERT INTO bairros (id, nome, cidade_id) VALUES
(1, 'Centro', 1) ON CONFLICT DO NOTHING;

INSERT INTO ruas (id, nome, cep, bairro_id) VALUES
(1, 'Rua Principal', '12345001', 1),
(2, 'Avenida Secundária', '12345002', 1) ON CONFLICT DO NOTHING;

-- 3. Residências
INSERT INTO residencias (id, rua_id, numero, complemento, hidrometro_numero, latitude, longitude) VALUES
('a1b2c3d4-e5f6-7890-1234-567890abcdef', 1, '100', NULL, 'H100A', -23.5505, -46.6333),
('b2c3d4e5-f6a7-8901-2345-67890abcdef0', 1, '110', 'Apto 1', 'H110A1', -23.5510, -46.6335),
('c3d4e5f6-a7b8-9012-3456-7890abcdef01', 2, '25', NULL, 'H25B', -23.5515, -46.6340),
('d4e5f6a7-b8c9-0123-4567-890abcdef012', 2, '30', 'Fundos', 'H30BF', -23.5520, -46.6345);

-- 4. Tipos de Ocorrência
INSERT INTO tipos_ocorrencia (id, codigo, descricao, gera_leitura) VALUES
(1, '00', 'Leitura Normal', true),
(2, '05', 'Impedido - Portão Fechado', false),
(3, '12', 'Hidrômetro Ilegível', false) ON CONFLICT DO NOTHING;


-- 5. Roteiro para hoje
INSERT INTO roteiros (id, leiturista_id, data, status) VALUES
('e1f2a3b4-c5d6-7890-e1f2-a3b4c5d6e7f8', '8f9b7c6e-5d4a-4b3c-8a1f-9e0d2c1b3a0e', CURRENT_DATE, 'pendente');

-- 6. Associar Residências ao Roteiro
INSERT INTO roteiro_residencias (roteiro_id, residencia_id, ordem, status, leitura_anterior_snapshot) VALUES
('e1f2a3b4-c5d6-7890-e1f2-a3b4c5d6e7f8', 'a1b2c3d4-e5f6-7890-1234-567890abcdef', 1, 'pendente', 1500), -- Residencia H100A
('e1f2a3b4-c5d6-7890-e1f2-a3b4c5d6e7f8', 'b2c3d4e5-f6a7-8901-2345-67890abcdef0', 2, 'pendente', 2100), -- Residencia H110A1
('e1f2a3b4-c5d6-7890-e1f2-a3b4c5d6e7f8', 'c3d4e5f6-a7b8-9012-3456-7890abcdef01', 3, 'pendente', 850),  -- Residencia H25B
('e1f2a3b4-c5d6-7890-e1f2-a3b4c5d6e7f8', 'd4e5f6a7-b8c9-0123-4567-890abcdef012', 4, 'pendente', 320);   -- Residencia H30BF
