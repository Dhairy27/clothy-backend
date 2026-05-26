const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const crypto = require('crypto');
require('dotenv').config(); // Ensure dotenv is loaded if not already

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/sources', express.static(path.join(__dirname, '../frontend/sources')));

// Ensure database connection before API/Auth routes (important for serverless functions)
app.use(async (req, res, next) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/auth')) {
    return next();
  }
  try {
    await connectToMongo();
    next();
  } catch (err) {
    res.status(500).json({ error: 'Database connection failed', details: err.message });
  }
});

// Multer Configuration for Image Uploads
const multer = require('multer');
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../frontend/images/uploads');
    // Ensure directory exists (recursive: true is for node 10+, but harmless if dir exists)
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Unique filename: timestamp + random + extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Initialize MongoDB connection
const mongoUrl = process.env.MONGODB_URL || 'mongodb://localhost:27017';
const client = new MongoClient(mongoUrl);
let db;


// Passport Configuration
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "http://localhost:3000/auth/google/callback"
},
  async function (accessToken, refreshToken, profile, cb) {
    try {
      // Check if db is initialized
      if (!db) {
        return cb(new Error('Database not initialized'), null);
      }

      const email = profile.emails[0].value;

      // Check if user exists
      let user = await db.collection('users').findOne({ email: email });

      if (!user) {
        // Create new user
        const newUser = {
          firstName: profile.name.givenName,
          lastName: profile.name.familyName,
          email: email,
          password: '', // No password for Google users
          googleId: profile.id,
          profileImage: profile.photos ? profile.photos[0].value : null,
          createdAt: new Date(),
          updatedAt: new Date(),
          type: 'user'
        };
        const result = await db.collection('users').insertOne(newUser);
        user = { ...newUser, _id: result.insertedId };
      } else {
        // Update existing user with Google ID if needed
        if (!user.googleId) {
          await db.collection('users').updateOne(
            { _id: user._id },
            { $set: { googleId: profile.id, profileImage: profile.photos ? profile.photos[0].value : user.profileImage } }
          );
        }
      }
      return cb(null, user);
    } catch (err) {
      return cb(err, null);
    }
  }
));

let dbPromise = null;

// Connect to MongoDB (reusing database connection in serverless environment)
async function connectToMongo() {
  if (!dbPromise) {
    dbPromise = (async () => {
      try {
        await client.connect();
        db = client.db('clothing_store');
        console.log('Connected to MongoDB database.');
        await initializeDatabase();
        return db;
      } catch (err) {
        console.error('Error connecting to MongoDB:', err.message);
        dbPromise = null; // Reset promise so next request can retry connection
        throw err;
      }
    })();
  }
  return dbPromise;
}

// Create database collections and indexes
async function initializeDatabase() {
  try {
    // Check if collections exist, create if they don't
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);

    if (!collectionNames.includes('users')) {
      await db.createCollection('users');
    }
    if (!collectionNames.includes('products')) {
      await db.createCollection('products');
    }
    if (!collectionNames.includes('orders')) {
      await db.createCollection('orders');
    }
    if (!collectionNames.includes('order_items')) {
      await db.createCollection('order_items');
    }
    if (!collectionNames.includes('addresses')) {
      await db.createCollection('addresses');
    }
    if (!collectionNames.includes('cart')) {
      await db.createCollection('cart');
    }
    if (!collectionNames.includes('categories')) {
      await db.createCollection('categories');
    }

    // Initialize default categories
    await initializeCategories();

    // Create indexes
    // Users collection
    await db.collection('users').createIndex({ email: 1 }, { unique: true });

    // Products collection
    await db.collection('products').createIndex({ category: 1 });
    await db.collection('products').createIndex({ createdAt: -1 });

    // Orders collection - remove any problematic orderId indexes
    try {
      await db.collection('orders').dropIndex('orderId_1');
    } catch (error) {
      // Silently handle index drop - no notification needed
    }

    await db.collection('orders').createIndex({ userId: 1 });
    await db.collection('orders').createIndex({ createdAt: -1 });

    console.log('Database collections initialized successfully');

    // Cart collection - update indexes for size-wise uniqueness
    await db.collection('cart').createIndex({ userId: 1, productName: 1, size: 1 }, { unique: true });
    await db.collection('cart').createIndex({ username: 1 });

    // Addresses collection
    await db.collection('addresses').createIndex({ userId: 1 });
    await db.collection('addresses').createIndex({ isDefault: -1, createdAt: -1 });

    console.log('Database collections initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

// Initialize database with default categories if they don't exist
async function initializeCategories() {
  const existingCategories = await db.collection('categories').countDocuments();
  if (existingCategories === 0) {
    const defaultCategories = [
      { name: 'T-Shirts', description: 'Comfortable t-shirts in various colors and styles', createdAt: new Date(), createdBy: 'system' },
      { name: 'Shirts', description: 'Formal and casual shirts for all occasions', createdAt: new Date(), createdBy: 'system' },
      { name: 'Jeans', description: 'Denim jeans in different fits and styles', createdAt: new Date(), createdBy: 'system' }
    ];
    await db.collection('categories').insertMany(defaultCategories);
    console.log('Default categories initialized');
  }
}

// Clean up existing address documents to remove firstName and lastName fields
async function cleanupAddressFields() {
  try {
    console.log('Cleaning up firstName and lastName fields from existing addresses...');

    // Remove firstName and lastName from all existing address documents
    const result = await db.collection('addresses').updateMany(
      {}, // Match all documents
      {
        $unset: { firstName: "", lastName: "" } // Remove these fields
      }
    );

    console.log(`Cleaned up ${result.modifiedCount} address documents`);
    return result.modifiedCount;
  } catch (error) {
    console.error('Error cleaning up address fields:', error);
    return 0;
  }
}

// Clean up existing user documents to remove address field
async function cleanupUserAddressFields() {
  try {
    console.log('Cleaning up address field from existing users...');

    // Remove address from all existing user documents
    const result = await db.collection('users').updateMany(
      {}, // Match all documents
      {
        $unset: { address: "" } // Remove address field
      }
    );

    console.log(`Cleaned up ${result.modifiedCount} user documents`);
    return result.modifiedCount;
  } catch (error) {
    console.error('Error cleaning up user address fields:', error);
    return 0;
  }
}

// Utility functions
function generateToken(user) {
  return jwt.sign({ id: user._id.toString(), email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  // Check if it's an admin token (mock token for admin)
  if (token.startsWith('admin-mock-token-')) {
    // For admin routes, we'll use a simple admin authentication
    req.user = { id: 'admin', email: 'admin@clothy.com', isAdmin: true };
    return next();
  }

  // For regular users, verify JWT token
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
}

// Auth Routes
app.post('/api/register', async (req, res) => {
  try {
    const { firstName, lastName, email, phone, password, type } = req.body;

    // Check if user already exists
    const existingUser = await db.collection('users').findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const newUser = {
      firstName,
      lastName,
      email,
      phone,
      password: hashedPassword,
      type: type || 'user', // Use provided type or default to 'user'
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('users').insertOne(newUser);

    // Get created user
    const user = await db.collection('users').findOne({ _id: result.insertedId });

    const token = generateToken(user);
    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        address: user.address,
        type: user.type || 'user'
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await db.collection('users').findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Compare password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user);
    res.json({
      message: 'Login successful',
      token,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        address: user.address,
        type: user.type || 'user'
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Forgot Password Flow
app.post('/api/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await db.collection('users').findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'User with this email does not exist' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: { resetToken, resetTokenExpiry } }
    );

    // MOCK MODE: Provide reset link for testing since no SMTP is configured
    const resetLink = `http://localhost:${PORT}/reset-password.html?token=${resetToken}`;
    console.log(`[MOCK EMAIL] Password reset requested for ${email}. Link: ${resetLink}`);

    res.json({
      message: 'Password reset link generated',
      resetLink // Return back to frontend for easy testing
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const user = await db.collection('users').findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: new Date() } // Token must be valid
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.collection('users').updateOne(
      { _id: user._id },
      {
        $set: { password: hashedPassword, updatedAt: new Date() },
        $unset: { resetToken: "", resetTokenExpiry: "" }
      }
    );

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Profile Routes
app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const user = await db.collection('users').findOne({ _id: new ObjectId(req.user.id) });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Remove password from response
    delete user.password;
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/profile', authenticateToken, async (req, res) => {
  try {
    const { firstName, lastName, phone, address } = req.body;

    const updateData = {
      firstName,
      lastName,
      phone,
      address,
      updatedAt: new Date()
    };

    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(req.user.id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error updating profile' });
  }
});

// Cart Routes
app.get('/api/cart', authenticateToken, async (req, res) => {
  try {
    const items = await db.collection('cart').find({ userId: new ObjectId(req.user.id) }).toArray();
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/cart', authenticateToken, async (req, res) => {
  try {
    const { productName, productId, price, quantity = 1, size } = req.body;

    console.log('POST /api/cart - User ID:', req.user.id);
    console.log('POST /api/cart - Product:', productName, 'ID:', productId, 'Price:', price, 'Size:', size);

    // Get user information to include username
    const user = await db.collection('users').findOne({ _id: new ObjectId(req.user.id) });
    if (!user) {
      console.log('POST /api/cart - User not found');
      return res.status(404).json({ error: 'User not found' });
    }

    // Create username from firstName and lastName
    const username = ((user.firstName || '') + ' ' + (user.lastName || '')).trim() || user.email || 'Unknown';
    console.log('POST /api/cart - Username:', username);

    // Check if item already exists in cart (including size)
    // process.env.DISABLE_PRODUCT_ID_CHECK can be used if needed during migration, but we'll assume we want strict checks now
    const cartQuery = {
      userId: new ObjectId(req.user.id),
      productName
    };

    // If size is provided, include it in the query to make it unique per size
    if (size) {
      cartQuery.size = size;
    }

    const existingItem = await db.collection('cart').findOne(cartQuery);

    if (existingItem) {
      // Update quantity
      await db.collection('cart').updateOne(
        cartQuery,
        {
          $inc: { quantity: 1 },
          $set: { username: username, updatedAt: new Date() }
        }
      );
      console.log('POST /api/cart - Item updated');
      res.json({ message: 'Cart updated successfully' });
    } else {
      // Add new item
      const newItem = {
        userId: new ObjectId(req.user.id),
        username: username,
        productName,
        productId, // Store product ID
        price,
        quantity,
        size: size || null, // Store selected size
        createdAt: new Date()
      };
      const result = await db.collection('cart').insertOne(newItem);
      console.log('POST /api/cart - Item inserted:', result.insertedId);
      res.json({ message: 'Item added to cart successfully', itemId: result.insertedId });
    }
  } catch (error) {
    console.error('POST /api/cart - Error:', error);
    res.status(500).json({ error: 'Error updating cart' });
  }
});

app.put('/api/cart/:id', authenticateToken, async (req, res) => {
  try {
    console.log('PUT /api/cart/:id called');
    console.log('Params:', req.params);
    console.log('Body:', req.body);

    const itemId = new ObjectId(req.params.id);
    const { quantity } = req.body;

    if (!quantity || quantity < 1) {
      return res.status(400).json({ error: 'Valid quantity is required' });
    }

    // Fetch the cart item to get productId and size
    const cartItem = await db.collection('cart').findOne({
      _id: itemId,
      userId: new ObjectId(req.user.id)
    });

    if (!cartItem) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Fetch the product to check stock
    if (cartItem.productId) {
      const product = await db.collection('products').findOne({ _id: new ObjectId(cartItem.productId) });

      if (product) {
        let availableStock = 0;

        // Determine available stock based on size or global stock
        if (cartItem.size && product.sizes) {
          // Check specific size stock
          // Handle case-insensitive keys if needed, but assuming exact match for now
          availableStock = product.sizes[cartItem.size] !== undefined ? product.sizes[cartItem.size] : 0;
        } else {
          // Fallback to legacy stock
          availableStock = product.stock || 0;
        }

        console.log(`Checking stock for ${product.name} (Size: ${cartItem.size}): Requested ${quantity}, Available ${availableStock}`);

        if (quantity > availableStock) {
          return res.status(400).json({
            error: `Only ${availableStock} items available for this size`
          });
        }
      }
    } else {
      console.log('Cart item missing productId, skipping strict stock check');
    }

    const result = await db.collection('cart').updateOne(
      { _id: itemId, userId: new ObjectId(req.user.id) },
      { $set: { quantity: parseInt(quantity), updatedAt: new Date() } }
    );

    res.json({ message: 'Cart updated successfully' });
  } catch (error) {
    console.error('Error updating cart item:', error);
    res.status(500).json({ error: 'Error updating cart item' });
  }
});

app.delete('/api/cart/:id', authenticateToken, async (req, res) => {
  try {
    const itemId = new ObjectId(req.params.id);

    const result = await db.collection('cart').deleteOne({
      _id: itemId,
      userId: new ObjectId(req.user.id)
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ message: 'Item removed from cart successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error removing item' });
  }
});

app.delete('/api/cart', authenticateToken, async (req, res) => {
  try {
    await db.collection('cart').deleteMany({ userId: new ObjectId(req.user.id) });
    res.json({ message: 'Cart cleared successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error clearing cart' });
  }
});

// Products Routes
app.get('/api/products', async (req, res) => {
  try {
    const { category, collection } = req.query;

    let query = {};
    if (category) {
      query.category = category;
    }

    // Support filtering by collection tag (e.g. 'best-collection')
    if (collection) {
      query.collections = collection;
    }

    const products = await db.collection('products')
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/products', upload.array('images', 10), async (req, res) => {
  try {
    const { name, category, price, description, stock, inCollection } = req.body;

    // Parse complex fields that might come as JSON strings from FormData
    let sizes = req.body.sizes;
    let colors = req.body.colors;
    let imagePath = req.body.image; // Legacy/Manual path

    try {
      if (typeof sizes === 'string') sizes = JSON.parse(sizes);
    } catch (e) {
      console.error('Error parsing sizes:', e);
      sizes = {};
    }

    try {
      if (typeof colors === 'string') colors = JSON.parse(colors);
    } catch (e) {
      console.error('Error parsing colors:', e);
      colors = [];
    }

    // Process uploaded files
    let uploadedImages = [];
    if (req.files && req.files.length > 0) {
      uploadedImages = req.files.map(file => `images/uploads/${file.filename}`);
    }

    // Determine primary image
    // If uploaded images exist, use the first one. Otherwise use the manual path.
    const primaryImage = uploadedImages.length > 0 ? uploadedImages[0] : (imagePath || '');

    // Combine manual path with uploaded images if needed, or just keep uploaded
    // For now, let's say primaryImage is the main one, and images array contains all uploaded + manual if valid?
    // Let's keep it simple: images array = uploadedImages. If manual path exists, maybe add it too?
    // User might paste a URL AND upload files.

    const allImages = [...uploadedImages];
    if (imagePath && !uploadedImages.includes(imagePath)) {
      // Only add if it's not empty
      allImages.unshift(imagePath); // Add URL/Path to beginning? Or end?
    }

    // Validate required fields
    if (!name || !category || !price) {
      return res.status(400).json({ error: 'Name, category, and price are required' });
    }

    // Handle size-wise stock or legacy single stock (logic from previous version tailored for formdata parsing)
    let sizeStock = {};
    if (sizes && typeof sizes === 'object') {
      sizeStock = sizes;
    } else if (stock !== undefined) {
      // If stock came as string "0" or "10"
      const stockNum = parseInt(stock);
      if (!isNaN(stockNum)) {
        sizeStock = { 'One Size': stockNum };
      }
    }

    const newProduct = {
      name,
      category,
      price: parseFloat(price),
      image: primaryImage, // For backward compatibility
      images: allImages,   // New array field
      description: description || '',
      stock: parseInt(stock) || 0,
      sizes: sizeStock,
      colors: Array.isArray(colors) ? colors : [],
      inCollection: inCollection === 'true' || inCollection === true, // Handle string 'true' from FormData
      createdAt: new Date(),
      createdBy: 'admin'
    };

    console.log('Creating product with images:', allImages);

    const result = await db.collection('products').insertOne(newProduct);
    console.log('Product created with ID:', result.insertedId);

    res.status(201).json({
      message: 'Product created successfully',
      productId: result.insertedId,
      images: allImages
    });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Error creating product: ' + error.message });
  }
});

// Orders Routes
app.get('/api/orders', authenticateToken, async (req, res) => {
  try {
    const orders = await db.collection('orders')
      .find({ userId: new ObjectId(req.user.id) })
      .sort({ createdAt: -1 })
      .toArray();

    // Add order items to each order
    const ordersWithItems = await Promise.all(orders.map(async (order) => {
      const orderItems = await db.collection('order_items')
        .find({ orderId: order._id })
        .toArray();

      return {
        ...order,
        items: orderItems.map(item => ({
          _id: item._id,
          productName: item.productName,
          name: item.productName,
          price: item.price,
          quantity: item.quantity,
          size: item.size, // Include size information
          total: item.price * item.quantity
        }))
      };
    }));

    res.json(ordersWithItems);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/orders', authenticateToken, async (req, res) => {
  try {
    console.log('Order request body:', req.body);
    const { items, totalAmount, shippingAddressId, paymentMethod, utrNumber } = req.body;

    // Simple validation - just check basic required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items are required' });
    }

    if (!totalAmount || totalAmount <= 0) {
      return res.status(400).json({ error: 'Valid total amount is required' });
    }

    if (!paymentMethod) {
      return res.status(400).json({ error: 'Payment method is required' });
    }

    // Validate UTR for UPI payments
    if (paymentMethod === 'upi') {
      if (!utrNumber) {
        return res.status(400).json({ error: 'UTR number is required for UPI payments' });
      }
      if (typeof utrNumber !== 'string' || utrNumber.length !== 12 || !/^\d+$/.test(utrNumber)) {
        return res.status(400).json({ error: 'UTR number must be exactly 12 digits' });
      }
    }

    // Get address details - no ownership check
    let shippingAddress = null;
    if (shippingAddressId) {
      shippingAddress = await db.collection('addresses').findOne({
        _id: new ObjectId(shippingAddressId)
      });
    }

    // Create simple order object - no past order checks
    const newOrder = {
      userId: new ObjectId(req.user.id),
      totalAmount,
      status: 'pending',
      shippingAddress: shippingAddress ? {
        name: shippingAddress.name || '',
        email: shippingAddress.email || '',
        phone: shippingAddress.phone || '',
        house: shippingAddress.house || '',
        street: shippingAddress.address || shippingAddress.street || '',
        city: shippingAddress.city || '',
        state: shippingAddress.state || '',
        zipCode: shippingAddress.zipCode || '',
        country: shippingAddress.country || 'IN'
      } : null,
      paymentMethod,
      utrNumber: paymentMethod === 'upi' ? utrNumber : null, // Store UTR only for UPI payments
      createdAt: new Date()
    };

    console.log('Creating order:', JSON.stringify(newOrder, null, 2));

    const orderResult = await db.collection('orders').insertOne(newOrder);
    const orderId = orderResult.insertedId;
    console.log('Order created with ID:', orderId);

    // Create order items - simple mapping with size information
    const orderItems = items.map(item => ({
      orderId: new ObjectId(orderId),
      productName: item.name,
      price: item.price,
      quantity: item.quantity,
      size: item.size || null // Store selected size
    }));

    // Add COD charge as separate item if payment method is COD
    if (paymentMethod === 'cod') {
      orderItems.push({
        orderId: new ObjectId(orderId),
        productName: 'Cash on Delivery Charge',
        price: 10,
        quantity: 1
      });
      console.log('Added COD charge as separate order item');
    }

    await db.collection('order_items').insertMany(orderItems);
    console.log('Order items created');

    // Update product stock
    for (const item of items) {
      // Frontend sends productId (mapped from item.id), but let's check both to be safe
      const prodId = item.productId || item.id;

      if (prodId) {
        try {
          const product = await db.collection('products').findOne({ _id: new ObjectId(prodId) });
          if (product) {
            const updateOps = {};

            // Decrement legacy stock
            if (product.stock !== undefined) {
              updateOps.stock = -item.quantity;
            }

            // Decrement size-specific stock if size is provided
            if (item.size && product.sizes) {
              // Handle case-insensitive size keys if needed, but for update we need exact key
              // Assuming standard keys S, M, L, XL, XXL are used consistently
              const sizeKey = `sizes.${item.size}`;
              updateOps[sizeKey] = -item.quantity;
            }

            if (Object.keys(updateOps).length > 0) {
              await db.collection('products').updateOne(
                { _id: new ObjectId(prodId) },
                { $inc: updateOps }
              );
              console.log(`Updated stock for product ${prodId} (Size: ${item.size || 'N/A'})`);
            }
          }
        } catch (stockError) {
          console.error(`Error updating stock for product ${prodId}:`, stockError);
          // Continue with order creation even if stock update fails, but log it
        }
      }
    }

    // Clear cart - no user checks
    await db.collection('cart').deleteMany({ userId: new ObjectId(req.user.id) });

    res.status(201).json({
      message: 'Order created successfully',
      orderId
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Error creating order: ' + error.message });
  }
});

// ...
// Address Management Routes
app.get('/api/user/addresses', authenticateToken, async (req, res) => {
  try {
    const addresses = await db.collection('addresses')
      .find({ userId: new ObjectId(req.user.id) })
      .sort({ isDefault: -1, createdAt: -1 })
      .toArray();

    res.json(addresses);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/user/addresses', authenticateToken, async (req, res) => {
  try {
    console.log('Raw request body:', req.body); // Debug raw request body

    const { type, name, email, house, street, city, state, zipCode, country, phone, isDefault } = req.body;

    console.log('Received address data:', { type, name, email, house, street, city, state, zipCode, country, phone, isDefault }); // Debug log
    console.log('Email field debugging:', {
      email: email,
      emailType: typeof email,
      emailLength: email ? email.length : 0,
      emailIsEmpty: !email || email === '',
      emailIsUndefined: email === undefined,
      emailIsNull: email === null
    }); // Specific email debugging

    // Specific debugging for name field
    console.log('Name field debugging:', {
      name: name,
      nameType: typeof name,
      nameLength: name ? name.length : 0,
      nameIsEmpty: !name || name === ''
    });

    // Log to check if email exists in the data to be saved
    console.log('Email in newAddress object will be:', email);

    // If setting as default, unset other default addresses
    if (isDefault) {
      await db.collection('addresses').updateMany(
        { userId: new ObjectId(req.user.id) },
        { $set: { isDefault: false } }
      );
    }

    const newAddress = {
      userId: new ObjectId(req.user.id),
      type,
      name,
      email,
      house,
      street,
      city,
      state,
      zipCode,
      country,
      phone,
      isDefault: isDefault || false,
      createdAt: new Date()
    };

    console.log('New address to be saved:', newAddress); // Debug log

    // Specifically check if name and email are in the object being saved
    console.log('Name and email fields in newAddress object:', {
      name: newAddress.name,
      email: newAddress.email
    });

    const result = await db.collection('addresses').insertOne(newAddress);

    res.status(201).json({
      message: 'Address added successfully',
      addressId: result.insertedId
    });
  } catch (error) {
    console.error('Error adding address:', error); // Debug log
    res.status(500).json({ error: 'Error adding address' });
  }
});

app.put('/api/user/addresses/:id', authenticateToken, async (req, res) => {
  try {
    const addressId = new ObjectId(req.params.id);
    const { type, name, email, house, street, city, state, zipCode, country, phone, isDefault } = req.body;

    // If setting as default, unset other default addresses
    if (isDefault) {
      await db.collection('addresses').updateMany(
        { userId: new ObjectId(req.user.id), _id: { $ne: addressId } },
        { $set: { isDefault: false } }
      );
    }

    const updateData = {
      type,
      name,
      email,
      house,
      street,
      city,
      state,
      zipCode,
      country,
      phone,
      isDefault: isDefault || false,
      updatedAt: new Date()
    };

    const result = await db.collection('addresses').updateOne(
      { _id: addressId, userId: new ObjectId(req.user.id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Address not found' });
    }

    res.json({ message: 'Address updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error updating address' });
  }
});

app.delete('/api/user/addresses/:id', authenticateToken, async (req, res) => {
  try {
    const addressId = new ObjectId(req.params.id);

    const result = await db.collection('addresses').deleteOne({
      _id: addressId,
      userId: new ObjectId(req.user.id)
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Address not found' });
    }

    res.json({ message: 'Address deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error deleting address' });
  }
});

// Admin Routes
app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await db.collection('users').find({}).toArray();
    // Remove passwords from response
    const usersWithoutPasswords = users.map(user => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
    res.json(usersWithoutPasswords);
  } catch (error) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/admin/orders', async (req, res) => {
  try {
    const orders = await db.collection('orders').find({}).sort({ createdAt: -1 }).toArray();

    // Add customer names and items to orders
    const ordersWithDetails = await Promise.all(orders.map(async (order) => {
      // Get customer information
      let customerName = 'Guest';
      if (order.userId) {
        const user = await db.collection('users').findOne({ _id: order.userId });
        customerName = user ? `${user.firstName} ${user.lastName}` : 'Unknown';
      }

      // Get order items with size information
      const orderItems = await db.collection('order_items')
        .find({ orderId: order._id })
        .toArray();

      return {
        ...order,
        customerName: customerName,
        items: orderItems.map(item => ({
          _id: item._id,
          name: item.productName,
          productName: item.productName,
          price: item.price,
          quantity: item.quantity,
          size: item.size || null,
          total: item.price * item.quantity
        }))
      };
    }));

    res.json(ordersWithDetails);
  } catch (error) {
    console.error('Error fetching admin orders:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/admin/orders/:id', async (req, res) => {
  try {
    const orderId = new ObjectId(req.params.id);

    console.log('Deleting order with ID:', orderId);

    // Delete order items first
    await db.collection('order_items').deleteMany({ orderId: orderId });

    // Delete the order
    const result = await db.collection('orders').deleteOne({ _id: orderId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    console.log('Order deleted successfully');
    res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({ error: 'Error deleting order: ' + error.message });
  }
});

app.put('/api/admin/orders/:id', async (req, res) => {
  try {
    const orderId = new ObjectId(req.params.id);
    const { status, paymentStatus } = req.body;

    console.log('Updating order with ID:', orderId);
    console.log('Update data:', { status, paymentStatus });

    // Check if order exists
    const order = await db.collection('orders').findOne({ _id: orderId });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Build update object
    const updateData = {};
    if (status) updateData.status = status;
    if (paymentStatus) updateData.paymentStatus = paymentStatus;

    // Add updated timestamp
    updateData.updatedAt = new Date();

    const result = await db.collection('orders').updateOne(
      { _id: orderId },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    console.log('Order updated successfully');
    res.json({ message: 'Order updated successfully' });
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ error: 'Error updating order' });
  }
});

// Get detailed order information
app.get('/api/admin/orders/:id/details', async (req, res) => {
  try {
    const orderId = new ObjectId(req.params.id);

    console.log('Fetching detailed order with ID:', orderId);

    // Get order details
    const order = await db.collection('orders').findOne({ _id: orderId });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Get order items with size information
    const orderItems = await db.collection('order_items')
      .find({ orderId: orderId })
      .toArray();

    // Get user information
    let customerInfo = {};
    if (order.userId) {
      const user = await db.collection('users').findOne({ _id: order.userId });
      if (user) {
        customerInfo = {
          customerName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
          userEmail: user.email,
          userPhone: user.phone
        };
      }
    }

    // Combine order data with items and customer info
    const detailedOrder = {
      ...order,
      ...customerInfo,
      items: orderItems.map(item => ({
        _id: item._id,
        name: item.productName,
        productName: item.productName,
        price: item.price,
        quantity: item.quantity,
        size: item.size || null,
        total: item.price * item.quantity
      }))
    };

    console.log('Detailed order fetched successfully');
    res.json(detailedOrder);

  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).json({ error: 'Error fetching order details: ' + error.message });
  }
});

// Add Stock to Product
app.post('/api/admin/products/:id/add-stock', async (req, res) => {
  try {
    const productId = new ObjectId(req.params.id);
    const { stockUpdate } = req.body;

    if (!stockUpdate || typeof stockUpdate !== 'object') {
      return res.status(400).json({ error: 'Stock update data is required' });
    }

    // Get current product
    const currentProduct = await db.collection('products').findOne({ _id: productId });
    if (!currentProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Initialize current sizes if not exists
    let currentSizes = currentProduct.sizes || {};
    if (Object.keys(currentSizes).length === 0) {
      // Convert legacy stock to size-wise if needed
      currentSizes = { 'One Size': currentProduct.stock || 0 };
    }

    // Add the new stock to existing stock
    let updatedSizes = { ...currentSizes };
    let totalStock = 0;

    Object.keys(stockUpdate).forEach(size => {
      const addQuantity = parseInt(stockUpdate[size]) || 0;
      if (addQuantity > 0) {
        updatedSizes[size] = (updatedSizes[size] || 0) + addQuantity;
      }
    });

    // Calculate total stock
    totalStock = Object.values(updatedSizes).reduce((sum, qty) => sum + qty, 0);

    // Update product with new stock
    const updateData = {
      stock: totalStock, // Keep for backward compatibility
      sizes: updatedSizes, // New size-wise stock
      updatedAt: new Date()
    };

    console.log('Adding stock to product with ID:', productId);
    console.log('Stock update:', stockUpdate);
    console.log('Updated sizes:', updatedSizes);

    const result = await db.collection('products').updateOne(
      { _id: productId },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    console.log('Stock added successfully');
    res.json({
      message: 'Stock added successfully',
      updatedStock: updatedSizes,
      totalStock: totalStock
    });
  } catch (error) {
    console.error('Error adding stock:', error);
    res.status(500).json({ error: 'Error adding stock: ' + error.message });
  }
});

app.delete('/api/admin/products/:id', async (req, res) => {
  try {
    const productId = new ObjectId(req.params.id);

    console.log('Deleting product with ID:', productId);

    const result = await db.collection('products').deleteOne({ _id: productId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    console.log('Product deleted successfully');
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Error deleting product: ' + error.message });
  }
});

app.put('/api/admin/products/:id', upload.array('images', 10), async (req, res) => {
  try {
    const productId = new ObjectId(req.params.id);
    console.log(`[PUT] Updating product ${productId}`);
    console.log('[PUT] req.body:', JSON.stringify(req.body, null, 2));
    console.log('[PUT] req.files:', req.files ? req.files.length : 0);

    const { name, category, price, description, stock, inCollection } = req.body;

    // Parse complex fields
    // ... (rest of parsing logic)

    // ...

    // Validate required fields
    if (!name || !category || !price) {
      const missing = [];
      if (!name) missing.push('name');
      if (!category) missing.push('category');
      if (!price) missing.push('price');
      console.error('[PUT] Validation failed. Missing:', missing);
      return res.status(400).json({ error: `Name, category, and price are required. Missing: ${missing.join(', ')}` });
    }

    // ... (rest of logic)
    let sizes = req.body.sizes;
    let colors = req.body.colors;
    let existingImages = req.body.existingImages; // Images to keep

    try {
      if (typeof sizes === 'string') sizes = JSON.parse(sizes);
    } catch (e) { sizes = {}; }

    try {
      if (typeof colors === 'string') colors = JSON.parse(colors);
    } catch (e) { colors = []; }

    // Process existing images
    let currentImages = [];
    if (existingImages) {
      if (Array.isArray(existingImages)) {
        currentImages = existingImages;
      } else {
        currentImages = [existingImages];
      }
    } else if (req.body.images) {
      // Fallback: use legacy 'images' array if provided
      if (Array.isArray(req.body.images)) {
        currentImages = req.body.images;
      } else if (typeof req.body.images === 'string') {
        // If it's a string (maybe JSON or single path), try to use it
        try {
          const parsed = JSON.parse(req.body.images);
          if (Array.isArray(parsed)) currentImages = parsed;
        } catch (e) {
          currentImages = [req.body.images];
        }
      }
    } else if (req.body.image) {
      // Fallback: use legacy 'image' field
      currentImages = [req.body.image];
    }

    // Process new uploaded files
    let newImages = [];
    if (req.files && req.files.length > 0) {
      newImages = req.files.map(file => `images/uploads/${file.filename}`);
    }

    // Combine images
    const allImages = [...currentImages, ...newImages];

    // Determine primary image (first one)
    const primaryImage = allImages.length > 0 ? allImages[0] : '';

    // Validate required fields
    if (!name || !category || !price) {
      return res.status(400).json({ error: 'Name, category, and price are required' });
    }

    // Handle size-wise stock
    let sizeStock = {};
    if (sizes && typeof sizes === 'object') {
      sizeStock = sizes;
    } else if (stock !== undefined) {
      const stockNum = parseInt(stock);
      if (!isNaN(stockNum)) sizeStock = { 'One Size': stockNum };
    }

    const updateData = {
      name,
      category,
      price: parseFloat(price),
      image: primaryImage,
      images: allImages,
      description: description || '',
      stock: parseInt(stock) || 0,
      sizes: sizeStock,
      colors: Array.isArray(colors) ? colors : [],
      inCollection: inCollection === 'true' || inCollection === true, // Handle string/bool
      updatedAt: new Date()
    };

    console.log('Updating product:', productId, 'Images:', allImages);

    const result = await db.collection('products').updateOne(
      { _id: productId },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    console.log('Product updated successfully');
    res.json({ message: 'Product updated successfully', images: allImages });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Error updating product: ' + error.message });
  }
});

// Get categories from separate categories collection
app.get('/api/categories', async (req, res) => {
  try {
    // Get all categories from categories collection
    const categories = await db.collection('categories')
      .find({})
      .sort({ name: 1 })
      .toArray();

    // console.log('Categories found:', categories);
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

// Add new category to separate categories collection
app.post('/api/admin/categories', async (req, res) => {
  try {
    const { name, description } = req.body;

    // Check if category already exists in categories collection
    const existingCategory = await db.collection('categories').findOne({
      name: { $regex: new RegExp(`^${name}$`, 'i') }
    });

    if (existingCategory) {
      return res.status(400).json({ error: 'Category already exists' });
    }

    // Create new category in categories collection
    const newCategory = {
      name,
      description: description || '',
      createdAt: new Date(),
      createdBy: 'admin'
    };

    await db.collection('categories').insertOne(newCategory);

    res.status(201).json(newCategory);
  } catch (error) {
    console.error('Error adding category:', error);
    res.status(500).json({ error: 'Error adding category' });
  }
});

// Group Products (Link as Colors)
app.post('/api/admin/products/group', async (req, res) => {
  try {
    const { productIds } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length < 2) {
      return res.status(400).json({ error: 'Please select at least 2 products to group.' });
    }

    console.log('[GROUP] Grouping products:', productIds);

    // Convert string IDs to ObjectIds
    const objectIds = productIds.map(id => new ObjectId(id));

    // Fetch the products to verify they exist and get details
    const products = await db.collection('products').find({ _id: { $in: objectIds } }).toArray();

    if (products.length !== productIds.length) {
      return res.status(404).json({ error: 'One or more products not found.' });
    }

    // For each product, link it to ALL other products in the group
    for (const product of products) {
      // Create the list of other products to link as colors
      const others = products.filter(p => !p._id.equals(product._id));

      const newColors = others.map(other => ({
        id: other._id.toString(),
        name: other.name, // Or a specific color name if we had it, fallback to product name
        image: other.image || (other.images && other.images.length > 0 ? other.images[0] : ''),
        hex: '#000000' // Default placeholder, user can edit later if we add that feature
      }));

      // Update the product
      await db.collection('products').updateOne(
        { _id: product._id },
        {
          $set: {
            colors: newColors,
            updatedAt: new Date()
          }
        }
      );
    }

    console.log('[GROUP] Successfully grouped products.');
    res.json({ message: 'Products successfully grouped and linked.' });

  } catch (error) {
    console.error('Error grouping products:', error);
    res.status(500).json({ error: 'Failed to group products: ' + error.message });
  }
});




// Ungroup Products (Remove Color Links)
app.post('/api/admin/products/ungroup', async (req, res) => {
  try {
    const { productIds } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ error: 'Please select products to ungroup.' });
    }

    console.log('[UNGROUP] Request to ungroup:', productIds);

    const objectIds = productIds.map(id => new ObjectId(id));

    // 1. Remove these products from the 'colors' array of ALL products
    // We do this by pulling elements from 'colors' array where 'id' matches any of our target IDs
    await db.collection('products').updateMany(
      {},
      {
        $pull: {
          colors: { id: { $in: productIds } }
        },
        $set: { updatedAt: new Date() }
      }
    );

    // 2. Clear the 'colors' array for the target products themselves
    // Since they are being ungrouped, they no longer have any color variants linked
    await db.collection('products').updateMany(
      { _id: { $in: objectIds } },
      {
        $set: {
          colors: [],
          updatedAt: new Date()
        }
      }
    );

    console.log('[UNGROUP] Successfully ungrouped products.');
    res.json({ message: 'Products successfully ungrouped.' });

  } catch (error) {
    console.error('[UNGROUP] Error:', error);
    res.status(500).json({ error: 'Failed to ungroup products: ' + error.message });
  }
});


// Admin User Management Routes
app.post('/api/admin/users', async (req, res) => {
  try {
    const { firstName, lastName, email, phone, password, address, type } = req.body;

    // Check if user already exists
    const existingUser = await db.collection('users').findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user with type
    const newUser = {
      firstName,
      lastName,
      email,
      phone,
      password: hashedPassword,
      address,
      type: type || 'user', // Use provided type or default to 'user'
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('users').insertOne(newUser);

    // Get created user
    const user = await db.collection('users').findOne({ _id: result.insertedId });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.status(201).json({
      message: 'User created successfully',
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Error creating user', details: error.message });
  }
});

app.put('/api/admin/users/:id', async (req, res) => {
  try {
    const userId = new ObjectId(req.params.id);
    const { firstName, lastName, email, phone, password, address, type } = req.body;

    // Check if user exists
    const user = await db.collection('users').findOne({ _id: userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Build update object
    const updateData = {
      firstName,
      lastName,
      email,
      phone,
      address,
      type: type || 'user',
      updatedAt: new Date()
    };

    // Only update password if provided
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const result = await db.collection('users').updateOne(
      { _id: userId },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Error updating user', details: error.message });
  }
});

app.delete('/api/admin/users/:id', async (req, res) => {
  try {
    const userId = new ObjectId(req.params.id);

    // Check if user exists
    const user = await db.collection('users').findOne({ _id: userId });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('Deleting user and all related data for userId:', userId);

    // Delete user's cart items
    const cartResult = await db.collection('cart').deleteMany({ userId: userId });
    console.log('Deleted cart items:', cartResult.deletedCount);

    // Delete user's addresses
    const addressResult = await db.collection('addresses').deleteMany({ userId: userId });
    console.log('Deleted addresses:', addressResult.deletedCount);

    // Delete user's orders
    const userOrders = await db.collection('orders').find({ userId: userId }).toArray();
    const orderIds = userOrders.map(order => order._id);

    // Delete order items for user's orders
    let orderItemsDeleted = 0;
    if (orderIds.length > 0) {
      const itemsResult = await db.collection('order_items').deleteMany({
        orderId: { $in: orderIds }
      });
      orderItemsDeleted = itemsResult.deletedCount;
      console.log('Deleted order items:', orderItemsDeleted);
    }

    // Delete orders
    const ordersResult = await db.collection('orders').deleteMany({ userId: userId });
    console.log('Deleted orders:', ordersResult.deletedCount);

    // Delete user
    const result = await db.collection('users').deleteOne({ _id: userId });
    console.log('Deleted user:', result.deletedCount > 0 ? 'User deleted successfully' : 'User not found');

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'User deleted successfully',
      deletedItems: {
        cartItems: cartResult.deletedCount,
        addresses: addressResult.deletedCount,
        orders: ordersResult.deletedCount,
        orderItems: orderItemsDeleted
      }
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Error deleting user', details: error.message });
  }
});

// Admin Product Routes
app.post('/api/admin/products/:id/add-stock', async (req, res) => {
  try {
    const productId = new ObjectId(req.params.id);
    const { stockUpdate } = req.body;

    console.log('Adding stock for product:', productId);
    console.log('Stock update data:', stockUpdate);

    const product = await db.collection('products').findOne({ _id: productId });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const updateOps = {};
    let totalAdded = 0;

    // Handle "One Size" (Single Stock)
    if (stockUpdate['One Size']) {
      const qty = parseInt(stockUpdate['One Size']);
      if (qty > 0) {
        updateOps.stock = qty; // Will be used in $inc
        totalAdded += qty;
      }
    }
    // Handle Multiple Sizes
    else {
      // Initialize checks handled by $inc logic
      for (const [size, qty] of Object.entries(stockUpdate)) {
        const quantity = parseInt(qty);
        if (quantity > 0) {
          updateOps[`sizes.${size}`] = quantity;
          totalAdded += quantity;
        }
      }

      // Also update total stock
      if (totalAdded > 0) {
        updateOps.stock = totalAdded;
      }
    }

    if (Object.keys(updateOps).length === 0) {
      return res.status(400).json({ error: 'No valid stock quantities provided' });
    }

    const result = await db.collection('products').updateOne(
      { _id: productId },
      { $inc: updateOps }
    );

    // Get updated product to return new totals
    const updatedProduct = await db.collection('products').findOne({ _id: productId });

    console.log('Stock updated successfully. Total added:', totalAdded);
    res.json({
      message: 'Stock updated successfully',
      totalStock: updatedProduct.stock,
      updatedProduct
    });

  } catch (error) {
    console.error('Error adding stock:', error);
    res.status(500).json({ error: 'Error adding stock' });
  }
});

// Google Auth Routes
app.get('/auth/google',
  passport.authenticate('google', { session: false, scope: ['profile', 'email'] }));

app.get('/auth/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login.html?error=google_login_failed' }),
  function (req, res) {
    // Successful authentication
    const user = req.user;

    // Create JWT token
    const token = jwt.sign(
      { id: user._id, email: user.email, type: user.type },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Redirect to frontend with token
    // Encode user data safely
    const userData = encodeURIComponent(JSON.stringify({
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      type: user.type,
      profileImage: user.profileImage
    }));

    res.redirect(`/?token=${token}&user=${userData}`);
  });

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Start server if run directly (local development)
if (require.main === module) {
  connectToMongo().then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Database: MongoDB (clothing_store)`);
      console.log(`Frontend: http://localhost:${PORT}`);
    });
  });
}

// Export Express app for Serverless Environments (Vercel)
module.exports = app;
