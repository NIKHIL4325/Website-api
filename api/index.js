const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors'); 
const app = express();

// PORT variable is ignored by Vercel serverless, but kept for context
const port = process.env.PORT || 3000; 

// VERCEL ENVIRONMENT VARIABLE: ADMIN_API_KEY
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'your-very-secret-key-123'; 

// --- CRITICAL FIX: Use process.cwd() for robust path resolution on Vercel ---
// This ensures the serverless function finds the data folder correctly.
const productsPath = path.join(process.cwd(), 'data', 'products.json'); 
const cartPath = path.join(process.cwd(), 'data', 'cart.json');
// --------------------------------------------------------------------------

// Middleware to check for Admin authorization
const checkAdmin = (req, res, next) => {
  const apiKey = req.headers['x-admin-key'];
  if (apiKey && apiKey === ADMIN_API_KEY) {
    next();
  } else {
    res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
};

// CORS Configuration: MUST include the actual URL of your deployed Netlify frontend site
const allowedOrigins = [
  'http://localhost:3000', 
  // !!! REPLACE THIS PLACEHOLDER WITH YOUR ACTUAL NETLIFY DOMAIN URL AFTER FRONTEND DEPLOYMENT !!!
  'https://YOUR-NETLIFY-SITE.netlify.app' 
]; 
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  }
}));
// -----------------------------------------

app.use(express.json());

// Helper function to read/write JSON files
const readJsonFile = (filePath) => {
    try {
        // Read initial data from the file system
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
        // Return empty array if file is missing (e.g., cart on first run)
        if (path.basename(filePath) === 'cart.json') return [];
        if (path.basename(filePath) === 'products.json') {
             console.error("CRITICAL: Products file not found or invalid JSON:", error.message);
             return [];
        }
        console.error(`File read error for ${filePath}:`, error.message); 
        throw error;
    }
};
const writeJsonFile = (filePath, data) => {
    // IMPORTANT NOTE: This write function only works temporarily on the serverless 
    // container and is not persistent across subsequent requests.
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
         console.warn(`Write operation failed/ignored for ${path.basename(filePath)}. Data is non-persistent on Vercel.`);
    }
};


// --- CUSTOMER APIs ---

// GET /api/products
app.get('/api/products', (req, res) => {
  try {
    const products = readJsonFile(productsPath);
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read products data' });
  }
});

// GET /api/products/:id
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

// GET /api/cart
app.get('/api/cart', (req, res) => {
  try {
    const cart = readJsonFile(cartPath);
    res.json(cart);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read cart data' });
  }
});

// POST /api/cart
app.post('/api/cart', (req, res) => {
  try {
    let cart = readJsonFile(cartPath);
    const { id, name, price, images } = req.body;
    // Simple validation for cart item structure
    if (!id || !name || typeof price !== 'number' || !images || !Array.isArray(images)) {
        return res.status(400).json({ error: 'Invalid cart item structure.' });
    }
    cart.push({ id, name, price, images });
    writeJsonFile(cartPath, cart);
    res.status(201).json(cart);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update cart' });
  }
});

// DELETE /api/cart/:index
app.delete('/api/cart/:index', (req, res) => {
  try {
    let cart = readJsonFile(cartPath);
    const index = parseInt(req.params.index);
    if (index >= 0 && index < cart.length) {
      cart.splice(index, 1);
      writeJsonFile(cartPath, cart);
      res.json(cart);
    } else {
      res.status(404).json({ error: 'Item index not found in cart' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to update cart' });
  }
});

// --- ADMIN ONLY APIs ---

// POST /api/admin/products
app.post('/api/admin/products', checkAdmin, (req, res) => {
  try {
    const products = readJsonFile(productsPath);
    const newProduct = req.body;
    // Basic ID generation
    const maxId = products.length > 0 ? Math.max(...products.map(p => p.id)) : 0;
    newProduct.id = maxId + 1; 
    
    // Server-side input validation
    if (!newProduct.name || !newProduct.price || !newProduct.description || !newProduct.images || newProduct.images.length === 0) {
        return res.status(400).json({ error: 'Missing required product fields (name, price, description, images).' });
    }

    products.push(newProduct);
    writeJsonFile(productsPath, products);
    res.status(201).json(newProduct);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add product' });
  }
});

// DELETE /api/admin/products/:id
app.delete('/api/admin/products/:id', checkAdmin, (req, res) => {
  try {
    let products = readJsonFile(productsPath);
    const id = parseInt(req.params.id);
    const initialLength = products.length;
    products = products.filter(p => p.id !== id);
    if (products.length < initialLength) {
      writeJsonFile(productsPath, products);
      res.status(204).end(); // 204 No Content for successful deletion
    } else {
      res.status(404).json({ error: 'Product not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete product' });
  }
});


// EXPORT the Express app for Vercel Serverless Function
module.exports = app; 
