import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Mock API for ASL prediction
  // In a real scenario, this would be the Python backend or a proxy to it.
  app.post("/api/predict", (req, res) => {
    const { landmarks } = req.body;
    
    // Simple mock logic: if landmarks exist, return a random letter or a placeholder
    // For the demo "LAURA", we can be a bit smarter or just return what the client expects
    // to test the UI flow.
    
    // In a real app, this would involve a machine learning model.
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const randomLetter = letters[Math.floor(Math.random() * letters.length)];
    
    res.json({
      prediction: randomLetter,
      confidence: 0.85,
      top_3: [
        { letter: randomLetter, confidence: 0.85 },
        { letter: letters[Math.floor(Math.random() * letters.length)], confidence: 0.1 },
        { letter: letters[Math.floor(Math.random() * letters.length)], confidence: 0.05 }
      ],
      raw_prediction: randomLetter
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
