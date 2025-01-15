const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const cors = require('cors');
const stripe = require("stripe")('sk_test_51OIDPJHroIJBMQjz3A9lmORO5EGCaqkQHolH9Cby0XJLoVl4DlciQxcfrb7vWIwYOikGnkMaQAggtVaxuvM3Mljo0000xqpHuw');

const app = express()
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')
const port = process.env.PORT || 5000
// middleWare
app.use(express.json())
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://quickbite-8faa4.web.app',
    'https://quickbite-8faa4.firebaseapp.com'
  ],
  credentials: true
}))
app.use(cookieParser())
require('dotenv').config()
// Mongo

const uri = `mongodb+srv://sakib01181:Sakib_22@cluster0.60qibw3.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // await client.connect();
    const foodCollection = client.db('foodCollection').collection('food')
    const foodCart = client.db('foodCollection').collection('cart')
    const user = client.db('foodCollection').collection('user')
    const payment = client.db('foodCollection').collection('payment')
    // Payment
    app.post("/stripe-payment", async (req, res) => {
      const { amount } = req.body;
      const { foods } = req.body;
      const balance = amount
      try {
        // Create a PaymentIntent with the order amount and currency
        const paymentIntent = await stripe.paymentIntents.create({
          amount: balance * 100, // Amount in cents
          currency: "usd",
          automatic_payment_methods: {
            enabled: true,
          },
        });
        const result = await payment.insertOne({paymentIntent, foods,amount})
        console.log(result);
        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      } catch (error) {
        console.error(`Error creating PaymentIntent: ${error.message}`);
        res.status(500).send({
          error: error.message,
        });
      }
    });



    app.get('/products-count', async (req, res) => {
      try {
        const count = await foodCollection.estimatedDocumentCount()
        res.send({ count: count })
      } catch (error) {
        console.log(error);
      }
    })
    //  verify Token
    const verifyToken = (req, res, next) => {
      const token = req?.cookies?.token;
      console.log('Cookie Value:', token);

      if (!token) {
        return res.status(401).send({ message: 'Unauthorized access' });
      }

      jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'Unauthorized access' });
        }
        console.log(decoded);
        req.user = decoded;
      });
      next();
    };

    // JWT TOKEN
    app.post('/jwt', (req, res) => {
      const user = req.body
      console.log(process.env.ACCESS_TOKEN);
      console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, { expiresIn: '5h' })
      console.log(token);
      res.cookie('token', token, {
          httpOnly: true,
          secure: true,
          sameSite: 'none',
        })
        .send({ token })
    }
    )
    app.post('/logout', async (req, res) => {
      const user = req.body
      res.clearCookie('token', { maxAge: 0 }).send({ success: true })
    })
    // 
    // Store User
    app.post('/user', async (req, res) => {
      try {
        const data = req.body
        const result = await user.insertOne(data)
        res.send(result)
      } catch (error) {
        console.log(error);
      }
    })


    // Get All cart Data
    app.get('/cart/:email', verifyToken, async (req, res) => {
      const email = req.params.email
      const user = req?.user?.user
      console.log(email, user)
      if (email !== user) {
        return res.status(401).send({ message: 'unauthorize access' })
      }
      const query = { loggedUser: email }
      const filter = foodCart.find(query)
      const result = await filter.toArray()
      res.send(result)
    })
    // Get specific user Added data
    app.get('/update/:email', verifyToken, async (req, res) => {
      const user = req?.user?.user
      const email = req.params.email
      console.log(user, email);
      if (user !== email) {
        res.status(401).send({ message: 'unauthorize access' })
      }
      const query = { loggedUser: email }
      const filter = foodCollection.find(query)
      const result = await filter.toArray()
      res.send(result)
    })
    // update a Product 
    app.put('/updateProduct/:id', async (req, res) => {
      try {
        const id = req.params.id
        const data = req.body
        const query = { _id: new ObjectId(id) }
        const options = { upsert: true };
        const doc = {
          $set: {
            foodImage: data?.foodImage,
            foodName: data?.foodName,
            description: data?.description,
            foodCategory: data?.foodCategory,
            price: data?.price,
            loggedUser: data?.loggedUser,
            country: data?.country,
            quantity: data?.quantity,
            orderCount: data?.orderCount
          }
        }
        // console.log(doc);
        const result = await foodCollection.updateOne(query, doc, options)
        res.send(result)
      } catch (error) {
        console.log(error);
      }
    })
    // add order to cart
    app.post('/order', async (req, res) => {
      try {
        const data = req.body
        console.log(req?.user?.user);
        console.log(data.loggedUser);
        // if(req.user.user !== data.loggedUser ){
        //   return res.status(403).send('forbidden access')
        // }
        const result = await foodCart.insertOne(data)
        res.send(result)
      } catch (error) {
        console.log(error);
      }
    })
    app.put('/updateOrderCount/:id', async (req, res) => {
      try {
        const id = req.params.id
        const data = req.body
        const query = { _id: new ObjectId(id) }
        const options = { upsert: true };
        const doc = {
          $set: {
            quantity: data?.quantity,
            orderCount: data?.orderCount
          }
        }
        const result = await foodCollection.updateOne(query, doc, options)
        res.send(result)
      } catch (error) {
        console.log(error);
      }
    })
    // Add Product 
    app.post('/addproduct', async (req, res) => {
      console.log(req.cookies)
      const data = req.body
      const result = await foodCollection.insertOne(data)
      res.send(result)
    })
    // All Product
    app.get('/products', async (req, res) => {
      try {

        const page = parseInt(req.query.page)
        const size = parseInt(req.query.size)
        const cursor = await foodCollection.find().skip(page * size).limit(size).toArray()
        res.send(cursor)
      } catch (error) {
        console.log(error);
      }
    })
    // Details id
    app.get('/details/:id', async (req, res) => {
      try {
        const id = req.params.id
        const user = req.query
        const query = { _id: new ObjectId(id) }
        const cursor = await foodCollection.findOne(query)
        res.send(cursor)
      } catch (error) {
        console.log(error)
      }
    })

    app.get('/single/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const find = await foodCollection.findOne(query)
      res.send(find)
    })
    // Delete From Cart
    app.delete('/cart/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await foodCart.deleteOne(query)
      res.send(result)
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', async (req, res) => {
  res.send('Server Started Successfully')
})
app.listen(port)