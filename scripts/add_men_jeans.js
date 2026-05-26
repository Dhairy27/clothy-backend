const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '../.env' });

const mongoUrl = process.env.MONGODB_URL || 'mongodb://localhost:27017';
const client = new MongoClient(mongoUrl);

const products = [
    {
        name: "Classic Blue Straight Leg Jeans",
        category: "Men",
        price: 2499,
        description: "Timeless classic blue jeans with a straight leg fit. Comfortable and durable.",
        image: "images/men/jeans_1.jpg",
        stock: 100,
        sizes: { "30": 20, "32": 30, "34": 30, "36": 20 },
        collections: []
    },
    {
        name: "Slim Fit Black Jeans",
        category: "Men",
        price: 2799,
        description: "Sleek black jeans with a modern slim fit. detailed stitching.",
        image: "images/men/jeans_2.jpg",
        stock: 100,
        sizes: { "30": 20, "32": 30, "34": 30, "36": 20 },
        collections: []
    },
    {
        name: "Light Wash Distressed Jeans",
        category: "Men",
        price: 2999,
        description: "Casual light wash jeans with stylish distressed details.",
        image: "images/men/jeans_3.jpg",
        stock: 100,
        sizes: { "30": 20, "32": 30, "34": 30, "36": 20 },
        collections: ["summer-essentials"]
    },
    {
        name: "Grey Tapered Jeans",
        category: "Men",
        price: 2699,
        description: "Versatile grey jeans with a tapered fit for a clean look.",
        image: "images/men/jeans_4.jpg",
        stock: 100,
        sizes: { "30": 20, "32": 30, "34": 30, "36": 20 },
        collections: []
    },
    {
        name: "Dark Navy Relaxed Fit Jeans",
        category: "Men",
        price: 2599,
        description: "Deep navy jeans with a relaxed fit for maximum comfort.",
        image: "images/men/jeans_5.jpg",
        stock: 100,
        sizes: { "30": 20, "32": 30, "34": 30, "36": 20 },
        collections: ["winter-wear"]
    },
    {
        name: "Vintage Wash Bootcut Jeans",
        category: "Men",
        price: 2899,
        description: "Retro-inspired bootcut jeans with a vintage wash.",
        image: "images/men/jeans_6.jpg",
        stock: 100,
        sizes: { "30": 20, "32": 30, "34": 30, "36": 20 },
        collections: []
    },
    {
        name: "Charcoal Skinny Jeans",
        category: "Men",
        price: 2799,
        description: "Edgy charcoal jeans with a skinny fit.",
        image: "images/men/jeans_7.jpg",
        stock: 100,
        sizes: { "30": 20, "32": 30, "34": 30, "36": 20 },
        collections: []
    },
    {
        name: "White Denim Jeans",
        category: "Men",
        price: 3199,
        description: "Crisp white denim jeans, perfect for summer.",
        image: "images/men/jeans_8.jpg",
        stock: 100,
        sizes: { "30": 20, "32": 30, "34": 30, "36": 20 },
        collections: ["summer-essentials"]
    },
    {
        name: "Light Blue Acid Wash Jeans",
        category: "Men",
        price: 3099,
        description: "Bold acid wash jeans for a statement look.",
        image: "images/men/jeans_9.jpg",
        stock: 100,
        sizes: { "30": 20, "32": 30, "34": 30, "36": 20 },
        collections: []
    },
    {
        name: "Olive Green Cargo Jeans",
        category: "Men",
        price: 3299,
        description: "Utility style olive green jeans with cargo pockets.",
        image: "images/men/jeans_10.jpg",
        stock: 100,
        sizes: { "30": 20, "32": 30, "34": 30, "36": 20 },
        collections: []
    }
];

async function seedMenJeans() {
    try {
        await client.connect();
        const db = client.db('clothing_store');
        console.log('Connected to MongoDB');

        for (const product of products) {
            const result = await db.collection('products').insertOne({
                ...product,
                createdAt: new Date(),
                createdBy: 'system-seed-script'
            });
            console.log(`Added: ${product.name} (ID: ${result.insertedId})`);
        }

        console.log(`\nSuccessfully added ${products.length} men's jeans products.`);

    } catch (error) {
        console.error('Error seeding database:', error);
    } finally {
        await client.close();
    }
}

seedMenJeans();
