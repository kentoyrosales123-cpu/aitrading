const mongoose = require("mongoose");

const signalSchema = new mongoose.Schema(
  {
    coin: String,
    price: Number,
    change: String,

    action: String,
    confidence: String,
    risk: String,

    newsScore: Number,
    priceScore: Number,
    redditScore: Number,
    finalScore: Number,

    marketRegime: String,
    fearGreedMood: String,
    reasons: [String],

    checked: {
      type: Boolean,
      default: false,
    },

    resultPrice: {
      type: Number,
      default: null,
    },

    resultChange: {
      type: Number,
      default: null,
    },

    outcome: {
      type: String,
      default: "Pending",
    },

    accuracyImpact: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Signal", signalSchema);
