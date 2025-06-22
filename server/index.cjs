// server/index.cjs - Ultimate Debugging Script

// STEP 1: Add Global Error Handlers
// This is our safety net to catch any error that might be crashing the process silently.
process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥🔥🔥🔥 UNHANDLED REJECTION 🔥🔥🔥🔥');
  console.error('This happens when a Promise fails without a .catch() block.');
  console.error('Reason:', reason);
  process.exit(1); // Exit with a failure code
});

process.on('uncaughtException', (error) => {
  console.error('💥💥💥💥 UNCAUGHT EXCEPTION 💥💥💥💥');
  console.error('This is a critical, unexpected error.');
  console.error('Error:', error);
  process.exit(1); // Exit with a failure code
});

console.log('--- Script Start ---');
console.log('Global error handlers are active.');

const dotenv = require('dotenv');
dotenv.config();
console.log('[OK] dotenv configured.');

// STEP 2: Let's inspect the token without revealing it
const apifyToken = process.env.APIFY_API_TOKEN;
if (apifyToken) {
    console.log('[INFO] APIFY_API_TOKEN exists.');
    console.log(`   > Token Length: ${apifyToken.length}`);
    console.log(`   > Starts with "apify_api_": ${apifyToken.startsWith('apify_api_')}`);
} else {
    console.error('[FATAL] APIFY_API_TOKEN is missing! Exiting.');
    process.exit(1);
}

const { GoogleGenerativeAI } = require('@google/generative-ai');
console.log('[OK] Google AI SDK Initialized.'); // Moved this up, since it seems to work fine.

// STEP 3: Try to initialize Apify inside a robust try...catch block
try {
    console.log('[ATTEMPTING] Apify SDK Initialization...');
    const { ApifyClient } = require('apify-client');
    const apifyClient = new ApifyClient({token: process.env.APIFY_API_TOKEN,});
    console.log('[OK] Apify SDK Initialized successfully.');
} catch (e) {
    console.error('❌❌ CAUGHT A SYNCHRONOUS ERROR DURING INITIALIZATION ❌❌');
    console.error(e);
    process.exit(1); // Exit with a failure code
}

// If we get this far, all initializations were successful.
const express = require('express');
const app = express();
const PORT = 3001;

app.listen(PORT, () => {
  console.log('\n--- Server Listening ---');
  console.log(`✅✅✅ Success! All initializations passed. Server is running on http://localhost:${PORT}`);
});