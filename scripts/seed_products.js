const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '../.env' });

const mongoUrl = process.env.MONGODB_URL || 'mongodb://localhost:27017';
const client = new MongoClient(mongoUrl);

const products = [
    // Men's Collection
    {
        name: "Classic White Tee",
        category: "Men",
        price: 1299,
        description: "Premium cotton classic fit white t-shirt. Essential for every wardrobe.",
        image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=800&auto=format&fit=crop",
        stock: 50,
        sizes: { "S": 10, "M": 20, "L": 15, "XL": 5 },
        collections: ["best-collection", "summer-essentials"]
    },
    {
        name: "Navy Blue Bomber Jacket",
        category: "Men",
        price: 4999,
        description: "Stylish navy blue bomber jacket with premium finish. Perfect for layering.",
        image: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?q=80&w=800&auto=format&fit=crop",
        stock: 30,
        sizes: { "M": 10, "L": 15, "XL": 5 },
        collections: ["best-collection", "winter-wear"]
    },
    {
        name: "Slim Fit Chinos",
        category: "Men",
        price: 2499,
        description: "Comfortable slim fit chinos in beige. Versatile for casual and semi-formal looks.",
        image: "https://images.unsplash.com/photo-1473966968600-fa801b869a1a?q=80&w=800&auto=format&fit=crop",
        stock: 40,
        sizes: { "30": 10, "32": 15, "34": 15 },
        collections: ["office-wear"]
    },
    {
        name: "Denim Jacket",
        category: "Men",
        price: 3499,
        description: "Classic denim jacket with a modern cut. Rugged and stylish.",
        image: "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?q=80&w=800&auto=format&fit=crop",
        stock: 25,
        sizes: { "S": 5, "M": 10, "L": 8, "XL": 2 },
        collections: ["best-collection"]
    },
    {
        name: "Black Hoodie",
        category: "Men",
        price: 1899,
        description: "Soft and warm black hoodie. Your go-to comfort wear.",
        image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?q=80&w=800&auto=format&fit=crop",
        stock: 60,
        sizes: { "S": 10, "M": 20, "L": 20, "XL": 10 },
        collections: []
    },

    // Women's Collection
    {
        name: "Floral Summer Dress",
        category: "Women",
        price: 2999,
        description: "Breezy floral print dress, perfect for summer days.",
        image: "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?q=80&w=800&auto=format&fit=crop",
        stock: 35,
        sizes: { "XS": 5, "S": 10, "M": 15, "L": 5 },
        collections: ["best-collection", "summer-essentials"]
    },
    {
        name: "Elegant Black Blazer",
        category: "Women",
        price: 5499,
        description: "Sharp and sophisticated black blazer for power dressing.",
        image: "https://images.unsplash.com/photo-1548624149-f9b1859aa2d0?q=80&w=800&auto=format&fit=crop",
        stock: 20,
        sizes: { "S": 10, "M": 10 },
        collections: ["best-collection", "office-wear"]
    },
    {
        name: "High-Waist Jeans",
        category: "Women",
        price: 2299,
        description: "Vintage inspired high-waist denim jeans.",
        image: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?q=80&w=800&auto=format&fit=crop",
        stock: 45,
        sizes: { "26": 10, "28": 15, "30": 15, "32": 5 },
        collections: []
    },
    {
        name: "Silk Blouse",
        category: "Women",
        price: 3299,
        description: "Luxurious silk blouse in champagne color.",
        image: "https://images.unsplash.com/photo-1564257631407-4deb1f99d992?q=80&w=800&auto=format&fit=crop",
        stock: 15,
        sizes: { "S": 5, "M": 5, "L": 5 },
        collections: ["best-collection"]
    },
    {
        name: "Knitted Sweater",
        category: "Women",
        price: 2699,
        description: "Cozy oversized knitted sweater in beige.",
        image: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?q=80&w=800&auto=format&fit=crop",
        stock: 30,
        sizes: { "S": 10, "M": 15, "L": 5 },
        collections: ["winter-wear"]
    },

    // Accessories
    {
        name: "Leather Messenger Bag",
        category: "Accessories",
        price: 6999,
        description: "Premium handcrafted leather messenger bag.",
        image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?q=80&w=800&auto=format&fit=crop",
        stock: 15,
        sizes: { "One Size": 15 },
        collections: ["best-collection"]
    },
    {
        name: "Minimalist Watch",
        category: "Accessories",
        price: 3499,
        description: "Sleek and minimalist analog watch with leather strap.",
        image: "https://images.unsplash.com/photo-1524592094714-0f0654e20314?q=80&w=800&auto=format&fit=crop",
        stock: 50,
        sizes: { "One Size": 50 },
        collections: ["best-collection"]
    },
    {
        name: "Classic Sunglasses",
        category: "Accessories",
        price: 1499,
        description: "Timeless aviator style sunglasses with UV protection.",
        image: "https://images.unsplash.com/photo-1572635196237-14b3f281e960?q=80&w=800&auto=format&fit=crop",
        stock: 100,
        sizes: { "One Size": 100 },
        collections: ["summer-essentials"]
    },
    {
        name: "Baseball Cap",
        category: "Accessories",
        price: 799,
        description: "Cotton baseball cap in various colors.",
        image: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?q=80&w=800&auto=format&fit=crop",
        stock: 60,
        sizes: { "One Size": 60 },
        collections: []
    },
    {
        name: "Canvas Sneakers",
        category: "Accessories",
        price: 1999,
        description: "White canvas sneakers, everyday essential.",
        image: "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?q=80&w=800&auto=format&fit=crop",
        stock: 40,
        sizes: { "38": 10, "40": 10, "42": 10, "44": 10 },
        collections: ["best-collection"]
    }
];

async function seedProducts() {
    try {
        await client.connect();
        const db = client.db('clothing_store');

        console.log('Connected to MongoDB');

        // Only add if they don't exist to avoid duplicates on re-runs (simple check by name)
        // Or we can just drop and recreate if that's safer for 'Best Collection' setup.
        // For now, let's just insert and filter out duplicates or clear existing?
        // Let's clear existing products to ensure clean slate for "Best Collection" if user agrees,
        // BUT user might have existing data. Let's just append but check for duplicates.

        // Actually, to make "Best Collection" work well, let's just insert these.
        // I will check if product with same name exists, if not insert.

        let addedCount = 0;
        for (const product of products) {
            const existing = await db.collection('products').findOne({ name: product.name });
            if (!existing) {
                await db.collection('products').insertOne({
                    ...product,
                    createdAt: new Date(),
                    createdBy: 'system-seed'
                });
                addedCount++;
                console.log(`Added: ${product.name}`);
            } else {
                // Update collections tag if it exists
                if (product.collections && product.collections.length > 0) {
                    await db.collection('products').updateOne(
                        { _id: existing._id },
                        { $set: { collections: product.collections, image: product.image } } // Also update image to high quality one
                    );
                    console.log(`Updated collections/image for: ${product.name}`);
                }
            }
        }

        console.log(`\nSeeding complete. Added ${addedCount} new products.`);

    } catch (error) {
        console.error('Error seeding database:', error);
    } finally {
        await client.close();
    }
}

seedProducts();
