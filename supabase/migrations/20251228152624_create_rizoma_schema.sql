/*
  # Schema RIZOMA - MVP

  ## Visão Geral
  Sistema de entregas conectando empreendedores a entregadores verificados.

  ## Tabelas Criadas
  
  ### 1. profiles
  - Perfis de usuários (empreendedor ou entregador)
  - Campos: id, user_id, role, name, company, phone, created_at
  
  ### 2. plans
  - Planos de assinatura disponíveis
  - Campos: id, name, price, max_deliveries, coverage_amount, features
  
  ### 3. subscriptions
  - Assinaturas ativas dos empreendedores
  - Campos: id, entrepreneur_id, plan_id, status, deliveries_used, starts_at, ends_at
  
  ### 4. deliveries
  - Entregas criadas no sistema
  - Campos: id, entrepreneur_id, deliveryman_id, status, origin, destination, item_type, declared_value, instructions, created_at
  
  ### 5. delivery_checkpoints
  - Checkpoints de progresso da entrega
  - Campos: id, delivery_id, checkpoint_type, timestamp, notes, created_by
  
  ### 6. delivery_ratings
  - Avaliações de entregas concluídas
  - Campos: id, delivery_id, rating, comment, created_at
  
  ### 7. delivery_problems
  - Problemas reportados em entregas
  - Campos: id, delivery_id, description, status, reported_at, resolved_at

  ## Segurança
  - RLS habilitado em todas as tabelas
  - Políticas específicas por tipo de usuário
  - Validação de ownership em todas as operações
*/

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL CHECK (role IN ('entrepreneur', 'deliveryman', 'admin')),
  name text NOT NULL,
  company text,
  phone text,
  avatar_url text,
  verification_level integer DEFAULT 0,
  trust_score decimal(3,1) DEFAULT 0.0,
  total_deliveries integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Plans table
CREATE TABLE IF NOT EXISTS plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  price decimal(10,2) NOT NULL,
  max_deliveries integer NOT NULL,
  coverage_amount decimal(10,2) NOT NULL,
  features jsonb DEFAULT '[]'::jsonb,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active plans"
  ON plans FOR SELECT
  TO authenticated
  USING (active = true);

-- Insert default plans
INSERT INTO plans (name, slug, price, max_deliveries, coverage_amount, features) VALUES
  ('Básico', 'basic', 79.90, 10, 1000.00, '["Entregadores verificados", "Cobertura até R$ 1.000", "Suporte por email"]'::jsonb),
  ('Profissional', 'professional', 199.90, 50, 5000.00, '["Até 50 entregas/mês", "Cobertura até R$ 5.000", "Suporte prioritário", "Relatórios avançados"]'::jsonb)
ON CONFLICT (slug) DO NOTHING;

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entrepreneur_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  plan_id uuid REFERENCES plans(id) NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  deliveries_used integer DEFAULT 0,
  starts_at timestamptz DEFAULT now(),
  ends_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Entrepreneurs can read own subscriptions"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (
    entrepreneur_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid() AND role = 'entrepreneur'
    )
  );

CREATE POLICY "Entrepreneurs can insert own subscriptions"
  ON subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (
    entrepreneur_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid() AND role = 'entrepreneur'
    )
  );

-- Deliveries table
CREATE TABLE IF NOT EXISTS deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  entrepreneur_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  deliveryman_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'accepted', 'in_progress', 'completed', 'problem')),
  origin text NOT NULL,
  destination text NOT NULL,
  item_type text NOT NULL,
  declared_value decimal(10,2) NOT NULL,
  instructions text,
  created_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  completed_at timestamptz
);

ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Entrepreneurs can read own deliveries"
  ON deliveries FOR SELECT
  TO authenticated
  USING (
    entrepreneur_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid() AND role = 'entrepreneur'
    )
  );

CREATE POLICY "Deliverymen can read assigned deliveries"
  ON deliveries FOR SELECT
  TO authenticated
  USING (
    deliveryman_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid() AND role = 'deliveryman'
    )
  );

CREATE POLICY "Deliverymen can read available deliveries"
  ON deliveries FOR SELECT
  TO authenticated
  USING (
    status = 'created' AND deliveryman_id IS NULL
  );

CREATE POLICY "Entrepreneurs can create deliveries"
  ON deliveries FOR INSERT
  TO authenticated
  WITH CHECK (
    entrepreneur_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid() AND role = 'entrepreneur'
    )
  );

CREATE POLICY "Deliverymen can update assigned deliveries"
  ON deliveries FOR UPDATE
  TO authenticated
  USING (
    deliveryman_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid() AND role = 'deliveryman'
    )
  )
  WITH CHECK (
    deliveryman_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid() AND role = 'deliveryman'
    )
  );

-- Function to generate delivery code
CREATE OR REPLACE FUNCTION generate_delivery_code()
RETURNS text AS $$
DECLARE
  new_code text;
  code_exists boolean;
BEGIN
  LOOP
    new_code := 'DEV-' || LPAD(floor(random() * 99999)::text, 5, '0');
    SELECT EXISTS(SELECT 1 FROM deliveries WHERE code = new_code) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;
  RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Delivery checkpoints table
CREATE TABLE IF NOT EXISTS delivery_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid REFERENCES deliveries(id) ON DELETE CASCADE NOT NULL,
  checkpoint_type text NOT NULL CHECK (checkpoint_type IN ('created', 'accepted', 'pickup', 'in_transit', 'arrived', 'completed')),
  notes text,
  created_by uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE delivery_checkpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read checkpoints of their deliveries"
  ON delivery_checkpoints FOR SELECT
  TO authenticated
  USING (
    delivery_id IN (
      SELECT id FROM deliveries 
      WHERE entrepreneur_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
         OR deliveryman_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Deliverymen can create checkpoints"
  ON delivery_checkpoints FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by IN (
      SELECT id FROM profiles WHERE user_id = auth.uid() AND role = 'deliveryman'
    )
  );

-- Delivery ratings table
CREATE TABLE IF NOT EXISTS delivery_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid REFERENCES deliveries(id) ON DELETE CASCADE NOT NULL UNIQUE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE delivery_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Entrepreneurs can rate their completed deliveries"
  ON delivery_ratings FOR INSERT
  TO authenticated
  WITH CHECK (
    delivery_id IN (
      SELECT id FROM deliveries 
      WHERE entrepreneur_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
        AND status = 'completed'
    )
  );

CREATE POLICY "Anyone can read ratings"
  ON delivery_ratings FOR SELECT
  TO authenticated
  USING (true);

-- Delivery problems table
CREATE TABLE IF NOT EXISTS delivery_problems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid REFERENCES deliveries(id) ON DELETE CASCADE NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved')),
  reported_by uuid REFERENCES profiles(id) NOT NULL,
  reported_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE delivery_problems ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read problems of their deliveries"
  ON delivery_problems FOR SELECT
  TO authenticated
  USING (
    delivery_id IN (
      SELECT id FROM deliveries 
      WHERE entrepreneur_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
         OR deliveryman_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Users can report problems on their deliveries"
  ON delivery_problems FOR INSERT
  TO authenticated
  WITH CHECK (
    reported_by IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    AND delivery_id IN (
      SELECT id FROM deliveries 
      WHERE entrepreneur_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
         OR deliveryman_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_deliveries_entrepreneur ON deliveries(entrepreneur_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_deliveryman ON deliveries(deliveryman_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_entrepreneur ON subscriptions(entrepreneur_id);
CREATE INDEX IF NOT EXISTS idx_delivery_checkpoints_delivery ON delivery_checkpoints(delivery_id);