require("dotenv").config();
const fetch = require("node-fetch");

const express = require("express");
const cors = require("cors");
const Parser = require("rss-parser");
const mongoose = require("mongoose");
const Signal = require("./models/Signal");

const app = express();
const parser = new Parser();

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((error) => console.log("MongoDB error:", error.message));

async function getCoinPrice(coin) {
  const coinMap = {
    BTC: "bitcoin",
    ETH: "ethereum",
    SOL: "solana",
    BNB: "binancecoin",
    XRP: "ripple",
  };

  const coinId = coinMap[coin.toUpperCase()];

  if (!coinId) return null;

  const priceUrl =
    `https://api.coingecko.com/api/v3/simple/price` +
    `?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`;

  const priceResponse = await fetch(priceUrl);

  if (!priceResponse.ok) return null;

  const priceData = await priceResponse.json();

  return priceData[coinId]?.usd || null;
}

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

app.get("/api/ai-signal/:coin", async (req, res) => {
  try {
    const coinParam = req.params.coin.toLowerCase();

    const coinMap = {
      btc: "bitcoin",
      eth: "ethereum",
      sol: "solana",
      bnb: "binancecoin",
      xrp: "ripple",
    };

    const coinId = coinMap[coinParam];

    if (!coinId) {
      return res.status(400).json({ error: "Unsupported coin" });
    }

    const priceUrl =
      `https://api.coingecko.com/api/v3/simple/price` +
      `?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`;

    const priceResponse = await fetch(priceUrl);

    if (!priceResponse.ok) {
      return res.status(502).json({ error: "Failed to fetch price data" });
    }

    const priceData = await priceResponse.json();

    const price = priceData[coinId]?.usd || 0;
    const change = priceData[coinId]?.usd_24h_change || 0;

    if (!price) {
      return res.status(502).json({ error: "Invalid price data" });
    }

    const newsQuery = encodeURIComponent(
      `${coinParam} crypto market fed inflation ETF SEC regulation hack adoption`,
    );

    const feed = await parser.parseURL(
      `https://news.google.com/rss/search?q=${newsQuery}&hl=en-US&gl=US&ceid=US:en`,
    );

    const newsItems = feed.items.slice(0, 8);

    let newsScore = 0;
    let highImpactCount = 0;
    let redditScore = 0;
    const reasons = [];

    const bullishWords = [
      "rally",
      "surge",
      "gain",
      "approval",
      "inflow",
      "adoption",
      "breakout",
      "record high",
      "institutional",
      "partnership",
      "accumulation",
    ];

    const bearishWords = [
      "crash",
      "drop",
      "fall",
      "lawsuit",
      "hack",
      "ban",
      "outflow",
      "selloff",
      "liquidation",
      "rejection",
      "fraud",
      "probe",
    ];

    const highImpactWords = [
      "fed",
      "federal reserve",
      "inflation",
      "interest rate",
      "sec",
      "etf",
      "regulation",
      "war",
      "recession",
      "cpi",
      "rate cut",
      "rate hike",
    ];

    newsItems.forEach((item) => {
      const title = item.title.toLowerCase();

      if (bullishWords.some((word) => title.includes(word))) {
        newsScore += 2;
        reasons.push("Bullish news detected.");
      }

      if (bearishWords.some((word) => title.includes(word))) {
        newsScore -= 2;
        reasons.push("Bearish news detected.");
      }

      if (highImpactWords.some((word) => title.includes(word))) {
        highImpactCount++;
      }
    });

    let priceScore = 0;

    if (change > 5) priceScore += 3;
    else if (change > 2) priceScore += 2;
    else if (change > 0.8) priceScore += 1;

    if (change < -5) priceScore -= 3;
    else if (change < -2) priceScore -= 2;
    else if (change < -0.8) priceScore -= 1;

    try {
      try {
        const redditRes = await fetch(
          `https://www.reddit.com/search.json?q=${coinParam}%20crypto&sort=new&limit=10`,
          {
            headers: {
              "User-Agent": "CryptoAISentimentApp/1.0",
            },
            signal: AbortSignal.timeout(8000),
          },
        );

        const redditData = await redditRes.json();

        const posts = redditData?.data?.children || [];

        const bullishWords = [
          "buy",
          "bullish",
          "moon",
          "pump",
          "breakout",
          "long",
        ];
        const bearishWords = [
          "sell",
          "bearish",
          "dump",
          "crash",
          "short",
          "fear",
        ];

        posts.forEach((post) => {
          const title = post.data.title.toLowerCase();

          bullishWords.forEach((word) => {
            if (title.includes(word)) redditScore += 1;
          });

          bearishWords.forEach((word) => {
            if (title.includes(word)) redditScore -= 1;
          });
        });

        if (redditScore > 1) {
          reasons.push("Reddit sentiment is bullish.");
        } else if (redditScore < -1) {
          reasons.push("Reddit sentiment is bearish.");
        } else {
          reasons.push("Reddit sentiment is neutral.");
        }
      } catch (error) {
        console.log("Reddit unavailable:", error.message);
        reasons.push("Reddit sentiment is currently unavailable.");
      }
    } catch (err) {
      console.log("Reddit system error:", err.message);

      reasons.push("Reddit sentiment temporarily unavailable.");
    }

    const finalScore = priceScore + newsScore + redditScore;
    const pastSignals = await Signal.find({
      coin: coinParam.toUpperCase(),
      checked: true,
    })
      .sort({ createdAt: -1 })
      .limit(30);

    const learningScore = pastSignals.reduce(
      (sum, signal) => sum + signal.accuracyImpact,
      0,
    );

    let learningAdjustment = 0;

    if (learningScore >= 10) {
      learningAdjustment = 2;
    } else if (learningScore >= 5) {
      learningAdjustment = 1;
    }

    if (learningScore <= -10) {
      learningAdjustment = -2;
    } else if (learningScore <= -5) {
      learningAdjustment = -1;
    }

    const adjustedFinalScore = finalScore + learningAdjustment;

    let fearGreedMood = "Neutral";

    if (redditScore >= 4 || newsScore >= 6) {
      fearGreedMood = "Greed";
    }

    if (redditScore >= 7 || finalScore >= 8) {
      fearGreedMood = "Extreme Greed";
    }

    if (redditScore <= -4 || newsScore <= -6) {
      fearGreedMood = "Fear";
    }

    if (redditScore <= -7 || finalScore <= -8) {
      fearGreedMood = "Extreme Fear";
    }

    let emergencyWarning = null;

    let threatLevel = "Low";

    if (highImpactCount >= 3 && newsScore < 0 && redditScore < 0) {
      threatLevel = "High";
    }

    if (highImpactCount >= 5 && newsScore <= -6) {
      threatLevel = "Extreme";
      emergencyWarning =
        "Extreme market risk detected. Possible panic or macroeconomic shock.";
    }

    if (highImpactCount >= 4 && newsScore < 0) {
      emergencyWarning = "Extreme macroeconomic or regulatory risk detected.";
    }

    let marketRegime = "Sideways";

    if (finalScore >= 6) {
      marketRegime = "Bull Market";
    }

    if (finalScore <= -6) {
      marketRegime = "Bear Market";
    }

    let action = "HOLD / WAIT";
    let risk = "Medium";
    let reason = "Mixed market condition. Wait for stronger confirmation.";

    if (adjustedFinalScore >= 5) {
      action = "ENTER / BUY";
      risk = highImpactCount >= 2 ? "Medium-High" : "Medium";
      reason =
        "Bullish price action and positive market news are aligned. Entry is possible after confirmation.";
    } else if (adjustedFinalScore >= 2) {
      action = "BUY WATCH";
      risk = "Medium";
      reason =
        "Market is leaning bullish, but the signal is not strong enough for aggressive entry.";
    } else if (adjustedFinalScore <= -5) {
      action = "EXIT / AVOID";
      risk = "High";
      reason =
        "Bearish news and negative price action are aligned. Avoid entry or reduce risk.";
    } else if (adjustedFinalScore <= -2) {
      action = "SELL WATCH";
      risk = "Medium-High";
      reason =
        "Market is leaning bearish. Protect capital and wait before entering.";
    }

    let confidence = 50 + Math.abs(adjustedFinalScore) * 6;

    if (learningAdjustment > 0) {
      confidence += 5;
    }

    if (learningAdjustment < 0) {
      confidence -= 5;
    }

    confidence = Math.min(96, confidence);

    const support = price * 0.97;
    const resistance = price * 1.03;
    const stopLoss = price * 0.95;

    const existingRecentSignal = await Signal.findOne({
      coin: coinParam.toUpperCase(),
      createdAt: {
        $gte: new Date(Date.now() - 10 * 60 * 1000),
      },
    });

    if (!existingRecentSignal) {
      await Signal.create({
        coin: coinParam.toUpperCase(),
        price,
        change: change.toFixed(2),
        action,
        confidence: `${confidence}%`,
        risk,
        newsScore,
        priceScore,
        redditScore,
        finalScore,
        marketRegime,
        fearGreedMood,
        reasons: [...new Set(reasons)],
      });
    }

    res.json({
      coin: coinParam.toUpperCase(),
      price,
      change: change.toFixed(2),
      action,
      confidence: `${confidence}%`,
      risk,
      entry:
        action.includes("BUY") || action.includes("ENTER")
          ? `Enter near $${support.toFixed(2)} after confirmation candle`
          : "Wait. No safe entry yet.",
      exit:
        action.includes("EXIT") || action.includes("SELL")
          ? `Exit or reduce position near $${price.toFixed(2)}`
          : `Take profit near $${resistance.toFixed(2)}`,
      stopLoss: `$${stopLoss.toFixed(2)}`,
      support: `$${support.toFixed(2)}`,
      resistance: `$${resistance.toFixed(2)}`,
      newsScore,
      priceScore,
      finalScore,
      adjustedFinalScore,
      learningAdjustment,
      marketRegime,
      emergencyWarning,
      threatLevel,
      fearGreedMood,
      highImpactNews: highImpactCount,
      reason,
      reasons: [...new Set(reasons)],
      news: newsItems.slice(0, 5).map((item) => ({
        title: item.title,
        link: item.link,
        date: item.pubDate,
      })),
      learningScore,
      aiLevel: "Level 4 Adaptive AI",
    });
  } catch (error) {
    console.error("========== AI SIGNAL ERROR ==========");
    console.error(error);
    console.error(error.message);
    console.error(error.stack);

    res.status(500).json({
      error: error.message,
    });
  }
});

app.get("/api/signals/history/:coin", async (req, res) => {
  try {
    const coin = req.params.coin.toUpperCase();

    const signals = await Signal.find({ coin })
      .sort({ createdAt: -1 })
      .limit(20);

    res.json(signals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/signals/check-outcomes", async (req, res) => {
  try {
    const oldSignals = await Signal.find({
      checked: false,
      createdAt: {
        $lte: new Date(Date.now() - 60 * 60 * 1000),
      },
    }).limit(50);

    const results = [];

    for (const signal of oldSignals) {
      const currentPrice = await getCoinPrice(signal.coin);

      if (!currentPrice) continue;

      const resultChange = ((currentPrice - signal.price) / signal.price) * 100;

      let outcome = "Neutral";
      let accuracyImpact = 0;

      if (signal.action.includes("BUY") || signal.action.includes("ENTER")) {
        if (resultChange > 1) {
          outcome = "Correct";
          accuracyImpact = 1;
        } else if (resultChange < -1) {
          outcome = "Wrong";
          accuracyImpact = -1;
        }
      }

      if (
        signal.action.includes("SELL") ||
        signal.action.includes("EXIT") ||
        signal.action.includes("AVOID")
      ) {
        if (resultChange < -1) {
          outcome = "Correct";
          accuracyImpact = 1;
        } else if (resultChange > 1) {
          outcome = "Wrong";
          accuracyImpact = -1;
        }
      }

      if (signal.action.includes("HOLD")) {
        if (Math.abs(resultChange) < 1.5) {
          outcome = "Correct";
          accuracyImpact = 1;
        } else {
          outcome = "Neutral";
          accuracyImpact = 0;
        }
      }

      signal.checked = true;
      signal.resultPrice = currentPrice;
      signal.resultChange = Number(resultChange.toFixed(2));
      signal.outcome = outcome;
      signal.accuracyImpact = accuracyImpact;

      await signal.save();

      results.push({
        coin: signal.coin,
        action: signal.action,
        entryPrice: signal.price,
        resultPrice: currentPrice,
        resultChange: signal.resultChange,
        outcome,
      });
    }

    res.json({
      checked: results.length,
      results,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/signals/performance/:coin", async (req, res) => {
  try {
    const coin = req.params.coin.toUpperCase();

    const signals = await Signal.find({
      coin,
      checked: true,
    });

    const total = signals.length;
    const correct = signals.filter((s) => s.outcome === "Correct").length;
    const wrong = signals.filter((s) => s.outcome === "Wrong").length;

    const accuracy = total > 0 ? ((correct / total) * 100).toFixed(2) : "0.00";

    const learningScore = signals.reduce(
      (sum, signal) => sum + signal.accuracyImpact,
      0,
    );

    res.json({
      coin,
      totalChecked: total,
      correct,
      wrong,
      accuracy: `${accuracy}%`,
      learningScore,
      status:
        Number(accuracy) >= 60
          ? "AI model is performing well."
          : "AI model needs more data.",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function checkSignalOutcomes() {
  try {
    const oldSignals = await Signal.find({
      checked: false,
      createdAt: {
        $lte: new Date(Date.now() - 60 * 60 * 1000),
      },
    }).limit(50);

    for (const signal of oldSignals) {
      const currentPrice = await getCoinPrice(signal.coin);
      if (!currentPrice) continue;

      const resultChange = ((currentPrice - signal.price) / signal.price) * 100;

      let outcome = "Neutral";
      let accuracyImpact = 0;

      if (signal.action.includes("BUY") || signal.action.includes("ENTER")) {
        if (resultChange > 1) {
          outcome = "Correct";
          accuracyImpact = 1;
        } else if (resultChange < -1) {
          outcome = "Wrong";
          accuracyImpact = -1;
        }
      }

      if (
        signal.action.includes("SELL") ||
        signal.action.includes("EXIT") ||
        signal.action.includes("AVOID")
      ) {
        if (resultChange < -1) {
          outcome = "Correct";
          accuracyImpact = 1;
        } else if (resultChange > 1) {
          outcome = "Wrong";
          accuracyImpact = -1;
        }
      }

      if (signal.action.includes("HOLD")) {
        if (Math.abs(resultChange) < 1.5) {
          outcome = "Correct";
          accuracyImpact = 1;
        }
      }

      signal.checked = true;
      signal.resultPrice = currentPrice;
      signal.resultChange = Number(resultChange.toFixed(2));
      signal.outcome = outcome;
      signal.accuracyImpact = accuracyImpact;

      await signal.save();
    }

    console.log("AI outcome check completed.");
  } catch (error) {
    console.log("Auto outcome check error:", error.message);
  }
}

setInterval(checkSignalOutcomes, 30 * 60 * 1000);
checkSignalOutcomes();

app.get("/api/ai-health/:coin", async (req, res) => {
  try {
    const coin = req.params.coin.toUpperCase();

    const signals = await Signal.find({ coin })
      .sort({ createdAt: -1 })
      .limit(100);

    const checkedSignals = signals.filter((s) => s.checked);
    const correct = checkedSignals.filter(
      (s) => s.outcome === "Correct",
    ).length;
    const wrong = checkedSignals.filter((s) => s.outcome === "Wrong").length;

    const accuracy =
      checkedSignals.length > 0
        ? Number(((correct / checkedSignals.length) * 100).toFixed(2))
        : 0;

    const avgFinalScore =
      signals.length > 0
        ? Number(
            (
              signals.reduce((sum, s) => sum + (s.finalScore || 0), 0) /
              signals.length
            ).toFixed(2),
          )
        : 0;

    const learningScore = checkedSignals.reduce(
      (sum, s) => sum + (s.accuracyImpact || 0),
      0,
    );

    let aiHealth = "Collecting Data";

    if (checkedSignals.length >= 10 && accuracy >= 65) {
      aiHealth = "Strong";
    } else if (checkedSignals.length >= 10 && accuracy >= 50) {
      aiHealth = "Stable";
    } else if (checkedSignals.length >= 10 && accuracy < 50) {
      aiHealth = "Weak";
    }

    res.json({
      coin,
      totalSignals: signals.length,
      checkedSignals: checkedSignals.length,
      correct,
      wrong,
      accuracy: `${accuracy}%`,
      learningScore,
      avgFinalScore,
      aiHealth,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/trade-journal/:coin", async (req, res) => {
  try {
    const coin = req.params.coin.toUpperCase();

    const journal = await Signal.find({ coin })
      .sort({ createdAt: -1 })
      .limit(50)
      .select(
        "coin price action confidence risk finalScore resultPrice resultChange outcome fearGreedMood marketRegime createdAt",
      );

    res.json(journal);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Crypto AI Agent running at http://localhost:${PORT}`);
});
