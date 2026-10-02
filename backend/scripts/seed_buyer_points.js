// Add 1000 reward points to buyer@hosta.local
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../app/models/User");
const RewardPointLog = require("../app/models/RewardPointLog");

(async () => {
  try {
    await mongoose.connect(process.env.DB_URI);
    
    const buyer = await User.findOne({ email: "buyer@hosta.local" });
    if (!buyer) {
      console.error("Buyer not found");
      process.exit(1);
    }
    
    console.log(`Found buyer: ${buyer.email} (${buyer._id})`);
    
    // Check current points
    const currentPoints = await buyer.rewardPoints();
    console.log(`Current reward points: ${currentPoints}`);
    
    // Add 1000 points
    await RewardPointLog.create({
      userId: buyer._id,
      rewardPoints: 1000,
      operationType: "credit",
    });
    
    console.log("Added 1000 reward points");
    
    // Verify
    const newPoints = await buyer.rewardPoints();
    console.log(`New reward points: ${newPoints}`);
    
    process.exit(0);
  } catch (e) {
    console.error("ERROR:", e.message);
    process.exit(1);
  }
})();
