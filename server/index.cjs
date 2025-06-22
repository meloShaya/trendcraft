// server/index.cjs - Test 2: Initializers

console.log('--- Script Start ---');

// 1. Test dotenv
const dotenv = require('dotenv');
dotenv.config();
console.log('[OK] dotenv configured.');
console.log(`   > Does APIFY_API_TOKEN exist? ${!!process.env.APIFY_API_TOKEN}`);
console.log(`   > Does GEMINI_API_KEY exist? ${!!process.env.GEMINI_API_KEY}`);


// 2. Test Google AI SDK Initialization
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
console.log('[OK] Google AI SDK Initialized.');


// 3. Test Apify SDK Initialization
const { Apify } = require('apify');
const apifyClient = Apify.newClient({ token: process.env.APIFY_API_TOKEN });
console.log('[OK] Apify SDK Initialized.');


// 4. Start the server
const express = require('express');
const app = express();
const PORT = 3001;

app.get('/', (req, res) => {
  res.send('Test server with initializers is working!');
});

app.listen(PORT, () => {
  console.log('\n--- Server Listening ---');
  console.log(`✅ Success! Server is running on http://localhost:${PORT}`);
});