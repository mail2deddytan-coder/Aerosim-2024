import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;
  const httpServer = createServer(app);
  
  // Initialize Socket.io
  const io = new Server(httpServer, {
    cors: { origin: "*" }
  });

  const players = new Map();

  io.on("connection", (socket) => {
    console.log("Player joined:", socket.id);
    
    // Send existing players to new player
    socket.emit("players_update", Array.from(players.entries()));

    socket.on("update_state", (state) => {
        // state contains: lat, lon, alt, pitch, roll, yaw, aircraftType
        players.set(socket.id, state);
        
        // Broadcast to all OTHER players
        socket.broadcast.emit("players_update", [[socket.id, state]]);
    });

    socket.on("disconnect", () => {
        console.log("Player left:", socket.id);
        players.delete(socket.id);
        io.emit("player_disconnected", socket.id);
    });
  });

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
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

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
