-- Core Tables

CREATE TABLE schools (
  id text PRIMARY KEY,
  name text NOT NULL,
  code text,
  logo text,
  address text,
  phone text,
  email text,
  academic_year text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  settings jsonb
);

CREATE TABLE classes (
  id text PRIMARY KEY,
  school_id text REFERENCES schools(id),
  name text NOT NULL,
  level text,
  room_id text,
  teacher_id text,
  max_students integer,
  subjects jsonb,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE teachers (
  id text PRIMARY KEY,
  school_id text REFERENCES schools(id),
  name text NOT NULL,
  max_hours_per_week integer,
  subjects jsonb,
  levels jsonb,
  availability jsonb,
  is_vacataire boolean DEFAULT false,
  available_hours jsonb,
  email text,
  phone text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE students (
  id text PRIMARY KEY,
  school_id text REFERENCES schools(id),
  name text NOT NULL,
  class_id text,
  academic_year text,
  code_massar text,
  gender text,
  parent_name text,
  date_of_birth text,
  place_of_birth text,
  email text,
  phone text,
  address text,
  guardian_name text,
  guardian_phone text,
  photo text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE salles (
  id text PRIMARY KEY,
  school_id text REFERENCES schools(id),
  name text NOT NULL,
  type text,
  capacity integer,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE subjects (
  id text PRIMARY KEY,
  school_id text REFERENCES schools(id),
  name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE levels (
  id text PRIMARY KEY,
  school_id text REFERENCES schools(id),
  name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE grades (
  id text PRIMARY KEY,
  student_id text,
  school_id text REFERENCES schools(id),
  subject text NOT NULL,
  exam_type text NOT NULL,
  grade numeric,
  class_id text,
  date text,
  academic_year text,
  coefficient numeric,
  teacher_id text,
  comment text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE timetables (
  id text PRIMARY KEY,
  school_id text REFERENCES schools(id),
  data jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Library Tables

CREATE TABLE library_books (
  id text PRIMARY KEY,
  title text NOT NULL,
  author text NOT NULL,
  isbn text,
  category text,
  total_copies integer,
  available_copies integer,
  location text,
  description text,
  cover_image text,
  published_year integer,
  publisher text,
  language text,
  pages integer,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE library_loans (
  id text PRIMARY KEY,
  book_id text REFERENCES library_books(id),
  book_title text,
  student_id text,
  student_name text,
  class_id text,
  loan_date timestamp with time zone,
  due_date timestamp with time zone,
  return_date timestamp with time zone,
  status text,
  notes text,
  borrowed_by text,
  borrowed_by_name text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Stock Tables

CREATE TABLE suppliers (
  id text PRIMARY KEY,
  name text NOT NULL,
  contact text,
  phone text,
  email text,
  address text,
  rc text,
  ice text,
  city text,
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE stock_items (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  category text,
  type text,
  quantity integer,
  min_quantity integer,
  max_quantity integer,
  unit text,
  price numeric,
  total_value numeric,
  location text,
  supplier_id text REFERENCES suppliers(id),
  barcode text,
  image_url text,
  is_active boolean DEFAULT true,
  expires_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE stock_transactions (
  id text PRIMARY KEY,
  item_id text REFERENCES stock_items(id),
  type text,
  quantity integer,
  previous_quantity integer,
  new_quantity integer,
  user_id text,
  user_name text,
  date timestamp with time zone,
  reason text,
  reference text,
  recipient_id text,
  recipient_type text,
  product_type text,
  due_date timestamp with time zone,
  return_date timestamp with time zone,
  condition_on_return text,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);


-- ENABLE RLS & Create permissive policies (Allow all for development)

ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON schools FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON classes FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON teachers FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON students FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE salles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON salles FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON subjects FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON levels FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON grades FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE timetables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON timetables FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE library_books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON library_books FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE library_loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON library_loans FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON suppliers FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE stock_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON stock_items FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE stock_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON stock_transactions FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE monthly_payments (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    school_id TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    month INTEGER NOT NULL,
    base_amount NUMERIC NOT NULL,
    transport_amount NUMERIC DEFAULT 0,
    discount NUMERIC DEFAULT 0,
    paid_amount NUMERIC NOT NULL,
    status TEXT NOT NULL,
    payment_date TIMESTAMP WITH TIME ZONE,
    payment_method TEXT,
    receipt_number TEXT,
    notes TEXT,
    paid_by TEXT,
    paid_by_name TEXT,
    payer_type TEXT,
    payer_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, school_id, academic_year, month)
);

CREATE TABLE notifications (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    read BOOLEAN DEFAULT FALSE,
    priority TEXT DEFAULT 'normal',
    action_url TEXT,
    deleted BOOLEAN DEFAULT FALSE
);

ALTER TABLE monthly_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON monthly_payments FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON notifications FOR ALL USING (true) WITH CHECK (true);
