# Running ZeroTrace

Follow these simple steps to set up, run, and test the ZeroTrace Express Web App.

---

## 1. Setup & Configuration

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed (v18+ recommended).

### Environment Variables
1. Ensure your `.env` file exists at the root of the project (we've created a placeholder for you).
2. Open `.env` and fill in your **Mistral API Key**:
   ```env
   MISTRAL_API_KEY=your_actual_mistral_api_key_here
   PORT=3000
   ```

### Install Dependencies
Run the following command from the root directory to install all necessary packages:
```bash
npm install
```

---

## 2. Running the Application

To run the Express web application locally, choose one of the options below:

### Option A: Development Mode (Auto-reload)
Runs the server with hot-reloading when source files change:
```bash
npm run web:dev
```

### Option B: Standard Mode
Runs the server directly:
```bash
npm run web
```

Once started, open your web browser and navigate to:
👉 **http://localhost:3000**

---

## 3. Running Self-Tests

ZeroTrace includes a built-in correctness suite for the core concatenated error-correcting codes (BCH + Reed-Solomon). Run it using:
```bash
npx tsx src/ecc/selftest.ts
```
