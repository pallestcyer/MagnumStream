import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertSaleSchema, insertFlightRecordingSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Get all flight recordings
  app.get("/api/recordings", async (_req, res) => {
    try {
      const recordings = await storage.getAllFlightRecordings();
      res.json(recordings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create sale
  app.post("/api/sales", async (req, res) => {
    try {
      const validated = insertSaleSchema.parse(req.body);
      const sale = await storage.createSale(validated);
      res.json(sale);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get all sales
  app.get("/api/sales", async (_req, res) => {
    try {
      const sales = await storage.getAllSales();
      res.json(sales);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get sales analytics
  app.get("/api/sales/analytics", async (_req, res) => {
    try {
      const sales = await storage.getAllSales();
      const recordings = await storage.getAllFlightRecordings();
      
      const totalRecordings = recordings.length;
      const totalSales = sales.length;
      const exportedRecordings = recordings.filter(r => r.exportStatus === "completed").length;
      const conversionRate = exportedRecordings > 0 ? (totalSales / exportedRecordings) * 100 : 0;
      
      // Staff performance
      const staffSales = sales.reduce((acc, sale) => {
        acc[sale.staffMember] = (acc[sale.staffMember] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      // Revenue
      const totalRevenue = sales.reduce((sum, sale) => sum + (sale.saleAmount || 0), 0);
      
      res.json({
        totalRecordings,
        totalSales,
        exportedRecordings,
        conversionRate,
        staffSales,
        totalRevenue,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Mock some initial data
  const initData = async () => {
    const existing = await storage.getAllFlightRecordings();
    if (existing.length === 0) {
      // Create sample recordings
      await storage.createFlightRecording({
        projectName: "Sunset Flight Tour",
        pilotName: "John & Sarah",
        pilotEmail: "john@example.com",
        staffMember: "Alex Johnson",
        flightDate: "2025-10-18",
        flightTime: "18:00",
        exportStatus: "completed",
        driveFileUrl: "https://drive.google.com/file/d/sample1/view",
        smsPhoneNumber: "+1 555-1234",
      });
      
      await storage.createFlightRecording({
        projectName: "Mountain Adventure",
        pilotName: "Emily",
        pilotEmail: "emily@example.com",
        staffMember: "Maria Garcia",
        flightDate: "2025-10-19",
        flightTime: "14:30",
        exportStatus: "completed",
        driveFileUrl: "https://drive.google.com/file/d/sample2/view",
      });
      
      await storage.createFlightRecording({
        projectName: "Coastal Tour",
        pilotName: "Mike & Lisa",
        pilotEmail: "mike@example.com",
        staffMember: "Alex Johnson",
        flightDate: "2025-10-20",
        flightTime: "10:00",
        exportStatus: "completed",
        driveFileUrl: "https://drive.google.com/file/d/sample3/view",
      });
    }
  };
  
  initData();

  const httpServer = createServer(app);

  return httpServer;
}
