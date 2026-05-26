const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '../.env' });

const mongoUrl = process.env.MONGODB_URL || 'mongodb://localhost:27017';
const client = new MongoClient(mongoUrl);

// Collection of detailed jeans products
// diverse styles, fits, and washes
const jeansProducts = [
    {
        name: "Classic Straight Leg Blue Jeans",
        description: "Timeless straight leg fit in a medium blue wash. Made from 100% durable cotton denim.",
        price: 2499,
        image: "https://images.unsplash.com/photo-1542272617-08f08630329e?q=80&w=800&auto=format&fit=crop",
        category: "Men",
        collections: ["best-collection"],
        stock: 50,
        sizes: { "30": 10, "32": 20, "34": 15, "36": 5 }
    },
    {
        name: "Slim Fit Dark Wash Denim",
        description: "Sleek slim fit jeans in a refined dark indigo wash. Perfect for a smart-casual look.",
        price: 2999,
        image: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?q=80&w=800&auto=format&fit=crop",
        category: "Men",
        collections: ["office-wear"],
        stock: 45,
        sizes: { "28": 5, "30": 15, "32": 15, "34": 10 }
    },
    {
        name: "Distressed Streetwear Jeans",
        description: "Edgy distressed jeans with rips and distinct fading. Ideal for street style outfits.",
        price: 3299,
        image: "https://images.unsplash.com/photo-1555689502-c4b22d76c56f?q=80&w=800&auto=format&fit=crop",
        category: "Men",
        collections: [],
        stock: 30,
        sizes: { "30": 10, "32": 10, "34": 10 }
    },
    {
        name: "Relaxed Fit Light Blue Jeans",
        description: "Comfortable relaxed fit in a vintage light blue wash. Great for weekends.",
        price: 2199,
        image: "https://images.unsplash.com/photo-1475178626620-a4d074967452?q=80&w=800&auto=format&fit=crop",
        category: "Men",
        collections: ["summer-essentials"],
        stock: 60,
        sizes: { "30": 15, "32": 20, "34": 15, "36": 10 }
    },
    {
        name: "Black Skinny Jeans",
        description: "Sharp black skinny jeans with stretch for comfort and style.",
        price: 2799,
        image: "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?q=80&w=800&auto=format&fit=crop",
        category: "Men",
        collections: ["best-collection"],
        stock: 40,
        sizes: { "28": 10, "30": 15, "32": 10, "34": 5 }
    },
    {
        name: "Tapered Fit Grey Jeans",
        description: "Modern tapered fit in a versatile grey wash.",
        price: 2599,
        image: "https://images.unsplash.com/photo-1582418702059-97ebafb35d09?q=80&w=800&auto=format&fit=crop",
        category: "Men",
        collections: [],
        stock: 35,
        sizes: { "30": 10, "32": 15, "34": 10 }
    },
    {
        name: "Raw Denim Selvedge Jeans",
        description: "Premium raw selvedge denim for the true enthusiast. Breaks in beautifully over time.",
        price: 4499,
        image: "https://images.unsplash.com/photo-1516961642265-531546e84af2?q=80&w=800&auto=format&fit=crop",
        category: "Men",
        collections: ["best-collection"],
        stock: 20,
        sizes: { "30": 5, "32": 10, "34": 5 }
    },
    {
        name: "Bootcut Vintage Jeans",
        description: "Classic bootcut silhouette with a retro vibe.",
        price: 2399,
        image: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?q=80&w=800&auto=format&fit=crop",
        category: "Men",
        collections: [],
        stock: 25,
        sizes: { "32": 10, "34": 10, "36": 5 }
    },
    {
        name: "White Summer Jeans",
        description: "Crisp white jeans for a fresh summer look.",
        price: 2699,
        image: "https://images.unsplash.com/photo-1584370848010-d7ccb2844db6?q=80&w=800&auto=format&fit=crop",
        category: "Men",
        collections: ["summer-essentials"],
        stock: 30,
        sizes: { "30": 10, "32": 10, "34": 10 }
    },
    {
        name: "Acid Wash 90s Jeans",
        description: "Throwback acid wash finish for a bold statement.",
        price: 2899,
        image: "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?q=80&w=800&auto=format&fit=crop",
        category: "Men",
        collections: [],
        stock: 20,
        sizes: { "30": 5, "32": 10, "34": 5 }
    },
    {
        name: "Cargo Detail Jeans",
        description: "Utility style jeans with subtle cargo pocket details.",
        price: 3199,
        image: "https://images.unsplash.com/photo-1604176354204-9268737828e4?q=80&w=800&auto=format&fit=crop",
        category: "Men",
        collections: [],
        stock: 35,
        sizes: { "30": 10, "32": 15, "34": 10 }
    },
    {
        name: "Stretch Comfort Jeans",
        description: "Maximum comfort with high-stretch denim fabric.",
        price: 1999,
        image: "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?q=80&w=800&auto=format&fit=crop",
        category: "Men",
        collections: ["best-collection"],
        stock: 80,
        sizes: { "30": 20, "32": 30, "34": 20, "36": 10 }
    },
    {
        name: "Ripped Knee Skinny Jeans",
        description: "Skinny fit with trendy knee rips.",
        price: 2599,
        image: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?q=80&w=800&auto=format&fit=crop",
        category: "Men",
        collections: [],
        stock: 40,
        sizes: { "28": 10, "30": 15, "32": 15 }
    },
    {
        name: "Indigo Carpenter Jeans",
        description: "Workwear-inspired carpenter jeans in deep indigo.",
        price: 3399,
        image: "https://images.unsplash.com/photo-1595341888016-a392ef81b7de?q=80&w=800&auto=format&fit=crop",
        category: "Men",
        collections: [],
        stock: 25,
        sizes: { "32": 10, "34": 10, "36": 5 }
    },
    {
        name: "Faded Black Denim",
        description: "Washed out black denim for a lived-in look.",
        price: 2799,
        image: "https://images.unsplash.com/photo-1582418702059-97ebafb35d09?q=80&w=800&auto=format&fit=crop",
        category: "Men",
        collections: [],
        stock: 30,
        sizes: { "30": 10, "32": 10, "34": 10 }
    },
    {
        name: "Slim Straight Chino Jeans",
        description: "Hybrid style combining chino comfort with denim durability.",
        price: 2699,
        image: "https://images.unsplash.com/photo-1473966968600-fa801b869a1a?q=80&w=800&auto=format&fit=crop",
        category: "Men",
        collections: ["office-wear"],
        stock: 45,
        sizes: { "30": 15, "32": 15, "34": 15 }
    },
    {
        name: "Light Wash Ripped Jeans",
        description: "Summer ready light wash jeans with distressing.",
        price: 2899,
        image: "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?q=80&w=800&auto=format&fit=crop",
        category: "Men",
        collections: ["summer-essentials"],
        stock: 35,
        sizes: { "30": 10, "32": 15, "34": 10 }
    },
    {
        name: "Navy Regular Fit Jeans",
        description: "Standard regular fit in a clean navy wash.",
        price: 1899,
        image: "https://images.unsplash.com/photo-1542272617-08f08630329e?q=80&w=800&auto=format&fit=crop",
        category: "Men",
        collections: [],
        stock: 60,
        sizes: { "30": 15, "32": 25, "34": 15, "36": 5 }
    },
    {
        name: "Grey Slim Fit Jeans",
        description: "Versatile grey denim in a modern slim silhouette.",
        price: 2499,
        image: "https://images.unsplash.com/photo-1582418702059-97ebafb35d09?q=80&w=800&auto=format&fit=crop",
        category: "Men",
        collections: [],
        stock: 40,
        sizes: { "30": 10, "32": 15, "34": 15 }
    },
    {
        name: "Premium Selvedge Black Jeans",
        description: "High-end black selvedge denim. The ultimate wardrobe staple.",
        price: 4999,
        image: "https://images.unsplash.com/photo-1516961642265-531546e84af2?q=80&w=800&auto=format&fit=crop",
        category: "Men",
        collections: ["best-collection", "office-wear"],
        stock: 15,
        sizes: { "30": 5, "32": 5, "34": 5 }
    }
];

async function seedJeans() {
    try {
        await client.connect();
        const db = client.db('clothing_store');
        console.log('Connected to MongoDB');

        let addedCount = 0;
        let updatedCount = 0;

        for (const product of jeansProducts) {
            const existing = await db.collection('products').findOne({ name: product.name });
            if (!existing) {
                await db.collection('products').insertOne({
                    ...product,
                    createdAt: new Date(),
                    createdBy: 'seed_jeans_script'
                });
                addedCount++;
                console.log(`Added: ${product.name}`);
            } else {
                await db.collection('products').updateOne(
                    { _id: existing._id },
                    {
                        $set: {
                            description: product.description,
                            price: product.price,
                            image: product.image,
                            sizes: product.sizes,
                            stock: product.stock,
                            collections: product.collections
                        }
                    }
                );
                updatedCount++;
                console.log(`Updated: ${product.name}`);
            }
        }

        console.log(`\nOperation complete. Added ${addedCount} new jeans, Updated ${updatedCount}.`);

    } catch (error) {
        console.error('Error seeding jeans:', error);
    } finally {
        await client.close();
    }
}

seedJeans();
