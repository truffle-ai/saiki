-- Sample database schema and data for the Database Interaction Agent
-- This demonstrates the types of operations the agent can perform

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    is_active BOOLEAN DEFAULT 1
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    category TEXT NOT NULL,
    stock_quantity INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Insert sample users
INSERT INTO users (name, email) VALUES 
    ('John Doe', 'john@example.com'),
    ('Jane Smith', 'jane@example.com'),
    ('Bob Johnson', 'bob@example.com'),
    ('Alice Brown', 'alice@example.com'),
    ('Charlie Wilson', 'charlie@example.com');

-- Insert sample products
INSERT INTO products (name, description, price, category, stock_quantity) VALUES 
    ('Laptop', 'High-performance laptop for professionals', 899.99, 'Electronics', 15),
    ('Smartphone', 'Latest smartphone with advanced features', 699.99, 'Electronics', 25),
    ('Coffee Maker', 'Automatic coffee maker for home use', 89.99, 'Home & Kitchen', 30),
    ('Running Shoes', 'Comfortable running shoes for athletes', 129.99, 'Sports', 20),
    ('Backpack', 'Durable backpack for daily use', 49.99, 'Fashion', 40),
    ('Bluetooth Speaker', 'Portable wireless speaker', 79.99, 'Electronics', 18),
    ('Yoga Mat', 'Non-slip yoga mat for fitness', 29.99, 'Sports', 35),
    ('Desk Lamp', 'LED desk lamp with adjustable brightness', 39.99, 'Home & Kitchen', 22);

-- Insert sample orders
INSERT INTO orders (user_id, total_amount, status) VALUES 
    (1, 899.99, 'completed'),
    (2, 209.98, 'completed'),
    (3, 159.98, 'pending'),
    (4, 699.99, 'completed'),
    (5, 89.99, 'shipped');

-- Insert sample order items
INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES 
    (1, 1, 1, 899.99),  -- John bought a laptop
    (2, 3, 1, 89.99),   -- Jane bought a coffee maker
    (2, 7, 1, 29.99),   -- Jane also bought a yoga mat
    (2, 8, 1, 39.99),   -- Jane also bought a desk lamp
    (3, 5, 1, 49.99),   -- Bob bought a backpack
    (3, 6, 1, 79.99),   -- Bob also bought a bluetooth speaker
    (3, 8, 1, 39.99),   -- Bob also bought a desk lamp
    (4, 2, 1, 699.99),  -- Alice bought a smartphone
    (5, 3, 1, 89.99);   -- Charlie bought a coffee maker

-- Update some user last_login times
UPDATE users SET last_login = datetime('now', '-1 day') WHERE id = 1;
UPDATE users SET last_login = datetime('now', '-3 days') WHERE id = 2;
UPDATE users SET last_login = datetime('now', '-7 days') WHERE id = 3;
UPDATE users SET last_login = datetime('now', '-2 days') WHERE id = 4;
UPDATE users SET last_login = datetime('now', '-5 days') WHERE id = 5;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id); 