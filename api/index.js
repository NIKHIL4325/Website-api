const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors'); 
const app = express();

const port = process.env.PORT || 3000;

// --- API Security & CORS Configuration ---
// Match this key to the value in your Render Environment Variables!
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'your-very-secret-key-123'; 
const productsPath = path.join(__dirname, 'data/products.json');
const cartPath = path.join(__dirname, 'data/cart.json');

// Middleware to check for Admin authorization
const checkAdmin = (req, res, next) => {
  const apiKey = req.headers['x-admin-key'];
  if (apiKey && apiKey === ADMIN_API_KEY) {
    next(); // Admin key is valid
  } else {
    res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
};

// Configure CORS (UPDATE 'YOUR-NETLIFY-SITE.netlify.app' with your actual domain)
const allowedOrigins = [
  'http://localhost:3000', // For local testing
  'https://YOUR-NETLIFY-SITE.netlify.app' // YOUR DEPLOYED FRONT-END URL
]; 
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));
// -----------------------------------------

// Middleware to parse JSON bodies
app.use(express.json());

// Helper function to read/write JSON files
const readJsonFile = (filePath) => {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
        if (filePath.includes('cart.json')) return []; // Start with an empty cart if not found
        if (filePath.includes('products.json')) return []; // Start with empty products if not found
        throw error;
    }
};
const writeJsonFile = (filePath, data) => fs.writeFileSync(filePath, JSON.stringify(data, null, 2));


// --- CUSTOMER APIs (Read-Only Products, Cart Operations) ---

// API: Get all products
app.get('/api/products', (req, res) => {
  try {
    const products = readJsonFile(productsPath);
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read products data' });
  }
});

// API: Get product by ID
app.get('/api/products/:id', (req, res) => {
  try {
    const products = readJsonFile(productsPath);
    const product = products.find(p => p.id === parseInt(req.params.id));
    if (product) {
      res.json(product);
    } else {
      res.status(404).json({ error: 'Product not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to read products data' });
  }
});

// API: Get cart
app.get('/api/cart', (req, res) => {
  try {
    const cart = readJsonFile(cartPath);
    res.json(cart);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read cart data' });
  }
});

// API: Add to cart
app.post('/api/cart', (req, res) => {
  try {
    let cart = readJsonFile(cartPath);
    // Ensure only necessary fields are saved in the cart
    const { id, name, price, images } = req.body;
    cart.push({ id, name, price, images });
    writeJsonFile(cartPath, cart);
    res.status(201).json(cart);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update cart' });
  }
});

// API: Remove from cart by index
app.delete('/api/cart/:index', (req, res) => {
  try {
    let cart = readJsonFile(cartPath);
    const index = parseInt(req.params.index);
    if (index >= 0 && index < cart.length) {
      cart.splice(index, 1);
      writeJsonFile(cartPath, cart);
      res.json(cart);
    } else {
      res.status(404).json({ error: 'Item not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to update cart' });
  }
});

// --- ADMIN ONLY APIs (Protected by checkAdmin middleware) ---

// API: Add new product
app.post('/api/admin/products', checkAdmin, (req, res) => {
  try {
    const products = readJsonFile(productsPath);
    const newProduct = req.body;
    // Assign a new sequential ID
    const maxId = products.length > 0 ? Math.max(...products.map(p => p.id)) : 0;
    newProduct.id = maxId + 1; 
    
    // Simple validation
    if (!newProduct.name || !newProduct.price || !newProduct.description || !newProduct.images || newProduct.images.length === 0) {
        return res.status(400).json({ error: 'Missing required product fields.' });
    }

    products.push(newProduct);
    writeJsonFile(productsPath, products);
    res.status(201).json(newProduct);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add product' });
  }
});

// API: Delete product by ID
app.delete('/api/admin/products/:id', checkAdmin, (req, res) => {
  try {
    let products = readJsonFile(productsPath);
    const id = parseInt(req.params.id);
    const initialLength = products.length;
    products = products.filter(p => p.id !== id);
    if (products.length < initialLength) {
      writeJsonFile(productsPath, products);
      res.status(204).end(); // 204 No Content on successful deletion
    } else {
      res.status(404).json({ error: 'Product not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete product' });
  }
});


// Start server
app.listen(port, () => {
  console.log(`Server running at port ${port}`);
});
