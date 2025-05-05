-- Informações dos leituristas
CREATE TABLE leituristas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(255) NOT NULL,
    matricula VARCHAR(50) UNIQUE NOT NULL,
    -- outros campos relevantes
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Cidades (para normalização do endereço)
CREATE TABLE cidades (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    uf CHAR(2) NOT NULL,
    UNIQUE(nome, uf)
);

-- Bairros (para normalização do endereço)
CREATE TABLE bairros (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    cidade_id INT NOT NULL REFERENCES cidades(id),
    UNIQUE(nome, cidade_id)
);

-- Ruas (para normalização do endereço)
CREATE TABLE ruas (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    cep CHAR(8),
    bairro_id INT NOT NULL REFERENCES bairros(id)
);

-- Informações das residências e hidrômetros
CREATE TABLE residencias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rua_id INT NOT NULL REFERENCES ruas(id),
    numero VARCHAR(20) NOT NULL,
    complemento VARCHAR(100),
    hidrometro_numero VARCHAR(50) UNIQUE NOT NULL, -- Assumindo unicidade do hidrômetro
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    -- outros campos (ex: sequencia_leitura_padrao)
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Roteiros diários atribuídos a leituristas
CREATE TABLE roteiros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    leiturista_id UUID NOT NULL REFERENCES leituristas(id),
    data DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'pendente', -- ex: pendente, em_andamento, concluido
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(leiturista_id, data) -- Geralmente um roteiro por leiturista/dia
);

-- Tabela de junção: Residências que compõem um roteiro específico
CREATE TABLE roteiro_residencias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    roteiro_id UUID NOT NULL REFERENCES roteiros(id) ON DELETE CASCADE,
    residencia_id UUID NOT NULL REFERENCES residencias(id),
    ordem INT NOT NULL, -- Ordem de visita
    status VARCHAR(30) DEFAULT 'pendente', -- Status da VISITA: pendente, concluido_com_leitura, concluido_sem_leitura, impedido
    visitado_em TIMESTAMPTZ, -- Timestamp da visita/tentativa
    leitura_anterior_snapshot INT, -- Opcional: Snapshot da leitura anterior no momento da criação do roteiro para offline
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(roteiro_id, residencia_id),
    UNIQUE(roteiro_id, ordem)
);

-- Tipos de ocorrência/impedimento para a leitura
CREATE TABLE tipos_ocorrencia (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(10) UNIQUE NOT NULL,
    descricao VARCHAR(255) NOT NULL,
    gera_leitura BOOLEAN DEFAULT true NOT NULL -- Indica se essa ocorrência tem valor de leitura
);

-- Leituras realizadas (ou ocorrências registradas)
CREATE TABLE leituras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    roteiro_residencia_id UUID NOT NULL REFERENCES roteiro_residencias(id) ON DELETE CASCADE, -- Ligação com a visita específica
    leitura_anterior INT, -- Valor da leitura do mês/ciclo anterior
    leitura_atual INT, -- Valor lido do hidrômetro (pode ser NULL se não houve leitura)
    consumo INT GENERATED ALWAYS AS (CASE WHEN leitura_atual >= leitura_anterior THEN leitura_atual - leitura_anterior ELSE NULL END) STORED, -- Calculado automaticamente
    data_leitura TIMESTAMPTZ NOT NULL DEFAULT now(), -- Data/hora exata
    imagem_url VARCHAR(512), -- URL da imagem no Supabase Storage
    observacao TEXT,
    tipo_ocorrencia_id INT NOT NULL REFERENCES tipos_ocorrencia(id), -- Referência à ocorrência
    latitude_leitura DECIMAL(10, 8), -- Opcional: Localização no momento da leitura
    longitude_leitura DECIMAL(11, 8), -- Opcional: Localização no momento da leitura
    -- Campos para controle de sincronização podem ser adicionados aqui ou gerenciados pela lib offline (ex: WatermelonDB)
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para otimizar consultas
CREATE INDEX idx_roteiros_data ON roteiros(data);
CREATE INDEX idx_roteiros_leiturista_data ON roteiros(leiturista_id, data);
CREATE INDEX idx_roteiro_residencias_roteiro ON roteiro_residencias(roteiro_id);
CREATE INDEX idx_roteiro_residencias_residencia ON roteiro_residencias(residencia_id);
CREATE INDEX idx_leituras_roteiro_residencia ON leituras(roteiro_residencia_id);
CREATE INDEX idx_leituras_data ON leituras(data_leitura);
CREATE INDEX idx_residencias_rua ON residencias(rua_id);
CREATE INDEX idx_ruas_bairro ON ruas(bairro_id);
CREATE INDEX idx_bairros_cidade ON bairros(cidade_id);
